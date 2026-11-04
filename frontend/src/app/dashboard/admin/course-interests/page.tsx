"use client";

import { useEffect, useState } from 'react';
import { BellRing, Loader, Mail, Phone, RefreshCw, UserRoundCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import { api, getErrorMessage } from '@/lib/api';
import { useI18n } from '@/lib/i18n-context';
import { EmptyState, PageHeader } from '../components';

type InterestStatus = 'PENDING' | 'CONTACTED';
type ContactMethod = 'EMAIL' | 'PHONE';

interface CourseInterest {
    id: string;
    contactMethod: ContactMethod;
    contactValue: string;
    status: InterestStatus;
    createdAt: string;
    course: { id: string; titleAr: string; titleEn: string };
}

export default function CourseInterestsPage() {
    const { locale, pick } = useI18n();
    const isAr = locale === 'ar';
    const [interests, setInterests] = useState<CourseInterest[]>([]);
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState<string | null>(null);

    const loadInterests = async () => {
        setLoading(true);
        try {
            const response = await api.get('/admin/course-interests');
            setInterests(response.data as CourseInterest[]);
        } catch (error) {
            toast.error(getErrorMessage(error) || (isAr ? 'تعذر تحميل قائمة المهتمين.' : 'Could not load course interests.'));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        let active = true;
        api.get('/admin/course-interests')
            .then((response) => {
                if (active) setInterests(response.data as CourseInterest[]);
            })
            .catch((error) => {
                if (active) toast.error(getErrorMessage(error) || (isAr ? 'تعذر تحميل قائمة المهتمين.' : 'Could not load course interests.'));
            })
            .finally(() => {
                if (active) setLoading(false);
            });
        return () => { active = false; };
    }, [isAr]);

    const markContacted = async (id: string) => {
        setProcessingId(id);
        try {
            await api.patch(`/admin/course-interests/${id}/contacted`);
            setInterests((rows) => rows.map((row) => row.id === id ? { ...row, status: 'CONTACTED' } : row));
            toast.success(isAr ? 'تم تسجيل التواصل مع المهتم.' : 'Interest marked as contacted.');
        } catch (error) {
            toast.error(getErrorMessage(error) || (isAr ? 'تعذر تحديث حالة المهتم.' : 'Could not update interest status.'));
        } finally {
            setProcessingId(null);
        }
    };

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <PageHeader
                    title={isAr ? 'المهتمون بالدورات' : 'Course interests'}
                    subtitle={isAr
                        ? 'قائمة الزوار الذين طلبوا التواصل معهم عند إتاحة دورة مغلقة. استخدم البريد أو الهاتف للتواصل ثم حدّث الحالة.'
                        : 'Visitors who asked to be contacted when a closed course becomes available. Contact them by email or phone, then update the status.'}
                />
                <button type="button" onClick={() => void loadInterests()} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-bold text-brand-navy disabled:opacity-50 dark:border-white/10 dark:bg-brand-navy-dark dark:text-white">
                    <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> {isAr ? 'تحديث' : 'Refresh'}
                </button>
            </div>

            {loading ? (
                <div className="flex h-40 items-center justify-center text-brand-gold-dark dark:text-brand-gold"><Loader className="animate-spin" size={32} /></div>
            ) : interests.length === 0 ? (
                <EmptyState icon={BellRing} title={isAr ? 'لا يوجد مهتمون بالدورات حالياً' : 'No course interests yet'} />
            ) : (
                <div className="space-y-4">
                    {interests.map((interest) => {
                        const contactHref = interest.contactMethod === 'EMAIL'
                            ? `mailto:${interest.contactValue}`
                            : `tel:${interest.contactValue}`;
                        const ContactIcon = interest.contactMethod === 'EMAIL' ? Mail : Phone;
                        return (
                            <article key={interest.id} className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5 dark:border-white/5 dark:bg-brand-navy-dark">
                                <div className="flex flex-wrap items-start justify-between gap-4">
                                    <div className="min-w-0">
                                        <h2 className="break-words font-black text-brand-navy dark:text-white">{pick(interest.course, 'title')}</h2>
                                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                            {isAr ? 'تاريخ الطلب:' : 'Requested:'} {new Date(interest.createdAt).toLocaleString(isAr ? 'ar' : 'en')}
                                        </p>
                                    </div>
                                    <span className={`rounded-full px-3 py-1 text-xs font-black ${interest.status === 'PENDING' ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300' : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'}`}>
                                        {interest.status === 'PENDING' ? (isAr ? 'بانتظار التواصل' : 'Pending contact') : (isAr ? 'تم التواصل' : 'Contacted')}
                                    </span>
                                </div>
                                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-4 dark:border-white/5">
                                    <a href={contactHref} className="inline-flex min-w-0 items-center gap-2 break-all text-sm font-bold text-brand-navy hover:text-brand-gold-dark dark:text-gray-200 dark:hover:text-brand-gold-light" dir={interest.contactMethod === 'PHONE' ? 'ltr' : undefined}>
                                        <ContactIcon size={16} className="shrink-0" /> {interest.contactValue}
                                    </a>
                                    {interest.status === 'PENDING' && (
                                        <button type="button" onClick={() => void markContacted(interest.id)} disabled={processingId === interest.id} className="inline-flex items-center gap-2 rounded-xl bg-brand-navy px-4 py-2.5 text-sm font-black text-white disabled:opacity-50 dark:bg-brand-gold dark:text-brand-navy-dark">
                                            {processingId === interest.id ? <Loader size={16} className="animate-spin" /> : <UserRoundCheck size={16} />}
                                            {isAr ? 'تم التواصل' : 'Mark contacted'}
                                        </button>
                                    )}
                                </div>
                            </article>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
