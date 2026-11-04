import { Body, Controller, Get, Post, Put, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { PERMISSIONS } from '../auth/permissions/permissions';
import { HomepageService } from './homepage.service';

@ApiTags('Homepage')
@Controller('homepage')
export class PublicHomepageController {
    constructor(private readonly homepage: HomepageService) {}

    @Get('public')
    @ApiOperation({ summary: 'Get the currently published homepage configuration' })
    publicConfig() {
        return this.homepage.publicConfig();
    }
}

@ApiTags('Admin Homepage')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles(Role.ADMIN)
@RequirePermissions(PERMISSIONS.SYSTEM_READ)
@Controller('admin/homepage')
export class AdminHomepageController {
    constructor(private readonly homepage: HomepageService) {}

    @Get()
    @ApiOperation({ summary: 'Get homepage draft and published configuration' })
    getState() {
        return this.homepage.adminState();
    }

    @Put('draft')
    @ApiOperation({ summary: 'Save homepage configuration as a draft' })
    saveDraft(@Body('config') config: unknown, @Request() req: any) {
        return this.homepage.saveDraft(config, req.user.userId);
    }

    @Post('publish')
    @ApiOperation({ summary: 'Publish the current homepage draft' })
    publish(@Request() req: any) {
        return this.homepage.publish(req.user.userId);
    }

    @Post('restore')
    @ApiOperation({ summary: 'Restore the draft from the currently published homepage' })
    restore(@Request() req: any) {
        return this.homepage.discardDraft(req.user.userId);
    }
}
