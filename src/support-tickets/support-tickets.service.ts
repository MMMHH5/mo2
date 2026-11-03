import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { TicketStatus } from '@prisma/client';

@Injectable()
export class SupportTicketsService {
    constructor(
        private prisma: PrismaService,
        private audit: AuditService,
    ) { }

    async create(userId: string, dto: { subject: string; message: string }) {
        if (!dto.subject || !dto.subject.trim()) {
            throw new BadRequestException('Subject is required');
        }
        if (!dto.message || !dto.message.trim()) {
            throw new BadRequestException('Message is required');
        }
        return this.prisma.supportTicket.create({
            data: {
                userId,
                subject: dto.subject.trim(),
                message: dto.message.trim(),
            },
        });
    }

    async getMy(userId: string) {
        return this.prisma.supportTicket.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
        });
    }

    async getAll() {
        return this.prisma.supportTicket.findMany({
            include: { user: { select: { id: true, email: true } } },
            orderBy: { createdAt: 'desc' },
        });
    }

    async update(id: string, dto: { status?: string; adminNotes?: string }, actorId: string) {
        const existing = await this.prisma.supportTicket.findUnique({ where: { id } });
        if (!existing) throw new NotFoundException('Ticket not found');

        const data: Record<string, unknown> = {};
        if (dto.status !== undefined) {
            const allowed = ['OPEN', 'IN_PROGRESS', 'CLOSED'];
            if (!allowed.includes(dto.status)) {
                throw new BadRequestException('Invalid ticket status');
            }
            data.status = dto.status;
        }
        if (dto.adminNotes !== undefined) {
            data.adminNotes = dto.adminNotes || null;
        }

        const ticket = await this.prisma.supportTicket.update({ where: { id }, data });
        await this.audit.logAction(`Updated support ticket ${id} -> ${dto.status ?? 'notes'}`, undefined, actorId);
        return ticket;
    }

    async getContactSubmissions() {
        return this.prisma.contactSubmission.findMany({
            orderBy: { createdAt: 'desc' },
        });
    }

    async updateContactSubmission(id: string, status: string, actorId: string) {
        const allowed = Object.values(TicketStatus);
        if (!allowed.includes(status as TicketStatus)) {
            throw new BadRequestException('Invalid contact submission status');
        }

        const existing = await this.prisma.contactSubmission.findUnique({ where: { id } });
        if (!existing) throw new NotFoundException('Contact submission not found');

        const submission = await this.prisma.contactSubmission.update({
            where: { id },
            data: { status: status as TicketStatus },
        });
        await this.audit.logAction(`Updated contact submission ${id} -> ${status}`, undefined, actorId);
        return submission;
    }
}