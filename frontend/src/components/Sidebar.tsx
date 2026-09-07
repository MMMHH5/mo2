"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useI18n } from '@/lib/i18n-context';
import { api } from '@/lib/api';
import { buildNavLinks } from '@/lib/nav-links';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { LogOut } from 'lucide-react';

export default function Sidebar() {
    const pathname = usePathname();
    const { user, logout } = useAuth();
    const { t } = useI18n();
    const [unread, setUnread] = useState(0);
    const [notificationsUnread, setNotificationsUnread] = useState(0);

    useEffect(() => {
        if (!user) return;
        let active = true;
        const load = async () => {
            try {
                const [msgRes, notifRes] = await Promise.all([
                    api.get('/messages/unread-count'),
                    api.get('/notifications/unread-count'),
                ]);
                if (active) {
                    setUnread(msgRes.data?.count ?? 0);
                    setNotificationsUnread(notifRes.data?.count ?? 0);
                }
            } catch {
                /* silent */
            }
        };
        load();
        const timer = setInterval(load, 15000);
        return () => { active = false; clearInterval(timer); };
    }, [user]);

    if (!user) return null;

    const links = buildNavLinks(t).filter(link => link.roles.includes(user.role));

    return (
        <aside className="w-64 shrink-0 bg-gradient-to-b from-brand-navy via-[#0e2a52] to-[#0a1e3c] h-screen flex flex-col justify-between hidden md:flex sticky top-0">
            <div>
                <div className="p-5 border-b border-white/10">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                            <span className="text-brand-gold font-black text-xl">L</span>
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-white tracking-tight leading-none">
                                laxa<span className="text-brand-gold">lab</span>
                            </h2>
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-mist/50">
                                {t('roles.' + user.role.toLowerCase())}
                            </span>
                        </div>
                    </div>
                </div>

                <nav className="p-4 space-y-2">
                    {links.map((link) => {
                        const isActive = pathname.startsWith(link.href) && link.href !== '/dashboard' || pathname === link.href;
                        const Icon = link.icon;
                        return (
                            <Link key={link.href} href={link.href}>
                                <div className={`group relative flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-bold transition-all duration-200 ${
                                    isActive
                                        ? 'bg-gradient-to-r from-brand-gold/20 to-transparent text-brand-gold shadow-inner'
                                        : 'text-brand-mist/70 hover:bg-white/10 hover:text-white'
                                }`}>
                                    {isActive && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full bg-brand-gold" />}
                                    <Icon size={19} className={`transition-colors ${isActive ? 'text-brand-gold' : 'text-brand-mist/50 group-hover:text-brand-mist'}`} />
                                    <span>{link.name}</span>
                                    {link.href === '/dashboard/inbox' && unread > 0 && (
                                        <span className="ml-auto bg-brand-gold text-white text-[10px] font-black rounded-full min-w-5 h-5 px-1.5 inline-flex items-center justify-center">
                                            {unread}
                                        </span>
                                    )}
                                    {link.href === '/dashboard/notifications' && notificationsUnread > 0 && (
                                        <span className="ml-auto bg-brand-gold text-white text-[10px] font-black rounded-full min-w-5 h-5 px-1.5 inline-flex items-center justify-center">
                                            {notificationsUnread}
                                        </span>
                                    )}
                                </div>
                            </Link>
                        );
                    })}
                </nav>
            </div>

            <div className="p-4 border-t border-white/10 space-y-4">
                <LanguageSwitcher dark />
                <button
                    onClick={logout}
                    className="flex items-center gap-3 text-red-300 hover:bg-red-500/10 w-full px-3.5 py-3 rounded-xl transition-colors font-bold"
                >
                    <LogOut size={19} className="rtl:rotate-180" />
                    <span>{t('sidebar.logout')}</span>
                </button>
            </div>
        </aside>
    );
}