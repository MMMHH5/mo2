import { Body, Controller, Get, Param, Patch, Post, Query, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { PERMISSIONS } from '../auth/permissions/permissions';
import { CourseInterestsService } from './course-interests.service';

@ApiTags('Public course interests')
@Controller('public/course-interests')
export class PublicCourseInterestsController {
    constructor(private readonly interests: CourseInterestsService) {}

    @Post()
    @Throttle({ default: { ttl: 60_000, limit: 5 } })
    @ApiOperation({ summary: 'Register interest in a published course for future contact' })
    register(@Body() body: { courseId?: unknown; contactMethod?: unknown; contactValue?: unknown }) {
        return this.interests.register(body);
    }
}

@ApiTags('Admin course interests')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles(Role.ADMIN, Role.COURSE_MANAGER)
@RequirePermissions(PERMISSIONS.COURSES_READ)
@Controller('admin/course-interests')
export class AdminCourseInterestsController {
    constructor(private readonly interests: CourseInterestsService) {}

    @Get()
    @ApiOperation({ summary: 'List course availability interests' })
    list(@Query('status') status?: string) {
        return this.interests.list(status);
    }

    @Patch(':id/contacted')
    @RequirePermissions(PERMISSIONS.COURSES_WRITE)
    @ApiOperation({ summary: 'Mark a course interest as contacted' })
    markContacted(@Param('id') id: string, @Request() req: { user: { userId: string } }) {
        return this.interests.markContacted(id, req.user.userId);
    }
}
