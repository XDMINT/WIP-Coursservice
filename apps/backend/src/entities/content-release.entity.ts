/**
 * Content Release Entity - Manages scheduled and conditional content releases
 * 
 * This entity controls when course content becomes available to students,
 * supporting various release strategies like time-based, progress-based, etc.
 * 
 * @module ContentReleaseEntity
 */
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { Course } from './course.entity';

/**
 * Release Type Enum
 * 
 * Defines different strategies for releasing content to students
 */
export enum ReleaseType {
  /** Content is released immediately */
  IMMEDIATE = 'immediate',
  /** Content is released at a specific date/time */
  SCHEDULED = 'scheduled',
  /** Content is released when certain conditions are met */
  CONDITIONAL = 'conditional',
  /** Content is released based on time criteria */
  TIME_BASED = 'time_based',
  /** Content is released based on student progress */
  PROGRESS_BASED = 'progress_based'
}

/**
 * Content Release Entity Class
 * 
 * Manages the release schedule and conditions for course content
 */
@Entity()
export class ContentRelease {
  /**
   * Unique identifier for the content release (UUID)
   * @example "550e8400-e29b-41d4-a716-446655440000"
   */
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Type of content being released
   * @example "LEARNING_MATERIAL", "ASSIGNMENT", "TASK"
   */
  @Column()
  contentType: string;

  /**
   * ID of the content being released
   * @example "learning-material-uuid-here"
   */
  @Column()
  contentId: string;

  /**
   * Strategy for releasing the content
   */
  @Column()
  releaseType: ReleaseType;

  /**
   * Date and time when content should be released (for scheduled releases)
   * @format date-time
   * @example "2026-10-01T00:00:00Z"
   */
  @Column({ nullable: true })
  releaseDate: Date;

  /**
   * Conditions that must be met for content release (JSON format)
   * @example {"minProgress": 70, "prerequisiteTasks": ["task-1", "task-2"]}
   */
  @Column({ type: 'json', nullable: true })
  releaseConditions: any;

  /**
   * Whether this release rule is currently active
   * @default false
   */
  @Column({ default: false })
  isActive: boolean;

  /**
   * Whether the content has been released
   * @default false
   */
  @Column({ default: false })
  isReleased: boolean;

  /**
   * Timestamp when the content was released
   * @format date-time
   */
  @Column({ nullable: true })
  releasedAt: Date;

  /**
   * User ID of who released the content
   * @example "teacher-123"
   */
  @Column({ nullable: true })
  releasedBy: string;

  /**
   * User ID of the creator
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
   * Timestamp when the release rule was created
   * @format date-time
   */
  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  /**
   * Timestamp when the release rule was last updated
   * @format date-time
   */
  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
  updatedAt: Date;

  /**
   * The course this content release belongs to
   */
  @ManyToOne(() => Course, (course) => course.contentReleases)
  course: Course;
}