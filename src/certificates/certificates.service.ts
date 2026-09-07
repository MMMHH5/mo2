import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { Role } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class CertificatesService {
    constructor(
        private prisma: PrismaService,
        private audit: AuditService,
        private notifications: NotificationsService,
    ) { }

    async issueForOpening(openingId: string) {
        const opening = await this.prisma.courseOpening.findUnique({
            where: { id: openingId },
            select: { id: true, courseId: true, course: { select: { titleAr: true, titleEn: true } } },
        });
        if (!opening) return [];

        const enrollments = await this.prisma.enrollment.findMany({
            where: { openingId, status: 'APPROVED' },
            select: { studentId: true, student: { select: { email: true } } },
        });

        const issued: string[] = [];
        for (const enrollment of enrollments) {
            const existing = await this.prisma.certificate.findFirst({
                where: { studentId: enrollment.studentId, courseId: opening.courseId },
            });
            if (existing) continue;
            const cert = await this.prisma.certificate.create({
                data: { studentId: enrollment.studentId, courseId: opening.courseId },
            });
            issued.push(cert.id);
            await this.notifications.notify({
                userId: enrollment.studentId,
                type: 'certificate.issued',
                titleAr: 'تم إصدار شهادتك',
                titleEn: 'Certificate issued',
                bodyAr: `تم إصدار شهادتك في دورة: ${opening.course.titleAr}`,
                bodyEn: `Your certificate for "${opening.course.titleEn}" has been issued.`,
                data: { certificateId: cert.id, courseId: opening.courseId },
            }).catch(() => {});
        }

        if (issued.length > 0) {
            await this.audit.logAction(`Issued ${issued.length} certificate(s) for Opening ${openingId}`);
        }
        return issued;
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