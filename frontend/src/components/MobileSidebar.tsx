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

export default function MobileSidebar() {
    const { user, logout } = useAuth();
    const { t } = useI18n();
    const { dark } = useTheme();
    const pathname = usePathname();
    const [open, setOpen] = useState(false);

    if (!user) return null;

    const links = buildNavLinks(t).filter(link => link.roles.includes(user.role));

    return (
        <>
            <button
                onClick={() => setOpen(true)}
                className="md:hidden p-2 text-brand-navy hover:bg-brand-mist rounded-xl transition"
                aria-label="Menu"
            >
                <Menu size={24} />
            </button>

            {open && (
                <div className="fixed inset-0 z-50 md:hidden">
                    <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
                    <div className={`absolute inset-y-0 right-0 w-72 max-w-[85vw] shadow-2xl flex flex-col ${dark ? 'bg-gradient-to-b from-brand-navy via-[#0e2a52] to-[#0a1e3c]' : 'bg-white'}`}>
                        <div className={`flex items-center justify-between p-5 border-b ${dark ? 'border-white/10' : 'border-gray-200'}`}>
                            <div className="flex items-center gap-3">
                                <img
                                    src={dark ? '/logos/LaxaLab_Academy_Horizontal_Reverse_4K.png' : '/logos/LaxaLab_Academy_Horizontal_4K.png'}
                                    alt="Laxalab Academy"
                                    className="h-8 w-auto object-contain"
                                />
                            </div>
                            <button onClick={() => setOpen(false)} className={`transition ${dark ? 'text-white/70 hover:text-white' : 'text-brand-charcoal/60 hover:text-brand-navy'}`} aria-label="Close">
                                <X size={24} />
                            </button>
                        </div>

                        <nav className="p-4 space-y-2 flex-1 overflow-y-auto">
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
                        </nav>

                        <div className={`p-4 border-t space-y-4 ${dark ? 'border-white/10' : 'border-gray-200'}`}>
                            <LanguageSwitcher />
                            <ThemeToggle />
                            <button onClick={logout} className={`flex items-center gap-3 w-full px-3.5 py-3 rounded-xl transition-colors font-bold ${dark ? 'text-red-300 hover:bg-red-500/10' : 'text-red-600 hover:bg-red-50'}`}>
                                <LogOut size={19} className="rtl:rotate-180" />
                                <span>{t('sidebar.logout')}</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}