"use client";

import { useMemo, useState } from 'react';
import { ArchiveRestore, BookOpen, CalendarClock, Flag, FileText, Search, Users } from 'lucide-react';
import { useFetchData } from '@/lib/useFetchData';
import { useI18n } from '@/lib/i18n-context';
import { PageHeader, StatCard, Badge, EmptyState } from '../components';
import EndedOpeningReportModal from '@/components/admin/EndedOpeningReportModal';
import { api, getErrorMessage } from '@/lib/api';
import toast from 'react-hot-toast';

interface Opening {
    id: string;
    status?: string | null;
    nameAr?: string | null;
    nameEn?: string | null;
    startDate?: string | null;
    endDate?: string | null;
    price?: string | null;
    courseId: string;
    instructor?: { email: string } | null;
    _count?: { enrollments?: number };
}

interface Course {
    id: string;
    titleAr?: string | null;
    titleEn?: string | null;
    openings?: Opening[];
}

interface ArchivedItems {
    courses: { id: string; titleAr?: string | null; titleEn?: string | null }[];
    openings: (Opening & {
        course: { id: string; titleAr?: string | null; titleEn?: string | null };
    })[];
}

const formatDate = (v?: string | null) => {
    if (!v) return null;
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' });
};

export default function AdminEndedPage() {
    const { t, pick } = useI18n();
    const [query, setQuery] = useState('');
    const [report, setReport] = useState<{ openingId: string; courseId: string } | null>(null);
    const [processingId, setProcessingId] = useState<string | null>(null);
    const { data: courses, loading, refetch } = useFetchData<Course[]>('/courses?includeUnpublished=true');
    const {
        data: archived,
        loading: archivedLoading,
        refetch: refetchArchived,
    } = useFetchData<ArchivedItems>('/api/admin/courses/archived');

    const restore = async (id: string, type: 'course' | 'opening' | 'ended') => {
        setProcessingId(id);
        try {
            await api.post(type === 'course' ? `/api/admin/courses/${id}/restore` : `/openings/${id}/restore`);
            toast.success(t(type === 'ended' ? 'endedCourses.restore_ended_success' : 'endedCourses.restore_success'));
            refetch();
            refetchArchived();
        } catch (err) {
            toast.error(getErrorMessage(err) || t('endedCourses.restore_failed'));
        } finally {
            setProcessingId(null);
        }
    };

    // A finished batch is the archival unit: it keeps its own roster and its own
    // certificate set, so the wrap-up report is keyed by opening, not by course.
    const ended = useMemo<(Opening & { course: Course })[]>(
        () => (courses || [])
            .flatMap(c => (c.openings || []).map(o => ({ ...o, course: c })))
            .filter(o => o.status === 'ENDED')
            .sort((a, b) => (b.endDate || '').localeCompare(a.endDate || '')),
        [courses],
    );

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return ended;
        return ended.filter(o => {
            const courseTitle = pick(o.course, 'title') || '';
            return [courseTitle, o.nameAr, o.nameEn, o.instructor?.email]
                .filter(Boolean)
                .join(' ')
                .toLowerCase()
                .includes(q);
        });
    }, [ended, query, pick]);

    const totalStudents = ended.reduce((sum, o) => sum + (o._count?.enrollments ?? 0), 0);
    const courseCount = new Set(ended.map(o => o.courseId)).size;

    return (
        <div className="space-y-6">
            <PageHeader
                title={t('endedCourses.title')}
                subtitle={t('endedCourses.subtitle')}
            />

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <StatCard
                    icon={Flag}
                    color="navy"
                    value={ended.length}
                    label={t('endedCourses.stat_batches')}
                />
                <StatCard
                    icon={BookOpen}
                    color="purple"
                    value={courseCount}
                    label={t('endedCourses.stat_courses')}
                />
                <StatCard
                    icon={Users}
                    color="green"
                    value={totalStudents}
                    label={t('endedCourses.stat_students')}
                />
            </div>

            <div className="bg-white dark:bg-brand-navy-dark border border-gray-200 dark:border-white/5 rounded-2xl shadow-sm overflow-hidden">
                <div className="p-4 border-b border-gray-100 dark:border-white/5">
                    <div className="relative max-w-md">
                        <Search size={16} className="absolute top-1/2 -translate-y-1/2 ltr:left-3 rtl:right-3 text-gray-400 pointer-events-none" />
                        <input
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                            placeholder={t('endedCourses.search_placeholder')}
                            className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl py-2.5 ltr:pl-9 rtl:pr-9 text-sm font-bold text-brand-navy dark:text-white placeholder:text-gray-400 focus:outline-none focus:border-brand-gold/50"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-gray-500 dark:text-gray-400 text-xs font-black border-b border-gray-100 dark:border-white/5">
                                <th className="text-start px-5 py-3">{t('endedCourses.col_course')}</th>
                                <th className="text-start px-5 py-3">{t('endedCourses.col_opening')}</th>
                                <th className="text-start px-5 py-3">{t('endedCourses.col_period')}</th>
                                <th className="text-start px-5 py-3">{t('endedCourses.col_students')}</th>
                                <th className="text-start px-5 py-3">{t('common.status')}</th>
                                <th className="text-start px-5 py-3"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 dark:divide-white/5">
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="p-12 text-center text-gray-400 font-bold text-sm">
                                        {t('common.loading')}
                                    </td>
                                </tr>
                            ) : filtered.length === 0 ? (
                                <EmptyState icon={CalendarClock} title={t('endedCourses.empty')} />
                            ) : (
                                filtered.map(o => {
                                    const courseTitle = pick(o.course, 'title') || t('endedCourses.untitled');
                                    const start = formatDate(o.startDate);
                                    const end = formatDate(o.endDate);
                                    return (
                                        <tr key={o.id} className="hover:bg-gray-50/70 dark:hover:bg-white/5 transition-colors">
                                            <td className="px-5 py-4">
                                                <div className="font-black text-brand-navy dark:text-white">{courseTitle}</div>
                                                {o.instructor?.email && (
                                                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5" dir="ltr">
                                                        {o.instructor.email}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-5 py-4 text-gray-600 dark:text-gray-300 font-bold">
                                                {pick(o, 'name') || t('endedCourses.col_opening')}
                                            </td>
                                            <td className="px-5 py-4 text-gray-500 dark:text-gray-400 text-xs font-bold whitespace-nowrap">
                                                {start && end ? `${start} — ${end}` : (end || start || t('endedCourses.not_set'))}
                                            </td>
                                            <td className="px-5 py-4">
                                                <span className="inline-flex items-center gap-1.5 font-black text-brand-navy dark:text-white">
                                                    <Users size={14} className="text-brand-gold" />
                                                    {o._count?.enrollments ?? 0}
                                                </span>
                                            </td>
                                            <td className="px-5 py-4">
                                                <Badge tone="gray">{t('manageCourses.status_ended')}</Badge>
                                            </td>
                                            <td className="px-5 py-4">
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={() => setReport({ openingId: o.id, courseId: o.courseId })}
                                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-gold/10 hover:bg-brand-gold/20 text-brand-gold-dark dark:text-brand-gold-light text-xs font-black transition-colors"
                                                    >
                                                        <FileText size={14} />
                                                        {t('endedCourses.view_report')}
                                                    </button>
                                                    <button
                                                        onClick={() => restore(o.id, 'ended')}
                                                        disabled={processingId === o.id}
                                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs font-black transition-colors disabled:opacity-50"
                                                    >
                                                        <ArchiveRestore size={14} />
                                                        {t('endedCourses.restore')}
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <section className="space-y-4">
                <PageHeader title={t('endedCourses.archived_title')} subtitle={t('endedCourses.archived_subtitle')} />
                {archivedLoading ? (
                    <div className="p-8 text-center text-gray-400 font-bold">{t('common.loading')}</div>
                ) : (
                    <div className="grid gap-4 lg:grid-cols-2">
                        <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-brand-navy-dark p-5 space-y-3">
                            <h3 className="font-black text-brand-navy dark:text-white">{t('endedCourses.archived_courses')}</h3>
                            {(archived?.courses ?? []).length === 0 ? (
                                <p className="text-sm text-gray-500 dark:text-gray-400">{t('endedCourses.archived_empty')}</p>
                            ) : archived?.courses.map(course => (
                                <div key={course.id} className="flex items-center justify-between gap-3 border-t border-gray-100 dark:border-white/5 pt-3">
                                    <span className="font-bold text-sm text-brand-navy dark:text-white">{pick(course, 'title') || course.id}</span>
                                    <button
                                        onClick={() => restore(course.id, 'course')}
                                        disabled={processingId === course.id}
                                        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-emerald-500/10 px-3 py-2 text-xs font-black text-emerald-700 dark:text-emerald-300 disabled:opacity-50"
                                    >
                                        <ArchiveRestore size={14} />
                                        {t('endedCourses.restore')}
                                    </button>
                                </div>
                            ))}
                        </div>
                        <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-brand-navy-dark p-5 space-y-3">
                            <h3 className="font-black text-brand-navy dark:text-white">{t('endedCourses.archived_openings')}</h3>
                            {(archived?.openings ?? []).length === 0 ? (
                                <p className="text-sm text-gray-500 dark:text-gray-400">{t('endedCourses.archived_empty')}</p>
                            ) : archived?.openings.map(opening => (
                                <div key={opening.id} className="flex items-center justify-between gap-3 border-t border-gray-100 dark:border-white/5 pt-3">
                                    <div className="min-w-0">
                                        <div className="font-bold text-sm text-brand-navy dark:text-white truncate">
                                            {pick(opening.course, 'title') || t('endedCourses.untitled')}
                                        </div>
                                        <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                            {pick(opening, 'name') || t('endedCourses.col_opening')}
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => restore(opening.id, 'opening')}
                                        disabled={processingId === opening.id}
                                        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-emerald-500/10 px-3 py-2 text-xs font-black text-emerald-700 dark:text-emerald-300 disabled:opacity-50"
                                    >
                                        <ArchiveRestore size={14} />
                                        {t('endedCourses.restore')}
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </section>

            {report && (
                <EndedOpeningReportModal
                    openingId={report.openingId}
                    courseId={report.courseId}
                    onClose={() => setReport(null)}
                />
            )}
        </div>
    );
}
