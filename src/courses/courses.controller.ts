import { Controller, Get, Post, Patch, Body, Param, Delete, UseGuards, Request, Ip, UseInterceptors, UploadedFile, BadRequestException, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { existsSync, mkdirSync } from 'fs';
import { CoursesService } from './courses.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { CreateCourseDto } from './dto/create-course.dto';
import { CreateOpeningDto } from './dto/create-opening.dto';

const ALLOWED_IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const ALLOWED_VIDEO_MIMES = ['video/mp4', 'video/webm', 'video/quicktime'];

@ApiTags('Courses Management')
@Controller('courses')
export class CoursesController {
    constructor(private readonly coursesService: CoursesService) { }

    @ApiBearerAuth('JWT-auth')
    @ApiOperation({ summary: 'Create a new course (Managers/Admins)' })
    @ApiResponse({ status: 201, description: 'Course created.' })
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN, Role.COURSE_MANAGER)
    @Post()
    create(@Body() createCourseDto: CreateCourseDto, @Request() req: any) {
        return this.coursesService.create(createCourseDto, req.user.userId);
    }

    @ApiBearerAuth('JWT-auth')
    @ApiOperation({ summary: 'Upload course media (images/videos). kind=cover|gallery|video|general via query' })
    @ApiConsumes('multipart/form-data')
    @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
    @ApiResponse({ status: 201, description: 'Media URL returned.' })
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN, Role.COURSE_MANAGER)
    @Post('media')
    @UseInterceptors(FileInterceptor('file', {
        storage: diskStorage({
            destination: (req: any, file, cb) => {
                const kind = (req.query.kind as string) || 'general';
                const safeKind = /^[a-z0-9_-]+$/i.test(kind) ? kind : 'general';
                const dir = `./uploads/courses/${safeKind}`;
                if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
                cb(null, dir);
            },
            filename: (req: any, file, cb) => {
                const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
                // Use fixed extension based on validated MIME type
                const mimeToExt: Record<string, string> = {
                    'image/jpeg': '.jpg',
                    'image/png': '.png',
                    'image/webp': '.webp',
                    'image/gif': '.gif',
                    'video/mp4': '.mp4',
                    'video/webm': '.webm',
                    'video/quicktime': '.mov',
                };
                const ext = mimeToExt[file.mimetype] || '.bin';
                cb(null, `course-${uniqueSuffix}${ext}`);
            }
        }),
        fileFilter: (req, file, cb) => {
            const allowed = ALLOWED_IMAGE_MIMES.includes(file.mimetype) || ALLOWED_VIDEO_MIMES.includes(file.mimetype);
            if (allowed) {
                cb(null, true);
            } else {
                cb(new BadRequestException('Only JPEG, PNG, WEBP, GIF images and MP4/WEBM/MOV videos are allowed.'), false);
            }
        },
        limits: {
            fileSize: 100 * 1024 * 1024 // 100MB
        }
    }))
    uploadMedia(
        @UploadedFile() file: any,
        @Query('kind') kind: string,
        @Request() req: any
    ) {
        if (!file) {
            throw new BadRequestException('File is required.');
        }
        const safeKind = /^[a-z0-9_-]+$/i.test(kind || '') ? kind : 'general';
        return {
            url: `/uploads/courses/${safeKind}/${file.filename}`,
            kind: safeKind,
            size: file.size,
            mimetype: file.mimetype,
        };
    }

    @ApiOperation({ summary: 'List all published courses' })
    @ApiResponse({ status: 200, description: 'List of courses returned.' })
    @Get()
    findAll(@Query('includeUnpublished') includeUnpublished?: string, @Request() req?: any) {
        // Only allow includeUnpublished for authenticated staff users
        const allowUnpublished = includeUnpublished === 'true' && req?.user?.role && ['ADMIN', 'COURSE_MANAGER'].includes(req.user.role);
        return this.coursesService.findAll(allowUnpublished);
    }

    @ApiBearerAuth('JWT-auth')
    @ApiOperation({ summary: 'Open/create a new opening (batch) for a course' })
    @ApiResponse({ status: 201, description: 'Course opening created.' })
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN, Role.COURSE_MANAGER)
    @Post(':id/openings')
    createOpening(@Param('id') id: string, @Body() dto: CreateOpeningDto) {
        return this.coursesService.createOpening(id, dto);
    }

    @ApiOperation({ summary: 'List openings (batches) of a course' })
    @ApiResponse({ status: 200, description: 'Openings returned.' })
    @Get(':id/openings')
    listOpenings(@Param('id') id: string, @Query('includeUnpublished') includeUnpublished?: string, @Request() req?: any) {
        const allowUnpublished = includeUnpublished === 'true' && req?.user?.role && ['ADMIN', 'COURSE_MANAGER'].includes(req.user.role);
        return this.coursesService.listOpenings(id, allowUnpublished);
    }

    @ApiOperation({ summary: 'Get specific course details' })
    @ApiResponse({ status: 200, description: 'Detailed course structure returned.' })
    @ApiResponse({ status: 404, description: 'Course not found.' })
    @Get(':id')
    findOne(@Param('id') id: string, @Query('includeUnpublished') includeUnpublished?: string, @Request() req?: any) {
        const allowUnpublished = includeUnpublished === 'true' && req?.user?.role && ['ADMIN', 'COURSE_MANAGER'].includes(req.user.role);
        return this.coursesService.findOne(id, allowUnpublished);
    }

    @ApiBearerAuth('JWT-auth')
    @ApiOperation({ summary: 'Update a course (Managers/Admins)' })
    @ApiResponse({ status: 200, description: 'Course updated.' })
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN, Role.COURSE_MANAGER)
    @Patch(':id')
    update(@Param('id') id: string, @Body() updateCourseDto: CreateCourseDto) {
        return this.coursesService.update(id, updateCourseDto);
    }

    @ApiBearerAuth('JWT-auth')
    @ApiOperation({ summary: 'Delete a course (Admins/Course Managers)' })
    @ApiResponse({ status: 200, description: 'Course successfully deleted.' })
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN, Role.COURSE_MANAGER)
    @Delete(':id')
    remove(@Param('id') id: string, @Request() req: any, @Ip() ip: string) {
        return this.coursesService.remove(id, req.user.userId, ip);
    }
}