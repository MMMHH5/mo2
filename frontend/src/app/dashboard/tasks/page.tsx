"use client";

import { useEffect, useState } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useFetchData } from '@/lib/useFetchData';
import { api, getErrorMessage } from '@/lib/api';
import { useI18n } from '@/lib/i18n-context';
import toast from 'react-hot-toast';
import {
    Loader, ClipboardList, CalendarClock, Send, Paperclip, CheckCircle, Clock, ChevronDown, ChevronUp,
} from 'lucide-react';

interface Enrollment {
    id: string;
    status: string;
    course: { id: string; titleAr?: string | null; titleEn?: string | null };
    opening?: {
        id: string;
        nameAr?: string | null;
        nameEn?: string | null;
    } | null;
}

interface TaskSubmission {
    id: string;
    content?: string | null;
    attachmentUrl?: string | null;
    score?: number | null;
    notes?: string | null;
    submittedAt: string;
}

interface Task {
    id: string;
    titleAr: string;
    titleEn: string;
    descriptionAr?: string | null;
    descriptionEn?: string | null;
    dueDate?: string | null;
    maxScore: number;
    createdAt: string;
    submissions: TaskSubmission[];
}

export default function TasksPage() {
    const { t, pick } = useI18n();
    const { data: enrollments } = useFetchData<Enrollment[]>('/enrollments/my');
    const openings = (enrollments || []).filter((e) => e.opening?.id && e.status !== 'REJECTED');

    const [selectedOpeningId, setSelectedOpeningId] = useState<string>('');
    const [tasks, setTasks] = useState<Task[] | null>(null);
    const [loading, setLoading] = useState(false);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [drafts, setDrafts] = useState<Record<string, string>>({});
    const [savingSubmit, setSavingSubmit] = useState<string | null>(null);

    useEffect(() => {
        if (!selectedOpeningId) return;
        let active = true;
        const run = async () => {
            try {
                const res = await api.get(`/tasks/opening/${selectedOpeningId}`);
                if (active) {
                    setTasks(res.data);
                    setExpandedId(null);
                    setDrafts({});
                }
            } catch (err) {
                if (active) toast.error(getErrorMessage(err) || t('tasks.load_fail'));
            } finally {
                if (active) setLoading(false);
            }
        };
        run();
        return () => { active = false; };
    }, [selectedOpeningId, t]);

    const submitAnswer = async (task: Task) => {
        const content = drafts[task.id] ?? '';
        if (!content.trim()) {
            toast.error(t('tasks.content_required'));
            return;
        }
        setSavingSubmit(task.id);
        try {
            await api.post(`/tasks/${task.id}/submit`, { content: content.trim() });
            toast.success(t('tasks.submit_success'));
            const res = await api.get(`/tasks/opening/${selectedOpeningId}`);
            setTasks(res.data);
        } catch (err) {
            toast.error(getErrorMessage(err) || t('tasks.submit_fail'));
        }
        setSavingSubmit(null);
    };

    const mySubmission = (task: Task) => task.submissions?.[0] ?? null;

    const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString() : '—');

    const inputCls = "w-full px-4 py-3 bg-[#0a1830] border border-white/10 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition placeholder:text-gray-500 text-white";

    return (
        <ProtectedRoute allowedRoles={['STUDENT']}>
            <div className="animate-fade-in space-y-6">
                <div className="bg-[#111f3a] p-8 rounded-3xl shadow-sm border border-white/5">
                    <h2 className="text-3xl font-black text-white flex items-center gap-3">
                        <ClipboardList size={26} className="text-amber-400" /> {t('tasks.teacher_heading')}
                    </h2>
                    <p className="text-gray-400 mt-2">{t('tasks.teacher_subtitle')}</p>
                </div>

                <div className="bg-[#111f3a] p-6 lg:p-8 rounded-3xl shadow-sm border border-white/5">
                    <div className="max-w-xl mb-6">
                        <label className="block text-sm font-bold text-gray-300 mb-1.5">{t('tasks.select_opening')} *</label>
                        <select
                            value={selectedOpeningId}
                            onChange={(e) => {
                                setSelectedOpeningId(e.target.value);
                                setTasks(null);
                                setExpandedId(null);
                                setDrafts({});
                                setLoading(true);
                            }}
                            className={inputCls}
                        >
                            <option value="">{t('tasks.select_opening_placeholder')}</option>
                            {openings.map((e) => (
                                <option key={e.opening?.id} value={e.opening?.id}>
                                    {pick(e.opening, 'name') || pick(e.course, 'title')} — {pick(e.course, 'title')}
                                </option>
                            ))}
                        </select>
                    </div>

                    {!selectedOpeningId && (
                        <div className="py-12 text-center text-gray-400 font-bold">{t('tasks.pick_hint')}</div>
                    )}

                    {selectedOpeningId && loading && (
                        <div className="h-40 flex items-center justify-center font-bold text-gray-400">
                            <Loader className="animate-spin text-amber-400 me-2" size={20} /> {t('common.loading')}
                        </div>
                    )}

                    {selectedOpeningId && !loading && tasks?.length === 0 && (
                        <div className="py-12 text-center text-gray-400 font-bold">{t('tasks.no_tasks')}</div>
                    )}

                    {selectedOpeningId && !loading && (
                        <div className="space-y-4">
                            {(tasks || []).map((task) => {
                                const expanded = expandedId === task.id;
                                const sub = mySubmission(task);
                                const hasGraded = sub && sub.score != null;
                                return (
                                    <div key={task.id} className="border border-white/5 rounded-2xl overflow-hidden">
                                        <div className="flex items-center justify-between gap-3 px-5 py-4 bg-gradient-to-r from-white/5 to-transparent">
                                            <div className="min-w-0">
                                                <h4 className="font-black text-white truncate">{pick(task, 'title')}</h4>
                                                <p className="text-xs text-gray-400 font-semibold mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                                                    <span className="inline-flex items-center gap-1"><CalendarClock size={13} /> {t('tasks.due_on')} {fmtDate(task.dueDate)}</span>
                                                    <span>{t('tasks.max_score_label')}: {task.maxScore}</span>
                                                    {sub && (
                                                        hasGraded ? (
                                                            <span className="inline-flex items-center gap-1 text-emerald-400"><CheckCircle size={13} /> {t('tasks.graded')}: {sub.score}/{task.maxScore}</span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1 text-amber-400"><Clock size={13} /> {t('tasks.submitted')}</span>
                                                        )
                                                    )}
                                                </p>
                                            </div>
                                            <button onClick={() => setExpandedId(expanded ? null : task.id)}
                                                className="admin-action-btn text-gray-400 hover:bg-white/10 tooltip" title={t('tasks.view_details')}>
                                                {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                            </button>
                                        </div>

                                        <div className="px-5 py-3 text-sm text-gray-400 border-t border-white/5">
                                            {pick(task, 'description') || t('tasks.no_description')}
                                        </div>

                                        {expanded && (
                                            <div className="px-5 pb-5 border-t border-white/5">
                                                <div className="space-y-4 mt-4">
                                                    {sub?.content && (
                                                        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                                                            <p className="text-xs font-black text-gray-400 mb-2 uppercase tracking-wide">{t('tasks.my_submission')} · {new Date(sub.submittedAt).toLocaleString()}</p>
                                                            <p className="text-sm text-gray-300 whitespace-pre-wrap">{sub.content}</p>
                                                            {sub.attachmentUrl && (
                                                                <a href={sub.attachmentUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm font-bold text-amber-400 hover:text-amber-300 transition mt-2">
                                                                    <Paperclip size={14} /> {t('tasks.attachment')}
                                                                </a>
                                                            )}
                                                        </div>
                                                    )}
                                                    {hasGraded && (
                                                        <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-4 text-sm">
                                                            <p className="font-black text-emerald-400">{t('tasks.grade')}: {sub.score}/{task.maxScore}</p>
                                                            {sub.notes && <p className="text-emerald-300 mt-1">{sub.notes}</p>}
                                                        </div>
                                                    )}
                                                    <div>
                                                        <label className="block text-sm font-bold text-gray-300 mb-1.5">{t('tasks.your_answer')}</label>
                                                        <textarea
                                                            value={drafts[task.id] ?? ''}
                                                            onChange={(e) => setDrafts((p) => ({ ...p, [task.id]: e.target.value }))}
                                                            rows={4}
                                                            className={inputCls}
                                                            placeholder={t('tasks.content_placeholder')}
                                                        />
                                                        <div className="flex items-center justify-end gap-3 mt-3">
                                                            {sub && !hasGraded && (
                                                                <span className="text-xs text-gray-400 font-semibold inline-flex items-center gap-1">
                                                                    <Clock size={13} /> {t('tasks.awaiting_grade')}
                                                                </span>
                                                            )}
                                                            <button
                                                                onClick={() => submitAnswer(task)}
                                                                disabled={savingSubmit === task.id || !(drafts[task.id] ?? '').trim()}
                                                                className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 text-black text-sm font-bold px-5 py-2.5 rounded-xl hover:from-amber-400 hover:to-amber-500 transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                                                            >
                                                                {savingSubmit === task.id ? <Loader size={15} className="animate-spin" /> : <Send size={15} />}
                                                                {sub ? t('tasks.update_submission') : t('tasks.submit')}
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </ProtectedRoute>
    );
}
