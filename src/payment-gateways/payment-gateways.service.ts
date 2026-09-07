import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class PaymentGatewaysService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly auditService: AuditService
    ) { }

    async getAllGateways() {
        return this.prisma.paymentGateway.findMany({
            orderBy: { createdAt: 'asc' }
        });
    }

    async getActiveGateways() {
        return this.prisma.paymentGateway.findMany({
            where: { isActive: true },
            orderBy: { createdAt: 'asc' }
        });
    }

    async createGateway(data: any, userId?: string) {
        const gateway = await this.prisma.paymentGateway.create({
            data: {
                name: data.name,
                instructions: data.instructions,
                walletGuideImageUrl: data.walletGuideImageUrl,
                isActive: data.isActive ?? true,
            }
        });

        if (userId) {
            await this.auditService.logAction('CREATE_PAYMENT_GATEWAY', undefined, userId);
        }

        return gateway;
    }

    async updateGateway(id: string, data: any, userId?: string) {
        try {
            const gateway = await this.prisma.paymentGateway.update({
                where: { id },
                data
            });
            if (userId) {
                await this.auditService.logAction('UPDATE_PAYMENT_GATEWAY', undefined, userId);
            }
            return gateway;
        } catch (e) {
            throw new NotFoundException('Gateway not found');
        }
    }

    async deleteGateway(id: string, userId?: string) {
        try {
            await this.prisma.paymentGateway.delete({ where: { id } });
            if (userId) {
                await this.auditService.logAction('DELETE_PAYMENT_GATEWAY', undefined, userId);
            }
        } catch (e) {
            throw new NotFoundException('Gateway not found');
        }
    }
}
