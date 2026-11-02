"use client";

import ProtectedRoute from '@/components/ProtectedRoute';
import { buildAdminNavLinks } from '@/lib/nav-links';
import { useAuth } from '@/lib/auth-context';
import { useI18n } from '@/lib/i18n-context';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo } from 'react';

const ADMIN_ROLES = ['ADMIN', 'FINANCE', 'COURSE_MANAGER'] as const;

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const { user } = useAuth();
    const { t } = useI18n();
    const pathname = usePathname();
    const router = useRouter();
    const navItems = useMemo(() => buildAdminNavLinks(t), [t]);

    useEffect(() => {
        if (!user) return;
        const entry = navItems
            .filter((item) => item.href !== '/dashboard/admin' || pathname === '/dashboard/admin')
            .find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
        if (entry && !entry.roles.includes(user.role)) {
            router.push('/unauthorized');
        }
    }, [navItems, pathname, router, user]);

    return (
        <ProtectedRoute allowedRoles={[...ADMIN_ROLES]}>
            <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-white/5 dark:bg-brand-navy-dark">
                <div className="h-1 bg-gradient-to-r from-brand-gold via-brand-gold/40 to-transparent" />
                <div className="p-4 sm:p-6 lg:p-8">{children}</div>
            </div>
        </ProtectedRoute>
    );
}