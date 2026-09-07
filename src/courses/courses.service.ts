import { Injectable, NotFoundException, ConflictException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { Prisma, CourseOpeningStatus, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CertificatesService } from '../certificates/certificates.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateCourseDto } from './dto/create-course.dto';
import { CreateOpeningDto } from './dto/create-opening.dto';

type ModuleDraft = {
    titleAr: string; titleEn: string; descriptionAr?: string; descriptionEn?: string; videoUrl?: string;
    orderIndex?: number; isFree?: boolean; durationMinutes?: number;
    outcomes?: { descriptionAr: string; descriptionEn: string }[];
    files?: { url: string; nameAr?: string; nameEn?: string }[];
    links?: { url: string; labelAr?: string; labelEn?: string }[];
};

@Injectable()
export class CoursesService {
    constructor(
        private prisma: PrismaService,
        private audit: AuditService,
        private certificates: CertificatesService,
        private notifications: NotificationsService,
    ) { }

    async create(data: CreateCourseDto, instructorId: string) {
        const { modules, chapters, objectives, prerequisites, audiences, faqs, gallery, ...rest } = data;

        return this.prisma.course.create({
            data: {
                ...rest,
                instructorId,
                modules: this.buildModules(modules),
                chapters: this.buildChapters(chapters),
                objectives: this.buildObjectives(objectives),
                prerequisites: this.buildPrerequisites(prerequisites),
                audiences: this.buildAudiences(audiences),
                faqs: this.buildFaqs(faqs),
                gallery: this.buildGallery(gallery),
            },
        });
    }

    async update(id: string, data: CreateCourseDto) {
        const existing = await this.prisma.course.findUnique({ where: { id } });
        if (!existing) throw new NotFoundException('Course not found');

        const { modules, chapters, objectives, prerequisites, audiences, faqs, gallery, ...rest } = data;

        const course = await this.prisma.$transaction(async (tx) => {
            await tx.course.update({
                where: { id },
                data: {
                    modules: { deleteMany: {} },
                    chapters: { deleteMany: {} },
                    objectives: { deleteMany: {} },
                    prerequisites: { deleteMany: {} },
                    audiences: { deleteMany: {} },
                    faqs: { deleteMany: {} },
                    gallery: { deleteMany: {} },
                },
            });

            return tx.course.update({
                where: { id },
                data: {
                    ...rest,
                    modules: this.buildModules(modules),
                    chapters: this.buildChapters(chapters),
                    objectives: this.buildObjectives(objectives),
                    prerequisites: this.buildPrerequisites(prerequisites),
                    audiences: this.buildAudiences(audiences),
                    faqs: this.buildFaqs(faqs),
                    gallery: this.buildGallery(gallery),
                },
            });
        });

        return this.findOne(id);
    }

    private moduleCreatePayload(m: ModuleDraft) {
        return {
            titleAr: m.titleAr,
            titleEn: m.titleEn,
            descriptionAr: m.descriptionAr,
            descriptionEn: m.descriptionEn,
            videoUrl: m.videoUrl,
            orderIndex: m.orderIndex ?? 0,
            isFree: m.isFree ?? false,
            durationMinutes: m.durationMinutes,
            files: m.files?.length ? m.files as any : undefined,
            links: m.links?.length ? m.links as any : undefined,
            outcomes: m.outcomes?.length
                ? { create: m.outcomes.map((o) => ({ descriptionAr: o.descriptionAr, descriptionEn: o.descriptionEn })) }
                : undefined,
        };
    }

    private buildModules(
        modules?: ModuleDraft[]
    ): Prisma.ModuleCreateNestedManyWithoutCourseInput | undefined {
        if (!modules?.length) return undefined;
        return {
            create: modules.map((m) => this.moduleCreatePayload(m)),
        };
    }

    private buildChapters(
        chapters?: { titleAr: string; titleEn: string; orderIndex?: number; modules?: ModuleDraft[] }[]
    ): Prisma.ChapterCreateNestedManyWithoutCourseInput | undefined {
        if (!chapters?.length) return undefined;
        return {
            create: chapters.map((ch, i) => ({
                titleAr: ch.titleAr,
                titleEn: ch.titleEn,
                orderIndex: ch.orderIndex ?? i,
                modules: ch.modules?.length
                    ? { create: ch.modules.map((m) => this.moduleCreatePayload(m) as Prisma.ModuleCreateWithoutChapterInput) }
                    : undefined,
            })),
        };
    }

    private buildObjectives(
        objectives?: { objectiveAr: string; objectiveEn: string; orderIndex?: number }[]
    ): Prisma.CourseObjectiveCreateNestedManyWithoutCourseInput | undefined {
        if (!objectives?.length) return undefined;
        return {
            create: objectives.map((o, i) => ({
                objectiveAr: o.objectiveAr,
                objectiveEn: o.objectiveEn,
                orderIndex: o.orderIndex ?? i,
            })),
        };
    }

    private buildPrerequisites(
        prerequisites?: { prerequisiteAr: string; prerequisiteEn: string; orderIndex?: number }[]
    ): Prisma.CoursePrerequisiteCreateNestedManyWithoutCourseInput | undefined {
        if (!prerequisites?.length) return undefined;
        return {
            create: prerequisites.map((p, i) => ({
                prerequisiteAr: p.prerequisiteAr,
                prerequisiteEn: p.prerequisiteEn,
                orderIndex: p.orderIndex ?? i,
            })),
        };
    }

    private buildAudiences(
        audiences?: { audienceAr: string; audienceEn: string; orderIndex?: number }[]
    ): Prisma.CourseAudienceCreateNestedManyWithoutCourseInput | undefined {
        if (!audiences?.length) return undefined;
        return {
            create: audiences.map((a, i) => ({
                audienceAr: a.audienceAr,
                audienceEn: a.audienceEn,
                orderIndex: a.orderIndex ?? i,
            })),
        };
    }

    private buildFaqs(
        faqs?: { questionAr: string; questionEn: string; answerAr: string; answerEn: string; orderIndex?: number }[]
    ): Prisma.CourseFaqCreateNestedManyWithoutCourseInput | undefined {
        if (!faqs?.length) return undefined;
        return {
            create: faqs.map((f, i) => ({
                questionAr: f.questionAr,
                questionEn: f.questionEn,
                answerAr: f.answerAr,
                answerEn: f.answerEn,
                orderIndex: f.orderIndex ?? i,
            })),
        };
    }

    private buildGallery(
        gallery?: { url: string; altAr?: string; altEn?: string; orderIndex?: number }[]
    ): Prisma.CourseImageCreateNestedManyWithoutCourseInput | undefined {
        if (!gallery?.length) return undefined;
        return {
            create: gallery.map((g, i) => ({
                url: g.url,
                altAr: g.altAr,
                altEn: g.altEn,
                orderIndex: g.orderIndex ?? i,
            })),
        };
    }

    private openingInclude = {
        instructor: { select: { id: true, email: true, role: true } },
        _count: { select: { enrollments: true } },
    } satisfies Prisma.CourseOpeningInclude;

    async findAll(includeUnpublished = false) {
        return this.prisma.course.findMany({
            orderBy: { createdAt: 'desc' },
            include: {
                instructor: { select: { id: true, email: true, role: true } },
                openings: {
                    where: includeUnpublished ? undefined : { isPublished: true },
                    orderBy: { createdAt: 'desc' },
                    include: this.openingInclude,
                },
                _count: { select: { enrollments: true, modules: true } },
            },
        });
    }

    async findOne(id: string, includeUnpublished = false) {
        const course = await this.prisma.course.findUnique({
            where: { id },
            include: {
                instructor: { select: { id: true, email: true, role: true } },
                openings: {
                    where: includeUnpublished ? undefined : { isPublished: true },
                    orderBy: { createdAt: 'desc' },
                    include: this.openingInclude,
                },
                _count: { select: { enrollments: true, modules: true } },
                modules: {
                    orderBy: { orderIndex: 'asc' },
                    include: { outcomes: { orderBy: { createdAt: 'asc' } } },
                },
                chapters: {
                    orderBy: { orderIndex: 'asc' },
                    include: {
                        modules: {
                            orderBy: { orderIndex: 'asc' },
                            include: { outcomes: { orderBy: { createdAt: 'asc' } } },
                        },
                    },
                },
                objectives: { orderBy: { orderIndex: 'asc' } },
                prerequisites: { orderBy: { orderIndex: 'asc' } },
                audiences: { orderBy: { orderIndex: 'asc' } },
                faqs: { orderBy: { orderIndex: 'asc' } },
                gallery: { orderBy: { orderIndex: 'asc' } },
            },
        });
        if (!course) throw new NotFoundException('Course not found');
        return course;
    }

    async createOpening(courseId: string, dto: CreateOpeningDto & { nameAr?: string; nameEn?: string }) {
        const course = await this.prisma.course.findUnique({ where: { id: courseId } });
        if (!course) throw new NotFoundException('Course not found');
        const instructor = await this.prisma.user.findUnique({ where: { id: dto.instructorId } });
        if (!instructor) throw new NotFoundException('Instructor not found');

        const opening = await this.prisma.courseOpening.create({
            data: {
                courseId,
                instructorId: dto.instructorId,
                nameAr: dto.nameAr ?? null,
                nameEn: dto.nameEn ?? null,
                startDate: dto.startDate as unknown as Date | undefined,
                endDate: dto.endDate as unknown as Date | undefined,
                enrollmentDeadline: dto.enrollmentDeadline as unknown as Date | undefined,
                price: new Prisma.Decimal(dto.price),
                priceOld: dto.priceOld != null ? new Prisma.Decimal(dto.priceOld) : null,
                maxStudents: dto.maxStudents ?? null,
            },
            include: this.openingInclude,
        });
        return opening;
    }

    async listOpenings(courseId: string, includeUnpublished = false) {
        const course = await this.prisma.course.findUnique({ where: { id: courseId } });
        if (!course) throw new NotFoundException('Course not found');
        return this.prisma.courseOpening.findMany({
            where: {
                courseId,
                ...(includeUnpublished ? {} : { isPublished: true }),
            },
            orderBy: { createdAt: 'desc' },
            include: this.openingInclude,
        });
    }

    async listMyOpenings(userId: string, actorRole: Role) {
        const isStaff = actorRole === Role.ADMIN || actorRole === Role.COURSE_MANAGER;
        if (!isStaff && actorRole !== Role.INSTRUCTOR) {
            throw new ForbiddenException('Not allowed to list openings');
        }
        return this.prisma.courseOpening.findMany({
            where: isStaff ? undefined : { instructorId: userId },
            orderBy: { createdAt: 'desc' },
            include: {
                course: { select: { id: true, titleAr: true, titleEn: true } },
                instructor: { select: { id: true, email: true, role: true } },
                _count: { select: { enrollments: true, tasks: true } },
            },
        });
    }

    async listOpeningModules(openingId: string, actorId: string, actorRole: Role) {
        const opening = await this.prisma.courseOpening.findUnique({ where: { id: openingId } });
        if (!opening) throw new NotFoundException('Opening not found');
        this.assertCanManage(opening, actorId, actorRole);
        return this.prisma.module.findMany({
            where: { courseId: opening.courseId },
            orderBy: { orderIndex: 'asc' },
            select: { id: true, titleAr: true, titleEn: true, orderIndex: true },
        });
    }

    async updateOpening(openingId: string, dto: Partial<CreateOpeningDto>) {
        const existing = await this.prisma.courseOpening.findUnique({ where: { id: openingId } });
        if (!existing) throw new NotFoundException('Opening not found');

        const data: Prisma.CourseOpeningUpdateInput = {};
        if (dto.nameAr !== undefined) data.nameAr = dto.nameAr;
        if (dto.nameEn !== undefined) data.nameEn = dto.nameEn;
        if (dto.instructorId !== undefined) {
            const instructor = await this.prisma.user.findUnique({ where: { id: dto.instructorId } });
            if (!instructor) throw new NotFoundException('Instructor not found');
            data.instructor = { connect: { id: dto.instructorId } };
        }
        if (dto.startDate !== undefined) data.startDate = dto.startDate as unknown as Date;
        if (dto.endDate !== undefined) data.endDate = dto.endDate as unknown as Date;
        if (dto.enrollmentDeadline !== undefined) data.enrollmentDeadline = dto.enrollmentDeadline as unknown as Date;
        if (dto.price !== undefined) data.price = new Prisma.Decimal(dto.price);
        if (dto.priceOld !== undefined) data.priceOld = dto.priceOld != null ? new Prisma.Decimal(dto.priceOld) : null;
        if (dto.maxStudents !== undefined) data.maxStudents = dto.maxStudents ?? null;
        if (dto.announcementStartAt !== undefined) data.announcementStartAt = dto.announcementStartAt as unknown as Date;
        if (dto.announcementEndAt !== undefined) data.announcementEndAt = dto.announcementEndAt as unknown as Date;

        return this.prisma.courseOpening.update({
            where: { id: openingId },
            data,
            include: this.openingInclude,
        });
    }

    private async requireOpening(openingId: string) {
        const opening = await this.prisma.courseOpening.findUnique({
            where: { id: openingId },
            include: { course: { select: { id: true, titleAr: true, titleEn: true } } },
        });
        if (!opening) throw new NotFoundException('Opening not found');
        return opening;
    }

    private assertCanManage(opening: { instructorId: string }, actorId: string, actorRole: Role) {
        if (actorRole === Role.ADMIN || actorRole === Role.COURSE_MANAGER) return;
        if (actorRole === Role.INSTRUCTOR && opening.instructorId === actorId) return;
        throw new ForbiddenException('You are not allowed to manage this opening');
    }

    private async setStatus(openingId: string, status: CourseOpeningStatus) {
        return this.prisma.courseOpening.update({
            where: { id: openingId },
            data: {
                status,
                isPublished: status !== CourseOpeningStatus.DRAFT,
            },
            include: this.openingInclude,
        });
    }

    async startAnnouncement(
        openingId: string,
        actorId: string,
        actorRole: Role,
        dto: { announcementStartAt?: Date; announcementEndAt?: Date }
    ) {
        const opening = await this.requireOpening(openingId);
        this.assertCanManage(opening, actorId, actorRole);
        if (opening.status !== CourseOpeningStatus.DRAFT && opening.status !== CourseOpeningStatus.ANNOUNCEMENT) {
            throw new BadRequestException('Only a draft opening can be moved to announcement');
        }
        const result = await this.prisma.courseOpening.update({
            where: { id: openingId },
            data: {
                status: CourseOpeningStatus.ANNOUNCEMENT,
                isPublished: true,
                announcementStartAt: dto.announcementStartAt ?? opening.announcementStartAt ?? null,
                announcementEndAt: dto.announcementEndAt ?? opening.announcementEndAt ?? null,
            },
            include: this.openingInclude,
        });
        await this.audit.logAction(`Announcement activated for Opening ${openingId}`, undefined, actorId);
        return result;
    }

    async openOpening(openingId: string, actorId: string, actorRole: Role) {
        const opening = await this.requireOpening(openingId);
        this.assertCanManage(opening, actorId, actorRole);
        if (opening.status !== CourseOpeningStatus.DRAFT && opening.status !== CourseOpeningStatus.ANNOUNCEMENT) {
            throw new BadRequestException('Only a draft or announced opening can be opened for registration');
        }
        const result = await this.setStatus(openingId, CourseOpeningStatus.OPEN);
        await this.audit.logAction(`Opening ${openingId} opened for registration`, undefined, actorId);
        return result;
    }

    async startCourse(openingId: string, actorId: string, actorRole: Role) {
        const opening = await this.requireOpening(openingId);
        this.assertCanManage(opening, actorId, actorRole);
        if (opening.status !== CourseOpeningStatus.OPEN) {
            throw new BadRequestException('Only an open opening can be started');
        }
        const result = await this.setStatus(openingId, CourseOpeningStatus.STARTED);
        await this.audit.logAction(`Course started for Opening ${openingId}`, undefined, actorId);
        const enrolled = await this.prisma.enrollment.findMany({
            where: { openingId, status: 'APPROVED' },
            select: { studentId: true },
        });
        const titleAr = opening.nameAr ?? opening.course?.titleAr;
        const titleEn = opening.nameEn ?? opening.course?.titleEn;
        await Promise.all(enrolled.map((e) => this.notifications.notify({
            userId: e.studentId,
            type: 'opening.started',
            titleAr: 'بدأت الدورة',
            titleEn: 'Course started',
            bodyAr: `بدأت الدورة: ${titleAr ?? ''}`,
            bodyEn: `The course "${titleEn ?? ''}" has started.`,
            data: { courseId: opening.courseId, openingId },
        }).catch(() => {})));
        return result;
    }

    async endCourse(openingId: string, actorId: string, actorRole: Role) {
        const opening = await this.requireOpening(openingId);
        this.assertCanManage(opening, actorId, actorRole);
        if (opening.status !== CourseOpeningStatus.OPEN && opening.status !== CourseOpeningStatus.STARTED) {
            throw new BadRequestException('Only an open or started opening can be ended');
        }
        const result = await this.setStatus(openingId, CourseOpeningStatus.ENDED);
        await this.audit.logAction(`Course ended for Opening ${openingId}`, undefined, actorId);
        const enrolled = await this.prisma.enrollment.findMany({
            where: { openingId, status: 'APPROVED' },
            select: { studentId: true },
        });
        const titleAr = opening.nameAr ?? opening.course?.titleAr;
        const titleEn = opening.nameEn ?? opening.course?.titleEn;
        await Promise.all(enrolled.map((e) => this.notifications.notify({
            userId: e.studentId,
            type: 'opening.ended',
            titleAr: 'انتهت الدورة',
            titleEn: 'Course ended',
            bodyAr: `انتهت دورة: ${titleAr ?? ''}. سيتم إصدار الشهادات قريباً.`,
            bodyEn: `The course "${titleEn ?? ''}" has ended. Certificates are being issued.`,
            data: { courseId: opening.courseId, openingId },
        }).catch(() => {})));
        await this.certificates.issueForOpening(openingId);
        return result;
    }

    async setOpeningPublished(openingId: string, isPublished: boolean) {
        const existing = await this.prisma.courseOpening.findUnique({
            where: { id: openingId },
            include: { course: { select: { id: true, titleAr: true, titleEn: true } } },
        });
        if (!existing) throw new NotFoundException('Opening not found');
        const result = await this.setStatus(openingId, isPublished ? CourseOpeningStatus.OPEN : CourseOpeningStatus.DRAFT);
        if (isPublished) {
            const wishlistUsers = await this.prisma.wishlist.findMany({
                where: { courseId: existing.courseId },
                select: { userId: true },
            });
            await Promise.all(wishlistUsers.map((w) => this.notifications.notify({
                userId: w.userId,
                type: 'opening.published',
                titleAr: 'فُتح التسجيل في الدورة',
                titleEn: 'Registration is open',
                bodyAr: `تم فتح التسجيل في دورة: ${existing.course.titleAr}`,
                bodyEn: `Registration is now open for "${existing.course.titleEn}".`,
                data: { courseId: existing.courseId, openingId },
            }).catch(() => {})));
        }
        return result;
    }

    async removeOpening(openingId: string, deleterId: string, ip?: string) {
        await this.audit.logAction(`User ${deleterId} deleted Opening ${openingId}`, ip, deleterId);
        return this.prisma.courseOpening.delete({ where: { id: openingId } });
    }

    async remove(id: string, deleterId: string, ip?: string) {
        let deleted;
        try {
            deleted = await this.prisma.course.delete({ where: { id } });
        } catch (e) {
            if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2003') {
                throw new ConflictException(
                    'Course cannot be deleted because it has enrollments. Archive the course or remove its enrollments first.'
                );
            }
            throw e;
        }
        await this.audit.logAction(
            `User ${deleterId} deleted Course ${id}`,
            ip,
            deleterId
        );
        return deleted;
    }
}