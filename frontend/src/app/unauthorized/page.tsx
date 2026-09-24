"use client";

import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';
import { useI18n } from '@/lib/i18n-context';

export default function UnauthorizedPage() {
    const { t } = useI18n();

    return (
        <div className="flex h-screen w-full flex-col items-center justify-center bg-brand-navy-dark">
            <ShieldAlert size={80} className="text-brand-gold mb-6" />
            <h1 className="text-4xl font-bold text-white">{t('unauthorized.title')}</h1>
            <p className="text-gray-400 mt-3 max-w-md text-center">
                {t('unauthorized.desc')}
            </p>
            <Link href="/dashboard">
                <button className="mt-8 px-6 py-3 bg-brand-gold text-brand-navy-dark rounded-lg font-bold shadow-md hover:bg-brand-gold-light transition">
                    {t('unauthorized.return_dashboard')}
                </button>
            </Link>
        </div>
    );
}