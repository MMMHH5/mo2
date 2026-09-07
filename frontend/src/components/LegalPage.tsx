"use client";

import { useI18n } from '@/lib/i18n-context';
import Link from 'next/link';

export interface LegalSection {
    titleAr: string;
    titleEn: string;
    bodyAr?: string;
    bodyEn?: string;
    itemsAr?: string[];
    itemsEn?: string[];
}

export interface LegalPageProps {
    titleAr: string;
    titleEn: string;
    introAr?: string;
    introEn?: string;
    updatedAr?: string;
    updatedEn?: string;
    sections: LegalSection[];
}

export default function LegalPage({ titleAr, titleEn, introAr, introEn, updatedAr, updatedEn, sections }: LegalPageProps) {
    const { locale } = useI18n();
    const isAr = locale === 'ar';

    return (
        <div className="min-h-screen bg-gray-50">
            <header className="px-8 py-6 flex items-center justify-between border-b border-gray-200 bg-white">
                <Link href="/" className="text-2xl font-black text-brand-navy">
                    laxa<span className="text-brand-gold">lab</span>
                </Link>
                <nav className="flex items-center gap-6 text-sm font-bold text-gray-600">
                    <Link href="/courses" className="hover:text-brand-gold transition">{isAr ? 'الدورات' : 'Courses'}</Link>
                    <Link href="/blog" className="hover:text-brand-gold transition">{isAr ? 'المدونة' : 'Blog'}</Link>
                    <Link href="/login" className="hover:text-brand-navy transition">{isAr ? 'تسجيل الدخول' : 'Sign in'}</Link>
                </nav>
            </header>

            <main className="max-w-3xl mx-auto px-6 py-12">
                <h1 className="text-3xl font-black text-brand-navy mb-2">{isAr ? titleAr : titleEn}</h1>
                {((isAr ? updatedAr : updatedEn) || '') && (
                    <p className="text-sm text-gray-400 mb-6 font-semibold">{isAr ? updatedAr : updatedEn}</p>
                )}
                {((isAr ? introAr : introEn) || '') && (
                    <p className="text-gray-600 leading-relaxed mb-8">{isAr ? introAr : introEn}</p>
                )}

                <div className="space-y-10">
                    {sections.map((section, i) => (
                        <section key={i}>
                            <h2 className="text-xl font-bold text-brand-navy mb-3">{isAr ? section.titleAr : section.titleEn}</h2>
                            {((isAr ? section.bodyAr : section.bodyEn) || '') && (
                                <p className="text-gray-600 leading-relaxed mb-2">{isAr ? section.bodyAr : section.bodyEn}</p>
                            )}
                            {((isAr ? section.itemsAr : section.itemsEn) || []).length > 0 && (
                                <ul className="list-disc pl-6 space-y-1 text-gray-600 leading-relaxed">
                                    {(isAr ? section.itemsAr : section.itemsEn)?.map((item, j) => (
                                        <li key={j}>{item}</li>
                                    ))}
                                </ul>
                            )}
                        </section>
                    ))}
                </div>

                <div className="mt-12 pt-8 border-t border-gray-200 flex flex-wrap gap-6 text-sm font-bold text-gray-600">
                    <Link href="/terms" className="hover:text-brand-gold transition">{isAr ? 'الشروط والأحكام' : 'Terms of Service'}</Link>
                    <Link href="/privacy" className="hover:text-brand-gold transition">{isAr ? 'سياسة الخصوصية' : 'Privacy Policy'}</Link>
                    <Link href="/refund-policy" className="hover:text-brand-gold transition">{isAr ? 'سياسة الاسترداد' : 'Refund Policy'}</Link>
                    <Link href="/cookies" className="hover:text-brand-gold transition">{isAr ? 'سياسة ملفات الارتباط' : 'Cookie Policy'}</Link>
                </div>
            </main>

            <footer className="py-8 text-center text-sm text-gray-400 font-semibold">
                &copy; {new Date().getFullYear()} Laxalab. All rights reserved.
            </footer>
        </div>
    );
}