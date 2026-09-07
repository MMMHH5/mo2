import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { FinanceService } from './finance.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

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

    @ApiOperation({ summary: 'List all coupons' })
    @Roles(Role.ADMIN, Role.FINANCE)
    @Get('coupons')
    getCoupons() {
        return this.financeService.getCoupons();
    }

    @ApiOperation({ summary: 'Create a coupon' })
    @Roles(Role.ADMIN)
    @Post('coupons')
    createCoupon(@Body() body: {
        code: string;
        type: 'PERCENT' | 'AMOUNT';
        value: number;
        maxUses?: number;
        startsAt?: string;
        expiresAt?: string;
        courseIds?: string[];
    }) {
        return this.financeService.createCoupon(body);
    }

    @ApiOperation({ summary: 'Update a coupon' })
    @Roles(Role.ADMIN)
    @Patch('coupons/:id')
    updateCoupon(@Param('id') id: string, @Body() body: {
        code?: string;
        type?: 'PERCENT' | 'AMOUNT';
        value?: number;
        maxUses?: number | null;
        active?: boolean;
        expiresAt?: string | null;
    }) {
        return this.financeService.updateCoupon(id, body);
    }

    @ApiOperation({ summary: 'Delete a coupon' })
    @Roles(Role.ADMIN)
    @Delete('coupons/:id')
    deleteCoupon(@Param('id') id: string) {
        return this.financeService.deleteCoupon(id);
    }

    @ApiOperation({ summary: 'Validate a coupon code' })
    @Post('coupons/validate')
    validateCoupon(@Body('code') code: string, @Body('courseId') courseId?: string) {
        return this.financeService.validateCoupon(code, courseId);
    }
}
