"use client";

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth, Role } from '@/lib/auth-context';

interface ProtectedRouteProps {
    children: React.ReactNode;
    allowedRoles?: Role[];
}

export default function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
    const { isAuthenticated, user } = useAuth();
    const router = useRouter();
    const pathname = usePathname();
    const [isReady, setIsReady] = useState(false);

    useEffect(() => {
        // Delay rendering to allow useAuth context to hydrate from localStorage
        const timer = setTimeout(() => {
            if (!isAuthenticated) {
                router.push(`/login?redirect=${encodeURIComponent(pathname)}`);
            } else if (allowedRoles && user && !allowedRoles.includes(user.role)) {
                router.push('/unauthorized');
            } else {
                setIsReady(true);
            }
        }, 100);

        return () => clearTimeout(timer);
    }, [isAuthenticated, user, allowedRoles, router, pathname]);

    if (!isReady) {
        return <div className="flex items-center justify-center h-screen font-bold text-gray-500">Checking Authorization...</div>;
    }

    return <>{children}</>;
}
