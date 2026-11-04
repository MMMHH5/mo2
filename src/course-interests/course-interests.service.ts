import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ContactMethod, CourseInterestStatus } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';

type InterestInput = {
    courseId?: unknown;
    contactMethod?: unknown;
    contactValue?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

@Injectable()
export class CourseInterestsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
    ) {}

    async register(input: InterestInput) {
        if (!isRecord(input) || typeof input.courseId !== 'string' || !input.courseId.trim()) {
            throw new BadRequestException('A course is required');
        }
        if (input.contactMethod !== ContactMethod.EMAIL && input.contactMethod !== ContactMethod.PHONE) {
            throw new BadRequestException('Choose email or phone as the contact method');
        }
        if (typeof input.contactValue !== 'string') {
            throw new BadRequestException('Enter an email address or phone number');
        }

        const contactValue = input.contactMethod === ContactMethod.EMAIL
            ? input.contactValue.trim().toLowerCase()
            : input.contactValue.trim().replace(/[\s()-]/g, '');
        const validContact = input.contactMethod === ContactMethod.EMAIL
            ? contactValue.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactValue)
            : contactValue.length <= 16 && /^\+?\d{7,15}$/.test(contactValue);
        if (!validContact) {
            throw new BadRequestException(input.contactMethod === ContactMethod.EMAIL
                ? 'Enter a valid email address'
                : 'Enter a valid phone number with country code');
        }

        const courseId = input.courseId.trim();
        const course = await this.prisma.course.findFirst({
            where: {
                id: courseId,
                archivedAt: null,
                openings: {
                    some: {
                        archivedAt: null,
                        isPublished: true,
                        status: { in: [ 'ANNOUNCEMENT', 'OPEN', 'STARTED', 'ENDED' ] },
                    },
                },
            },
            select: { id: true },
        });
        if (!course) throw new NotFoundException('Course is not available in the public catalogue');

        const interest = await this.prisma.courseInterest.upsert({
            where: {
                courseId_contactMethod_contactValue: {
                    courseId,
                    contactMethod: input.contactMethod,
                    contactValue,
                },
            },
            create: {
                courseId,
                contactMethod: input.contactMethod,
                contactValue,
            },
            update: { status: CourseInterestStatus.PENDING },
            select: { id: true, status: true, createdAt: true },
        });
        return { registered: true, ...interest };
    }

    async list(status?: string) {
        if (status && !Object.values(CourseInterestStatus).includes(status as CourseInterestStatus)) {
            throw new BadRequestException('Invalid course interest status');
        }
        return this.prisma.courseInterest.findMany({
            where: status ? { status: status as CourseInterestStatus } : undefined,
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                contactMethod: true,
                contactValue: true,
                status: true,
                createdAt: true,
                course: { select: { id: true, titleAr: true, titleEn: true } },
            },
        });
    }

    async markContacted(id: string, actorId: string) {
        const existing = await this.prisma.courseInterest.findUnique({
            where: { id },
            select: { id: true },
        });
        if (!existing) throw new NotFoundException('Course interest not found');
        const interest = await this.prisma.courseInterest.update({
            where: { id },
            data: { status: CourseInterestStatus.CONTACTED },
            select: { id: true, status: true },
        });
        await this.audit.logAction('Marked course interest as contacted', undefined, actorId);
        return interest;
    }
}
