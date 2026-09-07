import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, Request, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { TasksService } from './tasks.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

const STAFF_ROLES = [Role.ADMIN, Role.COURSE_MANAGER, Role.INSTRUCTOR];

@ApiTags('Tasks (المهام الدراسية)')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('tasks')
export class TasksController {
    constructor(private readonly tasksService: TasksService) { }

    @ApiOperation({ summary: 'List tasks for an opening (students see enrolled tasks; staff see their own openings)' })
    @Get('opening/:openingId')
    list(@Param('openingId') openingId: string, @Request() req: any) {
        return this.tasksService.listTasks(openingId, req.user.userId, req.user.role);
    }

    @ApiOperation({ summary: 'Create a task for an opening (instructor of the opening or staff)' })
    @ApiResponse({ status: 201, description: 'Task created.' })
    @Roles(...STAFF_ROLES)
    @Post('opening/:openingId')
    create(
        @Param('openingId') openingId: string,
        @Body('titleAr') titleAr: string,
        @Body('titleEn') titleEn: string,
        @Body('descriptionAr') descriptionAr: string | undefined,
        @Body('descriptionEn') descriptionEn: string | undefined,
        @Body('dueDate') dueDate: string | undefined,
        @Body('maxScore') maxScore: number | undefined,
        @Body('moduleId') moduleId: string | undefined,
        @Body('attachmentUrl') attachmentUrl: string | undefined,
        @Body('attachmentType') attachmentType: string | undefined,
        @Body('links') links: { url: string; labelAr?: string; labelEn?: string }[] | undefined,
        @Request() req: any,
    ) {
        return this.tasksService.createTask(openingId, { titleAr, titleEn, descriptionAr, descriptionEn, dueDate, maxScore, moduleId, attachmentUrl, attachmentType, links }, req.user.userId, req.user.role);
    }

    @ApiOperation({ summary: 'Update a task' })
    @Roles(...STAFF_ROLES)
    @Patch(':id')
    update(
        @Param('id') id: string,
        @Body('titleAr') titleAr: string | undefined,
        @Body('titleEn') titleEn: string | undefined,
        @Body('descriptionAr') descriptionAr: string | undefined,
        @Body('descriptionEn') descriptionEn: string | undefined,
        @Body('dueDate') dueDate: string | undefined,
        @Body('maxScore') maxScore: number | undefined,
        @Body('moduleId') moduleId: string | undefined,
        @Body('attachmentUrl') attachmentUrl: string | undefined,
        @Body('attachmentType') attachmentType: string | undefined,
        @Body('links') links: { url: string; labelAr?: string; labelEn?: string }[] | undefined,
        @Request() req: any,
    ) {
        return this.tasksService.updateTask(id, { titleAr, titleEn, descriptionAr, descriptionEn, dueDate, maxScore, moduleId, attachmentUrl, attachmentType, links }, req.user.userId, req.user.role);
    }

    @ApiOperation({ summary: 'Delete a task' })
    @Roles(...STAFF_ROLES)
    @Delete(':id')
    remove(@Param('id') id: string, @Request() req: any) {
        return this.tasksService.deleteTask(id, req.user.userId, req.user.role);
    }

    @ApiOperation({ summary: 'Student submits (or updates) their answer for a task' })
    @ApiResponse({ status: 201, description: 'Submission saved.' })
    @Roles(Role.STUDENT)
    @Post(':id/submit')
    submit(
        @Param('id') id: string,
        @Body('content') content: string | undefined,
        @Body('attachmentUrl') attachmentUrl: string | undefined,
        @Request() req: any,
    ) {
        return this.tasksService.submitTask(id, req.user.userId, { content, attachmentUrl });
    }

    @ApiOperation({ summary: 'Student reads their own submission for a task' })
    @Roles(Role.STUDENT)
    @Get(':id/my-submission')
    mySubmission(@Param('id') id: string, @Request() req: any) {
        return this.tasksService.getMySubmission(id, req.user.userId);
    }

    @ApiOperation({ summary: 'List submissions for a task (staff/own openings)' })
    @Roles(...STAFF_ROLES)
    @Get(':id/submissions')
    submissions(@Param('id') id: string, @Request() req: any) {
        return this.tasksService.getSubmissions(id, req.user.userId, req.user.role);
    }

    @ApiOperation({ summary: 'Grade a student submission (score + notes)' })
    @Roles(...STAFF_ROLES)
    @Patch('submissions/:submissionId/grade')
    grade(
        @Param('submissionId') submissionId: string,
        @Body('score') score: number,
        @Body('notes') notes: string | undefined,
        @Request() req: any,
    ) {
        return this.tasksService.gradeSubmission(submissionId, req.user.userId, req.user.role, score, notes);
    }
}