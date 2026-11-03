import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { EnrollmentStatus, PaymentStatus, RefundStatus, Role } from '@prisma/client';
import { RefundsService } from '../src/refunds/refunds.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuditService } from '../src/audit/audit.service';
import { NotificationsService } from '../src/notifications/notifications.service';
import { ChatService } from '../src/chat/chat.service';

const noSideEffects = {
    audit: { logAction: async () => undefined } as unknown as AuditService,
    notifications: { notify: async () => undefined } as unknown as NotificationsService,
    chat: {} as ChatService,
};

describe('refund processing', () => {
    test('allows paid enrollments before the opening date and exposes their coupon', async () => {
        const openingStart = new Date(Date.now() + 24 * 60 * 60 * 1000);
        let query: Record<string, unknown> | undefined;
        const prisma = {
            enrollment: {
                findMany: async () => [{ id: 'enrollment-1', courseId: 'course-1', openingId: 'opening-1' }],
            },
            payment: {
                findMany: async (args: Record<string, unknown>) => {
                    query = args;
                    return [{
                        id: 'payment-1',
                        openingId: 'opening-1',
                        enrollmentId: 'enrollment-1',
                        amount: 80,
                        currency: 'SAR',
                        couponCode: 'SAVE20',
                        coupon: { name: 'Student Discount', type: 'PERCENT', value: 20 },
                        opening: {
                            id: 'opening-1',
                            courseId: 'course-1',
                            startDate: openingStart,
                            refundWindowDays: null,
                            course: { id: 'course-1', titleEn: 'Course' },
                        },
                    }];
                },
            },
            refundRequest: { findMany: async () => [] },
        };
        const service = new RefundsService(
            prisma as unknown as PrismaService,
            noSideEffects.audit,
            noSideEffects.notifications,
            noSideEffects.chat,
        );

        const [item] = await service.getMyEligibility('student-1');

        assert.equal(item.eligible, true);
        assert.equal(item.couponCode, 'SAVE20');
        assert.equal(item.coupon.name, 'Student Discount');
        assert.equal(item.deadline.getTime(), openingStart.getTime());
        const where = query?.where as Record<string, unknown>;
        assert.equal(where.status, PaymentStatus.PAID);
        assert.deepEqual(where.amount, { gt: 0 });
        assert.deepEqual(where.OR, [
            { provider: 'STRIPE' },
            { provider: 'MANUAL', receiptFileUrl: { not: null } },
        ]);
    });

    test('allows requests during the opening grace period but not after it expires', async () => {
        const makeService = (startDate: Date) => new RefundsService(
            {
                enrollment: {
                    findMany: async () => [{ id: 'enrollment-1', courseId: 'course-1', openingId: 'opening-1' }],
                },
                payment: {
                    findMany: async () => [{
                        id: 'payment-1',
                        openingId: 'opening-1',
                        enrollmentId: 'enrollment-1',
                        amount: 80,
                        opening: {
                            id: 'opening-1',
                            courseId: 'course-1',
                            startDate,
                            refundWindowDays: 5,
                            course: { id: 'course-1' },
                        },
                    }],
                },
                refundRequest: { findMany: async () => [] },
            } as unknown as PrismaService,
            noSideEffects.audit,
            noSideEffects.notifications,
            noSideEffects.chat,
        );

        const withinGrace = await makeService(new Date(Date.now() - 2 * 24 * 60 * 60 * 1000))
            .getMyEligibility('student-1');
        const expired = await makeService(new Date(Date.now() - 6 * 24 * 60 * 60 * 1000))
            .getMyEligibility('student-1');

        assert.equal(withinGrace[0].eligible, true);
        assert.equal(expired[0].eligible, false);
        assert.equal(expired[0].reason, 'window_closed');
    });

    test('only accepts the exact paid payment attached to the approved enrollment', async () => {
        let query: Record<string, unknown> | undefined;
        const prisma = {
            payment: {
                findFirst: async (args: Record<string, unknown>) => {
                    query = args;
                    return {
                        opening: {
                            courseId: 'course-a',
                            startDate: new Date('2026-12-01T00:00:00Z'),
                            refundWindowDays: 30,
                        },
                        enrollment: {
                            id: 'enrollment-1',
                            studentId: 'student-1',
                            courseId: 'course-b',
                            status: EnrollmentStatus.APPROVED,
                        },
                    };
                },
            },
        };
        const service = new RefundsService(
            prisma as unknown as PrismaService,
            noSideEffects.audit,
            noSideEffects.notifications,
            noSideEffects.chat,
        );

        await assert.rejects(
            () => service.create('student-1', {
                paymentId: 'payment-1',
                method: 'BANK',
                accountName: 'Student One',
                accountNumber: '12345678',
            }),
            BadRequestException,
        );
        assert.deepEqual(query?.where, {
            id: 'payment-1',
            studentId: 'student-1',
            status: PaymentStatus.PAID,
            amount: { gt: 0 },
            OR: [
                { provider: 'STRIPE' },
                { provider: 'MANUAL', receiptFileUrl: { not: null } },
            ],
            enrollment: { studentId: 'student-1', status: EnrollmentStatus.APPROVED },
        });
    });

    test('reuses a rejected request for the same payment instead of violating the unique payment link', async () => {
        let updatedData: Record<string, unknown> | undefined;
        let created = false;
        const opening = {
            id: 'opening-1',
            instructorId: 'instructor-1',
            courseId: 'course-1',
            startDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
            refundWindowDays: 30,
        };
        const payment = {
            id: 'payment-1',
            studentId: 'student-1',
            status: PaymentStatus.PAID,
            amount: 25,
            currency: 'SAR',
            openingId: opening.id,
            opening,
            enrollment: {
                id: 'enrollment-1',
                studentId: 'student-1',
                courseId: opening.courseId,
                openingId: opening.id,
                status: EnrollmentStatus.APPROVED,
            },
        };
        const tx = {
            payment: { findFirst: async () => ({ id: payment.id }) },
            refundRequest: {
                findUnique: async () => ({ id: 'refund-1', status: RefundStatus.REJECTED }),
                update: async ({ data }: { data: Record<string, unknown> }) => {
                    updatedData = data;
                    return { id: 'refund-1', ...data };
                },
                create: async () => {
                    created = true;
                    return { id: 'refund-new' };
                },
            },
        };
        const prisma = {
            payment: { findFirst: async () => payment },
            $transaction: async (run: (transaction: unknown) => Promise<unknown>) => run(tx),
            user: {
                findUnique: async () => ({ email: 'student@example.test' }),
                findMany: async () => [],
            },
        };
        const service = new RefundsService(
            prisma as unknown as PrismaService,
            noSideEffects.audit,
            noSideEffects.notifications,
            noSideEffects.chat,
        );

        const result = await service.create('student-1', {
            paymentId: payment.id,
            method: 'BANK',
            accountName: 'Student One',
            accountNumber: '12345678',
        });

        assert.equal(result.id, 'refund-1');
        assert.equal(created, false);
        assert.equal(updatedData?.status, RefundStatus.PENDING);
        assert.equal(updatedData?.paymentId, payment.id);
        assert.equal(updatedData?.reviewedAt, null);
    });

    test('approval moves a request to processing without changing the payment', async () => {
        let requestUpdate: Record<string, unknown> | undefined;
        let paymentUpdates = 0;
        let lookupCount = 0;
        const request = {
            id: 'refund-1',
            studentId: 'student-1',
            courseId: 'course-1',
            paymentId: 'payment-1',
            status: RefundStatus.PENDING,
        };
        const prisma = {
            refundRequest: {
                findUnique: async () => {
                    lookupCount += 1;
                    return lookupCount === 1 ? request : { ...request, status: RefundStatus.PROCESSING };
                },
                updateMany: async (args: Record<string, unknown>) => {
                    requestUpdate = args;
                    return { count: 1 };
                },
            },
            payment: {
                findUnique: async () => ({ status: PaymentStatus.PAID }),
                update: async () => { paymentUpdates += 1; },
            },
        };
        const service = new RefundsService(
            prisma as unknown as PrismaService,
            noSideEffects.audit,
            noSideEffects.notifications,
            noSideEffects.chat,
        );

        const result = await service.review('refund-1', 'finance-1', Role.FINANCE, { status: 'APPROVED' });

        assert.equal(result?.status, RefundStatus.PROCESSING);
        assert.deepEqual(requestUpdate?.where, { id: 'refund-1', status: RefundStatus.PENDING });
        assert.equal(paymentUpdates, 0);
    });

    test('completion atomically marks payment and enrollment only after manual payout confirmation', async () => {
        const calls: string[] = [];
        const completed = { id: 'refund-1', status: RefundStatus.APPROVED };
        const tx = {
            payment: {
                updateMany: async () => {
                    calls.push('payment');
                    return { count: 1 };
                },
            },
            enrollment: {
                updateMany: async () => {
                    calls.push('enrollment');
                    return { count: 1 };
                },
            },
            refundRequest: {
                updateMany: async () => {
                    calls.push('request');
                    return { count: 1 };
                },
                findUnique: async () => completed,
            },
            $executeRaw: async () => {
                calls.push('seat');
                return 1;
            },
        };
        const prisma = {
            refundRequest: {
                findUnique: async () => ({
                    id: 'refund-1',
                    studentId: 'student-1',
                    paymentId: 'payment-1',
                    amount: 25,
                    currency: 'SAR',
                    status: RefundStatus.PROCESSING,
                    payment: { enrollmentId: 'enrollment-1', openingId: 'opening-1' },
                }),
            },
            $transaction: async (run: (transaction: unknown) => Promise<unknown>) => run(tx),
        };
        const service = new RefundsService(
            prisma as unknown as PrismaService,
            noSideEffects.audit,
            noSideEffects.notifications,
            {
                getOrCreateRoomForOpening: async () => ({ id: 'room-1' }),
                syncRoomMembers: async () => undefined,
            } as unknown as ChatService,
        );

        const result = await service.complete('refund-1', 'finance-1', Role.FINANCE, { payoutReference: ' bank-ref-1 ' });

        assert.equal(result?.status, RefundStatus.APPROVED);
        assert.deepEqual(calls, ['payment', 'enrollment', 'seat', 'request']);
    });

    test('does not complete a request if its payment is no longer paid', async () => {
        let requestCompleted = false;
        const prisma = {
            refundRequest: {
                findUnique: async () => ({
                    id: 'refund-1',
                    studentId: 'student-1',
                    paymentId: 'payment-1',
                    status: RefundStatus.PROCESSING,
                    payment: { enrollmentId: null, openingId: 'opening-1' },
                }),
            },
            $transaction: async (run: (tx: unknown) => Promise<unknown>) => run({
                payment: { updateMany: async () => ({ count: 0 }) },
                refundRequest: {
                    updateMany: async () => {
                        requestCompleted = true;
                        return { count: 1 };
                    },
                },
            }),
        };
        const service = new RefundsService(
            prisma as unknown as PrismaService,
            noSideEffects.audit,
            noSideEffects.notifications,
            noSideEffects.chat,
        );

        await assert.rejects(
            () => service.complete('refund-1', 'finance-1', Role.FINANCE, {}),
            ConflictException,
        );
        assert.equal(requestCompleted, false);
    });
});
