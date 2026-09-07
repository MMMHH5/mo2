"use client";

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { API_BASE_URL, getErrorMessage } from '@/lib/api';
import { useI18n } from '@/lib/i18n-context';
import { formatDate } from '@/lib/format';
import { Search, ShieldCheck, ShieldAlert, ExternalLink, Award } from 'lucide-react';

interface CertificateInfo {
    id: string;
    verificationCode: string;
    issuingDate: string;
    verificationStatus: string;
    student?: { email: string } | null;
    course?: { id: string; titleAr?: string | null; titleEn?: string | null } | null;
}

interface VerifyResult {
    valid: boolean;
    certificate: CertificateInfo | null;
}

export default function VerifyCertificateForm() {
    const searchParams = useSearchParams();
    const initialCode = searchParams.get('code') || '';
    const [code, setCode] = useState(initialCode);
    const [result, setResult] = useState<VerifyResult | null>(null);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { locale } = useI18n();
    const isAr = locale === 'ar';
    const autoRan = useRef(false);

    const verify = async (codeToVerify?: string) => {
        const targetCode = (codeToVerify || code).trim();
        if (!targetCode) return;
        setLoading(true);
        setError('');
        setResult(null);
        try {
            const res = await fetch(`${API_BASE_URL}/certificates/verify/${encodeURIComponent(targetCode)}`);
            if (!res.ok) throw new Error('Verification failed');
            const data = await res.json();
            setResult(data);
        } catch (err) {
            setError(getErrorMessage(err) || (isAr ? 'فشل التحقق' : 'Verification failed.'));
        } finally {
            setLoading(false);
        }
    };

    // Auto-verify if code is in URL
    useEffect(() => {
        if (initialCode && !autoRan.current) {
            autoRan.current = true;
            verify(initialCode);
        }
    }, [initialCode]);

    const cert = result?.certificate;

    return (
        <div className="min-h-screen bg-[#0a1830] flex flex-col">
            {/* Header */}
            <header className="px-6 py-5 flex items-center justify-between border-b border-white/5 bg-[#0a1830]/80 backdrop-blur-xl sticky top-0 z-50">
                <Link href="/" className="flex items-center gap-2">
                    <div className="w-9 h-9 bg-gradient-to-br from-amber-500 to-amber-600 rounded-lg flex items-center justify-center">
                        <span className="text-black font-black text-sm">L</span>
                    </div>
                    <span className="text-xl font-black text-white tracking-tight">
                        laxa<span className="text-amber-400">lab</span>
                    </span>
                </Link>
                <Link href="/login" className="text-sm font-bold text-gray-400 hover:text-white transition">
                    {isAr ? 'تسجيل الدخول' : 'Sign in'}
                </Link>
            </header>

            <main className="flex-1 flex flex-col items-center px-4 py-12 sm:py-20">
                {/* Hero */}
                <div className="text-center mb-12 max-w-xl">
                    <div className="w-18 h-18 w-[72px] h-[72px] mx-auto mb-6 bg-[#111f3a] rounded-3xl flex items-center justify-center border border-white/5">
                        <ShieldCheck size={36} className="text-amber-400" />
                    </div>
                    <h1 className="text-4xl sm:text-5xl font-black text-white mb-4">
                        {isAr ? 'التحقق من الشهادة' : 'Verify Certificate'}
                    </h1>
                    <p className="text-gray-400 text-lg leading-relaxed">
                        {isAr
                            ? 'أدخل رمز التحقق الموجود على الشهادة للتحقق من صحتها رسمياً'
                            : 'Enter the verification code on the certificate to officially verify its authenticity'}
                    </p>
                </div>

                {/* Search form */}
                <div className="w-full max-w-lg">
                    <form onSubmit={(e) => { e.preventDefault(); verify(); }} className="relative">
                        <div className="relative bg-[#111f3a] rounded-2xl border border-white/5 p-2 flex items-center gap-2 shadow-2xl shadow-black/20">
                            <Search size={20} className="text-gray-500 absolute left-5 top-1/2 -translate-y-1/2 rtl:left-auto rtl:right-5" />
                            <input
                                type="text"
                                required
                                className="flex-1 bg-transparent text-white placeholder-gray-500 font-mono text-sm tracking-wider pl-12 pr-4 py-4 outline-none rtl:pl-4 rtl:pr-12"
                                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                                value={code}
                                dir="ltr"
                                onChange={(e) => setCode(e.target.value.trim())}
                            />
                            <button
                                type="submit"
                                disabled={loading || !code.trim()}
                                className="bg-gradient-to-r from-amber-500 to-amber-600 text-black font-black text-sm px-6 py-3.5 rounded-xl hover:from-amber-400 hover:to-amber-500 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                            >
                                {loading
                                    ? (isAr ? 'جارٍ...' : 'Checking...')
                                    : (isAr ? 'تحقق' : 'Verify')}
                            </button>
                        </div>
                    </form>
                </div>

                {/* Error */}
                {error && (
                    <div className="w-full max-w-lg mt-6 p-5 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-start gap-3">
                        <ShieldAlert size={20} className="text-red-400 shrink-0 mt-0.5" />
                        <p className="text-red-400 font-semibold text-sm">{error}</p>
                    </div>
                )}

                {/* Result */}
                {result && cert && (
                    <div className="w-full max-w-lg mt-8">
                        <div className={`rounded-2xl border overflow-hidden ${
                            result.valid
                                ? 'bg-[#111f3a] border-green-500/20'
                                : 'bg-[#111f3a] border-red-500/20'
                        }`}>
                            {/* Status header */}
                            <div className={`px-6 py-4 flex items-center gap-3 ${
                                result.valid ? 'bg-green-500/10' : 'bg-red-500/10'
                            }`}>
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                                    result.valid ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                                }`}>
                                    {result.valid ? <ShieldCheck size={22} /> : <ShieldAlert size={22} />}
                                </div>
                                <div>
                                    <h2 className={`text-lg font-black ${result.valid ? 'text-green-400' : 'text-red-400'}`}>
                                        {result.valid
                                            ? (isAr ? 'شهادة صالحة' : 'Valid Certificate')
                                            : (isAr ? 'شهادة غير صالحة' : 'Invalid Certificate')}
                                    </h2>
                                    <p className="text-sm text-gray-400">
                                        {result.valid
                                            ? (isAr ? 'تم التحقق من صحة هذه الشهادة بنجاح' : 'This certificate has been successfully verified')
                                            : (isAr ? 'لم يتم العثور على شهادة بهذا الرمز' : 'No certificate found with this code')}
                                    </p>
                                </div>
                            </div>

                            {/* Certificate details */}
                            {result.valid && cert && (
                                <div className="p-6 space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-[#0a1830] rounded-xl p-4 border border-white/5">
                                            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                                                {isAr ? 'الحاصل على الشهادة' : 'Recipient'}
                                            </p>
                                            <p className="text-white font-bold text-sm capitalize">
                                                {cert.student?.email?.split('@')[0] || '—'}
                                            </p>
                                        </div>
                                        <div className="bg-[#0a1830] rounded-xl p-4 border border-white/5">
                                            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                                                {isAr ? 'الدورة' : 'Course'}
                                            </p>
                                            <p className="text-white font-bold text-sm line-clamp-2">
                                                {isAr ? (cert.course?.titleAr || cert.course?.titleEn) : (cert.course?.titleEn || cert.course?.titleAr) || '—'}
                                            </p>
                                        </div>
                                        <div className="bg-[#0a1830] rounded-xl p-4 border border-white/5">
                                            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                                                {isAr ? 'تاريخ الإصدار' : 'Issue Date'}
                                            </p>
                                            <p className="text-white font-bold text-sm">
                                                {formatDate(cert.issuingDate, { locale })}
                                            </p>
                                        </div>
                                        <div className="bg-[#0a1830] rounded-xl p-4 border border-white/5">
                                            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                                                {isAr ? 'رمز التحقق' : 'Verification Code'}
                                            </p>
                                            <p className="text-white font-bold text-xs font-mono truncate" dir="ltr">
                                                {cert.verificationCode.slice(0, 8)}...
                                            </p>
                                        </div>
                                    </div>

                                    {/* View certificate button */}
                                    <Link
                                        href={`/certificate/${cert.id}`}
                                        className="w-full flex items-center justify-center gap-2 bg-white/5 border border-white/10 text-white font-bold py-3.5 rounded-xl hover:bg-white/10 transition-all duration-200"
                                    >
                                        <Award size={18} />
                                        {isAr ? 'عرض الشهادة' : 'View Certificate'}
                                        <ExternalLink size={14} />
                                    </Link>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Info cards */}
                <div className="w-full max-w-2xl mt-16 grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {[
                        {
                            icon: ShieldCheck,
                            title: isAr ? 'آمن وموثوق' : 'Secure & Trusted',
                            desc: isAr ? 'جميع الشهادات موثقة رسمياً' : 'All certificates are officially documented',
                        },
                        {
                            icon: Search,
                            title: isAr ? 'بحث فوري' : 'Instant Lookup',
                            desc: isAr ? 'أدخل الرمز واحصل على نتيجة فورية' : 'Enter code for instant verification',
                        },
                        {
                            icon: Award,
                            title: isAr ? 'شهادات عالمية' : 'Global Certificates',
                            desc: isAr ? 'معترف بها عالمياً' : 'Internationally recognized',
                        },
                    ].map((item, i) => (
                        <div key={i} className="bg-[#111f3a] border border-white/5 rounded-2xl p-5 text-center hover:border-white/10 transition-all duration-300">
                            <div className="w-12 h-12 rounded-xl bg-white/5 text-gray-400 flex items-center justify-center mx-auto mb-3">
                                <item.icon size={22} />
                            </div>
                            <h3 className="text-white font-bold text-sm mb-1">{item.title}</h3>
                            <p className="text-gray-500 text-xs">{item.desc}</p>
                        </div>
                    ))}
                </div>
            </main>
        </div>
    );
}
