import { Controller, Get, Post, Patch, Param, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

const STAFF = [Role.ADMIN, Role.COURSE_MANAGER, Role.INSTRUCTOR];

@ApiTags('Analytics (إحصائيات التعلم)')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('analytics')
export class AnalyticsController {
    constructor(private readonly svc: AnalyticsService) {}

    @ApiOperation({ summary: 'Start a learning session' })
    @Roles(Role.STUDENT)
    @Post('session/start')
    startSession(@Body('courseId') courseId: string, @Body('moduleId') moduleId: string | undefined, @Request() req: any) {
        return this.svc.startSession(req.user.userId, courseId, moduleId);
    }

    @ApiOperation({ summary: 'Heartbeat for session' })
    @Roles(Role.STUDENT)
    @Patch('session/:id/heartbeat')
    heartbeat(@Param('id') id: string) {
        return this.svc.heartbeat(id);
    }

    @ApiOperation({ summary: 'Get own learning analytics' })
    @Roles(Role.STUDENT)
    @Get('me')
    getMe(@Request() req: any) {
        return this.svc.getStudentAnalytics(req.user.userId);
    }

    @ApiOperation({ summary: 'Get own analytics for a course' })
    @Roles(Role.STUDENT)
    @Get('me/course/:courseId')
    getMyCourse(@Param('courseId') courseId: string, @Request() req: any) {
        return this.svc.getStudentCourseAnalytics(req.user.userId, courseId);
    }

    @ApiOperation({ summary: 'Get course analytics (instructor)' })
    @Roles(...STAFF)
    @Get('course/:courseId')
    getCourse(@Param('courseId') courseId: string) {
        return this.svc.getCourseAnalytics(courseId);
    }
}
