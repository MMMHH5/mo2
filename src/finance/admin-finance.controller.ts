import { Controller, Get, Post, Patch, Delete, Body, Param, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { FinanceService } from './finance.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { PERMISSIONS } from '../auth/permissions/permissions';
import { Role } from '@prisma/client';
import { CreateCouponDto, UpdateCouponDto } from './dto/coupon.dto';
import { CreateFinanceExpenseDto, MarkFinanceExpensePaidDto, SetInstructorShareDto } from './dto/accounting.dto';

@ApiTags('Finance Management')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Controller('api/admin/finance')
export class AdminFinanceController {
    constructor(private readonly financeService: FinanceService) {}

    @ApiOperation({ summary: 'Payment report & analytics' })
    @Roles(Role.ADMIN, Role.FINANCE)
    @RequirePermissions(PERMISSIONS.FINANCE_READ)
    @Get('reports')
    getPaymentReport() {
        return this.financeService.getPaymentReport();
    }

    @ApiOperation({ summary: 'Course profitability, instructor entitlements, and expense ledger' })
    @Roles(Role.ADMIN, Role.FINANCE)
    @RequirePermissions(PERMISSIONS.FINANCE_READ)
    @Get('accounting')
    getAccountingReport() {
        return this.financeService.getAccountingReport();
    }

    @ApiOperation({ summary: 'Set the instructor revenue share for a course opening' })
    @Roles(Role.ADMIN, Role.FINANCE)
    @RequirePermissions(PERMISSIONS.FINANCE_WRITE)
    @Patch('accounting/openings/:id/instructor-share')
    setInstructorShare(@Param('id') id: string, @Body() dto: SetInstructorShareDto, @Req() req: any) {
        return this.financeService.setInstructorShare(id, dto.sharePercent ?? null, req.user.id || req.user.userId);
    }

    @ApiOperation({ summary: 'Create a draft operating expense or instructor payout' })
    @Roles(Role.ADMIN, Role.FINANCE)
    @RequirePermissions(PERMISSIONS.FINANCE_WRITE)
    @Post('accounting/expenses')
    createExpense(@Body() dto: CreateFinanceExpenseDto, @Req() req: any) {
        return this.financeService.createFinanceExpense(dto, req.user.id || req.user.userId);
    }

    @ApiOperation({ summary: 'Approve a draft expense' })
    @Roles(Role.ADMIN, Role.FINANCE)
    @RequirePermissions(PERMISSIONS.FINANCE_WRITE)
    @Patch('accounting/expenses/:id/approve')
    approveExpense(@Param('id') id: string, @Req() req: any) {
        return this.financeService.transitionFinanceExpense(id, 'approve', req.user.id || req.user.userId);
    }

    @ApiOperation({ summary: 'Reject a draft expense' })
    @Roles(Role.ADMIN, Role.FINANCE)
    @RequirePermissions(PERMISSIONS.FINANCE_WRITE)
    @Patch('accounting/expenses/:id/reject')
    rejectExpense(@Param('id') id: string, @Req() req: any) {
        return this.financeService.transitionFinanceExpense(id, 'reject', req.user.id || req.user.userId);
    }

    @ApiOperation({ summary: 'Record payment of an approved expense' })
    @Roles(Role.ADMIN, Role.FINANCE)
    @RequirePermissions(PERMISSIONS.FINANCE_WRITE)
    @Patch('accounting/expenses/:id/pay')
    payExpense(@Param('id') id: string, @Body() dto: MarkFinanceExpensePaidDto, @Req() req: any) {
        return this.financeService.transitionFinanceExpense(id, 'pay', req.user.id || req.user.userId, dto.paymentReference);
    }

    @ApiOperation({ summary: 'List all coupons with courses and redemption counts' })
    @Roles(Role.ADMIN, Role.FINANCE)
    @RequirePermissions(PERMISSIONS.FINANCE_READ)
    @Get('coupons')
    getCoupons() {
        return this.financeService.getCoupons();
    }

    @ApiOperation({ summary: 'Per-coupon statistics (uses, discounts, students, per-course)' })
    @Roles(Role.ADMIN, Role.FINANCE)
    @RequirePermissions(PERMISSIONS.FINANCE_READ)
    @Get('coupons/:id/stats')
    getCouponStats(@Param('id') id: string) {
        return this.financeService.getCouponStats(id);
    }

    @ApiOperation({ summary: 'Create a coupon (finance or admin)' })
    @Roles(Role.ADMIN, Role.FINANCE)
    @RequirePermissions(PERMISSIONS.FINANCE_WRITE)
    @Post('coupons')
    createCoupon(@Body() dto: CreateCouponDto) {
        return this.financeService.createCoupon(dto);
    }

    @ApiOperation({ summary: 'Update a coupon (finance or admin)' })
    @Roles(Role.ADMIN, Role.FINANCE)
    @RequirePermissions(PERMISSIONS.FINANCE_WRITE)
    @Patch('coupons/:id')
    updateCoupon(@Param('id') id: string, @Body() dto: UpdateCouponDto) {
        return this.financeService.updateCoupon(id, dto);
    }

    @ApiOperation({ summary: 'Delete a coupon (only if never redeemed)' })
    @Roles(Role.ADMIN, Role.FINANCE)
    @RequirePermissions(PERMISSIONS.FINANCE_WRITE)
    @Delete('coupons/:id')
    deleteCoupon(@Param('id') id: string) {
        return this.financeService.deleteCoupon(id);
    }
}
