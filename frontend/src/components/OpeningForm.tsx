"use client";

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, getErrorMessage } from '@/lib/api';
import { useFetchData } from '@/lib/useFetchData';
import { useI18n } from '@/lib/i18n-context';
import toast from 'react-hot-toast';
import { Loader } from 'lucide-react';
import { PageHeader } from '@/app/dashboard/admin/components';

interface Course { id: string; titleAr?: string | null; titleEn?: string | null; }
interface Instructor { id: string; email: string; role: string; }

interface FormValues {
    nameAr: string;
    nameEn: string;
    instructorId: string;
    startDate: string;
    endDate: string;
    enrollmentDeadline: string;
    price: string;
    priceOld: string;
    maxStudents: string;
}

const dateVal = (v?: string | null) => (v ? String(v).slice(0, 10) : '');

export default function OpeningForm({ courseId, openingId }: { courseId: string; openingId?: string }) {
    const { t, pick } = useI18n();
    const router = useRouter();
    const { data: course, loading: courseLoading } = useFetchData<Course>(`/courses/${courseId}`);
    const { data: instructors } = useFetchData<Instructor[]>('/users');
    const [loadingInit, setLoadingInit] = useState(!!openingId);

    const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormValues>({
        defaultValues: {
            nameAr: '', nameEn: '', instructorId: '', startDate: '', endDate: '',
            enrollmentDeadline: '', price: '', priceOld: '', maxStudents: '',
        },
    });

    useEffect(() => {
        if (!openingId) return;
        let active = true;
        const load = async () => {
            try {
                const res = await api.get(`/courses/${courseId}/openings?includeUnpublished=true`);
                const rows = (res.data || []) as Array<Record<string, unknown>>;
                const opening = rows.find((o) => (o as { id: string }).id === openingId);
                if (!active) return;
                if (opening) {
                    const o = opening as Record<string, string | null>;
                    reset({
                        nameAr: (o.nameAr as string) || '',
                        nameEn: (o.nameEn as string) || '',
                        instructorId: (o.instructorId as string) || '',
                        startDate: dateVal(o.startDate as string),
                        endDate: dateVal(o.endDate as string),
                        enrollmentDeadline: dateVal(o.enrollmentDeadline as string),
                        price: o.price ? Number(o.price).toString() : '',
                        priceOld: o.priceOld ? Number(o.priceOld).toString() : '',
                        maxStudents: o.maxStudents ? Number(o.maxStudents).toString() : '',
                    });
                }
            } catch {
                toast.error(t('opening.failed_load'));
            } finally {
                if (active) setLoadingInit(false);
            }
        };
        load();
        return () => { active = false; };
    }, [openingId, courseId, t, reset]);

    const onSubmit = async (data: FormValues) => {
        try {
            const num = (v: string) => (v !== '' ? Number(v) : null);
            const payload: Record<string, unknown> = {
                nameAr: data.nameAr || null,
                nameEn: data.nameEn || null,
                instructorId: data.instructorId,
                startDate: data.startDate || null,
                endDate: data.endDate || null,
                enrollmentDeadline: data.enrollmentDeadline || null,
                price: Number(data.price),
                priceOld: num(data.priceOld),
                maxStudents: num(data.maxStudents),
            };

            let resultId: string;
            if (openingId) {
                await api.patch(`/openings/${openingId}`, payload);
                resultId = openingId;
            } else {
                const res = await api.post(`/courses/${courseId}/openings`, payload);
                resultId = (res.data as { id: string }).id;
            }
            toast.success(openingId ? t('opening.updated') : t('opening.created'));
            router.push(openingId ? '/dashboard/admin/courses' : `/dashboard/courses/open/${courseId}?edit=${resultId}`);
        } catch (err) {
            toast.error(getErrorMessage(err) || t('common.submit_failed'));
        }
    };

    const instructorOptions = (instructors || []).filter((u) => u.role === 'INSTRUCTOR' || u.role === 'ADMIN' || u.role === 'COURSE_MANAGER');
    const inputCls = "w-full px-4 py-3 bg-brand-mist/20 border border-brand-mist rounded-xl focus:ring-2 focus:ring-brand-gold focus:border-brand-gold outline-none transition placeholder:text-gray-400";

    if (loadingInit) {
        return <div className="min-h-screen flex items-center justify-center text-brand-navy"><Loader className="animate-spin" size={48} /></div>;
    }

    return (
        <div className="max-w-3xl mx-auto bg-white p-6 lg:p-8 rounded-3xl shadow-sm border border-brand-mist">
            <Link href="/dashboard/admin/courses" className="inline-flex items-center gap-1.5 text-sm font-bold text-brand-navy hover:text-brand-gold transition mb-4">
                <span className="rtl:rotate-180">&larr;</span> {t('opening.back')}
            </Link>
            <div className="mb-8">
                <PageHeader
                    title={openingId ? t('opening.edit_heading') : t('opening.heading')}
                    subtitle={`${t('opening.for_course')} ${courseLoading ? '...' : pick(course, 'title')}`}
                />
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                    <section className="border-t border-brand-mist pt-8 mt-8 first:border-t-0 first:mt-0 first:pt-0">
                        <h3 className="text-xl font-black text-brand-charcoal mb-1">{t('opening.section_schedule')}</h3>
                        <p className="text-sm text-gray-500 mb-4">{t('opening.schedule_hint')}</p>
                        <div className="grid md:grid-cols-3 gap-3">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">{t('opening.start_date')}</label>
                                <input type="date" {...register('startDate')} className={inputCls} />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">{t('opening.end_date')}</label>
                                <input type="date" {...register('endDate')} className={inputCls} />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">{t('opening.deadline')}</label>
                                <input type="date" {...register('enrollmentDeadline')} className={inputCls} />
                            </div>
                        </div>
                    </section>

                    <section className="border-t border-brand-mist pt-8 mt-8">
                        <h3 className="text-xl font-black text-brand-charcoal mb-1">{t('opening.section_fees')}</h3>
                        <p className="text-sm text-gray-500 mb-4">{t('opening.fees_hint')}</p>
                        <div className="grid md:grid-cols-3 gap-3">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">{t('opening.price')} *</label>
                                <input type="number" step="0.01" min={0} {...register('price', { required: t('opening.price_required') })} className={inputCls} placeholder={t('opening.price_placeholder')} />
                                {errors.price && <p className="text-red-500 text-xs mt-1">{errors.price.message}</p>}
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">{t('opening.price_old')}</label>
                                <input type="number" step="0.01" min={0} {...register('priceOld')} className={inputCls} placeholder={t('opening.price_old_placeholder')} />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">{t('opening.max_students')}</label>
                                <input type="number" min={1} {...register('maxStudents')} className={inputCls} placeholder={t('opening.max_students_placeholder')} />
                            </div>
                        </div>
                    </section>

                    <section className="border-t border-brand-mist pt-8 mt-8">
                        <h3 className="text-xl font-black text-brand-charcoal mb-1">{t('opening.section_instructor')}</h3>
                        <p className="text-sm text-gray-500 mb-4">{t('opening.instructor_hint')}</p>
                        <select {...register('instructorId', { required: t('opening.instructor_required') })} className={inputCls}>
                            <option value="">{t('opening.select_instructor')}</option>
                            {instructorOptions.map((i) => (
                                <option key={i.id} value={i.id}>
                                    {i.email} ({i.role})
                                </option>
                            ))}
                        </select>
                        {errors.instructorId && <p className="text-red-500 text-xs mt-1">{errors.instructorId.message}</p>}
                    </section>

                    <section className="border-t border-brand-mist pt-8 mt-8">
                        <h3 className="text-xl font-black text-brand-charcoal mb-1">{t('opening.section_label')}</h3>
                        <p className="text-sm text-gray-500 mb-4">{t('opening.label_hint')}</p>
                        <div className="grid md:grid-cols-2 gap-3">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">{t('opening.name_ar')}</label>
                                <input {...register('nameAr')} className={inputCls} placeholder={t('opening.name_ar_placeholder')} />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">{t('opening.name_en')}</label>
                                <input {...register('nameEn')} className={inputCls} placeholder="e.g. September batch" />
                            </div>
                        </div>
                    </section>

                    <div className="flex gap-4 pt-6">
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="flex-1 bg-gradient-to-r from-brand-navy to-brand-charcoal text-white font-bold py-3.5 rounded-xl hover:opacity-95 shadow-md shadow-brand-navy/25 transition disabled:opacity-50 cursor-pointer"
                        >
                            {isSubmitting ? t('common.submitting') : (openingId ? t('opening.save_changes') : t('opening.create_opening'))}
                        </button>
                        <Link href="/dashboard/admin/courses" className="flex-1">
                            <button type="button" className="w-full bg-brand-mist text-brand-navy font-bold py-3.5 rounded-xl hover:bg-brand-navy hover:text-white transition cursor-pointer">
                                {t('common.cancel')}
                            </button>
                        </Link>
                    </div>
                </form>
            </div>
        );
}