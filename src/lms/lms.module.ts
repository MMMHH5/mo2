import { Module } from '@nestjs/common';
import { LessonsService } from './lessons.service';
import { LessonsController } from './lessons.controller';
import { QuizzesService } from './quizzes.service';
import { QuizzesController } from './quizzes.controller';
import { ReviewsService } from './reviews.service';
import { ReviewsController } from './reviews.controller';
import { GamificationModule } from '../gamification/gamification.module';
import { CourseEvaluationsController } from './course-evaluations.controller';
import { CourseEvaluationsService } from './course-evaluations.service';

@Module({
    imports: [GamificationModule],
    controllers: [LessonsController, QuizzesController, ReviewsController, CourseEvaluationsController],
    providers: [LessonsService, QuizzesService, ReviewsService, CourseEvaluationsService],
    exports: [LessonsService, QuizzesService, ReviewsService],
})
export class LmsModule { }