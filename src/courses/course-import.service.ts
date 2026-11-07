import { BadRequestException, Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { CourseContentType, CourseLevel } from '@prisma/client';
import { CoursesService } from './courses.service';
import { CreateCourseDto } from './dto/create-course.dto';

const IMPORT_MAX_BYTES = 15 * 1024 * 1024;
const COURSE_FIELDS = [
    'titleAr', 'titleEn', 'excerptAr', 'excerptEn', 'descriptionAr', 'descriptionEn',
    'categoryAr', 'categoryEn', 'level', 'contentType', 'language', 'hoursOfContent',
    'durationAr', 'durationEn', 'syllabusAr', 'syllabusEn', 'coverImageUrl',
    'introVideoUrl', 'videoFileUrl', 'certificateIssued', 'quizzesIncluded',
    'projectsIncluded', 'assignmentsIncluded', 'liveSessionsIncluded',
    'downloadableResources', 'lifetimeAccess', 'communityAccess',
] as const;
const COURSE_INFO_FIELDS = new Set<string>(COURSE_FIELDS);
const objectValue = (value: unknown): Record<string, unknown> | undefined =>
    value !== null && typeof value === 'object' && !Array.isArray(value)
        ? value as Record<string, unknown>
        : undefined;
const isNonEmptyString = (value: unknown) => typeof value === 'string' && value.trim().length > 0;
const asArray = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const pickFields = (value: unknown, fields: readonly string[]) => {
    const source = objectValue(value);
    if (!source) return {};
    return Object.fromEntries(fields.filter(field => source[field] !== undefined).map(field => [field, source[field]]));
};
const IMPORT_RESOURCE_FIELDS = ['lessonKey', 'type', 'url', 'nameAr', 'nameEn', 'labelAr', 'labelEn'] as const;
const IMPORT_REQUIRED_COLUMNS: Record<string, Set<string>> = {
    Objectives: new Set(['objectiveAr', 'objectiveEn']),
    Requirements: new Set(['prerequisiteAr', 'prerequisiteEn']),
    Modules: new Set(['importKey', 'titleAr', 'titleEn']),
    Lessons: new Set(['importKey', 'chapterKey', 'titleAr', 'titleEn']),
    Quizzes: new Set(['quizKey', 'titleAr', 'titleEn']),
    Questions: new Set(['quizKey', 'type', 'textAr', 'textEn', 'options', 'correctIndex']),
    Resources: new Set(['lessonKey', 'type', 'url']),
    Audiences: new Set(['audienceAr', 'audienceEn']),
    FAQs: new Set(['questionAr', 'questionEn', 'answerAr', 'answerEn']),
    Gallery: new Set(['url']),
};
const IMPORT_COLUMN_GUIDE: Record<string, string> = {
    Field: 'اسم حقل الدورة كما هو في بنية الاستيراد.',
    Value: 'قيمة الحقل في صف Course Info.',
    contentType: 'نوع تقديم الدورة: LIVE أو RECORDED.',
    level: 'المستوى: BEGINNER أو INTERMEDIATE أو ADVANCED أو ALL_LEVELS.',
    importKey: 'مفتاح نصي فريد يستخدم لربط العناصر.',
    chapterKey: 'يجب أن يطابق importKey في ورقة Modules.',
    lessonKey: 'يجب أن يطابق importKey في ورقة Lessons.',
    quizKey: 'مفتاح فريد للاختبار، تستخدمه ورقة Questions للربط.',
    type: 'نوع السؤال أو المورد؛ استخدم القائمة المنسدلة.',
    descriptionAr: 'محتوى الدرس بالعربية.',
    descriptionEn: 'Lesson content in English.',
    videoUrl: 'رابط فيديو الدرس أو مسار ملف موجود.',
    durationMinutes: 'مدة الدرس بالدقائق كعدد صحيح.',
    outcomes: 'مصفوفة JSON من مخرجات التعلم باللغتين.',
    files: 'مصفوفة JSON من الملفات بروابطها وأسمائها.',
    links: 'مصفوفة JSON من الروابط وتسمياتها.',
    options: 'مصفوفة JSON من خيارات السؤال، كل خيار له textAr وtextEn.',
    correctIndex: 'رقم الخيار الصحيح، يبدأ من صفر.',
    passScore: 'درجة النجاح من 0 إلى 100.',
    isFinal: 'TRUE أو FALSE؛ الاختبار النهائي لا يحتاج moduleRef.',
    moduleRef: 'importKey للدرس الذي يرتبط به الاختبار.',
    explanationAr: 'شرح الإجابة بالعربية.',
    explanationEn: 'Explanation in English.',
    orderIndex: 'الترتيب يبدأ من صفر؛ لا تكرر الرقم ضمن الوحدة.',
    url: 'رابط HTTP/HTTPS أو مسار آمن يبدأ بـ /uploads/.',
    nameAr: 'اسم الملف بالعربية.',
    nameEn: 'اسم الملف بالإنجليزية.',
    labelAr: 'تسمية الرابط بالعربية.',
    labelEn: 'Link label in English.',
    titleAr: 'العنوان بالعربية.',
    titleEn: 'Title in English.',
    objectiveAr: 'هدف التعلم بالعربية.',
    objectiveEn: 'Learning objective in English.',
    prerequisiteAr: 'المتطلب السابق بالعربية.',
    prerequisiteEn: 'Prerequisite in English.',
    audienceAr: 'الفئة المستهدفة بالعربية.',
    audienceEn: 'Target audience in English.',
    questionAr: 'السؤال بالعربية.',
    questionEn: 'Question in English.',
    answerAr: 'الإجابة بالعربية.',
    answerEn: 'Answer in English.',
    altAr: 'وصف بديل للصورة بالعربية.',
    altEn: 'English image alternative text.',
};
export const COURSE_IMPORT_JSON_TEMPLATE = JSON.stringify({
    titleAr: 'مقدمة في الأمن السيبراني',
    titleEn: 'Introduction to Cybersecurity',
    excerptAr: 'تعرف على مبادئ الأمن السيبراني.',
    excerptEn: 'Learn cybersecurity fundamentals.',
    descriptionAr: 'وصف الدورة بالعربية.',
    descriptionEn: 'Course description in English.',
    categoryAr: 'الأمن السيبراني',
    categoryEn: 'Cybersecurity',
    level: 'BEGINNER',
    contentType: 'RECORDED',
    language: 'Arabic',
    hoursOfContent: 2,
    durationAr: 'أسبوعان',
    durationEn: '2 weeks',
    syllabusAr: '',
    syllabusEn: '',
    coverImageUrl: '',
    introVideoUrl: '',
    videoFileUrl: '',
    certificateIssued: true,
    quizzesIncluded: false,
    projectsIncluded: false,
    assignmentsIncluded: false,
    liveSessionsIncluded: false,
    downloadableResources: false,
    lifetimeAccess: false,
    communityAccess: false,
    objectives: [{ objectiveAr: 'تحليل التنبيهات الأمنية', objectiveEn: 'Analyze security alerts', orderIndex: 0 }],
    prerequisites: [{ prerequisiteAr: 'معرفة أساسية بالحاسب', prerequisiteEn: 'Basic computer knowledge', orderIndex: 0 }],
    audiences: [],
    chapters: [{
        importKey: 'module-1',
        titleAr: 'مقدمة',
        titleEn: 'Introduction',
        orderIndex: 0,
        modules: [{
            importKey: 'lesson-1',
            titleAr: 'الدرس الأول',
            titleEn: 'Lesson 1',
            descriptionAr: 'محتوى الدرس بالعربية.',
            descriptionEn: 'Lesson content in English.',
            durationMinutes: 20,
            orderIndex: 0,
            outcomes: [],
            files: [],
            links: [],
        }],
    }],
    quizzes: [{
        quizKey: 'quiz-1',
        titleAr: 'اختبار المقدمة',
        titleEn: 'Introduction Quiz',
        passScore: 60,
        isFinal: false,
        moduleRef: 'lesson-1',
        orderIndex: 0,
        questions: [{
            type: 'SINGLE_CHOICE',
            textAr: 'ما الهدف من المراقبة الأمنية؟',
            textEn: 'What is the goal of security monitoring?',
            options: [
                { textAr: 'اكتشاف الأنشطة المشبوهة', textEn: 'Detect suspicious activity' },
                { textAr: 'لا شيء مما سبق', textEn: 'None of the above' },
            ],
            correctIndex: 0,
            orderIndex: 0,
        }],
    }],
    resources: [{
        lessonKey: 'lesson-1',
        type: 'LINK',
        url: 'https://example.com',
        labelAr: 'مرجع الدرس',
        labelEn: 'Lesson reference',
    }],
    faqs: [],
    gallery: [],
}, null, 2);
export const COURSE_IMPORT_MARKDOWN_TEMPLATE = `# Course Information

Put course fields inside a JSON code block. Required fields: \`titleAr\`, \`titleEn\`, and \`contentType\`. \`contentType\` is \`LIVE\` or \`RECORDED\`; \`level\` is \`BEGINNER\`, \`INTERMEDIATE\`, \`ADVANCED\`, or \`ALL_LEVELS\`.

\`\`\`json
{
  "titleAr": "مقدمة في الأمن السيبراني",
  "titleEn": "Introduction to Cybersecurity",
  "excerptAr": "نبذة قصيرة",
  "excerptEn": "Short summary",
  "categoryAr": "الأمن السيبراني",
  "categoryEn": "Cybersecurity",
  "level": "BEGINNER",
  "contentType": "RECORDED",
  "language": "Arabic",
  "hoursOfContent": 2,
  "durationAr": "أسبوعان",
  "durationEn": "2 weeks",
  "syllabusAr": "",
  "syllabusEn": "",
  "coverImageUrl": "",
  "introVideoUrl": "",
  "videoFileUrl": "",
  "certificateIssued": true,
  "quizzesIncluded": false,
  "projectsIncluded": false,
  "assignmentsIncluded": false,
  "liveSessionsIncluded": false,
  "downloadableResources": false,
  "lifetimeAccess": false,
  "communityAccess": false
}
\`\`\`

# Course Description

\`\`\`json
{
  "descriptionAr": "الوصف التفصيلي بالعربية",
  "descriptionEn": "Full description in English",
  "syllabusAr": "المنهج بالعربية",
  "syllabusEn": "Syllabus in English"
}
\`\`\`

# Learning Objectives

\`\`\`json
[
  { "objectiveAr": "تحليل التنبيهات", "objectiveEn": "Analyze alerts", "orderIndex": 0 }
]
\`\`\`

# Requirements

\`\`\`json
[
  { "prerequisiteAr": "معرفة أساسية بالحاسب", "prerequisiteEn": "Basic computer knowledge", "orderIndex": 0 }
]
\`\`\`

# Target Audience

\`\`\`json
[
  { "audienceAr": "المبتدئون", "audienceEn": "Beginners", "orderIndex": 0 }
]
\`\`\`

# Modules

\`\`\`json
[
  {
    "importKey": "module-1",
    "titleAr": "مقدمة",
    "titleEn": "Introduction",
    "orderIndex": 0,
    "modules": [
      {
        "importKey": "lesson-1",
        "titleAr": "الدرس الأول",
        "titleEn": "Lesson 1",
        "descriptionAr": "محتوى الدرس",
        "descriptionEn": "Lesson content",
        "durationMinutes": 20,
        "orderIndex": 0,
        "outcomes": [],
        "files": [],
        "links": []
      }
    ]
  }
]
\`\`\`

# Quizzes

The quiz types are \`SINGLE_CHOICE\`, \`MULTIPLE_CHOICE\`, and \`TRUE_FALSE\`. Questions are stored inside each quiz. \`moduleRef\` must match a lesson \`importKey\` for a lesson quiz. A final course quiz uses \`"isFinal": true\` and does not need \`moduleRef\`.

\`\`\`json
[
  {
    "quizKey": "quiz-1",
    "titleAr": "اختبار المقدمة",
    "titleEn": "Introduction Quiz",
    "passScore": 60,
    "isFinal": false,
    "moduleRef": "lesson-1",
    "orderIndex": 0,
    "questions": [
      {
        "type": "SINGLE_CHOICE",
        "textAr": "ما الهدف من المراقبة؟",
        "textEn": "What is the goal of monitoring?",
        "options": [
          { "textAr": "اكتشاف التهديدات", "textEn": "Detect threats" },
          { "textAr": "لا شيء", "textEn": "Nothing" }
        ],
        "correctIndex": 0,
        "orderIndex": 0
      }
    ]
  }
]
\`\`\`

# Questions

Questions belong to quizzes and are entered in each quiz's \`questions\` array.

# Resources

Attach resources to lessons using \`lessonKey\`, which must match a lesson \`importKey\`. \`type\` is \`FILE\` or \`LINK\`. URLs must use HTTP(S) or a safe \`/uploads/\` path.

\`\`\`json
[
  {
    "lessonKey": "lesson-1",
    "type": "LINK",
    "url": "https://example.com",
    "labelAr": "مرجع الدرس",
    "labelEn": "Lesson reference"
  }
]
\`\`\`

# FAQs

\`\`\`json
[]
\`\`\`

# Gallery

\`\`\`json
[]
\`\`\`
`;

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
type ImportValidationResult =
    | { valid: true; data: CreateCourseDto; errors: string[]; warnings: string[]; missing: string[] }
    | { valid: false; data: Partial<CreateCourseDto>; errors: string[]; warnings: string[]; missing: string[] };

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

    jsonTemplate(): Buffer {
        return Buffer.from(COURSE_IMPORT_JSON_TEMPLATE, 'utf8');
    }

    markdownTemplate(): Buffer {
        return Buffer.from(COURSE_IMPORT_MARKDOWN_TEMPLATE, 'utf8');
    }

    validateImportData(data: unknown) {
        return this.normalizeAndValidate(data);
    }

    async previewFile(filename: string, buffer: Buffer) {
        if (!buffer?.length || buffer.length > IMPORT_MAX_BYTES) {
            throw new BadRequestException('حجم الملف فارغ أو يتجاوز الحد الأقصى 15MB.');
        }
        const extension = filename.split('.').pop()?.toLowerCase();
        let raw: unknown;
        if (extension === 'json') {
            const text = buffer.toString('utf8');
            if (text.includes('\u0000')) throw new BadRequestException('ملف JSON غير صالح.');
            try {
                raw = JSON.parse(text);
            } catch {
                throw new BadRequestException('تعذر قراءة JSON: تحقق من الأقواس والفواصل وعلامات الاقتباس.');
            }
        } else if (extension === 'md') {
            const text = buffer.toString('utf8');
            if (text.includes('\u0000')) throw new BadRequestException('ملف Markdown غير صالح.');
            raw = this.parseMarkdown(text);
        } else if (extension === 'xlsx') {
            if (buffer.length < 4 || buffer[0] !== 0x50 || buffer[1] !== 0x4b) {
                throw new BadRequestException('محتوى الملف لا يطابق صيغة Excel .xlsx.');
            }
            raw = await this.parseStructuredWorkbook(buffer);
        } else {
            throw new BadRequestException('الصيغ المدعومة هي JSON وMarkdown وExcel (.xlsx).');
        }
        return this.normalizeAndValidate(raw);
    }

    async structuredTemplate(): Promise<Buffer> {
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'LaxaLab Academy';
        workbook.created = new Date();
        const sheets: { name: string; headers: string[]; sample: unknown[] }[] = [
            { name: 'Course Info', headers: ['Field', 'Value'], sample: ['titleAr', 'مقدمة في الأمن السيبراني'] },
            { name: 'Objectives', headers: ['objectiveAr', 'objectiveEn', 'orderIndex'], sample: ['تحليل التنبيهات الأمنية', 'Analyze security alerts', 0] },
            { name: 'Requirements', headers: ['prerequisiteAr', 'prerequisiteEn', 'orderIndex'], sample: ['معرفة أساسية بالحاسب', 'Basic computer knowledge', 0] },
            { name: 'Modules', headers: ['importKey', 'titleAr', 'titleEn', 'orderIndex'], sample: ['module-1', 'مقدمة', 'Introduction', 0] },
            { name: 'Lessons', headers: ['importKey', 'chapterKey', 'titleAr', 'titleEn', 'descriptionAr', 'descriptionEn', 'videoUrl', 'durationMinutes', 'orderIndex', 'outcomes', 'files', 'links'], sample: ['lesson-1', 'module-1', 'الدرس الأول', 'Lesson 1', '', '', '', 20, 0, '[]', '[]', '[]'] },
            { name: 'Quizzes', headers: ['quizKey', 'titleAr', 'titleEn', 'descriptionAr', 'descriptionEn', 'passScore', 'isFinal', 'orderIndex', 'moduleRef'], sample: ['quiz-1', 'اختبار المقدمة', 'Introduction Quiz', '', '', 60, false, 0, 'lesson-1'] },
            { name: 'Questions', headers: ['quizKey', 'type', 'textAr', 'textEn', 'options', 'correctIndex', 'explanationAr', 'explanationEn', 'orderIndex'], sample: ['quiz-1', 'SINGLE_CHOICE', 'ما الهدف من المراقبة؟', 'What is the goal of monitoring?', '[{"textAr":"اكتشاف الأنشطة المشبوهة","textEn":"Detect suspicious activity"},{"textAr":"لا شيء","textEn":"Nothing"}]', 0, '', '', 0] },
            { name: 'Resources', headers: ['lessonKey', 'type', 'url', 'nameAr', 'nameEn', 'labelAr', 'labelEn'], sample: ['lesson-1', 'LINK', 'https://example.com', '', '', 'مرجع الدرس', 'Lesson reference'] },
            { name: 'Audiences', headers: ['audienceAr', 'audienceEn', 'orderIndex'], sample: ['المبتدئون', 'Beginners', 0] },
            { name: 'FAQs', headers: ['questionAr', 'questionEn', 'answerAr', 'answerEn', 'orderIndex'], sample: ['هل توجد شهادة؟', 'Is there a certificate?', 'نعم', 'Yes', 0] },
            { name: 'Gallery', headers: ['url', 'altAr', 'altEn', 'orderIndex'], sample: ['/uploads/courses/gallery/example.webp', 'صورة الدورة', 'Course image', 0] },
        ];
        for (const [index, definition] of sheets.entries()) {
            const sheet = workbook.addWorksheet(definition.name, { views: [{ state: 'frozen', ySplit: 1, rightToLeft: true }] });
            sheet.columns = definition.headers.map(header => ({ header, width: Math.max(20, Math.min(42, header.length + 12)) }));
            sheet.getRow(1).height = 30;
            definition.headers.forEach((header, columnIndex) => {
                const cell = sheet.getRow(1).getCell(columnIndex + 1);
                cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                const required = IMPORT_REQUIRED_COLUMNS[definition.name]?.has(header) ?? false;
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: required ? 'FFB8860B' : 'FF17365D' },
                };
                cell.alignment = { vertical: 'middle', wrapText: true };
                const fieldDescription = IMPORT_COLUMN_GUIDE[header] ?? 'راجع اسم الحقل ومثال الصف الأول.';
                cell.note = `${required ? 'مطلوب | Required' : 'اختياري | Optional'}: ${fieldDescription}\nمثال: ${definition.sample[columnIndex] ?? ''}`;
            });
            if (index === 0) {
                const examples: Record<string, string> = {
                    titleAr: 'مقدمة في الأمن السيبراني',
                    titleEn: 'Introduction to Cybersecurity',
                    excerptAr: 'تعرف على مبادئ الأمن السيبراني.',
                    excerptEn: 'Learn cybersecurity fundamentals.',
                    contentType: 'RECORDED',
                    level: 'BEGINNER',
                    language: 'Arabic',
                    hoursOfContent: '2',
                };
                const courseRows = COURSE_FIELDS.map(field => [field, examples[field] ?? '']);
                courseRows.forEach(row => sheet.addRow(row));
            } else {
                sheet.addRow(definition.sample);
            }
            if (definition.name === 'Course Info') {
                sheet.getColumn(1).width = 28;
                sheet.getColumn(2).width = 48;
                sheet.getCell('B2').note = 'استبدل قيمة المثال قبل الاستيراد. الحقول المطلوبة: titleAr، titleEn، contentType.';
                const fieldRows = new Map<string, number>();
                COURSE_FIELDS.forEach((field, fieldIndex) => fieldRows.set(field, fieldIndex + 2));
                for (const [field, rowNumber] of fieldRows) {
                    const required = ['titleAr', 'titleEn', 'contentType'].includes(field);
                    sheet.getCell(rowNumber, 1).note = `${required ? 'مطلوب | Required' : 'اختياري | Optional'}: ${FIELD_GUIDE[field] ?? field}`;
                    if (required) {
                        for (let column = 1; column <= 2; column += 1) {
                            sheet.getCell(rowNumber, column).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF0C2' } };
                        }
                    }
                }
                const contentTypeRow = fieldRows.get('contentType')!;
                sheet.getCell(contentTypeRow, 2).dataValidation = {
                    type: 'list',
                    allowBlank: false,
                    formulae: ['"LIVE,RECORDED"'],
                };
                const levelRow = fieldRows.get('level')!;
                sheet.getCell(levelRow, 2).dataValidation = {
                    type: 'list',
                    allowBlank: true,
                    formulae: ['"BEGINNER,INTERMEDIATE,ADVANCED,ALL_LEVELS"'],
                };
                for (const field of ['titleAr', 'titleEn']) {
                    sheet.getCell(fieldRows.get(field)!, 2).note = 'مطلوب.';
                }
            }
            if (definition.name === 'Questions') {
                for (let rowNumber = 2; rowNumber <= 200; rowNumber += 1) {
                    sheet.getCell(rowNumber, 2).dataValidation = {
                        type: 'list',
                        allowBlank: true,
                        formulae: ['"SINGLE_CHOICE,MULTIPLE_CHOICE,TRUE_FALSE"'],
                    };
                }
            }
            if (definition.name === 'Resources') {
                for (let rowNumber = 2; rowNumber <= 200; rowNumber += 1) {
                    sheet.getCell(rowNumber, 2).dataValidation = {
                        type: 'list',
                        allowBlank: true,
                        formulae: ['"FILE,LINK"'],
                    };
                }
            }
            sheet.autoFilter = { from: 'A1', to: `${sheet.getColumn(sheet.columnCount).letter}${Math.max(sheet.rowCount, 20)}` };
            for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber += 1) {
                sheet.getRow(rowNumber).alignment = { vertical: 'top', wrapText: true };
            }
        }
        return Buffer.from(await workbook.xlsx.writeBuffer());
    }

    private parseMarkdown(markdown: string): unknown {
        if (((markdown.match(/```/g) ?? []).length % 2) !== 0) {
            throw new BadRequestException('كتلة Markdown غير مكتملة: تأكد من إغلاق كل كتلة JSON بعلامات ```.');
        }
        const sectionNames: Record<string, string> = {
            'course information': 'course',
            'course description': 'description',
            'learning objectives': 'objectives',
            requirements: 'prerequisites',
            'target audience': 'audiences',
            modules: 'chapters',
            quizzes: 'quizzes',
            questions: 'questions',
            resources: 'resources',
            faqs: 'faqs',
            gallery: 'gallery',
        };
        const sections = new Map<string, string>();
        const unsupportedSections: string[] = [];
        let active: string | undefined;
        for (const line of markdown.split(/\r?\n/)) {
            const heading = line.match(/^#{1,3}\s+(.+?)\s*#*\s*$/);
            if (heading) {
                active = sectionNames[heading[1].trim().toLowerCase()];
                if (!active) unsupportedSections.push(heading[1].trim());
                if (active) sections.set(active, '');
            } else if (active) {
                sections.set(active, `${sections.get(active)}\n${line}`);
            }
        }
        if (unsupportedSections.length) {
            throw new BadRequestException(`عناوين Markdown غير مدعومة: ${unsupportedSections.join('، ')}. استخدم عناوين القالب.`);
        }
        if (!sections.has('course')) {
            throw new BadRequestException('ملف Markdown يحتاج إلى قسم # Course Information.');
        }
        const parsed: Record<string, unknown> = {};
        for (const [section, content] of sections) {
            const blocks = [...content.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)];
            const text = blocks.length ? blocks.map(block => block[1]).join('\n') : content.trim();
            if (!text) continue;
            if (!blocks.length && !/^[{[]/.test(text)) continue;
            try {
                parsed[section] = JSON.parse(text);
            } catch {
                throw new BadRequestException(`محتوى قسم Markdown "${section}" غير صالح. استخدم JSON صالحاً داخل كتلة \`\`\`json.`);
            }
        }
        const course = objectValue(parsed.course) ?? {};
        const description = objectValue(parsed.description) ?? {};
        Object.assign(course, pickFields(description, ['excerptAr', 'excerptEn', 'descriptionAr', 'descriptionEn', 'syllabusAr', 'syllabusEn']));
        if (parsed.questions) {
            const quizzes = asArray(parsed.quizzes).map(value => ({ ...objectValue(value) }));
            const byKey = new Map(quizzes.map(quiz => [TEXT(quiz.quizKey), quiz]));
            for (const item of asArray(parsed.questions)) {
                const questionSet = objectValue(item);
                const quiz = questionSet && byKey.get(TEXT(questionSet.quizKey));
                if (quiz) quiz.questions = asArray(quiz.questions).concat(asArray(questionSet.questions));
            }
            parsed.quizzes = quizzes;
        }
        return {
            ...course,
            objectives: parsed.objectives,
            prerequisites: parsed.prerequisites,
            audiences: parsed.audiences,
            chapters: parsed.chapters,
            quizzes: parsed.quizzes,
            resources: parsed.resources,
            faqs: parsed.faqs,
            gallery: parsed.gallery,
        };
    }

    private async parseStructuredWorkbook(buffer: Buffer): Promise<Record<string, unknown>> {
        let workbook: ExcelJS.Workbook;
        try {
            workbook = new ExcelJS.Workbook();
            await workbook.xlsx.load(buffer as any);
        } catch {
            throw new BadRequestException('ملف Excel غير صالح أو تالف.');
        }
        const requiredSheets = ['Course Info', 'Objectives', 'Requirements', 'Modules', 'Lessons', 'Quizzes', 'Questions', 'Resources'];
        const missing = requiredSheets.filter(name => !workbook.getWorksheet(name));
        if (missing.length) {
            throw new BadRequestException({ message: 'ملف Excel لا يحتوي أوراق القالب المطلوبة.', errors: missing.map(name => `ورقة ${name} مفقودة`) });
        }
        const requiredHeaders: Record<string, string[]> = {
            'Course Info': ['Field', 'Value'],
            Objectives: ['objectiveAr', 'objectiveEn'],
            Requirements: ['prerequisiteAr', 'prerequisiteEn'],
            Modules: ['importKey', 'titleAr', 'titleEn'],
            Lessons: ['importKey', 'chapterKey', 'titleAr', 'titleEn'],
            Quizzes: ['quizKey', 'titleAr', 'titleEn'],
            Questions: ['quizKey', 'type', 'textAr', 'textEn', 'options', 'correctIndex'],
            Resources: ['lessonKey', 'type', 'url'],
        };
        const headerErrors: string[] = [];
        for (const [sheetName, required] of Object.entries(requiredHeaders)) {
            const sheet = workbook.getWorksheet(sheetName)!;
            const headers = ((sheet.getRow(1).values as unknown[]) ?? []).slice(1).map(TEXT);
            const duplicates = headers.filter((header, index) => header && headers.indexOf(header) !== index);
            if (duplicates.length) headerErrors.push(`${sheetName}: أعمدة مكررة (${[...new Set(duplicates)].join(', ')}).`);
            const absent = required.filter(header => !headers.includes(header));
            if (absent.length) headerErrors.push(`${sheetName}: أعمدة مطلوبة مفقودة (${absent.join(', ')}).`);
        }
        if (headerErrors.length) {
            throw new BadRequestException({ message: 'عناوين أعمدة ملف Excel لا تطابق القالب.', errors: headerErrors });
        }
        const rows = (name: string) => {
            const sheet = workbook.getWorksheet(name)!;
            const headers = sheet.getRow(1).values as unknown[];
            const keys = headers.slice(1).map(TEXT);
            const result: Record<string, unknown>[] = [];
            sheet.eachRow((row, rowNumber) => {
                if (rowNumber === 1) return;
                const item = Object.fromEntries(keys.map((key, index) => {
                    const value = row.getCell(index + 1).value;
                    if (typeof value === 'string' && ['outcomes', 'files', 'links', 'options'].includes(key) && value.trim()) {
                        try { return [key, JSON.parse(value)]; } catch { return [key, value]; }
                    }
                    return [key, value];
                }));
                if (Object.values(item).some(value => TEXT(value) !== '')) result.push(item);
            });
            return result;
        };
        const course: Record<string, unknown> = {};
        for (const entry of rows('Course Info')) {
            if (typeof entry.Field === 'string' && COURSE_INFO_FIELDS.has(entry.Field)) course[entry.Field] = entry.Value;
        }
        const moduleRows = rows('Modules');
        const lessonRows = rows('Lessons');
        const quizRows = rows('Quizzes');
        const questionRows = rows('Questions');
        const workbookErrors: string[] = [];
        const chapterKeys = new Set<string>();
        moduleRows.forEach((chapter, index) => {
            const key = TEXT(chapter.importKey);
            if (!key) workbookErrors.push(`Modules:${index + 2}: importKey مطلوب.`);
            else if (chapterKeys.has(key)) workbookErrors.push(`Modules:${index + 2}: importKey مكرر (${key}).`);
            if (key) chapterKeys.add(key);
        });
        const lessonKeys = new Set<string>();
        lessonRows.forEach((lesson, index) => {
            const key = TEXT(lesson.importKey);
            const chapterKey = TEXT(lesson.chapterKey);
            if (!key) workbookErrors.push(`Lessons:${index + 2}: importKey مطلوب.`);
            else if (lessonKeys.has(key)) workbookErrors.push(`Lessons:${index + 2}: importKey مكرر (${key}).`);
            lessonKeys.add(key);
            if (!chapterKeys.has(chapterKey)) workbookErrors.push(`Lessons:${index + 2}: chapterKey لا يطابق وحدة في Modules.`);
        });
        const quizKeys = new Set<string>();
        quizRows.forEach((quiz, index) => {
            const key = TEXT(quiz.quizKey);
            if (!key) workbookErrors.push(`Quizzes:${index + 2}: quizKey مطلوب.`);
            else if (quizKeys.has(key)) workbookErrors.push(`Quizzes:${index + 2}: quizKey مكرر (${key}).`);
            if (key) quizKeys.add(key);
        });
        questionRows.forEach((question, index) => {
            if (!quizKeys.has(TEXT(question.quizKey))) {
                workbookErrors.push(`Questions:${index + 2}: quizKey لا يطابق اختباراً في Quizzes.`);
            }
        });
        if (workbookErrors.length) {
            throw new BadRequestException({ message: 'تعذر ربط صفوف ملف Excel.', errors: workbookErrors });
        }
        const chapters = moduleRows.map(chapter => ({
            ...chapter,
            modules: lessonRows.filter(lesson => TEXT(lesson.chapterKey) === TEXT(chapter.importKey)),
        }));
        const quizzes = quizRows.map(quiz => ({
            ...quiz,
            questions: questionRows.filter(question => TEXT(question.quizKey) === TEXT(quiz.quizKey)),
        }));
        const resources = rows('Resources');
        return {
            ...course,
            objectives: rows('Objectives'),
            prerequisites: rows('Requirements'),
            chapters,
            quizzes,
            resources,
            audiences: workbook.getWorksheet('Audiences') ? rows('Audiences') : [],
            faqs: workbook.getWorksheet('FAQs') ? rows('FAQs') : [],
            gallery: workbook.getWorksheet('Gallery') ? rows('Gallery') : [],
        };
    }

    private normalizeAndValidate(raw: unknown): ImportValidationResult {
        const source = objectValue(raw);
        if (!source) throw new BadRequestException('يجب أن يحتوي الملف على كائن دورة واحد.');
        const data = pickFields(source, COURSE_FIELDS) as Partial<CreateCourseDto> & Record<string, any>;
        const errors: string[] = [];
        const warnings: string[] = [];
        const missing: string[] = [];
        const orderIndex = (value: unknown, fallback: number, label: string) => {
            if (value === undefined || value === null || value === '') return fallback;
            const parsed = NUM(value);
            if (parsed === undefined || !Number.isInteger(parsed) || parsed < 0) {
                errors.push(`${label} يجب أن يكون عددًا صحيحًا غير سالب.`);
                return fallback;
            }
            return parsed;
        };
        const validateOptionalText = (value: Record<string, any>, fields: string[], label: string) => {
            for (const field of fields) {
                if (value[field] !== undefined && value[field] !== null && typeof value[field] !== 'string') {
                    errors.push(`${label}.${field} يجب أن تكون نصاً.`);
                }
            }
        };

        for (const field of COURSE_FIELDS) {
            if (data[field] === undefined || data[field] === null || data[field] === '') continue;
            if (['hoursOfContent'].includes(field)) continue;
            if (['certificateIssued', 'quizzesIncluded', 'projectsIncluded', 'assignmentsIncluded',
                'liveSessionsIncluded', 'downloadableResources', 'lifetimeAccess', 'communityAccess'].includes(field)) continue;
            if (typeof data[field] !== 'string') errors.push(`${field} يجب أن تكون نصاً.`);
            else (data as any)[field] = data[field].trim();
        }
        for (const field of ['titleAr', 'titleEn', 'contentType'] as const) {
            if (!TEXT(data[field])) {
                errors.push(`الحقل ${field} مطلوب.`);
                missing.push(field);
            }
        }
        const contentType = TEXT(data.contentType).toUpperCase();
        if (contentType && !Object.values(CourseContentType).includes(contentType as CourseContentType)) {
            errors.push('contentType يجب أن يكون LIVE أو RECORDED.');
        } else if (contentType) data.contentType = contentType as CourseContentType;
        const levelValue: unknown = data.level;
        if (levelValue === null || levelValue === '') {
            delete data.level;
        } else if (levelValue !== undefined) {
            const level = TEXT(levelValue).toUpperCase();
            if (!Object.values(CourseLevel).includes(level as CourseLevel)) errors.push('level غير صالح.');
            else data.level = level as CourseLevel;
        }
        const hoursValue: unknown = data.hoursOfContent;
        if (hoursValue === null || hoursValue === '') {
            delete data.hoursOfContent;
        } else if (hoursValue !== undefined) {
            const hours = NUM(hoursValue);
            if (hours === undefined || !Number.isInteger(hours) || hours < 1) errors.push('hoursOfContent يجب أن يكون عدداً صحيحاً موجباً.');
            else data.hoursOfContent = hours;
        }
        for (const field of ['certificateIssued', 'quizzesIncluded', 'projectsIncluded', 'assignmentsIncluded',
            'liveSessionsIncluded', 'downloadableResources', 'lifetimeAccess', 'communityAccess'] as const) {
            const value: unknown = data[field];
            if (value === undefined || value === null || value === '') {
                delete data[field];
            } else if (typeof value !== 'boolean') {
                const normalized = TEXT(value).toUpperCase();
                if (['TRUE', '1', 'YES', 'نعم'].includes(normalized)) (data as any)[field] = true;
                else if (['FALSE', '0', 'NO', 'لا'].includes(normalized)) (data as any)[field] = false;
                else errors.push(`${field} يجب أن تكون true أو false.`);
            }
        }

        const textList = (field: string, arField: string, enField: string) => asArray(source[field])
            .map((item, index) => {
                const row = pickFields(item, [arField, enField, 'orderIndex']) as Record<string, any>;
                row.orderIndex = orderIndex(row.orderIndex, index, `${field}[${index}].orderIndex`);
                if (!isNonEmptyString(row[arField]) || !isNonEmptyString(row[enField])) errors.push(`${field}[${index}] يحتاج النصين العربي والإنجليزي.`);
                return row;
            });
        data.objectives = textList('objectives', 'objectiveAr', 'objectiveEn') as any;
        data.prerequisites = textList('prerequisites', 'prerequisiteAr', 'prerequisiteEn') as any;
        data.audiences = textList('audiences', 'audienceAr', 'audienceEn') as any;
        data.faqs = asArray(source.faqs).map((item, index) => {
            const row = pickFields(item, ['questionAr', 'questionEn', 'answerAr', 'answerEn', 'orderIndex']) as Record<string, any>;
            row.orderIndex = orderIndex(row.orderIndex, index, `faqs[${index}].orderIndex`);
            validateOptionalText(row, ['questionAr', 'questionEn', 'answerAr', 'answerEn'], `faqs[${index}]`);
            if (!isNonEmptyString(row.questionAr) || !isNonEmptyString(row.questionEn)
                || !isNonEmptyString(row.answerAr) || !isNonEmptyString(row.answerEn)) errors.push(`faqs[${index}] غير مكتمل.`);
            return row;
        }) as CreateCourseDto['faqs'];
        data.gallery = asArray(source.gallery).map((item, index) => {
            const row = pickFields(item, ['url', 'altAr', 'altEn', 'orderIndex']) as Record<string, any>;
            row.orderIndex = orderIndex(row.orderIndex, index, `gallery[${index}].orderIndex`);
            validateOptionalText(row, ['altAr', 'altEn'], `gallery[${index}]`);
            if (!isAllowedAssetUrl(TEXT(row.url))) errors.push(`gallery[${index}].url يجب أن يكون رابط http/https أو مسار /uploads/ صالحاً.`);
            return row;
        }) as CreateCourseDto['gallery'];
        const lessonKeys = new Set<string>();
        const importChapterKeys = new Set<string>();
        const chapterOrderIndexes = new Set<number>();
        data.chapters = asArray(source.chapters).map((item, chapterIndex) => {
            const chapter = pickFields(item, ['titleAr', 'titleEn', 'orderIndex', 'importKey']) as Record<string, any>;
            chapter.orderIndex = orderIndex(chapter.orderIndex, chapterIndex, `chapters[${chapterIndex}].orderIndex`);
            if (chapterOrderIndexes.has(chapter.orderIndex)) errors.push(`ترتيب الوحدة ${chapter.orderIndex} مكرر.`);
            chapterOrderIndexes.add(chapter.orderIndex);
            chapter.importKey = TEXT(chapter.importKey) || `chapter-${chapterIndex + 1}`;
            if (importChapterKeys.has(chapter.importKey)) errors.push(`importKey الوحدة مكرر: ${chapter.importKey}`);
            importChapterKeys.add(chapter.importKey);
            validateOptionalText(chapter, ['importKey'], `chapters[${chapterIndex}]`);
            if (!isNonEmptyString(chapter.titleAr) || !isNonEmptyString(chapter.titleEn)) errors.push(`chapters[${chapterIndex}] يحتاج عنواناً بالعربية والإنجليزية.`);
            const moduleOrderIndexes = new Set<number>();
            chapter.modules = asArray(objectValue(item)?.modules).map((lesson, lessonIndex) => {
                const module = pickFields(lesson, ['titleAr', 'titleEn', 'descriptionAr', 'descriptionEn', 'videoUrl',
                    'durationMinutes', 'orderIndex', 'importKey', 'files', 'links', 'outcomes']) as Record<string, any>;
                module.orderIndex = orderIndex(module.orderIndex, lessonIndex, `chapters[${chapterIndex}].modules[${lessonIndex}].orderIndex`);
                if (moduleOrderIndexes.has(module.orderIndex)) errors.push(`ترتيب الدرس ${module.orderIndex} مكرر في الوحدة ${chapter.titleAr}.`);
                moduleOrderIndexes.add(module.orderIndex);
                module.importKey = TEXT(module.importKey) || `${chapter.importKey}-lesson-${lessonIndex + 1}`;
                validateOptionalText(module, ['descriptionAr', 'descriptionEn', 'importKey'], `chapters[${chapterIndex}].modules[${lessonIndex}]`);
                if (!isNonEmptyString(module.titleAr) || !isNonEmptyString(module.titleEn)) errors.push(`chapters[${chapterIndex}].modules[${lessonIndex}] يحتاج عنواناً باللغتين.`);
                if (lessonKeys.has(module.importKey)) errors.push(`importKey الدرس مكرر: ${module.importKey}`);
                lessonKeys.add(module.importKey);
                if (module.videoUrl && !isAllowedAssetUrl(TEXT(module.videoUrl))) errors.push(`رابط فيديو الدرس ${module.importKey} غير صالح.`);
                if (module.durationMinutes === null || module.durationMinutes === '') {
                    delete module.durationMinutes;
                } else if (module.durationMinutes !== undefined) {
                    const duration = NUM(module.durationMinutes);
                    if (duration === undefined || !Number.isInteger(duration) || duration < 0) errors.push(`مدة الدرس ${module.importKey} غير صالحة.`);
                    else module.durationMinutes = duration;
                }
                module.files = asArray(module.files).map(file => pickFields(file, ['url', 'nameAr', 'nameEn']));
                module.links = asArray(module.links).map(link => pickFields(link, ['url', 'labelAr', 'labelEn']));
                for (const asset of [...module.files, ...module.links]) {
                    if (!isAllowedAssetUrl(TEXT((asset as any).url))) errors.push(`رابط مورد الدرس ${module.importKey} غير صالح.`);
                    validateOptionalText(asset as Record<string, any>, ['nameAr', 'nameEn', 'labelAr', 'labelEn'], `مورد الدرس ${module.importKey}`);
                }
                module.outcomes = asArray(module.outcomes).map((outcome, outcomeIndex) => {
                    const normalized = pickFields(outcome, ['descriptionAr', 'descriptionEn']);
                    if (!isNonEmptyString(normalized.descriptionAr) || !isNonEmptyString(normalized.descriptionEn)) {
                        errors.push(`مخرج التعلم ${outcomeIndex + 1} في الدرس ${module.importKey} يحتاج النصين.`);
                    }
                    return normalized;
                });
                return module;
            });
            return chapter;
        }) as any;
        const normalizedChapters = data.chapters ?? [];
        for (const resource of asArray(source.resources)) {
            const row = pickFields(resource, IMPORT_RESOURCE_FIELDS) as Record<string, any>;
            validateOptionalText(row, ['lessonKey', 'type', 'url', 'nameAr', 'nameEn', 'labelAr', 'labelEn'], 'resources');
            const lesson = normalizedChapters.flatMap(chapter => chapter.modules ?? []).find(module => module.importKey === TEXT(row.lessonKey));
            if (!lesson) {
                errors.push(`المورد يشير إلى lessonKey غير موجود: ${TEXT(row.lessonKey)}.`);
                continue;
            }
            if (!isAllowedAssetUrl(TEXT(row.url))) {
                errors.push(`رابط المورد ${TEXT(row.lessonKey)} غير صالح.`);
                continue;
            }
            if (TEXT(row.type).toUpperCase() === 'FILE') {
                lesson.files ??= [];
                lesson.files.push({ url: row.url, nameAr: row.nameAr, nameEn: row.nameEn });
            } else if (TEXT(row.type).toUpperCase() === 'LINK') {
                lesson.links ??= [];
                lesson.links.push({ url: row.url, labelAr: row.labelAr, labelEn: row.labelEn });
            } else {
                errors.push(`نوع المورد يجب أن يكون FILE أو LINK (lessonKey: ${TEXT(row.lessonKey)}).`);
            }
        }
        const quizKeys = new Set<string>();
        data.quizzes = asArray(source.quizzes).map((item, quizIndex) => {
            const quiz = pickFields(item, ['titleAr', 'titleEn', 'descriptionAr', 'descriptionEn', 'passScore',
                'isFinal', 'orderIndex', 'moduleRef', 'questions', 'quizKey']) as Record<string, any>;
            quiz.orderIndex = orderIndex(quiz.orderIndex, quizIndex, `quizzes[${quizIndex}].orderIndex`);
            quiz.passScore = quiz.passScore === undefined || quiz.passScore === null || quiz.passScore === ''
                ? 60
                : NUM(quiz.passScore);
            validateOptionalText(quiz, ['titleAr', 'titleEn', 'descriptionAr', 'descriptionEn', 'moduleRef'], `quizzes[${quizIndex}]`);
            if (!Number.isInteger(quiz.passScore) || quiz.passScore < 0 || quiz.passScore > 100) {
                errors.push(`درجة النجاح في الاختبار "${quiz.titleAr ?? quizIndex + 1}" يجب أن تكون بين 0 و100.`);
            }
            if (quiz.isFinal === undefined || quiz.isFinal === null || quiz.isFinal === '') quiz.isFinal = !quiz.moduleRef;
            else if (typeof quiz.isFinal !== 'boolean') {
                const normalized = TEXT(quiz.isFinal).toUpperCase();
                if (['TRUE', '1', 'YES', 'نعم'].includes(normalized)) quiz.isFinal = true;
                else if (['FALSE', '0', 'NO', 'لا'].includes(normalized)) quiz.isFinal = false;
                else errors.push(`isFinal للاختبار "${quiz.titleAr ?? quizIndex + 1}" يجب أن تكون true أو false.`);
            }
            if (!isNonEmptyString(quiz.titleAr) || !isNonEmptyString(quiz.titleEn)) errors.push(`quizzes[${quizIndex}] يحتاج عنواناً باللغتين.`);
            if (quiz.quizKey) {
                if (quizKeys.has(TEXT(quiz.quizKey))) errors.push(`quizKey الاختبار مكرر: ${TEXT(quiz.quizKey)}.`);
                quizKeys.add(TEXT(quiz.quizKey));
            }
            if (!quiz.isFinal && !lessonKeys.has(TEXT(quiz.moduleRef))) errors.push(`الاختبار ${quiz.titleAr} يحتاج moduleRef يشير إلى importKey درس صالح.`);
            if (quiz.isFinal && quiz.moduleRef) warnings.push(`تم تجاهل moduleRef للاختبار النهائي "${quiz.titleAr}".`);
            quiz.questions = asArray(quiz.questions).map((question, questionIndex) => {
                const q = pickFields(question, ['type', 'textAr', 'textEn', 'options', 'correctIndex',
                    'explanationAr', 'explanationEn', 'orderIndex']) as Record<string, any>;
                if (!isNonEmptyString(q.type)) errors.push(`نوع السؤال ${questionIndex + 1} في "${quiz.titleAr}" مطلوب.`);
                q.type = TEXT(q.type).toUpperCase();
                validateOptionalText(q, ['textAr', 'textEn', 'explanationAr', 'explanationEn'], `quizzes[${quizIndex}].questions[${questionIndex}]`);
                q.orderIndex = orderIndex(q.orderIndex, questionIndex, `quizzes[${quizIndex}].questions[${questionIndex}].orderIndex`);
                const options: Record<string, unknown>[] = asArray(q.options)
                    .map(option => pickFields(option, ['textAr', 'textEn']));
                q.options = options;
                if (!['SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'TRUE_FALSE'].includes(q.type)) errors.push(`نوع السؤال غير مدعوم في ${quiz.titleAr}.`);
                if (!isNonEmptyString(q.textAr) || !isNonEmptyString(q.textEn)) errors.push(`السؤال ${questionIndex + 1} في "${quiz.titleAr}" يحتاج نصاً باللغتين.`);
                if (q.options.length < 2) errors.push(`السؤال ${questionIndex + 1} في "${quiz.titleAr}" يحتاج خيارين على الأقل.`);
                if (options.some(option => !isNonEmptyString(option.textAr) || !isNonEmptyString(option.textEn))) {
                    errors.push(`خيارات السؤال ${questionIndex + 1} في "${quiz.titleAr}" تحتاج نصاً باللغتين.`);
                }
                if (q.correctIndex === undefined || q.correctIndex === '') errors.push(`الإجابة الصحيحة للسؤال ${questionIndex + 1} في "${quiz.titleAr}" مطلوبة.`);
                if (q.correctIndex !== undefined && q.correctIndex !== '') {
                    const correctIndex = NUM(q.correctIndex);
                    if (correctIndex === undefined || !Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex >= q.options.length) {
                        errors.push(`correctIndex للسؤال ${questionIndex + 1} في "${quiz.titleAr}" خارج نطاق الخيارات.`);
                    } else q.correctIndex = correctIndex;
                }
                return q;
            });
            return quiz;
        }) as any;

        for (const field of ['coverImageUrl', 'introVideoUrl', 'videoFileUrl'] as const) {
            if (data[field] && !isAllowedAssetUrl(TEXT(data[field]))) errors.push(`${field} يجب أن يكون رابط http/https أو مسار /uploads/ صالحاً.`);
        }
        if (!data.objectives?.length) warnings.push('لم تتم إضافة أهداف تعليمية.');
        if (!data.chapters?.length) warnings.push('لم تتم إضافة وحدات أو دروس.');
        if (data.chapters?.some(chapter => !chapter.modules?.length)) warnings.push('يوجد فصل واحد أو أكثر بلا دروس.');
        for (const field of ['descriptionAr', 'descriptionEn', 'categoryAr', 'categoryEn', 'language', 'hoursOfContent'] as const) {
            if (data[field] === undefined || data[field] === null || data[field] === '') missing.push(field);
        }
        if (!data.objectives?.length) missing.push('objectives');
        if (!data.chapters?.length) missing.push('chapters');
        const openingOnlyFields = [
            'price', 'priceOld', 'currency', 'isPublished', 'status', 'instructorName', 'instructorId',
            'startDate', 'endDate', 'enrollmentDeadline', 'maxStudents',
        ];
        if (openingOnlyFields.some(field => source[field] !== undefined)) {
            warnings.push('السعر وحالة النشر والمدرب لا تنتمي إلى سجل الدورة في النظام؛ لم يتم إنشاء دفعة أو تغيير المدرب الحالي.');
        }
        if (asArray(source.references).length) warnings.push('المراجع العامة غير مدعومة بجدول مستقل؛ أضف الروابط والملفات إلى موارد الدروس.');
        const knownCourseFields = new Set([
            ...COURSE_FIELDS, 'objectives', 'prerequisites', 'audiences', 'chapters', 'quizzes',
            'resources', 'references', 'faqs', 'gallery', ...openingOnlyFields,
        ]);
        const unsupportedCourseFields = Object.keys(source).filter(field => !knownCourseFields.has(field));
        if (unsupportedCourseFields.length) warnings.push(`حقول غير معروفة تم تجاهلها: ${unsupportedCourseFields.join(', ')}.`);
        if (asArray(source.quizzes).some(quiz => objectValue(quiz)?.timeLimit !== undefined)) {
            warnings.push('مدة الاختبار غير محفوظة في مخطط قاعدة البيانات الحالي.');
        }
        if (asArray(source.quizzes).some(quiz =>
            asArray(objectValue(quiz)?.questions).some(question => objectValue(question)?.correctIndexes !== undefined),
        )) {
            warnings.push('قاعدة البيانات تحفظ مؤشر إجابة صحيحة واحداً فقط لكل سؤال؛ لم يتم استيراد correctIndexes المتعددة.');
        }
        if (errors.length) {
            return { data, errors, warnings, missing, valid: false };
        }
        return { data: data as CreateCourseDto, errors, warnings, missing, valid: true };
    }

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
