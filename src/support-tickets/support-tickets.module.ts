import { Module } from '@nestjs/common';
import { SupportTicketsService } from './support-tickets.service';
import { SupportTicketsController } from './support-tickets.controller';
import { AdminContactSubmissionsController, AdminSupportTicketsController } from './admin-support-tickets.controller';

@Module({
    controllers: [SupportTicketsController, AdminSupportTicketsController, AdminContactSubmissionsController],
    providers: [SupportTicketsService],
})
export class SupportTicketsModule { }