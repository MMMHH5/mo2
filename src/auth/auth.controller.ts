import { Controller, Post, Body, HttpCode, HttpStatus, Get, UseGuards, Req, Res, Request } from '@nestjs/common';
import { Response } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { getFrontendUrl } from '../common/frontend-url';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) {}

    @ApiOperation({ summary: 'Register a new user' })
    @ApiResponse({ status: 201, description: 'User successfully created.' })
    @ApiResponse({ status: 409, description: 'Email already exists.' })
    @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 registrations per minute
    @Post('register')
    async register(@Body() registerDto: RegisterDto) {
        return this.authService.register(registerDto);
    }

    @ApiOperation({ summary: 'Login user and return JWT (returns two-factor challenge when enabled)' })
    @ApiResponse({ status: 200, description: 'User successfully logged in.' })
    @ApiResponse({ status: 401, description: 'Invalid credentials.' })
    @HttpCode(HttpStatus.OK)
    @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 login attempts per minute
    @Post('login')
    async login(@Body() loginDto: LoginDto) {
        return this.authService.login(loginDto);
    }

    @ApiOperation({ summary: 'Complete two-factor sign in with a verification code' })
    @HttpCode(HttpStatus.OK)
    @Post('2fa/verify-login')
    async verifyTwoFactor(@Body('tempToken') tempToken: string, @Body('code') code: string) {
        return this.authService.verify2FALogin(tempToken, code);
    }

    @ApiOperation({ summary: 'Set a new password when the account requires it (issued via login)' })
    @ApiResponse({ status: 200, description: 'Password changed successfully.' })
    @ApiResponse({ status: 401, description: 'Invalid or expired password-change token.' })
    @HttpCode(HttpStatus.OK)
    @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 changes per minute
    @Post('change-password')
    async changePassword(@Body() dto: ChangePasswordDto) {
        return this.authService.changePasswordForced(dto.tempToken, dto.newPassword);
    }

    @ApiOperation({ summary: 'Request a password reset email' })
    @HttpCode(HttpStatus.OK)
    @Throttle({ default: { limit: 3, ttl: 900000 } }) // 3 requests per 15 minutes
    @Post('forgot-password')
    async forgotPassword(@Body('email') email: string) {
        return this.authService.forgotPassword(email);
    }

    @ApiOperation({ summary: 'Reset the password using a reset token' })
    @HttpCode(HttpStatus.OK)
    @Post('reset-password')
    async resetPassword(@Body('token') token: string, @Body('newPassword') newPassword: string) {
        return this.authService.resetPassword(token, newPassword);
    }

    @ApiOperation({ summary: 'Verify an email address using a token' })
    @HttpCode(HttpStatus.OK)
    @Post('verify-email')
    async verifyEmail(@Body('token') token: string) {
        return this.authService.verifyEmail(token);
    }

    @ApiOperation({ summary: 'Rotate a refresh token and issue a new access token' })
    @HttpCode(HttpStatus.OK)
    @Post('refresh')
    async refresh(@Body('refreshToken') refreshToken: string) {
        return this.authService.refresh(refreshToken);
    }

    @ApiOperation({ summary: 'Revoke a refresh token (sign out)' })
    @HttpCode(HttpStatus.OK)
    @Post('logout')
    @UseGuards(JwtAuthGuard)
    async logout(@Request() req: any, @Body('refreshToken') refreshToken?: string) {
        return this.authService.logout(req.user.userId, refreshToken);
    }

    // ---------- Authenticated 2FA management ----------

    @ApiOperation({ summary: 'Begin 2FA setup (returns secret + QR code)' })
    @ApiBearerAuth('JWT-auth')
    @Post('2fa/setup')
    @UseGuards(JwtAuthGuard)
    async setup2FA(@Request() req: any) {
        return this.authService.setup2FA(req.user.userId);
    }

    @ApiOperation({ summary: 'Confirm and enable 2FA with a verification code' })
    @ApiBearerAuth('JWT-auth')
    @Post('2fa/confirm')
    @UseGuards(JwtAuthGuard)
    async confirm2FA(@Request() req: any, @Body('code') code: string) {
        return this.authService.confirm2FA(req.user.userId, code);
    }

    @ApiOperation({ summary: 'Disable 2FA (requires password + current code)' })
    @ApiBearerAuth('JWT-auth')
    @Post('2fa/disable')
    @UseGuards(JwtAuthGuard)
    async disable2FA(@Request() req: any, @Body('password') password: string, @Body('code') code: string) {
        return this.authService.disable2FA(req.user.userId, password, code);
    }

    @ApiOperation({ summary: 'Resend the email verification link' })
    @ApiBearerAuth('JWT-auth')
    @Post('resend-verification')
    @UseGuards(JwtAuthGuard)
    async resendVerification(@Request() req: any) {
        return this.authService.requestEmailVerification(req.user.userId, req.user.email);
    }

    @ApiOperation({ summary: 'Initiate Google Auth' })
    @Get('google')
    @UseGuards(AuthGuard('google'))
    async googleAuth(@Req() req: Request) {
        // Guard redirects
    }

    @ApiOperation({ summary: 'Google Auth Callback' })
    @Get('google/callback')
    @UseGuards(AuthGuard('google'))
    async googleAuthRedirect(@Req() req: Request, @Res() res: Response) {
        const result = await this.authService.googleLogin(req);
        const frontendUrl = getFrontendUrl();
        // Use hash fragments (#) instead of query params (?) to prevent tokens
        // from being logged in browser history, server logs, referrer headers, etc.
        if ('access_token' in result) {
            return res.redirect(
                `${frontendUrl}/auth/success#token=${encodeURIComponent(result.access_token)}&refresh=${encodeURIComponent(result.refresh_token)}`
            );
        }
        if ('requiresTwoFactor' in result && result.requiresTwoFactor) {
            return res.redirect(`${frontendUrl}/auth/success#twoFactor=1&tempToken=${encodeURIComponent(result.tempToken)}`);
        }
        // Google-created accounts have no password, so a forced password change
        // never applies to them; fall back to sign-in just in case.
        return res.redirect(`${frontendUrl}/login`);
    }
}