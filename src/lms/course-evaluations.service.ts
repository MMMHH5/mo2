import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { EnrollmentStatus, Role } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { GamificationService } from '../gamification/gamification.service';
import { PrismaService } from '../prisma/prisma.service';

type EvaluationInput = {
  courseRating: number;
  instructorRating: number;
  commentAr?: string;
  commentEn?: string;
};

@Injectable()
export class CourseEvaluationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly gamification: GamificationService,
  ) {}

  private validateRating(value: number, field: string) {
    if (!Number.isInteger(value) || value < 1 || value > 5) {
      throw new BadRequestException(`${field} must be an integer between 1 and 5`);
    }
  }

  private validateComment(value: unknown, field: string) {
    if (value !== undefined && value !== null && (typeof value !== 'string' || value.length > 2000)) {
      throw new BadRequestException(`${field} must be a string of at most 2000 characters`);
    }
  }

  private async getEligibleEnrollment(courseId: string, studentId: string) {
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { studentId_courseId: { studentId, courseId } },
      include: {
        course: { select: { id: true, titleAr: true, titleEn: true, instructorId: true } },
        opening: { select: { id: true, instructorId: true, nameAr: true, nameEn: true } },
        courseEvaluation: { select: { id: true, createdAt: true } },
      },
    });
    if (!enrollment || enrollment.status !== EnrollmentStatus.APPROVED) {
      throw new ForbiddenException('Only approved students can evaluate a course');
    }
    return enrollment;
  }

  private async completionState(enrollmentId: string, courseId: string, openingId: string | null) {
    const modules = await this.prisma.module.findMany({
      where: {
        courseId,
        OR: openingId ? [{ openingId: null }, { openingId }] : [{ openingId: null }],
      },
      select: { id: true },
    });
    const moduleIds = modules.map((module) => module.id);
    const [progress, tasks, quizzes] = modules.length
      ? await Promise.all([
          this.prisma.lessonProgress.findMany({
          where: { enrollmentId, moduleId: { in: modules.map((module) => module.id) } },
          select: { moduleId: true },
          }),
          openingId ? this.prisma.courseTask.findMany({
            where: { openingId, moduleId: { in: moduleIds } },
            select: { submissions: { where: { enrollmentId }, select: { id: true } } },
          }) : Promise.resolve([]),
          this.prisma.quiz.findMany({
            where: {
              courseId,
              moduleId: { in: moduleIds },
              isPublished: true,
              OR: openingId ? [{ openingId: null }, { openingId }] : [{ openingId: null }],
            },
            select: { attempts: { where: { enrollmentId }, select: { passed: true } } },
          }),
        ])
      : [[], [], []];
    const completed = new Set(progress.map((row) => row.moduleId));
    const pendingTasks = tasks.filter((task) => task.submissions.length === 0).length;
    const failedQuizzes = quizzes.filter((quiz) => !quiz.attempts.some((attempt) => attempt.passed)).length;
    return {
      totalLessons: modules.length,
      completedLessons: completed.size,
      pendingTasks,
      failedQuizzes,
      canSubmit: modules.length > 0 && completed.size === modules.length && pendingTasks === 0 && failedQuizzes === 0,
    };
  }

  async getMine(courseId: string, studentId: string) {
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { studentId_courseId: { studentId, courseId } },
      select: {
        id: true,
        status: true,
        openingId: true,
        courseEvaluation: { select: { id: true, createdAt: true } },
      },
    });
    if (!enrollment) throw new ForbiddenException('You are not enrolled in this course');
    if (enrollment.status !== EnrollmentStatus.APPROVED) {
      return {
        courseId,
        openingId: enrollment.openingId,
        submitted: false,
        submittedAt: null,
        totalLessons: 0,
        completedLessons: 0,
        pendingTasks: 0,
        failedQuizzes: 0,
        canSubmit: false,
      };
    }
    const [state, evaluation] = await Promise.all([
      this.completionState(enrollment.id, courseId, enrollment.openingId),
      Promise.resolve(enrollment.courseEvaluation),
    ]);
    return {
      courseId,
      openingId: enrollment.openingId,
      submitted: Boolean(evaluation),
      submittedAt: evaluation?.createdAt ?? null,
      ...state,
    };
  }

  async submit(courseId: string, studentId: string, input: EvaluationInput) {
    this.validateRating(input.courseRating, 'courseRating');
    this.validateRating(input.instructorRating, 'instructorRating');
    this.validateComment(input.commentAr, 'commentAr');
    this.validateComment(input.commentEn, 'commentEn');

    const enrollment = await this.getEligibleEnrollment(courseId, studentId);
    if (enrollment.courseEvaluation) {
      throw new ConflictException('Course evaluation has already been submitted');
    }
    const state = await this.completionState(enrollment.id, courseId, enrollment.openingId);
    if (!state.canSubmit) {
      throw new ConflictException({
        message: 'Complete all course lessons before submitting the evaluation',
        code: 'COURSE_LESSONS_INCOMPLETE',
        ...state,
      });
    }

    let evaluation;
    try {
      evaluation = await this.prisma.courseEvaluation.create({
        data: {
          courseRating: input.courseRating,
          instructorRating: input.instructorRating,
          commentAr: input.commentAr?.trim() || null,
          commentEn: input.commentEn?.trim() || null,
          enrollmentId: enrollment.id,
          courseId,
          openingId: enrollment.openingId,
          instructorId: enrollment.opening?.instructorId ?? enrollment.course.instructorId,
        },
        select: { id: true, createdAt: true },
      });
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
        throw new ConflictException('Course evaluation has already been submitted');
      }
      throw error;
    }

    await this.audit.logAction(
      `Submitted course and instructor evaluation for enrollment ${enrollment.id}`,
      undefined,
      studentId,
    );
    try {
      await this.gamification.addPoints(studentId, 'course_complete');
    } catch {
      // Evaluation persistence is authoritative; reward failures must not discard a valid submission.
    }
    return { submitted: true, submittedAt: evaluation.createdAt };
  }

  async listOpeningSummaries() {
    const groups = await this.prisma.courseEvaluation.groupBy({
      by: ['openingId', 'courseId'],
      _avg: { courseRating: true, instructorRating: true },
      _count: { _all: true },
    });
    const openingIds = groups.map((group) => group.openingId).filter((id): id is string => Boolean(id));
    const legacyCourseIds = groups.filter((group) => !group.openingId).map((group) => group.courseId);
    const [openings, legacyCourses] = await Promise.all([
      openingIds.length ? this.prisma.courseOpening.findMany({
        where: { id: { in: openingIds } },
        select: {
          id: true,
          nameAr: true,
          nameEn: true,
          status: true,
          endDate: true,
          course: { select: { id: true, titleAr: true, titleEn: true } },
          instructor: { select: { id: true, email: true } },
          _count: { select: { enrollments: { where: { status: EnrollmentStatus.APPROVED } } } },
        },
        orderBy: [{ endDate: 'desc' }, { createdAt: 'desc' }],
      }) : [],
      legacyCourseIds.length ? this.prisma.course.findMany({
        where: { id: { in: [...new Set(legacyCourseIds)] } },
        select: {
          id: true,
          titleAr: true,
          titleEn: true,
          instructorId: true,
          instructor: { select: { email: true } },
          _count: { select: { enrollments: { where: { status: EnrollmentStatus.APPROVED, openingId: null } } } },
        },
      }) : [],
    ]);
    const openingById = new Map(openings.map((opening) => [opening.id, opening]));
    const courseById = new Map(legacyCourses.map((course) => [course.id, course]));
    const summaries: Array<{
      id: string;
      nameAr: string | null;
      nameEn: string | null;
      status: string | null;
      endDate: Date | null;
      course: { id: string; titleAr: string; titleEn: string };
      instructor: { id: string; email: string };
      responseCount: number;
      approvedStudentCount: number;
      averageCourseRating: number;
      averageInstructorRating: number;
    }> = [];
    for (const group of groups) {
      const averages = {
        responseCount: group._count._all,
        averageCourseRating: group._avg.courseRating ?? 0,
        averageInstructorRating: group._avg.instructorRating ?? 0,
      };
      if (group.openingId) {
        const opening = openingById.get(group.openingId);
        if (!opening) continue;
        summaries.push({
          ...opening,
          ...averages,
          approvedStudentCount: opening._count.enrollments,
        });
        continue;
      }

      const course = courseById.get(group.courseId);
      if (!course) continue;
      summaries.push({
        id: `course:${group.courseId}`,
        nameAr: null,
        nameEn: null,
        status: null,
        endDate: null,
        course: { id: course.id, titleAr: course.titleAr, titleEn: course.titleEn },
        instructor: { id: course.instructorId, email: course.instructor.email },
        ...averages,
        approvedStudentCount: course._count.enrollments,
      });
    }
    return summaries;
  }

  async listOpeningEvaluations(openingId: string) {
    const legacyCourseId = openingId.startsWith('course:') ? openingId.slice('course:'.length) : null;
    if (legacyCourseId) {
      const course = await this.prisma.course.findUnique({
        where: { id: legacyCourseId },
        select: {
          id: true,
          titleAr: true,
          titleEn: true,
          instructorId: true,
          instructor: { select: { id: true, email: true } },
          _count: { select: { enrollments: { where: { status: EnrollmentStatus.APPROVED, openingId: null } } } },
        },
      });
      if (!course) throw new NotFoundException('Course not found');
      const evaluations = await this.prisma.courseEvaluation.findMany({
        where: { courseId: legacyCourseId, openingId: null },
        select: {
          id: true,
          courseRating: true,
          instructorRating: true,
          commentAr: true,
          commentEn: true,
          createdAt: true,
          enrollment: { select: { student: { select: { id: true, email: true, metadata: true } } } },
        },
        orderBy: { createdAt: 'desc' },
      });
      return {
        opening: {
          id: openingId,
          nameAr: null,
          nameEn: null,
          status: null,
          course: { id: course.id, titleAr: course.titleAr, titleEn: course.titleEn },
          instructor: course.instructor,
        },
        responseCount: evaluations.length,
        approvedStudentCount: course._count.enrollments,
        averageCourseRating: evaluations.length
          ? evaluations.reduce((sum, evaluation) => sum + evaluation.courseRating, 0) / evaluations.length
          : 0,
        averageInstructorRating: evaluations.length
          ? evaluations.reduce((sum, evaluation) => sum + evaluation.instructorRating, 0) / evaluations.length
          : 0,
        evaluations,
      };
    }

    const opening = await this.prisma.courseOpening.findUnique({
      where: { id: openingId },
      select: {
        id: true,
        nameAr: true,
        nameEn: true,
        status: true,
        course: { select: { id: true, titleAr: true, titleEn: true } },
        instructor: { select: { id: true, email: true } },
        _count: { select: { enrollments: { where: { status: EnrollmentStatus.APPROVED } } } },
      },
    });
    if (!opening) throw new NotFoundException('Course opening not found');

    const evaluations = await this.prisma.courseEvaluation.findMany({
      where: { openingId },
      select: {
        id: true,
        courseRating: true,
        instructorRating: true,
        commentAr: true,
        commentEn: true,
        createdAt: true,
        enrollment: {
          select: {
            student: { select: { id: true, email: true, metadata: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return {
      opening,
      responseCount: evaluations.length,
      approvedStudentCount: opening._count.enrollments,
      averageCourseRating: evaluations.length
        ? evaluations.reduce((sum, evaluation) => sum + evaluation.courseRating, 0) / evaluations.length
        : 0,
      averageInstructorRating: evaluations.length
        ? evaluations.reduce((sum, evaluation) => sum + evaluation.instructorRating, 0) / evaluations.length
        : 0,
      evaluations,
    };
  }

  assertStaffCanRead(role: Role) {
    if (role !== Role.ADMIN && role !== Role.COURSE_MANAGER) {
      throw new ForbiddenException('Only administrators and course managers can view course evaluations');
    }
  }
}
