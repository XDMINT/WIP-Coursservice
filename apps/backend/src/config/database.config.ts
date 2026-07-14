import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';

import { Assignment } from '../entities/assignment.entity';
import { CalendarEvent } from '../entities/calendar-event.entity';
import { ContentRelease } from '../entities/content-release.entity';
import { ContentTemplate } from '../entities/content-template.entity';
import { CourseGroup } from '../entities/course-group.entity';
import { CourseResult } from '../entities/course-result.entity';
import { CourseRun } from '../entities/course-run.entity';
import { CourseVersion } from '../entities/course-version.entity';
import { Course } from '../entities/course.entity';
import { Enrollment } from '../entities/enrollment.entity';
import { Grade } from '../entities/grade.entity';
import { GroupMembership } from '../entities/group-membership.entity';
import { LearningMaterial } from '../entities/learning-material.entity';
import { TaskProgress } from '../entities/task-progress.entity';
import { Task } from '../entities/task.entity';
import { CreateCourseSchema1720000000000 } from '../migrations/1720000000000-CreateCourseSchema';
import { AddCourseAuditFields1720000001000 } from '../migrations/1720000001000-AddCourseAuditFields';
import { ExpandLearningMaterials1720000002000 } from '../migrations/1720000002000-ExpandLearningMaterials';
import { ExpandLearningProcess1720000003000 } from '../migrations/1720000003000-ExpandLearningProcess';
import { HardenTaskProgressPersistence1720000004000 } from '../migrations/1720000004000-HardenTaskProgressPersistence';
import { AddCourseResults1720000005000 } from '../migrations/1720000005000-AddCourseResults';
import { HardenCourseVersions1720000006000 } from '../migrations/1720000006000-HardenCourseVersions';
import { AddCourseRuns1720000007000 } from '../migrations/1720000007000-AddCourseRuns';
import { ScopeTaskDemoKeyToCourseRun1720000008000 } from '../migrations/1720000008000-ScopeTaskDemoKeyToCourseRun';
import { AddLearningMaterialReleaseRules1720000009000 } from '../migrations/1720000009000-AddLearningMaterialReleaseRules';
import { AddCourseVersionTemplateMetadata1720000010000 } from '../migrations/1720000010000-AddCourseVersionTemplateMetadata';
import { LinkContentToCourseVersions1720000011000 } from '../migrations/1720000011000-LinkContentToCourseVersions';
import { AddCourseRunPlanTemplateSettings1720000012000 } from '../migrations/1720000012000-AddCourseRunPlanTemplateSettings';

const entities = [
  Course,
  CourseRun,
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
];

const parseBoolean = (value: string | undefined, defaultValue: boolean) => {
  if (value === undefined || value === '') {
    return defaultValue;
  }

  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
};

export const createDatabaseOptions = (
  configService: ConfigService,
): TypeOrmModuleOptions => ({
  type: 'postgres',
  host: configService.get<string>('DATABASE_HOST', 'localhost'),
  port: Number(configService.get<string>('DATABASE_PORT', '5432')),
  username: configService.get<string>('DATABASE_USER', 'ewill'),
  password: configService.get<string>('DATABASE_PASSWORD', 'change-me'),
  database: configService.get<string>('DATABASE_NAME', 'ewill'),
  ssl: parseBoolean(configService.get<string>('DATABASE_SSL'), false)
    ? { rejectUnauthorized: false }
    : false,
  entities,
  migrations: [
    CreateCourseSchema1720000000000,
    AddCourseAuditFields1720000001000,
    ExpandLearningMaterials1720000002000,
    ExpandLearningProcess1720000003000,
    HardenTaskProgressPersistence1720000004000,
    AddCourseResults1720000005000,
    HardenCourseVersions1720000006000,
    AddCourseRuns1720000007000,
    ScopeTaskDemoKeyToCourseRun1720000008000,
    AddLearningMaterialReleaseRules1720000009000,
    AddCourseVersionTemplateMetadata1720000010000,
    LinkContentToCourseVersions1720000011000,
    AddCourseRunPlanTemplateSettings1720000012000,
  ],
  migrationsRun: parseBoolean(
    configService.get<string>('DATABASE_MIGRATIONS_RUN'),
    true,
  ),
  synchronize: false,
});
