/**
 * The public shape of an instructor, as returned by the public endpoints
 * (`/public/instructors`, `/public/instructors/:id`, and the instructor nested
 * in a public course).
 *
 * The email is deliberately absent: public course payloads used to embed it and
 * the UI rendered it as the instructor's display name, which both leaked a
 * private field and broke once the backend stopped sending it. Identity now
 * comes from the bilingual name, read through `pick(entity, 'name')`.
 *
 * `nameAr`/`nameEn` and the other pairs are read with the shared `pick()`
 * helper from `@/lib/i18n-context`.
 */
export interface PublicInstructorCard {
    id: string;
    nameAr: string | null;
    nameEn: string | null;
    avatarUrl: string | null;
    jobTitleAr: string | null;
    jobTitleEn: string | null;
    bioAr: string | null;
    bioEn: string | null;
    specialtyAr: string | null;
    specialtyEn: string | null;
    experienceYears: number | null;
    isProfileIncomplete: boolean;
}
