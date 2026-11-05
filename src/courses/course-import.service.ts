import { BadRequestException, Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { CourseContentType, CourseLevel } from '@prisma/client';
import { CoursesService } from './courses.service';
import { CreateCourseDto } from './dto/create-course.dto';

const TEXT = (value: unknown) => String(value ?? '').trim();
const NUM = (value: unknown, fallback?: number) => {
    if (value === null || value === undefined || String(value).trim() === '') return fallback;
    const n = Number(value);
    return Number.isFinite(n) ? n : undefined;
};

@Injectable()
export class CourseImportService {
    constructor(private readonly coursesService: CoursesService) {}

    async template(): Promise<Buffer> {
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'LaxaLab Academy';
        workbook.created = new Date();
        const guide = workbook.addWorksheet('Instructions', { views: [{ rightToLeft: true }] });
        guide.columns = [{ width: 42 }, { width: 100 }];
        guide.addRow(['القاعدة', 'الشرح']);
        guide.addRow(['Courses reference key', 'استخدم معرفاً قصيراً فريداً مثل CO-001 في جميع الأسطر']);
        guide.addRow(['الحقول المطلوبة', 'العنوان العربي، العنوان الإنجليزي، نوع المحتوى']);
        guide.addRow(['نوع المحتوى', 'LIVE للدورات المباشرة أو RECORDED للدورات المسجلة']);
        guide.addRow(['المستوى', 'BEGINNER أو INTERMEDIATE أو ADVANCED أو EXPERT']);
        guide.addRow(['الترتيب', 'رقم صحيح يبدأ من 0']);
        guide.addRow(['الملفات', 'لا يمكن رفع الملفات داخل Excel. أضف الروابط النصية، ثم ارفع الصور والملفات من شاشة تعديل الدورة بعد الاستيراد']);

        const courses = workbook.addWorksheet('Courses', { views: [{ state: 'frozen', ySplit: 1, rightToLeft: true }] });
        courses.columns = [
            { header: 'CourseKey', key: 'courseKey', width: 18 }, { header: 'titleAr', key: 'titleAr', width: 32 },
            { header: 'titleEn', key: 'titleEn', width: 32 }, { header: 'excerptAr', key: 'excerptAr', width: 40 },
            { header: 'excerptEn', key: 'excerptEn', width: 40 }, { header: 'descriptionAr', key: 'descriptionAr', width: 48 },
            { header: 'descriptionEn', key: 'descriptionEn', width: 48 }, { header: 'categoryAr', key: 'categoryAr', width: 22 },
            { header: 'categoryEn', key: 'categoryEn', width: 22 }, { header: 'level', key: 'level', width: 18 },
            { header: 'contentType', key: 'contentType', width: 18 }, { header: 'language', key: 'language', width: 18 },
            { header: 'hoursOfContent', key: 'hoursOfContent', width: 18 }, { header: 'videoUrl', key: 'videoUrl', width: 36 },
        ];
        courses.addRow({ courseKey: 'CO-001', titleAr: 'عنوان الدورة', titleEn: 'Course title', level: 'BEGINNER', contentType: 'RECORDED', language: 'Bilingual', hoursOfContent: 10 });

        const chapters = workbook.addWorksheet('Chapters', { views: [{ state: 'frozen', ySplit: 1, rightToLeft: true }] });
        chapters.columns = [
            { header: 'CourseKey', key: 'courseKey', width: 18 }, { header: 'chapterKey', key: 'chapterKey', width: 18 },
            { header: 'titleAr', key: 'titleAr', width: 32 }, { header: 'titleEn', key: 'titleEn', width: 32 },
            { header: 'orderIndex', key: 'orderIndex', width: 14 },
        ];
        chapters.addRow({ courseKey: 'CO-001', chapterKey: 'CH-001', titleAr: 'المقدمة', titleEn: 'Introduction', orderIndex: 0 });

        const lessons = workbook.addWorksheet('Lessons', { views: [{ state: 'frozen', ySplit: 1, rightToLeft: true }] });
        lessons.columns = [
            { header: 'CourseKey', key: 'courseKey', width: 18 }, { header: 'chapterKey', key: 'chapterKey', width: 18 },
            { header: 'titleAr', key: 'titleAr', width: 32 }, { header: 'titleEn', key: 'titleEn', width: 32 },
            { header: 'descriptionAr', key: 'descriptionAr', width: 44 }, { header: 'descriptionEn', key: 'descriptionEn', width: 44 },
            { header: 'videoUrl', key: 'videoUrl', width: 36 }, { header: 'orderIndex', key: 'orderIndex', width: 14 },
            { header: 'durationMinutes', key: 'durationMinutes', width: 18 }, { header: 'links', key: 'links', width: 50 },
        ];
        lessons.addRow({ courseKey: 'CO-001', chapterKey: 'CH-001', titleAr: 'الدرس الأول', titleEn: 'First lesson', videoUrl: '', orderIndex: 0, durationMinutes: 30, links: '' });

        for (const sheet of [courses, chapters, lessons]) {
            sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
            sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF17365D' } };
            sheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };
            sheet.autoFilter = { from: 'A1', to: `${String.fromCharCode(64 + sheet.columnCount)}1` };
        }
        for (let row = 2; row <= 500; row += 1) {
            courses.getCell(row, 10).dataValidation = { type: 'list', allowBlank: true, formulae: ['"BEGINNER,INTERMEDIATE,ADVANCED,EXPERT"'] };
            courses.getCell(row, 11).dataValidation = { type: 'list', allowBlank: false, formulae: ['"LIVE,RECORDED"'] };
        }
        guide.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        guide.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF17365D' } };
        return Buffer.from(await workbook.xlsx.writeBuffer());
    }

    async import(buffer: Buffer, instructorId: string) {
        let workbook: ExcelJS.Workbook;
        try { workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(buffer as any); }
        catch { throw new BadRequestException('ملف Excel غير صالح أو تالف.'); }
        const coursesSheet = workbook.getWorksheet('Courses');
        if (!coursesSheet) throw new BadRequestException('ورقة Courses مفقودة من القالب.');
        const courseRows = coursesSheet.getRows(2, Math.max(0, coursesSheet.rowCount - 1)) ?? [];
        const parsedCourses: CreateCourseDto[] = [];
        const errors: string[] = [];
        const seenKeys = new Set<string>();
        const chapterRows = this.rows(workbook.getWorksheet('Chapters'));
        const lessonRows = this.rows(workbook.getWorksheet('Lessons'));

        for (const [index, row] of courseRows.entries()) {
            const line = index + 2;
            const key = TEXT(row.getCell(1).value);
            if (!key && courseRows.slice(index + 1).every(r => !TEXT(r.getCell(1).value))) break;
            if (!key) { errors.push(`Courses:${line}: CourseKey مطلوب`); continue; }
            if (seenKeys.has(key)) { errors.push(`Courses:${line}: CourseKey مكرر (${key})`); continue; }
            seenKeys.add(key);
            const titleAr = TEXT(row.getCell(2).value), titleEn = TEXT(row.getCell(3).value);
            const contentType = TEXT(row.getCell(11).value).toUpperCase() as CourseContentType;
            if (!titleAr || !titleEn) errors.push(`Courses:${line}: العنوان العربي والإنجليزي مطلوبان`);
            if (!Object.values(CourseContentType).includes(contentType)) errors.push(`Courses:${line}: contentType يجب أن يكون LIVE أو RECORDED`);
            const levelRaw = TEXT(row.getCell(10).value).toUpperCase() as CourseLevel;
            const level = Object.values(CourseLevel).includes(levelRaw) ? levelRaw : undefined;
            if (TEXT(row.getCell(10).value) && !level) errors.push(`Courses:${line}: المستوى غير صالح`);
            const ch = chapterRows.filter(r => TEXT(r.CourseKey) === key);
            const chapters = ch.map((c, chapterIndex) => {
                const chapterKey = TEXT(c.chapterKey);
                const lessons = lessonRows.filter(l => TEXT(l.CourseKey) === key && TEXT(l.chapterKey) === chapterKey);
                return {
                    chapterKey,
                    titleAr: TEXT(c.titleAr), titleEn: TEXT(c.titleEn),
                    orderIndex: NUM(c.orderIndex, chapterIndex) ?? chapterIndex,
                    modules: lessons.map((l, lessonIndex) => ({
                        titleAr: TEXT(l.titleAr), titleEn: TEXT(l.titleEn),
                        descriptionAr: TEXT(l.descriptionAr) || undefined, descriptionEn: TEXT(l.descriptionEn) || undefined,
                        videoUrl: TEXT(l.videoUrl) || undefined, orderIndex: NUM(l.orderIndex, lessonIndex) ?? lessonIndex,
                        durationMinutes: NUM(l.durationMinutes),
                        links: this.parseLinks(TEXT(l.links)),
                    })),
                };
            });
            if (!titleAr || !titleEn) continue;
            parsedCourses.push({
                titleAr, titleEn,
                excerptAr: TEXT(row.getCell(4).value) || undefined, excerptEn: TEXT(row.getCell(5).value) || undefined,
                descriptionAr: TEXT(row.getCell(6).value) || undefined, descriptionEn: TEXT(row.getCell(7).value) || undefined,
                categoryAr: TEXT(row.getCell(8).value) || undefined, categoryEn: TEXT(row.getCell(9).value) || undefined,
                level, contentType, language: TEXT(row.getCell(12).value) || undefined,
                hoursOfContent: NUM(row.getCell(13).value),
                chapters: chapters.map(({ chapterKey: _chapterKey, ...chapter }) => chapter) as any,
            });
        }
        if (!parsedCourses.length && !errors.length) errors.push('لا توجد دورات مكتملة في ورقة Courses.');
        if (errors.length) throw new BadRequestException({ message: 'تعذر استيراد ملف Excel.', errors });

        const created: { id: string; titleAr: string }[] = [];
        for (const course of parsedCourses) created.push(await this.coursesService.create(course, instructorId));
        return { imported: created.length, courses: created.map(c => ({ id: c.id, titleAr: c.titleAr })) };
    }

    private rows(sheet: ExcelJS.Worksheet | undefined): Record<string, unknown>[] {
        if (!sheet) return [];
        const headers = sheet.getRow(1).values as unknown[];
        const out: Record<string, unknown>[] = [];
        sheet.eachRow((row, rowNumber) => {
            if (rowNumber === 1) return;
            const value: Record<string, unknown> = {};
            headers.slice(1).forEach((header, index) => { value[String(header)] = row.getCell(index + 1).value; });
            if (Object.values(value).some(v => String(v ?? '').trim())) out.push(value);
        });
        return out;
    }

    private parseLinks(value: string) {
        if (!value) return undefined;
        return value.split(/[\n|;]/).map((item, index) => {
            const [url, label] = item.split(/\s+-\s+/, 2);
            return { url: url.trim(), labelAr: label?.trim() || `مرفق ${index + 1}`, labelEn: label?.trim() || `Link ${index + 1}` };
        }).filter(link => /^https?:\/\//i.test(link.url));
    }
}
