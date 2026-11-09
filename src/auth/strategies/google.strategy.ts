import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { GoogleOAuthStateStore } from './google-oauth-state.store';

export function getVerifiedGoogleEmail(profile: any): string | null {
    if (profile?._json?.email_verified !== true) return null;

    const email = profile.emails?.find((entry: any) => entry?.verified === true)?.value;
    return typeof email === 'string' && email.trim() ? email.trim().toLowerCase() : null;
}

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
    constructor() {
        const clientID = process.env.GOOGLE_CLIENT_ID?.trim();
        const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
        const callbackURL = process.env.GOOGLE_CALLBACK_URL?.trim()
            || (process.env.NODE_ENV === 'production'
                ? 'https://laxalab-api-public.onrender.com/auth/google/callback'
                : 'http://localhost:3001/auth/google/callback');

        super({
            clientID: clientID || 'google-oauth-not-configured',
            clientSecret: clientSecret || 'google-oauth-not-configured',
            callbackURL,
            scope: ['email', 'profile'],
            state: true,
            store: new GoogleOAuthStateStore(),
        });
    }

    async validate(accessToken: string, refreshToken: string, profile: any, done: VerifyCallback): Promise<any> {
        const email = getVerifiedGoogleEmail(profile);
        if (!email) {
            done(new UnauthorizedException('Google account does not provide a verified email address'));
            return;
        }
        if (typeof profile.id !== 'string' || !profile.id.trim()) {
            done(new UnauthorizedException('Google account identifier is missing'));
            return;
        }

        done(null, {
            email,
            emailVerified: true,
            firstName: profile.name?.givenName || '',
            lastName: profile.name?.familyName || '',
            picture: profile.photos?.[0]?.value || '',
            provider: 'google',
            providerId: profile.id,
            accessToken,
        });
    }
}
