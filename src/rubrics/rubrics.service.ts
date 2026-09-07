import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { GamificationService } from '../gamification/gamification.service';
import { Role } from '@prisma/client';

@Injectable()
export class RubricsService {
    constructor(private prisma: PrismaService, private audit: AuditService, private gamification: GamificationService) {}

    async createRubric(taskId: string, dto: { titleAr: string; titleEn: string; criteria: { titleAr: string; titleEn: string; descriptionAr?: string; descriptionEn?: string; maxScore: number }[] }, userId: string, userRole: Role) {
        const task = await this.prisma.courseTask.findUnique({ where: { id: taskId } });
        if (!task) throw new NotFoundException('Task not found');
        if (userRole === Role.INSTRUCTOR) {
            const opening = await this.prisma.courseOpening.findUnique({ where: { id: task.openingId } });
            if (!opening || opening.instructorId !== userId) throw new ForbiddenException('Not your task');
        }
        const existing = await this.prisma.rubric.findUnique({ where: { taskId } });
        if (existing) throw new BadRequestException('Task already has a rubric');
        const rubric = await this.prisma.rubric.create({
            data: {
                taskId,
                titleAr: dto.titleAr.trim(),
                titleEn: dto.titleEn.trim(),
                criteria: {
                    create: dto.criteria.map((c, i) => ({
                        titleAr: c.titleAr.trim(),
                        titleEn: c.titleEn.trim(),
                        descriptionAr: c.descriptionAr || null,
                        descriptionEn: c.descriptionEn || null,
                        maxScore: c.maxScore || 10,
                        orderIndex: i,
                    })),
                },
            },
            include: { criteria: { orderBy: { orderIndex: 'asc' } } },
        });
        await this.audit.logAction(`Created rubric for task ${taskId}`, undefined, userId);
        return rubric;
    }

    async getRubric(taskId: string) {
        const rubric = await this.prisma.rubric.findUnique({
            where: { taskId },
            include: { criteria: { orderBy: { orderIndex: 'asc' } } },
        });
        if (!rubric) throw new NotFoundException('Rubric not found');
        return rubric;
    }

    async submitReview(rubricId: string, submissionId: string, reviewerId: string, dto: { scores: { criterionId: string; score: number; commentAr?: string; commentEn?: string }[]; commentAr?: string; commentEn?: string }) {
        const rubric = await this.prisma.rubric.findUnique({ where: { id: rubricId } });
        if (!rubric) throw new NotFoundException('Rubric not found');
        const submission = await this.prisma.taskSubmission.findUnique({ where: { id: submissionId } });
        if (!submission) throw new NotFoundException('Submission not found');
        if (submission.enrollmentId === reviewerId) throw new ForbiddenException('Cannot review your own submission');
        const existing = await this.prisma.peerReview.findUnique({
            where: { rubricId_submissionId_reviewerId: { rubricId, submissionId, reviewerId } },
        });
        if (existing) throw new BadRequestException('Already reviewed this submission');
        const totalScore = dto.scores.reduce((sum, s) => sum + s.score, 0);
        const review = await this.prisma.peerReview.create({
            data: {
                rubricId,
                submissionId,
                reviewerId,
                score: totalScore,
                commentAr: dto.commentAr || null,
                commentEn: dto.commentEn || null,
                status: 'completed',
                criterionScores: {
                    create: dto.scores.map(s => ({
                        criterionId: s.criterionId,
                        score: s.score,
                        commentAr: s.commentAr || null,
                        commentEn: s.commentEn || null,
                    })),
                },
            },
            include: { criterionScores: { include: { criterion: true } } },
        });
        await this.audit.logAction(`Peer review submitted for submission ${submissionId}`, undefined, reviewerId);
        this.gamification.addPoints(reviewerId, 'peer_review').catch(() => {});
        return review;
    }

    async getReviewsForSubmission(submissionId: string) {
        const reviews = await this.prisma.peerReview.findMany({
            where: { submissionId },
            include: {
                reviewer: { select: { id: true, email: true } },
                criterionScores: { include: { criterion: true } },
            },
            orderBy: { createdAt: 'desc' },
        });
        const avgScore = reviews.length > 0 ? reviews.reduce((s, r) => s + (r.score || 0), 0) / reviews.length : 0;
        return { reviews, averageScore: Math.round(avgScore * 10) / 10, count: reviews.length };
    }

    async assignRandomReviews(rubricId: string, countPerSubmission: number) {
        const rubric = await this.prisma.rubric.findUnique({ where: { id: rubricId }, include: { task: true } });
        if (!rubric) throw new NotFoundException('Rubric not found');
        const submissions = await this.prisma.taskSubmission.findMany({ where: { taskId: rubric.taskId } });
        if (submissions.length < 2) throw new BadRequestException('Need at least 2 submissions');
        const assigned: { submissionId: string; reviewerId: string }[] = [];
        for (const sub of submissions) {
            const otherSubs = submissions.filter(s => s.id !== sub.id);
            const shuffled = otherSubs.sort(() => Math.random() - 0.5).slice(0, countPerSubmission);
            for (const other of shuffled) {
                const existing = await this.prisma.peerReview.findUnique({
                    where: { rubricId_submissionId_reviewerId: { rubricId, submissionId: other.id, reviewerId: sub.enrollmentId } },
                }).catch(() => null);
                if (!existing) {
                    assigned.push({ submissionId: other.id, reviewerId: sub.enrollmentId });
                }
            }
        }
        return { assigned, total: assigned.length };
    }
}
