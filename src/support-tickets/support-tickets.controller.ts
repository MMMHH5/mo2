import { Controller, Post, Body, Get, Patch, Param, UseGuards, Request, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SupportTicketsService } from './support-tickets.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

@ApiTags('Support Tickets (الشكاوى والدعم)')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('support-tickets')
export class SupportTicketsController {
    constructor(private readonly supportTicketsService: SupportTicketsService) { }

    @ApiOperation({ summary: 'Submit a support ticket / complaint' })
    @Post()
    create(
        @Body('subject') subject: string,
        @Body('message') message: string,
        @Request() req: any,
    ) {
        if (!subject || !message) {
            throw new BadRequestException('subject and message are required');
        }
        return this.supportTicketsService.create(req.user.userId, { subject, message });
    }

    @ApiOperation({ summary: 'My tickets' })
    @Get('my')
    getMy(@Request() req: any) {
        return this.supportTicketsService.getMy(req.user.userId);
    }

    @ApiOperation({ summary: 'All tickets (staff)' })
    @Roles(Role.ADMIN, Role.COURSE_MANAGER)
    @Get()
    getAll() {
        return this.supportTicketsService.getAll();
    }

    @ApiOperation({ summary: 'Update a ticket (status / reply)' })
    @Roles(Role.ADMIN, Role.COURSE_MANAGER)
    @Patch(':id')
    update(
        @Param('id') id: string,
        @Body('status') status: string | undefined,
        @Body('adminNotes') adminNotes: string | undefined,
        @Request() req: any,
    ) {
        return this.supportTicketsService.update(id, { status, adminNotes }, req.user.userId);
    }
}