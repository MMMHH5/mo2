import { Controller, Get, UseGuards, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuditService } from './audit.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('System Audit Logs')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('audit')
export class AuditController {
    constructor(
        private readonly auditService: AuditService,
        private readonly prisma: PrismaService,
    ) { }

    @ApiOperation({ summary: 'List all system audit logs' })
    @ApiResponse({ status: 200, description: 'Returns system audit logs with user context.' })
    @Roles(Role.ADMIN)
    @Get()
    getLogs(@Query('limit') limit: number = 100) {
        return this.prisma.auditLog.findMany({
            take: Number(limit) || 100,
            orderBy: { timestamp: 'desc' },
            include: { user: { select: { email: true, role: true } } },
        });
    }
}
