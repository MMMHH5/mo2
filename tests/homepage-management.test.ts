import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { BadRequestException } from '@nestjs/common';
import { HomepageService } from '../src/homepage/homepage.service';
import { DEFAULT_HOMEPAGE_CONFIG, mergeHomepageConfig } from '../frontend/src/lib/homepage-config';

const config = {
    sections: ['hero', 'features', 'stats', 'courses', 'about', 'contact', 'cta']
        .map((id) => ({ id, visible: true })),
    content: {},
    stats: [
        { id: 'courses', mode: 'AUTO', value: 0 },
        { id: 'instructors', mode: 'AUTO', value: 0 },
        { id: 'enrollments', mode: 'AUTO', value: 0 },
        { id: 'certificates', mode: 'AUTO', value: 0 },
    ],
    socials: [
        { id: 'youtube', label: 'YouTube', handle: '@laxalabacademy', url: 'https://youtube.com/@laxalabacademy' },
        { id: 'instagram', label: 'Instagram', handle: '@laxalabacademy', url: 'https://instagram.com/laxalabacademy' },
        { id: 'telegram', label: 'Telegram', handle: '@laxalabacademy', url: 'https://t.me/laxalabacademy' },
        { id: 'x', label: 'X', handle: '@laxalabacademy', url: 'https://x.com/laxalabacademy' },
        { id: 'facebook', label: 'Facebook', handle: 'laxalabacademy', url: 'https://facebook.com/laxalabacademy' },
    ],
};

function makeService(overrides: Record<string, unknown> = {}) {
    const calls: Record<string, unknown> = {};
    const prisma = {
        homepageSettings: {
            findUnique: async (args: unknown) => {
                calls.findUnique = args;
                return overrides.row ?? null;
            },
            upsert: async (args: unknown) => {
                calls.upsert = args;
                return { updatedAt: new Date('2026-11-04T10:00:00.000Z') };
            },
            update: async (args: unknown) => {
                calls.update = args;
                return {};
            },
        },
    };
    const audit = { logAction: async (...args: unknown[]) => { calls.audit = args; } };
    return { service: new HomepageService(prisma as never, audit as never), calls };
}

describe('homepage management', () => {
    test('public configuration returns only the published version', async () => {
        const published = { ...config, marker: 'published' };
        const { service, calls } = makeService({ row: { published } });

        assert.deepEqual(await service.publicConfig(), published);
        assert.deepEqual(calls.findUnique, {
            where: { id: 'singleton' },
            select: { published: true },
        });
    });

    test('saving a draft validates and records the editor without publishing', async () => {
        const { service, calls } = makeService();

        await service.saveDraft(config, 'admin-1');

        assert.equal((calls.upsert as { create: { draft: unknown; updatedById: string } }).create.updatedById, 'admin-1');
        assert.deepEqual((calls.upsert as { create: { draft: unknown } }).create.draft, config);
        assert.equal(calls.update, undefined);
        assert.deepEqual(calls.audit, ['Updated homepage draft', undefined, 'admin-1']);
    });

    test('publishing copies the saved draft to the public field', async () => {
        const { service, calls } = makeService({ row: { draft: config } });

        await service.publish('admin-1');

        const update = calls.update as { data: { published: unknown; publishedById: string } };
        assert.deepEqual(update.data.published, config);
        assert.equal(update.data.publishedById, 'admin-1');
    });

    test('rejects unsafe social links', async () => {
        const invalid = structuredClone(config);
        invalid.socials[0].url = 'javascript:alert(1)';
        const { service } = makeService();

        await assert.rejects(
            () => service.saveDraft(invalid, 'admin-1'),
            (error: unknown) => error instanceof BadRequestException,
        );
    });

    test('merging preserves the configured section order and visibility', () => {
        const reordered = mergeHomepageConfig({
            ...DEFAULT_HOMEPAGE_CONFIG,
            sections: [...DEFAULT_HOMEPAGE_CONFIG.sections].reverse().map((section) => ({
                ...section,
                visible: section.id !== 'stats',
            })),
        });

        assert.deepEqual(reordered.sections.map((section) => section.id), ['cta', 'contact', 'about', 'courses', 'stats', 'features', 'hero']);
        assert.equal(reordered.sections.find((section) => section.id === 'stats')?.visible, false);
    });
});
