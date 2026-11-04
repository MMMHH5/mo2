import { randomUUID } from 'crypto';
import { extname } from 'path';
import { Controller, Get, Post, Patch, Put, Delete, Param, Query, Body, Request, UseGuards, BadRequestException, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { LessonsService } from './lessons.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { hasValidUploadedSignature } from '../common/file-signatures';
import { createUploadStorage, removeUploadedFile, uploadUrl } from '../common/upload-storage';

const lessonUploadDir = './uploads/lessons';

function lessonFileName(originalName: string | undefined) {
  const extension = extname((originalName || '').replace(/\\/g, '/').split('/').pop() || '').toLowerCase();
  return `lesson-${randomUUID()}${/^\.[a-z0-9]{1,12}$/.test(extension) ? extension : ''}`;
}

@ApiTags('LMS: Lessons & Progress')
@ApiBearerAuth('JWT-auth')
@Controller('lms')
export class LessonsController {
  constructor(private lessons: LessonsService) {}

  @ApiOperation({ summary: 'Public syllabus for a course (modules + outcomes + quizzes + live sessions)' })
  @Get('courses/:courseId/syllabus')
  syllabus(@Param('courseId') courseId: string) {
    return this.lessons.syllabus(courseId);
  }

  @ApiOperation({ summary: 'My progress in a course (must be enrolled)' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.STUDENT, Role.INSTRUCTOR, Role.COURSE_MANAGER, Role.FINANCE, Role.ADMIN)
  @Get('courses/:courseId/my-progress')
  myProgress(@Param('courseId') courseId: string, @Request() req: any) {
    return this.lessons.courseProgress(courseId, req.user.userId);
  }

  @ApiOperation({ summary: 'List isolated learning content for an open course batch' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.INSTRUCTOR, Role.COURSE_MANAGER, Role.ADMIN)
  @Get('openings/:openingId/modules')
  openingModules(@Param('openingId') openingId: string, @Request() req: any) {
    return this.lessons.openingModulesForInstructor(openingId, req.user.userId, req.user.role);
  }

  @ApiOperation({ summary: 'Add a lesson to an open course batch only' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.INSTRUCTOR, Role.COURSE_MANAGER, Role.ADMIN)
  @Post('openings/:openingId/modules')
  createOpeningModule(@Param('openingId') openingId: string, @Body() dto: any, @Request() req: any) {
    return this.lessons.createOpeningModule(openingId, dto, req.user.userId, req.user.role);
  }

  @ApiOperation({ summary: 'Edit lesson content for one open course batch' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.INSTRUCTOR, Role.COURSE_MANAGER, Role.ADMIN)
  @Patch('openings/:openingId/modules/:moduleId')
  updateOpeningModule(@Param('openingId') openingId: string, @Param('moduleId') moduleId: string, @Body() dto: any, @Request() req: any) {
    return this.lessons.updateOpeningModule(openingId, moduleId, dto, req.user.userId, req.user.role);
  }

  @ApiOperation({ summary: 'Upload a lesson attachment for an open course batch' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.INSTRUCTOR, Role.COURSE_MANAGER, Role.ADMIN)
  @Post('openings/:openingId/modules/files')
  @UseInterceptors(FileInterceptor('file', {
    storage: createUploadStorage({
      destination: () => lessonUploadDir,
      filename: (_req, file) => lessonFileName(file.originalname),
    }),
    limits: { fileSize: 50 * 1024 * 1024, files: 1, fields: 5, fieldSize: 1 * 1024 * 1024, parts: 8 },
  }))
  async uploadOpeningModuleFile(
    @Param('openingId') openingId: string,
    @UploadedFile() file: Express.Multer.File,
    @Request() req: any,
  ) {
    if (!file) throw new BadRequestException('File is required.');
    try {
      await this.lessons.assertCanUploadOpeningFile(openingId, req.user.userId, req.user.role);
      if (file.mimetype && !hasValidUploadedSignature(file)) {
        throw new BadRequestException('File content does not match its declared type.');
      }
    } catch (error) {
      await removeUploadedFile(file);
      throw error;
    }
    return {
      url: uploadUrl(file),
      name: file.originalname || file.filename,
      size: file.size,
      mimetype: file.mimetype || null,
    };
  }

  @ApiOperation({ summary: 'Mark a module complete' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.STUDENT)
  @Post('progress')
  markComplete(@Body('enrollmentId') enrollmentId: string, @Body('moduleId') moduleId: string, @Request() req: any) {
    if (!enrollmentId || !moduleId) throw new BadRequestException('enrollmentId and moduleId are required');
    return this.lessons.markComplete(enrollmentId, moduleId, req.user.userId);
  }

  @ApiOperation({ summary: 'Mark a module incomplete' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.STUDENT)
  @Delete('progress/:moduleId')
  markIncomplete(@Param('moduleId') moduleId: string, @Query('enrollmentId') enrollmentId: string, @Request() req: any) {
    if (!enrollmentId) throw new BadRequestException('enrollmentId is required');
    return this.lessons.markIncomplete(enrollmentId, moduleId, req.user.userId);
  }

  @ApiOperation({ summary: 'My private notes per lesson (must be enrolled)' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.STUDENT)
  @Get('courses/:courseId/my-notes')
  myNotes(@Param('courseId') courseId: string, @Request() req: any) {
    return this.lessons.myNotes(courseId, req.user.userId);
  }

  @ApiOperation({ summary: 'Auto-save my note for a lesson' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.STUDENT)
  @Put('notes/:moduleId')
  saveNote(@Param('moduleId') moduleId: string, @Body('content') content: string, @Request() req: any) {
    if (typeof content !== 'string') throw new BadRequestException('content is required');
    return this.lessons.saveNote(moduleId, content, req.user.userId);
  }
}