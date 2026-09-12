import { Controller, Post, Body, Param, Patch, UseGuards, Request, Ip, UseInterceptors, UploadedFile, BadRequestException, Get } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { EnrollmentsService } from './enrollments.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role, EnrollmentStatus } from '@prisma/client';
import { existsSync, mkdirSync, unlink } from 'fs';
import { hasValidSignature } from '../common/file-signatures';

// Ensure upload directory exists
const uploadDir = './uploads/receipts';
if (!existsSync(uploadDir)) {
    mkdirSync(uploadDir, { recursive: true });
}

@ApiTags('Enrollments & Receipts')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('enrollments')
export class EnrollmentsController {
    constructor(private readonly enrollmentsService: EnrollmentsService) { }

    @ApiOperation({ summary: 'Admin/Course Manager directly enroll a student into a course opening (APPROVED)' })
    @ApiResponse({ status: 201, description: 'Student enrolled into the course.' })
    @Roles(Role.COURSE_MANAGER, Role.ADMIN)
    @Post('admin')
    enrollStudent(
        @Body('courseId') courseId: string,
        @Body('studentId') studentId: string,
        @Body('openingId') openingId: string | undefined,
        @Request() req: any,
        @Ip() ip: string
    ) {
        if (!courseId || !studentId) {
            throw new BadRequestException('courseId and studentId are required.');
        }
        return this.enrollmentsService.enrollByAdmin(courseId, studentId, req.user.userId, openingId, ip);
    }

    @ApiOperation({ summary: 'Enroll a student into a published course opening and upload payment receipt' })
    @ApiResponse({ status: 201, description: 'Successfully enrolled as PENDING with receipt.' })
    @Roles(Role.STUDENT)
    @Post()
    @UseInterceptors(FileInterceptor('receipt', {
        storage: diskStorage({
            destination: './uploads/receipts',
            filename: (req, file, cb) => {
                const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
                // Use fixed extension based on validated MIME type
                const mimeToExt: Record<string, string> = {
                    'image/jpeg': '.jpg',
                    'image/png': '.png',
                    'application/pdf': '.pdf',
                };
                const ext = mimeToExt[file.mimetype] || '.pdf';
                cb(null, `receipt-${uniqueSuffix}${ext}`);
            }
        }),
        fileFilter: (req, file, cb) => {
            if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/png' || file.mimetype === 'application/pdf') {
                cb(null, true);
            } else {
                cb(new BadRequestException('Only JPEG, PNG and PDF files are allowed.'), false);
            }
        },
        limits: {
            fileSize: 5 * 1024 * 1024, // 5MB
            files: 1,
            fields: 20,
            parts: 30,
        }
    }))
    enrollWithReceipt(
        @Body('openingId') openingId: string,
        @UploadedFile() file: any,
        @Request() req: any,
        @Ip() ip: string
    ) {
        if (!file) {
            throw new BadRequestException('Receipt file is required.');
        }
        if (!hasValidSignature(file.path, file.mimetype)) {
            unlink(file.path, () => { /* best-effort cleanup */ });
            throw new BadRequestException('Receipt content does not match its declared type.');
        }
        if (!openingId) {
            throw new BadRequestException('openingId is required.');
        }
        const receiptUrl = `/uploads/receipts/${file.filename}`;
        return this.enrollmentsService.enrollWithReceipt(openingId, receiptUrl, req.user.id || req.user.userId, ip);
    }

    @ApiOperation({ summary: 'Reserve a seat without payment' })
    @ApiResponse({ status: 201, description: 'Seat reserved successfully' })
    @Roles(Role.STUDENT)
    @Post('reserve')
    reserveSeat(
        @Body('courseId') courseId: string,
        @Request() req: any,
        @Ip() ip: string
    ) {
        return this.enrollmentsService.reserveSeat(courseId, req.user.id || req.user.userId, ip);
    }

    @ApiOperation({ summary: 'Get pending enrollments for finance review' })
    @Roles(Role.FINANCE, Role.ADMIN)
    @Get('pending')
    getPendingRequests() {
        return this.enrollmentsService.getPending();
    }

    @ApiOperation({ summary: 'Get current student enrollments' })
    @Roles(Role.STUDENT)
    @Get('my')
    getMyEnrollments(@Request() req: any) {
        return this.enrollmentsService.getMyEnrollments(req.user.userId);
    }

    @ApiOperation({ summary: 'Get current student grades across enrolled courses' })
    @Roles(Role.STUDENT)
    @Get('my/grades')
    getMyGrades(@Request() req: any) {
        return this.enrollmentsService.getMyGrades(req.user.userId);
    }

    @ApiOperation({ summary: 'Get all enrollments history for finance review' })
    @Roles(Role.FINANCE, Role.ADMIN)
    @Get('all')
    getAllEnrollments() {
        return this.enrollmentsService.getAllEnrollments();
    }

    @ApiOperation({ summary: 'Finance/Admin review enrollment receipt' })
    @ApiResponse({ status: 200, description: 'Enrollment status updated (APPROVED/REJECTED).' })
    @Roles(Role.FINANCE, Role.ADMIN)
    @Patch(':id/review')
    review(
        @Param('id') enrollmentId: string,
        @Body('status') status: EnrollmentStatus,
        @Request() req: any,
        @Ip() ip: string,
        @Body('notes') notes?: string,
    ) {
        return this.enrollmentsService.review(enrollmentId, status, req.user.userId, ip, notes);
    }
}
