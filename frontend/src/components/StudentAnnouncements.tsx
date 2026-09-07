"use client";

import { useEffect, useState } from 'react';
import { api, getErrorMessage } from '@/lib/api';
import { useI18n } from '@/lib/i18n-context';
import { useFetchData } from '@/lib/useFetchData';
import { Megaphone, Calendar, User, BookOpen, Loader, Bell } from 'lucide-react';
import { EmptyPanel } from '@/app/dashboard/admin/components';

interface Enrollment {
    id: string;
    status: string;
    course: { id: string; titleAr?: string | null; titleEn?: string | null };
    opening?: { id: string; nameAr?: string | null; nameEn?: string | null } | null;
}

interface Announcement {
    id: string;
    titleAr: string;
    titleEn: string;
    contentAr: string;
    contentEn: string;
    isPublished: boolean;
    createdAt: string;
    author?: { id: string; email: string } | null;
    openingName?: string | null;
}

export default function StudentAnnouncements() {
    const { t, pick, locale } = useI18n();
    const isAr = locale === 'ar';

    const { data: enrollments } = useFetchData<Enrollment[]>('/enrollments/my');
    const [announcements, setAnnouncements] = useState<Announcement[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let active = true;
        (async () => {
            setLoading(true);
            try {
                const approved = (enrollments || []).filter(e => e.status === 'APPROVED' && e.opening?.id);
                if (approved.length === 0) {
                    if (active) setAnnouncements([]);
                    return;
                }
                const results = await Promise.all(
                    approved.map(async (e) => {
                        try {
                            const res = await api.get(`/announcements/opening/${e.opening!.id}`);
                            return (res.data || []).map((a: Announcement) => ({
                                ...a,
                                openingName: pick(e.opening, 'name') || pick(e.course, 'title'),
                            }));
                        } catch {
                            return [];
                        }
                    })
                );
                if (active) {
                    const flat = results.flat().sort(
                        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                    );
                    setAnnouncements(flat);
                }
            } catch {
                if (active) setAnnouncements([]);
            } finally {
                if (active) setLoading(false);
            }
        })();
        return () => { active = false; };
    }, [enrollments]);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader size={24} className="animate-spin text-amber-400" />
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                    <Bell size={20} className="text-amber-400" />
                </div>
                <div>
                    <h3 className="text-xl font-black text-white">{t('announcements.title')}</h3>
                    <p className="text-gray-400 text-sm">{isAr ? 'آخر الإعلانات من دوراتك' : 'Latest announcements from your courses'}</p>
                </div>
            </div>

            {announcements.length === 0 ? (
                <div className="bg-[#111f3a] border border-white/5 rounded-2xl p-8">
                    <EmptyPanel icon={Megaphone} title={isAr ? 'لا توجد إعلانات' : 'No announcements yet'} />
                </div>
            ) : (
                <div className="space-y-3">
                    {announcements.map((a) => (
                        <div
                            key={a.id}
                            className="bg-[#111f3a] border border-white/5 rounded-2xl p-5 hover:border-amber-500/20 transition-all duration-200"
                        >
                            <div className="flex items-start gap-3">
                                <div className="shrink-0 w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center mt-0.5">
                                    <Megaphone size={18} className="text-amber-400" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h4 className="text-white font-bold text-base mb-1">{isAr ? a.titleAr : a.titleEn}</h4>
                                    {a.openingName && (
                                        <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-2">
                                            <BookOpen size={11} />
                                            <span>{a.openingName}</span>
                                        </div>
                                    )}
                                    <p className="text-gray-300 text-sm leading-relaxed line-clamp-3 mb-3">
                                        {isAr ? a.contentAr : a.contentEn}
                                    </p>
                                    <div className="flex items-center gap-4 text-[10px] text-gray-500">
                                        <span className="flex items-center gap-1">
                                            <Calendar size={10} />
                                            {new Date(a.createdAt).toLocaleDateString(isAr ? 'ar-SA' : 'en-US', {
                                                year: 'numeric', month: 'short', day: 'numeric'
                                            })}
                                        </span>
                                        {a.author && (
                                            <span className="flex items-center gap-1">
                                                <User size={10} />
                                                {a.author.email}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
