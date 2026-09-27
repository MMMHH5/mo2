import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { CertificatesService } from '../src/certificates/certificates.service';
import { UsersService } from '../src/users/users.service';
import { EnrollmentsService } from '../src/enrollments/enrollments.service';

/**
 * Regression tests for two defects found while building the profile redesign.
 * Both are the same shape as the audit findings: a value the page needed was
 * never in the payload it was reading.
 *
 *  1. getPublicById returned `student: { id }` and no name, while the print
 *     page derived one from `student.email`. That field is never present, so
 *     every publicly shared certificate printed the literal "Student" (and
 *     "Instructor") — a verifiable certificate that identifies nobody.
 *  2. PATCH /users/me stored `metadata` verbatim. Once a profile form writes
 *     `avatarUrl`, that let a caller persist a `javascript:` payload or an
 *     off-site tracking pixel straight into an `src` attribute.
 */

const noopService: any = {
    logAction: () => Promise.resolve(),
    notify: () => Promise.resolve(),
};

function certsService(prisma: any) {
    return new CertificatesService(prisma, noopService, noopService);
}

/** getPublicById's exact shape: student metadata in, public name out. */
function publicPrisma(student: any, instructor: any) {
    return {
        certificate: {
            findUnique: () =>
                Promise.resolve({
                    id: 'cert-1',
                    verificationCode: 'ABC',
                    issuingDate: new Date('2026-01-01'),
                    verificationStatus: 'VALID',
                    student,
                    course: {
                        id: 'c1',
                        titleAr: 'دورة',
                        titleEn: 'Course',
                        certificateIssued: true,
                        openings: [{ instructor }],
                    },
                }),
        },
    };
}

describe('certificate holder identity', () => {
    test('a public certificate prints the stored name, not "Student"', async () => {
        const prisma = publicPrisma(
            { id: 's1', metadata: { nameEn: 'Mohammed Al-Ahmadi', fullName: 'محمد الأحمدي' } },
            { id: 't1', metadata: { nameEn: 'Sara Instructor' } },
        );
        const out: any = await certsService(prisma).getPublicById('cert-1');
        assert.equal(out.holderName, 'Mohammed Al-Ahmadi');
        assert.equal(out.instructorName, 'Sara Instructor');
    });

    test('the english name wins over the arabic one, because it is the printed one', async () => {
        const prisma = publicPrisma(
            { id: 's1', metadata: { nameAr: 'محمد الأحمدي', nameEn: 'Mohammed Al-Ahmadi' } },
            { id: 't1', metadata: {} },
        );
        const out: any = await certsService(prisma).getPublicById('cert-1');
        assert.equal(out.holderName, 'Mohammed Al-Ahmadi');
    });

    test('the public payload carries neither the email nor the raw metadata', async () => {
        const prisma = publicPrisma(
            { id: 's1', metadata: { nameEn: 'A', phone: '+966500000000' } },
            { id: 't1', metadata: { nameEn: 'T' } },
        );
        const out: any = await certsService(prisma).getPublicById('cert-1');
        assert.deepEqual(out.student, { id: 's1' }, 'identity stays reduced to an id');
        assert.ok(!('email' in out.student), 'email must stay off a public response');
        assert.ok(!('metadata' in out), 'raw metadata must never be echoed back');
        assert.ok(!('phone' in out), 'phone must never be echoed back');
    });

    test('an anonymous visitor gets no email fragment when no name is set', async () => {
        const prisma = publicPrisma({ id: 's1', metadata: null }, { id: 't1', metadata: null });
        const out: any = await certsService(prisma).getPublicById('cert-1');
        assert.equal(out.holderName, '', 'must be empty, never a slice of the email address');
        assert.equal(out.instructorName, '');
    });

    test('the owner view still returns the identity it always did, plus the name', async () => {
        const prisma = {
            certificate: {
                findUnique: () =>
                    Promise.resolve({
                        id: 'cert-1',
                        studentId: 's1',
                        verificationCode: 'ABC',
                        issuingDate: new Date('2026-01-01'),
                        verificationStatus: 'VALID',
                        student: { id: 's1', email: 'mohammed@example.com', metadata: { nameEn: 'Mohammed A' } },
                        course: { id: 'c1', titleAr: 'د', titleEn: 'C', certificateIssued: true },
                    }),
            },
        };
        const out: any = await certsService(prisma).getOne('cert-1', 's1', 'STUDENT' as any);
        assert.deepEqual(out.student, { id: 's1', email: 'mohammed@example.com' }, 'existing contract preserved');
        assert.equal(out.holderName, 'Mohammed A');
        assert.ok(!('metadata' in out.student), 'metadata is reduced to a derived name, not echoed');
    });
});

describe('profile metadata sanitiser', () => {
    const clean = (input: Record<string, unknown>) =>
        (new UsersService({} as any, noopService) as any).sanitizeProfileMetadata(input);

    test('keeps the profile fields the form writes, trimmed', () => {
        const out = clean({ nameEn: '  Mohammed  ', country: 'Saudi Arabia', phone: '+966500000000' });
        assert.equal(out.nameEn, 'Mohammed');
        assert.equal(out.country, 'Saudi Arabia');
        assert.equal(out.phone, '+966500000000');
    });

    test('accepts a real uploads path for the avatar', () => {
        assert.equal(clean({ avatarUrl: '/uploads/avatars/me.png' }).avatarUrl, '/uploads/avatars/me.png');
    });

    test('rejects any avatar that is not one of our uploads', () => {
        const rejected = [
            'javascript:alert(1)',
            'https://evil.example/pixel.png',
            '//evil.example/pixel.png',
            'data:image/svg+xml;base64,AAAA',
            '/uploads/../etc/passwd',
            '/uploads/avatars/me.png?x=<script>',
        ];
        for (const bad of rejected) {
            assert.equal(clean({ avatarUrl: bad }).avatarUrl, undefined, `must reject: ${bad}`);
        }
    });

    test('caps field length and drops unknown keys', () => {
        const out = clean({ nameEn: 'x'.repeat(500), isAdmin: true, passwordHash: 'leak' });
        assert.equal(out.nameEn.length, 120, 'long input is truncated, not stored whole');
        assert.equal(out.isAdmin, undefined, 'a profile form cannot grant itself a role');
        assert.equal(out.passwordHash, undefined);
    });

    test('an empty avatar clears the picture', () => {
        assert.equal(clean({ avatarUrl: '' }).avatarUrl, null);
    });
});

/**
 * The profile's "my courses" tab shows a completion percentage. It is computed
 * in getMyEnrollments so there is one definition of the number, and these lock
 * the degenerate cases: a course with no lessons must read as unknown rather
 * than 0% or NaN, and progress must never exceed 100.
 */
describe('course completion percentage', () => {
    const svc = (rows: any[]) => {
        const prisma = {
            enrollment: { findMany: () => Promise.resolve(rows) },
        };
        return new EnrollmentsService(prisma as any, noopService, noopService as any, {} as any);
    };
    const row = (modules: number, done: number) => ({
        id: 'e1',
        course: { id: 'c1', _count: { modules } },
        _count: { lessonProgress: done },
    });

    test('a course with no lessons reports unknown, not 0% and not NaN', async () => {
        const out: any = await svc([row(0, 0)]).getMyEnrollments('s1');
        assert.equal(out[0].progressPercent, null);
    });

    test('a half-finished course reports 50', async () => {
        const out: any = await svc([row(4, 2)]).getMyEnrollments('s1');
        assert.equal(out[0].progressPercent, 50);
    });

    test('a finished course reports 100', async () => {
        const out: any = await svc([row(10, 10)]).getMyEnrollments('s1');
        assert.equal(out[0].progressPercent, 100);
    });

    test('progress is capped at 100 even if the counts disagree', async () => {
        const out: any = await svc([row(3, 7)]).getMyEnrollments('s1');
        assert.equal(out[0].progressPercent, 100, 'a stale progress row must not render 233%');
    });

    test('a course with one lesson reads 0% before anything is finished', async () => {
        const out: any = await svc([row(1, 0)]).getMyEnrollments('s1');
        assert.equal(out[0].progressPercent, 0);
    });

    test('the existing enrollment payload is left intact', async () => {
        const original = { ...row(4, 1), status: 'APPROVED', opening: { id: 'o1', status: 'OPEN' } };
        const out: any = await svc([original]).getMyEnrollments('s1');
        assert.equal(out[0].id, 'e1');
        assert.equal(out[0].status, 'APPROVED');
        assert.deepEqual(out[0].opening, { id: 'o1', status: 'OPEN' }, 'my-courses still reads these');
        assert.equal(out[0].course._count.modules, 4, 'the raw count is still available');
    });
});
