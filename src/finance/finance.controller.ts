import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { FinanceService } from './finance.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { CreateCouponDto, UpdateCouponDto, ValidateCouponDto } from './dto/coupon.dto';

@ApiTags('Finance Management')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('finance')
export class FinanceController {
    constructor(private readonly financeService: FinanceService) {}

    @ApiOperation({ summary: 'Payment report & analytics' })
    @Roles(Role.ADMIN, Role.FINANCE)
    @Get('reports')
    getPaymentReport() {
        return this.financeService.getPaymentReport();
    }

    @ApiOperation({ summary: 'List all coupons with courses and redemption counts' })
    @Roles(Role.ADMIN, Role.FINANCE)
    @Get('coupons')
    getCoupons() {
        return this.financeService.getCoupons();
    }

    @ApiOperation({ summary: 'Per-coupon statistics (uses, discounts, students, per-course)' })
    @Roles(Role.ADMIN, Role.FINANCE)
    @Get('coupons/:id/stats')
    getCouponStats(@Param('id') id: string) {
        return this.financeService.getCouponStats(id);
    }

    @ApiOperation({ summary: 'Create a coupon (finance or admin)' })
    @Roles(Role.ADMIN, Role.FINANCE)
    @Post('coupons')
    createCoupon(@Body() dto: CreateCouponDto) {
        return this.financeService.createCoupon(dto);
    }

    @ApiOperation({ summary: 'Update a coupon (finance or admin)' })
    @Roles(Role.ADMIN, Role.FINANCE)
    @Patch('coupons/:id')
    updateCoupon(@Param('id') id: string, @Body() dto: UpdateCouponDto) {
        return this.financeService.updateCoupon(id, dto);
    }

    @ApiOperation({ summary: 'Delete a coupon (only if never redeemed)' })
    @Roles(Role.ADMIN, Role.FINANCE)
    @Delete('coupons/:id')
    deleteCoupon(@Param('id') id: string) {
        return this.financeService.deleteCoupon(id);
    }

    // Any authenticated user (i.e. a student before paying) may check a code.
    @ApiOperation({ summary: 'Validate a coupon code and preview the discount' })
    @Post('coupons/validate')
    validateCoupon(@Body() dto: ValidateCouponDto) {
        return this.financeService.validateCoupon(dto.code, dto.courseId, dto.price);
    }
}
