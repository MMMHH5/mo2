import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EnrollmentStatus, CourseOpeningStatus } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ChatService } from '../chat/chat.service';

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

        const existing = await this.prisma.enrollment.findUnique({
            where: { studentId_courseId: { studentId, courseId } }
        });

        let enrollment;
        if (existing) {
            if (existing.status === EnrollmentStatus.APPROVED) {
                throw new ConflictException('Student is already enrolled in this course');
            }
            enrollment = await this.prisma.enrollment.update({
                where: { id: existing.id },
                data: {
                    status: EnrollmentStatus.APPROVED,
                    openingId: opening?.id ?? existing.openingId,
                    financeOfficerNotes: 'Assigned by staff',
                },
            });
        } else {
            enrollment = await this.prisma.enrollment.create({
                data: {
                    courseId,
                    studentId,
                    openingId: opening?.id,
                    status: EnrollmentStatus.APPROVED,
                    financeOfficerNotes: 'Assigned by staff',
                },
            });
        }

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
        const opening = await this.prisma.courseOpening.findUnique({ where: { id: openingId } });
        if (!opening) throw new NotFoundException('Opening not found');
        if (opening.status !== CourseOpeningStatus.OPEN) {
            throw new BadRequestException('This course opening is not open for registration yet');
        }

        const courseId = opening.courseId;
        let existing = await this.prisma.enrollment.findUnique({
            where: { studentId_courseId: { studentId, courseId } }
        });

        if (existing) {
            if (existing.status === 'RESERVED' || existing.status === 'PENDING') {
                return this.prisma.enrollment.update({
                    where: { id: existing.id },
                    data: { openingId, receiptFileUrl: receiptUrl, status: EnrollmentStatus.PENDING }
                });
            }
            throw new ConflictException('Already enrolled in this course');
        }

        const enrollment = await this.prisma.enrollment.create({
            data: {
                courseId,
                studentId,
                openingId,
                receiptFileUrl: receiptUrl,
                status: EnrollmentStatus.PENDING,
            }
        });

        await this.audit.logAction(`Uploaded receipt and enrolled in Course ${courseId} (opening ${openingId})`, ipAddress, studentId);

        return enrollment;
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

        const enrollment = await this.prisma.enrollment.create({
            data: {
                courseId,
                studentId,
                openingId: opening.id,
                status: 'RESERVED',
            }
        });

        await this.audit.logAction(`Reserved seat in Course ${courseId}`, ipAddress, studentId);

        return enrollment;
    }

    async review(enrollmentId: string, status: EnrollmentStatus, reviewerId: string, ipAddress?: string, notes?: string) {
        // Log action
        await this.audit.logAction(
            `Finance reviewed Enrollment ${enrollmentId} with status ${status}`,
            ipAddress,
            reviewerId
        );

        const enrollment = await this.prisma.enrollment.findUnique({
            where: { id: enrollmentId },
            include: { student: true, course: { select: { id: true, titleAr: true, titleEn: true } } },
        });
        if (!enrollment) throw new NotFoundException('Enrollment not found');

        const updated = await this.prisma.enrollment.update({
            where: { id: enrollmentId },
            data: {
                status,
                financeOfficerNotes: notes,
            }
        });

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
}
