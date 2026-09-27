import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { ChatService } from '../src/chat/chat.service';
import { Role } from '@prisma/client';

/**
 * Authorization tests for the batch (group) chat.
 *
 * A `ChatRoom` is one per course opening, and the caller has no `courseId` in
 * scope when they ask for a room: they name the room, or they get the list.
 * Both paths went wrong in ways that only showed up as "the chat did not open
 * for a student who was accepted":
 *
 *  - `getRooms` scoped by `openingId` only when the caller had at least one
 *    opening. With none it left `where` empty, which matched every room on the
 *    platform and returned each one's name, member count and last message.
 *  - `userHasRoomAccess` matched the student's enrollment on `courseId` instead
 *    of `openingId`, so being approved in one batch unlocked every other batch
 *    of the same course.
 *  - `getOrCreateDirectChat` required `enrollment.opening` to resolve the
 *    instructor. `Enrollment.openingId` is nullable and was added without a
 *    backfill, so an approved student with a legacy row was hard-403'd forever.
 *
 * These drive the real service against a recording double for Prisma, so they
 * assert the query the service builds — the part that decides who gets in.
 */

type Rec = { model: string; op: string; args: any };

function makeHarness(handlers: {
    enrollments?: any[];
    openings?: any[];
    rooms?: any[];
    roomMembers?: any[];
    course?: any;
    users?: any[];
}) {
    const calls: Rec[] = [];
    const rooms = handlers.rooms ?? [];
    const members = handlers.roomMembers ?? [];

    const prisma: any = {
        enrollment: {
            findMany: async (args: any) => {
                calls.push({ model: 'enrollment', op: 'findMany', args });
                // `syncRoomMembers` includes the student to read their role, so
                // every row the double returns has to carry one.
                return (handlers.enrollments ?? []).map((e) => ({
                    student: { id: e.studentId ?? e.student?.id ?? 'student-1', role: Role.STUDENT },
                    ...e,
                }));
            },
            findFirst: async (args: any) => {
                calls.push({ model: 'enrollment', op: 'findFirst', args });
                return (handlers.enrollments ?? [])[0] ?? null;
            },
        },
        courseOpening: {
            findMany: async (args: any) => {
                calls.push({ model: 'courseOpening', op: 'findMany', args });
                return handlers.openings ?? [];
            },
            findFirst: async (args: any) => {
                calls.push({ model: 'courseOpening', op: 'findFirst', args });
                return (handlers.openings ?? [])[0] ?? null;
            },
            findUnique: async (args: any) => {
                calls.push({ model: 'courseOpening', op: 'findUnique', args });
                return (handlers.openings ?? [])[0] ?? null;
            },
        },
        chatRoom: {
            findMany: async (args: any) => {
                calls.push({ model: 'chatRoom', op: 'findMany', args });
                // Honour the where clause the way Prisma would, so the test
                // fails if an empty allow-list ever matches everything again.
                const allowed = args?.where?.openingId?.in;
                if (!allowed) return rooms;
                return rooms.filter((r) => allowed.includes(r.openingId));
            },
            findUnique: async (args: any) => {
                calls.push({ model: 'chatRoom', op: 'findUnique', args });
                if (args?.where?.id) return rooms.find((r) => r.id === args.where.id) ?? null;
                // The lazy `openingId` lookup used by getOrCreateRoomForOpening.
                return rooms.find((r) => r.openingId === args?.where?.openingId) ?? null;
            },
            create: async (args: any) => {
                calls.push({ model: 'chatRoom', op: 'create', args });
                const created = { id: `new-${args.data.openingId}`, ...args.data, members: [], messages: [] };
                rooms.push(created as any);
                return created;
            },
        },
        chatRoomMember: {
            findUnique: async (args: any) => {
                calls.push({ model: 'chatRoomMember', op: 'findUnique', args });
                return members.find((m) => m.roomId === args?.where?.roomId_userId?.roomId
                    && m.userId === args?.where?.roomId_userId?.userId) ?? null;
            },
            deleteMany: async () => ({ count: 0 }),
            createMany: async () => ({ count: 0 }),
        },
        chatMessage: { count: async () => 0 },
        user: {
            findUnique: async (args: any) => {
                calls.push({ model: 'user', op: 'findUnique', args });
                return (handlers.users ?? []).find((u) => u.id === args?.where?.id) ?? null;
            },
            findMany: async () => handlers.users ?? [],
        },
        course: {
            findUnique: async (args: any) => {
                calls.push({ model: 'course', op: 'findUnique', args });
                return handlers.course ?? null;
            },
        },
        directChat: {
            upsert: async (args: any) => {
                calls.push({ model: 'directChat', op: 'upsert', args });
                return { id: 'dc1', ...(args?.create ?? {}) };
            },
        },
    };

    const service = new ChatService(prisma as any, { notify: async () => undefined } as any);
    return { service, calls, prisma };
}

describe('batch chat: the room list is an allow-list, even when empty', () => {
    test('a student with no approved enrollment gets no rooms, not every room', async () => {
        const { service, calls } = makeHarness({
            enrollments: [],
            rooms: [
                { id: 'r1', openingId: 'o1', nameEn: 'Batch A', members: [], messages: [] },
                { id: 'r2', openingId: 'o2', nameEn: 'Batch B', members: [], messages: [] },
            ],
        });

        const rooms = await service.getRooms('student-1', Role.STUDENT);

        assert.equal(rooms.length, 0, 'an empty allow-list must not fall open');
        const listed = calls.find((c) => c.model === 'chatRoom' && c.op === 'findMany');
        assert.ok(listed, 'the room query should still have run');
        assert.deepEqual(
            listed.args.where.openingId.in,
            [],
            'the query must carry an explicit empty opening allow-list',
        );
    });

    test('a student only receives rooms for the batches they are in', async () => {
        const { service } = makeHarness({
            enrollments: [{ openingId: 'o1', courseId: 'c1' }],
            openings: [{ id: 'o1', instructorId: 'teach-1', courseId: 'c1' }],
            rooms: [
                { id: 'r1', openingId: 'o1', nameEn: 'Mine', members: [], messages: [], opening: { id: 'o1', course: { id: 'c1', titleEn: 'C' } } },
                { id: 'r2', openingId: 'o2', nameEn: 'Theirs', members: [], messages: [], opening: { id: 'o2', course: { id: 'c1', titleEn: 'C' } } },
            ],
        });

        const rooms = await service.getRooms('student-1', Role.STUDENT);

        assert.deepEqual(rooms.map((r: any) => r.name), ['Mine']);
    });

    test('oversight roles still see every room', async () => {
        const { service } = makeHarness({
            rooms: [
                { id: 'r1', openingId: 'o1', nameEn: 'A', members: [], messages: [] },
                { id: 'r2', openingId: 'o2', nameEn: 'B', members: [], messages: [] },
            ],
        });

        for (const role of [Role.ADMIN, Role.COURSE_MANAGER]) {
            const rooms = await service.getRooms('staff-1', role);
            assert.equal(rooms.length, 2, `${role} should see all rooms`);
        }
    });

    test('an instructor is not an instructor of every course', async () => {
        // The trap: reading "is this user an instructor" instead of "is this
        // user assigned to this course". Instructors do teach other people's
        // courses on the platform, so the role check cannot stand in.
        const { service } = makeHarness({
            enrollments: [],
            openings: [],
            rooms: [
                { id: 'r1', openingId: 'o1', nameEn: 'Someone else\'s batch', members: [], messages: [] },
            ],
        });

        const rooms = await service.getRooms('other-teacher', Role.INSTRUCTOR);

        assert.equal(rooms.length, 0, 'teaching elsewhere must not grant another course\'s rooms');
    });

    test('an instructor assigned to a batch does get its room', async () => {
        const { service } = makeHarness({
            openings: [{ id: 'o1', instructorId: 'me', courseId: 'c1' }],
            rooms: [{ id: 'r1', openingId: 'o1', nameEn: 'My batch', members: [], messages: [] }],
        });

        const rooms = await service.getRooms('me', Role.INSTRUCTOR);

        assert.deepEqual(rooms.map((r: any) => r.name), ['My batch']);
    });
});

describe('batch chat: access is per batch, not per course', () => {
    test('approval in one batch does not unlock another batch of the same course', async () => {
        const { service, calls } = makeHarness({
            // The student is approved in batch A. The room they are probing is
            // batch B's, and they hold no row for it.
            enrollments: [],
            rooms: [{ id: 'rB', openingId: 'oB' }],
            openings: [{ id: 'oB', instructorId: 'teach-1', courseId: 'c1' }],
            users: [{ id: 'student-1', role: Role.STUDENT }],
        });

        const allowed = await service.userHasRoomAccess('rB', 'student-1');

        assert.equal(allowed, false, 'a same-course enrollment must not grant another batch');
        const probe = calls.find((c) => c.model === 'enrollment' && c.op === 'findFirst');
        assert.ok(probe, 'the enrollment should have been checked');
        assert.equal(
            probe.args.where.openingId,
            'oB',
            'the enrollment must be matched on the room\'s opening, not the course',
        );
        assert.equal(
            probe.args.where.courseId,
            undefined,
            'matching on courseId is what leaked the sibling batch',
        );
    });

    test('a student approved in the room\'s own batch is let in', async () => {
        const { service } = makeHarness({
            enrollments: [{ openingId: 'oA', courseId: 'c1' }],
            rooms: [{ id: 'rA', openingId: 'oA' }],
            openings: [{ id: 'oA', instructorId: 'teach-1', courseId: 'c1' }],
            users: [{ id: 'student-1', role: Role.STUDENT }],
        });

        assert.equal(await service.userHasRoomAccess('rA', 'student-1'), true);
    });

    test('the opening\'s own instructor is always allowed', async () => {
        const { service } = makeHarness({
            enrollments: [],
            rooms: [{ id: 'rA', openingId: 'oA' }],
            openings: [{ id: 'oA', instructorId: 'teach-1', courseId: 'c1' }],
            users: [{ id: 'teach-1', role: Role.INSTRUCTOR }],
        });

        assert.equal(await service.userHasRoomAccess('rA', 'teach-1'), true);
    });
});

describe('direct chat: a legacy enrollment with no batch is not locked out', () => {
    test('resolves the instructor from the course when the enrollment has no opening', async () => {
        const { service } = makeHarness({
            course: { id: 'c1', instructorId: 'teach-1' },
            // Approved, but `openingId` is NULL: the column was added by a
            // migration with no backfill, so legacy rows still look like this.
            enrollments: [{ courseId: 'c1', openingId: null, status: 'APPROVED', opening: null }],
        });

        const chat = await service.getOrCreateDirectChat('c1', 'student-1', Role.STUDENT);

        assert.equal(chat.instructorId, 'teach-1');
    });

    test('prefers the instructor of the batch the student is actually in', async () => {
        const { service } = makeHarness({
            course: { id: 'c1', instructorId: 'owner-1' },
            enrollments: [{
                courseId: 'c1',
                openingId: 'o9',
                status: 'APPROVED',
                opening: { id: 'o9', instructorId: 'batch-teacher' },
            }],
        });

        const chat = await service.getOrCreateDirectChat('c1', 'student-1', Role.STUDENT);

        assert.equal(chat.instructorId, 'batch-teacher', 'the batch teacher wins over the course owner');
    });

    test('a student with no enrollment at all is still refused', async () => {
        const { service } = makeHarness({
            course: { id: 'c1', instructorId: 'teach-1' },
            enrollments: [],
        });

        await assert.rejects(
            () => service.getOrCreateDirectChat('c1', 'student-1', Role.STUDENT),
            /not enrolled/i,
        );
    });
});
