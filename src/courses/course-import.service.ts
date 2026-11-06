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

const SHEET_NAMES: Record<string, string> = {
    Instructions: 'ابدأ هنا',
    Courses: 'بيانات الدورة',
    Chapters: 'الفصول',
    Lessons: 'الدروس',
    Objectives: 'أهداف التعلم',
    Prerequisites: 'المتطلبات',
    Audiences: 'الفئة المستهدفة',
    FAQs: 'الأسئلة الشائعة',
    Gallery: 'الصور',
    LessonOutcomes: 'مخرجات الدروس',
};

const FIELD_LABELS: Record<string, string> = {
    CourseKey: 'مفتاح الدورة (للربط بين الأوراق)',
    chapterKey: 'مفتاح الفصل',
    lessonKey: 'مفتاح الدرس',
    titleAr: 'العنوان بالعربية',
    titleEn: 'العنوان بالإنجليزية',
    excerptAr: 'نبذة قصيرة بالعربية',
    excerptEn: 'نبذة قصيرة بالإنجليزية',
    descriptionAr: 'الوصف بالعربية',
    descriptionEn: 'الوصف بالإنجليزية',
    categoryAr: 'التصنيف بالعربية',
    categoryEn: 'التصنيف بالإنجليزية',
    level: 'مستوى الدورة',
    contentType: 'نوع المحتوى',
    language: 'لغة الدورة',
    hoursOfContent: 'ساعات المحتوى',
    durationAr: 'المدة بالعربية',
    durationEn: 'المدة بالإنجليزية',
    syllabusAr: 'المنهج بالعربية',
    syllabusEn: 'المنهج بالإنجليزية',
    coverImageUrl: 'رابط صورة الغلاف',
    introVideoUrl: 'رابط الفيديو التعريفي',
    videoFileUrl: 'رابط ملف فيديو الدورة',
    certificateIssued: 'إصدار شهادة؟',
    quizzesIncluded: 'تتضمن اختبارات؟',
    projectsIncluded: 'تتضمن مشاريع؟',
    assignmentsIncluded: 'تتضمن واجبات؟',
    liveSessionsIncluded: 'تتضمن لقاءات مباشرة؟',
    downloadableResources: 'تتضمن ملفات للتنزيل؟',
    lifetimeAccess: 'الوصول مدى الحياة؟',
    communityAccess: 'تتضمن مجتمعًا؟',
    orderIndex: 'الترتيب (يبدأ من 0)',
    objectiveAr: 'الهدف بالعربية',
    objectiveEn: 'الهدف بالإنجليزية',
    prerequisiteAr: 'المتطلب بالعربية',
    prerequisiteEn: 'المتطلب بالإنجليزية',
    audienceAr: 'الفئة بالعربية',
    audienceEn: 'الفئة بالإنجليزية',
    questionAr: 'السؤال بالعربية',
    questionEn: 'السؤال بالإنجليزية',
    answerAr: 'الإجابة بالعربية',
    answerEn: 'الإجابة بالإنجليزية',
    url: 'رابط الصورة أو الملف',
    altAr: 'وصف الصورة بالعربية',
    altEn: 'وصف الصورة بالإنجليزية',
    videoUrl: 'رابط فيديو الدرس',
    durationMinutes: 'مدة الدرس بالدقائق',
    links: 'روابط الدرس',
    files: 'ملفات الدرس',
};

const REQUIRED_FIELDS: Record<string, Set<string>> = {
    Courses: new Set(['CourseKey', 'titleAr', 'titleEn', 'contentType']),
    Chapters: new Set(['CourseKey', 'chapterKey', 'titleAr', 'titleEn']),
    Lessons: new Set(['CourseKey', 'chapterKey', 'lessonKey', 'titleAr', 'titleEn']),
    Objectives: new Set(['CourseKey', 'objectiveAr', 'objectiveEn']),
    Prerequisites: new Set(['CourseKey', 'prerequisiteAr', 'prerequisiteEn']),
    Audiences: new Set(['CourseKey', 'audienceAr', 'audienceEn']),
    FAQs: new Set(['CourseKey', 'questionAr', 'questionEn', 'answerAr', 'answerEn']),
    Gallery: new Set(['CourseKey', 'url']),
    LessonOutcomes: new Set(['CourseKey', 'chapterKey', 'lessonKey', 'descriptionAr', 'descriptionEn']),
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
        const guide = workbook.addWorksheet(SHEET_NAMES.Instructions, { views: [{ rightToLeft: true }] });
        guide.columns = [{ width: 36 }, { width: 105 }];
        guide.addRow(['الخطوة', 'ماذا تفعل؟']);
        guide.addRow(['1. معلومات الدورة', 'افتح ورقة «بيانات الدورة» واملأ صفاً واحداً لكل دورة. الحقول الإلزامية موضحة بعلامة * وباللون الذهبي.']);
        guide.addRow(['2. تفاصيل إضافية', 'أكمل الأوراق التي تحتاجها فقط: الأهداف، المتطلبات، الفئة المستهدفة، الأسئلة الشائعة، الصور، الفصول، الدروس ومخرجاتها.']);
        guide.addRow(['3. اربط البيانات', 'انسخ «مفتاح الدورة» نفسه في كل صف يتبع الدورة. للدروس استخدم مفتاح الفصل، ولمخرجات الدرس استخدم مفاتيح الدورة والفصل والدرس.']);
        guide.addRow(['4. ابدأ التعبئة من الصف الثالث', 'الصف الثاني يوضح أسماء الخانات بالعربية. اكتب بياناتك في الخانات الصفراء ابتداءً من الصف 3، وصف واحد لكل عنصر.']);
        guide.addRow(['5. راجع ثم استورد', 'احفظ الملف بصيغة XLSX ثم اختر «استيراد دورات». لا تغيّر ترتيب الأعمدة أو أسماء الأوراق.']);
        guide.addRow(['ماذا تعني الألوان؟', 'الأصفر الفاتح خانات إدخال. الذهبي يدل على حقل مطلوب. رؤوس الأعمدة بالعربية، ويمكن تحديد الاختيارات من القوائم المنسدلة.']);
        guide.addRow(['حقول الدورة المطلوبة', 'مفتاح الدورة، العنوان بالعربية، العنوان بالإنجليزية، ونوع المحتوى. أدخل النصين العربي والإنجليزي للعناوين والحقول الثنائية.']);
        guide.addRow(['مفتاح الدورة', 'اكتب معرّفاً قصيراً وفريداً مثل CO-001 في ورقة «بيانات الدورة»، وانسخه كما هو في كل ورقة أخرى تخصها.']);
        guide.addRow(['الفصول والدروس', 'أضف كل فصل كسطر في «الفصول» مع مفتاح مثل CH-001. أضف الدروس في «الدروس» مع مفتاح الفصل نفسه ومفتاح درس مثل LE-001.']);
        guide.addRow(['الصفوف المتكررة', 'كل صف يعني عنصراً واحداً: هدفاً أو متطلباً أو فئة أو سؤالاً أو صورة أو فصلاً أو درساً. اترك الصف فارغاً إن لم تكن تحتاج العنصر.']);
        guide.addRow(['المستوى ونوع المحتوى', 'المستوى: BEGINNER أو INTERMEDIATE أو ADVANCED أو ALL_LEVELS. نوع المحتوى: LIVE للمباشر أو RECORDED للمسجل.']);
        guide.addRow(['الميزات', 'اختر TRUE أو FALSE من القائمة. ترك الخانة فارغة يعامل على أنه FALSE.']);
        guide.addRow(['الصور والملفات', 'أدخل رابط http/https أو مسار ملف سبق رفعه يبدأ بـ /uploads/. هذا القالب لا يرفع الملفات نفسها.']);
        guide.addRow(['روابط وملفات الدرس', 'كل عنصر في سطر مستقل بالصيغة: الرابط | الاسم بالعربية | الاسم بالإنجليزية.']);
        guide.addRow(['الدفعات والتسجيل', 'القالب مخصص لمحتوى الدورة. بعد إنشائها أضف الدفعة والسعر والمواعيد والمدرّس من إدارة الدورات.']);

        const courses = workbook.addWorksheet(SHEET_NAMES.Courses, { views: [{ state: 'frozen', ySplit: 2, rightToLeft: true }] });
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
        const chapters = workbook.addWorksheet(SHEET_NAMES.Chapters, { views: [{ state: 'frozen', ySplit: 2, rightToLeft: true }] });
        chapters.columns = [
            { header: 'CourseKey', key: 'courseKey', width: 18 }, { header: 'chapterKey', key: 'chapterKey', width: 18 },
            { header: 'titleAr', key: 'titleAr', width: 32 }, { header: 'titleEn', key: 'titleEn', width: 32 },
            { header: 'orderIndex', key: 'orderIndex', width: 14 },
        ];

        const lessons = workbook.addWorksheet(SHEET_NAMES.Lessons, { views: [{ state: 'frozen', ySplit: 2, rightToLeft: true }] });
        lessons.columns = [
            { header: 'CourseKey', key: 'courseKey', width: 18 }, { header: 'chapterKey', key: 'chapterKey', width: 18 },
            { header: 'lessonKey', key: 'lessonKey', width: 18 },
            { header: 'titleAr', key: 'titleAr', width: 32 }, { header: 'titleEn', key: 'titleEn', width: 32 },
            { header: 'descriptionAr', key: 'descriptionAr', width: 44 }, { header: 'descriptionEn', key: 'descriptionEn', width: 44 },
            { header: 'videoUrl', key: 'videoUrl', width: 36 }, { header: 'orderIndex', key: 'orderIndex', width: 14 },
            { header: 'durationMinutes', key: 'durationMinutes', width: 18 }, { header: 'links', key: 'links', width: 50 },
            { header: 'files', key: 'files', width: 70 },
        ];

        const objectives = workbook.addWorksheet(SHEET_NAMES.Objectives, { views: [{ state: 'frozen', ySplit: 2, rightToLeft: true }] });
        objectives.columns = [{ header: 'CourseKey', key: 'courseKey', width: 18 }, { header: 'objectiveAr', key: 'objectiveAr', width: 45 }, { header: 'objectiveEn', key: 'objectiveEn', width: 45 }, { header: 'orderIndex', key: 'orderIndex', width: 14 }];

        const prerequisites = workbook.addWorksheet(SHEET_NAMES.Prerequisites, { views: [{ state: 'frozen', ySplit: 2, rightToLeft: true }] });
        prerequisites.columns = [{ header: 'CourseKey', key: 'courseKey', width: 18 }, { header: 'prerequisiteAr', key: 'prerequisiteAr', width: 45 }, { header: 'prerequisiteEn', key: 'prerequisiteEn', width: 45 }, { header: 'orderIndex', key: 'orderIndex', width: 14 }];

        const audiences = workbook.addWorksheet(SHEET_NAMES.Audiences, { views: [{ state: 'frozen', ySplit: 2, rightToLeft: true }] });
        audiences.columns = [{ header: 'CourseKey', key: 'courseKey', width: 18 }, { header: 'audienceAr', key: 'audienceAr', width: 45 }, { header: 'audienceEn', key: 'audienceEn', width: 45 }, { header: 'orderIndex', key: 'orderIndex', width: 14 }];

        const faqs = workbook.addWorksheet(SHEET_NAMES.FAQs, { views: [{ state: 'frozen', ySplit: 2, rightToLeft: true }] });
        faqs.columns = [{ header: 'CourseKey', key: 'courseKey', width: 18 }, { header: 'questionAr', key: 'questionAr', width: 45 }, { header: 'questionEn', key: 'questionEn', width: 45 }, { header: 'answerAr', key: 'answerAr', width: 55 }, { header: 'answerEn', key: 'answerEn', width: 55 }, { header: 'orderIndex', key: 'orderIndex', width: 14 }];

        const gallery = workbook.addWorksheet(SHEET_NAMES.Gallery, { views: [{ state: 'frozen', ySplit: 2, rightToLeft: true }] });
        gallery.columns = [
            { header: 'CourseKey', key: 'courseKey', width: 18 },
            { header: 'url', key: 'url', width: 55 },
            { header: 'altAr', key: 'altAr', width: 38 },
            { header: 'altEn', key: 'altEn', width: 38 },
            { header: 'orderIndex', key: 'orderIndex', width: 14 },
        ];

        const lessonOutcomes = workbook.addWorksheet(SHEET_NAMES.LessonOutcomes, { views: [{ state: 'frozen', ySplit: 2, rightToLeft: true }] });
        lessonOutcomes.columns = [{ header: 'CourseKey', key: 'courseKey', width: 18 }, { header: 'chapterKey', key: 'chapterKey', width: 18 }, { header: 'lessonKey', key: 'lessonKey', width: 18 }, { header: 'descriptionAr', key: 'descriptionAr', width: 45 }, { header: 'descriptionEn', key: 'descriptionEn', width: 45 }, { header: 'orderIndex', key: 'orderIndex', width: 14 }];

        for (const sheet of [courses, chapters, lessons, objectives, prerequisites, audiences, faqs, gallery, lessonOutcomes]) {
            const internalName = Object.keys(SHEET_NAMES).find(name => SHEET_NAMES[name] === sheet.name)!;
            const internalHeaders = sheet.getRow(1).values as unknown[];
            const visibleHeaders = sheet.getRow(2);
            visibleHeaders.values = internalHeaders.slice(1).map(header => {
                const key = String(header);
                const label = FIELD_LABELS[key] ?? key;
                return REQUIRED_FIELDS[internalName]?.has(key) ? `${label} *` : label;
            });
            sheet.getRow(1).hidden = true;
            visibleHeaders.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
            visibleHeaders.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF17365D' } };
            visibleHeaders.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
            visibleHeaders.height = 42;
            sheet.views = [{ state: 'frozen', xSplit: internalName === 'Courses' ? 3 : 1, ySplit: 2, rightToLeft: true, zoomScale: 85 }];
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
                const description = sheetFieldGuide[internalName]?.[String(cell.value)] ?? FIELD_GUIDE[String(cell.value)];
                if (!description) return;
                const visibleCell = visibleHeaders.getCell(cell.col);
                visibleCell.note = description;
                if (REQUIRED_FIELDS[internalName]?.has(String(cell.value))) {
                    visibleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFB8860B' } };
                }
            });
            const colLetter = sheet.getColumn(sheet.columnCount).letter;
            sheet.autoFilter = { from: 'A2', to: `${colLetter}52` };
            for (let rowNumber = 3; rowNumber <= 52; rowNumber += 1) {
                const row = sheet.getRow(rowNumber);
                row.height = 28;
                row.eachCell({ includeEmpty: true }, cell => {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowNumber % 2 ? 'FFFFFBEB' : 'FFFFFDF5' } };
                    cell.alignment = { vertical: 'top', wrapText: true };
                    cell.border = { bottom: { style: 'hair', color: { argb: 'FFE7DDBF' } } };
                });
            }
        }
        for (let row = 3; row <= 500; row += 1) {
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
            if (rowNumber > 1) {
                row.height = 34;
                row.alignment = { vertical: 'top', wrapText: true };
                row.getCell(1).font = { bold: true, color: { argb: 'FF17365D' } };
                row.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowNumber % 2 ? 'FFF3F6FA' : 'FFFFFFFF' } };
            }
        });
        return Buffer.from(await workbook.xlsx.writeBuffer());
    }

    async import(buffer: Buffer, instructorId: string) {
        let workbook: ExcelJS.Workbook;
        try { workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(buffer as any); }
        catch { throw new BadRequestException('ملف Excel غير صالح أو تالف.'); }
        const coursesSheet = this.getSheet(workbook, 'Courses');
        if (!coursesSheet) throw new BadRequestException('ورقة بيانات الدورة (Courses) مفقودة من القالب.');
        const firstCourseRow = this.firstDataRow(coursesSheet);
        const courseRows = coursesSheet.getRows(firstCourseRow, Math.max(0, coursesSheet.rowCount - firstCourseRow + 1)) ?? [];
        const parsedCourses: CreateCourseDto[] = [];
        const errors: string[] = [];
        const seenKeys = new Set<string>();
        const importedCourseKeys = new Set<string>();
        const chapterRows = this.rows(this.getSheet(workbook, 'Chapters'));
        const lessonRows = this.rows(this.getSheet(workbook, 'Lessons'));
        const lessonOutcomeRows = this.rows(this.getSheet(workbook, 'LessonOutcomes'));
        const objectiveRows = this.rows(this.getSheet(workbook, 'Objectives'));
        const prerequisiteRows = this.rows(this.getSheet(workbook, 'Prerequisites'));
        const audienceRows = this.rows(this.getSheet(workbook, 'Audiences'));
        const faqRows = this.rows(this.getSheet(workbook, 'FAQs'));
        const galleryRows = this.rows(this.getSheet(workbook, 'Gallery'));

        for (const [index, row] of courseRows.entries()) {
            const line = index + firstCourseRow;
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
                        errors.push(`Lessons:${this.rowNumber(lesson, lessonIndex)}: رابط الفيديو غير صالح`);
                    }
                    if (TEXT(lesson.files)) this.validateDelimitedAssetUrls(TEXT(lesson.files), `Lessons:${this.rowNumber(lesson, lessonIndex)}: files`, errors);
                    if (TEXT(lesson.links)) this.validateDelimitedAssetUrls(TEXT(lesson.links), `Lessons:${this.rowNumber(lesson, lessonIndex)}: links`, errors, true);
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
                    errors.push(`${sheetName}:${this.rowNumber(row, index)}: CourseKey مفقود أو لا يطابق دورة في ورقة Courses`);
                }
            });
        }
        const validChapterKeys = new Set<string>();
        chapterRows.forEach((row, index) => {
            const courseKey = TEXT(row.CourseKey);
            const chapterKey = TEXT(row.chapterKey);
            if (!importedCourseKeys.has(courseKey)) return;
            if (!chapterKey) errors.push(`Chapters:${this.rowNumber(row, index)}: chapterKey مطلوب`);
            if (!TEXT(row.titleAr) || !TEXT(row.titleEn)) errors.push(`Chapters:${this.rowNumber(row, index)}: عنوان الفصل بالعربية والإنجليزية مطلوب`);
            if (chapterKey) validChapterKeys.add(`${courseKey}\u0000${chapterKey}`);
        });
        const validLessonKeys = new Set<string>();
        lessonRows.forEach((row, index) => {
            const courseKey = TEXT(row.CourseKey);
            const chapterKey = TEXT(row.chapterKey);
            const lessonKey = TEXT(row.lessonKey);
            if (!importedCourseKeys.has(courseKey)) return;
            if (!validChapterKeys.has(`${courseKey}\u0000${chapterKey}`)) {
                errors.push(`Lessons:${this.rowNumber(row, index)}: chapterKey لا يطابق فصلاً في ورقة Chapters`);
            }
            if (!lessonKey) errors.push(`Lessons:${this.rowNumber(row, index)}: lessonKey مطلوب`);
            if (!TEXT(row.titleAr) || !TEXT(row.titleEn)) errors.push(`Lessons:${this.rowNumber(row, index)}: عنوان الدرس بالعربية والإنجليزية مطلوب`);
            if (lessonKey) validLessonKeys.add(`${courseKey}\u0000${chapterKey}\u0000${lessonKey}`);
        });
        lessonOutcomeRows.forEach((row, index) => {
            const lessonKey = `${TEXT(row.CourseKey)}\u0000${TEXT(row.chapterKey)}\u0000${TEXT(row.lessonKey)}`;
            if (!validLessonKeys.has(lessonKey)) errors.push(`LessonOutcomes:${this.rowNumber(row, index)}: مفاتيح الدورة والفصل والدرس لا تطابق درساً موجوداً`);
            if (!TEXT(row.descriptionAr) || !TEXT(row.descriptionEn)) {
                errors.push(`LessonOutcomes:${this.rowNumber(row, index)}: نتيجة التعلم بالعربية والإنجليزية مطلوبة`);
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
                    errors.push(`${sheetName}:${this.rowNumber(row, index)}: يجب إدخال النص بالعربية والإنجليزية`);
                }
            });
        }
        faqRows.forEach((row, index) => {
            if (!importedCourseKeys.has(TEXT(row.CourseKey))) return;
            if (!TEXT(row.questionAr) || !TEXT(row.questionEn) || !TEXT(row.answerAr) || !TEXT(row.answerEn)) {
                errors.push(`FAQs:${this.rowNumber(row, index)}: السؤال والإجابة بالعربية والإنجليزية مطلوبة`);
            }
        });
        if (!parsedCourses.length && !errors.length) errors.push('لا توجد دورات مكتملة في ورقة Courses.');
        if (errors.length) throw new BadRequestException({ message: 'تعذر استيراد ملف Excel.', errors });

        const created: { id: string; titleAr: string }[] = [];
        for (const course of parsedCourses) created.push(await this.coursesService.create(course, instructorId));
        return { imported: created.length, courses: created.map(c => ({ id: c.id, titleAr: c.titleAr })) };
    }

    private getSheet(workbook: ExcelJS.Workbook, internalName: string): ExcelJS.Worksheet | undefined {
        return workbook.getWorksheet(SHEET_NAMES[internalName]) ?? workbook.getWorksheet(internalName);
    }

    private firstDataRow(sheet: ExcelJS.Worksheet): number {
        return sheet.getRow(1).hidden ? 3 : 2;
    }

    private rows(sheet: ExcelJS.Worksheet | undefined): Record<string, unknown>[] {
        if (!sheet) return [];
        const headers = sheet.getRow(1).values as unknown[];
        const out: Record<string, unknown>[] = [];
        const firstDataRow = this.firstDataRow(sheet);
        sheet.eachRow((row, rowNumber) => {
            if (rowNumber < firstDataRow) return;
            const value: Record<string, unknown> = {};
            headers.slice(1).forEach((header, index) => { value[String(header)] = row.getCell(index + 1).value; });
            if (Object.values(value).some(v => String(v ?? '').trim())) {
                Object.defineProperty(value, '__excelRowNumber', { value: rowNumber });
                out.push(value);
            }
        });
        return out;
    }

    private rowNumber(row: Record<string, unknown>, index: number): number {
        return Number(row.__excelRowNumber ?? index + 2);
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
