import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class InstructorApplicationsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly auditService: AuditService
    ) { }

    async getApplications() {
        return this.prisma.instructorApplication.findMany({
            include: { user: { select: { email: true, id: true } } },
            orderBy: { createdAt: 'desc' }
        });
    }

    async getMyApplication(userId: string) {
        return this.prisma.instructorApplication.findFirst({
            where: { userId },
            orderBy: { createdAt: 'desc' }
        });
    }

    async createApplication(userId: string, data: any, cvFileUrl: string) {
        const app = await this.prisma.instructorApplication.create({
            data: {
                userId,
                name: data.name,
                bio: data.bio,
                specialty: data.specialty,
                videoIntroUrl: data.videoIntroUrl,
                cvFileUrl,
            }
        });

        await this.auditService.logAction('CREATE_INSTRUCTOR_APP', undefined, userId);
        return app;
    }

    async updateApplicationStatus(id: string, status: 'APPROVED' | 'REJECTED', adminId: string) {
        const app = await this.prisma.instructorApplication.update({
            where: { id },
            data: { status }
        });

        await this.auditService.logAction(`UPDATE_INSTRUCTOR_APP_${status}`, undefined, adminId);

        if (status === 'APPROVED') {
            await this.prisma.user.update({
                where: { id: app.userId },
                data: { role: 'INSTRUCTOR' }
            });
            await this.auditService.logAction(`UPDATE_ROLE_INSTRUCTOR`, undefined, adminId);
        }

        return app;
    }
}
