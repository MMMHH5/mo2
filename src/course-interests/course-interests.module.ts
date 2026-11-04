import { Module } from '@nestjs/common';
import { AdminCourseInterestsController, PublicCourseInterestsController } from './course-interests.controller';
import { CourseInterestsService } from './course-interests.service';

@Module({
    controllers: [PublicCourseInterestsController, AdminCourseInterestsController],
    providers: [CourseInterestsService],
})
export class CourseInterestsModule {}
