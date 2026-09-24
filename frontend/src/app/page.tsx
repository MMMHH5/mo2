'use client';
import Link from 'next/link';
import { BookOpen, Award, Shield, Users, GraduationCap, ChevronRight, Sparkles, PlayCircle } from 'lucide-react';
import { useI18n } from '@/lib/i18n-context';
import { useTheme } from '@/lib/theme-context';
import { useFetchData } from '@/lib/useFetchData';
import { formatNumber } from '@/lib/format';
import AnnouncementBanner from '@/components/AnnouncementBanner';
import MarketingShell from '@/components/MarketingShell';

export default function Home() {
  const { t, locale } = useI18n();
  const { dark } = useTheme();
  const { data: stats } = useFetchData<{ courses: number; instructors: number; enrollments: number; certificates: number } | null>('/public/stats');

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
  const brandLineCls = dark
    ? 'bg-gradient-to-r from-brand-gold-light via-brand-gold to-brand-gold-light bg-clip-text text-transparent'
    : 'text-brand-gold-dark';
  const whyBannerCls = dark
    ? 'text-brand-gold-light [text-shadow:0_0_40px_rgba(238,193,102,0.25)]'
    : 'text-brand-gold-dark';
  const cardCls = dark
    ? 'bg-brand-navy border-white/10 hover:border-brand-gold/50 shadow-black/20 hover:shadow-[0_8px_30px_rgba(238,193,102,0.12)]'
    : 'bg-white border-gray-100 hover:border-brand-gold/50 hover:shadow-[0_8px_30px_rgb(18,48,90,0.08)] shadow-sm';
  const featIconCls = dark ? 'text-brand-gold-light bg-brand-gold/15' : 'text-brand-gold-dark bg-brand-gold/10';
  const cardTitleCls = dark ? 'text-white' : 'text-brand-navy';
  const cardDescCls = dark ? 'text-gray-400' : 'text-gray-500';

  return (
    <MarketingShell>
      {/* Announcement Banner */}
      <div className={`-mt-12 -mx-6 mb-8 rounded-b-3xl overflow-hidden ${dark ? 'shadow-lg shadow-black/20' : 'shadow-sm'}`}>
        <AnnouncementBanner variant="public" />
      </div>

      <div className="flex flex-col items-center justify-center min-h-[70vh] relative animate-fade-in-up">
        {/* Decorative background blobs */}
        <div className={`absolute top-10 left-10 w-72 h-72 rounded-full blur-[80px] -z-10 animate-float ${dark ? 'bg-brand-gold/10' : 'bg-brand-gold/10'}`} style={{ animationDuration: '6s' }}></div>
        <div className={`absolute bottom-10 right-10 w-96 h-96 rounded-full blur-[100px] -z-10 animate-float ${dark ? 'bg-brand-navy-light/15' : 'bg-brand-navy-light/5'}`} style={{ animationDuration: '8s', animationDelay: '2s' }}></div>

        <div className="max-w-4xl mx-auto text-center space-y-8 z-10 px-4">
          <div className={`inline-flex items-center gap-2 px-5 py-2 rounded-full ${badgeCls} font-bold text-sm shadow-sm animate-scale-in`}>
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-gold opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-brand-gold"></span>
            </span>
            {t('landing.badge')}
          </div>

          <h2 className={`text-5xl md:text-7xl font-black tracking-tight leading-tight ${heroTitleCls}`}>
            {t('landing.hero_title')}
            <span className={`block mt-3 ${brandLineCls}`}>
              LaxaLab
            </span>
          </h2>

          <p className={`text-xl md:text-2xl max-w-2xl mx-auto font-medium leading-relaxed ${heroDescCls}`}>
            {t('landing.hero_desc')}
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-6">
            <Link href="/courses">
              <button className={`flex items-center gap-2 font-black text-lg px-8 py-4 rounded-2xl shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 group ${exploreBtnCls}`}>
                {t('landing.explore_courses')}
                <ChevronRight className="rtl:rotate-180 group-hover:translate-x-1 rtl:group-hover:-translate-x-1 transition-transform" />
              </button>
            </Link>
            <Link href="/join-as-instructor">
              <button className={`flex items-center gap-2 border font-bold text-lg px-8 py-4 rounded-2xl hover:shadow-lg transition-all duration-300 ${joinBtnCls}`}>
                <GraduationCap size={22} />
                {t('landing.join_as_instructor')}
              </button>
            </Link>
          </div>

          <div className={`flex flex-wrap items-center justify-center gap-x-8 gap-y-3 pt-4 text-sm font-semibold ${dark ? 'text-brand-mist' : 'text-gray-600'}`}>
            <span className="inline-flex items-center gap-2"><Shield size={16} className="text-brand-gold" />{t('landing.trust_payment')}</span>
            <span className="inline-flex items-center gap-2"><Award size={16} className="text-brand-gold" />{t('landing.trust_instructors')}</span>
            <span className="inline-flex items-center gap-2"><PlayCircle size={16} className="text-brand-gold" />{t('landing.trust_anytime')}</span>
          </div>
        </div>
      </div>

      <div className="mt-24 space-y-32">
        {/* Features Section */}
        <section className="relative">
          <div className="text-center mb-16">
            <h3 className={`text-3xl md:text-4xl font-black mb-4 ${dark ? 'text-white' : 'text-brand-navy'}`}>
              {t('landing.why_heading')}
              <span className={`block mt-2 ${whyBannerCls}`}>LaxaLab</span>
            </h3>
            <p className={`max-w-xl mx-auto text-lg leading-relaxed ${dark ? 'text-gray-400' : 'text-gray-500'}`}>{t('landing.why_desc')}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { icon: BookOpen, titleKey: 'landing.feature_1_title', descKey: 'landing.feature_1_desc' },
              { icon: Shield, titleKey: 'landing.feature_2_title', descKey: 'landing.feature_2_desc' },
              { icon: Award, titleKey: 'landing.feature_3_title', descKey: 'landing.feature_3_desc' }
            ].map((feature, i) => (
              <div key={i} className={`border rounded-3xl p-8 transition-all duration-500 group transform hover:-translate-y-2 ${cardCls}`}>
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500 ${featIconCls}`}>
                  <feature.icon size={28} />
                </div>
                <h3 className={`text-xl font-black mb-3 ${cardTitleCls}`}>{t(feature.titleKey)}</h3>
                <p className={`leading-relaxed font-medium ${cardDescCls}`}>{t(feature.descKey)}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Stats Section */}
        {stats && (
          <section className="relative">
            <div className="bg-gradient-to-br from-brand-navy via-[#0e2a52] to-[#0a1e3c] rounded-3xl p-10 md:p-14 shadow-2xl shadow-black/40 overflow-hidden relative border border-white/10">
              <div className="absolute top-0 right-0 w-64 h-64 bg-brand-gold/10 rounded-full blur-[80px]"></div>
              <div className="absolute bottom-0 left-0 w-72 h-72 bg-brand-navy-light/20 rounded-full blur-[100px]"></div>

              <div className="relative z-10">
                <h3 className="text-center text-white font-black text-3xl md:text-4xl mb-12">{t('landing.stats_heading')}</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                  {[
                    { icon: BookOpen, value: stats.courses, labelKey: 'landing.stats_courses' },
                    { icon: GraduationCap, value: stats.instructors, labelKey: 'landing.stats_instructors' },
                    { icon: Users, value: stats.enrollments, labelKey: 'landing.stats_enrollments' },
                    { icon: Award, value: stats.certificates, labelKey: 'landing.stats_certificates' }
                  ].map((stat, i) => (
                    <div key={i} className="text-center group">
                      <div className="w-16 h-16 rounded-2xl bg-white/10 text-brand-gold flex items-center justify-center mx-auto mb-5 group-hover:bg-brand-gold group-hover:text-brand-navy transition-all duration-500 shadow-inner block">
                        <stat.icon size={28} />
                      </div>
                      <p className="text-4xl md:text-5xl font-black text-white mb-2 tracking-tight drop-shadow-md">{formatNumber(stat.value, locale)}</p>
                      <p className="text-sm font-bold text-gray-300 tracking-wide uppercase">{t(stat.labelKey)}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* CTA Section */}
        <section className={`relative bg-gradient-to-br from-[#10264a] via-brand-navy to-[#0a1e3c] border border-white/10 rounded-3xl py-16 px-6 text-center shadow-2xl shadow-black/40 overflow-hidden`}>
          <div className="absolute top-0 right-1/4 w-64 h-64 bg-brand-gold/10 rounded-full blur-[100px]"></div>
          <div className="absolute bottom-0 left-1/4 w-72 h-72 bg-brand-gold/5 rounded-full blur-[100px]"></div>
          <div className="relative z-10 max-w-3xl mx-auto space-y-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-brand-gold/15 text-brand-gold-light ring-1 ring-inset ring-brand-gold/25 shadow-lg shadow-brand-gold/10">
              <Sparkles size={30} />
            </div>
            <h3 className="text-3xl md:text-4xl font-black text-white">{t('landing.cta_heading')}</h3>
            <p className="text-gray-300 text-lg">{t('landing.cta_desc')}</p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
              <Link href="/register">
                <button className="bg-gradient-to-r from-brand-gold to-brand-gold-light text-brand-navy-dark font-black text-lg px-12 py-4 rounded-xl shadow-lg shadow-brand-gold/20 hover:shadow-xl hover:shadow-brand-gold/30 hover:-translate-y-1 transition-all duration-300">
                  {t('landing.cta_register')}
                </button>
              </Link>
              <Link href="/courses">
                <button className="bg-white/5 border border-white/10 text-white font-bold text-lg px-10 py-4 rounded-xl hover:border-brand-gold hover:text-brand-gold-light transition-all duration-300">
                  {t('landing.cta_browse')}
                </button>
              </Link>
            </div>
          </div>
        </section>
      </div>
    </MarketingShell>
  );
}