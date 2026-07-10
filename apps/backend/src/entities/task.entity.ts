/**
 * Task Entity - Represents learning activities and tasks in a course
 * 
 * This entity stores information about learning tasks that students need to complete,
 * including their order, prerequisites, and completion criteria.
 * 
 * @module TaskEntity
 */
import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Course } from './course.entity';
import { TaskProgress } from './task-progress.entity';

export enum TaskUnlockMode {
  IMMEDIATE = 'IMMEDIATE',
  AUTOMATIC = 'AUTOMATIC',
  MANUAL = 'MANUAL',
}

/**
 * Task Entity Class
 * 
 * Represents a learning task or activity that students must complete as part of a course
 */
@Entity()
export class Task {
  /**
   * Unique identifier for the task (UUID)
   * @example "550e8400-e29b-41d4-a716-446655440000"
   */
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Title of the task
   * @example "Complete Week 1 Reading"
   */
  @Column()
  title: string;

  /**
   * Detailed description of the task requirements
   * @example "Read chapters 1-3 and answer review questions"
   */
  @Column()
  description: string;

  /**
   * Type of task
   * @example "LESSON", "READING", "EXERCISE", "QUIZ"
   */
  @Column()
  type: string;

  /**
   * Order/sequence of this task in the learning path
   * @example 1 (first task)
   */
  @Column()
  order: number;

  @Column({ default: TaskUnlockMode.IMMEDIATE })
  unlockMode: TaskUnlockMode;

  /**
   * ID of the task that must be completed before this one (optional)
   * @example "task-uuid-here"
   */
  @Column({ nullable: true })
  prerequisiteTaskId?: string;

  /**
   * Criteria for task completion (JSON format)
   * @example {"requiredReading": true, "quizScore": 70}
   */
  @Column({ type: 'json', nullable: true })
  completionCriteria: any;

  /**
   * Whether the task is published and visible to students
   * @default false
   */
  @Column({ default: false })
  isPublished: boolean;

  @Column({ nullable: true })
  demoKey?: string;

  /**
   * User ID of the creator (typically an instructor)
   * @example "teacher-123"
   */
  @Column()
  createdBy: string;

  /**
   * User ID of the last editor
   * @example "teacher-123"
   */
  @Column()
  updatedBy: string;

  /**
   * Timestamp when the task was created
   * @format date-time
   */
  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  /**
   * Timestamp when the task was last updated
   * @format date-time
   */
  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
  updatedAt: Date;

  /**
   * The course this task belongs to
   */
  @Column({ type: 'uuid', nullable: true })
  courseId: string;

  @ManyToOne(() => Course, (course) => course.tasks, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'courseId' })
  course: Course;

  /**
   * Student progress records for this task
   */
  @OneToMany(() => TaskProgress, (progress) => progress.task)
  progress: TaskProgress[];
}
