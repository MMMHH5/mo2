import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ContactMethod } from '@prisma/client';
import { CourseInterestsService } from '../src/course-interests/course-interests.service';

function makeService(options: { course?: unknown; interest?: unknown } = {}) {
    const calls: Record<string, any> = {};
    const prisma: any = {
        course: {
            findFirst: async (args: unknown) => {
                calls.courseQuery = args;
                return options.course === undefined ? { id: 'course-1' } : options.course;
            },
        },
        courseInterest: {
            upsert: async (args: unknown) => {
                calls.upsert = args;
                return options.interest ?? { id: 'interest-1', status: 'PENDING', createdAt: new Date() };
            },
            findMany: async (args: unknown) => {
                calls.list = args;
                return [];
            },
            findUnique: async (args: unknown) => {
                calls.findUnique = args;
                return { id: 'interest-1' };
            },
            update: async (args: unknown) => {
                calls.update = args;
                return { id: 'interest-1', status: 'CONTACTED' };
            },
        },
    };
    const audit: any = { logAction: async (...args: unknown[]) => { calls.audit = args; } };
    return { service: new CourseInterestsService(prisma, audit), calls };
}

describe('course availability interests', () => {
    test('normalizes email and deduplicates a course interest', async () => {
        const { service, calls } = makeService();

        await service.register({
            courseId: 'course-1',
            contactMethod: ContactMethod.EMAIL,
            contactValue: '  LEARNER@EXAMPLE.COM ',
        });

        assert.deepEqual((calls.upsert as any).where.courseId_contactMethod_contactValue, {
            courseId: 'course-1',
            contactMethod: 'EMAIL',
            contactValue: 'learner@example.com',
        });
        assert.deepEqual((calls.courseQuery as any).where.openings.some.status.in, ['ANNOUNCEMENT', 'OPEN', 'STARTED', 'ENDED']);
    });

    test('accepts a phone number with international formatting', async () => {
        const { service, calls } = makeService();

        await service.register({ courseId: 'course-1', contactMethod: 'PHONE', contactValue: '+967 770-199-425' });

        assert.equal((calls.upsert as any).create.contactValue, '+967770199425');
    });

    test('rejects invalid contact data and unpublished courses', async () => {
        const { service } = makeService();

        await assert.rejects(
            () => service.register({ courseId: 'course-1', contactMethod: 'EMAIL', contactValue: 'not-an-email' }),
            (error: unknown) => error instanceof BadRequestException,
        );

        const unpublished = makeService({ course: null });
        await assert.rejects(
            () => unpublished.service.register({ courseId: 'course-1', contactMethod: 'EMAIL', contactValue: 'a@b.com' }),
            (error: unknown) => error instanceof NotFoundException,
        );
    });

    test('lists interests with course details and marks a visitor as contacted', async () => {
        const { service, calls } = makeService();

        await service.list('PENDING');
        await service.markContacted('interest-1', 'admin-1');

        assert.deepEqual((calls.list as any).where, { status: 'PENDING' });
        assert.deepEqual(calls.update, { where: { id: 'interest-1' }, data: { status: 'CONTACTED' }, select: { id: true, status: true } });
        assert.deepEqual(calls.audit, ['Marked course interest as contacted', undefined, 'admin-1']);
    });
});
