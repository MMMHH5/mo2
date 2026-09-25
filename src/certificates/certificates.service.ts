import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { Role, CertificateStatus } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class CertificatesService {
    constructor(
        private prisma: PrismaService,
        private audit: AuditService,
        private notifications: NotificationsService,
    ) { }

    /**
     * Compose the exact set of students that MAY receive a certificate for an
     * opening: those with an APPROVED enrollment on that specific batch.
     */
    async listCandidates(openingId: string) {
        const opening = await this.prisma.courseOpening.findUnique({
            where: { id: openingId },
            include: {
                course: { select: { id: true, titleAr: true, titleEn: true, certificateIssued: true } },
            },
        });
        if (!opening) throw new NotFoundException('Opening not found');

        const enrollments = await this.prisma.enrollment.findMany({
            where: { openingId, status: 'APPROVED' },
            select: {
                studentId: true,
                student: { select: { email: true } },
            },
        });

        const issued = await this.prisma.certificate.findMany({
            where: { courseId: opening.courseId },
            select: { id: true, studentId: true, verificationStatus: true },
        });
        const issuedBy = new Map<string, { id: string; status: string }>();
        for (const c of issued) issuedBy.set(c.studentId, { id: c.id, status: c.verificationStatus });

        // Openings generate a course-level certificate: a student can only have
        // one per course, so re-issuing to an already-certified student is a
        // re-issue — flag it as such rather than silently skipping.
        return enrollments.map(e => {
            const ex = issuedBy.get(e.studentId);
            return {
                studentId: e.studentId,
                email: e.student.email,
                certificateStatus: ex?.status ?? null,
                certificateId: ex?.id ?? null,
            };
        });
    }

    /**
     * Manually issue certificates for the SELECTED students of an opening.
     * Requires the course to be configured to grant certificates
     * (`course.certificateIssued`), and only APPROVED enrollments of that
     * opening are eligible. Fully audit-logged.
     */
    async issueForStudents(openingId: string, studentIds: string[], actorId: string, actorRole: Role) {
        const opening = await this.prisma.courseOpening.findUnique({
            where: { id: openingId },
            include: {
                course: { select: { id: true, titleAr: true, titleEn: true, certificateIssued: true } },
            },
        });
        if (!opening) throw new NotFoundException('Opening not found');
        if (!opening.course.certificateIssued) {
            throw new BadRequestException('This course is not configured to issue certificates');
        }
        // Certificates are granted after the batch finishes and the instructor
        // reviews performance; opening must have ended so we don't hand out
        // certificates for a course still in progress.
        if (opening.status !== 'ENDED') {
            throw new BadRequestException('Certificates can only be issued after the course opening has ended');
        }

        const enrollments = await this.prisma.enrollment.findMany({
            where: { openingId, status: 'APPROVED', studentId: { in: studentIds } },
            select: { studentId: true },
        });
        const eligible = new Set(enrollments.map(e => e.studentId));

        const issued: string[] = [];
        for (const studentId of new Set(studentIds)) {
            if (!eligible.has(studentId)) continue;
            const existing = await this.prisma.certificate.findFirst({
                where: { studentId, courseId: opening.courseId },
            });
            if (existing) {
                if (existing.verificationStatus === CertificateStatus.VALID) continue;
                // Re-affirming a certificate that was revoked/expired.
                const cert = await this.prisma.certificate.update({
                    where: { id: existing.id },
                    data: { verificationStatus: CertificateStatus.VALID, issuingDate: new Date() },
                });
                issued.push(cert.id);
            } else {
                const cert = await this.prisma.certificate.create({
                    data: { studentId, courseId: opening.courseId },
                });
                issued.push(cert.id);
            }
            await this.notifications.notify({
                userId: studentId,
                type: 'certificate.issued',
                titleAr: 'تم إصدار شهادتك',
                titleEn: 'Certificate issued',
                bodyAr: `تم إصدار شهادتك في دورة: ${opening.course.titleAr}`,
                bodyEn: `Your certificate for "${opening.course.titleEn}" has been issued.`,
                data: { certificateId: issued[issued.length - 1], courseId: opening.courseId },
            }).catch(() => {});
        }

        if (issued.length > 0) {
            await this.audit.logAction(
                `Issued ${issued.length} certificate(s) for Opening ${openingId} (${studentIds.length} selected)`,
                undefined,
                actorId,
            );
        }
        return { issued, count: issued.length };
    }

    async revoke(id: string, actorId: string, actorRole: Role) {
        const cert = await this.prisma.certificate.findUnique({ where: { id } });
        if (!cert) throw new NotFoundException('Certificate not found');
        if (cert.verificationStatus !== CertificateStatus.VALID) {
            throw new BadRequestException('Only a valid certificate can be revoked');
        }
        const updated = await this.prisma.certificate.update({
            where: { id },
            data: { verificationStatus: CertificateStatus.REVOKED },
        });
        await this.audit.logAction(`Revoked certificate ${id}`, undefined, actorId);
        return updated;
    }

    async reissue(id: string, actorId: string, actorRole: Role) {
        const cert = await this.prisma.certificate.findUnique({ where: { id } });
        if (!cert) throw new NotFoundException('Certificate not found');
        const updated = await this.prisma.certificate.update({
            where: { id },
            data: { verificationStatus: CertificateStatus.VALID, issuingDate: new Date() },
        });
        await this.audit.logAction(`Reissued certificate ${id}`, undefined, actorId);
        return updated;
    }

    /**
     * Checks that the actor may manage certificates for the opening: the
     * opening's instructor, or ADMIN / COURSE_MANAGER.
     */
    async assertCanManageOpening(openingId: string, userId: string, role: Role) {
        if (role === Role.ADMIN || role === Role.COURSE_MANAGER) return;
        if (role !== Role.INSTRUCTOR) throw new ForbiddenException('Only the batch instructor or an admin can manage certificates');
        const opening = await this.prisma.courseOpening.findUnique({
            where: { id: openingId },
            select: { instructorId: true },
        });
        if (!opening) throw new NotFoundException('Opening not found');
        if (opening.instructorId !== userId) {
            throw new ForbiddenException('You do not teach this batch');
        }
    }

    async listMine(studentId: string) {
        return this.prisma.certificate.findMany({
            where: { studentId },
            include: {
                course: {
                    select: { id: true, titleAr: true, titleEn: true, certificateIssued: true },
                },
            },
            orderBy: { issuingDate: 'desc' },
        });
    }

    async getByCourse(courseId: string, studentId: string) {
        const cert = await this.prisma.certificate.findFirst({
            where: { studentId, courseId },
            include: {
                course: {
                    select: { id: true, titleAr: true, titleEn: true, certificateIssued: true },
                },
            },
        });
        if (!cert) throw new NotFoundException('Certificate not found for this course');
        return cert;
    }

    async getOne(id: string, studentId: string, role: Role) {
        const cert = await this.prisma.certificate.findUnique({
            where: { id },
            include: {
                student: { select: { id: true, email: true } },
                course: {
                    select: { id: true, titleAr: true, titleEn: true, certificateIssued: true },
                },
            },
        });
        if (!cert) throw new NotFoundException('Certificate not found');
        if (role !== Role.ADMIN && cert.studentId !== studentId) {
            throw new ForbiddenException('You are not allowed to view this certificate');
        }
        return cert;
    }

    async verifyByCode(code: string) {
        if (!code) {
            return { valid: false, certificate: null };
        }
        const cert = await this.prisma.certificate.findUnique({
            where: { verificationCode: code },
            include: {
                student: { select: { id: true } }, // Never expose email publicly
                course: {
                    select: { id: true, titleAr: true, titleEn: true, certificateIssued: true },
                },
            },
        });
        if (!cert) {
            return { valid: false, certificate: null };
        }
        return {
            valid: cert.verificationStatus === 'VALID',
            certificate: {
                id: cert.id,
                verificationCode: cert.verificationCode,
                issuingDate: cert.issuingDate,
                verificationStatus: cert.verificationStatus,
                student: cert.student,
                course: cert.course,
            },
        };
    }

    async getPublicById(id: string) {
        const cert = await this.prisma.certificate.findUnique({
            where: { id },
            include: {
                student: { select: { id: true } }, // Never expose email publicly
                course: {
                    select: {
                        id: true,
                        titleAr: true,
                        titleEn: true,
                        certificateIssued: true,
                        openings: {
                            select: {
                                instructor: { select: { id: true } }, // Never expose email publicly
                            },
                            take: 1,
                        },
                    },
                },
            },
        });
        if (!cert) {
            return null;
        }
        return {
            id: cert.id,
            verificationCode: cert.verificationCode,
            issuingDate: cert.issuingDate,
            verificationStatus: cert.verificationStatus,
            student: cert.student,
            course: cert.course ? {
                id: cert.course.id,
                titleAr: cert.course.titleAr,
                titleEn: cert.course.titleEn,
            } : null,
        };
    }
}