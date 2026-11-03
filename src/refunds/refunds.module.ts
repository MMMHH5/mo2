import { Module } from '@nestjs/common';
import { RefundsService } from './refunds.service';
import { RefundsController } from './refunds.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { ChatModule } from '../chat/chat.module';

@Module({
    imports: [NotificationsModule, ChatModule],
    controllers: [RefundsController],
    providers: [RefundsService],
})
export class RefundsModule {}
