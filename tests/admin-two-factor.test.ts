import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { NotFoundException } from '@nestjs/common';
import { UsersService } from '../src/users/users.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuditService } from '../src/audit/audit.service';
import { UserCacheService } from '../src/common/user-cache.service';

describe('admin two-factor reset', () => {
    test('disables 2FA, revokes sessions, evicts the user cache, and audits the admin action', async () => {
        const calls: string[] = [];
        const prisma = {
            user: {
                findUnique: async () => ({ id: 'target-1', email: 'target@example.test', twoFactorEnabled: true }),
                update: async ({ data }: { data: Record<string, unknown> }) => {
                    calls.push('disable');
                    assert.equal(data.twoFactorEnabled, false);
                    assert.equal(data.twoFactorSecret, null);
                    assert.deepEqual(data.tokenVersion, { increment: 1 });
                    return { id: 'target-1', email: 'target@example.test', twoFactorEnabled: false };
                },
            },
            refreshToken: {
                updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
                    calls.push('revoke-sessions');
                    assert.deepEqual(where, { userId: 'target-1', revokedAt: null });
                    assert.ok(data.revokedAt instanceof Date);
                    return { count: 2 };
                },
            },
            $transaction: async (operations: Promise<unknown>[]) => Promise.all(operations),
        };
        const auditCalls: unknown[][] = [];
        const service = new UsersService(
            prisma as unknown as PrismaService,
            { logAction: async (...args: unknown[]) => { auditCalls.push(args); } } as unknown as AuditService,
            { invalidate: async (id: string) => { calls.push(`invalidate:${id}`); } } as unknown as UserCacheService,
        );

        const result = await service.disableUserTwoFactor('target-1', 'admin-1', '127.0.0.1');

        assert.deepEqual(result, { ok: true, twoFactorEnabled: false });
        assert.deepEqual(calls, ['disable', 'revoke-sessions', 'invalidate:target-1']);
        assert.deepEqual(auditCalls, [[
            'ADMIN admin-1 disabled two-factor authentication for user target-1 (target@example.test)',
            '127.0.0.1',
            'admin-1',
        ]]);
    });

    test('does not rewrite an account when 2FA is already disabled', async () => {
        let writes = 0;
        const service = new UsersService(
            {
                user: {
                    findUnique: async () => ({ id: 'target-1', email: 'target@example.test', twoFactorEnabled: false }),
                    update: async () => { writes += 1; },
                },
            } as unknown as PrismaService,
            {} as AuditService,
            {} as UserCacheService,
        );

        assert.deepEqual(await service.disableUserTwoFactor('target-1', 'admin-1'), {
            ok: true,
            twoFactorEnabled: false,
        });
        assert.equal(writes, 0);
    });

    test('returns not found for a missing account', async () => {
        const service = new UsersService(
            { user: { findUnique: async () => null } } as unknown as PrismaService,
            {} as AuditService,
            {} as UserCacheService,
        );

        await assert.rejects(() => service.disableUserTwoFactor('missing', 'admin-1'), NotFoundException);
    });
});
