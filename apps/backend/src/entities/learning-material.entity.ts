/**
 * Learning Material Entity - Represents educational content in a course
 * 
 * This entity stores information about various types of learning materials
 * such as presentations, documents, videos, and external links.
 * 
 * @module LearningMaterialEntity
 */
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Course } from './course.entity';

export enum LearningMaterialType {
  DOCUMENT = 'DOCUMENT',
  PRESENTATION = 'PRESENTATION',
  VIDEO = 'VIDEO',
  EXTERNAL_LINK = 'EXTERNAL_LINK',
  OTHER_FILE = 'OTHER_FILE',
}

export enum LearningMaterialPublicationStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  ARCHIVED = 'ARCHIVED',
}

/**
 * Learning Material Entity Class
 * 
 * Represents a piece of educational content associated with a course
 */
@Entity('learning_material')
export class LearningMaterial {
  /**
   * Unique identifier for the learning material (UUID)
   * @example "550e8400-e29b-41d4-a716-446655440000"
   */
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Title of the learning material
   * @example "Introduction to Computer Science"
   */
  @Column()
  title: string;

  /**
   * Description of the learning material content
   * @example "Week 1 lecture slides covering basic concepts"
   */
  @Column({ nullable: true })
  description?: string;

  /**
   * Actual content or text of the learning material (optional)
   * @example "The content goes here..."
   */
  @Column({ nullable: true })
  content?: string;

  /**
   * Type of learning material
   * @example "PRESENTATION", "DOCUMENT", "VIDEO", "LINK"
   */
  @Column({ name: 'type' })
  type: LearningMaterialType;

  /**
   * URL to access the learning material
   * @example "https://example.com/slides.pdf"
   */
  @Column({ nullable: true })
  url?: string;

  @Column({ nullable: true })
  originalFileName?: string;

  @Column({ nullable: true })
  storageKey?: string;

  @Column({ nullable: true })
  mimeType?: string;

  @Column({ type: 'bigint', nullable: true })
  fileSize?: number;

  @Column({ type: 'jsonb', nullable: true })
  previewMetadata?: Record<string, unknown>;

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  tags: string[];

  @Column({ default: 0 })
  sortOrder: number;

  @Column({ default: LearningMaterialPublicationStatus.DRAFT })
  publicationStatus: LearningMaterialPublicationStatus;

  @Column({ type: 'timestamptz', nullable: true })
  publishedAt?: Date;

  @Column({ type: 'timestamptz', nullable: true })
  archivedAt?: Date;

  /**
   * File path for uploaded materials
   * @example "/uploads/course-123/slides.pdf"
   */
  @Column({ nullable: true })
  filePath?: string;

  /**
   * Whether the material is published and visible to students
   * @default false
   */
  @Column({ default: false })
  isPublished: boolean;

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
   * Timestamp when the material was created
   * @format date-time
   */
  @CreateDateColumn({ type: 'timestamptz', name: 'createdAt' })
  createdAt: Date;

  /**
   * Timestamp when the material was last updated
   * @format date-time
   */
  @UpdateDateColumn({ type: 'timestamptz', name: 'updatedAt' })
  updatedAt: Date;

  @Column({ name: 'courseId', type: 'uuid' })
  courseId: string;

  /**
   * The course this learning material belongs to
   */
  @ManyToOne(() => Course, (course) => course.learningMaterials)
  @JoinColumn({ name: 'courseId' })
  course: Course;
}
