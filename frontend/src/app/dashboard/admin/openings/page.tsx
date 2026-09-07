"use client";

import { useFetchData } from '@/lib/useFetchData';
import { api, getErrorMessage } from '@/lib/api';
import { useI18n } from '@/lib/i18n-context';
import { useState } from 'react';
import toast from 'react-hot-toast';
import Link from 'next/link';
import { Pencil, Trash2, Users, Search, PlusCircle, CalendarClock, Megaphone, Unlock, Play, Flag } from 'lucide-react';
import { PageHeader, Badge, EmptyState, BtnPrimary, type Tone } from '../components';

interface Opening {
    id: string;
    status?: string | null;
    nameAr?: string | null;
    nameEn?: string | null;
    startDate?: string | null;
    endDate?: string | null;
    enrollmentDeadline?: string | null;
    price: string;
    priceOld?: string | null;
    maxStudents?: number | null;
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

type FilterKey = 'ALL' | 'OPEN' | 'PLANNED';

const isActiveStatus = (s?: string | null) => s === 'ANNOUNCEMENT' || s === 'OPEN' || s === 'STARTED';

export default function AdminOpeningsPage() {
    const { data: courses, loading, error, refetch } = useFetchData<Course[]>('/courses?includeUnpublished=true');
    const { t, pick } = useI18n();
    const [query, setQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<FilterKey>('ALL');
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [modal, setModal] = useState<{ opening: Opening; startAt: string; endAt: string } | null>(null);

    const allOpenings: (Opening & { course?: Course })[] = (courses || []).flatMap(c =>
        (c.openings || []).map(o => ({ ...o, course: c }))
    );

    const filtered = allOpenings.filter(o => {
        if (statusFilter === 'OPEN' && !isActiveStatus(o.status)) return false;
        if (statusFilter === 'PLANNED' && isActiveStatus(o.status)) return false;
        if (!query.trim()) return true;
        const q = query.toLowerCase();
        return (o.nameAr || '').toLowerCase().includes(q) || (o.nameEn || '').toLowerCase().includes(q)
            || (o.course?.titleAr || '').toLowerCase().includes(q) || (o.course?.titleEn || '').toLowerCase().includes(q)
            || (o.instructor?.email || '').toLowerCase().includes(q);
    });

    const openCount = allOpenings.filter(o => isActiveStatus(o.status)).length;
    const plannedCount = allOpenings.length - openCount;

    const statusMeta = (s?: string | null): { tone: Tone; label: string } => {
        switch (s) {
            case 'ANNOUNCEMENT': return { tone: 'blue', label: t('manageCourses.status_announcement') };
            case 'OPEN': return { tone: 'green', label: t('manageCourses.status_open') };
            case 'STARTED': return { tone: 'teal', label: t('manageCourses.status_started') };
            case 'ENDED': return { tone: 'gray', label: t('manageCourses.status_ended') };
            default: return { tone: 'amber', label: t('manageCourses.status_draft') };
        }
    };

    const runLifecycle = async (o: Opening, action: 'open' | 'start' | 'end') => {
        setProcessingId(o.id);
        try {
            await api.post(`/openings/${o.id}/${action}`);
            toast.success(t('manageCourses.opening_status_updated'));
            refetch();
        } catch (err) {
            toast.error(getErrorMessage(err) || t('manageCourses.opening_status_fail'));
        }
        setProcessingId(null);
    };

    const openAnnounceModal = (o: Opening) => {
        const today = new Date();
        const startAt = today.toISOString().slice(0, 10);
        today.setDate(today.getDate() + 7);
        const endAt = today.toISOString().slice(0, 10);
        setModal({ opening: o, startAt, endAt });
    };

    const confirmAnnounce = async () => {
        if (!modal || !modal.startAt || !modal.endAt) return;
        setProcessingId(modal.opening.id);
        try {
            await api.post(`/openings/${modal.opening.id}/announcement`, {
                announcementStartAt: new Date(`${modal.startAt}T00:00:00Z`).toISOString(),
                announcementEndAt: new Date(`${modal.endAt}T00:00:00Z`).toISOString(),
            });
            toast.success(t('manageCourses.opening_status_updated'));
            setModal(null);
            refetch();
        } catch (err) {
            toast.error(getErrorMessage(err) || t('manageCourses.opening_status_fail'));
        }
        setProcessingId(null);
    };

    const lifecycleBtn = (o: Opening) => {
        const disabled = processingId === o.id;
        const base = 'admin-action-btn tooltip disabled:opacity-40';
        switch (o.status) {
            case 'ANNOUNCEMENT':
                return (
                    <button onClick={() => runLifecycle(o, 'open')} disabled={disabled}
                        className={`${base} text-emerald-400 hover:bg-emerald-500/10`}
                        title={t('manageCourses.action_open_tooltip')}>
                        <Unlock size={18} />
                    </button>
                );
            case 'OPEN':
                return (
                    <button onClick={() => runLifecycle(o, 'start')} disabled={disabled}
                        className={`${base} text-teal-400 hover:bg-teal-500/10`}
                        title={t('manageCourses.action_start_tooltip')}>
                        <Play size={18} />
                    </button>
                );
            case 'STARTED':
                return (
                    <button onClick={() => runLifecycle(o, 'end')} disabled={disabled}
                        className={`${base} text-red-400 hover:bg-red-500/10`}
                        title={t('manageCourses.action_end_tooltip')}>
                        <Flag size={18} />
                    </button>
                );
            case 'DRAFT':
            default:
                return (
                    <button onClick={() => openAnnounceModal(o)} disabled={disabled}
                        className={`${base} text-blue-400 hover:bg-blue-500/10`}
                        title={t('manageCourses.action_announce_tooltip')}>
                        <Megaphone size={18} />
                    </button>
                );
        }
    };

    const handleDelete = async (o: Opening) => {
        if (!window.confirm(t('manageCourses.delete_opening_confirm'))) return;
        setProcessingId(o.id);
        try {
            await api.delete(`/openings/${o.id}`);
            toast.success(t('manageCourses.opening_deleted'));
            refetch();
        } catch {
            toast.error(t('manageCourses.opening_delete_fail'));
        }
        setProcessingId(null);
    };

    const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString() : '—');
    const seatsFilled = (o: Opening) => o._count?.enrollments ?? 0;
    const seatsLabel = (o: Opening) => o.maxStudents ? `${seatsFilled(o)}/${o.maxStudents}` : `${seatsFilled(o)}`;
    const seatsPct = (o: Opening) => o.maxStudents ? Math.min(100, Math.round((seatsFilled(o) / o.maxStudents) * 100)) : null;

    const filterBtn = (key: FilterKey, label: string) => (
        <button
            onClick={() => setStatusFilter(key)}
            className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 ${statusFilter === key
                ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-black shadow-md'
                : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10'
                }`}
        >
            {label}
        </button>
    );

    return (
        <div className="space-y-6 animate-fade-in">
            <PageHeader
                title={t('admin.openings_heading')}
                subtitle={t('admin.openings_subtitle')}
                actions={
                    <>
                        <div className="flex items-center gap-2 bg-white/5 rounded-xl p-1">
                            {filterBtn('ALL', t('admin.filter_all'))}
                            {filterBtn('OPEN', `${t('admin.filter_open')} · ${openCount}`)}
                            {filterBtn('PLANNED', `${t('admin.filter_planned')} · ${plannedCount}`)}
                        </div>
                        <div className="relative">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                            <input
                                value={query}
                                onChange={e => setQuery(e.target.value)}
                                placeholder={t('admin.search_openings')}
                                className="ps-9 pe-3 py-2.5 border border-white/10 rounded-xl text-sm w-52 bg-[#0a1830] text-white placeholder:text-gray-500 focus:ring-2 focus:ring-amber-500 outline-none transition"
                            />
                        </div>
                        <BtnPrimary href="/dashboard/admin/courses" icon={PlusCircle}>{t('admin.new_opening')}</BtnPrimary>
                    </>
                }
            />

            {error && <div className="p-4 bg-red-500/10 text-red-400 border border-red-500/20 rounded-xl">{error}</div>}

            {loading ? (
                <div className="h-40 flex items-center justify-center font-bold text-gray-400">{t('admin.loading_courses')}</div>
            ) : (
                <div className="admin-table-wrap animate-fade-in-up">
                    <table className="admin-table text-left">
                        <thead>
                            <tr>
                                <th>{t('admin.col_batch')}</th>
                                <th>{t('admin.col_course')}</th>
                                <th>{t('admin.col_dates')}</th>
                                <th>{t('admin.col_deadline')}</th>
                                <th>{t('manageCourses.col_price')}</th>
                                <th>{t('admin.col_seats')}</th>
                                <th>{t('admin.col_instructor')}</th>
                                <th>{t('manageCourses.col_status')}</th>
                                <th className="text-right">{t('manageCourses.col_actions')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {filtered.map((o) => {
                                const pct = seatsPct(o);
                                const meta = statusMeta(o.status);
                                return (
                                    <tr key={o.id} className="animate-fade-in hover:bg-white/5">
                                        <td className="p-4 font-bold text-gray-200 min-w-[150px]">
                                            {pick(o, 'name') || t('manageCourses.opening_default')}
                                            {o.priceOld && <span className="block text-xs text-gray-500 line-through font-normal mt-0.5">${o.priceOld}</span>}
                                        </td>
                                        <td className="p-4 text-sm text-gray-400">{pick(o.course, 'title') || o.courseId.slice(0, 8)}</td>
                                        <td className="p-4 text-sm text-gray-400">
                                            <div>{fmtDate(o.startDate)} → {fmtDate(o.endDate)}</div>
                                        </td>
                                        <td className="p-4 text-sm text-gray-400">{fmtDate(o.enrollmentDeadline)}</td>
                                        <td className="p-4 font-black text-emerald-400">${o.price}</td>
                                        <td className="p-4 text-sm text-gray-400 w-40">
                                            <div className="flex items-center justify-between mb-1.5">
                                                <span className="inline-flex items-center gap-1.5 font-bold"><Users size={14} className="text-gray-500" /> {seatsLabel(o)}</span>
                                            </div>
                                            {pct !== null && (
                                                <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                                                    <div className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-600" style={{ width: `${pct}%` }} />
                                                </div>
                                            )}
                                        </td>
                                        <td className="p-4 text-sm text-gray-500 max-w-[180px] truncate">{o.instructor?.email || '—'}</td>
                                        <td className="p-4">
                                            <Badge tone={meta.tone} dot>
                                                {meta.label}
                                            </Badge>
                                        </td>
                                        <td className="p-4 text-right whitespace-nowrap">
                                            {lifecycleBtn(o)}
                                            <Link href={`/dashboard/courses/open/${o.courseId}?edit=${o.id}`}>
                                                <button className="admin-action-btn text-blue-400 hover:bg-blue-500/10 tooltip" title={t('manageCourses.edit_opening_tooltip')}>
                                                    <Pencil size={18} />
                                                </button>
                                            </Link>
                                            <button
                                                onClick={() => handleDelete(o)}
                                                disabled={processingId === o.id}
                                                className="admin-action-btn tooltip disabled:opacity-40 text-red-400 hover:bg-red-500/10"
                                                title={t('manageCourses.delete_tooltip')}
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                            {filtered.length === 0 && (
                                <EmptyState icon={CalendarClock} title={t('manageCourses.no_openings')} />
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {modal && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
                    onClick={() => setModal(null)}
                >
                    <div className="bg-[#0d1f3c] border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-xl animate-fade-in-up" onClick={e => e.stopPropagation()}>
                        <h3 className="text-xl font-black text-white mb-1">{t('manageCourses.announce_title')}</h3>
                        <p className="text-sm text-gray-400 mb-5">{t('manageCourses.announce_hint')}</p>
                        <div className="grid grid-cols-2 gap-3 mb-5">
                            <div>
                                <label className="block text-sm font-bold text-gray-300 mb-1">{t('manageCourses.announce_start_at')}</label>
                                <input
                                    type="date"
                                    value={modal.startAt}
                                    onChange={e => setModal({ ...modal, startAt: e.target.value })}
                                    className="w-full px-4 py-3 bg-[#0a1830] border border-white/10 rounded-xl text-white focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-300 mb-1">{t('manageCourses.announce_end_at')}</label>
                                <input
                                    type="date"
                                    value={modal.endAt}
                                    onChange={e => setModal({ ...modal, endAt: e.target.value })}
                                    className="w-full px-4 py-3 bg-[#0a1830] border border-white/10 rounded-xl text-white focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition"
                                />
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={confirmAnnounce}
                                disabled={!modal.startAt || !modal.endAt || processingId === modal.opening.id}
                                className="flex-1 bg-gradient-to-r from-amber-500 to-amber-600 text-black font-bold py-3 rounded-xl hover:opacity-90 transition disabled:opacity-50 cursor-pointer"
                            >
                                {t('manageCourses.announce_confirm')}
                            </button>
                            <button
                                onClick={() => setModal(null)}
                                className="flex-1 bg-white/5 text-gray-300 font-bold py-3 rounded-xl hover:bg-white/10 transition cursor-pointer"
                            >
                                {t('manageCourses.announce_cancel')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
