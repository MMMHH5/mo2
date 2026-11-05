import { BadRequestException, Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { CourseContentType, CourseLevel } from '@prisma/client';
import { CoursesService } from './courses.service';
import { CreateCourseDto } from './dto/create-course.dto';

const TEXT = (value: unknown) => String(value ?? '').trim();
const BOOL = (value: unknown, fallback = false) => {
    const normalized = TEXT(value).toUpperCase();
    if (['TRUE', '1', 'YES', 'نعم'].includes(normalized)) return true;
    if (['FALSE', '0', 'NO', 'لا'].includes(normalized)) return false;
    return fallback;
};
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
        guide.columns = [{ width: 36 }, { width: 105 }];
        guide.addRow(['القاعدة', 'الشرح']);
        guide.addRow(['طريقة الاستخدام', 'عدّل صف المثال في كل ورقة ثم أضف صفوفاً أخرى عند الحاجة. لا تغيّر أسماء الأعمدة أو ترتيبها.']);
        guide.addRow(['CourseKey', 'استخدم معرفاً قصيراً فريداً لكل دورة مثل CO-001، وكرره كما هو في جميع أوراق الدورة.']);
        guide.addRow(['الحقول المطلوبة', 'العنوان العربي، العنوان الإنجليزي، ونوع المحتوى. أكمل الترجمات العربية والإنجليزية لكل عنصر تضيفه.']);
        guide.addRow(['نوع المحتوى', 'LIVE للدورات المباشرة أو RECORDED للدورات المسجلة']);
        guide.addRow(['المستوى', 'BEGINNER أو INTERMEDIATE أو ADVANCED أو ALL_LEVELS']);
        guide.addRow(['Courses', 'كل بيانات نموذج إنشاء الدورة: العناوين والملخص والوصف والتصنيف والمنهج والمدة والوسائط والميزات.']);
        guide.addRow(['Chapters و Lessons', 'أضف الفصول والدروس. يجب أن يطابق CourseKey و chapterKey في ورقة الدروس المفاتيح المعرفة هنا.']);
        guide.addRow(['Objectives / Prerequisites / Audiences', 'صف مستقل لكل هدف أو متطلب أو فئة، مع CourseKey والترجمتين والترتيب.']);
        guide.addRow(['FAQs', 'صف مستقل لكل سؤال. أكمل السؤال والإجابة باللغتين.']);
        guide.addRow(['LessonOutcomes', 'اربط النتيجة بـ CourseKey و chapterKey و lessonKey، واكتب الوصف باللغتين.']);
        guide.addRow(['Gallery', 'أضف رابط صورة لكل صف، مع نص بديل اختياري بالعربية والإنجليزية.']);
        guide.addRow(['الصور والفيديوهات', 'استخدم رابط URL عام مباشر أو رابطاً تم رفعه مسبقاً. لا يرفع ملف Excel الملفات الثنائية؛ يمكن رفع الوسائط لاحقاً من شاشة الدورة.']);
        guide.addRow(['روابط الدرس', 'اكتب كل رابط بصيغة URL | الاسم بالعربية | English label، وافصل عدة روابط بفاصلة منقوطة أو سطر جديد.']);
        guide.addRow(['ملفات الدرس', 'اكتب كل ملف بصيغة URL | الاسم بالعربية | English name. افصل الملفات بفاصلة منقوطة أو سطر جديد.']);
        guide.addRow(['الترتيب والميزات', 'الترتيب يبدأ من 0. استخدم TRUE أو FALSE لحقول الميزات.']);

        const courses = workbook.addWorksheet('Courses', { views: [{ state: 'frozen', ySplit: 1, rightToLeft: true }] });
        courses.columns = [
            { header: 'CourseKey', key: 'courseKey', width: 18 },
            { header: 'titleAr', key: 'titleAr', width: 32 }, { header: 'titleEn', key: 'titleEn', width: 32 },
            { header: 'excerptAr', key: 'excerptAr', width: 40 }, { header: 'excerptEn', key: 'excerptEn', width: 40 },
            { header: 'descriptionAr', key: 'descriptionAr', width: 48 }, { header: 'descriptionEn', key: 'descriptionEn', width: 48 },
            { header: 'categoryAr', key: 'categoryAr', width: 22 }, { header: 'categoryEn', key: 'categoryEn', width: 22 },
            { header: 'level', key: 'level', width: 18 }, { header: 'contentType', key: 'contentType', width: 18 },
            { header: 'language', key: 'language', width: 18 }, { header: 'hoursOfContent', key: 'hoursOfContent', width: 18 },
            { header: 'durationAr', key: 'durationAr', width: 20 }, { header: 'durationEn', key: 'durationEn', width: 20 },
            { header: 'syllabusAr', key: 'syllabusAr', width: 48 }, { header: 'syllabusEn', key: 'syllabusEn', width: 48 },
            { header: 'coverImageUrl', key: 'coverImageUrl', width: 36 }, { header: 'introVideoUrl', key: 'introVideoUrl', width: 36 },
            { header: 'videoFileUrl', key: 'videoFileUrl', width: 36 },
            { header: 'certificateIssued', key: 'certificateIssued', width: 18 }, { header: 'quizzesIncluded', key: 'quizzesIncluded', width: 18 },
            { header: 'projectsIncluded', key: 'projectsIncluded', width: 18 }, { header: 'assignmentsIncluded', key: 'assignmentsIncluded', width: 20 },
            { header: 'liveSessionsIncluded', key: 'liveSessionsIncluded', width: 20 }, { header: 'downloadableResources', key: 'downloadableResources', width: 22 },
            { header: 'lifetimeAccess', key: 'lifetimeAccess', width: 18 }, { header: 'communityAccess', key: 'communityAccess', width: 18 },
        ];
        courses.addRow({
            courseKey: 'CO-001', titleAr: 'عنوان الدورة', titleEn: 'Course title', excerptAr: 'ملخص قصير بالعربية', excerptEn: 'Short course summary',
            descriptionAr: 'وصف كامل للدورة بالعربية', descriptionEn: 'Complete English course description', categoryAr: 'البرمجة', categoryEn: 'Programming',
            level: 'BEGINNER', contentType: 'RECORDED', language: 'Bilingual', hoursOfContent: 10, durationAr: '10 ساعات', durationEn: '10 hours',
            syllabusAr: 'المنهج والمحتوى التفصيلي', syllabusEn: 'Detailed syllabus and content', coverImageUrl: '', introVideoUrl: '', videoFileUrl: '',
            certificateIssued: 'TRUE', quizzesIncluded: 'TRUE', projectsIncluded: 'TRUE', assignmentsIncluded: 'FALSE', liveSessionsIncluded: 'FALSE',
            downloadableResources: 'TRUE', lifetimeAccess: 'TRUE', communityAccess: 'TRUE',
        });

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
            { header: 'lessonKey', key: 'lessonKey', width: 18 },
            { header: 'titleAr', key: 'titleAr', width: 32 }, { header: 'titleEn', key: 'titleEn', width: 32 },
            { header: 'descriptionAr', key: 'descriptionAr', width: 44 }, { header: 'descriptionEn', key: 'descriptionEn', width: 44 },
            { header: 'videoUrl', key: 'videoUrl', width: 36 }, { header: 'orderIndex', key: 'orderIndex', width: 14 },
            { header: 'durationMinutes', key: 'durationMinutes', width: 18 }, { header: 'links', key: 'links', width: 50 },
            { header: 'files', key: 'files', width: 70 },
        ];
        lessons.addRow({ courseKey: 'CO-001', chapterKey: 'CH-001', lessonKey: 'LE-001', titleAr: 'الدرس الأول', titleEn: 'First lesson', videoUrl: '', orderIndex: 0, durationMinutes: 30, links: '', files: '' });

        const objectives = workbook.addWorksheet('Objectives', { views: [{ state: 'frozen', ySplit: 1, rightToLeft: true }] });
        objectives.columns = [{ header: 'CourseKey', key: 'courseKey', width: 18 }, { header: 'objectiveAr', key: 'objectiveAr', width: 45 }, { header: 'objectiveEn', key: 'objectiveEn', width: 45 }, { header: 'orderIndex', key: 'orderIndex', width: 14 }];
        objectives.addRow({ courseKey: 'CO-001', objectiveAr: 'فهم أساسيات الدورة', objectiveEn: 'Understand the course fundamentals', orderIndex: 0 });

        const prerequisites = workbook.addWorksheet('Prerequisites', { views: [{ state: 'frozen', ySplit: 1, rightToLeft: true }] });
        prerequisites.columns = [{ header: 'CourseKey', key: 'courseKey', width: 18 }, { header: 'prerequisiteAr', key: 'prerequisiteAr', width: 45 }, { header: 'prerequisiteEn', key: 'prerequisiteEn', width: 45 }, { header: 'orderIndex', key: 'orderIndex', width: 14 }];
        prerequisites.addRow({ courseKey: 'CO-001', prerequisiteAr: 'لا توجد متطلبات مسبقة', prerequisiteEn: 'No prior requirements', orderIndex: 0 });

        const audiences = workbook.addWorksheet('Audiences', { views: [{ state: 'frozen', ySplit: 1, rightToLeft: true }] });
        audiences.columns = [{ header: 'CourseKey', key: 'courseKey', width: 18 }, { header: 'audienceAr', key: 'audienceAr', width: 45 }, { header: 'audienceEn', key: 'audienceEn', width: 45 }, { header: 'orderIndex', key: 'orderIndex', width: 14 }];
        audiences.addRow({ courseKey: 'CO-001', audienceAr: 'المبتدئون والمهتمون بالمجال', audienceEn: 'Beginners and interested learners', orderIndex: 0 });

        const faqs = workbook.addWorksheet('FAQs', { views: [{ state: 'frozen', ySplit: 1, rightToLeft: true }] });
        faqs.columns = [{ header: 'CourseKey', key: 'courseKey', width: 18 }, { header: 'questionAr', key: 'questionAr', width: 45 }, { header: 'questionEn', key: 'questionEn', width: 45 }, { header: 'answerAr', key: 'answerAr', width: 55 }, { header: 'answerEn', key: 'answerEn', width: 55 }, { header: 'orderIndex', key: 'orderIndex', width: 14 }];
        faqs.addRow({ courseKey: 'CO-001', questionAr: 'هل يمكنني التسجيل؟', questionEn: 'Can I enroll?', answerAr: 'نعم، متاح التسجيل حسب فتحات الدورة.', answerEn: 'Yes, enrollment is available according to course openings.', orderIndex: 0 });

        const gallery = workbook.addWorksheet('Gallery', { views: [{ state: 'frozen', ySplit: 1, rightToLeft: true }] });
        gallery.columns = [
            { header: 'CourseKey', key: 'courseKey', width: 18 },
            { header: 'url', key: 'url', width: 55 },
            { header: 'altAr', key: 'altAr', width: 38 },
            { header: 'altEn', key: 'altEn', width: 38 },
            { header: 'orderIndex', key: 'orderIndex', width: 14 },
        ];

        const lessonOutcomes = workbook.addWorksheet('LessonOutcomes', { views: [{ state: 'frozen', ySplit: 1, rightToLeft: true }] });
        lessonOutcomes.columns = [{ header: 'CourseKey', key: 'courseKey', width: 18 }, { header: 'chapterKey', key: 'chapterKey', width: 18 }, { header: 'lessonKey', key: 'lessonKey', width: 18 }, { header: 'descriptionAr', key: 'descriptionAr', width: 45 }, { header: 'descriptionEn', key: 'descriptionEn', width: 45 }, { header: 'orderIndex', key: 'orderIndex', width: 14 }];
        lessonOutcomes.addRow({ courseKey: 'CO-001', chapterKey: 'CH-001', lessonKey: 'LE-001', descriptionAr: 'نتيجة التعلم للدرس', descriptionEn: 'Lesson learning outcome', orderIndex: 0 });

        for (const sheet of [courses, chapters, lessons, objectives, prerequisites, audiences, faqs, gallery, lessonOutcomes]) {
            sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
            sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF17365D' } };
            sheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };
            sheet.getRow(1).height = 24;
            sheet.views = [{ state: 'frozen', ySplit: 1, rightToLeft: true, zoomScale: 85 }];
            const colLetter = sheet.getColumn(sheet.columnCount).letter;
            sheet.autoFilter = { from: 'A1', to: `${colLetter}${Math.max(sheet.rowCount, 2)}` };
            sheet.eachRow((row, rowNumber) => {
                if (rowNumber > 1) row.alignment = { vertical: 'top', wrapText: true };
            });
        }
        for (let row = 2; row <= 500; row += 1) {
            courses.getCell(row, 10).dataValidation = { type: 'list', allowBlank: true, formulae: ['"BEGINNER,INTERMEDIATE,ADVANCED,ALL_LEVELS"'] };
            courses.getCell(row, 11).dataValidation = { type: 'list', allowBlank: false, formulae: ['"LIVE,RECORDED"'] };
            for (let column = 21; column <= 28; column += 1) {
                courses.getCell(row, column).dataValidation = { type: 'list', allowBlank: true, formulae: ['"TRUE,FALSE"'] };
            }
        }
        guide.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        guide.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF17365D' } };
        guide.getRow(1).height = 24;
        guide.eachRow((row, rowNumber) => {
            if (rowNumber > 1) row.alignment = { vertical: 'top', wrapText: true };
        });
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
        const lessonOutcomeRows = this.rows(workbook.getWorksheet('LessonOutcomes'));
        const objectiveRows = this.rows(workbook.getWorksheet('Objectives'));
        const prerequisiteRows = this.rows(workbook.getWorksheet('Prerequisites'));
        const audienceRows = this.rows(workbook.getWorksheet('Audiences'));
        const faqRows = this.rows(workbook.getWorksheet('FAQs'));
        const galleryRows = this.rows(workbook.getWorksheet('Gallery'));

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
                        files: this.parseFiles(TEXT(l.files)),
                        outcomes: lessonOutcomeRows.filter(o => TEXT(o.CourseKey) === key && TEXT(o.chapterKey) === chapterKey && TEXT(o.lessonKey) === TEXT(l.lessonKey)).map((o, i) => ({
                            descriptionAr: TEXT(o.descriptionAr), descriptionEn: TEXT(o.descriptionEn), orderIndex: NUM(o.orderIndex, i) ?? i,
                        })).filter(o => o.descriptionAr || o.descriptionEn),
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
                durationAr: TEXT(row.getCell(14).value) || undefined, durationEn: TEXT(row.getCell(15).value) || undefined,
                syllabusAr: TEXT(row.getCell(16).value) || undefined, syllabusEn: TEXT(row.getCell(17).value) || undefined,
                coverImageUrl: TEXT(row.getCell(18).value) || undefined, introVideoUrl: TEXT(row.getCell(19).value) || undefined,
                videoFileUrl: TEXT(row.getCell(20).value) || undefined,
                certificateIssued: BOOL(row.getCell(21).value), quizzesIncluded: BOOL(row.getCell(22).value),
                projectsIncluded: BOOL(row.getCell(23).value), assignmentsIncluded: BOOL(row.getCell(24).value),
                liveSessionsIncluded: BOOL(row.getCell(25).value), downloadableResources: BOOL(row.getCell(26).value),
                lifetimeAccess: BOOL(row.getCell(27).value), communityAccess: BOOL(row.getCell(28).value),
                objectives: objectiveRows.filter(r => TEXT(r.CourseKey) === key).map((r, i) => ({
                    objectiveAr: TEXT(r.objectiveAr), objectiveEn: TEXT(r.objectiveEn), orderIndex: NUM(r.orderIndex, i) ?? i,
                })).filter(r => r.objectiveAr || r.objectiveEn) as any,
                prerequisites: prerequisiteRows.filter(r => TEXT(r.CourseKey) === key).map((r, i) => ({
                    prerequisiteAr: TEXT(r.prerequisiteAr), prerequisiteEn: TEXT(r.prerequisiteEn), orderIndex: NUM(r.orderIndex, i) ?? i,
                })).filter(r => r.prerequisiteAr || r.prerequisiteEn) as any,
                audiences: audienceRows.filter(r => TEXT(r.CourseKey) === key).map((r, i) => ({
                    audienceAr: TEXT(r.audienceAr), audienceEn: TEXT(r.audienceEn), orderIndex: NUM(r.orderIndex, i) ?? i,
                })).filter(r => r.audienceAr || r.audienceEn) as any,
                faqs: faqRows.filter(r => TEXT(r.CourseKey) === key).map((r, i) => ({
                    questionAr: TEXT(r.questionAr), questionEn: TEXT(r.questionEn),
                    answerAr: TEXT(r.answerAr), answerEn: TEXT(r.answerEn), orderIndex: NUM(r.orderIndex, i) ?? i,
                })).filter(r => r.questionAr || r.questionEn || r.answerAr || r.answerEn) as any,
                gallery: galleryRows.filter(r => TEXT(r.CourseKey) === key).map((r, i) => ({
                    url: TEXT(r.url), altAr: TEXT(r.altAr) || undefined, altEn: TEXT(r.altEn) || undefined,
                    orderIndex: NUM(r.orderIndex, i) ?? i,
                })).filter(r => /^https?:\/\//i.test(r.url)) as any,
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

    private parseFiles(value: string) {
        if (!value) return undefined;
        return value.split(/\n|;/).map((item) => {
            const [url, nameAr, nameEn] = item.split('|').map(part => part.trim());
            return { url, nameAr: nameAr || '', nameEn: nameEn || '' };
        }).filter(file => /^https?:\/\//i.test(file.url));
    }

    private parseLinks(value: string) {
        if (!value) return undefined;
        return value.split(/\n|;/).map((item, index) => {
            const parts = item.split('|').map(part => part.trim());
            const [url, labelAr, labelEn] = parts;
            if (parts.length > 1) {
                return {
                    url,
                    labelAr: labelAr || `مرفق ${index + 1}`,
                    labelEn: labelEn || labelAr || `Link ${index + 1}`,
                };
            }
            const [legacyUrl, legacyLabel] = item.split(/\s+-\s+/, 2);
            return {
                url: legacyUrl.trim(),
                labelAr: legacyLabel?.trim() || `مرفق ${index + 1}`,
                labelEn: legacyLabel?.trim() || `Link ${index + 1}`,
            };
        }).filter(link => /^https?:\/\//i.test(link.url));
    }
}
