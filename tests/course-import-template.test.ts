import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import * as ExcelJS from 'exceljs';
import { CourseImportService } from '../src/courses/course-import.service';

describe('course import workbook', () => {
    test('provides empty bilingual worksheets with an Arabic user guide and column notes', async () => {
        const service = new CourseImportService({} as never);
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(await service.template() as any);

        const coursesSheet = workbook.getWorksheet('بيانات الدورة')!;
        assert.ok(coursesSheet.getRow(1).hidden, 'technical import keys should be hidden');
        const courseHeaders = coursesSheet.getRow(1).values as unknown[];
        assert.deepEqual(courseHeaders.slice(1), [
            'CourseKey', 'titleAr', 'titleEn', 'excerptAr', 'excerptEn', 'descriptionAr', 'descriptionEn',
            'categoryAr', 'categoryEn', 'level', 'contentType', 'language', 'hoursOfContent', 'durationAr',
            'durationEn', 'syllabusAr', 'syllabusEn', 'coverImageUrl', 'introVideoUrl', 'videoFileUrl',
            'certificateIssued', 'quizzesIncluded', 'projectsIncluded', 'assignmentsIncluded',
            'liveSessionsIncluded', 'downloadableResources', 'lifetimeAccess', 'communityAccess',
        ]);
        const visibleCourseHeaders = coursesSheet.getRow(2).values as unknown[];
        assert.deepEqual(visibleCourseHeaders.slice(1, 5), [
            'مفتاح الدورة (للربط بين الأوراق) *', 'العنوان بالعربية *', 'العنوان بالإنجليزية *', 'نبذة قصيرة بالعربية',
        ]);
        const galleryHeaders = workbook.getWorksheet('الصور')!.getRow(1).values as unknown[];
        assert.deepEqual(galleryHeaders.slice(1), ['CourseKey', 'url', 'altAr', 'altEn', 'orderIndex']);

        for (const sheet of ['الفصول', 'الدروس', 'أهداف التعلم', 'المتطلبات', 'الفئة المستهدفة', 'الأسئلة الشائعة', 'الصور', 'مخرجات الدروس']) {
            assert.ok(workbook.getWorksheet(sheet), `missing ${sheet} worksheet`);
        }
        assert.ok(
            !coursesSheet.getRows(3, Math.max(0, coursesSheet.rowCount - 2))?.some((row) =>
                Array.from({ length: coursesSheet.columnCount }, (_, column) => row.getCell(column + 1).value)
                    .some((value) => String(value ?? '').trim() !== ''),
            ),
            'data sheets should not contain importable sample courses',
        );
        assert.ok(
            (workbook.getWorksheet('ابدأ هنا')!.getColumn(2).values as unknown[]).some(value => /محتوى الدورة/.test(String(value ?? ''))),
        );
        assert.ok(coursesSheet.getCell(2, 2).note, 'visible Arabic headers should include detailed field notes');
    });

    test('continues to import workbooks using the previous English sheet names and layout', async () => {
        let createCalls = 0;
        const service = new CourseImportService({
            create: async () => {
                createCalls += 1;
                return { id: 'course-1', titleAr: 'عنوان' };
            },
        } as never);
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(await service.template() as any);
        const legacyNames: Record<string, string> = {
            'بيانات الدورة': 'Courses',
            'الفصول': 'Chapters',
            'الدروس': 'Lessons',
            'أهداف التعلم': 'Objectives',
            'المتطلبات': 'Prerequisites',
            'الفئة المستهدفة': 'Audiences',
            'الأسئلة الشائعة': 'FAQs',
            'الصور': 'Gallery',
            'مخرجات الدروس': 'LessonOutcomes',
        };
        for (const [localizedName, legacyName] of Object.entries(legacyNames)) {
            const sheet = workbook.getWorksheet(localizedName)!;
            sheet.name = legacyName;
            sheet.spliceRows(2, 1);
            sheet.getRow(1).hidden = false;
        }
        const courseRow = Array(28).fill('');
        courseRow[0] = 'CO-001';
        courseRow[1] = 'عنوان الدورة';
        courseRow[2] = 'Course title';
        courseRow[10] = 'RECORDED';
        workbook.getWorksheet('Courses')!.addRow(courseRow);

        const result = await service.import(Buffer.from(await workbook.xlsx.writeBuffer()), 'instructor-1');

        assert.equal(result.imported, 1);
        assert.equal(createCalls, 1);
    });

    test('does not import an empty template or stop at blank rows before real course data', async () => {
        let createCalls = 0;
        const service = new CourseImportService({
            create: async () => {
                createCalls += 1;
                return { id: 'course-1', titleAr: 'عنوان' };
            },
        } as never);
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(await service.template() as any);
        await assert.rejects(service.import(Buffer.from(await workbook.xlsx.writeBuffer()), 'instructor-1'));
        assert.equal(createCalls, 0);

        const courses = workbook.getWorksheet('بيانات الدورة')!;
        courses.addRow([]);
        const row = Array(28).fill('');
        row[0] = 'CO-001';
        row[1] = 'عنوان الدورة';
        row[2] = 'Course title';
        row[10] = 'RECORDED';
        courses.addRow(row);

        const result = await service.import(Buffer.from(await workbook.xlsx.writeBuffer()), 'instructor-1');
        assert.equal(result.imported, 1);
        assert.equal(createCalls, 1);
    });

    test('imports gallery alt text, linked lessons, and previously uploaded media paths', async () => {
        let createdCourse: Record<string, any> | undefined;
        const service = new CourseImportService({
            create: async (course: Record<string, any>) => {
                createdCourse = course;
                return { id: 'course-1', titleAr: course.titleAr };
            },
        } as never);
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(await service.template() as any);
        const courseRow = Array(28).fill('');
        courseRow[0] = 'CO-001';
        courseRow[1] = 'عنوان الدورة';
        courseRow[2] = 'Course title';
        courseRow[10] = 'RECORDED';
        workbook.getWorksheet('بيانات الدورة')!.addRow(courseRow);
        workbook.getWorksheet('الفصول')!.addRow(['CO-001', 'CH-001', 'مقدمة', 'Introduction', 0]);
        workbook.getWorksheet('الدروس')!.addRow([
            'CO-001', 'CH-001', 'LE-001', 'الدرس الأول', 'First lesson', '', '', '', 0, 30,
            'https://example.test/lesson-resource | رابط الدرس | Lesson resource',
            '/uploads/courses/lesson-files/file-1.pdf | ملف الدرس | Lesson file',
        ]);
        workbook.getWorksheet('الصور')!.addRow([
            'CO-001',
            '/uploads/courses/gallery/course-gallery.jpg',
            'صورة توضيحية',
            'Illustration',
            0,
        ]);

        const result = await service.import(Buffer.from(await workbook.xlsx.writeBuffer()), 'instructor-1');

        assert.equal(result.imported, 1);
        assert.deepEqual(createdCourse?.gallery, [{
            url: '/uploads/courses/gallery/course-gallery.jpg',
            altAr: 'صورة توضيحية',
            altEn: 'Illustration',
            orderIndex: 0,
        }]);
        assert.deepEqual(createdCourse?.chapters[0].modules[0].links, [{
            url: 'https://example.test/lesson-resource',
            labelAr: 'رابط الدرس',
            labelEn: 'Lesson resource',
        }]);
        assert.deepEqual(createdCourse?.chapters[0].modules[0].files, [{
            url: '/uploads/courses/lesson-files/file-1.pdf',
            nameAr: 'ملف الدرس',
            nameEn: 'Lesson file',
        }]);
    });

    test('rejects broken cross-sheet keys and unsupported media instead of silently dropping them', async () => {
        let createCalls = 0;
        const service = new CourseImportService({
            create: async () => {
                createCalls += 1;
                return { id: 'course-1', titleAr: 'عنوان' };
            },
        } as never);
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(await service.template() as any);
        const courseRow = Array(28).fill('');
        courseRow[0] = 'CO-001';
        courseRow[1] = 'عنوان الدورة';
        courseRow[2] = 'Course title';
        courseRow[10] = 'RECORDED';
        workbook.getWorksheet('بيانات الدورة')!.addRow(courseRow);
        workbook.getWorksheet('الفصول')!.addRow(['CO-001', 'CH-001', 'مقدمة', 'Introduction', 0]);
        workbook.getWorksheet('الدروس')!.addRow([
            'CO-001', 'MISSING-CHAPTER', 'LE-001', 'الدرس الأول', 'First lesson', '', '', '', 0, 30, '', '',
        ]);
        workbook.getWorksheet('الصور')!.addRow(['CO-001', 'javascript:alert(1)', '', '', 0]);

        await assert.rejects(service.import(Buffer.from(await workbook.xlsx.writeBuffer()), 'instructor-1'));
        assert.equal(createCalls, 0, 'invalid workbooks must not partially create courses');
    });
});
