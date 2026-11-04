"use client";

import { useState } from 'react';
import { CheckCircle, Loader, Star } from 'lucide-react';
import { api, getErrorMessage } from '@/lib/api';
import { useI18n } from '@/lib/i18n-context';
import toast from 'react-hot-toast';

export interface MyCourseEvaluation {
    submitted: boolean;
    submittedAt: string | null;
    canSubmit: boolean;
    totalLessons: number;
    completedLessons: number;
    pendingTasks: number;
    failedQuizzes: number;
}

export default function CourseEvaluationForm({
    courseId,
    onSubmitted,
}: {
    courseId: string;
    onSubmitted: (evaluation: MyCourseEvaluation) => void;
}) {
    const { locale } = useI18n();
    const isAr = locale === 'ar';
    const [courseRating, setCourseRating] = useState(0);
    const [instructorRating, setInstructorRating] = useState(0);
    const [comment, setComment] = useState('');
    const [saving, setSaving] = useState(false);

    const submit = async () => {
        if (!courseRating || !instructorRating || saving) return;
        setSaving(true);
        try {
            const response = await api.post(`/course-evaluations/my/${courseId}`, {
                courseRating,
                instructorRating,
                ...(isAr ? { commentAr: comment } : { commentEn: comment }),
            });
            onSubmitted({
                submitted: true,
                submittedAt: response.data.submittedAt,
                canSubmit: true,
                totalLessons: 0,
                completedLessons: 0,
                pendingTasks: 0,
                failedQuizzes: 0,
            });
            toast.success(isAr ? 'شكراً لك، تم استلام تقييمك' : 'Thank you. Your evaluation was submitted.');
        } catch (error) {
            toast.error(getErrorMessage(error) || (isAr ? 'تعذر إرسال التقييم. حاول مرة أخرى.' : 'Could not submit the evaluation. Please try again.'));
        } finally {
            setSaving(false);
        }
    };

    const ratingField = (label: string, value: number, setValue: (rating: number) => void) => (
        <fieldset>
            <legend className="mb-2 text-sm font-black text-ink">{label}</legend>
            <div className="flex items-center gap-1" role="radiogroup" aria-label={label}>
                {[1, 2, 3, 4, 5].map((rating) => (
                    <button
                        key={rating}
                        type="button"
                        role="radio"
                        aria-checked={value === rating}
                        aria-label={`${rating} / 5`}
                        onClick={() => setValue(rating)}
                        className={`rounded-lg p-2 transition ${rating <= value ? 'text-amber-500' : 'text-ink-subtle hover:text-amber-400'}`}
                    >
                        <Star size={24} fill={rating <= value ? 'currentColor' : 'none'} />
                    </button>
                ))}
                <span className="ms-2 text-xs font-bold text-ink-subtle">{value ? `${value}/5` : (isAr ? 'اختر التقييم' : 'Choose a rating')}</span>
            </div>
        </fieldset>
    );

    return (
        <section className="rounded-2xl border border-brand-gold/30 bg-surface p-5 shadow-lg sm:p-7" aria-labelledby="course-evaluation-title">
            <div className="mb-5 flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-gold/15 text-amber-500">
                    <Star size={22} />
                </div>
                <div>
                    <h2 id="course-evaluation-title" className="text-lg font-black text-ink">
                        {isAr ? 'أكمل الدورة بتقييمك' : 'Finish the course with your feedback'}
                    </h2>
                    <p className="mt-1 text-sm leading-6 text-ink-muted">
                        {isAr
                            ? 'تقييمك مطلوب لإتمام الدورة وإتاحة إصدار الشهادة. لا يطلع على النتائج إلا المدير ومدير الدورات.'
                            : 'Your evaluation is required to complete the course and make its certificate available. Only administrators and course managers can see the results.'}
                    </p>
                </div>
            </div>

            <div className="space-y-5">
                {ratingField(isAr ? 'كيف تقيّم الدورة؟' : 'How would you rate the course?', courseRating, setCourseRating)}
                {ratingField(isAr ? 'كيف تقيّم المدرّب؟' : 'How would you rate the instructor?', instructorRating, setInstructorRating)}
                <label className="block">
                    <span className="mb-2 block text-sm font-black text-ink">
                        {isAr ? 'ملاحظات إضافية (اختياري)' : 'Additional comments (optional)'}
                    </span>
                    <textarea
                        value={comment}
                        onChange={(event) => setComment(event.target.value)}
                        maxLength={2000}
                        rows={4}
                        className="w-full rounded-xl border border-line bg-surface-sunken p-3 text-sm text-ink outline-none transition focus:border-brand-gold"
                        placeholder={isAr ? 'شاركنا ما أعجبك وما يمكن تحسينه...' : 'Tell us what worked well and what could improve...'}
                    />
                    <span className="mt-1 block text-end text-xs text-ink-subtle">{comment.length}/2000</span>
                </label>
                <button
                    type="button"
                    disabled={!courseRating || !instructorRating || saving}
                    onClick={submit}
                    className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand-navy px-5 py-2.5 text-sm font-black text-white transition hover:bg-brand-navy-light disabled:cursor-not-allowed disabled:opacity-50"
                >
                    {saving ? <Loader size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                    {isAr ? 'إرسال التقييم وإتمام الدورة' : 'Submit evaluation and finish'}
                </button>
            </div>
        </section>
    );
}
