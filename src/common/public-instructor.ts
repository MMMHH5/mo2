import type { Prisma } from '@prisma/client';

/** A user row carrying the minimum needed to build a public instructor card. */
type PublicUserSource = {
    id: string;
    createdAt?: Date | null;
    email?: string | null;
    metadata?: unknown;
};

function asRecord(value: unknown): Record<string, unknown> {
    return (value ?? null) as Record<string, unknown> | null ?? {};
}

function str(value: unknown): string | null {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

/**
 * The public shape of an instructor.
 *
 * There is no `Instructor` table: an instructor is a `User` with
 * `role = INSTRUCTOR`. Before the CV fields existed, every instructor surface
 * fell back to the account email, and the public endpoints withheld the email
 * while the frontend read it — so both instructor pages threw on first render.
 *
 * `metadata` is parsed here and never echoed wholesale, so private profile
 * data (phone, birth date, university) cannot leak through a public route.
 * `email` is deliberately absent from the return type.
 */
export interface PublicInstructor {
    id: string;
    /**
     * Bilingual pair, read by the frontend's existing `pick()` helper exactly
     * like `Course.titleAr/titleEn`. Each side falls back to the registration
     * `fullName` so an instructor who only filled one field still renders.
     */
    nameAr: string | null;
    nameEn: string | null;
    avatarUrl: string | null;
    /** Bilingual: the caller picks with the same `pick()` used for courses. */
    jobTitleAr: string | null;
    jobTitleEn: string | null;
    bioAr: string | null;
    bioEn: string | null;
    specialtyAr: string | null;
    specialtyEn: string | null;
    experienceYears: number | null;
    joinedAt: Date | null;
    /** True when the instructor has not filled in a CV yet. */
    isProfileIncomplete: boolean;}

export function toPublicInstructor(user: PublicUserSource): PublicInstructor {
    const md = asRecord(user.metadata);

    const fullName = str(md.fullName);
    const nameAr = str(md.nameAr) ?? fullName;
    const nameEn = str(md.nameEn) ?? fullName;

    const jobTitleAr = str(md.jobTitleAr);
    const jobTitleEn = str(md.jobTitleEn);
    const bio = str(md.bio);
    const bioAr = bio;
    const bioEn = str(md.bioEn) || bio;
    const specialty = str(md.specialty);

    const yearsRaw = md.experienceYears;
    const years =
        typeof yearsRaw === 'number' && Number.isFinite(yearsRaw) && yearsRaw > 0 ? yearsRaw : null;

    // Same rule the sanitiser applies on write: our own uploads path only, with
    // ".." rejected so a stored value cannot climb out of the folder.
    const avatar = str(md.avatarUrl);
    const safeAvatar = avatar && /^\/uploads\/[A-Za-z0-9._/-]+$/.test(avatar) && !avatar.includes('..')
        ? avatar
        : null;

    return {
        id: user.id,
        nameAr,
        nameEn,
        avatarUrl: safeAvatar,
        jobTitleAr,
        jobTitleEn,
        bioAr,
        bioEn,
        specialtyAr: specialty,
        specialtyEn: specialty,
        experienceYears: years,
        joinedAt: user.createdAt ?? null,
        // Mirrors the copy shown to the teacher ("complete your job title"):
        // a card is incomplete until it has both an identity and a headline.
        isProfileIncomplete: (!nameAr && !nameEn) || (!jobTitleAr && !jobTitleEn),
    };
}

/** The `instructor` select used on every public course payload. */
export const publicInstructorSelect = {
    id: true,
    createdAt: true,
    metadata: true,
} satisfies Prisma.UserSelect;

/**
 * Rebuild the public instructor on a course and each of its openings.
 *
 * The public course routes used to select `instructor.email` directly, which
 * contradicted the comment in the same controller about not exposing it and let
 * anyone scrape every teacher's address. The email is no longer selected; this
 * replaces the raw user row with the derived public card.
 */
export function mapPublicCourse<
    T extends {
        instructor: { id: string; createdAt: Date; metadata: Prisma.JsonValue } | null;
        openings: Array<{
            instructor: { id: string; createdAt: Date; metadata: Prisma.JsonValue } | null;
        }>;
    },
>(course: T) {
    // Defensive: this is a pure projection, and the service is also exercised
    // with minimal course rows. A missing relation maps to `null` rather than
    // throwing, so the email scrubbing can never be the thing that breaks a
    // course request.
    const openings = Array.isArray(course.openings) ? course.openings : [];
    return {
        ...course,
        instructor: course.instructor ? toPublicInstructor(course.instructor) : null,
        openings: openings.map((opening) => ({
            ...opening,
            instructor: opening?.instructor ? toPublicInstructor(opening.instructor) : null,
        })),
    };
}
