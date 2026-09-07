"use client";

import { useEffect, useState } from 'react';
import { api, getErrorMessage } from '@/lib/api';
import { useI18n } from '@/lib/i18n-context';
import toast from 'react-hot-toast';
import { Loader, ClipboardList, Send, CheckCircle, Clock } from 'lucide-react';

interface TaskItem {
    id: string;
    titleAr: string;
    titleEn: string;
    descriptionAr?: string | null;
    descriptionEn?: string | null;
    dueDate?: string | null;
    maxScore: number;
    submissions?: { id: string; content?: string | null; score?: number | null; notes?: string | null; submittedAt: string }[];
}

interface Props {
    courseId: string;
}

export default function StudentTasksPanel({ courseId }: Props) {
    const { t, pick } = useI18n();
    const [openingId, setOpeningId] = useState<string | null>(null);
    const [tasks, setTasks] = useState<TaskItem[] | null>(null);
    const [loading, setLoading] = useState(true);
    const [drafts, setDrafts] = useState<Record<string, string>>({});
    const [submittingId, setSubmittingId] = useState<string | null>(null);

    useEffect(() => {
        let active = true;
        (async () => {
            try {
                if (typeof window === 'undefined' || !localStorage.getItem('laxalab_token')) {
                    if (active) { setOpeningId(null); setTasks([]); }
                    return;
                }
                const enr = await api.get('/enrollments/my');
                const mine = (enr.data || []).find((e: { course?: { id: string }; opening?: { id: string } }) => e.course?.id === courseId);
                const oid = mine?.opening?.id ?? null;
                if (!active) return;
                setOpeningId(oid);
                if (oid) {
                    const res = await api.get(`/tasks/opening/${oid}`);
                    if (active) setTasks(res.data || []);
                } else {
                    if (active) setTasks([]);
                }
            } catch {
                if (active) setTasks([]);
            } finally {
                if (active) setLoading(false);
            }
        })();
        return () => { active = false; };
    }, [courseId]);

    const handleSubmit = async (taskId: string) => {
        const content = (drafts[taskId] || '').trim();
        if (!content) return;
        setSubmittingId(taskId);
        try {
            await api.post(`/tasks/${taskId}/submit`, { content });
            toast.success(t('courseChat.send'));
            setDrafts(prev => ({ ...prev, [taskId]: '' }));
            if (openingId) {
                const res = await api.get(`/tasks/opening/${openingId}`);
                setTasks(res.data || []);
            }
        } catch (e) {
            toast.error(getErrorMessage(e) || t('tasks.load_fail'));
        } finally {
            setSubmittingId(null);
        }
    };

    const sorted = (tasks || []).slice().sort((a, b) => new Date(a.dueDate || 0).getTime() - new Date(b.dueDate || 0).getTime());

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <ClipboardList size={24} className="text-brand-gold" />
                <h2 className="text-2xl font-black text-brand-navy">{t('tasks.tasks_title')}</h2>
            </div>

            {loading ? (
                <div className="h-48 flex items-center justify-center text-brand-navy">
                    <Loader className="animate-spin" size={32} />
                </div>
            ) : !openingId ? (
                <div className="text-center text-gray-400 font-bold py-16">{t('courseChat.empty')}</div>
            ) : sorted.length === 0 ? (
                <div className="text-center text-gray-400 font-bold py-16">{t('tasks.no_tasks')}</div>
            ) : (
                <div className="space-y-4">
                    {sorted.map(task => {
                        const mySubmission = task.submissions?.length ? task.submissions[0] : null;
                        const graded = typeof mySubmission?.score === 'number';
                        const overdue = task.dueDate ? new Date(task.dueDate) < new Date() : false;
                        return (
                            <div key={task.id} className="border border-brand-mist rounded-2xl p-5 bg-white shadow-sm">
                                <div className="flex items-start justify-between gap-3 flex-wrap">
                                    <div>
                                        <h3 className="font-bold text-brand-navy">{pick(task, 'title')}</h3>
                                        {pick(task, 'description') && (
                                            <p className="text-sm text-gray-500 mt-1 whitespace-pre-wrap">{pick(task, 'description')}</p>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2 text-xs font-bold">
                                        {task.dueDate && (
                                            <span className={`flex items-center gap-1 px-2.5 py-1 rounded-lg ${overdue ? 'bg-red-50 text-red-600' : 'bg-brand-mist/50 text-gray-600'}`}>
                                                <Clock size={12} /> {t('tasks.due_on')} {new Date(task.dueDate).toLocaleDateString()}
                                            </span>
                                        )}
                                        <span className="bg-brand-navy text-white px-2.5 py-1 rounded-lg">
                                            {t('tasks.max_score_label')} {task.maxScore}
                                        </span>
                                    </div>
                                </div>

                                {graded ? (
                                    <div className="mt-4 flex items-center gap-2 text-sm font-bold text-green-600 bg-green-50 border border-green-200 rounded-xl p-3">
                                        <CheckCircle size={16} />
                                        {t('tasks.current_grade')}: {mySubmission?.score} / {task.maxScore}
                                        {mySubmission?.notes ? ` — ${mySubmission.notes}` : ''}
                                    </div>
                                ) : mySubmission ? (
                                    <div className="mt-4 text-sm text-gray-600 bg-brand-mist/30 border border-brand-mist rounded-xl p-3">
                                        {t('tasks.submitted_at')} {new Date(mySubmission.submittedAt).toLocaleString()}
                                    </div>
                                ) : (
                                    <div className="mt-4">
                                        <textarea
                                            value={drafts[task.id] || ''}
                                            onChange={e => setDrafts(prev => ({ ...prev, [task.id]: e.target.value }))}
                                            rows={2}
                                            placeholder={t('courseChat.placeholder')}
                                            className="w-full bg-white border border-brand-mist rounded-xl px-4 py-3 font-medium text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/40 resize-y"
                                        />
                                        <button
                                            onClick={() => handleSubmit(task.id)}
                                            disabled={submittingId === task.id || !(drafts[task.id] || '').trim()}
                                            className="mt-2 inline-flex items-center gap-2 bg-brand-navy hover:bg-brand-charcoal text-white disabled:opacity-40 px-5 py-2.5 rounded-xl font-bold text-sm transition"
                                        >
                                            <Send size={14} /> {t('common.submit')}
                                        </button>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}