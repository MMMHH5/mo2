"use client";

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth, Role } from '@/lib/auth-context';
import { api, getErrorMessage } from '@/lib/api';
import { useI18n } from '@/lib/i18n-context';
import LanguageSwitcher from '@/components/LanguageSwitcher';

export default function TwoFactorPage() {
    return (
        <Suspense fallback={<div className="flex h-screen w-full items-center justify-center bg-brand-navy-dark font-bold text-gray-400">Loading...</div>}>
            <TwoFactorForm />
        </Suspense>
    );
}

function TwoFactorForm() {
    const [code, setCode] = useState('');
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const { login } = useAuth();
    const router = useRouter();
    const { t } = useI18n();
    const searchParams = useSearchParams();
    const tempToken = searchParams?.get('tempToken') || '';

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!tempToken) {
            setError(t('recovery.twoFactorFail'));
            return;
        }
        setSubmitting(true);
        try {
            setError('');
            const res = await api.post('/auth/2fa/verify-login', { tempToken, code: code.trim() });
            const token = res.data.access_token;
            const refreshToken = res.data.refresh_token;

            const base64Url = token.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const payload = JSON.parse(window.atob(base64));

            login(token, {
                userId: payload.sub,
                email: payload.email,
                role: payload.role as Role
            }, refreshToken);

            const redirect = searchParams?.get('redirect') || '/dashboard';
            router.push(redirect);
        } catch (err) {
            setError(getErrorMessage(err) || t('recovery.twoFactorFail'));
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-brand-navy-dark relative overflow-hidden p-4">
            {/* Background elements */}
            <div className="absolute top-0 right-0 w-full h-full overflow-hidden pointer-events-none z-0">
                <div className="absolute -top-32 -right-32 w-96 h-96 bg-brand-gold/10 rounded-full blur-[100px] animate-float opacity-70"></div>
                <div className="absolute bottom-0 left-0 w-[30rem] h-[30rem] bg-brand-gold/5 rounded-full blur-[120px] animate-float opacity-70" style={{ animationDelay: '2s', animationDuration: '8s' }}></div>
            </div>

            <div className="absolute top-6 right-6 rtl:left-6 rtl:right-auto z-50 bg-white/5 backdrop-blur-md rounded-full shadow-sm border border-white/10 p-1">
                <LanguageSwitcher dark />
            </div>
            <div className="w-full max-w-md bg-brand-navy-dark/90 backdrop-blur-2xl p-10 rounded-[2rem] shadow-[0_20px_60px_rgb(0,0,0,0.4)] border border-white/10 relative z-10 transition-all duration-500 hover:border-white/20">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-black text-white">laxa<span className="text-brand-gold">lab</span></h1>
                    <p className="text-gray-400 mt-2 font-bold">{t('recovery.twoFactorTitle')}</p>
                </div>

                <p className="text-sm text-gray-400 text-center mb-4">{t('recovery.twoFactorSub')}</p>

                {error && <div className="mb-4 p-3 bg-red-500/10 border border-red-400/30 text-red-400 rounded-md text-sm font-semibold">{error}</div>}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-bold text-gray-300">{t('recovery.code')}</label>
                        <input
                            type="text"
                            inputMode="numeric"
                            maxLength={6}
                            required
                            className="mt-1 block w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:ring-2 focus:ring-brand-gold outline-none text-center tracking-widest text-white [color-scheme:dark]"
                            value={code}
                            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                        />
                    </div>
                    <button type="submit" disabled={submitting} className="w-full py-4 bg-brand-gold hover:bg-brand-gold-light text-brand-navy-dark font-black rounded-xl shadow-md transition disabled:opacity-60">
                        {submitting ? t('common.processing') : t('recovery.verifyCode')}
                    </button>
                </form>

                <div className="mt-6 text-center">
                    <a href="/login" className="text-sm text-brand-gold-light font-bold hover:text-brand-gold transition-colors">{t('recovery.backToLogin')}</a>
                </div>
            </div>
        </div>
    );
}