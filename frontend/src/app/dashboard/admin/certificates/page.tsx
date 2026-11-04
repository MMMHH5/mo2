"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent, type PointerEvent } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Award, Check, ChevronDown, ExternalLink, FileBadge, GripVertical, ImagePlus, LayoutTemplate, LoaderCircle, Palette, PenLine, Save, ShieldCheck, Stamp, Trash2, Upload } from 'lucide-react';
import toast from 'react-hot-toast';
import { api, API_BASE_URL, getErrorMessage } from '@/lib/api';
import { useI18n } from '@/lib/i18n-context';

type AssetKind = 'teacherSignature' | 'directorSignature' | 'academyStamp';
type CertificateLayout = Record<string, { x: number; y: number }>;
type CertificatePreset = { id: string; name: string; designKey: 'classic' | 'royal' | 'modern'; layout: CertificateLayout };
type CertificateTemplate = {
    academyNameAr: string;
    academyNameEn: string;
    titleAr: string;
    titleEn: string;
    descriptionAr: string;
    descriptionEn: string;
    directorSignatureUrl: string | null;
    academyStampUrl: string | null;
    designKey: 'classic' | 'royal' | 'modern';
    layout: CertificateLayout;
};
type InstructorRow = {
    id: string;
    email: string;
    name: string;
    signatureUrl: string | null;
};
type CertificateRow = {
    id: string;
    verificationCode: string;
    issuingDate: string;
    verificationStatus: 'VALID' | 'REVOKED' | 'EXPIRED';
    student: { id: string; email: string } | null;
};
type CourseRow = {
    id: string;
    titleAr: string;
    titleEn: string;
    _count: { certificates: number };
};
type Overview = {
    counts: { VALID: number; REVOKED: number; EXPIRED: number };
    total: number;
    courses: CourseRow[];
    instructors: InstructorRow[];
};
type CourseCertificates = {
    course: { id: string; titleAr: string; titleEn: string };
    certificates: CertificateRow[];
};

const EMPTY_TEMPLATE: CertificateTemplate = {
    academyNameAr: 'أكاديمية Laxalab',
    academyNameEn: 'Laxalab Academy',
    titleAr: 'شهادة إتمام الدورة',
    titleEn: 'Certificate of Completion',
    descriptionAr: 'بما في ذلك جميع المتطلبات الدراسية والتمارين العملية والاختبارات التقييمية اللازمة لإتمام الدورة بنجاح.',
    descriptionEn: 'Including all coursework, practical assignments, and assessments required for successful completion.',
    directorSignatureUrl: null,
    academyStampUrl: null,
    designKey: 'classic',
    layout: { brand: { x: 50, y: 9 }, title: { x: 50, y: 19 }, recipient: { x: 50, y: 43 }, course: { x: 50, y: 58 }, description: { x: 50, y: 69 }, signatures: { x: 50, y: 87 }, qr: { x: 87, y: 87 } },
};

function SignaturePad({
    label,
    savedUrl,
    kind,
    instructorId,
    onSave,
    onRemove,
    busy,
    isAr,
}: {
    label: string;
    savedUrl: string | null;
    kind: AssetKind;
    instructorId?: string;
    onSave: (kind: AssetKind, blob: Blob, instructorId?: string) => Promise<void>;
    onRemove: (kind: AssetKind, instructorId?: string) => Promise<void>;
    busy: boolean;
    isAr: boolean;
}) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const drawing = useRef(false);
    const hasDrawing = useRef(false);

    const point = (event: PointerEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return null;
        const bounds = canvas.getBoundingClientRect();
        return {
            x: (event.clientX - bounds.left) * (canvas.width / bounds.width),
            y: (event.clientY - bounds.top) * (canvas.height / bounds.height),
        };
    };

    const startDrawing = (event: PointerEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        const current = point(event);
        const context = canvas?.getContext('2d');
        if (!canvas || !context || !current) return;
        event.preventDefault();
        canvas.setPointerCapture(event.pointerId);
        drawing.current = true;
        hasDrawing.current = true;
        context.fillStyle = '#12305A';
        context.beginPath();
        context.arc(current.x, current.y, 1.5, 0, Math.PI * 2);
        context.fill();
        context.beginPath();
        context.moveTo(current.x, current.y);
    };

    const draw = (event: PointerEvent<HTMLCanvasElement>) => {
        if (!drawing.current) return;
        const current = point(event);
        const context = canvasRef.current?.getContext('2d');
        if (!current || !context) return;
        event.preventDefault();
        context.lineWidth = 3;
        context.lineCap = 'round';
        context.lineJoin = 'round';
        context.strokeStyle = '#12305A';
        context.lineTo(current.x, current.y);
        context.stroke();
    };

    const stopDrawing = () => {
        drawing.current = false;
        canvasRef.current?.getContext('2d')?.closePath();
    };

    const clear = () => {
        const canvas = canvasRef.current;
        hasDrawing.current = false;
        canvas?.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
    };

    const save = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        if (!hasDrawing.current) {
            toast.error(isAr ? 'ارسم التوقيع قبل الحفظ.' : 'Draw a signature before saving.');
            return;
        }
        canvas.toBlob((blob) => {
            if (blob) void onSave(kind, blob, instructorId);
            else toast.error(isAr ? 'تعذر إنشاء ملف التوقيع.' : 'Could not create the signature image.');
        }, 'image/png');
    };

    return (
        <section className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-white/10 dark:bg-white/[0.03]">
            <div className="flex items-center justify-between gap-3">
                <h3 className="font-bold text-brand-navy dark:text-white">{label}</h3>
                {savedUrl ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                        <Check size={14} /> {isAr ? 'محفوظ' : 'Saved'}
                    </span>
                ) : (
                    <span className="text-xs text-gray-500">{isAr ? 'لم يُضف بعد' : 'Not added yet'}</span>
                )}
            </div>
            <div className="mt-3 flex min-h-24 items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50 px-3 dark:border-white/10 dark:bg-black/10">
                {savedUrl ? (
                    <Image
                        src={`${API_BASE_URL}${savedUrl}`}
                        alt={label}
                        width={300}
                        height={120}
                        unoptimized
                        className={kind === 'academyStamp' ? 'h-24 w-24 object-contain' : 'h-20 max-w-full object-contain'}
                    />
                ) : (
                    <p className="text-xs text-gray-400">{isAr ? 'سيظهر التوقيع أو الختم هنا بعد الحفظ' : 'The saved signature or stamp will appear here'}</p>
                )}
            </div>
            {kind !== 'academyStamp' && (
                <>
                    <p className="mb-2 mt-4 text-xs font-semibold text-gray-600 dark:text-gray-300">
                        {isAr ? 'ارسم التوقيع داخل المساحة (يدعم اللمس)' : 'Draw a signature in the field (touch supported)'}
                    </p>
                    <canvas
                        ref={canvasRef}
                        width={600}
                        height={180}
                        aria-label={label}
                        className="h-28 w-full touch-none rounded-xl border border-gray-200 bg-white dark:border-white/10"
                        onPointerDown={startDrawing}
                        onPointerMove={draw}
                        onPointerUp={stopDrawing}
                        onPointerCancel={stopDrawing}
                    />
                    <div className="mt-3 flex flex-wrap gap-2">
                        <button type="button" onClick={clear} className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-bold text-gray-600 hover:bg-gray-50 dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/5">
                            {isAr ? 'مسح الرسم' : 'Clear drawing'}
                        </button>
                        <button type="button" disabled={busy} onClick={save} className="inline-flex items-center gap-2 rounded-lg bg-brand-navy px-3 py-2 text-xs font-bold text-white disabled:opacity-50 dark:bg-brand-gold dark:text-brand-navy-dark">
                            {busy ? <LoaderCircle size={14} className="animate-spin" /> : <PenLine size={14} />}
                            {isAr ? 'حفظ التوقيع' : 'Save signature'}
                        </button>
                    </div>
                </>
            )}
            {kind === 'academyStamp' && (
                <label className="mt-4 flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 px-3 py-3 text-xs font-bold text-gray-600 hover:bg-gray-50 dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/5">
                    <Upload size={15} />
                    {isAr ? 'رفع صورة الختم (PNG أو JPG أو WEBP)' : 'Upload stamp image (PNG, JPG, or WEBP)'}
                    <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="sr-only"
                        disabled={busy}
                        onChange={(event) => {
                            const file = event.target.files?.[0];
                            if (file) void onSave(kind, file, instructorId);
                            event.currentTarget.value = '';
                        }}
                    />
                </label>
            )}
            {savedUrl && (
                <button type="button" disabled={busy} onClick={() => void onRemove(kind, instructorId)} className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-red-600 hover:text-red-700 disabled:opacity-50 dark:text-red-400">
                    <Trash2 size={14} /> {isAr ? 'إزالة المحفوظ' : 'Remove saved image'}
                </button>
            )}
        </section>
    );
}

export default function AdminCertificatesPage() {
    const { locale } = useI18n();
    const isAr = locale === 'ar';
    const [template, setTemplate] = useState<CertificateTemplate>(EMPTY_TEMPLATE);
    const [presets, setPresets] = useState<CertificatePreset[]>([]);
    const [presetName, setPresetName] = useState('');
    const [overview, setOverview] = useState<Overview | null>(null);
    const [selectedInstructorId, setSelectedInstructorId] = useState('');
    const [records, setRecords] = useState<Record<string, CourseCertificates>>({});
    const [expandedCourse, setExpandedCourse] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [savingText, setSavingText] = useState(false);
    const [busyAsset, setBusyAsset] = useState<AssetKind | null>(null);
    const [error, setError] = useState('');

    const loadPage = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const [settingsResponse, overviewResponse, presetsResponse] = await Promise.all([
                api.get<CertificateTemplate>('/certificates/template'),
                api.get<Overview>('/certificates/management'),
                api.get<CertificatePreset[]>('/certificates/templates'),
            ]);
            setTemplate({ ...EMPTY_TEMPLATE, ...settingsResponse.data, layout: settingsResponse.data.layout && typeof settingsResponse.data.layout === 'object' ? { ...EMPTY_TEMPLATE.layout, ...(settingsResponse.data.layout as CertificateLayout) } : EMPTY_TEMPLATE.layout });
            setPresets(presetsResponse.data);
            setOverview(overviewResponse.data);
            setSelectedInstructorId((current) => overviewResponse.data.instructors.some((instructor) => instructor.id === current)
                ? current
                : overviewResponse.data.instructors[0]?.id || '');
        } catch (requestError) {
            const message = getErrorMessage(requestError) || (isAr ? 'تعذر تحميل إعدادات الشهادات.' : 'Could not load certificate settings.');
            setError(message);
        } finally {
            setLoading(false);
        }
    }, [isAr]);

    useEffect(() => {
        void Promise.resolve().then(() => loadPage());
    }, [loadPage]);

    const updateField = (field: keyof Pick<CertificateTemplate,
        'academyNameAr' | 'academyNameEn' | 'titleAr' | 'titleEn' | 'descriptionAr' | 'descriptionEn'>, value: string) => {
        setTemplate((current) => ({ ...current, [field]: value }));
    };

    const saveText = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setSavingText(true);
        try {
            const response = await api.patch<CertificateTemplate>('/certificates/template', {
                academyNameAr: template.academyNameAr,
                academyNameEn: template.academyNameEn,
                titleAr: template.titleAr,
                titleEn: template.titleEn,
                descriptionAr: template.descriptionAr,
                descriptionEn: template.descriptionEn,
                designKey: template.designKey,
                layout: template.layout,
            });
            setTemplate((current) => ({ ...current, ...response.data }));
            toast.success(isAr ? 'تم حفظ تصميم الشهادة.' : 'Certificate design saved.');
        } catch (requestError) {
            toast.error(getErrorMessage(requestError) || (isAr ? 'فشل حفظ تصميم الشهادة.' : 'Failed to save certificate design.'));
        } finally {
            setSavingText(false);
        }
    };

    const saveAsset = async (kind: AssetKind, blob: Blob, instructorId?: string) => {
        if (kind === 'teacherSignature' && !instructorId) {
            toast.error(isAr ? 'اختر المدرّس أولاً.' : 'Select an instructor first.');
            return;
        }
        setBusyAsset(kind);
        try {
            const form = new FormData();
            form.append('file', blob, kind === 'academyStamp' ? 'academy-stamp.png' : `${kind}.png`);
            const query = new URLSearchParams({ kind });
            if (instructorId) query.set('instructorId', instructorId);
            if (kind === 'teacherSignature') {
                const response = await api.post<InstructorRow>(
                    `/certificates/template/assets?${query.toString()}`,
                    form,
                    { headers: { 'Content-Type': 'multipart/form-data' } },
                );
                setOverview((current) => current ? {
                    ...current,
                    instructors: current.instructors.map((instructor) =>
                        instructor.id === response.data.id ? { ...instructor, signatureUrl: response.data.signatureUrl } : instructor),
                } : current);
            } else {
                const response = await api.post<CertificateTemplate>(
                    `/certificates/template/assets?${query.toString()}`,
                    form,
                    { headers: { 'Content-Type': 'multipart/form-data' } },
                );
                setTemplate((current) => ({ ...current, ...response.data }));
            }
            toast.success(isAr ? 'تم حفظ الصورة بنجاح.' : 'Image saved successfully.');
        } catch (requestError) {
            toast.error(getErrorMessage(requestError) || (isAr ? 'فشل رفع الصورة.' : 'Image upload failed.'));
        } finally {
            setBusyAsset(null);
        }
    };

    const removeAsset = async (kind: AssetKind, instructorId?: string) => {
        setBusyAsset(kind);
        try {
            if (kind === 'teacherSignature') {
                if (!instructorId) return;
                await api.delete(`/certificates/template/assets/${kind}?instructorId=${encodeURIComponent(instructorId)}`);
                setOverview((current) => current ? {
                    ...current,
                    instructors: current.instructors.map((instructor) =>
                        instructor.id === instructorId ? { ...instructor, signatureUrl: null } : instructor),
                } : current);
            } else {
                const response = await api.delete<CertificateTemplate>(`/certificates/template/assets/${kind}`);
                setTemplate((current) => ({ ...current, ...response.data }));
            }
            toast.success(isAr ? 'تمت إزالة الصورة.' : 'Image removed.');
        } catch (requestError) {
            toast.error(getErrorMessage(requestError) || (isAr ? 'تعذرت إزالة الصورة.' : 'Could not remove the image.'));
        } finally {
            setBusyAsset(null);
        }
    };

    const moveLayoutItem = (key: keyof CertificateLayout, event: React.DragEvent<HTMLDivElement>) => {
        const canvas = event.currentTarget.parentElement;
        if (!canvas) return;
        const bounds = canvas.getBoundingClientRect();
        const x = Math.max(8, Math.min(92, ((event.clientX - bounds.left) / bounds.width) * 100));
        const y = Math.max(6, Math.min(94, ((event.clientY - bounds.top) / bounds.height) * 100));
        setTemplate((current) => ({ ...current, layout: { ...current.layout, [key]: { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 } } }));
    };

    const savePreset = async () => {
        const name = presetName.trim();
        if (!name) {
            toast.error(isAr ? 'أدخل اسم القالب.' : 'Enter a template name.');
            return;
        }
        try {
            const response = await api.post<CertificatePreset>('/certificates/templates', { name, designKey: template.designKey, layout: template.layout });
            setPresets((current) => [response.data, ...current]);
            setPresetName('');
            toast.success(isAr ? 'تم حفظ قالب الشهادة.' : 'Certificate template saved.');
        } catch (requestError) {
            toast.error(getErrorMessage(requestError) || (isAr ? 'تعذر حفظ القالب.' : 'Could not save the template.'));
        }
    };

    const applyPreset = async (preset: CertificatePreset) => {
        setTemplate((current) => ({ ...current, designKey: preset.designKey, layout: preset.layout }));
        toast.success(isAr ? 'تم تطبيق القالب في المعاينة.' : 'Template applied to the preview.');
    };

    const deletePreset = async (id: string) => {
        try {
            await api.delete(`/certificates/templates/${id}`);
            setPresets((current) => current.filter((preset) => preset.id !== id));
            toast.success(isAr ? 'تم حذف القالب.' : 'Template deleted.');
        } catch (requestError) {
            toast.error(getErrorMessage(requestError) || (isAr ? 'تعذر حذف القالب.' : 'Could not delete the template.'));
        }
    };

    const toggleCourse = async (courseId: string) => {
        if (expandedCourse === courseId) {
            setExpandedCourse(null);
            return;
        }
        setExpandedCourse(courseId);
        if (records[courseId]) return;
        try {
            const response = await api.get<CourseCertificates>(`/certificates/course/${courseId}`);
            setRecords((current) => ({ ...current, [courseId]: response.data }));
        } catch (requestError) {
            setExpandedCourse(null);
            toast.error(getErrorMessage(requestError) || (isAr ? 'تعذر تحميل سجل الشهادات.' : 'Could not load certificate records.'));
        }
    };

    const changeStatus = async (certificate: CertificateRow, courseId: string) => {
        const reissue = certificate.verificationStatus !== 'VALID';
        if (!reissue && !window.confirm(isAr ? 'هل تريد إلغاء صلاحية هذه الشهادة؟' : 'Revoke this certificate?')) return;
        try {
            await api.post(`/certificates/${certificate.id}/${reissue ? 'reissue' : 'revoke'}`);
            const response = await api.get<CourseCertificates>(`/certificates/course/${courseId}`);
            setRecords((current) => ({ ...current, [courseId]: response.data }));
            await loadPage();
            toast.success(reissue
                ? (isAr ? 'تمت إعادة تفعيل الشهادة.' : 'Certificate re-issued.')
                : (isAr ? 'تم إلغاء الشهادة.' : 'Certificate revoked.'));
        } catch (requestError) {
            toast.error(getErrorMessage(requestError) || (isAr ? 'تعذر تحديث حالة الشهادة.' : 'Could not update certificate status.'));
        }
    };

    const title = (course: Pick<CourseRow, 'titleAr' | 'titleEn'>) => isAr ? course.titleAr || course.titleEn : course.titleEn || course.titleAr;
    if (loading) {
        return <div className="flex min-h-80 items-center justify-center text-gray-500"><LoaderCircle className="animate-spin" /> <span className="ms-3">{isAr ? 'جارٍ تحميل إدارة الشهادات...' : 'Loading certificate management...'}</span></div>;
    }

    return (
        <div className="space-y-7" dir={isAr ? 'rtl' : 'ltr'}>
            <header className="flex flex-col gap-4 rounded-3xl bg-gradient-to-br from-brand-navy to-[#1d426f] p-6 text-white sm:flex-row sm:items-center sm:justify-between sm:p-8">
                <div>
                    <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-gold/20 text-brand-gold-light"><Award size={25} /></div>
                    <h1 className="text-2xl font-black sm:text-3xl">{isAr ? 'إدارة الشهادات' : 'Certificate Management'}</h1>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-blue-100">
                        {isAr
                            ? 'تحكم بتصميم الشهادة ومحتواها وتوقيعاتها وختم الأكاديمية، وتابع سجل الشهادات الصادرة وحالة التحقق منها.'
                            : 'Manage certificate design, wording, signatures and academy seal, and review issued certificates and their verification status.'}
                    </p>
                </div>
                <Link href="/dashboard/admin/openings" className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-brand-gold px-4 py-3 text-sm font-black text-brand-navy-dark hover:bg-brand-gold-light">
                    <FileBadge size={17} /> {isAr ? 'إصدار الشهادات للدفعات' : 'Issue certificates for batches'}
                </Link>
            </header>

            {error && (
                <div role="alert" className="flex items-center justify-between gap-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
                    <span>{error}</span>
                    <button onClick={() => void loadPage()} className="rounded-lg border border-current px-3 py-1.5">{isAr ? 'إعادة المحاولة' : 'Retry'}</button>
                </div>
            )}

            <section className="grid gap-3 sm:grid-cols-3">
                {[
                    { title: isAr ? 'إجمالي الشهادات' : 'Total certificates', value: overview?.total ?? 0, icon: Award, color: 'text-brand-gold-dark dark:text-brand-gold-light' },
                    { title: isAr ? 'سارية' : 'Valid', value: overview?.counts.VALID ?? 0, icon: ShieldCheck, color: 'text-emerald-600 dark:text-emerald-400' },
                    { title: isAr ? 'ملغاة أو منتهية' : 'Revoked or expired', value: (overview?.counts.REVOKED ?? 0) + (overview?.counts.EXPIRED ?? 0), icon: FileBadge, color: 'text-red-600 dark:text-red-400' },
                ].map((item) => {
                    const Icon = item.icon;
                    return <div key={item.title} className="flex items-center gap-4 rounded-2xl border border-gray-200 bg-white p-5 dark:border-white/5 dark:bg-brand-navy-dark">
                        <span className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gray-100 dark:bg-white/5 ${item.color}`}><Icon size={21} /></span>
                        <div><p className="text-sm text-gray-500 dark:text-gray-400">{item.title}</p><p className="mt-1 text-2xl font-black text-brand-navy dark:text-white">{item.value}</p></div>
                    </div>;
                })}
            </section>

            <section className="rounded-3xl border border-gray-200 bg-white p-5 dark:border-white/5 dark:bg-brand-navy-dark sm:p-7">
                <div className="mb-6 flex items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-gold/10 text-brand-gold-dark dark:text-brand-gold-light"><PenLine size={19} /></span>
                    <div>
                        <h2 className="text-xl font-black text-brand-navy dark:text-white">{isAr ? 'قالب الشهادة ومحتواها' : 'Certificate template and wording'}</h2>
                        <p className="mt-1 text-sm leading-6 text-gray-500 dark:text-gray-400">
                            {isAr
                                ? 'تظهر الشهادة باسم المتدرب والدورة وتاريخ الإصدار ورمز QR للتحقق، إضافة إلى نص الاعتماد والتوقيعات والختم أدناه.'
                                : 'The certificate displays the learner, course, issue date, QR verification code, accreditation wording, signatures and seal.'}
                        </p>
                    </div>
                </div>
                <form onSubmit={saveText} className="space-y-5">
                    <div className="grid gap-4 lg:grid-cols-2">
                        {([
                            ['academyNameAr', 'اسم الأكاديمية بالعربية', 'Academy name in Arabic', 'text'],
                            ['academyNameEn', 'اسم الأكاديمية بالإنجليزية', 'Academy name in English', 'text'],
                            ['titleAr', 'عنوان الشهادة بالعربية', 'Certificate title in Arabic', 'text'],
                            ['titleEn', 'عنوان الشهادة بالإنجليزية', 'Certificate title in English', 'text'],
                        ] as const).map(([field, labelAr, labelEn]) => (
                            <label key={field} className="space-y-2 text-sm font-bold text-gray-700 dark:text-gray-200">
                                {isAr ? labelAr : labelEn}
                                <input
                                    required
                                    maxLength={120}
                                    value={template[field]}
                                    onChange={(event) => updateField(field, event.target.value)}
                                    dir={field.endsWith('Ar') ? 'rtl' : 'ltr'}
                                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 font-medium outline-none transition focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20 dark:border-white/10 dark:bg-white/5 dark:text-white"
                                />
                            </label>
                        ))}
                    </div>
                    <div className="grid gap-4 lg:grid-cols-2">
                        <label className="space-y-2 text-sm font-bold text-gray-700 dark:text-gray-200">
                            {isAr ? 'نص الاعتماد بالعربية' : 'Accreditation wording in Arabic'}
                            <textarea required maxLength={1200} rows={4} value={template.descriptionAr} onChange={(event) => updateField('descriptionAr', event.target.value)} dir="rtl" className="w-full resize-y rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 font-medium leading-6 outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20 dark:border-white/10 dark:bg-white/5 dark:text-white" />
                        </label>
                        <label className="space-y-2 text-sm font-bold text-gray-700 dark:text-gray-200">
                            {isAr ? 'نص الاعتماد بالإنجليزية' : 'Accreditation wording in English'}
                            <textarea required maxLength={1200} rows={4} value={template.descriptionEn} onChange={(event) => updateField('descriptionEn', event.target.value)} dir="ltr" className="w-full resize-y rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 font-medium leading-6 outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20 dark:border-white/10 dark:bg-white/5 dark:text-white" />
                        </label>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-4 dark:border-white/5">
                        <p className="text-xs leading-5 text-gray-500 dark:text-gray-400">
                            {isAr ? 'يتضمن التصميم رقم تحقق فريداً ورمز QR آلياً لكل شهادة.' : 'Each certificate gets a unique verification number and an automatically generated QR code.'}
                        </p>
                        <button disabled={savingText} className="inline-flex items-center gap-2 rounded-xl bg-brand-navy px-5 py-3 text-sm font-black text-white hover:bg-brand-charcoal disabled:opacity-50 dark:bg-brand-gold dark:text-brand-navy-dark">
                            {savingText ? <LoaderCircle size={17} className="animate-spin" /> : <Save size={17} />}
                            {isAr ? 'حفظ تصميم الشهادة' : 'Save certificate design'}
                        </button>
                    </div>
                </form>
            </section>

            <section className="rounded-3xl border border-gray-200 bg-white p-5 dark:border-white/5 dark:bg-brand-navy-dark sm:p-7">
                <div className="mb-5 flex items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-gold/10 text-brand-gold-dark dark:text-brand-gold-light"><LayoutTemplate size={19} /></span>
                    <div>
                        <h2 className="text-xl font-black text-brand-navy dark:text-white">{isAr ? 'مصمم الشهادة الاحترافي' : 'Professional certificate designer'}</h2>
                        <p className="mt-1 text-sm leading-6 text-gray-500 dark:text-gray-400">{isAr ? 'اسحب العناصر لتغيير مواقعها، واختر شكلاً بصرياً واحفظه كقالب قابل لإعادة الاستخدام.' : 'Drag elements to reposition them, choose a visual style, and save reusable templates.'}</p>
                    </div>
                </div>

                <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
                    <div className="overflow-auto rounded-2xl bg-slate-200 p-3 dark:bg-black/20 sm:p-5">
                        <div
                            className={`relative mx-auto aspect-[1.414/1] w-full max-w-[760px] overflow-hidden bg-white shadow-2xl ${template.designKey === 'royal' ? 'ring-[10px] ring-[#172b4d] ring-inset outline outline-1 outline-[#c6a15b]' : template.designKey === 'modern' ? 'rounded-lg' : 'border-[12px] border-[#12305A]'}`}
                            onDragOver={(event) => event.preventDefault()}
                        >
                            <div className="absolute inset-3 border border-[#c6a15b]/60" />
                            <div className="absolute inset-[18px] border border-[#12305a]/15" />
                            {(['brand', 'title', 'recipient', 'course', 'description', 'signatures', 'qr'] as const).map((key) => {
                                const pos = template.layout[key] ?? EMPTY_TEMPLATE.layout[key];
                                const labels: Record<typeof key, string> = {
                                    brand: isAr ? template.academyNameAr || 'اسم الأكاديمية' : template.academyNameEn || 'Academy',
                                    title: isAr ? template.titleAr || 'عنوان الشهادة' : template.titleEn || 'Certificate title',
                                    recipient: 'Student Name',
                                    course: 'Course Name',
                                    description: isAr ? 'نص الاعتماد والشهادة' : 'Accreditation wording',
                                    signatures: isAr ? 'التوقيعات والختم' : 'Signatures & seal',
                                    qr: 'QR',
                                };
                                return (
                                    <div
                                        key={key}
                                        draggable
                                        onDragStart={(event) => event.dataTransfer.setData('text/plain', key)}
                                        onDragEnd={(event) => moveLayoutItem(key, event)}
                                        className={`absolute z-10 cursor-move select-none border border-dashed border-brand-gold/80 bg-white/90 px-2 py-1 text-center shadow-sm transition hover:bg-white ${key === 'recipient' ? 'text-xl font-serif font-bold text-[#12305A]' : key === 'course' ? 'text-base font-bold text-[#12305A]' : 'text-xs text-gray-600'}`}
                                        style={{ left: `${pos.x}%`, top: `${pos.y}%`, transform: 'translate(-50%, -50%)', minWidth: key === 'qr' ? 46 : 120 }}
                                        title={isAr ? 'اسحب لتغيير المكان' : 'Drag to reposition'}
                                    >
                                        <GripVertical className="mr-auto inline-block text-brand-gold-dark" size={12} /> {labels[key]}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <aside className="space-y-5">
                        <div>
                            <h3 className="mb-3 flex items-center gap-2 text-sm font-black text-brand-navy dark:text-white"><Palette size={16} /> {isAr ? 'نمط التصميم' : 'Design style'}</h3>
                            <div className="grid grid-cols-3 gap-2">
                                {(['classic', 'royal', 'modern'] as const).map((design) => (
                                    <button key={design} type="button" onClick={() => setTemplate((current) => ({ ...current, designKey: design }))} className={`rounded-xl border p-3 text-xs font-bold transition ${template.designKey === design ? 'border-brand-gold bg-brand-gold/10 text-brand-navy dark:text-white' : 'border-gray-200 text-gray-500 dark:border-white/10'}`}>
                                        {design === 'classic' ? (isAr ? 'كلاسيكي' : 'Classic') : design === 'royal' ? (isAr ? 'ملكي' : 'Royal') : (isAr ? 'عصري' : 'Modern')}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <h3 className="mb-3 text-sm font-black text-brand-navy dark:text-white">{isAr ? 'قوالب محفوظة' : 'Saved templates'}</h3>
                            <div className="max-h-44 space-y-2 overflow-y-auto">
                                {presets.map((preset) => (
                                    <div key={preset.id} className="flex items-center gap-2 rounded-xl border border-gray-200 p-2 dark:border-white/10">
                                        <button type="button" onClick={() => void applyPreset(preset)} className="min-w-0 flex-1 truncate text-left text-xs font-bold text-brand-navy dark:text-white">{preset.name}</button>
                                        <button type="button" onClick={() => void deletePreset(preset.id)} aria-label={isAr ? 'حذف القالب' : 'Delete template'} className="rounded-lg p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10"><Trash2 size={14} /></button>
                                    </div>
                                ))}
                                {presets.length === 0 && <p className="rounded-xl border border-dashed border-gray-300 p-4 text-center text-xs text-gray-400 dark:border-white/10">{isAr ? 'لا توجد قوالب محفوظة' : 'No saved templates'}</p>}
                            </div>
                            <div className="mt-3 flex gap-2">
                                <input value={presetName} onChange={(event) => setPresetName(event.target.value)} maxLength={80} placeholder={isAr ? 'اسم قالب جديد' : 'New template name'} className="min-w-0 flex-1 rounded-xl border border-gray-200 px-3 py-2.5 text-xs outline-none focus:border-brand-gold dark:border-white/10 dark:bg-white/5 dark:text-white" />
                                <button type="button" onClick={() => void savePreset()} className="rounded-xl bg-brand-navy px-3 text-white dark:bg-brand-gold dark:text-brand-navy"><Save size={15} /></button>
                            </div>
                        </div>
                    </aside>
                </div>
            </section>

            <section className="space-y-4">
                <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-300"><Stamp size={19} /></span>
                    <div>
                        <h2 className="text-xl font-black text-brand-navy dark:text-white">{isAr ? 'التوقيعات والختم الرسمي' : 'Signatures and official seal'}</h2>
                        <p className="mt-1 text-sm leading-6 text-gray-500 dark:text-gray-400">
                            {isAr ? 'اختر المدرّس لحفظ توقيعه بشكل مستقل حتى لا يظهر توقيع مدرّس آخر على شهاداته. ارسم توقيع المدير وارفع ختم الأكاديمية مرة واحدة.' : 'Select each instructor to save their signature separately. This keeps another instructor’s signature off their certificates. Save the director signature and academy seal once.'}
                        </p>
                    </div>
                </div>
                <div className="grid gap-4 lg:grid-cols-3">
                    <SignaturePad label={isAr ? 'توقيع المدير' : 'Director signature'} kind="directorSignature" savedUrl={template.directorSignatureUrl} busy={busyAsset === 'directorSignature'} isAr={isAr} onSave={saveAsset} onRemove={removeAsset} />
                    <SignaturePad label={isAr ? 'ختم الأكاديمية' : 'Academy seal'} kind="academyStamp" savedUrl={template.academyStampUrl} busy={busyAsset === 'academyStamp'} isAr={isAr} onSave={saveAsset} onRemove={removeAsset} />
                    <div className="space-y-3">
                        <label className="block space-y-2 text-sm font-bold text-gray-700 dark:text-gray-200">
                            {isAr ? 'المدرّس' : 'Instructor'}
                            <select
                                value={selectedInstructorId}
                                onChange={(event) => setSelectedInstructorId(event.target.value)}
                                disabled={!overview?.instructors.length}
                                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-3 outline-none focus:border-brand-gold dark:border-white/10 dark:bg-brand-navy-dark dark:text-white"
                            >
                                {overview?.instructors.map((instructor) => (
                                    <option key={instructor.id} value={instructor.id}>{instructor.name || instructor.email}</option>
                                ))}
                            </select>
                        </label>
                        {overview?.instructors.find((instructor) => instructor.id === selectedInstructorId) ? (
                            <SignaturePad
                                key={selectedInstructorId}
                                label={`${isAr ? 'توقيع المدرّس' : 'Instructor signature'} — ${overview.instructors.find((instructor) => instructor.id === selectedInstructorId)?.name || overview.instructors.find((instructor) => instructor.id === selectedInstructorId)?.email}`}
                                kind="teacherSignature"
                                instructorId={selectedInstructorId}
                                savedUrl={overview.instructors.find((instructor) => instructor.id === selectedInstructorId)?.signatureUrl ?? null}
                                busy={busyAsset === 'teacherSignature'}
                                isAr={isAr}
                                onSave={saveAsset}
                                onRemove={removeAsset}
                            />
                        ) : (
                            <p className="rounded-2xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500 dark:border-white/10">
                                {isAr ? 'لا يوجد مدرّسون نشطون لإضافة توقيع.' : 'No active instructors are available to add a signature.'}
                            </p>
                        )}
                    </div>
                </div>
                <p className="rounded-xl bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
                    {isAr ? 'ملاحظة: الصور المعروضة توقيعات وختم مرئي على الشهادة وليست توقيعاً رقمياً تشفيرياً.' : 'Note: these are visual signature and seal images, not cryptographic digital signatures.'}
                </p>
            </section>

            <section className="overflow-hidden rounded-3xl border border-gray-200 bg-white dark:border-white/5 dark:bg-brand-navy-dark">
                <div className="flex items-center justify-between gap-3 border-b border-gray-100 p-5 dark:border-white/5 sm:px-7">
                    <div>
                        <h2 className="text-xl font-black text-brand-navy dark:text-white">{isAr ? 'سجل الشهادات الصادرة' : 'Issued certificate register'}</h2>
                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{isAr ? 'اختر دورة لمراجعة الشهادات والتحقق من حالتها أو إعادة تفعيلها.' : 'Choose a course to review certificates, verification status, and re-issue revoked certificates.'}</p>
                    </div>
                    <ImagePlus className="hidden text-brand-gold-dark dark:text-brand-gold-light sm:block" size={22} />
                </div>
                {(overview?.courses.length ?? 0) === 0 ? (
                    <p className="p-8 text-center text-sm text-gray-500">{isAr ? 'لا توجد دورات مفعّل لها إصدار الشهادات بعد.' : 'No courses are configured to issue certificates yet.'}</p>
                ) : (
                    <div className="divide-y divide-gray-100 dark:divide-white/5">
                        {overview?.courses.map((course) => {
                            const open = expandedCourse === course.id;
                            const courseData = records[course.id];
                            return <div key={course.id}>
                                <button onClick={() => void toggleCourse(course.id)} className="flex w-full items-center justify-between gap-4 px-5 py-4 text-start transition hover:bg-gray-50 dark:hover:bg-white/[0.03] sm:px-7">
                                    <span className="min-w-0">
                                        <span className="block truncate font-bold text-brand-navy dark:text-white">{title(course)}</span>
                                        <span className="mt-1 block text-xs text-gray-500">{course._count.certificates} {isAr ? 'شهادة صادرة' : 'issued'}</span>
                                    </span>
                                    <ChevronDown size={18} className={`shrink-0 text-gray-400 transition ${open ? 'rotate-180' : ''}`} />
                                </button>
                                {open && (
                                    <div className="border-t border-gray-100 bg-gray-50/70 px-4 py-4 dark:border-white/5 dark:bg-black/10 sm:px-7">
                                        {!courseData ? <p className="py-4 text-center text-sm text-gray-500">{isAr ? 'جارٍ التحميل...' : 'Loading...'}</p>
                                            : courseData.certificates.length === 0 ? <p className="py-4 text-center text-sm text-gray-500">{isAr ? 'لا توجد شهادات صادرة لهذه الدورة.' : 'No certificates have been issued for this course.'}</p>
                                                : <div className="space-y-3">
                                                    {courseData.certificates.map((certificate) => {
                                                        const valid = certificate.verificationStatus === 'VALID';
                                                        return <div key={certificate.id} className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 dark:border-white/10 dark:bg-brand-navy-dark sm:flex-row sm:items-center sm:justify-between">
                                                            <div className="min-w-0">
                                                                <p className="truncate text-sm font-bold text-brand-navy dark:text-white">{certificate.student?.email || certificate.student?.id || '—'}</p>
                                                                <p className="mt-1 break-all font-mono text-xs text-gray-500" dir="ltr">{certificate.verificationCode}</p>
                                                                <p className="mt-1 text-xs text-gray-500">{new Date(certificate.issuingDate).toLocaleDateString(isAr ? 'ar' : 'en')}</p>
                                                            </div>
                                                            <div className="flex flex-wrap items-center gap-2">
                                                                <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${valid ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'bg-red-500/10 text-red-700 dark:text-red-300'}`}>
                                                                    {valid ? (isAr ? 'سارية' : 'Valid') : certificate.verificationStatus === 'REVOKED' ? (isAr ? 'ملغاة' : 'Revoked') : (isAr ? 'منتهية' : 'Expired')}
                                                                </span>
                                                                <Link href={`/certificate/${certificate.id}`} target="_blank" className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50 dark:border-white/10 dark:text-gray-200 dark:hover:bg-white/5">
                                                                    <ExternalLink size={13} /> {isAr ? 'عرض' : 'View'}
                                                                </Link>
                                                                <button onClick={() => void changeStatus(certificate, course.id)} className={`rounded-lg px-2.5 py-2 text-xs font-bold ${valid ? 'bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-500/10 dark:text-red-300' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-300'}`}>
                                                                    {valid ? (isAr ? 'إلغاء' : 'Revoke') : (isAr ? 'إعادة تفعيل' : 'Re-issue')}
                                                                </button>
                                                            </div>
                                                        </div>;
                                                    })}
                                                </div>}
                                    </div>
                                )}
                            </div>;
                        })}
                    </div>
                )}
            </section>
        </div>
    );
}
