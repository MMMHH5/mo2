"use client";

import ProtectedRoute from '@/components/ProtectedRoute';
import { useFetchData } from '@/lib/useFetchData';
import { useI18n } from '@/lib/i18n-context';
import { BookOpen, Clock, CheckCircle, XCircle, GraduationCap, Award } from 'lucide-react';
import Link from 'next/link';

interface Enrollment {
    id: string;
    status: string;
    createdAt: string;
    financeOfficerNotes?: string | null;
    course: {
        id: string;
        titleAr?: string | null;
        titleEn?: string | null;
        descriptionAr?: string | null;
        descriptionEn?: string | null;
    };
    opening?: {
        id?: string;
        status?: string | null;
        nameAr?: string | null;
        nameEn?: string | null;
        price: string;
        startDate?: string | null;
        endDate?: string | null;
    } | null;
}

interface GradeRow {
    id: string;
    score: number;
    assessment: { id: string; nameAr: string; nameEn: string; maxScore: number };
}

interface Assessment {
    id: string;
    nameAr: string;
    nameEn: string;
    maxScore: number;
}

interface GradedEnrollment {
    course: { id: string };
    opening?: { id: string } | null;
    grades: GradeRow[];
    assessments: Assessment[];
}

export default function MyCoursesPage() {
    const { data: enrollments, loading, error } = useFetchData<Enrollment[]>('/enrollments/my');
    const { data: gradesData } = useFetchData<GradedEnrollment[]>('/enrollments/my/grades');
    const { t, pick } = useI18n();

    const statusLabel = (status: string) => t('statuses.' + (status || '').toLowerCase()) || status;

    const isCompleted = (enrollment: Enrollment) =>
        enrollment.status === 'APPROVED' && enrollment.opening?.status === 'ENDED';

    const gradeByCourse = new Map<string, GradeRow[]>();
    const assessmentsByCourse = new Map<string, Assessment[]>();
    (gradesData || []).forEach(g => {
        gradeByCourse.set(g.course.id, g.grades || []);
        assessmentsByCourse.set(g.course.id, g.assessments || []);
    });

    const courseProgress = (courseId: string): number | null => {
        const total = assessmentsByCourse.get(courseId) || [];
        if (!total.length) return null;
        const done = (gradeByCourse.get(courseId) || []).length;
        return Math.min(100, Math.round((done / total.length) * 100));
    };

    const courseAvg = (courseId: string): number | null => {
        const rows = gradeByCourse.get(courseId) || [];
        if (!rows.length) return null;
        const pct = rows.reduce((sum, r) => sum + (r.assessment.maxScore > 0 ? (r.score / r.assessment.maxScore) * 100 : 0), 0) / rows.length;
        return Math.round(pct);
    };

    return (
        <ProtectedRoute allowedRoles={['STUDENT']}>
            <div className="bg-[#111f3a] p-8 rounded-3xl shadow-sm border border-white/5 min-h-[80vh]">
                <div className="mb-8">
                    <h2 className="text-3xl font-black text-white">{t('myCourses.heading')}</h2>
                    <p className="text-gray-400 mt-2">{t('myCourses.subtitle')}</p>
                </div>

                {error && <div className="p-4 bg-red-500/10 text-red-400 border border-red-500/20 rounded-xl mb-6">{error}</div>}

                {loading ? (
                    <div className="h-40 flex items-center justify-center font-bold text-gray-400">{t('myCourses.loading')}</div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {enrollments?.map((enrollment) => (
                            <div key={enrollment.id} className="relative bg-[#0d1f3c] border border-white/5 rounded-3xl p-6 shadow-sm hover:shadow-xl transition-all duration-300">
                                <div className="absolute -top-4 -right-4 w-24 h-24 bg-amber-500/10 rounded-full blur-xl -z-10"></div>

                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 bg-[#111f3a] rounded-2xl flex items-center justify-center text-amber-400 shadow-sm">
                                            <BookOpen size={24} />
                                        </div>
                                        <div className="text-xs text-gray-400 font-semibold max-w-[180px] truncate">
                                            {pick(enrollment.opening, 'name') && <span className="block text-white font-bold">{pick(enrollment.opening, 'name')}</span>}
                                            {enrollment.opening?.price != null && <span className="text-green-400 font-bold">${enrollment.opening.price}</span>}
                                        </div>
                                    </div>
                                    <span className={`px-3 py-1 text-xs font-bold rounded-full border ${
                                        isCompleted(enrollment) ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
                                        enrollment.status === 'APPROVED' ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                                            enrollment.status === 'REJECTED' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                                                enrollment.status === 'RESERVED' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                                                    'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
                                    }`}>
                                        {isCompleted(enrollment) && <Award size={12} className="inline mr-1" />}
                                        {!isCompleted(enrollment) && enrollment.status === 'APPROVED' && <CheckCircle size={12} className="inline mr-1" />}
                                        {enrollment.status === 'REJECTED' && <XCircle size={12} className="inline mr-1" />}
                                        {enrollment.status === 'PENDING' && <Clock size={12} className="inline mr-1" />}
                                        {enrollment.status === 'RESERVED' && <Clock size={12} className="inline mr-1" />}
                                        {isCompleted(enrollment) ? t('statuses.completed') : statusLabel(enrollment.status)}
                                    </span>
                                </div>

                                <h3 className="text-xl font-bold text-white mb-2 line-clamp-2">
                                    <Link href={`/courses/${enrollment.course.id}`} className="hover:text-amber-400 transition-colors">
                                        {pick(enrollment.course, 'title')}
                                    </Link>
                                </h3>
                                <p className="text-sm text-gray-400 line-clamp-3 mb-6">
                                    {pick(enrollment.course, 'description') || t('myCourses.no_description')}
                                </p>

                                <div className="pt-4 border-t border-white/5">
                                    {enrollment.status === 'APPROVED' && courseProgress(enrollment.course.id) != null && (
                                        <div className="mb-3">
                                            <div className="flex items-center justify-between text-xs font-bold mb-1.5">
                                                <span className="text-gray-400 flex items-center gap-1.5">
                                                    <GraduationCap size={14} className="text-amber-400" /> {t('myCourses.progress')}
                                                </span>
                                                <span className="text-amber-400 font-black">{courseProgress(enrollment.course.id)}%</span>
                                            </div>
                                            <div className="h-2.5 bg-white/5 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-full transition-all duration-500"
                                                    style={{ width: `${courseProgress(enrollment.course.id)}%` }}
                                                />
                                            </div>
                                        </div>
                                    )}
                                    {enrollment.status === 'APPROVED' && courseAvg(enrollment.course.id) != null && (
                                        <div className="mb-3 flex items-center justify-between bg-white/5 rounded-xl px-4 py-2.5">
                                            <span className="text-xs font-bold text-gray-400 flex items-center gap-1.5">
                                                <GraduationCap size={14} className="text-amber-400" /> {t('myCourses.average_score')}
                                            </span>
                                            <span className="text-sm font-black text-amber-400">{courseAvg(enrollment.course.id)}%</span>
                                        </div>
                                    )}
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="text-xs text-gray-500 font-semibold">
                                            {t('myCourses.enrolled_on')} {new Date(enrollment.createdAt).toLocaleDateString()}
                                        </div>
                                        {isCompleted(enrollment) ? (
                                            <div className="flex items-center gap-2">
                                                <Link href="/dashboard/my-grades" className="text-sm font-bold px-4 py-2 rounded-xl border border-white/10 text-white hover:border-purple-500 hover:text-purple-400 transition whitespace-nowrap">
                                                    {t('myCourses.view_grades')}
                                                </Link>
                                                <Link href={`/dashboard/certificates?courseId=${enrollment.course.id}`} className="bg-gradient-to-r from-purple-500 to-purple-600 text-white text-sm font-bold px-4 py-2 rounded-xl hover:from-purple-400 hover:to-purple-500 transition whitespace-nowrap flex items-center gap-1.5">
                                                    <Award size={14} /> {t('myCourses.view_certificate')}
                                                </Link>
                                            </div>
                                        ) : enrollment.status === 'APPROVED' ? (
                                            <div className="flex items-center gap-2">
                                                <Link href="/dashboard/my-grades" className="text-sm font-bold px-4 py-2 rounded-xl border border-white/10 text-white hover:border-amber-500 hover:text-amber-400 transition whitespace-nowrap">
                                                    {t('myCourses.view_grades')}
                                                </Link>
                                                <Link href={`/dashboard/courses/${enrollment.course.id}/player`} className="bg-gradient-to-r from-amber-500 to-amber-600 text-black text-sm font-bold px-4 py-2 rounded-xl hover:from-amber-400 hover:to-amber-500 transition whitespace-nowrap">
                                                    {t('myCourses.continue')}
                                                </Link>
                                            </div>
                                        ) : (
                                            <span className="text-xs font-semibold text-gray-500">{t('myCourses.locked')}</span>
                                        )}
                                    </div>
                                </div>
                                {enrollment.status === 'REJECTED' && enrollment.financeOfficerNotes && (
                                    <div className="mt-4 p-3 bg-red-500/10 rounded-xl text-xs text-red-400 border border-red-500/20">
                                        <strong>{t('myCourses.finance_note')}</strong> {enrollment.financeOfficerNotes}
                                    </div>
                                )}
                            </div>
                        ))}
                        {enrollments?.length === 0 && (
                            <div className="col-span-full text-center py-16 text-gray-400 font-semibold text-lg border-2 border-dashed border-white/10 rounded-xl">
                                {t('myCourses.empty_title')}
                                <div className="mt-4">
                                    <Link href="/courses" className="text-amber-400 hover:underline">{t('landing.explore_courses')}</Link>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </ProtectedRoute>
    );
}
