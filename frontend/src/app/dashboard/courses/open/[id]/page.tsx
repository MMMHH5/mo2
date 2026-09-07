"use client";

import { useParams, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import OpeningForm from '@/components/OpeningForm';
import RosterGrades from '@/components/RosterGrades';
import { useI18n } from '@/lib/i18n-context';
import { Settings2, Users, ArrowLeft } from 'lucide-react';

type Tab = 'setup' | 'students';

export default function OpenCoursePage() {
    const { id } = useParams();
    const searchParams = useSearchParams();
    const openingId = searchParams?.get('edit') ?? undefined;
    const { t } = useI18n();
    const [tab, setTab] = useState<Tab>(openingId ? 'students' : 'setup');

    const tabBtn = (key: Tab, icon: React.ReactNode, label: string) => (
        <button
            onClick={() => setTab(key)}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 cursor-pointer ${
                tab === key
                    ? 'bg-brand-navy text-white shadow-md shadow-brand-navy/20'
                    : 'text-gray-500 hover:bg-brand-mist/50'
            }`}
        >
            {icon}
            {label}
        </button>
    );

    return (
        <ProtectedRoute allowedRoles={['ADMIN', 'COURSE_MANAGER']}>
            <div className="animate-fade-in space-y-6">
                <div className="inline-flex items-center gap-1 bg-white border border-brand-mist rounded-2xl p-1 shadow-sm">
                    {tabBtn('setup', <Settings2 size={16} />, t('roster.tab_setup'))}
                    {tabBtn('students', <Users size={16} />, t('roster.tab_label'))}
                </div>

                {tab === 'setup' && <OpeningForm courseId={String(id)} openingId={openingId} />}

                {tab === 'students' && !openingId && (
                    <div className="bg-white p-8 rounded-3xl shadow-sm border border-brand-mist text-center">
                        <p className="text-gray-500 font-bold">{t('roster.save_first_hint')}</p>
                        <button
                            onClick={() => setTab('setup')}
                            className="mt-4 inline-flex items-center gap-2 bg-brand-navy text-white px-5 py-2.5 rounded-xl font-bold hover:bg-brand-charcoal transition cursor-pointer"
                        >
                            <ArrowLeft size={16} /> {t('roster.save_first_btn')}
                        </button>
                    </div>
                )}

                {tab === 'students' && openingId && <RosterGrades openingId={openingId} />}
            </div>
        </ProtectedRoute>
    );
}
