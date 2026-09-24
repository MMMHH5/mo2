"use client";

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { api, getErrorMessage } from '@/lib/api';
import { useI18n } from '@/lib/i18n-context';
import LanguageSwitcher from '@/components/LanguageSwitcher';

export default function VerifyEmailPage() {
    return (
        <Suspense fallback={<div className="flex h-screen w-full items-center justify-center bg-brand-navy-dark font-bold text-gray-400">Loading...</div>}>
            <VerifyEmailForm />
        </Suspense>
    );
}

function VerifyEmailForm() {
    const [state, setState] = useState<'verifying' | 'verified' | 'failed'>('verifying');
    const [error, setError] = useState('');
    const { t } = useI18n();
    const searchParams = useSearchParams();
    const token = searchParams?.get('token') || '';

    useEffect(() => {
        let cancelled = false;
        (async () => {
            if (!token) {
                setState('failed');
                return;
            }
            try {
                await api.post('/auth/verify-email', { token });
                if (!cancelled) setState('verified');
            } catch (err) {
                if (!cancelled) {
                    setError(getErrorMessage(err));
                    setState('failed');
                }
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [token]);

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
            <div className="w-full max-w-md bg-brand-navy-dark/90 backdrop-blur-2xl p-10 rounded-[2rem] shadow-[0_20px_60px_rgb(0,0,0,0.4)] border border-white/10 relative z-10 transition-all duration-500 hover:border-white/20 text-center">
                <h1 className="text-3xl font-black text-white mb-4">laxa<span className="text-brand-gold">lab</span></h1>

                {state === 'verifying' && (
                    <div className="flex flex-col items-center">
                        <div className="h-10 w-10 rounded-full border-4 border-brand-gold border-t-transparent animate-spin mb-4"></div>
                        <p className="text-gray-400 font-bold">{t('recovery.verifying')}</p>
                    </div>
                )}

                {state === 'verified' && (
                    <div className="space-y-4">
                        <div className="w-16 h-16 mx-auto rounded-full bg-green-500/15 flex items-center justify-center text-2xl text-green-400">&#10003;</div>
                        <h2 className="text-lg font-bold text-white">{t('recovery.verified')}</h2>
                        <p className="text-sm text-gray-400">{t('recovery.verifiedBody')}</p>
                        <a href="/login" className="inline-block mt-2 px-6 py-3 bg-brand-gold hover:bg-brand-gold-light text-brand-navy-dark font-black rounded-xl">
                            {t('recovery.goToLogin')}
                        </a>
                    </div>
                )}

                {state === 'failed' && (
                    <div className="space-y-4">
                        <div className="w-16 h-16 mx-auto rounded-full bg-red-500/15 flex items-center justify-center text-2xl text-red-400">&#10007;</div>
                        <p className="text-sm text-red-400 font-semibold">{error || t('recovery.verifyFail')}</p>
                        <a href="/login" className="inline-block mt-2 text-brand-gold-light font-bold hover:text-brand-gold transition-colors">{t('recovery.backToLogin')}</a>
                    </div>
                )}
            </div>
        </div>
    );
}