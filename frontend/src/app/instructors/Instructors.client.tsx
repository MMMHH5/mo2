"use client";

import Link from 'next/link';
import { GraduationCap, BookOpen, Users } from 'lucide-react';
import { useI18n } from '@/lib/i18n-context';
import MarketingShell from '@/components/MarketingShell';
import { useFetchData } from '@/lib/useFetchData';
import { formatNumber, formatDate } from '@/lib/format';

interface PublicInstructor {
    id: string;
    email: string;
    joinedAt: string;
    courseCount: number;
    openingCount: number;
}

export default function InstructorsContent() {
    const { locale, t } = useI18n();
    const isAr = locale === 'ar';
    const { data: instructors, loading, error } = useFetchData<PublicInstructor[]>('/public/instructors');

    return (
        <MarketingShell
            title={isAr ? 'مدرّبونا' : 'Our Instructors'}
            subtitle={
                isAr
                    ? 'تعرف على نخبة المدربين المعتمدين الذين يقودون دوراتنا على المنصة.'
                    : 'Meet the certified trainers leading our courses across the platform.'}
        >
            {error && <div className="p-4 bg-red-50 text-red-600 rounded-xl font-semibold">{error}</div>}

            {loading ? (
                <div className="flex justify-center p-12 text-brand-gold font-bold text-xl">{t('explore.loading_catalog')}</div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                    {instructors?.map((instructor) => (
                        <Link
                            key={instructor.id}
                            href={`/instructors/${instructor.id}`}
                            className="bg-white rounded-3xl border border-brand-mist shadow-sm hover:shadow-xl transition-all p-8 flex flex-col items-center text-center group"
                        >
                            <div className="w-20 h-20 bg-brand-navy rounded-2xl flex items-center justify-center text-brand-gold text-3xl font-black mb-5 group-hover:scale-105 transition-transform">
                                {instructor.email.charAt(0).toUpperCase()}
                            </div>
                            <p className="font-black text-brand-navy text-lg mb-2 break-all" dir="ltr">{instructor.email}</p>
                            <p className="text-sm text-gray-400 font-semibold mb-6">
                                {isAr ? 'انضم في' : 'Joined'} {formatDate(instructor.joinedAt, { locale })}
                            </p>
                            <div className="flex items-center gap-3 w-full">
                                <div className="flex-1 bg-brand-mist/40 rounded-2xl py-3 text-center">
                                    <p className="text-xl font-black text-brand-navy">{formatNumber(instructor.courseCount, locale)}</p>
                                    <p className="text-xs font-bold text-gray-500 flex items-center justify-center gap-1">
                                        <BookOpen size={13} className="text-brand-gold" /> {isAr ? 'دورات' : 'Courses'}
                                    </p>
                                </div>
                                <div className="flex-1 bg-brand-mist/40 rounded-2xl py-3 text-center">
                                    <p className="text-xl font-black text-brand-navy">{formatNumber(instructor.openingCount, locale)}</p>
                                    <p className="text-xs font-bold text-gray-500 flex items-center justify-center gap-1">
                                        <Users size={13} className="text-brand-gold" /> {isAr ? 'دفعات' : 'Cohorts'}
                                    </p>
                                </div>
                            </div>
                        </Link>
                    ))}

                    {instructors?.length === 0 && (
                        <div className="col-span-full py-16 text-center bg-white rounded-3xl border border-brand-mist text-gray-500 text-lg">
                            {isAr ? 'لا يوجد مدرّبون حالياً.' : 'No instructors at the moment.'}
                        </div>
                    )}
                </div>
            )}

            <div className="mt-12 rounded-3xl bg-brand-mist/50 p-8 text-center">
                <h2 className="text-xl font-black text-brand-navy mb-2">
                    {isAr ? 'هل أنت مدرّب محترف؟' : 'Are you a professional trainer?'}
                </h2>
                <p className="text-gray-600 mb-6">
                    {isAr ? 'انضم إلى فريقنا وشارك خبرتك مع آلاف المتعلمين.' : 'Join our team and share your expertise with thousands of learners.'}
                </p>
                <Link href="/join-as-instructor" className="inline-flex items-center gap-2 bg-brand-navy text-white px-8 py-3.5 rounded-xl font-black hover:bg-brand-charcoal transition">
                    <GraduationCap size={18} /> {isAr ? 'انضم كمدرّب' : 'Become an Instructor'}
                </Link>
            </div>
        </MarketingShell>
    );
}