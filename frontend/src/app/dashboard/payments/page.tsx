"use client";

import ProtectedRoute from '@/components/ProtectedRoute';
import { useFetchData } from '@/lib/useFetchData';
import { useI18n } from '@/lib/i18n-context';
import { api, API_BASE_URL, getErrorMessage } from '@/lib/api';
import toast from 'react-hot-toast';
import { useRef, useState } from 'react';
import { Wallet, CheckCircle, Clock, XCircle, UploadCloud, FileImage, X, CalendarCheck, Eye } from 'lucide-react';
import Link from 'next/link';

interface Opening {
    id: string;
    status?: string | null;
    price: string;
    nameAr?: string | null;
    nameEn?: string | null;
}

interface Course {
    id: string;
    titleAr?: string | null;
    titleEn?: string | null;
    openings?: Opening[];
}

interface Enrollment {
    id: string;
    status: string;
    createdAt: string;
    financeOfficerNotes?: string | null;
    receiptFileUrl?: string | null;
    course: {
        id: string;
        titleAr?: string | null;
        titleEn?: string | null;
    };
    opening?: {
        id: string;
        nameAr?: string | null;
        nameEn?: string | null;
        price: string;
    } | null;
}

interface PayableEnrollment {
    enrollment: Enrollment;
    defaultOpeningId: string;
}

export default function PaymentsPage() {
    const { t, pick } = useI18n();
    const { data: enrollments, loading, error, refetch } = useFetchData<Enrollment[]>('/enrollments/my');
    const { data: courses } = useFetchData<Course[]>('/courses');

    const [payable, setPayable] = useState<PayableEnrollment | null>(null);
    const [openingId, setOpeningId] = useState('');
    const [receiptFile, setReceiptFile] = useState<File | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const statusLabel = (status: string) => t('statuses.' + (status || '').toLowerCase()) || status;

    const announcedCourses = (courses || []).filter(c => c.openings?.some(o => o.status === 'ANNOUNCEMENT'));
    const enrolledCourseIds = new Set((enrollments || []).map(e => e.course.id));

    const closeModal = () => { setPayable(null); setOpeningId(''); setReceiptFile(null); };

    const openPayModal = (enrollment: Enrollment) => {
        const defaultOpeningId = enrollment.opening?.id || enrollment.course && (courses || [])
            .find(c => c.id === enrollment.course.id)?.openings?.find(o => o.status === 'OPEN')?.id || '';
        setPayable({ enrollment, defaultOpeningId });
        setOpeningId(defaultOpeningId);
        setReceiptFile(null);
    };

    const handleReserveClick = async (courseId: string) => {
        try {
            await api.post('/enrollments/reserve', { courseId });
            toast.success(t('payments.reserve_success'));
            refetch();
        } catch (err) {
            toast.error(getErrorMessage(err) || t('payments.reserve_failed'));
        }
    };

    const handleSubmit = async () => {
        if (!payable) return;
        if (!openingId) {
            toast.error(t('payments.select_opening_required'));
            return;
        }
        if (!receiptFile) {
            toast.error(t('payments.upload_receipt_required'));
            return;
        }
        setIsSubmitting(true);
        try {
            const formData = new FormData();
            formData.append('openingId', openingId);
            formData.append('receipt', receiptFile);
            await api.post('/enrollments', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
            toast.success(t('payments.receipt_uploaded'));
            closeModal();
            refetch();
        } catch (err) {
            toast.error(getErrorMessage(err) || t('payments.upload_failed'));
        } finally {
            setIsSubmitting(false);
        }
    };

    const availableOpenings = payable
        ? ((courses || []).find(c => c.id === payable.enrollment.course.id)?.openings || []).filter(o => o.status === 'OPEN' || o.status === 'ANNOUNCEMENT')
        : [];

    const statusBadge = (status: string) => {
        const cls = status === 'APPROVED' ? 'bg-green-500/10 text-green-400 border-green-500/20'
            : status === 'REJECTED' ? 'bg-red-500/10 text-red-400 border-red-500/20'
                : status === 'RESERVED' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                    : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
        const Icon = status === 'APPROVED' ? CheckCircle : status === 'REJECTED' ? XCircle : Clock;
        return (
            <span className={`px-3 py-1 text-xs font-bold rounded-full border flex items-center gap-1.5 w-fit ${cls}`}>
                <Icon size={12} /> {statusLabel(status)}
            </span>
        );
    };

    return (
        <ProtectedRoute allowedRoles={['STUDENT']}>
            <div className="bg-[#111f3a] p-8 rounded-3xl shadow-sm border border-white/5 min-h-[80vh] space-y-10">
                <div className="mb-2">
                    <h2 className="text-3xl font-black text-white flex items-center gap-3">
                        <Wallet size={32} className="text-amber-400" /> {t('payments.heading')}
                    </h2>
                    <p className="text-gray-400 mt-2">{t('payments.subtitle')}</p>
                </div>

                {error && <div className="p-4 bg-red-500/10 text-red-400 border border-red-500/20 rounded-xl">{error}</div>}

                {/* Reserve a seat in announced courses */}
                {!loading && announcedCourses.length > 0 && (
                    <section>
                        <h3 className="text-xl font-black text-white mb-4 flex items-center gap-2">
                            <CalendarCheck size={22} className="text-amber-400" /> {t('payments.reserve_section')}
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {announcedCourses.filter(c => !enrolledCourseIds.has(c.id)).map(course => {
                                const opening = course.openings!.find(o => o.status === 'ANNOUNCEMENT')!;
                                return (
                                    <div key={course.id} className="border border-white/5 rounded-2xl p-5 bg-[#0d1f3c] flex items-center justify-between gap-4">
                                        <div>
                                            <h4 className="font-bold text-white">{pick(course, 'title')}</h4>
                                            <p className="text-sm text-gray-400 mt-1">
                                                {pick(opening, 'name')} · <strong className="text-green-400">${opening.price}</strong>
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => handleReserveClick(course.id)}
                                            className="bg-gradient-to-r from-amber-500 to-amber-600 text-black text-sm font-bold px-4 py-2.5 rounded-xl hover:from-amber-400 hover:to-amber-500 transition whitespace-nowrap"
                                        >
                                            {t('courseDetail.reserve_seat')}
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                )}

                {/* Financial history */}
                <section>
                    <h3 className="text-xl font-black text-white mb-4">{t('payments.history_section')}</h3>
                    {loading ? (
                        <div className="h-40 flex items-center justify-center font-bold text-gray-400">{t('payments.loading')}</div>
                    ) : (enrollments || []).length === 0 ? (
                        <div className="text-center py-16 text-gray-400 font-semibold text-lg border-2 border-dashed border-white/10 rounded-xl">
                            {t('payments.empty_history')}
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {(enrollments || []).map((enrollment) => (
                                <div key={enrollment.id} className="border border-white/5 rounded-2xl p-5 bg-[#0d1f3c]">
                                    <div className="flex flex-wrap items-start justify-between gap-4">
                                        <div className="min-w-0">
                                            <h4 className="font-black text-white text-lg">
                                                <Link href={`/courses/${enrollment.course.id}`} className="hover:text-amber-400 transition-colors">
                                                    {pick(enrollment.course, 'title')}
                                                </Link>
                                            </h4>
                                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-sm text-gray-400">
                                                {pick(enrollment.opening, 'name') && <span>{pick(enrollment.opening, 'name')}</span>}
                                                {enrollment.opening?.price != null && <span className="text-green-400 font-bold">${enrollment.opening.price}</span>}
                                                <span>{t('myCourses.enrolled_on')} {new Date(enrollment.createdAt).toLocaleDateString()}</span>
                                            </div>
                                        </div>
                                        {statusBadge(enrollment.status)}
                                    </div>

                                    {enrollment.financeOfficerNotes && (
                                        <div className="mt-3 p-3 bg-red-500/10 rounded-xl text-xs text-red-400 border border-red-500/20">
                                            <strong>{t('myCourses.finance_note')}</strong> {enrollment.financeOfficerNotes}
                                        </div>
                                    )}

                                    <div className="mt-4 pt-4 border-t border-white/5 flex flex-wrap items-center gap-3">
                                        {enrollment.receiptFileUrl && (
                                            <a
                                                href={`${API_BASE_URL}${enrollment.receiptFileUrl}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-sm font-bold px-4 py-2.5 rounded-xl border border-white/10 text-white hover:border-amber-500 hover:text-amber-400 transition flex items-center gap-2"
                                            >
                                                <Eye size={16} /> {t('payments.view_receipt')}
                                            </a>
                                        )}
                                        {enrollment.status !== 'APPROVED' && (
                                            <button
                                                onClick={() => openPayModal(enrollment)}
                                                className="bg-gradient-to-r from-amber-500 to-amber-600 text-black text-sm font-bold px-4 py-2.5 rounded-xl hover:from-amber-400 hover:to-amber-500 transition"
                                            >
                                                {enrollment.status === 'RESERVED' || enrollment.status === 'REJECTED'
                                                    ? t('payments.pay_now')
                                                    : t('payments.upload_receipt')}
                                            </button>
                                        )}
                                        {enrollment.status === 'APPROVED' && (
                                            <span className="text-sm font-bold text-green-400">{t('payments.fully_paid')}</span>
                                        )}
                                        {enrollment.status === 'RESERVED' && (
                                            <span className="text-xs text-gray-400 font-semibold">{t('payments.reserved_hint')}</span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            </div>

            {/* Upload receipt modal */}
            {payable && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-[#111f3a] rounded-2xl w-full max-w-lg p-8 shadow-2xl max-h-[90vh] overflow-y-auto border border-white/10">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-2xl font-black text-white">{t('payments.upload_title')}</h2>
                            <button onClick={closeModal} className="text-gray-400 hover:text-white transition" aria-label="Close">
                                <X size={22} />
                            </button>
                        </div>
                        <p className="text-gray-400 mb-6">{pick(payable.enrollment.course, 'title')}</p>

                        {(payable.enrollment.opening?.id || availableOpenings.length > 0) ? (
                            <div className="mb-5">
                                <label className="block text-sm font-bold text-gray-300 uppercase tracking-wider mb-2">
                                    {t('payments.select_opening')}
                                </label>
                                <select
                                    value={openingId}
                                    onChange={(e) => setOpeningId(e.target.value)}
                                    className="w-full border border-white/10 rounded-xl px-4 py-3 bg-[#0a1830] font-semibold text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                                >
                                    {payable.enrollment.opening?.id && (
                                        <option value={payable.enrollment.opening.id}>
                                            {pick(payable.enrollment.opening, 'name') || payable.enrollment.opening.id}
                                        </option>
                                    )}
                                    {availableOpenings.filter(o => o.id !== payable.enrollment.opening?.id).map(o => (
                                        <option key={o.id} value={o.id}>{pick(o, 'name') || o.id}</option>
                                    ))}
                                </select>
                            </div>
                        ) : (
                            <div className="p-3 bg-yellow-500/10 rounded-xl text-sm text-yellow-400 border border-yellow-500/20 mb-5">
                                {t('payments.no_open_opening')}
                            </div>
                        )}

                        {!receiptFile ? (
                            <div
                                onClick={() => fileInputRef.current?.click()}
                                className="bg-[#0a1830] border-2 border-dashed border-amber-500/40 rounded-xl p-8 flex flex-col items-center justify-center text-white font-semibold cursor-pointer hover:bg-white/5 transition group"
                            >
                                <UploadCloud size={40} className="mb-3 text-amber-400 group-hover:scale-110 transition-transform" />
                                <span>{t('payment.attach_receipt')}</span>
                                <span className="text-xs text-gray-500 font-normal mt-2">{t('explore.supports_formats')}</span>
                                <input
                                    type="file"
                                    className="hidden"
                                    ref={fileInputRef}
                                    onChange={(e) => { if (e.target.files && e.target.files[0]) setReceiptFile(e.target.files[0]); }}
                                    accept=".jpg,.jpeg,.png,.pdf"
                                />
                            </div>
                        ) : (
                            <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center justify-between">
                                <div className="flex items-center space-x-3 rtl:space-x-reverse overflow-hidden">
                                    <FileImage size={24} className="text-amber-400 flex-shrink-0" />
                                    <span className="font-semibold text-white truncate" dir="ltr">{receiptFile.name}</span>
                                </div>
                                <button onClick={() => setReceiptFile(null)} className="text-red-400 hover:text-red-300 transition flex-shrink-0">
                                    <X size={20} />
                                </button>
                            </div>
                        )}

                        <div className="flex gap-4 mt-8">
                            <button
                                onClick={handleSubmit}
                                disabled={isSubmitting || !receiptFile || !openingId}
                                className="flex-1 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black py-3 font-bold rounded-xl shadow-sm transition disabled:opacity-50"
                            >
                                {isSubmitting ? t('common.submitting') : t('payments.submit_receipt')}
                            </button>
                            <button
                                onClick={closeModal}
                                disabled={isSubmitting}
                                className="flex-1 bg-white/5 text-white hover:bg-white/10 py-3 font-bold rounded-xl transition border border-white/10"
                            >
                                {t('common.cancel')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </ProtectedRoute>
    );
}
