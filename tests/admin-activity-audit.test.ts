import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { lastValueFrom, of } from 'rxjs';
import { AdminActivityAuditInterceptor, createAdminActivityRecord } from '../src/operations/admin-activity-audit.interceptor';

describe('administrative activity audit', () => {
    test('describes enrollment decisions and retains only approved change details', () => {
        const record = createAdminActivityRecord({
            method: 'PATCH',
            baseUrl: '/api/admin/enrollments',
            route: { path: '/:id/review' },
            path: '/api/admin/enrollments/enrollment-1/review',
            params: { id: 'enrollment-1' },
            ip: '203.0.113.8',
            user: { userId: 'finance-1', email: 'finance@example.com', role: 'FINANCE' },
            body: {
                status: 'APPROVED',
                studentName: 'Test Student',
                amount: 100,
                password: 'must-not-be-recorded',
                twoFactorCode: '123456',
                receiptUrl: 'https://example.test/receipt',
                description: 'private text',
                nested: { token: 'secret' },
            },
        } as never);

        assert.ok(record);
        assert.equal(record.action, 'وافق على تسجيل طالب أو إيصال');
        assert.equal(record.targetId, 'enrollment-1');
        assert.equal(record.targetLabel, 'تسجيل طالب أو إيصال: Test Student');
        assert.deepEqual(record.details, {
            summary: 'finance@example.com (FINANCE) نفّذ إجراء «وافق على تسجيل طالب أو إيصال» على «تسجيل طالب أو إيصال: Test Student». تم تنفيذ الطلب بنجاح. التفاصيل: الحالة: APPROVED، اسم الطالب: Test Student، المبلغ: 100.',
            outcome: 'نجح التنفيذ',
            operation: 'وافق على تسجيل طالب أو إيصال',
            target: 'تسجيل طالب أو إيصال: Test Student',
            changes: [
                { field: 'status', label: 'الحالة', value: 'APPROVED', newValue: 'APPROVED' },
                { field: 'studentName', label: 'اسم الطالب', value: 'Test Student', newValue: 'Test Student' },
                { field: 'amount', label: 'المبلغ', value: 100, newValue: 100 },
                { field: 'description', label: 'حقل: description' },
                { field: 'nested', label: 'حقل: nested' },
            ],
        });
        assert.equal(JSON.stringify(record).includes('must-not-be-recorded'), false);
        assert.equal(JSON.stringify(record).includes('123456'), false);
        assert.equal(JSON.stringify(record).includes('receipt'), false);
        assert.equal(JSON.stringify(record).includes('private text'), false);
    });

    test('explains course edits and summarizes nested content without storing lesson text', () => {
        const record = createAdminActivityRecord({
            method: 'PATCH',
            baseUrl: '/api/admin/courses',
            route: { path: '/:id' },
            path: '/api/admin/courses/course-1',
            params: { id: 'course-1' },
            user: { userId: 'admin-1', email: 'admin@example.com', role: 'ADMIN' },
            body: {
                titleAr: 'أساسيات التصميم',
                contentType: 'RECORDED',
                chapters: [
                    {
                        titleAr: 'المقدمة',
                        modules: [
                            { titleAr: 'الدرس الأول', descriptionAr: 'نص درس خاص' },
                            { titleAr: 'الدرس الثاني', descriptionAr: 'نص درس آخر' },
                        ],
                    },
                    { titleAr: 'التطبيق', modules: [{ titleAr: 'مشروع' }] },
                ],
                objectives: [{ objectiveAr: 'نتيجة خاصة' }],
                coverImageUrl: 'https://private.example.test/cover.jpg',
            },
        } as never);

        assert.ok(record);
        const details = record.details as { summary: string; changes: Array<{ label: string; value?: string }> };
        assert.match(details.summary, /العنوان بالعربية: أساسيات التصميم/);
        assert.match(details.summary, /2 فصول و3 دروس/);
        assert.match(details.summary, /1 هدف/);
        assert.match(details.summary, /صورة غلاف الدورة: تم تعيين رابط الوسيط/);
        assert.deepEqual(details.changes.map(({ label, value }) => ({ label, value })), [
            { label: 'العنوان بالعربية', value: 'أساسيات التصميم' },
            { label: 'نوع المحتوى', value: 'RECORDED' },
            { label: 'الفصول', value: '2 فصول و3 دروس' },
            { label: 'الأهداف', value: '1 هدف' },
            { label: 'صورة غلاف الدورة', value: 'تم تعيين رابط الوسيط' },
        ]);
        assert.equal(JSON.stringify(record).includes('نص درس خاص'), false);
        assert.equal(JSON.stringify(record).includes('نتيجة خاصة'), false);
        assert.equal(JSON.stringify(record).includes('private.example.test'), false);
    });

    test('stores prior and submitted safe values for course edits', async () => {
        const request = {
            method: 'PATCH',
            baseUrl: '/api/admin/courses',
            route: { path: '/:id' },
            path: '/api/admin/courses/course-1',
            params: { id: 'course-1' },
            user: { userId: 'admin-1', email: 'admin@example.com', role: 'ADMIN' },
            body: { titleAr: 'العنوان الجديد' },
        };
        const recorded: Array<{ details?: { changes?: Array<{ field: string; previousValue?: unknown; newValue?: unknown }> } }> = [];
        const audit = {
            resolveAdminActivityTargetLabel: async () => undefined,
            resolveAdminActivityPreviousValues: async () => ({ titleAr: 'العنوان السابق' }),
            logAdminActivity: async (record: typeof recorded[number]) => { recorded.push(record); },
        };
        const interceptor = new AdminActivityAuditInterceptor(audit as never);

        await lastValueFrom(interceptor.intercept(
            { switchToHttp: () => ({ getRequest: () => request }) } as never,
            { handle: () => of({ id: 'course-1' }) } as never,
        ));

        assert.deepEqual(recorded[0].details?.changes?.[0], {
            field: 'titleAr',
            label: 'العنوان بالعربية',
            value: 'العنوان الجديد',
            newValue: 'العنوان الجديد',
            previousValue: 'العنوان السابق',
        });
    });

    test('ignores non-staff accounts, read requests and operations-password endpoints', () => {
        const base = {
            baseUrl: '/api/admin/courses',
            route: { path: '/' },
            path: '/api/admin/courses',
            params: {},
            user: { userId: 'admin-1', email: 'admin@example.com', role: 'ADMIN' },
            body: { title: 'New course' },
        };

        assert.equal(createAdminActivityRecord({ ...base, method: 'GET' } as never), null);
        assert.equal(
            createAdminActivityRecord({
                ...base,
                method: 'POST',
                user: { userId: 'student-1', email: 'student@example.com', role: 'STUDENT' },
            } as never),
            null,
        );
        assert.equal(
            createAdminActivityRecord({
                ...base,
                method: 'POST',
                baseUrl: '/api/admin/operations',
                route: { path: '/settings/password' },
                path: '/api/admin/operations/settings/password',
            } as never),
            null,
        );
    });
});
