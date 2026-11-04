import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { CourseEvaluationsService } from '../src/lms/course-evaluations.service';

function makeHarness(options: {
  status?: string;
  completedModuleIds?: string[];
  evaluation?: any;
  pendingTask?: boolean;
  failedQuiz?: boolean;
} = {}) {
  const writes: any[] = [];
  const awards: string[] = [];
  let saved = options.evaluation ?? null;
  const modules = [{ id: 'lesson-1' }, { id: 'lesson-2' }];
  const prisma: any = {
    enrollment: {
      findUnique: async () => ({
        id: 'enrollment-1',
        status: options.status ?? 'APPROVED',
        courseId: 'course-1',
        openingId: 'opening-1',
        course: { id: 'course-1', titleAr: 'دورة', titleEn: 'Course', instructorId: 'course-teacher' },
        opening: { id: 'opening-1', instructorId: 'batch-teacher', nameAr: 'دفعة', nameEn: 'Batch' },
        courseEvaluation: saved,
      }),
    },
    module: {
      findMany: async () => modules,
    },
    lessonProgress: {
      findMany: async () => (options.completedModuleIds ?? ['lesson-1', 'lesson-2']).map((moduleId) => ({ moduleId })),
    },
    courseTask: {
      findMany: async () => options.pendingTask ? [{ submissions: [] }] : [],
    },
    quiz: {
      findMany: async () => options.failedQuiz ? [{ attempts: [{ passed: false }] }] : [],
    },
    courseEvaluation: {
      create: async (args: any) => {
        writes.push(args.data);
        saved = { id: 'evaluation-1', createdAt: new Date('2026-11-04T10:00:00.000Z') };
        return saved;
      },
    },
  };
  const service = new CourseEvaluationsService(
    prisma,
    { logAction: async () => undefined } as any,
    { addPoints: async (_studentId: string, reason: string) => awards.push(reason) } as any,
  );
  return { service, writes, awards };
}

describe('end-of-course evaluations', () => {
  test('students cannot submit until every lesson is complete', async () => {
    const { service, writes } = makeHarness({ completedModuleIds: ['lesson-1'] });
    await assert.rejects(
      () => service.submit('course-1', 'student-1', { courseRating: 5, instructorRating: 4 }),
      (error: any) => error.getStatus?.() === 409 && error.response?.code === 'COURSE_LESSONS_INCOMPLETE',
    );
    assert.equal(writes.length, 0);
  });

  test('outstanding assignments and quizzes still block the final evaluation', async () => {
    for (const options of [{ pendingTask: true }, { failedQuiz: true }]) {
      const { service, writes } = makeHarness(options);
      await assert.rejects(
        () => service.submit('course-1', 'student-1', { courseRating: 5, instructorRating: 4 }),
        (error: any) => error.getStatus?.() === 409 && error.response?.code === 'COURSE_LESSONS_INCOMPLETE',
      );
      assert.equal(writes.length, 0);
    }
  });

  test('submission records both ratings against the batch instructor and rewards completion once', async () => {
    const { service, writes, awards } = makeHarness();
    const result = await service.submit('course-1', 'student-1', {
      courseRating: 5,
      instructorRating: 4,
      commentAr: '  دورة ممتازة  ',
    });

    assert.equal(result.submitted, true);
    assert.equal(writes[0].courseRating, 5);
    assert.equal(writes[0].instructorRating, 4);
    assert.equal(writes[0].instructorId, 'batch-teacher');
    assert.equal(writes[0].openingId, 'opening-1');
    assert.equal(writes[0].commentAr, 'دورة ممتازة');
    assert.deepEqual(awards, ['course_complete']);
  });

  test('each evaluation rating must be an integer from one through five', async () => {
    const { service, writes } = makeHarness();
    await assert.rejects(
      () => service.submit('course-1', 'student-1', { courseRating: 6, instructorRating: 4 }),
      /courseRating must be an integer between 1 and 5/,
    );
    await assert.rejects(
      () => service.submit('course-1', 'student-1', { courseRating: 4, instructorRating: 2.5 }),
      /instructorRating must be an integer between 1 and 5/,
    );
    assert.equal(writes.length, 0);
  });

  test('non-approved enrollments cannot submit an evaluation', async () => {
    const { service, writes } = makeHarness({ status: 'PENDING' });
    await assert.rejects(
      () => service.submit('course-1', 'student-1', { courseRating: 5, instructorRating: 5 }),
      (error: any) => error.getStatus?.() === 403,
    );
    assert.equal(writes.length, 0);
  });

  test('a previously submitted evaluation cannot be changed or resubmitted', async () => {
    const { service, writes, awards } = makeHarness({ evaluation: { id: 'evaluation-1' } });
    await assert.rejects(
      () => service.submit('course-1', 'student-1', { courseRating: 1, instructorRating: 1 }),
      (error: any) => error.getStatus?.() === 409,
    );
    assert.equal(writes.length, 0);
    assert.deepEqual(awards, []);
  });

  test('only administrators and course managers can read evaluation results', () => {
    const { service } = makeHarness();
    assert.doesNotThrow(() => service.assertStaffCanRead('ADMIN' as any));
    assert.doesNotThrow(() => service.assertStaffCanRead('COURSE_MANAGER' as any));
    assert.throws(() => service.assertStaffCanRead('INSTRUCTOR' as any), (error: any) => error.getStatus?.() === 403);
    assert.throws(() => service.assertStaffCanRead('STUDENT' as any), (error: any) => error.getStatus?.() === 403);
  });
});
