import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface AdminActivityRecord {
    action: string;
    userId: string;
    actorEmail: string;
    actorRole: string;
    targetType: string;
    targetId?: string;
    targetLabel?: string;
    method: string;
    route: string;
    ipAddress?: string;
    details?: Prisma.InputJsonValue;
}

export type AdminActivityPreviousValues = Record<string, string | number | boolean>;

const isJsonObject = (value: Prisma.JsonValue | null): value is Prisma.JsonObject =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

@Injectable()
export class AuditService {
    private readonly logger = new Logger(AuditService.name);

    constructor(private prisma: PrismaService) { }

    async logAction(action: string, ipAddress?: string, userId?: string) {
        try {
            await this.prisma.auditLog.create({
                data: {
                    action,
                    ipAddress,
                    userId,
                },
            });
        } catch (error) {
            this.logger.error(`Failed to record audit log: ${action}`, error);
        }
    }

    async logAdminActivity(record: AdminActivityRecord): Promise<void> {
        try {
            await this.prisma.auditLog.create({
                data: {
                    action: record.action,
                    userId: record.userId,
                    actorEmail: record.actorEmail,
                    actorRole: record.actorRole,
                    targetType: record.targetType,
                    targetId: record.targetId,
                    targetLabel: record.targetLabel,
                    method: record.method,
                    route: record.route,
                    ipAddress: record.ipAddress,
                    details: record.details,
                },
            });
        } catch (error) {
            this.logger.error(`Failed to record admin activity: ${record.action}`, error);
        }
    }

    async resolveAdminActivityPreviousValues(
        targetType: string,
        targetId: string,
        fields: string[],
    ): Promise<AdminActivityPreviousValues> {
        const safeFields = new Set(fields);
        try {
            let snapshot: Record<string, unknown> | null = null;
            if (targetType === 'دورة') {
                snapshot = await this.prisma.course.findUnique({
                    where: { id: targetId },
                    select: {
                        titleAr: true, titleEn: true, categoryAr: true, categoryEn: true,
                        level: true, contentType: true, language: true, hoursOfContent: true,
                        durationAr: true, durationEn: true, certificateIssued: true, quizzesIncluded: true,
                        projectsIncluded: true, assignmentsIncluded: true, liveSessionsIncluded: true,
                        downloadableResources: true, lifetimeAccess: true, communityAccess: true,
                        coverImageUrl: true, introVideoUrl: true, videoFileUrl: true,
                    },
                });
            } else if (targetType === 'دفعة دورة') {
                snapshot = await this.prisma.courseOpening.findUnique({
                    where: { id: targetId },
                    select: {
                        nameAr: true, nameEn: true, status: true, isPublished: true,
                        startDate: true, endDate: true, enrollmentDeadline: true, price: true,
                        priceOld: true, maxStudents: true, refundWindowDays: true, deliveryMode: true,
                        announcementStartAt: true, announcementEndAt: true, currency: true,
                    },
                });
            } else {
                return {};
            }
            if (!snapshot) return {};

            const previousValues: AdminActivityPreviousValues = {};
            for (const field of safeFields) {
                const value = snapshot[field];
                if (['coverImageUrl', 'introVideoUrl', 'videoFileUrl'].includes(field)) {
                    previousValues[field] = value ? 'تم تعيين رابط الوسيط' : 'لا يوجد رابط';
                } else if (value instanceof Date) {
                    previousValues[field] = value.toISOString();
                } else if (typeof value === 'string' || typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value))) {
                    previousValues[field] = typeof value === 'string' ? value.slice(0, 120) : value;
                } else if (value && typeof value === 'object' && value.constructor?.name === 'Decimal') {
                    previousValues[field] = String(value).slice(0, 120);
                }
            }
            return previousValues;
        } catch (error) {
            this.logger.error(`Failed to resolve previous admin activity values for ${targetType}`, error);
            return {};
        }
    }

    async logOpeningActivity(
        openingId: string,
        userId: string,
        action: string,
        details?: Prisma.InputJsonValue,
    ): Promise<void> {
        try {
            await this.prisma.auditLog.create({
                data: {
                    action,
                    userId,
                    targetType: 'OPENING_ACTIVITY',
                    targetId: openingId,
                    details,
                },
            });
        } catch (error) {
            this.logger.error(`Failed to record opening activity: ${action}`, error);
        }
    }

    async resolveAdminActivityTargetLabel(targetType: string, targetId: string): Promise<string | undefined> {
        try {
            if (targetType === 'تسجيل طالب أو إيصال') {
                const enrollment = await this.prisma.enrollment.findUnique({
                    where: { id: targetId },
                    select: {
                        student: { select: { email: true, metadata: true } },
                        course: { select: { titleAr: true, titleEn: true } },
                    },
                });
                if (!enrollment) return undefined;
                const studentName = getProfileName(enrollment.student.metadata);
                const student = studentName || enrollment.student.email;
                const course = enrollment.course.titleAr || enrollment.course.titleEn;
                return `${targetType}: ${student}${course ? ` — ${course}` : ''}`.slice(0, 250);
            }

            if (targetType === 'حساب مستخدم أو طالب') {
                const user = await this.prisma.user.findUnique({
                    where: { id: targetId },
                    select: { email: true, metadata: true },
                });
                if (!user) return undefined;
                return `${targetType}: ${getProfileName(user.metadata) || user.email}`.slice(0, 250);
            }

            if (targetType === 'دورة') {
                const course = await this.prisma.course.findUnique({
                    where: { id: targetId },
                    select: { titleAr: true, titleEn: true },
                });
                const title = course?.titleAr || course?.titleEn;
                return title ? `${targetType}: ${title}`.slice(0, 250) : undefined;
            }

            if (targetType === 'دفعة دورة') {
                const opening = await this.prisma.courseOpening.findUnique({
                    where: { id: targetId },
                    select: {
                        nameAr: true,
                        nameEn: true,
                        course: { select: { titleAr: true, titleEn: true } },
                    },
                });
                if (!opening) return undefined;
                const openingName = opening.nameAr || opening.nameEn;
                const courseName = opening.course.titleAr || opening.course.titleEn;
                const label = [courseName, openingName].filter(Boolean).join(' — ');
                return label ? `${targetType}: ${label}`.slice(0, 250) : undefined;
            }
        } catch (error) {
            this.logger.error(`Failed to resolve admin activity target: ${targetType}`, error);
        }
        return undefined;
    }
}

function getProfileName(metadata: Prisma.JsonValue | null): string | undefined {
    if (!isJsonObject(metadata)) return undefined;
    const name = metadata.fullName;
    return typeof name === 'string' && name.trim() ? name.trim().slice(0, 120) : undefined;
}
