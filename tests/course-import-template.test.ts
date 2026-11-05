import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import * as ExcelJS from 'exceljs';
import { CourseImportService } from '../src/courses/course-import.service';

describe('course import workbook', () => {
    test('provides columns for all course form data and optional gallery descriptions', async () => {
        const service = new CourseImportService({} as never);
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(await service.template() as any);

        const courseHeaders = workbook.getWorksheet('Courses')!.getRow(1).values as unknown[];
        assert.deepEqual(courseHeaders.slice(1), [
            'CourseKey', 'titleAr', 'titleEn', 'excerptAr', 'excerptEn', 'descriptionAr', 'descriptionEn',
            'categoryAr', 'categoryEn', 'level', 'contentType', 'language', 'hoursOfContent', 'durationAr',
            'durationEn', 'syllabusAr', 'syllabusEn', 'coverImageUrl', 'introVideoUrl', 'videoFileUrl',
            'certificateIssued', 'quizzesIncluded', 'projectsIncluded', 'assignmentsIncluded',
            'liveSessionsIncluded', 'downloadableResources', 'lifetimeAccess', 'communityAccess',
        ]);
        const galleryHeaders = workbook.getWorksheet('Gallery')!.getRow(1).values as unknown[];
        assert.deepEqual(galleryHeaders.slice(1), ['CourseKey', 'url', 'altAr', 'altEn', 'orderIndex']);

        for (const sheet of ['Chapters', 'Lessons', 'Objectives', 'Prerequisites', 'Audiences', 'FAQs', 'Gallery', 'LessonOutcomes']) {
            assert.ok(workbook.getWorksheet(sheet), `missing ${sheet} worksheet`);
        }
    });

    test('imports gallery alt text along with the course content', async () => {
        let createdCourse: Record<string, any> | undefined;
        const service = new CourseImportService({
            create: async (course: Record<string, any>) => {
                createdCourse = course;
                return { id: 'course-1', titleAr: course.titleAr };
            },
        } as never);
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(await service.template() as any);
        workbook.getWorksheet('Lessons')!.getCell(2, 11).value =
            'https://example.test/lesson-resource | رابط الدرس | Lesson resource';
        workbook.getWorksheet('Gallery')!.addRow([
            'CO-001',
            'https://example.test/course-gallery.jpg',
            'صورة توضيحية',
            'Illustration',
            0,
        ]);

        const result = await service.import(Buffer.from(await workbook.xlsx.writeBuffer()), 'instructor-1');

        assert.equal(result.imported, 1);
        assert.deepEqual(createdCourse?.gallery, [{
            url: 'https://example.test/course-gallery.jpg',
            altAr: 'صورة توضيحية',
            altEn: 'Illustration',
            orderIndex: 0,
        }]);
        assert.deepEqual(createdCourse?.chapters[0].modules[0].links, [{
            url: 'https://example.test/lesson-resource',
            labelAr: 'رابط الدرس',
            labelEn: 'Lesson resource',
        }]);
    });
});
