"use client";

import ProtectedRoute from '@/components/ProtectedRoute';
import { useFetchData } from '@/lib/useFetchData';
import { useI18n } from '@/lib/i18n-context';
import { useAuth } from '@/lib/auth-context';
import { api, getErrorMessage } from '@/lib/api';
import toast from 'react-hot-toast';
import { useState } from 'react';
import {
    UserRound, Mail, ShieldCheck, Calendar, Phone, MapPin, FileText,
    Edit3, Check, X, BadgeCheck, KeyRound, GraduationCap, Download, ShieldAlert,
    Users, UserCog,
} from 'lucide-react';
import SelectField from '@/components/SelectField';

interface MyProfile {
    id: string;
    email: string;
    role: string;
    isActive: boolean;
    metadata?: Record<string, unknown> | null;
    createdAt: string;
}

export default function ProfilePage() {
    const { user } = useAuth();
    const { t } = useI18n();
    const { data: profile, loading, error, refetch } = useFetchData<MyProfile>('/users/me');

    const [editing, setEditing] = useState(false);
    const [form, setForm] = useState({ fullName: '', phone: '', city: '', bio: '', specialty: '', gender: '', birthDate: '', university: '', studyStatus: '', studyLevel: '' });
    const [saving, setSaving] = useState(false);

    const [emailForm, setEmailForm] = useState({ email: '', currentPassword: '' });
    const [savingEmail, setSavingEmail] = useState(false);

    const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
    const [savingPw, setSavingPw] = useState(false);

    const [exportLoading, setExportLoading] = useState(false);

    const startEdit = () => {
        const m = profile?.metadata ?? {};
        setForm({
            fullName: (m.fullName as string) || '',
            phone: (m.phone as string) || '',
            city: (m.city as string) || '',
            bio: (m.bio as string) || '',
            specialty: (m.specialty as string) || '',
            gender: (m.gender as string) || '',
            birthDate: (m.birthDate as string) || '',
            university: (m.university as string) || '',
            studyStatus: (m.studyStatus as string) || '',
            studyLevel: (m.studyLevel as string) || '',
        });
        setEditing(true);
    };

    const saveProfile = async () => {
        setSaving(true);
        try {
            await api.patch('/users/me', { metadata: form });
            toast.success(t('profile.saved'));
            setEditing(false);
            refetch();
        } catch (err) {
            toast.error(getErrorMessage(err) || t('profile.save_failed'));
        } finally {
            setSaving(false);
        }
    };

    const saveEmail = async () => {
        if (!emailForm.email || !emailForm.currentPassword) {
            toast.error(t('profile.email_fields_required'));
            return;
        }
        setSavingEmail(true);
        try {
            const res = await api.patch('/users/me', { email: emailForm.email, currentPassword: emailForm.currentPassword });
            toast.success(t('profile.email_updated'));
            setEmailForm({ email: '', currentPassword: '' });
            refetch();
            if (typeof window !== 'undefined') {
                try {
                    const raw = localStorage.getItem('laxalab_user');
                    if (raw) {
                        const u = JSON.parse(raw);
                        u.email = res.data?.email ?? emailForm.email;
                        localStorage.setItem('laxalab_user', JSON.stringify(u));
                    }
                } catch { /* ignore */ }
            }
            window.location.reload();
        } catch (err) {
            toast.error(getErrorMessage(err) || t('profile.save_failed'));
        } finally {
            setSavingEmail(false);
        }
    };

    const savePassword = async () => {
        if (!pwForm.currentPassword || !pwForm.newPassword) {
            toast.error(t('profile.pw_fields_required'));
            return;
        }
        if (pwForm.newPassword.length < 6) {
            toast.error(t('profile.pw_too_short'));
            return;
        }
        if (pwForm.newPassword !== pwForm.confirmPassword) {
            toast.error(t('profile.pw_mismatch'));
            return;
        }
        setSavingPw(true);
        try {
            await api.patch('/users/me', { password: pwForm.newPassword, currentPassword: pwForm.currentPassword });
            toast.success(t('profile.pw_updated'));
            setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
        } catch (err) {
            toast.error(getErrorMessage(err) || t('profile.pw_update_failed'));
        } finally {
            setSavingPw(false);
        }
    };

    const exportData = async () => {
        setExportLoading(true);
        try {
            const res = await api.post('/users/me/export');
            const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `laxalab-data-export-${new Date().toISOString().slice(0, 10)}.json`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
            toast.success(t('gdpr.export_success'));
        } catch (err) {
            toast.error(getErrorMessage(err) || t('gdpr.export_failed'));
        } finally {
            setExportLoading(false);
        }
    };

    const fullName =
        (profile?.metadata?.fullName as string) ||
        user?.email?.split('@')[0] ||
        profile?.email || '';
    const initials = fullName.split(/\s+/).map(p => p[0]).slice(0, 2).join('').toUpperCase();
    const roleLabel = t('roles.' + (profile?.role || '').toLowerCase()) || profile?.role || '';

    const infoRows: { icon: typeof Mail; label: string; value: string }[] = [
        { icon: Mail, label: t('profile.email'), value: profile?.email || '' },
        { icon: ShieldCheck, label: t('profile.role'), value: roleLabel },
        { icon: BadgeCheck, label: t('profile.account_status'), value: profile?.isActive === false ? t('profile.suspended') : t('profile.active') },
        { icon: Calendar, label: t('profile.member_since'), value: profile ? new Date(profile.createdAt).toLocaleDateString() : '' },
        { icon: Phone, label: t('profile.phone'), value: (profile?.metadata?.phone as string) || '—' },
        { icon: MapPin, label: t('profile.city'), value: (profile?.metadata?.city as string) || '—' },
    ];

    const inputCls = "w-full bg-white dark:bg-brand-navy-dark border border-gray-300 dark:border-white/10 rounded-xl px-4 py-3 font-semibold text-brand-navy dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-gold focus:border-brand-gold transition";
    const labelCls = "block text-sm font-bold text-gray-600 dark:text-gray-300 mb-1.5";

    return (
        <ProtectedRoute>
            <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">
{error && <div className="p-4 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/20 bg-red-50 dark:bg-red-500/10 rounded-xl font-semibold">{error}</div>}

                {loading || !profile ? (
                    <div className="bg-white dark:bg-brand-navy-dark border border-gray-200 dark:border-white/5 p-16 rounded-3xl flex flex-col items-center gap-3 font-bold text-gray-500 dark:text-gray-400">
                        <div className="w-12 h-12 rounded-full border-4 border-gray-200 dark:border-white/10 border-t-brand-gold animate-spin" />
                        {t('profile.loading')}
                    </div>
                ) : (
                    <>
                        {/* Header card */}
                        <div className="relative overflow-hidden bg-gradient-to-br from-brand-navy via-[#0e2a52] to-[#0a1e3c] rounded-3xl p-4 sm:p-6 lg:p-8 text-white shadow-lg shadow-brand-navy/20">
                            <div className="absolute -top-16 -right-16 w-64 h-64 bg-brand-gold/20 rounded-full blur-3xl" />
                            <div className="absolute -bottom-20 -left-10 w-72 h-72 bg-brand-gold/10 rounded-full blur-3xl" />
                            <div className="absolute inset-0 opacity-[0.06]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, #fff 1px, transparent 0)', backgroundSize: '22px 22px' }} />
                            <div className="relative flex items-center gap-6 flex-wrap">
                                <div className="relative shrink-0">
                                    <div className="w-24 h-24 lg:w-28 lg:h-28 rounded-3xl bg-gradient-to-br from-brand-gold to-brand-gold/50 flex items-center justify-center shadow-lg shadow-brand-gold/30 ring-4 ring-white/15">
                                        <span className="text-3xl lg:text-4xl font-black text-brand-navy">{initials || <UserRound size={44} />}</span>
                                    </div>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-3 flex-wrap">
                                        <h1 className="text-3xl lg:text-4xl font-black tracking-tight" dir="auto">{fullName}</h1>
                                        {profile.isActive !== false && (
                                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-400/15 text-emerald-300 text-xs font-black">
                                                <BadgeCheck size={13} /> {t('profile.active')}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-brand-mist/90 mt-1.5 font-semibold truncate" dir="ltr">{profile.email}</p>
                                    <div className="flex flex-wrap gap-2 mt-4">
                                        <span className="px-3.5 py-1.5 rounded-full bg-brand-gold text-brand-navy text-xs font-black shadow-sm shadow-brand-gold/30">
                                            {roleLabel}
                                        </span>
                                        <span className="px-3.5 py-1.5 rounded-full bg-white/10 text-brand-mist/80 text-xs font-semibold backdrop-blur">
                                            {t('profile.since')} {new Date(profile.createdAt).toLocaleDateString()}
                                        </span>
                                    </div>
                                </div>
                                <button
                                    onClick={startEdit}
                                    className="inline-flex items-center gap-2 text-sm font-bold text-brand-navy bg-brand-gold hover:bg-brand-gold/90 px-4 py-2.5 rounded-xl shadow-lg shadow-brand-gold/25 transition"
                                >
                                    <Edit3 size={16} /> {t('profile.edit_profile')}
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Personal info */}
                            <div className="bg-white dark:bg-brand-navy-dark border border-gray-200 dark:border-gray-200 dark:border-white/5 rounded-3xl shadow-sm p-6 lg:p-7">
                                <div className="flex items-center gap-2.5 mb-6 pb-5 border-b border-gray-200 dark:border-white/5">
                                    <div className="w-10 h-10 rounded-xl bg-brand-gold/10 flex items-center justify-center text-brand-gold-dark dark:text-brand-gold-light">
                                        <UserRound size={20} />
                                    </div>
                                    <h3 className="text-xl font-black text-brand-navy dark:text-white">{t('profile.personal_info')}</h3>
                                </div>
                                <div className="space-y-1">
                                    {infoRows.map((row) => (
                                        <div key={row.label} className="flex items-center gap-4 py-2.5">
                                            <div className="w-10 h-10 rounded-xl bg-brand-gold/10 flex items-center justify-center text-brand-gold-dark dark:text-brand-gold-light shrink-0">
                                                <row.icon size={18} />
                                            </div>
                                            <div className="min-w-0">
<div className="text-xs font-bold text-gray-500 dark:text-gray-400 tracking-wide">{row.label}</div>
                                                 <div className="font-bold text-brand-navy dark:text-white truncate" dir="auto">{row.value}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {(profile.metadata?.bio as string) && (
                                    <div className="mt-5 pt-5 border-t border-gray-200 dark:border-white/5">
                                        <div className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-1.5">
                                            <FileText size={14} /> {t('profile.bio')}
                                        </div>
                                        <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed" dir="auto">
                                            {profile.metadata?.bio as string}
                                        </p>
                                    </div>
                                )}

                                {(profile.metadata?.specialty as string) && (
                                    <div className="mt-4 pt-4 border-t border-gray-200 dark:border-white/5 flex items-center gap-2">
                                        <GraduationCap size={16} className="text-brand-gold-dark dark:text-brand-gold-light shrink-0" />
                                        <span dir="auto" className="px-3 py-1 rounded-full bg-brand-gold/10 text-brand-gold-dark dark:text-brand-gold-light text-xs font-black">
                                            {profile.metadata?.specialty as string}
                                        </span>
                                    </div>
                                )}
                            </div>

                            {/* Account security: email + password */}
                            <div className="space-y-6">
                                {/* Email change */}
                                <div className="bg-white dark:bg-brand-navy-dark border border-gray-200 dark:border-gray-200 dark:border-white/5 rounded-3xl shadow-sm p-6 lg:p-7">
                                    <div className="flex items-center gap-2.5 mb-5">
                                        <div className="w-10 h-10 rounded-xl bg-brand-gold/10 flex items-center justify-center text-brand-gold-dark dark:text-brand-gold-light">
                                            <Mail size={20} />
                                        </div>
                                        <h3 className="text-xl font-black text-brand-navy dark:text-white">{t('profile.change_email')}</h3>
                                    </div>
                                    <div className="space-y-4">
                                        <div>
                                            <label className={labelCls}>{t('profile.field_new_email')}</label>
                                            <input
                                                type="email"
                                                value={emailForm.email}
                                                onChange={(e) => setEmailForm({ ...emailForm, email: e.target.value })}
                                                className={inputCls}
                                                dir="ltr"
                                                placeholder={t('profile.field_new_email_ph')}
                                            />
                                        </div>
                                        <div>
                                            <label className={labelCls}>{t('profile.field_current_password')}</label>
                                            <input
                                                type="password"
                                                value={emailForm.currentPassword}
                                                onChange={(e) => setEmailForm({ ...emailForm, currentPassword: e.target.value })}
                                                className={inputCls}
                                            />
                                        </div>
                                        <button
                                            onClick={saveEmail}
                                            disabled={savingEmail}
                                            className="w-full inline-flex items-center justify-center gap-2 bg-gradient-to-r from-brand-gold to-brand-gold-dark text-black py-3 font-bold rounded-xl hover:from-brand-gold-dark hover:to-brand-gold-dark transition disabled:opacity-50"
                                        >
                                            {savingEmail ? t('common.saving') : t('profile.save_email')}
                                        </button>
                                    </div>
                                </div>

                                {/* Password change */}
                                <div className="bg-white dark:bg-brand-navy-dark border border-gray-200 dark:border-gray-200 dark:border-white/5 rounded-3xl shadow-sm p-6 lg:p-7">
                                    <div className="flex items-center gap-2.5 mb-5">
                                        <div className="w-10 h-10 rounded-xl bg-brand-gold/10 flex items-center justify-center text-brand-gold-dark dark:text-brand-gold-light">
                                            <KeyRound size={20} />
                                        </div>
                                        <h3 className="text-xl font-black text-brand-navy dark:text-white">{t('profile.change_password')}</h3>
                                    </div>
                                    <div className="space-y-4">
                                        <div>
                                            <label className={labelCls}>{t('profile.field_current_password')}</label>
                                            <input
                                                type="password"
                                                value={pwForm.currentPassword}
                                                onChange={(e) => setPwForm({ ...pwForm, currentPassword: e.target.value })}
                                                className={inputCls}
                                            />
                                        </div>
                                        <div>
                                            <label className={labelCls}>{t('profile.field_new_password')}</label>
                                            <input
                                                type="password"
                                                value={pwForm.newPassword}
                                                onChange={(e) => setPwForm({ ...pwForm, newPassword: e.target.value })}
                                                className={inputCls}
                                            />
                                        </div>
                                        <div>
                                            <label className={labelCls}>{t('profile.field_confirm_password')}</label>
                                            <input
                                                type="password"
                                                value={pwForm.confirmPassword}
                                                onChange={(e) => setPwForm({ ...pwForm, confirmPassword: e.target.value })}
                                                className={inputCls}
                                            />
                                        </div>
                                        <button
                                            onClick={savePassword}
                                            disabled={savingPw}
                                            className="w-full inline-flex items-center justify-center gap-2 bg-gradient-to-r from-brand-gold to-brand-gold-dark text-black py-3 font-bold rounded-xl hover:from-brand-gold-dark hover:to-brand-gold-dark transition disabled:opacity-50"
                                        >
                                            {savingPw ? t('common.saving') : t('profile.save_password')}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* GDPR privacy card */}
                        <div className="bg-white dark:bg-brand-navy-dark border border-gray-200 dark:border-gray-200 dark:border-white/5 rounded-3xl shadow-sm p-6 lg:p-7">
                            <div className="flex items-center gap-2.5 mb-6 pb-5 border-b border-gray-200 dark:border-white/5">
                                <div className="w-10 h-10 rounded-xl bg-brand-gold/10 flex items-center justify-center text-brand-gold-dark dark:text-brand-gold-light">
                                    <ShieldAlert size={20} />
                                </div>
                                <h3 className="text-xl font-black text-brand-navy dark:text-white">{t('gdpr.heading')}</h3>
                            </div>
                            <div className="grid grid-cols-1 gap-6">
                                <div className="bg-brand-gold/5 border border-brand-gold/10 rounded-2xl p-6">
                                    <h4 className="font-black text-brand-gold-dark dark:text-brand-gold-light mb-1.5">{t('gdpr.export_title')}</h4>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">{t('gdpr.export_desc')}</p>
                                    <button
                                        onClick={exportData}
                                        disabled={exportLoading}
                                        className="inline-flex items-center gap-2 bg-gradient-to-r from-brand-gold to-brand-gold-dark text-black px-6 py-3 font-bold rounded-xl hover:from-brand-gold-dark hover:to-brand-gold-dark transition disabled:opacity-50"
                                    >
                                        <Download size={16} /> {exportLoading ? t('gdpr.exporting') : t('gdpr.export_btn')}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* Edit personal info modal */}
            {editing && profile && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
                    <div className="bg-brand-navy border border-white/10 rounded-3xl w-full max-w-lg p-8 shadow-2xl max-h-[90vh] overflow-y-auto animate-scale-in">
                        <div className="flex items-center justify-between mb-7">
                            <h2 className="text-2xl font-black text-white">{t('profile.edit_title')}</h2>
                            <button onClick={() => setEditing(false)} className="w-9 h-9 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition flex items-center justify-center" aria-label="Close">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className={labelCls}>{t('profile.field_full_name')}</label>
                                <input
                                    type="text"
                                    value={form.fullName}
                                    onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                                    className={inputCls}
                                    dir="auto"
                                />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className={labelCls}>{t('profile.field_phone')}</label>
                                    <input
                                        type="text"
                                        value={form.phone}
                                        onChange={(e) => setForm({ ...form, phone: e.target.value })}
                                        className={inputCls}
                                        dir="ltr"
                                    />
                                </div>
                                <div>
                                    <label className={labelCls}>{t('profile.field_city')}</label>
                                    <input
                                        type="text"
                                        value={form.city}
                                        onChange={(e) => setForm({ ...form, city: e.target.value })}
                                        className={inputCls}
                                        dir="auto"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className={labelCls}>{t('profile.field_specialty')}</label>
                                <input
                                    type="text"
                                    value={form.specialty}
                                    onChange={(e) => setForm({ ...form, specialty: e.target.value })}
                                    className={inputCls}
                                    dir="auto"
                                />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div>
                                    <label className={labelCls} htmlFor="pf-gender">{t('auth.gender')}</label>
                                    <SelectField
                                        id="pf-gender"
                                        icon={Users}
                                        inputCls={inputCls}
                                        value={form.gender}
                                        onChange={(v) => setForm({ ...form, gender: v })}
                                        placeholder={t('auth.gender_select')}
                                        ariaLabel={t('auth.gender')}
                                        options={[
                                            { value: 'MALE', label: t('auth.gender_male') },
                                            { value: 'FEMALE', label: t('auth.gender_female') },
                                            { value: 'OTHER', label: t('auth.gender_other') },
                                        ]}
                                    />
                                </div>
                                <div>
                                    <label className={labelCls} htmlFor="pf-birthdate">{t('auth.birth_date')}</label>
                                    <input
                                        id="pf-birthdate"
                                        type="date"
                                        max={new Date().toISOString().slice(0, 10)}
                                        value={form.birthDate}
                                        onChange={(e) => setForm({ ...form, birthDate: e.target.value })}
                                        className={inputCls}
                                    />
                                </div>
                                <div>
                                    <label className={labelCls}>{t('auth.university')}</label>
                                    <input
                                        type="text"
                                        value={form.university}
                                        onChange={(e) => setForm({ ...form, university: e.target.value })}
                                        className={inputCls}
                                        dir="auto"
                                        placeholder={t('auth.university_ph')}
                                    />
                                </div>
                            </div>
                                <div>
                                    <label className={labelCls} htmlFor="pf-study-status">{t('auth.study_status')}</label>
                                    <SelectField
                                        id="pf-study-status"
                                        icon={UserCog}
                                        inputCls={inputCls}
                                        value={form.studyStatus}
                                        onChange={(v) => setForm({ ...form, studyStatus: v })}
                                        placeholder={t('auth.study_status_select')}
                                        ariaLabel={t('auth.study_status')}
                                        options={[
                                            { value: 'STUDENT', label: t('auth.study_status_student') },
                                            { value: 'GRADUATE', label: t('auth.study_status_graduate') },
                                            { value: 'OTHER', label: t('auth.study_status_other') },
                                        ]}
                                    />
                                </div>
                                <div>
                                    <label className={labelCls}>{t('auth.study_level')}</label>
                                    <input
                                        type="text"
                                        value={form.studyLevel}
                                        onChange={(e) => setForm({ ...form, studyLevel: e.target.value })}
                                        className={inputCls}
                                        dir="auto"
                                        placeholder={t('auth.study_level_ph')}
                                    />
                                </div>
                            <div>
                                <label className={labelCls}>{t('profile.field_bio')}</label>
                                <textarea
                                    value={form.bio}
                                    onChange={(e) => setForm({ ...form, bio: e.target.value })}
                                    rows={4}
                                    className={inputCls}
                                    dir="auto"
                                />
                            </div>
                        </div>

                        <div className="flex gap-4 mt-8">
                            <button
                                onClick={saveProfile}
                                disabled={saving}
                                className="flex-1 bg-gradient-to-r from-brand-gold to-brand-gold-dark hover:from-brand-gold-dark hover:to-brand-gold-dark text-black py-3 font-bold rounded-xl shadow-sm transition disabled:opacity-50 inline-flex items-center justify-center gap-2"
                            >
                                <Check size={18} /> {saving ? t('common.saving') : t('profile.save')}
                            </button>
                            <button
                                onClick={() => setEditing(false)}
                                disabled={saving}
                                className="flex-1 bg-white/5 text-gray-300 hover:bg-white/10 py-3 font-bold rounded-xl transition"
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
