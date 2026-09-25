import { Controller, Get, Param, Request, UseGuards, Post, Body, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CertificatesService } from './certificates.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

const CERT_STAFF_ROLES = [Role.INSTRUCTOR, Role.ADMIN, Role.COURSE_MANAGER];

@ApiTags('Certificates (الشهادات)')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('certificates')
export class CertificatesController {
    constructor(private readonly certificatesService: CertificatesService) { }

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

    @ApiOperation({ summary: 'Candidates (approved students) for manual certificate issuance on an opening' })
    @Roles(...CERT_STAFF_ROLES)
    @Get('openings/:openingId/candidates')
    async candidates(@Param('openingId') openingId: string, @Request() req: any) {
        await this.certificatesService.assertCanManageOpening(openingId, req.user.userId, req.user.role);
        return this.certificatesService.listCandidates(openingId);
    }

    @ApiOperation({ summary: 'Manually issue certificates to selected approved students of an opening' })
    @Roles(...CERT_STAFF_ROLES)
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
    @Post(':id/revoke')
    revoke(@Param('id') id: string, @Request() req: any) {
        return this.certificatesService.revoke(id, req.user.userId, req.user.role);
    }

    @ApiOperation({ summary: 'Re-issue a revoked certificate (admin / course manager only)' })
    @Roles(Role.ADMIN, Role.COURSE_MANAGER)
    @Post(':id/reissue')
    reissue(@Param('id') id: string, @Request() req: any) {
        return this.certificatesService.reissue(id, req.user.userId, req.user.role);
    }

    @ApiOperation({ summary: 'Get a certificate by id (owner or admin)' })
    @Get(':id')
    findOne(@Param('id') id: string, @Request() req: any) {
        return this.certificatesService.getOne(id, req.user.userId, req.user.role);
    }
}