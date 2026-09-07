"use client";

import { useFetchData } from '@/lib/useFetchData';
import { api, API_BASE_URL, getErrorMessage } from '@/lib/api';
import { useI18n } from '@/lib/i18n-context';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { PlusCircle, Pencil, Trash2, ImageIcon, ExternalLink, CreditCard, Wallet } from 'lucide-react';
import { PageHeader, Badge, EmptyPanel, BtnSoft, type Tone } from '../components';

interface Gateway {
    id: string;
    name: string;
    instructions: string;
    walletGuideImageUrl?: string | null;
    isActive: boolean;
    createdAt: string;
}

interface GatewayForm {
    name: string;
    instructions: string;
    walletGuideImageUrl: string;
    isActive: boolean;
}

const EMPTY_FORM: GatewayForm = { name: '', instructions: '', walletGuideImageUrl: '', isActive: true };

const fileUrl = (url?: string | null) => {
    if (!url) return null;
    return url.startsWith('http') ? url : `${API_BASE_URL}${url}`;
};

export default function AdminGatewaysPage() {
    const { data: gateways, loading, error, refetch } = useFetchData<Gateway[]>('/payment-gateways/all');
    const { t } = useI18n();
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState<GatewayForm>(EMPTY_FORM);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [processingId, setProcessingId] = useState<string | null>(null);

    const openCreate = () => {
        setEditingId(null);
        setForm(EMPTY_FORM);
        setShowForm(true);
    };

    const openEdit = (g: Gateway) => {
        setEditingId(g.id);
        setForm({
            name: g.name,
            instructions: g.instructions,
            walletGuideImageUrl: g.walletGuideImageUrl || '',
            isActive: g.isActive,
        });
        setShowForm(true);
    };

    const handleSave = async () => {
        if (!form.name.trim() || !form.instructions.trim()) {
            toast.error(t('admin.gateway_validation'));
            return;
        }
        setSaving(true);
        try {
            if (editingId) {
                await api.patch(`/payment-gateways/${editingId}`, {
                    ...(form.name !== gateways?.find(g => g.id === editingId)?.name ? { name: form.name } : {}),
                    instructions: form.instructions,
                    ...(form.walletGuideImageUrl ? { walletGuideImageUrl: form.walletGuideImageUrl } : {}),
                    isActive: form.isActive,
                });
                toast.success(t('admin.gateway_updated'));
            } else {
                await api.post('/payment-gateways', form);
                toast.success(t('admin.gateway_created'));
            }
            setShowForm(false);
            setEditingId(null);
            setForm(EMPTY_FORM);
            refetch();
        } catch (err) {
            toast.error(getErrorMessage(err) || (editingId ? t('admin.gateway_update_fail') : t('admin.gateway_create_fail')));
        }
        setSaving(false);
    };

    const handleDelete = async (g: Gateway) => {
        if (!window.confirm(t('admin.delete_gateway_confirm'))) return;
        setProcessingId(g.id);
        try {
            await api.delete(`/payment-gateways/${g.id}`);
            toast.success(t('admin.gateway_deleted'));
            refetch();
        } catch (err) {
            toast.error(getErrorMessage(err) || t('admin.gateway_delete_fail'));
        }
        setProcessingId(null);
    };

    const handleToggleActive = async (g: Gateway) => {
        setProcessingId(g.id);
        try {
            await api.patch(`/payment-gateways/${g.id}`, { isActive: !g.isActive });
            toast.success(t('admin.gateway_updated'));
            refetch();
        } catch (err) {
            toast.error(getErrorMessage(err) || t('admin.gateway_update_fail'));
        }
        setProcessingId(null);
    };

    const activeCount = (gateways || []).filter(g => g.isActive).length;
    const isActiveTone = (b: boolean): Tone => (b ? 'green' : 'gray');

    return (
        <div className="space-y-6 animate-fade-in">
            <PageHeader
                title={t('admin.gateways_heading')}
                subtitle={t('admin.gateways_subtitle')}
                actions={
                    <button onClick={openCreate} className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 text-black px-4 py-2.5 rounded-xl font-bold hover:from-amber-600 hover:to-amber-700 transition-all duration-200 shadow-md shadow-amber-500/15 hover:-translate-y-0.5 cursor-pointer">
                        <PlusCircle size={18} /> {t('admin.add_gateway')}
                    </button>
                }
            />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 max-w-xl animate-fade-in-up">
                {[
                    { value: (gateways || []).length, label: t('admin.stat_gateways'), color: 'text-white' },
                    { value: activeCount, label: t('admin.active_tag'), color: 'text-emerald-400' },
                    { value: (gateways || []).length - activeCount, label: t('admin.inactive_tag'), color: 'text-gray-400' },
                ].map((s, i) => (
                    <div key={i} className="bg-[#111f3a] border border-white/5 rounded-2xl p-4">
                        <div className={`text-3xl font-black ${s.color}`}>{s.value}</div>
                        <div className="text-xs font-bold text-gray-400 mt-1">{s.label}</div>
                    </div>
                ))}
            </div>

            {error && <div className="p-4 bg-red-500/10 text-red-400 border border-red-500/20 rounded-xl">{error}</div>}

            {loading ? (
                <div className="h-40 flex items-center justify-center font-bold text-gray-400">{t('admin.loading_gateways')}</div>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 animate-fade-in-up">
                    {gateways?.map(g => (
                        <div key={g.id} className={`bg-[#111f3a] border border-white/5 rounded-2xl p-5 flex flex-col ${!g.isActive ? 'opacity-70' : ''}`}>
                            <div className="flex items-start justify-between gap-3 mb-3">
                                <div className="flex items-center gap-3">
                                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${g.isActive ? 'bg-teal-500/15 text-teal-400' : 'bg-white/5 text-gray-500'}`}>
                                        <CreditCard size={20} />
                                    </div>
                                    <h4 className="font-black text-white">{g.name}</h4>
                                </div>
                                <Badge tone={isActiveTone(g.isActive)} dot>
                                    {g.isActive ? t('admin.active_tag') : t('admin.inactive_tag')}
                                </Badge>
                            </div>
                            <p className="text-sm text-gray-300 whitespace-pre-wrap mb-4 flex-1 leading-relaxed">{g.instructions}</p>
                            {fileUrl(g.walletGuideImageUrl) && (
                                <a href={fileUrl(g.walletGuideImageUrl)!} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-amber-400 font-bold text-sm hover:underline mb-4 w-fit">
                                    <ImageIcon size={16} /> {t('admin.view_image')} <ExternalLink size={14} />
                                </a>
                            )}
                            <div className="flex items-center justify-between pt-4 border-t border-white/5">
                                <button onClick={() => handleToggleActive(g)} disabled={processingId === g.id} className={`text-xs font-bold px-3 py-1.5 rounded-lg transition disabled:opacity-40 cursor-pointer ${g.isActive ? 'bg-white/5 text-gray-400 hover:bg-white/10' : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 ring-1 ring-emerald-500/30'}`}>
                                    {g.isActive ? t('admin.deactivate') : t('admin.activate')}
                                </button>
                                <div className="flex gap-1.5">
                                    <button onClick={() => openEdit(g)} disabled={processingId === g.id} className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-white/5 text-gray-400 hover:bg-white/10 disabled:opacity-40 transition cursor-pointer tooltip" title={t('admin.edit_gateway')}>
                                        <Pencil size={16} />
                                    </button>
                                    <button onClick={() => handleDelete(g)} disabled={processingId === g.id} className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 disabled:opacity-40 transition cursor-pointer tooltip" title={t('admin.delete_user_title')}>
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                    {gateways?.length === 0 && (
                        <div className="col-span-full bg-[#111f3a] border border-white/5 rounded-2xl p-4">
                            <EmptyPanel icon={Wallet} title={t('admin.no_gateways')} color="teal" />
                        </div>
                    )}
                </div>
            )}

            {showForm && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in" onClick={() => { setShowForm(false); setEditingId(null); }}>
                    <div className="bg-[#0d1f3c] border border-white/10 rounded-3xl shadow-2xl max-w-lg w-full p-7 animate-scale-in" onClick={e => e.stopPropagation()}>
                        <h4 className="text-xl font-black text-white mb-5">{editingId ? t('admin.edit_gateway') : t('admin.new_gateway')}</h4>
                        <div className="space-y-4">
                            <input
                                type="text"
                                placeholder={t('admin.gateway_name_placeholder')}
                                className="w-full p-3 border border-white/10 bg-[#0a1830] rounded-xl focus:ring-2 focus:ring-amber-500 outline-none transition text-white placeholder:text-gray-500"
                                value={form.name}
                                onChange={e => setForm({ ...form, name: e.target.value })}
                            />
                            <textarea
                                placeholder={t('admin.gateway_instructions_placeholder')}
                                className="w-full p-3 border border-white/10 bg-[#0a1830] rounded-xl focus:ring-2 focus:ring-amber-500 outline-none transition text-white placeholder:text-gray-500"
                                rows={4}
                                value={form.instructions}
                                onChange={e => setForm({ ...form, instructions: e.target.value })}
                            />
                            <input
                                type="text"
                                placeholder={t('admin.gateway_image_url_ph')}
                                className="w-full p-3 border border-white/10 bg-[#0a1830] rounded-xl focus:ring-2 focus:ring-amber-500 outline-none transition text-white placeholder:text-gray-500"
                                value={form.walletGuideImageUrl}
                                onChange={e => setForm({ ...form, walletGuideImageUrl: e.target.value })}
                            />
                            <label className="flex items-center gap-2 font-bold cursor-pointer text-sm text-gray-300">
                                <input type="checkbox" checked={form.isActive} onChange={e => setForm({ ...form, isActive: e.target.checked })} className="w-4 h-4 accent-amber-500" />
                                {t('admin.active_gateway')}
                            </label>
                        </div>
                        <div className="flex justify-end gap-3 mt-6">
                            <BtnSoft onClick={() => { setShowForm(false); setEditingId(null); }}>{t('common.cancel')}</BtnSoft>
                            <button onClick={handleSave} disabled={saving} className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 text-black px-5 py-2.5 rounded-xl font-bold hover:from-amber-600 hover:to-amber-700 transition disabled:opacity-50 cursor-pointer">
                                {saving ? t('common.saving') : t('admin.save_gateway')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
