"use client";

import Link from 'next/link';
import { useFetchData } from '@/lib/useFetchData';
import { useI18n } from '@/lib/i18n-context';

interface BlogPostDetail {
    id: string;
    slug: string;
    titleAr: string;
    titleEn: string;
    excerptAr?: string | null;
    excerptEn?: string | null;
    contentAr: string;
    contentEn: string;
    coverImageUrl?: string | null;
    isPublished: boolean;
    publishedAt?: string | null;
    createdAt: string;
    author?: { id: string; email: string } | null;
}

export default function BlogPost({ slug }: { slug: string }) {
    const { t, locale } = useI18n();
    const isAr = locale === 'ar';
    const { data: post, error } = useFetchData<BlogPostDetail>(`/blog/${encodeURIComponent(slug)}`);

    if (error && !post) {
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-6 text-center">
                <h1 className="text-3xl font-black text-brand-navy mb-3">{isAr ? 'لم يتم العثور على المقالة' : 'Post not found'}</h1>
                <Link href="/blog" className="text-brand-gold font-bold hover:underline">{t('blog.backToBlog')}</Link>
            </div>
        );
    }

    if (!post) {
        return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><p className="font-bold text-gray-400">{t('common.loading')}</p></div>;
    }

    const body = (isAr ? post.contentAr : post.contentEn) || '';
    const paragraphs = body.split(/\n+/).filter(Boolean);
    const title = isAr ? post.titleAr : post.titleEn;
    const excerpt = isAr ? post.excerptAr : post.excerptEn;

    return (
        <div className="min-h-screen bg-gray-50 pb-16">
            <header className="px-8 py-6 flex items-center justify-between border-b border-gray-200 bg-white">
                <Link href="/" className="text-2xl font-black text-brand-navy">
                    laxa<span className="text-brand-gold">lab</span>
                </Link>
                <nav className="flex items-center gap-6 text-sm font-bold text-gray-600">
                    <Link href="/blog" className="hover:text-brand-gold transition">{t('blog.title')}</Link>
                    <Link href="/courses" className="hover:text-brand-gold transition">{isAr ? 'الدورات' : 'Courses'}</Link>
                    <Link href="/login" className="hover:text-brand-navy transition">{isAr ? 'تسجيل الدخول' : 'Sign in'}</Link>
                </nav>
            </header>

            <main className="max-w-3xl mx-auto px-6 py-12">
                <Link href="/blog" className="text-sm font-bold text-brand-gold hover:underline mb-6 inline-block">&larr; {t('blog.backToPosts')}</Link>

                {post.coverImageUrl && (
                    <div className="w-full h-64 md:h-80 bg-gray-100 rounded-3xl overflow-hidden mb-8">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={post.coverImageUrl} alt={title} className="w-full h-full object-cover" />
                    </div>
                )}

                <h1 className="text-3xl md:text-4xl font-black text-brand-navy leading-tight mb-4">{title}</h1>
                <div className="text-sm text-gray-400 font-semibold mb-8 flex items-center gap-2">
                    <span>{t('blog.byAuthor')} {post.author?.email}</span>
                    <span>•</span>
                    <span>{t('blog.publishedOn')} {new Date(post.publishedAt || post.createdAt).toLocaleDateString()}</span>
                </div>

                {excerpt && <p className="text-gray-600 font-semibold text-lg mb-6 leading-relaxed">{excerpt}</p>}

                <article className="prose prose-lg max-w-none text-gray-700 leading-relaxed space-y-4">
                    {paragraphs.map((p: string, i: number) => (
                        <p key={i}>{p}</p>
                    ))}
                </article>
            </main>
        </div>
    );
}