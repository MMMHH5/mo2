import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { OpeningActivityService } from '../src/courses/opening-activity.service';

function makeHarness(openingCount: number) {
    const calls: Record<string, any> = {};
    const opening = {
        id: 'opening-1',
        nameAr: 'الدفعة',
        nameEn: 'Batch',
        status: 'STARTED',
        startDate: null,
        endDate: null,
        courseId: 'course-1',
        course: { titleAr: 'الدورة', titleEn: 'Course' },
        instructor: { id: 'teacher-1', email: 'teacher@example.test', metadata: null },
    };
    const prisma: any = {
        courseOpening: {
            findUnique: async () => opening,
            count: async () => openingCount,
        },
        enrollment: { findMany: async (args: unknown) => { calls.enrollments = args; return []; } },
        module: { findMany: async () => [] },
        courseTask: { findMany: async (args: unknown) => { calls.tasks = args; return []; } },
        quiz: { findMany: async (args: unknown) => { calls.quizzes = args; return []; } },
        courseEvaluation: { findMany: async (args: unknown) => { calls.evaluations = args; return []; } },
        auditLog: { findMany: async (args: unknown) => { calls.audit = args; return []; } },
        lessonProgress: { findMany: async () => [] },
    };
    return { service: new OpeningActivityService(prisma), calls };
}

describe('opening oversight', () => {
    test('limits submissions, quiz attempts, and evaluations to this opening', async () => {
        const { service, calls } = makeHarness(2);
        const result = await service.getOpeningOversight('opening-1');

        assert.deepEqual(calls.enrollments.where, { OR: [{ openingId: 'opening-1' }] });
        assert.deepEqual(calls.tasks.include.submissions.where.enrollment.OR, [{ openingId: 'opening-1' }]);
        assert.deepEqual(calls.quizzes.where.OR, [{ openingId: 'opening-1' }, { openingId: null }]);
        assert.deepEqual(calls.quizzes.include.attempts.where.enrollment.OR, [{ openingId: 'opening-1' }]);
        assert.deepEqual(calls.evaluations.where.OR, [{ openingId: 'opening-1' }]);
        assert.equal(result.summary.studentCount, 0);
    });

    test('includes legacy enrollment records only when the course has one opening', async () => {
        const { service, calls } = makeHarness(1);
        await service.getOpeningOversight('opening-1');

        const legacyScope = { openingId: null, courseId: 'course-1' };
        assert.deepEqual(calls.enrollments.where.OR, [{ openingId: 'opening-1' }, legacyScope]);
        assert.deepEqual(calls.evaluations.where.OR, [{ openingId: 'opening-1' }, legacyScope]);
        assert.deepEqual(calls.tasks.include.submissions.where.enrollment.OR, [{ openingId: 'opening-1' }, legacyScope]);
    });
});
