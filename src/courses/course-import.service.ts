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
type CourseImportRow = { getCell: (column: number) => { value: unknown } };

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
    Courses: 'نموذج الدورة',
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
    chapterTitleAr: 'عنوان الفصل المرتبط',
    lessonTitleAr: 'عنوان الدرس المرتبط',
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
    Courses: new Set(['titleAr', 'titleEn', 'contentType']),
    Chapters: new Set(['titleAr', 'titleEn']),
    Lessons: new Set(['chapterTitleAr', 'titleAr', 'titleEn']),
    Objectives: new Set(['objectiveAr', 'objectiveEn']),
    Prerequisites: new Set(['prerequisiteAr', 'prerequisiteEn']),
    Audiences: new Set(['audienceAr', 'audienceEn']),
    FAQs: new Set(['questionAr', 'questionEn', 'answerAr', 'answerEn']),
    Gallery: new Set(['url']),
    LessonOutcomes: new Set(['chapterTitleAr', 'lessonTitleAr', 'descriptionAr', 'descriptionEn']),
};

const COURSE_HEADERS = [
    'CourseKey', 'titleAr', 'titleEn', 'excerptAr', 'excerptEn', 'descriptionAr', 'descriptionEn',
    'categoryAr', 'categoryEn', 'level', 'contentType', 'language', 'hoursOfContent', 'durationAr',
    'durationEn', 'syllabusAr', 'syllabusEn', 'coverImageUrl', 'introVideoUrl', 'videoFileUrl',
    'certificateIssued', 'quizzesIncluded', 'projectsIncluded', 'assignmentsIncluded',
    'liveSessionsIncluded', 'downloadableResources', 'lifetimeAccess', 'communityAccess',
];

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
    chapterTitleAr: 'اكتب عنوان الفصل بالعربية كما أدخلته في ورقة الفصول لربط هذا العنصر به.',
    lessonTitleAr: 'اكتب عنوان الدرس بالعربية كما أدخلته في ورقة الدروس لربط مخرج التعلم به.',
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
        const courses = workbook.addWorksheet(SHEET_NAMES.Courses, { views: [{ state: 'frozen', ySplit: 1, rightToLeft: true }] });
        courses.columns = [
            { header: '__course_form_v1__', key: 'fieldKey', width: 24 },
            { header: 'القسم', key: 'section', width: 22 },
            { header: 'البيان المطلوب', key: 'label', width: 36 },
            { header: 'إلزامي؟', key: 'required', width: 14 },
            { header: 'اكتب بيانات الدورة هنا', key: 'value', width: 58 },
        ];
        courses.getCell(1, 1).value = '__course_form_v1__';
        courses.getColumn(1).hidden = true;
        const courseFields: { key: string; section: string; required?: boolean }[] = [
            { key: 'titleAr', section: 'العناوين', required: true },
            { key: 'titleEn', section: 'العناوين', required: true },
            { key: 'excerptAr', section: 'الوصف' },
            { key: 'excerptEn', section: 'الوصف' },
            { key: 'descriptionAr', section: 'الوصف' },
            { key: 'descriptionEn', section: 'الوصف' },
            { key: 'categoryAr', section: 'التصنيف' },
            { key: 'categoryEn', section: 'التصنيف' },
            { key: 'level', section: 'التصنيف' },
            { key: 'contentType', section: 'التصنيف', required: true },
            { key: 'language', section: 'التصنيف' },
            { key: 'hoursOfContent', section: 'المدة' },
            { key: 'durationAr', section: 'المدة' },
            { key: 'durationEn', section: 'المدة' },
            { key: 'syllabusAr', section: 'المنهج' },
            { key: 'syllabusEn', section: 'المنهج' },
            { key: 'coverImageUrl', section: 'الوسائط' },
            { key: 'introVideoUrl', section: 'الوسائط' },
            { key: 'videoFileUrl', section: 'الوسائط' },
            { key: 'certificateIssued', section: 'مميزات الدورة' },
            { key: 'quizzesIncluded', section: 'مميزات الدورة' },
            { key: 'projectsIncluded', section: 'مميزات الدورة' },
            { key: 'assignmentsIncluded', section: 'مميزات الدورة' },
            { key: 'liveSessionsIncluded', section: 'مميزات الدورة' },
            { key: 'downloadableResources', section: 'مميزات الدورة' },
            { key: 'lifetimeAccess', section: 'مميزات الدورة' },
            { key: 'communityAccess', section: 'مميزات الدورة' },
        ];
        for (const field of courseFields) {
            const row = courses.addRow([
                field.key,
                field.section,
                `${FIELD_LABELS[field.key]}${field.required ? ' *' : ''}`,
                field.required ? 'نعم' : 'اختياري',
                '',
            ]);
            row.height = ['descriptionAr', 'descriptionEn', 'syllabusAr', 'syllabusEn'].includes(field.key) ? 58 : 34;
            row.getCell(5).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: field.required ? 'FFFFF0C2' : 'FFFFFBEB' } };
            row.getCell(5).alignment = { vertical: 'top', wrapText: true };
            row.getCell(5).note = FIELD_GUIDE[field.key] ?? '';
            row.getCell(3).font = { bold: field.required, color: { argb: field.required ? 'FF9A6700' : 'FF17365D' } };
            if (field.key === 'contentType') {
                row.getCell(5).dataValidation = { type: 'list', allowBlank: false, formulae: ['"مباشر,مسجل"'] };
            } else if (field.key === 'level') {
                row.getCell(5).dataValidation = { type: 'list', allowBlank: true, formulae: ['"مبتدئ,متوسط,متقدم,جميع المستويات"'] };
            } else if (field.key.endsWith('Included') || field.key === 'certificateIssued') {
                row.getCell(5).dataValidation = { type: 'list', allowBlank: true, formulae: ['"نعم,لا"'] };
            }
        }
        const contentSections = [
            ['الفصول', 'ورقة الفصول: أضف عنوان كل فصل بالعربية والإنجليزية وحدد ترتيبه.'],
            ['الدروس', 'ورقة الدروس: أضف كل درس في صف مستقل، واكتب عنوان الفصل بالعربية كما هو في ورقة الفصول. تشمل الحقول العنوان والوصف والفيديو والمدة والروابط والملفات.'],
            ['مخرجات الدروس', 'ورقة مخرجات الدروس: أضف مخرج تعلم لكل درس، واربطه بعنوان الفصل والدرس بالعربية.'],
            ['أهداف التعلم', 'ورقة أهداف التعلم: أضف كل هدف للدورة بالعربية والإنجليزية في صف مستقل.'],
            ['المتطلبات', 'ورقة المتطلبات: أضف كل متطلب سابق بالعربية والإنجليزية في صف مستقل.'],
            ['الفئة المستهدفة', 'ورقة الفئة المستهدفة: أضف كل فئة بالعربية والإنجليزية في صف مستقل.'],
            ['الأسئلة الشائعة', 'ورقة الأسئلة الشائعة: أضف السؤال والإجابة بالعربية والإنجليزية لكل صف.'],
            ['الصور', 'ورقة الصور: أضف رابط الصورة أو مسارها المرفوع مع وصف بديل بالعربية والإنجليزية.'],
        ];
        const sectionsHeading = courses.addRow(['', 'أقسام المحتوى التفصيلي', 'املأ الأوراق المناسبة أدناه؛ يمكن إضافة عدة صفوف لكل عنصر.']);
        sectionsHeading.height = 30;
        sectionsHeading.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        sectionsHeading.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF17365D' } };
        sectionsHeading.alignment = { vertical: 'middle', wrapText: true };
        for (const [sheetName, instructions] of contentSections) {
            const row = courses.addRow(['', sheetName, instructions]);
            row.height = sheetName === 'الدروس' || sheetName === 'مخرجات الدروس' ? 48 : 34;
            row.getCell(2).font = { bold: true, color: { argb: 'FF17365D' } };
            row.getCell(2).alignment = { vertical: 'middle', wrapText: true };
            row.getCell(3).alignment = { vertical: 'middle', wrapText: true };
            row.eachCell({ includeEmpty: true }, cell => {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF4F7FB' } };
                cell.border = { bottom: { style: 'hair', color: { argb: 'FFD7E0EB' } } };
            });
        }
        courses.getRow(1).height = 34;
        courses.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        courses.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF17365D' } };
        courses.getRow(1).alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        courses.views = [{ state: 'frozen', ySplit: 1, rightToLeft: true, zoomScale: 90 }];

        const definitions: { name: string; fields: { header: string; width: number }[] }[] = [
            { name: 'Chapters', fields: [
                { header: 'CourseKey', width: 18 }, { header: 'chapterKey', width: 18 },
                { header: 'titleAr', width: 34 }, { header: 'titleEn', width: 34 }, { header: 'orderIndex', width: 18 },
            ] },
            { name: 'Lessons', fields: [
                { header: 'CourseKey', width: 18 }, { header: 'chapterKey', width: 18 },
                { header: 'chapterTitleAr', width: 34 }, { header: 'lessonKey', width: 18 },
                { header: 'titleAr', width: 34 }, { header: 'titleEn', width: 34 },
                { header: 'descriptionAr', width: 42 }, { header: 'descriptionEn', width: 42 },
                { header: 'videoUrl', width: 42 }, { header: 'orderIndex', width: 18 },
                { header: 'durationMinutes', width: 22 }, { header: 'links', width: 48 }, { header: 'files', width: 58 },
            ] },
            { name: 'Objectives', fields: [
                { header: 'CourseKey', width: 18 }, { header: 'objectiveAr', width: 45 },
                { header: 'objectiveEn', width: 45 }, { header: 'orderIndex', width: 18 },
            ] },
            { name: 'Prerequisites', fields: [
                { header: 'CourseKey', width: 18 }, { header: 'prerequisiteAr', width: 45 },
                { header: 'prerequisiteEn', width: 45 }, { header: 'orderIndex', width: 18 },
            ] },
            { name: 'Audiences', fields: [
                { header: 'CourseKey', width: 18 }, { header: 'audienceAr', width: 45 },
                { header: 'audienceEn', width: 45 }, { header: 'orderIndex', width: 18 },
            ] },
            { name: 'FAQs', fields: [
                { header: 'CourseKey', width: 18 }, { header: 'questionAr', width: 40 },
                { header: 'questionEn', width: 40 }, { header: 'answerAr', width: 48 },
                { header: 'answerEn', width: 48 }, { header: 'orderIndex', width: 18 },
            ] },
            { name: 'Gallery', fields: [
                { header: 'CourseKey', width: 18 }, { header: 'url', width: 55 },
                { header: 'altAr', width: 38 }, { header: 'altEn', width: 38 }, { header: 'orderIndex', width: 18 },
            ] },
            { name: 'LessonOutcomes', fields: [
                { header: 'CourseKey', width: 18 }, { header: 'chapterKey', width: 18 },
                { header: 'chapterTitleAr', width: 34 }, { header: 'lessonKey', width: 18 },
                { header: 'lessonTitleAr', width: 34 }, { header: 'descriptionAr', width: 45 },
                { header: 'descriptionEn', width: 45 }, { header: 'orderIndex', width: 18 },
            ] },
        ];
        const dataSheets: ExcelJS.Worksheet[] = [];
        for (const definition of definitions) {
            const sheetName = SHEET_NAMES[definition.name];
            const sheet = workbook.addWorksheet(sheetName, {
                views: [{ state: 'frozen', ySplit: 2, rightToLeft: true, zoomScale: 85 }],
            });
            sheet.columns = definition.fields.map(field => ({ header: field.header, width: field.width }));
            for (const field of ['CourseKey', 'chapterKey', 'lessonKey']) {
                const index = definition.fields.findIndex(candidate => candidate.header === field);
                if (index >= 0) sheet.getColumn(index + 1).hidden = true;
            }
            const visibleHeaders = sheet.getRow(2);
            visibleHeaders.values = definition.fields.map(field => {
                const label = FIELD_LABELS[field.header] ?? field.header;
                return REQUIRED_FIELDS[definition.name]?.has(field.header) ? `${label} *` : label;
            });
            sheet.getRow(1).hidden = true;
            visibleHeaders.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
            visibleHeaders.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF17365D' } };
            visibleHeaders.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
            visibleHeaders.height = 42;
            const colLetter = sheet.getColumn(sheet.columnCount).letter;
            sheet.autoFilter = { from: 'A2', to: `${colLetter}52` };
            for (const [index, field] of definition.fields.entries()) {
                const description = FIELD_GUIDE[field.header];
                if (description) visibleHeaders.getCell(index + 1).note = description;
                if (REQUIRED_FIELDS[definition.name]?.has(field.header)) {
                    visibleHeaders.getCell(index + 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFB8860B' } };
                }
            }
            for (let rowNumber = 3; rowNumber <= 52; rowNumber += 1) {
                const row = sheet.getRow(rowNumber);
                row.height = 30;
                row.eachCell({ includeEmpty: true }, cell => {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowNumber % 2 ? 'FFFFFBEB' : 'FFFFFDF5' } };
                    cell.alignment = { vertical: 'top', wrapText: true };
                    cell.border = { bottom: { style: 'hair', color: { argb: 'FFE7DDBF' } } };
                });
            }
            dataSheets.push(sheet);
        }
        const chapterSheet = dataSheets.find(sheet => sheet.name === SHEET_NAMES.Chapters)!;
        const lessonSheet = dataSheets.find(sheet => sheet.name === SHEET_NAMES.Lessons)!;
        const outcomeSheet = dataSheets.find(sheet => sheet.name === SHEET_NAMES.LessonOutcomes)!;
        chapterSheet.getColumn(1).hidden = true;
        lessonSheet.getColumn(1).hidden = true;
        outcomeSheet.getColumn(1).hidden = true;
        for (let row = 3; row <= 500; row += 1) {
            lessonSheet.getCell(row, 3).note = 'اكتب اسم الفصل بالعربية كما أدخلته في ورقة الفصول لربط الدرس به.';
            outcomeSheet.getCell(row, 3).note = 'اكتب اسم الفصل بالعربية كما أدخلته في ورقة الفصول.';
            outcomeSheet.getCell(row, 5).note = 'اكتب اسم الدرس بالعربية كما أدخلته في ورقة الدروس.';
        }
        return Buffer.from(await workbook.xlsx.writeBuffer());
    }

    async import(buffer: Buffer, instructorId: string) {
        let workbook: ExcelJS.Workbook;
        try { workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(buffer as any); }
        catch { throw new BadRequestException('ملف Excel غير صالح أو تالف.'); }
        const coursesSheet = this.getSheet(workbook, 'Courses');
        if (!coursesSheet) throw new BadRequestException('ورقة بيانات الدورة (Courses) مفقودة من القالب.');
        const isCourseForm = coursesSheet.getCell(1, 1).value === '__course_form_v1__';
        const courseRows = this.courseRows(coursesSheet);
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

        const generatedCourseKey = isCourseForm ? 'COURSE-001' : undefined;
        const singleCourseKey = courseRows.length === 1
            ? generatedCourseKey ?? (TEXT(courseRows[0].row.getCell(1).value) || 'COURSE-001')
            : undefined;
        const childRows = [
            ...chapterRows, ...lessonRows, ...lessonOutcomeRows, ...objectiveRows, ...prerequisiteRows,
            ...audienceRows, ...faqRows, ...galleryRows,
        ];
        if (singleCourseKey) {
            for (const row of childRows) {
                if (!TEXT(row.CourseKey)) row.CourseKey = singleCourseKey;
            }
        }
        if (isCourseForm) {
            chapterRows.forEach((row, index) => {
                if (!TEXT(row.chapterKey)) row.chapterKey = `CH-${String(index + 1).padStart(3, '0')}`;
            });
            lessonRows.forEach((row, index) => {
                if (!TEXT(row.chapterKey)) {
                    const chapterTitle = TEXT(row.chapterTitleAr);
                    const matchingChapters = chapterRows.filter(chapter => TEXT(chapter.titleAr) === chapterTitle);
                    if (matchingChapters.length === 1) row.chapterKey = matchingChapters[0].chapterKey;
                    else if (!chapterTitle && chapterRows.length === 1) row.chapterKey = chapterRows[0].chapterKey;
                    else errors.push(`Lessons:${this.rowNumber(row, index)}: اكتب عنوان الفصل المرتبط كما هو في ورقة الفصول`);
                }
                if (!TEXT(row.lessonKey)) {
                    const chapterLessons = lessonRows.slice(0, index).filter(lesson =>
                        TEXT(lesson.CourseKey) === TEXT(row.CourseKey) && TEXT(lesson.chapterKey) === TEXT(row.chapterKey),
                    ).length;
                    row.lessonKey = `LE-${TEXT(row.chapterKey)}-${String(chapterLessons + 1).padStart(3, '0')}`;
                }
            });
            lessonOutcomeRows.forEach((row, index) => {
                if (!TEXT(row.chapterKey)) {
                    const chapterTitle = TEXT(row.chapterTitleAr);
                    const matchingChapters = chapterRows.filter(chapter => TEXT(chapter.titleAr) === chapterTitle);
                    if (matchingChapters.length === 1) row.chapterKey = matchingChapters[0].chapterKey;
                }
                if (!TEXT(row.lessonKey)) {
                    const matchingLessons = lessonRows.filter(lesson =>
                        TEXT(lesson.CourseKey) === TEXT(row.CourseKey)
                        && TEXT(lesson.chapterKey) === TEXT(row.chapterKey)
                        && TEXT(lesson.titleAr) === TEXT(row.lessonTitleAr),
                    );
                    if (matchingLessons.length === 1) row.lessonKey = matchingLessons[0].lessonKey;
                    else errors.push(`LessonOutcomes:${this.rowNumber(row, index)}: اكتب عنوان الدرس المرتبط كما هو في ورقة الدروس`);
                }
            });
        }

        for (const { row, line } of courseRows) {
            const key = TEXT(row.getCell(1).value);
            const hasData = Array.from({ length: COURSE_HEADERS.length }, (_, column) => row.getCell(column + 1).value)
                .some(value => TEXT(value) !== '');
            if (!hasData) continue;
            if (!key) { errors.push(`Courses:${line}: تعذر تحديد الدورة`); continue; }
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
        const previousLocalizedName = internalName === 'Courses' ? 'بيانات الدورة' : undefined;
        return workbook.getWorksheet(SHEET_NAMES[internalName])
            ?? (previousLocalizedName ? workbook.getWorksheet(previousLocalizedName) : undefined)
            ?? workbook.getWorksheet(internalName);
    }

    private courseRows(sheet: ExcelJS.Worksheet): { row: CourseImportRow; line: number }[] {
        if (sheet.getCell(1, 1).value === '__course_form_v1__') {
            const values = Array<unknown>(COURSE_HEADERS.length).fill('');
            values[0] = 'COURSE-001';
            const fieldIndexes = new Map(COURSE_HEADERS.map((field, index) => [field, index]));
            let hasInput = false;
            sheet.eachRow((row, rowNumber) => {
                if (rowNumber < 2) return;
                const field = TEXT(row.getCell(1).value);
                const index = fieldIndexes.get(field);
                if (index === undefined) return;
                let value: unknown = row.getCell(5).value;
                if (field === 'contentType') {
                    value = value === 'مباشر' ? 'LIVE' : value === 'مسجل' ? 'RECORDED' : value;
                } else if (field === 'level') {
                    const levels: Record<string, string> = {
                        'مبتدئ': 'BEGINNER',
                        'متوسط': 'INTERMEDIATE',
                        'متقدم': 'ADVANCED',
                        'جميع المستويات': 'ALL_LEVELS',
                    };
                    value = levels[TEXT(value)] ?? value;
                } else if (typeof value === 'string' && ['نعم', 'لا'].includes(value.trim())) {
                    value = value.trim() === 'نعم' ? 'TRUE' : 'FALSE';
                }
                values[index] = value;
                if (TEXT(value)) hasInput = true;
            });
            if (!hasInput) return [];
            const row: CourseImportRow = {
                getCell: column => ({ value: values[column - 1] }),
            };
            return [{ row, line: 2 }];
        }

        const firstRow = this.firstDataRow(sheet);
        const rows = sheet.getRows(firstRow, Math.max(0, sheet.rowCount - firstRow + 1)) ?? [];
        return rows.map((row, index) => ({ row, line: firstRow + index }));
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
