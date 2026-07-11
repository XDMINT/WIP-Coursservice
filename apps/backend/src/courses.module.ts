import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CoursesController } from './courses.controller';
import { CoursesService } from './courses.service';
import { CourseDemoSeedService } from './course-demo-seed.service';

import { Course } from './entities/course.entity';
import { CourseVersion } from './entities/course-version.entity';
import { CourseGroup } from './entities/course-group.entity';
import { GroupMembership } from './entities/group-membership.entity';
import { Enrollment } from './entities/enrollment.entity';
import { LearningMaterial } from './entities/learning-material.entity';
import { Assignment } from './entities/assignment.entity';
import { Grade } from './entities/grade.entity';
import { Task } from './entities/task.entity';
import { TaskProgress } from './entities/task-progress.entity';
import { CourseResult } from './entities/course-result.entity';
import { ContentRelease } from './entities/content-release.entity';
import { ContentTemplate } from './entities/content-template.entity';
import { CalendarEvent } from './entities/calendar-event.entity';
import { LocalMaterialStorage } from './storage/material-storage';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Course,
      CourseVersion,
      Enrollment,
      CourseGroup,
      GroupMembership,
      LearningMaterial,
      Assignment,
      Grade,
      CourseResult,
      Task,
      TaskProgress,
      ContentRelease,
      ContentTemplate,
      CalendarEvent,
    ]),
  ],

  controllers: [CoursesController],
  providers: [CoursesService, CourseDemoSeedService, LocalMaterialStorage],

  exports: [CoursesService],
})
export class CoursesModule {}
