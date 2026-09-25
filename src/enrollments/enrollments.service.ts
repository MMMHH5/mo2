import { Injectable, NotFoundException, ConflictException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EnrollmentStatus, CourseOpeningStatus, Role, PaymentStatus } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ChatService } from '../chat/chat.service';
import { resolvePrivateUpload } from '../common/private-uploads';
import { claimSeat, releaseSeat, assertOpeningEligible, CapacityConflictException } from '../common/opening-seats';

@Injectable()
export class EnrollmentsService {
    constructor(
        private prisma: PrismaService,
        private audit: AuditService,
        private notifications: NotificationsService,
        private chatService: ChatService,
    ) { }

    private async resolveOpening(courseId: string, openingId?: string) {
        if (openingId) {
            const opening = await this.prisma.courseOpening.findUnique({ where: { id: openingId } });
            if (!opening || opening.courseId !== courseId) {
                throw new NotFoundException('Opening not found for this course');
            }
            return opening;
        }
        // Fallback: first published opening of the course, if any.
        const opening = await this.prisma.courseOpening.findFirst({
            where: { courseId, isPublished: true },
            orderBy: { createdAt: 'desc' },
        });
        return opening ?? null;
    }

    async enrollByAdmin(courseId: string, studentId: string, adminId: string, openingId?: string, ipAddress?: string) {
        const [course, student] = await Promise.all([
            this.prisma.course.findUnique({ where: { id: courseId } }),
            this.prisma.user.findUnique({ where: { id: studentId } }),
        ]);
        if (!course) throw new NotFoundException('Course not found');
        if (!student) throw new NotFoundException('Student not found');

        const opening = await this.resolveOpening(courseId, openingId);
        if (!opening) throw new BadRequestException('No open opening available for this course');

        // Admin path shares the same eligibility rules: published opening, OPEN
        // status, enrollment deadline and — critically — the atomic seat claim
        // so staff can't oversubscribe the last seat either.
        assertOpeningEligible(opening, { requirePublished: true, enforceDeadline: true });

        const enrollment = await this.prisma.$transaction(async (tx) => {
            const existing = await tx.enrollment.findUnique({
                where: { studentId_courseId: { studentId, courseId } }
            });

            // A student who already holds a seat (PENDING/RESERVED/APPROVED)
            // keeps it — the upgrade must NOT claim a second seat.
            const holdsSeat = existing
                && (existing.status === EnrollmentStatus.PENDING
                    || existing.status === EnrollmentStatus.RESERVED
                    || existing.status === EnrollmentStatus.APPROVED);
            if (!holdsSeat) {
                await claimSeat(tx, opening.id);
            }

            if (existing) {
                if (existing.status === EnrollmentStatus.APPROVED) {
                    throw new ConflictException('Student is already enrolled in this course');
                }
                return tx.enrollment.update({
                    where: { id: existing.id },
                    data: {
                        status: EnrollmentStatus.APPROVED,
                        openingId: opening.id,
                        financeOfficerNotes: 'Assigned by staff',
                    },
                });
            }
            return tx.enrollment.create({
                data: {
                    courseId,
                    studentId,
                    openingId: opening.id,
                    status: EnrollmentStatus.APPROVED,
                    financeOfficerNotes: 'Assigned by staff',
                },
            });
        });

        await this.audit.logAction(`ADMIN/CM ${adminId} enrolled student ${studentId} in Course ${courseId} (APPROVED)`, ipAddress, adminId);
        const courseTitle = course.titleAr || course.titleEn;
        await this.notifications.notify({
            userId: studentId,
            type: 'enrollment.approved',
            titleAr: 'تم تأكيد تسجيلك',
            titleEn: 'Enrollment confirmed',
            bodyAr: `تم تفعيل تسجيلك في دورة: ${courseTitle}`,
            bodyEn: `Your enrollment in "${course.titleEn}" is now active.`,
            data: { courseId, enrollmentId: enrollment.id },
        }).catch(() => {});

        // Auto-add student to the batch chat room
        if (opening?.id) {
            try {
                const room = await this.chatService.getOrCreateRoomForOpening(opening.id);
                await this.chatService.syncRoomMembers(room.id);
            } catch { /* don't fail enrollment if chat sync fails */ }
        }

        return enrollment;
    }

    async getPending() {
        return this.prisma.enrollment.findMany({
            where: { status: EnrollmentStatus.PENDING },
            include: {
                student: { select: { id: true, email: true } },
                course: { select: { id: true, titleAr: true, titleEn: true, descriptionAr: true, descriptionEn: true } },
                opening: {
                    select: {
                        id: true,
                        nameAr: true,
                        nameEn: true,
                        price: true,
                        priceOld: true,
                        startDate: true,
                        endDate: true,
                        enrollmentDeadline: true,
                        isPublished: true,
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    async getMyEnrollments(studentId: string) {
        return this.prisma.enrollment.findMany({
            where: { studentId },
            include: {
                course: {
                    select: {
                        id: true,
                        titleAr: true,
                        titleEn: true,
                        descriptionAr: true,
                        descriptionEn: true,
                        instructor: { select: { id: true, email: true, role: true } },
                    },
                },
                opening: {
                    select: {
                        id: true,
                        status: true,
                        nameAr: true,
                        nameEn: true,
                        price: true,
                        priceOld: true,
                        startDate: true,
                        endDate: true,
                        enrollmentDeadline: true,
                        isPublished: true,
                        instructor: { select: { id: true, email: true, role: true } },
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    async getMyGrades(studentId: string) {
        const enrollments = await this.prisma.enrollment.findMany({
            where: { studentId, status: EnrollmentStatus.APPROVED },
            include: {
                course: {
                    select: {
                        id: true,
                        titleAr: true,
                        titleEn: true,
                    },
                },
                opening: {
                    select: {
                        id: true,
                        nameAr: true,
                        nameEn: true,
                    },
                },
                grades: {
                    include: { assessment: true },
                    orderBy: { assessment: { orderIndex: 'asc' } },
                },
            },
            orderBy: { createdAt: 'desc' },
        });

        const openingIds = [...new Set(
            enrollments.map(e => e.opening?.id).filter((id): id is string => Boolean(id))
        )];
        const assessments = openingIds.length > 0
            ? await this.prisma.assessment.findMany({
                where: { openingId: { in: openingIds } },
                orderBy: { orderIndex: 'asc' },
            })
            : [];
        const byOpening = new Map<string, typeof assessments>();
        for (const a of assessments) {
            const list = byOpening.get(a.openingId) || [];
            list.push(a);
            byOpening.set(a.openingId, list);
        }

        return enrollments.map(e => ({
            course: e.course,
            opening: e.opening,
            grades: e.grades,
            assessments: e.opening ? (byOpening.get(e.opening.id) || []) : [],
        }));
    }

    async getAllEnrollments() {
        return this.prisma.enrollment.findMany({
            include: {
                student: { select: { id: true, email: true } },
                course: { select: { id: true, titleAr: true, titleEn: true } },
                opening: {
                    select: {
                        id: true,
                        nameAr: true,
                        nameEn: true,
                        price: true,
                        priceOld: true,
                        isPublished: true,
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    async enrollWithReceipt(openingId: string, receiptUrl: string, studentId: string, ipAddress?: string) {
        const opening = await this.prisma.courseOpening.findUnique({
            where: { id: openingId },
            include: { course: { select: { id: true, titleEn: true, titleAr: true } } },
        });
        if (!opening) throw new NotFoundException('Opening not found');
        assertOpeningEligible(opening, { requirePublished: true, enforceDeadline: true });

        const courseId = opening.courseId;

        return this.prisma.$transaction(async (tx) => {
            let existing = await tx.enrollment.findUnique({
                where: { studentId_courseId: { studentId, courseId } }
            });

            if (existing) {
                if (existing.status === 'RESERVED' || existing.status === 'PENDING') {
                    existing = await tx.enrollment.update({
                        where: { id: existing.id },
                        data: { openingId, receiptFileUrl: receiptUrl, status: EnrollmentStatus.PENDING }
                    });
                } else {
                    throw new ConflictException('Already enrolled in this course');
                }
            } else {
                // New registration always claims an atomic seat. Existing
                // RESERVED/PENDING records already hold theirs.
                await claimSeat(tx, openingId);
                existing = await tx.enrollment.create({
                    data: {
                        courseId,
                        studentId,
                        openingId,
                        receiptFileUrl: receiptUrl,
                        status: EnrollmentStatus.PENDING,
                    }
                });
            }

            // Link the receipt upload to a manual Payment row so the finance
            // ledger and the enrollment stay consistent (unified manual flow).
            if (existing) {
                const payment = await tx.payment.findFirst({
                    where: { studentId, openingId },
                    orderBy: { createdAt: 'desc' },
                });
                const amount = Number(opening.price) || 0;
                if (payment && payment.status === PaymentStatus.PENDING && payment.provider === 'MANUAL') {
                    await tx.payment.update({
                        where: { id: payment.id },
                        data: { receiptFileUrl: receiptUrl, enrollmentId: existing.id },
                    });
                } else {
                    await tx.payment.create({
                        data: {
                            studentId,
                            openingId,
                            enrollmentId: existing.id,
                            amount,
                            currency: opening.currency,
                            provider: 'MANUAL',
                            method: 'RECEIPT',
                            description: `Receipt enrollment in ${opening.course.titleEn}`,
                            receiptFileUrl: receiptUrl,
                        },
                    });
                }
            }

            await tx.auditLog.create({
                data: { userId: studentId, ipAddress, action: `Uploaded receipt and enrolled in Course ${courseId} (opening ${openingId})` },
            });

            return existing;
        });
    }

    async reserveSeat(courseId: string, studentId: string, ipAddress?: string) {
        const existing = await this.prisma.enrollment.findUnique({
            where: { studentId_courseId: { studentId, courseId } }
        });

        if (existing) {
            throw new ConflictException('Already enrolled or reserved');
        }

        const opening = await this.prisma.courseOpening.findFirst({
            where: { courseId, status: CourseOpeningStatus.ANNOUNCEMENT },
            orderBy: { createdAt: 'desc' },
        });
        if (!opening) {
            throw new BadRequestException('This course is not open for reservation yet');
        }
        assertOpeningEligible(opening, { requiredStatus: CourseOpeningStatus.ANNOUNCEMENT, requirePublished: true, enforceDeadline: false });

        const enrollment = await this.prisma.$transaction(async (tx) => {
            await claimSeat(tx, opening.id);
            return tx.enrollment.create({
                data: {
                    courseId,
                    studentId,
                    openingId: opening.id,
                    status: 'RESERVED',
                }
            });
        });

        await this.audit.logAction(`Reserved seat in Course ${courseId}`, ipAddress, studentId);

        return enrollment;
    }

    async review(enrollmentId: string, status: EnrollmentStatus, reviewerId: string, ipAddress?: string, notes?: string) {
        if (status !== EnrollmentStatus.APPROVED && status !== EnrollmentStatus.REJECTED) {
            throw new BadRequestException('Review status must be APPROVED or REJECTED');
        }

        const enrollment = await this.prisma.enrollment.findUnique({
            where: { id: enrollmentId },
            include: {
                student: true,
                course: { select: { id: true, titleAr: true, titleEn: true } },
                payments: { orderBy: { createdAt: 'desc' } },
                opening: { select: { id: true } },
            },
        });
        if (!enrollment) throw new NotFoundException('Enrollment not found');

        // Restrict transitions: only PENDING enrollments awaiting review can be
        // decided, and only once. Already-decided / reserved / revoked records
        // must not be re-reviewed into an inconsistent state.
        if (enrollment.status !== EnrollmentStatus.PENDING) {
            throw new ConflictException(`Enrollment is in "${enrollment.status}" state and cannot be reviewed`);
        }

        const pendingPayment = enrollment.payments.find(p => p.status === PaymentStatus.PENDING);

        // The manual payment flow anchors on the pending Payment: approval marks
        // it PAID, rejection marks it REJECTED — in the same transaction as the
        // enrollment decision so the ledger can never drift from the enrollment.
        const updated = await this.prisma.$transaction(async (tx) => {
            const u = await tx.enrollment.update({
                where: { id: enrollmentId },
                data: { status, financeOfficerNotes: notes },
            });
            if (pendingPayment) {
                await tx.payment.update({
                    where: { id: pendingPayment.id },
                    data: status === EnrollmentStatus.APPROVED
                        ? { status: PaymentStatus.PAID, paidAt: new Date(), reviewedAt: new Date() }
                        : { status: PaymentStatus.REJECTED, reviewedAt: new Date() },
                });
            }
            // A rejected enrollment must give its seat back so the opening can
            // fill it with the next applicant (atomic counter).
            if (status === EnrollmentStatus.REJECTED && enrollment.openingId) {
                await releaseSeat(tx, enrollment.openingId);
            }
            return u;
        });

        await this.audit.logAction(
            `Finance reviewed Enrollment ${enrollmentId} with status ${status}`,
            ipAddress,
            reviewerId
        );

        const courseTitle = enrollment.course.titleEn;
        await this.notifications.notify({
            userId: enrollment.studentId,
            type: status === EnrollmentStatus.APPROVED ? 'enrollment.approved' : 'enrollment.rejected',
            titleAr: status === EnrollmentStatus.APPROVED ? 'تمت الموافقة على تسجيلك' : 'تم رفض تسجيلك',
            titleEn: status === EnrollmentStatus.APPROVED ? 'Enrollment approved' : 'Enrollment rejected',
            bodyAr: status === EnrollmentStatus.APPROVED
                ? `تمت الموافقة على تسجيلك في دورة: ${courseTitle}`
                : `عذراً، تم رفض طلب التسجيل في دورة: ${courseTitle}`,
            bodyEn: status === EnrollmentStatus.APPROVED
                ? `Your enrollment in "${courseTitle}" was approved.`
                : `Sorry, your enrollment in "${courseTitle}" was rejected.`,
            data: { courseId: enrollment.courseId, enrollmentId },
        }).catch(() => {});

        // Auto-sync batch chat room membership on approval or rejection
        if (enrollment.openingId) {
            try {
                const room = await this.chatService.getOrCreateRoomForOpening(enrollment.openingId);
                await this.chatService.syncRoomMembers(room.id);
            } catch { /* don't fail enrollment review if chat sync fails */ }
        }

        return updated;
    }

    /**
     * Resolve the absolute path of an enrollment's receipt file AFTER verifying
     * the caller may see it: the owning student, FINANCE, ADMIN (any role is
     * rejected with 403 — the file itself is private, never publicly exposed).
     */
    async getReceiptPath(enrollmentId: string, requesterId: string, role: Role) {
        const enrollment = await this.prisma.enrollment.findUnique({ where: { id: enrollmentId } });
        if (!enrollment) throw new NotFoundException('Enrollment not found');

        const allowed = role === Role.FINANCE || role === Role.ADMIN || enrollment.studentId === requesterId;
        if (!allowed) throw new ForbiddenException('Access denied to this receipt');

        if (!enrollment.receiptFileUrl) throw new NotFoundException('No receipt on file');
        return resolvePrivateUpload(enrollment.receiptFileUrl, ['receipts']);
    }
}
