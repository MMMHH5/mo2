"use client";

import { useState } from 'react';
import Link from 'next/link';
import { useFetchData } from '@/lib/useFetchData';
import { useI18n } from '@/lib/i18n-context';

interface BlogPostSummary {
    id: string;
    slug: string;
    titleAr: string;
    titleEn: string;
    excerptAr?: string | null;
    excerptEn?: string | null;
    coverImageUrl?: string | null;
    publishedAt?: string | null;
    author?: { id: string; email: string } | null;
}

interface BlogListData {
    total: number;
    page: number;
    pageSize: number;
    items: BlogPostSummary[];
}

export default function BlogList() {
    const { t, locale } = useI18n();
    const isAr = locale === 'ar';
    const [page, setPage] = useState(1);
    const { data, loading } = useFetchData<BlogListData>(`/blog?page=${page}&pageSize=12`);

    const items = data?.items ?? [];
    const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / 12));

    return (
        <div className="min-h-screen bg-gray-50 pb-16">
            <header className="px-8 py-6 flex items-center justify-between border-b border-gray-200 bg-white">
                <Link href="/" className="text-2xl font-black text-brand-navy">
                    laxa<span className="text-brand-gold">lab</span>
                </Link>
                <nav className="flex items-center gap-6 text-sm font-bold text-gray-600">
                    <Link href="/courses" className="hover:text-brand-gold transition">{isAr ? 'الدورات' : 'Courses'}</Link>
                    <Link href="/verify-certificate" className="hover:text-brand-gold transition">{isAr ? 'التحقق من الشهادات' : 'Verify a certificate'}</Link>
                    <Link href="/login" className="hover:text-brand-navy transition">{isAr ? 'تسجيل الدخول' : 'Sign in'}</Link>
                </nav>
            </header>

            <main className="max-w-5xl mx-auto px-6 py-12">
                <div className="text-center mb-10">
                    <h1 className="text-4xl font-black text-brand-navy mb-2">{t('blog.title')}</h1>
                    <p className="text-gray-500 font-semibold">{t('blog.subtitle')}</p>
                </div>

                {loading && <p className="text-center text-gray-400 font-bold">{t('common.loading')}</p>}

                {!loading && items.length === 0 && (
                    <p className="text-center text-gray-400 font-bold">{t('blog.empty')}</p>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {items.map((post) => (
                        <Link key={post.id} href={`/blog/${post.slug}`} className="bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-lg transition group">
                            {post.coverImageUrl && (
                                <div className="h-40 w-full bg-gray-100 overflow-hidden">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={post.coverImageUrl} alt={isAr ? post.titleAr : post.titleEn} className="w-full h-full object-cover group-hover:scale-105 transition duration-300" />
                                </div>
                            )}
                            <div className="p-5">
                                <h2 className="font-black text-brand-navy text-lg mb-2 group-hover:text-brand-gold transition">
                                    {isAr ? post.titleAr : post.titleEn}
                                </h2>
                                {(isAr ? post.excerptAr : post.excerptEn) && (
                                    <p className="text-sm text-gray-500 leading-relaxed line-clamp-2">{isAr ? post.excerptAr : post.excerptEn}</p>
                                )}
                                <div className="mt-4 flex items-center justify-between text-xs text-gray-400 font-semibold">
                                    <span>{post.author?.email}</span>
                                    <span>{post.publishedAt ? new Date(post.publishedAt).toLocaleDateString() : ''}</span>
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>

                {totalPages > 1 && (
                    <div className="mt-10 flex items-center justify-center gap-3">
                        <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="px-4 py-2 rounded-xl bg-white border border-gray-200 font-bold text-sm disabled:opacity-40 hover:bg-gray-50 transition">
                            {isAr ? 'السابق' : 'Previous'}
                        </button>
                        <span className="text-sm font-bold text-gray-500">{page} / {totalPages}</span>
                        <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="px-4 py-2 rounded-xl bg-white border border-gray-200 font-bold text-sm disabled:opacity-40 hover:bg-gray-50 transition">
                            {isAr ? 'التالي' : 'Next'}
                        </button>
                    </div>
                )}
            </main>
        </div>
    );
}