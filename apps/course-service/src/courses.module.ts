import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuditLogService } from './audit-log.service';
import { CoursesController } from './courses.controller';
import { CoursesService } from './courses.service';
import { CourseDemoSeedService } from './course-demo-seed.service';

import { AuditEvent } from './entities/audit-event.entity';
import { Course } from './entities/course.entity';
import { CourseRun } from './entities/course-run.entity';
import { CourseVersion } from './entities/course-version.entity';
import { CourseGroup } from './entities/course-group.entity';
import { GroupMembership } from './entities/group-membership.entity';
import { GroupTaskProgress } from './entities/group-task-progress.entity';
import { Enrollment } from './entities/enrollment.entity';
import { LearningMaterial } from './entities/learning-material.entity';
import { Assignment } from './entities/assignment.entity';
import { Grade } from './entities/grade.entity';
import { Task } from './entities/task.entity';
import { TaskAssessment } from './entities/task-assessment.entity';
import { TaskProgress } from './entities/task-progress.entity';
import { CourseResult } from './entities/course-result.entity';
import { ContentRelease } from './entities/content-release.entity';
import { ContentTemplate } from './entities/content-template.entity';
import { CalendarEvent } from './entities/calendar-event.entity';
import { LocalMaterialStorage } from './storage/material-storage';
import { TaskServiceClient } from './task-service.client';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AuditEvent,
      Course,
      CourseRun,
      CourseVersion,
      Enrollment,
      CourseGroup,
      GroupMembership,
      GroupTaskProgress,
      LearningMaterial,
      Assignment,
      Grade,
      CourseResult,
      Task,
      TaskAssessment,
      TaskProgress,
      ContentRelease,
      ContentTemplate,
      CalendarEvent,
    ]),
  ],

  controllers: [CoursesController],
  providers: [
    CoursesService,
    CourseDemoSeedService,
    LocalMaterialStorage,
    AuditLogService,
    TaskServiceClient,
  ],

  exports: [CoursesService, AuditLogService],
})
export class CoursesModule {}
