"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import { API_BASE_URL, api, getErrorMessage } from '@/lib/api';
import { useFetchData } from '@/lib/useFetchData';
import { useI18n } from '@/lib/i18n-context';
import { useAuth } from '@/lib/auth-context';
import { useTheme } from '@/lib/theme-context';
import toast from 'react-hot-toast';
import Link from 'next/link';
import {
    ArrowDown, ArrowUp, ArrowUpRight, BookOpen, ChevronDown, GraduationCap, ImagePlus, Layers, Loader, Lock, Pencil,
    Plus, Route, Search, Trash2, X,
} from 'lucide-react';

interface CourseReadiness {
    checks: Record<string, boolean>;
    missing: string[];
    percent: number;
}

interface CourseOption {
    id: string;
    titleAr?: string | null;
    titleEn?: string | null;
    categoryAr?: string | null;
    categoryEn?: string | null;
    level?: string | null;
    isPublished?: boolean;
    readiness?: CourseReadiness;
    publishedPathCount?: number;
}

interface PathCourseItem {
    id: string;
    orderIndex: number;
    course?: CourseOption | null;
    readiness?: CourseReadiness;
    registrationStatus?: string;
    enrollmentStatus?: string | null;
    completedLessons?: number;
    totalLessons?: number;
    progressPercent?: number;
    isCompleted?: boolean;
}

interface LearningPathData {
    id: string;
    titleAr: string;
    titleEn: string;
    descriptionAr?: string | null;
    descriptionEn?: string | null;
    coverImageUrl?: string | null;
    isPublished: boolean;
    createdAt: string;
    creator?: { id: string; email?: string } | null;
    courses?: PathCourseItem[];
}

interface PathForm {
    titleAr: string;
    titleEn: string;
    descriptionAr: string;
    descriptionEn: string;
    coverImageUrl: string;
    isPublished: boolean;
    courseIds: string[];
}

interface Props {
    mode?: 'browse' | 'manage';
    variant?: 'default' | 'featured';
    limit?: number;
}

const PATH_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_PATH_IMAGE_SIZE = 10 * 1024 * 1024;

const emptyPathForm: PathForm = {
    titleAr: '',
    titleEn: '',
    descriptionAr: '',
    descriptionEn: '',
    coverImageUrl: '',
    isPublished: false,
    courseIds: [],
};

const GRADIENTS = [
    'from-brand-gold/40 via-brand-navy-dark to-brand-navy',
    'from-brand-navy-light/30 via-brand-navy-dark to-brand-navy',
    'from-purple-500/25 via-brand-navy-dark to-brand-navy',
    'from-emerald-500/25 via-brand-navy-dark to-brand-navy',
];

export default function LearningPathList({ mode = 'browse', variant = 'default', limit }: Props) {
    const { t, locale, pick } = useI18n();
    const isAr = locale === 'ar';
    const { user } = useAuth();
    const { dark } = useTheme();

    const canManage = ['ADMIN', 'COURSE_MANAGER'].includes(user?.role || '');
    const manage = mode === 'manage' && canManage;

    const { data, loading, error, refetch } = useFetchData<LearningPathData[]>(manage ? '/learning-paths/manage' : '/learning-paths');
    const { data: courseData, loading: coursesLoading, error: coursesError } = useFetchData<CourseOption[]>(
        manage ? '/learning-paths/manage/courses' : null,
    );

    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<LearningPathData | null>(null);
    const [form, setForm] = useState<PathForm>(emptyPathForm);
    const [coverFile, setCoverFile] = useState<File | null>(null);
    const [coverFilePreview, setCoverFilePreview] = useState('');
    const [saving, setSaving] = useState(false);
    const [courseQuery, setCourseQuery] = useState('');
    const coverPreviewUrlRef = useRef<string | null>(null);

    const paths = useMemo(() => {
        const list = data || [];
        return manage ? list : list.filter((p) => p.isPublished !== false);
    }, [data, manage]);
    const visiblePaths = useMemo(() => (limit ? paths.slice(0, limit) : paths), [limit, paths]);
    const coursesWithoutPublishedPath = useMemo(
        () => (courseData || []).filter((course) => !course.publishedPathCount),
        [courseData],
    );

    useEffect(() => () => {
        if (coverPreviewUrlRef.current) URL.revokeObjectURL(coverPreviewUrlRef.current);
    }, []);

    const clearCoverFile = () => {
        if (coverPreviewUrlRef.current) {
            URL.revokeObjectURL(coverPreviewUrlRef.current);
            coverPreviewUrlRef.current = null;
        }
        setCoverFile(null);
        setCoverFilePreview('');
    };

    const closeModal = () => {
        setModalOpen(false);
        clearCoverFile();
    };

    const openCreate = () => {
        setEditing(null);
        setForm(emptyPathForm);
        clearCoverFile();
        setCourseQuery('');
        setModalOpen(true);
    };

    const openEdit = (p: LearningPathData) => {
        setEditing(p);
        setForm({
            titleAr: p.titleAr || '',
            titleEn: p.titleEn || '',
            descriptionAr: p.descriptionAr || '',
            descriptionEn: p.descriptionEn || '',
            coverImageUrl: p.coverImageUrl || '',
            isPublished: !!p.isPublished,
            courseIds: [...(p.courses || [])]
                .sort((a, b) => a.orderIndex - b.orderIndex)
                .map((item) => item.course?.id)
                .filter((id): id is string => !!id),
        });
        clearCoverFile();
        setCourseQuery('');
        setModalOpen(true);
    };

    const selectCoverImage = (file?: File) => {
        if (!file) return;
        if (!PATH_IMAGE_TYPES.includes(file.type)) {
            toast.error(isAr ? 'اختر صورة بصيغة JPG أو PNG أو WEBP أو GIF' : 'Choose a JPG, PNG, WEBP, or GIF image');
            return;
        }
        if (file.size > MAX_PATH_IMAGE_SIZE) {
            toast.error(isAr ? 'يجب ألا يتجاوز حجم الصورة 10 ميجابايت' : 'The image must be 10 MB or smaller');
            return;
        }
        clearCoverFile();
        const previewUrl = URL.createObjectURL(file);
        coverPreviewUrlRef.current = previewUrl;
        setCoverFilePreview(previewUrl);
        setCoverFile(file);
    };

    const save = async () => {
        if (!form.titleAr.trim() || !form.titleEn.trim()) {
            toast.error(isAr ? 'أدخل العنوان بالعربي والإنجليزي' : 'Enter the title in Arabic and English');
            return;
        }
        if (form.isPublished && form.courseIds.length === 0) {
            toast.error(isAr ? 'أضف دورة واحدة على الأقل قبل نشر المسار' : 'Add at least one course before publishing the path');
            return;
        }
        setSaving(true);
        try {
            let coverImageUrl = form.coverImageUrl.trim();
            if (coverFile) {
                const imageForm = new FormData();
                imageForm.append('file', coverFile);
                const uploadResponse = await api.post<{ url: string }>('/api/admin/courses/media?kind=path-cover', imageForm, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                });
                coverImageUrl = uploadResponse.data.url;
            }
            const payload = {
                titleAr: form.titleAr.trim(),
                titleEn: form.titleEn.trim(),
                descriptionAr: form.descriptionAr.trim(),
                descriptionEn: form.descriptionEn.trim(),
                coverImageUrl,
                isPublished: form.isPublished,
                courseIds: form.courseIds,
            };
            if (editing) {
                await api.patch(`/learning-paths/${editing.id}`, payload);
                toast.success(isAr ? 'تم تحديث المسار' : 'Learning path updated');
            } else {
                await api.post('/learning-paths', payload);
                toast.success(isAr ? 'تم إنشاء المسار' : 'Learning path created');
            }
            closeModal();
            refetch();
        } catch (err) {
            toast.error(getErrorMessage(err) || t('common.error'));
        } finally {
            setSaving(false);
        }
    };

    const remove = async (p: LearningPathData) => {
        if (!confirm(isAr ? `هل أنت متأكد من حذف مسار "${pick(p, 'title')}"؟` : `Delete the path "${pick(p, 'title')}"?`)) return;
        setDeletingId(p.id);
        try {
            await api.delete(`/learning-paths/${p.id}`);
            toast.success(isAr ? 'تم حذف المسار' : 'Learning path deleted');
            refetch();
        } catch (err) {
            toast.error(getErrorMessage(err) || t('common.error'));
        } finally {
            setDeletingId(null);
        }
    };

    const selectedCourses = form.courseIds
        .map((id) => courseData?.find((course) => course.id === id))
        .filter((course): course is CourseOption => !!course);
    const incompleteSelectedCourses = selectedCourses.filter((course) => (course.readiness?.percent ?? 0) < 100);
    const availableCourses = (courseData || []).filter((course) => {
        if (form.courseIds.includes(course.id)) return false;
        const query = courseQuery.trim().toLocaleLowerCase();
        return !query || `${course.titleAr || ''} ${course.titleEn || ''} ${course.categoryAr || ''} ${course.categoryEn || ''}`
            .toLocaleLowerCase()
            .includes(query);
    });

    const moveCourse = (index: number, direction: -1 | 1) => {
        const target = index + direction;
        if (target < 0 || target >= form.courseIds.length) return;
        const courseIds = [...form.courseIds];
        [courseIds[index], courseIds[target]] = [courseIds[target], courseIds[index]];
        setForm({ ...form, courseIds });
    };

    if (!manage && mode === 'manage') {
        return (
            <div className="bg-brand-navy-dark border border-white/5 rounded-2xl p-8 text-center">
                <Lock size={32} className="mx-auto text-gray-600 mb-3" />
                <p className="text-gray-400 font-bold text-sm">
                    {isAr ? 'إدارة المسارات متاحة للمدراء والمدرسين فقط' : 'Path management is available to admins and instructors only'}
                </p>
            </div>
        );
    }

    if (variant === 'featured' && !loading && !error && paths.length === 0) {
        return null;
    }

    return (
        <div id={variant === 'featured' ? 'learning-paths' : undefined} className={variant === 'featured' ? 'space-y-7' : 'space-y-4'}>
            <div className={`flex items-center justify-between gap-4 ${variant === 'featured' ? 'flex-col text-center sm:flex-row sm:text-start' : 'flex-wrap'}`}>
                <div>
                    <h3 className={`flex items-center gap-2 font-black ${variant === 'featured' ? `justify-center text-2xl sm:justify-start sm:text-3xl ${dark ? 'text-white' : 'text-brand-navy'}` : 'text-lg text-white'}`}>
                        <Route size={variant === 'featured' ? 24 : 20} className="text-brand-gold-dark dark:text-brand-gold-light" />
                        {isAr ? 'مسارات التعلم' : 'Learning Paths'}
                        {variant !== 'featured' && <span className="text-xs font-bold text-gray-500">({paths.length})</span>}
                    </h3>
                    {variant === 'featured' && (
                        <p className={`mt-2 max-w-2xl text-sm sm:text-base ${dark ? 'text-gray-400' : 'text-gray-600'}`}>
                            {isAr
                                ? 'خطط تعلم متكاملة ترتب لك الدورات خطوة بخطوة للوصول إلى هدفك.'
                                : 'Curated learning journeys that organize courses step by step to help you reach your goals.'}
                        </p>
                    )}
                </div>
                <div className="flex items-center gap-3">
                    {variant === 'featured' && limit !== undefined && paths.length > limit && (
                        <Link href="/courses#learning-paths" className={`inline-flex items-center gap-1.5 rounded-xl border px-4 py-2.5 text-sm font-bold transition ${dark ? 'border-white/10 text-gray-200 hover:border-brand-gold/50 hover:text-brand-gold-light' : 'border-gray-200 text-brand-navy hover:border-brand-gold hover:text-brand-gold-dark'}`}>
                            {isAr ? 'عرض كل المسارات' : 'View all paths'}
                        </Link>
                    )}
                {manage && (
                    <button
                        onClick={openCreate}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-brand-gold text-brand-navy-dark hover:bg-brand-gold-light transition"
                    >
                        <Plus size={16} /> {isAr ? 'مسار جديد' : 'New Path'}
                    </button>
                )}
                </div>
            </div>

            {manage && coursesWithoutPublishedPath.length > 0 && (
                <div role="status" className="rounded-xl border border-brand-gold/20 bg-brand-gold/5 px-4 py-3">
                    <p className="text-sm font-bold text-brand-gold-light">
                        {isAr
                            ? `${coursesWithoutPublishedPath.length} دورة غير مرتبطة بمسار منشور. أضفها إلى مسار وانشره قبل فتح التسجيل.`
                            : `${coursesWithoutPublishedPath.length} course(s) are not in a published path. Add them to a path and publish it before opening registration.`}
                    </p>
                    <p className="mt-1 text-xs text-gray-400">
                        {coursesWithoutPublishedPath.slice(0, 5).map((course) => pick(course, 'title')).join(isAr ? '، ' : ', ')}
                        {coursesWithoutPublishedPath.length > 5 ? (isAr ? '، والمزيد' : ', and more') : ''}
                    </p>
                </div>
            )}

            {loading ? (
                variant === 'featured' ? (
                    <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
                        {[0, 1, 2].map((item) => (
                            <div key={item} className={`animate-pulse overflow-hidden rounded-3xl border ${dark ? 'border-white/10 bg-brand-navy' : 'border-gray-100 bg-white'}`}>
                                <div className={`h-48 ${dark ? 'bg-white/5' : 'bg-gray-100'}`} />
                                <div className="space-y-3 p-5">
                                    <div className={`h-5 w-3/4 rounded-full ${dark ? 'bg-white/10' : 'bg-gray-100'}`} />
                                    <div className={`h-4 w-full rounded-full ${dark ? 'bg-white/5' : 'bg-gray-50'}`} />
                                    <div className={`h-10 rounded-xl ${dark ? 'bg-white/5' : 'bg-gray-50'}`} />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="flex items-center justify-center py-20">
                        <Loader size={28} className="animate-spin text-brand-gold-light" />
                    </div>
                )
            ) : error ? (
                <div className={`rounded-2xl border p-8 text-center ${variant === 'featured' && !dark ? 'border-red-200 bg-red-50' : 'border-white/5 bg-brand-navy-dark'}`}>
                    <Route size={32} className="mx-auto text-gray-600 mb-3" />
                    <p className={`text-sm font-bold ${variant === 'featured' && !dark ? 'text-red-700' : 'text-gray-400'}`}>{error}</p>
                </div>
            ) : paths.length === 0 ? (
                <div className="bg-brand-navy-dark border border-white/5 rounded-2xl p-10 text-center">
                    <Layers size={32} className="mx-auto text-gray-600 mb-3" />
                    <p className="text-gray-400 font-bold text-sm">{isAr ? 'لا توجد مسارات تعلم بعد' : 'No learning paths yet'}</p>
                </div>
            ) : (
                <div className={`grid grid-cols-1 gap-5 ${variant === 'featured' ? 'md:grid-cols-2 xl:grid-cols-3' : 'md:grid-cols-2 xl:grid-cols-3'}`}>
                    {visiblePaths.map((p, idx) => {
                        const courses = [...(p.courses || [])].sort((a, b) => a.orderIndex - b.orderIndex);
                        const expanded = expandedId === p.id;
                        const pathReadiness = courses.length > 0
                            ? Math.round(courses.reduce((total, item) => total + (item.readiness?.percent ?? 0), 0) / courses.length)
                            : 0;
                        return (
                            <div
                                key={p.id}
                                className={`${variant === 'featured'
                                    ? `${dark ? 'bg-brand-navy border-white/10' : 'bg-white border-gray-100'} rounded-3xl shadow-sm hover:-translate-y-1 hover:shadow-xl ${dark ? 'hover:border-brand-gold/30' : 'hover:border-brand-gold/50 hover:shadow-brand-navy/10'}`
                                    : `bg-brand-navy-dark rounded-2xl ${expanded ? 'border-brand-gold/30' : 'border-white/5 hover:border-white/15'}`
                                } border overflow-hidden flex flex-col transition-all duration-200`}
                            >
                                {/* Cover */}
                                <div className={`relative ${variant === 'featured' ? 'h-48' : 'h-28'} bg-gradient-to-br ${GRADIENTS[idx % GRADIENTS.length]} flex items-end p-4`}>
                                    {p.coverImageUrl ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src={/^https?:\/\//i.test(p.coverImageUrl) ? p.coverImageUrl : `${API_BASE_URL}${p.coverImageUrl}`} alt="" className="absolute inset-0 h-full w-full object-cover opacity-70" />
                                    ) : null}
                                    {variant === 'featured' && <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-black/5" />}
                                    <div className="relative z-10 w-full flex items-start justify-between gap-2">
                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/40 backdrop-blur-sm text-[11px] font-bold text-white border border-white/10">
                                            <BookOpen size={12} className="text-brand-gold-light" />
                                            {courses.length} {isAr ? 'دورة' : courses.length === 1 ? 'course' : 'courses'}
                                        </span>
                                        {mode === 'manage' && (
                                            <span className={`px-2 py-1 rounded-lg text-[10px] font-black backdrop-blur-sm border ${
                                                p.isPublished
                                                    ? 'bg-green-500/20 text-green-300 border-green-500/30'
                                                    : 'bg-gray-900/50 text-gray-400 border-white/10'
                                            }`}>
                                                {p.isPublished ? (isAr ? 'منشور' : 'Published') : (isAr ? 'مسودة' : 'Draft')}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <div className={`${variant === 'featured' ? 'p-5' : 'p-4'} flex-1 flex flex-col`}>
                                    <h4 className={`font-black leading-snug ${variant === 'featured' ? `text-lg ${dark ? 'text-white' : 'text-brand-navy'}` : 'text-white'}`}>{pick(p, 'title')}</h4>
                                    {pick(p, 'description') && (
                                        <p className={`${variant === 'featured' && !dark ? 'text-gray-600' : 'text-gray-400'} mt-1.5 text-xs leading-relaxed line-clamp-2`}>{pick(p, 'description')}</p>
                                    )}

                                    {manage && (
                                        <div className="mt-3 flex items-center justify-between gap-2 text-[11px] font-bold text-gray-400">
                                            <span>{isAr ? 'جاهزية بيانات الدورات' : 'Course information readiness'}</span>
                                            <span className={pathReadiness === 100 ? 'text-emerald-400' : 'text-brand-gold-light'}>{pathReadiness}%</span>
                                        </div>
                                    )}
                                    {manage && (
                                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
                                            <div className="h-full rounded-full bg-brand-gold" style={{ width: `${pathReadiness}%` }} />
                                        </div>
                                    )}
                                    {expanded && (
                                        <div className="mt-4 space-y-2 animate-fade-in">
                                            {courses.length === 0 ? (
                                                <p className="text-[11px] text-gray-500 font-bold">{isAr ? 'لا توجد دورات في هذا المسار بعد' : 'No courses in this path yet'}</p>
                                            ) : (
                                                courses.map((pc, i) => {
                                                    const readiness = pc.readiness;
                                                    return (
                                                        <div key={pc.id} className="space-y-2 rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2.5">
                                                            <div className="flex items-center gap-2.5">
                                                                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-brand-gold/30 bg-brand-gold/15 text-[11px] font-black tabular-nums text-brand-gold-light">
                                                                    {i + 1}
                                                                </span>
                                                                <div className="min-w-0 flex-1">
                                                                    {pc.course?.id ? (
                                                                        <Link href={`/courses/${pc.course.id}`} className="block truncate text-xs font-bold text-gray-200 hover:text-brand-gold-light">
                                                                            {pick(pc.course, 'title') || (isAr ? 'دورة' : 'Course')}
                                                                        </Link>
                                                                    ) : (
                                                                        <span className="block truncate text-xs font-bold text-gray-200">
                                                                            {pick(pc.course, 'title') || (isAr ? 'دورة' : 'Course')}
                                                                        </span>
                                                                    )}
                                                                    {manage && readiness && (
                                                                        <span className={`text-[10px] font-bold ${readiness.percent === 100 ? 'text-emerald-400' : 'text-brand-gold-light'}`}>
                                                                            {isAr ? 'جاهزية الدورة' : 'Course readiness'}: {readiness.percent}%
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            {manage && readiness?.missing.length ? (
                                                                <p className="ps-8 text-[10px] leading-relaxed text-gray-500">
                                                                    {isAr ? 'ناقص: ' : 'Missing: '}
                                                                    {readiness.missing.map((key) => t(`learningPaths.check_${key}`)).join(isAr ? '، ' : ', ')}
                                                                </p>
                                                            ) : null}
                                                            {!manage && pc.course?.id && (
                                                                <Link
                                                                    href={`/courses/${pc.course.id}`}
                                                                    className="ms-8 inline-flex items-center gap-1.5 text-[11px] font-black text-brand-gold-light transition hover:text-brand-gold"
                                                                >
                                                                    {isAr ? 'عرض الدورة والتسجيل' : 'View course and enroll'}
                                                                    <ArrowUpRight size={13} className="rtl:rotate-[-90deg]" />
                                                                </Link>
                                                            )}
                                                        </div>
                                                    );
                                                })
                                            )}
                                        </div>
                                    )}

                                    <div className="mt-auto pt-4 flex items-center gap-2">
                                        <button
                                            onClick={() => setExpandedId(expanded ? null : p.id)}
                                            className={`flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition ${variant === 'featured' && !dark ? 'border-gray-200 bg-white text-brand-navy hover:border-brand-gold hover:bg-brand-gold/5' : 'border-white/10 bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white'}`}
                                        >
                                            {isAr ? 'الدورات' : 'Courses'}
                                            <ChevronDown size={13} className={`transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`} />
                                        </button>
                                        {manage && (
                                            <>
                                                <button
                                                    onClick={() => openEdit(p)}
                                                    className="p-2 rounded-xl bg-brand-gold/10 text-brand-gold-light hover:bg-brand-gold/20 transition-colors"
                                                    title={isAr ? 'تعديل' : 'Edit'}
                                                >
                                                    <Pencil size={14} />
                                                </button>
                                                <button
                                                    onClick={() => remove(p)}
                                                    disabled={deletingId === p.id}
                                                    className="p-2 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50"
                                                    title={isAr ? 'حذف' : 'Delete'}
                                                >
                                                    {deletingId === p.id ? <Loader size={14} className="animate-spin" /> : <Trash2 size={14} />}
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {modalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={closeModal}>
                    <div
                        className="bg-brand-navy border border-white/10 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between p-6 border-b border-white/5">
                            <h3 className="text-lg font-black text-white">
                                {editing ? (isAr ? 'تعديل المسار' : 'Edit Learning Path') : (isAr ? 'مسار تعلم جديد' : 'New Learning Path')}
                            </h3>
                            <button onClick={closeModal} className="text-gray-400 hover:text-white transition-colors">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-6 space-y-5">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-300 mb-1.5">{isAr ? 'العنوان بالعربي' : 'Title (Arabic)'}</label>
                                    <input
                                        type="text"
                                        value={form.titleAr}
                                        onChange={(e) => setForm({ ...form, titleAr: e.target.value })}
                                        dir="rtl"
                                        className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-300 mb-1.5">{isAr ? 'العنوان بالإنجليزي' : 'Title (English)'}</label>
                                    <input
                                        type="text"
                                        value={form.titleEn}
                                        onChange={(e) => setForm({ ...form, titleEn: e.target.value })}
                                        dir="ltr"
                                        className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-300 mb-1.5">{isAr ? 'الوصف بالعربي' : 'Description (Arabic)'}</label>
                                    <textarea
                                        value={form.descriptionAr}
                                        onChange={(e) => setForm({ ...form, descriptionAr: e.target.value })}
                                        rows={3}
                                        dir="rtl"
                                        className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50 resize-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-300 mb-1.5">{isAr ? 'الوصف بالإنجليزي' : 'Description (English)'}</label>
                                    <textarea
                                        value={form.descriptionEn}
                                        onChange={(e) => setForm({ ...form, descriptionEn: e.target.value })}
                                        rows={3}
                                        dir="ltr"
                                        className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50 resize-none"
                                    />
                                </div>
                            </div>
                            <div>
                                <label htmlFor="learning-path-cover" className="mb-1.5 block text-sm font-bold text-gray-300">
                                    {isAr ? 'صورة غلاف المسار (اختياري)' : 'Path cover image (optional)'}
                                </label>
                                <div className="flex flex-col gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3 sm:flex-row sm:items-center">
                                    {(coverFilePreview || form.coverImageUrl) && (
                                        <div className="relative h-24 w-full shrink-0 overflow-hidden rounded-lg bg-white/5 sm:w-40">
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img
                                                src={coverFilePreview || (/^https?:\/\//i.test(form.coverImageUrl) ? form.coverImageUrl : `${API_BASE_URL}${form.coverImageUrl}`)}
                                                alt={isAr ? 'معاينة غلاف المسار' : 'Path cover preview'}
                                                className="h-full w-full object-cover"
                                            />
                                        </div>
                                    )}
                                    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
                                        <label
                                            htmlFor="learning-path-cover"
                                            className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-brand-gold/30 bg-brand-gold/10 px-4 py-2.5 text-sm font-bold text-brand-gold-light transition hover:bg-brand-gold/20"
                                        >
                                            <ImagePlus size={16} />
                                            {isAr ? 'اختيار صورة' : 'Choose image'}
                                        </label>
                                        <input
                                            id="learning-path-cover"
                                            type="file"
                                            accept="image/jpeg,image/png,image/webp,image/gif"
                                            className="sr-only"
                                            onChange={(e) => {
                                                selectCoverImage(e.target.files?.[0]);
                                                e.currentTarget.value = '';
                                            }}
                                        />
                                        <span className="text-xs leading-relaxed text-gray-500">
                                            {coverFile?.name || (isAr ? 'JPG أو PNG أو WEBP أو GIF، بحد أقصى 10 ميجابايت' : 'JPG, PNG, WEBP, or GIF, up to 10 MB')}
                                        </span>
                                        {(coverFilePreview || form.coverImageUrl) && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setCoverFile(null);
                                                    setForm({ ...form, coverImageUrl: '' });
                                                }}
                                                className="ms-auto inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold text-red-300 transition hover:bg-red-500/10"
                                            >
                                                <X size={14} /> {isAr ? 'إزالة الصورة' : 'Remove image'}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <section className="space-y-3">
                                <div className="flex items-center justify-between gap-2">
                                    <h4 className="text-sm font-black text-white">
                                        {isAr ? 'دورات المسار' : 'Path courses'}
                                        <span className="ms-2 text-xs text-gray-500">({form.courseIds.length})</span>
                                    </h4>
                                    <span className="text-[11px] text-gray-500">
                                        {isAr ? 'رتّبها حسب التسلسل المقترح للتعلم' : 'Arrange courses in the recommended learning order'}
                                    </span>
                                </div>

                                {incompleteSelectedCourses.length > 0 && (
                                    <div role="status" className="rounded-xl border border-brand-gold/20 bg-brand-gold/5 p-3">
                                        <p className="text-xs font-black text-brand-gold-light">
                                            {isAr
                                                ? `توجد ${incompleteSelectedCourses.length} دورة تحتاج استكمال بياناتها قبل أن يصبح المسار جاهزًا بالكامل.`
                                                : `${incompleteSelectedCourses.length} selected course(s) need more information before the path is fully ready.`}
                                        </p>
                                        <ul className="mt-2 space-y-1">
                                            {incompleteSelectedCourses.map((course) => (
                                                <li key={course.id} className="text-[10px] leading-relaxed text-gray-400">
                                                    <span className="font-bold text-gray-200">{pick(course, 'title')}: </span>
                                                    {(course.readiness?.missing ?? []).map((key) => t(`learningPaths.check_${key}`)).join(isAr ? '، ' : ', ')}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                {selectedCourses.length > 0 ? (
                                    <ol className="space-y-2">
                                        {selectedCourses.map((course, index) => (
                                            <li key={course.id} className="flex items-center gap-2 rounded-xl border border-brand-gold/20 bg-brand-gold/5 p-2.5">
                                                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-gold/15 text-xs font-black text-brand-gold-light">
                                                    {index + 1}
                                                </span>
                                                <div className="min-w-0 flex-1">
                                                    <p className="truncate text-sm font-bold text-white">{pick(course, 'title')}</p>
                                                    <p className="truncate text-[11px] text-gray-500">
                                                        {pick(course, 'category') || (isAr ? 'بدون تصنيف' : 'Uncategorized')}
                                                        {course.level ? ` · ${course.level}` : ''}
                                                    </p>
                                                    {course.readiness && (
                                                        <p className={`truncate text-[10px] font-bold ${course.readiness.percent === 100 ? 'text-emerald-400' : 'text-brand-gold-light'}`}>
                                                            {isAr ? 'الجاهزية' : 'Readiness'}: {course.readiness.percent}%
                                                        </p>
                                                    )}
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => moveCourse(index, -1)}
                                                    disabled={index === 0}
                                                    aria-label={isAr ? 'تحريك الدورة للأعلى' : 'Move course up'}
                                                    className="rounded-lg p-2 text-gray-400 hover:bg-white/10 hover:text-white disabled:opacity-30"
                                                >
                                                    <ArrowUp size={15} />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => moveCourse(index, 1)}
                                                    disabled={index === selectedCourses.length - 1}
                                                    aria-label={isAr ? 'تحريك الدورة للأسفل' : 'Move course down'}
                                                    className="rounded-lg p-2 text-gray-400 hover:bg-white/10 hover:text-white disabled:opacity-30"
                                                >
                                                    <ArrowDown size={15} />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setForm({ ...form, courseIds: form.courseIds.filter((id) => id !== course.id) })}
                                                    aria-label={isAr ? 'إزالة الدورة' : 'Remove course'}
                                                    className="rounded-lg p-2 text-red-400 hover:bg-red-500/10"
                                                >
                                                    <X size={15} />
                                                </button>
                                            </li>
                                        ))}
                                    </ol>
                                ) : (
                                    <p className="rounded-xl border border-dashed border-white/10 px-4 py-5 text-center text-xs font-bold text-gray-500">
                                        {isAr ? 'لم تتم إضافة دورات إلى هذا المسار بعد' : 'No courses have been added to this path yet'}
                                    </p>
                                )}

                                <div className="space-y-2 rounded-xl border border-white/5 bg-black/10 p-3">
                                    <div className="relative">
                                        <Search size={15} className="absolute start-3 top-1/2 -translate-y-1/2 text-gray-500" />
                                        <input
                                            type="search"
                                            value={courseQuery}
                                            onChange={(e) => setCourseQuery(e.target.value)}
                                            placeholder={isAr ? 'ابحث عن دورة لإضافتها' : 'Search courses to add'}
                                            className="w-full rounded-lg border border-white/10 bg-white/5 py-2 ps-9 pe-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-gold/50"
                                        />
                                    </div>
                                    {coursesLoading ? (
                                        <p className="py-3 text-center text-xs text-gray-500">{isAr ? 'جارٍ تحميل الدورات…' : 'Loading courses…'}</p>
                                    ) : coursesError ? (
                                        <p className="py-3 text-center text-xs text-red-400">{coursesError}</p>
                                    ) : availableCourses.length > 0 ? (
                                        <div className="max-h-44 space-y-1 overflow-y-auto">
                                            {availableCourses.map((course) => (
                                                <button
                                                    key={course.id}
                                                    type="button"
                                                    onClick={() => setForm({ ...form, courseIds: [...form.courseIds, course.id] })}
                                                    className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-start hover:bg-white/5"
                                                >
                                                    <span className="min-w-0">
                                                        <span className="block truncate text-xs font-bold text-gray-200">{pick(course, 'title')}</span>
                                                        <span className="block truncate text-[10px] text-gray-500">{pick(course, 'category') || course.level || ''}</span>
                                                    </span>
                                                    <Plus size={15} className="shrink-0 text-brand-gold-light" />
                                                </button>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="py-3 text-center text-xs text-gray-500">
                                            {isAr ? 'لا توجد دورات مطابقة أو تمت إضافتها كلها' : 'No matching courses, or all courses have been added'}
                                        </p>
                                    )}
                                </div>
                            </section>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={form.isPublished}
                                    onChange={(e) => setForm({ ...form, isPublished: e.target.checked })}
                                    className="w-4 h-4 rounded border-white/20 bg-white/5 accent-brand-gold cursor-pointer"
                                />
                                <span className="text-sm text-gray-300 font-bold">{isAr ? 'منشور (مرئي للطلاب)' : 'Published (visible to students)'}</span>
                            </label>
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-3 p-6 border-t border-white/5">
                            <span className="hidden sm:flex items-center gap-1.5 text-[11px] font-bold text-gray-600">
                                <GraduationCap size={13} />
                                {isAr ? `${form.courseIds.length} دورة محددة` : `${form.courseIds.length} courses selected`}
                            </span>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={closeModal}
                                    className="px-5 py-2.5 rounded-xl text-sm font-bold text-gray-400 hover:text-white hover:bg-white/5 transition-all"
                                >
                                    {isAr ? 'إلغاء' : 'Cancel'}
                                </button>
                                <button
                                    onClick={save}
                                    disabled={saving}
                                    className="px-5 py-2.5 rounded-xl text-sm font-bold bg-brand-gold text-brand-navy-dark hover:bg-brand-gold-light transition-all disabled:opacity-50 flex items-center gap-2"
                                >
                                    {saving && <Loader size={14} className="animate-spin" />}
                                    {editing ? (isAr ? 'تحديث' : 'Update') : (isAr ? 'إنشاء' : 'Create')}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
