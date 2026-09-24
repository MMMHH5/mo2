'use client';
import Link from 'next/link';
import { BookOpen, Award, Shield, Users, GraduationCap, ChevronRight } from 'lucide-react';
import { useI18n } from '@/lib/i18n-context';
import { useFetchData } from '@/lib/useFetchData';
import { formatNumber } from '@/lib/format';
import AnnouncementBanner from '@/components/AnnouncementBanner';
import MarketingShell from '@/components/MarketingShell';

export default function Home() {
  const { t, locale } = useI18n();
  const { data: stats } = useFetchData<{ courses: number; instructors: number; enrollments: number; certificates: number } | null>('/public/stats');

  return (
    <MarketingShell>
      {/* Announcement Banner */}
      <div className="-mt-12 -mx-6 mb-8 rounded-b-3xl overflow-hidden shadow-sm">
        <AnnouncementBanner variant="public" />
      </div>

      <div className="flex flex-col items-center justify-center min-h-[70vh] relative animate-fade-in-up">
        {/* Decorative background blobs */}
        <div className="absolute top-10 left-10 w-72 h-72 bg-brand-gold/10 rounded-full blur-[80px] -z-10 animate-float" style={{ animationDuration: '6s' }}></div>
        <div className="absolute bottom-10 right-10 w-96 h-96 bg-brand-navy-light/5 rounded-full blur-[100px] -z-10 animate-float" style={{ animationDuration: '8s', animationDelay: '2s' }}></div>

        <div className="max-w-4xl mx-auto text-center space-y-8 z-10 px-4">
          <div className="inline-flex items-center gap-2 px-5 py-2 glass-panel rounded-full text-brand-navy font-bold text-sm shadow-sm animate-scale-in">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-gold opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-brand-gold"></span>
            </span>
            {t('landing.badge')}
          </div>

          <h2 className="text-5xl md:text-7xl font-black text-brand-navy tracking-tight leading-tight">
            {t('landing.hero_title')}
          </h2>

          <p className="text-xl md:text-2xl text-gray-600 max-w-2xl mx-auto font-medium leading-relaxed">
            {t('landing.hero_desc')}
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-6">
            <Link href="/courses">
              <button className="flex items-center gap-2 bg-brand-navy text-white font-black text-lg px-8 py-4 rounded-2xl shadow-xl hover:shadow-2xl hover:bg-brand-navy-light hover:-translate-y-1 transition-all duration-300 group">
                {t('landing.explore_courses')}
                <ChevronRight className="rtl:rotate-180 group-hover:translate-x-1 rtl:group-hover:-translate-x-1 transition-transform" />
              </button>
            </Link>
            <Link href="/join-as-instructor">
              <button className="flex items-center gap-2 bg-white border border-gray-200 text-brand-navy font-bold text-lg px-8 py-4 rounded-2xl hover:border-brand-gold hover:text-brand-gold-dark hover:shadow-lg transition-all duration-300">
                {t('landing.join_as_instructor')}
              </button>
            </Link>
          </div>
        </div>
      </div>

      <div className="mt-24 space-y-32">
        {/* Features Section */}
        <section className="relative">
          <div className="text-center mb-16">
            <h3 className="text-3xl md:text-4xl font-black text-brand-navy mb-4">لماذا منصة <span className="text-brand-gold-dark">Laxal<span className="text-brand-navy">ab</span></span> ؟</h3>
            <p className="text-gray-500 max-w-xl mx-auto text-lg leading-relaxed">نوفر لك بيئة تعليمية متكاملة مصممة خصيصاً لتطوير قدراتك وتعزيز مهاراتك بشهادات معتمدة محلياً وعالمياً.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { icon: BookOpen, titleKey: 'landing.feature_1_title', descKey: 'landing.feature_1_desc', color: 'text-brand-navy', bg: 'bg-brand-mist' },
              { icon: Shield, titleKey: 'landing.feature_2_title', descKey: 'landing.feature_2_desc', color: 'text-brand-gold-dark', bg: 'bg-brand-gold/10' },
              { icon: Award, titleKey: 'landing.feature_3_title', descKey: 'landing.feature_3_desc', color: 'text-emerald-700', bg: 'bg-emerald-50' }
            ].map((feature, i) => (
              <div key={i} className="bg-white border border-gray-100 rounded-3xl p-8 hover:border-brand-gold/50 shadow-sm hover:shadow-[0_8px_30px_rgb(18,48,90,0.08)] transition-all duration-500 group transform hover:-translate-y-2">
                <div className={`w-16 h-16 rounded-2xl ${feature.bg} ${feature.color} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500`}>
                  <feature.icon size={28} />
                </div>
                <h3 className="text-xl font-black text-brand-navy mb-3">{t(feature.titleKey)}</h3>
                <p className="text-gray-500 leading-relaxed font-medium">{t(feature.descKey)}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Stats Section */}
        {stats && (
          <section className="relative">
            <div className="bg-gradient-to-br from-brand-navy via-[#0e2a52] to-[#0a1e3c] rounded-3xl p-10 md:p-14 shadow-2xl overflow-hidden relative">
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-[80px]"></div>

              <div className="relative z-10">
                <h3 className="text-center text-white font-black text-3xl md:text-4xl mb-12">أرقام نفخر بها</h3>
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
        <section className="bg-gradient-to-r from-brand-gold/10 to-brand-gold-light/10 border border-brand-gold/20 rounded-3xl py-16 px-6 text-center shadow-sm">
          <div className="max-w-3xl mx-auto space-y-8">
            <h3 className="text-3xl md:text-4xl font-black text-brand-navy">{t('landing.hero_title')}</h3>
            <p className="text-gray-600 text-lg">انضم إلى مجتمعنا الآن وابدأ رحلة تعليمية جديدة تصنع مستقبلك</p>
            <div className="pt-4">
              <Link href="/register">
                <button className="bg-brand-navy text-white font-black text-lg px-12 py-4 rounded-xl shadow-lg hover:bg-brand-charcoal hover:-translate-y-1 transition-all duration-300">
                  {t('auth.register')}
                </button>
              </Link>
            </div>
          </div>
        </section>
      </div>
    </MarketingShell>
  );
}
