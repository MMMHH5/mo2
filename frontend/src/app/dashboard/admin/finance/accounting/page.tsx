"use client";

import { useState } from 'react';
import { useFetchData } from '@/lib/useFetchData';
import { api, getErrorMessage } from '@/lib/api';
import { useI18n } from '@/lib/i18n-context';
import toast from 'react-hot-toast';
import { BadgeDollarSign, Check, Plus, ReceiptText, RefreshCw, Wallet, X } from 'lucide-react';
import { PageHeader, Badge, BtnSoft, BtnPrimary, type Tone } from '../../components';
import { formatPrice } from '@/lib/format';

type ExpenseType = 'OPERATING' | 'INSTRUCTOR_PAYOUT';
type ExpenseStatus = 'DRAFT' | 'APPROVED' | 'PAID' | 'REJECTED';

interface Opening {
    id: string;
    courseName: string;
    openingName: string | null;
    currency: string;
    instructor: { id: string; email: string };
    sharePercent: number | null;
    collected: number;
    refunded: number;
    instructorAccrued: number;
    instructorPaid: number;
    instructorPayoutsPending: number;
    instructorPayoutsReserved: number;
    instructorRemaining: number;
    instructorOverpaid: number;
    operatingExpenses: number;
    profit: number;
    hasUnsettledShare: boolean;
}

interface Expense {
    id: string;
    type: ExpenseType;
    category: string;
    status: ExpenseStatus;
    title: string;
    vendor: string | null;
    notes: string | null;
    amount: string | number;
    currency: string;
    paymentReference: string | null;
    createdAt: string;
    paidAt: string | null;
    openingId: string | null;
    opening: { nameAr: string | null; nameEn: string | null; course: { titleAr: string; titleEn: string } } | null;
    instructor: { id: string; email: string } | null;
    createdBy: { id: string; email: string };
}

interface CurrencySummary {
    currency: string;
    collected: number;
    refunded: number;
    operatingExpenses: number;
    instructorAccrued: number;
    instructorPaid: number;
    unconfiguredInstructorRevenue: number;
    profit: number;
    cashAfterPaidExpenses: number;
}

interface AccountingReport {
    summary: CurrencySummary[];
    openings: Opening[];
    expenses: Expense[];
}

const categoryOptions = ['MARKETING', 'PLATFORM', 'SALARIES', 'MATERIALS', 'TRAVEL', 'OFFICE', 'OTHER'];
const statusTone: Record<ExpenseStatus, Tone> = { DRAFT: 'amber', APPROVED: 'blue', PAID: 'green', REJECTED: 'red' };

export default function FinanceAccountingPage() {
    const { data, loading, error, refetch } = useFetchData<AccountingReport>('/api/admin/finance/accounting');
    const { locale } = useI18n();
    const isArabic = locale === 'ar';
    const [type, setType] = useState<ExpenseType>('OPERATING');
    const [title, setTitle] = useState('');
    const [vendor, setVendor] = useState('');
    const [notes, setNotes] = useState('');
    const [amount, setAmount] = useState('');
    const [currency, setCurrency] = useState('SAR');
    const [category, setCategory] = useState('OTHER');
    const [openingId, setOpeningId] = useState('');
    const [shareOpeningId, setShareOpeningId] = useState('');
    const [sharePercent, setSharePercent] = useState('');
    const [paymentRefs, setPaymentRefs] = useState<Record<string, string>>({});
    const [saving, setSaving] = useState(false);

    const openings = data?.openings || [];
    const uniqueOpenings = Array.from(new Map(openings.map((opening) => [opening.id, opening])).values());
    const selectedOpening = openings.find((opening) => opening.id === openingId && opening.currency === currency)
        || openings.find((opening) => opening.id === openingId);
    const shareOpening = openings.find((opening) => opening.id === shareOpeningId);
    const currencyOptions = Array.from(new Set(openings.map((opening) => opening.currency).concat((data?.summary || []).map((row) => row.currency))));

    const refresh = () => { void refetch(); };
    const submit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!title.trim() || !Number.isFinite(Number(amount)) || Number(amount) <= 0) {
            toast.error(isArabic ? 'أدخل وصفاً ومبلغاً صحيحاً.' : 'Enter a description and a valid amount.');
            return;
        }
        if (type === 'INSTRUCTOR_PAYOUT' && !selectedOpening) {
            toast.error(isArabic ? 'اختر دفعة الدورة لصرف مستحق المدرّب.' : 'Select a course opening for the instructor payout.');
            return;
        }
        setSaving(true);
        try {
            await api.post('/api/admin/finance/accounting/expenses', {
                type,
                category: type === 'OPERATING' ? category : 'SALARIES',
                title: title.trim(),
                vendor: vendor.trim() || undefined,
                notes: notes.trim() || undefined,
                amount: Number(amount),
                currency: type === 'INSTRUCTOR_PAYOUT' && selectedOpening ? selectedOpening.currency : currency,
                openingId: openingId || undefined,
                instructorId: type === 'INSTRUCTOR_PAYOUT' ? selectedOpening?.instructor.id : undefined,
            });
            toast.success(isArabic ? 'تم حفظ المصروف كمسودة.' : 'Expense saved as a draft.');
            setTitle('');
            setVendor('');
            setNotes('');
            setAmount('');
            setOpeningId('');
            refresh();
        } catch (err) {
            toast.error(getErrorMessage(err) || (isArabic ? 'تعذر تسجيل المصروف.' : 'Could not record the expense.'));
        } finally {
            setSaving(false);
        }
    };

    const saveShare = async () => {
        if (!shareOpening) return;
        const value = sharePercent.trim() === '' ? null : Number(sharePercent);
        if (value !== null && (!Number.isFinite(value) || value < 0 || value > 100)) {
            toast.error(isArabic ? 'النسبة يجب أن تكون بين 0 و100.' : 'Share must be between 0 and 100.');
            return;
        }
        setSaving(true);
        try {
            await api.patch(`/api/admin/finance/accounting/openings/${shareOpening.id}/instructor-share`, { sharePercent: value });
            toast.success(isArabic ? 'تم حفظ نسبة المدرّب.' : 'Instructor share saved.');
            refresh();
        } catch (err) {
            toast.error(getErrorMessage(err) || (isArabic ? 'تعذر حفظ النسبة.' : 'Could not save the share.'));
        } finally {
            setSaving(false);
        }
    };

    const transition = async (expense: Expense, action: 'approve' | 'reject' | 'pay') => {
        const paymentReference = paymentRefs[expense.id]?.trim();
        if (action === 'pay' && !paymentReference) {
            toast.error(isArabic ? 'أدخل رقم التحويل أو مرجع الدفع.' : 'Enter the transfer or payment reference.');
            return;
        }
        setSaving(true);
        try {
            await api.patch(`/api/admin/finance/accounting/expenses/${expense.id}/${action}`, action === 'pay' ? { paymentReference } : {});
            toast.success(action === 'pay'
                ? (isArabic ? 'تم تسجيل الدفع.' : 'Payment recorded.')
                : action === 'approve' ? (isArabic ? 'تم اعتماد المصروف.' : 'Expense approved.') : (isArabic ? 'تم رفض المسودة.' : 'Draft rejected.'));
            refresh();
        } catch (err) {
            toast.error(getErrorMessage(err) || (isArabic ? 'تعذر تحديث المصروف.' : 'Could not update the expense.'));
        } finally {
            setSaving(false);
        }
    };

    const money = (value: number, currencyCode: string) => formatPrice(value, { currency: currencyCode, locale });
    const t = (ar: string, en: string) => isArabic ? ar : en;

    return (
        <div className="space-y-6 animate-fade-in">
            <PageHeader
                title={t('الحسابات والربحية', 'Accounting & profitability')}
                subtitle={t('إيرادات كل دفعة، مستحقات المدرّبين، المصروفات، وصافي الربح حسب العملة.', 'Revenue by course opening, instructor entitlements, expenses, and profit—kept separate by currency.')}
                actions={<BtnSoft icon={RefreshCw} onClick={refresh}>{t('تحديث', 'Refresh')}</BtnSoft>}
            />

            {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">{error}</div>}
            {loading ? (
                <div className="flex h-40 items-center justify-center font-bold text-gray-500">{t('جارٍ تحميل الحسابات...', 'Loading accounting data...')}</div>
            ) : (
                <>
                    <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                        {(data?.summary || []).map((row) => (
                            <article key={row.currency} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-brand-navy-dark">
                                <div className="mb-4 flex items-center justify-between">
                                    <h2 className="font-black text-brand-navy dark:text-white">{row.currency}</h2>
                                    <Badge tone={row.profit >= 0 ? 'green' : 'red'}>{t('ملخص العملة', 'Currency summary')}</Badge>
                                </div>
                                <dl className="space-y-2 text-sm">
                                    <Metric label={t('صافي المقبوضات', 'Net collections')} value={money(row.collected, row.currency)} />
                                    <Metric label={t('المبالغ المستردة', 'Refunded')} value={money(row.refunded, row.currency)} />
                                    <Metric label={t('مستحق المدرّبين', 'Instructor entitlements')} value={money(row.instructorAccrued, row.currency)} />
                                    <Metric label={t('المصروفات التشغيلية المدفوعة', 'Paid operating expenses')} value={money(row.operatingExpenses, row.currency)} />
                                    <Metric label={t('الربح بعد المستحقات والمصروفات', 'Profit after entitlements & expenses')} value={money(row.profit, row.currency)} strong />
                                    <Metric label={t('النقد بعد جميع الدفعات', 'Cash after all paid expenses')} value={money(row.cashAfterPaidExpenses, row.currency)} />
                                    {row.unconfiguredInstructorRevenue > 0 && (
                                        <Metric label={t('إيراد دفعات بلا نسبة محددة', 'Revenue with no share set')} value={money(row.unconfiguredInstructorRevenue, row.currency)} warn />
                                    )}
                                </dl>
                            </article>
                        ))}
                        {(data?.summary || []).length === 0 && (
                            <div className="rounded-xl border border-dashed border-gray-300 p-6 text-sm text-gray-500 dark:border-white/10">{t('لا توجد حركة مالية مسجلة بعد.', 'No financial activity has been recorded yet.')}</div>
                        )}
                    </section>

                    <section className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
                        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-brand-navy-dark">
                            <div className="mb-4 flex items-center gap-2"><BadgeDollarSign className="text-brand-gold-dark dark:text-brand-gold-light" /><h2 className="text-lg font-black text-brand-navy dark:text-white">{t('مستحقات المدرّبين وربحية الدفعات', 'Instructor entitlements & opening profitability')}</h2></div>
                            <div className="overflow-x-auto">
                                <table className="min-w-[900px] w-full text-sm">
                                    <thead className="text-left text-xs text-gray-500 dark:text-gray-400">
                                        <tr>{[t('الدورة / الدفعة', 'Course / opening'), t('المدرّب', 'Instructor'), t('المقبوض', 'Collected'), t('النسبة', 'Share'), t('المستحق', 'Earned'), t('مدفوع / متبقٍ', 'Paid / remaining'), t('الربح', 'Profit')].map((label) => <th key={label} className="border-b border-gray-200 px-3 py-3 dark:border-white/10">{label}</th>)}</tr>
                                    </thead>
                                    <tbody>
                                        {openings.map((opening) => (
                                            <tr key={`${opening.id}-${opening.currency}`} className="border-b border-gray-100 align-top dark:border-white/5">
                                                <td className="px-3 py-3 font-bold text-brand-navy dark:text-white">
                                                    <div>{opening.courseName}</div>
                                                    <div className="mt-1 text-xs font-medium text-gray-500">{opening.openingName || opening.currency}</div>
                                                </td>
                                                <td className="px-3 py-3 text-gray-600 dark:text-gray-300">{opening.instructor.email}</td>
                                                <td className="px-3 py-3 font-bold">{money(opening.collected, opening.currency)}<div className="text-xs font-normal text-gray-500">{t('مسترد', 'Refunded')}: {money(opening.refunded, opening.currency)}</div></td>
                                                <td className="px-3 py-3">{opening.sharePercent === null ? <Badge tone="amber">{t('غير محددة', 'Unset')}</Badge> : `${opening.sharePercent}%`}</td>
                                                <td className="px-3 py-3">{money(opening.instructorAccrued, opening.currency)}</td>
                                                <td className="px-3 py-3">{money(opening.instructorPaid, opening.currency)}<div className="text-xs text-gray-500">{t('متبقٍ', 'Remaining')}: {money(opening.instructorRemaining, opening.currency)}</div>{opening.instructorOverpaid > 0 && <div className="text-xs font-bold text-red-600">{t('زيادة صرف', 'Overpaid')}: {money(opening.instructorOverpaid, opening.currency)}</div>}</td>
                                                <td className={`px-3 py-3 font-black ${opening.profit < 0 ? 'text-red-600' : 'text-green-700 dark:text-green-400'}`}>{money(opening.profit, opening.currency)}</td>
                                            </tr>
                                        ))}
                                        {openings.length === 0 && <tr><td colSpan={7} className="px-3 py-8 text-center text-gray-500">{t('لا توجد دفعات دورات.', 'No course openings found.')}</td></tr>}
                                    </tbody>
                                </table>
                            </div>
                            <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_170px_auto]">
                                <select value={shareOpeningId} onChange={(event) => {
                                    setShareOpeningId(event.target.value);
                                    const opening = openings.find((item) => item.id === event.target.value);
                                    setSharePercent(opening?.sharePercent == null ? '' : String(opening.sharePercent));
                                }} className="rounded-xl border border-gray-300 bg-transparent px-3 py-2 text-sm dark:border-white/10">
                                    <option value="">{t('اختر الدفعة لتحديد نسبة المدرّب', 'Choose opening to set instructor share')}</option>
                                    {uniqueOpenings.map((opening) => <option key={opening.id} value={opening.id}>{opening.courseName} — {opening.instructor.email}</option>)}
                                </select>
                                <input aria-label={t('نسبة المدرّب', 'Instructor share')} type="number" min="0" max="100" step="0.01" value={sharePercent} onChange={(event) => setSharePercent(event.target.value)} placeholder={t('النسبة %', 'Share %')} className="rounded-xl border border-gray-300 bg-transparent px-3 py-2 text-sm dark:border-white/10" />
                                <BtnPrimary icon={Check} onClick={saveShare} disabled={!shareOpening || saving}>{t('حفظ النسبة', 'Save share')}</BtnPrimary>
                            </div>
                            <p className="mt-2 text-xs text-gray-500">{t('الدفعات القديمة بلا نسبة تبقى غير محسوبة حتى يحددها المدير. النسبة تطبق على صافي المقبوضات بعد الاستردادات.', 'Legacy openings remain unconfigured until a manager sets a share. The share is based on net collections after refunds.')}</p>
                        </div>

                        <form onSubmit={submit} className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-brand-navy-dark">
                            <div className="flex items-center gap-2"><ReceiptText className="text-brand-gold-dark dark:text-brand-gold-light" /><h2 className="text-lg font-black text-brand-navy dark:text-white">{t('تسجيل مصروف أو صرف مستحق', 'Record expense or instructor payout')}</h2></div>
                            <div className="grid grid-cols-2 gap-2">
                                <button type="button" onClick={() => setType('OPERATING')} className={`rounded-xl border px-3 py-2 text-sm font-bold ${type === 'OPERATING' ? 'border-brand-gold bg-brand-gold/10 text-brand-navy dark:text-white' : 'border-gray-200 text-gray-500 dark:border-white/10'}`}>{t('مصروف تشغيلي', 'Operating expense')}</button>
                                <button type="button" onClick={() => setType('INSTRUCTOR_PAYOUT')} className={`rounded-xl border px-3 py-2 text-sm font-bold ${type === 'INSTRUCTOR_PAYOUT' ? 'border-brand-gold bg-brand-gold/10 text-brand-navy dark:text-white' : 'border-gray-200 text-gray-500 dark:border-white/10'}`}>{t('مستحق مدرّب', 'Instructor payout')}</button>
                            </div>
                            <input required maxLength={160} value={title} onChange={(event) => setTitle(event.target.value)} placeholder={t('البيان / سبب الصرف', 'Description / reason')} className="w-full rounded-xl border border-gray-300 bg-transparent px-3 py-2.5 text-sm dark:border-white/10" />
                            <input maxLength={160} value={vendor} onChange={(event) => setVendor(event.target.value)} placeholder={t('المستفيد أو المورد (اختياري)', 'Payee or vendor (optional)')} className="w-full rounded-xl border border-gray-300 bg-transparent px-3 py-2.5 text-sm dark:border-white/10" />
                            {type === 'OPERATING' ? (
                                <>
                                    <select value={openingId} onChange={(event) => {
                                        setOpeningId(event.target.value);
                                        const opening = openings.find((item) => item.id === event.target.value);
                                        if (opening) setCurrency(opening.currency);
                                    }} className="w-full rounded-xl border border-gray-300 bg-transparent px-3 py-2.5 text-sm dark:border-white/10">
                                        <option value="">{t('مصروف عام (غير مرتبط بدفعة)', 'General expense (not assigned to an opening)')}</option>
                                        {uniqueOpenings.map((opening) => <option key={opening.id} value={opening.id}>{opening.courseName} — {opening.currency}</option>)}
                                    </select>
                                    <div className="grid grid-cols-2 gap-2">
                                        <select value={category} onChange={(event) => setCategory(event.target.value)} className="rounded-xl border border-gray-300 bg-transparent px-3 py-2.5 text-sm dark:border-white/10">
                                            {categoryOptions.map((option) => <option key={option} value={option}>{categoryLabel(option, isArabic)}</option>)}
                                        </select>
                                        <select value={currency} onChange={(event) => setCurrency(event.target.value)} disabled={Boolean(openingId)} className="rounded-xl border border-gray-300 bg-transparent px-3 py-2.5 text-sm disabled:opacity-60 dark:border-white/10">
                                            {Array.from(new Set(['SAR', ...currencyOptions])).map((option) => <option key={option} value={option}>{option}</option>)}
                                        </select>
                                    </div>
                                </>
                            ) : (
                                <select value={selectedOpening ? `${selectedOpening.id}::${selectedOpening.currency}` : ''} onChange={(event) => {
                                    const [selectedId, selectedCurrency] = event.target.value.split('::');
                                    setOpeningId(selectedId || '');
                                    const opening = openings.find((item) => item.id === selectedId && item.currency === selectedCurrency);
                                    if (opening) setCurrency(opening.currency);
                                }} className="w-full rounded-xl border border-gray-300 bg-transparent px-3 py-2.5 text-sm dark:border-white/10">
                                    <option value="">{t('اختر دفعة الدورة والمدرّب', 'Choose course opening and instructor')}</option>
                                    {openings.map((opening) => <option key={`${opening.id}-${opening.currency}`} value={`${opening.id}::${opening.currency}`}>{opening.courseName} — {opening.instructor.email} ({opening.currency})</option>)}
                                </select>
                            )}
                            <input required type="number" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder={t('المبلغ', 'Amount')} className="w-full rounded-xl border border-gray-300 bg-transparent px-3 py-2.5 text-sm dark:border-white/10" />
                            <textarea maxLength={2000} rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder={t('ملاحظات أو تفاصيل إضافية', 'Notes or additional details')} className="w-full resize-y rounded-xl border border-gray-300 bg-transparent px-3 py-2.5 text-sm dark:border-white/10" />
                            {type === 'INSTRUCTOR_PAYOUT' && selectedOpening && <p className="text-xs text-gray-500">{t('المستحق المتاح بعد المسودات والاعتمادات', 'Available after drafts and approvals')}: {money(selectedOpening.instructorRemaining - selectedOpening.instructorPayoutsReserved, selectedOpening.currency)} — {selectedOpening.instructor.email}</p>}
                            <BtnPrimary icon={Plus} type="submit" disabled={saving}>{saving ? t('جارٍ الحفظ...', 'Saving...') : t('حفظ كمسودة', 'Save as draft')}</BtnPrimary>
                        </form>
                    </section>

                    <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-brand-navy-dark">
                        <div className="mb-4 flex items-center justify-between gap-3"><div className="flex items-center gap-2"><Wallet className="text-brand-gold-dark dark:text-brand-gold-light" /><h2 className="text-lg font-black text-brand-navy dark:text-white">{t('سجل المصروفات والصرف', 'Expense & payout ledger')}</h2></div><span className="text-xs text-gray-500">{t('السجل الكامل', 'Full history')}</span></div>
                        <div className="overflow-x-auto">
                            <table className="min-w-[980px] w-full text-sm">
                                <thead className="text-left text-xs text-gray-500 dark:text-gray-400"><tr>{[t('البيان', 'Description'), t('النوع / التصنيف', 'Type / category'), t('الدورة / المستفيد', 'Opening / payee'), t('المبلغ', 'Amount'), t('الحالة', 'Status'), t('الإجراء', 'Action')].map((label) => <th key={label} className="border-b border-gray-200 px-3 py-3 dark:border-white/10">{label}</th>)}</tr></thead>
                                <tbody>
                                    {(data?.expenses || []).map((expense) => (
                                        <tr key={expense.id} className="border-b border-gray-100 align-top dark:border-white/5">
                                            <td className="px-3 py-3 font-bold text-brand-navy dark:text-white">{expense.title}<div className="mt-1 text-xs font-normal text-gray-500">{expense.vendor || expense.createdBy.email} · {new Date(expense.createdAt).toLocaleDateString(locale)}</div>{expense.paymentReference && <div className="mt-1 text-xs text-gray-500">{t('مرجع الدفع', 'Payment ref')}: {expense.paymentReference}</div>}</td>
                                            <td className="px-3 py-3">{expense.type === 'INSTRUCTOR_PAYOUT' ? t('مستحق مدرّب', 'Instructor payout') : categoryLabel(expense.category, isArabic)}</td>
                                            <td className="px-3 py-3 text-gray-600 dark:text-gray-300">{expense.opening ? `${expense.opening.course.titleAr || expense.opening.course.titleEn} — ${expense.opening.nameAr || expense.opening.nameEn || ''}` : '—'}{expense.instructor && <div className="mt-1 text-xs">{expense.instructor.email}</div>}</td>
                                            <td className="px-3 py-3 font-black">{money(Number(expense.amount), expense.currency)}</td>
                                            <td className="px-3 py-3"><Badge tone={statusTone[expense.status]} dot>{statusLabel(expense.status, isArabic)}</Badge></td>
                                            <td className="px-3 py-3">
                                                {expense.status === 'DRAFT' && <div className="flex gap-2"><button disabled={saving} onClick={() => void transition(expense, 'approve')} className="rounded-lg bg-green-600 px-2.5 py-1.5 text-xs font-bold text-white disabled:opacity-50"><Check size={14} className="inline" /> {t('اعتماد', 'Approve')}</button><button disabled={saving} onClick={() => void transition(expense, 'reject')} className="rounded-lg bg-red-600 px-2.5 py-1.5 text-xs font-bold text-white disabled:opacity-50"><X size={14} className="inline" /> {t('رفض', 'Reject')}</button></div>}
                                                {expense.status === 'APPROVED' && <div className="flex min-w-[230px] gap-2"><input maxLength={160} aria-label={t('مرجع الدفع', 'Payment reference')} value={paymentRefs[expense.id] || ''} onChange={(event) => setPaymentRefs({ ...paymentRefs, [expense.id]: event.target.value })} placeholder={t('رقم التحويل/المرجع', 'Transfer/payment ref')} className="min-w-0 flex-1 rounded-lg border border-gray-300 bg-transparent px-2 py-1.5 text-xs dark:border-white/10" /><button disabled={saving} onClick={() => void transition(expense, 'pay')} className="rounded-lg bg-brand-gold px-2.5 py-1.5 text-xs font-bold text-black disabled:opacity-50">{t('تسجيل الدفع', 'Mark paid')}</button></div>}
                                            </td>
                                        </tr>
                                    ))}
                                    {(data?.expenses || []).length === 0 && <tr><td colSpan={6} className="px-3 py-8 text-center text-gray-500">{t('لا توجد مصروفات. أضف أول مصروف من النموذج أعلاه.', 'No expenses yet. Add the first expense using the form above.')}</td></tr>}
                                </tbody>
                            </table>
                        </div>
                        <p className="mt-3 text-xs text-gray-500">{t('لا يدخل المصروف في الربحية ولا يسجل كمدفوع إلا بعد الاعتماد ثم تسجيل الدفع مع مرجع التحويل. المستحقات المعتمدة لا تخصم من الربح مرتين.', 'Expenses affect cash and profitability only when marked paid. Each must be approved first and have a payment reference. Instructor entitlements are not deducted twice.')}</p>
                    </section>
                </>
            )}
        </div>
    );
}

function Metric({ label, value, strong = false, warn = false }: { label: string; value: string; strong?: boolean; warn?: boolean }) {
    return <div className={`flex items-start justify-between gap-3 ${strong ? 'border-t border-gray-200 pt-2 font-black dark:border-white/10' : ''} ${warn ? 'text-amber-700 dark:text-amber-300' : 'text-gray-600 dark:text-gray-300'}`}><dt>{label}</dt><dd className="text-right">{value}</dd></div>;
}

function categoryLabel(category: string, isArabic: boolean) {
    const labels: Record<string, [string, string]> = {
        MARKETING: ['تسويق', 'Marketing'], PLATFORM: ['منصة وتقنية', 'Platform & technology'],
        SALARIES: ['رواتب وأجور', 'Salaries'], MATERIALS: ['مواد تعليمية', 'Materials'],
        TRAVEL: ['سفر وتنقل', 'Travel'], OFFICE: ['مكتب وتشغيل', 'Office'], OTHER: ['أخرى', 'Other'],
    };
    const pair = labels[category] || labels.OTHER;
    return isArabic ? pair[0] : pair[1];
}

function statusLabel(status: ExpenseStatus, isArabic: boolean) {
    const labels: Record<ExpenseStatus, [string, string]> = {
        DRAFT: ['مسودة', 'Draft'], APPROVED: ['معتمد', 'Approved'], PAID: ['مدفوع', 'Paid'], REJECTED: ['مرفوض', 'Rejected'],
    };
    return isArabic ? labels[status][0] : labels[status][1];
}
