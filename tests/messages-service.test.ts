import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { ForbiddenException } from '@nestjs/common';
import { EnrollmentStatus, Role, StudentMessageRequestStatus } from '@prisma/client';
import { MessagesService } from '../src/messages/messages.service';

function makeService(options: { approvedRequest?: boolean; recipientEnrolled?: boolean } = {}) {
    let createdMessage: any;
    const prisma: any = {
        user: {
            findUnique: async () => ({ id: 'student-2', role: Role.STUDENT }),
        },
        course: {
            findUnique: async () => ({ id: 'course-1', instructorId: 'instructor-1' }),
        },
        courseOpening: {
            findFirst: async () => ({ id: 'opening-1', courseId: 'course-1' }),
        },
        enrollment: {
            findFirst: async ({ where }: any) => {
                if (where.studentId === 'student-2' && options.recipientEnrolled === false) return null;
                return { id: `enrollment-${where.studentId}`, status: EnrollmentStatus.APPROVED };
            },
        },
        studentMessageRequest: {
            findFirst: async () => options.approvedRequest
                ? { id: 'request-1', status: StudentMessageRequestStatus.APPROVED }
                : null,
        },
        message: {
            create: async ({ data }: any) => {
                createdMessage = data;
                return {
                    ...data,
                    id: 'message-1',
                    createdAt: new Date('2026-01-01T00:00:00Z'),
                    readAt: null,
                    sender: { id: 'student-1', role: Role.STUDENT, metadata: { nameAr: 'الطالب الأول' } },
                    recipient: { id: 'student-2', role: Role.STUDENT, metadata: { nameEn: 'Student Two' } },
                };
            },
        },
    };
    const service = new MessagesService(
        prisma,
        { encrypt: (value: string) => `encrypted:${value}`, tryDecrypt: (value: string) => value.replace('encrypted:', '') } as any,
    );
    return { service, getCreatedMessage: () => createdMessage };
}

describe('student peer messaging', () => {
    const sender = { userId: 'student-1', role: Role.STUDENT };
    const message = {
        recipientId: 'student-2',
        courseId: 'course-1',
        openingId: 'opening-1',
        content: 'Hello',
    };

    test('a student cannot start a peer conversation without an approved request', async () => {
        const { service } = makeService();
        await assert.rejects(
            () => service.send(sender, message),
            (error: unknown) => error instanceof ForbiddenException,
        );
    });

    test('a request approval permits messaging only while both students belong to the same opening', async () => {
        const { service } = makeService({ approvedRequest: true });
        const result = await service.send(sender, message);
        assert.equal(result.content, 'Hello');
        assert.equal(result.sender.nameAr, 'الطالب الأول');
        assert.equal(result.recipient.nameEn, 'Student Two');
        assert.equal('email' in result.sender, false);
        assert.equal('email' in result.recipient, false);
        assert.equal(result.openingId, 'opening-1');
    });

    test('an approved request does not override a student leaving the opening', async () => {
        const { service } = makeService({ approvedRequest: true, recipientEnrolled: false });
        await assert.rejects(
            () => service.send(sender, message),
            (error: unknown) => error instanceof ForbiddenException,
        );
    });

    test('contacts show the assigned opening instructor and classmates by name without exposing emails', async () => {
        const prisma: any = {
            user: {
                findMany: async () => [{
                    id: 'admin-1',
                    role: Role.ADMIN,
                    metadata: { nameAr: 'مدير المنصة' },
                    email: 'admin@example.test',
                }],
            },
            enrollment: {
                findMany: async ({ where }: any) => where.studentId === 'student-1'
                    ? [{
                        studentId: 'student-1',
                        status: EnrollmentStatus.APPROVED,
                        courseId: 'course-1',
                        openingId: 'opening-1',
                        course: { id: 'course-1', titleAr: 'دورة', titleEn: 'Course' },
                        opening: {
                            id: 'opening-1',
                            instructor: {
                                id: 'instructor-1',
                                role: Role.INSTRUCTOR,
                                metadata: { fullName: 'Assigned Instructor' },
                                email: 'instructor@example.test',
                            },
                        },
                    }]
                    : [{
                        studentId: 'student-2',
                        openingId: 'opening-1',
                        status: EnrollmentStatus.APPROVED,
                        student: {
                            id: 'student-2',
                            role: Role.STUDENT,
                            metadata: { inboxDisplayName: 'Classmate', inboxUseOfficialName: false },
                            email: 'classmate@example.test',
                        },
                        course: { id: 'course-1', titleAr: 'دورة', titleEn: 'Course' },
                    }],
            },
            studentMessageRequest: {
                findMany: async () => [{
                    id: 'request-1',
                    openingId: 'opening-1',
                    requesterId: 'student-1',
                    recipientId: 'student-2',
                    status: StudentMessageRequestStatus.PENDING,
                    updatedAt: new Date('2026-01-01T00:00:00Z'),
                }],
            },
        };
        const service = new MessagesService(prisma, {} as any);
        const contacts = await service.getContacts(sender);

        assert.equal(contacts.admins[0].nameAr, 'مدير المنصة');
        assert.equal('email' in contacts.admins[0], false);
        assert.equal(contacts.instructors[0].nameEn, 'Assigned Instructor');
        assert.equal('email' in contacts.instructors[0], false);
        assert.equal(contacts.students[0].nameEn, 'Classmate');
        assert.equal(contacts.students[0].requestStatus, StudentMessageRequestStatus.PENDING);
        assert.equal(contacts.students[0].requestDirection, 'OUTGOING');
        assert.equal('email' in contacts.students[0], false);
    });

    test('students can create and the recipient can approve an opening-scoped request', async () => {
        let created: any;
        let updated: any;
        const requestRow = {
            id: 'request-1',
            openingId: 'opening-1',
            requesterId: 'student-1',
            recipientId: 'student-2',
            status: StudentMessageRequestStatus.PENDING,
        };
        let lookupCount = 0;
        const prisma: any = {
            courseOpening: { findFirst: async () => ({ id: 'opening-1' }) },
            enrollment: { findFirst: async () => ({ id: 'enrollment-1' }) },
            user: { findUnique: async () => ({ id: 'student-2', role: Role.STUDENT }) },
            studentMessageRequest: {
                findFirst: async () => null,
                findUnique: async () => {
                    lookupCount += 1;
                    return lookupCount === 1 ? null : requestRow;
                },
                create: async ({ data }: any) => {
                    created = data;
                    return requestRow;
                },
                updateMany: async ({ data }: any) => {
                    updated = data;
                    return { count: 1 };
                },
            },
        };
        const service = new MessagesService(prisma, {} as any);

        await service.createStudentMessageRequest(sender, 'student-2', 'opening-1');
        assert.deepEqual(created, {
            openingId: 'opening-1',
            requesterId: 'student-1',
            recipientId: 'student-2',
        });

        const response = await service.respondToStudentMessageRequest(
            { userId: 'student-2', role: Role.STUDENT },
            'request-1',
            true,
        );
        assert.equal(updated.status, StudentMessageRequestStatus.APPROVED);
        assert.deepEqual(response, { ok: true, status: StudentMessageRequestStatus.APPROVED });
    });
});
