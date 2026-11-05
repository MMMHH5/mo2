import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createAdminActivityRecord } from '../src/operations/admin-activity-audit.interceptor';

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
            summary: 'finance@example.com (FINANCE) نفّذ إجراء «وافق على تسجيل طالب أو إيصال» على «تسجيل طالب أو إيصال: Test Student». تم تنفيذ الطلب بنجاح.',
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
