"use client";

import React from 'react';
import Sidebar from '@/components/Sidebar';
import MobileSidebar from '@/components/MobileSidebar';
import ThemeToggle from '@/components/ThemeToggle';
import ProtectedRoute from '@/components/ProtectedRoute';
import BrandLogo from '@/components/BrandLogo';
import { usePathname } from 'next/navigation';
import type { Role } from '@/lib/auth-context';

const APP_MODE = process.env.NEXT_PUBLIC_APP_MODE === 'admin' ? 'admin' : 'learner';
const PLATFORM_ROLES: Role[] = APP_MODE === 'admin'
    ? ['ADMIN', 'FINANCE', 'COURSE_MANAGER']
    : ['STUDENT', 'INSTRUCTOR'];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const isCoursePlayer = /^\/(?:(?:ar|en)\/)?dashboard\/courses\/[^/]+\/player\/?$/.test(pathname);

    return (
        <ProtectedRoute allowedRoles={PLATFORM_ROLES}>
            <div className="flex min-h-screen min-w-0 overflow-x-clip bg-gray-50 dark:bg-brand-navy-dark">
                {!isCoursePlayer && <Sidebar />}

                {/* Main Application Area wrapped securely */}
                <div className={`flex-1 min-w-0 ${isCoursePlayer ? 'min-h-screen' : ''}`}>
                    {!isCoursePlayer && (
                        <>
                            <div className="h-1 bg-gradient-to-r from-brand-gold via-brand-gold/40 to-transparent" />
                            <div className="lg:hidden sticky top-0 z-40 bg-white/95 dark:bg-brand-navy/95 backdrop-blur-xl border-b border-gray-200 dark:border-white/5 px-3 sm:px-4 py-2.5 flex items-center justify-between gap-2">
                                <BrandLogo className="h-7 w-auto max-w-[42vw] shrink-0 object-contain" />
                                <div className="flex shrink-0 items-center gap-1.5">
                                    <ThemeToggle />
                                    <MobileSidebar />
                                </div>
                            </div>
                        </>
                    )}
                    <main className={`min-w-0 ${isCoursePlayer ? '' : 'overflow-x-clip p-3 sm:p-5 lg:p-8'}`}>
                        {children}
                    </main>
                </div>
            </div>
        </ProtectedRoute>
    );
}