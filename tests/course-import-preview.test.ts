import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as ExcelJS from 'exceljs';
import {
    COURSE_IMPORT_JSON_TEMPLATE,
    COURSE_IMPORT_MARKDOWN_TEMPLATE,
    CourseImportService,
} from '../src/courses/course-import.service';
import { CoursesService } from '../src/courses/courses.service';

const validCourseData = (): Record<string, any> => ({
    titleAr: 'عنوان الدورة',
    titleEn: 'Course title',
    contentType: 'RECORDED',
    objectives: [],
    chapters: [{
        importKey: 'module-1',
        titleAr: 'الوحدة الأولى',
        titleEn: 'Module one',
        modules: [{
            importKey: 'lesson-1',
            titleAr: 'الدرس الأول',
            titleEn: 'Lesson one',
            links: [{ url: 'https://example.test/lesson', labelAr: 'رابط', labelEn: 'Link' }],
        }],
    }],
    quizzes: [{
        quizKey: 'quiz-1',
        titleAr: 'الاختبار الأول',
        titleEn: 'Quiz one',
        moduleRef: 'lesson-1',
        questions: [{
            type: 'SINGLE_CHOICE',
            textAr: 'السؤال',
            textEn: 'Question',
            options: [{ textAr: 'خيار', textEn: 'Option' }, { textAr: 'خيار آخر', textEn: 'Another option' }],
            correctIndex: 0,
        }],
    }],
    resources: [{
        lessonKey: 'lesson-1',
        type: 'LINK',
        url: 'https://example.test/resource',
        labelAr: 'مرجع',
        labelEn: 'Reference',
    }],
});

describe('course import preview', () => {
    const service = new CourseImportService({} as never);

    test('keeps checked-in JSON and Markdown templates aligned with downloadable templates', () => {
        assert.equal(
            readFileSync('course-template.json', 'utf8').replace(/\r\n/g, '\n').trim(),
            COURSE_IMPORT_JSON_TEMPLATE,
        );
        assert.equal(
            readFileSync('course-template.md', 'utf8').replace(/\r\n/g, '\n').trim(),
            COURSE_IMPORT_MARKDOWN_TEMPLATE.trim(),
        );
    });

    test('keeps all downloadable templates free of prefilled course data', async () => {
        const isBlankStructure = (value: unknown): boolean => {
            if (Array.isArray(value)) return value.every(isBlankStructure);
            if (value !== null && typeof value === 'object') {
                return Object.values(value).every(isBlankStructure);
            }
            return value === '';
        };
        assert.equal(isBlankStructure(JSON.parse(COURSE_IMPORT_JSON_TEMPLATE)), true);
        assert.doesNotMatch(COURSE_IMPORT_MARKDOWN_TEMPLATE, /مقدمة في الأمن السيبراني|example\.com/);

        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(readFileSync('course-template.xlsx') as any);
        for (const sheet of workbook.worksheets) {
            sheet.eachRow((row, rowNumber) => {
                if (rowNumber === 1) return;
                if (sheet.name === 'Course Info') {
                    assert.equal(String(row.getCell(2).value ?? ''), '', `unexpected course value in ${sheet.name}:${rowNumber}`);
                    return;
                }
                assert.equal(
                    row.values.slice(1).some(value => String(value ?? '').trim() !== ''),
                    false,
                    `unexpected sample row in ${sheet.name}:${rowNumber}`,
                );
            });
        }
    });

    test('provides a blank JSON template with the complete course structure', async () => {
        const result = await service.previewFile('course.json', Buffer.from(COURSE_IMPORT_JSON_TEMPLATE));
        const template = JSON.parse(COURSE_IMPORT_JSON_TEMPLATE);
        assert.equal(result.valid, false);
        assert.ok(result.errors.some(error => error.includes('titleAr')));
        assert.ok(template.chapters[0].modules[0].descriptionAr !== undefined);
        assert.ok(template.chapters[0].modules[0].outcomes !== undefined);
        assert.ok(template.chapters[0].modules[0].files !== undefined);
        assert.ok(template.chapters[0].modules[0].links !== undefined);
        assert.ok(template.quizzes[0].questions[0].options.length >= 2);
        assert.ok(template.resources[0].lessonKey !== undefined);
    });

    test('reports missing required course fields without creating anything', async () => {
        const result = await service.previewFile('course.json', Buffer.from('{"titleAr":"عنوان"}'));
        assert.equal(result.valid, false);
        assert.ok(result.errors.some(error => error.includes('titleEn')));
        assert.ok(result.errors.some(error => error.includes('contentType')));
    });

    test('preserves multiple chapter, lesson, quiz, and question relationships', async () => {
        const course = validCourseData();
        course.chapters.push({
            importKey: 'module-2',
            titleAr: 'الوحدة الثانية',
            titleEn: 'Module 2',
            orderIndex: 1,
            modules: [{
                importKey: 'lesson-2',
                titleAr: 'الدرس الثاني',
                titleEn: 'Lesson 2',
                orderIndex: 0,
            }],
        });
        course.quizzes.push({
            titleAr: 'الاختبار النهائي',
            titleEn: 'Final quiz',
            isFinal: true,
            orderIndex: 1,
            questions: [{
                type: 'TRUE_FALSE',
                textAr: 'العبارة صحيحة',
                textEn: 'The statement is true',
                options: [{ textAr: 'صحيح', textEn: 'True' }, { textAr: 'خطأ', textEn: 'False' }],
                correctIndex: 0,
            }],
        });

        const result = await service.previewFile('course.json', Buffer.from(JSON.stringify(course)));
        assert.equal(result.valid, true);
        assert.deepEqual(result.data.chapters?.map(chapter => chapter.orderIndex), [0, 1]);
        assert.equal(result.data.chapters?.[1].modules?.[0].importKey, 'lesson-2');
        assert.equal(result.data.quizzes?.[1].isFinal, true);
        assert.equal(result.data.quizzes?.[1].questions[0].correctIndex, 0);
    });

    test('rejects invalid JSON and files with a mismatched xlsx signature', async () => {
        await assert.rejects(service.previewFile('course.json', Buffer.from('{')));
        await assert.rejects(service.previewFile('course.xlsx', Buffer.from('not an xlsx')));
    });

    test('parses the documented Markdown sections deterministically', async () => {
        const result = await service.previewFile('course.md', Buffer.from(COURSE_IMPORT_MARKDOWN_TEMPLATE));
        assert.equal(result.valid, false);
        assert.ok(result.errors.some(error => error.includes('titleAr')));
        assert.equal(result.data.chapters?.[0].modules?.[0].descriptionEn, '');
        assert.equal(result.data.quizzes?.[0].questions[0].options.length, 2);
    });

    test('rejects malformed or unsupported Markdown sections', async () => {
        await assert.rejects(service.previewFile('course.md', Buffer.from('# Course Information\n\n```json\n{')));
        await assert.rejects(service.previewFile('course.md', Buffer.from('# Overview\n\nNo course section')));
    });

    test('provides an empty structured Excel template and reads complete relationships', async () => {
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(await service.structuredTemplate() as any);
        const info = workbook.getWorksheet('Course Info')!;
        const titleAr = Array.from({ length: info.rowCount }, (_, index) => index + 1)
            .find(row => info.getCell(row, 1).value === 'titleAr')!;
        const titleEn = Array.from({ length: info.rowCount }, (_, index) => index + 1)
            .find(row => info.getCell(row, 1).value === 'titleEn')!;
        const contentType = Array.from({ length: info.rowCount }, (_, index) => index + 1)
            .find(row => info.getCell(row, 1).value === 'contentType')!;
        const level = Array.from({ length: info.rowCount }, (_, index) => index + 1)
            .find(row => info.getCell(row, 1).value === 'level')!;
        const hours = Array.from({ length: info.rowCount }, (_, index) => index + 1)
            .find(row => info.getCell(row, 1).value === 'hoursOfContent')!;
        info.getCell(titleAr, 2).value = 'دورة اختبار';
        info.getCell(titleEn, 2).value = 'Test course';
        info.getCell(contentType, 2).value = 'RECORDED';
        info.getCell(level, 2).value = null;
        info.getCell(hours, 2).value = null;
        workbook.getWorksheet('Modules')!.addRow(['module-1', 'الوحدة الأولى', 'Module one', 0]);
        workbook.getWorksheet('Lessons')!.addRow([
            'lesson-1', 'module-1', 'الدرس الأول', 'Lesson one', '', '', '', '', 0,
            '[{"descriptionAr":"مخرج","descriptionEn":"Outcome","orderIndex":0}]',
            '[]',
            '[{"url":"https://example.test/lesson","labelAr":"رابط","labelEn":"Link"}]',
        ]);
        workbook.getWorksheet('Quizzes')!.addRow(['quiz-1', 'الاختبار الأول', 'Quiz one', '', '', 60, false, 0, 'lesson-1']);
        workbook.getWorksheet('Questions')!.addRow([
            'quiz-1', 'SINGLE_CHOICE', 'السؤال', 'Question',
            '[{"textAr":"خيار","textEn":"Option"},{"textAr":"خيار آخر","textEn":"Another option"}]',
            0, '', '', 0,
        ]);
        workbook.getWorksheet('Resources')!.addRow([
            'lesson-1', 'LINK', 'https://example.test/resource', '', '', 'مرجع', 'Reference',
        ]);

        const result = await service.previewFile('course.xlsx', Buffer.from(await workbook.xlsx.writeBuffer()));
        assert.equal(result.valid, true, JSON.stringify(result.errors));
        assert.equal(result.data.chapters?.[0].modules?.[0].importKey, 'lesson-1');
        assert.equal(result.data.chapters?.[0].modules?.[0].outcomes?.[0].descriptionEn, 'Outcome');
        assert.equal(result.data.quizzes?.[0].questions[0].correctIndex, 0);
        assert.equal(result.data.chapters?.[0].modules?.[0].links?.[0].url, 'https://example.test/lesson');
        assert.equal(result.data.chapters?.[0].modules?.[0].links?.[1].url, 'https://example.test/resource');
        assert.equal('level' in result.data, false);
        assert.equal('hoursOfContent' in result.data, false);

        const checkedInTemplate = await service.previewFile('course-template.xlsx', readFileSync('course-template.xlsx'));
        assert.equal(checkedInTemplate.valid, false);
        assert.equal('certificateIssued' in checkedInTemplate.data, false, 'blank Excel booleans must use database defaults');
    });

    test('reports missing required Excel sheets', async () => {
        const workbook = new ExcelJS.Workbook();
        workbook.addWorksheet('Course Info').addRow(['Field', 'Value']);
        await assert.rejects(service.previewFile('course.xlsx', Buffer.from(await workbook.xlsx.writeBuffer())));
    });
});

describe('course creation with imported quizzes', () => {
    test('creates the course, lesson quiz, and questions inside one transaction', async () => {
        let transactionCalls = 0;
        const quizzes: Record<string, any>[] = [];
        const tx = {
            course: { create: async ({ data }: { data: Record<string, unknown> }) => ({ id: data.id }) },
            module: {
                findMany: async () => [{
                    id: 'lesson-db-id',
                    titleAr: 'الدرس الأول',
                    titleEn: 'Lesson one',
                    orderIndex: 0,
                    chapter: { titleAr: 'الوحدة الأولى', titleEn: 'Module one', orderIndex: 0 },
                }],
            },
            quiz: { create: async ({ data }: { data: Record<string, any> }) => { quizzes.push(data); return data; } },
        };
        const prisma = {
            $transaction: async (callback: (transaction: typeof tx) => Promise<unknown>) => {
                transactionCalls += 1;
                return callback(tx);
            },
            course: { create: async () => { throw new Error('quiz creation must use a transaction'); } },
        };
        const service = new CoursesService(prisma as never, {} as never, {} as never, {} as never);
        await service.create({
            titleAr: 'دورة اختبار',
            titleEn: 'Test course',
            contentType: 'RECORDED' as never,
            chapters: [{
                importKey: 'chapter-1',
                titleAr: 'الوحدة الأولى',
                titleEn: 'Module one',
                orderIndex: 0,
                modules: [{
                    importKey: 'lesson-1',
                    titleAr: 'الدرس الأول',
                    titleEn: 'Lesson one',
                    orderIndex: 0,
                }],
            }],
            quizzes: [{
                titleAr: 'اختبار الدرس',
                titleEn: 'Lesson quiz',
                moduleRef: 'lesson-1',
                isFinal: false,
                questions: [{
                    type: 'SINGLE_CHOICE',
                    textAr: 'سؤال',
                    textEn: 'Question',
                    options: [{ textAr: 'نعم', textEn: 'Yes' }, { textAr: 'لا', textEn: 'No' }],
                    correctIndex: 0,
                }],
            }],
        }, 'instructor-id');

        assert.equal(transactionCalls, 1);
        assert.equal(quizzes.length, 1);
        assert.equal(quizzes[0].module.connect.id, 'lesson-db-id');
        assert.equal(quizzes[0].questions.create[0].correctIndex, 0);
    });

    test('returns the original course for repeated import keys and rejects changed payload reuse', async () => {
        let storedCourse: Record<string, unknown> | null = null;
        const transaction = {
            course: {
                create: async ({ data }: { data: Record<string, unknown> }) => {
                    storedCourse = data;
                    return data;
                },
            },
            module: { findMany: async () => [] },
            quiz: { create: async () => undefined },
            courseImportRequest: {
                findUnique: async () => storedCourse
                    ? { payloadHash: storedCourse.payloadHash, course: storedCourse }
                    : null,
                create: async ({ data }: { data: Record<string, unknown> }) => {
                    storedCourse = { ...storedCourse, ...data };
                    return storedCourse;
                },
            },
        };
        const prisma = {
            ...transaction,
            $transaction: async (callback: (tx: typeof transaction) => Promise<unknown>) => callback(transaction),
        };
        const service = new CoursesService(prisma as never, {} as never, {} as never, {} as never);
        const course = {
            titleAr: 'دورة اختبار',
            titleEn: 'Test course',
            contentType: 'RECORDED' as never,
        };
        const key = 'f6067e79-0bf0-4c12-9451-6a9c28ce3ec1';
        const first = await service.createImported(course, 'instructor-id', key);
        const retry = await service.createImported(course, 'instructor-id', key);

        assert.equal(first.id, retry.id);
        assert.equal(storedCourse?.idempotencyKey, key);
        await assert.rejects(service.createImported({ ...course, titleEn: 'Different course' }, 'instructor-id', key));
    });
});
