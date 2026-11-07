"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent, type PointerEvent } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Award, Check, ChevronDown, ExternalLink, FileBadge, GripVertical, ImagePlus, LayoutTemplate, LoaderCircle, Palette, PenLine, RotateCcw, Save, ShieldCheck, Stamp, Trash2, Type, Upload } from 'lucide-react';
import toast from 'react-hot-toast';
import { api, API_BASE_URL, getErrorMessage } from '@/lib/api';
import { useI18n } from '@/lib/i18n-context';
import CertificateDesignFrame, { CERTIFICATE_DESIGNS, type CertificateDesign } from '@/components/CertificateDesignFrame';
import CertificateSeal, { type CertificateSealShape } from '@/components/CertificateSeal';
import CertificateBilingual from '@/components/CertificateBilingual';

type AssetKind = 'teacherSignature' | 'directorSignature' | 'academyStamp';
type BrandingAsset = { name: string; url: string };
type CertificateLayout = Record<string, { x: number; y: number; zIndex?: number } | CertificateVisualStyle>;
type CertificateImageElement = { id: string; name: string; url: string };
type CertificateVisualStyle = {
    primaryColor: string;
    accentColor: string;
    backgroundColor: string;
    textColor: string;
    frameStyle: 'double' | 'single' | 'none' | 'dashed' | 'ornate';
    logoShape: 'circle' | 'rounded' | 'square';
    logoVariant: 'mark' | 'horizontal' | 'stacked';
    showLogo: boolean;
    logoUrl: string;
    logoLibrary: BrandingAsset[];
    certificateDesign: CertificateDesign;
    fontName: string;
    fontFamily: string;
    fontUrl: string | null;
    fontLibrary: BrandingAsset[];
    fontSizes: Record<string, number>;
    fontWeights: Record<string, number>;
    customElements: CustomCertificateElement[];
    customImages: CertificateImageElement[];
    imageSizes: Record<string, number>;
    pageSize: 'A4' | 'Letter' | 'A3' | 'custom';
    pageOrientation: 'landscape' | 'portrait';
    pageWidth: number;
    pageHeight: number;
    showSeal: boolean;
    sealMode: 'platform' | 'uploaded';
    sealShape: CertificateSealShape;
    sealColor: string;
    sealFillColor: string;
    sealBorderStyle: 'double' | 'solid' | 'dashed';
    sealSize: number;
    sealOpacity: number;
    sealRotation: number;
    sealImageHue: number;
    sealTextAr: string;
    sealTextEn: string;
};
const CERTIFICATE_ELEMENTS = ['logo', 'brand', 'title', 'recipient', 'course', 'description', 'signatures', 'qr', 'stamp'] as const;
type CertificateElementKey = typeof CERTIFICATE_ELEMENTS[number] | `custom-${string}` | `image-${string}`;
type CustomCertificateElement = {
    id: string;
    labelAr: string;
    labelEn: string;
    textAr: string;
    textEn: string;
};
const DEFAULT_CERTIFICATE_LOGO = '/logos/LaxaLab_Academy_Horizontal_Primary_4K.png';
const BUILT_IN_LOGOS = [
    { nameAr: 'LaxaLab Academy — أفقي أساسي', nameEn: 'LaxaLab Academy — Primary horizontal', url: DEFAULT_CERTIFICATE_LOGO },
    { nameAr: 'LaxaLab Academy — عمودي أساسي', nameEn: 'LaxaLab Academy — Primary stacked', url: '/logos/LaxaLab_Academy_Stacked_Primary_4K.png' },
    { nameAr: 'LaxaLab — أفقي أحادي داكن', nameEn: 'LaxaLab — Navy monochrome horizontal', url: '/logos/LaxaLab_Academy_Horizontal_Mono_Navy_4K.png' },
    { nameAr: 'LaxaLab — علامة أساسية', nameEn: 'LaxaLab — Primary mark', url: '/logos/LaxaLab_LAXA_Mark_Primary_4096.png' },
    { nameAr: 'LaxaLab Academy — أفقي أبيض', nameEn: 'LaxaLab Academy — White horizontal', url: '/logos/LaxaLab_Academy_Horizontal_Reverse_4K.png' },
    { nameAr: 'LaxaLab Academy — عمودي أبيض', nameEn: 'LaxaLab Academy — White stacked', url: '/logos/LaxaLab_Academy_Stacked_Reverse_4K.png' },
];
const BUILT_IN_FONTS = [
    { name: 'Georgia', family: "'Georgia', 'Times New Roman', serif" },
    { name: 'Arial', family: 'Arial, sans-serif' },
    { name: 'Times New Roman', family: "'Times New Roman', serif" },
    { name: 'Tahoma', family: 'Tahoma, sans-serif' },
    { name: 'Verdana', family: 'Verdana, sans-serif' },
    { name: 'Trebuchet MS', family: "'Trebuchet MS', sans-serif" },
    { name: 'Palatino Linotype', family: "'Palatino Linotype', 'Book Antiqua', serif" },
    { name: 'Garamond', family: 'Garamond, serif' },
];
const brandingAssetSrc = (url: string) => url.startsWith('/uploads/') ? `${API_BASE_URL}${url}` : url;

const DEFAULT_VISUAL_STYLE: CertificateVisualStyle = {
    primaryColor: '#12305A',
    accentColor: '#C6A15B',
    backgroundColor: '#FFFFFF',
    textColor: '#12305A',
    frameStyle: 'double',
    logoShape: 'rounded',
    logoVariant: 'mark',
    showLogo: true,
    logoUrl: DEFAULT_CERTIFICATE_LOGO,
    logoLibrary: [],
    certificateDesign: 'classic',
    fontName: 'Georgia',
    fontFamily: "'Georgia', 'Times New Roman', serif",
    fontUrl: null,
    fontLibrary: [],
    fontSizes: { brand: 24, title: 18, recipient: 38, course: 24, description: 15 },
    fontWeights: { brand: 700, title: 700, recipient: 700, course: 700, description: 400 },
    customElements: [],
    customImages: [],
    imageSizes: {},
    pageSize: 'A4',
    pageOrientation: 'landscape',
    pageWidth: 1123,
    pageHeight: 794,
    showSeal: true,
    sealMode: 'platform',
    sealShape: 'round',
    sealColor: '#B42318',
    sealFillColor: '#FFF9F2',
    sealBorderStyle: 'double',
    sealSize: 150,
    sealOpacity: 0.78,
    sealRotation: -8,
    sealImageHue: 0,
    sealTextAr: 'ختم الأكاديمية',
    sealTextEn: 'OFFICIAL SEAL',
};
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
type CertificateManagementTab = 'content' | 'designer' | 'assets' | 'records';

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
    layout: { logo: { x: 50, y: 9 }, brand: { x: 50, y: 13 }, title: { x: 50, y: 19 }, recipient: { x: 50, y: 43 }, course: { x: 50, y: 58 }, description: { x: 50, y: 69 }, signatures: { x: 50, y: 87 }, qr: { x: 87, y: 87 }, stamp: { x: 16, y: 82 } },
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
    const [draggingLayoutKey, setDraggingLayoutKey] = useState<keyof CertificateLayout | null>(null);
    const [selectedElement, setSelectedElement] = useState<CertificateElementKey>('logo');
    const [studioView, setStudioView] = useState<'edit' | 'final'>('edit');
    const [managementTab, setManagementTab] = useState<CertificateManagementTab>('content');
    const [overview, setOverview] = useState<Overview | null>(null);
    const [selectedInstructorId, setSelectedInstructorId] = useState('');
    const [records, setRecords] = useState<Record<string, CourseCertificates>>({});
    const [expandedCourse, setExpandedCourse] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [savingText, setSavingText] = useState(false);
    const [busyAsset, setBusyAsset] = useState<AssetKind | null>(null);
    const [busyBrandAsset, setBusyBrandAsset] = useState<'logo' | 'font' | null>(null);
    const [error, setError] = useState('');

    const savedVisualStyle = template.layout.__visualStyle && typeof template.layout.__visualStyle === 'object'
        ? template.layout.__visualStyle as Partial<CertificateVisualStyle>
        : {};
    const visualStyle: CertificateVisualStyle = {
        ...DEFAULT_VISUAL_STYLE,
        ...savedVisualStyle,
        fontSizes: savedVisualStyle.fontSizes && typeof savedVisualStyle.fontSizes === 'object' ? savedVisualStyle.fontSizes : DEFAULT_VISUAL_STYLE.fontSizes,
        fontWeights: savedVisualStyle.fontWeights && typeof savedVisualStyle.fontWeights === 'object' ? savedVisualStyle.fontWeights : DEFAULT_VISUAL_STYLE.fontWeights,
        customElements: Array.isArray(savedVisualStyle.customElements) ? savedVisualStyle.customElements : [],
        customImages: Array.isArray(savedVisualStyle.customImages) ? savedVisualStyle.customImages : [],
        imageSizes: savedVisualStyle.imageSizes && typeof savedVisualStyle.imageSizes === 'object' ? savedVisualStyle.imageSizes : {},
        pageSize: savedVisualStyle.pageSize === 'Letter' || savedVisualStyle.pageSize === 'A3' || savedVisualStyle.pageSize === 'custom' ? savedVisualStyle.pageSize : 'A4',
        pageOrientation: savedVisualStyle.pageOrientation === 'portrait' ? 'portrait' : 'landscape',
        pageWidth: Number.isFinite(savedVisualStyle.pageWidth) ? Math.min(2400, Math.max(600, Number(savedVisualStyle.pageWidth))) : DEFAULT_VISUAL_STYLE.pageWidth,
        pageHeight: Number.isFinite(savedVisualStyle.pageHeight) ? Math.min(2400, Math.max(600, Number(savedVisualStyle.pageHeight))) : DEFAULT_VISUAL_STYLE.pageHeight,
        showSeal: typeof savedVisualStyle.showSeal === 'boolean' ? savedVisualStyle.showSeal : DEFAULT_VISUAL_STYLE.showSeal,
        sealMode: savedVisualStyle.sealMode === 'uploaded' ? 'uploaded' : 'platform',
        sealShape: savedVisualStyle.sealShape ?? DEFAULT_VISUAL_STYLE.sealShape,
        sealColor: savedVisualStyle.sealColor ?? DEFAULT_VISUAL_STYLE.sealColor,
        sealFillColor: savedVisualStyle.sealFillColor ?? DEFAULT_VISUAL_STYLE.sealFillColor,
        sealBorderStyle: savedVisualStyle.sealBorderStyle ?? DEFAULT_VISUAL_STYLE.sealBorderStyle,
        sealSize: savedVisualStyle.sealSize ?? DEFAULT_VISUAL_STYLE.sealSize,
        sealOpacity: savedVisualStyle.sealOpacity ?? DEFAULT_VISUAL_STYLE.sealOpacity,
        sealRotation: savedVisualStyle.sealRotation ?? DEFAULT_VISUAL_STYLE.sealRotation,
        sealImageHue: savedVisualStyle.sealImageHue ?? DEFAULT_VISUAL_STYLE.sealImageHue,
        sealTextAr: savedVisualStyle.sealTextAr ?? DEFAULT_VISUAL_STYLE.sealTextAr,
        sealTextEn: savedVisualStyle.sealTextEn ?? DEFAULT_VISUAL_STYLE.sealTextEn,
    };

    const updateVisualStyle = (patch: Partial<CertificateVisualStyle>) => {
        setTemplate((current) => ({
            ...current,
            layout: { ...current.layout, __visualStyle: { ...visualStyle, ...patch } },
        }));
    };

    const selectedCustomElement = visualStyle.customElements.find((element) => `custom-${element.id}` === selectedElement);
    const selectedImage = visualStyle.customImages.find((image) => `image-${image.id}` === selectedElement);
    const isTextElement = selectedElement !== 'logo' && selectedElement !== 'signatures' && selectedElement !== 'qr' && selectedElement !== 'stamp' && !selectedImage;
    const selectedFontSize = visualStyle.fontSizes[selectedElement] ?? 18;
    const selectedFontWeight = visualStyle.fontWeights[selectedElement] ?? (selectedCustomElement ? 600 : 700);

    const addCustomElement = () => {
        const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}`;
        const element: CustomCertificateElement = {
            id,
            labelAr: isAr ? 'عنصر جديد' : 'New element',
            labelEn: 'New element',
            textAr: 'اكتب النص هنا',
            textEn: 'Enter text here',
        };
        const key = `custom-${id}` as const;
        const index = visualStyle.customElements.length;
        setTemplate((current) => ({
            ...current,
            layout: {
                ...current.layout,
                [key]: { x: 50, y: Math.min(82, 72 + index * 5) },
                __visualStyle: { ...visualStyle, customElements: [...visualStyle.customElements, element] },
            },
        }));
        setSelectedElement(key);
    };

    const updateCustomElement = (id: string, patch: Partial<CustomCertificateElement>) => {
        updateVisualStyle({
            customElements: visualStyle.customElements.map((element) =>
                element.id === id ? { ...element, ...patch } : element),
        });
    };

    const removeCustomElement = (id: string) => {
        const key = `custom-${id}`;
        const layout = { ...template.layout };
        delete layout[key];
        setTemplate((current) => ({
            ...current,
            layout: {
                ...layout,
                __visualStyle: {
                    ...visualStyle,
                    customElements: visualStyle.customElements.filter((element) => element.id !== id),
                },
            },
        }));
        setSelectedElement('title');
    };

    const addCustomImage = async (file: File) => {
        if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
            toast.error(isAr ? 'ارفع صورة PNG أو JPG أو WEBP لا يتجاوز حجمها 5 ميجابايت.' : 'Upload a PNG, JPG, or WEBP image up to 5 MB.');
            return;
        }
        setBusyBrandAsset('logo');
        try {
            const form = new FormData();
            form.append('file', file);
            const response = await api.post<BrandingAsset & { kind: string }>('/certificates/template/branding-assets?kind=logo', form, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            const image: CertificateImageElement = {
                id: crypto.randomUUID(),
                name: file.name,
                url: response.data.url,
            };
            const key = `image-${image.id}`;
            setTemplate((current) => ({
                ...current,
                layout: {
                    ...current.layout,
                    [key]: { x: 50, y: 50 },
                    __visualStyle: {
                        ...visualStyle,
                        customImages: [...visualStyle.customImages, image],
                        imageSizes: { ...visualStyle.imageSizes, [image.id]: 160 },
                    },
                },
            }));
            setSelectedElement(key as CertificateElementKey);
            toast.success(isAr ? 'أضيفت الصورة إلى مساحة التصميم.' : 'Image added to the design canvas.');
        } catch (requestError) {
            toast.error(getErrorMessage(requestError) || (isAr ? 'تعذر رفع الصورة.' : 'Could not upload the image.'));
        } finally {
            setBusyBrandAsset(null);
        }
    };

    const removeCustomImage = (id: string) => {
        const key = `image-${id}`;
        const layout = { ...template.layout };
        delete layout[key];
        const imageSizes = { ...visualStyle.imageSizes };
        delete imageSizes[id];
        setTemplate((current) => ({
            ...current,
            layout: {
                ...layout,
                __visualStyle: {
                    ...visualStyle,
                    customImages: visualStyle.customImages.filter((image) => image.id !== id),
                    imageSizes,
                },
            },
        }));
        setSelectedElement('title');
    };

    const adjustLayer = (key: CertificateElementKey, offset: number) => {
        const position = template.layout[key];
        const point = position && 'x' in position ? position : { x: 50, y: 50, zIndex: 10 };
        setTemplate((current) => ({
            ...current,
            layout: { ...current.layout, [key]: { ...point, zIndex: Math.max(1, Math.min(30, (point.zIndex ?? 10) + offset)) } },
        }));
    };

    const setSelectedTypography = (field: 'fontSizes' | 'fontWeights', value: number) => {
        updateVisualStyle({ [field]: { ...visualStyle[field], [selectedElement]: value } });
    };

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

    const uploadBrandAsset = async (kind: 'logo' | 'font', file: File) => {
        const isSupported = kind === 'logo'
            ? ['image/png', 'image/jpeg', 'image/webp'].includes(file.type)
            : /\.(woff2?|ttf|otf)$/i.test(file.name);
        if (!isSupported) {
            toast.error(isAr
                ? (kind === 'logo' ? 'ارفع شعاراً بصيغة PNG أو JPG أو WEBP.' : 'ارفع خطاً بصيغة WOFF أو WOFF2 أو TTF أو OTF.')
                : (kind === 'logo' ? 'Upload a PNG, JPG, or WEBP logo.' : 'Upload a WOFF, WOFF2, TTF, or OTF font.'));
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            toast.error(isAr ? 'يجب ألا يتجاوز حجم الملف 5 ميجابايت.' : 'The file must be 5 MB or smaller.');
            return;
        }

        setBusyBrandAsset(kind);
        try {
            const form = new FormData();
            form.append('file', file);
            const response = await api.post<BrandingAsset & { kind: string }>(
                `/certificates/template/branding-assets?kind=${kind}`,
                form,
                { headers: { 'Content-Type': 'multipart/form-data' } },
            );
            const uploadedAsset = { name: file.name, url: response.data.url };
            setTemplate((current) => {
                const currentStyle = { ...DEFAULT_VISUAL_STYLE, ...((current.layout.__visualStyle ?? {}) as Partial<CertificateVisualStyle>) };
                const updatedStyle: CertificateVisualStyle = kind === 'logo'
                    ? { ...currentStyle, logoUrl: uploadedAsset.url, logoLibrary: [...(Array.isArray(currentStyle.logoLibrary) ? currentStyle.logoLibrary : []), uploadedAsset] }
                    : {
                        ...currentStyle,
                        fontName: uploadedAsset.name,
                        fontFamily: "'LaxaCertificateCustom', sans-serif",
                        fontUrl: uploadedAsset.url,
                        fontLibrary: [...(Array.isArray(currentStyle.fontLibrary) ? currentStyle.fontLibrary : []), uploadedAsset],
                    };
                return { ...current, layout: { ...current.layout, __visualStyle: updatedStyle } };
            });
            toast.success(isAr ? 'تم رفع الملف. احفظ تصميم الشهادة لتثبيته.' : 'File uploaded. Save the certificate design to keep it.');
        } catch (requestError) {
            toast.error(getErrorMessage(requestError) || (isAr ? 'تعذر رفع الملف.' : 'Could not upload the file.'));
        } finally {
            setBusyBrandAsset(null);
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

    const moveLayoutItem = (key: keyof CertificateLayout, event: React.PointerEvent<HTMLDivElement>) => {
        const canvas = event.currentTarget.parentElement;
        if (!canvas) return;
        const bounds = canvas.getBoundingClientRect();
        const x = Math.max(8, Math.min(92, ((event.clientX - bounds.left) / bounds.width) * 100));
        const y = Math.max(6, Math.min(94, ((event.clientY - bounds.top) / bounds.height) * 100));
        setTemplate((current) => {
            const existing = current.layout[key];
            const point = existing && 'x' in existing ? existing : undefined;
            return {
                ...current,
                layout: {
                    ...current.layout,
                    [key]: {
                        ...(point ? { zIndex: point.zIndex } : {}),
                        x: Math.round(x * 10) / 10,
                        y: Math.round(y * 10) / 10,
                    },
                },
            };
        });
    };

    const beginLayoutDrag = (key: keyof CertificateLayout, event: React.PointerEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        setDraggingLayoutKey(key);
        moveLayoutItem(key, event);
    };

    const resetLayout = () => {
        const customPositions = [
            ...visualStyle.customElements.map((element) => {
                const key = `custom-${element.id}`;
                return [key, template.layout[key] ?? { x: 50, y: 50 }] as const;
            }),
            ...visualStyle.customImages.map((image) => {
                const key = `image-${image.id}`;
                return [key, template.layout[key] ?? { x: 50, y: 50 }] as const;
            }),
        ];
        setTemplate((current) => ({
            ...current,
            layout: { ...EMPTY_TEMPLATE.layout, ...Object.fromEntries(customPositions), __visualStyle: visualStyle },
        }));
        toast.success(isAr ? 'تمت إعادة العناصر إلى وضعها الافتراضي.' : 'Elements returned to the default layout.');
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
        setTemplate((current) => ({
            ...current,
            designKey: preset.designKey,
            layout: { ...preset.layout, __visualStyle: preset.layout.__visualStyle ?? visualStyle },
        }));
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
    const previewInstructor = overview?.instructors.find((instructor) => instructor.id === selectedInstructorId);
    const previewElementKeys: CertificateElementKey[] = [
        ...CERTIFICATE_ELEMENTS,
        ...visualStyle.customElements.map((element) => `custom-${element.id}` as const),
        ...visualStyle.customImages.map((image) => `image-${image.id}` as const),
    ];
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

            <nav role="tablist" aria-label={isAr ? 'أقسام إدارة الشهادات' : 'Certificate management sections'} className="grid grid-cols-2 gap-2 rounded-2xl border border-gray-200 bg-white p-2 dark:border-white/5 dark:bg-brand-navy-dark sm:grid-cols-4">
                {([
                    { id: 'content', icon: PenLine, label: isAr ? 'المحتوى والنصوص' : 'Content & wording', hint: isAr ? 'بيانات الشهادة' : 'Certificate details' },
                    { id: 'designer', icon: LayoutTemplate, label: isAr ? 'مصمم الشهادة' : 'Certificate designer', hint: isAr ? 'القوالب والتنسيق' : 'Templates & layout' },
                    { id: 'assets', icon: Stamp, label: isAr ? 'التوقيعات والختم' : 'Signatures & seal', hint: isAr ? 'الهوية الرسمية' : 'Official assets' },
                    { id: 'records', icon: FileBadge, label: isAr ? 'سجل الشهادات' : 'Certificate register', hint: isAr ? 'المتابعة والتحقق' : 'Manage issued certificates' },
                ] as const).map((tab) => {
                    const Icon = tab.icon;
                    const selected = managementTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            type="button"
                            role="tab"
                            id={`certificate-tab-${tab.id}`}
                            aria-controls="certificate-management-panel"
                            aria-selected={selected}
                            onClick={() => setManagementTab(tab.id)}
                            className={`flex min-h-[72px] items-center gap-3 rounded-xl px-3 py-3 text-start transition sm:px-4 ${selected
                                ? 'bg-brand-navy text-white shadow-sm dark:bg-brand-gold dark:text-brand-navy-dark'
                                : 'text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-white/5'}`}
                        >
                            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${selected ? 'bg-white/10 dark:bg-brand-navy/10' : 'bg-gray-100 text-brand-navy dark:bg-white/5 dark:text-brand-gold-light'}`}>
                                <Icon size={19} />
                            </span>
                            <span className="min-w-0">
                                <span className="block text-sm font-black">{tab.label}</span>
                                <span className={`mt-0.5 block text-xs ${selected ? 'text-white/70 dark:text-brand-navy/70' : 'text-gray-500 dark:text-gray-400'}`}>{tab.hint}</span>
                            </span>
                        </button>
                    );
                })}
            </nav>

            {managementTab === 'content' && <section role="tabpanel" id="certificate-management-panel" aria-labelledby="certificate-tab-content" className="rounded-3xl border border-gray-200 bg-white p-5 dark:border-white/5 dark:bg-brand-navy-dark sm:p-7">
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
            </section>}

            {managementTab === 'designer' && <section role="tabpanel" id="certificate-management-panel" aria-labelledby="certificate-tab-designer" className="rounded-3xl border border-gray-200 bg-white p-5 dark:border-white/5 dark:bg-brand-navy-dark sm:p-7">
                {visualStyle.fontUrl?.startsWith('/uploads/certificates/branding/') && !visualStyle.fontUrl.includes('..') && (
                    <style>{`@font-face { font-family: 'LaxaCertificateCustom'; src: url("${brandingAssetSrc(visualStyle.fontUrl)}"); font-display: swap; }`}</style>
                )}
                <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-gold/10 text-brand-gold-dark dark:text-brand-gold-light"><LayoutTemplate size={19} /></span>
                        <div>
                            <h2 className="text-xl font-black text-brand-navy dark:text-white">{isAr ? 'مصمم الشهادة الاحترافي' : 'Professional certificate designer'}</h2>
                            <p className="mt-1 text-sm leading-6 text-gray-500 dark:text-gray-400">{isAr ? 'اسحب العناصر بالماوس أو اللمس لتغيير مواقعها، واختر شكلاً بصرياً واحفظه كقالب قابل لإعادة الاستخدام.' : 'Drag elements with a mouse or touch to reposition them, choose a visual style, and save reusable templates.'}</p>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <div className="inline-flex rounded-xl border border-gray-200 p-1 dark:border-white/10">
                            <button type="button" onClick={() => setStudioView('edit')} className={`rounded-lg px-3 py-2 text-xs font-bold ${studioView === 'edit' ? 'bg-brand-navy text-white dark:bg-brand-gold dark:text-brand-navy-dark' : 'text-gray-600 dark:text-gray-300'}`}>
                                {isAr ? 'تحرير' : 'Edit'}
                            </button>
                            <button type="button" onClick={() => setStudioView('final')} className={`rounded-lg px-3 py-2 text-xs font-bold ${studioView === 'final' ? 'bg-brand-navy text-white dark:bg-brand-gold dark:text-brand-navy-dark' : 'text-gray-600 dark:text-gray-300'}`}>
                                {isAr ? 'المعاينة النهائية' : 'Final preview'}
                            </button>
                        </div>
                        {studioView === 'edit' && (
                            <button type="button" onClick={resetLayout} className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-xs font-bold text-gray-600 hover:border-brand-gold hover:text-brand-gold-dark dark:border-white/10 dark:text-gray-300">
                                <RotateCcw size={15} /> {isAr ? 'إعادة المواضع' : 'Reset positions'}
                            </button>
                        )}
                    </div>
                </div>

                {studioView === 'final' ? (
                    <div className="rounded-2xl bg-slate-200 p-3 dark:bg-black/20 sm:p-5">
                        <CertificateBilingual
                            studentName={isAr ? 'اسم الطالب التجريبي' : 'Sample Student'}
                            courseName={isAr ? 'اسم الدورة التدريبية' : 'Sample Course'}
                            instructorName={previewInstructor?.name || (isAr ? 'اسم المدرّس' : 'Instructor Name')}
                            instructorSignatureUrl={previewInstructor?.signatureUrl}
                            issueDate="2025-01-01"
                            verificationCode="PREVIEW-2025"
                            verificationUrl="https://laxalab.example/verify-certificate?code=PREVIEW-2025"
                            lang={isAr ? 'ar' : 'en'}
                            template={template}
                            editorPreview
                        />
                    </div>
                ) : <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
                    <div className="overflow-auto rounded-2xl bg-slate-200 p-3 dark:bg-black/20 sm:p-5">
                        <div
                            style={{
                                backgroundColor: visualStyle.backgroundColor,
                                fontFamily: visualStyle.fontFamily,
                                aspectRatio: `${visualStyle.pageWidth} / ${visualStyle.pageHeight}`,
                            }}
                            className={`relative mx-auto w-full max-w-[760px] overflow-hidden shadow-2xl ${template.designKey === 'modern' ? 'rounded-lg' : ''}`}
                        >
                            {visualStyle.frameStyle !== 'none' && (
                                <>
                                    <div className="absolute" style={{ inset: 0, borderStyle: visualStyle.frameStyle === 'dashed' ? 'dashed' : visualStyle.frameStyle === 'ornate' ? 'double' : 'solid', borderWidth: visualStyle.frameStyle === 'double' || visualStyle.frameStyle === 'ornate' ? 12 : 6, borderColor: visualStyle.primaryColor }} />
                                    {visualStyle.frameStyle === 'double' && (
                                        <>
                                            <div className="absolute border" style={{ inset: 18, borderColor: visualStyle.accentColor }} />
                                            <div className="absolute border" style={{ inset: 28, borderColor: `${visualStyle.primaryColor}55` }} />
                                        </>
                                    )}
                                    {visualStyle.frameStyle === 'ornate' && (
                                        <>
                                            <div className="absolute border-2" style={{ inset: 18, borderColor: visualStyle.accentColor }} />
                                            <div className="absolute border" style={{ inset: 28, borderColor: `${visualStyle.primaryColor}55` }} />
                                        </>
                                    )}
                                </>
                            )}
                            <CertificateDesignFrame
                                design={visualStyle.certificateDesign}
                                primaryColor={visualStyle.primaryColor}
                                accentColor={visualStyle.accentColor}
                            />
                            {previewElementKeys.map((key) => {
                                if (key === 'logo' && !visualStyle.showLogo) return null;
                                if (key === 'stamp' && !visualStyle.showSeal) return null;
                                const rawPosition = template.layout[key] ?? EMPTY_TEMPLATE.layout[key];
                                const pos = rawPosition && 'x' in rawPosition ? rawPosition : { x: 50, y: 50 };
                                const customElement = typeof key === 'string' && key.startsWith('custom-')
                                    ? visualStyle.customElements.find((element) => `custom-${element.id}` === key)
                                    : undefined;
                                const customImage = typeof key === 'string' && key.startsWith('image-')
                                    ? visualStyle.customImages.find((image) => `image-${image.id}` === key)
                                    : undefined;
                                const elementIsText = key !== 'logo' && key !== 'signatures' && key !== 'qr' && key !== 'stamp' && !customImage;
                                const labels: Partial<Record<CertificateElementKey, string>> = {
                                    logo: isAr ? 'شعار المنصة' : 'Platform logo',
                                    brand: isAr ? template.academyNameAr || 'اسم الأكاديمية' : template.academyNameEn || 'Academy',
                                    title: isAr ? template.titleAr || 'عنوان الشهادة' : template.titleEn || 'Certificate title',
                                    recipient: 'Student Name',
                                    course: 'Course Name',
                                    description: isAr ? 'نص الاعتماد والشهادة' : 'Accreditation wording',
                                    signatures: isAr ? 'التوقيعات والختم' : 'Signatures & seal',
                                    qr: 'QR',
                                    stamp: isAr ? 'ختم الأكاديمية' : 'Academy seal',
                                };
                                const previewText = customElement
                                    ? (isAr ? customElement.textAr : customElement.textEn)
                                    : customImage?.name ?? labels[key];
                                return (
                                    <div
                                        key={key}
                                        onClick={() => setSelectedElement(key)}
                                        onPointerDown={(event) => { setSelectedElement(key); beginLayoutDrag(key, event); }}
                                        onPointerMove={(event) => { if (draggingLayoutKey === key) moveLayoutItem(key, event); }}
                                        onPointerUp={() => setDraggingLayoutKey(null)}
                                        onPointerCancel={() => setDraggingLayoutKey(null)}
                                        className={`absolute z-10 touch-none cursor-move select-none border border-dashed px-2 py-1 text-center shadow-sm transition hover:bg-white ${selectedElement === key || draggingLayoutKey === key ? 'border-brand-gold bg-white ring-2 ring-brand-gold/30' : 'border-brand-gold/50 bg-white/90'} ${draggingLayoutKey === key ? 'scale-105' : ''}`}
                                        style={{
                                            left: `${pos.x}%`,
                                            top: `${pos.y}%`,
                                            transform: `translate(-50%, -50%)${key === 'stamp' ? ` rotate(${visualStyle.sealRotation}deg)` : ''}`,
                                            zIndex: pos.zIndex ?? 10,
                                            minWidth: key === 'qr' ? 46 : customImage ? undefined : 120,
                                            color: elementIsText ? visualStyle.textColor : undefined,
                                            fontSize: elementIsText ? `${(visualStyle.fontSizes[key] ?? (key === 'recipient' ? 38 : key === 'course' ? 28 : 18)) * Math.min(1, 760 / visualStyle.pageWidth)}px` : undefined,
                                            fontWeight: elementIsText ? visualStyle.fontWeights[key] ?? (key === 'description' ? 400 : 700) : undefined,
                                            opacity: key === 'stamp' ? visualStyle.sealOpacity : undefined,
                                            padding: customImage ? 0 : undefined,
                                        }}
                                        title={isAr ? 'اسحب لتغيير المكان' : 'Drag to reposition'}
                                    >
                                        <GripVertical className="mr-auto inline-block text-brand-gold-dark" size={12} />
                                        {key === 'logo' ? (
                                            <Image
                                                src={brandingAssetSrc(visualStyle.logoUrl || DEFAULT_CERTIFICATE_LOGO)}
                                                width={360}
                                                height={100}
                                                unoptimized
                                                className={`mx-auto block ${visualStyle.logoShape === 'circle' ? 'rounded-full' : visualStyle.logoShape === 'rounded' ? 'rounded-lg' : 'rounded-none'} h-12 w-40 object-contain`}
                                                alt={isAr ? 'شعار المنصة' : 'Platform logo'}
                                            />
                                        ) : customImage ? (
                                            <Image
                                                src={brandingAssetSrc(customImage.url)}
                                                alt={customImage.name}
                                                width={600}
                                                height={600}
                                                unoptimized
                                                className="block max-w-none object-contain"
                                                style={{ width: `${(visualStyle.imageSizes[customImage.id] ?? 160) * Math.min(1, 760 / visualStyle.pageWidth)}px`, height: `${(visualStyle.imageSizes[customImage.id] ?? 160) * Math.min(1, 760 / visualStyle.pageWidth)}px` }}
                                            />
                                        ) : key === 'stamp' ? (
                                            visualStyle.sealMode === 'uploaded' && template.academyStampUrl ? (
                                                <Image
                                                    src={brandingAssetSrc(template.academyStampUrl)}
                                                    alt={isAr ? 'ختم الأكاديمية المرفوع' : 'Uploaded academy seal'}
                                                    width={240}
                                                    height={240}
                                                    unoptimized
                                                    className="mx-auto object-contain"
                                                    style={{ width: Math.round(visualStyle.sealSize * 0.52), height: Math.round(visualStyle.sealSize * 0.52), backgroundColor: visualStyle.sealFillColor, filter: `hue-rotate(${visualStyle.sealImageHue}deg)` }}
                                                />
                                            ) : (
                                                <CertificateSeal
                                                    logoUrl={brandingAssetSrc(visualStyle.logoUrl || DEFAULT_CERTIFICATE_LOGO)}
                                                    text={isAr ? visualStyle.sealTextAr : visualStyle.sealTextEn}
                                                    color={visualStyle.sealColor}
                                                    fillColor={visualStyle.sealFillColor}
                                                    shape={visualStyle.sealShape}
                                                    borderStyle={visualStyle.sealBorderStyle}
                                                    size={Math.round(visualStyle.sealSize * 0.52)}
                                                />
                                            )
                                        ) : previewText}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <aside className="space-y-5">
                        <div>
                            <h3 className="mb-3 text-sm font-black text-brand-navy dark:text-white">{isAr ? 'عناصر الشهادة' : 'Certificate elements'}</h3>
                            <div className="grid grid-cols-2 gap-2">
                                {previewElementKeys.map((key) => {
                                    const customElement = typeof key === 'string' && key.startsWith('custom-')
                                        ? visualStyle.customElements.find((element) => `custom-${element.id}` === key)
                                        : undefined;
                                    const customImage = typeof key === 'string' && key.startsWith('image-')
                                        ? visualStyle.customImages.find((image) => `image-${image.id}` === key)
                                        : undefined;
                                    const labels: Partial<Record<typeof key, [string, string]>> = {
                                        logo: ['شعار المنصة', 'Platform logo'],
                                        brand: ['اسم الأكاديمية', 'Academy name'],
                                        title: ['عنوان الشهادة', 'Certificate title'],
                                        recipient: ['اسم المستفيد', 'Recipient name'],
                                        course: ['اسم الدورة', 'Course name'],
                                        description: ['نص الشهادة', 'Certificate wording'],
                                        signatures: ['التوقيعات والختم', 'Signatures & seal'],
                                        qr: ['رمز التحقق QR', 'Verification QR'],
                                        stamp: ['ختم الأكاديمية', 'Academy seal'],
                                    };
                                    const label = customElement
                                        ? [customElement.labelAr, customElement.labelEn]
                                        : customImage
                                            ? [customImage.name, customImage.name]
                                            : labels[key];
                                    return (
                                        <button
                                            key={key}
                                            type="button"
                                            onClick={() => setSelectedElement(key)}
                                            className={`rounded-xl border px-3 py-2 text-start text-xs font-bold transition ${selectedElement === key ? 'border-brand-gold bg-brand-gold/10 text-brand-navy dark:text-white' : 'border-gray-200 text-gray-600 dark:border-white/10 dark:text-gray-300'}`}
                                        >
                                            {label?.[isAr ? 0 : 1] ?? ''}
                                        </button>
                                    );
                                })}
                                <button type="button" onClick={addCustomElement} className="col-span-2 inline-flex items-center justify-center gap-2 rounded-xl border border-dashed border-brand-gold px-3 py-2 text-xs font-black text-brand-navy hover:bg-brand-gold/10 dark:text-white">
                                    <Type size={14} /> {isAr ? 'إضافة عنصر نصي جديد' : 'Add a custom text element'}
                                </button>
                                <label className="col-span-2 inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-gray-300 px-3 py-2 text-xs font-black text-gray-700 hover:border-brand-gold dark:border-white/10 dark:text-white">
                                    {busyBrandAsset === 'logo' ? <LoaderCircle size={14} className="animate-spin" /> : <ImagePlus size={14} />}
                                    {isAr ? 'إضافة صورة أو زخرفة' : 'Add image or decoration'}
                                    <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" disabled={busyBrandAsset !== null} onChange={(event) => {
                                        const file = event.target.files?.[0];
                                        if (file) void addCustomImage(file);
                                        event.currentTarget.value = '';
                                    }} />
                                </label>
                            </div>
                            <label className="mt-3 flex items-center gap-2 text-xs font-bold text-gray-600 dark:text-gray-300">
                                <input type="checkbox" checked={visualStyle.showLogo} onChange={(event) => updateVisualStyle({ showLogo: event.target.checked })} />
                                {isAr ? 'إظهار شعار المنصة في الشهادة' : 'Show platform logo on certificate'}
                            </label>
                            {selectedCustomElement && (
                                <div className="mt-4 space-y-3 rounded-xl border border-brand-gold/30 p-3">
                                    <h4 className="text-xs font-black text-brand-navy dark:text-white">{isAr ? 'محتوى العنصر الجديد' : 'Custom element content'}</h4>
                                    <label className="block text-xs font-bold text-gray-600 dark:text-gray-300">
                                        {isAr ? 'اسم العنصر' : 'Element label'}
                                        <input value={isAr ? selectedCustomElement.labelAr : selectedCustomElement.labelEn} onChange={(event) => updateCustomElement(selectedCustomElement.id, isAr ? { labelAr: event.target.value } : { labelEn: event.target.value })} maxLength={60} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 dark:border-white/10 dark:bg-brand-navy-dark" />
                                    </label>
                                    <label className="block text-xs font-bold text-gray-600 dark:text-gray-300">
                                        {isAr ? 'النص بالعربية' : 'Arabic text'}
                                        <textarea value={selectedCustomElement.textAr} onChange={(event) => updateCustomElement(selectedCustomElement.id, { textAr: event.target.value })} maxLength={300} rows={2} dir="rtl" className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 dark:border-white/10 dark:bg-brand-navy-dark" />
                                    </label>
                                    <label className="block text-xs font-bold text-gray-600 dark:text-gray-300">
                                        {isAr ? 'النص بالإنجليزية' : 'English text'}
                                        <textarea value={selectedCustomElement.textEn} onChange={(event) => updateCustomElement(selectedCustomElement.id, { textEn: event.target.value })} maxLength={300} rows={2} dir="ltr" className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 dark:border-white/10 dark:bg-brand-navy-dark" />
                                    </label>
                                    <button type="button" onClick={() => removeCustomElement(selectedCustomElement.id)} className="inline-flex items-center gap-1.5 text-xs font-bold text-red-600 dark:text-red-400">
                                        <Trash2 size={14} /> {isAr ? 'حذف العنصر' : 'Remove element'}
                                    </button>
                                </div>
                            )}
                            {selectedImage && (
                                <div className="mt-4 space-y-3 rounded-xl border border-brand-gold/30 p-3">
                                    <h4 className="text-xs font-black text-brand-navy dark:text-white">{isAr ? 'خصائص الصورة' : 'Image properties'}</h4>
                                    <label className="block text-xs font-bold text-gray-600 dark:text-gray-300">
                                        {isAr ? `الحجم: ${visualStyle.imageSizes[selectedImage.id] ?? 160}px` : `Size: ${visualStyle.imageSizes[selectedImage.id] ?? 160}px`}
                                        <input type="range" min="40" max="600" value={visualStyle.imageSizes[selectedImage.id] ?? 160} onChange={(event) => updateVisualStyle({ imageSizes: { ...visualStyle.imageSizes, [selectedImage.id]: Number(event.target.value) } })} className="mt-2 w-full accent-brand-gold" />
                                    </label>
                                    <button type="button" onClick={() => removeCustomImage(selectedImage.id)} className="inline-flex items-center gap-1.5 text-xs font-bold text-red-600 dark:text-red-400">
                                        <Trash2 size={14} /> {isAr ? 'حذف الصورة من التصميم' : 'Remove image from design'}
                                    </button>
                                </div>
                            )}
                            <div className="mt-4 rounded-xl border border-gray-100 p-3 dark:border-white/10">
                                <h4 className="mb-2 text-xs font-black text-gray-700 dark:text-gray-200">{isAr ? 'الطبقات' : 'Layers'}</h4>
                                <p className="mb-3 text-[11px] leading-5 text-gray-500 dark:text-gray-400">
                                    {isAr ? 'حدد عنصرًا ثم غيّر ترتيبه أمام العناصر الأخرى. استخدم الأسهم لترتيب الطبقة.' : 'Select an element, then change its stacking order using the arrows.'}
                                </p>
                                <div className="flex gap-2">
                                    <button type="button" onClick={() => adjustLayer(selectedElement, 1)} className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-xs font-bold dark:border-white/10">{isAr ? 'إلى الأمام ↑' : 'Bring forward ↑'}</button>
                                    <button type="button" onClick={() => adjustLayer(selectedElement, -1)} className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-xs font-bold dark:border-white/10">{isAr ? 'إلى الخلف ↓' : 'Send backward ↓'}</button>
                                </div>
                            </div>
                            {isTextElement && (
                                <div className="mt-4 space-y-3 rounded-xl border border-gray-100 p-3 dark:border-white/10">
                                    <h4 className="flex items-center gap-2 text-xs font-black text-gray-700 dark:text-gray-200"><Type size={14} /> {isAr ? 'تنسيق النص المحدد' : 'Selected text formatting'}</h4>
                                    <label className="block text-xs font-bold text-gray-600 dark:text-gray-300">
                                        {isAr ? `حجم الخط: ${selectedFontSize}px` : `Font size: ${selectedFontSize}px`}
                                        <input type="range" min="10" max="64" value={selectedFontSize} onChange={(event) => setSelectedTypography('fontSizes', Number(event.target.value))} className="mt-2 w-full accent-brand-gold" />
                                    </label>
                                    <label className="block text-xs font-bold text-gray-600 dark:text-gray-300">
                                        {isAr ? 'سمك الخط' : 'Font weight'}
                                        <select value={selectedFontWeight} onChange={(event) => setSelectedTypography('fontWeights', Number(event.target.value))} className="mt-1.5 w-full rounded-lg border border-gray-200 px-3 py-2 text-xs dark:border-white/10 dark:bg-brand-navy-dark">
                                            {[400, 500, 600, 700, 800, 900].map((weight) => <option key={weight} value={weight}>{weight} — {weight < 600 ? (isAr ? 'عادي' : 'Regular') : weight < 800 ? (isAr ? 'متوسط' : 'Medium') : (isAr ? 'عريض' : 'Bold')}</option>)}
                                        </select>
                                    </label>
                                </div>
                            )}
                            <div className="mt-4 space-y-3 rounded-xl border border-brand-gold/30 p-3">
                                <h4 className="text-xs font-black text-brand-navy dark:text-white">{isAr ? 'إعدادات ختم الأكاديمية' : 'Academy seal settings'}</h4>
                                <label className="flex items-center gap-2 text-xs font-bold text-gray-600 dark:text-gray-300">
                                    <input type="checkbox" checked={visualStyle.showSeal} onChange={(event) => updateVisualStyle({ showSeal: event.target.checked })} />
                                    {isAr ? 'إظهار الختم على الشهادة' : 'Show seal on certificates'}
                                </label>
                                <label className="block text-xs font-bold text-gray-600 dark:text-gray-300">
                                    {isAr ? 'مصدر الختم' : 'Seal source'}
                                    <select value={visualStyle.sealMode} onChange={(event) => updateVisualStyle({ sealMode: event.target.value as CertificateVisualStyle['sealMode'] })} className="mt-1.5 w-full rounded-lg border border-gray-200 px-3 py-2 dark:border-white/10 dark:bg-brand-navy-dark">
                                        <option value="platform">{isAr ? 'ختم المنصة بالشعار' : 'Platform seal with logo'}</option>
                                        <option value="uploaded">{isAr ? 'صورة ختم مرفوعة' : 'Uploaded seal image'}</option>
                                    </select>
                                </label>
                                {visualStyle.sealMode === 'platform' ? (
                                    <>
                                        <label className="block text-xs font-bold text-gray-600 dark:text-gray-300">
                                            {isAr ? 'شكل الختم' : 'Seal shape'}
                                            <select value={visualStyle.sealShape} onChange={(event) => updateVisualStyle({ sealShape: event.target.value as CertificateSealShape })} className="mt-1.5 w-full rounded-lg border border-gray-200 px-3 py-2 dark:border-white/10 dark:bg-brand-navy-dark">
                                                <option value="round">{isAr ? 'دائري' : 'Round'}</option>
                                                <option value="rosette">{isAr ? 'وردة مسننة' : 'Rosette'}</option>
                                                <option value="square">{isAr ? 'مربع بزوايا ناعمة' : 'Rounded square'}</option>
                                                <option value="ribbon">{isAr ? 'شريطي' : 'Ribbon'}</option>
                                                <option value="minimal">{isAr ? 'بسيط' : 'Minimal'}</option>
                                            </select>
                                        </label>
                                        <label className="block text-xs font-bold text-gray-600 dark:text-gray-300">
                                            {isAr ? 'نمط الإطار' : 'Border style'}
                                            <select value={visualStyle.sealBorderStyle} onChange={(event) => updateVisualStyle({ sealBorderStyle: event.target.value as CertificateVisualStyle['sealBorderStyle'] })} className="mt-1.5 w-full rounded-lg border border-gray-200 px-3 py-2 dark:border-white/10 dark:bg-brand-navy-dark">
                                                <option value="double">{isAr ? 'مزدوج' : 'Double'}</option>
                                                <option value="solid">{isAr ? 'متصل' : 'Solid'}</option>
                                                <option value="dashed">{isAr ? 'متقطع' : 'Dashed'}</option>
                                            </select>
                                        </label>
                                        <div className="grid grid-cols-2 gap-3">
                                            <label className="text-xs font-bold text-gray-600 dark:text-gray-300">
                                                <span className="mb-1.5 block">{isAr ? 'لون الختم' : 'Seal color'}</span>
                                                <input type="color" value={visualStyle.sealColor} onChange={(event) => updateVisualStyle({ sealColor: event.target.value })} className="h-9 w-full cursor-pointer rounded-lg border border-gray-200 bg-white p-1 dark:border-white/10" />
                                            </label>
                                            <label className="text-xs font-bold text-gray-600 dark:text-gray-300">
                                                <span className="mb-1.5 block">{isAr ? 'لون الخلفية' : 'Fill color'}</span>
                                                <input type="color" value={visualStyle.sealFillColor} onChange={(event) => updateVisualStyle({ sealFillColor: event.target.value })} className="h-9 w-full cursor-pointer rounded-lg border border-gray-200 bg-white p-1 dark:border-white/10" />
                                            </label>
                                        </div>
                                        <label className="block text-xs font-bold text-gray-600 dark:text-gray-300">
                                            {isAr ? `الحجم: ${visualStyle.sealSize}px` : `Size: ${visualStyle.sealSize}px`}
                                            <input type="range" min="60" max="260" value={visualStyle.sealSize} onChange={(event) => updateVisualStyle({ sealSize: Number(event.target.value) })} className="mt-2 w-full accent-brand-gold" />
                                        </label>
                                        <label className="block text-xs font-bold text-gray-600 dark:text-gray-300">
                                            {isAr ? `الشفافية: ${Math.round(visualStyle.sealOpacity * 100)}%` : `Opacity: ${Math.round(visualStyle.sealOpacity * 100)}%`}
                                            <input type="range" min="10" max="100" value={Math.round(visualStyle.sealOpacity * 100)} onChange={(event) => updateVisualStyle({ sealOpacity: Number(event.target.value) / 100 })} className="mt-2 w-full accent-brand-gold" />
                                        </label>
                                        <label className="block text-xs font-bold text-gray-600 dark:text-gray-300">
                                            {isAr ? `الدوران: ${visualStyle.sealRotation}°` : `Rotation: ${visualStyle.sealRotation}°`}
                                            <input type="range" min="-180" max="180" value={visualStyle.sealRotation} onChange={(event) => updateVisualStyle({ sealRotation: Number(event.target.value) })} className="mt-2 w-full accent-brand-gold" />
                                        </label>
                                        <label className="block text-xs font-bold text-gray-600 dark:text-gray-300">
                                            {isAr ? 'النص العربي على الختم' : 'Arabic seal text'}
                                            <input value={visualStyle.sealTextAr} onChange={(event) => updateVisualStyle({ sealTextAr: event.target.value })} maxLength={40} dir="rtl" className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 dark:border-white/10 dark:bg-brand-navy-dark" />
                                        </label>
                                        <label className="block text-xs font-bold text-gray-600 dark:text-gray-300">
                                            {isAr ? 'النص الإنجليزي على الختم' : 'English seal text'}
                                            <input value={visualStyle.sealTextEn} onChange={(event) => updateVisualStyle({ sealTextEn: event.target.value })} maxLength={40} dir="ltr" className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 dark:border-white/10 dark:bg-brand-navy-dark" />
                                        </label>
                                    </>
                                ) : (
                                    <p className="text-xs leading-5 text-gray-500 dark:text-gray-400">
                                        {template.academyStampUrl
                                            ? (isAr ? 'سيتم استخدام صورة الختم المرفوعة أدناه. يمكنك تغيير حجمها وشفافيتها ودورانها من الإعدادات.' : 'The uploaded seal below will be used. Adjust its size, opacity and rotation with the controls below.')
                                            : (isAr ? 'ارفع صورة الختم من قسم التوقيعات والختم أسفل الصفحة لتظهر هنا.' : 'Upload a seal image in the Signatures & seal section below to display it here.')}
                                    </p>
                                )}
                                {visualStyle.sealMode === 'uploaded' && (
                                    <>
                                        <label className="text-xs font-bold text-gray-600 dark:text-gray-300">
                                            <span className="mb-1.5 block">{isAr ? 'لون خلفية الصورة' : 'Image background color'}</span>
                                            <input type="color" value={visualStyle.sealFillColor} onChange={(event) => updateVisualStyle({ sealFillColor: event.target.value })} className="h-9 w-full cursor-pointer rounded-lg border border-gray-200 bg-white p-1 dark:border-white/10" />
                                        </label>
                                        <label className="block text-xs font-bold text-gray-600 dark:text-gray-300">
                                            {isAr ? `تغيير درجة لون الصورة: ${visualStyle.sealImageHue}°` : `Image hue: ${visualStyle.sealImageHue}°`}
                                            <input type="range" min="0" max="360" value={visualStyle.sealImageHue} onChange={(event) => updateVisualStyle({ sealImageHue: Number(event.target.value) })} className="mt-2 w-full accent-brand-gold" />
                                        </label>
                                        <label className="block text-xs font-bold text-gray-600 dark:text-gray-300">
                                            {isAr ? `الحجم: ${visualStyle.sealSize}px` : `Size: ${visualStyle.sealSize}px`}
                                            <input type="range" min="60" max="260" value={visualStyle.sealSize} onChange={(event) => updateVisualStyle({ sealSize: Number(event.target.value) })} className="mt-2 w-full accent-brand-gold" />
                                        </label>
                                        <label className="block text-xs font-bold text-gray-600 dark:text-gray-300">
                                            {isAr ? `الشفافية: ${Math.round(visualStyle.sealOpacity * 100)}%` : `Opacity: ${Math.round(visualStyle.sealOpacity * 100)}%`}
                                            <input type="range" min="10" max="100" value={Math.round(visualStyle.sealOpacity * 100)} onChange={(event) => updateVisualStyle({ sealOpacity: Number(event.target.value) / 100 })} className="mt-2 w-full accent-brand-gold" />
                                        </label>
                                        <label className="block text-xs font-bold text-gray-600 dark:text-gray-300">
                                            {isAr ? `الدوران: ${visualStyle.sealRotation}°` : `Rotation: ${visualStyle.sealRotation}°`}
                                            <input type="range" min="-180" max="180" value={visualStyle.sealRotation} onChange={(event) => updateVisualStyle({ sealRotation: Number(event.target.value) })} className="mt-2 w-full accent-brand-gold" />
                                        </label>
                                    </>
                                )}
                                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                                    {isAr ? 'يمكنك سحب عنصر الختم داخل المعاينة لتغيير موضعه.' : 'Drag the seal element in the preview to reposition it.'}
                                </p>
                            </div>
                        </div>
                        <div>
                            <h3 className="mb-3 flex items-center gap-2 text-sm font-black text-brand-navy dark:text-white"><Palette size={16} /> {isAr ? 'اختر شكل الشهادة' : 'Choose a certificate design'}</h3>
                            <div className="grid grid-cols-2 gap-2">
                                {CERTIFICATE_DESIGNS.map((design) => (
                                    <button
                                        key={design.id}
                                        type="button"
                                        onClick={() => {
                                            const designKey = design.id === 'modern' || design.id === 'minimal' || design.id === 'geometric' || design.id === 'wave' || design.id === 'mosaic'
                                                ? 'modern'
                                                : design.id === 'royal' || design.id === 'artDeco' || design.id === 'heritage' || design.id === 'ribbon'
                                                    ? 'royal'
                                                    : 'classic';
                                            setTemplate((current) => ({
                                                ...current,
                                                designKey,
                                                layout: {
                                                    ...current.layout,
                                                    __visualStyle: { ...visualStyle, certificateDesign: design.id },
                                                },
                                            }));
                                        }}
                                        className={`relative overflow-hidden rounded-xl border p-2 text-start transition ${visualStyle.certificateDesign === design.id ? 'border-brand-gold bg-brand-gold/10 text-brand-navy dark:text-white' : 'border-gray-200 text-gray-600 dark:border-white/10 dark:text-gray-300'}`}
                                    >
                                        <span className="relative mb-2 block aspect-[1.7/1] overflow-hidden rounded-md border bg-white" style={{ borderColor: visualStyle.primaryColor, backgroundColor: visualStyle.backgroundColor }}>
                                            <span className="absolute inset-[12%] border" style={{ borderColor: visualStyle.primaryColor }} />
                                            <CertificateDesignFrame design={design.id} primaryColor={visualStyle.primaryColor} accentColor={visualStyle.accentColor} />
                                        </span>
                                        <span className="text-[11px] font-bold">{isAr ? design.nameAr : design.nameEn}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="rounded-2xl border border-gray-200 p-3 dark:border-white/10">
                            <h3 className="mb-3 text-sm font-black text-brand-navy dark:text-white">{isAr ? 'الألوان والإطار والشعار' : 'Colors, frame and logo'}</h3>
                            <div className="grid grid-cols-2 gap-3">
                                {([
                                    ['primaryColor', isAr ? 'اللون الأساسي' : 'Primary'],
                                    ['accentColor', isAr ? 'لون التفاصيل' : 'Accent'],
                                    ['backgroundColor', isAr ? 'الخلفية' : 'Background'],
                                    ['textColor', isAr ? 'لون النصوص' : 'Text'],
                                ] as const).map(([field, label]) => (
                                    <label key={field} className="text-xs font-bold text-gray-600 dark:text-gray-300">
                                        <span className="mb-1.5 block">{label}</span>
                                        <input type="color" value={visualStyle[field]} onChange={(event) => updateVisualStyle({ [field]: event.target.value })} className="h-9 w-full cursor-pointer rounded-lg border border-gray-200 bg-white p-1 dark:border-white/10" />
                                    </label>
                                ))}
                            </div>
                            <div className="rounded-2xl border border-gray-200 p-3 dark:border-white/10">
                                <h3 className="mb-3 text-sm font-black text-brand-navy dark:text-white">{isAr ? 'حجم واتجاه الشهادة' : 'Certificate size and orientation'}</h3>
                                <label className="block text-xs font-bold text-gray-600 dark:text-gray-300">
                                    {isAr ? 'حجم الصفحة' : 'Page size'}
                                    <select
                                        value={visualStyle.pageSize}
                                        onChange={(event) => {
                                            const pageSize = event.target.value as CertificateVisualStyle['pageSize'];
                                            if (pageSize === 'custom') {
                                                updateVisualStyle({ pageSize });
                                                return;
                                            }
                                            const dimensions = pageSize === 'A3' ? [1587, 1122] : pageSize === 'Letter' ? [1056, 816] : [1123, 794];
                                            const [landscapeWidth, landscapeHeight] = dimensions;
                                            updateVisualStyle({
                                                pageSize,
                                                pageWidth: visualStyle.pageOrientation === 'landscape' ? landscapeWidth : landscapeHeight,
                                                pageHeight: visualStyle.pageOrientation === 'landscape' ? landscapeHeight : landscapeWidth,
                                            });
                                        }}
                                        className="mt-1.5 w-full rounded-lg border border-gray-200 px-3 py-2 dark:border-white/10 dark:bg-brand-navy-dark"
                                    >
                                        <option value="A4">A4</option>
                                        <option value="Letter">Letter</option>
                                        <option value="A3">A3</option>
                                        <option value="custom">{isAr ? 'مخصص' : 'Custom'}</option>
                                    </select>
                                </label>
                                <label className="mt-3 block text-xs font-bold text-gray-600 dark:text-gray-300">
                                    {isAr ? 'اتجاه الصفحة' : 'Orientation'}
                                    <select
                                        value={visualStyle.pageOrientation}
                                        onChange={(event) => {
                                            const pageOrientation = event.target.value as CertificateVisualStyle['pageOrientation'];
                                            const needsSwap = (pageOrientation === 'landscape' && visualStyle.pageWidth < visualStyle.pageHeight)
                                                || (pageOrientation === 'portrait' && visualStyle.pageWidth > visualStyle.pageHeight);
                                            updateVisualStyle({
                                                pageOrientation,
                                                ...(needsSwap ? { pageWidth: visualStyle.pageHeight, pageHeight: visualStyle.pageWidth } : {}),
                                            });
                                        }}
                                        className="mt-1.5 w-full rounded-lg border border-gray-200 px-3 py-2 dark:border-white/10 dark:bg-brand-navy-dark"
                                    >
                                        <option value="landscape">{isAr ? 'أفقي' : 'Landscape'}</option>
                                        <option value="portrait">{isAr ? 'عمودي' : 'Portrait'}</option>
                                    </select>
                                </label>
                                {visualStyle.pageSize === 'custom' && (
                                    <div className="mt-3 grid grid-cols-2 gap-3">
                                        {([
                                            ['pageWidth', isAr ? 'العرض (px)' : 'Width (px)'],
                                            ['pageHeight', isAr ? 'الارتفاع (px)' : 'Height (px)'],
                                        ] as const).map(([field, label]) => (
                                            <label key={field} className="text-xs font-bold text-gray-600 dark:text-gray-300">
                                                {label}
                                                <input type="number" min="600" max="2400" step="1" value={visualStyle[field]} onChange={(event) => {
                                                    const value = Number(event.target.value);
                                                    if (Number.isFinite(value)) updateVisualStyle({ [field]: Math.max(600, Math.min(2400, value)) });
                                                }} className="mt-1.5 w-full rounded-lg border border-gray-200 px-3 py-2 dark:border-white/10 dark:bg-brand-navy-dark" />
                                            </label>
                                        ))}
                                    </div>
                                )}
                                <p className="mt-2 text-[11px] text-gray-500 dark:text-gray-400">{visualStyle.pageWidth} × {visualStyle.pageHeight} px</p>
                            </div>
                            <label className="mt-3 block text-xs font-bold text-gray-600 dark:text-gray-300">
                                {isAr ? 'شكل الإطار' : 'Frame shape'}
                                <select value={visualStyle.frameStyle} onChange={(event) => updateVisualStyle({ frameStyle: event.target.value as CertificateVisualStyle['frameStyle'] })} className="mt-1.5 w-full rounded-lg border border-gray-200 px-3 py-2 text-xs dark:border-white/10 dark:bg-brand-navy-dark">
                                    <option value="double">{isAr ? 'إطار مزدوج' : 'Double frame'}</option>
                                    <option value="single">{isAr ? 'إطار واحد' : 'Single frame'}</option>
                                    <option value="dashed">{isAr ? 'إطار متقطع' : 'Dashed frame'}</option>
                                    <option value="ornate">{isAr ? 'إطار مزخرف' : 'Ornate frame'}</option>
                                    <option value="none">{isAr ? 'بدون إطار' : 'No frame'}</option>
                                </select>
                            </label>
                            <label className="mt-3 block text-xs font-bold text-gray-600 dark:text-gray-300">
                                {isAr ? 'شكل شعار المنصة' : 'Platform logo shape'}
                                <div className="mt-1.5 grid grid-cols-3 gap-2">
                                    {(['circle', 'rounded', 'square'] as const).map((shape) => (
                                        <button key={shape} type="button" onClick={() => updateVisualStyle({ logoShape: shape })} className={`rounded-lg border px-2 py-2 text-[11px] ${visualStyle.logoShape === shape ? 'border-brand-gold bg-brand-gold/10' : 'border-gray-200 dark:border-white/10'}`}>
                                            {shape === 'circle' ? (isAr ? 'دائري' : 'Circle') : shape === 'rounded' ? (isAr ? 'ناعم' : 'Rounded') : (isAr ? 'مربع' : 'Square')}
                                        </button>
                                    ))}
                                </div>
                            </label>
                            <div className="mt-4 rounded-xl border border-gray-100 p-3 dark:border-white/10">
                                <h4 className="mb-2 flex items-center gap-2 text-xs font-black text-gray-700 dark:text-gray-200"><ImagePlus size={14} /> {isAr ? 'الشعار المستخدم' : 'Certificate logo'}</h4>
                                <div className="mb-2 flex h-16 items-center justify-center rounded-lg bg-gray-50 p-2 dark:bg-white/5">
                                    <Image src={brandingAssetSrc(visualStyle.logoUrl || DEFAULT_CERTIFICATE_LOGO)} alt={isAr ? 'معاينة الشعار' : 'Logo preview'} width={240} height={72} unoptimized className="h-full max-w-full object-contain" />
                                </div>
                                <select
                                    value={visualStyle.logoUrl || DEFAULT_CERTIFICATE_LOGO}
                                    onChange={(event) => updateVisualStyle({ logoUrl: event.target.value })}
                                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs dark:border-white/10 dark:bg-brand-navy-dark"
                                >
                                    {BUILT_IN_LOGOS.map((logo) => <option key={logo.url} value={logo.url}>{isAr ? logo.nameAr : logo.nameEn}</option>)}
                                    {(Array.isArray(visualStyle.logoLibrary) ? visualStyle.logoLibrary : []).map((logo) => <option key={logo.url} value={logo.url}>{logo.name}</option>)}
                                </select>
                                <label className="mt-2 flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 px-3 py-2 text-xs font-bold text-gray-600 dark:border-white/10 dark:text-gray-300">
                                    {busyBrandAsset === 'logo' ? <LoaderCircle size={14} className="animate-spin" /> : <Upload size={14} />}
                                    {isAr ? 'إضافة شعار جديد' : 'Upload another logo'}
                                    <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" disabled={busyBrandAsset !== null} onChange={(event) => {
                                        const file = event.target.files?.[0];
                                        if (file) void uploadBrandAsset('logo', file);
                                        event.currentTarget.value = '';
                                    }} />
                                </label>
                            </div>
                            <div className="mt-4 rounded-xl border border-gray-100 p-3 dark:border-white/10">
                                <h4 className="mb-2 flex items-center gap-2 text-xs font-black text-gray-700 dark:text-gray-200"><Type size={14} /> {isAr ? 'خط الشهادة' : 'Certificate font'}</h4>
                                <select
                                    value={visualStyle.fontUrl || visualStyle.fontFamily}
                                    onChange={(event) => {
                                        const font = BUILT_IN_FONTS.find((option) => option.family === event.target.value);
                                        if (font) {
                                            updateVisualStyle({ fontName: font.name, fontFamily: font.family, fontUrl: null });
                                            return;
                                        }
                                        const uploadedFont = (Array.isArray(visualStyle.fontLibrary) ? visualStyle.fontLibrary : []).find((asset) => asset.url === event.target.value);
                                        if (uploadedFont) updateVisualStyle({ fontName: uploadedFont.name, fontFamily: "'LaxaCertificateCustom', sans-serif", fontUrl: uploadedFont.url });
                                    }}
                                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs dark:border-white/10 dark:bg-brand-navy-dark"
                                >
                                    {BUILT_IN_FONTS.map((font) => <option key={font.name} value={font.family}>{font.name}</option>)}
                                    {(Array.isArray(visualStyle.fontLibrary) ? visualStyle.fontLibrary : []).map((font) => <option key={font.url} value={font.url}>{font.name}</option>)}
                                </select>
                                <label className="mt-2 flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 px-3 py-2 text-xs font-bold text-gray-600 dark:border-white/10 dark:text-gray-300">
                                    {busyBrandAsset === 'font' ? <LoaderCircle size={14} className="animate-spin" /> : <Upload size={14} />}
                                    {isAr ? 'رفع خط جديد (حتى 5 ميجابايت)' : 'Upload a font (up to 5 MB)'}
                                    <input type="file" accept=".woff,.woff2,.ttf,.otf,font/woff,font/woff2,font/ttf,font/otf" className="sr-only" disabled={busyBrandAsset !== null} onChange={(event) => {
                                        const file = event.target.files?.[0];
                                        if (file) void uploadBrandAsset('font', file);
                                        event.currentTarget.value = '';
                                    }} />
                                </label>
                            </div>
                            <div className="mt-4">
                                <p className="mb-2 text-xs font-bold text-gray-600 dark:text-gray-300">{isAr ? 'لوحات ألوان جاهزة' : 'Color palettes'}</p>
                                <div className="grid grid-cols-2 gap-2">
                                    {[
                                        { name: isAr ? 'ملكي' : 'Royal', primaryColor: '#12305A', accentColor: '#C6A15B', backgroundColor: '#FFFFFF', textColor: '#12305A' },
                                        { name: isAr ? 'زمردي' : 'Emerald', primaryColor: '#064E3B', accentColor: '#34D399', backgroundColor: '#F0FDF4', textColor: '#052E16' },
                                        { name: isAr ? 'بنفسجي' : 'Violet', primaryColor: '#4C1D95', accentColor: '#C4B5FD', backgroundColor: '#FAF5FF', textColor: '#2E1065' },
                                        { name: isAr ? 'عنابي' : 'Burgundy', primaryColor: '#7F1D1D', accentColor: '#FCA5A5', backgroundColor: '#FFFBFA', textColor: '#450A0A' },
                                        { name: isAr ? 'أزرق محيطي' : 'Ocean', primaryColor: '#0C4A6E', accentColor: '#38BDF8', backgroundColor: '#F0F9FF', textColor: '#082F49' },
                                        { name: isAr ? 'فحمي' : 'Charcoal', primaryColor: '#27272A', accentColor: '#A1A1AA', backgroundColor: '#FAFAFA', textColor: '#18181B' },
                                    ].map((palette) => (
                                        <button key={palette.name} type="button" onClick={() => updateVisualStyle(palette)} className="flex items-center gap-2 rounded-lg border border-gray-200 px-2 py-2 text-[11px] font-bold dark:border-white/10">
                                            <span className="flex h-5 w-8 overflow-hidden rounded">
                                                <span className="w-1/2" style={{ backgroundColor: palette.primaryColor }} />
                                                <span className="w-1/2" style={{ backgroundColor: palette.accentColor }} />
                                            </span>
                                            {palette.name}
                                        </button>
                                    ))}
                                </div>
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
                </div>}
            </section>}

            {managementTab === 'assets' && <section role="tabpanel" id="certificate-management-panel" aria-labelledby="certificate-tab-assets" className="space-y-4">
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
            </section>}

            {managementTab === 'records' && <section role="tabpanel" id="certificate-management-panel" aria-labelledby="certificate-tab-records" className="overflow-hidden rounded-3xl border border-gray-200 bg-white dark:border-white/5 dark:bg-brand-navy-dark">
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
            </section>}
        </div>
    );
}
