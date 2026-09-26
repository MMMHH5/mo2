"use client";

import ProtectedRoute from '@/components/ProtectedRoute';
import { useFetchData } from '@/lib/useFetchData';
import { useI18n } from '@/lib/i18n-context';
import { useAuth } from '@/lib/auth-context';
import Link from 'next/link';
import {
    UserRound, Mail, ShieldCheck, Calendar, Phone, MapPin, GraduationCap, Award,
    BookOpen, FileText, BadgeCheck, Info, ClipboardList, ExternalLink, CheckCircle2,
} from 'lucide-react';

interface MyProfile {
    id: string;
    email: string;
    role: string;
    isActive: boolean;
    metadata?: Record<string, unknown> | null;
    createdAt: string;
}

interface Enrollment {
    id: string;
    status: string;
    createdAt: string;
    course: {
        id: string;
        titleAr?: string | null;
        titleEn?: string | null;
    };
    opening?: {
        id?: string;
        nameAr?: string | null;
        nameEn?: string | null;
        startDate?: string | null;
        endDate?: string | null;
    } | null;
}

interface Certificate {
    id: string;
    verificationCode: string;
    issuingDate: string;
    verificationStatus: string;
    course?: { id: string; titleAr?: string | null; titleEn?: string | null } | null;
}

interface GradeRow {
    id: string;
    score: number;
    assessment: { id: string; nameAr: string; nameEn: string; maxScore: number };
}

interface GradedEnrollment {
    course: { id: string };
    grades: GradeRow[];
    assessments: { id: string; nameAr: string; nameEn: string; maxScore: number }[];
}

export default function DetailsPage() {
    const { user } = useAuth();
    const { t, pick } = useI18n();

    const { data: profile, loading } = useFetchData<MyProfile>('/users/me');
    const { data: enrollments, loading: enrollmentsLoading } = useFetchData<Enrollment[]>('/enrollments/my');
    const { data: gradesData } = useFetchData<GradedEnrollment[]>('/enrollments/my/grades');
    const { data: certificates } = useFetchData<Certificate[]>('/certificates/my');

    const meta = profile?.metadata ?? {};
    const fullName =
        (meta.fullName as string) ||
        user?.email?.split('@')[0] ||
        profile?.email || '';
    const initials = fullName.split(/\s+/).map(p => p[0]).slice(0, 2).join('').toUpperCase();
    const roleLabel = t('roles.' + (profile?.role || '').toLowerCase()) || profile?.role || '';
    const studyStatus = (meta.studyStatus as string) || '';

    const statusLabel = (status: string) => t('statuses.' + (status || '').toLowerCase()) || status;

    const gradeByCourse = new Map<string, GradeRow[]>();
    const assessmentsByCourse = new Map<string, GradeRow['assessment'][]>();
    (gradesData || []).forEach(g => {
        gradeByCourse.set(g.course.id, g.grades || []);
        assessmentsByCourse.set(g.course.id, g.assessments || []);
    });
    const courseAverage = (courseId: string): number | null => {
        const grades = gradeByCourse.get(courseId) || [];
        if (!grades.length) return null;
        return Math.round((grades.reduce((s, g) => s + g.score, 0) / grades.length) * 10) / 10;
    };

    const infoRows: { icon: typeof Mail; label: string; value: string }[] = [
        { icon: Mail, label: t('profile.email'), value: profile?.email || '' },
        { icon: ShieldCheck, label: t('profile.role'), value: roleLabel },
        { icon: BadgeCheck, label: t('profile.account_status'), value: profile?.isActive === false ? t('profile.suspended') : t('profile.active') },
        { icon: Calendar, label: t('profile.member_since'), value: profile ? new Date(profile.createdAt).toLocaleDateString() : '' },
        { icon: Phone, label: t('profile.phone'), value: (meta.phone as string) || '—' },
        { icon: MapPin, label: t('profile.city'), value: (meta.city as string) || '—' },
        { icon: GraduationCap, label: t('details.specialty'), value: (meta.specialty as string) || '—' },
        { icon: BookOpen, label: t('details.title'), value: (meta.title as string) || '—' },
        { icon: FileText, label: t('details.study_status'), value: studyStatus ? t('details.status_' + studyStatus.toLowerCase()) : '—' },
        { icon: ClipboardList, label: t('details.study_level'), value: (meta.studyLevel as string) || '—' },
    ];

    return (
        <ProtectedRoute>
            <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">
                {/* Header card */}
                <div className="relative overflow-hidden bg-gradient-to-br from-brand-navy via-[#0e2a52] to-[#0a1e3c] rounded-3xl p-4 sm:p-6 lg:p-8 text-white shadow-lg shadow-brand-navy/20">
                    <div className="absolute -top-16 -right-16 w-64 h-64 bg-brand-gold/20 rounded-full blur-3xl" />
                    <div className="absolute -bottom-20 -left-10 w-72 h-72 bg-brand-gold/10 rounded-full blur-3xl" />
                    <div className="absolute inset-0 opacity-[0.06]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, #fff 1px, transparent 0)', backgroundSize: '22px 22px' }} />
                    <div className="relative flex items-center gap-6 flex-wrap">
                        <div className="relative shrink-0">
                            <div className="w-24 h-24 lg:w-28 lg:h-28 rounded-3xl bg-gradient-to-br from-brand-gold to-brand-gold/50 flex items-center justify-center shadow-lg shadow-brand-gold/30 ring-4 ring-white/15">
                                <span className="text-3xl lg:text-4xl font-black text-brand-navy">{initials || <UserRound size={44} />}</span>
                            </div>
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3 flex-wrap">
                                <h1 className="text-3xl lg:text-4xl font-black tracking-tight" dir="auto">{fullName}</h1>
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-brand-mist/90 text-xs font-black">
                                    <Info size={13} /> {t('details.heading')}
                                </span>
                            </div>
                            <p className="text-brand-mist/90 mt-1.5 font-semibold truncate" dir="ltr">{profile?.email}</p>
                            <div className="flex flex-wrap gap-2 mt-4">
                                <span className="px-3.5 py-1.5 rounded-full bg-brand-gold text-brand-navy text-xs font-black shadow-sm shadow-brand-gold/30">{roleLabel}</span>
                                <span className="px-3.5 py-1.5 rounded-full bg-white/10 text-brand-mist/80 text-xs font-semibold backdrop-blur">
                                    {t('profile.since')} {profile ? new Date(profile.createdAt).toLocaleDateString() : ''}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {loading && (
                    <div className="bg-white dark:bg-brand-navy-dark border border-gray-200 dark:border-white/5 p-16 rounded-3xl flex flex-col items-center gap-3 font-bold text-gray-500 dark:text-gray-400">
                        <div className="w-12 h-12 rounded-full border-4 border-gray-200 dark:border-white/10 border-t-brand-gold animate-spin" />
                        {t('profile.loading')}
                    </div>
                )}

                {/* Personal details */}
                <div className="bg-white dark:bg-brand-navy-dark border border-gray-200 dark:border-white/5 rounded-3xl shadow-sm p-6 lg:p-7">
                    <div className="flex items-center gap-2.5 mb-6 pb-5 border-b border-gray-200 dark:border-white/5">
                        <div className="w-10 h-10 rounded-xl bg-brand-gold/10 flex items-center justify-center text-brand-gold-dark dark:text-brand-gold-light">
                            <UserRound size={20} />
                        </div>
                        <h3 className="text-xl font-black text-brand-navy dark:text-white">{t('details.personal_info')}</h3>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1">
                        {infoRows.map((row) => (
                            <div key={row.label} className="flex items-center gap-4 py-2.5">
                                <div className="w-10 h-10 rounded-xl bg-brand-gold/10 flex items-center justify-center text-brand-gold-dark dark:text-brand-gold-light shrink-0">
                                    <row.icon size={18} />
                                </div>
                                <div className="min-w-0">
                                    <div className="text-xs font-bold text-gray-500 dark:text-gray-400 tracking-wide">{row.label}</div>
                                    <div className="font-bold text-brand-navy dark:text-white truncate" dir="auto">{row.value}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                    {(meta.bio as string) && (
                        <div className="mt-5 pt-5 border-t border-gray-200 dark:border-white/5">
                            <div className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-1.5">
                                <FileText size={14} /> {t('profile.bio')}
                            </div>
                            <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed" dir="auto">{meta.bio as string}</p>
                        </div>
                    )}
                </div>

                {/* Courses taken */}
                <div className="bg-white dark:bg-brand-navy-dark border border-gray-200 dark:border-white/5 rounded-3xl shadow-sm p-6 lg:p-7">
                    <div className="flex items-center gap-2.5 mb-6 pb-5 border-b border-gray-200 dark:border-white/5">
                        <div className="w-10 h-10 rounded-xl bg-brand-gold/10 flex items-center justify-center text-brand-gold-dark dark:text-brand-gold-light">
                            <BookOpen size={20} />
                        </div>
                        <h3 className="text-xl font-black text-brand-navy dark:text-white">{t('details.my_courses')}</h3>
                    </div>
                    {enrollmentsLoading ? (
                        <div className="text-center py-8 font-bold text-gray-500 dark:text-gray-400">{t('common.loading')}</div>
                    ) : (enrollments || []).length === 0 ? (
                        <div className="text-center py-12 text-gray-500 dark:text-gray-400 font-semibold text-lg border-2 border-dashed border-gray-300 dark:border-white/10 rounded-xl bg-gray-100/50 dark:bg-transparent">
                            {t('details.no_courses')}
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {enrollments!.map(en => {
                                const avg = courseAverage(en.course.id);
                                return (
                                    <Link
                                        key={en.id}
                                        href="/dashboard/my-courses"
                                        className="group flex items-center gap-4 p-4 rounded-2xl border border-gray-200 dark:border-white/5 hover:border-brand-gold/30 hover:shadow-md transition"
                                    >
                                        <div className="w-11 h-11 rounded-xl bg-brand-gold/10 flex items-center justify-center text-brand-gold-dark dark:text-brand-gold-light shrink-0">
                                            <BookOpen size={20} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="font-black text-brand-navy dark:text-white truncate" dir="auto">
                                                {en.course ? (en.course.titleAr || en.course.titleEn) : '—'}
                                            </div>
                                            <div className="text-xs font-bold text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-2 flex-wrap">
                                                <span className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-white/5">{statusLabel(en.status)}</span>
                                                {en.opening?.nameAr || en.opening?.nameEn ? (
                                                    <span>{en.opening?.nameAr || en.opening?.nameEn}</span>
                                                ) : null}
                                                {avg !== null && (
                                                    <span className="text-brand-gold-dark dark:text-brand-gold-light">
                                                        {t('details.average')}: {avg}/100
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <ExternalLink size={18} className="text-gray-400 group-hover:text-brand-gold shrink-0" />
                                    </Link>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Certificates */}
                <div className="bg-white dark:bg-brand-navy-dark border border-gray-200 dark:border-white/5 rounded-3xl shadow-sm p-6 lg:p-7">
                    <div className="flex items-center gap-2.5 mb-6 pb-5 border-b border-gray-200 dark:border-white/5">
                        <div className="w-10 h-10 rounded-xl bg-brand-gold/10 flex items-center justify-center text-brand-gold-dark dark:text-brand-gold-light">
                            <Award size={20} />
                        </div>
                        <h3 className="text-xl font-black text-brand-navy dark:text-white">{t('details.certificates')}</h3>
                    </div>
                    {(certificates || []).length === 0 ? (
                        <div className="text-center py-8 text-gray-500 dark:text-gray-400 font-semibold border-2 border-dashed border-gray-300 dark:border-white/10 rounded-xl bg-gray-100/50 dark:bg-transparent">
                            {t('details.no_certificates')}
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {certificates!.map(cert => (
                                <Link
                                    key={cert.id}
                                    href={`/dashboard/certificates/${cert.id}`}
                                    className="group flex items-start gap-4 p-4 rounded-2xl border border-gray-200 dark:border-white/5 hover:border-brand-gold/30 hover:shadow-md transition"
                                >
                                    <div className="w-11 h-11 rounded-xl bg-brand-gold/10 flex items-center justify-center text-brand-gold-dark dark:text-brand-gold-light shrink-0">
                                        <Award size={20} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="font-black text-brand-navy dark:text-white line-clamp-2" dir="auto">
                                            {cert.course ? pick(cert.course, 'title') : t('certificates.unknown_course')}
                                        </div>
                                        <div className="text-xs font-bold text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-1.5">
                                            <CheckCircle2 size={13} className={cert.verificationStatus === 'VALID' ? 'text-emerald-500' : 'text-gray-400'} />
                                            {new Date(cert.issuingDate).toLocaleDateString()}
                                        </div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </ProtectedRoute>
    );
}