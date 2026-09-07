"use client";

import { useState } from 'react';
import { Mail, Clock, MessageSquare, CheckCircle2 } from 'lucide-react';
import { useI18n } from '@/lib/i18n-context';
import MarketingShell from '@/components/MarketingShell';
import { api, getErrorMessage } from '@/lib/api';

export default function ContactContent() {
    const { locale } = useI18n();
    const isAr = locale === 'ar';

    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [subject, setSubject] = useState('');
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setSuccess(false);
        try {
            await api.post('/public/contact', { name, email, subject, message });
            setSuccess(true);
            setName('');
            setEmail('');
            setSubject('');
            setMessage('');
        } catch (err) {
            setError(getErrorMessage(err));
        } finally {
            setLoading(false);
        }
    };

    const inputCls =
        'block w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-gold outline-none transition';

    return (
        <MarketingShell
            title={isAr ? 'تواصل معنا' : 'Contact Us'}
            subtitle={
                isAr
                    ? 'نسعد بسماعك. أرسل رسالتك وسيقوم فريقنا بالرد خلال 24–48 ساعة عمل.'
                    : 'We’d love to hear from you. Send a message and our team will reply within 24–48 business hours.'}
        >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="md:col-span-2 bg-white rounded-3xl border border-brand-mist shadow-sm p-8">
                    <h2 className="text-xl font-black text-brand-navy mb-6">{isAr ? 'أرسل رسالة' : 'Send a Message'}</h2>

                    {success && (
                        <div className="mb-6 p-4 rounded-xl bg-green-50 border border-green-200 text-sm font-semibold text-green-700 flex items-start gap-2">
                            <CheckCircle2 size={18} className="shrink-0 mt-0.5" />
                            {isAr
                                ? 'تم إرسال رسالتك بنجاح. سنتواصل معك قريباً.'
                                : 'Your message has been sent successfully. We will get back to you soon.'}
                        </div>
                    )}

                    {error && (
                        <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-sm font-semibold text-red-700">
                            {error}
                        </div>
                    )}

                    <form onSubmit={submit} className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">{isAr ? 'الاسم' : 'Name'}</label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className={inputCls}
                                    maxLength={200}
                                    required
                                    placeholder={isAr ? 'اسمك الكامل' : 'Your full name'}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">{isAr ? 'البريد الإلكتروني' : 'Email'}</label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className={inputCls}
                                    required
                                    placeholder="you@example.com"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">{isAr ? 'الموضوع' : 'Subject'}</label>
                            <input
                                type="text"
                                value={subject}
                                onChange={(e) => setSubject(e.target.value)}
                                className={inputCls}
                                maxLength={200}
                                placeholder={isAr ? 'موضوع الرسالة' : 'Message subject'}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">{isAr ? 'الرسالة' : 'Message'}</label>
                            <textarea
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                className={`${inputCls} min-h-36 resize-y`}
                                maxLength={4000}
                                required
                                placeholder={isAr ? 'اكتب رسالتك هنا...' : 'Write your message here...'}
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full sm:w-auto py-4 px-10 bg-brand-gold hover:bg-[#b08e50] text-brand-navy font-black rounded-xl shadow-md transition disabled:opacity-60"
                        >
                            {loading ? (isAr ? 'جارٍ الإرسال...' : 'Sending...') : isAr ? 'إرسال الرسالة' : 'Send Message'}
                        </button>
                    </form>
                </div>

                <aside className="space-y-5">
                    <div className="bg-white rounded-3xl border border-brand-mist shadow-sm p-7">
                        <div className="w-11 h-11 bg-brand-mist/50 rounded-2xl flex items-center justify-center text-brand-navy mb-4">
                            <Mail size={22} />
                        </div>
                        <h3 className="font-bold text-brand-navy mb-1">{isAr ? 'دعم المنصة' : 'Platform Support'}</h3>
                        <p className="text-sm text-gray-500" dir="ltr">support@laxalab.com</p>
                    </div>
                    <div className="bg-white rounded-3xl border border-brand-mist shadow-sm p-7">
                        <div className="w-11 h-11 bg-brand-mist/50 rounded-2xl flex items-center justify-center text-brand-navy mb-4">
                            <Clock size={22} />
                        </div>
                        <h3 className="font-bold text-brand-navy mb-1">{isAr ? 'ساعات العمل' : 'Working Hours'}</h3>
                        <p className="text-sm text-gray-500 leading-relaxed">
                            {isAr
                                ? 'السبت – الخميس، من 9 صباحاً حتى 6 مساءً (بتوقيت مكة المكرمة).'
                                : 'Saturday – Thursday, 9:00 AM to 6:00 PM (Makkah time).'}
                        </p>
                    </div>
                    <div className="bg-white rounded-3xl border border-brand-mist shadow-sm p-7">
                        <div className="w-11 h-11 bg-brand-mist/50 rounded-2xl flex items-center justify-center text-brand-navy mb-4">
                            <MessageSquare size={22} />
                        </div>
                        <h3 className="font-bold text-brand-navy mb-1">{isAr ? 'التذاكر' : 'Tickets'}</h3>
                        <p className="text-sm text-gray-500 leading-relaxed">
                            {isAr
                                ? 'المستخدمون المسجلون يمكنهم فتح تذكرة دعم من لوحة التحكم مباشرة.'
                                : 'Registered users can open a support ticket directly from their dashboard.'}
                        </p>
                    </div>
                </aside>
            </div>
        </MarketingShell>
    );
}