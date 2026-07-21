import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Course } from './course.entity';
import { CourseRun } from './course-run.entity';
import { CourseVersion } from './course-version.entity';
import { GroupTaskProgress } from './group-task-progress.entity';
import { TaskProgress } from './task-progress.entity';
import { TaskAssessment } from './task-assessment.entity';
import { TaskDependency } from './task-dependency.entity';

export enum TaskUnlockMode {
  IMMEDIATE = 'IMMEDIATE',
  AUTOMATIC = 'AUTOMATIC',
  MANUAL = 'MANUAL',
}

export enum TaskGradingMode {
  NOT_GRADED = 'NOT_GRADED',
  SELF_CONFIRMATION = 'SELF_CONFIRMATION',
  MANUAL = 'MANUAL',
  AUTOMATIC_MOCK = 'AUTOMATIC_MOCK',
}

export enum TaskWorkMode {
  INDIVIDUAL = 'INDIVIDUAL',
  GROUP = 'GROUP',
}

export enum TaskLearningPathType {
  STANDARD = 'STANDARD',
  REMEDIAL = 'REMEDIAL',
  DEEPENING = 'DEEPENING',
  PRACTICE = 'PRACTICE',
}

/**
 * Course-scoped reference to a task owned by the Task Service.
 *
 * The class keeps the historical name `Task` because progress and assessment
 * tables already reference task IDs. The complete task content is loaded from
 * the Task Service through `externalTaskId`.
 */
@Entity('task')
export class Task {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  externalTaskId: string;

  title?: string;

  description?: string;

  type?: string;

  content?: Record<string, unknown>;

  @Column()
  order: number;

  @Column({ default: TaskUnlockMode.IMMEDIATE })
  unlockMode: TaskUnlockMode;

  @Column({ nullable: true })
  prerequisiteTaskId?: string;

  completionCriteria?: Record<string, unknown>;

  @Column({ default: false })
  isPublished: boolean;

  demoKey?: string;

  @Column({ type: 'varchar', default: TaskGradingMode.NOT_GRADED })
  gradingMode: TaskGradingMode;

  @Column({ type: 'varchar', default: TaskWorkMode.INDIVIDUAL })
  workMode: TaskWorkMode;

  @Column({ type: 'varchar', default: TaskLearningPathType.STANDARD })
  learningPathType: TaskLearningPathType;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  maxPoints?: number | null;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  passThreshold?: number | null;

  @Column({ default: false })
  feedbackRequired: boolean;

  @Column({ default: false })
  allowRetries: boolean;

  @Column()
  createdBy: string;

  @Column()
  updatedBy: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
  updatedAt: Date;

  @Column({ type: 'uuid', nullable: true })
  courseId: string;

  @ManyToOne(() => Course, (course) => course.tasks, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'courseId' })
  course: Course;

  @Column({ type: 'uuid', nullable: true })
  courseRunId?: string;

  @ManyToOne(() => CourseRun, (run) => run.tasks, {
    nullable: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'courseRunId' })
  courseRun?: CourseRun;

  @Column({ type: 'uuid', nullable: true })
  courseVersionId?: string;

  @ManyToOne(() => CourseVersion, (version) => version.tasks, {
    nullable: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'courseVersionId' })
  courseVersion?: CourseVersion;

  @OneToMany(() => TaskProgress, (progress) => progress.task)
  progress: TaskProgress[];

  @OneToMany(() => GroupTaskProgress, (progress) => progress.task)
  groupProgress: GroupTaskProgress[];

  @OneToMany(() => TaskAssessment, (assessment) => assessment.task)
  assessments: TaskAssessment[];

  @OneToMany(() => TaskDependency, (dependency) => dependency.task)
  dependencies?: TaskDependency[];

  @OneToMany(() => TaskDependency, (dependency) => dependency.prerequisiteTask)
  dependentTasks?: TaskDependency[];
}

export { Task as CourseTaskReference };
