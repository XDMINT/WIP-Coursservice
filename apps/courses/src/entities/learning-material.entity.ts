/**
 * Learning Material Entity - Represents educational content in a course
 * 
 * This entity stores information about various types of learning materials
 * such as presentations, documents, videos, and external links.
 * 
 * @module LearningMaterialEntity
 */
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { Course } from './course.entity';

/**
 * Learning Material Entity Class
 * 
 * Represents a piece of educational content associated with a course
 */
@Entity()
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
  @Column()
  description: string;

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
  @Column()
  type: string; // 'video', 'document', 'link', etc.

  /**
   * URL to access the learning material
   * @example "https://example.com/slides.pdf"
   */
  @Column()
  url: string;

  /**
   * File path for uploaded materials
   * @example "/uploads/course-123/slides.pdf"
   */
  @Column({ nullable: true })
  filePath: string;

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
  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  /**
   * Timestamp when the material was last updated
   * @format date-time
   */
  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
  updatedAt: Date;

  /**
   * The course this learning material belongs to
   */
  @ManyToOne(() => Course, (course) => course.learningMaterials)
  course: Course;
}