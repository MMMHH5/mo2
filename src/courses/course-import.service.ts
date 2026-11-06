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
const isAllowedAssetUrl = (value: string) => {
    if (/^https?:\/\//i.test(value)) {
        try {
            const url = new URL(value);
            return (url.protocol === 'http:' || url.protocol === 'https:') && Boolean(url.hostname);
        } catch {
            return false;
        }
    }
    return /^\/uploads\/(?!private(?:\/|$))(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9._/-]+$/i.test(value);
};

const FIELD_GUIDE: Record<string, string> = {
    CourseKey: 'مفتاح داخلي قصير وفريد للدورة، مثل CO-001. انسخه كما هو في كل صف تابع للدورة.',
    titleAr: 'عنوان الدورة بالعربية (مطلوب).',
    titleEn: 'عنوان الدورة بالإنجليزية (مطلوب).',
    excerptAr: 'ملخص عربي قصير يظهر في بطاقات الدورة. اختياري.',
    excerptEn: 'Short English summary shown on course cards. Optional.',
    categoryAr: 'اسم التصنيف بالعربية. اختياري.',
    categoryEn: 'Category name in English. Optional.',
    level: 'المستوى: BEGINNER أو INTERMEDIATE أو ADVANCED أو ALL_LEVELS. اتركه فارغاً للمستوى الافتراضي.',
    contentType: 'نوع المحتوى (مطلوب): LIVE للمباشر أو RECORDED للمسجل.',
    language: 'لغة تقديم الدورة كنص، مثل العربية أو English أو Bilingual. اختياري.',
    hoursOfContent: 'إجمالي ساعات المحتوى كرقم. اختياري.',
    durationAr: 'المدة المعروضة بالعربية، مثل ٨ أسابيع. اختياري.',
    durationEn: 'المدة المعروضة بالإنجليزية، مثل 8 weeks. اختياري.',
    syllabusAr: 'المنهج أو خطة الدورة بالعربية. اختياري.',
    syllabusEn: 'Course syllabus in English. Optional.',
    coverImageUrl: 'رابط صورة الغلاف أو مسار ملف مرفوع يبدأ بـ /uploads/. اتركه فارغاً إن لم يوجد.',
    introVideoUrl: 'رابط فيديو تعريفي http/https. اختياري.',
    videoFileUrl: 'رابط أو مسار فيديو الدورة المرفوع. يقبل http/https أو /uploads/. اختياري.',
    certificateIssued: 'هل تصدر شهادة؟ TRUE أو FALSE. الفراغ يعني FALSE.',
    quizzesIncluded: 'هل تتضمن الدورة اختبارات؟ TRUE أو FALSE. الفراغ يعني FALSE.',
    projectsIncluded: 'هل تتضمن الدورة مشاريع؟ TRUE أو FALSE. الفراغ يعني FALSE.',
    assignmentsIncluded: 'هل تتضمن واجبات؟ TRUE أو FALSE. الفراغ يعني FALSE.',
    liveSessionsIncluded: 'هل تتضمن لقاءات مباشرة؟ TRUE أو FALSE. الفراغ يعني FALSE.',
    downloadableResources: 'هل تتضمن ملفات قابلة للتنزيل؟ TRUE أو FALSE. الفراغ يعني FALSE.',
    lifetimeAccess: 'هل الوصول مدى الحياة؟ TRUE أو FALSE. الفراغ يعني FALSE.',
    communityAccess: 'هل تتضمن مجتمعاً؟ TRUE أو FALSE. الفراغ يعني FALSE.',
    chapterKey: 'مفتاح فصل فريد داخل الدورة، مثل CH-001. استخدمه لربط الدروس بهذا الفصل.',
    lessonKey: 'مفتاح درس فريد داخل الفصل، مثل LE-001. يلزم لربط مخرجات الدرس.',
    orderIndex: 'ترتيب العنصر، يبدأ من 0. يمكن تركه فارغاً ليُستخدم ترتيب الصف.',
    url: 'رابط http/https أو مسار ملف مرفوع يبدأ بـ /uploads/.',
    altAr: 'وصف بديل للصورة بالعربية لتحسين الوصول. اختياري.',
    altEn: 'English image alternative text for accessibility. Optional.',
    descriptionAr: 'الوصف بالعربية. اختياري للدورة والدرس؛ مطلوب بالعربية والإنجليزية عند إضافة نتيجة تعلم.',
    descriptionEn: 'Description in English. Optional for course/lesson descriptions; learning outcomes require both languages.',
    objectiveAr: 'هدف تعلم بالعربية. أضف صفاً لكل هدف.',
    objectiveEn: 'Learning objective in English. One row per objective.',
    prerequisiteAr: 'متطلب سابق بالعربية. أضف صفاً لكل متطلب.',
    prerequisiteEn: 'Prerequisite in English. One row per prerequisite.',
    audienceAr: 'الفئة المستهدفة بالعربية. أضف صفاً لكل فئة.',
    audienceEn: 'Target audience in English. One row per audience.',
    questionAr: 'السؤال الشائع بالعربية.',
    questionEn: 'FAQ question in English.',
    answerAr: 'إجابة السؤال بالعربية.',
    answerEn: 'FAQ answer in English.',
    videoUrl: 'رابط فيديو الدرس أو مسار ملف مرفوع يبدأ بـ /uploads/.',
    durationMinutes: 'مدة الدرس بالدقائق كرقم صحيح (0 أو أكثر).',
    links: 'رابط واحد بكل سطر، بصيغة: URL | الاسم بالعربية | English label. يقبل http/https أو /uploads/.',
    files: 'ملف واحد بكل سطر، بصيغة: URL | الاسم بالعربية | English name. يقبل http/https أو /uploads/.',
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
        guide.addRow(['نطاق القالب', 'هذا القالب ينشئ محتوى الدورة فقط. لا ينشئ دفعات أو أسعاراً أو مواعيد أو تسجيلات؛ أضفها من إدارة الدورات بعد الاستيراد.']);
        guide.addRow(['ابدأ من هنا', 'أدخل كل دورة مرة واحدة في ورقة Courses. الصفوف في بقية الأوراق اختيارية؛ لا تضف إلا البيانات التي تحتاجها.']);
        guide.addRow(['صفوف الإدخال', 'أوراق الإدخال فارغة عمداً حتى لا تُستورد أمثلة على أنها دورات حقيقية. ابدأ من الصف 2، وكل صف مكتمل يُعامل كبيانات فعلية.']);
        guide.addRow(['أسماء الأعمدة', 'لا تغيّر أسماء الأعمدة أو ترتيبها؛ يستخدم الاستيراد هذه الأسماء والترتيب لقراءة البيانات. اضغط على عنوان العمود لعرض شرحه بالعربية.']);
        guide.addRow(['CourseKey', 'معرّف قصير وفريد لكل دورة مثل CO-001. اكتبه في Courses ثم انسخه حرفياً في كل صف تابع لها.']);
        guide.addRow(['الحقول المطلوبة', 'في Courses: CourseKey والعنوان بالعربية والعنوان بالإنجليزية ونوع المحتوى. الحقول الأخرى اختيارية ما لم تكن تضيف عنصراً مترجماً.']);
        guide.addRow(['طريقة تنظيم التفاصيل', 'صف واحد لكل هدف أو متطلب أو فئة أو سؤال أو صورة أو فصل. اربط كل صف بالدورة عبر CourseKey.']);
        guide.addRow(['الفصول والدروس', 'أدخل الفصل في Chapters مع chapterKey، ثم أضف دروسه في Lessons باستخدام CourseKey نفسه وchapterKey نفسه.']);
        guide.addRow(['مخرجات الدرس', 'أدخل النتيجة في LessonOutcomes واربطها بالمفاتيح الثلاثة المطابقة: CourseKey وchapterKey وlessonKey.']);
        guide.addRow(['الترتيب', 'orderIndex يبدأ من 0. اتركه فارغاً إذا كان ترتيب الصفوف في الورقة مناسباً.']);
        guide.addRow(['نوع المحتوى', 'LIVE للدورة المباشرة أو RECORDED للمسجلة. الدرس المسجل يمكنه استخدام videoUrl؛ لا تضع فيديو درس في دورة LIVE.']);
        guide.addRow(['المستوى', 'BEGINNER أو INTERMEDIATE أو ADVANCED أو ALL_LEVELS.']);
        guide.addRow(['الميزات', 'استخدم TRUE أو FALSE. ترك الخانة فارغة يعني FALSE؛ لا توجد ميزات مفعلة تلقائياً.']);
        guide.addRow(['الوسائط', 'يمكن استخدام رابط http/https أو مسار ملف سبق رفعه يبدأ بـ /uploads/. ملف Excel لا يرفع الصور أو الفيديوهات نفسها.']);
        guide.addRow(['الروابط والملفات', 'كل عنصر في سطر مستقل بصيغة URL | الاسم بالعربية | الاسم بالإنجليزية. لا تستخدم الفاصلة المنقوطة داخل الرابط.']);
        guide.addRow(['الترجمات', 'عند إضافة عنوان أو هدف أو سؤال أو إجابة أو نتيجة تعلم، أدخل النصين العربي والإنجليزي.']);
        guide.addRow(['طريقة الرفع', 'استورد الملف بعد مراجعة البيانات. بعد إنشاء الدورة، أضف الدفعة والسعر والمواعيد والمدرّس من شاشة إدارة الدورة.']);

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
        const chapters = workbook.addWorksheet('Chapters', { views: [{ state: 'frozen', ySplit: 1, rightToLeft: true }] });
        chapters.columns = [
            { header: 'CourseKey', key: 'courseKey', width: 18 }, { header: 'chapterKey', key: 'chapterKey', width: 18 },
            { header: 'titleAr', key: 'titleAr', width: 32 }, { header: 'titleEn', key: 'titleEn', width: 32 },
            { header: 'orderIndex', key: 'orderIndex', width: 14 },
        ];

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

        const objectives = workbook.addWorksheet('Objectives', { views: [{ state: 'frozen', ySplit: 1, rightToLeft: true }] });
        objectives.columns = [{ header: 'CourseKey', key: 'courseKey', width: 18 }, { header: 'objectiveAr', key: 'objectiveAr', width: 45 }, { header: 'objectiveEn', key: 'objectiveEn', width: 45 }, { header: 'orderIndex', key: 'orderIndex', width: 14 }];

        const prerequisites = workbook.addWorksheet('Prerequisites', { views: [{ state: 'frozen', ySplit: 1, rightToLeft: true }] });
        prerequisites.columns = [{ header: 'CourseKey', key: 'courseKey', width: 18 }, { header: 'prerequisiteAr', key: 'prerequisiteAr', width: 45 }, { header: 'prerequisiteEn', key: 'prerequisiteEn', width: 45 }, { header: 'orderIndex', key: 'orderIndex', width: 14 }];

        const audiences = workbook.addWorksheet('Audiences', { views: [{ state: 'frozen', ySplit: 1, rightToLeft: true }] });
        audiences.columns = [{ header: 'CourseKey', key: 'courseKey', width: 18 }, { header: 'audienceAr', key: 'audienceAr', width: 45 }, { header: 'audienceEn', key: 'audienceEn', width: 45 }, { header: 'orderIndex', key: 'orderIndex', width: 14 }];

        const faqs = workbook.addWorksheet('FAQs', { views: [{ state: 'frozen', ySplit: 1, rightToLeft: true }] });
        faqs.columns = [{ header: 'CourseKey', key: 'courseKey', width: 18 }, { header: 'questionAr', key: 'questionAr', width: 45 }, { header: 'questionEn', key: 'questionEn', width: 45 }, { header: 'answerAr', key: 'answerAr', width: 55 }, { header: 'answerEn', key: 'answerEn', width: 55 }, { header: 'orderIndex', key: 'orderIndex', width: 14 }];

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

        for (const sheet of [courses, chapters, lessons, objectives, prerequisites, audiences, faqs, gallery, lessonOutcomes]) {
            sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
            sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF17365D' } };
            sheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };
            sheet.getRow(1).height = 24;
            sheet.views = [{ state: 'frozen', xSplit: sheet.name === 'Courses' ? 3 : 1, ySplit: 1, rightToLeft: true, zoomScale: 85 }];
            const sheetFieldGuide: Record<string, Record<string, string>> = {
                Chapters: {
                    titleAr: 'عنوان الفصل بالعربية (مطلوب).',
                    titleEn: 'Chapter title in English (required).',
                },
                Lessons: {
                    titleAr: 'عنوان الدرس بالعربية (مطلوب).',
                    titleEn: 'Lesson title in English (required).',
                },
                LessonOutcomes: {
                    descriptionAr: 'مخرج التعلم بالعربية (مطلوب).',
                    descriptionEn: 'Learning outcome in English (required).',
                },
            };
            sheet.getRow(1).eachCell((cell) => {
                const description = sheetFieldGuide[sheet.name]?.[String(cell.value)] ?? FIELD_GUIDE[String(cell.value)];
                if (description) cell.note = description;
            });
            const colLetter = sheet.getColumn(sheet.columnCount).letter;
            sheet.autoFilter = { from: 'A1', to: `${colLetter}${Math.max(sheet.rowCount, 2)}` };
            sheet.eachRow((row, rowNumber) => {
                if (rowNumber > 1) row.alignment = { vertical: 'top', wrapText: true };
            });
        }
        for (let row = 2; row <= 500; row += 1) {
            courses.getCell(row, 10).dataValidation = { type: 'list', allowBlank: true, formulae: ['"BEGINNER,INTERMEDIATE,ADVANCED,ALL_LEVELS"'] };
            courses.getCell(row, 11).dataValidation = { type: 'list', allowBlank: true, formulae: ['"LIVE,RECORDED"'] };
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
        const importedCourseKeys = new Set<string>();
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
            const hasData = Array.from({ length: coursesSheet.columnCount }, (_, column) => row.getCell(column + 1).value)
                .some(value => TEXT(value) !== '');
            if (!hasData) continue;
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
            for (const field of ['coverImageUrl', 'introVideoUrl', 'videoFileUrl'] as const) {
                const column = {
                    coverImageUrl: 18,
                    introVideoUrl: 19,
                    videoFileUrl: 20,
                }[field];
                const url = TEXT(row.getCell(column).value);
                if (url && !isAllowedAssetUrl(url)) errors.push(`Courses:${line}: ${field} يجب أن يكون رابط http/https أو مسار /uploads/ صالحاً`);
            }
            const chapters = ch.map((c, chapterIndex) => {
                const chapterKey = TEXT(c.chapterKey);
                const lessons = lessonRows.filter(l => TEXT(l.CourseKey) === key && TEXT(l.chapterKey) === chapterKey);
                lessons.forEach((lesson, lessonIndex) => {
                    if (TEXT(lesson.videoUrl) && !isAllowedAssetUrl(TEXT(lesson.videoUrl))) {
                        errors.push(`Lessons:${lessonIndex + 2}: رابط الفيديو غير صالح`);
                    }
                    if (TEXT(lesson.files)) this.validateDelimitedAssetUrls(TEXT(lesson.files), `Lessons:${lessonIndex + 2}: files`, errors);
                    if (TEXT(lesson.links)) this.validateDelimitedAssetUrls(TEXT(lesson.links), `Lessons:${lessonIndex + 2}: links`, errors, true);
                });
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
                })).filter(r => {
                    if (!isAllowedAssetUrl(r.url)) {
                        errors.push(`Gallery: رابط الصورة غير صالح للدورة ${key}: ${r.url}`);
                        return false;
                    }
                    return true;
                }) as any,
                chapters: chapters.map(({ chapterKey: _chapterKey, ...chapter }) => chapter) as any,
            });
            importedCourseKeys.add(key);
        }
        for (const [sheetName, rows] of [
            ['Chapters', chapterRows], ['Lessons', lessonRows], ['LessonOutcomes', lessonOutcomeRows],
            ['Objectives', objectiveRows], ['Prerequisites', prerequisiteRows], ['Audiences', audienceRows],
            ['FAQs', faqRows], ['Gallery', galleryRows],
        ] as const) {
            rows.forEach((row, index) => {
                const key = TEXT(row.CourseKey);
                if (!key || !importedCourseKeys.has(key)) {
                    errors.push(`${sheetName}:${index + 2}: CourseKey مفقود أو لا يطابق دورة في ورقة Courses`);
                }
            });
        }
        const validChapterKeys = new Set<string>();
        chapterRows.forEach((row, index) => {
            const courseKey = TEXT(row.CourseKey);
            const chapterKey = TEXT(row.chapterKey);
            if (!importedCourseKeys.has(courseKey)) return;
            if (!chapterKey) errors.push(`Chapters:${index + 2}: chapterKey مطلوب`);
            if (!TEXT(row.titleAr) || !TEXT(row.titleEn)) errors.push(`Chapters:${index + 2}: عنوان الفصل بالعربية والإنجليزية مطلوب`);
            if (chapterKey) validChapterKeys.add(`${courseKey}\u0000${chapterKey}`);
        });
        const validLessonKeys = new Set<string>();
        lessonRows.forEach((row, index) => {
            const courseKey = TEXT(row.CourseKey);
            const chapterKey = TEXT(row.chapterKey);
            const lessonKey = TEXT(row.lessonKey);
            if (!importedCourseKeys.has(courseKey)) return;
            if (!validChapterKeys.has(`${courseKey}\u0000${chapterKey}`)) {
                errors.push(`Lessons:${index + 2}: chapterKey لا يطابق فصلاً في ورقة Chapters`);
            }
            if (!lessonKey) errors.push(`Lessons:${index + 2}: lessonKey مطلوب`);
            if (!TEXT(row.titleAr) || !TEXT(row.titleEn)) errors.push(`Lessons:${index + 2}: عنوان الدرس بالعربية والإنجليزية مطلوب`);
            if (lessonKey) validLessonKeys.add(`${courseKey}\u0000${chapterKey}\u0000${lessonKey}`);
        });
        lessonOutcomeRows.forEach((row, index) => {
            const lessonKey = `${TEXT(row.CourseKey)}\u0000${TEXT(row.chapterKey)}\u0000${TEXT(row.lessonKey)}`;
            if (!validLessonKeys.has(lessonKey)) errors.push(`LessonOutcomes:${index + 2}: مفاتيح الدورة والفصل والدرس لا تطابق درساً موجوداً`);
            if (!TEXT(row.descriptionAr) || !TEXT(row.descriptionEn)) {
                errors.push(`LessonOutcomes:${index + 2}: نتيجة التعلم بالعربية والإنجليزية مطلوبة`);
            }
        });
        for (const [sheetName, rows, arabicField, englishField] of [
            ['Objectives', objectiveRows, 'objectiveAr', 'objectiveEn'],
            ['Prerequisites', prerequisiteRows, 'prerequisiteAr', 'prerequisiteEn'],
            ['Audiences', audienceRows, 'audienceAr', 'audienceEn'],
        ] as const) {
            rows.forEach((row, index) => {
                if (!importedCourseKeys.has(TEXT(row.CourseKey))) return;
                if (!TEXT(row[arabicField]) || !TEXT(row[englishField])) {
                    errors.push(`${sheetName}:${index + 2}: يجب إدخال النص بالعربية والإنجليزية`);
                }
            });
        }
        faqRows.forEach((row, index) => {
            if (!importedCourseKeys.has(TEXT(row.CourseKey))) return;
            if (!TEXT(row.questionAr) || !TEXT(row.questionEn) || !TEXT(row.answerAr) || !TEXT(row.answerEn)) {
                errors.push(`FAQs:${index + 2}: السؤال والإجابة بالعربية والإنجليزية مطلوبة`);
            }
        });
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
        }).filter(file => isAllowedAssetUrl(file.url));
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
        }).filter(link => isAllowedAssetUrl(link.url));
    }

    private validateDelimitedAssetUrls(value: string, location: string, errors: string[], allowLegacyLinks = false) {
        const items = value.split(/\n|;/).map(item => item.trim()).filter(Boolean);
        for (const item of items) {
            const url = item.includes('|')
                ? item.split('|', 1)[0].trim()
                : allowLegacyLinks
                    ? item.split(/\s+-\s+/, 1)[0].trim()
                    : item.trim();
            if (!isAllowedAssetUrl(url)) errors.push(`${location}: رابط الملف غير صالح (${url})`);
        }
    }
}
