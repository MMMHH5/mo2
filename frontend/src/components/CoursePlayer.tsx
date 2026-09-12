"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type RefObject } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { api, API_BASE_URL, getErrorMessage } from '@/lib/api';
import { useI18n } from '@/lib/i18n-context';
import toast from 'react-hot-toast';
import {
    ArrowLeft, Award, Loader, Sun, Moon, PanelLeftClose, PanelLeft, Search, ChevronDown,
    PlayCircle, FileText, ClipboardList, Link2, Clock, CheckCircle, Circle, Play, Pause,
    RotateCcw, Volume2, VolumeX, Maximize, ZoomIn, ZoomOut, Maximize2, Download,
    UploadCloud, StickyNote, MessagesSquare, Send, X, Gift, BookMarked, MessageCircle, ArrowRight,
    Bell, Megaphone, Calendar, User,
} from 'lucide-react';
import CourseChat from '@/components/CourseChat';
import DiscussionForum from '@/components/DiscussionForum';
import InteractiveQuiz from '@/components/InteractiveQuiz';

// ---------- Types ----------

interface Outcome {
    descriptionAr?: string | null;
    descriptionEn?: string | null;
}
interface LessonFile {
    url: string;
    nameAr?: string | null;
    nameEn?: string | null;
}
interface LessonLink {
    url: string;
    labelAr?: string | null;
    labelEn?: string | null;
}
interface CourseModule {
    id: string;
    titleAr?: string | null;
    titleEn?: string | null;
    descriptionAr?: string | null;
    descriptionEn?: string | null;
    videoUrl?: string | null;
    isFree?: boolean | null;
    durationMinutes?: number | null;
    files?: LessonFile[] | null;
    links?: LessonLink[] | null;
    outcomes?: Outcome[] | null;
}
interface CourseChapter {
    id: string;
    titleAr?: string | null;
    titleEn?: string | null;
    modules?: CourseModule[] | null;
}
interface ProgressModule extends CourseModule {
    completed: boolean;
    completedAt: string | null;
}
interface ProgressData {
    enrollmentId: string;
    openingId: string | null;
    percent: number;
    total: number;
    completed: number;
    modules: ProgressModule[];
}
interface NoteRow {
    moduleId: string;
    content: string;
    updatedAt: string;
}
interface NotesData {
    enrollmentId: string;
    notes: NoteRow[];
}
interface TaskSubmission {
    id: string;
    content?: string | null;
    attachmentUrl?: string | null;
    score?: number | null;
    notes?: string | null;
    submittedAt?: string | null;
}
interface LessonTask {
    id: string;
    titleAr: string;
    titleEn: string;
    descriptionAr?: string | null;
    descriptionEn?: string | null;
    dueDate?: string | null;
    maxScore: number;
    moduleId?: string | null;
    attachmentUrl?: string | null;
    attachmentType?: string | null;
    links?: LessonLink[] | null;
    submissions?: TaskSubmission[] | null;
}
interface CourseData {
    id: string;
    titleAr: string;
    titleEn: string;
    chapters?: CourseChapter[] | null;
    modules?: CourseModule[] | null;
}

type LessonKind = 'video' | 'pdf' | 'task' | 'resource';
type DeckTab = 'overview' | 'notes' | 'discussions' | 'quizzes' | 'batch' | 'direct';

interface Announcement {
    id: string;
    titleAr: string;
    titleEn: string;
    contentAr: string;
    contentEn: string;
    isPublished: boolean;
    createdAt: string;
    author?: { id: string; email: string } | null;
}

interface ModuleQuiz {
    id: string;
    titleAr: string;
    titleEn: string;
    descriptionAr?: string | null;
    descriptionEn?: string | null;
    passScore?: number;
    isPublished?: boolean;
    orderIndex?: number;
    moduleId?: string | null;
    questions?: unknown[];
}

// ---------- Helpers ----------

function getVideoUrl(url?: string | null): { type: 'embed' | 'file'; src: string } | null {
    if (!url) return null;
    const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{6,})/);
    const vm = url.match(/vimeo\.com\/(\d+)/);
    if (yt) return { type: 'embed', src: `https://www.youtube.com/embed/${yt[1]}` };
    if (vm) return { type: 'embed', src: `https://player.vimeo.com/video/${vm[1]}` };
    if (url.startsWith('/uploads') || /\.(mp4|webm|mov)$/i.test(url)) return { type: 'file', src: url };
    return { type: 'embed', src: url };
}

function kindOf(module: CourseModule, tasks: LessonTask[]): LessonKind {
    if (getVideoUrl(module.videoUrl)) return 'video';
    const pdf = (module.files || []).find(f => /\.pdf$/i.test(f.url));
    if (pdf) return 'pdf';
    if (tasks.length > 0) return 'task';
    return 'resource';
}

function fmtTime(s: number): string {
    if (!isFinite(s) || s < 0) s = 0;
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = Math.floor(s % 60);
    const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
    const ss = String(sec).padStart(2, '0');
    return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

interface Props {
    courseId: string;
}

export default function CoursePlayer({ courseId }: Props) {
    const { t, pick, locale } = useI18n();
    const isAr = locale === 'ar';
    const router = useRouter();

    const [course, setCourse] = useState<CourseData | null>(null);
    const [progress, setProgress] = useState<ProgressData | null>(null);
    const [notesData, setNotesData] = useState<NotesData | null>(null);
    const [tasks, setTasks] = useState<LessonTask[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);

    const [focusMode, setFocusMode] = useState(false);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [openChs, setOpenChs] = useState<Record<number, boolean>>({});
    const [search, setSearch] = useState('');
    const [deckTab, setDeckTab] = useState<DeckTab>('overview');

    // Progress mutations
    const [progressing, setProgressing] = useState(false);
    // Tasks
    const [taskFile, setTaskFile] = useState<File | null>(null);
    const [taskDraft, setTaskDraft] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [dragOver, setDragOver] = useState(false);
    const taskInputRef = useRef<HTMLInputElement>(null);

    // Announcements
    const [announcements, setAnnouncements] = useState<Announcement[]>([]);
    const [announcementsOpen, setAnnouncementsOpen] = useState(false);
    // Quizzes for current module
    const [moduleQuizzes, setModuleQuizzes] = useState<ModuleQuiz[]>([]);

    // ---------- Data loading ----------
    useEffect(() => {
        let active = true;
        (async () => {
            setLoading(true);
            setLoadError(null);
            try {
                const [c, p, n] = await Promise.all([
                    api.get(`/courses/${courseId}`),
                    api.get(`/lms/courses/${courseId}/my-progress`),
                    api.get(`/lms/courses/${courseId}/my-notes`),
                ]);
                if (!active) return;
                setCourse(c.data as CourseData);
                setProgress(p.data as ProgressData);
                setNotesData(n.data as NotesData);
                if (p.data?.openingId) {
                    try {
                        const tr = await api.get(`/tasks/opening/${p.data.openingId}`);
                        if (active) setTasks(tr.data || []);
                    } catch {
                        if (active) setTasks([]);
                    }
                    try {
                        const ar = await api.get(`/announcements/opening/${p.data.openingId}`);
                        if (active) setAnnouncements(ar.data || []);
                    } catch {
                        if (active) setAnnouncements([]);
                    }
                } else {
                    setTasks([]);
                }
                try {
                    const qr = await api.get(`/quizzes/course/${courseId}`);
                    if (active) setModuleQuizzes(qr.data || []);
                } catch {
                    if (active) setModuleQuizzes([]);
                }
                const mods = flattenModules(c.data);
                if (mods.length > 0) {
                    const firstIncomplete = mods.find(m => !m.completedMap) ?? mods[0];
                    setSelectedId(firstIncomplete.id);
                }
            } catch (e) {
                if (active) setLoadError(getErrorMessage(e) || t('player.load_failed'));
            } finally {
                if (active) setLoading(false);
            }
        })();
        return () => { active = false; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [courseId]);

    // ---------- Learning Session Heartbeat ----------
    useEffect(() => {
        if (!courseId || loading) return;
        let sessionId: string | null = null;
        let timer: ReturnType<typeof setInterval> | null = null;
        (async () => {
            try {
                const res = await api.post('/analytics/session/start', { courseId });
                sessionId = res.data?.id;
                if (sessionId) {
                    timer = setInterval(() => {
                        api.patch(`/analytics/session/${sessionId}/heartbeat`).catch(() => {});
                    }, 60000);
                }
            } catch {}
        })();
        return () => {
            if (timer) clearInterval(timer);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [courseId, loading]);

    // ---------- Derived ----------
    const chapters = useMemo<CourseChapter[]>(() => {
        if (course?.chapters?.length) return course.chapters;
        return [{ id: 'root', titleAr: null, titleEn: null, modules: course?.modules || [] }];
    }, [course]);

    const completedSet = useMemo(() => new Set((progress?.modules || []).filter(m => m.completed).map(m => m.id)), [progress]);

    const flatten = useCallback((chs: CourseChapter[]) => chs.flatMap(c => c.modules || []).filter(Boolean), []);
    const allModules = useMemo(() => flatten(chapters), [chapters, flatten]);
    const notesMap = useMemo(() => new Map((notesData?.notes || []).map(n => [n.moduleId, n.content])), [notesData]);

    const selected = useMemo(() => allModules.find(m => m.id === selectedId) ?? allModules[0] ?? null, [allModules, selectedId]);
    const selectedTasks = useMemo(() => tasks.filter(tk => tk.moduleId === selected?.id), [tasks, selected]);
    const selectedKind = useMemo(() => (selected ? kindOf(selected, selectedTasks) : null), [selected, selectedTasks]);

    const filteredModules = useMemo(() => {
        if (!search.trim()) return null;
        const q = search.trim().toLowerCase();
        return allModules.filter(m => (pick(m, 'title') || '').toLowerCase().includes(q));
    }, [allModules, search, pick]);

    // Watch-position resume (localStorage per lesson)
    const posKey = (m: CourseModule) => `laxalab:video:${courseId}:${m.id}`;
    const watchPos = useMemo(() => {
        const map = new Map<string, number>();
        if (typeof window === 'undefined') return map;
        allModules.forEach(m => {
            const raw = window.localStorage.getItem(posKey(m));
            if (raw) {
                const v = parseFloat(raw);
                if (isFinite(v) && v > 5) map.set(m.id, v);
            }
        });
        return map;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [allModules]);

    const isInProgress = (m: CourseModule) => !completedSet.has(m.id) && watchPos.has(m.id);

    // ---------- Actions ----------
    const flipComplete = async () => {
        if (!selected || !progress?.enrollmentId) return;
        setProgressing(true);
        try {
            const completed = completedSet.has(selected.id);
            if (completed) {
                const p = await api.delete(`/lms/progress/${selected.id}`, { params: { enrollmentId: progress.enrollmentId } });
                setProgress(p.data as ProgressData);
            } else {
                const p = await api.post('/lms/progress', { enrollmentId: progress.enrollmentId, moduleId: selected.id });
                setProgress(p.data as ProgressData);
            }
        } catch (e) {
            toast.error(getErrorMessage(e) || t('player.mark_failed'));
        } finally {
            setProgressing(false);
        }
    };

    const saveNote = async (content: string, moduleId: string) => {
        await api.put(`/lms/notes/${moduleId}`, { content });
    };

    const submitTask = async (task: LessonTask) => {
        const content = taskDraft.trim();
        const file = taskFile;
        if ((!content && !file) || submitting) return;
        setSubmitting(true);
        try {
            let attachmentUrl: string | undefined;
            if (file) {
                const fd = new FormData();
                fd.append('file', file);
                const up = await api.post('/chat/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
                attachmentUrl = up.data.url;
            }
            await api.post(`/tasks/${task.id}/submit`, { content, attachmentUrl });
            toast.success(t('player.task_submitted'));
            setTaskDraft('');
            setTaskFile(null);
            const tr = await api.get(`/tasks/opening/${progress?.openingId}`);
            setTasks(tr.data || []);
        } catch (e) {
            toast.error(getErrorMessage(e) || t('player.task_fail'));
        } finally {
            setSubmitting(false);
        }
    };

    const isCourseComplete = progress?.percent === 100 && progress.total > 0;

    // ---------- Sub renders ----------

    const renderIcon = (m: CourseModule) => {
        const modTasks = tasks.filter(tk => tk.moduleId === m.id);
        const kind = kindOf(m, modTasks);
        if (kind === 'video') return <PlayCircle size={16} />;
        if (kind === 'pdf') return <FileText size={16} />;
        if (kind === 'task') return <ClipboardList size={16} />;
        return <Link2 size={16} />;
    };

    const renderStatus = (m: CourseModule) => {
        if (completedSet.has(m.id)) return <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" title={t('player.completed')} />;
        if (isInProgress(m)) return <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0" title={t('player.in_progress')} />;
        return <span className="w-2 h-2 rounded-full bg-white/20 shrink-0" />;
    };

    const renderLessonButton = (m: CourseModule, active: boolean) => {
        const done = completedSet.has(m.id);
        return (
            <button
                key={m.id}
                onClick={() => setSelectedId(m.id)}
                className={`w-full flex items-center gap-3 text-left rtl:text-right px-3 py-2.5 rounded-xl border transition-all duration-200 cursor-pointer ${
                    active
                        ? 'bg-gradient-to-r from-amber-500/10 to-amber-500/5 border-l-2 border-l-amber-400 border-white/10 text-white shadow-lg shadow-black/10'
                        : 'bg-transparent border-transparent hover:bg-white/5 hover:border-white/10 text-gray-300'
                }`}
            >
                <span className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs ${
                    active
                        ? 'bg-amber-500/20 text-amber-400'
                        : done
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : 'bg-white/10 text-gray-400'
                }`}>
                    {done ? <CheckCircle size={14} /> : renderIcon(m)}
                </span>
                <span className={`flex-1 min-w-0 truncate text-sm font-bold ${active ? 'text-white' : ''}`}>{pick(m, 'title')}</span>
                {!!m.durationMinutes && (
                    <span className="flex items-center gap-1 text-[10px] font-bold shrink-0 text-gray-500">
                        <Clock size={11} /> {m.durationMinutes}
                    </span>
                )}
                {renderStatus(m)}
            </button>
        );
    };

    // Video player (file videos only get custom controls)
    const renderVideoPlayer = (m: CourseModule, vid: { type: string; src: string }) => {
        if (vid.type === 'embed') {
            return (
                <div className="space-y-3">
                    <div className="rounded-2xl overflow-hidden bg-black aspect-video shadow-xl shadow-black/30">
                        <iframe src={vid.src} title={pick(m, 'title') || undefined} className="w-full h-full" allowFullScreen allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" />
                    </div>
                    <button
                        onClick={flipComplete}
                        disabled={progressing || !progress?.enrollmentId}
                        className={`w-full flex items-center justify-center gap-2 px-5 py-4 rounded-2xl text-sm font-black transition-all duration-300 ${
                            completedSet.has(m.id)
                                ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/40'
                                : 'bg-gradient-to-r from-amber-500 to-amber-600 text-black shadow-lg shadow-amber-500/20 hover:shadow-amber-500/40 hover:scale-[1.01]'
                        }`}
                    >
                        <CheckCircle size={16} />
                        {completedSet.has(m.id) ? t('player.completed') : t('player.mark_complete')}
                    </button>
                </div>
            );
        }
        return <FileVideoPlayer src={vid.src} posKey={posKey(m)} initialPos={watchPos.get(m.id) || 0} completed={completedSet.has(m.id)} onToggleComplete={flipComplete} progressing={progressing} />;
    };

    const renderStage = () => {
        if (!selected) {
            return (
                <div className="h-72 flex flex-col items-center justify-center text-center text-gray-400">
                    <BookMarked size={44} className="mb-3 text-amber-400/40" />
                    <p className="font-bold">{t('player.no_lesson')}</p>
                </div>
            );
        }

        const vid = getVideoUrl(selected.videoUrl);
        const pdfFile = (selected.files || []).find(f => /\.pdf$/i.test(f.url));
        const done = completedSet.has(selected.id);

        const curIdx = allModules.findIndex(m => m.id === selected.id);
        const chIdx = chapters.findIndex(ch => (ch.modules || []).some(m => m.id === selected.id));
        const chMods = chapters[chIdx]?.modules || [];
        const chPos = chIdx >= 0 ? chMods.findIndex(m => m.id === selected.id) + 1 : 0;
        const prevM = curIdx > 0 ? allModules[curIdx - 1] : null;
        const nextM = curIdx >= 0 && curIdx < allModules.length - 1 ? allModules[curIdx + 1] : null;

        return (
            <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-lg shadow-black/20 ${done ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
                            {done ? <CheckCircle size={18} /> : renderIcon(selected)}
                        </div>
                        <div className="min-w-0">
                            {chIdx >= 0 && (
                                <div className="text-[10px] font-black uppercase tracking-widest mb-0.5 text-amber-400/70">
                                    {pick(chapters[chIdx], 'title')}{chMods.length > 1 && chPos > 0 ? ` · ${chPos} / ${chMods.length}` : ''}
                                </div>
                            )}
                            <h2 className="text-2xl font-black text-white leading-tight truncate">{pick(selected, 'title')}</h2>
                            {!!selected.durationMinutes && (
                                <p className="text-[11px] font-bold text-gray-400 flex items-center gap-1 mt-0.5">
                                    <Clock size={11} /> {selected.durationMinutes} {t('lessons.minutes_short')}
                                    {!!selected.isFree && <span className="flex items-center gap-1 text-emerald-400 bg-emerald-500/20 rounded-full px-2 py-0.5"><Gift size={10} /> {t('lessons.free_badge')}</span>}
                                </p>
                            )}
                        </div>
                    </div>
                    <button
                        onClick={flipComplete}
                        disabled={progressing || !progress?.enrollmentId}
                        className={`w-full flex items-center justify-center gap-2 px-5 py-4 rounded-2xl text-sm font-black transition-all duration-300 cursor-pointer disabled:opacity-40 ${
                            done
                                ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/40'
                                : 'bg-gradient-to-r from-amber-500 to-amber-600 text-black shadow-lg shadow-amber-500/20 hover:shadow-amber-500/40 hover:scale-[1.01]'
                        }`}
                    >
                        {progressing ? <Loader size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                        {done ? t('player.undo_complete') : t('player.mark_complete')}
                    </button>
                </div>

                <AnimatePresence mode="wait">
                    <motion.div
                        key={`${selected.id}-${selectedKind}`}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.25 }}
                    >
                        {selectedKind === 'video' && vid && renderVideoPlayer(selected, vid)}
                        {selectedKind === 'pdf' && pdfFile && <PdfViewer url={pdfFile.url} m={selected} />}
                        {selectedKind === 'task' && (
                            <TaskStage
                                tasks={selectedTasks}
                                taskDraft={taskDraft}
                                setTaskDraft={setTaskDraft}
                                taskFile={taskFile}
                                setTaskFile={setTaskFile}
                                submitting={submitting}
                                onSubmit={submitTask}
                                dragOver={dragOver}
                                setDragOver={setDragOver}
                                fileInputRef={taskInputRef}
                            />
                        )}
                        {selectedKind === 'resource' && <ResourceStage m={selected} />}
                    </motion.div>
                </AnimatePresence>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-white/5 mt-1">
                    {prevM ? (
                        <button
                            onClick={() => setSelectedId(prevM.id)}
                            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer bg-white/5 border border-white/10 text-gray-300 hover:border-white/20 hover:text-white"
                        >
                            <ArrowLeft size={14} className="rtl:-scale-x-100 shrink-0" />
                            <span className="max-w-[180px] truncate">{pick(prevM, 'title')}</span>
                        </button>
                    ) : <span />}
                    {nextM ? (
                        <button
                            onClick={() => setSelectedId(nextM.id)}
                            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black transition-all duration-200 cursor-pointer bg-gradient-to-r from-amber-500 to-amber-600 text-black hover:shadow-lg hover:shadow-amber-500/20 hover:scale-[1.01]"
                        >
                            <span className="max-w-[180px] truncate">{pick(nextM, 'title')}</span>
                            <ArrowRight size={14} className="rtl:-scale-x-100 shrink-0" />
                        </button>
                    ) : null}
                </div>
            </div>
        );
    };

    const renderDeck = () => {
        const tabs: { key: DeckTab; label: string; icon: typeof BookMarked }[] = [
            { key: 'overview', label: t('player.tab_overview'), icon: BookMarked },
            { key: 'notes', label: t('player.tab_notes'), icon: StickyNote },
            { key: 'discussions', label: isAr ? 'النقاش' : 'Discuss', icon: MessageCircle },
            { key: 'quizzes', label: isAr ? 'اختبار' : 'Quiz', icon: ClipboardList },
            { key: 'batch', label: t('player.tab_batch'), icon: MessagesSquare },
            { key: 'direct', label: t('player.tab_direct'), icon: MessageCircle },
        ];
        return (
            <div className="mt-6">
                <div className="flex gap-1 border-b border-white/5 overflow-x-auto">
                    {tabs.map(tb => {
                        const Icon = tb.icon;
                        const active = deckTab === tb.key;
                        return (
                            <button
                                key={tb.key}
                                onClick={() => setDeckTab(tb.key)}
                                className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-bold transition-all duration-200 whitespace-nowrap cursor-pointer relative ${
                                    active ? 'text-amber-400' : 'text-gray-400 hover:text-gray-200'
                                }`}
                            >
                                <Icon size={15} /> {tb.label}
                                {active && <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-amber-400 rounded-full" />}
                            </button>
                        );
                    })}
                </div>
                <div className="mt-4 min-h-[120px]">
                    {deckTab === 'overview' && selected && (
                        <div className="space-y-4">
                            {pick(selected, 'description') && (
                                <p className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed font-medium">{pick(selected, 'description')}</p>
                            )}
                            {selected.outcomes && selected.outcomes.length > 0 && (
                                <div>
                                    <h4 className="text-xs font-black text-amber-400/70 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                                        <CheckCircle size={14} className="text-amber-400" /> {t('createCourse.outcomes_heading')}
                                    </h4>
                                    <ul className="space-y-2">
                                        {selected.outcomes.map((o, j) => (
                                            <li key={j} className="flex items-start gap-2 text-sm text-gray-300">
                                                <CheckCircle size={16} className="text-emerald-400 mt-0.5 flex-shrink-0" />
                                                <span>{pick(o, 'description')}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                            {(selected.files || []).length > 0 && (
                                <div>
                                    <h4 className="text-xs font-black text-amber-400/70 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                                        <FileText size={14} className="text-amber-400" /> {t('courseDetail.lesson_files')}
                                    </h4>
                                    <div className="flex flex-wrap gap-2">
                                        {(selected.files || []).map((f, fi) => (
                                            <a key={fi} href={f.url.startsWith('/') ? API_BASE_URL + f.url : f.url} target="_blank" rel="noreferrer"
                                                className="inline-flex items-center gap-1.5 text-sm font-bold text-gray-300 bg-[#111f3a] border border-white/5 rounded-xl px-3 py-2 hover:border-amber-400/30 hover:text-amber-400 transition-all duration-200">
                                                <Download size={14} /> {pick(f, 'name') || f.url.split('/').pop() || f.url}
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {(selected.links || []).length > 0 && (
                                <div>
                                    <h4 className="text-xs font-black text-amber-400/70 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                                        <Link2 size={14} className="text-amber-400" /> {t('courseDetail.lesson_links')}
                                    </h4>
                                    <div className="flex flex-wrap gap-2">
                                        {(selected.links || []).map((lk, li) => (
                                            <a key={li} href={lk.url} target="_blank" rel="noreferrer"
                                                className="inline-flex items-center gap-1.5 text-sm font-bold text-gray-300 bg-[#111f3a] border border-white/5 rounded-xl px-3 py-2 hover:border-amber-400/30 hover:text-amber-400 transition-all duration-200">
                                                <Link2 size={14} /> {pick(lk, 'label') || lk.url}
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                    {deckTab === 'notes' && selected && (
                        <NotesEditor
                            key={selected.id}
                            initial={notesMap.get(selected.id) ?? ''}
                            moduleId={selected.id}
                            onSave={saveNote}
                        />
                    )}
                    {deckTab === 'discussions' && selected && (
                        <DiscussionForum moduleId={selected.id} courseId={courseId} />
                    )}
                    {deckTab === 'quizzes' && progress?.openingId && (
                        <div className="space-y-4">
                            {moduleQuizzes.filter((q) => q.moduleId === selected?.id).length === 0 ? (
                                <p className="text-sm text-gray-400 text-center py-8">{isAr ? 'لا يوجد اختبارات لهذا الدرس بعد' : 'No quizzes for this lesson yet'}</p>
                            ) : (
                                moduleQuizzes.filter((q) => q.moduleId === selected?.id).map((quiz) => (
                                    <div key={quiz.id}>
                                        <p className="text-sm text-gray-400 mb-3">{isAr ? 'اختبر معلوماتك' : 'Test your knowledge'}</p>
                                        <InteractiveQuiz
                                            quizId={quiz.id}
                                            enrollmentId={progress.enrollmentId}
                                            onComplete={(passed, score) => {
                                                toast.success(passed ? (isAr ? 'نجحت في الاختبار!' : 'Quiz passed!') : (isAr ? 'حاول مرة أخرى' : 'Try again'));
                                            }}
                                        />
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                    {deckTab === 'batch' && <CourseChat courseId={courseId} variant="group" />}
                    {deckTab === 'direct' && <CourseChat courseId={courseId} variant="direct" />}
                </div>
            </div>
        );
    };

    // ---------- Render ----------
    if (loading) {
        return (
            <div className="h-[70vh] flex items-center justify-center bg-[#0a1830]">
                <Loader className="animate-spin text-amber-400" size={36} />
            </div>
        );
    }

    if (loadError) {
        return (
            <div className="h-[60vh] flex flex-col items-center justify-center text-center gap-3 bg-[#0a1830]">
                <BookMarked size={44} className="text-amber-400/40" />
                <p className="text-lg font-bold text-white">{t('player.not_enrolled_title')}</p>
                <p className="text-sm text-gray-400 max-w-md">{loadError}</p>
                <button onClick={() => router.push(`/courses/${courseId}`)} className="bg-gradient-to-r from-amber-500 to-amber-600 text-black px-6 py-3 rounded-xl font-black hover:shadow-lg hover:shadow-amber-500/20 transition-all duration-300">
                    {t('player.go_to_course')}
                </button>
            </div>
        );
    }

    const pct = progress?.percent ?? 0;

    return (
        <div className="min-h-screen bg-[#0a1830]">
            {/* Header */}
            <header className="sticky top-0 z-30 bg-gradient-to-r from-[#0d1f3c] via-[#132a50] to-[#0d1f3c] border-b border-white/5 px-4 md:px-6 py-3 flex items-center gap-3">
                <button
                    onClick={() => router.push('/dashboard')}
                    title={t('player.back')}
                    className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white transition-all duration-200"
                >
                    <ArrowLeft className="rtl:-scale-x-100" size={18} />
                </button>

                <div className="flex-1 min-w-0">
                    <h1 className="text-white font-black text-lg truncate">
                        {pick(course, 'title')}
                    </h1>
                    <div className="flex items-center gap-2">
                        <div className="flex-1 max-w-[220px] md:max-w-xs h-3 rounded-full overflow-hidden bg-white/10">
                            <div
                                className={`h-full rounded-full transition-all duration-500 shadow-[0_0_12px_rgba(245,158,11,0.3)] ${pct === 100 ? 'bg-gradient-to-r from-emerald-400 to-emerald-500' : 'bg-gradient-to-r from-amber-400 via-emerald-400 to-emerald-500'}`}
                                style={{ width: `${pct}%` }}
                            />
                        </div>
                        <span className="text-amber-400 font-black text-lg tabular-nums transition-all duration-300">{pct}%</span>
                        {isCourseComplete && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-black rounded-full px-2 py-0.5 bg-amber-400/20 text-amber-400">
                                <Award size={12} /> {t('player.completion_badge')}
                            </span>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 relative">
                    {announcements.length > 0 && (
                        <div className="relative">
                            <button
                                onClick={() => setAnnouncementsOpen(o => !o)}
                                title={t('announcements.title')}
                                className="relative w-10 h-10 rounded-xl flex items-center justify-center bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white transition-all duration-200 cursor-pointer"
                            >
                                <Bell size={18} />
                                <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-amber-500 text-[#0a1830] text-[10px] font-black flex items-center justify-center">
                                    {announcements.length}
                                </span>
                            </button>
                            {announcementsOpen && (
                                <>
                                    <div className="fixed inset-0 z-40" onClick={() => setAnnouncementsOpen(false)} />
                                    <div className="absolute top-12 right-0 z-50 w-[380px] max-h-[420px] overflow-y-auto bg-[#0d1f3c] border border-white/10 rounded-2xl shadow-2xl shadow-black/40 admin-scroll">
                                        <div className="p-4 border-b border-white/5 sticky top-0 bg-[#0d1f3c] z-10">
                                            <div className="flex items-center gap-2">
                                                <Megaphone size={16} className="text-amber-400" />
                                                <h3 className="text-white font-black text-sm">{t('announcements.title')}</h3>
                                            </div>
                                        </div>
                                        <div className="p-2">
                                            {announcements.map(a => (
                                                <div key={a.id} className="p-3 rounded-xl hover:bg-white/5 transition-colors border border-transparent hover:border-white/5 mb-1 last:mb-0">
                                                    <div className="flex items-center gap-2 mb-1.5">
                                                        <span className="text-amber-400"><Megaphone size={13} /></span>
                                                        <h4 className="text-white font-bold text-sm">{pick(a, 'title')}</h4>
                                                    </div>
                                                    <p className="text-gray-300 text-xs leading-relaxed line-clamp-3 mb-2">{pick(a, 'content')}</p>
                                                    <div className="flex items-center gap-3 text-[10px] text-gray-500">
                                                        <span className="flex items-center gap-1">
                                                            <Calendar size={10} />
                                                            {new Date(a.createdAt).toLocaleDateString()}
                                                        </span>
                                                        {a.author && (
                                                            <span className="flex items-center gap-1">
                                                                <User size={10} />
                                                                {a.author.email}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                    <button
                        onClick={() => setFocusMode(f => !f)}
                        title={focusMode ? t('player.focus_exit') : t('player.focus_mode')}
                        className="w-10 h-10 rounded-xl flex items-center justify-center bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white transition-all duration-200 cursor-pointer"
                    >
                        {focusMode ? <PanelLeft size={18} /> : <PanelLeftClose size={18} />}
                    </button>
                </div>
            </header>

            <div className="flex gap-0">
                {/* Sidebar */}
                <aside
                    className={`max-md:hidden shrink-0 transition-all duration-300 ${
                        focusMode ? 'md:w-0 md:opacity-0 md:overflow-hidden' : 'md:w-80 md:opacity-100'
                    }`}
                >
                    <div className="md:p-4 md:pr-0 h-full">
                        <div className="md:border-r border-white/5 md:p-4 md:h-[calc(100vh-64px)] overflow-y-auto admin-scroll bg-[#0b1929]">
                            <div className={`relative mb-3 ${focusMode ? 'hidden' : 'block'}`}>
                                <Search size={15} className="absolute top-1/2 -translate-y-1/2 left-3 text-gray-400" />
                                <input
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    placeholder={t('player.search_lessons')}
                                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-white/10 bg-[#0d1f3c] text-sm font-medium text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-400/50 transition-all duration-200"
                                />
                                {search && (
                                    <button onClick={() => setSearch('')} className="absolute top-1/2 -translate-y-1/2 right-3 text-gray-400 hover:text-white transition-colors">
                                        <X size={14} />
                                    </button>
                                )}
                            </div>

                            {filteredModules ? (
                                filteredModules.length > 0 ? (
                                    <div className="space-y-1.5">
                                        {filteredModules.map(m => renderLessonButton(m, selected?.id === m.id))}
                                        <p className="text-[10px] font-bold text-gray-500 pt-1">{t('player.search_results')} ({filteredModules.length})</p>
                                    </div>
                                ) : (
                                    <p className="text-xs font-bold text-gray-500 text-center py-6">{t('player.search_empty')}</p>
                                )
                            ) : (
                                <nav className="space-y-3">
                                    {chapters.map((ch, ci) => {
                                        const chMods = ch.modules || [];
                                        const open = openChs[ci] ?? true;
                                        const chDur = chMods.reduce((s, m) => s + (m.durationMinutes || 0), 0);
                                        const chDone = chMods.filter(m => completedSet.has(m.id)).length;
                                        return (
                                            <div key={ch.id || ci} className="rounded-xl overflow-hidden border border-white/5">
                                                <button
                                                    onClick={() => setOpenChs(p => ({ ...p, [ci]: !(p[ci] ?? true) }))}
                                                    className="w-full flex items-center justify-between gap-2 px-3.5 py-3 cursor-pointer text-left rtl:text-right transition-all duration-200 bg-[#0d1f3c] hover:bg-white/5"
                                                >
                                                    <span className="flex items-center gap-2 min-w-0 font-black text-sm truncate text-white">
                                                        <ChevronDown size={15} className={`text-amber-400 transition-transform duration-200 ease-out shrink-0 ${open ? 'rotate-180' : ''}`} />
                                                        {pick(ch, 'title') || t('player.lessons')}
                                                    </span>
                                                    <span className="flex items-center gap-2 text-[10px] font-bold shrink-0 text-gray-400">
                                                        {chDur > 0 && <span className="flex items-center gap-0.5"><Clock size={11} /> {chDur} {t('lessons.minutes_short')}</span>}
                                                        <span className="bg-emerald-500/20 text-emerald-400 rounded-full px-2 py-0.5">
                                                            {chDone}/{chMods.length}
                                                        </span>
                                                    </span>
                                                </button>
                                                {open && (
                                                    <div className="px-2 pb-2 space-y-1.5 border-t border-white/5">
                                                        {chMods.map(m => renderLessonButton(m, selected?.id === m.id))}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </nav>
                            )}
                        </div>
                    </div>
                </aside>

                {/* Main */}
                <main className="flex-1 min-w-0 px-4 md:px-8 py-6">
                    {/* Mobile lesson picker */}
                    <div className={`mb-4 md:hidden ${focusMode ? 'hidden' : ''}`}>
                        <select
                            value={selected?.id ?? ''}
                            onChange={e => setSelectedId(e.target.value)}
                            className="w-full px-3 py-3 rounded-xl border border-white/10 bg-[#0d1f3c] font-bold text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-400/50 cursor-pointer transition-all duration-200"
                        >
                            {chapters.map((ch, ci) => (
                                <optgroup key={ci} label={pick(ch, 'title') || t('player.lessons')}>
                                    {(ch.modules || []).map(m => (
                                        <option key={m.id} value={m.id}>
                                            {completedSet.has(m.id) ? '✔ ' : isInProgress(m) ? '⏳ ' : ''}{pick(m, 'title')}
                                        </option>
                                    ))}
                                </optgroup>
                            ))}
                        </select>
                    </div>
                    <motion.div layout className="space-y-4 min-h-[300px]">
                        {renderStage()}
                        {renderDeck()}
                    </motion.div>
                </main>
            </div>
        </div>
    );
}

// ---------- Sub components ----------

function FileVideoPlayer({ src, posKey, initialPos, completed, onToggleComplete, progressing }: {
    src: string;
    posKey: string;
    initialPos: number;
    completed: boolean;
    onToggleComplete: () => void;
    progressing: boolean;
}) {
    const { t } = useI18n();
    const videoRef = useRef<HTMLVideoElement>(null);
    const wrapRef = useRef<HTMLDivElement>(null);
    const [playing, setPlaying] = useState(false);
    const [current, setCurrent] = useState(0);
    const [duration, setDuration] = useState(0);
    const [speed, setSpeed] = useState(1);
    const [muted, setMuted] = useState(false);
    const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const onReady = () => {
        const v = videoRef.current;
        if (!v) return;
        setDuration(v.duration || 0);
        if (initialPos > 5 && initialPos < (v.duration || 0) - 5) {
            v.currentTime = initialPos;
        }
    };

    const onTime = () => {
        const v = videoRef.current;
        if (!v) return;
        setCurrent(v.currentTime);
        if (saveTimer.current) return;
        saveTimer.current = setTimeout(() => {
            window.localStorage.setItem(posKey, String(v.currentTime));
            saveTimer.current = null;
        }, 3000);
    };

    useEffect(() => () => { if (saveTimer.current) clearTimeout(saveTimer.current); }, []);

    const togglePlay = () => {
        const v = videoRef.current;
        if (!v) return;
        if (v.paused) { v.play(); setPlaying(true); }
        else { v.pause(); setPlaying(false); }
    };

    const toggleMute = () => {
        const v = videoRef.current;
        if (!v) return;
        v.muted = !v.muted;
        setMuted(v.muted);
    };

    const fullscreen = () => {
        const el = wrapRef.current;
        if (!el) return;
        if (document.fullscreenElement) document.exitFullscreen();
        else el.requestFullscreen().catch(() => { });
    };

    const seek = (e: ChangeEvent<HTMLInputElement>) => {
        const v = videoRef.current;
        if (!v) return;
        const tSec = parseFloat(e.target.value);
        v.currentTime = tSec;
        setCurrent(tSec);
    };

    const speedList = [0.5, 0.75, 1, 1.25, 1.5, 2];

    return (
        <div ref={wrapRef} className="rounded-2xl overflow-hidden bg-black shadow-xl shadow-black/30 relative group">
            <video
                ref={videoRef}
                src={`${API_BASE_URL}${src}`}
                className="w-full aspect-video"
                muted={muted}
                onLoadedMetadata={onReady}
                onTimeUpdate={onTime}
                onPlay={() => setPlaying(true)}
                onPause={() => setPlaying(false)}
                onEnded={() => { setPlaying(false); window.localStorage.removeItem(posKey); onToggleComplete(); }}
                preload="metadata"
            />
            {/* Controls */}
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent px-4 pt-10 pb-3">
                <div dir="ltr" className="mb-1.5">
                    <input
                        type="range"
                        min={0}
                        max={duration || 0}
                        step={0.1}
                        value={current}
                        onChange={seek}
                        className="w-full h-1.5 accent-amber-400 cursor-pointer"
                    />
                </div>
                <div className="flex items-center justify-between gap-2 text-white">
                    <div className="flex items-center gap-2">
                        <button onClick={togglePlay} className="w-9 h-9 rounded-full bg-white/15 hover:bg-white/30 flex items-center justify-center transition-all duration-200 cursor-pointer" title={playing ? t('player.pause') : t('player.play')}>
                            {playing ? <Pause size={16} /> : <Play size={16} className="translate-x-[1px]" />}
                        </button>
                        <select
                            value={speed}
                            onChange={e => { const f = parseFloat(e.target.value); setSpeed(f); if (videoRef.current) videoRef.current.playbackRate = f; }}
                            className="bg-white/15 hover:bg-white/30 text-xs font-bold rounded-lg px-2 py-1.5 cursor-pointer outline-none transition-all duration-200"
                            title={t('player.speed')}
                        >
                            {speedList.map(sp => (
                                <option key={sp} value={sp} className="text-black">{sp}x</option>
                            ))}
                        </select>
                        <button onClick={toggleMute} className="w-9 h-9 rounded-full bg-white/15 hover:bg-white/30 flex items-center justify-center transition-all duration-200 cursor-pointer">
                            {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                        </button>
                        <span className="text-[11px] font-bold text-white/80" dir="ltr">
                            {fmtTime(current)} / {fmtTime(duration)}
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={onToggleComplete} disabled={progressing} className="flex items-center gap-1.5 text-[11px] font-bold rounded-lg px-3 py-2 transition-all duration-200 cursor-pointer disabled:opacity-40 bg-white/15 hover:bg-white/30">
                            {completed ? <CheckCircle size={13} className="text-emerald-400" /> : <CheckCircle size={13} />}
                            {completed ? t('player.completed') : t('player.mark_complete')}
                        </button>
                        <button onClick={fullscreen} className="w-9 h-9 rounded-full bg-white/15 hover:bg-white/30 flex items-center justify-center transition-all duration-200 cursor-pointer" title={t('player.fullscreen')}>
                            <Maximize size={16} />
                        </button>
                    </div>
                </div>
                {initialPos > 5 && !completed && (
                    <p className="text-[10px] text-white/60 mt-1 flex items-center gap-1">
                        <RotateCcw size={10} /> {t('player.resumed_at')} {fmtTime(initialPos)}
                    </p>
                )}
            </div>
        </div>
    );
}

function PdfViewer({ url, m }: { url: string; m: CourseModule }) {
    const { t, pick } = useI18n();
    const [zoom, setZoom] = useState(1);
    const src = API_BASE_URL + url;
    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
                <button onClick={() => setZoom(z => Math.min(2.5, z + 0.2))} className="inline-flex items-center gap-1.5 text-xs font-bold bg-white/10 text-white px-3 py-2 rounded-xl hover:bg-white/20 transition-all duration-200 cursor-pointer" title={t('player.zoom_in')}>
                    <ZoomIn size={14} /> {t('player.zoom_in')}
                </button>
                <button onClick={() => setZoom(z => Math.max(0.6, z - 0.2))} className="inline-flex items-center gap-1.5 text-xs font-bold bg-white/10 text-white px-3 py-2 rounded-xl hover:bg-white/20 transition-all duration-200 cursor-pointer" title={t('player.zoom_out')}>
                    <ZoomOut size={14} /> {t('player.zoom_out')}
                </button>
                <button onClick={() => setZoom(1)} className="inline-flex items-center gap-1.5 text-xs font-bold bg-white/10 text-white px-3 py-2 rounded-xl hover:bg-white/20 transition-all duration-200 cursor-pointer" title={t('player.zoom_reset')}>
                    <Maximize2 size={14} /> {Math.round(zoom * 100)}%
                </button>
                <a href={src} target="_blank" rel="noreferrer" download className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-300 border border-white/10 px-3 py-2 rounded-xl hover:border-amber-400/30 hover:text-amber-400 transition-all duration-200 cursor-pointer">
                    <Download size={14} /> {t('player.download_pdf')}
                </a>
                <span className="text-[11px] font-bold text-gray-500 truncate max-w-[200px]">{pick(m, 'title')}</span>
            </div>
            <div className="rounded-2xl overflow-hidden border border-white/10 bg-black h-[600px] overflow-auto">
                <object data={src} type="application/pdf" className="w-full h-full" style={{ transform: `scale(${zoom})`, transformOrigin: 'top center' }}>
                    <iframe src={src} className="w-full h-full" title="PDF" />
                </object>
            </div>
        </div>
    );
}

function TaskStage({ tasks, taskDraft, setTaskDraft, taskFile, setTaskFile, submitting, onSubmit, dragOver, setDragOver, fileInputRef }: {
    tasks: LessonTask[];
    taskDraft: string;
    setTaskDraft: (v: string) => void;
    taskFile: File | null;
    setTaskFile: (f: File | null) => void;
    submitting: boolean;
    onSubmit: (task: LessonTask) => void;
    dragOver: boolean;
    setDragOver: (v: boolean) => void;
    fileInputRef: RefObject<HTMLInputElement | null>;
}) {
    const { t, pick } = useI18n();
    const handleFile = (f: File | undefined | null) => {
        if (f) setTaskFile(f);
    };
    return (
        <div className="space-y-4">
            {tasks.map(task => {
                const overdue = task.dueDate ? new Date(task.dueDate) < new Date() : false;
                const sub = task.submissions?.[0] ?? null;
                const graded = typeof sub?.score === 'number';
                return (
                    <div key={task.id} className="rounded-2xl border border-white/5 overflow-hidden shadow-xl shadow-black/20 bg-[#111f3a]">
                        <div className="px-5 py-4 bg-white/5 border-b border-white/5 flex flex-wrap items-center justify-between gap-2">
                            <h3 className="font-black text-white flex items-center gap-2 text-sm">
                                <ClipboardList size={16} className="text-amber-400" /> {pick(task, 'title')}
                            </h3>
                            <div className="flex items-center gap-2 text-xs font-bold">
                                {task.dueDate && (
                                    <span className={`px-2.5 py-1 rounded-lg ${overdue ? 'bg-red-500/20 text-red-400' : 'bg-white/10 text-gray-300'}`}>
                                        {t('tasks.due_on')} {new Date(task.dueDate).toLocaleDateString()}
                                    </span>
                                )}
                                <span className="bg-amber-500/20 text-amber-400 px-2.5 py-1 rounded-lg">{t('tasks.max_score_label')} {task.maxScore}</span>
                            </div>
                        </div>
                        <div className="p-5 space-y-4">
                            {pick(task, 'description') && <p className="text-sm text-gray-300 whitespace-pre-wrap font-medium">{pick(task, 'description')}</p>}
                            {(task.attachmentUrl || (task.links || []).length > 0) && (
                                <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
                                    {task.attachmentUrl && (
                                        <a href={task.attachmentUrl.startsWith('/') ? API_BASE_URL + task.attachmentUrl : task.attachmentUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 font-bold text-gray-300 hover:text-amber-400 transition-all duration-200">
                                            <Download size={14} /> {t('tasks.attachment')}
                                        </a>
                                    )}
                                    {(task.links || []).map((lk, i) => (
                                        <a key={i} href={lk.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 font-bold text-gray-300 hover:text-amber-400 transition-all duration-200">
                                            <Link2 size={14} /> {pick(lk, 'label') || lk.url}
                                        </a>
                                    ))}
                                </div>
                            )}

                            {graded ? (
                                <div className="flex items-center gap-2 text-sm font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3">
                                    <CheckCircle size={16} /> {t('tasks.current_grade')}: {sub?.score} / {task.maxScore}
                                    {sub?.notes ? ` — ${sub.notes}` : ''}
                                </div>
                            ) : sub ? (
                                <div className="text-sm text-gray-300 bg-white/5 border border-white/10 rounded-xl p-3">
                                    {t('tasks.submitted_at')} {sub.submittedAt ? new Date(sub.submittedAt).toLocaleString() : ''}
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <div
                                        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                                        onDragLeave={() => setDragOver(false)}
                                        onDrop={e => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files?.[0]); }}
                                        onClick={() => fileInputRef.current?.click()}
                                        className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all duration-200 cursor-pointer ${
                                            dragOver
                                                ? 'border-amber-400 bg-amber-400/10'
                                                : 'border-white/10 hover:border-amber-400/50 hover:bg-white/5'
                                        }`}
                                    >
                                        <UploadCloud size={30} className={`mx-auto mb-2 ${dragOver ? 'text-amber-400' : 'text-amber-400/70'}`} />
                                        {taskFile ? (
                                            <p className="text-sm font-bold text-white truncate max-w-sm mx-auto">{taskFile.name}</p>
                                        ) : (
                                            <>
                                                <p className="text-sm font-bold text-white">{t('player.drop_zone')}</p>
                                                <p className="text-xs text-gray-400 font-semibold mt-1">{t('player.drop_hint')}</p>
                                            </>
                                        )}
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            accept=".pdf,.jpg,.jpeg,.png,.webp"
                                            className="hidden"
                                            onChange={e => { handleFile(e.target.files?.[0]); e.target.value = ''; }}
                                        />
                                    </div>
                                    {taskFile && (
                                        <button onClick={() => setTaskFile(null)} className="text-xs font-bold text-red-400 hover:text-red-300 transition-all duration-200">
                                            {t('player.remove_file')}
                                        </button>
                                    )}
                                    <textarea
                                        value={taskDraft}
                                        onChange={e => setTaskDraft(e.target.value)}
                                        rows={3}
                                        placeholder={t('lessons.answer_placeholder')}
                                        className="w-full bg-[#0d1f3c] border border-white/10 rounded-xl p-3.5 focus:ring-2 focus:ring-amber-400/50 outline-none transition-all duration-200 placeholder:text-gray-500 text-sm text-white"
                                    />
                                    <button
                                        onClick={() => onSubmit(task)}
                                        disabled={submitting || (!taskDraft.trim() && !taskFile)}
                                        className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 text-black disabled:opacity-40 px-6 py-3 rounded-xl font-black text-sm transition-all duration-200 cursor-pointer disabled:cursor-not-allowed hover:shadow-lg hover:shadow-amber-500/20"
                                    >
                                        {submitting ? <Loader size={14} className="animate-spin" /> : <Send size={14} />} {t('common.submit')}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

function ResourceStage({ m }: { m: CourseModule }) {
    const { t, pick } = useI18n();
    return (
        <div className="space-y-4">
            {(m.files || []).length > 0 && (
                <div>
                    <h4 className="text-xs font-black text-amber-400/70 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                        <FileText size={14} className="text-amber-400" /> {t('courseDetail.lesson_files')}
                    </h4>
                    <div className="grid sm:grid-cols-2 gap-2">
                        {(m.files || []).map((f, i) => {
                            const isPdf = /\.pdf$/i.test(f.url);
                            return (
                                <a key={i} href={f.url.startsWith('/') ? API_BASE_URL + f.url : f.url} target="_blank" rel="noreferrer"
                                    className="flex items-center gap-2 text-sm font-bold text-gray-300 bg-[#111f3a] border border-white/5 rounded-xl px-4 py-3 hover:border-amber-400/30 hover:text-amber-400 transition-all duration-200">
                                    <FileText size={16} className="text-amber-400" />
                                    <span className="truncate">{pick(f, 'name') || f.url.split('/').pop() || f.url}</span>
                                    {isPdf && <span className="text-[9px] font-black text-emerald-400 bg-emerald-500/20 rounded px-1.5 py-0.5 uppercase">pdf</span>}
                                    <Download size={14} className="ml-auto shrink-0" />
                                </a>
                            );
                        })}
                    </div>
                </div>
            )}
            {(m.links || []).length > 0 && (
                <div>
                    <h4 className="text-xs font-black text-amber-400/70 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                        <Link2 size={14} className="text-amber-400" /> {t('courseDetail.lesson_links')}
                    </h4>
                    <div className="flex flex-wrap gap-2">
                        {(m.links || []).map((lk, i) => (
                            <a key={i} href={lk.url} target="_blank" rel="noreferrer"
                                className="inline-flex items-center gap-1.5 text-sm font-bold text-gray-300 bg-[#111f3a] border border-white/5 rounded-lg px-4 py-2.5 hover:border-amber-400/30 hover:text-amber-400 transition-all duration-200">
                                <Link2 size={14} /> {pick(lk, 'label') || lk.url}
                            </a>
                        ))}
                    </div>
                </div>
            )}
            {(!(m.files || []).length && !(m.links || []).length) && (
                <p className="text-sm text-gray-500 font-bold text-center py-4">{t('player.resource_empty')}</p>
            )}
        </div>
    );
}

function NotesEditor({ initial, moduleId, onSave }: {
    initial: string;
    moduleId: string;
    onSave: (content: string, moduleId: string) => Promise<void>;
}) {
    const { t } = useI18n();
    const [draft, setDraft] = useState(initial);
    const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

    const onChange = (v: string) => {
        setDraft(v);
        setStatus('idle');
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(async () => {
            if (!v.trim()) return;
            setStatus('saving');
            try {
                await onSave(v, moduleId);
                setStatus('saved');
            } catch {
                setStatus('error');
            }
        }, 900);
    };

    return (
        <div>
            <textarea
                value={draft}
                onChange={e => onChange(e.target.value)}
                rows={7}
                placeholder={t('player.notes_placeholder')}
                className="w-full bg-[#0d1f3c] border border-white/10 rounded-2xl p-4 focus:ring-2 focus:ring-amber-400/50 outline-none transition-all duration-200 placeholder:text-gray-500 text-sm text-white"
            />
            <div className="flex items-center gap-2 mt-2 text-xs font-bold text-gray-500">
                {status === 'idle' && <span>{t('player.notes_autosave')}</span>}
                {status === 'saving' && <span className="flex items-center gap-1.5"><Loader size={12} className="animate-spin" /> {t('player.notes_saving')}</span>}
                {status === 'saved' && <span className="text-emerald-400 flex items-center gap-1"><CheckCircle size={12} /> {t('player.notes_saved')}</span>}
                {status === 'error' && <span className="text-red-400">{t('player.notes_error')}</span>}
            </div>
        </div>
    );
}

function flattenModules(course: CourseData): (CourseModule & { completedMap?: boolean })[] {
    const chs: CourseChapter[] = course?.chapters?.length ? course.chapters : [{ id: 'root', titleAr: null, titleEn: null, modules: course?.modules || [] }];
    return chs.flatMap(c => c.modules || []);
}
