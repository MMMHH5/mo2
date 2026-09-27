"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useI18n } from '@/lib/i18n-context';
import { useTheme } from '@/lib/theme-context';
import { api } from '@/lib/api';
import { buildNavLinks } from '@/lib/nav-links';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import ThemeToggle from '@/components/ThemeToggle';
import { LogOut } from 'lucide-react';

export default function Sidebar() {
    const pathname = usePathname();
    const { user, logout } = useAuth();
    const { t } = useI18n();
    const { dark } = useTheme();
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

    const roleKey = (user.role || '').toUpperCase();
    const allNav = buildNavLinks(t);
    const roleLinks = allNav.filter(link => link.roles.some(r => r.toUpperCase() === roleKey));
    const links = roleLinks.length > 0
        ? roleLinks
        : allNav.filter(link => ['/dashboard', '/dashboard/profile', '/dashboard/support'].includes(link.href));

    return (
        <aside className={`w-64 shrink-0 h-screen flex flex-col justify-between hidden lg:flex sticky top-0 ${dark ? 'bg-gradient-to-b from-brand-navy via-[#0e2a52] to-[#0a1e3c]' : 'bg-white border-r border-gray-200 shadow-sm'}`}>
            <div>
                <div className={`p-5 border-b ${dark ? 'border-white/10' : 'border-gray-200'}`}>
                    <div className="flex flex-col gap-2">
                        <img
                            src={dark ? '/logos/LaxaLab_Academy_Horizontal_Reverse_4K.png' : '/logos/LaxaLab_Academy_Horizontal_Primary_4K.png'}
                            alt="Laxalab Academy"
                            className="h-10 w-auto object-contain mx-auto"
                        />
                        <span className={`text-[10px] text-center font-black uppercase tracking-[0.2em] ${dark ? 'text-brand-mist/50' : 'text-brand-charcoal/50'}`}>
                            {t('roles.' + user.role.toLowerCase())}
                        </span>
                    </div>
                </div>

                <nav className="p-4 space-y-2">
                    {links.map((link) => {
                        const isActive = pathname.startsWith(link.href) && link.href !== '/dashboard' || pathname === link.href;
                        const Icon = link.icon;
                        return (
                            <Link key={link.href} href={link.href}>
                                <div className={`group relative flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-bold transition-all duration-200 ${isActive
                                        ? dark ? 'bg-gradient-to-r from-brand-gold/20 to-transparent text-brand-gold shadow-inner' : 'bg-brand-gold/10 text-brand-gold-dark shadow-inner'
                                        : dark ? 'text-brand-mist/70 hover:bg-white/10 hover:text-white' : 'text-brand-charcoal/70 hover:bg-brand-mist/60 hover:text-brand-navy'
                                    }`}>
                                    {isActive && <span className={`absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full ${dark ? 'bg-brand-gold' : 'bg-brand-gold'}`} />}
                                    <Icon size={19} className={`transition-colors ${isActive ? 'text-brand-gold' : dark ? 'text-brand-mist/50 group-hover:text-brand-mist' : 'text-brand-charcoal/50 group-hover:text-brand-navy'}`} />
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

            <div className={`p-4 border-t space-y-4 ${dark ? 'border-white/10' : 'border-gray-200'}`}>
                <LanguageSwitcher />
                <ThemeToggle />
                <button
                    onClick={logout}
                    className={`flex items-center gap-3 w-full px-3.5 py-3 rounded-xl transition-colors font-bold ${dark ? 'text-red-300 hover:bg-red-500/10' : 'text-red-600 hover:bg-red-50'}`}
                >
                    <LogOut size={19} className="rtl:rotate-180" />
                    <span>{t('sidebar.logout')}</span>
                </button>
            </div>
        </aside>
    );
}