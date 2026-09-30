"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, API_BASE_URL, getErrorMessage, isUnauthorized } from '@/lib/api';
import toast from 'react-hot-toast';
import {
    BookOpen, Clock, User, CheckCircle, Loader, Award, Star, Users,
    CalendarDays, Globe, ChevronDown, GraduationCap, PlayCircle, MessagesSquare, ListChecks, Target,
    AlertTriangle, ClipboardList, Settings2
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useI18n } from '@/lib/i18n-context';
import { useTheme } from '@/lib/theme-context';
import { useFetchData } from '@/lib/useFetchData';
import { formatPrice, formatDate, formatNumber } from '@/lib/format';
import PublicMobileMenu from '@/components/PublicMobileMenu';
import CourseChat from '@/components/CourseChat';
import StudentTasksPanel from '@/components/StudentTasksPanel';
import StudentGradesPanel from '@/components/StudentGradesPanel';
import RosterGrades from '@/components/RosterGrades';
import TasksPanel from '@/components/TasksPanel';
import LessonExplorer from '@/components/LessonExplorer';
import InstructorRating from '@/components/InstructorRating';
import PaymentMethods, { type PaymentGateway } from '@/components/payment/PaymentMethods';
import ReceiptDropzone from '@/components/payment/ReceiptDropzone';
import EnrollSteps from '@/components/payment/EnrollSteps';
import LoginPromptModal from '@/components/LoginPromptModal';
import type { PublicInstructorCard } from '@/lib/public-instructor';

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
    instructor?: PublicInstructorCard | null;
    _count?: { enrollments?: number };
}

export interface CourseReview {
    id: string;
    rating: number;
    commentAr?: string | null;
    commentEn?: string | null;
    createdAt: string;
    user?: { id: string; email?: string } | null;
}

// Mirrors GET /reviews/course/:courseId (published reviews only).
export interface CourseReviews {
    total: number;
    average: number;
    distribution: { stars: number; count: number }[];
    reviews: CourseReview[];
}

// How many written reviews to list before asking people to read the rest.
const REVIEWS_PREVIEW = 5;

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
    instructor?: PublicInstructorCard | null;
    openings?: Opening[];
    /**
     * What the signed-in viewer may do with this course, from the API. Absent
     * on the anonymous server render, which is why the page re-fetches with a
     * token once it knows who is asking.
     */
    viewerAccess?: { enrolled: boolean; approved: boolean; teaches: boolean; chatEnabled: boolean };
    modules?: Module[];
    chapters?: Chapter[];
    _count?: { enrollments?: number; modules?: number };
}

const SectionTitle = ({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) => {
    const { dark } = useTheme();
    return (
        <div className="flex flex-col gap-2 mb-5">
            <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl bg-brand-gold/10 flex items-center justify-center shrink-0 'text-gold-ink'`}>
                    {icon}
                </div>
                <h2 className={`text-xl md:text-2xl font-black 'text-ink'`}>{children}</h2>
            </div>
            <div className="w-12 h-1 bg-brand-gold/30 rounded-full ms-[52px]" />
        </div>
    );
};

export default function CourseDetailsPage({ initialCourse }: { initialCourse?: Course | null }) {
    const { id } = useParams();
    const router = useRouter();
    const { user } = useAuth();
    const { t, locale, pick } = useI18n();
    const { dark } = useTheme();
    // Stat-card captions. The Latin treatment is small, bold, capped and
    // tracked-out. None of that transfers to Arabic: the script is cursive, so
    // letter-spacing opens gaps between joined glyphs and breaks the word
    // shape, and `uppercase` is a no-op on a script with no case. Arabic also
    // needs the larger size -- at sm and up the Latin size is 10px, too small
    // to read in either script, and the muted ink holds 6.18:1 on the sunken
    // card against the gold's 6.5:1 without the low-chroma brown look.
    const statCaption = locale === 'ar'
        ? 'text-xs font-bold text-ink-muted'
        : 'text-[11px] sm:text-[10px] font-bold text-gold-ink uppercase tracking-wider';
    // Same reasoning for the filled gold pill, which carries Arabic course
    // duration ("20 يوم") rather than a Latin code.
    const pillCaption = locale === 'ar' ? 'font-black text-xs' : 'font-black text-xs uppercase tracking-wider';
    const [course, setCourse] = useState<Course | null>(initialCourse ?? null);
    const [loading, setLoading] = useState(!initialCourse);
    const [openFaq, setOpenFaq] = useState<number | null>(null);
    const [selectedOpening, setSelectedOpening] = useState<Opening | null>(null);
    const [showLoginPrompt, setShowLoginPrompt] = useState(false);

    // --- Mode detection ---
    // Entitlement comes from the API, not from `openings.length`. The old
    // inference ("a live opening exists, therefore the signed-in student
    // belongs here") put every logged-in student in student mode on every
    // course, and dropped a real student back to guest whenever the batch they
    // were sitting in was filtered out of the anonymous render — which took
    // the chat, tasks and grades tabs with it.
    const isStudent = user?.role === 'STUDENT';
    const isInstructor = user?.role === 'INSTRUCTOR';
    const access = course?.viewerAccess;
    let mode: 'guest' | 'student' | 'instructor' = 'guest';
    if (access?.teaches) {
        mode = 'instructor';
    } else if (access?.enrolled) {
        mode = 'student';
    } else if (isInstructor) {
        // Older payloads (and any course the flag has not been computed for
        // yet) fall back to the previous best-effort check.
        mode = course?.openings?.some((o) => o.instructor?.id === user?.userId) ? 'instructor' : 'guest';
    } else if (isStudent && !access) {
        mode = (course?.openings?.length ?? 0) > 0 ? 'student' : 'guest';
    }
    const [receiptFile, setReceiptFile] = useState<File | null>(null);
    const [gatewayId, setGatewayId] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    // The hero doubles as the trailer player, so the 1-2 minute intro is above
    // the fold instead of a section the visitor may never scroll to.
    const [showTrailer, setShowTrailer] = useState(false);
    const { data: gateways, loading: gatewaysLoading } = useFetchData<PaymentGateway[]>('/payment-gateways');
    const { data: reviews, loading: reviewsLoading } = useFetchData<CourseReviews>(`/reviews/course/${id}`);
    const [activeTab, setActiveTab] = useState<'overview' | 'tasks' | 'grades' | 'chat' | 'roster'>('overview');

    // Prefer the server's verdict; fall back to `mode` for a payload that
    // predates the flag so a signed-in user is never left without the tab.
    const chatAvailable = access ? access.chatEnabled : mode !== 'guest';

    // A tab can stop being available while it is open — a signed-in viewer
    // whose own copy arrives without cohort access, for instance. Deriving the
    // tab that actually renders keeps that from stranding an empty panel
    // without writing state back from an effect.
    const tab = activeTab === 'chat' && !chatAvailable ? 'overview' : activeTab;

    // The batch whose work the instructor manages. `Course.instructorId` and
    // `CourseOpening.instructorId` are separate fields, so an instructor who
    // owns the course may own no batch at all — matching only on the batch's
    // instructor left `instructorOpeningId` null for them, which hid the tasks
    // and roster tabs entirely and read as "the assignment tools are missing".
    const instructorOpeningId = (() => {
        const openings = course?.openings ?? [];
        return openings.find(o => o.instructor?.id === user?.userId)?.id
            ?? (course?.instructor?.id === user?.userId ? openings[0]?.id : null)
            ?? null;
    })();

    // --- Tabs render ---
    const renderTabs = () => {
        const item = (key: typeof activeTab, icon: React.ReactNode, label: string) => (
            <button
                onClick={() => setActiveTab(key)}
                className={`relative inline-flex shrink-0 items-center gap-2 px-3 sm:px-4 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 cursor-pointer ${
                    tab === key
                        ? 'bg-brand-gold/15 text-gold-ink border border-brand-gold/25'
                        : dark ? 'text-gold-ink hover:text-ink hover:bg-ink/[0.04] border border-transparent' : 'text-gold-ink hover:text-ink hover:bg-surface-sunken border border-transparent'
                }`}
            >
                {icon}
                <span className="whitespace-nowrap">{label}</span>
                {tab === key && <span className={`absolute bottom-0 left-3 right-3 h-1 rounded-full ${dark ? 'bg-brand-gold-light' : 'bg-brand-gold-dark'}`} />}
            </button>
        );
        return (
            // The offset has to match the header exactly: it is now h-16 on a
            // phone and h-20 from `sm` up. A stale `top-20` slid the tab strip
            // under the header, clipping the top of the first tab.
            <div className="sticky top-16 sm:top-20 z-30 mb-6 sm:mb-8 -mx-4 sm:mx-0 px-4 sm:px-0">
                {/* One scrollable row instead of wrapping: with six tabs a phone
                    wrapped them onto three lines, which turned the sticky strip
                    into a wall that ate a third of the viewport. */}
                <div className={`inline-flex max-w-full gap-1 overflow-x-auto rounded-2xl border p-1.5 shadow-xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${dark ? 'bg-surface-sunken backdrop-blur-md border-line shadow-black/20' : 'bg-surface-raised backdrop-blur-md border-line shadow-brand-navy/10'}`}>
                    {item('overview', <BookOpen size={18} />, t('courseDetail.tab_overview'))}
                    {mode === 'student' && item('tasks', <ClipboardList size={18} />, t('courseDetail.tab_tasks'))}
                    {mode === 'student' && item('grades', <GraduationCap size={18} />, t('courseDetail.tab_grades'))}
                    {/* Chat follows the API's own answer rather than `mode`:
                        a student who is approved but whose batch is closed still
                        has a cohort room to read, and a pending applicant has
                        none. `mode` alone hid the tab in the first case. */}
                    {chatAvailable && item('chat', <MessagesSquare size={18} />, t('courseDetail.tab_chat'))}
                    {mode === 'instructor' && item('tasks', <Settings2 size={18} />, t('courseDetail.tab_tasks'))}
                    {mode === 'instructor' && item('roster', <Settings2 size={18} />, t('courseDetail.tab_roster'))}
                </div>
            </div>
        );
    };

    useEffect(() => {
        if (!id) return;

        // The page is server-rendered from an anonymous fetch, so that payload
        // has no viewer: no `viewerAccess`, and no batches beyond the public
        // OPEN/ANNOUNCEMENT ones. A guest is fine with it, but a signed-in
        // student needs their own copy — the effect used to bail out whenever
        // `initialCourse` existed, pinning the anonymous snapshot for the life
        // of the page. That is why an approved student sitting in a closed
        // batch never saw the chat tab at all.
        const hasAnonymousCopy = !!initialCourse;
        if (!user && hasAnonymousCopy) {
            // `loading` already started as `!initialCourse`, so the guest path
            // needs no state write here. Leaving the server copy on screen also
            // avoids a spinner flash for a signed-in viewer whose own copy is
            // still in flight below.
            return;
        }
        // No viewer and no server copy (the render failed): fetch anonymously
        // so the page is not blank.

        let cancelled = false;
        const fetchCourse = async () => {
            try {
                const res = await api.get(`/courses/${id}`);
                if (!cancelled) setCourse(res.data as Course);
            } catch {
                if (!cancelled) toast.error(t('courseDetail.failed_load'));
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        fetchCourse();
        return () => { cancelled = true; };
    }, [id, t, user, initialCourse]);

    const handleEnrollSubmit = async () => {
        if (!selectedOpening) return;
        if (!gatewayId) {
            toast.error(t('payment.select_method_first'));
            return;
        }
        if (!receiptFile) {
            toast.error(t('explore.upload_receipt_required'));
            return;
        }
        setIsSubmitting(true);
        try {
            const formData = new FormData();
            formData.append('openingId', selectedOpening.id);
            formData.append('gatewayId', gatewayId);
            formData.append('receipt', receiptFile);
            await api.post('/enrollments', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            toast.success(t('explore.review_success'));
            setSelectedOpening(null);
            setReceiptFile(null);
            setGatewayId(null);
        } catch (e) {
            // A guest that slipped past the CTA still gets a prompt, not "Unauthorized".
            if (isUnauthorized(e)) {
                setSelectedOpening(null);
                setShowLoginPrompt(true);
                return;
            }
            toast.error(getErrorMessage(e) || t('courseDetail.enroll_failed'));
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleEnrollClick = (target: Opening) => {
        if (!user) {
            setShowLoginPrompt(true);
            return;
        }
        setReceiptFile(null);
        setGatewayId(null);
        setSelectedOpening(target);
    };

    if (loading) return <div className={`min-h-screen flex items-center justify-center ${dark ? 'bg-surface-sunken' : 'bg-brand-white'}`}><Loader className="animate-spin text-accent" size={48} /></div>;
    if (!course) return <div className={`min-h-screen flex items-center justify-center ${dark ? 'bg-surface-sunken' : 'bg-brand-white'} text-red-700 dark:text-red-400 font-bold text-2xl`}>{t('courseDetail.not_found')}</div>;

    const levelLabel = (lvl?: string | null) => t(`course.level_${String(lvl || 'BEGINNER').toLowerCase()}`);
    const fmtDate = (d?: string | null) => formatDate(d, { locale });

    const opening = course.openings?.find(o => o.status === 'OPEN') || null;
    const announced = course.openings?.find(o => o.status === 'ANNOUNCEMENT') || null;
    const metaOpening = opening || announced;
    const courseInstructor = metaOpening?.instructor || course.instructor;
    // The public instructor payload has no email on purpose, so the display
    // name falls back through the bilingual pair and then to a generic label.
    const instructorName = (courseInstructor && pick(courseInstructor, 'name')) || '';
    const instructorJobTitle = (courseInstructor && pick(courseInstructor, 'jobTitle')) || '';
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
        <div className={`min-h-screen ${dark ? 'bg-surface-sunken' : 'bg-brand-white'} pb-20`}>
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
            <header className={`px-4 sm:px-6 md:px-8 h-16 sm:h-20 flex items-center justify-between border-b sticky top-0 z-50 ${dark ? 'border-line bg-surface-sunken' : 'border-line bg-ink/[0.45] backdrop-blur-md'}`}>
                {/* Brand: this header used to draw a hand-rolled "L" tile plus
                    a typed `laxa|lab` wordmark, so the course page showed a
                    different identity from every other page. Use the real mark,
                    as MarketingShell does, and keep it clickable home. */}
                <button
                    onClick={() => router.push('/')}
                    aria-label="Laxalab Academy"
                    className="flex items-center cursor-pointer"
                >
                    <img
                        src={dark ? '/logos/LaxaLab_Academy_Horizontal_Reverse_4K.png' : '/logos/LaxaLab_Academy_Horizontal_Primary_4K.png'}
                        alt="Laxalab Academy"
                        className="h-8 sm:h-10 md:h-12 w-auto max-w-[45vw] object-contain"
                    />
                </button>
                <nav className="hidden md:flex items-center gap-8">
                    <button onClick={() => router.push('/courses')} className={`font-bold transition cursor-pointer ${dark ? 'text-ink-muted hover:text-ink' : 'text-ink-subtle hover:text-ink'}`}>
                        {t('landing.explore_courses')}
                    </button>
                    <button onClick={() => router.push('/join-as-instructor')} className={`font-bold transition cursor-pointer ${dark ? 'text-ink-muted hover:text-ink' : 'text-ink-subtle hover:text-ink'}`}>
                        {t('landing.join_as_instructor')}
                    </button>
                </nav>
                <div className="flex items-center gap-4">
                    <PublicMobileMenu />
                    <div className="hidden sm:flex items-center gap-4">
                        {user ? (
                            <button onClick={() => router.push('/dashboard')} className="bg-brand-gold text-ink-on-gold hover:bg-brand-gold-light px-6 py-2.5 rounded-xl font-bold transition-all duration-300 shadow-md">
                                {t('courseDetail.dashboard')}
                            </button>
                        ) : (
                            <>
                                <button onClick={() => router.push('/login')} className={`hover:text-accent font-bold transition cursor-pointer 'text-ink'`}>
                                    {t('auth.login')}
                                </button>
                                <button onClick={() => router.push('/register')} className="bg-brand-gold text-ink-on-gold hover:bg-brand-gold-light px-6 py-2.5 rounded-xl font-bold transition-all duration-300 shadow-md">
                                    {t('auth.register')}
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </header>

            {/* Hero Section */}
            <div className="relative overflow-hidden bg-gradient-to-br from-brand-navy-dark via-brand-navy to-brand-navy-light min-h-[480px]">
                {course.coverImageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={`${API_BASE_URL}${course.coverImageUrl}`} alt="" className="absolute inset-0 w-full h-full object-cover opacity-15" aria-hidden />
                )}
                <div className="absolute inset-0 bg-gradient-to-br from-brand-navy-dark/70 via-brand-navy/85 to-brand-navy-dark/95" aria-hidden />
                <div className="absolute -top-24 -start-24 w-96 h-96 bg-brand-gold/10 rounded-full blur-3xl" aria-hidden />
                <div className="absolute top-1/2 end-0 w-72 h-72 bg-brand-gold/8 rounded-full blur-3xl" aria-hidden />
                <div className="absolute bottom-0 start-1/3 w-80 h-80 bg-surface-raised rounded-full blur-3xl" aria-hidden />
                <div className="absolute bottom-0 end-0 w-80 h-80 bg-brand-gold/5 rounded-full blur-3xl" aria-hidden />

                <div className="relative max-w-6xl mx-auto px-4 sm:px-6 md:px-10 pt-10 sm:pt-16 md:pt-20 pb-14 sm:pb-24 md:pb-28 grid lg:grid-cols-[1.2fr_1fr] gap-10 md:gap-12 items-center">
                    {/* Left */}
                    <div className="animate-fade-in-up">
                        {/* Breadcrumb */}
                        <nav className="flex items-center gap-2 text-xs font-bold text-gold-ink mb-6 flex-wrap">
                            <button onClick={() => router.push('/')} className="hover:text-accent transition cursor-pointer">{t('landing.home')}</button>
                            <span className="text-accent">/</span>
                            <button onClick={() => router.push('/courses')} className="hover:text-accent transition cursor-pointer">{t('landing.explore_courses')}</button>
                            <span className="text-accent">/</span>
                            <span className="text-accent truncate max-w-[60vw] sm:max-w-[200px]">{pick(course, 'title')}</span>
                        </nav>

                        <div className="flex flex-wrap items-center gap-2 mb-5">
                            {pick(course, 'duration') && (
                                <span className={`bg-brand-gold text-ink-on-gold px-3 py-1.5 rounded-full shadow-sm ${pillCaption}`}>
                                    {pick(course, 'duration')}
                                </span>
                            )}
                            {pick(course, 'category') && (
                                <span className="bg-ink/[0.08] border border-line-strong text-ink font-bold text-xs px-3 py-1.5 rounded-full">
                                    {pick(course, 'category')}
                                </span>
                            )}
                            <span className="bg-ink/[0.08] border border-line-strong text-ink font-bold text-xs px-3 py-1.5 rounded-full">
                                {levelLabel(course.level)}
                            </span>
                            {course.language && (
                                <span className="bg-ink/[0.08] border border-line-strong text-ink font-bold text-xs px-3 py-1.5 rounded-full">
                                    <Globe size={11} className="inline me-1" />{course.language}
                                </span>
                            )}
                        </div>

                        {/* The glow belongs to the old dark hero. On the light
                            theme it put a 24px, 50%-black halo behind #1b2434 on
                            white, which smears the largest text on the page --
                            it was the only textShadow left anywhere in the app. */}
                        <h1
                            className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black text-ink mb-5 sm:mb-6 leading-[1.15] sm:leading-[1.08] tracking-tight break-words"
                            style={dark ? { textShadow: '0 2px 24px rgba(0,0,0,0.5)' } : undefined}
                        >
                            {pick(course, 'title')}
                        </h1>
                        {(pick(course, 'excerpt') || pick(course, 'description')) && (
                            <p className="text-base sm:text-lg md:text-xl text-ink-muted max-w-2xl mb-6 sm:mb-8 font-medium leading-relaxed break-words">
                                {pick(course, 'excerpt') || pick(course, 'description')}
                            </p>
                        )}

                        {/* Stats */}
                        <div className="flex flex-wrap gap-3 mb-8">
                            <div className="bg-ink/[0.04] border border-line rounded-2xl px-4 py-3 flex items-center gap-3 backdrop-blur-md hover:border-brand-gold/20 transition">
                                <div className="w-9 h-9 rounded-xl bg-brand-gold/20 flex items-center justify-center text-gold-ink">
                                    <Clock size={17} />
                                </div>
                                <div>
                                    <div className={statCaption}>{t('explore.duration')}</div>
                                    <div className="text-sm font-black text-ink">{pick(course, 'duration') || t('courseDetail.self_paced')}</div>
                                </div>
                            </div>
                            {course.hoursOfContent ? (
                                <div className="bg-ink/[0.04] border border-line rounded-2xl px-4 py-3 flex items-center gap-3 backdrop-blur-md hover:border-brand-gold/20 transition">
                                    <div className="w-9 h-9 rounded-xl bg-brand-gold/20 flex items-center justify-center text-gold-ink">
                                        <PlayCircle size={17} />
                                    </div>
                                    <div>
                                        <div className={statCaption}>{t('courseDetail.hours_label')}</div>
                                        <div className="text-sm font-black text-gold-ink">{course.hoursOfContent}</div>
                                    </div>
                                </div>
                            ) : null}
                            {enrolledCount ? (
                                <div className="bg-ink/[0.04] border border-line rounded-2xl px-4 py-3 flex items-center gap-3 backdrop-blur-md hover:border-brand-gold/20 transition">
                                    <div className="w-9 h-9 rounded-xl bg-brand-gold/20 flex items-center justify-center text-gold-ink">
                                        <Users size={17} />
                                    </div>
                                    <div>
                                        <div className={statCaption}>{t('explore.students')}</div>
                                        <div className="text-sm font-black text-gold-ink">{enrolledCount}</div>
                                    </div>
                                </div>
                            ) : null}
                            <div className="bg-ink/[0.04] border border-line rounded-2xl px-4 py-3 flex items-center gap-3 backdrop-blur-md hover:border-brand-gold/20 transition">
                                <div className="w-9 h-9 rounded-xl bg-brand-gold/20 flex items-center justify-center text-gold-ink">
                                    <User size={17} />
                                </div>
                                <div>
                                    <div className={statCaption}>{t('courseDetail.expert_instructor')}</div>
                                    <div className="text-sm font-black text-ink max-w-[55vw] sm:max-w-[160px] truncate">{instructorName || t('courseDetail.expert_instructor')}</div>
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
                                    <button onClick={() => handleEnrollClick(opening)} className="bg-gradient-to-r from-brand-gold to-brand-gold-dark hover:from-brand-gold-light hover:to-brand-gold text-black flex items-center gap-3 font-black py-4 px-8 rounded-2xl shadow-xl shadow-brand-gold/25 hover:shadow-[0_0_30px_rgba(245,158,11,0.45)] transition-all transform hover:-translate-y-0.5 cursor-pointer animate-[pulse_2.5s_ease-in-out_infinite] hover:animate-none">
                                        <BookOpen size={20} />
                                        {Number(opening.price) === 0 ? t('course.free') : `${t('courseDetail.enroll_for')} ${formatPrice(opening.price, { locale })}`}
                                    </button>
                                    {opening.priceOld && Number(opening.priceOld) > Number(opening.price) && (
                                        <span className="text-ink-muted text-sm font-semibold">
                                            {t('courseDetail.was_price')} <s className="text-ink-muted">{formatPrice(opening.priceOld, { locale })}</s>
                                        </span>
                                    )}
                                    {announced && (
                                        <button onClick={handleReserveClick} className="bg-ink/[0.08] hover:bg-ink/[0.12] border border-line-strong text-ink flex items-center gap-2 font-bold py-4 px-8 rounded-2xl transition transform hover:-translate-y-0.5 cursor-pointer">
                                            {t('courseDetail.reserve_seat')}
                                        </button>
                                    )}
                                </>
                            ) : announced ? (
                                <button onClick={handleReserveClick} className="bg-gradient-to-r from-brand-gold to-brand-gold-dark hover:from-brand-gold-light hover:to-brand-gold text-black flex items-center gap-3 font-black py-4 px-8 rounded-2xl shadow-xl shadow-brand-gold/25 hover:shadow-[0_0_30px_rgba(245,158,11,0.45)] transition-all transform hover:-translate-y-0.5 cursor-pointer animate-[pulse_2.5s_ease-in-out_infinite] hover:animate-none">
                                    <BookOpen size={20} />
                                    {t('courseDetail.reserve_seat')}
                                </button>
                            ) : (
                                <div className="bg-ink/[0.04] border border-line text-ink-muted font-bold py-3 px-7 rounded-2xl">
                                    {t('courseDetail.not_open_yet')}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right: cover card, doubling as the trailer player */}
                    <div className="hidden lg:block animate-fade-in-up">
                        <div className="relative">
                            <div className="absolute -inset-3 bg-gradient-to-tr from-brand-gold/30 to-transparent rounded-[2rem] blur-2xl opacity-50" aria-hidden />
                            <div className="relative rounded-[1.75rem] overflow-hidden border border-line shadow-2xl shadow-black/40 hover:scale-[1.02] transition-transform duration-500">
                                {showTrailer && introVideo ? (
                                    <div className="w-full aspect-[4/3] bg-black">
                                        {introVideo.type === 'embed' ? (
                                            <iframe
                                                src={`${introVideo.src}${introVideo.src.includes('?') ? '&' : '?'}autoplay=1`}
                                                title={t('courseDetail.intro_video')}
                                                className="w-full h-full"
                                                allow="autoplay; fullscreen; accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                            />
                                        ) : (
                                            <video src={`${API_BASE_URL}${introVideo.src}`} controls autoPlay className="w-full h-full" />
                                        )}
                                    </div>
                                ) : (
                                    <>
                                        {course.coverImageUrl ? (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img src={`${API_BASE_URL}${course.coverImageUrl}`} alt={pick(course, 'title') || ''} className="w-full aspect-[4/3] object-cover" />
                                        ) : (
                                            <div className="w-full aspect-[4/3] bg-gradient-to-br from-brand-navy-light to-brand-navy-dark flex items-center justify-center">
                                                <BookOpen size={72} className="text-accent" />
                                            </div>
                                        )}
                                        {introVideo && (
                                            <button
                                                type="button"
                                                onClick={() => setShowTrailer(true)}
                                                className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-surface-sunken backdrop-blur-[2px] transition hover:bg-surface-sunken cursor-pointer group"
                                                aria-label={t('courseDetail.watch_intro')}
                                            >
                                                <span className="flex h-20 w-20 items-center justify-center rounded-full bg-brand-gold text-ink-on-gold shadow-2xl transition-transform duration-300 group-hover:scale-110">
                                                    <PlayCircle size={42} />
                                                </span>
                                                <span className="rounded-full bg-surface px-4 py-1.5 text-xs font-black text-ink backdrop-blur-sm">
                                                    {t('courseDetail.watch_intro')}
                                                </span>
                                            </button>
                                        )}
                                    </>
                                )}
                                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-brand-navy-dark/95 to-transparent p-6 pt-16 pointer-events-none">
                                    <div className="flex items-center justify-between gap-4">
                                        <div>
                                            <div className="text-[10px] font-bold text-accent uppercase tracking-[0.2em] mb-1">
                                                {opening ? (Number(opening.price) === 0 ? t('course.free') : formatPrice(opening.price, { locale })) : t('courseDetail.not_open_yet')}
                                            </div>
                                            <div className="text-ink font-black text-2xl">{pick(course, 'title')}</div>
                                        </div>
                                        {course._count?.modules ? (
                                            <div className="bg-ink/[0.12] backdrop-blur-sm rounded-2xl px-4 py-3 text-center shrink-0">
                                                <div className="text-xl font-black text-accent">{course._count.modules}</div>
                                                <div className="text-[10px] font-bold text-ink">{t('course.modules')}</div>
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
                <div className={`rounded-3xl shadow-2xl p-4 sm:p-6 md:p-12 animate-fade-in-up ${dark ? 'bg-surface shadow-black/20 border border-line' : 'bg-surface-raised shadow-brand-navy/10 border border-line'}`}>

                    {mode !== 'guest' && tab !== 'overview' ? (
                        <>
                            {tab === 'tasks' && mode === 'instructor' && instructorOpeningId && <TasksPanel openingId={instructorOpeningId} />}
                            {tab === 'tasks' && mode === 'student' && <StudentTasksPanel courseId={course.id} />}
                            {tab === 'grades' && mode === 'student' && <StudentGradesPanel courseId={course.id} />}
                            {/* Guarded on the same flag as the tab: this body had
                                no `mode` check of its own, so it was reachable by
                                any non-guest even where the tab was hidden. */}
                            {tab === 'chat' && chatAvailable && <CourseChat courseId={course.id} />}
                            {tab === 'roster' && mode === 'instructor' && instructorOpeningId && <RosterGrades openingId={instructorOpeningId} />}
                        </>
                    ) : (
                        <>

                    {/* What you'll learn — before the syllabus, so the visitor
                        sees the payoff before committing to the syllabus. */}
                    {course.objectives && course.objectives.length > 0 && (
                        <div className="mb-8 sm:mb-12 bg-brand-gold/5 border border-brand-gold/10 rounded-3xl p-4 sm:p-6">
                            <SectionTitle icon={<GraduationCap size={18} />}>{t('courseDetail.learn_heading')}</SectionTitle>
                            <div className="grid sm:grid-cols-2 gap-3">
                                {course.objectives.map((o, idx) => (
                                    <div key={idx} className={`flex items-start gap-3 rounded-xl p-3 sm:p-4 hover:border-brand-gold/20 transition ${'bg-surface-sunken border border-line'}`}>
                                        <CheckCircle size={18} className="text-emerald-500 mt-0.5 flex-shrink-0" />
                                        <span className={`text-sm font-medium ${dark ? 'text-ink-muted' : 'text-ink-subtle'}`}>{pick(o, 'objective')}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Lesson explorer */}
                    {course.modules && course.modules.length > 0 && (
                        <div className="mb-12">
                            <LessonExplorer courseId={course.id} modules={course.modules || []} chapters={course.chapters} openingId={instructorOpeningId} mode={mode} />
                        </div>
                    )}

                    <div className="grid md:grid-cols-3 gap-10 md:gap-12">
                        {/* Highlights */}
                        <div className="md:col-span-2 space-y-8 sm:space-y-10">

                            {/* About */}
                            {(pick(course, 'description') || pick(course, 'syllabus')) && (
                                <div>
                                    <SectionTitle icon={<BookOpen size={18} />}>{t('courseDetail.about_heading')}</SectionTitle>
                                    {pick(course, 'description') && (
                                        <p className={`whitespace-pre-wrap leading-relaxed mb-6 ${dark ? 'text-ink-muted' : 'text-ink-subtle'}`}>{pick(course, 'description')}</p>
                                    )}
                                    {pick(course, 'syllabus') && (
                                        <div>
                                            <h3 className={`text-lg font-bold mb-2 'text-ink'`}>{t('courseDetail.syllabus_heading')}</h3>
                                            <p className={`whitespace-pre-wrap leading-relaxed rounded-2xl p-5 ${'text-ink-muted bg-surface-sunken border border-line'}`}>
                                                {pick(course, 'syllabus') || t('courseDetail.syllabus_fallback')}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Prerequisites */}
                            {course.prerequisites && course.prerequisites.length > 0 && (
                                <div>
                                    <SectionTitle icon={<Target size={18} />}>{t('courseDetail.prereq_heading')}</SectionTitle>
                                    <ul className="space-y-3">
                                        {course.prerequisites.map((p, idx) => (
                                            <li key={idx} className="flex items-start gap-3">
                                                <ListChecks size={18} className={`mt-0.5 flex-shrink-0 'text-accent'`} />
                                                <span className={`font-medium ${dark ? 'text-ink-muted' : 'text-ink-subtle'}`}>{pick(p, 'prerequisite')}</span>
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
                                                <CheckCircle size={18} className={`mt-0.5 flex-shrink-0 'text-accent'`} />
                                                <span className={`font-medium ${dark ? 'text-ink-muted' : 'text-ink-subtle'}`}>{pick(a, 'audience')}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* The instructor card links to the public profile.
                                The gate is the id, not an email: the public
                                payload deliberately carries no email. */}
                            {courseInstructor?.id && (
                                <div>
                                    <SectionTitle icon={<User size={18} />}>{t('courseDetail.instructor_heading')}</SectionTitle>
                                    <div className={`flex flex-wrap items-center gap-5 rounded-2xl p-5 ${'bg-surface-sunken border border-line'}`}>
                                        {courseInstructor.avatarUrl ? (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img
                                                src={`${API_BASE_URL}${courseInstructor.avatarUrl}`}
                                                alt={instructorName}
                                                className="h-16 w-16 flex-shrink-0 rounded-full object-cover"
                                            />
                                        ) : (
                                            <span className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-gold to-brand-gold-dark text-2xl font-black text-ink">
                                                {(instructorName || '?').trim().charAt(0).toUpperCase()}
                                            </span>
                                        )}
                                        <div className="min-w-0 flex-1 basis-40">
                                            {/* Wraps instead of truncating: a clipped
                                                name is unreadable on a phone, and
                                                Arabic job titles are long. */}
                                            <div className={`font-black break-words 'text-ink'`} dir="auto">
                                                {instructorName || t('courseDetail.expert_instructor')}
                                            </div>
                                            <div className={`mt-0.5 text-sm break-words 'text-ink-subtle'`} dir="auto">
                                                {instructorJobTitle || t('courseDetail.instructor_role')}
                                            </div>
                                            <Link
                                                href={`/instructors/${courseInstructor.id}`}
                                                className={`mt-2 inline-flex items-center gap-1.5 text-sm font-bold hover:underline 'text-accent'`}
                                            >
                                                {t('courseDetail.instructor_view_profile')}
                                            </Link>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Student reviews */}
                            <div>
                                <SectionTitle icon={<Star size={18} />}>{t('courseDetail.reviews_heading')}</SectionTitle>
                                {reviewsLoading ? (
                                    <div className={`h-20 animate-pulse rounded-2xl ${dark ? 'bg-ink/[0.04]' : 'bg-surface-sunken'}`} />
                                ) : !reviews || reviews.total === 0 ? (
                                    <p className={`rounded-2xl border border-dashed p-5 text-sm ${'border-line text-ink-subtle'}`}>
                                        {t('courseDetail.reviews_empty')}
                                    </p>
                                ) : (
                                    <div className="space-y-4">
                                    <div className={`flex flex-wrap items-center gap-4 sm:gap-5 rounded-2xl p-4 sm:p-5 ${'bg-surface-sunken border border-line'}`}>
                                            <div className="text-center">
                                                <div className="text-4xl font-black text-accent dark:text-brand-gold-light">
                                                    {reviews.average.toFixed(1)}
                                                </div>
                                                <div className="mt-1 flex items-center justify-center gap-0.5" aria-hidden>
                                                    {[1, 2, 3, 4, 5].map(s => (
                                                        <Star key={s} size={13} className={s <= Math.round(reviews.average) ? 'fill-brand-gold text-accent' : dark ? 'text-ink-subtle' : 'text-ink-muted'} />
                                                    ))}
                                                </div>
                                                <div className={`mt-1 text-xs font-bold 'text-ink-subtle'`}>
                                                    {t('courseDetail.reviews_count').replace('{n}', formatNumber(reviews.total, locale))}
                                                </div>
                                            </div>
                                            <ul className="flex-1 space-y-1">
                                                {reviews.distribution.map(d => (
                                                    <li key={d.stars} className="flex items-center gap-2 text-xs">
                                                        <span className={`w-8 shrink-0 font-black 'text-ink-subtle'`}>{d.stars}★</span>
                                                        <span className={`h-2 flex-1 overflow-hidden rounded-full ${'bg-ink/[0.08]'}`}>
                                                            <span
                                                                className="block h-full rounded-full bg-brand-gold"
                                                                style={{ width: `${reviews.total ? (d.count / reviews.total) * 100 : 0}%` }}
                                                            />
                                                        </span>
                                                        <span className={`w-6 shrink-0 text-end font-bold 'text-ink-subtle'`}>{d.count}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                        <ul className="space-y-3">
                                            {reviews.reviews.slice(0, REVIEWS_PREVIEW).map(r => (
                                                <li key={r.id} className={`rounded-2xl p-4 ${dark ? 'bg-surface-sunken border border-line' : 'bg-surface-raised border border-line'}`}>
                                                    <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1">
                                                        <span className="flex items-center gap-0.5 shrink-0" aria-label={`${r.rating}/5`}>
                                                            {[1, 2, 3, 4, 5].map(s => (
                                                                <Star key={s} size={12} className={s <= r.rating ? 'fill-brand-gold text-accent' : dark ? 'text-ink-subtle' : 'text-ink-muted'} />
                                                            ))}
                                                        </span>
                                                        <span className={`truncate text-[13px] font-bold max-w-[55vw] sm:max-w-[220px] 'text-ink-subtle'`} dir="ltr">
                                                            {r.user?.email}
                                                        </span>
                                                        <span className={`ms-auto shrink-0 text-xs 'text-ink-subtle'`}>
                                                            {fmtDate(r.createdAt)}
                                                        </span>
                                                    </div>
                                                    {(pick(r, 'comment')) && (
                                                        <p className={`text-sm leading-relaxed ${dark ? 'text-ink-muted' : 'text-ink-subtle'}`}>{pick(r, 'comment')}</p>
                                                    )}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>

                            {/* FAQ */}
                            {course.faqs && course.faqs.length > 0 && (
                                <div>
                                    <SectionTitle icon={<MessagesSquare size={18} />}>{t('courseDetail.faq_heading')}</SectionTitle>
                                    <div className="space-y-3">
                                        {course.faqs.map((f, idx) => (
                                            <div key={idx} className={`rounded-2xl overflow-hidden ${'border border-line bg-surface-sunken'}`}>
                                                <button
                                                    onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                                                    className={`w-full flex items-center justify-between gap-3 p-4 text-left font-bold transition ${dark ? 'text-ink hover:bg-ink/[0.04]' : 'text-ink hover:bg-surface-sunken'}`}
                                                >
                                                    <span>{pick(f, 'question')}</span>
                                                    <ChevronDown size={18} className={`flex-shrink-0 transition-transform ${openFaq === idx ? 'rotate-180' : ''} 'text-accent'`} />
                                                </button>
                                                {openFaq === idx && (
                                                    <p className={`px-4 pb-4 text-sm leading-relaxed ${dark ? 'text-ink-muted' : 'text-ink-subtle'}`}>{pick(f, 'answer')}</p>
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
                                            <a key={idx} href={`${API_BASE_URL}${g.url}`} target="_blank" rel="noreferrer" className={`group overflow-hidden rounded-2xl transition ${dark ? 'border border-line hover:border-brand-gold/20' : 'border border-line hover:border-brand-gold/40'}`}>
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
                            <div className="rounded-3xl overflow-hidden border border-line shadow-2xl shadow-black/20 bg-surface-sunken border-t-2 border-t-brand-gold-light animate-fade-in-up">
                                <div className="bg-gradient-to-r from-brand-gold/10 to-transparent px-6 py-4 flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-brand-gold/20 flex items-center justify-center text-gold-ink">
                                        <BookOpen size={16} />
                                    </div>
                                    <h2 className="font-black text-accent uppercase tracking-wider text-sm">{t('courseDetail.course_details')}</h2>
                                </div>
                                <div className="p-4 sm:p-6 space-y-1">
                                    {[
                                        { icon: <Clock size={16} />, label: pick(course, 'duration') || t('courseDetail.self_paced') },
                                        { icon: <User size={16} />, label: instructorName || t('courseDetail.expert_instructor') },
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
                                        <div key={idx} className="flex items-center gap-3 py-2.5 text-ink-muted font-medium text-sm border-b border-line last:border-0">
                                            <div className="w-8 h-8 rounded-full bg-brand-gold/10 flex items-center justify-center text-gold-ink shrink-0">
                                                {row.icon}
                                            </div>
                                            <span className="break-words">{row.label}</span>
                                        </div>
                                    ))}
                                    {metaOpening && (
                                        <div className="flex items-center gap-3 py-3 mt-1">
                                            <div className="w-8 h-8 rounded-full bg-brand-gold/20 flex items-center justify-center text-gold-ink shrink-0">
                                                <BookOpen size={16} />
                                            </div>
                                            <span className="font-black text-accent text-3xl">
                                                {Number(metaOpening.price) === 0 ? t('course.free') : formatPrice(metaOpening.price, { locale })}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Included features */}
                            {included.length > 0 && (
                                <div className="rounded-3xl border border-line p-4 sm:p-6 shadow-sm bg-surface-sunken animate-fade-in-up">
                                    <h2 className="font-black text-ink mb-4 flex items-center gap-2 text-sm uppercase tracking-wider">
                                        <span className="w-1 h-5 bg-brand-gold-light rounded-full" /> {t('courseDetail.features_heading')}
                                    </h2>
                                    <ul className="space-y-2.5">
                                        {included.map((f, idx) => (
                                            <li key={idx} className="flex items-start gap-2.5">
                                                <span className="w-5 h-5 rounded-full bg-emerald-500/15 text-emerald-800 dark:text-emerald-400 flex items-center justify-center mt-0.5 flex-shrink-0">
                                                    <CheckCircle size={13} />
                                                </span>
                                                <span className="text-sm text-ink-muted font-medium">{f.label}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            <div className="rounded-3xl border border-line p-4 sm:p-6 shadow-sm bg-surface-sunken animate-fade-in-up">
                                <h2 className="font-black text-ink mb-4 flex items-center gap-2 text-sm uppercase tracking-wider">
                                    <span className="w-1 h-5 bg-brand-gold-light rounded-full" /> {t('courseDetail.achievements')}
                                </h2>
                                <ul className="space-y-2.5">
                                    <li className="flex items-start gap-2.5">
                                        <span className="w-5 h-5 rounded-full bg-emerald-500/15 text-emerald-800 dark:text-emerald-400 flex items-center justify-center mt-0.5 flex-shrink-0">
                                            <CheckCircle size={13} />
                                        </span>
                                        <span className="text-sm text-ink-muted font-medium">{t('courseDetail.achievement_1')}</span>
                                    </li>
                                    <li className="flex items-start gap-2.5">
                                        <span className="w-5 h-5 rounded-full bg-emerald-500/15 text-emerald-800 dark:text-emerald-400 flex items-center justify-center mt-0.5 flex-shrink-0">
                                            <CheckCircle size={13} />
                                        </span>
                                        <span className="text-sm text-ink-muted font-medium">{t('courseDetail.achievement_2')}</span>
                                    </li>
                                    <li className="flex items-start gap-2.5">
                                        <span className="w-5 h-5 rounded-full bg-emerald-500/15 text-emerald-800 dark:text-emerald-400 flex items-center justify-center mt-0.5 flex-shrink-0">
                                            <CheckCircle size={13} />
                                        </span>
                                        <span className="text-sm text-ink-muted font-medium">{t('courseDetail.achievement_3')}</span>
                                    </li>
                                </ul>
                            </div>
                        </div>
                    </div>

                        </>
                    )}

                </div>
            </div>

            {/* Login Prompt Modal (guests only) */}
            <LoginPromptModal
                open={showLoginPrompt}
                onClose={() => setShowLoginPrompt(false)}
                redirectTo={`/courses/${id}`}
            />

            {/* Enrollment Modal with Receipt Upload */}
            {selectedOpening && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-4">
                    <div className={`rounded-3xl w-full max-w-lg p-5 sm:p-8 shadow-2xl transform transition-all max-h-[90vh] overflow-y-auto ${dark ? 'bg-surface border border-line' : 'bg-surface-raised border border-line'}`}>
                        <h2 className={`text-xl sm:text-2xl font-black mb-2 break-words 'text-ink'`}>
                            {t('explore.enroll_in')} {pick(course, 'title')}
                        </h2>
                        <p className={`mb-6 ${dark ? 'text-ink-muted' : 'text-ink-subtle'}`}>
                            {t('explore.transfer_part1')} <strong className={'text-accent'}>{formatPrice(selectedOpening.price, { locale })}</strong> {t('explore.transfer_part2')}
                        </p>

                        <EnrollSteps step={gatewayId ? 2 : 1} dark={dark} />

                        <div className="mb-6 space-y-3">
                            <h3 className={`font-bold text-sm uppercase tracking-wider ${dark ? 'text-ink-muted' : 'text-ink'}`}>{t('payment.payment_method')}:</h3>
                            <p className={`text-xs -mt-1 'text-ink-subtle'`}>{t('payment.choose_method_hint')}</p>
                            <PaymentMethods
                                gateways={gateways}
                                loading={gatewaysLoading}
                                selectedId={gatewayId}
                                onSelect={(gid) => setGatewayId(prev => (prev === gid ? null : gid))}
                                dark={dark}
                                emptyLabel={t('explore.no_payment_methods')}
                            />
                        </div>

                        <div className="space-y-3">
                            <h3 className={`font-bold text-sm uppercase tracking-wider ${dark ? 'text-ink-muted' : 'text-ink'}`}>{t('payment.step_receipt')}:</h3>
                            {!gatewayId ? (
                                <p className={`text-sm p-3 rounded-xl border flex items-center gap-2 ${dark ? 'text-ink-muted bg-ink/[0.04] border-line' : 'text-ink-muted bg-ink/[0.04] border-brand-mist'}`}>
                                    <AlertTriangle size={16} className="flex-shrink-0 text-accent" />
                                    {t('payment.receipt_section_locked')}
                                </p>
                            ) : (
                                <ReceiptDropzone file={receiptFile} onChange={setReceiptFile} dark={dark} disabled={isSubmitting} />
                            )}
                        </div>

                        {/* Stacked on a phone: two Arabic labels side by side in a
                            320px viewport left each button ~100px and wrapped the
                            text onto three lines. */}
                        <div className="flex flex-col-reverse sm:flex-row gap-3 sm:gap-4 mt-8">
                            <button
                                onClick={handleEnrollSubmit}
                                disabled={isSubmitting || !receiptFile || !gatewayId}
                                className="flex-1 bg-gradient-to-r from-brand-gold to-brand-gold-dark hover:from-brand-gold-light hover:to-brand-gold text-black py-3 font-bold rounded-xl shadow-sm transition disabled:opacity-50"
                            >
                                {isSubmitting ? t('common.submitting') : t('explore.submit_proof')}
                            </button>
                            <button
                                onClick={() => setSelectedOpening(null)}
                                disabled={isSubmitting}
                                className={`flex-1 py-3 font-bold rounded-xl transition ${dark ? 'bg-ink/[0.04] text-ink-muted hover:bg-ink/[0.08]' : 'bg-surface-sunken text-ink-muted hover:bg-ink/[0.08]'}`}
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
