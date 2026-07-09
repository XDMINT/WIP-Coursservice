import { Module, OnApplicationBootstrap } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CoursesController } from './courses.controller';
import { CoursesService } from './courses.service';

import { Course } from './entities/course.entity';
import { CourseVersion } from './entities/course-version.entity';
import { CourseGroup } from './entities/course-group.entity';
import { GroupMembership } from './entities/group-membership.entity';
import { Enrollment } from './entities/enrollment.entity';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'mysql',
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT) || 3306,
      username: process.env.DB_USERNAME || 'courses_user',
      password: process.env.DB_PASSWORD || 'courses_password',
      database: process.env.DB_DATABASE || 'courses',
      autoLoadEntities: true,
      synchronize: true,
    }),

    TypeOrmModule.forFeature([
      Course,
      CourseVersion,
      Enrollment,
      CourseGroup,
      GroupMembership,
    ]),
  ],
  controllers: [CoursesController],
  providers: [CoursesService],
})
export class CoursesModule {}