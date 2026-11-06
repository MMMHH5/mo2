import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import * as ExcelJS from 'exceljs';
import { CourseImportService } from '../src/courses/course-import.service';

const fillCourseForm = (sheet: ExcelJS.Worksheet, fields: Record<string, string>) => {
    sheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const key = String(row.getCell(1).value ?? '');
        if (key in fields) row.getCell(5).value = fields[key];
    });
};

const validCourse = {
    titleAr: 'عنوان الدورة',
    titleEn: 'Course title',
    contentType: 'مسجل',
};

describe('course import workbook', () => {
    test('is a fillable course form with no instructions sheet or sample data', async () => {
        const service = new CourseImportService({} as never);
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(await service.template() as any);

        assert.deepEqual(workbook.worksheets.map(sheet => sheet.name), [
            'نموذج الدورة', 'الفصول', 'الدروس', 'أهداف التعلم', 'المتطلبات',
            'الفئة المستهدفة', 'الأسئلة الشائعة', 'الصور', 'مخرجات الدروس',
        ]);
        const courseSheet = workbook.getWorksheet('نموذج الدورة')!;
        assert.equal(courseSheet.getCell(1, 1).value, '__course_form_v1__');
        assert.deepEqual(
            [courseSheet.getCell(2, 3).value, courseSheet.getCell(3, 3).value, courseSheet.getCell(11, 3).value],
            ['العنوان بالعربية *', 'العنوان بالإنجليزية *', 'نوع المحتوى *'],
        );
        assert.equal(String(courseSheet.getCell(2, 5).value ?? ''), '');
        assert.ok(courseSheet.getCell(11, 5).dataValidation, 'content type should use a dropdown');
        assert.equal(workbook.getWorksheet('الفصول')!.getColumn(1).hidden, true, 'internal course IDs should not be shown');
        assert.equal(workbook.getWorksheet('الدروس')!.getColumn(3).hidden, false, 'chapter link should use a readable title');
        assert.ok(workbook.getWorksheet('الدروس')!.getCell(2, 3).note);
    });

    test('creates a course from values entered in the form without requiring internal IDs', async () => {
        let createdCourse: Record<string, any> | undefined;
        const service = new CourseImportService({
            create: async (course: Record<string, any>) => {
                createdCourse = course;
                return { id: 'course-1', titleAr: course.titleAr };
            },
        } as never);
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(await service.template() as any);
        fillCourseForm(workbook.getWorksheet('نموذج الدورة')!, {
            ...validCourse,
            level: 'متوسط',
            certificateIssued: 'نعم',
            descriptionAr: 'وصف الدورة بالعربية',
        });

        const result = await service.import(Buffer.from(await workbook.xlsx.writeBuffer()), 'instructor-1');

        assert.equal(result.imported, 1);
        assert.equal(createdCourse?.titleAr, validCourse.titleAr);
        assert.equal(createdCourse?.contentType, 'RECORDED');
        assert.equal(createdCourse?.level, 'INTERMEDIATE');
        assert.equal(createdCourse?.certificateIssued, true);
        assert.equal(createdCourse?.descriptionAr, 'وصف الدورة بالعربية');
    });

    test('rejects an empty form and accepts the completed form after blank rows', async () => {
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

        const courses = workbook.getWorksheet('نموذج الدورة')!;
        courses.addRow([]);
        fillCourseForm(courses, validCourse);
        const result = await service.import(Buffer.from(await workbook.xlsx.writeBuffer()), 'instructor-1');
        assert.equal(result.imported, 1);
        assert.equal(createCalls, 1);
    });

    test('imports linked chapters, lessons, outcomes, gallery, and uploaded media paths', async () => {
        let createdCourse: Record<string, any> | undefined;
        const service = new CourseImportService({
            create: async (course: Record<string, any>) => {
                createdCourse = course;
                return { id: 'course-1', titleAr: course.titleAr };
            },
        } as never);
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(await service.template() as any);
        fillCourseForm(workbook.getWorksheet('نموذج الدورة')!, validCourse);
        workbook.getWorksheet('الفصول')!.addRow(['', '', 'مقدمة', 'Introduction', 0]);
        workbook.getWorksheet('الدروس')!.addRow([
            '', '', 'مقدمة', '', 'الدرس الأول', 'First lesson', '', '', '', 0, 30,
            'https://example.test/lesson-resource | رابط الدرس | Lesson resource',
            '/uploads/courses/lesson-files/file-1.pdf | ملف الدرس | Lesson file',
        ]);
        workbook.getWorksheet('مخرجات الدروس')!.addRow([
            '', '', 'مقدمة', '', 'الدرس الأول', 'يتعرف الطالب إلى المفاهيم', 'Learns the concepts', 0,
        ]);
        workbook.getWorksheet('الصور')!.addRow([
            '', '/uploads/courses/gallery/course-gallery.jpg', 'صورة توضيحية', 'Illustration', 0,
        ]);

        const result = await service.import(Buffer.from(await workbook.xlsx.writeBuffer()), 'instructor-1');

        assert.equal(result.imported, 1);
        assert.deepEqual(createdCourse?.gallery, [{
            url: '/uploads/courses/gallery/course-gallery.jpg',
            altAr: 'صورة توضيحية',
            altEn: 'Illustration',
            orderIndex: 0,
        }]);
        assert.equal(createdCourse?.chapters[0].titleAr, 'مقدمة');
        assert.equal(createdCourse?.chapters[0].modules[0].titleAr, 'الدرس الأول');
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
        assert.equal(createdCourse?.chapters[0].modules[0].outcomes[0].descriptionAr, 'يتعرف الطالب إلى المفاهيم');
    });

    test('rejects unmatched chapter links and unsupported media before creating the course', async () => {
        let createCalls = 0;
        const service = new CourseImportService({
            create: async () => {
                createCalls += 1;
                return { id: 'course-1', titleAr: 'عنوان' };
            },
        } as never);
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(await service.template() as any);
        fillCourseForm(workbook.getWorksheet('نموذج الدورة')!, validCourse);
        workbook.getWorksheet('الفصول')!.addRow(['', '', 'مقدمة', 'Introduction', 0]);
        workbook.getWorksheet('الدروس')!.addRow([
            '', '', 'فصل غير موجود', '', 'الدرس الأول', 'First lesson', '', '', '', 0, 30, '', '',
        ]);
        workbook.getWorksheet('الصور')!.addRow(['', 'javascript:alert(1)', '', '', 0]);

        await assert.rejects(service.import(Buffer.from(await workbook.xlsx.writeBuffer()), 'instructor-1'));
        assert.equal(createCalls, 0, 'invalid workbooks must not partially create courses');
    });

    test('continues to import workbooks using the previous English sheet names and layout', async () => {
        let createdCourse: Record<string, any> | undefined;
        const service = new CourseImportService({
            create: async (course: Record<string, any>) => {
                createdCourse = course;
                return { id: 'course-1', titleAr: course.titleAr };
            },
        } as never);
        const workbook = new ExcelJS.Workbook();
        const courses = workbook.addWorksheet('Courses');
        courses.columns = [
            'CourseKey', 'titleAr', 'titleEn', 'excerptAr', 'excerptEn', 'descriptionAr', 'descriptionEn',
            'categoryAr', 'categoryEn', 'level', 'contentType', 'language', 'hoursOfContent', 'durationAr',
            'durationEn', 'syllabusAr', 'syllabusEn', 'coverImageUrl', 'introVideoUrl', 'videoFileUrl',
            'certificateIssued', 'quizzesIncluded', 'projectsIncluded', 'assignmentsIncluded',
            'liveSessionsIncluded', 'downloadableResources', 'lifetimeAccess', 'communityAccess',
        ].map(header => ({ header }));
        const row = Array(28).fill('');
        row[0] = 'CO-001';
        row[1] = validCourse.titleAr;
        row[2] = validCourse.titleEn;
        row[10] = 'RECORDED';
        courses.addRow(row);

        const result = await service.import(Buffer.from(await workbook.xlsx.writeBuffer()), 'instructor-1');

        assert.equal(result.imported, 1);
        assert.equal(createdCourse?.titleAr, validCourse.titleAr);
    });

    test('continues to import the previously published Arabic workbook layout', async () => {
        let createdCourse: Record<string, any> | undefined;
        const service = new CourseImportService({
            create: async (course: Record<string, any>) => {
                createdCourse = course;
                return { id: 'course-1', titleAr: course.titleAr };
            },
        } as never);
        const workbook = new ExcelJS.Workbook();
        const courses = workbook.addWorksheet('بيانات الدورة');
        courses.columns = [
            'CourseKey', 'titleAr', 'titleEn', 'excerptAr', 'excerptEn', 'descriptionAr', 'descriptionEn',
            'categoryAr', 'categoryEn', 'level', 'contentType', 'language', 'hoursOfContent', 'durationAr',
            'durationEn', 'syllabusAr', 'syllabusEn', 'coverImageUrl', 'introVideoUrl', 'videoFileUrl',
            'certificateIssued', 'quizzesIncluded', 'projectsIncluded', 'assignmentsIncluded',
            'liveSessionsIncluded', 'downloadableResources', 'lifetimeAccess', 'communityAccess',
        ].map(header => ({ header }));
        courses.getRow(1).hidden = true;
        courses.getRow(2).values = [
            'CourseKey', 'titleAr', 'titleEn', 'excerptAr', 'excerptEn', 'descriptionAr', 'descriptionEn',
            'categoryAr', 'categoryEn', 'level', 'contentType', 'language', 'hoursOfContent', 'durationAr',
            'durationEn', 'syllabusAr', 'syllabusEn', 'coverImageUrl', 'introVideoUrl', 'videoFileUrl',
            'certificateIssued', 'quizzesIncluded', 'projectsIncluded', 'assignmentsIncluded',
            'liveSessionsIncluded', 'downloadableResources', 'lifetimeAccess', 'communityAccess',
        ];
        const row = Array(28).fill('');
        row[0] = 'CO-001';
        row[1] = validCourse.titleAr;
        row[2] = validCourse.titleEn;
        row[10] = 'RECORDED';
        courses.addRow([]);
        courses.addRow(row);

        const result = await service.import(Buffer.from(await workbook.xlsx.writeBuffer()), 'instructor-1');

        assert.equal(result.imported, 1);
        assert.equal(createdCourse?.titleAr, validCourse.titleAr);
    });
});
