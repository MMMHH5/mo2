"use client";

import { useEffect, useState } from 'react';
import { MessageSquareText, RefreshCw, Star, Users } from 'lucide-react';
import { api, getErrorMessage } from '@/lib/api';
import { useI18n } from '@/lib/i18n-context';
import toast from 'react-hot-toast';
import { PageHeader, StatCard } from '../components';

interface EvaluationOpening {
    id: string;
    nameAr?: string | null;
    nameEn?: string | null;
    status: string;
    course: { id: string; titleAr: string; titleEn: string };
    instructor: { id: string; email: string };
    responseCount: number;
    approvedStudentCount: number;
    averageCourseRating: number;
    averageInstructorRating: number;
}

interface EvaluationRow {
    id: string;
    courseRating: number;
    instructorRating: number;
    commentAr?: string | null;
    commentEn?: string | null;
    createdAt: string;
    enrollment: {
        student: {
            id: string;
            email: string;
            metadata?: Record<string, unknown> | null;
        };
    };
}

interface OpeningDetails {
    opening: EvaluationOpening;
    responseCount: number;
    approvedStudentCount: number;
    averageCourseRating: number;
    averageInstructorRating: number;
    evaluations: EvaluationRow[];
}

function studentName(metadata?: Record<string, unknown> | null) {
    if (!metadata) return null;
    for (const key of ['nameAr', 'nameEn', 'fullName']) {
        const value = metadata[key];
        if (typeof value === 'string' && value.trim()) return value.trim();
    }
    return null;
}

export default function CourseEvaluationsPage() {
    const { locale, pick } = useI18n();
    const isAr = locale === 'ar';
    const [openings, setOpenings] = useState<EvaluationOpening[]>([]);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [details, setDetails] = useState<OpeningDetails | null>(null);
    const [loading, setLoading] = useState(true);
    const [detailsReadyFor, setDetailsReadyFor] = useState<string | null>(null);
    const [detailsErrorFor, setDetailsErrorFor] = useState<string | null>(null);
    const [detailsRetry, setDetailsRetry] = useState(0);

    const loadOpenings = async () => {
        try {
            const response = await api.get('/course-evaluations/admin/openings');
            const rows = response.data as EvaluationOpening[];
            setOpenings(rows);
            setSelectedId((current) => current && rows.some((row) => row.id === current) ? current : rows[0]?.id ?? null);
        } catch (error) {
            toast.error(getErrorMessage(error) || (isAr ? 'تعذر تحميل التقييمات' : 'Could not load evaluations'));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        let active = true;
        api.get('/course-evaluations/admin/openings')
            .then((response) => {
                if (!active) return;
                const rows = response.data as EvaluationOpening[];
                setOpenings(rows);
                setSelectedId((current) => current && rows.some((row) => row.id === current) ? current : rows[0]?.id ?? null);
            })
            .catch((error) => {
                if (active) toast.error(getErrorMessage(error) || (isAr ? 'تعذر تحميل التقييمات' : 'Could not load evaluations'));
            })
            .finally(() => {
                if (active) setLoading(false);
            });
        return () => { active = false; };
        // Only load the current language on mount; request data is language-neutral.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (!selectedId) return;
        let active = true;
        api.get(`/course-evaluations/admin/openings/${selectedId}`)
            .then((response) => {
                if (active) {
                    setDetails(response.data as OpeningDetails);
                    setDetailsReadyFor(selectedId);
                    setDetailsErrorFor(null);
                }
            })
            .catch((error) => {
                if (active) {
                    setDetailsErrorFor(selectedId);
                    toast.error(getErrorMessage(error) || (isAr ? 'تعذر تحميل تفاصيل التقييم' : 'Could not load evaluation details'));
                }
            });
        return () => { active = false; };
    }, [selectedId, detailsRetry, isAr]);

    const summary = openings.find((opening) => opening.id === selectedId);
    const visibleDetails = details?.opening.id === selectedId ? details : null;
    const detailsLoading = Boolean(selectedId && detailsReadyFor !== selectedId && detailsErrorFor !== selectedId);
    const completionRate = visibleDetails?.approvedStudentCount
        ? Math.round((visibleDetails.responseCount / visibleDetails.approvedStudentCount) * 100)
        : 0;

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
                <PageHeader
                    title={isAr ? 'تقييمات نهاية الدورات' : 'End-of-course evaluations'}
                    subtitle={isAr
                        ? 'نتائج سرية لا تظهر إلا للمدير ومدير الدورات.'
                        : 'Confidential feedback visible only to administrators and course managers.'}
                />
                <button
                    type="button"
                    onClick={() => { setLoading(true); void loadOpenings(); }}
                    disabled={loading}
                    className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-bold text-brand-navy transition hover:bg-gray-50 disabled:opacity-50 dark:border-white/10 dark:text-white dark:hover:bg-white/5"
                >
                    <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
                    {isAr ? 'تحديث' : 'Refresh'}
                </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
                <StatCard icon={Users} color="blue" value={openings.length} label={isAr ? 'دفعات لديها تقييمات' : 'Batches with feedback'} />
                <StatCard icon={MessageSquareText} color="green" value={openings.reduce((sum, item) => sum + item.responseCount, 0)} label={isAr ? 'إجمالي الردود' : 'Total responses'} />
                <StatCard icon={Star} color="amber" value={summary ? `${summary.averageCourseRating.toFixed(1)} / 5` : '—'} label={isAr ? 'متوسط تقييم الدورة' : 'Selected course rating'} />
            </div>

            <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-white/5 dark:bg-brand-navy-dark">
                <div className="border-b border-gray-100 p-4 dark:border-white/5">
                    <h2 className="font-black text-brand-navy dark:text-white">
                        {isAr ? 'اختر دفعة لمراجعة نتائجها' : 'Choose a batch to review its results'}
                    </h2>
                </div>
                {loading ? (
                    <p className="p-8 text-center text-sm font-bold text-gray-400">{isAr ? 'جارٍ التحميل...' : 'Loading...'}</p>
                ) : openings.length === 0 ? (
                    <p className="p-8 text-center text-sm font-bold text-gray-400">
                        {isAr ? 'لا توجد تقييمات مرسلة حتى الآن.' : 'No evaluations have been submitted yet.'}
                    </p>
                ) : (
                    <div className="flex flex-wrap gap-2 p-4">
                        {openings.map((opening) => (
                            <button
                                key={opening.id}
                                type="button"
                                onClick={() => setSelectedId(opening.id)}
                                className={`rounded-xl border px-4 py-3 text-start transition ${
                                    opening.id === selectedId
                                        ? 'border-brand-gold bg-brand-gold/10'
                                        : 'border-gray-200 hover:border-brand-gold/50 dark:border-white/10'
                                }`}
                            >
                                <span className="block font-black text-brand-navy dark:text-white">{pick(opening.course, 'title')}</span>
                                <span className="mt-1 block text-xs text-gray-500 dark:text-gray-400">
                                    {pick(opening, 'name') || (isAr ? 'الدفعة' : 'Opening')} · {opening.responseCount}/{opening.approvedStudentCount}
                                </span>
                            </button>
                        ))}
                    </div>
                )}
            </section>

            {detailsLoading ? (
                <p className="p-8 text-center text-sm font-bold text-gray-400">{isAr ? 'جارٍ تحميل النتائج...' : 'Loading results...'}</p>
            ) : detailsErrorFor === selectedId ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
                    <p className="font-bold">{isAr ? 'تعذر تحميل نتائج هذه الدفعة.' : 'Could not load this batch’s results.'}</p>
                    <button
                        type="button"
                        onClick={() => { setDetailsErrorFor(null); setDetailsRetry((value) => value + 1); }}
                        className="mt-3 rounded-lg border border-current px-3 py-1.5 font-bold"
                    >
                        {isAr ? 'إعادة المحاولة' : 'Try again'}
                    </button>
                </div>
            ) : visibleDetails && (
                <>
                    <section className="grid gap-4 sm:grid-cols-3">
                        <StatCard icon={Star} color="purple" value={`${visibleDetails.averageCourseRating.toFixed(1)} / 5`} label={isAr ? 'متوسط تقييم الدورة' : 'Course rating average'} />
                        <StatCard icon={Star} color="amber" value={`${visibleDetails.averageInstructorRating.toFixed(1)} / 5`} label={isAr ? 'متوسط تقييم المدرّب' : 'Instructor rating average'} />
                        <StatCard icon={Users} color="green" value={`${visibleDetails.responseCount}/${visibleDetails.approvedStudentCount} · ${completionRate}%`} label={isAr ? 'الطلاب الذين أرسلوا التقييم' : 'Students who submitted'} />
                    </section>

                    <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-white/5 dark:bg-brand-navy-dark">
                        <div className="border-b border-gray-100 p-4 dark:border-white/5">
                            <h2 className="font-black text-brand-navy dark:text-white">{isAr ? 'التقييمات الفردية' : 'Individual evaluations'}</h2>
                            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                {pick(visibleDetails.opening.course, 'title')} · {visibleDetails.opening.instructor.email}
                            </p>
                        </div>
                        <div className="divide-y divide-gray-100 dark:divide-white/5">
                            {visibleDetails.evaluations.map((evaluation) => {
                                const name = studentName(evaluation.enrollment.student.metadata);
                                const comment = isAr
                                    ? evaluation.commentAr || evaluation.commentEn
                                    : evaluation.commentEn || evaluation.commentAr;
                                return (
                                    <article key={evaluation.id} className="grid gap-3 p-4 sm:grid-cols-[minmax(180px,1fr)_repeat(2,minmax(130px,0.7fr))_minmax(220px,2fr)] sm:items-start">
                                        <div className="min-w-0">
                                            <p className="break-words font-bold text-brand-navy dark:text-white">{name || evaluation.enrollment.student.email}</p>
                                            {name && <p className="mt-0.5 break-all text-xs text-gray-500 dark:text-gray-400">{evaluation.enrollment.student.email}</p>}
                                            <time className="mt-1 block text-xs text-gray-400" dateTime={evaluation.createdAt}>
                                                {new Date(evaluation.createdAt).toLocaleDateString(isAr ? 'ar' : 'en')}
                                            </time>
                                        </div>
                                        <Rating label={isAr ? 'الدورة' : 'Course'} value={evaluation.courseRating} />
                                        <Rating label={isAr ? 'المدرّب' : 'Instructor'} value={evaluation.instructorRating} />
                                        <p className="whitespace-pre-wrap break-words text-sm leading-6 text-gray-600 dark:text-gray-300">
                                            {comment || (isAr ? 'لا توجد ملاحظات مكتوبة.' : 'No written comment.')}
                                        </p>
                                    </article>
                                );
                            })}
                        </div>
                    </section>
                </>
            )}
        </div>
    );
}

function Rating({ label, value }: { label: string; value: number }) {
    return (
        <div>
            <p className="mb-1 text-xs font-bold text-gray-500 dark:text-gray-400">{label}: {value}/5</p>
            <div className="flex text-amber-500" aria-label={`${value} / 5`}>
                {[1, 2, 3, 4, 5].map((star) => <Star key={star} size={14} fill={star <= value ? 'currentColor' : 'none'} />)}
            </div>
        </div>
    );
}
