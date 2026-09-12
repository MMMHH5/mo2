"use client";

import ProtectedRoute from '@/components/ProtectedRoute';
import { useFetchData } from '@/lib/useFetchData';
import { useI18n } from '@/lib/i18n-context';
import { Award, ExternalLink, Download } from 'lucide-react';
import Link from 'next/link';
import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

interface CertificateCourse {
    id: string;
    titleAr?: string | null;
    titleEn?: string | null;
}

interface Certificate {
    id: string;
    verificationCode: string;
    issuingDate: string;
    verificationStatus: string;
    course?: CertificateCourse | null;
}

export default function CertificatesPage() {
    const { data: certificates, loading, error } = useFetchData<Certificate[]>('/certificates/my');
    const { t, pick } = useI18n();
    const router = useRouter();
    const searchParams = useSearchParams();
    const courseId = searchParams.get('courseId');

    useEffect(() => {
        if (courseId && certificates && certificates.length > 0) {
            const match = certificates.find(c => c.course?.id === courseId);
            if (match) {
                router.replace(`/dashboard/certificates/${match.id}`);
            }
        }
    }, [courseId, certificates, router]);

    return (
        <ProtectedRoute allowedRoles={['STUDENT']}>
            <div className="bg-[#111f3a] p-8 rounded-3xl shadow-sm border border-white/5 min-h-[80vh]">
                <div className="mb-8">
                    <h2 className="text-3xl font-black text-white flex items-center gap-3">
                        <Award size={32} className="text-amber-400" /> {t('certificates.heading')}
                    </h2>
                    <p className="text-gray-400 mt-2">{t('certificates.subtitle')}</p>
                </div>

                {error && <div className="p-4 bg-red-500/10 text-red-400 border border-red-500/20 rounded-xl mb-6">{error}</div>}

                {loading ? (
                    <div className="h-40 flex items-center justify-center font-bold text-gray-400">{t('certificates.loading')}</div>
                ) : (certificates || []).length === 0 ? (
                    <div className="text-center py-16 text-gray-400 font-semibold text-lg border-2 border-dashed border-white/10 rounded-xl">
                        {t('certificates.empty_title')}
                        <div className="mt-2 text-sm font-normal">{t('certificates.empty_subtitle')}</div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {certificates!.map(cert => (
                            <div key={cert.id} className="relative border border-white/5 rounded-3xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 group bg-[#0d1f3c]">
                                <div className="absolute inset-x-0 top-0 h-1.5 bg-white/10 group-hover:bg-amber-500/50 transition-all duration-500" />
                                <div className="p-6">
                                    <div className="flex items-start justify-between mb-4">
                                        <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center text-gray-400 group-hover:text-amber-400 group-hover:bg-amber-500/10 transition-all duration-300">
                                            <Award size={26} />
                                        </div>
                                        {cert.verificationStatus === 'VALID' && (
                                            <span className="px-3 py-1 text-xs font-bold rounded-full border bg-green-500/10 text-green-400 border-green-500/20">
                                                {t('certificates.valid')}
                                            </span>
                                        )}
                                    </div>
                                    <h3 className="text-xl font-bold text-white mb-1 line-clamp-2">
                                        {cert.course ? pick(cert.course, 'title') : t('certificates.unknown_course')}
                                    </h3>
                                    <p className="text-sm text-gray-400 mb-4">
                                        {t('certificates.issued_on')} {new Date(cert.issuingDate).toLocaleDateString()}
                                    </p>
                                    <p className="text-xs text-gray-500 font-mono truncate mb-5" dir="ltr">
                                        {t('certificates.code')}: {cert.verificationCode.slice(0, 8)}...
                                    </p>
                                    <div className="flex items-center gap-2">
                                        <Link
                                            href={`/dashboard/certificates/${cert.id}`}
                                            className="inline-flex items-center gap-2 bg-white/5 border border-white/10 text-white text-sm font-bold px-4 py-2.5 rounded-xl hover:bg-white/10 transition"
                                        >
                                            <ExternalLink size={16} /> {t('certificates.view')}
                                        </Link>
                                        <Link
                                            href={`/certificate/${cert.id}`}
                                            target="_blank"
                                            className="inline-flex items-center gap-2 bg-white/5 border border-white/10 text-gray-400 text-sm font-bold px-4 py-2.5 rounded-xl hover:bg-white/10 hover:text-white transition"
                                        >
                                            <Download size={16} /> {t('certificates.download')}
                                        </Link>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </ProtectedRoute>
    );
}
