"use client";

import { useRef, useState } from 'react';
import { FileUp, FileText, Download, ArrowLeft, Loader, CheckCircle, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import CourseForm from '@/components/CourseForm';
import { api, getErrorMessage } from '@/lib/api';
import { useI18n } from '@/lib/i18n-context';

type ImportResult = {
    valid: boolean;
    data: Record<string, unknown>;
    errors: string[];
    warnings: string[];
    missing: string[];
};

function CourseImportPanel({ onCancel }: { onCancel: () => void }) {
    const { t, isRtl } = useI18n();
    const router = useRouter();
    const [dragging, setDragging] = useState(false);
    const [busy, setBusy] = useState(false);
    const [filename, setFilename] = useState('');
    const [preview, setPreview] = useState<ImportResult | null>(null);
    const [editedData, setEditedData] = useState('');
    const createInProgress = useRef(false);
    const importIdempotencyKey = useRef<string | null>(null);

    const readFile = async (file?: File) => {
        if (!file) return;
        if (!/\.(json|md|xlsx)$/i.test(file.name)) {
            toast.error(t('courseImport.unsupported'));
            return;
        }
        if (file.size > 15 * 1024 * 1024) {
            toast.error(t('courseImport.too_large'));
            return;
        }
        setBusy(true);
        setPreview(null);
        setFilename(file.name);
        const formData = new FormData();
        formData.append('file', file);
        try {
            const response = await api.post<ImportResult>('/api/admin/courses/import/preview', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            setPreview(response.data);
            setEditedData(JSON.stringify(response.data.data, null, 2));
        } catch (error) {
            toast.error(getErrorMessage(error) || t('courseImport.parse_failed'));
        } finally {
            setBusy(false);
        }
    };

    const downloadTemplate = async (format: 'json' | 'md' | 'xlsx') => {
        try {
            const response = await api.get(`/api/admin/courses/import/templates/${format}`, { responseType: 'blob' });
            const url = URL.createObjectURL(response.data);
            const anchor = document.createElement('a');
            anchor.href = url;
            anchor.download = `course-template.${format}`;
            anchor.click();
            window.setTimeout(() => URL.revokeObjectURL(url), 1000);
        } catch (error) {
            toast.error(getErrorMessage(error) || t('courseImport.download_failed'));
        }
    };

    const createCourse = async () => {
        if (busy || createInProgress.current) return;
        createInProgress.current = true;
        setBusy(true);
        try {
            let candidate: unknown;
            try {
                candidate = JSON.parse(editedData);
            } catch {
                toast.error(t('courseImport.invalid_json'));
                return;
            }
            const validated = await api.post<ImportResult>('/api/admin/courses/import/validate', candidate);
            setPreview(validated.data);
            setEditedData(JSON.stringify(validated.data.data, null, 2));
            if (!validated.data.valid) return;
            importIdempotencyKey.current ??= globalThis.crypto.randomUUID();
            await api.post('/api/admin/courses/import/confirm', validated.data.data, {
                headers: { 'Idempotency-Key': importIdempotencyKey.current },
            });
            toast.success(t('courseImport.created'));
            router.push('/dashboard/admin/courses');
        } catch (error) {
            toast.error(getErrorMessage(error) || t('courseImport.create_failed'));
        } finally {
            setBusy(false);
            createInProgress.current = false;
        }
    };

    const lessonCount = (preview?.data.chapters as { modules?: unknown[] }[] | undefined)
        ?.reduce((sum, chapter) => sum + (chapter.modules?.length ?? 0), 0) ?? 0;
    const questionCount = (preview?.data.quizzes as { questions?: unknown[] }[] | undefined)
        ?.reduce((sum, quiz) => sum + (quiz.questions?.length ?? 0), 0) ?? 0;

    return (
        <section className="mx-auto max-w-5xl space-y-6 p-4 md:p-8" dir={isRtl ? 'rtl' : 'ltr'}>
            <header className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-black text-brand-navy">{t('courseImport.title')}</h1>
                    <p className="mt-1 text-sm text-gray-600">{t('courseImport.subtitle')}</p>
                </div>
                <button type="button" onClick={onCancel} className="inline-flex items-center gap-2 rounded-xl border border-brand-mist px-4 py-2 font-bold text-brand-navy">
                    <ArrowLeft size={17} /> {t('courseImport.back')}
                </button>
            </header>

            <div className="flex flex-wrap gap-2 rounded-2xl border border-brand-mist bg-white p-4">
                <span className="me-2 self-center text-sm font-bold text-brand-charcoal">{t('courseImport.templates')}</span>
                {(['json', 'md', 'xlsx'] as const).map(format => (
                    <button key={format} type="button" onClick={() => void downloadTemplate(format)} className="inline-flex items-center gap-2 rounded-lg bg-brand-mist/40 px-3 py-2 text-sm font-bold text-brand-navy hover:bg-brand-mist">
                        <Download size={15} /> {format.toUpperCase()}
                    </button>
                ))}
            </div>

            <label
                onDragOver={event => { event.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={event => {
                    event.preventDefault();
                    setDragging(false);
                    void readFile(event.dataTransfer.files[0]);
                }}
                className={`flex min-h-48 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 text-center transition ${dragging ? 'border-brand-gold bg-brand-gold/10' : 'border-brand-mist bg-white hover:border-brand-navy'}`}
            >
                {busy ? <Loader className="mb-3 animate-spin text-brand-navy" size={34} /> : <FileUp className="mb-3 text-brand-navy" size={34} />}
                <span className="font-bold text-brand-navy">{filename || t('courseImport.dropzone')}</span>
                <span className="mt-2 text-sm text-gray-500">{t('courseImport.formats')}</span>
                <input type="file" accept=".json,.md,.xlsx,application/json,text/markdown,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="sr-only" onChange={event => void readFile(event.target.files?.[0])} />
            </label>

            {preview && (
                <div className="space-y-4 rounded-2xl border border-brand-mist bg-white p-5 shadow-sm">
                    <div className="flex items-center gap-2 font-black text-brand-navy">
                        {preview.valid ? <CheckCircle className="text-green-600" size={20} /> : <AlertTriangle className="text-amber-600" size={20} />}
                        {preview.valid ? t('courseImport.preview_ready') : t('courseImport.preview_errors')}
                    </div>
                    <p className="text-lg font-bold text-brand-charcoal">
                        {[preview.data.titleAr, preview.data.titleEn].filter(value => typeof value === 'string' && value.trim()).join(' | ')}
                    </p>
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                        {[
                            [t('courseImport.modules'), (preview.data.chapters as unknown[] | undefined)?.length ?? 0],
                            [t('courseImport.lessons'), lessonCount],
                            [t('courseImport.quizzes'), (preview.data.quizzes as unknown[] | undefined)?.length ?? 0],
                            [t('courseImport.questions'), questionCount],
                        ].map(([label, count]) => (
                            <div key={String(label)} className="rounded-xl bg-brand-mist/30 p-3 text-center">
                                <div className="text-xl font-black text-brand-navy">{count}</div>
                                <div className="text-xs text-gray-600">{label}</div>
                            </div>
                        ))}
                    </div>

                    {!!preview.missing.length && <IssueList title={t('courseImport.missing')} items={preview.missing} />}
                    {!!preview.errors.length && <IssueList title={t('courseImport.errors')} items={preview.errors} danger />}
                    {!!preview.warnings.length && <IssueList title={t('courseImport.warnings')} items={preview.warnings} />}

                    <label className="block space-y-2">
                        <span className="font-bold text-brand-charcoal">{t('courseImport.edit_data')}</span>
                        <span className="block text-xs text-gray-500">{t('courseImport.edit_hint')}</span>
                        <textarea value={editedData} onChange={event => {
                            importIdempotencyKey.current = null;
                            setEditedData(event.target.value);
                        }} rows={18} spellCheck={false} dir="ltr" className="w-full rounded-xl border border-brand-mist bg-slate-950 p-4 font-mono text-xs leading-5 text-green-100 outline-none focus:ring-2 focus:ring-brand-gold" />
                    </label>
                    <div className="flex flex-wrap justify-end gap-3">
                        <button type="button" onClick={() => { setFilename(''); setPreview(null); setEditedData(''); }} className="rounded-xl border border-brand-mist px-5 py-3 font-bold text-brand-charcoal">
                            {t('courseImport.cancel')}
                        </button>
                        <button type="button" disabled={busy} onClick={() => void createCourse()} className="rounded-xl bg-brand-navy px-5 py-3 font-bold text-white disabled:opacity-50">
                            {busy ? t('courseImport.creating') : t('courseImport.confirm')}
                        </button>
                    </div>
                </div>
            )}
            <div className="flex items-start gap-2 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
                <FileText size={18} className="mt-0.5 shrink-0" />
                <p>{t('courseImport.limits')}</p>
            </div>
        </section>
    );
}

function IssueList({ title, items, danger = false }: { title: string; items: string[]; danger?: boolean }) {
    return (
        <div className={`rounded-xl p-4 ${danger ? 'bg-red-50 text-red-800' : 'bg-amber-50 text-amber-900'}`}>
            <h2 className="mb-2 font-bold">{title}</h2>
            <ul className="list-inside list-disc space-y-1 text-sm">{items.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}</ul>
        </div>
    );
}

export default function CourseCreateWorkspace() {
    const { t } = useI18n();
    const [mode, setMode] = useState<'manual' | 'import'>('manual');
    return (
        <>
            <div className="mx-auto flex max-w-7xl justify-end gap-2 px-4 pt-5">
                <button type="button" onClick={() => setMode('manual')} className={`rounded-xl px-4 py-2 text-sm font-bold ${mode === 'manual' ? 'bg-brand-navy text-white' : 'bg-brand-mist/50 text-brand-navy'}`}>
                    {t('courseImport.manual')}
                </button>
                <button type="button" onClick={() => setMode('import')} className={`rounded-xl px-4 py-2 text-sm font-bold ${mode === 'import' ? 'bg-brand-navy text-white' : 'bg-brand-mist/50 text-brand-navy'}`}>
                    {t('courseImport.open')}
                </button>
            </div>
            {mode === 'import' ? <CourseImportPanel onCancel={() => setMode('manual')} /> : <CourseForm />}
        </>
    );
}
