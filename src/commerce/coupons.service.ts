import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface ApplyResult {
  valid: boolean;
  code: string;
  type: 'PERCENT' | 'AMOUNT';
  value: number;
  amountOff: number;
  finalAmount: number;
  finalAmountCurrency: string;
}

@Injectable()
export class CouponsService {
  constructor(private prisma: PrismaService) {}

  async validate(code: string, courseId: string, openingPrice: number) {
    const coupon = await this.prisma.coupon.findUnique({ where: { code: code.trim().toUpperCase() }, include: { courses: { select: { courseId: true } } } });
    if (!coupon) throw new NotFoundException('Invalid coupon code');

    const now = new Date();
    const withinWindow = (!coupon.startsAt || coupon.startsAt <= now) && (!coupon.expiresAt || coupon.expiresAt >= now);
    if (!coupon.active) throw new BadRequestException('This coupon is inactive');
    if (!withinWindow) throw new BadRequestException('This coupon is not valid at this time');
    if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) throw new BadRequestException('This coupon has reached its usage limit');
    const scoped = coupon.courses.length > 0 && !coupon.courses.some((c) => c.courseId === courseId);
    if (scoped) throw new BadRequestException('This coupon does not apply to this course');

    const value = Number(coupon.value);
    const amountOff = coupon.type === 'PERCENT' ? Math.round(openingPrice * (value / 100) * 100) / 100 : value;
    const finalAmount = Math.max(0, Math.round((openingPrice - amountOff) * 100) / 100);
    return { valid: true, code: coupon.code, type: coupon.type, value, amountOff, finalAmount, finalAmountCurrency: '' };
  }

  async incrementUsage(code: string) {
    return this.prisma.coupon.update({ where: { code }, data: { usedCount: { increment: 1 } } });
  }

  async create(data: { code: string; type: 'PERCENT' | 'AMOUNT'; value: number; maxUses?: number; active?: boolean; startsAt?: Date; expiresAt?: Date; courseIds?: string[] }) {
    const code = data.code.trim().toUpperCase();
    const existing = await this.prisma.coupon.findUnique({ where: { code } });
    if (existing) throw new BadRequestException('Coupon code already exists');
    if (data.value <= 0) throw new BadRequestException('Value must be positive');
    if (data.type === 'PERCENT' && data.value > 100) throw new BadRequestException('Percent coupons cannot exceed 100%');

    const courses = data.courseIds?.length
      ? { create: data.courseIds.map((courseId) => ({ courseId })) }
      : undefined;

    return this.prisma.coupon.create({
      data: { code, type: data.type, value: data.value, maxUses: data.maxUses ?? null, active: data.active ?? true, startsAt: data.startsAt ?? null, expiresAt: data.expiresAt ?? null, courses },
      include: { courses: true },
    });
  }

  async update(id: string, data: { code?: string; type?: 'PERCENT' | 'AMOUNT'; value?: number; maxUses?: number; active?: boolean; startsAt?: Date | null; expiresAt?: Date | null; courseIds?: string[] }) {
    const existing = await this.prisma.coupon.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Coupon not found');

    const update: Record<string, unknown> = {};
    if (data.code) update.code = data.code.trim().toUpperCase();
    if (data.type) update.type = data.type;
    if (data.value !== undefined) {
      if (data.value <= 0) throw new BadRequestException('Value must be positive');
      if (data.type === 'PERCENT' && data.value > 100) throw new BadRequestException('Percent coupons cannot exceed 100%');
      update.value = data.value;
    }
    if (data.maxUses !== undefined) update.maxUses = data.maxUses;
    if (data.active !== undefined) update.active = data.active;
    if (data.startsAt !== undefined) update.startsAt = data.startsAt;
    if (data.expiresAt !== undefined) update.expiresAt = data.expiresAt;

    if (data.courseIds) {
      await this.prisma.couponCourse.deleteMany({ where: { couponId: id } });
      if (data.courseIds.length) update.courses = { create: data.courseIds.map((courseId) => ({ courseId })) };
    }

    return this.prisma.coupon.update({ where: { id }, data: update, include: { courses: true } });
  }

  async list() {
    return this.prisma.coupon.findMany({
      include: { courses: { include: { course: { select: { id: true, titleAr: true, titleEn: true } } } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async remove(id: string) {
    return this.prisma.coupon.delete({ where: { id } });
  }
}