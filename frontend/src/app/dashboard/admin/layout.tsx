"use client";

import ProtectedRoute from '@/components/ProtectedRoute';
import { useI18n } from '@/lib/i18n-context';
import { useAuth, type Role } from '@/lib/auth-context';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import {
    LayoutDashboard, BookOpen, CalendarClock, CalendarPlus, Users, Wallet, GraduationCap, CreditCard, Settings, ShieldAlert, LifeBuoy, Route,
    MessageCircle, Megaphone, Flag, Menu, X, LogOut,
    type LucideIcon,
} from 'lucide-react';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import ThemeToggle from '@/components/ThemeToggle';

interface AdminNavItem {
    href: string;
    label: string;
    icon: LucideIcon;
    roles: Role[];
}

const ALL_ROLES: Role[] = ['ADMIN', 'FINANCE', 'COURSE_MANAGER'];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const { t } = useI18n();
    const pathname = usePathname();
    const router = useRouter();
    const { user, logout } = useAuth();
    const role = user?.role;
    const [mobileNavOpen, setMobileNavOpen] = useState(false);

    const mainNav: AdminNavItem[] = useMemo(() => [
        { href: '/dashboard/admin', label: t('admin.nav_overview'), icon: LayoutDashboard, roles: ['ADMIN'] },
        { href: '/dashboard/admin/courses', label: t('admin.nav_courses'), icon: BookOpen, roles: ['ADMIN', 'COURSE_MANAGER'] },
        { href: '/dashboard/admin/learning-paths', label: t('admin.nav_learning_paths'), icon: Route, roles: ['ADMIN', 'COURSE_MANAGER'] },
        { href: '/dashboard/admin/openings', label: t('admin.nav_openings'), icon: CalendarClock, roles: ['ADMIN', 'COURSE_MANAGER'] },
        { href: '/dashboard/admin/ended', label: t('admin.nav_ended'), icon: Flag, roles: ['ADMIN', 'COURSE_MANAGER'] },
        { href: '/dashboard/admin/users', label: t('admin.nav_users'), icon: Users, roles: ['ADMIN'] },
        { href: '/dashboard/admin/finance', label: t('admin.nav_finance'), icon: Wallet, roles: ['FINANCE', 'ADMIN'] },
    ], [t]);

    const platformNav: AdminNavItem[] = useMemo(() => [
        { href: '/dashboard/admin/instructors', label: t('admin.nav_instructors'), icon: GraduationCap, roles: ['ADMIN', 'COURSE_MANAGER'] },
        { href: '/dashboard/admin/blog', label: t('admin.nav_blog'), icon: BookOpen, roles: ['ADMIN', 'COURSE_MANAGER'] },
        { href: '/dashboard/admin/gateways', label: t('admin.nav_gateways'), icon: CreditCard, roles: ['ADMIN'] },
        { href: '/dashboard/admin/system', label: t('admin.nav_system'), icon: Settings, roles: ['ADMIN'] },
        { href: '/dashboard/admin/tickets', label: t('admin.nav_tickets'), icon: LifeBuoy, roles: ['ADMIN', 'COURSE_MANAGER'] },
        { href: '/dashboard/admin/requests', label: t('admin.nav_requests'), icon: CalendarPlus, roles: ['ADMIN', 'COURSE_MANAGER'] },
        { href: '/dashboard/admin/chats', label: t('admin.nav_chats'), icon: MessageCircle, roles: ['ADMIN', 'COURSE_MANAGER'] },
        { href: '/dashboard/admin/announcements', label: t('admin.nav_announcements'), icon: Megaphone, roles: ['ADMIN', 'COURSE_MANAGER'] },
        { href: '/dashboard/admin/audit', label: t('admin.nav_audit'), icon: ShieldAlert, roles: ['ADMIN'] },
    ], [t]);

    useEffect(() => {
        if (!user || !role) return;
        const entry = [...mainNav, ...platformNav]
            .filter(item => item.href !== '/dashboard/admin' || pathname === '/dashboard/admin')
            .find((item) => pathname === item.href || pathname.startsWith(item.href + '/'));
        if (entry && !entry.roles.includes(role)) {
            router.push('/unauthorized');
        }
    }, [pathname, user, role, router, mainNav, platformNav]);

    useEffect(() => {
        if (!mobileNavOpen) return;
        const closeOnEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setMobileNavOpen(false);
        };
        document.addEventListener('keydown', closeOnEscape);
        return () => document.removeEventListener('keydown', closeOnEscape);
    }, [mobileNavOpen]);

    const allowedMain = mainNav.filter(item => role ? item.roles.includes(role) : true);
    const allowedPlatform = platformNav.filter(item => role ? item.roles.includes(role) : true);

    const isActive = (href: string) => href === '/dashboard/admin'
        ? pathname === '/dashboard/admin'
        : pathname.startsWith(href);

    const renderItem = (item: AdminNavItem) => {
        const active = isActive(item.href);
        const Icon = item.icon;
        return (
            <Link key={item.href} href={item.href} onClick={() => setMobileNavOpen(false)}>
                <div className={`group relative flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 ${active
                    ? 'bg-gradient-to-r from-brand-gold/20 to-transparent text-brand-gold shadow-inner'
                    : 'text-gray-500 dark:text-brand-mist/70 hover:bg-brand-navy/5 dark:hover:bg-white/10 hover:text-brand-navy dark:hover:text-white'
                    }`}>
                    {active && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full bg-brand-gold" />}
                    <Icon size={19} className={`transition-colors ${active ? 'text-brand-gold' : 'text-gray-400 dark:text-brand-mist/50 group-hover:text-brand-gold-dark dark:group-hover:text-brand-mist'}`} />
                    <span>{item.label}</span>
                </div>
            </Link>
        );
    };

    const renderNavigation = () => (
        <nav aria-label={t('sidebar.navigation')} className="p-3 space-y-2 overflow-y-auto flex-1 admin-scroll">
            {allowedMain.length > 0 && (
                <p className="px-3.5 pt-2 pb-1 text-[10px] font-black uppercase tracking-[0.18em] text-gray-400 dark:text-brand-mist/40">
                    {t('admin.nav_group_main')}
                </p>
            )}
            {allowedMain.map(renderItem)}
            {allowedPlatform.length > 0 && (
                <p className="px-3.5 pt-4 pb-1 text-[10px] font-black uppercase tracking-[0.18em] text-gray-400 dark:text-brand-mist/40">
                    {t('admin.nav_group_platform')}
                </p>
            )}
            {allowedPlatform.map(renderItem)}
        </nav>
    );

    const renderBrand = () => (
        <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-navy/10 dark:bg-white/10">
                <span className="text-xl font-black text-brand-gold-dark dark:text-brand-gold">L</span>
            </div>
            <div>
                <h2 className="text-xl font-black leading-none tracking-tight text-brand-navy dark:text-white">
                    laxa<span className="text-brand-gold-dark dark:text-brand-gold">lab</span>
                </h2>
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 dark:text-brand-mist/50">Admin Suite</span>
            </div>
        </div>
    );

    return (
        <ProtectedRoute allowedRoles={ALL_ROLES}>
            <div className="flex min-h-[85vh] flex-col overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-lg shadow-brand-navy/10 dark:border-white/5 dark:bg-brand-navy-dark dark:shadow-black/30 lg:flex-row">
                <header className="flex items-center justify-between gap-3 border-b border-gray-200 bg-white p-3 dark:border-white/10 dark:bg-brand-navy lg:hidden">
                    {renderBrand()}
                    <button
                        type="button"
                        onClick={() => setMobileNavOpen(true)}
                        aria-label={t('sidebar.navigation')}
                        aria-expanded={mobileNavOpen}
                        aria-controls="admin-mobile-navigation"
                        className="rounded-xl p-2 text-brand-navy hover:bg-brand-navy/5 dark:text-white dark:hover:bg-white/10"
                    >
                        <Menu size={23} />
                    </button>
                </header>

                {/* Dark navy sidebar */}
                <aside className="hidden lg:flex w-64 shrink-0 bg-white dark:bg-gradient-to-b dark:from-brand-navy dark:via-[#0e2a52] dark:to-[#0a1e3c] border-e border-gray-200 dark:border-white/10 flex-col">
                    <div className="p-5 border-b border-gray-200 dark:border-white/10">
                        {renderBrand()}
                    </div>

                    {renderNavigation()}

                    <div className="space-y-3 border-t border-gray-200 p-4 dark:border-white/10">
                        <div className="flex items-center gap-2.5 bg-gray-100 dark:bg-white/5 rounded-xl px-3.5 py-3">
                            <span className="relative flex h-2.5 w-2.5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
                                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400" />
                            </span>
                            <span className="text-[11px] font-bold text-gray-600 dark:text-brand-mist/80">{t('admin.online')}</span>
                        </div>
                        <LanguageSwitcher />
                        <ThemeToggle />
                        <button
                            type="button"
                            onClick={logout}
                            className="flex w-full items-center gap-3 rounded-xl px-3.5 py-3 font-bold text-red-600 transition-colors hover:bg-red-500/10 dark:text-red-400"
                        >
                            <LogOut size={19} className="rtl:rotate-180" />
                            <span>{t('sidebar.logout')}</span>
                        </button>
                    </div>
                </aside>

                {mobileNavOpen && (
                    <div className="fixed inset-0 z-50 lg:hidden">
                        <button
                            type="button"
                            aria-label={t('common.close')}
                            onClick={() => setMobileNavOpen(false)}
                            className="absolute inset-0 h-full w-full bg-black/50"
                        />
                        <aside
                            id="admin-mobile-navigation"
                            role="dialog"
                            aria-modal="true"
                            aria-label={t('sidebar.navigation')}
                            className="absolute inset-y-0 start-0 flex w-[min(85%,20rem)] flex-col overflow-y-auto border-e border-gray-200 bg-white shadow-2xl dark:border-white/10 dark:bg-brand-navy"
                        >
                            <div className="flex items-center justify-between border-b border-gray-200 p-5 dark:border-white/10">
                                {renderBrand()}
                                <button
                                    type="button"
                                    onClick={() => setMobileNavOpen(false)}
                                    aria-label={t('common.close')}
                                    className="rounded-xl p-2 text-gray-500 hover:bg-gray-100 dark:text-brand-mist dark:hover:bg-white/10"
                                >
                                    <X size={21} />
                                </button>
                            </div>
                            {renderNavigation()}
                            <div className="space-y-3 border-t border-gray-200 p-4 dark:border-white/10">
                                <LanguageSwitcher />
                                <ThemeToggle />
                                <button
                                    type="button"
                                    onClick={logout}
                                    className="flex w-full items-center gap-3 rounded-xl px-3.5 py-3 font-bold text-red-600 transition-colors hover:bg-red-500/10 dark:text-red-400"
                                >
                                    <LogOut size={19} className="rtl:rotate-180" />
                                    <span>{t('sidebar.logout')}</span>
                                </button>
                            </div>
                        </aside>
                    </div>
                )}

                {/* Content */}
                <div className="flex-1 overflow-y-auto">
                    {/* Top gradient strip */}
                    <div className="h-1 bg-gradient-to-r from-brand-gold via-brand-gold/40 to-transparent" />
                    <div className="p-4 sm:p-6 lg:p-8 admin-scroll">{children}</div>
                </div>
            </div>
        </ProtectedRoute>
    );
}