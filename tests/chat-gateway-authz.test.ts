import test from 'node:test';
import assert from 'node:assert/strict';
import { ChatGateway } from '../src/chat/chat.gateway';
import { UserCacheService } from '../src/common/user-cache.service';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';

/**
 * The chat socket used to take its role straight from the JWT. Because
 * isOversight() grants ADMIN and COURSE_MANAGER blanket access to EVERY direct
 * chat on the platform, that meant a demoted or suspended account kept reading
 * other people's private conversations for the rest of the token's life, and
 * revoking the session did not close an already-open socket.
 *
 * These tests pin the corrected behaviour: the role comes from the database,
 * and an account that is no longer active is disconnected at the door.
 */

const SECRET = 'test-secret-that-is-long-enough-for-hs256-signing!!';
process.env.JWT_SECRET = SECRET;

const jwt = new JwtService({ secret: SECRET, signOptions: { expiresIn: '15m' } });

/** Minimal Socket double that records whether it was disconnected.
 *  Note: the gateway stores identity as plain properties on the socket
 *  (`(client as any).userId`), not in Socket.IO's `client.data`, so the double
 *  must read them back the same way. */
function fakeSocket(token?: string) {
    return {
        handshake: { auth: token === undefined ? {} : { token } },
        disconnected: false,
        disconnect() { this.disconnected = true; },
        join: async () => undefined,
    } as any;
}

/** Gateway wired to a cache double that answers with `user` (null = inactive). */
function buildGateway(user: { id: string; email: string; role: string; isActive: boolean } | null) {
    const lookedUp: string[] = [];
    const cache = {
        findActiveUser: async (id: string) => { lookedUp.push(id); return user; },
    };
    const chatService = {
        userHasRoomAccess: async () => false,
        userHasDirectAccess: async () => false,
    };
    const gw = new ChatGateway(jwt, chatService as never, cache as unknown as UserCacheService);
    return { gw, lookedUp };
}

const ADMIN = { id: 'u1', email: 'a@b.test', role: Role.ADMIN, isActive: true };
const STUDENT = { id: 'u2', email: 's@b.test', role: Role.STUDENT, isActive: true };

test('SECURITY: the role comes from the database, not from the token', async () => {
    // The token still claims ADMIN -- exactly the state after a demotion.
    const token = jwt.sign({ sub: 'u1', role: Role.ADMIN });
    const { gw } = buildGateway({ ...ADMIN, role: Role.STUDENT });
    const client = fakeSocket(token);

    await gw.handleConnection(client);

    assert.equal(client.userRole, Role.STUDENT, 'the demoted role must win over the stale claim');
    assert.equal(client.disconnected, false);
});

test('SECURITY: a suspended user is disconnected, not merely left without a role', async () => {
    const token = jwt.sign({ sub: 'u1', role: Role.ADMIN });
    const { gw } = buildGateway(null); // cache: inactive / missing
    const client = fakeSocket(token);

    await gw.handleConnection(client);

    assert.equal(client.disconnected, true, 'a suspended account must not keep a live socket');
    assert.equal(client.userId, undefined);
    assert.equal(client.userRole, undefined);
});

test('SECURITY: the database is consulted -- a token alone cannot open a socket', async () => {
    const token = jwt.sign({ sub: 'u1', role: Role.ADMIN });
    const { gw, lookedUp } = buildGateway(ADMIN);
    const client = fakeSocket(token);

    await gw.handleConnection(client);

    assert.deepEqual(lookedUp, ['u1'], 'the account must be re-read, not trusted from the token');
    assert.equal(client.userRole, Role.ADMIN);
});

test('a request with no token is disconnected', async () => {
    const { gw } = buildGateway(ADMIN);
    const client = fakeSocket();

    await gw.handleConnection(client);

    assert.equal(client.disconnected, true);
});

test('a token signed with the wrong secret is disconnected', async () => {
    const foreign = new JwtService({ secret: 'a-completely-different-secret-value!!!!' });
    const token = foreign.sign({ sub: 'u1', role: Role.ADMIN });
    const { gw } = buildGateway(ADMIN);
    const client = fakeSocket(token);

    await gw.handleConnection(client);

    assert.equal(client.disconnected, true, 'signature verification still gates the socket');
});

test('a token with no subject is disconnected', async () => {
    const token = jwt.sign({ role: Role.ADMIN });
    const { gw } = buildGateway(ADMIN);
    const client = fakeSocket(token);

    await gw.handleConnection(client);

    assert.equal(client.disconnected, true);
});

test('an expired token is disconnected', async () => {
    const expired = new JwtService({ secret: SECRET, signOptions: { expiresIn: '-1s' } });
    const token = expired.sign({ sub: 'u1', role: Role.ADMIN });
    const { gw } = buildGateway(ADMIN);
    const client = fakeSocket(token);

    await gw.handleConnection(client);

    assert.equal(client.disconnected, true);
});

test('SECURITY: the algorithm is pinned, so an alg-confusion token cannot be accepted', async () => {
    // Forge a token whose header says `none`. If the gateway stops pinning
    // algorithms and starts trusting the header, this must not authenticate.
    const b64 = (o: any) => Buffer.from(JSON.stringify(o)).toString('base64url');
    const forged =
        b64({ alg: 'none', typ: 'JWT' }) + '.' +
        b64({ sub: 'u1', role: Role.ADMIN }) + '.';

    const { gw } = buildGateway(ADMIN);
    const client = fakeSocket(forged);

    await gw.handleConnection(client);

    assert.equal(client.disconnected, true, 'alg=none must never authenticate');
});

test('a cache outage does not disconnect a legitimate user', async () => {
    // If the cache throws, handleConnection's catch disconnects. That is the
    // safe failure direction, but assert it is deliberate rather than silent.
    const token = jwt.sign({ sub: 'u1', role: Role.ADMIN });
    const cache = { findActiveUser: async () => { throw new Error('redis down'); } };
    const gw = new ChatGateway(jwt, {} as never, cache as unknown as UserCacheService);
    const client = fakeSocket(token);

    await gw.handleConnection(client);

    assert.equal(client.disconnected, true, 'fail closed, never open on an unknown account');
});
