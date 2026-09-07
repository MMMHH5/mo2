"use client";

import { useFetchData } from '@/lib/useFetchData';
import { api, getErrorMessage } from '@/lib/api';
import { useI18n } from '@/lib/i18n-context';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { Pencil, Trash2, ArrowRightLeft, Pause, Play, Search, UserPlus, Users, Download } from 'lucide-react';
import { PageHeader, Badge, EmptyState, BtnPrimary, BtnSoft, type Tone } from '../components';

interface User {
    id: string;
    email: string;
    role: string;
    isActive: boolean;
    createdAt: string;
}

interface Course {
    id: string;
    titleAr?: string | null;
    titleEn?: string | null;
    openings?: { id: string; nameAr?: string | null; nameEn?: string | null; price: string; isPublished: boolean }[];
}

const ROLES = ['STUDENT', 'INSTRUCTOR', 'COURSE_MANAGER', 'FINANCE', 'ADMIN'];

const roleTone: Record<string, Tone> = {
    ADMIN: 'red',
    FINANCE: 'green',
    INSTRUCTOR: 'purple',
    COURSE_MANAGER: 'amber',
    STUDENT: 'blue',
};

export default function AdminUsersPage() {
    const { data: users, loading, error, refetch } = useFetchData<User[]>('/users');
    const { data: courses } = useFetchData<Course[]>('/courses?includeUnpublished=true');
    const { t, locale } = useI18n();
    const [query, setQuery] = useState('');
    const [roleFilter, setRoleFilter] = useState('ALL');
    const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'SUSPENDED'>('ALL');
    const [processingId, setProcessingId] = useState<string | null>(null);

    // Create modal
    const [showCreate, setShowCreate] = useState(false);
    const [createForm, setCreateForm] = useState({ email: '', password: '', role: 'STUDENT', isActive: true });
    const [creating, setCreating] = useState(false);

    // Edit modal
    const [editUser, setEditUser] = useState<User | null>(null);
    const [editForm, setEditForm] = useState({ email: '', password: '', role: '' });
    const [savingEdit, setSavingEdit] = useState(false);

    // Transfer modal
    const [transferId, setTransferId] = useState<string | null>(null);
    const [transferCourseId, setTransferCourseId] = useState('');
    const [transferOpeningId, setTransferOpeningId] = useState('');
    const [transferring, setTransferring] = useState(false);

    const roleLabel = (role: string) => t('roles.' + (role || '').toLowerCase()) || role;

    const filtered = (users || []).filter(u => {
        if (roleFilter !== 'ALL' && u.role !== roleFilter) return false;
        if (statusFilter === 'ACTIVE' && u.isActive === false) return false;
        if (statusFilter === 'SUSPENDED' && u.isActive !== false) return false;
        if (!query.trim()) return true;
        return u.email.toLowerCase().includes(query.toLowerCase());
    });

    const counts = (users || []).reduce((acc, u) => {
        acc[u.role] = (acc[u.role] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    const exportCsv = () => {
        if (!filtered.length) return;
        const esc = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
        const headers = [t('admin.col_email'), t('admin.col_role'), t('admin.col_status'), t('admin.col_joined')];
        const rows = filtered.map(u => [
            u.email,
            roleLabel(u.role),
            u.isActive === false ? t('admin.status_suspended') : t('admin.status_active'),
            new Date(u.createdAt).toLocaleDateString(locale === 'ar' ? 'ar' : 'en'),
        ]);
        const csv = '\uFEFF' + [headers, ...rows].map(r => r.map(esc).join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `users-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success(t('admin.export_csv_success'));
    };

    const handleCreate = async () => {
        if (!createForm.email || createForm.password.length < 6) {
            toast.error(t('admin.create_user_validation'));
            return;
        }
        setCreating(true);
        try {
            const res = await api.post('/users', createForm);
            toast.success(`${t('admin.user_created')} (${res.data.email})`);
            setShowCreate(false);
            setCreateForm({ email: '', password: '', role: 'STUDENT', isActive: true });
            refetch();
        } catch (err) {
            toast.error(getErrorMessage(err) || t('admin.user_create_fail'));
        }
        setCreating(false);
    };

    const openEdit = (u: User) => {
        setEditUser(u);
        setEditForm({ email: u.email, password: '', role: u.role });
    };

    const handleSaveEdit = async () => {
        if (!editUser) return;
        if (!editForm.email || (editForm.password && editForm.password.length < 6)) {
            toast.error(t('admin.create_user_validation'));
            return;
        }
        setSavingEdit(true);
        try {
            await api.patch(`/users/${editUser.id}`, {
                ...(editForm.email !== editUser.email ? { email: editForm.email } : {}),
                ...(editForm.password ? { password: editForm.password } : {}),
                role: editForm.role,
            });
            toast.success(t('admin.user_updated'));
            setEditUser(null);
            refetch();
        } catch (err) {
            toast.error(getErrorMessage(err) || t('admin.user_update_fail'));
        }
        setSavingEdit(false);
    };

    const handleToggleActive = async (u: User) => {
        if (!window.confirm(u.isActive ? t('admin.suspend_confirm') : t('admin.activate_confirm'))) return;
        setProcessingId(u.id);
        try {
            await api.patch(`/users/${u.id}`, { isActive: !u.isActive });
            toast.success(u.isActive ? t('admin.user_suspended') : t('admin.user_activated'));
            refetch();
        } catch (err) {
            toast.error(getErrorMessage(err) || t('admin.toggle_status_fail'));
        }
        setProcessingId(null);
    };

    const handleDelete = async (u: User) => {
        if (!window.confirm(t('admin.delete_user_confirm'))) return;
        setProcessingId(u.id);
        try {
            await api.delete(`/users/${u.id}`);
            toast.success(t('admin.user_deleted'));
            refetch();
        } catch (err) {
            toast.error(getErrorMessage(err) || t('admin.delete_user_fail'));
        }
        setProcessingId(null);
    };

    const openTransfer = (userId: string) => {
        setTransferId(userId);
        setTransferCourseId('');
        setTransferOpeningId('');
    };

    const handleTransfer = async () => {
        if (!transferId || !transferCourseId) {
            toast.error(t('admin.select_course_required'));
            return;
        }
        setTransferring(true);
        try {
            await api.post('/enrollments/admin', {
                courseId: transferCourseId,
                studentId: transferId,
                ...(transferOpeningId ? { openingId: transferOpeningId } : {}),
            });
            toast.success(t('admin.transfer_success'));
            setTransferId(null);
            setTransferCourseId('');
            setTransferOpeningId('');
        } catch (err) {
            toast.error(getErrorMessage(err) || t('admin.transfer_fail'));
        }
        setTransferring(false);
    };

    const transferUser = (users || []).find(u => u.id === transferId);

    return (
        <div className="space-y-6 animate-fade-in">
            <PageHeader
                title={t('admin.users_heading')}
                subtitle={t('admin.users_subtitle')}
                actions={
                    <div className="flex items-center gap-2">
                        <BtnSoft icon={Download} onClick={exportCsv} disabled={!filtered.length}>
                            {t('admin.export_csv_btn')}
                        </BtnSoft>
                        <BtnPrimary icon={UserPlus} onClick={() => setShowCreate(!showCreate)}>
                            {showCreate ? t('common.cancel') : t('admin.add_user')}
                        </BtnPrimary>
                    </div>
                }
            />

            {/* Role stats */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 animate-fade-in-up">
                {ROLES.map(r => (
                    <div key={r} className="admin-card p-4 flex items-center justify-between">
                        <Badge tone={roleTone[r]} dot={false}>{roleLabel(r)}</Badge>
                        <span className="admin-stat-value text-white">{counts[r] || 0}</span>
                    </div>
                ))}
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3">
                <div className="relative">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                    <input
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        placeholder={t('admin.search_users')}
                        className="ps-9 pe-3 py-2.5 border border-white/10 rounded-xl text-sm w-64 bg-[#0a1830] text-white placeholder:text-gray-500 focus:ring-2 focus:ring-amber-500 outline-none transition"
                    />
                </div>
                <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} className="px-3.5 py-2.5 border border-white/10 rounded-xl text-sm bg-[#0a1830] text-white cursor-pointer focus:outline-none">
                    <option value="ALL">{t('admin.filter_all')}</option>
                    {ROLES.map(r => <option key={r} value={r}>{roleLabel(r)}</option>)}
                </select>
                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as typeof statusFilter)} className="px-3.5 py-2.5 border border-white/10 rounded-xl text-sm bg-[#0a1830] text-white cursor-pointer focus:outline-none">
                    <option value="ALL">{t('admin.filter_all')}</option>
                    <option value="ACTIVE">{t('admin.status_active')}</option>
                    <option value="SUSPENDED">{t('admin.status_suspended')}</option>
                </select>
            </div>

            {/* Create form */}
            {showCreate && (
                <div className="admin-card p-6 animate-scale-in bg-[#111f3a]">
                    <h4 className="font-black text-lg mb-4 text-white">{t('admin.new_user')}</h4>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 max-w-5xl">
                        <input type="email" placeholder={t('admin.user_email_ph')} className="p-3 border border-white/10 rounded-xl bg-[#0a1830] text-white placeholder:text-gray-500 focus:ring-2 focus:ring-amber-500 outline-none" value={createForm.email} onChange={e => setCreateForm({ ...createForm, email: e.target.value })} />
                        <input type="password" placeholder={t('admin.user_password_ph')} className="p-3 border border-white/10 rounded-xl bg-[#0a1830] text-white placeholder:text-gray-500 focus:ring-2 focus:ring-amber-500 outline-none" value={createForm.password} onChange={e => setCreateForm({ ...createForm, password: e.target.value })} />
                        <select className="p-3 border border-white/10 rounded-xl bg-[#0a1830] text-white cursor-pointer focus:outline-none" value={createForm.role} onChange={e => setCreateForm({ ...createForm, role: e.target.value })}>
                            {ROLES.map(r => <option key={r} value={r}>{roleLabel(r)}</option>)}
                        </select>
                        <div className="flex items-center gap-2 py-3">
                            <input type="checkbox" id="newUserActive" checked={createForm.isActive} onChange={e => setCreateForm({ ...createForm, isActive: e.target.checked })} className="w-4 h-4 accent-amber-500" />
                            <label htmlFor="newUserActive" className="font-bold cursor-pointer text-sm text-gray-300">{t('admin.account_active')}</label>
                        </div>
                    </div>
                    <button onClick={handleCreate} disabled={creating} className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 text-black font-black py-3 px-6 rounded-xl mt-3 hover:opacity-90 transition disabled:opacity-50 cursor-pointer">
                        {creating ? t('admin.creating_user') : t('admin.create_account_btn')}
                    </button>
                </div>
            )}

            {error && <div className="p-4 bg-red-500/10 text-red-400 border border-red-500/20 rounded-xl">{error}</div>}

            {/* Users table */}
            {loading ? (
                <div className="h-40 flex items-center justify-center font-bold text-gray-400">{t('admin.loading_users')}</div>
            ) : (
                <div className="admin-table-wrap animate-fade-in-up">
                    <table className="admin-table text-left">
                        <thead>
                            <tr>
                                <th>{t('admin.col_email')}</th>
                                <th>{t('admin.col_role')}</th>
                                <th>{t('admin.col_status')}</th>
                                <th>{t('admin.col_joined')}</th>
                                <th className="text-right">{t('admin.col_admin_actions')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {filtered.map(u => (
                                <tr key={u.id} className={`animate-fade-in hover:bg-white/5 ${u.isActive === false ? 'opacity-60' : ''}`}>
                                    <td className="p-4 font-bold text-gray-200">{u.email}</td>
                                    <td className="p-4">
                                        <Badge tone={roleTone[u.role]} dot={false}>{roleLabel(u.role)}</Badge>
                                    </td>
                                    <td className="p-4">
                                        <Badge tone={u.isActive === false ? 'red' : 'green'} dot>
                                            {u.isActive === false ? t('admin.status_suspended') : t('admin.status_active')}
                                        </Badge>
                                    </td>
                                    <td className="p-4 text-sm text-gray-400">{new Date(u.createdAt).toLocaleDateString()}</td>
                                    <td className="p-4 text-right whitespace-nowrap">
                                        <button onClick={() => openEdit(u)} disabled={processingId === u.id} className="admin-action-btn bg-white/5 text-gray-300 hover:bg-white/10 tooltip disabled:opacity-40" title={t('admin.edit_user')}>
                                            <Pencil size={18} />
                                        </button>
                                        <button onClick={() => openTransfer(u.id)} disabled={processingId === u.id} className="admin-action-btn bg-blue-500/10 text-blue-400 hover:bg-blue-500 hover:text-white tooltip disabled:opacity-40 ms-1" title={t('admin.transfer_title')}>
                                            <ArrowRightLeft size={18} />
                                        </button>
                                        <button onClick={() => handleToggleActive(u)} disabled={processingId === u.id} className={`admin-action-btn ms-1 tooltip disabled:opacity-40 ${u.isActive === false ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-white' : 'bg-amber-500/10 text-amber-400 hover:bg-amber-500 hover:text-white'}`} title={u.isActive === false ? t('admin.activate_title') : t('admin.suspend_title')}>
                                            {u.isActive === false ? <Play size={18} /> : <Pause size={18} />}
                                        </button>
                                        <button onClick={() => handleDelete(u)} disabled={processingId === u.id || u.role === 'ADMIN'} className="admin-action-btn bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white tooltip disabled:opacity-40 ms-1" title={u.role === 'ADMIN' ? t('admin.cannot_delete_admin_title') : t('admin.delete_user_title')}>
                                            <Trash2 size={18} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {filtered.length === 0 && (
                                <EmptyState icon={Users} title={t('admin.no_users')} />
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Edit modal */}
            {editUser && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in" onClick={() => setEditUser(null)}>
                    <div className="bg-[#0d1f3c] border border-white/10 rounded-3xl shadow-2xl max-w-md w-full p-7 animate-scale-in" onClick={e => e.stopPropagation()}>
                        <h4 className="text-xl font-black text-white mb-5">{t('admin.edit_user_title')}</h4>
                        <div className="space-y-4">
                            <input type="email" placeholder={t('admin.user_email_ph')} className="w-full p-3 border border-white/10 rounded-xl bg-[#0a1830] text-white placeholder:text-gray-500 focus:ring-2 focus:ring-amber-500 outline-none" value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })} />
                            <input type="password" placeholder={t('admin.new_password_ph')} className="w-full p-3 border border-white/10 rounded-xl bg-[#0a1830] text-white placeholder:text-gray-500 focus:ring-2 focus:ring-amber-500 outline-none" value={editForm.password} onChange={e => setEditForm({ ...editForm, password: e.target.value })} />
                            <select className="w-full p-3 border border-white/10 rounded-xl bg-[#0a1830] text-white cursor-pointer focus:outline-none" value={editForm.role} onChange={e => setEditForm({ ...editForm, role: e.target.value })}>
                                {ROLES.map(r => <option key={r} value={r}>{roleLabel(r)}</option>)}
                            </select>
                        </div>
                        <div className="flex justify-end gap-3 mt-6">
                            <BtnSoft onClick={() => setEditUser(null)}>{t('common.cancel')}</BtnSoft>
                            <button onClick={handleSaveEdit} disabled={savingEdit} className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 text-black px-5 py-2.5 rounded-xl font-bold hover:opacity-90 transition disabled:opacity-50 cursor-pointer">
                                {savingEdit ? t('common.saving') : t('common.save')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Transfer modal */}
            {transferId && transferUser && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in" onClick={() => setTransferId(null)}>
                    <div className="bg-[#0d1f3c] border border-white/10 rounded-3xl shadow-2xl max-w-lg w-full p-7 animate-scale-in" onClick={e => e.stopPropagation()}>
                        <h4 className="text-xl font-black text-white mb-1">{t('admin.transfer_user_title')}</h4>
                        <p className="text-gray-400 text-sm mb-5">
                            {t('admin.transfer_user_desc')} <span className="font-bold text-white">{transferUser.email}</span>
                        </p>
                        <select className="w-full p-3 border border-white/10 rounded-xl bg-[#0a1830] text-white mb-4 cursor-pointer focus:outline-none" value={transferCourseId} onChange={e => { setTransferCourseId(e.target.value); setTransferOpeningId(''); }}>
                            <option value="">{t('admin.select_course')}</option>
                            {(courses || []).map(c => <option key={c.id} value={c.id}>{c.titleAr || c.titleEn || c.id}</option>)}
                        </select>
                        <select className="w-full p-3 border border-white/10 rounded-xl bg-[#0a1830] text-white cursor-pointer focus:outline-none" value={transferOpeningId} onChange={e => setTransferOpeningId(e.target.value)}>
                            <option value="">{t('admin.no_opening_option')}</option>
                            {(courses || []).find(c => c.id === transferCourseId)?.openings?.map(o => (
                                <option key={o.id} value={o.id}>
                                    {o.nameAr || o.nameEn || `#${o.id.slice(0, 4)}`} — ${o.price} {o.isPublished ? `(${t('admin.opening_published')})` : ''}
                                </option>
                            ))}
                        </select>
                        <div className="flex justify-end gap-3 mt-6">
                            <BtnSoft onClick={() => setTransferId(null)}>{t('common.cancel')}</BtnSoft>
                            <button onClick={handleTransfer} disabled={transferring} className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 text-black px-5 py-2.5 rounded-xl font-bold hover:opacity-90 transition disabled:opacity-50 cursor-pointer">
                                {transferring ? t('common.processing') : t('admin.transfer_submit')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
