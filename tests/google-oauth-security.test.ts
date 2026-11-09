import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import type { Request, Response } from 'express';
import { getVerifiedGoogleEmail } from '../src/auth/strategies/google.strategy';
import { GoogleOAuthStateStore } from '../src/auth/strategies/google-oauth-state.store';
import { AuthService } from '../src/auth/auth.service';

describe('Google OAuth security', () => {
    test('marks a newly created Google student for profile completion', async () => {
        let createdData: Record<string, unknown> | undefined;
        const prisma = {
            user: {
                findUnique: async () => null,
                create: async ({ data }: { data: Record<string, unknown> }) => {
                    createdData = data;
                    return {
                        id: 'new-student',
                        email: 'new-student@example.com',
                        role: 'STUDENT',
                        tokenVersion: 0,
                        emailVerifiedAt: new Date(),
                        twoFactorEnabled: false,
                        language: 'en',
                        isActive: true,
                        createdAt: new Date(),
                    };
                },
            },
            refreshToken: { create: async () => ({}) },
        };
        const service = new AuthService(
            prisma as never,
            { sign: () => 'access-token' } as never,
            {} as never,
            {} as never,
            {} as never,
        );

        const result = await service.googleLogin({
            user: {
                email: 'new-student@example.com',
                emailVerified: true,
                providerId: 'google-subject',
                firstName: 'New',
                lastName: 'Student',
            },
        });

        assert.equal('isNewGoogleUser' in result && result.isNewGoogleUser, true);
        assert.deepEqual(createdData?.metadata, {
            googleOnboardingPending: true,
            fullName: 'New Student',
        });
    });

    test('does not send an existing Google account to onboarding', async () => {
        const prisma = {
            user: {
                findUnique: async () => ({
                    id: 'existing-student',
                    email: 'existing@example.com',
                    role: 'STUDENT',
                    tokenVersion: 0,
                    emailVerifiedAt: new Date(),
                    twoFactorEnabled: false,
                    language: 'en',
                    isActive: true,
                    createdAt: new Date(),
                }),
            },
            refreshToken: { create: async () => ({}) },
        };
        const service = new AuthService(
            prisma as never,
            { sign: () => 'access-token' } as never,
            {} as never,
            {} as never,
            {} as never,
        );

        const result = await service.googleLogin({
            user: {
                email: 'existing@example.com',
                emailVerified: true,
                providerId: 'google-subject',
            },
        });

        assert.equal('isNewGoogleUser' in result, false);
    });

    test('accepts only explicitly verified Google email claims', () => {
        assert.equal(getVerifiedGoogleEmail({
            _json: { email_verified: true },
            emails: [{ value: ' Student@Example.com ', verified: true }],
        }), 'student@example.com');

        assert.equal(getVerifiedGoogleEmail({
            _json: { email_verified: false },
            emails: [{ value: 'student@example.com', verified: false }],
        }), null);
        assert.equal(getVerifiedGoogleEmail({
            _json: {},
            emails: [{ value: 'student@example.com' }],
        }), null);
        assert.equal(getVerifiedGoogleEmail({
            _json: { email_verified: true },
            emails: [{ value: 'student@example.com', verified: false }],
        }), null);
    });

    test('binds OAuth callback state to its initiating browser cookie', () => {
        let cookieName = '';
        let cookieValue = '';
        let cookieOptions: { httpOnly?: boolean; sameSite?: string; secure?: boolean; path?: string } | undefined;
        let clearedCookie = '';
        const response = {
            cookie(name: string, value: string, options: typeof cookieOptions) {
                cookieName = name;
                cookieValue = value;
                cookieOptions = options;
            },
            clearCookie(name: string) {
                clearedCookie = name;
            },
        } as unknown as Response;
        const store = new GoogleOAuthStateStore();
        const request = { headers: {}, res: response } as unknown as Request;
        let generatedState = '';

        store.store(request, {}, (error, state) => {
            assert.ifError(error);
            generatedState = state;
        });

        assert.match(generatedState, /^[A-Za-z0-9_-]{43}$/);
        assert.equal(cookieValue, generatedState);
        assert.ok(cookieName.endsWith(generatedState));
        assert.equal(cookieOptions?.httpOnly, true);
        assert.equal(cookieOptions?.sameSite, 'lax');
        assert.equal(cookieOptions?.path, '/');
        assert.equal(cookieOptions?.secure, process.env.NODE_ENV === 'production');

        const callbackRequest = {
            headers: { cookie: `${cookieName}=${cookieValue}` },
            res: response,
        } as unknown as Request;
        let verified = false;
        store.verify(callbackRequest, generatedState, {}, (error, result) => {
            assert.ifError(error);
            verified = result;
        });

        assert.equal(verified, true);
        assert.equal(clearedCookie, cookieName);
    });

    test('rejects state that does not match the initiating browser', () => {
        const request = {
            headers: { cookie: 'laxalab_google_oauth_state=other-session' },
            res: { clearCookie() {} },
        } as unknown as Request;
        let verified = true;

        new GoogleOAuthStateStore().verify(request, 'A'.repeat(43), {}, (error, result) => {
            assert.ifError(error);
            verified = result;
        });

        assert.equal(verified, false);
    });
});
