import {
    LayoutDashboard,
    BookOpen,
    Users,
    CreditCard,
    ShieldAlert,
    Settings,
    MessageSquare,
    LifeBuoy,
    GraduationCap,
    Wallet,
    Award,
    UserRound,
    ClipboardList,
    MessagesSquare,
    type LucideIcon,
} from 'lucide-react';

export interface NavLink {
    name: string;
    href: string;
    icon: LucideIcon;
    roles: string[];
}

export function buildNavLinks(t: (key: string) => string): NavLink[] {
    return [
        { name: t('sidebar.dashboard'), href: '/dashboard', icon: LayoutDashboard, roles: ['STUDENT', 'INSTRUCTOR', 'COURSE_MANAGER', 'FINANCE', 'ADMIN'] },
        { name: t('sidebar.profile'), href: '/dashboard/profile', icon: UserRound, roles: ['STUDENT', 'INSTRUCTOR', 'COURSE_MANAGER', 'FINANCE', 'ADMIN'] },
        { name: t('landing.explore_courses'), href: '/dashboard/explore', icon: BookOpen, roles: ['STUDENT'] },
        { name: t('sidebar.my_courses'), href: '/dashboard/my-courses', icon: BookOpen, roles: ['STUDENT'] },
        { name: t('sidebar.my_grades'), href: '/dashboard/my-grades', icon: GraduationCap, roles: ['STUDENT'] },
        { name: t('sidebar.tasks'), href: '/dashboard/tasks', icon: ClipboardList, roles: ['STUDENT'] },
        { name: t('sidebar.payments'), href: '/dashboard/payments', icon: Wallet, roles: ['STUDENT'] },
        { name: t('sidebar.certificates'), href: '/dashboard/certificates', icon: Award, roles: ['STUDENT'] },
        { name: t('sidebar.inbox'), href: '/dashboard/inbox', icon: MessageSquare, roles: ['STUDENT', 'INSTRUCTOR', 'COURSE_MANAGER', 'FINANCE', 'ADMIN'] },
        { name: t('sidebar.batch_chats'), href: '/dashboard/batch-chats', icon: MessagesSquare, roles: ['STUDENT', 'INSTRUCTOR', 'COURSE_MANAGER', 'FINANCE', 'ADMIN'] },
        { name: t('sidebar.notifications'), href: '/dashboard/notifications', icon: ShieldAlert, roles: ['STUDENT', 'INSTRUCTOR', 'COURSE_MANAGER', 'FINANCE', 'ADMIN'] },
        { name: t('sidebar.support'), href: '/dashboard/support', icon: LifeBuoy, roles: ['STUDENT', 'INSTRUCTOR', 'COURSE_MANAGER', 'FINANCE', 'ADMIN'] },
        { name: t('sidebar.manage_courses'), href: '/dashboard/admin/courses', icon: BookOpen, roles: ['COURSE_MANAGER', 'ADMIN'] },
        { name: t('sidebar.teach_hub'), href: '/dashboard/teaching', icon: GraduationCap, roles: ['INSTRUCTOR'] },
        { name: t('sidebar.instructors_hr'), href: '/dashboard/admin/instructors', icon: Users, roles: ['ADMIN', 'COURSE_MANAGER'] },
        { name: t('sidebar.audit_logs'), href: '/dashboard/admin/audit', icon: ShieldAlert, roles: ['ADMIN'] },
        { name: t('sidebar.finance'), href: '/dashboard/admin/finance', icon: CreditCard, roles: ['FINANCE', 'ADMIN'] },
        { name: t('sidebar.admin'), href: '/dashboard/admin', icon: Settings, roles: ['ADMIN'] },
    ];
}
