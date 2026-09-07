"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Menu, X, LogOut } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useI18n } from '@/lib/i18n-context';
import { buildNavLinks } from '@/lib/nav-links';
import LanguageSwitcher from '@/components/LanguageSwitcher';

export default function MobileSidebar() {
    const { user, logout } = useAuth();
    const { t } = useI18n();
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
                    <div className="absolute inset-y-0 right-0 w-72 max-w-[85vw] bg-gradient-to-b from-brand-navy via-[#0e2a52] to-[#0a1e3c] shadow-2xl flex flex-col">
                        <div className="flex items-center justify-between p-5 border-b border-white/10">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                                    <span className="text-brand-gold font-black text-xl">L</span>
                                </div>
                                <h2 className="text-xl font-black text-white tracking-tight">
                                    laxa<span className="text-brand-gold">lab</span>
                                </h2>
                            </div>
                            <button onClick={() => setOpen(false)} className="text-white/70 hover:text-white transition" aria-label="Close">
                                <X size={24} />
                            </button>
                        </div>

                        <nav className="p-4 space-y-2 flex-1 overflow-y-auto">
                            {links.map((link) => {
                                const isActive = (pathname.startsWith(link.href) && link.href !== '/dashboard') || pathname === link.href;
                                const Icon = link.icon;
                                return (
                                    <Link key={link.href} href={link.href} onClick={() => setOpen(false)}>
                                        <div className={`flex items-center gap-3 px-3.5 py-3 rounded-xl font-bold transition-colors ${
                                            isActive ? 'bg-brand-gold/20 text-brand-gold' : 'text-brand-mist/70 hover:bg-white/10 hover:text-white'
                                        }`}>
                                            <Icon size={19} />
                                            <span>{link.name}</span>
                                        </div>
                                    </Link>
                                );
                            })}
                        </nav>

                        <div className="p-4 border-t border-white/10 space-y-4">
                            <LanguageSwitcher dark />
                            <button onClick={logout} className="flex items-center gap-3 text-red-300 hover:bg-red-500/10 w-full px-3.5 py-3 rounded-xl transition-colors font-bold">
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
