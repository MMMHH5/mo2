import { randomBytes, timingSafeEqual } from 'crypto';
import type { Request, Response } from 'express';

type StoreCallback = (error: Error | null, state: string | undefined) => void;
type VerifyCallback = (error: Error | null, verified: boolean, state?: unknown) => void;
type OAuthMetadata = {
    authorizationURL: string;
    tokenURL: string;
    clientID: string;
};

interface OAuthStateStore {
    store(req: Request, callback: StoreCallback): void;
    store(req: Request, meta: OAuthMetadata, callback: StoreCallback): void;
    verify(req: Request, state: string, callback: VerifyCallback): void;
    verify(req: Request, state: string, meta: OAuthMetadata, callback: VerifyCallback): void;
}

const STATE_COOKIE_PREFIX = process.env.NODE_ENV === 'production'
    ? '__Host-laxalab_google_oauth_'
    : 'laxalab_google_oauth_';
const STATE_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const STATE_COOKIE_OPTIONS = {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 10 * 60 * 1000,
};

function stateCookieName(state: string): string {
    return `${STATE_COOKIE_PREFIX}${state}`;
}

function readCookie(req: Request, name: string): string | undefined {
    const cookieHeader = req.headers.cookie;
    if (!cookieHeader) return undefined;

    for (const part of cookieHeader.split(';')) {
        const separator = part.indexOf('=');
        if (separator < 0 || part.slice(0, separator).trim() !== name) continue;
        try {
            return decodeURIComponent(part.slice(separator + 1).trim());
        } catch {
            return undefined;
        }
    }
    return undefined;
}

export class GoogleOAuthStateStore implements OAuthStateStore {
    store(req: Request, callback: StoreCallback): void;
    store(req: Request, meta: OAuthMetadata, callback: StoreCallback): void;
    store(req: Request, _meta: OAuthMetadata | StoreCallback, maybeCallback?: StoreCallback): void {
        const callback = typeof _meta === 'function' ? _meta : maybeCallback;
        if (!callback) return;

        const state = randomBytes(32).toString('base64url');
        const response = req.res as Response | undefined;
        if (!response) {
            callback(new Error('Google OAuth state could not be stored for this request'), undefined);
            return;
        }

        response.cookie(stateCookieName(state), state, STATE_COOKIE_OPTIONS);
        callback(null, state);
    }

    verify(req: Request, state: string, callback: VerifyCallback): void;
    verify(req: Request, state: string, meta: OAuthMetadata, callback: VerifyCallback): void;
    verify(req: Request, state: string, _meta: OAuthMetadata | VerifyCallback, maybeCallback?: VerifyCallback): void {
        const callback = typeof _meta === 'function' ? _meta : maybeCallback;
        if (!callback) return;

        if (!STATE_PATTERN.test(state || '')) {
            callback(null, false, { message: 'Unable to verify authorization request state.' });
            return;
        }

        const cookieName = stateCookieName(state);
        const response = req.res as Response | undefined;
        response?.clearCookie(cookieName, {
            httpOnly: true,
            sameSite: 'lax',
            secure: process.env.NODE_ENV === 'production',
            path: '/',
        });

        const storedState = readCookie(req, cookieName);
        if (!storedState || storedState.length !== state.length) {
            callback(null, false, { message: 'Unable to verify authorization request state.' });
            return;
        }

        const matches = timingSafeEqual(Buffer.from(storedState), Buffer.from(state));
        callback(null, matches, matches ? undefined : { message: 'Invalid authorization request state.' });
    }
}
