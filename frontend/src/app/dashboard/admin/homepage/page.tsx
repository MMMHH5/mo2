"use client";

import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Eye, EyeOff, Globe, PanelTop, Save, Send, RotateCcw, BarChart3 } from 'lucide-react';
import toast from 'react-hot-toast';
import { api, getErrorMessage } from '@/lib/api';
import { useI18n } from '@/lib/i18n-context';
import { DEFAULT_HOMEPAGE_CONFIG, HOMEPAGE_FIELD_GROUPS, mergeHomepageConfig, type HomepageConfig, type HomepageSectionId } from '@/lib/homepage-config';
import { PageHeader } from '../components';

const sectionLabels: Record<HomepageSectionId, { ar: string; en: string }> = {
    hero: { ar: 'الواجهة الرئيسية', en: 'Hero section' },
    features: { ar: 'مميزات المنصة', en: 'Platform features' },
    stats: { ar: 'الإحصائيات', en: 'Statistics' },
    courses: { ar: 'الدورات المميزة', en: 'Featured courses' },
    about: { ar: 'عن المنصة', en: 'About the platform' },
    contact: { ar: 'التواصل', en: 'Contact' },
    cta: { ar: 'الدعوة للتسجيل', en: 'Registration call to action' },
};

const statLabels: Record<string, { ar: string; en: string }> = {
    courses: { ar: 'عدد الدورات', en: 'Courses' },
    instructors: { ar: 'عدد المدرّسين', en: 'Instructors' },
    enrollments: { ar: 'عدد الطلاب المسجلين', en: 'Enrolled students' },
    certificates: { ar: 'عدد الشهادات الصادرة', en: 'Certificates issued' },
};

export default function HomepageManagementPage() {
    const { locale } = useI18n();
    const isAr = locale === 'ar';
    const [config, setConfig] = useState<HomepageConfig>(() => mergeHomepageConfig(DEFAULT_HOMEPAGE_CONFIG));
    const [published, setPublished] = useState<HomepageConfig | null>(null);
    const [hasDraft, setHasDraft] = useState(false);
    const [publishedAt, setPublishedAt] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [publishing, setPublishing] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        let active = true;
        api.get('/admin/homepage')
            .then((response) => {
                if (!active) return;
                const state = response.data as {
                    draft: unknown;
                    published: unknown;
                    publishedAt: string | null;
                };
                setConfig(mergeHomepageConfig(state.draft ?? state.published ?? DEFAULT_HOMEPAGE_CONFIG));
                setPublished(state.published ? mergeHomepageConfig(state.published) : null);
                setHasDraft(Boolean(state.draft));
                setPublishedAt(state.publishedAt);
            })
            .catch((cause) => {
                if (active) {
                    setError(getErrorMessage(cause) || (isAr ? 'تعذر تحميل إعدادات الصفحة.' : 'Could not load homepage settings.'));
                    console.error('Failed to load homepage settings', cause);
                }
            })
            .finally(() => {
                if (active) setLoading(false);
            });
        return () => { active = false; };
    }, [isAr]);

    const updateText = (key: string, language: 'ar' | 'en', value: string) => {
        setConfig((current) => ({
            ...current,
            content: {
                ...current.content,
                [key]: { ...current.content[key], [language]: value },
            },
        }));
    };

    const updateSection = (id: HomepageSectionId, visible: boolean) => {
        setConfig((current) => ({
            ...current,
            sections: current.sections.map((section) => section.id === id ? { ...section, visible } : section),
        }));
    };

    const moveSection = (index: number, direction: -1 | 1) => {
        setConfig((current) => {
            const target = index + direction;
            if (target < 0 || target >= current.sections.length) return current;
            const sections = [...current.sections];
            [sections[index], sections[target]] = [sections[target], sections[index]];
            return { ...current, sections };
        });
    };

    const updateStat = (id: string, field: 'mode' | 'value', value: string) => {
        setConfig((current) => ({
            ...current,
            stats: current.stats.map((stat) => stat.id !== id ? stat : {
                ...stat,
                [field]: field === 'value' ? Math.max(0, Math.min(1_000_000_000, Number(value) || 0)) : value,
            }),
        }));
    };

    const updateSocial = (id: string, field: 'label' | 'handle' | 'url', value: string) => {
        setConfig((current) => ({
            ...current,
            socials: current.socials.map((social) => social.id === id ? { ...social, [field]: value } : social),
        }));
    };

    const saveDraft = async (notify = true) => {
        setSaving(true);
        try {
            await api.put('/admin/homepage/draft', { config });
            setHasDraft(true);
            if (notify) toast.success(isAr ? 'تم حفظ المسودة. لم تظهر للزوار بعد.' : 'Draft saved. It is not public yet.');
            return true;
        } catch (cause) {
            toast.error(getErrorMessage(cause) || (isAr ? 'تعذر حفظ المسودة.' : 'Could not save the draft.'));
            return false;
        } finally {
            setSaving(false);
        }
    };

    const publish = async () => {
        setPublishing(true);
        try {
            await api.put('/admin/homepage/draft', { config });
            await api.post('/admin/homepage/publish');
            setHasDraft(true);
            setPublished(mergeHomepageConfig(config));
            setPublishedAt(new Date().toISOString());
            toast.success(isAr ? 'تم نشر الصفحة الرئيسية.' : 'Homepage published.');
        } catch (cause) {
            toast.error(getErrorMessage(cause) || (isAr ? 'تعذر نشر الصفحة.' : 'Could not publish the homepage.'));
        } finally {
            setPublishing(false);
        }
    };

    const restorePublished = async () => {
        if (!published) return;
        try {
            await api.post('/admin/homepage/restore');
            setConfig(mergeHomepageConfig(published));
            setHasDraft(true);
            toast.success(isAr ? 'تم استرجاع المسودة من آخر نسخة منشورة.' : 'Draft restored from the published version.');
        } catch (cause) {
            toast.error(getErrorMessage(cause) || (isAr ? 'تعذر استرجاع النسخة.' : 'Could not restore the published version.'));
        }
    };

    const preview = async () => {
        const previewWindow = window.open('about:blank', '_blank');
        if (!previewWindow) {
            toast.error(isAr ? 'اسمح بفتح النوافذ المنبثقة للمعاينة.' : 'Allow pop-ups to open the preview.');
            return;
        }
        const saved = await saveDraft(false);
        if (!saved) {
            previewWindow.close();
            return;
        }
        previewWindow.location.href = '/?homepagePreview=1';
    };

    const inputClass = 'w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-brand-navy outline-none transition focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20 dark:border-white/10 dark:bg-brand-navy-dark dark:text-white';
    const cardClass = 'rounded-2xl border border-gray-200 bg-white p-5 dark:border-white/5 dark:bg-brand-navy-dark';

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
                <PageHeader
                    title={isAr ? 'إدارة الصفحة الرئيسية' : 'Homepage management'}
                    subtitle={isAr
                        ? 'حرّر النصوص بالعربية والإنجليزية، رتّب الأقسام، وتحكّم بالإحصائيات قبل نشرها.'
                        : 'Edit Arabic and English copy, reorder sections, and control statistics before publishing.'}
                />
                <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => void preview()} disabled={loading || saving}
                        className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-bold text-brand-navy hover:bg-gray-50 disabled:opacity-50 dark:border-white/10 dark:text-white dark:hover:bg-white/5">
                        <Eye size={16} /> {isAr ? 'معاينة المسودة' : 'Preview draft'}
                    </button>
                    <button type="button" onClick={() => void saveDraft()} disabled={loading || saving || publishing}
                        className="inline-flex items-center gap-2 rounded-xl border border-brand-navy px-4 py-2.5 text-sm font-black text-brand-navy hover:bg-brand-navy/5 disabled:opacity-50 dark:border-brand-gold dark:text-brand-gold-light">
                        <Save size={16} /> {saving ? (isAr ? 'جارٍ الحفظ...' : 'Saving...') : (isAr ? 'حفظ مسودة' : 'Save draft')}
                    </button>
                    <button type="button" onClick={() => void publish()} disabled={loading || saving || publishing}
                        className="inline-flex items-center gap-2 rounded-xl bg-brand-gold px-4 py-2.5 text-sm font-black text-brand-navy-dark hover:bg-brand-gold-light disabled:opacity-50">
                        <Send size={16} /> {publishing ? (isAr ? 'جارٍ النشر...' : 'Publishing...') : (isAr ? 'نشر التغييرات' : 'Publish changes')}
                    </button>
                </div>
            </div>

            <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm leading-relaxed text-blue-900 dark:border-blue-500/20 dark:bg-blue-500/5 dark:text-blue-100">
                {isAr
                    ? 'التعديلات محفوظة كمسودة ولا يراها الزوار حتى تضغط «نشر التغييرات». الأرقام الحقيقية لا تتغير؛ اختيار «يدوي» يغيّر الرقم المعروض على الصفحة فقط.'
                    : 'Changes remain a draft until you publish. Real platform counts are never modified; manual mode changes only the number displayed on the homepage.'}
                {publishedAt && <span className="ms-2 font-bold">{isAr ? 'آخر نشر:' : 'Last published:'} {new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(publishedAt))}</span>}
            </div>

            {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">{error}</div>}
            {loading ? (
                <div className={`${cardClass} py-12 text-center font-bold text-gray-400`}>{isAr ? 'جارٍ تحميل الإعدادات...' : 'Loading settings...'}</div>
            ) : (
                <>
                    <section className={cardClass}>
                        <div className="mb-4 flex items-center gap-2">
                            <PanelTop size={20} className="text-brand-gold-dark dark:text-brand-gold-light" />
                            <h2 className="text-lg font-black text-brand-navy dark:text-white">{isAr ? 'ترتيب وإظهار الأقسام' : 'Section visibility and order'}</h2>
                        </div>
                        <div className="space-y-2">
                            {config.sections.map((section, index) => (
                                <div key={section.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-100 p-3 dark:border-white/5">
                                    <div className="flex items-center gap-3">
                                        <span className="grid h-8 w-8 place-items-center rounded-lg bg-gray-100 text-sm font-black dark:bg-white/5">{index + 1}</span>
                                        <span className="font-bold text-brand-navy dark:text-white">{sectionLabels[section.id][isAr ? 'ar' : 'en']}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button type="button" onClick={() => moveSection(index, -1)} disabled={index === 0} title={isAr ? 'تحريك لأعلى' : 'Move up'} className="rounded-lg border border-gray-200 p-2 disabled:opacity-30 dark:border-white/10"><ArrowUp size={16} /></button>
                                        <button type="button" onClick={() => moveSection(index, 1)} disabled={index === config.sections.length - 1} title={isAr ? 'تحريك لأسفل' : 'Move down'} className="rounded-lg border border-gray-200 p-2 disabled:opacity-30 dark:border-white/10"><ArrowDown size={16} /></button>
                                        <button type="button" onClick={() => updateSection(section.id, !section.visible)} className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-black ${section.visible ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'bg-gray-100 text-gray-500 dark:bg-white/5'}`}>
                                            {section.visible ? <Eye size={15} /> : <EyeOff size={15} />}
                                            {section.visible ? (isAr ? 'ظاهر' : 'Visible') : (isAr ? 'مخفي' : 'Hidden')}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>

                    {HOMEPAGE_FIELD_GROUPS.map((group) => (
                        <section key={group.id} className={cardClass}>
                            <div className="mb-5 flex items-center gap-2">
                                <Globe size={19} className="text-brand-gold-dark dark:text-brand-gold-light" />
                                <h2 className="text-lg font-black text-brand-navy dark:text-white">{isAr ? group.titleAr : group.titleEn}</h2>
                            </div>
                            <div className="grid gap-4 lg:grid-cols-2">
                                {group.keys.map((key) => (
                                    <div key={key} className={key.endsWith('_desc') || key.includes('paragraph') ? 'lg:col-span-2' : ''}>
                                        <label className="mb-1.5 block text-sm font-bold text-gray-600 dark:text-gray-300">{isAr ? DEFAULT_HOMEPAGE_CONFIG.content[key]?.ar || key : DEFAULT_HOMEPAGE_CONFIG.content[key]?.en || key}</label>
                                        <div className="grid gap-2 md:grid-cols-2">
                                            {(['ar', 'en'] as const).map((language) => (
                                                <div key={language}>
                                                    <span className="mb-1 block text-[11px] font-black uppercase text-gray-400">{language === 'ar' ? 'العربية' : 'English'}</span>
                                                    {key.endsWith('_desc') || key.includes('paragraph') ? (
                                                        <textarea rows={3} maxLength={2000} value={config.content[key]?.[language] ?? ''} onChange={(event) => updateText(key, language, event.target.value)} className={inputClass} dir={language === 'ar' ? 'rtl' : 'ltr'} />
                                                    ) : (
                                                        <input maxLength={2000} value={config.content[key]?.[language] ?? ''} onChange={(event) => updateText(key, language, event.target.value)} className={inputClass} dir={language === 'ar' ? 'rtl' : 'ltr'} />
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>
                    ))}

                    <section className={cardClass}>
                        <div className="mb-2 flex items-center gap-2">
                            <BarChart3 size={20} className="text-brand-gold-dark dark:text-brand-gold-light" />
                            <h2 className="text-lg font-black text-brand-navy dark:text-white">{isAr ? 'طريقة عرض كل إحصائية' : 'How each statistic is displayed'}</h2>
                        </div>
                        <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">{isAr ? 'تلقائي: من بيانات المنصة. يدوي: رقم تسويقي للعرض فقط. مخفي: لا يظهر هذا المؤشر.' : 'Automatic: live platform data. Manual: display-only marketing number. Hidden: omit this statistic.'}</p>
                        <div className="grid gap-3 md:grid-cols-2">
                            {config.stats.map((stat) => (
                                <div key={stat.id} className="grid gap-3 rounded-xl border border-gray-100 p-4 md:grid-cols-[1fr_1fr_140px] md:items-end dark:border-white/5">
                                    <label className="text-sm font-black text-brand-navy dark:text-white">{statLabels[stat.id][isAr ? 'ar' : 'en']}</label>
                                    <select value={stat.mode} onChange={(event) => updateStat(stat.id, 'mode', event.target.value)} className={inputClass}>
                                        <option value="AUTO">{isAr ? 'تلقائي من البيانات' : 'Automatic'}</option>
                                        <option value="MANUAL">{isAr ? 'رقم يدوي للعرض' : 'Manual display value'}</option>
                                        <option value="HIDDEN">{isAr ? 'إخفاء' : 'Hidden'}</option>
                                    </select>
                                    <input type="number" min={0} max={1_000_000_000} step={1} value={stat.value} disabled={stat.mode !== 'MANUAL'} onChange={(event) => updateStat(stat.id, 'value', event.target.value)} className={`${inputClass} disabled:opacity-40`} aria-label={isAr ? 'الرقم اليدوي' : 'Manual value'} />
                                </div>
                            ))}
                        </div>
                    </section>

                    <section className={cardClass}>
                        <div className="mb-2 flex items-center gap-2">
                            <Globe size={19} className="text-brand-gold-dark dark:text-brand-gold-light" />
                            <h2 className="text-lg font-black text-brand-navy dark:text-white">{isAr ? 'روابط منصات التواصل' : 'Social links'}</h2>
                        </div>
                        <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">{isAr ? 'تُقبل روابط HTTPS فقط حفاظًا على سلامة الروابط.' : 'Only HTTPS links are accepted for safety.'}</p>
                        <div className="grid gap-4 lg:grid-cols-2">
                            {config.socials.map((social) => (
                                <div key={social.id} className="space-y-2 rounded-xl border border-gray-100 p-4 dark:border-white/5">
                                    <h3 className="font-black capitalize text-brand-navy dark:text-white">{social.id}</h3>
                                    <input value={social.label} onChange={(event) => updateSocial(social.id, 'label', event.target.value)} maxLength={80} placeholder={isAr ? 'اسم المنصة' : 'Platform name'} className={inputClass} />
                                    <input value={social.handle} onChange={(event) => updateSocial(social.id, 'handle', event.target.value)} maxLength={120} placeholder={isAr ? 'اسم الحساب' : 'Account handle'} className={inputClass} dir="ltr" />
                                    <input value={social.url} onChange={(event) => updateSocial(social.id, 'url', event.target.value)} maxLength={500} placeholder="https://" className={inputClass} dir="ltr" />
                                </div>
                            ))}
                        </div>
                    </section>

                    <div className="flex flex-wrap justify-end gap-3">
                        {published && <button type="button" onClick={() => void restorePublished()} className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-bold dark:border-white/10"><RotateCcw size={16} />{isAr ? 'استرجاع المنشور' : 'Restore published'}</button>}
                        <button type="button" onClick={() => void preview()} disabled={saving} className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-bold dark:border-white/10"><Eye size={16} />{isAr ? 'معاينة' : 'Preview'}</button>
                        <button type="button" onClick={() => void saveDraft()} disabled={saving} className="inline-flex items-center gap-2 rounded-xl border border-brand-navy px-4 py-2.5 text-sm font-black text-brand-navy dark:border-brand-gold dark:text-brand-gold-light"><Save size={16} />{isAr ? 'حفظ مسودة' : 'Save draft'}</button>
                        <button type="button" onClick={() => void publish()} disabled={publishing} className="inline-flex items-center gap-2 rounded-xl bg-brand-gold px-4 py-2.5 text-sm font-black text-brand-navy-dark"><Send size={16} />{isAr ? 'نشر التغييرات' : 'Publish changes'}</button>
                    </div>
                    {!hasDraft && <p className="text-end text-xs text-gray-400">{isAr ? 'لم تُحفظ مسودة بعد؛ الصفحة العامة تستخدم النصوص الافتراضية.' : 'No draft has been saved yet; the public page uses its default content.'}</p>}
                </>
            )}
        </div>
    );
}
