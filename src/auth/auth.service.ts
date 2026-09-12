import {
    Injectable,
    UnauthorizedException,
    ConflictException,
    ForbiddenException,
    BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { getFrontendUrl } from '../common/frontend-url';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { generateSecret, verify as verifyOtp } from 'otplib';
import * as qrcode from 'qrcode';
import * as crypto from 'crypto';
import * as bcrypt from 'bcryptjs';

export interface PublicUser {
    id: string;
    email: string;
    role: string;
    emailVerifiedAt: Date | null;
    twoFactorEnabled: boolean;
    language: string;
    isActive: boolean;
    createdAt: Date;
}

export type LoginResult =
    | { requiresTwoFactor: true; tempToken: string }
    | { requiresPasswordChange: true; tempToken: string }
    | { requiresTwoFactor: false; access_token: string; refresh_token: string; user: PublicUser };

@Injectable()
export class AuthService {
    constructor(
        private prisma: PrismaService,
        private jwtService: JwtService,
        private email: EmailService,
    ) {}

    private hashToken(token: string): string {
        return crypto.createHash('sha256').update(token).digest('hex');
    }

    private generateToken(): { raw: string; hash: string } {
        const raw = crypto.randomBytes(32).toString('hex');
        return { raw, hash: this.hashToken(raw) };
    }

    private appUrl(): string {
        return getFrontendUrl();
    }

    async register(dto: RegisterDto) {
        const existingUser = await this.prisma.user.findUnique({ where: { email: dto.email } });
        if (existingUser) throw new ConflictException('Email already in use');

        const hashedPassword = await bcrypt.hash(dto.password, 12);

        const user = await this.prisma.user.create({
            data: { email: dto.email, passwordHash: hashedPassword, role: 'STUDENT' },
        });

        await this.issueVerificationEmail(user.id, user.email);

        const tokens = await this.issueTokens(user.id, user.email, user.role);
        return { ...tokens, user: this.publicUser(user) };
    }

    async login(dto: LoginDto): Promise<LoginResult> {
        const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
        if (!user) throw new UnauthorizedException('Invalid credentials');
        if (!user.isActive) throw new ForbiddenException('Account is suspended');

        const pwMatches = await bcrypt.compare(dto.password, user.passwordHash);
        if (!pwMatches) throw new UnauthorizedException('Invalid credentials');

        if (user.mustChangePassword) {
            const tempToken = this.jwtService.sign(
                { sub: user.id, email: user.email, role: user.role, purpose: 'pwd_change' },
                { expiresIn: '5m' }
            );
            return { requiresPasswordChange: true, tempToken };
        }

        if (user.twoFactorEnabled) {
            const tempToken = this.jwtService.sign(
                { sub: user.id, email: user.email, role: user.role, purpose: '2fa' },
                { expiresIn: '5m' }
            );
            return { requiresTwoFactor: true, tempToken };
        }

        const tokens = await this.issueTokens(user.id, user.email, user.role);
        return { ...tokens, requiresTwoFactor: false, user: this.publicUser(user) };
    }

    async verify2FALogin(tempToken: string, code: string) {
        let payload: any;
        try {
            payload = this.jwtService.verify(tempToken);
        } catch {
            throw new UnauthorizedException('Two-factor session expired. Please sign in again.');
        }
        if (payload.purpose !== '2fa') throw new UnauthorizedException('Invalid two-factor token');

        const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
        if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) {
            throw new UnauthorizedException('Two-factor authentication is not enabled for this account');
        }
        const valid = await verifyOtp({ token: code, secret: user.twoFactorSecret });
        if (!valid) throw new UnauthorizedException('Incorrect verification code');

        const tokens = await this.issueTokens(user.id, user.email, user.role);
        return { ...tokens, user: this.publicUser(user) };
    }

    async changePasswordForced(tempToken: string, newPassword: string) {
        let payload: any;
        try {
            payload = this.jwtService.verify(tempToken);
        } catch {
            throw new UnauthorizedException('Password change session expired. Please sign in again.');
        }
        if (payload.purpose !== 'pwd_change') throw new UnauthorizedException('Invalid password change token');

        const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
        if (!user) throw new UnauthorizedException('User not found');
        if (!user.mustChangePassword) throw new BadRequestException('Password change is not required for this account');

        const hashed = await bcrypt.hash(newPassword, 12);

        await this.prisma.$transaction([
            this.prisma.user.update({ where: { id: user.id }, data: { passwordHash: hashed, mustChangePassword: false } }),
            this.prisma.refreshToken.updateMany({ where: { userId: user.id }, data: { revokedAt: new Date() } }),
        ]);

        return { ok: true };
    }

    private publicUser(user: { id: string; email: string; role: string; emailVerifiedAt: Date | null; twoFactorEnabled: boolean; language: string; isActive: boolean; createdAt: Date }) {
        return { id: user.id, email: user.email, role: user.role, emailVerifiedAt: user.emailVerifiedAt, twoFactorEnabled: user.twoFactorEnabled, language: user.language, isActive: user.isActive, createdAt: user.createdAt };
    }

    private async issueTokens(userId: string, email: string, role: string) {
        const access_token = this.jwtService.sign({ sub: userId, email, role });
        const refresh = this.generateToken();
        await this.prisma.refreshToken.create({
            data: {
                tokenHash: refresh.hash,
                userId,
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            },
        });
        return { access_token, refresh_token: refresh.raw };
    }

    async refresh(refreshToken: string) {
        const token = await this.prisma.refreshToken.findUnique({ where: { tokenHash: this.hashToken(refreshToken) } });
        if (!token || token.revokedAt || token.expiresAt < new Date()) {
            throw new UnauthorizedException('Invalid or expired refresh token');
        }

        const user = await this.prisma.user.findUnique({ where: { id: token.userId } });
        if (!user || !user.isActive) throw new UnauthorizedException('Account not available');

        // Rotate the refresh token
        const newRefresh = this.generateToken();
        await this.prisma.$transaction([
            this.prisma.refreshToken.update({ where: { id: token.id }, data: { revokedAt: new Date() } }),
            this.prisma.refreshToken.create({
                data: { tokenHash: newRefresh.hash, userId: user.id, expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
            }),
        ]);

        const access_token = this.jwtService.sign({ sub: user.id, email: user.email, role: user.role });
        return { access_token, refresh_token: newRefresh.raw };
    }

    async logout(userId: string, refreshToken?: string) {
        if (refreshToken) {
            await this.prisma.refreshToken.updateMany({
                where: { userId, tokenHash: this.hashToken(refreshToken) },
                data: { revokedAt: new Date() },
            });
        }
        return { ok: true };
    }

    async forgotPassword(email: string) {
        const user = await this.prisma.user.findUnique({ where: { email } });
        if (user) {
            const { raw, hash: tokenHash } = this.generateToken();
            await this.prisma.passwordResetToken.create({
                data: { tokenHash, userId: user.id, expiresAt: new Date(Date.now() + 60 * 60 * 1000) },
            });
            const resetUrl = `${this.appUrl()}/reset-password?token=${raw}`;
            await this.email.sendPasswordReset(user.email, resetUrl);
        }
        // Always respond OK to avoid user enumeration
        return { ok: true };
    }

    async resetPassword(token: string, newPassword: string) {
        const record = await this.prisma.passwordResetToken.findUnique({ where: { tokenHash: this.hashToken(token) } });
        if (!record || record.usedAt || record.expiresAt < new Date()) {
            throw new BadRequestException('Invalid or expired reset token');
        }

        const hashed = await bcrypt.hash(newPassword, 12);

        await this.prisma.$transaction([
            this.prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
            this.prisma.user.update({ where: { id: record.userId }, data: { passwordHash: hashed, mustChangePassword: false } }),
            this.prisma.refreshToken.updateMany({ where: { userId: record.userId }, data: { revokedAt: new Date() } }),
        ]);

        return { ok: true };
    }

    async requestEmailVerification(userId: string, email: string) {
        const { raw, hash: tokenHash } = this.generateToken();
        await this.prisma.emailVerificationToken.create({
            data: { tokenHash, userId, expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) },
        });
        const verifyUrl = `${this.appUrl()}/verify-email?token=${raw}`;
        await this.email.sendEmailVerification(email, verifyUrl);
        return { ok: true };
    }

    private async issueVerificationEmail(userId: string, email: string) {
        await this.requestEmailVerification(userId, email);
    }

    async verifyEmail(token: string, userId?: string) {
        const record = await this.prisma.emailVerificationToken.findUnique({ where: { tokenHash: this.hashToken(token) } });
        if (!record || record.usedAt || record.expiresAt < new Date()) {
            throw new BadRequestException('Invalid or expired verification token');
        }
        await this.prisma.$transaction([
            this.prisma.emailVerificationToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
            this.prisma.user.update({ where: { id: record.userId }, data: { emailVerifiedAt: new Date() } }),
        ]);
        return { ok: true };
    }

    async setup2FA(userId: string) {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user) throw new UnauthorizedException('User not found');

        const secret = generateSecret();
        const label = encodeURIComponent(`Laxalab:${user.email}`);
        const otpauth = `otpauth://totp/${label}?secret=${secret}&issuer=Laxalab&algorithm=SHA1&digits=6&period=30`;
        const qrDataUrl = await qrcode.toDataURL(otpauth);

        // Store the secret immediately so confirm can verify against it.
        await this.prisma.user.update({ where: { id: userId }, data: { twoFactorSecret: secret } });

        return { secret, otpauth, qrDataUrl };
    }

    async confirm2FA(userId: string, code: string) {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user || !user.twoFactorSecret) throw new BadRequestException('No pending 2FA setup');

        const valid = await verifyOtp({ token: code, secret: user.twoFactorSecret });
        if (!valid) throw new BadRequestException('Incorrect verification code');

        await this.prisma.user.update({ where: { id: userId }, data: { twoFactorEnabled: true } });
        return { ok: true, twoFactorEnabled: true };
    }

    async disable2FA(userId: string, password: string, code: string) {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user) throw new UnauthorizedException('User not found');

        const pwMatches = await bcrypt.compare(password, user.passwordHash);
        if (!pwMatches) throw new BadRequestException('Password is incorrect');

        if (user.twoFactorEnabled) {
            if (!user.twoFactorSecret) throw new BadRequestException('Two-factor is not configured');
            const valid = await verifyOtp({ token: code, secret: user.twoFactorSecret });
            if (!valid) throw new BadRequestException('Incorrect verification code');
        }

        await this.prisma.user.update({
            where: { id: userId },
            data: { twoFactorEnabled: false, twoFactorSecret: null },
        });
        return { ok: true, twoFactorEnabled: false };
    }

    async googleLogin(req: any): Promise<LoginResult> {
        if (!req.user) throw new UnauthorizedException('No user from google');

        const { email } = req.user;
        let user = await this.prisma.user.findUnique({ where: { email } });

        if (!user) {
            // Use a random bcrypt hash (not a sentinel string) to prevent timing-based user enumeration
            const randomHash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);
            user = await this.prisma.user.create({
                data: { email, passwordHash: randomHash, role: 'STUDENT', emailVerifiedAt: new Date() },
            });
        }

        if (!user.isActive) throw new ForbiddenException('Account is suspended');

        if (user.twoFactorEnabled) {
            const tempToken = this.jwtService.sign(
                { sub: user.id, email: user.email, role: user.role, purpose: '2fa' },
                { expiresIn: '5m' }
            );
            return { requiresTwoFactor: true, tempToken };
        }

        const tokens = await this.issueTokens(user.id, user.email, user.role);
        return { ...tokens, requiresTwoFactor: false, user: this.publicUser(user) };
    }
}