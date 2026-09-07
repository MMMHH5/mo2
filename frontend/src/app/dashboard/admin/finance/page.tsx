"use client";

import { useFetchData } from '@/lib/useFetchData';
import { api, API_BASE_URL, getErrorMessage } from '@/lib/api';
import { useI18n } from '@/lib/i18n-context';
import { useState } from 'react';
import Image from 'next/image';
import toast from 'react-hot-toast';
import { Check, X, FileImage, ExternalLink, RefreshCw, ShieldCheck, Wallet, CreditCard } from 'lucide-react';
import { PageHeader, Badge, EmptyState, BtnSoft, type Tone } from '../components';
import { formatPrice } from '@/lib/format';

interface Enrollment {
    id: string;
    createdAt: string;
    status: string;
    receiptFileUrl?: string | null;
    financeOfficerNotes?: string | null;
    student?: { email: string } | null;
    course?: { titleAr?: string | null; titleEn?: string | null } | null;
    opening?: { price: string; nameAr?: string | null; nameEn?: string | null; isPublished: boolean } | null;
}

interface Payment {
    id: string;
    amount: number | string;
    status: string;
    method?: string | null;
    createdAt: string;
    user?: { email: string } | null;
    enrollment?: { course?: { titleAr?: string | null; titleEn?: string | null } | null } | null;
}

const statusTone: Record<string, Tone> = {
    PENDING: 'amber',
    APPROVED: 'green',
    REJECTED: 'red',
    RESERVED: 'blue',
};

type Filter = 'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'RESERVED';

export default function AdminFinancePage() {
    const { data: enrollments, loading, error, refetch } = useFetchData<Enrollment[]>('/enrollments/all');
    const [activeTab, setActiveTab] = useState<'enrollments' | 'payments'>('enrollments');
    const { data: payments, loading: paymentsLoading, error: paymentsError } = useFetchData<Payment[]>(activeTab === 'payments' ? '/payments' : null);
    const { t, pick, locale } = useI18n();
    const [statusFilter, setStatusFilter] = useState<Filter>('ALL');
    const [selected, setSelected] = useState<Enrollment | null>(null);
    const [isRejecting, setIsRejecting] = useState(false);
    const [reason, setReason] = useState('');
    const [processing, setProcessing] = useState(false);

    const counts = {
        ALL: (enrollments || []).length,
        PENDING: (enrollments || []).filter(e => e.status === 'PENDING').length,
        APPROVED: (enrollments || []).filter(e => e.status === 'APPROVED').length,
        REJECTED: (enrollments || []).filter(e => e.status === 'REJECTED').length,
        RESERVED: (enrollments || []).filter(e => e.status === 'RESERVED').length,
    };

    const filtered = (enrollments || []).filter(e => statusFilter === 'ALL' || e.status === statusFilter);

    const handleVerify = async (id: string, status: 'APPROVED' | 'REJECTED') => {
        if (status === 'REJECTED' && !reason.trim()) {
            toast.error(t('finance.provided_reason'));
            return;
        }
        setProcessing(true);
        try {
            await api.patch(`/enrollments/${id}/review`, { status, notes: status === 'REJECTED' ? reason : undefined });
            toast.success(status === 'APPROVED' ? t('finance.approved_msg') : t('finance.rejected_msg'));
            setSelected(null);
            setIsRejecting(false);
            setReason('');
            refetch();
        } catch (err) {
            toast.error(getErrorMessage(err) || (status === 'APPROVED' ? t('finance.approve_fail') : t('finance.reject_fail')));
        }
        setProcessing(false);
    };

    const openReceipt = (e: Enrollment, reject = false) => {
        setSelected(e);
        setIsRejecting(reject);
        setReason('');
    };

    const statBtn = (s: Filter) => (
        <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`rounded-xl p-3 text-start transition-all duration-200 ${statusFilter === s
                ? 'bg-gradient-to-br from-[#0d1f3c] to-[#111f3a] text-white shadow-lg shadow-black/25 scale-[1.02] border border-white/10'
                : 'bg-[#111f3a] border border-white/5 hover:shadow-md'
                }`}
        >
            <div className="admin-stat-value">{counts[s]}</div>
            <div className={`text-[11px] font-black mt-1 ${statusFilter === s ? 'text-amber-400' : 'text-gray-500'}`}>
                {s === 'ALL' ? t('admin.filter_all') : t('statuses.' + s.toLowerCase())}
            </div>
        </button>
    );

    return (
        <div className="space-y-6 animate-fade-in">
            <PageHeader
                title={t('admin.finance_heading')}
                subtitle={t('admin.finance_subtitle')}
                actions={
                    <BtnSoft icon={RefreshCw} onClick={refetch}>{t('admin.refresh')}</BtnSoft>
                }
            />

            {/* Tabs */}
            <div className="flex gap-2 p-1.5 bg-[#111f3a] border border-white/5 rounded-2xl w-fit animate-fade-in-up">
                <button
                    onClick={() => setActiveTab('enrollments')}
                    className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-black transition-all duration-200 ${activeTab === 'enrollments'
                        ? 'bg-gradient-to-br from-[#0d1f3c] to-[#111f3a] text-white shadow-lg shadow-black/25 border border-white/10'
                        : 'text-gray-500 hover:text-gray-300'
                        }`}
                >
                    <ShieldCheck size={16} /> {t('finance.tab_enrollments')}
                </button>
                <button
                    onClick={() => setActiveTab('payments')}
                    className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-black transition-all duration-200 ${activeTab === 'payments'
                        ? 'bg-gradient-to-br from-[#0d1f3c] to-[#111f3a] text-white shadow-lg shadow-black/25 border border-white/10'
                        : 'text-gray-500 hover:text-gray-300'
                        }`}
                >
                    <Wallet size={16} /> {t('finance.tab_payments')}
                </button>
            </div>

            {activeTab === 'enrollments' && (<>
                {/* Stats */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 animate-fade-in-up">
                {(['ALL', 'PENDING', 'APPROVED', 'REJECTED', 'RESERVED'] as const).map(s => statBtn(s))}
            </div>

            {error && <div className="p-4 bg-red-500/10 text-red-400 border border-red-500/20 rounded-xl">{error}</div>}

            {loading ? (
                <div className="h-40 flex items-center justify-center font-bold text-gray-400">{t('finance.loading')}</div>
            ) : (
                <div className="admin-table-wrap animate-fade-in-up">
                    <table className="admin-table text-left">
                        <thead>
                            <tr>
                                <th>{t('finance.col_student')}</th>
                                <th>{t('finance.col_course')}</th>
                                <th>{t('admin.col_status')}</th>
                                <th className="text-center">{t('finance.col_receipt')}</th>
                                <th className="text-right">{t('finance.col_actions')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {filtered.map(e => (
                                <tr key={e.id} className="animate-fade-in hover:bg-white/5">
                                    <td className="p-4">
                                        <div className="font-bold text-gray-200">{e.student?.email || t('finance.unknown_student')}</div>
                                        <div className="text-xs text-gray-500 mt-1">{new Date(e.createdAt).toLocaleDateString()}</div>
                                    </td>
                                    <td className="p-4">
                                        <div className="font-bold text-white">{pick(e.course, 'title')}</div>
                                        <div className="text-sm font-black text-amber-400">${e.opening?.price ?? '—'}</div>
                                        {pick(e.opening, 'name') && <div className="text-xs text-gray-500 mt-0.5">{pick(e.opening, 'name')}</div>}
                                    </td>
                                    <td className="p-4">
                                        <Badge tone={statusTone[e.status] || 'gray'} dot>{t('statuses.' + (e.status || '').toLowerCase())}</Badge>
                                    </td>
                                    <td className="p-4 text-center">
                                        <button onClick={() => openReceipt(e)} className="inline-flex items-center gap-2 px-3.5 py-2 bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white rounded-xl text-sm font-bold transition-all duration-200">
                                            <FileImage size={16} /> {t('finance.view_receipt')}
                                        </button>
                                    </td>
                                    <td className="p-4 text-right whitespace-nowrap">
                                        {e.status === 'PENDING' ? (
                                            <>
                                                <button onClick={() => handleVerify(e.id, 'APPROVED')} disabled={processing} className="inline-flex items-center gap-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/20 px-3.5 py-2 rounded-lg text-sm font-bold transition disabled:opacity-40">
                                                    <Check size={16} /> {t('finance.approve')}
                                                </button>
                                                <button onClick={() => openReceipt(e, true)} disabled={processing} className="inline-flex items-center gap-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 ring-1 ring-red-500/20 px-3.5 py-2 rounded-lg text-sm font-bold transition disabled:opacity-40 ms-2">
                                                    <X size={16} /> {t('finance.reject')}
                                                </button>
                                            </>
                                        ) : (
                                            <span className="text-xs text-gray-500">{t('admin.no_action')}</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {filtered.length === 0 && (
                                <EmptyState icon={ShieldCheck} title={t('finance.all_caught_up')} color="green" />
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Receipt modal */}
            {selected && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
                    <div className="bg-[#0d1f3c] border border-white/10 rounded-3xl w-full max-w-3xl flex flex-col max-h-[90vh] overflow-hidden shadow-2xl animate-scale-in">
                        <div className="p-6 border-b border-white/10 flex justify-between items-center bg-gradient-to-r from-[#0d1f3c] to-[#111f3a]">
                            <div>
                                <h3 className="text-xl font-black text-white">{isRejecting ? t('finance.reject_title') : t('finance.verification_title')}</h3>
                                <p className="text-sm text-gray-400 mt-1">
                                    {t('finance.student_label')} <span className="font-bold text-white">{selected.student?.email}</span> | {t('finance.course_label')} <span className="font-bold text-white">{pick(selected.course, 'title')}</span>
                                </p>
                            </div>
                            <button onClick={() => { setSelected(null); setIsRejecting(false); setReason(''); }} className="admin-action-btn bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 transition"><X size={22} /></button>
                        </div>

                        <div className="p-6 overflow-y-auto flex-1 bg-[#0a1830] flex flex-col items-center justify-center relative">
                            {selected.receiptFileUrl ? (
                                selected.receiptFileUrl.toLowerCase().endsWith('.pdf') ? (
                                    <iframe src={`${API_BASE_URL}${selected.receiptFileUrl}`} className="w-full h-[500px] rounded-xl shadow-md border border-white/10" title="PDF Receipt" />
                                ) : (
                                    <Image src={`${API_BASE_URL}${selected.receiptFileUrl}`} alt="Receipt" width={800} height={600} unoptimized className="max-w-full rounded-xl shadow-md border border-white/10" />
                                )
                            ) : (
                                <div className="text-center space-y-4">
                                    <div className="admin-tile w-20 h-20 bg-white/10 text-gray-400 mx-auto">
                                        <FileImage size={36} />
                                    </div>
                                    <p className="text-gray-500 font-semibold">{t('finance.no_receipt')}</p>
                                </div>
                            )}
                            {selected.receiptFileUrl && (
                                <a href={`${API_BASE_URL}${selected.receiptFileUrl}`} target="_blank" rel="noreferrer" className="absolute top-8 right-8 bg-[#111f3a] border border-white/10 p-2.5 rounded-xl shadow-md hover:shadow-lg hover:-translate-y-0.5 transition text-gray-300 hover:text-white">
                                    <ExternalLink size={20} />
                                </a>
                            )}
                        </div>

                        {isRejecting ? (
                            <div className="p-6 border-t border-white/10 bg-[#0d1f3c]">
                                <label className="block text-sm font-bold text-gray-300 mb-2">{t('finance.reason_label')}</label>
                                <textarea className="w-full border border-white/10 rounded-xl p-4 bg-[#0a1830] text-white placeholder:text-gray-500 focus:ring-2 focus:ring-red-400 outline-none transition" rows={3} placeholder={t('finance.reason_placeholder')} value={reason} onChange={e => setReason(e.target.value)} />
                                <div className="flex gap-4 mt-4">
                                    <button onClick={() => handleVerify(selected.id, 'REJECTED')} disabled={processing} className="flex-1 bg-gradient-to-r from-red-600 to-red-500 hover:from-red-700 hover:to-red-600 text-white font-bold py-3.5 rounded-xl disabled:opacity-50 transition shadow-md shadow-red-500/20">
                                        {processing ? t('common.processing') : t('finance.confirm_rejection')}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="p-6 border-t border-white/10 bg-[#0d1f3c] flex gap-4">
                                <button onClick={() => handleVerify(selected.id, 'APPROVED')} disabled={processing} className="flex-1 bg-gradient-to-r from-amber-500 to-amber-600 hover:opacity-90 text-black font-black py-4 rounded-xl shadow-md shadow-amber-500/25 disabled:opacity-50 transition flex items-center justify-center gap-2">
                                    <Check size={20} /> {t('finance.approve_activate')}
                                </button>
                                <button onClick={() => setIsRejecting(true)} disabled={processing} className="flex-1 bg-white/5 hover:bg-white/10 text-gray-300 font-bold py-4 rounded-xl disabled:opacity-50 transition flex items-center justify-center gap-2">
                                    <X size={20} /> {t('finance.mark_invalid')}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}</>)}

            {activeTab === 'payments' && (
                <>
                    {paymentsError && <div className="p-4 bg-red-500/10 text-red-400 border border-red-500/20 rounded-xl">{paymentsError}</div>}

                    {paymentsLoading ? (
                        <div className="h-40 flex items-center justify-center font-bold text-gray-400">{t('payments.loading')}</div>
                    ) : (
                        <div className="admin-table-wrap animate-fade-in-up">
                            <table className="admin-table text-left">
                                <thead>
                                    <tr>
                                        <th>{t('finance.col_student')}</th>
                                        <th>{t('finance.col_course')}</th>
                                        <th>{t('finance.col_amount')}</th>
                                        <th>{t('admin.col_status')}</th>
                                        <th>{t('finance.col_method')}</th>
                                        <th>{t('finance.col_date')}</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {(payments || []).map(p => (
                                        <tr key={p.id} className="animate-fade-in hover:bg-white/5">
                                            <td className="p-4 font-bold text-gray-200">{p.user?.email || t('finance.unknown_student')}</td>
                                            <td className="p-4 font-bold text-white">{pick(p.enrollment?.course, 'title') || '—'}</td>
                                            <td className="p-4 font-black text-amber-400">{formatPrice(p.amount, { locale })}</td>
                                            <td className="p-4">
                                                <Badge tone={statusTone[p.status] || 'gray'} dot>{t('statuses.' + (p.status || '').toLowerCase())}</Badge>
                                            </td>
                                            <td className="p-4">
                                                {p.method ? (
                                                    <span className="inline-flex items-center gap-1.5 text-sm font-bold text-gray-300">
                                                        <CreditCard size={14} /> {p.method}
                                                    </span>
                                                ) : (
                                                    <span className="text-gray-600">—</span>
                                                )}
                                            </td>
                                            <td className="p-4 text-sm text-gray-500">{new Date(p.createdAt).toLocaleDateString()}</td>
                                        </tr>
                                    ))}
                                    {(payments || []).length === 0 && (
                                        <EmptyState icon={Wallet} title={t('payments.empty_history')} color="blue" />
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
