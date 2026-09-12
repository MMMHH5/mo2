import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

interface SeedAccount {
    email: string;
    envKey: string;
    role: Role;
    fallbackPassword: string;
}

const accounts: SeedAccount[] = [
    { email: 'admin@laxalab.com', envKey: 'SEED_ADMIN_PASSWORD', role: Role.ADMIN, fallbackPassword: 'AdminPassword123!' },
    { email: 'finance@laxalab.com', envKey: 'SEED_FINANCE_PASSWORD', role: Role.FINANCE, fallbackPassword: 'FinancePassword123!' },
    { email: 'instructor@laxalab.com', envKey: 'SEED_INSTRUCTOR_PASSWORD', role: Role.INSTRUCTOR, fallbackPassword: 'InstructorPassword123!' },
    { email: 'course.manager@laxalab.com', envKey: 'SEED_MANAGER_PASSWORD', role: Role.COURSE_MANAGER, fallbackPassword: 'ManagerPassword123!' },
    { email: 'student@laxalab.com', envKey: 'SEED_STUDENT_PASSWORD', role: Role.STUDENT, fallbackPassword: 'StudentPassword123!' },
];

async function main() {
    console.log('Seeding database...');

    for (const account of accounts) {
        const envPassword = process.env[account.envKey];
        const password = envPassword && envPassword.length > 0 ? envPassword : account.fallbackPassword;

        const existing = await prisma.user.findUnique({ where: { email: account.email } });
        const hash = await bcrypt.hash(password, 10);

        if (existing) {
            // Only rotate the password when an env override is provided, so prod deploys
            // cannot silently reset the account to a known default.
            await prisma.user.upsert({
                where: { email: account.email },
                update: envPassword && envPassword.length > 0 ? { role: account.role, passwordHash: hash } : { role: account.role },
                create: { email: account.email, passwordHash: hash, role: account.role },
            });
            console.log(`✔ ${account.email} ensured (role ${account.role})`);
        } else {
            await prisma.user.upsert({
                where: { email: account.email },
                update: { role: account.role, passwordHash: hash },
                create: { email: account.email, passwordHash: hash, role: account.role },
            });
            console.log(`✔ ${account.email} created (role ${account.role})${envPassword ? '' : ' — set a password via ' + account.envKey}`);
        }
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });