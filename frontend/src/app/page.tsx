'use client';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { BookOpen, Award, Shield, Users, GraduationCap, ChevronRight, Sparkles, PlayCircle, Play, Camera, Send, Hash, Globe, Mail, Clock, Target, MapPin, Route, Phone, MessageCircle } from 'lucide-react';
import { useI18n } from '@/lib/i18n-context';
import { useTheme } from '@/lib/theme-context';
import { useFetchData } from '@/lib/useFetchData';
import { formatNumber } from '@/lib/format';
import AnnouncementBanner from '@/components/AnnouncementBanner';
import MarketingShell from '@/components/MarketingShell';
import CourseCard, { type PublicCourse } from '@/components/CourseCard';
import { api } from '@/lib/api';
import { DEFAULT_HOMEPAGE_CONFIG, localizedHomepageText, mergeHomepageConfig, type HomepageConfig, type HomepageSectionId } from '@/lib/homepage-config';

interface HomeLearningPath {
  id: string;
  titleAr: string;
  titleEn: string;
  descriptionAr?: string | null;
  descriptionEn?: string | null;
  courses?: { course?: { id: string } | null }[];
}

export default function Home() {
  const { t, pick, locale } = useI18n();
  const { dark } = useTheme();
  const isAr = locale === 'ar';
  const [homepageConfig, setHomepageConfig] = useState<HomepageConfig>(DEFAULT_HOMEPAGE_CONFIG);
  const [isPreview, setIsPreview] = useState(false);
  const { data: stats } = useFetchData<{ courses: number; instructors: number; enrollments: number; certificates: number } | null>('/public/stats');
  const { data: homeCourses, loading: homeCoursesLoading } = useFetchData<PublicCourse[]>('/public/courses');
  const { data: homeLearningPaths, error: homeLearningPathsError } = useFetchData<HomeLearningPath[]>('/learning-paths');
  const [activePathId, setActivePathId] = useState('');

  useEffect(() => {
    let active = true;
    const preview = new URLSearchParams(window.location.search).get('homepagePreview') === '1';
    const request = preview
      ? api.get('/admin/homepage').then((response) => response.data?.draft)
      : api.get('/homepage/public').then((response) => response.data);
    request
      .then((config) => {
        if (active) {
          setIsPreview(preview && !!config);
          if (config) setHomepageConfig(mergeHomepageConfig(config));
        }
      })
      .catch((error) => {
        if (active) console.error('Failed to load homepage configuration', error);
      });
    return () => { active = false; };
  }, []);

  const text = (key: string) => localizedHomepageText(homepageConfig, key, locale);
  const sectionOrder = (id: HomepageSectionId) => homepageConfig.sections.findIndex((section) => section.id === id);
  const sectionStyle = (id: HomepageSectionId) => ({
    display: homepageConfig.sections.find((section) => section.id === id)?.visible === false ? 'none' : undefined,
    order: sectionOrder(id),
  });

  const activePath = homeLearningPaths?.find(path => path.id === activePathId);
  const activePathCourseIds = useMemo(
    () => new Set((homeLearningPaths?.find(path => path.id === activePathId)?.courses ?? []).map(item => item.course?.id).filter((id): id is string => !!id)),
    [homeLearningPaths, activePathId],
  );

  const featuredCourses = useMemo(() => {
    const pool = activePathId
      ? (homeCourses ?? []).filter(course => activePathCourseIds.has(course.id))
      : (homeCourses ?? []);
    return pool.slice(0, 3);
  }, [homeCourses, activePathId, activePathCourseIds]);

  const aboutValues = [
    { icon: Target, titleKey: 'about_value_1_title', descKey: 'about_value_1_desc' },
    { icon: Globe, titleKey: 'about_value_2_title', descKey: 'about_value_2_desc' },
    { icon: Award, titleKey: 'about_value_3_title', descKey: 'about_value_3_desc' },
    { icon: Users, titleKey: 'about_value_4_title', descKey: 'about_value_4_desc' },
  ];

  const socials = [
    { icon: Play, id: 'youtube' },
    { icon: Camera, id: 'instagram' },
    { icon: Send, id: 'telegram' },
    { icon: Hash, id: 'x' },
    { icon: Globe, id: 'facebook' },
  ].map((social) => ({
    ...social,
    ...homepageConfig.socials.find((item) => item.id === social.id),
  }));
  const phoneDigits = (text('contact_phone').match(/\d/g) ?? []).join('');
  const phoneForCall = text('contact_phone').replace(/[^\d+]/g, '');

  const badgeCls = dark
    ? 'border border-white/10 bg-white/5 text-brand-mist'
    : 'glass-panel text-brand-navy';
  const heroTitleCls = dark ? 'text-white drop-shadow-2xl' : 'text-brand-navy';
  const heroDescCls = dark ? 'text-gray-300' : 'text-gray-600';
  const exploreBtnCls = dark
    ? 'bg-gradient-to-r from-brand-gold to-brand-gold-light text-brand-navy-dark shadow-brand-gold/20 hover:shadow-brand-gold/30'
    : 'bg-brand-navy text-white hover:bg-brand-navy-light';
  const joinBtnCls = dark
    ? 'bg-white/5 border-white/10 text-white hover:border-brand-gold hover:text-brand-gold-light'
    : 'bg-white border-gray-200 text-brand-navy hover:border-brand-gold hover:text-brand-gold-dark';
  const cardCls = dark
    ? 'bg-brand-navy border-white/10 hover:border-brand-gold/50 shadow-black/20 hover:shadow-[0_8px_30px_rgba(238,193,102,0.12)]'
    : 'bg-white border-gray-100 hover:border-brand-gold/50 hover:shadow-[0_8px_30px_rgb(18,48,90,0.08)] shadow-sm';
  const featIconCls = dark ? 'text-brand-gold-light bg-brand-gold/15' : 'text-brand-gold-dark bg-brand-gold/10';
  const cardTitleCls = dark ? 'text-white' : 'text-brand-navy';
  const cardDescCls = dark ? 'text-gray-400' : 'text-gray-500';

  return (
    <MarketingShell>
      {isPreview && (
        <div className="mb-4 rounded-xl border border-amber-400 bg-amber-100 px-4 py-3 text-center text-sm font-black text-amber-900">
          {isAr ? 'معاينة مسودة الصفحة الرئيسية — لا يراها الزوار قبل النشر.' : 'Homepage draft preview — visitors will not see this until published.'}
        </div>
      )}
      <div className="mt-8 flex flex-col gap-32">
      {/* Announcement Banner */}
      <div style={sectionStyle('hero')} className="flex flex-col">
      <div className={`-mt-12 -mx-6 mb-8 rounded-b-3xl overflow-hidden ${dark ? 'shadow-lg shadow-black/20' : 'shadow-sm'}`}>
        <AnnouncementBanner variant="public" />
      </div>

      <div className="flex flex-col items-center justify-center min-h-[70vh] relative animate-fade-in-up overflow-hidden">
        {/* Decorative background blobs */}
        <div className={`absolute top-10 left-10 w-72 h-72 rounded-full blur-[80px] -z-10 animate-float ${dark ? 'bg-brand-gold/10' : 'bg-brand-gold/10'}`} style={{ animationDuration: '6s' }}></div>
        <div className={`absolute bottom-10 right-10 w-96 h-96 rounded-full blur-[100px] -z-10 animate-float ${dark ? 'bg-brand-navy-light/15' : 'bg-brand-navy-light/5'}`} style={{ animationDuration: '8s', animationDelay: '2s' }}></div>

        <div className="max-w-4xl mx-auto text-center space-y-8 z-10 px-4">
          <div className={`inline-flex items-center gap-2 px-5 py-2 rounded-full ${badgeCls} font-bold text-sm shadow-sm animate-scale-in`}>
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-gold opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-brand-gold"></span>
            </span>
            {text('hero_badge')}
          </div>

          <h2 className={`text-5xl md:text-7xl font-black tracking-tight leading-tight ${heroTitleCls}`}>
            {text('hero_title')}
            {/* The brand word used to be re-typed here as styled text, which
                read as a second, unofficial logo next to the real one in the
                header. Show the actual mark instead. */}
            <img
              src={dark ? '/logos/LaxaLab_Academy_Horizontal_Reverse_4K.png' : '/logos/LaxaLab_Academy_Horizontal_Primary_4K.png'}
              alt="Laxalab Academy"
              className="block mt-5 mx-auto h-14 md:h-20 lg:h-24 w-auto max-w-[80vw] object-contain"
            />
          </h2>

          <p className={`text-xl md:text-2xl max-w-2xl mx-auto font-medium leading-relaxed ${heroDescCls}`}>
            {text('hero_desc')}
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-6">
            <Link href="/courses">
              <button className={`flex items-center gap-2 font-black text-lg px-8 py-4 rounded-2xl shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 group ${exploreBtnCls}`}>
                {text('hero_explore')}
                <ChevronRight className="rtl:rotate-180 group-hover:translate-x-1 rtl:group-hover:-translate-x-1 transition-transform" />
              </button>
            </Link>
            <Link href="/join-as-instructor">
              <button className={`flex items-center gap-2 border font-bold text-lg px-8 py-4 rounded-2xl hover:shadow-lg transition-all duration-300 ${joinBtnCls}`}>
                <GraduationCap size={22} />
                {text('hero_instructor')}
              </button>
            </Link>
          </div>

          <div className={`flex flex-wrap items-center justify-center gap-x-8 gap-y-3 pt-4 text-sm font-semibold ${dark ? 'text-brand-mist' : 'text-gray-600'}`}>
            <span className="inline-flex items-center gap-2"><Shield size={16} className="text-brand-gold" />{text('trust_payment')}</span>
            <span className="inline-flex items-center gap-2"><Award size={16} className="text-brand-gold" />{text('trust_instructors')}</span>
            <span className="inline-flex items-center gap-2"><PlayCircle size={16} className="text-brand-gold" />{text('trust_anytime')}</span>
          </div>
        </div>
      </div>
      </div>

        {/* Features Section */}
        <section style={sectionStyle('features')} className="relative">
          <div className="text-center mb-16">
            <h3 className={`text-3xl md:text-4xl font-black mb-4 ${dark ? 'text-white' : 'text-brand-navy'}`}>
              {text('why_heading')}
            </h3>
            <img
              src={dark ? '/logos/LaxaLab_Academy_Horizontal_Mono_White_4K.png' : '/logos/LaxaLab_Academy_Horizontal_Mono_Navy_4K.png'}
              alt="Laxalab Academy"
              className="mx-auto h-10 md:h-12 w-auto max-w-[70vw] object-contain"
            />
            <p className={`max-w-xl mx-auto text-lg leading-relaxed ${dark ? 'text-gray-400' : 'text-gray-500'}`}>{text('why_desc')}</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
            {[
              { icon: BookOpen, titleKey: 'feature_1_title', descKey: 'feature_1_desc' },
              { icon: Shield, titleKey: 'feature_2_title', descKey: 'feature_2_desc' },
              { icon: Award, titleKey: 'feature_3_title', descKey: 'feature_3_desc' }
            ].map((feature, i) => (
              <div key={i} className={`border rounded-3xl p-8 transition-all duration-500 group transform hover:-translate-y-2 ${cardCls}`}>
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500 ${featIconCls}`}>
                  <feature.icon size={28} />
                </div>
                <h3 className={`text-xl font-black mb-3 ${cardTitleCls}`}>{text(feature.titleKey)}</h3>
                <p className={`leading-relaxed font-medium ${cardDescCls}`}>{text(feature.descKey)}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Stats Section */}
        {homepageConfig.stats.some((item) => item.mode !== 'HIDDEN') && homepageConfig.sections.find((item) => item.id === 'stats')?.visible !== false && (
          <section style={sectionStyle('stats')} className="relative">
            <div className="bg-gradient-to-br from-brand-navy via-[#0e2a52] to-[#0a1e3c] rounded-3xl p-6 md:p-10 md:p-14 shadow-2xl shadow-black/40 overflow-hidden relative border border-white/10">
              <div className="absolute top-0 right-0 w-64 h-64 bg-brand-gold/10 rounded-full blur-[80px]"></div>
              <div className="absolute bottom-0 left-0 w-72 h-72 bg-brand-navy-light/20 rounded-full blur-[100px]"></div>

              <div className="relative z-10">
                <h3 className="text-center text-white font-black text-3xl md:text-4xl mb-12">{text('stats_heading')}</h3>
                <div className="grid grid-cols-1 min-[380px]:grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
                  {[
                    { id: 'courses', icon: BookOpen, auto: stats?.courses ?? 0, labelKey: 'stats_courses' },
                    { id: 'instructors', icon: GraduationCap, auto: stats?.instructors ?? 0, labelKey: 'stats_instructors' },
                    { id: 'enrollments', icon: Users, auto: stats?.enrollments ?? 0, labelKey: 'stats_enrollments' },
                    { id: 'certificates', icon: Award, auto: stats?.certificates ?? 0, labelKey: 'stats_certificates' }
                  ].flatMap((stat, i) => {
                    const setting = homepageConfig.stats.find((item) => item.id === stat.id);
                    if (!setting || setting.mode === 'HIDDEN') return [];
                    const value = setting.mode === 'MANUAL' ? setting.value : stat.auto;
                    return [(
                    <div key={i} className="text-center group">
                      <div className="w-16 h-16 rounded-2xl bg-white/10 text-brand-gold flex items-center justify-center mx-auto mb-5 group-hover:bg-brand-gold group-hover:text-brand-navy transition-all duration-500 shadow-inner block">
                        <stat.icon size={28} />
                      </div>
                      <p className="text-3xl md:text-4xl md:text-5xl font-black text-white mb-2 tracking-tight drop-shadow-md">{formatNumber(value, locale)}</p>
                      <p className="text-sm font-bold text-gray-300 tracking-wide uppercase">{text(stat.labelKey)}</p>
                    </div>
                    )];
                  })}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Featured Courses Section */}
        <section style={sectionStyle('courses')} className="relative">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-14 text-center sm:text-left">
            <div className="space-y-2">
              <h3 className={`text-3xl md:text-4xl font-black ${dark ? 'text-white' : 'text-brand-navy'}`}>{text('home_courses_heading')}</h3>
              <p className={`max-w-xl text-lg leading-relaxed ${dark ? 'text-gray-400' : 'text-gray-500'}`}>{text('home_courses_desc')}</p>
            </div>
            <Link href="/courses" className={`inline-flex items-center gap-2 font-bold text-sm px-6 py-3 rounded-xl border transition-all duration-300 whitespace-nowrap ${dark ? 'border-white/10 text-gray-300 hover:border-brand-gold hover:text-brand-gold-light' : 'border-gray-200 text-brand-navy hover:border-brand-gold hover:text-brand-gold-dark'}`}>
              {text('home_courses_view_all')}
              <ChevronRight className="rtl:rotate-180" size={16} />
            </Link>
          </div>

          {(homeLearningPaths?.length ?? 0) > 0 && (
            <div className="flex flex-wrap items-center justify-center gap-2.5 mb-12">
              <button
                type="button"
                onClick={() => setActivePathId('')}
                aria-pressed={activePathId === ''}
                className={`px-5 py-2.5 rounded-full text-sm font-black transition-all duration-300 cursor-pointer ${activePathId === ''
                  ? 'bg-gradient-to-r from-brand-gold to-brand-gold-light text-brand-navy-dark shadow-lg shadow-brand-gold/20'
                  : dark ? 'bg-white/5 border border-white/10 text-gray-300 hover:border-brand-gold/50 hover:text-white' : 'bg-white border border-gray-200 text-brand-navy hover:border-brand-gold'}`}
              >
                {isAr ? 'كل المسارات' : 'All paths'}
              </button>
              {homeLearningPaths?.map(path => (
                <button
                  key={path.id}
                  type="button"
                  onClick={() => setActivePathId(path.id === activePathId ? '' : path.id)}
                  aria-pressed={activePathId === path.id}
                  className={`px-5 py-2.5 rounded-full text-sm font-black transition-all duration-300 cursor-pointer ${activePathId === path.id
                    ? 'bg-gradient-to-r from-brand-gold to-brand-gold-light text-brand-navy-dark shadow-lg shadow-brand-gold/20'
                    : dark ? 'bg-white/5 border border-white/10 text-gray-300 hover:border-brand-gold/50 hover:text-white' : 'bg-white border border-gray-200 text-brand-navy hover:border-brand-gold'}`}
                >
                  {pick(path, 'title')}
                </button>
              ))}
            </div>
          )}

          {homeLearningPathsError && (
            <div role="alert" className={`mb-8 rounded-xl border p-4 text-sm font-semibold ${dark ? 'border-red-500/20 bg-red-500/10 text-red-300' : 'border-red-200 bg-red-50 text-red-700'}`}>
              {homeLearningPathsError}
            </div>
          )}

          {activePath && (
            <div className={`mb-8 flex items-start gap-4 rounded-2xl border p-5 ${dark ? 'border-brand-gold/20 bg-brand-gold/5' : 'border-brand-gold/30 bg-brand-gold/5'}`}>
              <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${dark ? 'bg-brand-gold/15 text-brand-gold-light' : 'bg-brand-gold/20 text-brand-gold-dark'}`}>
                <Route size={21} />
              </span>
              <div className="min-w-0 flex-1">
                <h4 className={`font-black ${dark ? 'text-white' : 'text-brand-navy'}`}>{pick(activePath, 'title')}</h4>
                {pick(activePath, 'description') && (
                  <p className={`mt-1 text-sm leading-relaxed ${dark ? 'text-gray-400' : 'text-gray-600'}`}>{pick(activePath, 'description')}</p>
                )}
                <p className={`mt-2 text-xs font-bold ${dark ? 'text-brand-gold-light' : 'text-brand-gold-dark'}`}>
                  {formatNumber(activePathCourseIds.size, locale)} {isAr ? 'دورة في هذا المسار' : 'courses in this path'}
                </p>
              </div>
            </div>
          )}

          {homeCoursesLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[0, 1, 2].map(i => (
                <div key={i} className={`animate-pulse rounded-3xl overflow-hidden ${dark ? 'bg-brand-navy border border-white/10' : 'bg-white border border-gray-100'}`}>
                  <div className="h-56 bg-gray-200 dark:bg-gray-800" />
                  <div className="p-7 space-y-4">
                    <div className="h-5 w-3/4 bg-gray-200 dark:bg-gray-700 rounded-full" />
                    <div className="h-4 w-full bg-gray-200 dark:bg-gray-700 rounded-full" />
                    <div className="h-4 w-2/3 bg-gray-200 dark:bg-gray-700 rounded-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : featuredCourses.length > 0 ? (
            <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
              {featuredCourses.map(course => (
                <CourseCard
                  key={course.id}
                  course={course}
                  isDark={dark}
                  variant="featured"
                  learningPathNames={(homeLearningPaths ?? [])
                    .filter(path => path.courses?.some(item => item.course?.id === course.id))
                    .map(path => pick(path, 'title'))
                    .filter((name): name is string => !!name)}
                />
              ))}
            </div>
          ) : null}

          {!homeCoursesLoading && featuredCourses.length === 0 && (
            <p className={`text-center py-10 ${dark ? 'text-gray-400' : 'text-gray-500'}`}>
              {activePathId ? t('explore.no_results') : t('explore.no_courses')}
            </p>
          )}
        </section>

        {/* About Section */}
        <section style={sectionStyle('about')} className={`relative rounded-3xl border p-8 md:p-14 overflow-hidden ${dark ? 'bg-brand-navy border-white/10' : 'bg-white border-gray-100'}`}>
          <div className={`absolute top-0 right-0 w-72 h-72 rounded-full blur-[100px] ${dark ? 'bg-brand-gold/5' : 'bg-brand-gold/5'}`}></div>
          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
            <div className="space-y-6">
              <span className={`inline-flex items-center gap-2 font-black text-sm uppercase tracking-wider ${dark ? 'text-brand-gold-light' : 'text-brand-gold-dark'}`}>
                <Sparkles size={16} />
                {text('home_about_heading')}
              </span>
              <p className={`text-lg leading-relaxed ${dark ? 'text-gray-300' : 'text-gray-600'}`}>{text('home_about_paragraph_1')}</p>
              <p className={`text-lg leading-relaxed ${dark ? 'text-gray-300' : 'text-gray-600'}`}>{text('home_about_paragraph_2')}</p>
              <Link href="/about" className={`inline-flex items-center gap-2 font-black text-sm px-6 py-3 rounded-xl border transition-all duration-300 ${dark ? 'border-brand-gold/40 text-brand-gold-light hover:bg-brand-gold/10' : 'border-brand-gold/40 text-brand-gold-dark hover:bg-brand-gold/10'}`}>
                {text('home_about_cta')}
                <ChevronRight className="rtl:rotate-180" size={16} />
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {aboutValues.map((value, i) => (
                <div key={i} className={`p-7 rounded-3xl border shadow-sm transition-all duration-300 ${cardCls}`}>
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-5 ${featIconCls}`}>
                    <value.icon size={24} />
                  </div>
                  <h4 className={`text-lg font-black mb-2 ${cardTitleCls}`}>{text(value.titleKey)}</h4>
                  <p className={`text-sm leading-relaxed ${cardDescCls}`}>{text(value.descKey)}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Contact Section */}
        <section style={sectionStyle('contact')} className="relative">
          <div className="text-center mb-14">
            <h3 className={`text-3xl md:text-4xl font-black mb-4 ${dark ? 'text-white' : 'text-brand-navy'}`}>{text('home_contact_heading')}</h3>
            <p className={`max-w-xl mx-auto text-lg leading-relaxed ${dark ? 'text-gray-400' : 'text-gray-500'}`}>{text('home_contact_desc')}</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
            <div className={`border rounded-3xl p-8 transition-all duration-500 hover:-translate-y-1 ${cardCls}`}>
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-5 ${featIconCls}`}>
                <Mail size={22} />
              </div>
              <h4 className={`text-lg font-black mb-2 ${cardTitleCls}`}>{text('contact_email_label')}</h4>
              <a href={`mailto:${text('contact_email')}`} className={`text-sm font-bold break-all hover:text-brand-gold-dark dark:hover:text-brand-gold-light ${dark ? 'text-gray-400' : 'text-gray-500'}`}>
                {text('contact_email')}
              </a>
            </div>

            <div className={`border rounded-3xl p-8 transition-all duration-500 hover:-translate-y-1 ${cardCls}`}>
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-5 ${featIconCls}`}>
                <Clock size={22} />
              </div>
              <h4 className={`text-lg font-black mb-2 ${cardTitleCls}`}>{text('contact_hours_label')}</h4>
              <p className={`text-sm font-bold ${dark ? 'text-gray-400' : 'text-gray-500'}`}>
                {text('contact_hours')}
              </p>
            </div>

            <div className={`border rounded-3xl p-8 transition-all duration-500 hover:-translate-y-1 ${cardCls}`}>
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-5 ${featIconCls}`}>
                <Phone size={22} />
              </div>
              <h4 className={`text-lg font-black mb-2 ${cardTitleCls}`}>{text('contact_phone_title')}</h4>
              <p dir="ltr" className={`mb-4 text-sm font-bold ${dark ? 'text-gray-400' : 'text-gray-500'}`}>{text('contact_phone')}</p>
              <div className="flex flex-wrap gap-2">
                <a href={phoneForCall ? `tel:${phoneForCall}` : undefined} className="inline-flex items-center gap-2 rounded-xl bg-brand-navy px-3 py-2 text-sm font-black text-white transition hover:bg-brand-navy-light">
                  <Phone size={15} /> {text('contact_call_button')}
                </a>
                <a href={phoneDigits ? `https://wa.me/${phoneDigits}` : undefined} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-black text-white transition hover:bg-emerald-700">
                  <MessageCircle size={15} /> {text('contact_whatsapp_button')}
                </a>
              </div>
            </div>

            <div className={`border rounded-3xl p-8 transition-all duration-500 hover:-translate-y-1 ${cardCls}`}>
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-5 ${featIconCls}`}>
                <MapPin size={22} />
              </div>
              <h4 className={`text-lg font-black mb-2 ${cardTitleCls}`}>{text('contact_social_title')}</h4>
              <div className="space-y-2.5">
                {socials.map((social, i) => (
                  <a
                    key={i}
                    href={social.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`flex items-center gap-3 text-sm font-bold group/link py-1 ${dark ? 'text-gray-400 hover:text-brand-gold-light' : 'text-gray-500 hover:text-brand-gold-dark'}`}
                  >
                    <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${featIconCls}`}>
                      <social.icon size={16} />
                    </span>
                    <span className="truncate">{social.label}</span>
                    <span className={`ml-auto hidden sm:block text-xs font-semibold ${dark ? 'text-gray-500' : 'text-gray-400'}`}>{social.handle}</span>
                  </a>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section style={sectionStyle('cta')} className="relative bg-gradient-to-br from-[#10264a] via-brand-navy to-[#0a1e3c] border border-white/10 rounded-3xl py-16 px-6 text-center shadow-2xl shadow-black/40 overflow-hidden">
          <div className="absolute top-0 right-1/4 w-64 h-64 bg-brand-gold/10 rounded-full blur-[100px]"></div>
          <div className="absolute bottom-0 left-1/4 w-72 h-72 bg-brand-gold/5 rounded-full blur-[100px]"></div>
          <div className="relative z-10 max-w-3xl mx-auto space-y-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-brand-gold/15 text-brand-gold-light ring-1 ring-inset ring-brand-gold/25 shadow-lg shadow-brand-gold/10">
              <Sparkles size={30} />
            </div>
            <h3 className="text-3xl md:text-4xl font-black text-white">{text('cta_heading')}</h3>
            <p className="text-gray-300 text-lg">{text('cta_desc')}</p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
              <Link href="/register">
                <button className="bg-gradient-to-r from-brand-gold to-brand-gold-light text-brand-navy-dark font-black text-lg px-12 py-4 rounded-xl shadow-lg shadow-brand-gold/20 hover:shadow-xl hover:shadow-brand-gold/30 hover:-translate-y-1 transition-all duration-300">
                  {text('cta_register')}
                </button>
              </Link>
              <Link href="/courses">
                <button className="bg-white/5 border border-white/10 text-white font-bold text-lg px-10 py-4 rounded-xl hover:border-brand-gold hover:text-brand-gold-light transition-all duration-300">
                  {text('cta_browse')}
                </button>
              </Link>
            </div>
          </div>
        </section>
      </div>
    </MarketingShell>
  );
}