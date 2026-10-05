import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { Transform, Type } from 'class-transformer';

/**
 * Query params arrive as strings, and `Boolean("false")` is `true` -- so the
 * obvious `@Type(() => Boolean)` silently turns `?authenticatedOnly=false`
 * into a filter that keeps only signed-in devices. This reads the actual value.
 */
const toOptionalBoolean = ({ value }: { value: unknown }): boolean | undefined => {
    if (value === undefined || value === null || value === '') return undefined;
    if (typeof value === 'boolean') return value;
    const normalized = String(value).trim().toLowerCase();
    if (normalized === 'true' || normalized === '1') return true;
    if (normalized === 'false' || normalized === '0') return false;
    return undefined;
};

export class UnlockDto {
    @IsString()
    @MinLength(1)
    @MaxLength(200)
    key!: string;
}

const EVENT_TYPES = ['page_view', 'api_call', 'action', 'security'] as const;

export class TrackEventDto {
    @IsIn(EVENT_TYPES)
    type!: (typeof EVENT_TYPES)[number];

    @IsOptional() @IsString() @MaxLength(300)
    path?: string;

    @IsOptional() @IsString() @MaxLength(200)
    label?: string;

    @IsOptional() @IsString() @MaxLength(40)
    screen?: string;

    @IsOptional() @IsString() @MaxLength(60)
    timezone?: string;

    /** Allow-listed server-side; unknown keys are dropped, never stored. */
    @IsOptional()
    meta?: Record<string, unknown>;
}

export class OverviewQueryDto {
    @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(24 * 30)
    hours?: number;
}

export class TimelineQueryDto {
    @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(24 * 30)
    hours?: number;
}

export class EventsQueryDto {
    @IsOptional() @IsIn(EVENT_TYPES)
    type?: string;

    @IsOptional() @IsString() @MaxLength(64)
    sessionId?: string;

    @IsOptional() @IsString() @MaxLength(120)
    search?: string;

    @IsOptional() @Type(() => Number) @IsInt() @Min(0)
    from?: number;

    @IsOptional() @Type(() => Number) @IsInt() @Min(0)
    to?: number;

    @IsOptional() @Transform(toOptionalBoolean) @IsBoolean()
    authenticatedOnly?: boolean;

    @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100000)
    skip?: number;

    @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200)
    take?: number;
}

export class SessionsQueryDto {
    @IsOptional() @IsString() @MaxLength(120)
    search?: string;

    @IsOptional() @IsString() @MaxLength(40)
    deviceType?: string;

    @IsOptional() @Transform(toOptionalBoolean) @IsBoolean()
    authenticatedOnly?: boolean;

    @IsOptional() @Transform(toOptionalBoolean) @IsBoolean()
    botsOnly?: boolean;

    @IsOptional() @Type(() => Number) @IsInt() @Min(0)
    from?: number;

    @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100000)
    skip?: number;

    @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200)
    take?: number;
}
