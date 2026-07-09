import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { CoursesController } from './courses.controller';
import { CoursesService } from './courses.service';

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
import { ContentRelease } from './entities/content-release.entity';
import { ContentTemplate } from './entities/content-template.entity';
import { CalendarEvent } from './entities/calendar-event.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    TypeOrmModule.forRoot({
      type: 'mysql',
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT) || 3306,
      username: process.env.DB_USER || 'root',
      password: process.env.DB_PASS || 'root',
      database: process.env.DB_NAME || 'courses',
      autoLoadEntities: true,
      synchronize: true,
    }),

    TypeOrmModule.forFeature([
      Course,
      CourseVersion,
      Enrollment,
      CourseGroup,
      GroupMembership,
      LearningMaterial,
      Assignment,
      Grade,
      Task,
      TaskProgress,
      ContentRelease,
      ContentTemplate,
      CalendarEvent,
    ]),
  ],

  controllers: [CoursesController],

  providers: [
    CoursesService,

    {
      provide: 'DATA_SOURCE',
      useFactory: async () => {
        const dataSource = new DataSource({
          type: 'mysql',
          host: process.env.DB_HOST || 'localhost',
          port: Number(process.env.DB_PORT) || 3306,
          username: process.env.DB_USER || 'root',
          password: process.env.DB_PASS || 'root',
          database: process.env.DB_NAME || 'courses',
          entities: [
            Course,
            CourseVersion,
            Enrollment,
            CourseGroup,
            GroupMembership,
            LearningMaterial,
            Assignment,
            Grade,
            Task,
            TaskProgress,
            ContentRelease,
            ContentTemplate,
            CalendarEvent,
          ],
          synchronize: true,
        });

        return dataSource.initialize();
      },
    },

    {
      provide: 'COURSE_REPOSITORY',
      useFactory: (dataSource: DataSource) =>
          dataSource.getRepository(Course),
      inject: ['DATA_SOURCE'],
    },

    {
      provide: 'COURSE_GROUP_REPOSITORY',
      useFactory: (dataSource: DataSource) =>
          dataSource.getRepository(CourseGroup),
      inject: ['DATA_SOURCE'],
    },

    {
      provide: 'GROUP_MEMBERSHIP_REPOSITORY',
      useFactory: (dataSource: DataSource) =>
          dataSource.getRepository(GroupMembership),
      inject: ['DATA_SOURCE'],
    },

    {
      provide: 'LEARNING_MATERIAL_REPOSITORY',
      useFactory: (dataSource: DataSource) =>
          dataSource.getRepository(LearningMaterial),
      inject: ['DATA_SOURCE'],
    },

    {
      provide: 'ASSIGNMENT_REPOSITORY',
      useFactory: (dataSource: DataSource) =>
          dataSource.getRepository(Assignment),
      inject: ['DATA_SOURCE'],
    },

    {
      provide: 'GRADE_REPOSITORY',
      useFactory: (dataSource: DataSource) =>
          dataSource.getRepository(Grade),
      inject: ['DATA_SOURCE'],
    },

    {
      provide: 'ENROLLMENT_REPOSITORY',
      useFactory: (dataSource: DataSource) =>
          dataSource.getRepository(Enrollment),
      inject: ['DATA_SOURCE'],
    },

    {
      provide: 'TASK_REPOSITORY',
      useFactory: (dataSource: DataSource) =>
          dataSource.getRepository(Task),
      inject: ['DATA_SOURCE'],
    },

    {
      provide: 'TASK_PROGRESS_REPOSITORY',
      useFactory: (dataSource: DataSource) =>
          dataSource.getRepository(TaskProgress),
      inject: ['DATA_SOURCE'],
    },

    {
      provide: 'CONTENT_RELEASE_REPOSITORY',
      useFactory: (dataSource: DataSource) =>
          dataSource.getRepository(ContentRelease),
      inject: ['DATA_SOURCE'],
    },

    {
      provide: 'CONTENT_TEMPLATE_REPOSITORY',
      useFactory: (dataSource: DataSource) =>
          dataSource.getRepository(ContentTemplate),
      inject: ['DATA_SOURCE'],
    },

    {
      provide: 'CALENDAR_EVENT_REPOSITORY',
      useFactory: (dataSource: DataSource) =>
          dataSource.getRepository(CalendarEvent),
      inject: ['DATA_SOURCE'],
    },
  ],

  exports: [CoursesService],
})
export class CoursesModule {}