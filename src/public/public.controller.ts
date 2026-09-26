import { Controller, Get, Param, Post, Body, Ip, BadRequestException, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { EmailService } from '../email/email.service';
import { Role } from '@prisma/client';

/**
 * Fields of a lesson that are safe to expose in the public catalogue: enough to
 * render a syllabus preview, nothing that reveals the locked content itself.
 */
const OUTLINE_LESSON_SELECT = {
    id: true,
    titleAr: true,
    titleEn: true,
    orderIndex: true,
    durationMinutes: true,
    isFree: true,
} as const;

@ApiTags('Public')
@Controller('public')
export class PublicController {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly email: EmailService,
    ) {}

    @ApiOperation({ summary: 'Public site statistics (aggregate, privacy-safe)' })
    @Get('stats')
    async stats() {
        const [courses, instructors, enrollments, certificates] = await Promise.all([
            this.prisma.course.count({
                where: { openings: { some: { isPublished: true, status: { in: ['OPEN', 'ANNOUNCEMENT'] } } } },
            }),
            this.prisma.user.count({ where: { role: { in: [Role.INSTRUCTOR, Role.COURSE_MANAGER] }, isActive: true } }),
            this.prisma.enrollment.count({ where: { status: 'APPROVED' } }),
            this.prisma.certificate.count({ where: { verificationStatus: 'VALID' } }),
        ]);
        return { courses, instructors, enrollments, certificates };
    }

    @ApiOperation({ summary: 'Public list of active instructors with public stats' })
    @Get('instructors')
    async instructors() {
        const users = await this.prisma.user.findMany({
            where: { role: { in: [Role.INSTRUCTOR, Role.COURSE_MANAGER] }, isActive: true },
            select: {
                id: true,
                createdAt: true,
                _count: { select: { coursesTaught: true, openingsTaught: true } },
            },
            orderBy: { createdAt: 'asc' },
        });
        return users.map((u) => ({
            id: u.id,
            joinedAt: u.createdAt,
            courseCount: u._count.coursesTaught,
            openingCount: u._count.openingsTaught,
        }));
    }

    @ApiOperation({ summary: 'Public instructor profile with their courses' })
    @Get('instructors/:id')
    async instructor(@Param('id') id: string) {
        const user = await this.prisma.user.findFirst({
            where: { id, role: { in: [Role.INSTRUCTOR, Role.COURSE_MANAGER] }, isActive: true },
            select: {
                id: true,
                createdAt: true,
                coursesTaught: {
                    select: {
                        id: true,
                        titleAr: true,
                        titleEn: true,
                        excerptAr: true,
                        excerptEn: true,
                        coverImageUrl: true,
                        categoryAr: true,
                        categoryEn: true,
                        level: true,
                        createdAt: true,
                        openings: {
                            where: { status: { in: ['OPEN', 'ANNOUNCEMENT'] } },
                            select: { id: true, price: true, priceOld: true, status: true },
                        },
                        _count: { select: { enrollments: true } },
                    },
                    orderBy: { createdAt: 'desc' },
                },
            },
        });
        if (!user) throw new NotFoundException('Instructor not found');
        const { coursesTaught, ...profile } = user;
        return { ...profile, courseCount: coursesTaught.length, courses: coursesTaught };
    }

    @ApiOperation({ summary: 'Public browseable courses (only OPEN or ANNOUNCEMENT openings)' })
    @Get('courses')
    async courses() {
        const courses = await this.prisma.course.findMany({
            where: {
                openings: {
                    some: {
                        isPublished: true,
                        status: { in: ['OPEN', 'ANNOUNCEMENT'] as any },
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
            include: {
                instructor: { select: { id: true, email: true, role: true } },
                openings: {
                    where: { isPublished: true },
                    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
                    select: {
                        id: true,
                        status: true,
                        price: true,
                        priceOld: true,
                        nameAr: true,
                        nameEn: true,
                        startDate: true,
                        endDate: true,
                        enrollmentDeadline: true,
                        announcementStartAt: true,
                        announcementEndAt: true,
                        maxStudents: true,
                        instructor: { select: { id: true, email: true } },
                        _count: { select: { enrollments: true } },
                    },
                },
                _count: { select: { enrollments: true, modules: true } },
                chapters: {
                    orderBy: { orderIndex: 'asc' },
                    select: {
                        id: true,
                        titleAr: true,
                        titleEn: true,
                        orderIndex: true,
                        modules: {
                            orderBy: { orderIndex: 'asc' },
                            select: OUTLINE_LESSON_SELECT,
                        },
                    },
                },
                modules: {
                    orderBy: { orderIndex: 'asc' },
                    select: OUTLINE_LESSON_SELECT,
                },
            },
        });

        return courses.map((course) => ({
            ...course,
            // Normalised syllabus preview for the public catalogue: one entry per
            // chapter, or a single untitled chapter for courses that keep their
            // lessons flat. Only titles/timing are exposed — never the lesson
            // body, files, links or the locked video URLs.
            outline: course.chapters.length > 0
                ? course.chapters.map((chapter) => ({
                    id: chapter.id,
                    titleAr: chapter.titleAr,
                    titleEn: chapter.titleEn,
                    lessons: chapter.modules,
                }))
                : course.modules.length > 0
                    ? [{ id: null, titleAr: null, titleEn: null, lessons: course.modules }]
                    : [],
            openings: course.openings.map((opening) => ({
                ...opening,
                // Public footprint: never expose instructor email (prevents scraping/enumeration).
                instructor: opening.instructor ? { id: opening.instructor.id } : null,
            })),
        }))
            .map((course) => {
                // Course ownership fields are internal; keep only what the public needs.
                const { instructorId, chapters, modules, ...rest } = course;
                return rest;
            });
    }

    @ApiOperation({ summary: 'Submit a contact message' })
    @Post('contact')
    @Throttle({ default: { ttl: 60_000, limit: 5 } })
    async contact(@Body() body: { name?: string; email?: string; subject?: string; message?: string }, @Ip() ip: string) {
        const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase().slice(0, 254) : '';
        const message = typeof body?.message === 'string' ? body.message.trim().slice(0, 4000) : '';
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !message) {
            throw new BadRequestException('A valid email and message are required');
        }
        const name = typeof body?.name === 'string' ? body.name.trim().slice(0, 200) : '';
        const subject = typeof body?.subject === 'string' ? body.subject.trim().slice(0, 200) : '';
        await this.audit.logAction(`Contact form submission from ${email}`, ip);
        await this.email.sendContactEmail(email, name, subject, message);
        return { ok: true };
    }
}