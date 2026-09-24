"use client";

import React, { useState } from 'react';
import { api, getErrorMessage } from '@/lib/api';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/lib/i18n-context';
import { UploadCloud, CheckCircle, Video, User, Briefcase } from 'lucide-react';
import MarketingShell from '@/components/MarketingShell';

export default function JoinAsInstructorPage() {
    const router = useRouter();
    const { t, locale } = useI18n();
    const isAr = locale === 'ar';
    const [formData, setFormData] = useState({ name: '', bio: '', specialty: '', videoIntroUrl: '' });
    const [cvFile, setCvFile] = useState<File | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [success, setSuccess] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!cvFile) {
            toast.error(t('joinInstructor.cv_required'));
            return;
        }
        if (!formData.name || !formData.bio || !formData.specialty) {
            toast.error(t('joinInstructor.fill_required'));
            return;
        }

        setIsSubmitting(true);
        const data = new FormData();
        data.append('cv', cvFile);
        data.append('name', formData.name);
        data.append('bio', formData.bio);
        data.append('specialty', formData.specialty);
        if (formData.videoIntroUrl) data.append('videoIntroUrl', formData.videoIntroUrl);

        try {
            await api.post('/instructor-applications', data, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setSuccess(true);
            toast.success(t('joinInstructor.submitted'));
        } catch (error) {
            const is401 = error && typeof error === 'object' && 'response' in error
                && (error as { response?: { status?: number } }).response?.status === 401;
            if (is401) {
                toast.error(t('joinInstructor.must_login'));
                router.push('/login?redirect=/join-as-instructor');
            } else {
                toast.error(getErrorMessage(error) || t('joinInstructor.submit_fail'));
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    if (success) {
        return (
            <MarketingShell dark>
                <div className="flex items-center justify-center p-4 py-20">
                    <div className="bg-brand-navy-dark p-12 rounded-3xl shadow-black/30 max-w-lg w-full text-center border border-white/10">
                        <CheckCircle className="w-24 h-24 text-green-500 mx-auto mb-6" />
                        <h2 className="text-3xl font-black text-white mb-4">{t('joinInstructor.success_title')}</h2>
                        <p className="text-gray-400 mb-8">
                            {t('joinInstructor.success_desc')}
                        </p>
                        <button
                            onClick={() => router.push('/dashboard')}
                            className="bg-brand-gold hover:bg-[#b08e50] text-brand-navy font-bold py-4 px-8 rounded-xl shadow-lg transition w-full"
                        >
                            {t('joinInstructor.go_dashboard')}
                        </button>
                    </div>
                </div>
            </MarketingShell>
        );
    }

    return (
        <MarketingShell
            dark
            title={t('joinInstructor.teach_title')}
            subtitle={t('joinInstructor.teach_desc')}
        >
            {/* Application Form */}
            <div className="max-w-3xl mx-auto -mt-32 relative z-10 pb-20">
                <div className="bg-brand-navy-dark p-8 md:p-12 rounded-3xl shadow-black/30 border border-white/10">
                    <h2 className="text-2xl font-black text-white mb-8 border-b border-white/10 pb-4">{t('joinInstructor.app_heading')}</h2>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-bold text-gray-300 mb-2 flex items-center gap-2">
                                    <User size={16} /> {t('joinInstructor.full_name_label')}
                                </label>
                                <input
                                    type="text"
                                    required
                                    className="w-full border border-white/10 bg-white/5 hover:bg-white/10 rounded-xl p-4 focus:ring-2 focus:ring-brand-gold focus:border-brand-gold outline-none transition-all text-white [color-scheme:dark]"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-300 mb-2 flex items-center gap-2">
                                    <Briefcase size={16} /> {t('joinInstructor.specialty_label')}
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder={t('joinInstructor.specialty_placeholder')}
                                    className="w-full border border-white/10 bg-white/5 hover:bg-white/10 rounded-xl p-4 focus:ring-2 focus:ring-brand-gold focus:border-brand-gold outline-none transition-all text-white [color-scheme:dark]"
                                    value={formData.specialty}
                                    onChange={e => setFormData({ ...formData, specialty: e.target.value })}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-300 mb-2 flex items-center gap-2">
                                <Video size={16} /> {t('joinInstructor.video_label')}
                            </label>
                            <input
                                type="url"
                                placeholder={t('joinInstructor.video_placeholder')}
                                className="w-full border border-white/10 bg-white/5 hover:bg-white/10 rounded-xl p-4 focus:ring-2 focus:ring-brand-gold focus:border-brand-gold outline-none transition-all text-white [color-scheme:dark]"
                                value={formData.videoIntroUrl}
                                onChange={e => setFormData({ ...formData, videoIntroUrl: e.target.value })}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-300 mb-2">{t('joinInstructor.bio_label')}</label>
                            <textarea
                                required
                                rows={4}
                                placeholder={t('joinInstructor.bio_placeholder')}
                                className="w-full border border-white/10 bg-white/5 hover:bg-white/10 rounded-xl p-4 focus:ring-2 focus:ring-brand-gold focus:border-brand-gold outline-none transition-all text-white [color-scheme:dark]"
                                value={formData.bio}
                                onChange={e => setFormData({ ...formData, bio: e.target.value })}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-300 mb-2">{t('joinInstructor.cv_label')}</label>
                            <label className={`flex flex-col items-center justify-center border-2 border-dashed rounded-2xl p-8 cursor-pointer transition ${cvFile ? 'border-brand-gold bg-brand-gold/10' : 'border-white/15 hover:bg-white/5 hover:border-white/25'}`}>
                                <UploadCloud className={cvFile ? "text-brand-gold mb-2" : "text-gray-500 mb-2"} size={32} />
                                <span className={cvFile ? "font-bold text-brand-gold-light" : "text-gray-400 font-medium"}>
                                    {cvFile ? cvFile.name : t('joinInstructor.cv_placeholder')}
                                </span>
                                <input
                                    type="file"
                                    accept=".pdf,.doc,.docx"
                                    className="hidden"
                                    onChange={e => setCvFile(e.target.files?.[0] || null)}
                                />
                            </label>
                        </div>

                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="bg-brand-gold hover:bg-brand-gold-light hover:-translate-y-1 text-brand-navy-dark font-bold py-4 px-8 rounded-xl shadow-lg transition-all duration-300 w-full disabled:opacity-50 mt-8 disabled:hover:translate-y-0"
                        >
                            {isSubmitting ? t('joinInstructor.submitting') : t('joinInstructor.submit_application')}
                        </button>
                    </form>
                </div>
            </div>
        </MarketingShell>
    );
}