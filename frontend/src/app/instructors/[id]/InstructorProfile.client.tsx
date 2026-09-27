"use client";

import Link from 'next/link';
import { BookOpen, Users, Eye, ArrowLeft, Briefcase, GraduationCap, Clock, UserRound } from 'lucide-react';
import { useI18n } from '@/lib/i18n-context';
import { useTheme } from '@/lib/theme-context';
import MarketingShell from '@/components/MarketingShell';
import { useFetchData } from '@/lib/useFetchData';
import { API_BASE_URL } from '@/lib/api';
import { formatNumber, formatDate, formatPrice } from '@/lib/format';
import type { PublicInstructorCard } from '@/lib/public-instructor';

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

/**
 * The public instructor profile, mirroring the backend `PublicInstructor` shape
 * plus the courses it is nested with.
 *
 * This interface used to declare `email: string` as required while the endpoint
 * deliberately withheld it, so `profile.email.charAt(0)` threw and the page
 * rendered nothing.
 */
interface PublicInstructorProfile extends PublicInstructorCard {
    joinedAt: string | null;
    courseCount: number;
    courses: PublicCourse[];
}

export default function InstructorProfileContent({ id }: { id: string }) {
    const { locale, t, pick } = useI18n();
    const { dark } = useTheme();
    const { data: profile, loading, error } = useFetchData<PublicInstructorProfile>(
        `/public/instructors/${encodeURIComponent(id)}`,
    );

    const levelLabel = (lvl?: string | null) => t(`course.level_${String(lvl || 'BEGINNER').toLowerCase()}`);
    const currentOpening = (course: PublicCourse): PublicOpening | undefined =>
        course.openings?.find((o) => o.status === 'OPEN') ?? course.openings?.find((o) => o.status === 'ANNOUNCEMENT');

    const card = (dark_: boolean) =>
        dark_
            ? 'bg-brand-navy-dark border-white/10'
            : 'bg-white border-gray-200';
    const title = (dark_: boolean) => (dark_ ? 'text-white' : 'text-brand-navy');
    const muted = (dark_: boolean) => (dark_ ? 'text-gray-400' : 'text-gray-600');

    if (loading) {
        return (
            <MarketingShell title={t('instructorProfile.heading')}>
                <div className="flex justify-center p-12 text-brand-gold font-bold text-xl">
                    {t('instructorProfile.loading')}
                </div>
            </MarketingShell>
        );
    }

    if (error || !profile) {
        return (
            <MarketingShell title={t('instructorProfile.heading')}>
                <div className={`p-6 rounded-2xl font-semibold text-center ${dark ? 'bg-red-500/10 border border-red-400/30 text-red-400' : 'bg-red-50 border border-red-200 text-red-600'}`}>
                    {error || t('instructorProfile.not_found')}
                </div>
                <div className="mt-6 text-center">
                    <Link href="/instructors" className={`inline-flex items-center gap-2 text-sm font-bold transition ${muted(dark)}`}>
                        <ArrowLeft size={16} className="rtl:rotate-180" /> {t('instructorProfile.back')}
                    </Link>
                </div>
            </MarketingShell>
        );
    }

    const name = pick(profile, 'name');
    const jobTitle = pick(profile, 'jobTitle');
    const bio = pick(profile, 'bio');
    const specialty = pick(profile, 'specialty');
    const initial = (name || '?').trim().charAt(0).toUpperCase();

    return (
        <MarketingShell title={name || t('instructorProfile.heading')}>
            <div className="space-y-10">
                {/* Hero */}
                <div className={`rounded-3xl border shadow-sm p-8 ${card(dark)}`}>
                    <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
                        {profile.avatarUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                                src={`${API_BASE_URL}${profile.avatarUrl}`}
                                alt={name}
                                className="w-24 h-24 rounded-3xl object-cover shrink-0 border border-brand-gold/30"
                            />
                        ) : (
                            <div className="w-24 h-24 bg-brand-navy rounded-3xl flex items-center justify-center text-brand-gold text-4xl font-black shrink-0">
                                {initial}
                            </div>
                        )}
                        <div className="flex-1 text-center sm:text-left min-w-0">
                            <h1 className={`font-black text-2xl sm:text-3xl break-words ${title(dark)}`} dir="auto">
                                {name || t('instructorProfile.heading')}
                            </h1>
                            {jobTitle ? (
                                <p className="text-base font-bold text-brand-gold-dark dark:text-brand-gold-light mt-1" dir="auto">
                                    {jobTitle}
                                </p>
                            ) : null}
                            <p className={`text-sm font-semibold mt-2 ${muted(dark)}`}>
                                {t('profile.member_since')} {formatDate(profile.joinedAt, { locale })}
                            </p>

                            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 mt-5">
                                <div className={`rounded-2xl py-3 px-6 text-center ${dark ? 'bg-white/5' : 'bg-brand-mist/60'}`}>
                                    <p className={`text-xl font-black ${title(dark)}`}>{formatNumber(profile.courseCount, locale)}</p>
                                    <p className={`text-xs font-bold flex items-center justify-center gap-1 ${muted(dark)}`}>
                                        <BookOpen size={13} className="text-brand-gold" /> {t('instructorProfile.courses_suffix')}
                                    </p>
                                </div>
                                {profile.experienceYears ? (
                                    <div className={`rounded-2xl py-3 px-6 text-center ${dark ? 'bg-white/5' : 'bg-brand-mist/60'}`}>
                                        <p className={`text-xl font-black ${title(dark)}`}>{formatNumber(profile.experienceYears, locale)}</p>
                                        <p className={`text-xs font-bold flex items-center justify-center gap-1 ${muted(dark)}`}>
                                            <Clock size={13} className="text-brand-gold" /> {t('instructorProfile.years_suffix')}
                                        </p>
                                    </div>
                                ) : null}
                            </div>
                        </div>
                    </div>
                </div>

                {/* CV */}
                {bio || jobTitle || specialty ? (
                    <div className={`rounded-3xl border shadow-sm p-8 ${card(dark)}`}>
                        <h2 className={`text-xl font-black mb-4 flex items-center gap-2 ${title(dark)}`}>
                            <Briefcase size={20} className="text-brand-gold" />
                            {t('instructorProfile.cv_heading')}
                        </h2>
                        {specialty ? (
                            <p className="inline-flex items-center gap-1.5 text-sm font-bold text-brand-gold-dark dark:text-brand-gold-light bg-brand-gold/10 px-3 py-1.5 rounded-full mb-4" dir="auto">
                                <GraduationCap size={14} /> {specialty}
                            </p>
                        ) : null}
                        {bio ? (
                            <p className={`text-sm leading-relaxed whitespace-pre-line ${muted(dark)}`} dir="auto">
                                {bio}
                            </p>
                        ) : null}
                    </div>
                ) : profile.isProfileIncomplete ? (
                    <div className={`rounded-3xl border border-dashed p-6 text-center text-sm font-semibold ${dark ? 'border-white/10 text-gray-400' : 'border-gray-300 text-gray-500'}`}>
                        <UserRound size={22} className="mx-auto mb-2 opacity-50" />
                        {t('instructorProfile.not_filled')}
                    </div>
                ) : null}

                {/* Courses */}
                <div>
                    <h2 className={`text-2xl font-black mb-6 ${title(dark)}`}>
                        {t('instructorProfile.courses_heading')}
                    </h2>
                    {profile.courses.length === 0 ? (
                        <div className={`py-14 text-center rounded-3xl border text-lg ${dark ? 'bg-brand-navy-dark border-white/10 text-gray-400' : 'bg-white border-gray-200 text-gray-600'}`}>
                            {t('instructorProfile.no_courses')}
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                            {profile.courses.map((course) => (
                                <div key={course.id} className={`rounded-3xl overflow-hidden shadow-sm hover:shadow-xl transition-all flex flex-col group ${card(dark)}`}>
                                    <div className={`h-44 relative overflow-hidden border-b ${dark ? 'border-white/5' : 'border-gray-100'}`}>
                                        {course.coverImageUrl ? (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img
                                                src={`${API_BASE_URL}${course.coverImageUrl}`}
                                                alt={pick(course, 'title') || ''}
                                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                            />
                                        ) : (
                                            <div className="w-full h-full bg-gradient-to-br from-brand-navy to-brand-navy-dark flex flex-col items-center justify-center">
                                                <BookOpen size={44} className="text-brand-gold mb-2 opacity-40" />
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
                                                    <span className={`text-xs font-black px-2.5 py-1 rounded-full ${dark ? 'text-brand-gold-light bg-brand-gold/15' : 'text-brand-gold-dark bg-brand-gold/10'}`}>{pick(course, 'category')}</span>
                                                )}
                                                {course.level && (
                                                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${dark ? 'text-gray-300 bg-white/10' : 'text-gray-600 bg-gray-100'}`}>{levelLabel(course.level)}</span>
                                                )}
                                            </div>
                                        )}
                                        <h3 className={`text-xl font-bold mb-2 line-clamp-2 ${title(dark)}`}>{pick(course, 'title')}</h3>
                                        <p className={`text-sm leading-relaxed mb-4 line-clamp-3 flex-1 ${muted(dark)}`}>
                                            {pick(course, 'excerpt')}
                                        </p>
                                        <div className={`flex items-center justify-between text-xs font-bold mb-5 ${muted(dark)}`}>
                                            <span className="flex items-center gap-1">
                                                <Users size={13} className="text-brand-gold" />
                                                {t('instructorProfile.course_students').replace('{n}', formatNumber(course._count?.enrollments ?? 0, locale))}
                                            </span>
                                        </div>
                                        <Link
                                            href={`/courses/${course.id}`}
                                            className={`py-3.5 border-2 font-bold rounded-xl transition-colors flex items-center justify-center gap-2 ${dark ? 'border-white/10 text-white hover:border-brand-gold hover:text-brand-gold-light' : 'border-gray-200 text-brand-navy hover:border-brand-gold hover:text-brand-gold-dark'}`}
                                        >
                                            <Eye size={16} /> {t('explore.view_details')}
                                        </Link>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <Link href="/instructors" className={`inline-flex items-center gap-2 text-sm font-bold transition ${muted(dark)}`}>
                    <ArrowLeft size={16} className="rtl:rotate-180" /> {t('instructorProfile.back')}
                </Link>
            </div>
        </MarketingShell>
    );
}
