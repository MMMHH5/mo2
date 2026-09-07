"use client";

import Link from 'next/link';
import { BookOpen, Award, Shield, Users, GraduationCap } from 'lucide-react';
import { useI18n } from '@/lib/i18n-context';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import PublicMobileMenu from '@/components/PublicMobileMenu';
import { useFetchData } from '@/lib/useFetchData';
import { formatNumber } from '@/lib/format';
import AnnouncementBanner from '@/components/AnnouncementBanner';

export default function Home() {
  const { t, locale } = useI18n();
  const { data: stats } = useFetchData<{ courses: number; instructors: number; enrollments: number; certificates: number } | null>('/public/stats');

  return (
    <div dir="rtl" className="min-h-screen bg-[#0a1830] flex flex-col">
      {/* Header */}
      <header className="px-8 py-6 flex items-center justify-between border-b border-white/5 bg-[#0a1830]/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl flex items-center justify-center shadow-lg shadow-amber-500/20">
            <span className="text-black font-black text-xl">L</span>
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">
            laxa<span className="text-amber-400">lab</span>
          </h1>
        </div>
        <nav className="hidden md:flex items-center gap-8">
          <Link href="/courses" className="text-gray-300 font-bold hover:text-white transition">
            {t('landing.explore_courses')}
          </Link>
          <Link href="/join-as-instructor" className="text-gray-300 font-bold hover:text-white transition">
            {t('landing.join_as_instructor')}
          </Link>
        </nav>
        <div className="flex items-center gap-4">
          <PublicMobileMenu />
          <div className="hidden sm:flex items-center gap-4">
            <LanguageSwitcher />
            <Link href="/login">
              <button className="text-white hover:text-amber-400 font-bold transition">
                {t('auth.login')}
              </button>
            </Link>
            <Link href="/register">
              <button className="bg-white/10 border border-white/10 text-white font-bold px-6 py-2.5 rounded-xl hover:bg-white/15 transition-all duration-300">
                {t('auth.register')}
              </button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center relative overflow-hidden">
        {/* Hero - Full viewport */}
        <section className="w-full min-h-[90vh] flex flex-col items-center justify-center px-4 relative">
          {/* Animated gradient blobs — very subtle */}
          <div className="absolute top-20 left-[10%] w-[500px] h-[500px] bg-blue-500/6 rounded-full blur-[128px]"></div>
          <div className="absolute bottom-20 right-[15%] w-[400px] h-[400px] bg-indigo-500/6 rounded-full blur-[128px]"></div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-white/[0.02] rounded-full blur-[160px]"></div>

          <div className="max-w-5xl mx-auto text-center space-y-8 z-10">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-full text-gray-300 font-semibold text-sm animate-fade-in-up">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </span>
              {t('landing.badge')}
            </div>

            {/* Title */}
            <h2 className="text-6xl md:text-8xl font-black text-white tracking-tight leading-tight animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
              {t('landing.hero_title')}
            </h2>

            {/* Description */}
            <p className="text-xl md:text-2xl text-gray-400 max-w-2xl mx-auto font-medium leading-relaxed animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
              {t('landing.hero_desc')}
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-8 animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
              <Link href="/courses">
                <button className="bg-white text-[#0a1830] font-black text-lg px-10 py-5 rounded-2xl shadow-2xl shadow-white/10 hover:shadow-white/20 hover:-translate-y-1 transition-all duration-300">
                  {t('landing.explore_courses')}
                </button>
              </Link>
              <Link href="/join-as-instructor">
                <button className="border border-white/10 text-white font-bold px-10 py-5 rounded-2xl hover:bg-white/5 hover:border-white/20 transition-all duration-300">
                  {t('landing.join_as_instructor')}
                </button>
              </Link>
            </div>
          </div>
        </section>

        {/* Announcement Banner — full width */}
        <section className="w-full -mt-4 z-10 relative px-0">
          <AnnouncementBanner variant="public" />
        </section>

        {/* Features Section */}
        <section className="w-full bg-[#0d1f3c] py-24 px-4 relative">
          {/* Dot pattern background */}
          <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>

          <div className="max-w-5xl mx-auto relative z-10">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { icon: BookOpen, titleKey: 'landing.feature_1_title', descKey: 'landing.feature_1_desc' },
                { icon: Shield, titleKey: 'landing.feature_2_title', descKey: 'landing.feature_2_desc' },
                { icon: Award, titleKey: 'landing.feature_3_title', descKey: 'landing.feature_3_desc' }
              ].map((feature, i) => (
                <div key={i} className="bg-[#111f3a] border border-white/5 rounded-3xl p-8 hover:border-white/10 hover:shadow-2xl transition-all duration-500 group">
                  <div className="w-16 h-16 rounded-2xl bg-white/5 text-gray-300 flex items-center justify-center mb-6 group-hover:bg-white/10 group-hover:text-white transition-all duration-500">
                    <feature.icon size={28} />
                  </div>
                  <h3 className="text-xl font-black text-white mb-3">{t(feature.titleKey)}</h3>
                  <p className="text-gray-400 leading-relaxed">{t(feature.descKey)}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Stats Section */}
        {stats && (
          <section className="w-full bg-white/[0.02] border-y border-white/5 py-24 px-4">
            <div className="max-w-5xl mx-auto bg-[#0a1830]/50 backdrop-blur-sm rounded-3xl p-8 md:p-12">
              <h3 className="text-center text-white font-black text-3xl mb-10">{t('landing.stats_heading')}</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                {[
                  { icon: BookOpen, value: stats.courses, labelKey: 'landing.stats_courses' },
                  { icon: GraduationCap, value: stats.instructors, labelKey: 'landing.stats_instructors' },
                  { icon: Users, value: stats.enrollments, labelKey: 'landing.stats_enrollments' },
                  { icon: Award, value: stats.certificates, labelKey: 'landing.stats_certificates' }
                ].map((stat, i) => (
                  <div key={i} className="bg-[#111f3a] border border-white/5 rounded-2xl p-6 text-center hover:border-white/10 transition-all duration-300">
                    <div className="w-14 h-14 rounded-2xl bg-white/5 text-gray-400 flex items-center justify-center mx-auto mb-4">
                      <stat.icon size={24} />
                    </div>
                    <p className="text-5xl font-black text-white mb-2">{formatNumber(stat.value, locale)}</p>
                    <p className="text-sm font-bold text-gray-400">{t(stat.labelKey)}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* CTA Section */}
        <section className="w-full bg-[#111f3a] border-y border-white/5 py-20 px-4">
          <div className="max-w-4xl mx-auto text-center space-y-8">
            <h3 className="text-4xl font-black text-white">{t('landing.hero_title')}</h3>
            <Link href="/register">
              <button className="bg-white text-[#0a1830] font-black px-10 py-4 rounded-2xl hover:bg-gray-100 transition-all duration-300">
                {t('auth.register')}
              </button>
            </Link>
          </div>
        </section>

        {/* Footer */}
        <footer className="w-full bg-[#0a1830] border-t border-white/5 py-16 px-4">
          <div className="max-w-5xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-12 mb-12">
              {/* Brand */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl flex items-center justify-center shadow-lg shadow-amber-500/20">
                    <span className="text-black font-black text-xl">L</span>
                  </div>
                  <h1 className="text-2xl font-black text-white tracking-tight">
                    laxa<span className="text-amber-400">lab</span>
                  </h1>
                </div>
                <p className="text-gray-400 leading-relaxed text-sm max-w-xs">
                  {t('landing.hero_desc')}
                </p>
              </div>

              {/* Platform */}
              <div>
                <h4 className="text-white font-black text-lg mb-4">Platform</h4>
                <ul className="space-y-3">
                  <li><Link href="/courses" className="text-gray-400 hover:text-white transition text-sm">{t('landing.explore_courses')}</Link></li>
                  <li><Link href="/courses" className="text-gray-400 hover:text-white transition text-sm">{t('landing.stats_heading')}</Link></li>
                  <li><Link href="/courses" className="text-gray-400 hover:text-white transition text-sm">FAQ</Link></li>
                  <li><Link href="/courses" className="text-gray-400 hover:text-white transition text-sm">{t('landing.join_as_instructor')}</Link></li>
                </ul>
              </div>

              {/* Policy */}
              <div>
                <h4 className="text-white font-black text-lg mb-4">Policy</h4>
                <ul className="space-y-3">
                  <li><Link href="/courses" className="text-gray-400 hover:text-white transition text-sm">Terms of Service</Link></li>
                  <li><Link href="/courses" className="text-gray-400 hover:text-white transition text-sm">Privacy Policy</Link></li>
                  <li><Link href="/courses" className="text-gray-400 hover:text-white transition text-sm">Refund Policy</Link></li>
                </ul>
              </div>
            </div>

            <div className="border-t border-white/5 pt-8 text-center">
              <p className="text-gray-400 text-sm">&copy; {new Date().getFullYear()} laxalab. All rights reserved.</p>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
