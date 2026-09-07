"use client";

import Link from 'next/link';
import { useI18n } from '@/lib/i18n-context';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import ExploreCourses from '@/components/ExploreCourses';
import { useAuth } from '@/lib/auth-context';

export default function BrowseCoursesPage() {
    const { t } = useI18n();
    const { user } = useAuth();

    return (
        <div className="min-h-screen bg-gray-50">
            <header className="px-8 py-6 flex items-center justify-between border-b border-brand-mist/50 bg-white/80 backdrop-blur-md sticky top-0 z-50">
                <div className="flex items-center gap-2">
                    <div className="w-10 h-10 bg-brand-navy rounded-xl flex items-center justify-center shadow-lg shadow-brand-navy/20">
                        <span className="text-brand-gold font-black text-xl">L</span>
                    </div>
                    <Link href="/">
                        <h1 className="text-2xl font-black text-brand-navy tracking-tight">
                            laxa<span className="text-brand-gold-dark">lab</span>
                        </h1>
                    </Link>
                </div>
                <nav className="hidden md:flex items-center gap-8">
                    <Link href="/courses" className="text-gray-600 font-bold hover:text-brand-gold-dark transition">
                        {t('landing.explore_courses')}
                    </Link>
                    <Link href="/join-as-instructor" className="text-gray-600 font-bold hover:text-brand-gold-dark transition">
                        {t('landing.join_as_instructor')}
                    </Link>
                </nav>
                <div className="flex items-center gap-4">
                    <LanguageSwitcher />
                    {user ? (
                        <Link href="/dashboard">
                            <button className="bg-brand-navy text-white hover:bg-brand-charcoal px-6 py-2.5 rounded-xl font-bold transition-all duration-300 shadow-md">
                                {t('courseDetail.dashboard')}
                            </button>
                        </Link>
                    ) : (
                        <>
                            <Link href="/login">
                                <button className="text-brand-navy hover:text-brand-charcoal font-bold transition">
                                    {t('auth.login')}
                                </button>
                            </Link>
                            <Link href="/register">
                                <button className="bg-brand-navy text-white hover:bg-brand-charcoal px-6 py-2.5 rounded-xl font-bold transition-all duration-300 shadow-md">
                                    {t('auth.register')}
                                </button>
                            </Link>
                        </>
                    )}
                </div>
            </header>

            <main>
                {/* Catalog hero band */}
                <div className="relative overflow-hidden bg-brand-navy">
                    <div className="absolute -top-24 -start-24 w-80 h-80 bg-brand-gold/15 rounded-full blur-3xl" aria-hidden />
                    <div className="absolute -bottom-32 end-0 w-96 h-96 bg-brand-gold/10 rounded-full blur-3xl" aria-hidden />
                    <div className="absolute top-10 end-1/4 w-24 h-24 bg-white/5 rounded-3xl rotate-12" aria-hidden />

                    <div className="relative max-w-7xl mx-auto px-8 py-16 md:py-20">
                        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-8">
                            <div className="max-w-2xl">
                                <div className="inline-flex items-center gap-2 text-brand-gold font-black text-xs uppercase tracking-[0.25em] mb-4">
                                    <span className="w-8 h-px bg-brand-gold" /> {t('landing.badge')}
                                </div>
                                <h1 className="text-4xl md:text-6xl font-black text-white tracking-tight leading-[1.1] mb-5">
                                    {t('explore.heading')}<span className="text-brand-gold">.</span>
                                </h1>
                                <p className="text-brand-mist/90 text-lg md:text-xl max-w-xl leading-relaxed">
                                    {t('explore.subtitle')}
                                </p>
                            </div>
                            <div className="grid grid-cols-3 gap-4 max-w-md shrink-0">
                                <div className="bg-white/10 border border-white/15 rounded-2xl p-4 text-center backdrop-blur-sm">
                                    <div className="text-2xl font-black text-brand-gold">100%</div>
                                    <div className="text-[11px] font-bold text-brand-mist mt-1">Remote</div>
                                </div>
                                <div className="bg-white/10 border border-white/15 rounded-2xl p-4 text-center backdrop-blur-sm">
                                    <div className="text-2xl font-black text-brand-gold">Certified</div>
                                    <div className="text-[11px] font-bold text-brand-mist mt-1">Completion</div>
                                </div>
                                <div className="bg-white/10 border border-white/15 rounded-2xl p-4 text-center backdrop-blur-sm">
                                    <div className="text-2xl font-black text-brand-gold">Expert</div>
                                    <div className="text-[11px] font-bold text-brand-mist mt-1">Instructors</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="max-w-7xl mx-auto px-8 -mt-10 relative z-20 pb-20">
                    <ExploreCourses hideHeader />
                </div>
            </main>
        </div>
    );
}