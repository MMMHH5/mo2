import { Controller, Get, Post, Patch, Delete, Body, Param, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { CurrenciesService } from './currencies.service';
import { CouponsService } from './coupons.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { CheckoutDto, RefundPaymentDto, CreateCouponDto, UpdateCouponDto } from './dto/commerce.dto';

const ALL_ROLES = ['STUDENT', 'INSTRUCTOR', 'COURSE_MANAGER', 'FINANCE', 'ADMIN'];

@ApiTags('Payments & Commerce (المدفوعات والتجارة)')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class CommerceController {
  constructor(
    private payments: PaymentsService,
    private currencies: CurrenciesService,
    private coupons: CouponsService,
  ) {}

  // ---------- Payments ----------

  @ApiOperation({ summary: 'Create a checkout session for an opening' })
  @Roles('STUDENT', 'FINANCE', 'ADMIN')
  @Post('payments/checkout')
  async checkout(@Request() req: any, @Body() dto: CheckoutDto) {
    return this.payments.checkout(req.user.userId, dto.openingId, { provider: dto.provider, couponCode: dto.couponCode });
  }

  @ApiOperation({ summary: 'My payments (student)' })
  @Roles('STUDENT')
  @Get('payments/my')
  myPayments(@Request() req: any) {
    return this.payments.listMy(req.user.userId);
  }

  @ApiOperation({ summary: 'All payments (admin/finance)' })
  @Roles(Role.ADMIN, Role.FINANCE)
  @Get('payments')
  allPayments() {
    return this.payments.listAll();
  }

  @ApiOperation({ summary: 'Refund a payment (admin/finance)' })
  @Roles(Role.ADMIN, Role.FINANCE)
  @Post('payments/:id/refund')
  refund(@Param('id') id: string, @Body() dto: RefundPaymentDto, @Request() req: any) {
    return this.payments.refund(id, req.user.userId, req.user.role, dto.reason);
  }

  @ApiOperation({ summary: 'Cancel a pending payment (owner student, admin, or finance)' })
  @Roles(Role.ADMIN, Role.FINANCE, Role.STUDENT)
  @Post('payments/:id/cancel')
  cancel(@Param('id') id: string, @Request() req: any) {
    return this.payments.cancel(id, req.user.userId, req.user.role);
  }

  // ---------- Currencies ----------

  @ApiOperation({ summary: 'List supported currencies' })
  @Get('currencies')
  listCurrencies() {
    return this.currencies.list();
  }

  @ApiOperation({ summary: 'Convert an amount between currencies' })
  @Get('currencies/convert')
  convert(@Body('amount') amount: number, @Body('from') from: string, @Body('to') to: string) {
    return this.currencies.convert(amount, from, to);
  }

  @ApiOperation({ summary: 'Create a currency (admin)' })
  @Roles(Role.ADMIN)
  @Post('currencies')
  createCurrency(@Body('code') code: string, @Body('symbol') symbol: string, @Body('nameAr') nameAr: string, @Body('nameEn') nameEn: string, @Body('rate') rate: number) {
    return this.currencies.create(code, { symbol, nameAr, nameEn, rate });
  }

  @ApiOperation({ summary: 'Update a currency (admin)' })
  @Roles(Role.ADMIN)
  @Patch('currencies/:code')
  updateCurrency(@Param('code') code: string, @Body('symbol') symbol: string, @Body('nameAr') nameAr: string, @Body('nameEn') nameEn: string, @Body('rate') rate: number, @Body('isBase') isBase?: boolean) {
    return this.currencies.upsert(code, { symbol, nameAr, nameEn, rate, isBase });
  }

  @ApiOperation({ summary: 'Delete a currency (admin)' })
  @Roles(Role.ADMIN)
  @Delete('currencies/:code')
  deleteCurrency(@Param('code') code: string) {
    return this.currencies.delete(code);
  }

  // ---------- Coupons ----------

  @ApiOperation({ summary: 'Validate a coupon for a course' })
  @Get('coupons/validate')
  validateCoupon(@Body('code') code: string, @Body('courseId') courseId: string, @Body('price') price: number) {
    return this.coupons.validate(code, courseId, price);
  }

  @ApiOperation({ summary: 'List all coupons (admin)' })
  @Roles(Role.ADMIN, Role.COURSE_MANAGER)
  @Get('coupons')
  listCoupons() {
    return this.coupons.list();
  }

  @ApiOperation({ summary: 'Create a coupon (admin)' })
  @Roles(Role.ADMIN)
  @Post('coupons')
  createCoupon(@Body() dto: CreateCouponDto) {
    return this.coupons.create(dto);
  }

  @ApiOperation({ summary: 'Update a coupon (admin)' })
  @Roles(Role.ADMIN)
  @Patch('coupons/:id')
  updateCoupon(@Param('id') id: string, @Body() dto: UpdateCouponDto) {
    return this.coupons.update(id, dto);
  }

  @ApiOperation({ summary: 'Delete a coupon (admin)' })
  @Roles(Role.ADMIN)
  @Delete('coupons/:id')
  deleteCoupon(@Param('id') id: string) {
    return this.coupons.remove(id);
  }
}