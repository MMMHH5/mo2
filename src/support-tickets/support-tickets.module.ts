import { Module } from '@nestjs/common';
import { SupportTicketsService } from './support-tickets.service';
import { SupportTicketsController } from './support-tickets.controller';

@Module({
    controllers: [SupportTicketsController],
    providers: [SupportTicketsService],
})
export class SupportTicketsModule { }