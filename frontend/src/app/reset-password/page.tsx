"use client";

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { api, getErrorMessage } from '@/lib/api';
import { useI18n } from '@/lib/i18n-context';
import LanguageSwitcher from '@/components/LanguageSwitcher';

export default function ResetPasswordPage() {
    return (
        <Suspense fallback={<div className="flex h-screen w-full items-center justify-center bg-gray-50 font-bold text-gray-500">Loading...</div>}>
            <ResetPasswordForm />
        </Suspense>
    );
}

function ResetPasswordForm() {
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const { t } = useI18n();
    const searchParams = useSearchParams();
    const token = searchParams?.get('token') || '';

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!token) {
            setError(t('recovery.verifyFail'));
            return;
        }
        if (password !== confirm) {
            setError(t('recovery.passwordsMismatch'));
            return;
        }
        setSubmitting(true);
        try {
            setError('');
            await api.post('/auth/reset-password', { token, newPassword: password });
            setSuccess(true);
        } catch (err) {
            setError(getErrorMessage(err) || t('recovery.resetRequired'));
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="flex min-h-screen w-full items-center justify-center bg-gray-50 p-4 relative">
            <div className="absolute top-4 right-4 rtl:left-4 rtl:right-auto">
                <LanguageSwitcher />
            </div>
            <div className="w-full max-w-md bg-white p-8 rounded-3xl shadow-xl border border-gray-100">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-black text-brand-navy">laxa<span className="text-brand-gold-dark">lab</span></h1>
                    <p className="text-gray-500 mt-2 font-bold">{t('recovery.resetTitle')}</p>
                </div>

                {success ? (
                    <div className="text-center space-y-4">
                        <div className="w-16 h-16 mx-auto rounded-full bg-green-100 flex items-center justify-center text-2xl">&#10003;</div>
                        <h2 className="text-lg font-bold text-brand-navy">{t('recovery.resetSuccessTitle')}</h2>
                        <p className="text-sm text-gray-500">{t('recovery.resetSuccessBody')}</p>
                        <a href="/login" className="inline-block mt-2 px-6 py-3 bg-brand-gold hover:bg-[#b08e50] text-brand-navy font-black rounded-xl">
                            {t('recovery.goToLogin')}
                        </a>
                    </div>
                ) : (
                    <>
                        <p className="text-sm text-gray-500 text-center mb-4">{t('recovery.resetSub')}</p>

                        {error && <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md text-sm font-semibold">{error}</div>}

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700">{t('recovery.newPassword')}</label>
                                <input
                                    type="password"
                                    required
                                    minLength={6}
                                    className="mt-1 block w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-gold outline-none"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700">{t('recovery.confirmPassword')}</label>
                                <input
                                    type="password"
                                    required
                                    minLength={6}
                                    className="mt-1 block w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-gold outline-none"
                                    value={confirm}
                                    onChange={(e) => setConfirm(e.target.value)}
                                />
                            </div>
                            <button type="submit" disabled={submitting} className="w-full py-4 bg-brand-gold hover:bg-[#b08e50] text-brand-navy font-black rounded-xl shadow-md transition disabled:opacity-60">
                                {submitting ? t('common.processing') : t('recovery.resetButton')}
                            </button>
                        </form>

                        <div className="mt-6 text-center">
                            <a href="/login" className="text-sm text-brand-navy font-bold hover:underline">{t('recovery.backToLogin')}</a>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}