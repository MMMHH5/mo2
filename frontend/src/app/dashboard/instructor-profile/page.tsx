"use client";

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useFetchData } from '@/lib/useFetchData';
import { useI18n } from '@/lib/i18n-context';
import { api, getErrorMessage, API_BASE_URL } from '@/lib/api';
import toast from 'react-hot-toast';
import {
    BadgeCheck, Camera, Check, CircleAlert, Eye, Loader, Save, Sparkles, X,
} from 'lucide-react';

interface MyProfile {
    id: string;
    email: string;
    role: string;
    metadata?: Record<string, unknown> | null;
}

type Meta = Record<string, unknown>;

/** The CV keys this page owns. Every value is a string: form inputs hand
 *  back strings, and the server coerces `experienceYears` and trims the rest. */
interface CvForm {
    nameAr: string;
    nameEn: string;
    jobTitleAr: string;
    jobTitleEn: string;
    bio: string;
    bioEn: string;
    specialty: string;
    experienceYears: string;
}

const EMPTY: CvForm = {
    nameAr: '', nameEn: '', jobTitleAr: '', jobTitleEn: '',
    bio: '', bioEn: '', specialty: '', experienceYears: '',
};

const asText = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const asNum = (v: unknown) => (v === null || v === undefined || v === '' ? '' : String(v));

export default function InstructorProfilePage() {
    const { t, locale } = useI18n();
    const { data: profile, loading, error, refetch } = useFetchData<MyProfile>('/users/me');

    const [form, setForm] = useState<CvForm>(EMPTY);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const fileRef = useRef<HTMLInputElement | null>(null);

    // Hydrate the form from the loaded profile. The ref only remembers *which*
    // profile was hydrated, so the save's refetch does not overwrite the edits
    // in progress; the actual values come from state, set inside the effect.
    const hydratedFor = useRef<string | null>(null);
    useEffect(() => {
        if (!profile?.id || hydratedFor.current === profile.id) return;
        hydratedFor.current = profile.id;
        const m = (profile.metadata ?? {}) as Meta;
        setForm({
            nameAr: asText(m.nameAr),
            nameEn: asText(m.nameEn),
            jobTitleAr: asText(m.jobTitleAr),
            jobTitleEn: asText(m.jobTitleEn),
            bio: asText(m.bio),
            bioEn: asText(m.bioEn),
            specialty: asText(m.specialty),
            experienceYears: asNum(m.experienceYears),
        });
    }, [profile]);

    const set =
        (key: keyof CvForm) =>
        (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
            setForm((f) => ({ ...f, [key]: e.target.value }));

    const save = async () => {
        setSaving(true);
        try {
            // Only the CV keys are sent. PATCH /users/me merges, so an omitted
            // key keeps its stored value and the phone, country and academic
            // record this page never knew about survive untouched.
            await api.patch('/users/me', { metadata: form });
            toast.success(t('profile.saved'));
            refetch();
        } catch (err) {
            toast.error(getErrorMessage(err) || t('common.error'));
        } finally {
            setSaving(false);
        }
    };

    const uploadAvatar = async (file: File) => {
        setUploading(true);
        try {
            const body = new FormData();
            body.append('file', file);
            await api.post('/users/me/avatar', body, { headers: { 'Content-Type': 'multipart/form-data' } });
            toast.success(t('profile.avatar_updated'));
            refetch();
        } catch (err) {
            toast.error(getErrorMessage(err) || t('profile.avatar_failed'));
        } finally {
            setUploading(false);
            if (fileRef.current) fileRef.current.value = '';
        }
    };

    const avatar = asText((profile?.metadata as Meta | undefined)?.avatarUrl);
    const displayName = locale === 'ar'
        ? (form.nameAr || form.nameEn || '')
        : (form.nameEn || form.nameAr || '');
    const displayTitle = locale === 'ar'
        ? (form.jobTitleAr || form.jobTitleEn || '')
        : (form.jobTitleEn || form.jobTitleAr || '');

    // Mirrors `toPublicInstructor`'s notion of complete: an identity plus a
    // headline. Keeping the two in step means the badge here predicts what a
    // visitor will actually see.
    const hasIdentity = Boolean(form.nameAr || form.nameEn) && Boolean(avatar);
    const hasTitle = Boolean(form.jobTitleAr || form.jobTitleEn);
    const complete = Boolean(form.nameAr || form.nameEn) && hasTitle;

    const steps = [
        { label: t('instructorProfile.step_identity'), done: hasIdentity },
        { label: t('instructorProfile.step_title'), done: hasTitle },
        { label: t('instructorProfile.step_bio'), done: Boolean(form.bio) && Boolean(form.specialty) },
        { label: t('instructorProfile.step_bio_en'), done: Boolean(form.bioEn) },
    ];
    const doneCount = steps.filter((s) => s.done).length;

    const inputCls = 'w-full px-4 py-3 bg-brand-navy border border-white/10 rounded-xl text-white placeholder:text-gray-500 focus:ring-2 focus:ring-brand-gold/40 focus:border-brand-gold/40 outline-none transition';
    const labelCls = 'block text-sm font-bold text-gray-300 mb-1.5';
    const cardCls = 'bg-brand-navy-dark border border-white/5 rounded-2xl p-6 lg:p-7';

    return (
        <ProtectedRoute allowedRoles={['INSTRUCTOR', 'COURSE_MANAGER']}>
            <div className="min-h-screen bg-gray-50 dark:bg-brand-navy space-y-6 animate-fade-in p-6 lg:p-8">
                {/* Header */}
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-black text-brand-navy dark:text-white tracking-tight flex items-center gap-3">
                            <BadgeCheck className="text-brand-gold-dark dark:text-brand-gold-light" size={30} />
                            {t('instructorProfile.studio_title')}
                        </h1>
                        <p className="text-gray-600 dark:text-gray-400 text-sm mt-2 max-w-2xl">
                            {t('instructorProfile.studio_subtitle')}
                        </p>
                    </div>
                    {profile?.id && (
                        <Link
                            href={`/instructors/${profile.id}`}
                            target="_blank"
                            className="inline-flex items-center gap-2 bg-white dark:bg-brand-navy border border-gray-200 dark:border-white/10 text-brand-navy dark:text-white font-bold text-sm px-5 py-2.5 rounded-xl hover:border-brand-gold/50 transition-all"
                        >
                            <Eye size={16} /> {t('instructorProfile.view_public')}
                        </Link>
                    )}
                </div>

                {error && <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-500 dark:text-red-400 rounded-xl">{error}</div>}

                {!complete && (
                    <div className="flex items-start gap-3 p-4 bg-brand-gold/10 border border-brand-gold/30 text-brand-navy dark:text-brand-gold-light rounded-xl">
                        <CircleAlert size={18} className="mt-0.5 shrink-0" />
                        <p className="text-sm font-bold">{t('instructorProfile.required_hint')}</p>
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                    {/* ============ EDIT FORM ============ */}
                    <div className="lg:col-span-2 space-y-6">
                        <section className={cardCls}>
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-lg font-black text-white flex items-center gap-2">
                                    <Camera size={18} className="text-brand-gold-light" />
                                    {t('instructorProfile.photo_label')}
                                </h2>
                            </div>

                            <div className="flex flex-wrap items-center gap-5">
                                <div className="relative">
                                    {avatar ? (
                                        <img
                                            src={`${API_BASE_URL}${avatar}`}
                                            alt={t('instructorProfile.avatar_alt')}
                                            className="w-24 h-24 rounded-2xl object-cover border-2 border-brand-gold/30"
                                        />
                                    ) : (
                                        <div className="w-24 h-24 rounded-2xl bg-brand-navy border-2 border-dashed border-white/15 flex items-center justify-center text-gray-500">
                                            <Camera size={26} />
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1 min-w-[200px]">
                                    <input
                                        ref={fileRef}
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadAvatar(f); }}
                                    />
                                    <button
                                        onClick={() => fileRef.current?.click()}
                                        disabled={uploading}
                                        className="inline-flex items-center gap-2 bg-brand-gold/10 text-brand-gold-light border border-brand-gold/25 font-bold text-sm px-4 py-2.5 rounded-xl hover:bg-brand-gold hover:text-black transition-all disabled:opacity-50"
                                    >
                                        {uploading ? <Loader size={15} className="animate-spin" /> : <Camera size={15} />}
                                        {t('instructorProfile.photo_label')}
                                    </button>
                                    <p className="text-xs text-gray-400 mt-2">{t('instructorProfile.photo_hint')}</p>
                                </div>
                            </div>
                        </section>

                        <section className={cardCls}>
                            <h2 className="text-lg font-black text-white mb-6">{t('instructorProfile.cv_heading')}</h2>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className={labelCls}>{t('profile.name_ar')}</label>
                                    <input value={form.nameAr} onChange={set('nameAr')} className={inputCls} />
                                </div>
                                <div>
                                    <label className={labelCls}>{t('profile.name_en')}</label>
                                    <input value={form.nameEn} onChange={set('nameEn')} className={inputCls} dir="ltr" />
                                </div>
                                <div>
                                    <label className={labelCls}>{t('instructorProfile.job_title_label')}</label>
                                    <input value={form.jobTitleAr} onChange={set('jobTitleAr')} placeholder={t('instructorProfile.job_title_ar_ph')} className={inputCls} />
                                </div>
                                <div>
                                    <label className={labelCls}>{t('instructorProfile.job_title_label')} (EN)</label>
                                    <input value={form.jobTitleEn} onChange={set('jobTitleEn')} placeholder={t('instructorProfile.job_title_en_ph')} className={inputCls} dir="ltr" />
                                </div>
                                <div>
                                    <label className={labelCls}>{t('instructorProfile.specialty_label')}</label>
                                    <input value={form.specialty} onChange={set('specialty')} placeholder={t('instructorProfile.specialty_ph')} className={inputCls} />
                                </div>
                                <div>
                                    <label className={labelCls}>{t('instructorProfile.experience_years_label')}</label>
                                    <input
                                        value={form.experienceYears}
                                        onChange={set('experienceYears')}
                                        inputMode="numeric"
                                        placeholder={t('instructorProfile.years_hint')}
                                        className={inputCls}
                                        dir="ltr"
                                    />
                                </div>
                            </div>

                            <div className="mt-4 space-y-4">
                                <div>
                                    <label className={labelCls}>{t('instructorProfile.bio_ar_label')}</label>
                                    <textarea
                                        value={form.bio}
                                        onChange={set('bio')}
                                        rows={4}
                                        maxLength={500}
                                        placeholder={t('instructorProfile.bio_ar_ph')}
                                        className={`${inputCls} resize-y`}
                                    />
                                </div>
                                <div>
                                    <label className={labelCls}>{t('instructorProfile.bio_en_label')}</label>
                                    <textarea
                                        value={form.bioEn}
                                        onChange={set('bioEn')}
                                        rows={3}
                                        maxLength={500}
                                        dir="ltr"
                                        placeholder={t('instructorProfile.bio_en_ph')}
                                        className={`${inputCls} resize-y`}
                                    />
                                </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-3 mt-6 pt-6 border-t border-white/5">
                                <button
                                    onClick={save}
                                    disabled={saving || loading}
                                    className="inline-flex items-center gap-2 bg-gradient-to-r from-brand-gold to-brand-gold-dark text-black font-bold px-6 py-3 rounded-xl hover:opacity-95 transition-all disabled:opacity-50"
                                >
                                    {saving ? <Loader size={16} className="animate-spin" /> : <Save size={16} />}
                                    {saving ? t('common.saving') : t('common.save')}
                                </button>
                                <p className="text-xs text-gray-400">{t('instructorProfile.cv_hint')}</p>
                            </div>
                        </section>
                    </div>

                    {/* ============ PREVIEW + CHECKLIST ============ */}
                    <div className="space-y-6">
                        <section className={cardCls}>
                            <h3 className="text-base font-black text-white flex items-center gap-2 mb-1">
                                <Eye size={16} className="text-brand-gold-light" />
                                {t('instructorProfile.preview_heading')}
                            </h3>
                            <p className="text-xs text-gray-400 mb-5">{t('instructorProfile.preview_hint')}</p>

                            <div className="bg-brand-navy border border-white/5 rounded-2xl p-5">
                                <div className="flex items-start gap-4">
                                    {avatar ? (
                                        <img
                                            src={`${API_BASE_URL}${avatar}`}
                                            alt=""
                                            className="w-14 h-14 rounded-xl object-cover shrink-0 border border-brand-gold/30"
                                        />
                                    ) : (
                                        <div className="w-14 h-14 rounded-xl bg-brand-navy-dark border border-dashed border-white/15 shrink-0" />
                                    )}
                                    <div className="min-w-0">
                                        <p className="font-black text-white truncate">
                                            {displayName || <span className="text-gray-500">{t('instructorProfile.preview_name_placeholder')}</span>}
                                        </p>
                                        <p className="text-xs text-brand-gold-light font-bold truncate mt-0.5">
                                            {displayTitle || <span className="text-gray-500">{t('instructorProfile.preview_title_placeholder')}</span>}
                                        </p>
                                    </div>
                                </div>

                                {(form.specialty || form.experienceYears) && (
                                    <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-white/5">
                                        {form.specialty && (
                                            <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-brand-gold/10 text-brand-gold-light border border-brand-gold/20">
                                                {form.specialty}
                                            </span>
                                        )}
                                        {form.experienceYears && (
                                            <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-white/5 text-gray-300 border border-white/10">
                                                {form.experienceYears} {t('instructorProfile.years_suffix')}
                                            </span>
                                        )}
                                    </div>
                                )}

                                {form.bio && (
                                    <p className="text-xs text-gray-300 leading-relaxed mt-4 whitespace-pre-wrap line-clamp-6">{form.bio}</p>
                                )}

                                {!displayName && !form.bio && (
                                    <p className="text-xs text-gray-500 mt-4 flex items-start gap-2">
                                        <X size={13} className="mt-0.5 shrink-0" />
                                        {t('instructorProfile.preview_empty')}
                                    </p>
                                )}
                            </div>
                        </section>

                        <section className={cardCls}>
                            <h3 className="text-base font-black text-white mb-1">{t('instructorProfile.completion_heading')}</h3>
                            <div className="flex items-center gap-3 mt-4 mb-5">
                                <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-gradient-to-r from-brand-gold to-brand-gold-light rounded-full transition-all duration-500"
                                        style={{ width: `${(doneCount / steps.length) * 100}%` }}
                                    />
                                </div>
                                <span className="text-xs font-black text-brand-gold-light shrink-0">
                                    {doneCount}/{steps.length}
                                </span>
                            </div>

                            <ul className="space-y-2.5">
                                {steps.map((s) => (
                                    <li key={s.label} className="flex items-center gap-2.5">
                                        {s.done
                                            ? <Check size={15} className="text-emerald-400 shrink-0" />
                                            : <Sparkles size={15} className="text-brand-gold-light shrink-0" />}
                                        <span className={`text-sm ${s.done ? 'text-gray-400 line-through' : 'text-white font-bold'}`}>
                                            {s.label}
                                        </span>
                                        <span className={`ms-auto text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                            s.done
                                                ? 'bg-emerald-500/10 text-emerald-400'
                                                : 'bg-brand-gold/10 text-brand-gold-light'
                                        }`}>
                                            {s.done ? t('instructorProfile.step_done') : t('instructorProfile.step_missing')}
                                        </span>
                                    </li>
                                ))}
                            </ul>

                            <p className="text-xs text-gray-400 mt-5 pt-5 border-t border-white/5">
                                {t('instructorProfile.readonly_note')}
                            </p>
                        </section>
                    </div>
                </div>
            </div>
        </ProtectedRoute>
    );
}