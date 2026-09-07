import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class FinanceService {
    constructor(
        private prisma: PrismaService,
        private audit: AuditService,
    ) {}

    async getPaymentReport() {
        const [totalPayments, revenueSum, statusCounts] = await Promise.all([
            this.prisma.payment.count(),
            this.prisma.payment.aggregate({ _sum: { amount: true }, where: { status: 'PAID' } }),
            this.prisma.payment.groupBy({ by: ['status'], _count: true }),
        ]);

        const statusMap: Record<string, number> = {};
        statusCounts.forEach((s: { status: string; _count: number }) => { statusMap[s.status] = s._count; });

        return {
            totalPayments,
            totalRevenue: Number(revenueSum._sum.amount || 0),
            statusCounts: statusMap,
        };
    }

    async getCoupons() {
        return this.prisma.coupon.findMany({
            include: {
                courses: {
                    include: { course: { select: { id: true, titleAr: true, titleEn: true } } },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    async createCoupon(dto: {
        code: string;
        type: 'PERCENT' | 'AMOUNT';
        value: number;
        maxUses?: number;
        startsAt?: string;
        expiresAt?: string;
        courseIds?: string[];
    }) {
        if (!dto.code || !dto.code.trim()) throw new BadRequestException('Code is required');
        if (dto.value <= 0) throw new BadRequestException('Value must be positive');
        if (dto.type === 'PERCENT' && dto.value > 100) throw new BadRequestException('Percentage cannot exceed 100');

        const existing = await this.prisma.coupon.findUnique({ where: { code: dto.code.trim().toUpperCase() } });
        if (existing) throw new BadRequestException('Coupon code already exists');

        const coupon = await this.prisma.coupon.create({
            data: {
                code: dto.code.trim().toUpperCase(),
                type: dto.type,
                value: dto.value,
                maxUses: dto.maxUses ?? null,
                startsAt: dto.startsAt ? new Date(dto.startsAt) : null,
                expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
                courses: dto.courseIds && dto.courseIds.length
                    ? { create: dto.courseIds.map(courseId => ({ courseId })) }
                    : undefined,
            },
            include: { courses: { include: { course: { select: { id: true, titleAr: true, titleEn: true } } } } },
        });

        await this.audit.logAction('Created coupon ' + coupon.code, undefined, undefined);
        return coupon;
    }

    async updateCoupon(id: string, dto: {
        code?: string;
        type?: 'PERCENT' | 'AMOUNT';
        value?: number;
        maxUses?: number | null;
        active?: boolean;
        expiresAt?: string | null;
    }) {
        const existing = await this.prisma.coupon.findUnique({ where: { id } });
        if (!existing) throw new NotFoundException('Coupon not found');

        const data: Record<string, unknown> = {};
        if (dto.code !== undefined) data.code = dto.code.trim().toUpperCase();
        if (dto.type !== undefined) data.type = dto.type;
        if (dto.value !== undefined) data.value = dto.value;
        if (dto.maxUses !== undefined) data.maxUses = dto.maxUses;
        if (dto.active !== undefined) data.active = dto.active;
        if (dto.expiresAt !== undefined) data.expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;

        const coupon = await this.prisma.coupon.update({ where: { id }, data });
        await this.audit.logAction('Updated coupon ' + coupon.code, undefined, undefined);
        return coupon;
    }

    async deleteCoupon(id: string) {
        const coupon = await this.prisma.coupon.findUnique({ where: { id } });
        if (!coupon) throw new NotFoundException('Coupon not found');
        await this.prisma.coupon.delete({ where: { id } });
        await this.audit.logAction('Deleted coupon ' + coupon.code, undefined, undefined);
        return { ok: true };
    }

    async validateCoupon(code: string, courseId?: string) {
        const coupon = await this.prisma.coupon.findUnique({
            where: { code: code.trim().toUpperCase() },
            include: { courses: { select: { courseId: true } } },
        });
        if (!coupon) throw new NotFoundException('Coupon not found');
        if (!coupon.active) throw new BadRequestException('Coupon is inactive');
        if (coupon.expiresAt && coupon.expiresAt < new Date()) throw new BadRequestException('Coupon has expired');
        if (coupon.maxUses && coupon.usedCount >= coupon.maxUses) throw new BadRequestException('Coupon usage limit reached');
        if (courseId && coupon.courses.length > 0 && !coupon.courses.some(c => c.courseId === courseId)) {
            throw new BadRequestException('Coupon not applicable to this course');
        }
        return { valid: true, code: coupon.code, type: coupon.type, value: Number(coupon.value) };
    }
}
