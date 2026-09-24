"use client";

import { Suspense, useState } from 'react';
import { useAuth, Role } from '@/lib/auth-context';
import { useRouter, useSearchParams } from 'next/navigation';
import { api, getErrorMessage } from '@/lib/api';
import { useI18n } from '@/lib/i18n-context';
import LanguageSwitcher from '@/components/LanguageSwitcher';

export default function LoginPage() {
    return (
        <Suspense fallback={<div className="flex h-screen w-full items-center justify-center bg-gray-50 font-bold text-gray-500">Loading...</div>}>
            <LoginForm />
        </Suspense>
    );
}

function LoginForm() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const { login } = useAuth();
    const router = useRouter();
    const { t } = useI18n();
    const searchParams = useSearchParams();
    const redirect = searchParams?.get('redirect') || '/dashboard';

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            setError('');
            const res = await api.post('/auth/login', { email, password });
            const body = res.data;

            if (body.requiresTwoFactor && body.tempToken) {
                router.push(`/auth/two-factor?tempToken=${encodeURIComponent(body.tempToken)}&redirect=${encodeURIComponent(redirect)}`);
                return;
            }

            if (body.requiresPasswordChange && body.tempToken) {
                router.push(`/auth/change-password?tempToken=${encodeURIComponent(body.tempToken)}&redirect=${encodeURIComponent(redirect)}`);
                return;
            }

            const token = body.access_token;
            const refreshToken = body.refresh_token;

            // Decode payload easily without a heavy library (NextJs client side friendly)
            const base64Url = token.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const payload = JSON.parse(window.atob(base64));

            login(token, {
                userId: payload.sub,
                email: payload.email,
                role: payload.role as Role
            }, refreshToken);

            router.push(redirect);
        } catch (err) {
            setError(getErrorMessage(err) || t('auth.login_failed'));
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
                    <img
                        src="/logos/LaxaLab_Academy_Stacked_Primary_4K.png"
                        alt="Laxalab Academy"
                        className="h-24 w-auto object-contain mx-auto mb-2 drop-shadow-sm"
                    />
                    <p className="text-gray-500 mt-2 font-bold">{t('auth.welcome_back')}</p>
                </div>

                {error && <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md text-sm font-semibold animate-fade-in-up">{error}</div>}

                <form onSubmit={handleLogin} className="space-y-5">
                    <div>
                        <label className="block text-sm font-black text-brand-navy mb-1.5">{t('auth.email')}</label>
                        <input
                            type="email"
                            required
                            className="block w-full px-4 py-3.5 bg-gray-50/50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-gold focus:border-brand-gold outline-none transition-all duration-200 hover:bg-white"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-black text-brand-navy mb-1.5">{t('auth.password')}</label>
                        <input
                            type="password"
                            required
                            className="block w-full px-4 py-3.5 bg-gray-50/50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-gold focus:border-brand-gold outline-none transition-all duration-200 hover:bg-white"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                    </div>
                    <button type="submit" className="w-full py-4 bg-brand-gold hover:bg-[#b5924a] text-white focus:ring-4 focus:ring-brand-gold/30 font-black rounded-xl shadow-md transition-all duration-300 transform active:scale-[0.98] animate-fade-in-up">
                        {t('auth.sign_in')}
                    </button>

                    <div className="relative flex items-center justify-center my-6 text-sm">
                        <span className="absolute bg-white px-3 text-gray-400 font-bold z-10">{t('common.or')}</span>
                        <div className="w-full h-px bg-gray-200"></div>
                    </div>

                    <button
                        type="button"
                        onClick={() => router.push('/api/auth/google')}
                        className="w-full flex items-center justify-center gap-3 py-4 bg-white border border-gray-200 hover:bg-gray-50 hover:border-brand-mist hover:shadow-sm text-gray-700 font-bold rounded-xl transition-all duration-200"
                    >
                        <svg className="h-5 w-5" viewBox="0 0 24 24">
                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                        </svg>
                        {t('auth.continue_with_google')}
                    </button>
                </form>

                <div className="mt-8 text-center space-y-3">
                    <p className="text-gray-500 text-sm font-semibold">
                        {t('auth.dont_have_account')}{' '}
                        <a href="/register" className="text-brand-navy font-black hover:text-brand-gold-dark transition-colors">
                            {t('auth.register_now')}
                        </a>
                    </p>
                    <p className="text-sm">
                        <a href="/forgot-password" className="text-brand-gold flex items-center justify-center font-bold hover:text-brand-gold-dark transition-colors">
                            {t('recovery.forgotLink')}
                        </a>
                    </p>
                </div>
            </div>
        </div>
    );
}
