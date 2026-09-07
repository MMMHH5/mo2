import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { Role } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class TasksService {
    constructor(
        private prisma: PrismaService,
        private audit: AuditService,
        private notifications: NotificationsService,
    ) { }

    private async getTaskOrThrow(taskId: string) {
        const task = await this.prisma.courseTask.findUnique({ where: { id: taskId } });
        if (!task) throw new NotFoundException('Task not found');
        return task;
    }

    private async assertCanManageOpening(openingId: string, actorId: string, actorRole: Role) {
        const opening = await this.prisma.courseOpening.findUnique({ where: { id: openingId } });
        if (!opening) throw new NotFoundException('Opening not found');
        if (actorRole === Role.ADMIN || actorRole === Role.COURSE_MANAGER) return opening;
        if (actorRole === Role.INSTRUCTOR && opening.instructorId === actorId) return opening;
        throw new ForbiddenException('You are not allowed to manage tasks for this opening');
    }

    private async getEnrollmentId(studentId: string, openingId: string) {
        const enrollment = await this.prisma.enrollment.findFirst({
            where: { studentId, openingId, status: { in: ['APPROVED', 'PENDING', 'RESERVED'] } },
            orderBy: { createdAt: 'desc' },
        });
        return enrollment?.id ?? null;
    }

    /** Ensure the target module belongs to the same course as the opening. */
    private async assertModuleBelongsToCourse(moduleId: string, openingId: string) {
        const [module, opening] = await Promise.all([
            this.prisma.module.findUnique({ where: { id: moduleId } }),
            this.prisma.courseOpening.findUnique({ where: { id: openingId } }),
        ]);
        if (!module) throw new BadRequestException('Module not found');
        if (!opening) throw new NotFoundException('Opening not found');
        if (module.courseId !== opening.courseId) {
            throw new BadRequestException('Module does not belong to this course');
        }
    }

    async createTask(openingId: string, dto: {
        titleAr: string;
        titleEn: string;
        descriptionAr?: string;
        descriptionEn?: string;
        dueDate?: string;
        maxScore?: number;
        moduleId?: string;
        attachmentUrl?: string;
        attachmentType?: string;
        links?: { url: string; labelAr?: string; labelEn?: string }[];
    }, actorId: string, actorRole: Role) {
        await this.assertCanManageOpening(openingId, actorId, actorRole);
        if (!dto.titleAr?.trim() || !dto.titleEn?.trim()) {
            throw new BadRequestException('titleAr and titleEn are required');
        }
        if (dto.maxScore != null && dto.maxScore <= 0) {
            throw new BadRequestException('Max score must be greater than 0');
        }
        if (dto.moduleId) {
            await this.assertModuleBelongsToCourse(dto.moduleId, openingId);
        }
        const task = await this.prisma.courseTask.create({
            data: {
                openingId,
                moduleId: dto.moduleId ?? null,
                titleAr: dto.titleAr.trim(),
                titleEn: dto.titleEn.trim(),
                descriptionAr: dto.descriptionAr?.trim() ? dto.descriptionAr.trim() : null,
                descriptionEn: dto.descriptionEn?.trim() ? dto.descriptionEn.trim() : null,
                dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
                maxScore: dto.maxScore ?? 100,
                attachmentUrl: dto.attachmentUrl ?? null,
                attachmentType: dto.attachmentType ?? null,
                links: dto.links?.length ? dto.links as any : undefined,
            },
        });
        await this.audit.logAction(`Created task "${dto.titleAr}" for Opening ${openingId}`, undefined, actorId);
        return task;
    }

    async listTasks(openingId: string, actorId: string, actorRole: Role) {
        const opening = await this.prisma.courseOpening.findUnique({ where: { id: openingId } });
        if (!opening) throw new NotFoundException('Opening not found');

        const isStaff = actorRole === Role.ADMIN || actorRole === Role.COURSE_MANAGER ||
            (actorRole === Role.INSTRUCTOR && opening.instructorId === actorId);
        const isStudent = actorRole === Role.STUDENT;

        if (!isStaff && !isStudent) {
            throw new ForbiddenException('Not allowed to view tasks for this opening');
        }
        if (isStudent) {
            const enrollmentId = await this.getEnrollmentId(actorId, openingId);
            if (!enrollmentId) throw new ForbiddenException('You are not enrolled in this opening');
        }

        const tasks = await this.prisma.courseTask.findMany({
            where: { openingId },
            orderBy: [{ moduleId: 'asc' }, { createdAt: 'desc' }],
            include: {
                module: { select: { id: true, titleAr: true, titleEn: true, orderIndex: true } },
                submissions: isStaff
                    ? { include: { enrollment: { select: { id: true, student: { select: { id: true, email: true } } } } } }
                    : { where: { enrollmentId: await this.getEnrollmentId(actorId, openingId) ?? '00000000' } },
            },
        });
        return tasks;
    }

    async updateTask(taskId: string, dto: {
        titleAr?: string;
        titleEn?: string;
        descriptionAr?: string;
        descriptionEn?: string;
        dueDate?: string;
        maxScore?: number;
        moduleId?: string;
        attachmentUrl?: string;
        attachmentType?: string;
        links?: { url: string; labelAr?: string; labelEn?: string }[];
    }, actorId: string, actorRole: Role) {
        const task = await this.getTaskOrThrow(taskId);
        await this.assertCanManageOpening(task.openingId, actorId, actorRole);
        if (dto.maxScore != null && dto.maxScore <= 0) {
            throw new BadRequestException('Max score must be greater than 0');
        }
        if (dto.moduleId !== undefined) {
            if (dto.moduleId) {
                await this.assertModuleBelongsToCourse(dto.moduleId, task.openingId);
            }
        }
        const updated = await this.prisma.courseTask.update({
            where: { id: taskId },
            data: {
                titleAr: dto.titleAr?.trim() ?? task.titleAr,
                titleEn: dto.titleEn?.trim() ?? task.titleEn,
                descriptionAr: dto.descriptionAr?.trim() !== undefined
                    ? (dto.descriptionAr?.trim() || null)
                    : task.descriptionAr,
                descriptionEn: dto.descriptionEn?.trim() !== undefined
                    ? (dto.descriptionEn?.trim() || null)
                    : task.descriptionEn,
                dueDate: dto.dueDate !== undefined ? (dto.dueDate ? new Date(dto.dueDate) : null) : task.dueDate,
                maxScore: dto.maxScore ?? task.maxScore,
                moduleId: dto.moduleId !== undefined ? (dto.moduleId || null) : task.moduleId,
                attachmentUrl: dto.attachmentUrl !== undefined ? (dto.attachmentUrl || null) : task.attachmentUrl,
                attachmentType: dto.attachmentType !== undefined ? (dto.attachmentType || null) : task.attachmentType,
                links: dto.links !== undefined ? (dto.links?.length ? dto.links as any : null) : task.links,
            },
        });
        await this.audit.logAction(`Updated task ${taskId}`, undefined, actorId);
        return updated;
    }

    async deleteTask(taskId: string, actorId: string, actorRole: Role) {
        const task = await this.getTaskOrThrow(taskId);
        await this.assertCanManageOpening(task.openingId, actorId, actorRole);
        await this.audit.logAction(`Deleted task ${taskId} (Opening ${task.openingId})`, undefined, actorId);
        return this.prisma.courseTask.delete({ where: { id: taskId } });
    }

    // ---------- Submissions ----------

    async submitTask(taskId: string, studentId: string, dto: { content?: string; attachmentUrl?: string }) {
        const task = await this.getTaskOrThrow(taskId);
        const enrollmentId = await this.getEnrollmentId(studentId, task.openingId);
        if (!enrollmentId) throw new ForbiddenException('You are not enrolled in this opening');

        const existing = await this.prisma.taskSubmission.findUnique({
            where: { taskId_enrollmentId: { taskId, enrollmentId } },
        });

        const submission = await this.prisma.taskSubmission.upsert({
            where: { taskId_enrollmentId: { taskId, enrollmentId } },
            update: {
                content: dto.content?.trim() ? dto.content.trim() : (existing?.content ?? null),
                attachmentUrl: dto.attachmentUrl ?? existing?.attachmentUrl ?? null,
                score: existing?.score ?? null,
                notes: existing?.notes ?? null,
            },
            create: {
                taskId,
                enrollmentId,
                content: dto.content?.trim() ? dto.content.trim() : null,
                attachmentUrl: dto.attachmentUrl ?? null,
            },
        });
        await this.audit.logAction(`Student ${studentId} submitted Task ${taskId}`, undefined, studentId);
        return submission;
    }

    async getMySubmission(taskId: string, studentId: string) {
        await this.getTaskOrThrow(taskId);
        const enrollmentId = await this.getEnrollmentId(studentId, (await this.getTaskOrThrow(taskId)).openingId);
        if (!enrollmentId) throw new ForbiddenException('You are not enrolled in this opening');
        return this.prisma.taskSubmission.findUnique({
            where: { taskId_enrollmentId: { taskId, enrollmentId } },
        });
    }

    async getSubmissions(taskId: string, actorId: string, actorRole: Role) {
        const task = await this.getTaskOrThrow(taskId);
        await this.assertCanManageOpening(task.openingId, actorId, actorRole);
        return this.prisma.taskSubmission.findMany({
            where: { taskId },
            include: { enrollment: { select: { id: true, student: { select: { id: true, email: true } } } } },
            orderBy: { submittedAt: 'desc' },
        });
    }

    async gradeSubmission(submissionId: string, actorId: string, actorRole: Role, score?: number, notes?: string) {
        const submission = await this.prisma.taskSubmission.findUnique({
            where: { id: submissionId },
            include: { task: true, enrollment: { select: { studentId: true } } },
        });
        if (!submission) throw new NotFoundException('Submission not found');
        await this.assertCanManageOpening(submission.task.openingId, actorId, actorRole);
        if (score != null && (isNaN(score) || score < 0)) {
            throw new BadRequestException('Score must be a non-negative number');
        }
        const updated = await this.prisma.taskSubmission.update({
            where: { id: submissionId },
            data: {
                score: score != null ? score : submission.score,
                notes: notes !== undefined ? (notes.trim() ? notes.trim() : null) : submission.notes,
            },
        });
        await this.audit.logAction(`Graded submission ${submissionId} for Task ${submission.taskId}`, undefined, actorId);
        await this.notifications.notify({
            userId: submission.enrollment.studentId,
            type: 'task.graded',
            titleAr: 'تم تصحيح المهمة',
            titleEn: 'Assignment graded',
            bodyAr: score != null
                ? `تم تصحيح مهمتك في "${submission.task.titleAr}" والنتيجة: ${score} من ${submission.task.maxScore}`
                : `تم تصحيح مهمتك في "${submission.task.titleAr}"`,
            bodyEn: score != null
                ? `Your assignment "${submission.task.titleEn}" was graded with ${score} out of ${submission.task.maxScore}.`
                : `Your assignment "${submission.task.titleEn}" was reviewed.`,
            data: { submissionId, taskId: submission.taskId },
        }).catch(() => {});
        return updated;
    }
}