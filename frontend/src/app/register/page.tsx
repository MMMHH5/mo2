"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, getErrorMessage } from '@/lib/api';
import toast from 'react-hot-toast';
import Link from 'next/link';
import { Mail, Lock, User, Phone, LogIn } from 'lucide-react';

import { useI18n } from '@/lib/i18n-context';
import LanguageSwitcher from '@/components/LanguageSwitcher';

export default function RegisterPage() {
    const router = useRouter();
    const { t } = useI18n();

    const [formData, setFormData] = useState({
        fullName: '',
        phone: '',
        email: '',
        password: '',
        confirmPassword: ''
    });
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (formData.password !== formData.confirmPassword) {
            toast.error(t('auth.passwords_not_match'));
            return;
        }

        setIsLoading(true);
        try {
            await api.post('/auth/register', {
                email: formData.email,
                password: formData.password,
            });
            toast.success(t('auth.registration_success'));
            router.push('/login');
        } catch (err) {
            toast.error(getErrorMessage(err) || t('auth.register_failed'));
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 flexflex-col flex items-center justify-center p-4 relative">
            <div className="absolute top-4 right-4 rtl:left-4 rtl:right-auto">
                <LanguageSwitcher />
            </div>
            <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
                <div className="bg-brand-navy p-8 text-center">
                    <h2 className="text-3xl font-black text-brand-gold mb-2">{t('auth.join_laxalab')}</h2>
                    <p className="text-brand-mist/80">{t('auth.start_learning')}</p>
                </div>

                <div className="p-8">
                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">{t('auth.fullName')}</label>
                            <div className="relative flex items-center">
                                <div className="absolute left-4 rtl:right-4 rtl:left-auto flex items-center pointer-events-none">
                                    <User size={18} className="text-gray-400" />
                                </div>
                                <input
                                    type="text"
                                    required
                                    className="w-full pl-11 pr-4 rtl:pr-11 rtl:pl-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-gold outline-none transition"
                                    placeholder="Jane Doe"
                                    value={formData.fullName}
                                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">{t('auth.phone')}</label>
                            <div className="relative flex items-center">
                                <div className="absolute left-4 rtl:right-4 rtl:left-auto flex items-center pointer-events-none">
                                    <Phone size={18} className="text-gray-400" />
                                </div>
                                <input
                                    type="tel"
                                    required
                                    className="w-full pl-11 pr-4 rtl:pr-11 rtl:pl-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-gold outline-none transition text-left"
                                    placeholder="+1 234 567 890"
                                    dir="ltr"
                                    value={formData.phone}
                                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">{t('auth.email')}</label>
                            <div className="relative flex items-center">
                                <div className="absolute left-4 rtl:right-4 rtl:left-auto flex items-center pointer-events-none">
                                    <Mail size={18} className="text-gray-400" />
                                </div>
                                <input
                                    type="email"
                                    required
                                    className="w-full pl-11 pr-4 rtl:pr-11 rtl:pl-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-gold outline-none transition text-left"
                                    placeholder="you@example.com"
                                    dir="ltr"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">{t('auth.password')}</label>
                            <div className="relative flex items-center">
                                <div className="absolute left-4 rtl:right-4 rtl:left-auto flex items-center pointer-events-none">
                                    <Lock size={18} className="text-gray-400" />
                                </div>
                                <input
                                    type="password"
                                    required
                                    minLength={6}
                                    className="w-full pl-11 pr-4 rtl:pr-11 rtl:pl-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-gold outline-none transition text-left"
                                    placeholder="••••••••"
                                    dir="ltr"
                                    value={formData.password}
                                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">{t('auth.confirmPassword')}</label>
                            <div className="relative flex items-center">
                                <div className="absolute left-4 rtl:right-4 rtl:left-auto flex items-center pointer-events-none">
                                    <Lock size={18} className="text-gray-400" />
                                </div>
                                <input
                                    type="password"
                                    required
                                    minLength={6}
                                    className="w-full pl-11 pr-4 rtl:pr-11 rtl:pl-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-gold outline-none transition text-left"
                                    placeholder="••••••••"
                                    dir="ltr"
                                    value={formData.confirmPassword}
                                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full bg-brand-gold hover:bg-[#b08e50] text-brand-navy font-black py-4 rounded-xl shadow-lg transition flex justify-center items-center gap-2 mt-4 disabled:opacity-50"
                        >
                            {isLoading ? t('auth.creating_account') : (
                                <>
                                    <LogIn size={20} className="rtl:rotate-180" /> {t('auth.register_securely')}
                                </>
                            )}
                        </button>

                        <div className="relative flex items-center justify-center my-4 text-sm mt-6">
                            <span className="absolute bg-white px-2 text-gray-500 font-bold z-10">{t('common.or')}</span>
                            <div className="w-full h-px bg-gray-200"></div>
                        </div>

                        <button
                            type="button"
                            onClick={() => router.push('/api/auth/google')}
                            className="w-full flex items-center justify-center gap-3 py-4 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-bold rounded-xl shadow-sm transition"
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

                    <div className="mt-8 text-center">
                        <p className="text-gray-500 text-sm">
                            {t('auth.already_have_account')}{' '}
                            <Link href="/login" className="text-brand-navy font-bold hover:underline">
                                {t('auth.sign_in')}
                            </Link>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
