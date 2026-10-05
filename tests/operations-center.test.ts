import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { parseUserAgent, pickSafeMeta, clampText } from '../src/operations/operations-parser';
import { OperationsService, readCookie } from '../src/operations/operations.service';
import { OperationsKeyService, OperationsTrackerMiddleware } from '../src/operations/operations-tracker.middleware';
import { OperationsController } from '../src/operations/operations.controller';
import { EventsQueryDto, SessionsQueryDto } from '../src/operations/dto/operations.dto';
import { plainToInstance } from 'class-transformer';
import { UnauthorizedException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Tests for the operations center.
 *
 * The security-relevant claims are the ones asserted here, because each is a
 * boundary that a later refactor can quietly break:
 *
 *   - the second password must fail CLOSED when unset (an unset key locking the
 *     page is correct; an unset key opening it is a catastrophic regression),
 *   - a grant must not be substitutable by a normal access token,
 *   - request bodies must never reach the event log,
 *   - a browser must not be able to forge a server-authored event type,
 *   - the visitor cache must not grow without bound,
 *   - a session must never be labelled with an unverified token identity.
 */

const SECRET = 'a'.repeat(48);

function buildService(over: { onTouch?: () => void } = {}) {
    const prisma: any = {
        visitSession: {
            findUnique: async () => null,
            create: async ({ data }: any) => ({ id: `sess_${data.visitorId.slice(0, 8)}` }),
            update: async () => {
                over.onTouch?.();
            },
        },
        visitEvent: { create: async () => ({}) },
    };
    return new OperationsService(prisma);
}

function req(over: { headers?: Record<string, unknown>; url?: string; method?: string; ip?: string; cookie?: string } = {}) {
    return {
        headers: {
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0 Safari/537.36',
            // Cookies reach the server in the `Cookie` header, which is what the
            // hand-rolled reader parses -- `req.cookies` only exists once
            // cookie-parser has run, and this app does not use it.
            ...(over.cookie !== undefined ? { cookie: over.cookie } : {}),
            ...(over.headers ?? {}),
        },
        originalUrl: over.url ?? '/courses',
        url: over.url ?? '/courses',
        method: over.method ?? 'GET',
        ip: over.ip ?? '203.0.113.7',
    } as any;
}

describe('OPERATIONS: user-agent classification', () => {
    test('distinguishes Chromium from Safari', () => {
        // The ordering bug this guards: Chrome's UA contains "Safari", so a
        // naive Safari-first check reports every Chromium browser as Safari.
        const chrome = parseUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        assert.equal(chrome.browser, 'Chrome');
        assert.equal(chrome.os, 'Windows');

        const safari = parseUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15');
        assert.equal(safari.browser, 'Safari');
        assert.equal(safari.os, 'macOS');
    });

    test('detects Edge and Opera before their Chrome claim', () => {
        assert.equal(parseUserAgent('Mozilla/5.0 (Windows NT 10.0) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0').browser, 'Edge');
        assert.equal(parseUserAgent('Mozilla/5.0 (Windows NT 10.0) Chrome/120.0.0.0 Safari/537.36 OPR/106.0.0.0').browser, 'Opera');
    });

    test('separates tablet from phone', () => {
        const ipad = parseUserAgent('Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Safari/604.1');
        assert.equal(ipad.deviceType, 'tablet');
        assert.equal(ipad.os, 'iOS');

        const iphone = parseUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1');
        assert.equal(iphone.deviceType, 'mobile');

        const androidPhone = parseUserAgent('Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36');
        assert.equal(androidPhone.deviceType, 'mobile');
        assert.equal(androidPhone.os, 'Android');

        const androidTablet = parseUserAgent('Mozilla/5.0 (Linux; Android 13; SM-X200) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36');
        assert.equal(androidTablet.deviceType, 'tablet');
    });

    test('classifies crawlers as bots, not desktop browsers', () => {
        // A bot UA usually also carries "Safari" and "Intel"; if bot detection
        // ran after browser detection it would show up in the desktop list and
        // bury genuine traffic.
        for (const ua of [
            'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
            'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
            'facebookexternalhit/1.1',
            'curl/8.4.0',
            'PostmanRuntime/7.35.0',
            'python-requests/2.31.0',
        ]) {
            const parsed = parseUserAgent(ua);
            assert.equal(parsed.isBot, true, `expected bot: ${ua}`);
            assert.equal(parsed.deviceType, 'bot');
        }
    });

    test('separates smart TVs from desktop Linux', () => {
        const parsed = parseUserAgent('Mozilla/5.0 (Linux; Android 11; SmartTV) AppleWebKit/537.36 Chrome/94.0 Safari/537.36');
        assert.equal(parsed.deviceType, 'tv');
    });

    test('returns unknown rather than guessing on an empty UA', () => {
        for (const input of ['', '   ', null, undefined]) {
            const parsed = parseUserAgent(input as any);
            assert.equal(parsed.deviceType, 'unknown');
            assert.equal(parsed.isBot, false);
        }
    });
});

describe('OPERATIONS: event metadata cannot become a credential store', () => {
    test('drops everything not on the allow-list', () => {
        const meta = pickSafeMeta({
            resourceId: 'course_123',
            count: 4,
            // The shapes that must never be persisted:
            password: 'hunter2',
            token: 'eyJhbGciOi...',
            cardNumber: '4242424242424242',
            cvv: '123',
            email: 'victim@example.com',
        });
        assert.deepEqual(meta, { resourceId: 'course_123', count: 4 });
        assert.equal(JSON.stringify(meta).includes('hunter2'), false);
        assert.equal(JSON.stringify(meta).includes('4242'), false);
    });

    test('ignores non-scalars and long strings', () => {
        assert.equal(pickSafeMeta({ resourceId: { nested: true } }), undefined);
        const clamped = pickSafeMeta({ resourceId: 'x'.repeat(500) })!.resourceId;
        assert.equal(typeof clamped, 'string');
        assert.equal((clamped as string).length, 120);
        assert.equal(pickSafeMeta(null), undefined);
        assert.equal(pickSafeMeta([1, 2, 3]), undefined);
        assert.equal(pickSafeMeta('a string'), undefined);
    });

    test('clamps text and treats blanks as absent', () => {
        assert.equal(clampText('x'.repeat(900), 512)!.length, 512);
        assert.equal(clampText('   ', 10), null);
        assert.equal(clampText(undefined, 10), null);
        assert.equal(clampText('hello', 10), 'hello');
    });
});

describe('OPERATIONS: the second password fails closed', () => {
    beforeEach(() => {
        process.env.OPERATIONS_KEY = 'correct-horse-battery-staple';
        process.env.JWT_SECRET = SECRET;
    });

    test('rejects when OPERATIONS_KEY is unset', () => {
        delete process.env.OPERATIONS_KEY;
        const svc = buildService();
        // This is the load-bearing assertion of the whole feature: an unset
        // variable must LOCK the page. If it ever returns true, anyone with an
        // admin token can read the device log with no second factor.
        assert.equal(svc.verifyOperationsKey('anything'), false);
        assert.equal(svc.verifyOperationsKey(undefined), false);
    });

    test('rejects wrong, right-length-wrong, and empty keys', () => {
        const svc = buildService();
        assert.equal(svc.verifyOperationsKey('wrong'), false);
        assert.equal(svc.verifyOperationsKey('correct-horse-battery-stapl'), false, 'prefix must not pass');
        assert.equal(svc.verifyOperationsKey('correct-horse-battery-staples'), false, 'extension must not pass');
        assert.equal(svc.verifyOperationsKey(''), false);
        assert.equal(svc.verifyOperationsKey(undefined), false);
    });

    test('accepts only the exact key', () => {
        const svc = buildService();
        assert.equal(svc.verifyOperationsKey('correct-horse-battery-staple'), true);
    });
});

describe('OPERATIONS: a grant is not interchangeable with an access token', () => {
    beforeEach(() => {
        process.env.JWT_SECRET = SECRET;
    });

    test('issues a grant that verifies for its own user only', () => {
        const keys = new OperationsKeyService(buildService());
        const { grant } = keys.issueGrant('admin-1');
        assert.equal(keys.verifyGrant(grant, 'admin-1'), true);
        // Bound to the subject: a grant lifted from one admin must not unlock
        // the page for another.
        assert.equal(keys.verifyGrant(grant, 'admin-2'), false);
    });

    test('refuses a plain access token, which carries no opsGrant claim', () => {
        // This is the collision that matters: an admin's everyday bearer token
        // must NOT satisfy the operations gate, or the second password is
        // decorative. Minted with the same secret and algorithm on purpose.
        const jwt = require('jsonwebtoken');
        const accessToken = jwt.sign({ sub: 'admin-1', email: 'a@b.c', role: 'ADMIN', tv: 0 }, SECRET, { algorithm: 'HS256' });
        const keys = new OperationsKeyService(buildService());
        assert.equal(keys.verifyGrant(accessToken, 'admin-1'), false);
    });

    test('refuses garbage and a tampered grant', () => {
        const keys = new OperationsKeyService(buildService());
        assert.equal(keys.verifyGrant('not-a-token', 'admin-1'), false);
        assert.equal(keys.verifyGrant(undefined, 'admin-1'), false);

        const { grant } = keys.issueGrant('admin-1');
        const jwt = require('jsonwebtoken');
        // Re-sign the same claims with the attacker's own key.
        const forged = jwt.sign({ sub: 'admin-1', opsGrant: true }, 'attacker-secret', { algorithm: 'HS256' });
        assert.equal(keys.verifyGrant(forged, 'admin-1'), false);
        assert.notEqual(grant, forged);
    });

    test('an expired grant stops working', () => {
        const jwt = require('jsonwebtoken');
        const keys = new OperationsKeyService(buildService());
        const expired = jwt.sign({ sub: 'admin-1', opsGrant: true }, SECRET, { algorithm: 'HS256', expiresIn: -10 });
        assert.equal(keys.verifyGrant(expired, 'admin-1'), false);
    });
});

describe('OPERATIONS: the session is never labelled with an unverified identity', () => {
    /**
     * The middleware labels a session with the token's `sub` before the guards
     * run. That label is what the UI shows as "who did this", so a forged token
     * would file someone else's activity under a real account -- the exact thing
     * an audit log must not allow.
     */
    /** `secret: null` simulates an unset JWT_SECRET. */
    function userIdFor(authorization: string | undefined, secret: string | null = SECRET): string | null {
        const previous = process.env.JWT_SECRET;
        if (secret === null) delete process.env.JWT_SECRET;
        else process.env.JWT_SECRET = secret;
        try {
            const mw: any = new OperationsTrackerMiddleware(buildService());
            return mw.readUserId({ headers: authorization ? { authorization } : {} });
        } finally {
            if (previous === undefined) delete process.env.JWT_SECRET;
            else process.env.JWT_SECRET = previous;
        }
    }

    test('reads the subject from a correctly signed token', () => {
        const jwt = require('jsonwebtoken');
        const token = jwt.sign({ sub: 'user-7', role: 'STUDENT' }, SECRET, { algorithm: 'HS256' });
        assert.equal(userIdFor(`Bearer ${token}`), 'user-7');
    });

    test('ignores a self-signed token that names somebody else', () => {
        const jwt = require('jsonwebtoken');
        const forged = jwt.sign({ sub: 'admin-1' }, 'attacker-secret', { algorithm: 'HS256' });
        assert.equal(userIdFor(`Bearer ${forged}`), null);
    });

    test('ignores an unsigned alg-none token', () => {
        // `alg: none` is the classic downgrade: verification must not be skipped.
        const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
        const body = Buffer.from(JSON.stringify({ sub: 'admin-1' })).toString('base64url');
        assert.equal(userIdFor(`Bearer ${header}.${body}.`), null);
    });

    test('an absent or malformed header yields null rather than throwing', () => {
        assert.equal(userIdFor(undefined), null);
        assert.equal(userIdFor('Basic dXNlcjpwYXNz'), null);
        assert.equal(userIdFor('Bearer not-a-token'), null);
    });

    test('with no JWT_SECRET configured the session is simply anonymous', () => {
        const jwt = require('jsonwebtoken');
        // Failing open here would mean an unconfigured deployment quietly labels
        // every session, so the safe direction is to treat it as anonymous.
        const token = jwt.sign({ sub: 'user-7' }, SECRET, { algorithm: 'HS256' });
        assert.equal(userIdFor(`Bearer ${token}`, null), null);
    });
});

describe('OPERATIONS: the session cache stays bounded', () => {
    test('expires and prunes entries', () => {
        const svc = buildService();
        const now = Date.now();
        svc.sessionCache.set('a', { sessionId: '1', expiresAt: now - 1, authenticated: false });
        svc.sessionCache.set('b', { sessionId: '2', expiresAt: now + 60_000, authenticated: false });
        assert.equal(svc.pruneSessionCache(now), 1);
        assert.equal(svc.sessionCache.size, 1);
    });

    test('a repeat request does not re-read the session row', async () => {
        // The reason the cache exists: without it, every request on the platform
        // costs a SELECT, and the anonymous majority is most of the traffic.
        let reads = 0;
        const prisma: any = {
            visitSession: {
                findUnique: async () => { reads++; return { id: 'existing', userId: null }; },
                create: async () => ({ id: 'created' }),
                update: async () => {},
            },
            visitEvent: { create: async () => ({}) },
        };
        const svc = new OperationsService(prisma);
        const request = req({ cookie: 'laxalab_vid=11111111-1111-4111-8111-111111111111' });

        for (let i = 0; i < 10; i++) await svc.resolveSession(request, { userId: null });
        assert.equal(reads, 1, 'expected exactly one lookup for ten requests');
    });
});

describe('OPERATIONS: concurrent first visits do not error', () => {
    test('a unique-index collision resolves to the winning row', async () => {
        // visitorId is UNIQUE, and a browser fires several requests at once on
        // first load. Both miss the SELECT and race into INSERT; the loser gets
        // P2002 and must recover by re-reading, not throw.
        let creates = 0;
        const prisma: any = {
            visitSession: {
                findUnique: async ({ where }: any) => {
                    if (creates > 0) return { id: 'winner', userId: null };
                    return null;
                },
                create: async () => {
                    creates++;
                    if (creates === 1) {
                        const err: any = new Error('Unique constraint failed');
                        err.code = 'P2002';
                        throw err;
                    }
                    return { id: 'winner' };
                },
                update: async () => {},
            },
            visitEvent: { create: async () => ({}) },
        };
        const svc = new OperationsService(prisma);
        const request = req({ cookie: 'laxalab_vid=22222222-2222-4222-8222-222222222222' });
        const result = await svc.resolveSession(request, { userId: null });
        assert.ok(result, 'a collision must resolve, not throw');
        assert.equal(result.sessionId, 'winner');
        assert.equal(result.isNew, false);
    });
});

describe('OPERATIONS: the controller enforces the gates', () => {
    function buildController(grantValid: boolean) {
        const keys = {
            issueGrant: () => ({ grant: 'g', expiresAt: 'later' }),
            verifyGrant: () => grantValid,
        } as any;
        const ops = {
            verifyOperationsKey: () => true,
            trackClientEvent: async () => {},
            enrichSession: async () => {},
            trackSecurity: async () => {},
        } as any;
        const queries = {
            overview: async () => ({ ok: true }),
            timeline: async () => ({}),
            events: async () => ({ items: [], total: 0 }),
            sessions: async () => ({ items: [], total: 0 }),
            sessionDetail: async () => null,
            filterOptions: async () => ({}),
        } as any;
        return new OperationsController(ops, queries, keys);
    }

    test('a locked page rejects every read endpoint', async () => {
        const controller = buildController(false);
        const r = req();
        r.user = { userId: 'admin-1' };
        // `overview` throws synchronously while the others reject, so both shapes
        // are wrapped: the assertion is that the gate fires, not how it surfaces.
        await assert.rejects(async () => controller.overview(r, undefined, {}), UnauthorizedException);
        await assert.rejects(() => controller.events(r, 'bad-grant', {}), UnauthorizedException);
        await assert.rejects(() => controller.sessions(r, undefined, {}), UnauthorizedException);
        await assert.rejects(() => controller.sessionDetail(r, undefined, 'x'), UnauthorizedException);
    });

    test('an unlocked page reads', async () => {
        const controller = buildController(true);
        const r = req();
        r.user = { userId: 'admin-1' };
        assert.deepEqual(await controller.overview(r, 'grant', {}), { ok: true });
    });

    test('a browser cannot forge a server-authored event type', async () => {
        const controller = buildController(true);
        const r = req();
        r.opsSessionId = 'sess-1';
        // `api_call` and `security` are written by the server from the real
        // request. Accepting them from a client would let anyone fabricate
        // history against any device.
        await assert.rejects(
            () => controller.track(r, { type: 'api_call' } as any),
            ForbiddenException,
        );
        await assert.rejects(
            () => controller.track(r, { type: 'security' } as any),
            ForbiddenException,
        );
    });

    test('a browser may record a page view or a named action', async () => {
        const controller = buildController(true);
        const r = req();
        r.opsSessionId = 'sess-1';
        assert.deepEqual(await controller.track(r, { type: 'page_view', path: '/courses' }), { ok: true });
        assert.deepEqual(await controller.track(r, { type: 'action', label: 'enroll.click' }), { ok: true });
    });

    test('tracking without a session is a silent skip, not an error', async () => {
        const controller = buildController(true);
        const r = req();
        r.opsSessionId = null;
        assert.deepEqual(await controller.track(r, { type: 'page_view' }), { ok: true, skipped: true });
    });

    test('a missing session row is a 404', async () => {
        const controller = buildController(true);
        const r = req();
        r.user = { userId: 'admin-1' };
        await assert.rejects(() => controller.sessionDetail(r, 'grant', 'missing'), NotFoundException);
    });
});

describe('OPERATIONS: cookie reading', () => {
    test('finds a named cookie among others', () => {
        const request = req({ cookie: 'a=1; laxalab_vid=abc-123; b=2' });
        assert.equal(readCookie(request, 'laxalab_vid'), 'abc-123');
    });

    test('handles missing, empty and percent-encoded values', () => {
        assert.equal(readCookie(req(), 'laxalab_vid'), null);
        assert.equal(readCookie(req({ cookie: 'other=1' }), 'laxalab_vid'), null);
        assert.equal(readCookie(req({ cookie: 'laxalab_vid=' }), 'laxalab_vid'), '');
        assert.equal(readCookie(req({ cookie: 'laxalab_vid=a%20b' }), 'laxalab_vid'), 'a b');
    });

    test('does not match a cookie whose name is a suffix of another', () => {
        assert.equal(readCookie(req({ cookie: 'evil_laxalab_vid=x' }), 'laxalab_vid'), null);
    });
});

describe('OPERATIONS: query-string booleans are not coerced the wrong way', () => {
    /**
     * The naive transformation reads the string "false" as a truthy value and
     * answers "show me signed-in devices" to a request asking for the opposite,
     * silently.
     */
    function parse<T extends object>(cls: new () => T, query: Record<string, unknown>): T {
        return plainToInstance(cls, query) as T;
    }

    test('"false" stays false rather than flipping to true', () => {
        assert.equal(parse(SessionsQueryDto, { authenticatedOnly: 'false' }).authenticatedOnly, false);
        assert.equal(parse(SessionsQueryDto, { botsOnly: 'false' }).botsOnly, false);
    });

    test('"true" is still true, and 1/0 are understood', () => {
        assert.equal(parse(SessionsQueryDto, { authenticatedOnly: 'true' }).authenticatedOnly, true);
        assert.equal(parse(SessionsQueryDto, { authenticatedOnly: '1' }).authenticatedOnly, true);
        assert.equal(parse(SessionsQueryDto, { botsOnly: '0' }).botsOnly, false);
    });

    test('an absent or empty value stays undefined so no filter is applied', () => {
        assert.equal(parse(SessionsQueryDto, {}).authenticatedOnly, undefined);
        assert.equal(parse(SessionsQueryDto, { authenticatedOnly: '' }).authenticatedOnly, undefined);
        assert.equal(parse(EventsQueryDto, { authenticatedOnly: 'false' }).authenticatedOnly, false);
    });
});

describe('PLATFORM: CORS permits the headers the frontend actually sends', () => {
    /**
     * A custom header forces a preflight, and the browser rejects the request
     * outright when the header is missing from `Access-Control-Allow-Headers` --
     * with no error the API can see or report. `X-Ops-Grant` carries the
     * operations grant, so leaving it out locked the whole page.
     *
     * This reads the real `main.ts` source rather than restating the list, so a
     * header added to the frontend without updating the API fails here.
     */
    function corsAllowedHeaders(): string[] {
        const source = readFileSync(join(__dirname, '..', 'src', 'main.ts'), 'utf8');
        const match = source.match(/allowedHeaders:\s*'([^']+)'/);
        assert.ok(match, 'main.ts must configure enableCors with allowedHeaders');
        return match[1].split(',').map(h => h.trim());
    }

    test('the operations grant header is allowed', () => {
        const allowed = corsAllowedHeaders().map(h => h.toLowerCase());
        assert.ok(
            allowed.includes('x-ops-grant'),
            `x-ops-grant missing from allowedHeaders: ${allowed.join(', ')}`,
        );
    });

    test('the headers every authenticated request needs are still allowed', () => {
        const allowed = corsAllowedHeaders().map(h => h.toLowerCase());
        for (const header of ['content-type', 'authorization']) {
            assert.ok(allowed.includes(header), `${header} missing from allowedHeaders`);
        }
    });
});
