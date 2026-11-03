export function calculateInstructorEntitlement(collected: number, sharePercent: number | null): number {
    if (sharePercent === null) return 0;
    return Math.round(collected * sharePercent) / 100;
}

export function calculateCourseProfit(collected: number, instructorEntitlement: number, paidOperatingExpenses: number): number {
    return Math.round((collected - instructorEntitlement - paidOperatingExpenses) * 100) / 100;
}
