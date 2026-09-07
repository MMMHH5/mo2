"use client";

import Link from 'next/link';
import { useI18n } from '@/lib/i18n-context';
import PublicMobileMenu from '@/components/PublicMobileMenu';

export default function NotFound() {
    const { t } = useI18n();

    return (
        <div className="min-h-screen bg-brand-white flex flex-col">
            <header className="px-8 py-6 flex items-center justify-between border-b border-brand-mist/50 bg-white/80 backdrop-blur-md sticky top-0 z-40">
                <div className="flex items-center gap-2">
                    <div className="w-10 h-10 bg-brand-navy rounded-xl flex items-center justify-center shadow-lg shadow-brand-navy/20">
                        <span className="text-brand-gold font-black text-xl">L</span>
                    </div>
                    <h1 className="text-2xl font-black text-brand-navy tracking-tight">
                        laxa<span className="text-brand-gold">lab</span>
                    </h1>
                </div>
                <div className="flex items-center gap-4">
                    <PublicMobileMenu />
                </div>
            </header>

            <main className="flex-1 flex flex-col items-center justify-center px-4 text-center relative overflow-hidden">
                <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-brand-gold/10 rounded-full blur-3xl -z-10"></div>
                <div className="absolute bottom-1/4 left-1/4 w-96 h-96 bg-brand-navy/10 rounded-full blur-3xl -z-10"></div>

                <div className="text-9xl font-black text-brand-navy leading-none select-none">
                    4<span className="text-brand-gold">0</span>4
                </div>
                <h2 className="text-3xl lg:text-4xl font-black text-brand-charcoal mt-6">{t('notFound.title')}</h2>
                <p className="text-gray-500 mt-3 max-w-md leading-relaxed">{t('notFound.desc')}</p>
                <div className="flex flex-wrap justify-center gap-4 mt-10">
                    <Link href="/" className="bg-brand-navy text-white px-7 py-3.5 rounded-xl font-bold hover:bg-brand-charcoal transition-all duration-300 shadow-md hover:shadow-lg">
                        {t('notFound.home')}
                    </Link>
                    <Link href="/courses" className="border-2 border-brand-mist text-brand-charcoal px-7 py-3.5 rounded-xl font-bold hover:border-brand-gold hover:text-brand-navy transition-all duration-300">
                        {t('notFound.explore')}
                    </Link>
                </div>
            </main>
        </div>
    );
}
