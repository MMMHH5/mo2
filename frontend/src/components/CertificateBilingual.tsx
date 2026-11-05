"use client";

import { useEffect, useState, useRef, useCallback } from 'react';
import QRCode from 'qrcode';
import Image from 'next/image';
import { API_BASE_URL } from '@/lib/api';
import BrandLogo from '@/components/BrandLogo';
import CertificateDesignFrame, { type CertificateDesign } from '@/components/CertificateDesignFrame';

export interface CertificateTemplateData {
    academyNameAr: string;
    academyNameEn: string;
    titleAr: string;
    titleEn: string;
    descriptionAr: string;
    descriptionEn: string;
    directorSignatureUrl: string | null;
    academyStampUrl: string | null;
    designKey?: 'classic' | 'royal' | 'modern';
    layout?: Record<string, { x: number; y: number } | unknown>;
}

export interface CertificateProps {
    studentName: string;
    courseName: string;
    instructorName: string;
    issueDate: string;
    verificationCode: string;
    verificationUrl: string;
    instructorSignatureUrl?: string | null;
    lang: 'ar' | 'en';
    template?: CertificateTemplateData;
}

function formatDate(dateStr: string, lang: 'ar' | 'en'): string {
    const d = new Date(dateStr);
    if (lang === 'en') {
        return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    }
    return d.toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' });
}

function QRCodeSVG({ url, lang, color = '#12305A' }: { url: string; lang: 'ar' | 'en'; color?: string }) {
    const [svg, setSvg] = useState('');
    const [failed, setFailed] = useState(false);
    useEffect(() => {
        QRCode.toString(url, { type: 'svg', width: 90, margin: 1, color: { dark: color, light: '#ffffff00' } })
            .then((result) => {
                setFailed(false);
                setSvg(result);
            })
            .catch(() => setFailed(true));
    }, [url, color]);
    if (failed) return <div role="img" aria-label={lang === 'ar' ? 'تعذر إنشاء رمز QR' : 'QR code unavailable'} className="flex h-[90px] w-[90px] items-center justify-center rounded bg-gray-100 px-2 text-center text-[9px] text-gray-500">{lang === 'ar' ? 'تعذر إنشاء الرمز' : 'QR unavailable'}</div>;
    if (!svg) return <div className="w-[90px] h-[90px] bg-gray-100 animate-pulse rounded" />;
    return <div className="w-[90px] h-[90px]" dangerouslySetInnerHTML={{ __html: svg }} />;
}

function GoldDiamond({ color }: { color: string }) {
    return (
        <svg width="12" height="12" viewBox="0 0 12 12" className="inline-block mx-1">
            <rect x="6" y="0" width="8.5" height="8.5" transform="rotate(45 6 0)" fill={color} />
        </svg>
    );
}

function OrnamentLine({ side, color }: { side: 'left' | 'right'; color: string }) {
    return (
        <div className={`flex items-center gap-1 ${side === 'right' ? 'flex-row-reverse' : ''}`}>
            <div className="h-[1px] w-8" style={{ backgroundColor: colorWithOpacity(color, 0.4) }} />
            <div className="w-1.5 h-1.5 rotate-45" style={{ backgroundColor: colorWithOpacity(color, 0.6) }} />
            <div className="h-[1px] w-20" style={{ background: `linear-gradient(to right, ${colorWithOpacity(color, 0.6)}, ${colorWithOpacity(color, 0.1)})` }} />
        </div>
    );
}

function colorWithOpacity(color: string, opacity: number): string {
    const hex = color.replace('#', '');
    if (!/^[\da-f]{6}$/i.test(hex)) return color;
    const value = Number.parseInt(hex, 16);
    return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${opacity})`;
}

export default function CertificateBilingual({ studentName, courseName, instructorName, instructorSignatureUrl, issueDate, verificationCode, verificationUrl, lang, template }: CertificateProps) {
    const isAr = lang === 'ar';
    const academyName = isAr ? template?.academyNameAr : template?.academyNameEn;
    const certificateTitle = isAr ? template?.titleAr : template?.titleEn;
    const certificateDescription = isAr ? template?.descriptionAr : template?.descriptionEn;
    const savedStyle = template?.layout?.__visualStyle;
    const visualStyle = {
        primaryColor: savedStyle && typeof savedStyle === 'object' && 'primaryColor' in savedStyle && typeof savedStyle.primaryColor === 'string' ? savedStyle.primaryColor : '#12305A',
        accentColor: savedStyle && typeof savedStyle === 'object' && 'accentColor' in savedStyle && typeof savedStyle.accentColor === 'string' ? savedStyle.accentColor : '#C6A15B',
        backgroundColor: savedStyle && typeof savedStyle === 'object' && 'backgroundColor' in savedStyle && typeof savedStyle.backgroundColor === 'string' ? savedStyle.backgroundColor : '#FFFFFF',
        textColor: savedStyle && typeof savedStyle === 'object' && 'textColor' in savedStyle && typeof savedStyle.textColor === 'string' ? savedStyle.textColor : '#12305A',
        frameStyle: savedStyle && typeof savedStyle === 'object' && 'frameStyle' in savedStyle && typeof savedStyle.frameStyle === 'string' ? savedStyle.frameStyle : 'double',
        logoShape: savedStyle && typeof savedStyle === 'object' && 'logoShape' in savedStyle && typeof savedStyle.logoShape === 'string' ? savedStyle.logoShape : 'rounded',
        logoVariant: savedStyle && typeof savedStyle === 'object' && 'logoVariant' in savedStyle && typeof savedStyle.logoVariant === 'string' ? savedStyle.logoVariant : 'mark',
        showLogo: !(savedStyle && typeof savedStyle === 'object' && 'showLogo' in savedStyle && savedStyle.showLogo === false),
        logoUrl: savedStyle && typeof savedStyle === 'object' && 'logoUrl' in savedStyle && typeof savedStyle.logoUrl === 'string' ? savedStyle.logoUrl : '/logos/LaxaLab_Academy_Horizontal_Primary_4K.png',
        certificateDesign: savedStyle && typeof savedStyle === 'object' && 'certificateDesign' in savedStyle && typeof savedStyle.certificateDesign === 'string' ? savedStyle.certificateDesign as CertificateDesign : 'classic',
        fontFamily: savedStyle && typeof savedStyle === 'object' && 'fontFamily' in savedStyle && typeof savedStyle.fontFamily === 'string' ? savedStyle.fontFamily : "'Georgia', 'Times New Roman', serif",
        fontUrl: savedStyle && typeof savedStyle === 'object' && 'fontUrl' in savedStyle && typeof savedStyle.fontUrl === 'string' ? savedStyle.fontUrl : null,
    };
    const logoClass = visualStyle.logoShape === 'circle' ? 'rounded-full' : visualStyle.logoShape === 'square' ? 'rounded-none' : 'rounded-lg';
    const frameBorderStyle = visualStyle.frameStyle === 'dashed' ? 'dashed' : visualStyle.frameStyle === 'ornate' ? 'double' : 'solid';
    const logoSrc = visualStyle.logoUrl.startsWith('/uploads/certificates/branding/') && !visualStyle.logoUrl.includes('..')
        ? `${API_BASE_URL}${visualStyle.logoUrl}`
        : /^\/(logos|icons)\/[A-Za-z0-9._/-]+$/.test(visualStyle.logoUrl) && !visualStyle.logoUrl.includes('..')
            ? visualStyle.logoUrl
            : '/logos/LaxaLab_Academy_Horizontal_Primary_4K.png';
    const fontSrc = visualStyle.fontUrl?.startsWith('/uploads/certificates/branding/') && !visualStyle.fontUrl.includes('..')
        ? `${API_BASE_URL}${visualStyle.fontUrl}`
        : null;
    const fontFormat = fontSrc?.toLowerCase().endsWith('.woff2') ? 'woff2' : fontSrc?.toLowerCase().endsWith('.woff') ? 'woff' : fontSrc?.toLowerCase().endsWith('.otf') ? 'opentype' : 'truetype';
    const certificateFontFamily = visualStyle.fontFamily;
    const layoutOffset = (key: string, axis: 'x' | 'y', baseline: number) => {
        const point = template?.layout?.[key];
        if (!point || typeof point !== 'object' || !('x' in point) || !('y' in point)) return 0;
        const value = point[axis] ?? baseline;
        return typeof value === 'number' ? (value - baseline) * 5.6 : 0;
    };
    const [scale, setScale] = useState(1);
    const certRef = useRef<HTMLDivElement>(null);

    const handlePrint = useCallback(() => {
        window.print();
    }, []);

    useEffect(() => {
        const el = certRef.current;
        if (!el) return;
        const fit = () => {
            const w = el.getBoundingClientRect().width;
            setScale(Math.min(1, w / 1056));
        };
        fit();
        const ro = new ResizeObserver(fit);
        ro.observe(el);
        window.addEventListener('resize', fit);
        return () => { ro.disconnect(); window.removeEventListener('resize', fit); };
    }, []);

    useEffect(() => {
        document.title = isAr
            ? `${certificateTitle || 'شهادة إتمام الدورة'} - ${courseName} | ${academyName || 'Laxalab'}`
            : `${certificateTitle || 'Certificate of Completion'} - ${courseName} | ${academyName || 'Laxalab'}`;
    }, [isAr, courseName, academyName, certificateTitle]);

    return (
        <>
            {fontSrc && <style>{`@font-face { font-family: 'LaxaCertificateCustom'; src: url("${fontSrc}") format("${fontFormat}"); font-display: swap; }`}</style>}
            {/* Controls — hidden on print */}
            <div className="no-print fixed top-0 inset-x-0 z-50 bg-brand-navy-dark/95 backdrop-blur-xl border-b border-white/10">
                <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <BrandLogo className="h-8 w-8 rounded-lg" variant="mark" dark />
                        <span className="text-white font-bold text-sm hidden sm:inline">
                            {certificateTitle || (isAr ? 'شهادة إتمام الدورة' : 'Certificate of Completion')}
                        </span>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="text-gray-400 text-xs hidden sm:inline font-mono" dir="ltr">
                            #{verificationCode.slice(0, 8)}
                        </span>
                        <button
                            onClick={handlePrint}
                            className="bg-white text-brand-navy-dark font-black text-sm px-5 py-2 rounded-lg hover:bg-gray-100 transition-all duration-200 flex items-center gap-2"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5zm-3 0h.008v.008H15V10.5z" />
                            </svg>
                            {isAr ? 'طباعة' : 'Print'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Spacer for fixed header */}
            <div className="no-print h-14" />

            {/* Certificate */}
            <div className="min-h-screen bg-gray-200 flex items-center justify-center p-4 overflow-hidden print:bg-white print:p-0 print:overflow-visible">
                {/* Mobile stacked certificate (screen only, below md) */}
                <div className="md:hidden print:hidden w-full max-w-md mx-auto relative z-10">
                    <div className="relative rounded-3xl overflow-hidden shadow-2xl" style={{ backgroundColor: visualStyle.backgroundColor, border: visualStyle.frameStyle === 'none' ? 'none' : `8px ${frameBorderStyle} ${visualStyle.primaryColor}` }}>
                        <CertificateDesignFrame design={visualStyle.certificateDesign} primaryColor={visualStyle.primaryColor} accentColor={visualStyle.accentColor} />
                        <div className="absolute inset-x-0 top-0 z-10 h-1.5" style={{ backgroundColor: visualStyle.accentColor }} />
                        <div className="relative z-10 p-6 pt-8 text-center space-y-5">
                            <div className="flex items-center justify-center gap-2">
                                {visualStyle.showLogo && <Image src={logoSrc} alt={isAr ? 'شعار المنصة' : 'Platform logo'} width={320} height={90} unoptimized className={`h-10 w-36 ${logoClass} object-contain`} />}
                                <span className="text-xl font-black tracking-tight" style={{ color: visualStyle.textColor, fontFamily: certificateFontFamily }}>{academyName || 'Laxalab Academy'}</span>
                            </div>
                            <div className="mx-8 h-px" style={{ background: `linear-gradient(to right, transparent, ${colorWithOpacity(visualStyle.accentColor, 0.6)}, transparent)` }} />
                            <div>
                                <p className="text-[10px] font-bold uppercase tracking-[0.3em] mb-4" style={{ color: visualStyle.accentColor, fontFamily: certificateFontFamily }}>
                                    {certificateTitle || (isAr ? 'شهادة إتمام الدورة' : 'CERTIFICATE OF COMPLETION')}
                                </p>
                                <p className="text-sm text-gray-500 italic">{isAr ? 'تُمنح هذه الشهادة إلى' : 'This is to certify that'}</p>
                                <p className="mt-1 break-words text-2xl font-bold" style={{ color: visualStyle.textColor, fontFamily: certificateFontFamily }}>{studentName}</p>
                                <p className="text-sm text-gray-500 italic mt-4">{isAr ? 'وقد أتم بنجاح دورة:' : 'has successfully completed the course:'}</p>
                                <p className="mt-1 break-words text-lg font-bold" style={{ color: visualStyle.textColor, fontFamily: certificateFontFamily }}>{courseName}</p>
                            </div>
                            <div className="grid grid-cols-2 gap-3 text-start">
                                <div className="rounded-xl border p-3" style={{ backgroundColor: colorWithOpacity(visualStyle.primaryColor, 0.035), borderColor: colorWithOpacity(visualStyle.primaryColor, 0.1) }}>
                                            <p className="text-[9px] font-bold uppercase tracking-[0.15em]" style={{ color: visualStyle.accentColor, fontFamily: certificateFontFamily }}>
                                        {isAr ? 'المدرّس المعتمد' : 'Instructor'}
                                    </p>
                                    <p className="mt-1 break-words text-xs font-bold" style={{ color: visualStyle.textColor, fontFamily: certificateFontFamily }}>{instructorName}</p>
                                </div>
                                <div className="rounded-xl border p-3" style={{ backgroundColor: colorWithOpacity(visualStyle.primaryColor, 0.035), borderColor: colorWithOpacity(visualStyle.primaryColor, 0.1) }}>
                                    <p className="text-[9px] font-bold uppercase tracking-[0.15em]" style={{ color: visualStyle.accentColor, fontFamily: certificateFontFamily }}>
                                        {isAr ? 'تاريخ الإصدار' : 'Date'}
                                    </p>
                                    <p className="mt-1 text-xs font-bold" style={{ color: visualStyle.textColor, fontFamily: certificateFontFamily }}>{formatDate(issueDate, lang)}</p>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3 border-t border-dashed pt-4" style={{ borderColor: colorWithOpacity(visualStyle.primaryColor, 0.15) }}>
                                <div className="text-center">
                                    {instructorSignatureUrl && <Image src={`${API_BASE_URL}${instructorSignatureUrl}`} alt={isAr ? 'توقيع المدرّس' : 'Instructor signature'} width={240} height={90} unoptimized className="mx-auto h-10 max-w-full object-contain" />}
                                    <p className="mt-1 truncate text-[10px] font-bold" style={{ color: visualStyle.textColor }}>{instructorName}</p>
                                    <p className="mt-1 text-[9px] font-bold" style={{ color: visualStyle.accentColor }}>{isAr ? 'توقيع المدرّس' : 'Instructor signature'}</p>
                                </div>
                                <div className="text-center">
                                    {template?.directorSignatureUrl && <Image src={`${API_BASE_URL}${template.directorSignatureUrl}`} alt={isAr ? 'توقيع المدير' : 'Director signature'} width={240} height={90} unoptimized className="mx-auto h-10 max-w-full object-contain" />}
                                    <p className="mt-1 text-[10px] font-bold" style={{ color: visualStyle.textColor }}>{isAr ? 'إدارة الأكاديمية' : 'Academy Director'}</p>
                                    <p className="mt-1 text-[9px] font-bold" style={{ color: visualStyle.accentColor }}>{isAr ? 'توقيع المدير' : 'Director signature'}</p>
                                </div>
                            </div>
                            {template?.academyStampUrl && <Image src={`${API_BASE_URL}${template.academyStampUrl}`} alt={isAr ? 'ختم الأكاديمية' : 'Academy seal'} width={120} height={120} unoptimized className="mx-auto h-16 w-16 object-contain" />}
                            <div className="flex items-center justify-center gap-4 border-t border-dashed pt-5" style={{ borderColor: colorWithOpacity(visualStyle.primaryColor, 0.15) }}>
                                <div className="shrink-0 rounded border bg-white p-1.5 shadow-sm" style={{ borderColor: colorWithOpacity(visualStyle.primaryColor, 0.1) }}>
                                    <QRCodeSVG url={verificationUrl} lang={lang} color={visualStyle.primaryColor} />
                                </div>
                                <div className="text-start min-w-0">
                                    <p className="text-[9px] font-bold uppercase tracking-[0.15em]" style={{ color: visualStyle.accentColor, fontFamily: certificateFontFamily }}>
                                        {isAr ? 'رقم الشهادة' : 'Certificate ID'}
                                    </p>
                                    <p className="break-all text-sm font-mono font-black tracking-wider" style={{ color: visualStyle.textColor }} dir="ltr">{verificationCode.toUpperCase()}</p>
                                    <p className="text-[9px] text-gray-400 mt-1 break-all" dir="ltr">{verificationUrl.replace(/^https?:\/\//, '')}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div ref={certRef} className="w-full relative print:relative hidden md:block print:block">
                    <div className="print:hidden" style={{ height: `${748 * scale}px` }} />
                    <div
                        className="certificate-wrap bg-white shadow-2xl print:shadow-none print:w-full"
                        style={{
                            position: 'absolute' as const,
                            top: 0,
                            left: 0,
                            width: '1056px',
                            height: '748px',
                            transform: `scale(${scale})`,
                            transformOrigin: 'top left',
                            backgroundColor: visualStyle.backgroundColor,
                        }}
                    >
                        <CertificateDesignFrame design={visualStyle.certificateDesign} primaryColor={visualStyle.primaryColor} accentColor={visualStyle.accentColor} />

                        {/* === DECORATIVE BORDER === */}
                        {visualStyle.frameStyle !== 'none' && (
                            <>
                                <div
                                    className="absolute"
                                    style={{
                                        inset: 0,
                                        borderStyle: frameBorderStyle,
                                        borderWidth: visualStyle.frameStyle === 'double' || visualStyle.frameStyle === 'ornate' ? 14 : 6,
                                        borderColor: visualStyle.primaryColor,
                                    }}
                                />
                                {visualStyle.frameStyle === 'double' && <div className="absolute border-2" style={{ inset: '10px', borderColor: visualStyle.accentColor }} />}
                                {visualStyle.frameStyle === 'ornate' && (
                                    <>
                                        <div className="absolute border-2" style={{ inset: '12px', borderColor: visualStyle.accentColor }} />
                                        <div className="absolute border" style={{ inset: '22px', borderColor: colorWithOpacity(visualStyle.primaryColor, 0.45) }} />
                                    </>
                                )}
                            </>
                        )}

                        {/* Corner ornaments — elegant gold dots */}
                        {[
                            { top: '14px', left: '14px' },
                            { top: '14px', right: '14px' },
                            { bottom: '14px', left: '14px' },
                            { bottom: '14px', right: '14px' },
                        ].map((pos, i) => (
                            <div key={i} className="absolute" style={{ ...pos }}>
                                <div className="w-5 h-5 relative">
                                    <div className="absolute top-1/2 left-0 -translate-y-1/2 w-full h-[1px]" style={{ backgroundColor: colorWithOpacity(visualStyle.accentColor, 0.5) }} />
                                    <div className="absolute left-1/2 top-0 -translate-x-1/2 h-full w-[1px]" style={{ backgroundColor: colorWithOpacity(visualStyle.accentColor, 0.5) }} />
                                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full" style={{ backgroundColor: visualStyle.accentColor }} />
                                </div>
                            </div>
                        ))}

                        {/* === CONTENT === */}
                        <div
                            className="relative z-10 h-full flex flex-col items-center justify-between"
                            style={{ inset: '24px', position: 'absolute', padding: isAr ? '40px 48px 32px' : '40px 48px 32px' }}
                        >

                            {/* ===== TOP SECTION: Logo + Title ===== */}
                            <div className="text-center w-full" style={{ transform: `translate(${layoutOffset('brand', 'x', 50)}px, ${layoutOffset('brand', 'y', 9) + layoutOffset('title', 'y', 19)}px)` }}>
                                {/* Logo + Brand */}
                                <div className={`flex items-center justify-center gap-3 mb-4 ${isAr ? 'flex-row-reverse' : ''}`}>
                                    {visualStyle.showLogo && (
                                        <div style={{ transform: `translate(${layoutOffset('logo', 'x', 50)}px, ${layoutOffset('logo', 'y', 9)}px)` }}>
                                            <Image src={logoSrc} alt={isAr ? 'شعار المنصة' : 'Platform logo'} width={400} height={110} unoptimized className={`h-16 w-52 ${logoClass} object-contain`} />
                                        </div>
                                    )}
                                    <h1 className="text-2xl font-black tracking-tight" style={{ color: visualStyle.textColor, fontFamily: certificateFontFamily }}>
                                        {academyName || 'Laxalab Academy'}
                                    </h1>
                                </div>

                                {/* Decorative line */}
                                <div className="flex items-center justify-center gap-3 mb-3">
                                    <OrnamentLine side="left" color={visualStyle.accentColor} />
                                    <GoldDiamond color={visualStyle.accentColor} />
                                    <OrnamentLine side="right" color={visualStyle.accentColor} />
                                </div>

                                {/* Certificate Title */}
                                <h2
                                    className="text-[11px] font-bold uppercase tracking-[0.4em] mb-1"
                                    style={{ color: visualStyle.accentColor, fontFamily: certificateFontFamily }}
                                >
                                    {certificateTitle || (isAr ? 'شهادة إتمام الدورة' : 'Certificate of Completion')}
                                </h2>
                            </div>

                            {/* ===== MIDDLE SECTION: Body ===== */}
                            <div className={`text-center flex-1 flex flex-col items-center justify-center w-full max-w-xl ${isAr ? 'direction-rtl' : ''}`} dir={isAr ? 'rtl' : 'ltr'} style={{ transform: `translate(${layoutOffset('recipient', 'x', 50) + layoutOffset('course', 'x', 50)}px, ${(layoutOffset('recipient', 'y', 43) + layoutOffset('course', 'y', 58)) / 2}px)` }}>

                                {/* "This is to certify that" */}
                                <p
                                    className="text-[13px] mb-4"
                                    style={{ color: colorWithOpacity(visualStyle.textColor, 0.68), fontFamily: certificateFontFamily, fontStyle: 'italic' }}
                                >
                                    {isAr ? 'تُمنح هذه الشهادة إلى' : 'This is to certify that'}
                                </p>

                                {/* === Student Name (large, underlined) === */}
                                <div className="mb-2">
                                    <p
                                        className="text-[38px] leading-tight mb-1"
                                        style={{
                                            color: visualStyle.textColor,
                                            fontFamily: certificateFontFamily,
                                            fontWeight: 700,
                                        }}
                                    >
                                        {studentName}
                                    </p>
                                    <div className="mx-auto h-[1.5px] w-80" style={{ background: `linear-gradient(to right, transparent, ${colorWithOpacity(visualStyle.accentColor, 0.7)}, transparent)` }} />
                                </div>

                                {/* "has successfully completed" */}
                                <p
                                    className="text-[13px] mt-3 mb-2"
                                    style={{ color: colorWithOpacity(visualStyle.textColor, 0.68), fontFamily: certificateFontFamily, fontStyle: 'italic' }}
                                >
                                    {isAr ? 'وقد أتم بنجاح دورة' : 'has successfully completed the course'}
                                </p>

                                {/* === Course Name === */}
                                <p
                                    className="text-[22px] font-bold mb-3"
                                    style={{
                                        color: visualStyle.textColor,
                                        fontFamily: certificateFontFamily,
                                    }}
                                >
                                    {courseName}
                                </p>

                                {/* Description */}
                                <p
                                    className="text-[11px] leading-relaxed max-w-md mb-4"
                                    style={{ color: colorWithOpacity(visualStyle.textColor, 0.55), fontFamily: certificateFontFamily }}
                                >
                                    {certificateDescription || (isAr
                                        ? 'بما في ذلك جميع المتطلبات الدراسية والتمارين العملية والاختبارات التقييمية اللازمة لإتمام الدورة بنجاح.'
                                        : 'Including all coursework, practical assignments, and assessments required for successful completion.')}
                                </p>

                                {/* Certificate Number */}
                                <div className={`inline-flex items-center gap-2 rounded border px-4 py-1.5 ${isAr ? 'flex-row-reverse' : ''}`} style={{ borderColor: colorWithOpacity(visualStyle.primaryColor, 0.1), backgroundColor: colorWithOpacity(visualStyle.primaryColor, 0.035) }}>
                                    <span className="text-[9px] font-bold uppercase tracking-[0.15em]" style={{ color: visualStyle.accentColor, fontFamily: certificateFontFamily }}>
                                        {isAr ? 'رقم الشهادة' : 'Certificate ID'}
                                    </span>
                                    <span className="text-[10px] font-mono font-black tracking-wider" style={{ color: visualStyle.textColor }} dir="ltr">
                                        {verificationCode.toUpperCase()}
                                    </span>
                                </div>
                            </div>

                            {/* ===== BOTTOM SECTION: Signatures + QR + Date ===== */}
                            <div className={`w-full flex items-end justify-between gap-6 ${isAr ? 'flex-row-reverse' : ''}`} dir="ltr" style={{ transform: `translate(${layoutOffset('signatures', 'x', 50) + layoutOffset('qr', 'x', 87) - 37}px, ${layoutOffset('signatures', 'y', 87)}px)` }}>

                                {/* Left: Instructor Signature */}
                                <div className="flex-1 text-center" dir={isAr ? 'rtl' : 'ltr'}>
                                    <p
                                        className="text-[14px] italic mb-1"
                                        style={{
                                            color: visualStyle.textColor,
                                            fontFamily: certificateFontFamily,
                                        }}
                                    >
                                        {instructorSignatureUrl
                                            ? <Image src={`${API_BASE_URL}${instructorSignatureUrl}`} alt={isAr ? 'توقيع المدرّس' : 'Instructor signature'} width={300} height={100} unoptimized className="mx-auto h-12 max-w-full object-contain" />
                                            : instructorName}
                                    </p>
                                    <div className="mb-1 h-[1px] w-full" style={{ backgroundColor: colorWithOpacity(visualStyle.primaryColor, 0.2) }} />
                                    {instructorSignatureUrl && <p className="mb-1 text-[8px] font-semibold" style={{ color: visualStyle.textColor }}>{instructorName}</p>}
                                    <p className="text-[9px] font-bold uppercase tracking-[0.15em]" style={{ color: visualStyle.accentColor, fontFamily: certificateFontFamily }}>
                                        {isAr ? 'المدرّس المعتمد' : 'Certified Instructor'}
                                    </p>
                                </div>

                                {/* Center: QR Code + Laxalab Seal */}
                                <div className="flex flex-col items-center gap-1 shrink-0">
                                    <div className="rounded border bg-white p-1.5 shadow-sm" style={{ borderColor: colorWithOpacity(visualStyle.primaryColor, 0.1) }}>
                                        <QRCodeSVG url={verificationUrl} lang={lang} color={visualStyle.primaryColor} />
                                    </div>
                                    {template?.academyStampUrl && <Image src={`${API_BASE_URL}${template.academyStampUrl}`} alt={isAr ? 'ختم الأكاديمية' : 'Academy seal'} width={100} height={100} unoptimized className="h-14 w-14 object-contain" />}
                                    <p className="text-[7px] font-mono font-bold tracking-[0.15em]" style={{ color: colorWithOpacity(visualStyle.textColor, 0.55) }}>
                                        {isAr ? 'امسح للتحقق' : 'SCAN TO VERIFY'}
                                    </p>
                                </div>

                                {/* Right: Director signature and issue date */}
                                <div className="flex-1 text-center" dir={isAr ? 'rtl' : 'ltr'}>
                                    {template?.directorSignatureUrl
                                        ? <Image src={`${API_BASE_URL}${template.directorSignatureUrl}`} alt={isAr ? 'توقيع المدير' : 'Director signature'} width={300} height={100} unoptimized className="mx-auto h-12 max-w-full object-contain" />
                                        : <p className="mb-1 text-[12px] font-bold" style={{ color: visualStyle.textColor, fontFamily: certificateFontFamily }}>{isAr ? 'إدارة الأكاديمية' : 'Academy Director'}</p>}
                                    <div className="mb-1 h-[1px] w-full" style={{ backgroundColor: colorWithOpacity(visualStyle.primaryColor, 0.2) }} />
                                    <p className="mb-1 text-[8px] font-semibold" style={{ color: visualStyle.textColor }}>{isAr ? 'المدير' : 'Director'}</p>
                                    <p className="text-[9px] font-bold uppercase tracking-[0.15em]" style={{ color: visualStyle.accentColor, fontFamily: certificateFontFamily }}>
                                        {isAr ? 'تاريخ الإصدار' : 'Date of Issue'}
                                    </p>
                                    <p className="mt-1 text-[10px] font-bold" style={{ color: visualStyle.textColor, fontFamily: certificateFontFamily }}>
                                        {formatDate(issueDate, lang)}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Print styles */}
            <style>{`
                @media print {
                    @page { size: landscape; margin: 0; }
                    body { margin: 0; padding: 0; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                    .no-print { display: none !important; }
                    .certificate-wrap { box-shadow: none !important; width: 100% !important; margin: 0 !important; position: relative !important; transform: none !important; height: 748px !important; }
                    .min-h-screen { background: white !important; padding: 0 !important; display: block !important; }
                    .min-h-screen > div { margin: 0 !important; }
                }
            `}</style>
        </>
    );
}
