'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        Sentry.captureException(error);
    }, [error]);

    return (
        <html lang="ar" dir="rtl">
            <body className="min-h-screen flex items-center justify-center bg-slate-950 p-6 text-white">
                <main className="max-w-lg rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
                    <h1 className="text-xl font-bold">حدث خطأ غير متوقع</h1>
                    <p className="mt-3 text-sm text-slate-300">An unexpected error occurred.</p>
                    <button
                        type="button"
                        onClick={() => reset()}
                        className="mt-6 rounded-xl bg-amber-400 px-5 py-3 font-bold text-slate-950"
                    >
                        إعادة المحاولة · Try again
                    </button>
                </main>
            </body>
        </html>
    );
}
