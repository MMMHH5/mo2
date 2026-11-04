import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { CourseOpeningStatus, EnrollmentStatus, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { GamificationService } from '../gamification/gamification.service';

@Injectable()
export class QuizzesService {
  constructor(private prisma: PrismaService, private gamification: GamificationService) {}

  private stripAnswers(quiz: any) {
    if (!quiz) return quiz;
    const { questions, ...rest } = quiz;
    return {
      ...rest,
      questions: (questions ?? []).map((q: any) => {
        const { correctIndex, ...publicQuestion } = q;
        // `parseCorrectIndices` also reads the answer out of
        // `options[i].isCorrect`, so dropping only `correctIndex` left the key
        // sitting in the payload of a fully public GET /lms/quizzes/:id. Any
        // quiz authored in that shape was anonymously solvable.
        if (Array.isArray(publicQuestion.options)) {
          publicQuestion.options = publicQuestion.options.map((opt: any) => {
            if (opt && typeof opt === 'object' && 'isCorrect' in opt) {
              const { isCorrect, ...restOpt } = opt;
              return restOpt;
            }
            return opt;
          });
        }
        return publicQuestion;
      }),
    };
  }

  async create(data: any) {
    const { questions = [], courseId, moduleId, openingId, ...quizData } = data;
    const course = await this.prisma.course.findUnique({ where: { id: courseId } });
    if (!course) throw new NotFoundException('Course not found');
    this.validatePlacement(quizData.isFinal ?? false, moduleId);
    if (openingId && quizData.isFinal) {
      const existingFinal = await this.prisma.quiz.findFirst({ where: { openingId, isFinal: true } });
      if (existingFinal) throw new BadRequestException('This opening already has a final exam');
    }
    if (moduleId) {
      const mod = await this.prisma.module.findUnique({ where: { id: moduleId } });
      if (!mod || mod.courseId !== courseId || (mod.openingId && mod.openingId !== openingId)) {
        throw new BadRequestException('Module does not belong to this course opening');
      }
    }
    return this.prisma.quiz.create({
      data: {
        ...quizData,
        courseId,
        openingId: openingId || null,
        moduleId: moduleId || null,
        questions: {
          create: questions.map((q: any, i: number) => ({ ...q, moduleId: undefined, courseId: undefined, orderIndex: q.orderIndex ?? i })),
        },
      },
      include: { questions: { orderBy: { orderIndex: 'asc' } } },
    });
  }

  async update(id: string, data: any) {
    const quiz = await this.prisma.quiz.findUnique({ where: { id } });
    if (!quiz) throw new NotFoundException('Quiz not found');
    const { questions, courseId, moduleId, openingId: _openingId, ...quizData } = data;
    const nextModuleId = moduleId !== undefined ? (moduleId || null) : quiz.moduleId;
    const isFinal = quizData.isFinal ?? quiz.isFinal ?? false;
    this.validatePlacement(isFinal, nextModuleId);
    if (quiz.openingId && isFinal && !quiz.isFinal) {
      const existingFinal = await this.prisma.quiz.findFirst({ where: { openingId: quiz.openingId, isFinal: true, id: { not: id } } });
      if (existingFinal) throw new BadRequestException('This opening already has a final exam');
    }
    if (nextModuleId) {
      const mod = await this.prisma.module.findUnique({ where: { id: nextModuleId } });
      if (!mod || mod.courseId !== quiz.courseId || (mod.openingId && mod.openingId !== quiz.openingId)) {
        throw new BadRequestException('Module does not belong to this course opening');
      }
    }
    if (Array.isArray(questions)) {
      await this.prisma.$transaction([
        this.prisma.quizQuestion.deleteMany({ where: { quizId: id } }),
        this.prisma.quiz.update({
          where: { id },
          data: {
            ...quizData,
            moduleId: nextModuleId,
            questions: { create: questions.map((q: any, i: number) => ({ ...q, orderIndex: q.orderIndex ?? i })) },
          },
        }),
      ]);
    } else {
      await this.prisma.quiz.update({
        where: { id },
        data: { ...quizData, moduleId: nextModuleId },
      });
    }
    return this.prisma.quiz.findUnique({ where: { id }, include: { questions: { orderBy: { orderIndex: 'asc' } } } });
  }

  async remove(id: string) {
    await this.prisma.quiz.delete({ where: { id } });
    return { ok: true };
  }

  private validatePlacement(isFinal: boolean, moduleId: string | null | undefined) {
    if (isFinal && moduleId) throw new BadRequestException('A final quiz cannot be assigned to a lesson');
    if (!isFinal && !moduleId) throw new BadRequestException('A lesson quiz must be assigned to a lesson');
  }

  private async assertCanManageOpening(openingId: string, actorId: string, role: Role) {
    const opening = await this.prisma.courseOpening.findUnique({
      where: { id: openingId },
      include: { instructorGrants: { where: { instructorId: actorId } } },
    });
    if (!opening || opening.archivedAt) throw new NotFoundException('Opening not found');
    if (opening.status !== CourseOpeningStatus.OPEN && opening.status !== CourseOpeningStatus.STARTED) {
      throw new ForbiddenException('Quizzes can only be managed for open or started courses');
    }
    if (role === Role.ADMIN || role === Role.COURSE_MANAGER) return opening;
    if (role !== Role.INSTRUCTOR) throw new ForbiddenException('You are not allowed to manage quizzes');
    const grant = opening.instructorGrants[0];
    if (opening.instructorId !== actorId && !grant?.canReadContent) {
      throw new ForbiddenException('You are not allowed to manage quizzes for this opening');
    }
    return opening;
  }

  async listForInstructor(openingId: string, actorId: string, role: Role) {
    await this.assertCanManageOpening(openingId, actorId, role);
    return this.listByOpening(openingId, true);
  }

  async createForInstructor(data: any, openingId: string, actorId: string, role: Role) {
    const opening = await this.assertCanManageOpening(openingId, actorId, role);
    if (data.courseId && data.courseId !== opening.courseId) throw new BadRequestException('Quiz course does not match the opening');
    const moduleId = data.moduleId || null;
    if (moduleId) {
      const module = await this.prisma.module.findUnique({ where: { id: moduleId } });
      if (!module || module.courseId !== opening.courseId || (module.openingId && module.openingId !== openingId)) {
        throw new BadRequestException('Lesson does not belong to this opening');
      }
    }
    return this.create({ ...data, courseId: opening.courseId, openingId });
  }

  async updateForInstructor(id: string, data: any, openingId: string, actorId: string, role: Role) {
    await this.assertCanManageOpening(openingId, actorId, role);
    const quiz = await this.prisma.quiz.findUnique({ where: { id }, select: { courseId: true, openingId: true } });
    if (!quiz) throw new NotFoundException('Quiz not found');
    if (quiz.openingId !== openingId) throw new NotFoundException('Quiz not found in this opening');
    if (data.courseId && data.courseId !== quiz.courseId) throw new BadRequestException('Quiz course cannot be changed');
    return this.update(id, data);
  }

  async removeForInstructor(id: string, openingId: string, actorId: string, role: Role) {
    await this.assertCanManageOpening(openingId, actorId, role);
    const quiz = await this.prisma.quiz.findUnique({ where: { id }, select: { openingId: true } });
    if (!quiz) throw new NotFoundException('Quiz not found');
    if (quiz.openingId !== openingId) throw new NotFoundException('Quiz not found in this opening');
    return this.remove(id);
  }

  async listByOpening(openingId: string, includeUnpublished: boolean) {
    const quizzes = await this.prisma.quiz.findMany({
      where: { openingId, ...(includeUnpublished ? {} : { isPublished: true }) },
      include: { questions: { orderBy: { orderIndex: 'asc' } } },
      orderBy: { orderIndex: 'asc' },
    });
    return includeUnpublished ? quizzes : quizzes.map((quiz) => this.stripAnswers(quiz));
  }

  async listForEnrolledOpening(courseId: string, openingId: string, studentId: string) {
    const enrollment = await this.prisma.enrollment.findFirst({
      where: { courseId, openingId, studentId, status: EnrollmentStatus.APPROVED },
      select: { id: true },
    });
    if (!enrollment) throw new ForbiddenException('You are not enrolled in this opening');
    const quizzes = await this.prisma.quiz.findMany({
      where: { courseId, isPublished: true, OR: [{ openingId: null }, { openingId }] },
      include: { questions: { orderBy: { orderIndex: 'asc' } } },
      orderBy: { orderIndex: 'asc' },
    });
    return quizzes.map((quiz) => this.stripAnswers(quiz));
  }

  async listByCourse(courseId: string, includeUnpublished: boolean) {
    const quizzes = await this.prisma.quiz.findMany({
      where: { courseId, openingId: null, ...(includeUnpublished ? {} : { isPublished: true }) },
      include: { questions: { orderBy: { orderIndex: 'asc' } } },
      orderBy: { orderIndex: 'asc' },
    });
    return includeUnpublished ? quizzes : quizzes.map((quiz) => this.stripAnswers(quiz));
  }

  async getPublic(id: string, studentId?: string) {
    const quiz = await this.prisma.quiz.findUnique({
      where: { id },
      include: { questions: { orderBy: { orderIndex: 'asc' } } },
    });
    if (!quiz || !quiz.isPublished) throw new NotFoundException('Quiz not found');
    if (quiz.openingId) {
      if (!studentId) throw new NotFoundException('Quiz not found');
      const enrollment = await this.prisma.enrollment.findFirst({
        where: { courseId: quiz.courseId, openingId: quiz.openingId, studentId, status: EnrollmentStatus.APPROVED },
        select: { id: true },
      });
      if (!enrollment) throw new NotFoundException('Quiz not found');
    }
    return this.stripAnswers(quiz);
  }

  async myAttempt(quizId: string, studentId: string) {
    const [attempt] = await this.prisma.quizAttempt.findMany({
      where: { quizId, enrollment: { studentId } },
      orderBy: { score: 'desc' },
      take: 1,
    });
    return attempt ?? null;
  }

  private parseCorrectIndices(question: any): number[] {
    const indices = new Set<number>();
    if (question.correctIndex !== null && question.correctIndex !== undefined) indices.add(Number(question.correctIndex));
    const options = Array.isArray(question.options) ? question.options : [];
    options.forEach((opt: any, i: number) => {
      if (opt && typeof opt === 'object' && opt.isCorrect) indices.add(i);
    });
    return [...indices].sort();
  }

  private scoreQuiz(quiz: any, answers: any[]) {
    let correct = 0;
    const total = quiz.questions.length;
    const details = quiz.questions.map((question: any) => {
      const answer = answers.find((a: any) => a.questionId === question.id);
      const selected: number[] = Array.isArray(answer?.selected) ? answer.selected.map(Number) : [];
      const correctSet = this.parseCorrectIndices(question);
      const isCorrect = correctSet.length > 0 && JSON.stringify([...selected].sort()) === JSON.stringify(correctSet);
      if (isCorrect) correct += 1;
      // `isCorrect` is feedback a student is entitled to. `correctAnswer` is
      // the key: returning it let anyone submit dummy answers, read the
      // correct indices out of the response and resubmit for 100%, which
      // defeats passScore (gating module completion) and the quiz_perfect /
      // quiz_master awards. Grading still uses correctSet internally; only the
      // per-question breakdown is withheld.
      return { questionId: question.id, isCorrect };
    });
    const score = total === 0 ? 0 : Math.round((correct / total) * 100);
    return { score, passed: score >= quiz.passScore, details };
  }

  async attempt(quizId: string, enrollmentId: string, answers: any[], studentId: string) {
    const quiz = await this.prisma.quiz.findUnique({
      where: { id: quizId },
      include: { questions: { orderBy: { orderIndex: 'asc' } } },
    });
    if (!quiz || !quiz.isPublished) throw new NotFoundException('Quiz not found');

    const enrollment = await this.prisma.enrollment.findUnique({ where: { id: enrollmentId } });
    if (!enrollment || enrollment.studentId !== studentId) throw new ForbiddenException('Not your enrollment');
    if (enrollment.courseId !== quiz.courseId) throw new BadRequestException('Quiz does not belong to this course');
    if (quiz.openingId && enrollment.openingId !== quiz.openingId) throw new ForbiddenException('Quiz does not belong to this opening');

    const result = this.scoreQuiz(quiz, answers);
    const existing = await this.prisma.quizAttempt.findUnique({
      where: { quizId_enrollmentId: { quizId, enrollmentId } },
    });
    const bestScore = existing ? Math.max(existing.score, result.score) : result.score;
    const passed = bestScore >= quiz.passScore;

    const attempt = await this.prisma.quizAttempt.upsert({
      where: { quizId_enrollmentId: { quizId, enrollmentId } },
      update: { score: bestScore, passed, answers: answers as object },
      create: { quizId, enrollmentId, score: result.score, passed: result.passed, answers: answers as object },
    });

    if (result.passed) {
      try {
        await this.gamification.addPoints(studentId, result.score === 100 ? 'quiz_perfect' : 'quiz_pass');
      } catch {}
    }

    return { attempt, score: bestScore, passed, details: result.details };
  }
}