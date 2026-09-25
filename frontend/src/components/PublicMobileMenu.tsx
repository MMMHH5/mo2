"use client";

import Link from 'next/link';
import { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useI18n } from '@/lib/i18n-context';
import { useTheme } from '@/lib/theme-context';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import ThemeToggle from '@/components/ThemeToggle';

export default function PublicMobileMenu({ dark }: { dark?: boolean }) {
    const { t } = useI18n();
    const { locale } = useI18n();
    const { user } = useAuth();
    const { dark: ctxDark } = useTheme();
    const isDark = dark ?? ctxDark;
    const isAr = locale === 'ar';
    const [open, setOpen] = useState(false);

    const tone = isDark ? 'text-white hover:text-brand-gold' : 'text-brand-navy hover:text-brand-charcoal';
    const drawerCls = isDark
        ? 'absolute inset-y-0 right-0 w-72 max-w-[85vw] bg-brand-navy-dark shadow-2xl flex flex-col'
        : 'absolute inset-y-0 right-0 w-72 max-w-[85vw] bg-white shadow-2xl flex flex-col';
    const linkCls = isDark
        ? 'block px-3.5 py-3 rounded-xl font-bold text-white hover:bg-white/10 transition'
        : 'block px-3.5 py-3 rounded-xl font-bold text-brand-navy hover:bg-brand-mist transition';
    const dividerCls = isDark ? 'border-white/10' : 'border-brand-mist';
    const closeCls = isDark ? 'text-gray-400 hover:text-white transition' : 'text-gray-400 hover:text-gray-700 transition';

    return (
        <>
            <button
                onClick={() => setOpen(true)}
                className={`lg:hidden p-2 ${tone} transition`}
                aria-label="Menu"
            >
                <Menu size={24} />
            </button>

            {open && (
                <div className="fixed inset-0 z-50 lg:hidden">
                    <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
                    <div className={drawerCls}>
                        <div className={`p-5 border-b ${dividerCls} flex items-center justify-between`}>
                            <img
                                src={isDark ? '/logos/LaxaLab_Academy_Horizontal_Reverse_4K.png' : '/logos/LaxaLab_Academy_Horizontal_Primary_4K.png'}
                                alt="Laxalab Academy"
                                className="h-8 w-auto object-contain"
                            />
                            <button onClick={() => setOpen(false)} className={closeCls} aria-label="Close">
                                <X size={24} />
                            </button>
                        </div>

                        <nav className="p-4 space-y-2 flex-1 overflow-y-auto">
                            <Link href="/courses" onClick={() => setOpen(false)} className={linkCls}>
                                {t('landing.explore_courses')}
                            </Link>
                            <Link href="/about" onClick={() => setOpen(false)} className={linkCls}>
                                {isAr ? 'من نحن' : 'About Us'}
                            </Link>
                            <Link href="/instructors" onClick={() => setOpen(false)} className={linkCls}>
                                {isAr ? 'المدرّبون' : 'Instructors'}
                            </Link>
                            <Link href="/blog" onClick={() => setOpen(false)} className={linkCls}>
                                {isAr ? 'المدونة' : 'Blog'}
                            </Link>
                            <Link href="/verify-certificate" onClick={() => setOpen(false)} className={linkCls}>
                                {isAr ? 'التحقق من الشهادة' : 'Verify Certificate'}
                            </Link>
                            <Link href="/faq" onClick={() => setOpen(false)} className={linkCls}>
                                {isAr ? 'الأسئلة الشائعة' : 'FAQ'}
                            </Link>
                            <Link href="/contact" onClick={() => setOpen(false)} className={linkCls}>
                                {isAr ? 'تواصل معنا' : 'Contact'}
                            </Link>
                            <Link href="/join-as-instructor" onClick={() => setOpen(false)} className={linkCls}>
                                {t('landing.join_as_instructor')}
                            </Link>
                            {user ? (
                                <Link href="/dashboard" onClick={() => setOpen(false)} className={`${isDark ? 'bg-brand-gold text-brand-navy-dark hover:bg-brand-gold-light' : 'bg-brand-navy text-white'} block px-3.5 py-3 rounded-xl font-bold text-center transition`}>
                                    {t('courseDetail.dashboard')}
                                </Link>
                            ) : (
                                <>
                                    <Link href="/login" onClick={() => setOpen(false)} className={linkCls}>
                                        {t('auth.login')}
                                    </Link>
                                    <Link href="/register" onClick={() => setOpen(false)} className={`${isDark ? 'bg-brand-gold text-brand-navy-dark hover:bg-brand-gold-light' : 'bg-brand-navy text-white'} block px-3.5 py-3 rounded-xl font-bold text-center transition`}>
                                        {t('auth.register')}
                                    </Link>
                                </>
                            )}
                        </nav>

                        <div className={`p-4 border-t ${dividerCls} space-y-3`}>
                            <LanguageSwitcher dark={dark} />
                            <ThemeToggle />
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
