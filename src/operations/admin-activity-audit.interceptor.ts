import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Request } from 'express';
import { from, mergeMap, Observable } from 'rxjs';
import { AuditService, AdminActivityRecord } from '../audit/audit.service';

type AuthenticatedRequest = Request & {
    user?: {
        userId?: string;
        email?: string;
        role?: string;
    };
};

interface ChangeDetail {
    field: string;
    label: string;
    value?: string | number | boolean;
    previousValue?: string | number | boolean;
    newValue?: string | number | boolean;
}

const TARGET_TYPES: Array<[RegExp, string]> = [
    [/enrollments?/i, 'تسجيل طالب أو إيصال'],
    [/users?/i, 'حساب مستخدم أو طالب'],
    [/openings?/i, 'دفعة دورة'],
    [/courses?/i, 'دورة'],
    [/coupons?/i, 'قسيمة خصم'],
    [/refunds?/i, 'طلب استرداد'],
    [/finance/i, 'عملية مالية'],
    [/payment-gateways?/i, 'وسيلة دفع'],
    [/(^|\/)payments?(\/|$)/i, 'دفعة مالية'],
    [/instructor-applications?/i, 'طلب انضمام مدرب'],
    [/instructor-requests?/i, 'طلب مدرب'],
    [/opening-requests?/i, 'طلب فتح دفعة'],
    [/close-requests?/i, 'طلب إغلاق دفعة'],
    [/live-sessions?/i, 'جلسة مباشرة'],
    [/attendance/i, 'حضور طالب'],
    [/certificates?/i, 'شهادة'],
    [/grades?/i, 'درجة'],
    [/support-tickets?/i, 'تذكرة دعم'],
    [/tasks?/i, 'مهمة'],
    [/announcements?/i, 'إعلان'],
];

const ACTION_VERBS: Array<[RegExp, string]> = [
    [/(^|\/)(approve|approved)(\/|$)/i, 'وافق على'],
    [/(^|\/)(reject|rejected)(\/|$)/i, 'رفض'],
    [/(^|\/)(review|reviewed)(\/|$)/i, 'راجع'],
    [/(^|\/)(publish|published)(\/|$)/i, 'نشر'],
    [/(^|\/)(unpublish|unpublished)(\/|$)/i, 'أوقف نشر'],
    [/(^|\/)(open|opened)(\/|$)/i, 'فتح'],
    [/(^|\/)(start|started)(\/|$)/i, 'بدأ'],
    [/(^|\/)(end|ended|close|closed)(\/|$)/i, 'أنهى أو أغلق'],
    [/(^|\/)(role)(\/|$)/i, 'غيّر صلاحية'],
    [/(^|\/)(status)(\/|$)/i, 'غيّر حالة'],
    [/(^|\/)announcement(\/|$)/i, 'فعّل إعلانًا ل'],
    [/(^|\/)instructor-grants(\/|$)/i, 'حدّث صلاحيات المدربين في'],
    [/(^|\/)media(\/|$)/i, 'رفع وسائط ل'],
];

const FIELD_LABELS: Record<string, string> = {
    name: 'الاسم',
    nameAr: 'الاسم بالعربية',
    nameEn: 'الاسم بالإنجليزية',
    fullName: 'الاسم الكامل',
    studentName: 'اسم الطالب',
    title: 'العنوان',
    titleAr: 'العنوان بالعربية',
    titleEn: 'العنوان بالإنجليزية',
    descriptionAr: 'الوصف بالعربية',
    descriptionEn: 'الوصف بالإنجليزية',
    excerptAr: 'الملخص بالعربية',
    excerptEn: 'الملخص بالإنجليزية',
    categoryAr: 'التصنيف بالعربية',
    categoryEn: 'التصنيف بالإنجليزية',
    email: 'البريد الإلكتروني',
    role: 'الصلاحية',
    isActive: 'حالة الحساب',
    status: 'الحالة',
    isPublished: 'حالة النشر',
    published: 'حالة النشر',
    isOpen: 'حالة الفتح',
    startDate: 'تاريخ البدء',
    endDate: 'تاريخ الانتهاء',
    enrollmentDeadline: 'آخر موعد للتسجيل',
    price: 'السعر',
    priceOld: 'السعر السابق',
    amount: 'المبلغ',
    currency: 'العملة',
    capacity: 'السعة',
    maxStudents: 'الحد الأقصى للطلاب',
    courseId: 'معرّف الدورة',
    instructorId: 'معرّف المدرب',
    studentId: 'معرّف الطالب',
    openingId: 'معرّف الدفعة',
    paymentStatus: 'حالة الدفع',
    enrollmentStatus: 'حالة التسجيل',
    discount: 'الخصم',
    discountPercent: 'نسبة الخصم',
    couponCode: 'رمز القسيمة',
    level: 'المستوى',
    language: 'اللغة',
    contentType: 'نوع المحتوى',
    syllabusAr: 'المنهج بالعربية',
    syllabusEn: 'المنهج بالإنجليزية',
    durationAr: 'المدة بالعربية',
    durationEn: 'المدة بالإنجليزية',
    coverImageUrl: 'صورة غلاف الدورة',
    introVideoUrl: 'الفيديو التعريفي',
    videoFileUrl: 'ملف فيديو الدورة',
    certificateIssued: 'إصدار شهادة إتمام',
    quizzesIncluded: 'تضمين اختبارات',
    projectsIncluded: 'تضمين مشاريع',
    assignmentsIncluded: 'تضمين واجبات',
    liveSessionsIncluded: 'تضمين جلسات مباشرة',
    downloadableResources: 'تضمين موارد قابلة للتنزيل',
    lifetimeAccess: 'إتاحة وصول دائم',
    communityAccess: 'إتاحة مجتمع الدورة',
    deliveryMode: 'نمط الدراسة',
    hoursOfContent: 'ساعات المحتوى',
    refundWindowDays: 'مدة استرداد المبلغ بالأيام',
    announcementStartAt: 'بداية الإعلان',
    announcementEndAt: 'نهاية الإعلان',
    modules: 'الوحدات والدروس',
    chapters: 'الفصول',
    objectives: 'الأهداف',
    prerequisites: 'المتطلبات السابقة',
    audiences: 'الفئات المستهدفة',
    faqs: 'الأسئلة الشائعة',
    gallery: 'معرض الصور',
};

const VALUE_FIELDS = new Set(Object.keys(FIELD_LABELS));
const COLLECTION_FIELDS = new Set(['modules', 'chapters', 'objectives', 'prerequisites', 'audiences', 'faqs', 'gallery']);
const MEDIA_FIELDS = new Set(['coverImageUrl', 'introVideoUrl', 'videoFileUrl']);
const UNSAFE_VALUE_FIELD = /description|excerpt|syllabus|content|comment|notes?|meet.?link|image|file|gallery|modules|chapters|objectives|prerequisites|audiences|faqs/i;
const SENSITIVE_FIELD = /password|secret|token|auth|totp|two.?factor|otp|verification.?code|card|cvv|receipt|file|upload|image|document|attachment|phone|address|birth|metadata|bank|iban|accountNumber/i;
const IGNORED_ROUTE = /(^|\/)(validate|preview|export|calculate|search|track|unlock|recover-password)(\/|$)/i;
const CREATE_ROUTE = /\/(courses|users|enrollments\/admin|openings|coupons|payment-gateways|tasks|announcements|refunds|support-tickets)\/?$/i;

/**
 * Logs successful writes performed by staff without persisting request bodies.
 * Only a small, explicit allow-list of scalar field values is retained.
 */
@Injectable()
export class AdminActivityAuditInterceptor implements NestInterceptor {
    constructor(private readonly audit: AuditService) {}

    intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
        const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
        const record = createAdminActivityRecord(request);
        if (!record) return next.handle();

        const method = request.method.toUpperCase();
        const priorTargetLabel = method === 'DELETE' && record.targetId
            ? this.audit.resolveAdminActivityTargetLabel(record.targetType, record.targetId)
            : Promise.resolve(undefined);
        const requestedFields = isRecord(request.body)
            ? Object.keys(request.body).filter((field) => VALUE_FIELDS.has(field))
            : [];
        const previousValues = (method === 'PATCH' || method === 'PUT') && record.targetId
            ? this.audit.resolveAdminActivityPreviousValues(record.targetType, record.targetId, requestedFields)
            : Promise.resolve({});

        return from(Promise.all([priorTargetLabel, previousValues])).pipe(
            mergeMap(([priorLabel, priorValues]) => {
                if (priorLabel) record.targetLabel = priorLabel;
                record.details = addPreviousValues(record.details, priorValues);
                return next.handle().pipe(
                    mergeMap(async (response: unknown) => {
                        const responseId = getStringProperty(response, 'id');
                        if (responseId && isResourceCreation(record.method, record.route)) record.targetId = responseId;
                        else if (!record.targetId && responseId) record.targetId = responseId;
                        if (record.targetId) {
                            const targetLabel = await this.audit.resolveAdminActivityTargetLabel(record.targetType, record.targetId);
                            if (targetLabel) record.targetLabel = targetLabel;
                        }
                        await this.audit.logAdminActivity(record);
                        return response;
                    }),
                );
            }),
        );
    }
}

export function createAdminActivityRecord(request: AuthenticatedRequest): AdminActivityRecord | null {
    const user = request.user;
    const method = request.method.toUpperCase();
    const role = user?.role;
    if (
        !user?.userId ||
        !user.email ||
        (role !== 'ADMIN' && role !== 'FINANCE' && role !== 'COURSE_MANAGER') ||
        !['POST', 'PATCH', 'PUT', 'DELETE'].includes(method)
    ) {
        return null;
    }

    const route = normalizeRoute(request);
    if (!route || route.startsWith('/api/admin/operations') || IGNORED_ROUTE.test(route)) return null;

    const targetType = findTargetType(route);
    const body = isRecord(request.body) ? request.body : {};
    const action = describeAction(method, route, body, targetType);
    const targetId = findTargetId(request.params, body);
    const targetLabel = findTargetLabel(body, targetType, targetId);
    const changes = captureChanges(body);
    const jsonChanges: Prisma.InputJsonObject[] = changes.map((change) => ({
        field: change.field,
        label: change.label,
        ...(change.value !== undefined ? { value: change.value } : {}),
        ...(change.previousValue !== undefined ? { previousValue: change.previousValue } : {}),
        ...(change.newValue !== undefined ? { newValue: change.newValue } : {}),
    }));
    const changeSummary = changes
        .filter((change) => VALUE_FIELDS.has(change.field))
        .slice(0, 6)
        .map((change) => change.value !== undefined
            ? `${change.label}: ${String(change.value)}`
            : `${change.label}: تم تحديثه`)
        .join('، ');
    const summary = `${user.email} (${role}) نفّذ إجراء «${action}»${targetLabel ? ` على «${targetLabel}»` : ''}. تم تنفيذ الطلب بنجاح.${changeSummary ? ` التفاصيل: ${changeSummary}.` : ''}`;

    return {
        action,
        userId: user.userId,
        actorEmail: user.email,
        actorRole: role,
        targetType,
        targetId,
        targetLabel,
        method,
        route,
        ipAddress: request.ip?.slice(0, 64),
        details: {
            summary,
            outcome: 'نجح التنفيذ',
            operation: action,
            target: targetLabel ?? targetType,
            ...(changes.length ? { changes: jsonChanges } : {}),
        },
    };
}

function normalizeRoute(request: AuthenticatedRequest): string {
    const routePath = request.route?.path;
    const rawPath = routePath
        ? `${request.baseUrl ?? ''}/${routePath}`.replace(/\/+/g, '/')
        : request.path;
    if (!rawPath) return '';
    return rawPath.split('?')[0].replace(/\/+/g, '/').slice(0, 300);
}

function findTargetType(route: string): string {
    for (const [pattern, label] of TARGET_TYPES) {
        if (pattern.test(route)) return label;
    }
    return 'إجراء إداري';
}

function describeAction(
    method: string,
    route: string,
    body: Record<string, unknown>,
    targetType: string,
): string {
    const status = typeof body.status === 'string' ? body.status.toUpperCase() : '';
    if (/(^|\/)(review|approve)(\/|$)/i.test(route)) {
        if (status === 'APPROVED') return `وافق على ${targetType}`;
        if (status === 'REJECTED') return `رفض ${targetType}`;
    }

    const verb = ACTION_VERBS.find(([pattern]) => pattern.test(route))?.[1]
        ?? (isResourceCreation(method, route) ? 'أنشأ' : method === 'POST' ? 'نفّذ' : method === 'DELETE' ? 'حذف' : 'عدّل');
    return `${verb} ${targetType}`;
}

function isResourceCreation(method: string, route: string): boolean {
    return method === 'POST' && CREATE_ROUTE.test(route);
}

function findTargetId(
    params: Record<string, string | string[] | undefined>,
    body: Record<string, unknown>,
): string | undefined {
    const paramValue = params.id ?? params.userId ?? params.courseId ?? params.enrollmentId ?? params.openingId;
    const paramId = Array.isArray(paramValue) ? paramValue[0] : paramValue;
    if (paramId) return paramId.slice(0, 120);
    for (const key of ['userId', 'studentId', 'courseId', 'enrollmentId', 'openingId', 'paymentId', 'couponId']) {
        const value = body[key];
        if (typeof value === 'string' && value.length > 0) return value.slice(0, 120);
    }
    return undefined;
}

function findTargetLabel(
    body: Record<string, unknown>,
    targetType: string,
    targetId?: string,
): string {
    for (const key of ['fullName', 'studentName', 'name', 'nameAr', 'titleAr', 'title', 'email']) {
        const value = body[key];
        if (typeof value === 'string' && value.trim()) {
            return `${targetType}: ${value.trim().slice(0, 100)}`;
        }
    }
    return targetId ? `${targetType} (${targetId})` : targetType;
}

function captureChanges(body: Record<string, unknown>): ChangeDetail[] {
    const changes: ChangeDetail[] = [];
    for (const [field, rawValue] of Object.entries(body)) {
        if ((SENSITIVE_FIELD.test(field) && !MEDIA_FIELDS.has(field)) || rawValue === null || rawValue === undefined) continue;

        const change: ChangeDetail = {
            field: field.slice(0, 80),
            label: FIELD_LABELS[field] ?? `حقل: ${field}`,
        };
        if (COLLECTION_FIELDS.has(field) && Array.isArray(rawValue)) {
            change.value = summarizeCollection(field, rawValue);
            change.newValue = change.value;
        } else if (MEDIA_FIELDS.has(field) && typeof rawValue === 'string') {
            change.value = rawValue.trim() ? 'تم تعيين رابط الوسيط' : 'تم مسح رابط الوسيط';
            change.newValue = change.value;
        } else if (
            VALUE_FIELDS.has(field)
            && (field === 'contentType' || !UNSAFE_VALUE_FIELD.test(field))
            && isSafeScalar(rawValue)
        ) {
            change.value = typeof rawValue === 'string' ? rawValue.trim().slice(0, 120) : rawValue;
            change.newValue = change.value;
        }
        changes.push(change);
    }
    return changes.slice(0, 30);
}

function summarizeCollection(field: string, value: unknown[]): string {
    const count = value.length;
    if (field === 'chapters') {
        const lessonCount = value.reduce<number>((total, chapter) => (
            total + (isRecord(chapter) && Array.isArray(chapter.modules) ? chapter.modules.length : 0)
        ), 0);
        return `${count} ${count === 1 ? 'فصل' : 'فصول'} و${lessonCount} ${lessonCount === 1 ? 'درس' : 'دروس'}`;
    }
    if (field === 'modules') return `${count} ${count === 1 ? 'درس' : 'دروس'}`;
    const labels: Record<string, [string, string]> = {
        objectives: ['هدف', 'أهداف'],
        prerequisites: ['متطلب سابق', 'متطلبات سابقة'],
        audiences: ['فئة مستهدفة', 'فئات مستهدفة'],
        faqs: ['سؤال شائع', 'أسئلة شائعة'],
        gallery: ['صورة', 'صور'],
    };
    const [singular, plural] = labels[field] ?? ['عنصر', 'عناصر'];
    return `${count} ${count === 1 ? singular : plural}`;
}

function addPreviousValues(
    details: Prisma.InputJsonValue | undefined,
    previousValues: Record<string, string | number | boolean>,
): Prisma.InputJsonValue | undefined {
    if (!isRecord(details)) return details;
    const detailRecord = details as Record<string, unknown>;
    if (!Array.isArray(detailRecord.changes)) return details;
    return {
        ...detailRecord,
        changes: detailRecord.changes.map((change: unknown) => {
            if (!isRecord(change) || typeof change.field !== 'string') return change;
            const previousValue = previousValues[change.field];
            return previousValue === undefined ? change : { ...change, previousValue };
        }),
    } as Prisma.InputJsonObject;
}

function isSafeScalar(value: unknown): value is string | number | boolean {
    return typeof value === 'boolean'
        || (typeof value === 'number' && Number.isFinite(value))
        || (typeof value === 'string' && value.length <= 500);
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getStringProperty(value: unknown, key: string): string | undefined {
    if (!isRecord(value)) return undefined;
    const property = value[key];
    return typeof property === 'string' && property.length <= 120 ? property : undefined;
}
