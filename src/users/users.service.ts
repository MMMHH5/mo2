import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { Role, EnrollmentStatus, Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { CreateUserDto, UpdateUserDto, UpdateMeDto } from './dto/user.dto';

@Injectable()
export class UsersService {
    constructor(
        private prisma: PrismaService,
        private audit: AuditService,
    ) { }

    async findAll() {
        return this.prisma.user.findMany({
            select: { id: true, email: true, role: true, isActive: true, createdAt: true },
            orderBy: { createdAt: 'desc' },
        });
    }

    async findOne(id: string) {
        const user = await this.prisma.user.findUnique({
            where: { id },
            select: { id: true, email: true, role: true, isActive: true, metadata: true, createdAt: true }
        });
        if (!user) throw new NotFoundException('User not found');
        return user;
    }

    async getMe(userId: string) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true, email: true, role: true, isActive: true, metadata: true,
                createdAt: true, updatedAt: true, language: true, emailVerifiedAt: true,
                twoFactorEnabled: true,
            },
        });
        if (!user) throw new NotFoundException('User not found');

        const canSeePending = user.role === Role.FINANCE || user.role === Role.ADMIN;

        const [
            enrollments,
            certificates,
            coursesTaught,
            openingsTaught,
            pendingEnrollments,
            tickets,
            unreadMessages,
            unreadNotifications,
        ] = await Promise.all([
            this.prisma.enrollment.count({ where: { studentId: user.id } }),
            this.prisma.certificate.count({ where: { studentId: user.id } }),
            this.prisma.course.count({ where: { instructorId: user.id } }),
            this.prisma.courseOpening.count({ where: { instructorId: user.id } }),
            canSeePending ? this.prisma.enrollment.count({ where: { status: EnrollmentStatus.PENDING } }) : Promise.resolve(0),
            this.prisma.supportTicket.count({ where: { userId: user.id } }),
            this.prisma.message.count({ where: { recipientId: user.id, readAt: null } }),
            this.prisma.notification.count({ where: { userId: user.id, readAt: null } }),
        ]);

        return {
            ...user,
            stats: {
                enrollments,
                certificates,
                coursesTaught,
                openingsTaught,
                pendingEnrollments,
                tickets,
                unreadMessages,
                unreadNotifications,
            },
        };
    }

    async updateMe(userId: string, dto: UpdateMeDto) {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user) throw new NotFoundException('User not found');

        const wantsCredentialChange = Boolean(dto.email) || Boolean(dto.password);
        if (wantsCredentialChange) {
            if (!dto.currentPassword) {
                throw new BadRequestException('currentPassword is required to change email or password');
            }
            const pwMatches = await bcrypt.compare(dto.currentPassword, user.passwordHash);
            if (!pwMatches) {
                throw new BadRequestException('Current password is incorrect');
            }
        }

        const data: {
            email?: string;
            passwordHash?: string;
            metadata?: Prisma.InputJsonObject;
            language?: string;
        } = {};

        if (dto.email && dto.email !== user.email) {
            const conflict = await this.prisma.user.findUnique({ where: { email: dto.email } });
            if (conflict) throw new ConflictException('Email already in use');
            data.email = dto.email;
            // Changing email invalidates verification
            data.metadata = undefined;
        }

        if (dto.password) {
            data.passwordHash = await bcrypt.hash(dto.password, 12);
        }

        if (dto.language) {
            data.language = dto.language;
        }

        if (dto.metadata) {
            const merged = {
                ...((user.metadata as Record<string, unknown> | null) ?? {}),
                ...(dto.metadata ?? {}),
            };
            data.metadata = merged as unknown as Prisma.InputJsonObject;
        }

        if (dto.email && dto.email !== user.email) {
            await this.prisma.user.update({
                where: { id: userId },
                data: { emailVerifiedAt: null },
            });
        }

        const updated = await this.prisma.user.update({
            where: { id: userId },
            data,
            select: { id: true, email: true, role: true, isActive: true, metadata: true, createdAt: true, updatedAt: true, language: true, emailVerifiedAt: true, twoFactorEnabled: true },
        });

        await this.audit.logAction(`User ${userId} updated their profile${data.email ? ' (email changed)' : ''}${data.passwordHash ? ' (password changed)' : ''}`);
        return updated;
    }

    async exportMyData(userId: string) {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user) throw new NotFoundException('User not found');

        const [profile, enrollments, certificates, coursesTaught, tickets, messagesSent, messagesReceived, payments, notifications] =
            await Promise.all([
                this.prisma.user.findUnique({
                    where: { id: userId },
                    select: { id: true, email: true, role: true, isActive: true, language: true, emailVerifiedAt: true, createdAt: true, metadata: true },
                }),
                this.prisma.enrollment.findMany({ where: { studentId: userId }, include: { course: { select: { titleAr: true, titleEn: true } }, opening: { select: { id: true, nameAr: true, nameEn: true, price: true, currency: true } } } }),
                this.prisma.certificate.findMany({ where: { studentId: userId }, select: { id: true, verificationCode: true, issuingDate: true, verificationStatus: true } }),
                this.prisma.course.findMany({ where: { instructorId: userId }, select: { id: true, titleAr: true, titleEn: true, createdAt: true } }),
                this.prisma.supportTicket.findMany({ where: { userId }, select: { id: true, subject: true, message: true, status: true, createdAt: true } }),
                this.prisma.message.findMany({ where: { senderId: userId }, select: { content: true, createdAt: true, recipientId: true } }),
                this.prisma.message.findMany({ where: { recipientId: userId }, select: { content: true, createdAt: true, senderId: true } }),
                this.prisma.payment.findMany({ where: { studentId: userId } }),
                this.prisma.notification.findMany({ where: { userId }, select: { type: true, titleEn: true, bodyEn: true, readAt: true, createdAt: true } }),
            ]);

        return {
            exportedAt: new Date().toISOString(),
            profile,
            enrollments,
            certificates,
            coursesTaught,
            supportTickets: tickets,
            messagesSent,
            messagesReceived,
            payments,
            notifications,
        };
    }

    async deleteMyAccount(userId: string, currentPassword: string) {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user) throw new NotFoundException('User not found');
        const pwMatches = await bcrypt.compare(currentPassword, user.passwordHash);
        if (!pwMatches) throw new BadRequestException('Password is incorrect');

        await this.prisma.$transaction([
            this.prisma.refreshToken.deleteMany({ where: { userId } }),
            this.prisma.notification.deleteMany({ where: { userId } }),
            this.prisma.message.deleteMany({ where: { OR: [{ senderId: userId }, { recipientId: userId }] } }),
        ]);

        try {
            await this.prisma.user.delete({ where: { id: userId } });
            await this.audit.logAction(`User ${userId} deleted their own account (GDPR)`);
            return { ok: true, deleted: true };
        } catch {
            // Hard delete blocked by relational integrity — anonymize instead (GDPR erasure equivalent)
            const anonEmail = `deleted-${randomUUID()}@laxalab.local`;
            await this.prisma.user.update({
                where: { id: userId },
                data: {
                    email: anonEmail,
                    passwordHash: await bcrypt.hash(randomUUID(), 12),
                    isActive: false,
                    twoFactorEnabled: false,
                    twoFactorSecret: null,
                    emailVerifiedAt: null,
                    metadata: { anonymized: true, anonymizedAt: new Date().toISOString() },
                },
            });
            await this.audit.logAction(`User ${userId} account anonymized (GDPR) because of relational constraints`);
            return { ok: true, deleted: false, anonymized: true };
        }
    }

    async create(dto: CreateUserDto, adminId: string, ip?: string) {
        const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
        if (existing) {
            throw new ConflictException('Email already in use');
        }

        const passwordHash = await bcrypt.hash(dto.password, 10);
        const user = await this.prisma.user.create({
            data: {
                email: dto.email,
                passwordHash,
                role: dto.role ?? Role.STUDENT,
                isActive: dto.isActive ?? true,
            },
            select: { id: true, email: true, role: true, isActive: true, createdAt: true },
        });

        await this.audit.logAction(`ADMIN ${adminId} created user ${user.id} (${user.email}) with role ${user.role}`, ip, adminId);
        return user;
    }

    async update(id: string, dto: UpdateUserDto, adminId: string, ip?: string) {
        const existing = await this.prisma.user.findUnique({ where: { id } });
        if (!existing) throw new NotFoundException('User not found');

        if (dto.email && dto.email !== existing.email) {
            const conflict = await this.prisma.user.findUnique({ where: { email: dto.email } });
            if (conflict) throw new ConflictException('Email already in use');
        }

        const data: {
            email?: string;
            passwordHash?: string;
            role?: Role;
            isActive?: boolean;
        } = {};
        if (dto.email) data.email = dto.email;
        if (dto.password) data.passwordHash = await bcrypt.hash(dto.password, 10);
        if (dto.role) data.role = dto.role;
        if (typeof dto.isActive === 'boolean') data.isActive = dto.isActive;

        const user = await this.prisma.user.update({
            where: { id },
            data,
            select: { id: true, email: true, role: true, isActive: true, createdAt: true },
        });

        await this.audit.logAction(`ADMIN ${adminId} updated user ${id} (${user.email})`, ip, adminId);
        return user;
    }

    async updateRole(id: string, newRole: Role, adminId: string, ip?: string) {
        await this.audit.logAction(`ADMIN ${adminId} changed user ${id} role to ${newRole}`, ip, adminId);
        return this.prisma.user.update({
            where: { id },
            data: { role: newRole },
            select: { id: true, email: true, role: true, isActive: true, createdAt: true },
        });
    }

    async remove(id: string, adminId: string, ip?: string) {
        await this.audit.logAction(`ADMIN ${adminId} deleted user ${id}`, ip, adminId);
        return this.prisma.user.delete({ where: { id } });
    }
}