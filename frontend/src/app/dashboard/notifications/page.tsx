"use client";

import { useEffect, useState } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { api, getErrorMessage } from '@/lib/api';
import { useI18n } from '@/lib/i18n-context';
import toast from 'react-hot-toast';
import { Bell, Loader, CheckCheck, Inbox } from 'lucide-react';

interface NotificationItem {
    id: string;
    type: string;
    titleAr?: string | null;
    titleEn?: string | null;
    bodyAr?: string | null;
    bodyEn?: string | null;
    data?: Record<string, unknown> | null;
    createdAt: string;
    readAt?: string | null;
}

export default function NotificationsPage() {
    const { t, locale } = useI18n();
    const [items, setItems] = useState<NotificationItem[] | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let active = true;
        (async () => {
            try {
                const res = await api.get('/notifications');
                if (active) setItems(res.data || []);
            } catch {
                if (active) setItems([]);
            } finally {
                if (active) setLoading(false);
            }
        })();
        return () => { active = false; };
    }, []);

    const title = (n: NotificationItem) =>
        locale === 'ar' ? (n.titleAr || n.titleEn || '') : (n.titleEn || n.titleAr || '');
    const body = (n: NotificationItem) =>
        locale === 'ar' ? (n.bodyAr || n.bodyEn || '') : (n.bodyEn || n.bodyAr || '');

    const markRead = async (id: string) => {
        try {
            await api.patch(`/notifications/${id}/read`);
            setItems(prev => (prev || []).map(n => n.id === id ? { ...n, readAt: new Date().toISOString() } : n));
        } catch (e) {
            toast.error(getErrorMessage(e) || t('notifications.fail'));
        }
    };

    const markAllRead = async () => {
        try {
            await api.patch('/notifications/read-all');
            setItems(prev => (prev || []).map(n => n.readAt ? n : { ...n, readAt: new Date().toISOString() }));
        } catch (e) {
            toast.error(getErrorMessage(e) || t('notifications.fail'));
        }
    };

    const unreadCount = (items || []).filter(n => !n.readAt).length;

    return (
        <ProtectedRoute allowedRoles={['STUDENT', 'INSTRUCTOR', 'COURSE_MANAGER', 'FINANCE', 'ADMIN']}>
            <div className="bg-[#111f3a] p-8 rounded-3xl shadow-sm border border-white/5 min-h-[80vh]">
                <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
                    <div>
                        <h2 className="text-3xl font-black text-white flex items-center gap-3">
                            <Bell size={32} className="text-amber-400" /> {t('notifications.heading')}
                        </h2>
                        <p className="text-gray-400 mt-2">{t('notifications.subtitle')}</p>
                    </div>
                    {unreadCount > 0 && (
                        <button onClick={markAllRead} className="inline-flex items-center gap-2 text-sm font-bold text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 px-4 py-2.5 rounded-xl transition">
                            <CheckCheck size={16} /> {t('notifications.mark_all')}
                        </button>
                    )}
                </div>

                {loading ? (
                    <div className="h-40 flex items-center justify-center font-bold text-gray-400">
                        <Loader className="animate-spin text-amber-400" size={32} />
                    </div>
                ) : !items || items.length === 0 ? (
                    <div className="h-56 flex flex-col items-center justify-center text-center text-gray-400">
                        <Inbox size={44} className="mb-3 text-gray-500" />
                        <p className="font-bold">{t('notifications.empty')}</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {items.map(n => (
                            <button
                                key={n.id}
                                onClick={() => !n.readAt && markRead(n.id)}
                                className={`w-full text-left p-5 rounded-2xl border transition ${
                                    n.readAt
                                        ? 'bg-[#0d1f3c] border-white/5 opacity-75'
                                        : 'bg-amber-500/5 border-amber-500/20 hover:border-amber-500/40'
                                }`}
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-[11px] font-black uppercase tracking-wider text-gray-400 bg-white/5 px-2.5 py-0.5 rounded-full">
                                            {n.type}
                                        </span>
                                        {!n.readAt && <span className="w-2 h-2 rounded-full bg-amber-400" />}
                                    </div>
                                    <span className="text-[11px] text-gray-500 font-semibold shrink-0">
                                        {new Date(n.createdAt).toLocaleString()}
                                    </span>
                                </div>
                                <h3 className="font-bold text-white mt-2">{title(n)}</h3>
                                {body(n) && <p className="text-sm text-gray-300 mt-1 leading-relaxed">{body(n)}</p>}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </ProtectedRoute>
    );
}
