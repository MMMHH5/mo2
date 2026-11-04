import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { Injectable, UnauthorizedException } from '@nestjs/common';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
    constructor() {
        const clientID = process.env.GOOGLE_CLIENT_ID?.trim();
        const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
        const callbackURL = process.env.GOOGLE_CALLBACK_URL?.trim() || 'http://localhost:3001/auth/google/callback';

        super({
            clientID: clientID || 'google-oauth-not-configured',
            clientSecret: clientSecret || 'google-oauth-not-configured',
            callbackURL,
            scope: ['email', 'profile'],
        });
    }

    async validate(accessToken: string, refreshToken: string, profile: any, done: VerifyCallback): Promise<any> {
        const email = profile.emails?.find((entry: any) => entry?.verified !== false)?.value
            || profile.emails?.[0]?.value;

        if (!email || typeof email !== 'string') {
            done(new UnauthorizedException('Google account does not provide an email address'));
            return;
        }

        done(null, {
            email: email.trim().toLowerCase(),
            firstName: profile.name?.givenName || '',
            lastName: profile.name?.familyName || '',
            picture: profile.photos?.[0]?.value || '',
            provider: 'google',
            providerId: profile.id,
            accessToken,
        });
    }
}
