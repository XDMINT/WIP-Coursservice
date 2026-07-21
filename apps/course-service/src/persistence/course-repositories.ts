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
import {
  EntityRepositoryPort,
  QueryOperator,
  TypeOrmEntityRepositoryAdapter,
} from './repository-port';

export type CourseRepositoriesDependencies = {
  courses: Repository<Course>;
  courseRuns: Repository<CourseRun>;
  courseVersions: Repository<CourseVersion>;
  learningMaterials: Repository<LearningMaterial>;
  assignments: Repository<Assignment>;
  grades: Repository<Grade>;
  courseResults: Repository<CourseResult>;
  enrollments: Repository<Enrollment>;
  tasks: Repository<Task>;
  taskDependencies: Repository<TaskDependency>;
  taskAssessments: Repository<TaskAssessment>;
  taskProgress: Repository<TaskProgress>;
  contentReleases: Repository<ContentRelease>;
  contentTemplates: Repository<ContentTemplate>;
  courseGroups: Repository<CourseGroup>;
  groupMemberships: Repository<GroupMembership>;
  calendarEvents: Repository<CalendarEvent>;
  groupTaskProgress?: Repository<GroupTaskProgress>;
};

export class CourseRepositories {
  readonly courses: EntityRepositoryPort<Course>;
  readonly courseRuns: EntityRepositoryPort<CourseRun>;
  readonly courseVersions: EntityRepositoryPort<CourseVersion>;
  readonly learningMaterials: EntityRepositoryPort<LearningMaterial>;
  readonly assignments: EntityRepositoryPort<Assignment>;
  readonly grades: EntityRepositoryPort<Grade>;
  readonly courseResults: EntityRepositoryPort<CourseResult>;
  readonly enrollments: EntityRepositoryPort<Enrollment>;
  readonly tasks: EntityRepositoryPort<Task>;
  readonly taskDependencies: EntityRepositoryPort<TaskDependency>;
  readonly taskAssessments: EntityRepositoryPort<TaskAssessment>;
  readonly taskProgress: EntityRepositoryPort<TaskProgress>;
  readonly contentReleases: EntityRepositoryPort<ContentRelease>;
  readonly contentTemplates: EntityRepositoryPort<ContentTemplate>;
  readonly courseGroups: EntityRepositoryPort<CourseGroup>;
  readonly groupMemberships: EntityRepositoryPort<GroupMembership>;
  readonly calendarEvents: EntityRepositoryPort<CalendarEvent>;
  readonly groupTaskProgress?: EntityRepositoryPort<GroupTaskProgress>;

  constructor(dependencies: CourseRepositoriesDependencies) {
    this.courses = new TypeOrmEntityRepositoryAdapter(dependencies.courses);
    this.courseRuns = new TypeOrmEntityRepositoryAdapter(dependencies.courseRuns);
    this.courseVersions = new TypeOrmEntityRepositoryAdapter(dependencies.courseVersions);
    this.learningMaterials = new TypeOrmEntityRepositoryAdapter(dependencies.learningMaterials);
    this.assignments = new TypeOrmEntityRepositoryAdapter(dependencies.assignments);
    this.grades = new TypeOrmEntityRepositoryAdapter(dependencies.grades);
    this.courseResults = new TypeOrmEntityRepositoryAdapter(dependencies.courseResults);
    this.enrollments = new TypeOrmEntityRepositoryAdapter(dependencies.enrollments);
    this.tasks = new TypeOrmEntityRepositoryAdapter(dependencies.tasks);
    this.taskDependencies = new TypeOrmEntityRepositoryAdapter(dependencies.taskDependencies);
    this.taskAssessments = new TypeOrmEntityRepositoryAdapter(dependencies.taskAssessments);
    this.taskProgress = new TypeOrmEntityRepositoryAdapter(dependencies.taskProgress);
    this.contentReleases = new TypeOrmEntityRepositoryAdapter(dependencies.contentReleases);
    this.contentTemplates = new TypeOrmEntityRepositoryAdapter(dependencies.contentTemplates);
    this.courseGroups = new TypeOrmEntityRepositoryAdapter(dependencies.courseGroups);
    this.groupMemberships = new TypeOrmEntityRepositoryAdapter(dependencies.groupMemberships);
    this.calendarEvents = new TypeOrmEntityRepositoryAdapter(dependencies.calendarEvents);
    this.groupTaskProgress = dependencies.groupTaskProgress
      ? new TypeOrmEntityRepositoryAdapter(dependencies.groupTaskProgress)
      : undefined;
  }

  in<T>(values: T[]): QueryOperator {
    return { kind: 'in', value: values };
  }

  not(value: unknown): QueryOperator {
    return { kind: 'not', value };
  }

  isNull(): QueryOperator {
    return { kind: 'isNull' };
  }

  lessThanOrEqual(value: unknown): QueryOperator {
    return { kind: 'lessThanOrEqual', value };
  }

  moreThanOrEqual(value: unknown): QueryOperator {
    return { kind: 'moreThanOrEqual', value };
  }

  ilike(pattern: string): QueryOperator {
    return { kind: 'ilike', value: pattern };
  }
}
