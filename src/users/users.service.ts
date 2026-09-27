import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { Role, EnrollmentStatus, Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { unlink } from 'fs';
import { basename, join } from 'path';
import { hasValidSignature } from '../common/file-signatures';
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

    async getDetails(id: string) {
        const user = await this.prisma.user.findUnique({
            where: { id },
            select: { id: true, email: true, role: true, isActive: true, metadata: true, createdAt: true },
        });
        if (!user) throw new NotFoundException('User not found');

        const [enrollments, certificates] = await Promise.all([
            this.prisma.enrollment.findMany({
                where: { studentId: id },
                include: {
                    course: { select: { id: true, titleAr: true, titleEn: true } },
                    opening: { select: { id: true, nameAr: true, nameEn: true, startDate: true, endDate: true } },
                },
                orderBy: { createdAt: 'desc' },
            }),
            this.prisma.certificate.findMany({
                where: { studentId: id },
                select: { id: true, verificationCode: true, issuingDate: true, verificationStatus: true, courseId: true },
                orderBy: { issuingDate: 'desc' },
            }),
        ]);

        return { user, enrollments, certificates };
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

    /**
     * Profile `metadata` is free-form JSON, so anything a client sends used to be
     * stored verbatim. That let a caller park a `javascript:` string in
     * `avatarUrl` (stored XSS once rendered into an `src`) or an off-site
     * tracking pixel. Only the known profile keys survive, capped, and
     * `avatarUrl` is restricted to a path under our own uploads directory.
     */
    private sanitizeProfileMetadata(input: Record<string, unknown>): Record<string, unknown> {
        const LIMITS: Record<string, number> = {
            fullName: 120,
            nameAr: 120,
            nameEn: 120,
            country: 80,
            city: 80,
            phone: 32,
            bio: 500,
            specialty: 120,
        };
        const out: Record<string, unknown> = {};

        for (const [key, max] of Object.entries(LIMITS)) {
            const v = input[key];
            if (typeof v !== 'string') continue;
            const trimmed = v.trim().slice(0, max);
            if (trimmed) out[key] = trimmed;
        }

        const avatar = input.avatarUrl;
        if (typeof avatar === 'string') {
            const trimmed = avatar.trim();
            // Same-origin path only. Rejects absolute URLs, protocol-relative
            // "//evil.com", and javascript:/data: payloads. The character class
            // admits "." so ".." needs its own check or /uploads/../x escapes
            // the uploads directory.
            if (/^\/uploads\/[A-Za-z0-9._\/-]+$/.test(trimmed) && !trimmed.includes('..')) {
                out.avatarUrl = trimmed;
            } else if (trimmed === '') {
                out.avatarUrl = null;
            }
        }

        return out;
    }

    /**
     * Stores an uploaded avatar and points metadata.avatarUrl at it.
     *
     * The declared Content-Type is client-controlled, so the magic bytes are
     * verified before the path is trusted. The previous avatar is removed from
     * disk on success so replacing a picture does not leave orphans, but only
     * after the new one is safely recorded: if the write fails the old picture
     * stays and the user is not left with a broken reference.
     */
    async setAvatar(userId: string, file: Express.Multer.File) {
        if (!hasValidSignature(file.path, file.mimetype)) {
            unlink(file.path, () => undefined);
            throw new BadRequestException('The uploaded file is not a valid image.');
        }

        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { metadata: true },
        });
        if (!user) {
            unlink(file.path, () => undefined);
            throw new NotFoundException('User not found');
        }

        const previous = (user.metadata as Record<string, unknown> | null)?.avatarUrl;
        const publicPath = `/uploads/avatars/${file.filename}`;

        // Goes through the same sanitiser as PATCH /users/me, so an avatar can
        // only ever be a path inside our own uploads directory.
        const updated = await this.prisma.user.update({
            where: { id: userId },
            data: {
                metadata: this.sanitizeProfileMetadata({
                    ...((user.metadata as Record<string, unknown>) ?? {}),
                    avatarUrl: publicPath,
                }) as unknown as Prisma.InputJsonObject,
            },
            select: { id: true, metadata: true },
        });

        if (typeof previous === 'string' && previous.startsWith('/uploads/avatars/')) {
            // basename() so a crafted stored value cannot escape the folder.
            const oldName = basename(previous);
            if (oldName && oldName !== file.filename) {
                unlink(join(process.cwd(), 'uploads', 'avatars', oldName), () => undefined);
            }
        }

        return { avatarUrl: publicPath, metadata: updated.metadata };
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
            mustChangePassword?: boolean;
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
            // A voluntary change satisfies any forced-change requirement.
            data.mustChangePassword = false;
        }

        if (dto.language) {
            data.language = dto.language;
        }

        if (dto.metadata) {
            const merged = {
                ...((user.metadata as Record<string, unknown> | null) ?? {}),
                ...this.sanitizeProfileMetadata(dto.metadata as Record<string, unknown>),
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
                // Admin-provided passwords must be replaced by the user on first login.
                mustChangePassword: dto.mustChangePassword !== false,
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
            mustChangePassword?: boolean;
        } = {};
        if (dto.email) data.email = dto.email;
        if (dto.password) {
            data.passwordHash = await bcrypt.hash(dto.password, 10);
            // When the admin sets a password, force the user to replace it on next login.
            data.mustChangePassword = true;
        }
        if (dto.role) data.role = dto.role;
        if (typeof dto.isActive === 'boolean') data.isActive = dto.isActive;
        if (typeof dto.mustChangePassword === 'boolean') data.mustChangePassword = dto.mustChangePassword;

        const user = await this.prisma.user.update({
            where: { id },
            data,
            select: { id: true, email: true, role: true, isActive: true, mustChangePassword: true, createdAt: true },
        });

        // A forced password change must invalidate existing sessions so the next
        // login actually re-enters the change flow.
        if (dto.password) {
            await this.prisma.refreshToken.updateMany({ where: { userId: id }, data: { revokedAt: new Date() } });
        }

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