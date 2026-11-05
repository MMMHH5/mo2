import { Module } from '@nestjs/common';
import { CoursesService } from './courses.service';
import { CoursesController } from './courses.controller';
import { AdminCoursesController } from './admin-courses.controller';
import { CourseOpeningsController } from './course-openings.controller';
import { CertificatesModule } from '../certificates/certificates.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { OpeningActivityService } from './opening-activity.service';
import { CourseImportService } from './course-import.service';

@Module({
    imports: [CertificatesModule, NotificationsModule],
    controllers: [CoursesController, AdminCoursesController, CourseOpeningsController],
    providers: [CoursesService, CourseImportService, OpeningActivityService],
    exports: [CoursesService],
})
export class CoursesModule { }