import { Module } from '@nestjs/common';
import { AnnouncementBoardService } from './announcement-board.service';
import { AnnouncementBoardController } from './announcement-board.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
    imports: [PrismaModule],
    controllers: [AnnouncementBoardController],
    providers: [AnnouncementBoardService],
    exports: [AnnouncementBoardService],
})
export class AnnouncementBoardModule {}
