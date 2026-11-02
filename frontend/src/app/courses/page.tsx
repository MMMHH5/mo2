"use client";

import { useI18n } from '@/lib/i18n-context';
import MarketingShell from '@/components/MarketingShell';
import ExploreCourses from '@/components/ExploreCourses';
import LearningPathList from '@/components/LearningPathList';

export default function BrowseCoursesPage() {
    const { t } = useI18n();

    return (
        <MarketingShell
            title={t('explore.heading')}
            subtitle={t('explore.subtitle')}
        >
            <div className="w-full mt-4 pb-20">
                <section className="mb-16">
                    <LearningPathList mode="browse" variant="featured" />
                </section>
                <ExploreCourses hideHeader />
            </div>
        </MarketingShell>
    );
}