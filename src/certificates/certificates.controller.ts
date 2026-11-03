import { Controller, Get, Param, Request, UseGuards, Post, Body, BadRequestException, Patch, Delete, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse, ApiBody, ApiConsumes } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { CertificatesService } from './certificates.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { StepUpGuard } from '../auth/guards/step-up.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { PERMISSIONS } from '../auth/permissions/permissions';
import { Role } from '@prisma/client';
import { createUploadStorage, removeUploadedFile, uploadUrl } from '../common/upload-storage';
import { hasValidUploadedSignature } from '../common/file-signatures';
import type { CertificateAssetKind } from './certificates.service';

const CERTIFICATE_ASSET_KINDS: readonly CertificateAssetKind[] = [
    'teacherSignature',
    'directorSignature',
    'academyStamp',
];
const CERTIFICATE_IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp'];

const CERT_STAFF_ROLES = [Role.INSTRUCTOR, Role.ADMIN, Role.COURSE_MANAGER];

@ApiTags('Certificates (الشهادات)')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Controller('certificates')
export class CertificatesController {
    constructor(private readonly certificatesService: CertificatesService) { }

    @ApiOperation({ summary: 'Read the certificate template and its saved signatures (admin / course manager)' })
    @Roles(Role.ADMIN, Role.COURSE_MANAGER)
    @RequirePermissions(PERMISSIONS.CERTIFICATES_MANAGE)
    @Get('template')
    getTemplate() {
        return this.certificatesService.getTemplate();
    }

    @ApiOperation({ summary: 'Update certificate text and branding (admin / course manager)' })
    @Roles(Role.ADMIN, Role.COURSE_MANAGER)
    @RequirePermissions(PERMISSIONS.CERTIFICATES_MANAGE)
    @Patch('template')
    updateTemplate(@Body() body: Record<string, unknown>, @Request() req: any) {
        return this.certificatesService.updateTemplate(body, req.user.userId);
    }

    @ApiOperation({ summary: 'Get certificate issuance counts by status and eligible courses' })
    @Roles(Role.ADMIN, Role.COURSE_MANAGER)
    @RequirePermissions(PERMISSIONS.CERTIFICATES_MANAGE)
    @Get('management')
    managementOverview() {
        return this.certificatesService.managementOverview();
    }

    @ApiOperation({ summary: 'Save a teacher signature, director signature, or academy stamp image' })
    @ApiConsumes('multipart/form-data')
    @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
    @Roles(Role.ADMIN, Role.COURSE_MANAGER)
    @RequirePermissions(PERMISSIONS.CERTIFICATES_MANAGE)
    @Post('template/assets')
    @UseInterceptors(FileInterceptor('file', {
        storage: createUploadStorage({
            destination: () => './uploads/certificates',
            filename: (_req, file) => {
                const extension = file.mimetype === 'image/png' ? '.png'
                    : file.mimetype === 'image/webp' ? '.webp' : '.jpg';
                return `certificate-${Date.now()}-${Math.round(Math.random() * 1e9)}${extension}`;
            },
        }),
        fileFilter: (_req, file, callback) => {
            if (CERTIFICATE_IMAGE_MIMES.includes(file.mimetype)) callback(null, true);
            else callback(new BadRequestException('Only PNG, JPEG, and WEBP images are allowed.'), false);
        },
        limits: { fileSize: 2 * 1024 * 1024, fieldSize: 64 * 1024, fields: 4, files: 1, parts: 6 },
    }))
    async saveTemplateAsset(
        @UploadedFile() file: Express.Multer.File,
        @Query('kind') kind: string,
        @Query('instructorId') instructorId: string,
        @Request() req: any,
    ) {
        if (!CERTIFICATE_ASSET_KINDS.includes(kind as CertificateAssetKind)) {
            if (file) await removeUploadedFile(file);
            throw new BadRequestException('Choose a valid certificate asset type.');
        }
        if (!file) throw new BadRequestException('An image file is required.');
        if (!hasValidUploadedSignature(file)) {
            await removeUploadedFile(file);
            throw new BadRequestException('File content does not match its declared image type.');
        }
        if (kind === 'teacherSignature') {
            if (!instructorId) {
                await removeUploadedFile(file);
                throw new BadRequestException('Select the instructor for this signature.');
            }
            return this.certificatesService.setInstructorSignature(instructorId, uploadUrl(file), req.user.userId);
        }
        return this.certificatesService.setTemplateAsset(kind as CertificateAssetKind, uploadUrl(file), req.user.userId);
    }

    @ApiOperation({ summary: 'Remove a saved certificate signature or academy stamp' })
    @Roles(Role.ADMIN, Role.COURSE_MANAGER)
    @RequirePermissions(PERMISSIONS.CERTIFICATES_MANAGE)
    @Delete('template/assets/:kind')
    removeTemplateAsset(@Param('kind') kind: string, @Query('instructorId') instructorId: string, @Request() req: any) {
        if (!CERTIFICATE_ASSET_KINDS.includes(kind as CertificateAssetKind)) {
            throw new BadRequestException('Choose a valid certificate asset type.');
        }
        if (kind === 'teacherSignature') {
            return this.certificatesService.removeInstructorSignature(instructorId, req.user.userId);
        }
        return this.certificatesService.setTemplateAsset(kind as CertificateAssetKind, null, req.user.userId);
    }

    @ApiOperation({ summary: 'List my certificates (student)' })
    @Roles(Role.STUDENT)
    @Get('my')
    mine(@Request() req: any) {
        return this.certificatesService.listMine(req.user.userId);
    }

    @ApiOperation({ summary: 'Get my certificate for a specific course' })
    @Roles(Role.STUDENT)
    @Get('by-course/:courseId')
    findByCourse(@Param('courseId') courseId: string, @Request() req: any) {
        return this.certificatesService.getByCourse(courseId, req.user.userId);
    }

    @ApiOperation({ summary: 'All certificates issued for a course, with their holders (admin / course manager)' })
    @Roles(Role.ADMIN, Role.COURSE_MANAGER)
    @RequirePermissions(PERMISSIONS.CERTIFICATES_MANAGE)
    @Get('course/:courseId')
    listForCourse(@Param('courseId') courseId: string) {
        return this.certificatesService.listForCourse(courseId);
    }

    @ApiOperation({ summary: 'Candidates (approved students) for manual certificate issuance on an opening' })
    @Roles(...CERT_STAFF_ROLES)
    @RequirePermissions(PERMISSIONS.CERTIFICATES_ISSUE)
    @Get('openings/:openingId/candidates')
    async candidates(@Param('openingId') openingId: string, @Request() req: any) {
        await this.certificatesService.assertCanManageOpening(openingId, req.user.userId, req.user.role);
        return this.certificatesService.listCandidates(openingId);
    }

    @ApiOperation({ summary: 'Manually issue certificates to selected approved students of an opening' })
    @Roles(...CERT_STAFF_ROLES)
    @RequirePermissions(PERMISSIONS.CERTIFICATES_ISSUE)
    @Post('openings/:openingId/issue')
    async issue(@Param('openingId') openingId: string, @Body('studentIds') studentIds: string[] | undefined, @Request() req: any) {
        if (!Array.isArray(studentIds) || studentIds.length === 0) {
            throw new BadRequestException('Select at least one student to issue a certificate for');
        }
        await this.certificatesService.assertCanManageOpening(openingId, req.user.userId, req.user.role);
        return this.certificatesService.issueForStudents(openingId, studentIds.map(s => String(s)), req.user.userId, req.user.role);
    }

    @ApiOperation({ summary: 'Revoke a certificate (admin / course manager only)' })
    @Roles(Role.ADMIN, Role.COURSE_MANAGER)
    @RequirePermissions(PERMISSIONS.CERTIFICATES_MANAGE)
    @UseGuards(StepUpGuard)
    @Post(':id/revoke')
    revoke(@Param('id') id: string, @Request() req: any) {
        return this.certificatesService.revoke(id, req.user.userId, req.user.role);
    }

    @ApiOperation({ summary: 'Re-issue a revoked certificate (admin / course manager only)' })
    @Roles(Role.ADMIN, Role.COURSE_MANAGER)
    @RequirePermissions(PERMISSIONS.CERTIFICATES_MANAGE)
    @UseGuards(StepUpGuard)
    @Post(':id/reissue')
    reissue(@Param('id') id: string, @Request() req: any) {
        return this.certificatesService.reissue(id, req.user.userId, req.user.role);
    }

    @ApiOperation({ summary: 'Record that a certificate was printed, and by whom (staff or its owner)' })
    @ApiResponse({ status: 201, description: 'Print recorded on the certificate.' })
    // No @Roles: the service authorises staff and the certificate owner, so a
    // student can log their own print without widening the route to everyone.
    @Post(':id/print')
    markPrinted(@Param('id') id: string, @Request() req: any) {
        return this.certificatesService.markPrinted(id, { userId: req.user.userId, role: req.user.role });
    }

    @ApiOperation({ summary: 'Get a certificate by id (owner or admin)' })
    @Get(':id')
    findOne(@Param('id') id: string, @Request() req: any) {
        return this.certificatesService.getOne(id, req.user.userId, req.user.role);
    }
}