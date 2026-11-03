import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { BadRequestException } from '@nestjs/common';
import { ContactMethod } from '@prisma/client';
import { PublicController } from '../src/public/public.controller';

describe('public contact submissions', () => {
    test('persists an email contact request for the admin inbox', async () => {
        const saved: any[] = [];
        const controller = new PublicController(
            { contactSubmission: { create: async (args: any) => { saved.push(args.data); return { id: 'submission-id' }; } } } as any,
            { logAction: async () => undefined } as any,
            { sendContactEmail: async () => undefined } as any,
        );

        const result = await controller.contact(
            { name: 'Guest', contactMethod: 'email', email: ' Guest@Example.com ', message: 'Help' },
            '127.0.0.1',
        );

        assert.deepEqual(result, { ok: true, id: 'submission-id' });
        assert.deepEqual(saved[0], {
            name: 'Guest',
            email: 'guest@example.com',
            phone: null,
            contactMethod: ContactMethod.EMAIL,
            subject: '',
            message: 'Help',
        });
    });

    test('persists a phone contact request and rejects invalid phone numbers', async () => {
        const saved: any[] = [];
        const controller = new PublicController(
            { contactSubmission: { create: async (args: any) => { saved.push(args.data); return { id: 'phone-id' }; } } } as any,
            { logAction: async () => undefined } as any,
            { sendContactEmail: async () => undefined } as any,
        );

        await controller.contact(
            { contactMethod: 'phone', phone: '+966 50 123 4567', message: 'Call me' },
            '127.0.0.1',
        );
        assert.equal(saved[0].contactMethod, ContactMethod.PHONE);
        assert.equal(saved[0].phone, '+966 50 123 4567');
        assert.equal(saved[0].email, null);

        await assert.rejects(
            controller.contact({ contactMethod: 'phone', phone: '123', message: 'Call me' }, '127.0.0.1'),
            BadRequestException,
        );
        assert.equal(saved.length, 1);
    });
});
