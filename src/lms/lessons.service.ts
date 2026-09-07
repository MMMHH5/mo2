import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GamificationService } from '../gamification/gamification.service';

@Injectable()
export class LessonsService {
  constructor(private prisma: PrismaService, private gamification: GamificationService) {}

  async syllabus(courseId: string) {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      include: {
        modules: {
          orderBy: { orderIndex: 'asc' },
          include: {
            outcomes: { orderBy: { createdAt: 'asc' } },
            quizzes: {
              where: { isPublished: true },
              orderBy: { orderIndex: 'asc' },
              select: { id: true, titleAr: true, titleEn: true, orderIndex: true, passScore: true, _count: { select: { questions: true } } },
            },
          },
        },
        chapters: {
          orderBy: { orderIndex: 'asc' },
          include: {
            modules: {
              orderBy: { orderIndex: 'asc' },
              include: {
                outcomes: { orderBy: { createdAt: 'asc' } },
                quizzes: {
                  where: { isPublished: true },
                  orderBy: { orderIndex: 'asc' },
                  select: { id: true, titleAr: true, titleEn: true, orderIndex: true, passScore: true, _count: { select: { questions: true } } },
                },
              },
            },
          },
        },
        liveSessions: { orderBy: { scheduledAt: 'asc' } },
      },
    });
    if (!course) throw new NotFoundException('Course not found');
    return course;
  }

  async listCourseModules(courseId: string) {
    return this.prisma.module.findMany({
      where: { courseId },
      orderBy: { orderIndex: 'asc' },
      include: { outcomes: { orderBy: { createdAt: 'asc' } } },
    });
  }

  async courseProgress(courseId: string, studentId: string) {
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { studentId_courseId: { studentId, courseId } },
    });
    if (!enrollment) throw new ForbiddenException('You are not enrolled in this course');

    const modules = await this.listCourseModules(courseId);
    const progress = await this.prisma.lessonProgress.findMany({
      where: { enrollmentId: enrollment.id },
      select: { moduleId: true, completedAt: true },
    });
    const completedMap = new Map(progress.map((p) => [p.moduleId, p.completedAt]));

    const list = modules.map((m: any) => ({
      id: m.id,
      titleAr: m.titleAr,
      titleEn: m.titleEn,
      descriptionAr: m.descriptionAr,
      descriptionEn: m.descriptionEn,
      videoUrl: m.videoUrl,
      orderIndex: m.orderIndex,
      isFree: m.isFree,
      durationMinutes: m.durationMinutes,
      files: m.files ?? null,
      links: m.links ?? null,
      chapterId: m.chapterId,
      outcomes: m.outcomes,
      completed: completedMap.has(m.id),
      completedAt: completedMap.get(m.id) ?? null,
    }));

    const completedCount = list.filter((m) => m.completed).length;
    const percent = modules.length === 0 ? 0 : Math.round((completedCount / modules.length) * 100);
    return { enrollmentId: enrollment.id, openingId: enrollment.openingId, total: modules.length, completed: completedCount, percent, modules: list };
  }

  async myNotes(courseId: string, studentId: string) {
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { studentId_courseId: { studentId, courseId } },
    });
    if (!enrollment) throw new ForbiddenException('You are not enrolled in this course');
    const notes = await this.prisma.lessonNote.findMany({
      where: { enrollmentId: enrollment.id },
      select: { moduleId: true, content: true, updatedAt: true },
    });
    return { enrollmentId: enrollment.id, notes };
  }

  async saveNote(moduleId: string, content: string, studentId: string) {
    const module = await this.prisma.module.findUnique({
      where: { id: moduleId },
      select: { courseId: true },
    });
    if (!module) throw new NotFoundException('Module not found');
    const enrollment = await this.prisma.enrollment.findFirst({
      where: { studentId, courseId: module.courseId },
      select: { id: true },
    });
    if (!enrollment) throw new ForbiddenException('You are not enrolled in this course');
    await this.prisma.lessonNote.upsert({
      where: { enrollmentId_moduleId: { enrollmentId: enrollment.id, moduleId } },
      update: { content },
      create: { enrollmentId: enrollment.id, moduleId, content },
    });
    return { savedAt: new Date() };
  }

  async markComplete(enrollmentId: string, moduleId: string, studentId: string) {
    const enrollment = await this.prisma.enrollment.findUnique({ where: { id: enrollmentId } });
    if (!enrollment || enrollment.studentId !== studentId) throw new ForbiddenException('Not your enrollment');

    const module = await this.prisma.module.findUnique({ where: { id: moduleId } });
    if (!module || module.courseId !== enrollment.courseId) throw new NotFoundException('Module not found in this course');

    await this.prisma.lessonProgress.upsert({
      where: { enrollmentId_moduleId: { enrollmentId, moduleId } },
      update: { completedAt: new Date() },
      create: { enrollmentId, moduleId },
    });

    try { await this.gamification.addPoints(studentId, 'lesson_complete'); } catch {}

    const progress = await this.courseProgress(enrollment.courseId, studentId);
    if (progress.percent === 100) {
      try { await this.gamification.addPoints(studentId, 'course_complete'); } catch {}
    }
    return progress;
  }

  async markIncomplete(enrollmentId: string, moduleId: string, studentId: string) {
    const enrollment = await this.prisma.enrollment.findUnique({ where: { id: enrollmentId } });
    if (!enrollment || enrollment.studentId !== studentId) throw new ForbiddenException('Not your enrollment');
    await this.prisma.lessonProgress.deleteMany({ where: { enrollmentId, moduleId } });
    return this.courseProgress(enrollment.courseId, studentId);
  }
}