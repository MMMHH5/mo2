import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { Prisma } from '@prisma/client';
import { UsersService } from '../src/users/users.service';

/**
 * Deleting a user that other rows still point at must say so.
 *
 * `Enrollment.student`, `Course.instructor` and `CourseOpening.instructor` all
 * declare `onDelete: Restrict` on purpose: a student's payment history and an
 * instructor's course cannot vanish with the account. The refusal is correct, but
 * a bare `prisma.user.delete` let Prisma's `P2003` escape, and the global filter
 * turned it into a 500. An admin deleting any student who has ever enrolled saw
 * a server fault and no reason at all. A 409 naming the constraint is the whole
 * difference between "the platform is broken" and "this account has history".
 */

const P2003 = (field = 'Enrollment_studentId_fkey (required)') =>
    new Prisma.PrismaClientKnownRequestError('Foreign key constraint failed', {
        code: 'P2003',
        clientVersion: '5.0.0',
        meta: { field_name: field },
    });

const build = (impl: (args: any) => Promise<any>) => {
    const prisma = { user: { delete: impl } };
    const audit = { logAction: async () => {} };
    return new UsersService(prisma as never, audit as never);
};

describe('admin user deletion explains a relational-integrity refusal', () => {
    test('a referenced user answers 409, never 500', async () => {
        const svc = build(async () => { throw P2003(); });
        await assert.rejects(
            () => svc.remove('u1', 'admin-1'),
            (err: any) => {
                assert.equal(err.getStatus?.(), 409);
                assert.equal(err.response?.code, 'USER_HAS_REFERENCING_RECORDS');
                assert.match(err.response?.message, /cannot be deleted/i);
                return true;
            },
        );
    });

    test('the refusal names the table that is holding the row', async () => {
        const svc = build(async () => { throw P2003('Enrollment_studentId_fkey (required)'); });
        await assert.rejects(
            () => svc.remove('u1', 'admin-1'),
            (err: any) => {
                assert.deepEqual(err.response?.references, ['Enrollment_studentId_fkey (required)']);
                return true;
            },
        );
    });

    test('the refusal survives a constraint that reports no field name', async () => {
        const svc = build(async () => {
            throw new Prisma.PrismaClientKnownRequestError('Foreign key constraint failed', {
                code: 'P2003',
                clientVersion: '5.0.0',
                meta: {},
            });
        });
        await assert.rejects(
            () => svc.remove('u1', 'admin-1'),
            (err: any) => {
                assert.equal(err.getStatus?.(), 409);
                assert.deepEqual(err.response?.references, []);
                return true;
            },
        );
    });

    test('an unknown id answers 404 instead of 500', async () => {
        const svc = build(async () => {
            throw new Prisma.PrismaClientKnownRequestError('Record to delete does not exist', {
                code: 'P2025',
                clientVersion: '5.0.0',
            });
        });
        await assert.rejects(
            () => svc.remove('u1', 'admin-1'),
            (err: any) => err.getStatus?.() === 404,
        );
    });

    test('a deletable user is still deleted', async () => {
        let deleted = false;
        const svc = build(async () => { deleted = true; return { id: 'u1' }; });
        const row = await svc.remove('u1', 'admin-1');
        assert.equal(deleted, true);
        assert.equal(row.id, 'u1');
    });

    test('an unrelated failure is not swallowed into a 409', async () => {
        const svc = build(async () => { throw new Error('connection reset'); });
        await assert.rejects(
            () => svc.remove('u1', 'admin-1'),
            (err: any) => !(err.getStatus?.() === 409),
        );
    });
});
