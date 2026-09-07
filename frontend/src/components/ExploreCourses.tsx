"use client";

import { useFetchData } from '@/lib/useFetchData';
import { BookOpen, UploadCloud, FileImage, XCircle, LogIn, UserPlus, Eye, Search, Users, Clock, SlidersHorizontal, X, Sparkles, CheckCircle2 } from 'lucide-react';
import { useState, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, API_BASE_URL, getErrorMessage } from '@/lib/api';
import toast from 'react-hot-toast';
import { useI18n } from '@/lib/i18n-context';
import { useAuth } from '@/lib/auth-context';
import { formatPrice, formatNumber } from '@/lib/format';

interface Opening {
    id: string;
    status?: string | null;
    price: string;
}

interface Course {
    id: string;
    level?: string | null;
    language?: string | null;
    coverImageUrl?: string | null;
    excerptAr?: string | null;
    excerptEn?: string | null;
    categoryAr?: string | null;
    categoryEn?: string | null;
    titleAr?: string | null;
    titleEn?: string | null;
    descriptionAr?: string | null;
    descriptionEn?: string | null;
    durationAr?: string | null;
    durationEn?: string | null;
    openings?: Opening[];
    _count?: { enrollments?: number; modules?: number };
}

interface PaymentGateway {
    id: string;
    name: string;
    instructions: string;
}

export default function ExploreCourses({ hideHeader = false }: { hideHeader?: boolean }) {
    const { t, pick, locale } = useI18n();
    const { user } = useAuth();
    const router = useRouter();
    const { data: courses, loading, error } = useFetchData<Course[]>('/public/courses');
    const { data: gateways } = useFetchData<PaymentGateway[]>('/payment-gateways');
    const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
    const [showLoginPrompt, setShowLoginPrompt] = useState(false);
    const [receiptFile, setReceiptFile] = useState<File | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [query, setQuery] = useState('');
    const [category, setCategory] = useState('');
    const [level, setLevel] = useState('');
    const [showFilters, setShowFilters] = useState(false);

    const levelLabel = (lvl?: string | null) => t(`course.level_${String(lvl || 'BEGINNER').toLowerCase()}`);
    const openOpening = (course: Course): Opening | undefined => course.openings?.find(o => o.status === 'OPEN');
    const announcedOpening = (course: Course): Opening | undefined => course.openings?.find(o => o.status === 'ANNOUNCEMENT');
    const currentOpening = (course: Course): Opening | undefined => openOpening(course) ?? announcedOpening(course);

    const categories = useMemo(() => {
        const set = new Set<string>();
        for (const course of courses ?? []) {
            const cat = pick(course, 'category');
            if (cat) set.add(cat);
        }
        return Array.from(set).sort((a, b) => a.localeCompare(b));
    }, [courses, pick]);

    const filteredCourses = useMemo(() => {
        if (!courses) return courses;
        const q = query.trim().toLowerCase();
        return courses.filter((course) => {
            if (level && (course.level ?? 'BEGINNER') !== level) return false;
            if (category) {
                const cat = pick(course, 'category') ?? '';
                if (!cat || cat !== category) return false;
            }
            if (q) {
                const haystack = [
                    course.titleAr, course.titleEn,
                    course.excerptAr, course.excerptEn,
                    course.categoryAr, course.categoryEn,
                ].filter(Boolean).join(' ').toLowerCase();
                if (!haystack.includes(q)) return false;
            }
            return true;
        });
    }, [courses, query, category, level, pick]);

    const hasFilters = !!query.trim() || !!category || !!level;

    const clearFilters = () => { setQuery(''); setCategory(''); setLevel(''); };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setReceiptFile(e.target.files[0]);
        }
    };

    const handleEnrollClick = (course: Course) => {
        const opening = currentOpening(course);
        if (!opening) return;
        if (!user) {
            setShowLoginPrompt(true);
            return;
        }
        setSelectedCourse(course);
        setReceiptFile(null);
    };

    const handleReserveClick = async (course: Course) => {
        if (!user) {
            setShowLoginPrompt(true);
            return;
        }
        try {
            await api.post('/enrollments/reserve', { courseId: course.id });
            toast.success(t('courseDetail.seat_reserved'));
            router.push('/dashboard/my-courses');
        } catch (err) {
            toast.error(getErrorMessage(err) || t('courseDetail.reserve_failed'));
        }
    };

    const handleEnrollmentSubmit = async () => {
        if (!selectedCourse) return;
        const opening = currentOpening(selectedCourse);
        if (!opening) return;
        if (!receiptFile) {
            toast.error(t('explore.upload_receipt_required'));
            return;
        }

        setIsSubmitting(true);
        try {
            const formData = new FormData();
            formData.append('openingId', opening.id);
            formData.append('receipt', receiptFile);

            await api.post('/enrollments', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            toast.success(t('explore.review_success'));
            setSelectedCourse(null);
            setReceiptFile(null);
        } catch (err) {
            toast.error(getErrorMessage(err) || t('explore.submit_failed'));
        } finally {
            setIsSubmitting(false);
        }
    };

    const selectCls = "w-full px-4 py-3 bg-white border border-brand-mist rounded-xl font-semibold text-brand-charcoal focus:outline-none focus:ring-2 focus:ring-brand-gold transition cursor-pointer";

    return (
        <div className="max-w-7xl mx-auto space-y-8">
            {/* Header */}
            {!hideHeader && (
                <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
                    <div>
                        <div className="inline-flex items-center gap-2 text-brand-gold-dark font-black text-xs uppercase tracking-[0.2em] mb-2">
                            <Sparkles size={14} /> {t('landing.explore_courses')}
                        </div>
                        <h1 className="text-4xl md:text-5xl font-black text-brand-navy tracking-tight">{t('explore.heading')}</h1>
                        <p className="text-gray-500 mt-2 text-lg max-w-xl">{t('explore.subtitle')}</p>
                    </div>
                    {!loading && courses && (
                        <div className="inline-flex items-center gap-1.5 bg-white border border-brand-mist rounded-full px-4 py-2 text-sm font-black text-brand-navy shadow-sm shrink-0">
                            <BookOpen size={15} className="text-brand-gold-dark" />
                            {formatNumber(filteredCourses?.length ?? 0, locale)} {t('explore.count_label')}
                        </div>
                    )}
                </div>
            )}

            {/* Toolbar */}
            <div className="bg-white rounded-2xl border border-brand-mist shadow-sm p-4 sticky top-20 z-30 backdrop-blur-md bg-white/90">
                <div className="flex flex-col md:flex-row gap-3">
                    <div className="flex-1 relative">
                        <Search size={18} className="absolute start-4 top-1/2 -translate-y-1/2 text-gray-600" />
                        <input
                            type="search"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder={t('explore.search_placeholder')}
                            className="w-full ps-12 pe-4 py-3 bg-gray-50 border border-brand-mist rounded-xl font-semibold text-brand-charcoal placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-gold transition"
                        />
                    </div>
                    <button
                        onClick={() => setShowFilters((v) => !v)}
                        className="md:hidden inline-flex items-center justify-center gap-2 bg-brand-navy text-white px-4 py-3 rounded-xl font-bold transition cursor-pointer"
                    >
                        <SlidersHorizontal size={16} /> {t('common.filter')}
                    </button>
                    <div className={`${showFilters ? 'flex' : 'hidden'} md:flex flex-col md:flex-row gap-3 md:w-auto w-full`}>
                        <div className="flex-1 relative">
                            <select value={category} onChange={(e) => setCategory(e.target.value)} className={selectCls}>
                                <option value="">{t('explore.all_categories')}</option>
                                {categories.map((c) => (
                                    <option key={c} value={c}>{c}</option>
                                ))}
                            </select>
                        </div>
                        <select value={level} onChange={(e) => setLevel(e.target.value)} className={selectCls}>
                            <option value="">{t('explore.all_levels')}</option>
                            {['BEGINNER', 'INTERMEDIATE', 'ADVANCED'].map((lvl) => (
                                <option key={lvl} value={lvl}>{levelLabel(lvl)}</option>
                            ))}
                        </select>
                    </div>
                </div>
                {hasFilters && (
                    <div className="flex items-center gap-2 mt-3">
                        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-navy bg-brand-gold/15 text-brand-navy px-3 py-1.5 rounded-full">
                            <SlidersHorizontal size={12} /> {t('common.filter')}: {formatNumber(filteredCourses?.length ?? 0, locale)}
                        </span>
                        <button onClick={clearFilters} className="inline-flex items-center gap-1 text-xs font-bold text-gray-600 hover:text-brand-navy transition cursor-pointer">
                            <X size={12} /> {t('common.cancel')}
                        </button>
                    </div>
                )}
            </div>

            {error && <div className="p-4 bg-red-50 text-red-600 rounded-lg font-semibold">{error}</div>}

            {loading ? (
                <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-8">
                    {[...Array(6)].map((_, i) => (
                        <div key={i} className="bg-white rounded-3xl border border-brand-mist overflow-hidden animate-pulse">
                            <div className="h-52 bg-brand-mist/70" />
                            <div className="p-6 space-y-3">
                                <div className="h-4 w-1/3 bg-brand-mist rounded-full" />
                                <div className="h-6 w-3/4 bg-brand-mist rounded-full" />
                                <div className="h-4 w-full bg-brand-mist/60 rounded-full" />
                                <div className="h-4 w-2/3 bg-brand-mist/60 rounded-full" />
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                    {filteredCourses?.map((course) => {
                        const opening = currentOpening(course);
                        const isOpen = !!openOpening(course);
                        const announced = !!announcedOpening(course);
                        const price = opening ? (Number(opening.price) === 0 ? t('course.free') : formatPrice(opening.price, { locale })) : t('courseDetail.not_open_yet');
                        return (
                            <div
                                key={course.id}
                                className="group bg-white rounded-3xl overflow-hidden shadow-sm hover:shadow-2xl hover:shadow-brand-navy/10 transition-all duration-300 border border-brand-mist/70 hover:border-brand-gold/40 flex flex-col animate-fade-in-up"
                            >
                                {/* Cover */}
                                <Link href={`/courses/${course.id}`} className="relative h-52 block overflow-hidden">
                                    {course.coverImageUrl ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img
                                            src={`${API_BASE_URL}${course.coverImageUrl}`}
                                            alt={pick(course, 'title') || ''}
                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                                        />
                                    ) : (
                                        <div className="w-full h-full bg-gradient-to-br from-brand-navy via-brand-navy/90 to-brand-mist flex flex-col items-center justify-center">
                                            <BookOpen size={52} className="text-brand-gold mb-2 opacity-60 group-hover:scale-110 transition-transform duration-500" />
                                        </div>
                                    )}
                                    <div className="absolute inset-0 bg-gradient-to-t from-brand-navy/50 via-transparent to-transparent opacity-60 group-hover:opacity-80 transition-opacity" aria-hidden />
                                    <div className="absolute top-4 end-4 bg-brand-navy/90 backdrop-blur-sm px-3.5 py-1.5 rounded-full font-black text-brand-gold text-sm shadow-lg border border-white/10">
                                        {price}
                                    </div>
                                    <div className="absolute bottom-3 start-3 flex items-center gap-2">
                                        <span className="bg-white/95 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-black text-brand-navy shadow-sm">
                                            {levelLabel(course.level)}
                                        </span>
                                        {isOpen && (
                                            <span className="bg-green-500 text-white px-3 py-1 rounded-full text-xs font-black shadow-sm flex items-center gap-1">
                                                <CheckCircle2 size={12} /> {t('statuses.open')}
                                            </span>
                                        )}
                                    </div>
                                </Link>

                                {/* Body */}
                                <div className="p-6 flex-1 flex flex-col">
                                    {(pick(course, 'category') || course.language) && (
                                        <div className="flex flex-wrap gap-2 mb-2.5">
                                            {pick(course, 'category') && (
                                                <span className="text-[11px] font-black text-brand-gold-dark bg-brand-gold/10 px-2.5 py-1 rounded-full">{pick(course, 'category')}</span>
                                            )}
                                            {course.language && (
                                                <span className="text-[11px] font-semibold text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full">{course.language}</span>
                                            )}
                                        </div>
                                    )}
                                    <Link href={`/courses/${course.id}`}>
                                        <h3 className="text-xl font-black text-brand-charcoal mb-2 line-clamp-2 group-hover:text-brand-navy transition-colors leading-snug">{pick(course, 'title')}</h3>
                                    </Link>
                                    <p className="text-sm text-gray-500 mb-4 line-clamp-3 leading-relaxed flex-1">
                                        {pick(course, 'excerpt') || pick(course, 'description')}
                                    </p>

                                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs font-bold text-gray-500 mb-5">
                                        {course._count && course._count.modules ? (
                                            <span className="inline-flex items-center gap-1.5"><BookOpen size={14} className="text-brand-gold" /> {course._count.modules} {t('course.modules')}</span>
                                        ) : null}
                                        {pick(course, 'duration') ? (
                                            <span className="inline-flex items-center gap-1.5"><Clock size={14} className="text-brand-gold" /> {pick(course, 'duration')}</span>
                                        ) : null}
                                        {course._count && course._count.enrollments ? (
                                            <span className="inline-flex items-center gap-1.5"><Users size={14} className="text-brand-gold" /> {formatNumber(course._count.enrollments, locale)} {t('explore.students')}</span>
                                        ) : null}
                                    </div>

                                    <div className="grid grid-cols-2 gap-3 mt-auto">
                                        <Link
                                            href={`/courses/${course.id}`}
                                            className="py-3.5 border-2 border-brand-mist text-brand-charcoal hover:border-brand-navy hover:text-brand-navy hover:bg-brand-navy/5 rounded-xl transition-all font-bold text-sm flex items-center justify-center gap-2"
                                        >
                                            <Eye size={16} /> {t('explore.view_details')}
                                        </Link>
                                        {isOpen ? (
                                            <button
                                                onClick={() => handleEnrollClick(course)}
                                                className="py-3.5 bg-brand-navy hover:bg-brand-charcoal text-white font-bold rounded-xl transition-all text-sm flex items-center justify-center gap-2 shadow-md shadow-brand-navy/20 cursor-pointer"
                                            >
                                                {t('explore.enroll_now')}
                                            </button>
                                        ) : announced ? (
                                            <button
                                                onClick={() => handleReserveClick(course)}
                                                className="py-3.5 border-2 border-brand-gold/50 text-brand-navy hover:bg-brand-gold hover:text-brand-navy font-bold rounded-xl transition-all text-sm cursor-pointer"
                                            >
                                                {t('courseDetail.reserve_seat')}
                                            </button>
                                        ) : (
                                            <span className="py-3.5 bg-gray-50 text-gray-500 font-bold rounded-xl text-center text-sm">
                                                {t('courseDetail.not_open_yet')}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}

                    {filteredCourses?.length === 0 && (
                        <div className="col-span-full py-20 text-center bg-white rounded-3xl border border-brand-mist text-gray-500 border-2 border-dashed border-brand-mist/70">
                            <BookOpen size={48} className="mx-auto mb-4 text-brand-gold-dark/50" />
                            <p className="text-lg font-bold text-brand-navy">{hasFilters ? t('explore.no_results') : t('explore.no_courses')}</p>
                            {hasFilters && (
                                <button onClick={clearFilters} className="mt-4 inline-flex items-center gap-2 bg-brand-navy text-white px-5 py-2.5 rounded-xl font-bold transition hover:bg-brand-charcoal cursor-pointer">
                                    <X size={15} /> {t('common.cancel')}
                                </button>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Login Prompt Modal (guests only) */}
            {showLoginPrompt && (
                <div className="fixed inset-0 bg-brand-charcoal/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-3xl w-full max-w-md p-8 shadow-2xl text-center animate-scale-in">
                        <div className="w-16 h-16 bg-gradient-to-br from-brand-gold/25 to-brand-gold/10 rounded-2xl flex items-center justify-center mx-auto mb-6 text-brand-gold">
                            <LogIn size={32} />
                        </div>
                        <h2 className="text-2xl font-black text-brand-navy mb-3">{t('explore.login_prompt_title')}</h2>
                        <p className="text-gray-500 mb-8">{t('explore.login_prompt_desc')}</p>
                        <div className="flex flex-col gap-3">
                            <button
                                onClick={() => router.push('/login')}
                                className="w-full bg-brand-navy hover:bg-brand-charcoal text-white font-bold py-4 rounded-2xl transition cursor-pointer"
                            >
                                {t('auth.login')}
                            </button>
                            <button
                                onClick={() => router.push('/register')}
                                className="w-full bg-brand-mist text-brand-charcoal hover:bg-gray-200 font-bold py-4 rounded-2xl transition flex items-center justify-center gap-2 cursor-pointer"
                            >
                                <UserPlus size={18} /> {t('auth.register')}
                            </button>
                            <button
                                onClick={() => setShowLoginPrompt(false)}
                                className="text-gray-600 hover:text-gray-800 font-semibold text-sm mt-1 cursor-pointer"
                            >
                                {t('common.cancel')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Enrollment Modal with Receipt Upload */}
            {selectedCourse && (
                <div className="fixed inset-0 bg-brand-charcoal/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-3xl w-full max-w-lg p-8 shadow-2xl transform transition-all max-h-[90vh] overflow-y-auto animate-scale-in">
                        <div className="w-12 h-12 bg-gradient-to-br from-brand-gold/25 to-brand-gold/10 rounded-2xl flex items-center justify-center mb-4 text-brand-gold">
                            <BookOpen size={24} />
                        </div>
                        <h2 className="text-2xl font-black text-brand-navy mb-2">{t('explore.enroll_in')} {pick(selectedCourse, 'title')}</h2>
                        <p className="text-gray-500 mb-6">{t('explore.transfer_part1')} <strong className="text-brand-navy">{formatPrice(currentOpening(selectedCourse)?.price, { locale })}</strong> {t('explore.transfer_part2')}</p>

                        <div className="mb-6 space-y-3">
                            <h3 className="font-bold text-sm text-brand-charcoal uppercase tracking-wider">{t('payment.payment_method')}:</h3>
                            {gateways && gateways.length > 0 ? (
                                gateways.map((gateway) => (
                                    <div key={gateway.id} className="bg-brand-mist/20 p-4 rounded-xl border border-brand-mist">
                                        <h4 className="font-bold text-brand-navy">{gateway.name}</h4>
                                        <p className="text-sm text-gray-600 whitespace-pre-wrap mt-1">{gateway.instructions}</p>
                                    </div>
                                ))
                            ) : (
                                <div className="text-sm text-yellow-700 bg-yellow-50 p-3 rounded-xl border border-yellow-100">
                                    {t('explore.no_payment_methods')}
                                </div>
                            )}
                        </div>

                        {!receiptFile ? (
                            <div
                                onClick={() => fileInputRef.current?.click()}
                                className="bg-brand-white border-2 border-dashed border-brand-gold/50 rounded-2xl p-8 flex flex-col items-center justify-center text-brand-navy font-semibold cursor-pointer hover:bg-brand-mist/50 hover:border-brand-gold transition group"
                            >
                                <UploadCloud size={40} className="mb-3 text-brand-gold group-hover:scale-110 transition-transform" />
                                <span>{t('payment.attach_receipt')}</span>
                                <span className="text-xs text-gray-500 font-normal mt-2">{t('explore.supports_formats')}</span>
                                <input
                                    type="file"
                                    className="hidden"
                                    ref={fileInputRef}
                                    onChange={handleFileChange}
                                    accept=".jpg,.jpeg,.png,.pdf"
                                />
                            </div>
                        ) : (
                            <div className="bg-brand-mist border border-brand-mist/80 rounded-xl p-4 flex items-center justify-between">
                                <div className="flex items-center space-x-3 rtl:space-x-reverse overflow-hidden">
                                    <FileImage size={24} className="text-brand-navy flex-shrink-0" />
                                    <span className="font-semibold text-brand-charcoal truncate" dir="ltr">{receiptFile.name}</span>
                                </div>
                                <button onClick={() => setReceiptFile(null)} className="text-red-500 hover:text-red-700 transition flex-shrink-0 cursor-pointer">
                                    <XCircle size={20} />
                                </button>
                            </div>
                        )}

                        <div className="flex gap-3 mt-8">
                            <button
                                onClick={handleEnrollmentSubmit}
                                disabled={isSubmitting || !receiptFile}
                                className="flex-1 bg-brand-gold hover:bg-brand-gold/90 text-brand-navy py-3.5 font-bold rounded-2xl shadow-sm transition disabled:opacity-50 cursor-pointer"
                            >
                                {isSubmitting ? t('common.submitting') : t('explore.submit_proof')}
                            </button>
                            <button
                                onClick={() => setSelectedCourse(null)}
                                disabled={isSubmitting}
                                className="flex-1 bg-brand-mist text-brand-charcoal hover:bg-gray-200 py-3.5 font-bold rounded-2xl transition cursor-pointer"
                            >
                                {t('common.cancel')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}