"use client";

import { useEffect, useState } from 'react';
import { api, getErrorMessage } from '@/lib/api';
import { useI18n } from '@/lib/i18n-context';
import toast from 'react-hot-toast';
import { Loader, LifeBuoy, Mail, MessageSquare, Phone } from 'lucide-react';
import { EmptyState, PageHeader } from '../components';

type ContactMethod = 'EMAIL' | 'PHONE';
type SubmissionStatus = 'OPEN' | 'IN_PROGRESS' | 'CLOSED';

interface ContactSubmission {
    id: string;
    name: string | null;
    email: string | null;
    phone: string | null;
    contactMethod: ContactMethod;
    subject: string;
    message: string;
    status: SubmissionStatus;
    createdAt: string;
}

export default function ContactRequestsPage() {
    const { t, locale } = useI18n();
    const isAr = locale === 'ar';
    const [submissions, setSubmissions] = useState<ContactSubmission[]>([]);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState<string | null>(null);

    useEffect(() => {
        let active = true;
        api.get('/api/admin/contact-submissions')
            .then((response) => {
                if (active) setSubmissions(response.data);
            })
            .catch((error: unknown) => {
                if (active) toast.error(getErrorMessage(error) || t('common.error'));
            })
            .finally(() => {
                if (active) setLoading(false);
            });
        return () => { active = false; };
    }, [t]);

    const changeStatus = async (id: string, status: SubmissionStatus) => {
        setProcessing(id);
        try {
            const response = await api.patch(`/api/admin/contact-submissions/${id}`, { status });
            setSubmissions((current) => current.map((item) => item.id === id ? { ...item, status: response.data.status } : item));
            toast.success(isAr ? 'تم تحديث حالة الطلب' : 'Request status updated');
        } catch (error) {
            toast.error(getErrorMessage(error) || (isAr ? 'تعذر تحديث حالة الطلب' : 'Could not update request status'));
        } finally {
            setProcessing(null);
        }
    };

    return (
        <div className="space-y-6 animate-fade-in">
            <PageHeader
                title={t('admin.nav_contact_requests')}
                subtitle={isAr ? 'الرسائل المرسلة من صفحة تواصل معنا، بما فيها رسائل الزوار غير المسجلين.' : 'Messages sent through the Contact page, including from visitors who are not signed in.'}
            />

            {loading ? (
                <div className="h-40 flex items-center justify-center text-brand-gold-dark dark:text-brand-gold">
                    <Loader className="animate-spin" size={32} />
                </div>
            ) : submissions.length === 0 ? (
                <EmptyState icon={LifeBuoy} title={isAr ? 'لا توجد رسائل تواصل حتى الآن' : 'No contact messages yet'} />
            ) : (
                <div className="space-y-4">
                    {submissions.map((submission) => {
                        const contact = submission.contactMethod === 'EMAIL' ? submission.email : submission.phone;
                        const contactHref = submission.contactMethod === 'EMAIL'
                            ? `mailto:${submission.email}`
                            : `tel:${submission.phone}`;
                        return (
                            <article key={submission.id} className="rounded-2xl border border-gray-200 dark:border-white/5 bg-white dark:bg-brand-navy-dark p-5 sm:p-6 space-y-4">
                                <div className="flex flex-wrap items-start justify-between gap-4">
                                    <div className="min-w-0">
                                        <h3 className="font-black text-brand-navy dark:text-white break-words">
                                            {submission.subject || (isAr ? 'بدون موضوع' : 'No subject')}
                                        </h3>
                                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                            {submission.name || (isAr ? 'زائر' : 'Visitor')} · {new Date(submission.createdAt).toLocaleString(isAr ? 'ar' : 'en')}
                                        </p>
                                    </div>
                                    <select
                                        aria-label={isAr ? 'حالة الطلب' : 'Request status'}
                                        value={submission.status}
                                        onChange={(event) => {
                                            const status = event.target.value;
                                            if (status === 'OPEN' || status === 'IN_PROGRESS' || status === 'CLOSED') {
                                                void changeStatus(submission.id, status);
                                            }
                                        }}
                                        disabled={processing === submission.id}
                                        className="px-3 py-2 border border-gray-300 dark:border-white/10 rounded-lg text-sm font-bold bg-white dark:bg-brand-navy-dark text-brand-navy dark:text-white disabled:opacity-50"
                                    >
                                        <option value="OPEN">{t('support.status_open')}</option>
                                        <option value="IN_PROGRESS">{t('support.status_in_progress')}</option>
                                        <option value="CLOSED">{t('support.status_closed')}</option>
                                    </select>
                                </div>

                                <a
                                    href={contactHref}
                                    dir="ltr"
                                    className="inline-flex items-center gap-2 text-sm font-bold text-brand-navy-light dark:text-brand-gold-light hover:underline"
                                >
                                    {submission.contactMethod === 'EMAIL' ? <Mail size={16} /> : <Phone size={16} />}
                                    {contact}
                                </a>

                                <div className="flex items-start gap-3 rounded-xl bg-gray-50 dark:bg-white/5 p-4">
                                    <MessageSquare size={17} className="mt-0.5 shrink-0 text-brand-gold-dark dark:text-brand-gold-light" />
                                    <p className="text-sm text-gray-700 dark:text-gray-200 whitespace-pre-wrap break-words">{submission.message}</p>
                                </div>
                            </article>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
