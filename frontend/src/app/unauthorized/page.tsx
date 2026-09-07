"use client";

import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';
import { useI18n } from '@/lib/i18n-context';

export default function UnauthorizedPage() {
    const { t } = useI18n();

    return (
        <div className="flex h-screen w-full flex-col items-center justify-center bg-gray-50">
            <ShieldAlert size={80} className="text-red-500 mb-6" />
            <h1 className="text-4xl font-bold text-gray-800">{t('unauthorized.title')}</h1>
            <p className="text-gray-500 mt-3 max-w-md text-center">
                {t('unauthorized.desc')}
            </p>
            <Link href="/dashboard">
                <button className="mt-8 px-6 py-3 bg-indigo-600 text-white rounded-lg font-bold shadow-md hover:bg-indigo-700 transition">
                    {t('unauthorized.return_dashboard')}
                </button>
            </Link>
        </div>
    );
}