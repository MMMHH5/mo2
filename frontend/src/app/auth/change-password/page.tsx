"use client";

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { api, getErrorMessage } from '@/lib/api';
import { useI18n } from '@/lib/i18n-context';
import LanguageSwitcher from '@/components/LanguageSwitcher';

export default function ChangePasswordPage() {
    return (
        <Suspense fallback={<div className="flex h-screen w-full items-center justify-center bg-gray-50 font-bold text-gray-500">Loading...</div>}>
            <ChangePasswordForm />
        </Suspense>
    );
}

function ChangePasswordForm() {
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const { t } = useI18n();
    const searchParams = useSearchParams();
    const tempToken = searchParams?.get('tempToken') || '';

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!tempToken) {
            setError(t('recovery.mustChangeFail'));
            return;
        }
        if (password !== confirm) {
            setError(t('recovery.passwordsMismatch'));
            return;
        }
        setSubmitting(true);
        try {
            setError('');
            await api.post('/auth/change-password', { tempToken, newPassword: password });
            setSuccess(true);
        } catch (err) {
            setError(getErrorMessage(err) || t('recovery.resetRequired'));
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 relative overflow-hidden p-4">
            {/* Background elements */}
            <div className="absolute top-0 right-0 w-full h-full overflow-hidden pointer-events-none z-0">
                <div className="absolute -top-32 -right-32 w-96 h-96 bg-brand-gold/20 rounded-full blur-[100px] animate-float opacity-70"></div>
                <div className="absolute bottom-0 left-0 w-[30rem] h-[30rem] bg-brand-navy-light/10 rounded-full blur-[120px] animate-float opacity-70" style={{ animationDelay: '2s', animationDuration: '8s' }}></div>
            </div>

            <div className="absolute top-6 right-6 rtl:left-6 rtl:right-auto z-50 bg-white/50 backdrop-blur-md rounded-full shadow-sm border border-gray-100 p-1">
                <LanguageSwitcher />
            </div>
            <div className="w-full max-w-md bg-white/80 backdrop-blur-2xl p-10 rounded-[2rem] shadow-[0_20px_60px_rgb(18,48,90,0.08)] border border-white relative z-10 transition-all duration-500 hover:shadow-[0_20px_60px_rgb(18,48,90,0.12)]">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-black text-brand-navy">laxa<span className="text-brand-gold-dark">lab</span></h1>
                    <p className="text-gray-500 mt-2 font-bold">{t('recovery.mustChangeTitle')}</p>
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
                        <p className="text-sm text-gray-500 text-center mb-4">{t('recovery.mustChangeSub')}</p>

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
                                {submitting ? t('common.processing') : t('recovery.mustChangeButton')}
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