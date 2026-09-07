import React from 'react';
import Sidebar from '@/components/Sidebar';
import MobileSidebar from '@/components/MobileSidebar';
import ProtectedRoute from '@/components/ProtectedRoute';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    return (
        <ProtectedRoute>
            <div className="flex min-h-screen bg-[#0a1830]">
                {/* Dynamic Sidebar handles its own Role checks */}
                <Sidebar />

                {/* Main Application Area wrapped securely */}
                <div className="flex-1 min-w-0">
                    <div className="h-1 bg-gradient-to-r from-amber-500 via-amber-500/40 to-transparent" />
                    <div className="md:hidden sticky top-0 z-40 bg-[#0d1f3c]/95 backdrop-blur-xl border-b border-white/5 px-4 py-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-amber-500/10 rounded-lg flex items-center justify-center">
                                <span className="text-amber-400 font-black text-sm">L</span>
                            </div>
                            <span className="font-black text-white tracking-tight">
                                laxa<span className="text-amber-400">lab</span>
                            </span>
                        </div>
                        <MobileSidebar />
                    </div>
                    <main className="p-6 lg:p-8">
                        {children}
                    </main>
                </div>
            </div>
        </ProtectedRoute>
    );
}