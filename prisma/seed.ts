import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
    console.log('Seeding database...');

    const adminEmail = 'admin@laxalab.com';
    const adminPassword = 'AdminPassword123!';

    // Hash the password
    const passwordHash = await bcrypt.hash(adminPassword, 10);

    // Upsert ensures we don't duplicate if it already exists
    const adminUser = await prisma.user.upsert({
        where: { email: adminEmail },
        update: {
            passwordHash,
            role: Role.ADMIN,
        },
        create: {
            email: adminEmail,
            passwordHash,
            role: Role.ADMIN,
        },
    });

    console.log(`✅ Admin account ensured!`);
    console.log(`👤 Username (Email): ${adminUser.email}`);
    console.log(`🔑 Password: ${adminPassword}`);


    // Let's create a Finance user too just in case
    const financeEmail = 'finance@laxalab.com';
    const financePassword = 'FinancePassword123!';
    const financeHash = await bcrypt.hash(financePassword, 10);

    const financeUser = await prisma.user.upsert({
        where: { email: financeEmail },
        update: { role: Role.FINANCE, passwordHash: financeHash },
        create: { email: financeEmail, passwordHash: financeHash, role: Role.FINANCE }
    });

    console.log(`\n✅ Finance account ensured!`);
    console.log(`👤 Username (Email): ${financeUser.email}`);
    console.log(`🔑 Password: ${financePassword}`);

    const ensureUser = async (email: string, password: string, role: Role) => {
        const hash = await bcrypt.hash(password, 10);
        const user = await prisma.user.upsert({
            where: { email },
            update: { role, passwordHash: hash },
            create: { email, passwordHash: hash, role }
        });
        console.log(`\n✅ ${role} account ensured!`);
        console.log(`👤 Username (Email): ${user.email}`);
        console.log(`🔑 Password: ${password}`);
    };

    await ensureUser('instructor@laxalab.com', 'InstructorPassword123!', Role.INSTRUCTOR);
    await ensureUser('course.manager@laxalab.com', 'ManagerPassword123!', Role.COURSE_MANAGER);
    await ensureUser('student@laxalab.com', 'StudentPassword123!', Role.STUDENT);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
