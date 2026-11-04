import { Injectable, NotFoundException } from '@nestjs/common';
import { EnrollmentStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type JsonRecord = Record<string, unknown>;

function asRecord(value: Prisma.JsonValue | null | undefined): JsonRecord {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? value as JsonRecord
        : {};
}

function asList(value: unknown): JsonRecord[] {
    return Array.isArray(value)
        ? value.filter((item): item is JsonRecord => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
        : [];
}

function personLabel(metadata: Prisma.JsonValue | null, email: string): string {
    const profile = asRecord(metadata);
    for (const key of ['nameAr', 'nameEn', 'fullName']) {
        const name = profile[key];
        if (typeof name === 'string' && name.trim()) return name.trim();
    }
    return email;
}

@Injectable()
export class OpeningActivityService {
    constructor(
        private readonly prisma: PrismaService,
    ) {}

    async getOpeningOversight(openingId: string) {
        const opening = await this.prisma.courseOpening.findUnique({
            where: { id: openingId },
            select: {
                id: true,
                nameAr: true,
                nameEn: true,
                status: true,
                startDate: true,
                endDate: true,
                courseId: true,
                course: { select: { titleAr: true, titleEn: true } },
                instructor: { select: { id: true, email: true, metadata: true } },
            },
        });
        if (!opening) throw new NotFoundException('Opening not found');

        const openingCount = await this.prisma.courseOpening.count({
            where: { courseId: opening.courseId },
        });
        const enrollmentScope = [
            { openingId },
            ...(openingCount === 1 ? [{ openingId: null, courseId: opening.courseId }] : []),
        ];
        const evaluationScope = [
            { openingId },
            ...(openingCount === 1 ? [{ openingId: null, courseId: opening.courseId }] : []),
        ];

        const [enrollments, modules, tasks, quizzes, evaluations, auditLogs] = await Promise.all([
            this.prisma.enrollment.findMany({
                where: { OR: enrollmentScope },
                orderBy: { createdAt: 'desc' },
                select: {
                    id: true,
                    status: true,
                    createdAt: true,
                    student: { select: { id: true, email: true, metadata: true } },
                },
            }),
            this.prisma.module.findMany({
                where: {
                    courseId: opening.courseId,
                    OR: [{ openingId: null }, { openingId }],
                },
                orderBy: [{ orderIndex: 'asc' }, { createdAt: 'asc' }],
                include: {
                    openingContents: {
                        where: { openingId },
                        select: { content: true, isHidden: true, updatedAt: true },
                    },
                },
            }),
            this.prisma.courseTask.findMany({
                where: { openingId },
                orderBy: { createdAt: 'desc' },
                include: {
                    _count: {
                        select: {
                            submissions: { where: { enrollment: { OR: enrollmentScope } } },
                        },
                    },
                    module: { select: { titleAr: true, titleEn: true } },
                    submissions: {
                        where: { enrollment: { OR: enrollmentScope } },
                        orderBy: { updatedAt: 'desc' },
                        include: {
                            enrollment: {
                                select: {
                                    student: { select: { id: true, email: true, metadata: true } },
                                },
                            },
                        },
                    },
                },
            }),
            this.prisma.quiz.findMany({
                where: {
                    courseId: opening.courseId,
                    OR: [{ openingId }, { openingId: null }],
                },
                orderBy: { createdAt: 'desc' },
                include: {
                    module: { select: { titleAr: true, titleEn: true } },
                    _count: {
                        select: {
                            questions: true,
                            attempts: { where: { enrollment: { OR: enrollmentScope } } },
                        },
                    },
                    questions: {
                        orderBy: { orderIndex: 'asc' },
                        select: { id: true, type: true, textAr: true, textEn: true },
                    },
                    attempts: {
                        where: { enrollment: { OR: enrollmentScope } },
                        orderBy: { submittedAt: 'desc' },
                        include: {
                            enrollment: {
                                select: {
                                    student: { select: { id: true, email: true, metadata: true } },
                                },
                            },
                        },
                    },
                },
            }),
            this.prisma.courseEvaluation.findMany({
                where: { OR: evaluationScope },
                orderBy: { createdAt: 'desc' },
                include: {
                    enrollment: {
                        select: {
                            id: true,
                            student: { select: { id: true, email: true, metadata: true } },
                        },
                    },
                },
            }),
            this.prisma.auditLog.findMany({
                where: {
                    targetType: 'OPENING_ACTIVITY',
                    targetId: openingId,
                },
                orderBy: { timestamp: 'desc' },
                take: 1000,
                include: {
                    user: { select: { id: true, email: true, role: true, metadata: true } },
                },
            }),
        ]);

        const enrollmentIds = enrollments.map((enrollment) => enrollment.id);
        const moduleIds = modules.map((module) => module.id);
        const progress = enrollmentIds.length && moduleIds.length
            ? await this.prisma.lessonProgress.findMany({
                where: {
                    enrollmentId: { in: enrollmentIds },
                    moduleId: { in: moduleIds },
                },
                orderBy: { completedAt: 'desc' },
                include: {
                    enrollment: {
                        select: {
                            student: { select: { id: true, email: true, metadata: true } },
                        },
                    },
                    module: { select: { titleAr: true, titleEn: true } },
                },
            })
            : [];

        const content = modules.flatMap((module) => {
            const override = module.openingContents[0];
            const stored = override ? asRecord(override.content) : {};
            const source: JsonRecord = {
                titleAr: module.titleAr,
                titleEn: module.titleEn,
                descriptionAr: module.descriptionAr,
                descriptionEn: module.descriptionEn,
                videoUrl: module.videoUrl,
                files: module.files,
                links: module.links,
                ...stored,
            };
            const files = asList(source.files).map((file) => ({
                nameAr: typeof file.nameAr === 'string' ? file.nameAr : null,
                nameEn: typeof file.nameEn === 'string' ? file.nameEn : null,
                url: typeof file.url === 'string' ? file.url : '',
            })).filter((file) => file.url);
            const links = asList(source.links).map((link) => ({
                labelAr: typeof link.labelAr === 'string' ? link.labelAr : null,
                labelEn: typeof link.labelEn === 'string' ? link.labelEn : null,
                url: typeof link.url === 'string' ? link.url : '',
            })).filter((link) => link.url);
            return [{
                id: module.id,
                titleAr: typeof source.titleAr === 'string' ? source.titleAr : module.titleAr,
                titleEn: typeof source.titleEn === 'string' ? source.titleEn : module.titleEn,
                isHidden: override?.isHidden ?? false,
                updatedAt: override?.updatedAt ?? module.updatedAt,
                videoUrl: typeof source.videoUrl === 'string' ? source.videoUrl : null,
                files,
                links,
            }];
        });

        const studentRows = new Map(enrollments.map((enrollment) => [enrollment.id, {
            id: enrollment.student.id,
            email: enrollment.student.email,
            name: personLabel(enrollment.student.metadata, enrollment.student.email),
            status: enrollment.status,
            enrolledAt: enrollment.createdAt,
            completedLessons: 0,
            submissions: 0,
            quizAttempts: 0,
            evaluated: false,
        }]));
        for (const row of progress) {
            const student = studentRows.get(row.enrollmentId);
            if (student) student.completedLessons += 1;
        }
        for (const task of tasks) {
            for (const submission of task.submissions) {
                const student = studentRows.get(submission.enrollmentId);
                if (student) student.submissions += 1;
            }
        }
        for (const quiz of quizzes) {
            for (const attempt of quiz.attempts) {
                const student = studentRows.get(attempt.enrollmentId);
                if (student) student.quizAttempts += 1;
            }
        }
        for (const evaluation of evaluations) {
            const row = studentRows.get(evaluation.enrollment.id);
            if (row) row.evaluated = true;
        }

        const activities: JsonRecord[] = [];
        const auditedSubmissionIds = new Set(auditLogs
            .map((row) => asRecord(row.details).entityId)
            .filter((id): id is string => typeof id === 'string'));
        for (const row of auditLogs) {
            const details = asRecord(row.details);
            const isStudent = row.user?.role === 'STUDENT';
            activities.push({
                id: `audit:${row.id}`,
                type: isStudent && row.action === 'task_submission'
                    ? 'task_submission'
                    : isStudent && row.action === 'quiz_attempt'
                        ? 'quiz_attempt'
                        : isStudent ? 'student_action' : 'instructor_change',
                action: row.action,
                createdAt: row.timestamp,
                actor: row.user ? {
                    id: row.user.id,
                    email: row.user.email,
                    name: personLabel(row.user.metadata, row.user.email),
                    role: row.user.role,
                } : null,
                details,
            });
        }
        for (const task of tasks) {
            for (const submission of task.submissions) {
                if (auditedSubmissionIds.has(submission.id)) continue;
                const student = submission.enrollment.student;
                activities.push({
                    id: `submission:${submission.id}`,
                    type: 'task_submission',
                    action: 'task_submission',
                    createdAt: submission.submittedAt,
                    actor: {
                        id: student.id,
                        email: student.email,
                        name: personLabel(student.metadata, student.email),
                        role: 'STUDENT',
                    },
                    details: {
                        taskTitleAr: task.titleAr,
                        taskTitleEn: task.titleEn,
                        attachmentUrl: submission.attachmentUrl,
                        attachmentName: submission.attachmentName,
                        attachmentType: submission.attachmentType,
                        attachmentSize: submission.attachmentSize,
                        score: submission.score,
                        maxScore: task.maxScore,
                    },
                });
            }
        }
        for (const quiz of quizzes) {
            for (const attempt of quiz.attempts) {
                if (auditedSubmissionIds.has(attempt.id)) continue;
                const student = attempt.enrollment.student;
                activities.push({
                    id: `attempt:${attempt.id}`,
                    type: 'quiz_attempt',
                    action: 'quiz_attempt',
                    createdAt: attempt.submittedAt,
                    actor: {
                        id: student.id,
                        email: student.email,
                        name: personLabel(student.metadata, student.email),
                        role: 'STUDENT',
                    },
                    details: {
                        quizTitleAr: quiz.titleAr,
                        quizTitleEn: quiz.titleEn,
                        score: attempt.score,
                        passed: attempt.passed,
                    },
                });
            }
        }
        for (const evaluation of evaluations) {
            const student = evaluation.enrollment.student;
            activities.push({
                id: `evaluation:${evaluation.id}`,
                type: 'course_evaluation',
                action: 'course_evaluation',
                createdAt: evaluation.createdAt,
                actor: {
                    id: student.id,
                    email: student.email,
                    name: personLabel(student.metadata, student.email),
                    role: 'STUDENT',
                },
                details: {
                    courseRating: evaluation.courseRating,
                    instructorRating: evaluation.instructorRating,
                    commentAr: evaluation.commentAr,
                    commentEn: evaluation.commentEn,
                },
            });
        }
        for (const row of progress) {
            const student = row.enrollment.student;
            activities.push({
                id: `progress:${row.id}`,
                type: 'lesson_completed',
                action: 'lesson_completed',
                createdAt: row.completedAt,
                actor: {
                    id: student.id,
                    email: student.email,
                    name: personLabel(student.metadata, student.email),
                    role: 'STUDENT',
                },
                details: {
                    lessonTitleAr: row.module.titleAr,
                    lessonTitleEn: row.module.titleEn,
                },
            });
        }
        for (const enrollment of enrollments) {
            activities.push({
                id: `enrollment:${enrollment.id}`,
                type: 'enrollment',
                action: 'enrollment',
                createdAt: enrollment.createdAt,
                actor: {
                    id: enrollment.student.id,
                    email: enrollment.student.email,
                    name: personLabel(enrollment.student.metadata, enrollment.student.email),
                    role: 'STUDENT',
                },
                details: { status: enrollment.status },
            });
        }
        activities.sort((a, b) =>
            new Date(b.createdAt as string | number | Date).getTime() -
            new Date(a.createdAt as string | number | Date).getTime(),
        );

        const approvedStudentCount = enrollments.filter(
            (enrollment) => enrollment.status === EnrollmentStatus.APPROVED,
        ).length;
        const activity = activities.slice(0, 1000);
        return {
            opening: {
                id: opening.id,
                nameAr: opening.nameAr,
                nameEn: opening.nameEn,
                status: opening.status,
                startDate: opening.startDate,
                endDate: opening.endDate,
                courseId: opening.courseId,
                course: opening.course,
                instructor: {
                    ...opening.instructor,
                    name: personLabel(opening.instructor.metadata, opening.instructor.email),
                },
            },
            summary: {
                studentCount: enrollments.length,
                approvedStudentCount,
                lessonCount: content.length,
                taskCount: tasks.length,
                quizCount: quizzes.length,
                submissionCount: tasks.reduce((sum, task) => sum + task._count.submissions, 0),
                quizAttemptCount: quizzes.reduce((sum, quiz) => sum + quiz._count.attempts, 0),
                evaluationCount: evaluations.length,
            },
            students: Array.from(studentRows.values()).sort((a, b) => a.name.localeCompare(b.name)),
            content,
            tasks,
            quizzes,
            evaluations,
            activity,
            activityTruncated: activities.length > activity.length || auditLogs.length === 1000,
        };
    }
}
