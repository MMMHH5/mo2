import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Req } from '@nestjs/common';
import { PaymentGatewaysService } from './payment-gateways.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

@Controller('payment-gateways')
export class PaymentGatewaysController {
    constructor(private readonly paymentGatewaysService: PaymentGatewaysService) { }

    @Get()
    async getActiveGateways() {
        // Public endpoint to get active methods
        return this.paymentGatewaysService.getActiveGateways();
    }

    @Get('all')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    async getAllGateways() {
        return this.paymentGatewaysService.getAllGateways();
    }

    @Post()
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    async createGateway(@Body() data: any, @Req() req: any) {
        return this.paymentGatewaysService.createGateway(data, req.user?.id || req.user?.userId);
    }

    @Patch(':id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    async updateGateway(@Param('id') id: string, @Body() data: any, @Req() req: any) {
        return this.paymentGatewaysService.updateGateway(id, data, req.user?.id || req.user?.userId);
    }

    @Delete(':id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    async deleteGateway(@Param('id') id: string, @Req() req: any) {
        return this.paymentGatewaysService.deleteGateway(id, req.user?.id || req.user?.userId);
    }
}
