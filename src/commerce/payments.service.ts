import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EmailService } from '../email/email.service';
import { CouponsService } from './coupons.service';
import { Role, PaymentStatus } from '@prisma/client';
import Stripe from 'stripe';
import { getFrontendUrl } from '../common/frontend-url';

@Injectable()
export class PaymentsService {
  private stripe: Stripe | null = null;

  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
    private email: EmailService,
    private coupons: CouponsService,
  ) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (key) {
      this.stripe = new Stripe(key, { apiVersion: '2026-07-29.dahlia' });
    }
  }

  private appUrl() {
    return getFrontendUrl();
  }

  private async resolveOpening(openingId: string) {
    const opening = await this.prisma.courseOpening.findUnique({
      where: { id: openingId },
      include: { course: true, instructor: { select: { id: true, email: true } } },
    });
    if (!opening) throw new NotFoundException('Opening not found');
    return opening;
  }

  private async ensureEnrollment(studentId: string, openingId: string) {
    const opening = await this.prisma.courseOpening.findUnique({ where: { id: openingId } });
    if (!opening) throw new NotFoundException('Opening not found');
    const existing = await this.prisma.enrollment.findUnique({
      where: { studentId_courseId: { studentId, courseId: opening.courseId } },
    });
    if (existing) {
      return this.prisma.enrollment.update({ where: { id: existing.id }, data: { openingId, status: 'APPROVED' } });
    }
    return this.prisma.enrollment.create({
      data: { studentId, courseId: opening.courseId, openingId, status: 'APPROVED' },
    });
  }

  async checkout(studentId: string, openingId: string, opts: { provider?: string; couponCode?: string }) {
    const opening = await this.resolveOpening(openingId);
    const price = Number(opening.price);

    let amount = price;
    let couponCode: string | undefined = opts.couponCode?.trim().toUpperCase() || undefined;
    if (couponCode) {
      const result = await this.coupons.validate(couponCode, opening.courseId, price);
      amount = result.finalAmount;
    }

    const provider = (opts.provider || 'MANUAL').toUpperCase();

    const payment = await this.prisma.payment.create({
      data: {
        studentId,
        openingId,
        amount,
        currency: opening.currency,
        provider,
        couponCode,
        description: `Enrollment in ${opening.course.titleEn}`,
      },
    });

    if (provider === 'STRIPE') {
      if (!this.stripe) throw new BadRequestException('Online payments are not configured. Please use the manual payment method.');
      const intent = await this.stripe.paymentIntents.create({
        amount: Math.round(amount * 100),
        currency: opening.currency.toLowerCase(),
        metadata: { paymentId: payment.id, openingId, studentId },
        description: payment.description ?? undefined,
        automatic_payment_methods: { enabled: true },
      });
      await this.prisma.payment.update({ where: { id: payment.id }, data: { providerRef: intent.id } });
      return { id: payment.id, provider, clientSecret: intent.client_secret, redirectUrl: null, amount, currency: opening.currency, couponCode, paymentIntentId: intent.id };
    }

    const gateways = await this.prisma.paymentGateway.findMany({ where: { isActive: true } });
    return { id: payment.id, provider: 'MANUAL', clientSecret: null, redirectUrl: null, amount, currency: opening.currency, couponCode, instructions: gateways[0]?.instructions ?? '' };
  }

  async webhookStripe(payload: Buffer, signature: string) {
    if (!this.stripe) throw new BadRequestException('Stripe is not configured');
    let event: Stripe.Event;
    try {
      const secret = process.env.STRIPE_WEBHOOK_SECRET || '';
      event = this.stripe.webhooks.constructEvent(payload, signature, secret);
    } catch (err) {
        // Log detailed error server-side only; return generic message to client
        console.error('[Stripe Webhook] Signature verification failed:', (err as Error).message);
        throw new BadRequestException('Webhook signature verification failed');
    }

    if (event.type === 'payment_intent.succeeded') {
      const intent = event.data.object as Stripe.PaymentIntent;
      const paymentId = intent.metadata?.paymentId;
      if (paymentId) {
        const payment = await this.prisma.payment.findUnique({ where: { id: paymentId }, include: { student: { select: { id: true, email: true } } } });
        if (payment && payment.status !== PaymentStatus.PAID) {
          await this.prisma.$transaction([
            this.prisma.payment.update({ where: { id: paymentId }, data: { status: PaymentStatus.PAID, paidAt: new Date() } }),
            this.prisma.enrollment.deleteMany({ where: { id: payment.enrollmentId ?? '' } }),
          ]);
          const enrollment = await this.ensureEnrollment(payment.studentId, payment.openingId);
          await this.prisma.payment.update({ where: { id: paymentId }, data: { enrollmentId: enrollment.id } });
          if (payment.couponCode) await this.coupons.incrementUsage(payment.couponCode);
          await this.notifications.notify({
            userId: payment.studentId,
            type: 'payment.confirmed',
            titleAr: 'تم تأكيد الدفع',
            titleEn: 'Payment confirmed',
            bodyAr: 'تم تأكيد دفعتك بنجاح وتم تفعيل تسجيلك في الدورة.',
            bodyEn: 'Your payment was confirmed and your enrollment is now active.',
            data: { paymentId, openingId: payment.openingId },
            email: {
              to: payment.student.email,
            },
          }).catch(() => {});
        }
      }
    }
    return { received: true };
  }

  async listMy(studentId: string) {
    return this.prisma.payment.findMany({
      where: { studentId },
      include: { opening: { select: { id: true, nameAr: true, nameEn: true, status: true, course: { select: { id: true, titleAr: true, titleEn: true } } } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listAll() {
    return this.prisma.payment.findMany({
      include: {
        student: { select: { id: true, email: true } },
        opening: { select: { id: true, nameAr: true, nameEn: true, course: { select: { id: true, titleAr: true, titleEn: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async refund(paymentId: string, actorId: string, role: Role, reason?: string) {
    const payment = await this.prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment) throw new NotFoundException('Payment not found');
    if (role !== Role.ADMIN && role !== Role.FINANCE) throw new ForbiddenException('Only finance staff can refund payments');
    if (payment.status !== PaymentStatus.PAID) throw new BadRequestException('Only paid payments can be refunded');

    if (payment.provider === 'STRIPE' && payment.providerRef && this.stripe) {
      const refundReason = reason === 'duplicate' || reason === 'fraudulent' || reason === 'requested_by_customer' ? reason : undefined;
      await this.stripe.refunds.create({ payment_intent: payment.providerRef, ...(refundReason ? { reason: refundReason } : {}) });
    }

    await this.prisma.payment.update({ where: { id: paymentId }, data: { status: PaymentStatus.REFUNDED, refundedAt: new Date() } });
    await this.notifications.notify({
      userId: payment.studentId,
      type: 'payment.refunded',
      titleAr: 'تم استرداد المبلغ',
      titleEn: 'Payment refunded',
      bodyAr: reason ?? 'تم استرداد مبلغ دفعتك.',
      bodyEn: reason ?? 'Your payment has been refunded.',
      data: { paymentId },
    }).catch(() => {});
    return { ok: true };
  }
}