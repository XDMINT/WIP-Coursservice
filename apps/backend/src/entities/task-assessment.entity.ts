import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { CourseRun } from './course-run.entity';
import { CourseVersion } from './course-version.entity';
import { CourseGroup } from './course-group.entity';
import { Task, TaskGradingMode } from './task.entity';

export enum TaskAssessmentStatus {
  NOT_SUBMITTED = 'NOT_SUBMITTED',
  SUBMITTED = 'SUBMITTED',
  PENDING_REVIEW = 'PENDING_REVIEW',
  PASSED = 'PASSED',
  FAILED = 'FAILED',
  AUTO_EVALUATED = 'AUTO_EVALUATED',
}

export enum TaskAssessmentTargetType {
  INDIVIDUAL = 'INDIVIDUAL',
  GROUP = 'GROUP',
}

@Index('uq_task_assessment_run_task_student', ['courseRunId', 'taskId', 'studentId'], {
  unique: true,
  where: '"studentId" IS NOT NULL',
})
@Index('uq_task_assessment_run_task_group', ['courseRunId', 'taskId', 'groupId'], {
  unique: true,
  where: '"groupId" IS NOT NULL',
})
@Index('idx_task_assessment_run_student', ['courseRunId', 'studentId'])
@Index('idx_task_assessment_run_group', ['courseRunId', 'groupId'])
@Index('idx_task_assessment_task', ['taskId'])
@Entity('task_assessment')
export class TaskAssessment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  courseRunId: string;

  @ManyToOne(() => CourseRun, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'courseRunId' })
  courseRun: CourseRun;

  @Column({ type: 'uuid' })
  courseVersionId: string;

  @ManyToOne(() => CourseVersion, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'courseVersionId' })
  courseVersion: CourseVersion;

  @Column({ type: 'uuid' })
  taskId: string;

  @ManyToOne(() => Task, (task) => task.assessments, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'taskId' })
  task: Task;

  @Column({ type: 'varchar', default: TaskAssessmentTargetType.INDIVIDUAL })
  assessmentTargetType: TaskAssessmentTargetType;

  @Column({ nullable: true })
  studentId?: string | null;

  @Column({ type: 'uuid', nullable: true })
  groupId?: string | null;

  @ManyToOne(() => CourseGroup, {
    nullable: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'groupId' })
  group?: CourseGroup | null;

  @Column({ type: 'varchar' })
  gradingMode: TaskGradingMode;

  @Column({ type: 'varchar', default: TaskAssessmentStatus.NOT_SUBMITTED })
  status: TaskAssessmentStatus;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  points?: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  maxPoints?: number | null;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  passThreshold?: number | null;

  @Column({ nullable: true })
  passed?: boolean | null;

  @Column({ type: 'text', nullable: true })
  feedback?: string | null;

  @Column({ type: 'json', nullable: true })
  submissionData?: Record<string, unknown> | null;

  @Column({ nullable: true })
  assessedBy?: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  assessedAt?: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
