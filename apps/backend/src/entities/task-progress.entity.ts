/**
 * Task Progress Entity - Represents student progress on learning tasks
 * 
 * This entity tracks the completion status and progress of students
 * on individual learning tasks within a course.
 * 
 * @module TaskProgressEntity
 */
import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Task } from './task.entity';
import { Enrollment } from './enrollment.entity';

export enum TaskProgressStatus {
  LOCKED = 'LOCKED',
  AVAILABLE = 'AVAILABLE',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export enum TaskUnlockSource {
  IMMEDIATE = 'IMMEDIATE',
  AUTOMATIC = 'AUTOMATIC',
  MANUAL = 'MANUAL',
}

/**
 * Task Progress Entity Class
 * 
 * Represents the progress and completion status of a student on a specific task
 */
@Entity()
export class TaskProgress {
  /**
   * Unique identifier for the task progress record (UUID)
   * @example "550e8400-e29b-41d4-a716-446655440000"
   */
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Current status of the task
   * @example "NOT_STARTED", "IN_PROGRESS", "COMPLETED"
   */
  @Column({ default: TaskProgressStatus.LOCKED })
  status: TaskProgressStatus;

  /**
   * Percentage of task completion (0-100)
   * @default 0
   * @example 75
   */
  @Column({ default: 0 })
  completionPercentage: number;

  /**
   * Additional progress data in JSON format
   * @example {"quizScore": 85, "readingCompleted": true}
   */
  @Column({ type: 'json', nullable: true })
  progressData: any;

  @Column({ nullable: true })
  unlockedAt?: Date;

  @Column({ nullable: true })
  unlockSource?: TaskUnlockSource;

  /**
   * Timestamp when the student started the task
   * @format date-time
   * @example "2026-10-15T09:00:00Z"
   */
  @Column({ nullable: true })
  startedAt?: Date;

  /**
   * Timestamp when the student completed the task
   * @format date-time
   * @example "2026-10-15T11:30:00Z"
   */
  @Column({ nullable: true })
  completedAt?: Date;

  @Column({ nullable: true })
  resultPassed?: boolean;

  @Column({ nullable: true })
  resultRecordedAt?: Date;

  /**
   * User ID of the creator (student who started the task)
   * @example "student-123"
   */
  @Column()
  createdBy: string;

  /**
   * User ID of the last editor
   * @example "student-123"
   */
  @Column()
  updatedBy: string;

  /**
   * Timestamp when the progress record was created
   * @format date-time
   */
  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  /**
   * Timestamp when the progress record was last updated
   * @format date-time
   */
  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
  updatedAt: Date;

  /**
   * The task this progress record is for
   */
  @Column({ type: 'uuid', nullable: true })
  taskId: string;

  @ManyToOne(() => Task, (task) => task.progress, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'taskId' })
  task: Task;

  /**
   * The enrollment this progress record belongs to
   */
  @Column({ type: 'uuid', nullable: true })
  enrollmentId: string;

  @ManyToOne(() => Enrollment, (enrollment) => enrollment.taskProgress, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'enrollmentId' })
  enrollment: Enrollment;
}
