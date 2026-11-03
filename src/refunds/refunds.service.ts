import {
    Injectable,
    NotFoundException,
    BadRequestException,
    ConflictException,
    ForbiddenException,
} from '@nestjs/common';
import { RefundStatus, Role, PaymentStatus, EnrollmentStatus } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ChatService } from '../chat/chat.service';
import { releaseSeat } from '../common/opening-seats';
import { getFrontendUrl } from '../common/frontend-url';
import { CompleteRefundRequestDto, CreateRefundRequestDto, ReviewRefundRequestDto } from './dto/refund.dto';

const DAY_MS = 24 * 60 * 60 * 1000;
const PAID_PAYMENT_EVIDENCE: Prisma.PaymentWhereInput = {
    OR: [
        { provider: 'STRIPE' },
        { provider: 'MANUAL', receiptFileUrl: { not: null } },
    ],
};

const REFUND_INCLUDE = {
    course: { select: { id: true, titleAr: true, titleEn: true } },
    opening: { select: { id: true, nameAr: true, nameEn: true, startDate: true, refundWindowDays: true } },
    student: { select: { id: true, email: true } },
    payment: {
        select: {
            id: true,
            amount: true,
            currency: true,
            method: true,
            status: true,
            receiptFileUrl: true,
            enrollmentId: true,
            provider: true,
            providerRef: true,
            paidAt: true,
            couponCode: true,
            coupon: { select: { name: true, type: true, value: true } },
        },
    },
    reviewedBy: { select: { id: true, email: true } },
    completedBy: { select: { id: true, email: true } },
} as const;

const REFUND_STUDENT_INCLUDE = {
    course: { select: { id: true, titleAr: true, titleEn: true } },
    opening: { select: { id: true, nameAr: true, nameEn: true } },
    payment: {
        select: {
            id: true,
            amount: true,
            currency: true,
            method: true,
            status: true,
            couponCode: true,
            coupon: { select: { name: true } },
        },
    },
} as const;

@Injectable()
export class RefundsService {
    constructor(
        private prisma: PrismaService,
        private audit: AuditService,
        private notifications: NotificationsService,
        private chat: ChatService,
    ) { }

    /** The configured grace period starts on the opening's start date. */
    private deadlineOf(startDate: Date | null, days: number | null): Date | null {
        if (!startDate) return null;
        return new Date(startDate.getTime() + (days ?? 0) * DAY_MS);
    }

    /**
     * Paid courses the signed-in student can request a refund for, plus the
     * ones they already did (or that closed). Computed from PAID payments so it
     * always reflects money that actually landed.
     */
    async getMyEligibility(studentId: string) {
        const enrollments = await this.prisma.enrollment.findMany({
            where: { studentId, status: EnrollmentStatus.APPROVED },
            select: { id: true, courseId: true, openingId: true },
        });
        if (enrollments.length === 0) return [];

        const [payments, requests] = await Promise.all([
            this.prisma.payment.findMany({
                where: {
                    studentId,
                    status: PaymentStatus.PAID,
                    amount: { gt: 0 },
                    ...PAID_PAYMENT_EVIDENCE,
                    enrollmentId: { in: enrollments.map(({ id }) => id) },
                },
                orderBy: [{ paidAt: 'desc' }, { createdAt: 'desc' }],
                include: {
                    opening: {
                        select: {
                            id: true,
                            nameAr: true,
                            nameEn: true,
                            startDate: true,
                            refundWindowDays: true,
                            courseId: true,
                            course: { select: { id: true, titleAr: true, titleEn: true } },
                        },
                    },
                    coupon: { select: { name: true, type: true, value: true } },
                },
            }),
            this.prisma.refundRequest.findMany({
                where: { studentId },
                select: { id: true, paymentId: true, status: true },
                orderBy: { createdAt: 'desc' },
            }),
        ]);

        const byPayment = new Map<string, (typeof requests)[number]>();
        const enrollmentById = new Map(enrollments.map(({ id, courseId, openingId }) => [id, { courseId, openingId }]));
        for (const request of requests) {
            if (request.paymentId && !byPayment.has(request.paymentId)) byPayment.set(request.paymentId, request);
        }

        const now = Date.now();
        return payments
            .filter((payment) => {
                if (!payment.enrollmentId) return false;
                const enrollment = enrollmentById.get(payment.enrollmentId);
                return enrollment?.courseId === payment.opening.courseId && enrollment.openingId === payment.openingId;
            })
            .map((p) => {
                const opening = p.opening;
                const deadline = this.deadlineOf(opening?.startDate ?? null, opening?.refundWindowDays ?? null);
                const existing = byPayment.get(p.id) ?? null;

                return {
                    paymentId: p.id,
                    courseId: opening?.courseId ?? null,
                    course: opening?.course ?? null,
                    openingId: opening?.id ?? null,
                    openingNameAr: opening?.nameAr ?? null,
                    openingNameEn: opening?.nameEn ?? null,
                    amount: Number(p.amount),
                    currency: p.currency,
                    couponCode: p.couponCode,
                    coupon: p.coupon,
                    receiptFileUrl: p.receiptFileUrl ?? null,
                    enrollmentId: p.enrollmentId ?? null,
                    paidAt: p.paidAt ?? p.createdAt,
                    startDate: opening?.startDate ?? null,
                    refundWindowDays: opening?.refundWindowDays ?? null,
                    deadline,
                    eligible: (!existing || existing.status === RefundStatus.REJECTED) && !!deadline && now <= deadline.getTime(),
                    reason: existing && existing.status !== RefundStatus.REJECTED
                        ? 'already_requested'
                        : !deadline
                            ? 'no_window'
                            : now > deadline.getTime()
                                ? 'window_closed'
                                : null,
                    requestId: existing?.id ?? null,
                    requestStatus: existing?.status ?? null,
                };
            });
    }

    async listMine(studentId: string) {
        return this.prisma.refundRequest.findMany({
            where: { studentId },
            include: REFUND_STUDENT_INCLUDE,
            orderBy: { createdAt: 'desc' },
        });
    }

    async listAll(status?: string) {
        const valid = status && ['PENDING', 'PROCESSING', 'APPROVED', 'REJECTED'].includes(status);
        return this.prisma.refundRequest.findMany({
            where: valid ? { status: status as RefundStatus } : undefined,
            include: REFUND_INCLUDE,
            orderBy: { createdAt: 'desc' },
        });
    }

    async create(studentId: string, dto: CreateRefundRequestDto) {
        const payment = await this.prisma.payment.findFirst({
            where: {
                id: dto.paymentId,
                studentId,
                status: PaymentStatus.PAID,
                amount: { gt: 0 },
                ...PAID_PAYMENT_EVIDENCE,
                enrollment: { studentId, status: EnrollmentStatus.APPROVED },
            },
            include: { opening: true, enrollment: true },
        });
        if (!payment || !payment.enrollment) {
            throw new BadRequestException('Select a paid payment attached to your active enrollment');
        }

        const enrollment = payment.enrollment;
        if (!enrollment || enrollment.status !== EnrollmentStatus.APPROVED) {
            throw new BadRequestException('You can only request a refund for an approved (paid) enrollment');
        }
        if (payment.opening.courseId !== enrollment.courseId || payment.openingId !== enrollment.openingId) {
            throw new BadRequestException('The selected payment does not match your course enrollment');
        }

        const opening = payment.opening;
        const deadline = this.deadlineOf(opening?.startDate ?? null, opening?.refundWindowDays ?? null);
        if (!deadline) throw new BadRequestException('Refunds are not available for this course');
        if (Date.now() > deadline.getTime()) {
            throw new BadRequestException('The refund window for this course has closed');
        }

        const accountName = dto.accountName.trim();
        const accountNumber = dto.accountNumber.trim();
        if (accountName.length < 2 || accountNumber.length < 4) {
            throw new BadRequestException('Enter a valid account holder name and payout account number');
        }

        let created;
        try {
            created = await this.prisma.$transaction(async (tx) => {
                const currentPayment = await tx.payment.findFirst({
                    where: {
                        id: payment.id,
                        studentId,
                        status: PaymentStatus.PAID,
                        amount: { gt: 0 },
                        ...PAID_PAYMENT_EVIDENCE,
                        openingId: payment.openingId,
                        enrollmentId: enrollment.id,
                        enrollment: { studentId, status: EnrollmentStatus.APPROVED },
                    },
                    select: { id: true },
                });
                if (!currentPayment) {
                    throw new ConflictException('The payment or enrollment is no longer eligible for a refund request');
                }
                const existing = await tx.refundRequest.findUnique({ where: { paymentId: payment.id } });
                if (existing && existing.status !== RefundStatus.REJECTED) {
                    throw new ConflictException('A refund request already exists for this payment');
                }
                const data = {
                    studentId,
                    courseId: enrollment.courseId,
                    openingId: payment.openingId,
                    paymentId: payment.id,
                    amount: payment.amount,
                    currency: payment.currency,
                    method: dto.method,
                    accountName,
                    accountNumber,
                    studentNote: dto.studentNote?.trim() || null,
                    reviewerNote: null,
                    reviewedAt: null,
                    reviewedById: null,
                    completedAt: null,
                    completedById: null,
                    payoutReference: null,
                    status: RefundStatus.PENDING,
                };
                if (existing) {
                    return tx.refundRequest.update({
                        where: { id: existing.id },
                        data: { ...data, createdAt: new Date() },
                    });
                }
                return tx.refundRequest.create({ data });
            });
        } catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
                throw new ConflictException('A refund request already exists for this payment');
            }
            throw error;
        }

        const student = await this.prisma.user.findUnique({
            where: { id: studentId },
            select: { email: true },
        });

        // Alert the people who handle money and the batch: the instructor who
        // teaches this opening plus finance, admin, and course-manager accounts.
        const staff = await this.prisma.user.findMany({
            where: { role: { in: [Role.FINANCE, Role.ADMIN, Role.COURSE_MANAGER] }, isActive: true },
            select: { id: true, email: true, role: true },
        });
        const recipients = new Map<string, { id: string; email: string; role: Role }>();
        if (!recipients.has(opening.instructorId)) {
            recipients.set(opening.instructorId, { id: opening.instructorId, email: '', role: Role.INSTRUCTOR });
        }
        for (const s of staff) recipients.set(s.id, s);

        const studentEmail = student?.email ?? 'Student';
        const amountLabel = `${Number(payment.amount)} ${payment.currency}`;
        const frontend = getFrontendUrl();

        await Promise.all(
            Array.from(recipients.values()).map((r) =>
                this.notifications
                    .notify({
                        userId: r.id,
                        type: 'refund.requested',
                        titleAr: 'طلب استرداد جديد',
                        titleEn: 'New refund request',
                        bodyAr: `قدّم ${studentEmail} طلب استرداد بمبلغ ${amountLabel}.`,
                        bodyEn: `${studentEmail} requested a refund of ${amountLabel}.`,
                        data: {
                            refundRequestId: created.id,
                            courseId: enrollment.courseId,
                            openingId: payment.openingId,
                            paymentId: payment.id,
                        },
                        email:
                            r.role === Role.FINANCE || r.role === Role.ADMIN
                                ? { to: r.email, actionUrl: `${frontend}/dashboard/admin/finance` }
                                : undefined,
                    })
                    .catch((error: unknown) => {
                        console.error(`[Refunds] Failed to notify staff about request ${created.id}:`, error);
                    }),
            ),
        );

        await this.audit.logAction(
            `Refund request ${created.id} created for payment ${payment.id} (${amountLabel})`,
            undefined,
            studentId,
        );

        return created;
    }

    async review(id: string, actorId: string, role: Role, dto: ReviewRefundRequestDto) {
        this.assertFinanceRole(role);
        const request = await this.prisma.refundRequest.findUnique({ where: { id } });
        if (!request) throw new NotFoundException('Refund request not found');
        if (request.status !== RefundStatus.PENDING) {
            throw new ConflictException('This request has already been reviewed');
        }

        const note = dto.reviewerNote?.trim() || null;
        if (dto.status === 'APPROVED') {
            if (!request.paymentId) {
                throw new BadRequestException('This request has no linked payment');
            }
            const payment = await this.prisma.payment.findUnique({ where: { id: request.paymentId } });
            if (!payment || payment.status !== PaymentStatus.PAID) {
                throw new ConflictException('The linked payment is no longer refundable');
            }
        }

        const nextStatus = dto.status === 'REJECTED' ? RefundStatus.REJECTED : RefundStatus.PROCESSING;
        const update = await this.prisma.refundRequest.updateMany({
            where: { id, status: RefundStatus.PENDING },
            data: {
                status: nextStatus,
                reviewerNote: note,
                reviewedAt: new Date(),
                reviewedById: actorId,
            },
        });
        if (update.count !== 1) throw new ConflictException('This request has already been reviewed');

        const updated = await this.prisma.refundRequest.findUnique({
            where: { id },
            include: REFUND_INCLUDE,
        });
        if (!updated) throw new NotFoundException('Refund request not found');

        await this.audit.logAction(
            dto.status === 'REJECTED'
                ? `Refund request ${id} rejected`
                : `Refund request ${id} approved for manual payout (payment ${request.paymentId})`,
            undefined,
            actorId,
        );
        await this.notifications.notify({
            userId: request.studentId,
            type: dto.status === 'REJECTED' ? 'refund.rejected' : 'refund.processing',
            titleAr: dto.status === 'REJECTED' ? 'تم رفض طلب الاسترداد' : 'طلب الاسترداد قيد التنفيذ',
            titleEn: dto.status === 'REJECTED' ? 'Refund request rejected' : 'Refund request is being processed',
            bodyAr: dto.status === 'REJECTED'
                ? note ?? 'تم رفض طلب استرداد المبلغ.'
                : 'تم اعتماد طلبك. سيُحوّل المبلغ يدويًا، وستتلقى إشعارًا عند إتمام التحويل.',
            bodyEn: dto.status === 'REJECTED'
                ? note ?? 'Your refund request was rejected.'
                : 'Your request was approved. The refund will be sent manually, and you will be notified when the transfer is complete.',
            data: { refundRequestId: id, courseId: request.courseId },
        }).catch((error: unknown) => {
            console.error(`[Refunds] Failed to notify student for request ${id}:`, error);
        });
        return updated;
    }

    async complete(
        id: string,
        actorId: string,
        role: Role,
        dto: CompleteRefundRequestDto,
    ) {
        this.assertFinanceRole(role);
        const payoutReference = dto.payoutReference?.trim() || null;
        const request = await this.prisma.refundRequest.findUnique({
            where: { id },
            include: { payment: true },
        });
        if (!request) throw new NotFoundException('Refund request not found');
        if (request.status === RefundStatus.APPROVED) {
            return this.prisma.refundRequest.findUnique({
                where: { id },
                include: REFUND_INCLUDE,
            });
        }
        if (request.status !== RefundStatus.PROCESSING) {
            throw new ConflictException('Only a refund awaiting manual payout can be completed');
        }
        if (!request.paymentId || !request.payment) {
            throw new BadRequestException('This request has no linked payment');
        }

        const paymentId = request.paymentId;
        const completedAt = new Date();
        const result = await this.prisma.$transaction(async (tx) => {
            const paymentUpdate = await tx.payment.updateMany({
                where: { id: paymentId, status: PaymentStatus.PAID },
                data: { status: PaymentStatus.REFUNDED, refundedAt: completedAt },
            });
            if (paymentUpdate.count !== 1) {
                throw new ConflictException('The payment has already changed and cannot be refunded again');
            }

            if (request.payment?.enrollmentId) {
                const revoked = await tx.enrollment.updateMany({
                    where: {
                        id: request.payment.enrollmentId,
                        status: EnrollmentStatus.APPROVED,
                    },
                    data: { status: EnrollmentStatus.REVOKED },
                });
                if (revoked.count === 1) await releaseSeat(tx, request.payment.openingId);
            }

            const requestUpdate = await tx.refundRequest.updateMany({
                where: { id, status: RefundStatus.PROCESSING },
                data: {
                    status: RefundStatus.APPROVED,
                    completedAt,
                    completedById: actorId,
                    payoutReference,
                },
            });
            if (requestUpdate.count !== 1) {
                throw new ConflictException('This refund request has already been completed');
            }
            return tx.refundRequest.findUnique({
                where: { id },
                include: REFUND_INCLUDE,
            });
        });
        if (!result) throw new NotFoundException('Refund request not found');

        await this.audit.logAction(
            `Refund request ${id} completed manually (payment ${paymentId})${payoutReference ? `, reference ${payoutReference}` : ''}`,
            undefined,
            actorId,
        );
        await this.notifications.notify({
            userId: request.studentId,
            type: 'refund.completed',
            titleAr: 'تم تحويل مبلغ الاسترداد',
            titleEn: 'Refund transfer completed',
            bodyAr: `تم إتمام تحويل مبلغ الاسترداد ${Number(request.amount)} ${request.currency}.`,
            bodyEn: `Your refund of ${Number(request.amount)} ${request.currency} has been transferred.`,
            data: { refundRequestId: id, paymentId },
        }).catch((error: unknown) => {
            console.error(`[Refunds] Failed to notify student of completed request ${id}:`, error);
        });

        if (request.payment.openingId) {
            try {
                const room = await this.chat.getOrCreateRoomForOpening(request.payment.openingId);
                await this.chat.syncRoomMembers(room.id);
            } catch (error) {
                console.error(`[Refunds] Failed to sync course chat after refund ${id}:`, error);
            }
        }
        return result;
    }

    private assertFinanceRole(role: Role) {
        if (role !== Role.ADMIN && role !== Role.FINANCE) {
            throw new ForbiddenException('Only finance staff can review refunds');
        }
    }
}
