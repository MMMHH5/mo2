"use client";

import Link from 'next/link';
import { ReactNode } from 'react';
import { useI18n } from '@/lib/i18n-context';
import { useAuth } from '@/lib/auth-context';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import PublicMobileMenu from '@/components/PublicMobileMenu';

export default function MarketingShell({ children, title, subtitle }: { children: ReactNode; title?: ReactNode; subtitle?: ReactNode }) {
    const { locale } = useI18n();
    const { user } = useAuth();
    const isAr = locale === 'ar';

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            <header className="px-8 py-6 flex items-center justify-between border-b border-brand-mist/50 bg-white/80 backdrop-blur-md sticky top-0 z-50">
                <div className="flex items-center gap-2">
                    <div className="w-10 h-10 bg-brand-navy rounded-xl flex items-center justify-center shadow-lg shadow-brand-navy/20">
                        <span className="text-brand-gold-dark font-black text-xl">L</span>
                    </div>
                    <Link href="/">
                        <span className="text-2xl font-black text-brand-navy tracking-tight">
                            laxa<span className="text-brand-gold-dark">lab</span>
                        </span>
                    </Link>
                </div>
                <nav className="hidden md:flex items-center gap-7">
                    <Link href="/courses" className="text-gray-600 font-bold hover:text-brand-gold-dark transition">
                        {isAr ? 'الدورات' : 'Courses'}
                    </Link>
                    <Link href="/about" className="text-gray-600 font-bold hover:text-brand-gold-dark transition">
                        {isAr ? 'من نحن' : 'About Us'}
                    </Link>
                    <Link href="/faq" className="text-gray-600 font-bold hover:text-brand-gold-dark transition">
                        {isAr ? 'الأسئلة الشائعة' : 'FAQ'}
                    </Link>
                    <Link href="/contact" className="text-gray-600 font-bold hover:text-brand-gold-dark transition">
                        {isAr ? 'تواصل معنا' : 'Contact'}
                    </Link>
                </nav>
                <div className="flex items-center gap-4">
                    <PublicMobileMenu />
                    <div className="hidden sm:flex items-center gap-4">
                        <LanguageSwitcher />
                        {user ? (
                            <Link href="/dashboard">
                                <button className="bg-brand-navy text-white hover:bg-brand-charcoal px-6 py-2.5 rounded-xl font-bold transition-all duration-300 shadow-md">
                                    {isAr ? 'لوحة التحكم' : 'Dashboard'}
                                </button>
                            </Link>
                        ) : (
                            <>
                                <Link href="/login">
                                    <button className="text-brand-navy hover:text-brand-charcoal font-bold transition">
                                        {isAr ? 'تسجيل الدخول' : 'Sign in'}
                                    </button>
                                </Link>
                                <Link href="/register">
                                    <button className="bg-brand-navy text-white hover:bg-brand-charcoal px-6 py-2.5 rounded-xl font-bold transition-all duration-300 shadow-md">
                                        {isAr ? 'إنشاء حساب' : 'Register'}
                                    </button>
                                </Link>
                            </>
                        )}
                    </div>
                </div>
            </header>

            {title && (
                <div className="bg-brand-navy">
                    <div className="max-w-5xl mx-auto px-6 py-16 text-center">
                        <h1 className="text-4xl md:text-5xl font-black text-white mb-4">{title}</h1>
                        {subtitle && <p className="text-brand-mist text-lg md:text-xl max-w-2xl mx-auto leading-relaxed">{subtitle}</p>}
                    </div>
                </div>
            )}

            <main className="flex-1 w-full max-w-5xl mx-auto px-6 py-12">{children}</main>

            <footer className="py-12 bg-white border-t border-gray-200">
                <div className="max-w-5xl mx-auto px-6 grid grid-cols-1 md:grid-cols-3 gap-10">
                    <div>
                        <p className="text-2xl font-black text-brand-navy mb-3">
                            laxa<span className="text-brand-gold-dark">lab</span>
                        </p>
                        <p className="text-sm text-gray-500 leading-relaxed">
                            {isAr
                                ? 'منصة تعليمية رقمية تجمع بين التميز العربي والعالمي لتقديم دورات عملية بشهادات معتمدة.'
                                : 'A digital learning platform blending Arabic and global excellence with practical courses and accredited certificates.'}
                        </p>
                    </div>
                    <div>
                        <h3 className="text-sm font-black text-brand-navy mb-3 tracking-wide">{isAr ? 'المنصة' : 'Platform'}</h3>
                        <nav className="flex flex-col gap-2 text-sm font-semibold text-gray-500">
                            <Link href="/about" className="hover:text-brand-gold-dark transition">{isAr ? 'من نحن' : 'About Us'}</Link>
                            <Link href="/faq" className="hover:text-brand-gold-dark transition">{isAr ? 'الأسئلة الشائعة' : 'FAQ'}</Link>
                            <Link href="/contact" className="hover:text-brand-gold-dark transition">{isAr ? 'تواصل معنا' : 'Contact Us'}</Link>
                            <Link href="/courses" className="hover:text-brand-gold-dark transition">{isAr ? 'تصفح الدورات' : 'Browse Courses'}</Link>
                            <Link href="/join-as-instructor" className="hover:text-brand-gold-dark transition">{isAr ? 'انضم كمدرّب' : 'Join as an Instructor'}</Link>
                        </nav>
                    </div>
                    <div>
                        <h3 className="text-sm font-black text-brand-navy mb-3 tracking-wide">{isAr ? 'سياسات' : 'Policies'}</h3>
                        <nav className="flex flex-col gap-2 text-sm font-semibold text-gray-500">
                            <Link href="/terms" className="hover:text-brand-gold-dark transition">{isAr ? 'الشروط والأحكام' : 'Terms of Service'}</Link>
                            <Link href="/privacy" className="hover:text-brand-gold-dark transition">{isAr ? 'سياسة الخصوصية' : 'Privacy Policy'}</Link>
                            <Link href="/refund-policy" className="hover:text-brand-gold-dark transition">{isAr ? 'سياسة الاسترداد' : 'Refund Policy'}</Link>
                            <Link href="/cookies" className="hover:text-brand-gold-dark transition">{isAr ? 'سياسة ملفات الارتباط' : 'Cookie Policy'}</Link>
                        </nav>
                    </div>
                </div>
                <div className="mt-10 border-t border-gray-100 pt-6 text-center text-sm text-gray-500 font-semibold">
                    &copy; {new Date().getFullYear()} Laxalab. {isAr ? 'جميع الحقوق محفوظة.' : 'All rights reserved.'}
                </div>
            </footer>
        </div>
    );
}