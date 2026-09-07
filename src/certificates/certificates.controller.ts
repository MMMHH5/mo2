import { Controller, Get, Param, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CertificatesService } from './certificates.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

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

    @ApiOperation({ summary: 'Get a certificate by id (owner or admin)' })
    @Get(':id')
    findOne(@Param('id') id: string, @Request() req: any) {
        return this.certificatesService.getOne(id, req.user.userId, req.user.role);
    }
}