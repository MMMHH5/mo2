"use client";

import { useFetchData } from '@/lib/useFetchData';
import { api, getErrorMessage } from '@/lib/api';
import { useI18n } from '@/lib/i18n-context';
import { formatDate } from '@/lib/format';
import { useAuth } from '@/lib/auth-context';
import Link from 'next/link';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { Pencil, Trash2, ArrowRightLeft, Pause, Play, Search, UserPlus, Users, Download, Info, BookOpen, Award, Mail, Phone, MapPin, GraduationCap, Calendar, ShieldCheck, ShieldOff, BadgeCheck, FileText, ClipboardList, X, Cake, School } from 'lucide-react';
import { PageHeader, Badge, EmptyState, BtnPrimary, BtnSoft, type Tone } from '../components';

interface User {
    id: string;
    email: string;
    role: string;
    isActive: boolean;
    twoFactorEnabled: boolean;
    createdAt: string;
    metadata?: Record<string, unknown> | null;
}

interface Course {
    id: string;
    titleAr?: string | null;
    titleEn?: string | null;
    openings?: { id: string; nameAr?: string | null; nameEn?: string | null; price: string; isPublished: boolean }[];
}

interface UserDetailsResponse {
    user: User & { metadata?: Record<string, unknown> | null; language: string; emailVerifiedAt: string | null; updatedAt: string };
    enrollments: {
        id: string;
        status: string;
        createdAt: string;
        course: { id: string; titleAr?: string | null; titleEn?: string | null };
        opening?: { id: string; nameAr?: string | null; nameEn?: string | null; startDate?: string | null; endDate?: string | null } | null;
    }[];
    certificates: {
        id: string;
        verificationCode: string;
        issuingDate: string;
        verificationStatus: string;
        courseId: string;
    }[];
    coursesTaught: { id: string; titleAr: string; titleEn: string; createdAt: string }[];
    openingsTaught: { id: string; nameAr: string; nameEn: string; status: string; startDate: string | null; endDate: string | null }[];
}

const ROLES = ['STUDENT', 'INSTRUCTOR', 'COURSE_MANAGER', 'FINANCE', 'ADMIN'];

const roleTone: Record<string, Tone> = {
    ADMIN: 'red',
    FINANCE: 'green',
    INSTRUCTOR: 'purple',
    COURSE_MANAGER: 'amber',
    STUDENT: 'blue',
};

type UserView = 'all' | 'students' | 'instructors' | 'staff';

const VIEW_ROLES: Record<UserView, string[]> = {
    all: ROLES,
    students: ['STUDENT'],
    instructors: ['INSTRUCTOR'],
    staff: ['ADMIN', 'COURSE_MANAGER', 'FINANCE'],
};

const VIEW_TITLES: Record<UserView, string> = {
    all: 'users_heading',
    students: 'students_heading',
    instructors: 'instructors_accounts_heading',
    staff: 'staff_users_heading',
};

const VIEW_SUBTITLES: Record<UserView, string> = {
    all: 'users_subtitle',
    students: 'students_subtitle',
    instructors: 'instructors_accounts_subtitle',
    staff: 'staff_users_subtitle',
};

export default function UsersManager({ view = 'all' }: { view?: UserView }) {
    const visibleRoles = VIEW_ROLES[view];
    const defaultCreateRole = view === 'students' ? 'STUDENT' : view === 'instructors' ? 'INSTRUCTOR' : view === 'staff' ? 'COURSE_MANAGER' : 'STUDENT';
    const { data: users, loading, error, refetch } = useFetchData<User[]>('/users');
    const { data: courses } = useFetchData<Course[]>('/courses?includeUnpublished=true');
    const { t, locale } = useI18n();
    const { user: currentUser } = useAuth();
    const [query, setQuery] = useState('');
    const [roleFilter, setRoleFilter] = useState('ALL');
    const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'SUSPENDED'>('ALL');
    const [processingId, setProcessingId] = useState<string | null>(null);

    // Create modal
    const [showCreate, setShowCreate] = useState(false);
    const [createForm, setCreateForm] = useState({
        email: '',
        password: '',
        role: defaultCreateRole,
        isActive: true,
        fullName: '',
        phone: '',
        city: '',
        specialty: '',
        bio: '',
        university: '',
        studyStatus: '',
        studyLevel: '',
        jobTitleAr: '',
        jobTitleEn: '',
        experienceYears: '',
    });
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

    // Details modal
    const [details, setDetails] = useState<UserDetailsResponse | null>(null);
    const [detailsLoading, setDetailsLoading] = useState(false);

    const roleLabel = (role: string) => t('roles.' + (role || '').toLowerCase()) || role;

    const filtered = (users || []).filter(u => {
        if (!visibleRoles.includes(u.role)) return false;
        if (roleFilter !== 'ALL' && u.role !== roleFilter) return false;
        if (statusFilter === 'ACTIVE' && u.isActive === false) return false;
        if (statusFilter === 'SUSPENDED' && u.isActive !== false) return false;
        if (!query.trim()) return true;
        const search = query.toLowerCase();
        const metadata = u.metadata ?? {};
        return u.email.toLowerCase().includes(search)
            || String(metadata.fullName ?? '').toLowerCase().includes(search)
            || String(metadata.phone ?? '').toLowerCase().includes(search)
            || String(metadata.specialty ?? '').toLowerCase().includes(search);
    });

    const counts = (users || []).reduce((acc, u) => {
        acc[u.role] = (acc[u.role] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    const exportCsv = () => {
        if (!filtered.length) return;
        const esc = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
        const headers = [t('admin.profile_name'), t('admin.col_email'), t('admin.col_role'), t('admin.col_status'), t('admin.col_joined')];
        const rows = filtered.map(u => [
            String(u.metadata?.fullName ?? ''),
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
            const {
                fullName, phone, city, specialty, bio, university, studyStatus, studyLevel,
                jobTitleAr, jobTitleEn, experienceYears, ...account
            } = createForm;
            const metadata = Object.fromEntries(
                Object.entries({
                    fullName, phone, city, specialty, bio, university, studyStatus, studyLevel,
                    jobTitleAr, jobTitleEn, experienceYears,
                }).filter(([, value]) => value !== ''),
            );
            const res = await api.post('/users', { ...account, metadata });
            toast.success(`${t('admin.user_created')} (${res.data.email})`);
            setShowCreate(false);
            setCreateForm({
                email: '',
                password: '',
                role: defaultCreateRole,
                isActive: true,
                fullName: '',
                phone: '',
                city: '',
                specialty: '',
                bio: '',
                university: '',
                studyStatus: '',
                studyLevel: '',
                jobTitleAr: '',
                jobTitleEn: '',
                experienceYears: '',
            });
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

    const handleDisableTwoFactor = async (u: User) => {
        if (!u.twoFactorEnabled || currentUser?.role !== 'ADMIN') return;
        if (!window.confirm(t('admin.disable_two_factor_confirm'))) return;
        setProcessingId(u.id);
        try {
            await api.patch(`/users/${u.id}/two-factor/disable`);
            toast.success(t('admin.two_factor_disabled'));
            if (details?.user.id === u.id) {
                setDetails({
                    ...details,
                    user: { ...details.user, twoFactorEnabled: false },
                });
            }
            refetch();
        } catch (err) {
            toast.error(getErrorMessage(err) || t('admin.two_factor_disable_fail'));
        } finally {
            setProcessingId(null);
        }
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

    const openDetails = async (u: User) => {
        setDetailsLoading(true);
        setDetails(null);
        try {
            const res = await api.get(`/users/${u.id}/details`);
            setDetails(res.data);
        } catch (err) {
            toast.error(getErrorMessage(err) || t('common.error'));
        } finally {
            setDetailsLoading(false);
        }
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
                title={t(`admin.${VIEW_TITLES[view]}`)}
                subtitle={t(`admin.${VIEW_SUBTITLES[view]}`)}
                actions={
                    <div className="flex items-center gap-2">
                        <BtnSoft icon={Download} onClick={exportCsv} disabled={!filtered.length}>
                            {t('admin.export_csv_btn')}
                        </BtnSoft>
                        <BtnPrimary icon={UserPlus} onClick={() => setShowCreate(!showCreate)}>
                            {showCreate
                                ? t('common.cancel')
                                : t(`admin.${view === 'students' ? 'create_student' : view === 'instructors' ? 'create_instructor' : view === 'staff' ? 'create_staff_user' : 'add_user'}`)}
                        </BtnPrimary>
                    </div>
                }
            />

            <nav aria-label={t('admin.nav_users')} className="flex gap-2 overflow-x-auto pb-1">
                {([
                    { id: 'all', href: '/dashboard/admin/users', label: t('admin.nav_users') },
                    { id: 'students', href: '/dashboard/admin/users/students', label: t('admin.nav_students') },
                    { id: 'instructors', href: '/dashboard/admin/users/instructors', label: t('admin.nav_instructors_users') },
                    { id: 'staff', href: '/dashboard/admin/users/staff', label: t('admin.nav_staff_users') },
                ] as const).map((item) => (
                    <Link
                        key={item.id}
                        href={item.href}
                        aria-current={view === item.id ? 'page' : undefined}
                        className={`shrink-0 rounded-xl px-4 py-2.5 text-sm font-bold transition ${
                            view === item.id
                                ? 'bg-brand-navy text-white dark:bg-brand-gold dark:text-brand-navy'
                                : 'border border-gray-200 bg-white text-gray-600 hover:border-brand-gold dark:border-white/10 dark:bg-brand-navy-dark dark:text-gray-300'
                        }`}
                    >
                        {item.label}
                    </Link>
                ))}
            </nav>

            {/* Role stats */}
            <div className={`grid grid-cols-1 sm:grid-cols-2 ${visibleRoles.length > 2 ? 'md:grid-cols-5' : 'md:grid-cols-2'} gap-3 animate-fade-in-up`}>
                {visibleRoles.map(r => (
                    <div key={r} className="admin-card p-4 flex items-center justify-between">
                        <Badge tone={roleTone[r]} dot={false}>{roleLabel(r)}</Badge>
                        <span className="admin-stat-value text-brand-navy dark:text-white">{counts[r] || 0}</span>
                    </div>
                ))}
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3">
                <div className="relative">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400" />
                    <input
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        placeholder={t('admin.search_users')}
                        className="ps-9 pe-3 py-2.5 border border-gray-300 dark:border-white/10 rounded-xl text-sm w-64 bg-white dark:bg-brand-navy-dark text-brand-navy dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:ring-2 focus:ring-brand-gold outline-none transition"
                    />
                </div>
                <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} className="px-3.5 py-2.5 border border-gray-300 dark:border-white/10 rounded-xl text-sm bg-white dark:bg-brand-navy-dark text-brand-navy dark:text-white cursor-pointer focus:outline-none">
                    <option value="ALL">{t('admin.filter_all')}</option>
                    {visibleRoles.map(r => <option key={r} value={r}>{roleLabel(r)}</option>)}
                </select>
                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as typeof statusFilter)} className="px-3.5 py-2.5 border border-gray-300 dark:border-white/10 rounded-xl text-sm bg-white dark:bg-brand-navy-dark text-brand-navy dark:text-white cursor-pointer focus:outline-none">
                    <option value="ALL">{t('admin.filter_all')}</option>
                    <option value="ACTIVE">{t('admin.status_active')}</option>
                    <option value="SUSPENDED">{t('admin.status_suspended')}</option>
                </select>
            </div>

            {/* Create form */}
            {showCreate && (
                <div className="admin-card p-6 animate-scale-in bg-white dark:bg-brand-navy-dark">
                    <h4 className="font-black text-lg mb-1 text-brand-navy dark:text-white">
                        {t(`admin.${view === 'students' ? 'create_student' : view === 'instructors' ? 'create_instructor' : view === 'staff' ? 'create_staff_user' : 'new_user'}`)}
                    </h4>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">{t('admin.create_user_profile_hint')}</p>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 max-w-5xl">
                        <input type="text" maxLength={120} aria-label={t('admin.profile_name')} placeholder={t('admin.profile_name')} className="p-3 border border-gray-300 dark:border-white/10 rounded-xl bg-white dark:bg-brand-navy-dark text-brand-navy dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:ring-2 focus:ring-brand-gold outline-none" value={createForm.fullName} onChange={e => setCreateForm({ ...createForm, fullName: e.target.value })} />
                        <input type="email" autoComplete="email" placeholder={t('admin.user_email_ph')} className="p-3 border border-gray-300 dark:border-white/10 rounded-xl bg-white dark:bg-brand-navy-dark text-brand-navy dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:ring-2 focus:ring-brand-gold outline-none" value={createForm.email} onChange={e => setCreateForm({ ...createForm, email: e.target.value })} />
                        <input type="tel" maxLength={32} aria-label={t('admin.profile_phone')} placeholder={t('admin.profile_phone')} className="p-3 border border-gray-300 dark:border-white/10 rounded-xl bg-white dark:bg-brand-navy-dark text-brand-navy dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:ring-2 focus:ring-brand-gold outline-none" value={createForm.phone} onChange={e => setCreateForm({ ...createForm, phone: e.target.value })} />
                        <input type="text" maxLength={80} aria-label={t('admin.profile_city')} placeholder={t('admin.profile_city')} className="p-3 border border-gray-300 dark:border-white/10 rounded-xl bg-white dark:bg-brand-navy-dark text-brand-navy dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:ring-2 focus:ring-brand-gold outline-none" value={createForm.city} onChange={e => setCreateForm({ ...createForm, city: e.target.value })} />
                        <input type="password" autoComplete="new-password" placeholder={t('admin.user_password_ph')} className="p-3 border border-gray-300 dark:border-white/10 rounded-xl bg-white dark:bg-brand-navy-dark text-brand-navy dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:ring-2 focus:ring-brand-gold outline-none" value={createForm.password} onChange={e => setCreateForm({ ...createForm, password: e.target.value })} />
                        {(view === 'all' || view === 'staff') && (
                            <select aria-label={t('admin.col_role')} className="p-3 border border-gray-300 dark:border-white/10 rounded-xl bg-white dark:bg-brand-navy-dark text-brand-navy dark:text-white cursor-pointer focus:outline-none" value={createForm.role} onChange={e => setCreateForm({ ...createForm, role: e.target.value })}>
                                {visibleRoles.map(r => <option key={r} value={r}>{roleLabel(r)}</option>)}
                            </select>
                        )}
                        {createForm.role === 'STUDENT' && (
                            <>
                                <input type="text" maxLength={120} aria-label={t('admin.profile_university')} placeholder={t('admin.profile_university')} className="p-3 border border-gray-300 dark:border-white/10 rounded-xl bg-white dark:bg-brand-navy-dark text-brand-navy dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:ring-2 focus:ring-brand-gold outline-none" value={createForm.university} onChange={e => setCreateForm({ ...createForm, university: e.target.value })} />
                                <input type="text" maxLength={20} aria-label={t('admin.profile_study_status')} placeholder={t('admin.profile_study_status')} className="p-3 border border-gray-300 dark:border-white/10 rounded-xl bg-white dark:bg-brand-navy-dark text-brand-navy dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:ring-2 focus:ring-brand-gold outline-none" value={createForm.studyStatus} onChange={e => setCreateForm({ ...createForm, studyStatus: e.target.value })} />
                                <input type="text" maxLength={80} aria-label={t('admin.profile_study_level')} placeholder={t('admin.profile_study_level')} className="p-3 border border-gray-300 dark:border-white/10 rounded-xl bg-white dark:bg-brand-navy-dark text-brand-navy dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:ring-2 focus:ring-brand-gold outline-none" value={createForm.studyLevel} onChange={e => setCreateForm({ ...createForm, studyLevel: e.target.value })} />
                            </>
                        )}
                        {createForm.role === 'INSTRUCTOR' && (
                            <>
                                <input type="text" maxLength={120} aria-label={t('admin.profile_specialty')} placeholder={t('admin.profile_specialty')} className="p-3 border border-gray-300 dark:border-white/10 rounded-xl bg-white dark:bg-brand-navy-dark text-brand-navy dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:ring-2 focus:ring-brand-gold outline-none" value={createForm.specialty} onChange={e => setCreateForm({ ...createForm, specialty: e.target.value })} />
                                <input type="text" maxLength={120} aria-label={t('admin.profile_job_title')} placeholder={t('admin.profile_job_title')} className="p-3 border border-gray-300 dark:border-white/10 rounded-xl bg-white dark:bg-brand-navy-dark text-brand-navy dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:ring-2 focus:ring-brand-gold outline-none" value={locale === 'ar' ? createForm.jobTitleAr : createForm.jobTitleEn} onChange={e => setCreateForm({ ...createForm, ...(locale === 'ar' ? { jobTitleAr: e.target.value } : { jobTitleEn: e.target.value }) })} />
                                <input type="number" min="0" max="80" aria-label={t('admin.profile_experience_years')} placeholder={t('admin.profile_experience_years')} className="p-3 border border-gray-300 dark:border-white/10 rounded-xl bg-white dark:bg-brand-navy-dark text-brand-navy dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:ring-2 focus:ring-brand-gold outline-none" value={createForm.experienceYears} onChange={e => setCreateForm({ ...createForm, experienceYears: e.target.value })} />
                                <textarea rows={3} maxLength={500} aria-label={t('admin.profile_bio')} placeholder={t('admin.profile_bio')} className="md:col-span-2 p-3 border border-gray-300 dark:border-white/10 rounded-xl bg-white dark:bg-brand-navy-dark text-brand-navy dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:ring-2 focus:ring-brand-gold outline-none" value={createForm.bio} onChange={e => setCreateForm({ ...createForm, bio: e.target.value })} />
                            </>
                        )}
                        <div className="flex items-center gap-2 py-3">
                            <input type="checkbox" id="newUserActive" checked={createForm.isActive} onChange={e => setCreateForm({ ...createForm, isActive: e.target.checked })} className="w-4 h-4 accent-brand-gold" />
                            <label htmlFor="newUserActive" className="font-bold cursor-pointer text-sm text-gray-600 dark:text-gray-300">{t('admin.account_active')}</label>
                        </div>
                    </div>
                    <button onClick={handleCreate} disabled={creating} className="inline-flex items-center gap-2 bg-gradient-to-r from-brand-gold to-brand-gold-dark text-black font-black py-3 px-6 rounded-xl mt-3 hover:opacity-90 transition disabled:opacity-50 cursor-pointer">
                        {creating ? t('admin.creating_user') : t('admin.create_account_btn')}
                    </button>
                </div>
            )}

            {error && <div className="p-4 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/20 rounded-xl">{error}</div>}

            {/* Users table */}
            {loading ? (
                <div className="h-40 flex items-center justify-center font-bold text-gray-500 dark:text-gray-400">{t('admin.loading_users')}</div>
            ) : (
                <div className="admin-table-wrap animate-fade-in-up">
                    <table className="admin-table text-left">
                        <thead>
                            <tr>
                                <th>{t('admin.profile_name')}</th>
                                <th>{t('admin.col_email')}</th>
                                <th>{t('admin.col_role')}</th>
                                <th>{t('admin.col_status')}</th>
                                <th>{t('admin.two_factor_status')}</th>
                                <th>{t('admin.col_joined')}</th>
                                <th className="text-right">{t('admin.col_admin_actions')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-white/5">
                            {filtered.map(u => (
                                <tr key={u.id} className={`animate-fade-in hover:bg-gray-100 dark:hover:bg-white/5 ${u.isActive === false ? 'opacity-60' : ''}`}>
                                    <td className="p-4 font-bold text-brand-navy dark:text-gray-200">
                                        <Link href={`/dashboard/admin/users/${u.id}`} className="hover:text-brand-gold-dark dark:hover:text-brand-gold-light">
                                            {String(u.metadata?.fullName ?? u.metadata?.nameAr ?? u.metadata?.nameEn ?? '—')}
                                        </Link>
                                    </td>
                                    <td className="p-4 font-bold text-brand-navy dark:text-gray-200">{u.email}</td>
                                    <td className="p-4">
                                        <Badge tone={roleTone[u.role]} dot={false}>{roleLabel(u.role)}</Badge>
                                    </td>
                                    <td className="p-4">
                                        <Badge tone={u.isActive === false ? 'red' : 'green'} dot>
                                            {u.isActive === false ? t('admin.status_suspended') : t('admin.status_active')}
                                        </Badge>
                                    </td>
                                    <td className="p-4">
                                        <Badge tone={u.twoFactorEnabled ? 'green' : 'gray'} dot>
                                            {u.twoFactorEnabled ? t('admin.two_factor_enabled') : t('admin.two_factor_disabled_label')}
                                        </Badge>
                                    </td>
                                    <td className="p-4 text-sm text-gray-500 dark:text-gray-400">{new Date(u.createdAt).toLocaleDateString()}</td>
                                    <td className="p-4 text-right whitespace-nowrap">
                                        <button onClick={() => openDetails(u)} disabled={processingId === u.id} className="admin-action-btn bg-brand-gold/10 text-brand-gold-dark dark:text-brand-gold-light hover:bg-brand-gold hover:text-white tooltip disabled:opacity-40" title={t('admin.user_details')}>
                                            <Info size={18} />
                                        </button>
                                        <button onClick={() => openEdit(u)} disabled={processingId === u.id} className="admin-action-btn bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/10 tooltip disabled:opacity-40 ms-1" title={t('admin.edit_user')}>
                                            <Pencil size={18} />
                                        </button>
                                        {currentUser?.role === 'ADMIN' && u.twoFactorEnabled && (
                                            <button onClick={() => handleDisableTwoFactor(u)} disabled={processingId === u.id} className="admin-action-btn ms-1 bg-amber-50 text-amber-700 hover:bg-amber-500 hover:text-white dark:bg-amber-500/10 dark:text-amber-300 tooltip disabled:opacity-40" title={t('admin.disable_two_factor')}>
                                                <ShieldOff size={18} />
                                            </button>
                                        )}
                                        {u.role === 'STUDENT' && (
                                            <button onClick={() => openTransfer(u.id)} disabled={processingId === u.id} className="admin-action-btn bg-brand-navy/10 text-brand-navy dark:bg-brand-navy-light/10 dark:text-brand-navy-light hover:bg-brand-navy dark:hover:bg-brand-navy-light hover:text-white tooltip disabled:opacity-40 ms-1" title={t('admin.transfer_title')}>
                                                <ArrowRightLeft size={18} />
                                            </button>
                                        )}
                                        <button onClick={() => handleToggleActive(u)} disabled={processingId === u.id} className={`admin-action-btn ms-1 tooltip disabled:opacity-40 ${u.isActive === false ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500 hover:text-white' : 'bg-brand-gold/10 text-brand-gold-dark dark:text-brand-gold-light hover:bg-brand-gold hover:text-white'}`} title={u.isActive === false ? t('admin.activate_title') : t('admin.suspend_title')}>
                                            {u.isActive === false ? <Play size={18} /> : <Pause size={18} />}
                                        </button>
                                        <button onClick={() => handleDelete(u)} disabled={processingId === u.id || u.role === 'ADMIN'} className="admin-action-btn bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500 hover:text-white tooltip disabled:opacity-40 ms-1" title={u.role === 'ADMIN' ? t('admin.cannot_delete_admin_title') : t('admin.delete_user_title')}>
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

            {/* Details modal */}
            {(details || detailsLoading) && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in" onClick={() => { setDetails(null); setDetailsLoading(false); }}>
                    <div className="bg-brand-navy border border-white/10 rounded-3xl shadow-2xl max-w-2xl w-full p-7 animate-scale-in max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <div className="flex items-start justify-between mb-6">
                            <div>
                                <h4 className="text-xl font-black text-white flex items-center gap-2">
                                    <Info size={20} className="text-brand-gold-light" /> {t('admin.user_details_title')}
                                </h4>
                                <p className="text-gray-400 text-sm mt-1">{t('admin.user_details_subtitle')}</p>
                            </div>
                            <button onClick={() => { setDetails(null); setDetailsLoading(false); }} className="w-9 h-9 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition flex items-center justify-center" aria-label="Close">
                                <X size={20} />
                            </button>
                        </div>

                        {detailsLoading && (
                            <div className="py-16 text-center font-bold text-gray-400">{t('common.loading')}</div>
                        )}

                        {details && !detailsLoading && (() => {
                            const meta = (details.user.metadata ?? {}) as Record<string, unknown>;
                            const fullName = (meta.fullName as string) || details.user.email.split('@')[0];
                            const initials = fullName.split(/\s+/).map(p => p[0]).slice(0, 2).join('').toUpperCase();
                            const statusLabel = (s: string) => t('statuses.' + (s || '').toLowerCase()) || s;
                            const gender = (meta.gender as string) || '';
                            const genderLabel = gender === 'MALE'
                                ? t('auth.gender_male')
                                : gender === 'FEMALE'
                                    ? t('auth.gender_female')
                                    : '—';
                            const infoRows: { icon: typeof Mail; label: string; value: string }[] = [
                                { icon: Mail, label: t('profile.email'), value: details.user.email },
                                { icon: ShieldCheck, label: t('profile.role'), value: roleLabel(details.user.role) },
                                { icon: BadgeCheck, label: t('profile.account_status'), value: details.user.isActive === false ? t('profile.suspended') : t('profile.active') },
                                { icon: ShieldCheck, label: t('admin.two_factor_status'), value: details.user.twoFactorEnabled ? t('admin.two_factor_enabled') : t('admin.two_factor_disabled_label') },
                                { icon: Calendar, label: t('profile.member_since'), value: new Date(details.user.createdAt).toLocaleDateString() },
                                { icon: BadgeCheck, label: t('admin.verification_status'), value: details.user.emailVerifiedAt ? t('admin.email_verified') : t('admin.email_unverified') },
                                { icon: Phone, label: t('profile.phone'), value: (meta.phone as string) || '—' },
                                { icon: MapPin, label: t('profile.city'), value: (meta.city as string) || '—' },
                                { icon: GraduationCap, label: t('profile.field_specialty'), value: (meta.specialty as string) || '—' },
                                { icon: School, label: t('admin.profile_university'), value: (meta.university as string) || '—' },
                                { icon: FileText, label: t('admin.profile_study_status'), value: (meta.studyStatus as string) || '—' },
                                { icon: ClipboardList, label: t('admin.profile_study_level'), value: (meta.studyLevel as string) || '—' },
                                { icon: GraduationCap, label: t('admin.profile_job_title'), value: ((locale === 'ar' ? meta.jobTitleAr : meta.jobTitleEn) as string) || '—' },
                                { icon: BadgeCheck, label: t('admin.profile_experience_years'), value: meta.experienceYears !== undefined && meta.experienceYears !== null ? String(meta.experienceYears) : '—' },
                                { icon: Users, label: t('profile.field_gender'), value: genderLabel },
                                { icon: Cake, label: t('profile.field_birth_date'), value: formatDate(meta.birthDate as string, { locale }) || '—' },
                                { icon: School, label: t('profile.field_university'), value: (meta.university as string) || '—' },
                                { icon: FileText, label: t('profile.field_study_status'), value: (meta.studyStatus as string) ? t('auth.study_status_' + (meta.studyStatus as string).toLowerCase()) : '—' },
                                { icon: ClipboardList, label: t('profile.field_study_level'), value: (meta.studyLevel as string) || '—' },
                            ];
                            return (
                                <div className="space-y-6">
                                    {/* Header */}
                                    <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/10">
                                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-gold to-brand-gold/50 flex items-center justify-center shrink-0">
                                            <span className="text-2xl font-black text-brand-navy">{initials}</span>
                                        </div>
                                        <div className="min-w-0">
                                            <div className="font-black text-white text-lg truncate" dir="auto">{fullName}</div>
                                            <div className="text-gray-400 text-sm truncate" dir="ltr">{details.user.email}</div>
                                            <div className="flex gap-2 mt-2">
                                                <span className="px-2.5 py-0.5 rounded-full bg-brand-gold text-brand-navy text-[11px] font-black">{roleLabel(details.user.role)}</span>
                                                <span className={"px-2.5 py-0.5 rounded-full text-[11px] font-black " + (details.user.isActive === false ? 'bg-red-500/15 text-red-400' : 'bg-emerald-500/15 text-emerald-400')}>
                                                    {details.user.isActive === false ? t('profile.suspended') : t('profile.active')}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Info grid */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
                                        {infoRows.map(row => (
                                            <div key={row.label} className="flex items-center gap-3 py-2">
                                                <div className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center text-brand-gold-light shrink-0">
                                                    <row.icon size={16} />
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="text-[11px] font-bold text-gray-400">{row.label}</div>
                                                    <div className="font-bold text-white text-sm truncate" dir="auto">{row.value}</div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {!!((meta.bio as string) || (meta.bioEn as string)) && (
                                        <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                                            <div className="text-[11px] font-bold text-gray-400 mb-1.5 flex items-center gap-1.5"><FileText size={13} /> {t('profile.bio')}</div>
                                            <p className="text-sm text-gray-200 leading-relaxed" dir="auto">{(locale === 'ar' ? meta.bio : meta.bioEn) as string || (meta.bio as string)}</p>
                                        </div>
                                    )}

                                    {details.user.role === 'INSTRUCTOR' && (
                                        <>
                                            <div>
                                                <h5 className="font-black text-white flex items-center gap-2 mb-3">
                                                    <BookOpen size={17} className="text-brand-gold-light" /> {t('admin.instructor_courses')}
                                                    <span className="text-xs text-gray-400 font-bold">({details.coursesTaught.length})</span>
                                                </h5>
                                                {details.coursesTaught.length ? (
                                                    <div className="grid gap-2 sm:grid-cols-2">
                                                        {details.coursesTaught.map(course => (
                                                            <div key={course.id} className="rounded-xl bg-white/5 border border-white/10 p-3">
                                                                <p className="font-bold text-white text-sm" dir="auto">{locale === 'ar' ? course.titleAr : course.titleEn}</p>
                                                                <p className="text-xs text-gray-400 mt-1">{formatDate(course.createdAt, { locale })}</p>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <div className="text-sm text-gray-400 py-4 text-center rounded-xl bg-white/5 border border-white/10">{t('admin.no_instructor_courses')}</div>
                                                )}
                                            </div>
                                            <div>
                                                <h5 className="font-black text-white flex items-center gap-2 mb-3">
                                                    <Calendar size={17} className="text-brand-gold-light" /> {t('admin.instructor_openings')}
                                                    <span className="text-xs text-gray-400 font-bold">({details.openingsTaught.length})</span>
                                                </h5>
                                                {details.openingsTaught.length ? (
                                                    <div className="space-y-2">
                                                        {details.openingsTaught.map(opening => (
                                                            <div key={opening.id} className="rounded-xl bg-white/5 border border-white/10 p-3 flex items-center justify-between gap-3">
                                                                <span className="font-bold text-white text-sm" dir="auto">{locale === 'ar' ? opening.nameAr || '—' : opening.nameEn || '—'}</span>
                                                                <Badge tone={roleTone[opening.status] ?? 'gray'} dot={false}>{statusLabel(opening.status)}</Badge>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <div className="text-sm text-gray-400 py-4 text-center rounded-xl bg-white/5 border border-white/10">{t('admin.no_instructor_openings')}</div>
                                                )}
                                            </div>
                                        </>
                                    )}

                                    {/* Enrollments */}
                                    <div>
                                        <h5 className="font-black text-white flex items-center gap-2 mb-3">
                                            <BookOpen size={17} className="text-brand-gold-light" /> {t('admin.user_courses')}
                                            <span className="text-xs text-gray-400 font-bold">({details.enrollments.length})</span>
                                        </h5>
                                        {details.enrollments.length === 0 ? (
                                            <div className="text-sm text-gray-400 py-4 text-center rounded-xl bg-white/5 border border-white/10">{t('admin.no_user_courses')}</div>
                                        ) : (
                                            <div className="space-y-2">
                                                {details.enrollments.map(en => (
                                                    <div key={en.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
                                                        <BookOpen size={16} className="text-brand-gold-light shrink-0" />
                                                        <div className="flex-1 min-w-0">
                                                            <div className="font-bold text-white text-sm truncate" dir="auto">{en.course.titleAr || en.course.titleEn || '—'}</div>
                                                            <div className="text-[11px] text-gray-400">
                                                                {statusLabel(en.status)}{en.opening?.nameAr || en.opening?.nameEn ? ' • ' + (en.opening.nameAr || en.opening.nameEn) : ''}
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Certificates */}
                                    <div>
                                        <h5 className="font-black text-white flex items-center gap-2 mb-3">
                                            <Award size={17} className="text-brand-gold-light" /> {t('admin.user_certificates')}
                                            <span className="text-xs text-gray-400 font-bold">({details.certificates.length})</span>
                                        </h5>
                                        {details.certificates.length === 0 ? (
                                            <div className="text-sm text-gray-400 py-4 text-center rounded-xl bg-white/5 border border-white/10">{t('admin.no_user_certificates')}</div>
                                        ) : (
                                            <div className="space-y-2">
                                                {details.certificates.map(c => (
                                                    <div key={c.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
                                                        <Award size={16} className="text-brand-gold-light shrink-0" />
                                                        <div className="flex-1 min-w-0">
                                                            <div className="font-bold text-white text-sm font-mono truncate" dir="ltr">{c.verificationCode.slice(0, 12)}...</div>
                                                            <div className="text-[11px] text-gray-400">{new Date(c.issuingDate).toLocaleDateString()}</div>
                                                        </div>
                                                        <span className={"px-2 py-0.5 rounded-full text-[10px] font-black " + (c.verificationStatus === 'VALID' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-gray-500/15 text-gray-400')}>
                                                            {c.verificationStatus}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })()}
                    </div>
                </div>
            )}

            {/* Edit modal */}
            {editUser && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in" onClick={() => setEditUser(null)}>
                    <div className="bg-brand-navy border border-white/10 rounded-3xl shadow-2xl max-w-md w-full p-7 animate-scale-in max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <h4 className="text-xl font-black text-white mb-5">{t('admin.edit_user_title')}</h4>
                        <div className="space-y-4">
                            <input type="email" placeholder={t('admin.user_email_ph')} className="w-full p-3 border border-white/10 rounded-xl bg-brand-navy-dark text-white placeholder:text-gray-500 focus:ring-2 focus:ring-brand-gold outline-none" value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })} />
                            <input type="password" placeholder={t('admin.new_password_ph')} className="w-full p-3 border border-white/10 rounded-xl bg-brand-navy-dark text-white placeholder:text-gray-500 focus:ring-2 focus:ring-brand-gold outline-none" value={editForm.password} onChange={e => setEditForm({ ...editForm, password: e.target.value })} />
                            <select className="w-full p-3 border border-white/10 rounded-xl bg-brand-navy-dark text-white cursor-pointer focus:outline-none" value={editForm.role} onChange={e => setEditForm({ ...editForm, role: e.target.value })}>
                                {ROLES.map(r => <option key={r} value={r}>{roleLabel(r)}</option>)}
                            </select>
                        </div>
                        <div className="flex justify-end gap-3 mt-6">
                            <BtnSoft onClick={() => setEditUser(null)}>{t('common.cancel')}</BtnSoft>
                            <button onClick={handleSaveEdit} disabled={savingEdit} className="inline-flex items-center gap-2 bg-gradient-to-r from-brand-gold to-brand-gold-dark text-black px-5 py-2.5 rounded-xl font-bold hover:opacity-90 transition disabled:opacity-50 cursor-pointer">
                                {savingEdit ? t('common.saving') : t('common.save')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Transfer modal */}
            {transferId && transferUser && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in" onClick={() => setTransferId(null)}>
                    <div className="bg-brand-navy border border-white/10 rounded-3xl shadow-2xl max-w-lg w-full p-7 animate-scale-in max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <h4 className="text-xl font-black text-white mb-1">{t('admin.transfer_user_title')}</h4>
                        <p className="text-gray-400 text-sm mb-5">
                            {t('admin.transfer_user_desc')} <span className="font-bold text-white">{transferUser.email}</span>
                        </p>
                        <select className="w-full p-3 border border-white/10 rounded-xl bg-brand-navy-dark text-white mb-4 cursor-pointer focus:outline-none" value={transferCourseId} onChange={e => { setTransferCourseId(e.target.value); setTransferOpeningId(''); }}>
                            <option value="">{t('admin.select_course')}</option>
                            {(courses || []).map(c => <option key={c.id} value={c.id}>{c.titleAr || c.titleEn || c.id}</option>)}
                        </select>
                        <select className="w-full p-3 border border-white/10 rounded-xl bg-brand-navy-dark text-white cursor-pointer focus:outline-none" value={transferOpeningId} onChange={e => setTransferOpeningId(e.target.value)}>
                            <option value="">{t('admin.no_opening_option')}</option>
                            {(courses || []).find(c => c.id === transferCourseId)?.openings?.map(o => (
                                <option key={o.id} value={o.id}>
                                    {o.nameAr || o.nameEn || `#${o.id.slice(0, 4)}`} — ${o.price} {o.isPublished ? `(${t('admin.opening_published')})` : ''}
                                </option>
                            ))}
                        </select>
                        <div className="flex justify-end gap-3 mt-6">
                            <BtnSoft onClick={() => setTransferId(null)}>{t('common.cancel')}</BtnSoft>
                            <button onClick={handleTransfer} disabled={transferring} className="inline-flex items-center gap-2 bg-gradient-to-r from-brand-gold to-brand-gold-dark text-black px-5 py-2.5 rounded-xl font-bold hover:opacity-90 transition disabled:opacity-50 cursor-pointer">
                                {transferring ? t('common.processing') : t('admin.transfer_submit')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
