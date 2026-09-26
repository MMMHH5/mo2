"use client";

import { useState } from 'react';
import Link from 'next/link';
import {
    BookOpen,
    CheckCircle2,
    ChevronDown,
    Clock,
    Eye,
    Layers,
    Lock,
    Sparkles,
    Star,
    Unlock,
    Users,
} from 'lucide-react';
import { API_BASE_URL } from '@/lib/api';
import { formatNumber, formatPrice } from '@/lib/format';
import { useI18n } from '@/lib/i18n-context';

export interface PublicOpening {
    id: string;
    status?: string | null;
    price: string;
    /** Struck through on the card when the opening is discounted. */
    priceOld?: string | null;
}

export interface OutlineLesson {
    id: string;
    titleAr: string;
    titleEn: string;
    orderIndex: number;
    durationMinutes?: number | null;
    isFree: boolean;
}

export interface OutlineChapter {
    id: string | null;
    titleAr?: string | null;
    titleEn?: string | null;
    lessons: OutlineLesson[];
}

export interface PublicCourse {
    id: string;
    level?: string | null;
    language?: string | null;
    coverImageUrl?: string | null;
    excerptAr?: string | null;
    excerptEn?: string | null;
    categoryAr?: string | null;
    categoryEn?: string | null;
    titleAr?: string | null;
    titleEn?: string | null;
    descriptionAr?: string | null;
    descriptionEn?: string | null;
    durationAr?: string | null;
    durationEn?: string | null;
    openings?: PublicOpening[];
    outline?: OutlineChapter[];
    _count?: { enrollments?: number; modules?: number };
    /** Mean of published CourseReview rows, 0 when nobody has reviewed yet. */
    averageRating?: number;
    reviewCount?: number;
}

interface CourseCardProps {
    course: PublicCourse;
    isDark?: boolean;
    /** Omit to render a single "view details" call to action. */
    onEnroll?: (course: PublicCourse) => void;
    onReserve?: (course: PublicCourse) => void;
    /** The home page renders fewer, taller cards. */
    variant?: 'default' | 'featured';
    className?: string;
}

const CHAPTERS_PREVIEW = 3;
const LESSONS_PREVIEW = 3;

export default function CourseCard({
    course,
    isDark = false,
    onEnroll,
    onReserve,
    variant = 'default',
    className = '',
}: CourseCardProps) {
    const { t, pick, locale } = useI18n();
    // The outline is depth, not hook: the card has to answer what/for/how-much
    // in a glance, so the syllabus stays one tap away.
    const [outlineOpen, setOutlineOpen] = useState(false);
    const [expanded, setExpanded] = useState(false);

    const openOpening = course.openings?.find(o => o.status === 'OPEN');
    const announcedOpening = course.openings?.find(o => o.status === 'ANNOUNCEMENT');
    const current = openOpening ?? announcedOpening;
    const isOpen = !!openOpening;
    const announced = !isOpen && !!announcedOpening;

    const levelLabel = t(`course.level_${String(course.level || 'BEGINNER').toLowerCase()}`);
    const price = current
        ? (Number(current.price) === 0 ? t('course.free') : formatPrice(current.price, { locale }))
        : t('courseDetail.not_open_yet');
    const discounted = !!current && !!current.priceOld && Number(current.priceOld) > Number(current.price);
    const oldPrice = discounted ? formatPrice(current!.priceOld!, { locale }) : null;

    const reviewCount = course.reviewCount ?? 0;
    const averageRating = course.averageRating ?? 0;
    const studentCount = course._count?.enrollments ?? 0;

    const outline = course.outline ?? [];
    const chapters = outline.filter(c => c.lessons.length > 0);
    const totalLessons = chapters.reduce((sum, c) => sum + c.lessons.length, 0);
    const visibleChapters = expanded ? chapters : chapters.slice(0, CHAPTERS_PREVIEW);
    const hiddenCount = chapters.length - visibleChapters.length;
    const hiddenLessons = hiddenCount > 0
        ? chapters.slice(CHAPTERS_PREVIEW).reduce((sum, c) => sum + c.lessons.length, 0)
        : 0;

    const count = (key: string, n: number) => t(key).replace('{n}', formatNumber(n, locale));
    const hasSecondCta = isOpen ? !!onEnroll : announced ? !!onReserve : false;

    return (
        <article
            className={`group flex h-full flex-col overflow-hidden rounded-3xl border transition-all duration-300 animate-fade-in-up hover:-translate-y-1 ${
                isDark
                    ? 'border-white/5 bg-brand-navy hover:border-brand-gold/30 hover:shadow-2xl hover:shadow-black/30'
                    : 'border-brand-mist/70 bg-white shadow-sm hover:border-brand-gold/40 hover:shadow-2xl hover:shadow-brand-navy/10'
            } ${className}`}
        >
            {/* Cover */}
            <Link href={`/courses/${course.id}`} className={`relative block overflow-hidden ${variant === 'featured' ? 'h-56' : 'h-52'}`}>
                {course.coverImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                        src={`${API_BASE_URL}${course.coverImageUrl}`}
                        alt={pick(course, 'title') || ''}
                        className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-brand-navy via-brand-navy/90 to-brand-mist">
                        <BookOpen size={variant === 'featured' ? 44 : 52} className="mb-2 text-brand-gold opacity-60 transition-transform duration-500 group-hover:scale-110" />
                    </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-brand-navy/55 via-transparent to-transparent opacity-70 transition-opacity group-hover:opacity-90" aria-hidden />
                <span className="absolute end-4 top-4 rounded-full border border-white/10 bg-brand-navy/90 px-3.5 py-1.5 text-sm font-black text-brand-gold shadow-lg backdrop-blur-sm flex items-center gap-1.5">
                    {oldPrice && (
                        <s className="text-[11px] font-bold text-gray-400">{oldPrice}</s>
                    )}
                    {price}
                </span>
                <div className="absolute bottom-3 start-3 flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-3 py-1 text-xs font-black shadow-sm backdrop-blur-sm ${isDark ? 'border border-white/10 bg-black/40 text-white' : 'bg-white/95 text-brand-navy'}`}>
                        {levelLabel}
                    </span>
                    {isOpen && (
                        <span className="flex items-center gap-1 rounded-full bg-green-500 px-3 py-1 text-xs font-black text-white shadow-sm">
                            <CheckCircle2 size={12} /> {t('statuses.open')}
                        </span>
                    )}
                    {announced && (
                        <span className="flex items-center gap-1 rounded-full bg-brand-gold px-3 py-1 text-xs font-black text-brand-navy-dark shadow-sm">
                            <Sparkles size={12} /> {t('explore.announced_pill')}
                        </span>
                    )}
                </div>
            </Link>

            {/* Body */}
            <div className="flex flex-1 flex-col p-6">
                {(pick(course, 'category') || course.language) && (
                    <div className="mb-2.5 flex flex-wrap gap-2">
                        {pick(course, 'category') && (
                            <span className={`rounded-full px-2.5 py-1 text-[11px] font-black ${isDark ? 'bg-brand-gold/15 text-brand-gold-light' : 'bg-brand-gold/10 text-brand-gold-dark'}`}>
                                {pick(course, 'category')}
                            </span>
                        )}
                        {course.language && (
                            <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${isDark ? 'bg-white/5 text-gray-300' : 'bg-gray-100 text-gray-500'}`}>
                                {course.language}
                            </span>
                        )}
                    </div>
                )}

                <Link href={`/courses/${course.id}`}>
                    <h3 className={`mb-2 line-clamp-2 text-xl font-black leading-snug transition-colors ${isDark ? 'text-white group-hover:text-brand-gold-light' : 'text-brand-charcoal group-hover:text-brand-navy'}`}>
                        {pick(course, 'title')}
                    </h3>
                </Link>
                <p className={`mb-4 line-clamp-2 text-sm leading-relaxed ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    {pick(course, 'excerpt') || pick(course, 'description')}
                </p>

                {/* ★ rating · N reviews · N students */}
                <div className={`mb-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs font-bold ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    {reviewCount > 0 && (
                        <span className="inline-flex items-center gap-1" title={t('explore.rating_title')}>
                            <span className="inline-flex items-center gap-0.5" aria-hidden>
                                {[1, 2, 3, 4, 5].map(star => (
                                    <Star
                                        key={star}
                                        size={13}
                                        className={star <= Math.round(averageRating)
                                            ? 'fill-brand-gold text-brand-gold'
                                            : isDark ? 'text-gray-600' : 'text-gray-300'}
                                    />
                                ))}
                            </span>
                            <span className={isDark ? 'text-gray-200' : 'text-brand-charcoal'}>{averageRating.toFixed(1)}</span>
                            <span>({formatNumber(reviewCount, locale)})</span>
                        </span>
                    )}
                    {totalLessons > 0 && (
                        <span className="inline-flex items-center gap-1.5">
                            <BookOpen size={14} className={isDark ? 'text-brand-gold-light' : 'text-brand-gold'} />
                            {count('explore.outline_lessons_count', totalLessons)}
                        </span>
                    )}
                    {pick(course, 'duration') && (
                        <span className="inline-flex items-center gap-1.5">
                            <Clock size={14} className={isDark ? 'text-brand-gold-light' : 'text-brand-gold'} />
                            {pick(course, 'duration')}
                        </span>
                    )}
                    {studentCount > 0 && (
                        <span className="inline-flex items-center gap-1.5">
                            <Users size={14} className={isDark ? 'text-brand-gold-light' : 'text-brand-gold'} />
                            {formatNumber(studentCount, locale)} {t('explore.students')}
                        </span>
                    )}
                </div>

                {/* Course outline (محاور الدورة) — hidden until asked for */}
                {chapters.length > 0 && (
                    <div className={`mb-5 overflow-hidden rounded-2xl border ${isDark ? 'border-white/5 bg-white/[0.03]' : 'border-brand-mist/80 bg-brand-white'}`}>
                        <button
                            type="button"
                            onClick={() => setOutlineOpen(v => !v)}
                            aria-expanded={outlineOpen}
                            className={`flex w-full items-center gap-2 px-4 py-2.5 text-start transition-colors cursor-pointer ${isDark ? 'hover:bg-white/5' : 'hover:bg-brand-mist/40'}`}
                        >
                            <Layers size={15} className={isDark ? 'text-brand-gold-light' : 'text-brand-gold'} />
                            <span className={`text-xs font-black uppercase tracking-wide ${isDark ? 'text-white' : 'text-brand-navy'}`}>
                                {t('explore.outline_heading')}
                            </span>
                            <span className={`ms-auto rounded-full px-2 py-0.5 text-[10px] font-black ${isDark ? 'bg-white/5 text-gray-400' : 'bg-brand-mist/70 text-gray-500'}`}>
                                {count('explore.outline_chapters_count', chapters.length)}
                            </span>
                            <ChevronDown size={15} className={`shrink-0 transition-transform duration-300 ${outlineOpen ? 'rotate-180' : ''} ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
                        </button>

                        {outlineOpen && (
                            <>
                        <ul className="divide-y border-t px-4 py-1">
                            {visibleChapters.map((chapter, ci) => {
                                const lessons = expanded ? chapter.lessons : chapter.lessons.slice(0, LESSONS_PREVIEW);
                                const restCount = chapter.lessons.length - lessons.length;
                                const title = chapter.titleAr || chapter.titleEn;
                                return (
                                    <li key={chapter.id || `flat-${ci}`} className="py-2.5">
                                        {title && (
                                            <div className="flex items-center gap-2">
                                                <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[10px] font-black ${isDark ? 'bg-brand-gold/20 text-brand-gold-light' : 'bg-brand-gold/15 text-brand-gold-dark'}`}>
                                                    {formatNumber(ci + 1, locale)}
                                                </span>
                                                <span className={`text-[13px] font-bold leading-snug ${isDark ? 'text-gray-100' : 'text-brand-charcoal'}`}>
                                                    {pick(chapter, 'title')}
                                                </span>
                                            </div>
                                        )}
                                        <ul className="mt-1.5 space-y-1 ps-7">
                                            {lessons.map((lesson) => (
                                                <li key={lesson.id} className={`flex items-start gap-2 text-[12px] leading-snug ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                                    <span className={`mt-1.5 h-1 w-1 shrink-0 rounded-full ${isDark ? 'bg-gray-600' : 'bg-brand-mist'}`} aria-hidden />
                                                    <span className="flex-1">{pick(lesson, 'title')}</span>
                                                    {lesson.isFree ? (
                                                        <span className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-black uppercase ${isDark ? 'bg-brand-gold/20 text-brand-gold-light' : 'bg-brand-gold/15 text-brand-gold-dark'}`}>
                                                            {t('explore.outline_free')}
                                                        </span>
                                                    ) : (
                                                        <Lock size={11} className={`mt-0.5 shrink-0 ${isDark ? 'text-gray-600' : 'text-gray-400'}`} aria-label={t('explore.outline_locked')} />
                                                    )}
                                                </li>
                            ))}
                                            {restCount > 0 && (
                                                <li className={`text-[11px] font-bold ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                                    {count('explore.outline_more_lessons', restCount)}
                                                </li>
                                            )}
                                        </ul>
                                    </li>
                                );
                            })}
                        </ul>

                        {(hiddenCount > 0 || expanded) && (
                            <button
                                type="button"
                                onClick={() => setExpanded(v => !v)}
                                className={`flex w-full items-center justify-center gap-1.5 border-t py-2.5 text-[11px] font-black transition-colors cursor-pointer ${isDark ? 'border-white/5 text-brand-gold-light hover:bg-white/5' : 'border-brand-mist/80 text-brand-gold-dark hover:bg-brand-gold/5'}`}
                            >
                                {expanded
                                    ? t('explore.outline_hide')
                                    : `${t('explore.outline_show')} (+${formatNumber(hiddenLessons, locale)})`}
                                <ChevronDown size={14} className={`transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`} />
                            </button>
                        )}
                            </>
                        )}
                    </div>
                )}

                {/* Calls to action */}
                <div className={`mt-auto grid gap-3 ${hasSecondCta ? 'grid-cols-1 min-[420px]:grid-cols-2' : 'grid-cols-1'}`}>
                    <Link
                        href={`/courses/${course.id}`}
                        className={`flex items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-bold transition-all ${
                            isDark
                                ? 'border border-white/10 text-gray-300 hover:border-brand-gold/40 hover:bg-white/5 hover:text-white'
                                : 'border-2 border-brand-mist text-brand-charcoal hover:border-brand-navy hover:bg-brand-navy/5 hover:text-brand-navy'
                        }`}
                    >
                        <Eye size={16} /> {t('explore.view_details')}
                    </Link>
                    {isOpen && onEnroll && (
                        <button
                            type="button"
                            onClick={() => onEnroll(course)}
                            className={`flex items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-bold shadow-md transition-all cursor-pointer ${
                                isDark
                                    ? 'bg-brand-gold text-brand-navy-dark shadow-brand-gold/25 hover:bg-brand-gold-light'
                                    : 'bg-brand-navy text-white shadow-brand-navy/20 hover:bg-brand-charcoal'
                            }`}
                        >
                            <Sparkles size={16} /> {t('explore.enroll_now')}
                        </button>
                    )}
                    {announced && onReserve && (
                        <button
                            type="button"
                            onClick={() => onReserve(course)}
                            className={`flex items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-bold transition-all cursor-pointer ${
                                isDark
                                    ? 'border border-brand-gold/40 text-brand-gold-light hover:bg-brand-gold hover:text-brand-navy-dark'
                                    : 'border-2 border-brand-gold/50 text-brand-navy hover:bg-brand-gold'
                            }`}
                        >
                            <Unlock size={16} /> {t('courseDetail.reserve_seat')}
                        </button>
                    )}
                    {!isOpen && !announced && (
                        <span className={`rounded-xl py-3.5 text-center text-sm font-bold ${isDark ? 'bg-white/5 text-gray-400' : 'bg-gray-50 text-gray-500'}`}>
                            {t('courseDetail.not_open_yet')}
                        </span>
                    )}
                </div>
            </div>
        </article>
    );
}
