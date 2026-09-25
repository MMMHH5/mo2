import { Controller, Post, Get, Patch, Param, Body, UseGuards, Request, UseInterceptors, UploadedFile, BadRequestException, Res } from '@nestjs/common';
import { InstructorApplicationsService } from './instructor-applications.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { existsSync, mkdirSync, unlink } from 'fs';
import { basename } from 'path';
import { Response } from 'express';
import { Role } from '@prisma/client';
import { hasValidSignature } from '../common/file-signatures';

// CVs are private: stored OUTSIDE the publicly-served uploads tree
// (uploads/private/...) and only downloadable via GET :id/cv.
const uploadDir = './uploads/private/cvs';
if (!existsSync(uploadDir)) {
    mkdirSync(uploadDir, { recursive: true });
}

@Controller('instructor-applications')
export class InstructorApplicationsController {
    constructor(private readonly instructorApplicationsService: InstructorApplicationsService) { }

    @Get()
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN, Role.COURSE_MANAGER)
    async getApplications() {
        return this.instructorApplicationsService.getApplications();
    }

    @Get('my')
    @UseGuards(JwtAuthGuard)
    async getMyApplication(@Request() req: any) {
        return this.instructorApplicationsService.getMyApplication(req.user.id || req.user.userId);
    }

    @Post()
    @UseGuards(JwtAuthGuard)
    @UseInterceptors(FileInterceptor('cv', {
        storage: diskStorage({
            destination: './uploads/private/cvs',
            filename: (req, file, cb) => {
                const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
                // Use fixed extension based on validated MIME type
                const mimeToExt: Record<string, string> = {
                    'application/pdf': '.pdf',
                    'application/msword': '.doc',
                    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
                    'text/plain': '.txt',
                };
                const ext = mimeToExt[file.mimetype] || '.pdf';
                cb(null, `cv-${uniqueSuffix}${ext}`);
            }
        }),
        fileFilter: (req, file, cb) => {
            const allowedMimes = [
                'application/pdf',
                'application/msword',
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'text/plain',
            ];
            if (allowedMimes.includes(file.mimetype)) {
                cb(null, true);
            } else {
                cb(new BadRequestException('Only PDF, DOC, DOCX, and TXT files are allowed.'), false);
            }
        },
        limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 20, parts: 30 } // 10MB
    }))
    async createApplication(
        @UploadedFile() file: any,
        @Body() data: any,
        @Request() req: any
    ) {
        if (!file) throw new BadRequestException('CV file is required.');
        if (!hasValidSignature(file.path, file.mimetype)) {
            unlink(file.path, () => { /* best-effort cleanup */ });
            throw new BadRequestException('CV content does not match its declared type.');
        }
        const cvFileUrl = `/uploads/private/cvs/${file.filename}`;
        return this.instructorApplicationsService.createApplication(req.user.id || req.user.userId, data, cvFileUrl);
    }

    @Patch(':id/status')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN, Role.COURSE_MANAGER)
    async updateStatus(
        @Param('id') id: string,
        @Body('status') status: 'APPROVED' | 'REJECTED',
        @Request() req: any
    ) {
        return this.instructorApplicationsService.updateApplicationStatus(id, status, req.user.id || req.user.userId);
    }

    @Get(':id/cv')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN, Role.COURSE_MANAGER)
    async downloadCv(@Param('id') id: string, @Res() res: Response) {
        const abs = await this.instructorApplicationsService.getCvPath(id);
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
        res.setHeader('Content-Disposition', `inline; filename="${basename(abs).replace(/["\\\r\n]/g, '')}"`);
        return res.sendFile(abs);
    }
}
