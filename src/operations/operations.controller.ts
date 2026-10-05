import {
    Body, Controller, ForbiddenException, Get, Headers, NotFoundException, Param, Post, Query, Req, UnauthorizedException, UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { InMemoryRateLimiter } from '../common/in-memory-rate-limiter';
import { OperationsService } from './operations.service';
import { OperationsKeyService } from './operations-tracker.middleware';
import { OperationsQueriesService } from './operations-queries.service';
import {
    EventsQueryDto, OverviewQueryDto, SessionsQueryDto, TimelineQueryDto, TrackEventDto, UnlockDto,
} from './dto/operations.dto';

const UNAUTHENTICATED_TRACKING = ['page_view', 'action'] as const;

/**
 * The operations center API.
 *
 * Three gates stand in front of the read endpoints, and all three are required:
 *
 *   1. A valid ADMIN access token (JwtAuthGuard + RolesGuard).
 *   2. A live operations grant, i.e. the second password was entered
 *      (checked per-request in `assertGranted`).
 *   3. The page itself is unlinked -- there is no nav entry anywhere in the app,
 *      and it is disallowed in robots.txt, so it is reachable only by typing the
 *      path. That is obscurity by design, not a substitute for 1 and 2.
 *
 * The tracking endpoints are public because they must capture anonymous
 * visitors. They accept only a page view or a named action, write only against
 * the caller's own cookie-identified session, and never accept a session id from
 * the client -- otherwise anyone could write events into someone else's device.
 */
@ApiTags('Operations Center')
@Controller('operations')
export class OperationsController {
    /**
     * Unlock attempts are limited per IP and per account. Without this, a leaked
     * admin token would make the second password brute-forceable, which would
     * defeat the entire point of having it.
     */
    private readonly unlockLimiter = new InMemoryRateLimiter(5, 15 * 60 * 1000);

    constructor(
        private readonly ops: OperationsService,
        private readonly queries: OperationsQueriesService,
        private readonly keys: OperationsKeyService,
    ) { }

    // ---------------------------------------------------------------- tracking

    /**
     * Page views and named UI actions. Public, because most traffic is anonymous
     * and the tracker runs before any session exists.
     */
    @Post('track')
    @ApiOperation({ summary: 'Record a page view or a named UI action' })
    async track(@Req() req: any, @Body() dto: TrackEventDto) {
        const sessionId = (req as { opsSessionId?: string | null }).opsSessionId;
        if (!sessionId) {
            // The middleware issues a cookie on the first request, so this only
            // happens when the tracker fires before any page load resolved.
            return { ok: true, skipped: true };
        }

        const isTracked = (UNAUTHENTICATED_TRACKING as readonly string[]).includes(dto.type);
        if (!isTracked) {
            // `api_call` and `security` are server-authored. Accepting them from
            // a browser would let anyone forge both.
            throw new ForbiddenException('This event type is recorded by the server only');
        }
        // Narrowed here because the DTO carries all four types; the guard above
        // is what makes the narrowing true rather than an unchecked assertion.
        const clientEvent = dto as { type: 'page_view' | 'action' };

        await this.ops.trackClientEvent(sessionId, clientEvent);
        if (dto.screen || dto.timezone) {
            await this.ops.enrichSession(sessionId, { screen: dto.screen, timezone: dto.timezone });
        }
        return { ok: true };
    }

    // ----------------------------------------------------------------- unlocking

    @Post('unlock')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    @ApiBearerAuth('JWT-auth')
    @ApiOperation({ summary: 'Exchange the second password for a short-lived grant' })
    async unlock(@Req() req: any, @Body() dto: UnlockDto) {
        const userId = req.user.userId as string;
        const ip = req.ip ?? 'unknown';

        if (!this.unlockLimiter.allow(`ip:${ip}`) || !this.unlockLimiter.allow(`user:${userId}`)) {
            await this.ops.trackSecurity({
                sessionId: (req as { opsSessionId?: string | null }).opsSessionId ?? null,
                label: 'operations.unlock.rate_limited',
                ipAddress: ip,
                userAgent: req.headers['user-agent'] ?? null,
            });
            throw new UnauthorizedException('Too many attempts. Try again later.');
        }

        if (!this.ops.verifyOperationsKey(dto.key)) {
            await this.ops.trackSecurity({
                sessionId: (req as { opsSessionId?: string | null }).opsSessionId ?? null,
                label: 'operations.unlock.failed',
                ipAddress: ip,
                userAgent: req.headers['user-agent'] ?? null,
            });
            // Same message and shape as any other auth failure on purpose: the
            // caller must not be able to tell "wrong password" from "no password
            // configured", and either way gets nothing.
            throw new UnauthorizedException('Incorrect operations password');
        }

        return this.keys.issueGrant(userId);
    }

    // --------------------------------------------------------------------- reads

    @Get('overview')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    @ApiBearerAuth('JWT-auth')
    @ApiOperation({ summary: 'Headline counts and breakdowns for the chosen window' })
    overview(@Req() req: any, @Headers('x-ops-grant') grant: string | undefined, @Query() q: OverviewQueryDto) {
        this.assertGranted(req, grant);
        return this.queries.overview(q.hours ?? 24);
    }

    @Get('timeline')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    @ApiBearerAuth('JWT-auth')
    async timeline(@Req() req: any, @Headers('x-ops-grant') grant: string | undefined, @Query() q: TimelineQueryDto) {
        this.assertGranted(req, grant);
        return this.queries.timeline(q.hours ?? 24);
    }

    @Get('events')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    @ApiBearerAuth('JWT-auth')
    async events(@Req() req: any, @Headers('x-ops-grant') grant: string | undefined, @Query() q: EventsQueryDto) {
        this.assertGranted(req, grant);
        const result = await this.queries.events({
            type: q.type,
            sessionId: q.sessionId,
            search: q.search,
            from: q.from ? new Date(q.from) : undefined,
            to: q.to ? new Date(q.to) : undefined,
            authenticatedOnly: q.authenticatedOnly,
            skip: q.skip ?? 0,
            take: q.take ?? 50,
        });
        return { ...result, skip: q.skip ?? 0, take: q.take ?? 50 };
    }

    @Get('sessions')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    @ApiBearerAuth('JWT-auth')
    async sessions(@Req() req: any, @Headers('x-ops-grant') grant: string | undefined, @Query() q: SessionsQueryDto) {
        this.assertGranted(req, grant);
        const result = await this.queries.sessions({
            search: q.search,
            deviceType: q.deviceType,
            authenticatedOnly: q.authenticatedOnly,
            botsOnly: q.botsOnly,
            from: q.from ? new Date(q.from) : undefined,
            skip: q.skip ?? 0,
            take: q.take ?? 50,
        });
        return { ...result, skip: q.skip ?? 0, take: q.take ?? 50 };
    }

    @Get('sessions/:id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    @ApiBearerAuth('JWT-auth')
    async sessionDetail(@Req() req: any, @Headers('x-ops-grant') grant: string | undefined, @Param('id') id: string) {
        this.assertGranted(req, grant);
        const detail = await this.queries.sessionDetail(id);
        if (!detail) throw new NotFoundException('Session not found');
        return detail;
    }

    @Get('filter-options')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    @ApiBearerAuth('JWT-auth')
    async filterOptions(@Req() req: any, @Headers('x-ops-grant') grant: string | undefined) {
        this.assertGranted(req, grant);
        return this.queries.filterOptions();
    }

    /**
     * The gate every read endpoint shares. Kept as one method so a new endpoint
     * physically cannot forget it: forgetting the grant check would leave a
     * readable route behind a login that anyone with an admin token can pass.
     */
    private assertGranted(req: any, grant: string | undefined): void {
        if (!this.keys.verifyGrant(grant, req.user.userId as string)) {
            void this.ops.trackSecurity({
                sessionId: (req as { opsSessionId?: string | null }).opsSessionId ?? null,
                label: 'operations.access.denied',
                ipAddress: req.ip ?? null,
                userAgent: req.headers['user-agent'] ?? null,
            });
            throw new UnauthorizedException('Operations center is locked');
        }
    }
}
