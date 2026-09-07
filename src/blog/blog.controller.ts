import { Controller, Get, Post, Patch, Delete, Body, Param, Query, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { BlogService } from './blog.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

@ApiTags('Blog')
@ApiBearerAuth('JWT-auth')
@Controller('blog')
export class BlogController {
  constructor(private blog: BlogService) {}

  @ApiOperation({ summary: 'Public list of published posts (page, pageSize)' })
  @Get()
  list(@Query('page') page?: string, @Query('pageSize') pageSize?: string) {
    return this.blog.list(page ? parseInt(page, 10) : 1, pageSize ? Math.min(50, parseInt(pageSize, 10)) : 12);
  }

  @ApiOperation({ summary: 'Admin list of all posts (including drafts)' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.COURSE_MANAGER)
  @Get('admin/all')
  listAll() {
    return this.blog.listAllAdmin();
  }

  @ApiOperation({ summary: 'Get a post by slug (?includeUnpublished=true for staff prev/rew)' })
  @Get(':slug')
  getBySlug(@Param('slug') slug: string, @Query('includeUnpublished') includeUnpublished?: string) {
    return this.blog.getBySlug(slug, includeUnpublished === 'true');
  }

  @ApiOperation({ summary: 'Create a post (Admins/Course Managers)' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.COURSE_MANAGER)
  @Post()
  create(@Body() dto: any, @Request() req: any) {
    return this.blog.create(dto, req.user.userId);
  }

  @ApiOperation({ summary: 'Update a post (Admins/Course Managers)' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.COURSE_MANAGER)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: any) {
    return this.blog.update(id, dto);
  }

  @ApiOperation({ summary: 'Publish a post' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.COURSE_MANAGER)
  @Post(':id/publish')
  publish(@Param('id') id: string) {
    return this.blog.setPublished(id, true);
  }

  @ApiOperation({ summary: 'Unpublish a post' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.COURSE_MANAGER)
  @Post(':id/unpublish')
  unpublish(@Param('id') id: string) {
    return this.blog.setPublished(id, false);
  }

  @ApiOperation({ summary: 'Delete a post (Admins/Course Managers)' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.COURSE_MANAGER)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.blog.remove(id);
  }
}