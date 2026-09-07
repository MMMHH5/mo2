"use client";

import Link from 'next/link';
import { BookOpen, Users, Eye, ArrowLeft } from 'lucide-react';
import { useI18n } from '@/lib/i18n-context';
import MarketingShell from '@/components/MarketingShell';
import { useFetchData } from '@/lib/useFetchData';
import { API_BASE_URL } from '@/lib/api';
import { formatNumber, formatDate, formatPrice } from '@/lib/format';

interface PublicOpening {
    id: string;
    price: string;
    priceOld?: string | null;
    status?: string | null;
}

interface PublicCourse {
    id: string;
    titleAr?: string | null;
    titleEn?: string | null;
    excerptAr?: string | null;
    excerptEn?: string | null;
    coverImageUrl?: string | null;
    categoryAr?: string | null;
    categoryEn?: string | null;
    level?: string | null;
    createdAt?: string;
    openings?: PublicOpening[];
    _count?: { enrollments?: number };
}

interface PublicInstructorProfile {
    id: string;
    email: string;
    createdAt: string;
    courseCount: number;
    courses: PublicCourse[];
}

export default function InstructorProfileContent({ id }: { id: string }) {
    const { locale, t, pick } = useI18n();
    const isAr = locale === 'ar';
    const { data: profile, loading, error } = useFetchData<PublicInstructorProfile>(`/public/instructors/${encodeURIComponent(id)}`);

    const levelLabel = (lvl?: string | null) => t(`course.level_${String(lvl || 'BEGINNER').toLowerCase()}`);
    const currentOpening = (course: PublicCourse): PublicOpening | undefined =>
        course.openings?.find((o) => o.status === 'OPEN') ?? course.openings?.find((o) => o.status === 'ANNOUNCEMENT');

    return (
        <MarketingShell
            title={profile ? profile.email : isAr ? 'ملف المدرب' : 'Instructor Profile'}
            subtitle={
                profile
                    ? isAr
                        ? 'تعرف على دورات هذا المدرب وقم بالالتحاق بالدفعة المناسبة لك.'
                        : 'Explore this instructor’s courses and join the cohort that suits you.'
                    : undefined
            }
        >
            {error && (
                <div className="p-6 bg-red-50 border border-red-200 text-red-600 rounded-2xl font-semibold text-center">
                    {error}
                </div>
            )}

            {loading ? (
                <div className="flex justify-center p-12 text-brand-gold font-bold text-xl">{t('explore.loading_catalog')}</div>
            ) : profile ? (
                <div className="space-y-10">
                    <div className="bg-white rounded-3xl border border-brand-mist shadow-sm p-8">
                        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
                            <div className="w-20 h-20 bg-brand-navy rounded-2xl flex items-center justify-center text-brand-gold text-3xl font-black shrink-0">
                                {profile.email.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1 text-center sm:text-left">
                                <p className="font-black text-brand-navy text-2xl break-all" dir="ltr">{profile.email}</p>
                                <p className="text-sm text-gray-400 font-semibold mt-2">
                                    {isAr ? 'عضو منذ' : 'Member since'} {formatDate(profile.createdAt, { locale })}
                                </p>
                                <div className="flex items-center justify-center sm:justify-start gap-3 mt-5">
                                    <div className="bg-brand-mist/40 rounded-2xl py-3 px-6 text-center">
                                        <p className="text-xl font-black text-brand-navy">{formatNumber(profile.courseCount, locale)}</p>
                                        <p className="text-xs font-bold text-gray-500 flex items-center justify-center gap-1">
                                            <BookOpen size={13} className="text-brand-gold" /> {isAr ? 'دورات' : 'Courses'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div>
                        <h2 className="text-2xl font-black text-brand-navy mb-6">
                            {isAr ? 'دورات المدرب' : 'Instructor’s Courses'}
                        </h2>
                        {profile.courses.length === 0 ? (
                            <div className="py-14 text-center bg-white rounded-3xl border border-brand-mist text-gray-500 text-lg">
                                {isAr ? 'لا توجد دورات متاحة حالياً.' : 'No courses available at the moment.'}
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                                {profile.courses.map((course) => (
                                    <div key={course.id} className="bg-white rounded-3xl overflow-hidden shadow-sm hover:shadow-xl transition-all border border-brand-mist flex flex-col group">
                                        <div className="h-44 relative overflow-hidden border-b border-brand-mist/50">
                                            {course.coverImageUrl ? (
                                                // eslint-disable-next-line @next/next/no-img-element
                                                <img
                                                    src={`${API_BASE_URL}${course.coverImageUrl}`}
                                                    alt={pick(course, 'title') || ''}
                                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                                />
                                            ) : (
                                                <div className="w-full h-full bg-gradient-to-br from-brand-mist to-white flex flex-col items-center justify-center">
                                                    <BookOpen size={44} className="text-brand-navy mb-2 opacity-30" />
                                                </div>
                                            )}
                                            {currentOpening(course) && (
                                                <div className="absolute top-4 right-4 bg-brand-navy/90 backdrop-blur-sm px-4 py-1 rounded-full font-black text-brand-gold shadow-sm">
                                                    {Number(currentOpening(course)!.price) === 0
                                                        ? t('course.free')
                                                        : formatPrice(currentOpening(course)!.price, { locale })}
                                                </div>
                                            )}
                                        </div>
                                        <div className="p-6 flex-1 flex flex-col">
                                            {(pick(course, 'category') || course.level) && (
                                                <div className="flex flex-wrap gap-2 mb-2">
                                                    {pick(course, 'category') && (
                                                        <span className="text-xs font-black text-brand-gold bg-brand-gold/10 px-2.5 py-1 rounded-full">{pick(course, 'category')}</span>
                                                    )}
                                                    {course.level && (
                                                        <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full">{levelLabel(course.level)}</span>
                                                    )}
                                                </div>
                                            )}
                                            <h3 className="text-xl font-bold text-brand-charcoal mb-2 line-clamp-2">{pick(course, 'title')}</h3>
                                            <p className="text-gray-500 text-sm leading-relaxed mb-4 line-clamp-3 flex-1">
                                                {pick(course, 'excerpt')}
                                            </p>
                                            <div className="flex items-center justify-between text-xs font-bold text-gray-500 mb-5">
                                                <span className="flex items-center gap-1">
                                                    <Users size={13} className="text-brand-gold" />
                                                    {formatNumber(course._count?.enrollments ?? 0, locale)} {isAr ? 'طالب' : 'students'}
                                                </span>
                                            </div>
                                            <Link
                                                href={`/courses/${course.id}`}
                                                className="py-3.5 border-2 border-brand-mist text-brand-charcoal hover:border-brand-gold hover:text-brand-navy font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
                                            >
                                                <Eye size={16} /> {t('explore.view_details')}
                                            </Link>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <Link href="/instructors" className="inline-flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-brand-navy transition">
                        <ArrowLeft size={16} className="rtl:rotate-180" /> {isAr ? 'العودة إلى قائمة المدرّبين' : 'Back to all instructors'}
                    </Link>
                </div>
            ) : null}
        </MarketingShell>
    );
}