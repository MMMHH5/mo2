import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { AnnouncementBoardService } from './announcement-board.service';
import { CreateAnnouncementBoardDto } from './dto/create-announcement-board.dto';
import { UpdateAnnouncementBoardDto } from './dto/update-announcement-board.dto';

@Controller()
export class AnnouncementBoardController {
    constructor(private readonly service: AnnouncementBoardService) {}

    // Public endpoint — no auth required
    @Get('announcement-board/active')
    getActive() {
        return this.service.findActive();
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN, Role.COURSE_MANAGER)
    @Get('announcement-board')
    findAll() {
        return this.service.findAll();
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN, Role.COURSE_MANAGER)
    @Get('announcement-board/:id')
    findOne(@Param('id') id: string) {
        return this.service.findOne(id);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN, Role.COURSE_MANAGER)
    @Post('announcement-board')
    create(@Body() dto: CreateAnnouncementBoardDto, @Request() req: any) {
        return this.service.create({ ...dto, authorId: req.user.userId });
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN, Role.COURSE_MANAGER)
    @Patch('announcement-board/:id')
    update(@Param('id') id: string, @Body() dto: UpdateAnnouncementBoardDto) {
        return this.service.update(id, dto);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN, Role.COURSE_MANAGER)
    @Delete('announcement-board/:id')
    remove(@Param('id') id: string) {
        return this.service.remove(id);
    }
}
