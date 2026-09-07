import { Controller, Get, Param, Patch, Body, Delete, UseGuards, Request, Ip, Post } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { CreateUserDto, UpdateUserDto, UpdateMeDto } from './dto/user.dto';

@ApiTags('Users & Roles')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
    constructor(private readonly usersService: UsersService) { }
    @ApiResponse({ status: 200, description: 'Returns all users.' })
    @Roles(Role.ADMIN, Role.COURSE_MANAGER)
    @Get()
    findAll() {
        return this.usersService.findAll();
    }

    @ApiOperation({ summary: 'Get the current authenticated user profile (+ role-specific stats)' })
    @ApiResponse({ status: 200, description: 'Returns the current user profile and stats.' })
    @Roles(Role.STUDENT, Role.INSTRUCTOR, Role.COURSE_MANAGER, Role.FINANCE, Role.ADMIN)
    @Get('me')
    getMe(@Request() req: any) {
        return this.usersService.getMe(req.user.userId);
    }

    @ApiOperation({ summary: 'Update the current user personal info / email / password' })
    @ApiResponse({ status: 200, description: 'Returns the updated user profile.' })
    @Roles(Role.STUDENT, Role.INSTRUCTOR, Role.COURSE_MANAGER, Role.FINANCE, Role.ADMIN)
    @Patch('me')
    updateMe(@Body() dto: UpdateMeDto, @Request() req: any) {
        return this.usersService.updateMe(req.user.userId, dto);
    }

    @ApiOperation({ summary: 'Export all of my personal data (GDPR)' })
    @Roles(Role.STUDENT, Role.INSTRUCTOR, Role.COURSE_MANAGER, Role.FINANCE, Role.ADMIN)
    @Post('me/export')
    exportMyData(@Request() req: any) {
        return this.usersService.exportMyData(req.user.userId);
    }

    @ApiOperation({ summary: 'Delete my own account (GDPR erasure)' })
    @Roles(Role.STUDENT, Role.INSTRUCTOR, Role.COURSE_MANAGER, Role.FINANCE, Role.ADMIN)
    @Delete('me')
    deleteMe(@Body('currentPassword') currentPassword: string, @Request() req: any) {
        return this.usersService.deleteMyAccount(req.user.userId, currentPassword);
    }

    @ApiOperation({ summary: 'Create a new user (Admin only)' })
    @ApiResponse({ status: 201, description: 'User created.' })
    @Roles(Role.ADMIN)
    @Post()
    create(@Body() dto: CreateUserDto, @Request() req: any, @Ip() ip: string) {
        return this.usersService.create(dto, req.user.userId, ip);
    }

    @ApiOperation({ summary: 'Get specific user profile' })
    @ApiResponse({ status: 200, description: 'Returns user profile and metadata.' })
    @Roles(Role.ADMIN, Role.COURSE_MANAGER)
    @Get(':id')
    findOne(@Param('id') id: string) {
        return this.usersService.findOne(id);
    }

    @ApiOperation({ summary: 'Update user account (email/password/role/activate-suspend) (Admin only)' })
    @ApiResponse({ status: 200, description: 'User updated.' })
    @Roles(Role.ADMIN)
    @Patch(':id')
    update(
        @Param('id') id: string,
        @Body() dto: UpdateUserDto,
        @Request() req: any,
        @Ip() ip: string
    ) {
        return this.usersService.update(id, dto, req.user.userId, ip);
    }

    @ApiOperation({ summary: 'Change user role (Admin only)' })
    @ApiResponse({ status: 200, description: 'User role updated.' })
    @Roles(Role.ADMIN)
    @Patch(':id/role')
    updateRole(
        @Param('id') id: string,
        @Body('role') role: Role,
        @Request() req: any,
        @Ip() ip: string
    ) {
        return this.usersService.updateRole(id, role, req.user.userId, ip);
    }

    @ApiOperation({ summary: 'Delete user account (Admin only)' })
    @ApiResponse({ status: 200, description: 'User permanently deleted.' })
    @Roles(Role.ADMIN)
    @Delete(':id')
    remove(@Param('id') id: string, @Request() req: any, @Ip() ip: string) {
        return this.usersService.remove(id, req.user.userId, ip);
    }
}
