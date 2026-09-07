import { Controller, Get, Post, Param, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RubricsService } from './rubrics.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

const STAFF = [Role.ADMIN, Role.COURSE_MANAGER, Role.INSTRUCTOR];

@ApiTags('Rubrics & Peer Review (تقييم الأقران)')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('rubrics')
export class RubricsController {
    constructor(private readonly svc: RubricsService) {}

    @ApiOperation({ summary: 'Create rubric for a task' })
    @Roles(...STAFF)
    @Post('task/:taskId')
    create(@Param('taskId') taskId: string, @Body() dto: any, @Request() req: any) {
        return this.svc.createRubric(taskId, dto, req.user.userId, req.user.role);
    }

    @ApiOperation({ summary: 'Get rubric for a task' })
    @Get('task/:taskId')
    getForTask(@Param('taskId') taskId: string) {
        return this.svc.getRubric(taskId);
    }

    @ApiOperation({ summary: 'Submit peer review' })
    @Roles(Role.STUDENT)
    @Post(':id/review')
    submitReview(@Param('id') id: string, @Body() dto: any, @Request() req: any) {
        return this.svc.submitReview(id, dto.submissionId, req.user.userId, dto);
    }

    @ApiOperation({ summary: 'Get reviews for a submission' })
    @Get('submission/:submissionId/reviews')
    getReviews(@Param('submissionId') submissionId: string) {
        return this.svc.getReviewsForSubmission(submissionId);
    }

    @ApiOperation({ summary: 'Assign random peer reviews' })
    @Roles(...STAFF)
    @Post(':id/assign')
    assign(@Param('id') id: string, @Body('count') count: number) {
        return this.svc.assignRandomReviews(id, count || 2);
    }
}
