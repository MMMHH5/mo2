"use client";

import Link from 'next/link';
import { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useI18n } from '@/lib/i18n-context';
import LanguageSwitcher from '@/components/LanguageSwitcher';

export default function PublicMobileMenu({ dark = false }: { dark?: boolean }) {
    const { t } = useI18n();
    const { user } = useAuth();
    const [open, setOpen] = useState(false);

    const tone = dark ? 'text-white hover:text-brand-gold' : 'text-brand-navy hover:text-brand-charcoal';

    return (
        <>
            <button
                onClick={() => setOpen(true)}
                className={`md:hidden p-2 ${tone} transition`}
                aria-label="Menu"
            >
                <Menu size={24} />
            </button>

            {open && (
                <div className="fixed inset-0 z-50 md:hidden">
                    <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
                    <div className="absolute inset-y-0 right-0 w-72 max-w-[85vw] bg-white shadow-2xl flex flex-col">
                        <div className="p-5 border-b border-brand-mist flex items-center justify-between">
                            <span className="font-black text-brand-navy text-xl tracking-tight">
                                laxa<span className="text-brand-gold">lab</span>
                            </span>
                            <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-700 transition" aria-label="Close">
                                <X size={24} />
                            </button>
                        </div>

                        <nav className="p-4 space-y-2 flex-1 overflow-y-auto">
                            <Link href="/courses" onClick={() => setOpen(false)} className="block px-3.5 py-3 rounded-xl font-bold text-brand-navy hover:bg-brand-mist transition">
                                {t('landing.explore_courses')}
                            </Link>
                            <Link href="/join-as-instructor" onClick={() => setOpen(false)} className="block px-3.5 py-3 rounded-xl font-bold text-brand-navy hover:bg-brand-mist transition">
                                {t('landing.join_as_instructor')}
                            </Link>
                            {user ? (
                                <Link href="/dashboard" onClick={() => setOpen(false)} className="block px-3.5 py-3 rounded-xl font-bold bg-brand-navy text-white text-center transition">
                                    {t('courseDetail.dashboard')}
                                </Link>
                            ) : (
                                <>
                                    <Link href="/login" onClick={() => setOpen(false)} className="block px-3.5 py-3 rounded-xl font-bold text-brand-navy hover:bg-brand-mist transition">
                                        {t('auth.login')}
                                    </Link>
                                    <Link href="/register" onClick={() => setOpen(false)} className="block px-3.5 py-3 rounded-xl font-bold bg-brand-navy text-white text-center transition">
                                        {t('auth.register')}
                                    </Link>
                                </>
                            )}
                        </nav>

                        <div className="p-4 border-t border-brand-mist">
                            <LanguageSwitcher />
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
