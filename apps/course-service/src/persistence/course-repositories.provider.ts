import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
import { GroupTaskProgress } from '../entities/group-task-progress.entity';
import { LearningMaterial } from '../entities/learning-material.entity';
import { TaskAssessment } from '../entities/task-assessment.entity';
import { TaskDependency } from '../entities/task-dependency.entity';
import { TaskProgress } from '../entities/task-progress.entity';
import { Task } from '../entities/task.entity';
import { CourseRepositories } from './course-repositories';

@Injectable()
export class CourseRepositoriesProvider extends CourseRepositories {
  constructor(
    @InjectRepository(Course)
    courses: Repository<Course>,
    @InjectRepository(CourseRun)
    courseRuns: Repository<CourseRun>,
    @InjectRepository(CourseVersion)
    courseVersions: Repository<CourseVersion>,
    @InjectRepository(LearningMaterial)
    learningMaterials: Repository<LearningMaterial>,
    @InjectRepository(Assignment)
    assignments: Repository<Assignment>,
    @InjectRepository(Grade)
    grades: Repository<Grade>,
    @InjectRepository(CourseResult)
    courseResults: Repository<CourseResult>,
    @InjectRepository(Enrollment)
    enrollments: Repository<Enrollment>,
    @InjectRepository(Task)
    tasks: Repository<Task>,
    @InjectRepository(TaskDependency)
    taskDependencies: Repository<TaskDependency>,
    @InjectRepository(TaskAssessment)
    taskAssessments: Repository<TaskAssessment>,
    @InjectRepository(TaskProgress)
    taskProgress: Repository<TaskProgress>,
    @InjectRepository(ContentRelease)
    contentReleases: Repository<ContentRelease>,
    @InjectRepository(ContentTemplate)
    contentTemplates: Repository<ContentTemplate>,
    @InjectRepository(CourseGroup)
    courseGroups: Repository<CourseGroup>,
    @InjectRepository(GroupMembership)
    groupMemberships: Repository<GroupMembership>,
    @InjectRepository(CalendarEvent)
    calendarEvents: Repository<CalendarEvent>,
    @InjectRepository(GroupTaskProgress)
    groupTaskProgress: Repository<GroupTaskProgress>,
  ) {
    super({
      assignments,
      calendarEvents,
      contentReleases,
      contentTemplates,
      courseGroups,
      courseResults,
      courseRuns,
      courses,
      courseVersions,
      enrollments,
      grades,
      groupMemberships,
      groupTaskProgress,
      learningMaterials,
      taskDependencies,
      taskAssessments,
      taskProgress,
      tasks,
    });
  }
}
