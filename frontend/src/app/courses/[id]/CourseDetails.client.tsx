"use client";

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api, API_BASE_URL, getErrorMessage } from '@/lib/api';
import toast from 'react-hot-toast';
import {
    BookOpen, Clock, User, CheckCircle, Loader, Award, Film, Users,
    CalendarDays, Globe, ChevronDown, GraduationCap, PlayCircle, MessagesSquare, ListChecks, Target,
    UploadCloud, FileImage, XCircle, ClipboardList, Settings2
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useI18n } from '@/lib/i18n-context';
import { formatPrice, formatDate } from '@/lib/format';
import PublicMobileMenu from '@/components/PublicMobileMenu';
import CourseChat from '@/components/CourseChat';
import StudentTasksPanel from '@/components/StudentTasksPanel';
import StudentGradesPanel from '@/components/StudentGradesPanel';
import RosterGrades from '@/components/RosterGrades';
import TasksPanel from '@/components/TasksPanel';
import LessonExplorer from '@/components/LessonExplorer';
import InstructorRating from '@/components/InstructorRating';

export interface Module {
    id: string;
    titleAr?: string | null;
    titleEn?: string | null;
    descriptionAr?: string | null;
    descriptionEn?: string | null;
    videoUrl?: string | null;
    isFree?: boolean | null;
    durationMinutes?: number | null;
    outcomes?: { descriptionAr?: string | null; descriptionEn?: string | null }[];
    files?: { url: string; nameAr?: string | null; nameEn?: string | null }[] | null;
    links?: { url: string; labelAr?: string | null; labelEn?: string | null }[] | null;
}

export interface Chapter {
    id: string;
    titleAr?: string | null;
    titleEn?: string | null;
    modules?: Module[] | null;
}

export interface Opening {
    id: string;
    status?: string | null;
    nameAr?: string | null;
    nameEn?: string | null;
    startDate?: string | null;
    endDate?: string | null;
    enrollmentDeadline?: string | null;
    price: string;
    priceOld?: string | null;
    maxStudents?: number | null;
    instructor?: { id: string; email: string } | null;
    _count?: { enrollments?: number };
}

export interface Course {
    id: string;
    titleAr: string;
    titleEn: string;
    descriptionAr?: string | null;
    descriptionEn?: string | null;
    syllabusAr?: string | null;
    syllabusEn?: string | null;
    durationAr?: string | null;
    durationEn?: string | null;
    createdAt?: string | null;
    level?: string | null;
    language?: string | null;
    categoryAr?: string | null;
    categoryEn?: string | null;
    excerptAr?: string | null;
    excerptEn?: string | null;
    coverImageUrl?: string | null;
    introVideoUrl?: string | null;
    videoFileUrl?: string | null;
    hoursOfContent?: number | null;
    certificateIssued?: boolean | null;
    quizzesIncluded?: boolean | null;
    projectsIncluded?: boolean | null;
    assignmentsIncluded?: boolean | null;
    liveSessionsIncluded?: boolean | null;
    downloadableResources?: boolean | null;
    lifetimeAccess?: boolean | null;
    communityAccess?: boolean | null;
    objectives?: { objectiveAr?: string | null; objectiveEn?: string | null }[];
    prerequisites?: { prerequisiteAr?: string | null; prerequisiteEn?: string | null }[];
    audiences?: { audienceAr?: string | null; audienceEn?: string | null }[];
    faqs?: { questionAr?: string | null; questionEn?: string | null; answerAr?: string | null; answerEn?: string | null }[];
    gallery?: { url: string }[];
    instructor?: { id: string; email: string } | null;
    openings?: Opening[];
    modules?: Module[];
    chapters?: Chapter[];
    _count?: { enrollments?: number; modules?: number };
}

const SectionTitle = ({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) => (
    <div className="flex flex-col gap-2 mb-5">
        <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0">
                {icon}
            </div>
            <h2 className="text-xl md:text-2xl font-black text-white">{children}</h2>
        </div>
        <div className="w-12 h-1 bg-amber-500/30 rounded-full ms-[52px]" />
    </div>
);

export default function CourseDetailsPage({ initialCourse }: { initialCourse?: Course | null }) {
    const { id } = useParams();
    const router = useRouter();
    const { user } = useAuth();
    const { t, locale, pick } = useI18n();
    const [course, setCourse] = useState<Course | null>(initialCourse ?? null);
    const [loading, setLoading] = useState(!initialCourse);
    const [openFaq, setOpenFaq] = useState<number | null>(null);
    const [selectedOpening, setSelectedOpening] = useState<Opening | null>(null);

    // --- Mode detection ---
    const isStudent = user?.role === 'STUDENT';
    const isInstructor = user?.role === 'INSTRUCTOR';
    let mode: 'guest' | 'student' | 'instructor' = 'guest';
    if (isStudent) {
        const enrolled = course?.openings?.some(o => o.status === 'OPEN' || o.status === 'ANNOUNCEMENT' || o.status === 'STARTED') ? true : false;
        if (enrolled || (course?.openings?.length ?? 0) > 0) mode = 'student';
        else mode = 'guest';
    } else if (isInstructor) {
        const teaches = course?.openings?.some(o => o.instructor?.id === user?.userId);
        mode = teaches ? 'instructor' : 'guest';
    } else {
        mode = 'guest';
    }
    const [receiptFile, setReceiptFile] = useState<File | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [activeTab, setActiveTab] = useState<'overview' | 'tasks' | 'grades' | 'chat' | 'roster'>('overview');

    const instructorOpeningId = course?.openings?.find(o => o.instructor?.id === user?.userId)?.id ?? null;

    // --- Tabs render ---
    const renderTabs = () => {
        const item = (key: typeof activeTab, icon: React.ReactNode, label: string) => (
            <button
                onClick={() => setActiveTab(key)}
                className={`relative inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 cursor-pointer ${
                    activeTab === key
                        ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
                }`}
            >
                {icon}
                {label}
                {activeTab === key && <span className="absolute bottom-0 left-3 right-3 h-1 bg-amber-400 rounded-full" />}
            </button>
        );
        return (
            <div className="sticky top-20 z-30 mb-8">
                <div className="inline-flex flex-wrap gap-1 bg-[#111f3a] backdrop-blur-md rounded-2xl border border-white/5 p-1.5 shadow-xl shadow-black/20">
                    {item('overview', <BookOpen size={18} />, t('courseDetail.tab_overview'))}
                    {mode === 'student' && item('tasks', <ClipboardList size={18} />, t('courseDetail.tab_tasks'))}
                    {mode === 'student' && item('grades', <GraduationCap size={18} />, t('courseDetail.tab_grades'))}
                    {mode !== 'guest' && item('chat', <MessagesSquare size={18} />, t('courseDetail.tab_chat'))}
                    {mode === 'instructor' && item('tasks', <Settings2 size={18} />, t('courseDetail.tab_tasks'))}
                    {mode === 'instructor' && item('roster', <Settings2 size={18} />, t('courseDetail.tab_roster'))}
                </div>
            </div>
        );
    };

    useEffect(() => {
        if (!id || initialCourse) return;
        const fetchCourse = async () => {
            try {
                const res = await api.get(`/courses/${id}`);
                setCourse(res.data as Course);
            } catch {
                toast.error(t('courseDetail.failed_load'));
            } finally {
                setLoading(false);
            }
        };
        fetchCourse();
    }, [id, t, initialCourse]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setReceiptFile(e.target.files[0]);
        }
    };

    const handleEnrollSubmit = async () => {
        if (!selectedOpening) return;
        if (!receiptFile) {
            toast.error(t('explore.upload_receipt_required'));
            return;
        }
        setIsSubmitting(true);
        try {
            const formData = new FormData();
            formData.append('openingId', selectedOpening.id);
            formData.append('receipt', receiptFile);
            await api.post('/enrollments', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            toast.success(t('explore.review_success'));
            setSelectedOpening(null);
            setReceiptFile(null);
        } catch (e) {
            toast.error(getErrorMessage(e) || t('courseDetail.enroll_failed'));
        } finally {
            setIsSubmitting(false);
        }
    };

    if (loading) return <div className="min-h-screen flex items-center justify-center bg-[#0a1830]"><Loader className="animate-spin text-amber-400" size={48} /></div>;
    if (!course) return <div className="min-h-screen flex items-center justify-center bg-[#0a1830] text-red-400 font-bold text-2xl">{t('courseDetail.not_found')}</div>;

    const levelLabel = (lvl?: string | null) => t(`course.level_${String(lvl || 'BEGINNER').toLowerCase()}`);
    const fmtDate = (d?: string | null) => formatDate(d, { locale });

    const opening = course.openings?.find(o => o.status === 'OPEN') || null;
    const announced = course.openings?.find(o => o.status === 'ANNOUNCEMENT') || null;
    const metaOpening = opening || announced;
    const courseInstructor = metaOpening?.instructor || course.instructor;
    const enrolledCount = course._count?.enrollments ?? metaOpening?._count?.enrollments ?? 0;

    const getVideoUrl = (url?: string | null) => {
        if (!url) return null;
        const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{6,})/);
        const vm = url.match(/vimeo\.com\/(\d+)/);
        if (yt) return { type: 'embed', src: `https://www.youtube.com/embed/${yt[1]}` } as const;
        if (vm) return { type: 'embed', src: `https://player.vimeo.com/video/${vm[1]}` } as const;
        if (url.startsWith('/uploads') || /\.(mp4|webm|mov)$/i.test(url)) return { type: 'file', src: url } as const;
        return { type: 'embed', src: url } as const;
    };

    const handleReserveClick = async () => {
        if (!user) {
            toast.error(t('courseDetail.login_to_reserve'));
            router.push(`/login?redirect=/courses/${id}`);
            return;
        }
        try {
            await api.post('/enrollments/reserve', { courseId: id });
            toast.success(t('courseDetail.seat_reserved'));
            router.push('/dashboard/my-courses');
        } catch (e) {
            toast.error(getErrorMessage(e) || t('courseDetail.reserve_failed'));
        }
    };

    const features: { key: keyof Course; label: string }[] = [
        { key: 'certificateIssued', label: t('courseDetail.certificate_label') },
        { key: 'quizzesIncluded', label: t('createCourse.feat_quizzes') },
        { key: 'projectsIncluded', label: t('createCourse.feat_projects') },
        { key: 'assignmentsIncluded', label: t('createCourse.feat_assignments') },
        { key: 'liveSessionsIncluded', label: t('createCourse.feat_live_sessions') },
        { key: 'downloadableResources', label: t('createCourse.feat_downloadable') },
        { key: 'lifetimeAccess', label: t('createCourse.feat_lifetime') },
        { key: 'communityAccess', label: t('createCourse.feat_community') },
    ];
    const included = features.filter(f => !!course[f.key]);

    const introVideo = getVideoUrl(course.introVideoUrl) || getVideoUrl(course.videoFileUrl);

    return (
        <div className="min-h-screen bg-[#0a1830] pb-20">
            <style>{`
                html { scroll-behavior: smooth; }
                @keyframes fadeInUp {
                    from { opacity: 0; transform: translateY(24px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .animate-fade-in-up { animation: fadeInUp 0.6s ease-out both; }
                .fade-in-section { opacity: 0; transform: translateY(20px); transition: opacity 0.5s ease-out, transform 0.5s ease-out; }
                .fade-in-section.visible { opacity: 1; transform: translateY(0); }
            `}</style>

            {/* Header */}
            <header className="px-8 py-6 flex items-center justify-between border-b border-white/5 bg-[#0a1830] sticky top-0 z-50">
                <div className="flex items-center gap-2">
                    <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-lg">
                        <span className="text-brand-gold-dark font-black text-xl">L</span>
                    </div>
                    <h1 className="text-2xl font-black text-white tracking-tight">
                        laxa<span className="text-brand-gold">lab</span>
                    </h1>
                </div>
                <nav className="hidden md:flex items-center gap-8">
                    <button onClick={() => router.push('/courses')} className="text-gray-300 font-bold hover:text-white transition">
                        {t('landing.explore_courses')}
                    </button>
                    <button onClick={() => router.push('/join-as-instructor')} className="text-gray-300 font-bold hover:text-white transition">
                        {t('landing.join_as_instructor')}
                    </button>
                </nav>
                <div className="flex items-center gap-4">
                    <PublicMobileMenu dark />
                    <div className="hidden sm:flex items-center gap-4">
                        {user ? (
                            <button onClick={() => router.push('/dashboard')} className="bg-brand-gold text-brand-navy hover:bg-white px-6 py-2.5 rounded-xl font-bold transition-all duration-300 shadow-md">
                                {t('courseDetail.dashboard')}
                            </button>
                        ) : (
                            <>
                                <button onClick={() => router.push('/login')} className="text-white hover:text-brand-gold font-bold transition">
                                    {t('auth.login')}
                                </button>
                                <button onClick={() => router.push('/register')} className="bg-brand-gold text-brand-navy hover:bg-white px-6 py-2.5 rounded-xl font-bold transition-all duration-300 shadow-md">
                                    {t('auth.register')}
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </header>

            {/* Hero Section */}
            <div className="relative overflow-hidden bg-gradient-to-br from-[#0a1830] via-[#0d1f3c] to-[#132a50] min-h-[480px]">
                {course.coverImageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={`${API_BASE_URL}${course.coverImageUrl}`} alt="" className="absolute inset-0 w-full h-full object-cover opacity-15" aria-hidden />
                )}
                <div className="absolute inset-0 bg-gradient-to-br from-[#0a1830]/70 via-[#0d1f3c]/85 to-[#0a1830]/95" aria-hidden />
                <div className="absolute -top-24 -start-24 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl" aria-hidden />
                <div className="absolute top-1/2 end-0 w-72 h-72 bg-amber-500/8 rounded-full blur-3xl" aria-hidden />
                <div className="absolute bottom-0 start-1/3 w-80 h-80 bg-blue-500/8 rounded-full blur-3xl" aria-hidden />
                <div className="absolute bottom-0 end-0 w-80 h-80 bg-amber-500/5 rounded-full blur-3xl" aria-hidden />

                <div className="relative max-w-6xl mx-auto px-6 md:px-10 pt-16 md:pt-20 pb-24 md:pb-28 grid lg:grid-cols-[1.2fr_1fr] gap-12 items-center">
                    {/* Left */}
                    <div className="animate-fade-in-up">
                        {/* Breadcrumb */}
                        <nav className="flex items-center gap-2 text-xs font-bold text-gray-400 mb-6 flex-wrap">
                            <button onClick={() => router.push('/')} className="hover:text-amber-400 transition cursor-pointer">{t('landing.home')}</button>
                            <span className="text-amber-400">/</span>
                            <button onClick={() => router.push('/courses')} className="hover:text-amber-400 transition cursor-pointer">{t('landing.explore_courses')}</button>
                            <span className="text-amber-400">/</span>
                            <span className="text-amber-400 truncate max-w-[200px]">{pick(course, 'title')}</span>
                        </nav>

                        <div className="flex flex-wrap items-center gap-2 mb-5">
                            {pick(course, 'duration') && (
                                <span className="bg-brand-gold text-brand-navy font-black text-xs px-3 py-1.5 rounded-full uppercase tracking-wider shadow-sm">
                                    {pick(course, 'duration')}
                                </span>
                            )}
                            {pick(course, 'category') && (
                                <span className="bg-white/10 border border-white/20 text-white font-bold text-xs px-3 py-1.5 rounded-full">
                                    {pick(course, 'category')}
                                </span>
                            )}
                            <span className="bg-white/10 border border-white/20 text-white font-bold text-xs px-3 py-1.5 rounded-full">
                                {levelLabel(course.level)}
                            </span>
                            {course.language && (
                                <span className="bg-white/10 border border-white/20 text-white font-bold text-xs px-3 py-1.5 rounded-full">
                                    <Globe size={11} className="inline me-1" />{course.language}
                                </span>
                            )}
                        </div>

                        <h1 className="text-4xl md:text-5xl lg:text-6xl font-black text-white mb-6 leading-[1.08] tracking-tight" style={{ textShadow: '0 2px 24px rgba(0,0,0,0.5)' }}>{pick(course, 'title')}</h1>
                        {(pick(course, 'excerpt') || pick(course, 'description')) && (
                            <p className="text-lg md:text-xl text-gray-300 max-w-2xl mb-8 font-medium leading-relaxed">
                                {pick(course, 'excerpt') || pick(course, 'description')}
                            </p>
                        )}

                        {/* Stats */}
                        <div className="flex flex-wrap gap-3 mb-8">
                            <div className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3 flex items-center gap-3 backdrop-blur-md hover:border-amber-500/20 transition">
                                <div className="w-9 h-9 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-400">
                                    <Clock size={17} />
                                </div>
                                <div>
                                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{t('explore.duration')}</div>
                                    <div className="text-sm font-black text-white">{pick(course, 'duration') || t('courseDetail.self_paced')}</div>
                                </div>
                            </div>
                            {course.hoursOfContent ? (
                                <div className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3 flex items-center gap-3 backdrop-blur-md hover:border-amber-500/20 transition">
                                    <div className="w-9 h-9 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-400">
                                        <PlayCircle size={17} />
                                    </div>
                                    <div>
                                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{t('courseDetail.hours_label')}</div>
                                        <div className="text-sm font-black text-white">{course.hoursOfContent}</div>
                                    </div>
                                </div>
                            ) : null}
                            {enrolledCount ? (
                                <div className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3 flex items-center gap-3 backdrop-blur-md hover:border-amber-500/20 transition">
                                    <div className="w-9 h-9 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-400">
                                        <Users size={17} />
                                    </div>
                                    <div>
                                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{t('explore.students')}</div>
                                        <div className="text-sm font-black text-white">{enrolledCount}</div>
                                    </div>
                                </div>
                            ) : null}
                            <div className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3 flex items-center gap-3 backdrop-blur-md hover:border-amber-500/20 transition">
                                <div className="w-9 h-9 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-400">
                                    <User size={17} />
                                </div>
                                <div>
                                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{t('courseDetail.expert_instructor')}</div>
                                    <div className="text-sm font-black text-white max-w-[160px] truncate">{courseInstructor?.email || t('courseDetail.expert_instructor')}</div>
                                    {courseInstructor?.id && (
                                        <InstructorRating
                                            instructorId={courseInstructor.id}
                                            courseId={course.id}
                                            showRateButton={!!opening}
                                        />
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* CTA */}
                        <div className="flex flex-wrap items-center gap-3">
                            {opening ? (
                                <>
                                    <button onClick={() => setSelectedOpening(opening)} className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black flex items-center gap-3 font-black py-4 px-8 rounded-2xl shadow-xl shadow-amber-500/25 hover:shadow-[0_0_30px_rgba(245,158,11,0.45)] transition-all transform hover:-translate-y-0.5 cursor-pointer animate-[pulse_2.5s_ease-in-out_infinite] hover:animate-none">
                                        <BookOpen size={20} />
                                        {Number(opening.price) === 0 ? t('course.free') : `${t('courseDetail.enroll_for')} ${formatPrice(opening.price, { locale })}`}
                                    </button>
                                    {opening.priceOld && Number(opening.priceOld) > Number(opening.price) && (
                                        <span className="text-gray-300 text-sm font-semibold">
                                            {t('courseDetail.was_price')} <s className="text-gray-500">{formatPrice(opening.priceOld, { locale })}</s>
                                        </span>
                                    )}
                                    {announced && (
                                        <button onClick={handleReserveClick} className="bg-white/10 hover:bg-white/15 border border-white/20 text-white flex items-center gap-2 font-bold py-4 px-8 rounded-2xl transition transform hover:-translate-y-0.5 cursor-pointer">
                                            {t('courseDetail.reserve_seat')}
                                        </button>
                                    )}
                                </>
                            ) : announced ? (
                                <button onClick={handleReserveClick} className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black flex items-center gap-3 font-black py-4 px-8 rounded-2xl shadow-xl shadow-amber-500/25 hover:shadow-[0_0_30px_rgba(245,158,11,0.45)] transition-all transform hover:-translate-y-0.5 cursor-pointer animate-[pulse_2.5s_ease-in-out_infinite] hover:animate-none">
                                    <BookOpen size={20} />
                                    {t('courseDetail.reserve_seat')}
                                </button>
                            ) : (
                                <div className="bg-white/5 border border-white/15 text-gray-400 font-bold py-3 px-7 rounded-2xl">
                                    {t('courseDetail.not_open_yet')}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right: cover card */}
                    <div className="hidden lg:block animate-fade-in-up">
                        <div className="relative">
                            <div className="absolute -inset-3 bg-gradient-to-tr from-amber-500/30 to-transparent rounded-[2rem] blur-2xl opacity-50" aria-hidden />
                            <div className="relative rounded-[1.75rem] overflow-hidden border border-white/15 shadow-2xl shadow-black/40 hover:scale-[1.02] transition-transform duration-500">
                                {course.coverImageUrl ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={`${API_BASE_URL}${course.coverImageUrl}`} alt={pick(course, 'title') || ''} className="w-full aspect-[4/3] object-cover" />
                                ) : (
                                    <div className="w-full aspect-[4/3] bg-gradient-to-br from-[#132a50] to-[#0a1830] flex items-center justify-center">
                                        <BookOpen size={72} className="text-amber-400/30" />
                                    </div>
                                )}
                                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#0a1830]/95 to-transparent p-6 pt-16">
                                    <div className="flex items-center justify-between gap-4">
                                        <div>
                                            <div className="text-[10px] font-bold text-amber-400 uppercase tracking-[0.2em] mb-1">
                                                {opening ? (Number(opening.price) === 0 ? t('course.free') : formatPrice(opening.price, { locale })) : t('courseDetail.not_open_yet')}
                                            </div>
                                            <div className="text-white font-black text-2xl">{pick(course, 'title')}</div>
                                        </div>
                                        {course._count?.modules ? (
                                            <div className="bg-white/15 backdrop-blur-sm rounded-2xl px-4 py-3 text-center shrink-0">
                                                <div className="text-xl font-black text-amber-400">{course._count.modules}</div>
                                                <div className="text-[10px] font-bold text-white/70">{t('course.modules')}</div>
                                            </div>
                                        ) : null}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-6xl mx-auto px-4 md:px-6 -mt-10 relative z-20">
                {mode !== 'guest' && renderTabs()}
                <div className="bg-[#0d1f3c] rounded-3xl shadow-2xl shadow-black/20 border border-white/5 p-6 md:p-12 animate-fade-in-up">

                    {mode !== 'guest' && activeTab !== 'overview' ? (
                        <>
                            {activeTab === 'tasks' && mode === 'instructor' && instructorOpeningId && <TasksPanel openingId={instructorOpeningId} />}
                            {activeTab === 'tasks' && mode === 'student' && <StudentTasksPanel courseId={course.id} />}
                            {activeTab === 'grades' && mode === 'student' && <StudentGradesPanel courseId={course.id} />}
                            {activeTab === 'chat' && <CourseChat courseId={course.id} />}
                            {activeTab === 'roster' && mode === 'instructor' && instructorOpeningId && <RosterGrades openingId={instructorOpeningId} />}
                        </>
                    ) : (
                        <>

                    {/* Intro Video */}
                    {introVideo && (
                        <div className="mb-10">
                            <SectionTitle icon={<Film size={18} />}>{t('courseDetail.intro_video')}</SectionTitle>
                            <div className="rounded-2xl overflow-hidden shadow-lg border border-white/10 aspect-video bg-black">
                                {introVideo.type === 'embed' ? (
                                    <iframe src={introVideo.src} title="Intro" className="w-full h-full" allowFullScreen allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" />
                                ) : (
                                    <video src={`${API_BASE_URL}${introVideo.src}`} controls className="w-full h-full" />
                                )}
                            </div>
                        </div>
                    )}

                    {/* Lesson explorer */}
                    {course.modules && course.modules.length > 0 && (
                        <div className="mb-12">
                            <LessonExplorer courseId={course.id} modules={course.modules || []} chapters={course.chapters} openingId={instructorOpeningId} mode={mode} />
                        </div>
                    )}

                    <div className="grid md:grid-cols-3 gap-12">
                        {/* Highlights */}
                        <div className="md:col-span-2 space-y-10">

                            {/* About */}
                            {(pick(course, 'description') || pick(course, 'syllabus')) && (
                                <div>
                                    <SectionTitle icon={<BookOpen size={18} />}>{t('courseDetail.about_heading')}</SectionTitle>
                                    {pick(course, 'description') && (
                                        <p className="text-gray-300 whitespace-pre-wrap leading-relaxed mb-6">{pick(course, 'description')}</p>
                                    )}
                                    {pick(course, 'syllabus') && (
                                        <div>
                                            <h3 className="text-lg font-bold text-white mb-2">{t('courseDetail.syllabus_heading')}</h3>
                                            <p className="text-gray-300 whitespace-pre-wrap leading-relaxed bg-[#111f3a] border border-white/5 rounded-2xl p-5">
                                                {pick(course, 'syllabus') || t('courseDetail.syllabus_fallback')}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* What you'll learn */}
                            {course.objectives && course.objectives.length > 0 && (
                                <div className="bg-amber-500/5 border border-amber-500/10 rounded-3xl p-6">
                                    <SectionTitle icon={<GraduationCap size={18} />}>{t('courseDetail.learn_heading')}</SectionTitle>
                                    <div className="grid sm:grid-cols-2 gap-3">
                                        {course.objectives.map((o, idx) => (
                                            <div key={idx} className="flex items-start gap-3 bg-[#111f3a] border border-white/5 rounded-xl p-4 hover:border-amber-500/20 transition">
                                                <CheckCircle size={18} className="text-emerald-400 mt-0.5 flex-shrink-0" />
                                                <span className="text-sm text-gray-300 font-medium">{pick(o, 'objective')}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Prerequisites */}
                            {course.prerequisites && course.prerequisites.length > 0 && (
                                <div>
                                    <SectionTitle icon={<Target size={18} />}>{t('courseDetail.prereq_heading')}</SectionTitle>
                                    <ul className="space-y-3">
                                        {course.prerequisites.map((p, idx) => (
                                            <li key={idx} className="flex items-start gap-3">
                                                <ListChecks size={18} className="text-amber-400 mt-0.5 flex-shrink-0" />
                                                <span className="text-gray-300 font-medium">{pick(p, 'prerequisite')}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* Audience */}
                            {course.audiences && course.audiences.length > 0 && (
                                <div>
                                    <SectionTitle icon={<Users size={18} />}>{t('courseDetail.audience_heading')}</SectionTitle>
                                    <ul className="space-y-3">
                                        {course.audiences.map((a, idx) => (
                                            <li key={idx} className="flex items-start gap-3">
                                                <CheckCircle size={18} className="text-amber-400 mt-0.5 flex-shrink-0" />
                                                <span className="text-gray-300 font-medium">{pick(a, 'audience')}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* FAQ */}
                            {course.faqs && course.faqs.length > 0 && (
                                <div>
                                    <SectionTitle icon={<MessagesSquare size={18} />}>{t('courseDetail.faq_heading')}</SectionTitle>
                                    <div className="space-y-3">
                                        {course.faqs.map((f, idx) => (
                                            <div key={idx} className="border border-white/5 rounded-2xl overflow-hidden bg-[#111f3a]">
                                                <button
                                                    onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                                                    className="w-full flex items-center justify-between gap-3 p-4 text-left font-bold text-white hover:bg-white/5 transition"
                                                >
                                                    <span>{pick(f, 'question')}</span>
                                                    <ChevronDown size={18} className={`text-amber-400 flex-shrink-0 transition-transform ${openFaq === idx ? 'rotate-180' : ''}`} />
                                                </button>
                                                {openFaq === idx && (
                                                    <p className="px-4 pb-4 text-gray-300 text-sm leading-relaxed">{pick(f, 'answer')}</p>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Gallery */}
                            {course.gallery && course.gallery.length > 0 && (
                                <div>
                                    <SectionTitle icon={<Award size={18} />}>{t('courseDetail.course_gallery')}</SectionTitle>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                        {course.gallery.map((g, idx) => (
                                            <a key={idx} href={`${API_BASE_URL}${g.url}`} target="_blank" rel="noreferrer" className="group overflow-hidden rounded-2xl border border-white/5 hover:border-amber-500/20">
                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                <img src={`${API_BASE_URL}${g.url}`} alt={`gallery-${idx}`} className="w-full h-32 object-cover group-hover:scale-105 transition-transform duration-500" />
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Sidebar Info */}
                        <div className="space-y-6 lg:sticky lg:top-24 self-start">
                            <div className="rounded-3xl overflow-hidden border border-white/5 shadow-2xl shadow-black/20 bg-[#111f3a] border-t-2 border-t-amber-400 animate-fade-in-up">
                                <div className="bg-gradient-to-r from-amber-500/10 to-transparent px-6 py-4 flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-400">
                                        <BookOpen size={16} />
                                    </div>
                                    <h2 className="font-black text-amber-400 uppercase tracking-wider text-sm">{t('courseDetail.course_details')}</h2>
                                </div>
                                <div className="p-6 space-y-1">
                                    {[
                                        { icon: <Clock size={16} />, label: pick(course, 'duration') || t('courseDetail.self_paced') },
                                        { icon: <User size={16} />, label: courseInstructor?.email || t('courseDetail.expert_instructor') },
                                        course.categoryAr ? { icon: <ListChecks size={16} />, label: `${t('courseDetail.category_label')}: ${pick(course, 'category')}` } : null,
                                        { icon: <GraduationCap size={16} />, label: `${t('courseDetail.level_label')}: ${levelLabel(course.level)}` },
                                        course.language ? { icon: <Globe size={16} />, label: `${t('courseDetail.language_label')}: ${course.language}` } : null,
                                        course.hoursOfContent ? { icon: <PlayCircle size={16} />, label: `${t('courseDetail.hours_label')}: ${course.hoursOfContent}` } : null,
                                        enrolledCount ? { icon: <Users size={16} />, label: `${enrolledCount} ${t('courseDetail.student_label')}` } : null,
                                        metaOpening?.maxStudents ? { icon: <Users size={16} />, label: `${t('createCourse.max_students_label')}: ${metaOpening.maxStudents}` } : null,
                                        fmtDate(metaOpening?.startDate) ? { icon: <CalendarDays size={16} />, label: `${t('courseDetail.starts_label')}: ${fmtDate(metaOpening?.startDate)}` } : null,
                                        fmtDate(metaOpening?.endDate) ? { icon: <CalendarDays size={16} />, label: `${t('courseDetail.ends_label')}: ${fmtDate(metaOpening?.endDate)}` } : null,
                                        fmtDate(metaOpening?.enrollmentDeadline) ? { icon: <CalendarDays size={16} />, label: `${t('courseDetail.deadline_label')}: ${fmtDate(metaOpening?.enrollmentDeadline)}` } : null,
                                    ].filter(Boolean).map((row, idx) => row && (
                                        <div key={idx} className="flex items-center gap-3 py-2.5 text-gray-300 font-medium text-sm border-b border-white/5 last:border-0">
                                            <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-400 shrink-0">
                                                {row.icon}
                                            </div>
                                            <span className="truncate">{row.label}</span>
                                        </div>
                                    ))}
                                    {metaOpening && (
                                        <div className="flex items-center gap-3 py-3 mt-1">
                                            <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
                                                <BookOpen size={16} />
                                            </div>
                                            <span className="font-black text-amber-400 text-3xl">
                                                {Number(metaOpening.price) === 0 ? t('course.free') : formatPrice(metaOpening.price, { locale })}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Included features */}
                            {included.length > 0 && (
                                <div className="rounded-3xl border border-white/5 p-6 shadow-sm bg-[#111f3a] animate-fade-in-up">
                                    <h2 className="font-black text-white mb-4 flex items-center gap-2 text-sm uppercase tracking-wider">
                                        <span className="w-1 h-5 bg-amber-400 rounded-full" /> {t('courseDetail.features_heading')}
                                    </h2>
                                    <ul className="space-y-2.5">
                                        {included.map((f, idx) => (
                                            <li key={idx} className="flex items-start gap-2.5">
                                                <span className="w-5 h-5 rounded-full bg-emerald-500/15 text-emerald-400 flex items-center justify-center mt-0.5 flex-shrink-0">
                                                    <CheckCircle size={13} />
                                                </span>
                                                <span className="text-sm text-gray-300 font-medium">{f.label}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            <div className="rounded-3xl border border-white/5 p-6 shadow-sm bg-[#111f3a] animate-fade-in-up">
                                <h2 className="font-black text-white mb-4 flex items-center gap-2 text-sm uppercase tracking-wider">
                                    <span className="w-1 h-5 bg-amber-400 rounded-full" /> {t('courseDetail.achievements')}
                                </h2>
                                <ul className="space-y-2.5">
                                    <li className="flex items-start gap-2.5">
                                        <span className="w-5 h-5 rounded-full bg-emerald-500/15 text-emerald-400 flex items-center justify-center mt-0.5 flex-shrink-0">
                                            <CheckCircle size={13} />
                                        </span>
                                        <span className="text-sm text-gray-300 font-medium">{t('courseDetail.achievement_1')}</span>
                                    </li>
                                    <li className="flex items-start gap-2.5">
                                        <span className="w-5 h-5 rounded-full bg-emerald-500/15 text-emerald-400 flex items-center justify-center mt-0.5 flex-shrink-0">
                                            <CheckCircle size={13} />
                                        </span>
                                        <span className="text-sm text-gray-300 font-medium">{t('courseDetail.achievement_2')}</span>
                                    </li>
                                    <li className="flex items-start gap-2.5">
                                        <span className="w-5 h-5 rounded-full bg-emerald-500/15 text-emerald-400 flex items-center justify-center mt-0.5 flex-shrink-0">
                                            <CheckCircle size={13} />
                                        </span>
                                        <span className="text-sm text-gray-300 font-medium">{t('courseDetail.achievement_3')}</span>
                                    </li>
                                </ul>
                            </div>
                        </div>
                    </div>

                        </>
                    )}

                </div>
            </div>

            {/* Enrollment Modal with Receipt Upload */}
            {selectedOpening && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-[#0d1f3c] border border-white/10 rounded-3xl w-full max-w-lg p-8 shadow-2xl transform transition-all max-h-[90vh] overflow-y-auto">
                        <h2 className="text-2xl font-black text-white mb-2">
                            {t('explore.enroll_in')} {pick(course, 'title')}
                        </h2>
                        <p className="text-gray-300 mb-6">
                            {t('explore.transfer_part1')} <strong className="text-amber-400">{formatPrice(selectedOpening.price, { locale })}</strong> {t('explore.transfer_part2')}
                        </p>

                        {!receiptFile ? (
                            <div
                                onClick={() => fileInputRef.current?.click()}
                                className="border-2 border-dashed border-amber-500/30 bg-amber-500/5 rounded-xl p-8 flex flex-col items-center justify-center text-white font-semibold cursor-pointer hover:bg-amber-500/10 transition group"
                            >
                                <UploadCloud size={40} className="mb-3 text-amber-400 group-hover:scale-110 transition-transform" />
                                <span>{t('payment.attach_receipt')}</span>
                                <span className="text-xs text-gray-400 font-normal mt-2">{t('explore.supports_formats')}</span>
                                <input type="file" className="hidden" ref={fileInputRef} onChange={handleFileChange} accept=".jpg,.jpeg,.png,.pdf" />
                            </div>
                        ) : (
                            <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center justify-between">
                                <div className="flex items-center space-x-3 rtl:space-x-reverse overflow-hidden">
                                    <FileImage size={24} className="text-amber-400 flex-shrink-0" />
                                    <span className="font-semibold text-gray-200 truncate" dir="ltr">{receiptFile.name}</span>
                                </div>
                                <button onClick={() => setReceiptFile(null)} className="text-red-400 hover:text-red-300 transition flex-shrink-0">
                                    <XCircle size={20} />
                                </button>
                            </div>
                        )}

                        <div className="flex gap-4 mt-8">
                            <button
                                onClick={handleEnrollSubmit}
                                disabled={isSubmitting || !receiptFile}
                                className="flex-1 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black py-3 font-bold rounded-xl shadow-sm transition disabled:opacity-50"
                            >
                                {isSubmitting ? t('common.submitting') : t('explore.submit_proof')}
                            </button>
                            <button
                                onClick={() => setSelectedOpening(null)}
                                disabled={isSubmitting}
                                className="flex-1 bg-white/5 text-gray-300 hover:bg-white/10 py-3 font-bold rounded-xl transition"
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
