import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CoursesService } from '../src/courses/courses.service';
import { LessonsService } from '../src/lms/lessons.service';
import { QuizzesService } from '../src/lms/quizzes.service';

describe('SECURITY: learning content exposure', () => {
    test('public syllabus removes lesson assets from modules and chapters', async () => {
        const module = {
            id: 'module-1',
            titleEn: 'Lesson',
            videoUrl: 'https://media.example/lesson.mp4',
            files: [{ url: '/uploads/lesson.pdf' }],
            links: [{ url: 'https://resources.example' }],
            outcomes: [],
            quizzes: [],
        };
        const course = {
            id: 'course-1',
            modules: [module],
            chapters: [{ id: 'chapter-1', modules: [{ ...module, id: 'chapter-module-1' }] }],
        };
        const service = new LessonsService(
            { course: { findUnique: async () => course } } as never,
            {} as never,
        );

        const syllabus = await service.syllabus('course-1');

        assert.equal(syllabus.modules[0].videoUrl, null);
        assert.deepEqual(syllabus.modules[0].files, []);
        assert.deepEqual(syllabus.modules[0].links, []);
        assert.equal(syllabus.chapters[0].modules[0].videoUrl, null);
        assert.deepEqual(syllabus.chapters[0].modules[0].files, []);
        assert.deepEqual(syllabus.chapters[0].modules[0].links, []);
        assert.equal(syllabus.modules[0].titleEn, 'Lesson');
    });

    test('pending enrollment sees progress metadata but not lesson assets', async () => {
        const service = new LessonsService(
            {
                enrollment: {
                    findUnique: async () => ({
                        id: 'enrollment-1',
                        studentId: 'student-1',
                        courseId: 'course-1',
                        openingId: null,
                        status: 'PENDING',
                    }),
                },
                course: { findUnique: async () => ({ contentType: 'RECORDED' }) },
                module: {
                    findMany: async () => [{
                        id: 'module-1',
                        titleEn: 'Lesson',
                        videoUrl: 'https://media.example/lesson.mp4',
                        files: [{ url: '/uploads/lesson.pdf' }],
                        links: [{ url: 'https://resources.example' }],
                    }],
                },
                lessonProgress: { findMany: async () => [] },
                courseTask: { findMany: async () => [] },
                quiz: { findMany: async () => [] },
            } as never,
            {} as never,
        );

        const progress = await service.courseProgress('course-1', 'student-1');

        assert.equal(progress.modules[0].titleEn, 'Lesson');
        assert.equal(progress.modules[0].videoUrl, null);
        assert.deepEqual(progress.modules[0].files, []);
        assert.deepEqual(progress.modules[0].links, []);
    });

    test('public course quiz listings remove answer keys', async () => {
        const quiz = {
            id: 'quiz-1',
            isPublished: true,
            questions: [{
                id: 'question-1',
                correctIndex: 1,
                options: [{ text: 'wrong' }, { text: 'right', isCorrect: true }],
            }],
        };
        const service = new QuizzesService(
            { quiz: { findMany: async () => [quiz] } } as never,
            {} as never,
        );

        const quizzes = await service.listByCourse('course-1', false);

        assert.equal('correctIndex' in quizzes[0].questions[0], false);
        assert.deepEqual(quizzes[0].questions[0].options, [{ text: 'wrong' }, { text: 'right' }]);
    });

    test('staff quiz listings may retain answer keys for authorized editing', async () => {
        const quiz = { id: 'quiz-1', questions: [{ correctIndex: 1, options: [] }] };
        const service = new QuizzesService(
            { quiz: { findMany: async () => [quiz] } } as never,
            {} as never,
        );

        const quizzes = await service.listByCourse('course-1', true);

        assert.equal(quizzes[0].questions[0].correctIndex, 1);
    });

    test('instructors may manage quizzes only for openings they teach or can read', async () => {
        let openingQuery: any;
        let quizQuery: any;
        const service = new QuizzesService(
            {
                courseOpening: {
                    findUnique: async (args: any) => {
                        openingQuery = args;
                        return {
                            id: 'opening-1',
                            courseId: 'course-1',
                            status: 'OPEN',
                            archivedAt: null,
                            instructorId: 'instructor-1',
                            instructorGrants: [],
                        };
                    },
                },
                quiz: {
                    findMany: async (args: any) => {
                        quizQuery = args;
                        return [{
                            id: 'quiz-1',
                            openingId: 'opening-1',
                            questions: [{ correctIndex: 1, options: [] }],
                        }];
                    },
                },
            } as never,
            {} as never,
        );

        const quizzes = await service.listForInstructor('opening-1', 'instructor-1', Role.INSTRUCTOR);
        assert.equal(openingQuery.where.id, 'opening-1');
        assert.equal(quizQuery.where.openingId, 'opening-1');
        assert.equal(quizzes[0].questions[0].correctIndex, 1);
    });

    test('instructors without an active course assignment cannot manage quizzes', async () => {
        const service = new QuizzesService(
            {
                courseOpening: {
                    findUnique: async () => ({
                        id: 'opening-1',
                        courseId: 'course-1',
                        status: 'OPEN',
                        archivedAt: null,
                        instructorId: 'someone-else',
                        instructorGrants: [],
                    }),
                },
            } as never,
            {} as never,
        );

        await assert.rejects(
            () => service.listForInstructor('opening-1', 'instructor-1', Role.INSTRUCTOR),
            ForbiddenException,
        );
    });

    test('instructor lesson edits are stored as opening overrides and never update the main lesson', async () => {
        let overrideWrite: any;
        let mainLessonUpdated = false;
        const service = new LessonsService(
            {
                courseOpening: {
                    findUnique: async () => ({
                        id: 'opening-1',
                        courseId: 'course-1',
                        status: 'OPEN',
                        archivedAt: null,
                        instructorId: 'instructor-1',
                        instructorGrants: [],
                    }),
                },
                module: {
                    findUnique: async () => ({
                        id: 'module-1',
                        courseId: 'course-1',
                        openingId: null,
                        titleAr: 'الدرس الرئيسي',
                        titleEn: 'Main lesson',
                        descriptionAr: null,
                        descriptionEn: null,
                        videoUrl: null,
                        durationMinutes: null,
                        files: [],
                        links: [],
                    }),
                    update: async () => { mainLessonUpdated = true; },
                },
                openingModuleContent: {
                    findUnique: async () => null,
                    upsert: async (args: any) => {
                        overrideWrite = args;
                        return args.create;
                    },
                },
            } as never,
            {} as never,
        );

        await service.updateOpeningModule('opening-1', 'module-1', {
            titleAr: 'عنوان خاص بالدفعة',
            titleEn: 'Batch-only title',
            descriptionAr: null,
            descriptionEn: null,
            videoUrl: null,
            durationMinutes: null,
            files: [],
            links: [],
            outcomes: [],
        }, 'instructor-1', Role.INSTRUCTOR);

        assert.equal(mainLessonUpdated, false);
        assert.equal(overrideWrite.where.openingId_moduleId.openingId, 'opening-1');
        assert.equal(overrideWrite.where.openingId_moduleId.moduleId, 'module-1');
        assert.equal(overrideWrite.create.content.titleAr, 'عنوان خاص بالدفعة');
        assert.equal(overrideWrite.create.content.titleEn, 'Batch-only title');
    });

    test('opening lesson listing merges only that opening override with shared lessons', async () => {
        let moduleQuery: any;
        const service = new LessonsService(
            {
                courseOpening: {
                    findUnique: async () => ({
                        id: 'opening-1',
                        courseId: 'course-1',
                        status: 'STARTED',
                        archivedAt: null,
                        instructorId: 'instructor-1',
                        instructorGrants: [],
                    }),
                },
                module: {
                    findMany: async (args: any) => {
                        moduleQuery = args;
                        return [{
                            id: 'module-1',
                            titleAr: 'الدرس الرئيسي',
                            titleEn: 'Main lesson',
                            outcomes: [],
                            openingContents: [{
                                isHidden: false,
                                content: { titleAr: 'عنوان خاص بالدفعة', titleEn: 'Batch-only title' },
                            }],
                        }];
                    },
                },
            } as never,
            {} as never,
        );

        const modules = await service.openingModulesForInstructor('opening-1', 'instructor-1', Role.INSTRUCTOR);

        assert.deepEqual(moduleQuery.where.OR, [{ openingId: null }, { openingId: 'opening-1' }]);
        assert.equal(modules[0].titleAr, 'عنوان خاص بالدفعة');
        assert.equal(modules[0].titleEn, 'Batch-only title');
    });

    test('final quizzes cannot also be attached to a lesson', async () => {
        const service = new QuizzesService(
            { course: { findUnique: async () => ({ id: 'course-1' }) } } as never,
            {} as never,
        );

        await assert.rejects(
            () => service.create({
                courseId: 'course-1',
                moduleId: 'module-1',
                isFinal: true,
                titleAr: 'اختبار نهائي',
                titleEn: 'Final exam',
            }),
            BadRequestException,
        );
    });

    test('pending students cannot read or write private lesson notes', async () => {
        const service = new LessonsService(
            {
                enrollment: {
                    findUnique: async () => ({ id: 'enrollment-1', status: 'PENDING' }),
                    findFirst: async () => null,
                },
                module: { findUnique: async () => ({ courseId: 'course-1' }) },
            } as never,
            {} as never,
        );

        await assert.rejects(() => service.myNotes('course-1', 'student-1'), ForbiddenException);
        await assert.rejects(() => service.saveNote('module-1', 'private note', 'student-1'), ForbiddenException);
    });

    test('only approved enrollment grants paid course content', async () => {
        const checkAccess = async (enrollmentStatus: string) => {
            let enrollmentWhere: Record<string, unknown> | undefined;
            const service = new CoursesService(
                {
                    courseOpening: { findFirst: async () => null },
                    openingInstructorGrant: { findFirst: async () => null },
                    enrollment: {
                        findFirst: async ({ where }: { where: Record<string, unknown> }) => {
                            enrollmentWhere = where;
                            return enrollmentStatus === where.status ? { id: 'enrollment-1' } : null;
                        },
                    },
                } as never,
                {} as never,
                {} as never,
                {} as never,
            );
            const canView = await (service as any).canViewPaidContent(
                { id: 'course-1', instructorId: 'instructor-1' },
                { userId: 'student-1', role: 'STUDENT' },
            );
            return { canView, enrollmentWhere };
        };

        const pending = await checkAccess('PENDING');
        assert.equal(pending.canView, false);
        assert.equal(pending.enrollmentWhere?.status, 'APPROVED');

        const approved = await checkAccess('APPROVED');
        assert.equal(approved.canView, true);
    });
});
