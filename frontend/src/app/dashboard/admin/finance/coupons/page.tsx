"use client";

import { useFetchData } from '@/lib/useFetchData';
import { api, getErrorMessage } from '@/lib/api';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, Trash2, Tag, Percent, DollarSign, X } from 'lucide-react';
import { PageHeader, Badge, EmptyState, BtnSoft } from '../../components';

interface CouponCourse {
    id: string;
    titleAr?: string | null;
    titleEn?: string | null;
}

interface Coupon {
    id: string;
    code: string;
    discount: number | string;
    type: 'PERCENTAGE' | 'FIXED';
    expiresAt?: string | null;
    maxUses?: number | null;
    usedCount: number;
    courses?: CouponCourse[] | null;
}

interface CouponForm {
    code: string;
    discount: string;
    type: 'PERCENTAGE' | 'FIXED';
    maxUses: string;
    expiresAt: string;
}

const emptyForm: CouponForm = { code: '', discount: '', type: 'PERCENTAGE', maxUses: '', expiresAt: '' };

export default function AdminCouponsPage() {
    const { data: coupons, loading, error, refetch } = useFetchData<Coupon[]>('/finance/coupons');
    const [showModal, setShowModal] = useState(false);
    const [form, setForm] = useState<CouponForm>(emptyForm);
    const [saving, setSaving] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const set = (key: keyof CouponForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
        setForm(f => ({ ...f, [key]: e.target.value }));

    const handleCreate = async () => {
        if (!form.code.trim() || !form.discount) {
            toast.error('Code and discount are required');
            return;
        }
        setSaving(true);
        try {
            await api.post('/finance/coupons', {
                code: form.code.trim(),
                discount: Number(form.discount),
                type: form.type,
                maxUses: form.maxUses ? Number(form.maxUses) : undefined,
                expiresAt: form.expiresAt || undefined,
            });
            toast.success('Coupon created');
            setShowModal(false);
            setForm(emptyForm);
            refetch();
        } catch (err) {
            toast.error(getErrorMessage(err) || 'Failed to create coupon');
        }
        setSaving(false);
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('Delete this coupon?')) return;
        setDeletingId(id);
        try {
            await api.delete(`/finance/coupons/${id}`);
            toast.success('Coupon deleted');
            refetch();
        } catch (err) {
            toast.error(getErrorMessage(err) || 'Failed to delete coupon');
        }
        setDeletingId(null);
    };

    return (
        <div className="space-y-6 animate-fade-in">
            <PageHeader
                title="Coupons"
                subtitle="Create and manage discount coupons"
                actions={
                    <div className="flex gap-2">
                        <BtnSoft icon={Plus} onClick={() => { setForm(emptyForm); setShowModal(true); }}>Create Coupon</BtnSoft>
                        <BtnSoft icon={Percent} onClick={refetch}>Refresh</BtnSoft>
                    </div>
                }
            />

            {error && <div className="p-4 bg-red-500/10 text-red-400 border border-red-500/20 rounded-xl">{error}</div>}

            {loading ? (
                <div className="h-40 flex items-center justify-center font-bold text-gray-400">Loading coupons…</div>
            ) : (
                <div className="admin-table-wrap bg-[#111f3a] border border-white/5 rounded-2xl animate-fade-in-up">
                    <table className="admin-table text-left">
                        <thead>
                            <tr>
                                <th>Code</th>
                                <th>Discount</th>
                                <th>Type</th>
                                <th>Expiry</th>
                                <th className="text-center">Uses</th>
                                <th className="text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {(coupons || []).map(c => {
                                const expired = c.expiresAt ? new Date(c.expiresAt) < new Date() : false;
                                const exhausted = c.maxUses != null && c.usedCount >= c.maxUses;
                                return (
                                    <tr key={c.id} className="animate-fade-in hover:bg-white/5">
                                        <td className="p-4">
                                            <span className="inline-flex items-center gap-2 font-mono font-black text-white">
                                                <Tag size={15} className="text-amber-400" /> {c.code}
                                            </span>
                                            {!!c.courses?.length && (
                                                <div className="text-xs text-gray-500 mt-1">
                                                    {c.courses.map(cc => cc.titleEn || cc.titleAr).filter(Boolean).join(', ')}
                                                </div>
                                            )}
                                        </td>
                                        <td className="p-4 font-black text-amber-400">
                                            {c.type === 'PERCENTAGE' ? `${c.discount}%` : `$${c.discount}`}
                                        </td>
                                        <td className="p-4">
                                            <Badge tone={c.type === 'PERCENTAGE' ? 'purple' : 'blue'} dot={false}>
                                                {c.type === 'PERCENTAGE' ? <Percent size={12} /> : <DollarSign size={12} />}
                                                {c.type}
                                            </Badge>
                                        </td>
                                        <td className="p-4 text-sm">
                                            {c.expiresAt ? (
                                                <span className={expired ? 'text-red-400 font-bold' : 'text-gray-400'}>
                                                    {new Date(c.expiresAt).toLocaleDateString()}
                                                </span>
                                            ) : (
                                                <span className="text-gray-600">—</span>
                                            )}
                                        </td>
                                        <td className="p-4 text-center">
                                            <span className={`font-bold ${exhausted ? 'text-red-400' : 'text-gray-300'}`}>
                                                {c.usedCount}{c.maxUses != null ? ` / ${c.maxUses}` : ''}
                                            </span>
                                        </td>
                                        <td className="p-4 text-right whitespace-nowrap">
                                            <button
                                                onClick={() => handleDelete(c.id)}
                                                disabled={deletingId === c.id}
                                                className="inline-flex items-center gap-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 ring-1 ring-red-500/20 px-3.5 py-2 rounded-lg text-sm font-bold transition disabled:opacity-40 cursor-pointer"
                                            >
                                                <Trash2 size={16} /> Delete
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                            {(coupons || []).length === 0 && (
                                <EmptyState icon={Tag} title="No coupons yet. Create your first discount coupon." color="gold" />
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Create coupon modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
                    <div className="bg-[#111f3a] border border-white/10 rounded-3xl w-full max-w-md shadow-2xl animate-scale-in">
                        <div className="p-6 border-b border-white/10 flex justify-between items-center">
                            <h3 className="text-xl font-black text-white">Create Coupon</h3>
                            <button onClick={() => setShowModal(false)} className="p-2 rounded-xl bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 transition cursor-pointer"><X size={20} /></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-300 mb-1.5">Code *</label>
                                <input
                                    value={form.code}
                                    onChange={set('code')}
                                    placeholder="SUMMER25"
                                    className="w-full border border-white/10 rounded-xl p-3 bg-[#0a1830] text-white uppercase placeholder:text-gray-600 focus:ring-2 focus:ring-amber-400 outline-none transition"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-bold text-gray-300 mb-1.5">Discount *</label>
                                    <input
                                        type="number"
                                        min={0}
                                        value={form.discount}
                                        onChange={set('discount')}
                                        placeholder="25"
                                        className="w-full border border-white/10 rounded-xl p-3 bg-[#0a1830] text-white placeholder:text-gray-600 focus:ring-2 focus:ring-amber-400 outline-none transition"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-300 mb-1.5">Type *</label>
                                    <select
                                        value={form.type}
                                        onChange={set('type')}
                                        className="w-full border border-white/10 rounded-xl p-3 bg-[#0a1830] text-white focus:ring-2 focus:ring-amber-400 outline-none transition"
                                    >
                                        <option value="PERCENTAGE">PERCENTAGE</option>
                                        <option value="FIXED">FIXED</option>
                                    </select>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-bold text-gray-300 mb-1.5">Max Uses</label>
                                    <input
                                        type="number"
                                        min={0}
                                        value={form.maxUses}
                                        onChange={set('maxUses')}
                                        placeholder="Unlimited"
                                        className="w-full border border-white/10 rounded-xl p-3 bg-[#0a1830] text-white placeholder:text-gray-600 focus:ring-2 focus:ring-amber-400 outline-none transition"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-300 mb-1.5">Expiry Date</label>
                                    <input
                                        type="date"
                                        value={form.expiresAt}
                                        onChange={set('expiresAt')}
                                        className="w-full border border-white/10 rounded-xl p-3 bg-[#0a1830] text-white focus:ring-2 focus:ring-amber-400 outline-none transition"
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="p-6 pt-0 flex gap-3">
                            <button
                                onClick={handleCreate}
                                disabled={saving}
                                className="flex-1 bg-gradient-to-r from-amber-500 to-amber-600 hover:opacity-90 text-black font-black py-3.5 rounded-xl shadow-md shadow-amber-500/25 disabled:opacity-50 transition cursor-pointer"
                            >
                                {saving ? 'Creating…' : 'Create Coupon'}
                            </button>
                            <BtnSoft onClick={() => setShowModal(false)}>Cancel</BtnSoft>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
