import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { BadRequestException } from '@nestjs/common';
import { CourseOpeningStatus, Role } from '@prisma/client';
import { CoursesService } from '../src/courses/courses.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuditService } from '../src/audit/audit.service';
import { CertificatesService } from '../src/certificates/certificates.service';
import { NotificationsService } from '../src/notifications/notifications.service';

describe('course archive and restore', () => {
    test('keeps archived courses and openings out of the staff course list', async () => {
        let query: Record<string, unknown> | undefined;
        const prisma = {
            course: {
                findMany: async (args: Record<string, unknown>) => {
                    query = args;
                    return [];
                },
            },
        };
        const service = new CoursesService(
            prisma as unknown as PrismaService,
            {} as AuditService,
            {} as CertificatesService,
            {} as NotificationsService,
        );

        await service.findAll(true, { role: Role.ADMIN });

        assert.deepEqual(query?.where, { archivedAt: null });
        const include = query?.include as { openings: { where: unknown } };
        assert.deepEqual(include.openings.where, { archivedAt: null });
    });

    test('rejects assigning a non-instructor account to an opening', async () => {
        const prisma = {
            course: { findUnique: async () => ({ id: 'course-1', archivedAt: null }) },
            user: { findUnique: async () => ({ id: 'staff-1', role: Role.ADMIN }) },
        };
        const service = new CoursesService(
            prisma as unknown as PrismaService,
            {} as AuditService,
            {} as CertificatesService,
            {} as NotificationsService,
        );

        await assert.rejects(
            () => service.createOpening('course-1', { instructorId: 'staff-1', price: 1 }),
            BadRequestException,
        );
    });

    test('archives a course and its active openings while preserving records', async () => {
        let openingUpdate: { where: Record<string, unknown>; data: Record<string, unknown> } | undefined;
        const prisma = {
            course: {
                findFirst: async () => ({ id: 'course-1', archivedAt: null }),
                update: async ({ data }: { data: Record<string, unknown> }) => ({ id: 'course-1', ...data }),
            },
            courseOpening: {
                updateMany: async (args: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
                    openingUpdate = args;
                },
            },
            $transaction: async (run: (tx: unknown) => unknown) => run(prisma),
        };
        const service = new CoursesService(
            prisma as unknown as PrismaService,
            { logAction: async () => undefined } as unknown as AuditService,
            {} as CertificatesService,
            {} as NotificationsService,
        );

        const archived = await service.remove('course-1', 'admin-1') as { archivedAt: Date };

        assert.ok(archived.archivedAt instanceof Date);
        assert.deepEqual(openingUpdate?.where, { courseId: 'course-1', archivedAt: null });
        assert.equal(openingUpdate?.data.archivedAt, archived.archivedAt);
        assert.equal(openingUpdate?.data.isPublished, false);
    });

    test('restores a course and only its matching archived openings as drafts', async () => {
        const archivedAt = new Date('2026-10-01T10:00:00.000Z');
        let openingUpdate: { where: Record<string, unknown>; data: Record<string, unknown> } | undefined;
        const prisma = {
            course: {
                findFirst: async () => ({ id: 'course-1', archivedAt }),
                update: async ({ data }: { data: Record<string, unknown> }) => ({ id: 'course-1', ...data }),
            },
            courseOpening: {
                updateMany: async (args: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
                    openingUpdate = args;
                },
            },
            $transaction: async (run: (tx: unknown) => unknown) => run(prisma),
        };
        const service = new CoursesService(
            prisma as unknown as PrismaService,
            { logAction: async () => undefined } as unknown as AuditService,
            {} as CertificatesService,
            {} as NotificationsService,
        );

        const restored = await service.restoreCourse('course-1', 'admin-1') as { archivedAt: null };

        assert.equal(restored.archivedAt, null);
        assert.deepEqual(openingUpdate?.where, { courseId: 'course-1', archivedAt });
        assert.deepEqual(openingUpdate?.data, {
            archivedAt: null,
            status: CourseOpeningStatus.DRAFT,
            isPublished: false,
        });
    });

    test('archives an opening without deleting its student-linked data', async () => {
        let updateData: Record<string, unknown> | undefined;
        const prisma = {
            courseOpening: {
                findFirst: async () => ({ id: 'opening-1', courseId: 'course-1', archivedAt: null }),
                update: async ({ data }: { data: Record<string, unknown> }) => {
                    updateData = data;
                    return { id: 'opening-1', ...data };
                },
            },
        };
        const audit = { logAction: async () => undefined };
        const service = new CoursesService(
            prisma as unknown as PrismaService,
            audit as unknown as AuditService,
            {} as CertificatesService,
            {} as NotificationsService,
        );

        await service.removeOpening('opening-1', 'admin-1');

        assert.ok(updateData?.archivedAt instanceof Date);
        assert.equal(updateData?.isPublished, false);
    });

    test('restores a deleted opening as an unpublished draft', async () => {
        let updateData: Record<string, unknown> | undefined;
        const prisma = {
            courseOpening: {
                findFirst: async () => ({ id: 'opening-1', archivedAt: new Date(), courseId: 'course-1' }),
                update: async ({ data }: { data: Record<string, unknown> }) => {
                    updateData = data;
                    return { id: 'opening-1', ...data };
                },
            },
        };
        const service = new CoursesService(
            prisma as unknown as PrismaService,
            { logAction: async () => undefined } as unknown as AuditService,
            {} as CertificatesService,
            {} as NotificationsService,
        );

        await service.restoreOpening('opening-1', 'admin-1', Role.ADMIN);

        assert.equal(updateData?.archivedAt, null);
        assert.equal(updateData?.status, CourseOpeningStatus.DRAFT);
        assert.equal(updateData?.isPublished, false);
    });

    test('restores a completed opening to in-progress, not enrollment-open', async () => {
        const prisma = {
            courseOpening: {
                findFirst: async () => null,
                findUnique: async () => ({
                    id: 'opening-1',
                    courseId: 'course-1',
                    instructorId: 'instructor-1',
                    status: CourseOpeningStatus.ENDED,
                    course: { id: 'course-1', archivedAt: null },
                }),
                update: async ({ data }: { data: Record<string, unknown> }) => data,
            },
        };
        const service = new CoursesService(
            prisma as unknown as PrismaService,
            { logAction: async () => undefined } as unknown as AuditService,
            {} as CertificatesService,
            {} as NotificationsService,
        );

        const restored = await service.restoreOpening('opening-1', 'admin-1', Role.ADMIN) as {
            status: CourseOpeningStatus;
            isPublished: boolean;
        };
        assert.equal(restored.status, CourseOpeningStatus.STARTED);
        assert.equal(restored.isPublished, true);
    });

    test('rejects restoring a batch that was not ended or archived', async () => {
        const prisma = {
            courseOpening: {
                findFirst: async () => null,
                findUnique: async () => ({
                    id: 'opening-1',
                    instructorId: 'instructor-1',
                    status: CourseOpeningStatus.OPEN,
                    course: { id: 'course-1', archivedAt: null },
                }),
            },
        };
        const service = new CoursesService(
            prisma as unknown as PrismaService,
            {} as AuditService,
            {} as CertificatesService,
            {} as NotificationsService,
        );

        await assert.rejects(
            () => service.restoreOpening('opening-1', 'admin-1', Role.ADMIN),
            BadRequestException,
        );
    });
});
