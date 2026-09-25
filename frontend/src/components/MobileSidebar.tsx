"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Menu, X, LogOut } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useI18n } from '@/lib/i18n-context';
import { useTheme } from '@/lib/theme-context';
import { buildNavLinks } from '@/lib/nav-links';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import ThemeToggle from '@/components/ThemeToggle';
import { createPortal } from 'react-dom';
import { CalendarClock, Users as UsersIcon, Newspaper, CreditCard, Settings, LifeBuoy, CalendarPlus, MessageCircle, Megaphone } from 'lucide-react';

const ADMIN_EXTRA_LINKS = [
    { href: '/dashboard/admin/openings', icon: CalendarClock },
    { href: '/dashboard/admin/users', icon: UsersIcon },
    { href: '/dashboard/admin/blog', icon: Newspaper },
    { href: '/dashboard/admin/gateways', icon: CreditCard },
    { href: '/dashboard/admin/system', icon: Settings },
    { href: '/dashboard/admin/tickets', icon: LifeBuoy },
    { href: '/dashboard/admin/requests', icon: CalendarPlus },
    { href: '/dashboard/admin/chats', icon: MessageCircle },
    { href: '/dashboard/admin/announcements', icon: Megaphone },
] as const;

export default function MobileSidebar() {
    const { user, logout } = useAuth();
    const { t } = useI18n();
    const { dark } = useTheme();
    const pathname = usePathname();
    const [open, setOpen] = useState(false);

    if (!user) return null;

    const roleKey = (user.role || '').toUpperCase();
    const roleLinks = buildNavLinks(t).filter(link => link.roles.some(r => r.toUpperCase() === roleKey));
    const links = roleLinks.length > 0 ? roleLinks : buildNavLinks(t);
    const adminLinks = pathname?.startsWith('/dashboard/admin') ? ADMIN_EXTRA_LINKS.map(l => ({ ...l, name: t('admin.nav_' + l.href.split('/').pop()) })) : [];

    return (
        <>
            <button
                onClick={() => setOpen(true)}
                className={`lg:hidden p-2 text-brand-navy dark:text-brand-mist hover:bg-brand-mist dark:hover:bg-white/10 rounded-xl transition ${dark ? 'text-brand-mist' : 'text-brand-navy'}`}
                aria-label="Menu"
            >
                <Menu size={24} />
            </button>

            {open && createPortal(
                <div className="fixed inset-0 z-50 lg:hidden">
                    <div className="fixed inset-0 bg-black/50" onClick={() => setOpen(false)} />
                    <div className={`fixed top-0 bottom-0 start-0 w-[85%] max-w-xs overflow-y-auto shadow-2xl ${dark ? 'bg-brand-navy-dark text-white' : 'bg-white text-brand-navy'}`}>
                        <div className={`flex items-center justify-between p-5 border-b ${dark ? 'border-white/10' : 'border-gray-200'}`}>
                            <div className="flex items-center gap-3">
                                <img
                                    src={dark ? '/logos/LaxaLab_Academy_Horizontal_Reverse_4K.png' : '/logos/LaxaLab_Academy_Horizontal_Primary_4K.png'}
                                    alt="Laxalab Academy"
                                    className="h-8 w-auto object-contain"
                                />
                            </div>
                            <button onClick={() => setOpen(false)} className={`transition ${dark ? 'text-white/70 hover:text-white' : 'text-brand-charcoal/60 hover:text-brand-navy'}`} aria-label="Close">
                                <X size={24} />
                            </button>
                        </div>

                        <div className="p-4 space-y-2">
                            {links.map((link) => {
                                const isActive = (pathname.startsWith(link.href) && link.href !== '/dashboard') || pathname === link.href;
                                const Icon = link.icon;
                                return (
                                    <Link key={link.href} href={link.href} onClick={() => setOpen(false)}>
                                        <div className={`flex items-center gap-3 px-3.5 py-3 rounded-xl font-bold transition-colors ${isActive
                                                ? dark ? 'bg-brand-gold/20 text-brand-gold' : 'bg-brand-gold/10 text-brand-gold-dark'
                                                : dark ? 'text-brand-mist/70 hover:bg-white/10 hover:text-white' : 'text-brand-charcoal/70 hover:bg-brand-mist/60 hover:text-brand-navy'
                                            }`}>
                                            <Icon size={19} />
                                            <span>{link.name}</span>
                                        </div>
                                    </Link>
                                );
                            })}
                            {adminLinks.map((link) => {
                                const isActive = pathname.startsWith(link.href);
                                const Icon = link.icon;
                                return (
                                    <Link key={link.href} href={link.href} onClick={() => setOpen(false)}>
                                        <div className={`flex items-center gap-3 px-3.5 py-3 rounded-xl font-bold transition-colors ${isActive
                                                ? dark ? 'bg-brand-gold/20 text-brand-gold' : 'bg-brand-gold/10 text-brand-gold-dark'
                                                : dark ? 'text-brand-mist/70 hover:bg-white/10 hover:text-white' : 'text-brand-charcoal/70 hover:bg-brand-mist/60 hover:text-brand-navy'
                                            }`}>
                                            <Icon size={19} />
                                            <span>{link.name}</span>
                                        </div>
                                    </Link>
                                );
                            })}
                        </div>

                        <div className={`p-4 border-t space-y-4 ${dark ? 'border-white/10' : 'border-gray-200'}`}>
                            <LanguageSwitcher />
                            <ThemeToggle />
                            <button onClick={logout} className={`flex items-center gap-3 w-full px-3.5 py-3 rounded-xl transition-colors font-bold ${dark ? 'text-red-300 hover:bg-red-500/10' : 'text-red-600 hover:bg-red-50'}`}>
                                <LogOut size={19} className="rtl:rotate-180" />
                                <span>{t('sidebar.logout')}</span>
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </>
    );
}