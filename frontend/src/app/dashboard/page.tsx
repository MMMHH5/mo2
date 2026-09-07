"use client";

import { useAuth } from '@/lib/auth-context';
import { useFetchData } from '@/lib/useFetchData';
import { useI18n } from '@/lib/i18n-context';
import { Activity, BookOpen, Clock, Compass, GraduationCap, LifeBuoy } from 'lucide-react';
import Link from 'next/link';
import { StatCard } from '@/app/dashboard/admin/components';
import StudentAnnouncements from '@/components/StudentAnnouncements';
import GamificationPanel from '@/components/GamificationPanel';
import LearningAnalytics from '@/components/LearningAnalytics';
import LearningPathList from '@/components/LearningPathList';
import AnnouncementBanner from '@/components/AnnouncementBanner';

interface HealthResponse {
    status?: string;
}

export default function DashboardPage() {
    const { user } = useAuth();
    const { t } = useI18n();

    const canSeePending = user && (user.role === 'FINANCE' || user.role === 'ADMIN');
    const { data: coursesData, loading: coursesLoading, error: coursesError } = useFetchData<unknown[]>('/courses');
    const { data: pending, loading: pendingLoading } = useFetchData<unknown[]>(canSeePending ? '/enrollments/pending' : null);
    const { data: health } = useFetchData<HealthResponse>('/health');

    if (!user) return null;

    const roleLabel = t('roles.' + (user.role || '').toLowerCase()) || user.role;

    const metrics: { label: string; value: string | number; icon: typeof Activity; color: string }[] = [
        {
            label: t('dashboard.system_status'),
            value: health ? (health.status === 'ok' ? t('dashboard.online') : t('dashboard.offline')) : '...',
            icon: Activity,
            color: 'green',
        },
        {
            label: t('dashboard.platform_courses'),
            value: coursesLoading ? '...' : (coursesData ? coursesData.length : 0),
            icon: BookOpen,
            color: 'navy',
        },
    ];

    if (canSeePending) {
        metrics.push({
            label: t('dashboard.pending_review'),
            value: pendingLoading ? '...' : (pending ? pending.length : 0),
            icon: Clock,
            color: 'amber',
        });
    }

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            {/* Welcome Banner */}
            <div className="relative overflow-hidden bg-gradient-to-br from-[#0d1f3c] via-[#132a50] to-[#0d1f3c] rounded-3xl p-8 lg:p-10 text-white shadow-lg shadow-black/20 animate-fade-in">
                <div className="absolute -top-16 -right-16 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl" />
                <div className="absolute -bottom-20 -left-10 w-72 h-72 bg-amber-500/5 rounded-full blur-3xl" />
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-amber-500/40 to-transparent" />
                <div className="relative">
                    <h1 className="text-3xl lg:text-4xl font-black tracking-tight">
                        {t('dashboard.welcome_back')}, {user.email}
                    </h1>
                    <p className="text-gray-400 mt-2 font-semibold">
                        {t('dashboard.secure_login')}{' '}
                        <span className="font-black text-amber-400">{roleLabel}</span>{' '}
                        {t('dashboard.permissions')}
                    </p>
                </div>
            </div>

            {/* Announcement Banner — full width */}
            <div className="mx-[calc(50%-50vw)] w-screen">
                <AnnouncementBanner variant="dashboard" />
            </div>

            {/* Metrics Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-fade-in-up">
                {metrics.map((m) => (
                    <StatCard key={m.label} icon={m.icon} color={m.color} value={m.value} label={m.label} accent />
                ))}
            </div>

            {/* Error or Dashboard specific elements */}
            {coursesError && (
                <div className="p-4 bg-red-500/10 text-red-400 rounded-xl border border-red-500/20 font-semibold">
                    {t('dashboard.failed_metrics')} {coursesError}
                </div>
            )}

            {/* Quick Actions (students) */}
            {user.role === 'STUDENT' && (
                <div className="animate-fade-in-up">
                    <h3 className="text-xl font-black text-white mb-4">{t('dashboard.quick_actions')}</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <Link href="/dashboard/explore" className="group bg-[#111f3a] border border-white/5 rounded-2xl p-6 hover:border-amber-500/20 hover:shadow-xl hover:-translate-y-0.5 transition-all">
                            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                <Compass size={24} />
                            </div>
                            <div className="font-black text-white">{t('landing.explore_courses')}</div>
                            <div className="text-sm text-gray-400 mt-1">{t('dashboard.explore_desc')}</div>
                        </Link>
                        <Link href="/dashboard/my-courses" className="group bg-[#111f3a] border border-white/5 rounded-2xl p-6 hover:border-amber-500/20 hover:shadow-xl hover:-translate-y-0.5 transition-all">
                            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                <BookOpen size={24} />
                            </div>
                            <div className="font-black text-white">{t('sidebar.my_courses')}</div>
                            <div className="text-sm text-gray-400 mt-1">{t('dashboard.my_courses_desc')}</div>
                        </Link>
                        <Link href="/dashboard/my-grades" className="group bg-[#111f3a] border border-white/5 rounded-2xl p-6 hover:border-amber-500/20 hover:shadow-xl hover:-translate-y-0.5 transition-all">
                            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                <GraduationCap size={24} />
                            </div>
                            <div className="font-black text-white">{t('sidebar.my_grades')}</div>
                            <div className="text-sm text-gray-400 mt-1">{t('dashboard.my_grades_desc')}</div>
                        </Link>
                        <Link href="/dashboard/support" className="group bg-[#111f3a] border border-white/5 rounded-2xl p-6 hover:border-amber-500/20 hover:shadow-xl hover:-translate-y-0.5 transition-all">
                            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                <LifeBuoy size={24} />
                            </div>
                            <div className="font-black text-white">{t('sidebar.support')}</div>
                            <div className="text-sm text-gray-400 mt-1">{t('dashboard.support_desc')}</div>
                        </Link>
                    </div>
                </div>
            )}

            {/* Content Area */}
            <div className="space-y-6 animate-fade-in-up">
                {user.role === 'STUDENT' ? (
                    <>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <StudentAnnouncements />
                            <GamificationPanel />
                        </div>
                        <LearningAnalytics />
                        <LearningPathList mode="browse" />
                    </>
                ) : (
                    <div className="bg-[#111f3a] border border-white/5 rounded-3xl p-8 min-h-[400px]">
                        <h3 className="text-xl font-black text-white mb-6">{t('dashboard.recent_activity')}</h3>
                        <div className="flex items-center justify-center text-gray-400 h-64 border-2 border-dashed border-white/10 rounded-2xl bg-white/5 font-semibold">
                            {t('dashboard.detailed_metrics')}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
