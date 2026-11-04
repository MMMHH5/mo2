import { Module } from '@nestjs/common';
import { HomepageService } from './homepage.service';
import { AdminHomepageController, PublicHomepageController } from './homepage.controller';

@Module({
    controllers: [PublicHomepageController, AdminHomepageController],
    providers: [HomepageService],
})
export class HomepageModule {}
