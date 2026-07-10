/**
 * Content Template Entity - Represents reusable course content templates
 * 
 * This entity stores templates for course structures, learning materials,
 * assignments, and other content that can be reused across multiple courses.
 * 
 * @module ContentTemplateEntity
 */
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { Course } from './course.entity';

/**
 * Content Template Entity Class
 * 
 * Represents a reusable template for course content and structure
 */
@Entity()
export class ContentTemplate {
  /**
   * Unique identifier for the template (UUID)
   * @example "550e8400-e29b-41d4-a716-446655440000"
   */
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Name of the template
   * @example "Standard Course Structure"
   */
  @Column()
  name: string;

  /**
   * Description of what the template contains and its purpose
   * @example "Basic template with weekly structure for introductory courses"
   */
  @Column()
  description: string;

  /**
   * Type of template
   * @example "COURSE_STRUCTURE", "ASSIGNMENT_SET", "LEARNING_PATH"
   */
  @Column()
  templateType: string;

  /**
   * Template content in JSON format
   * @example {"learningMaterials": [...], "assignments": [...], "structure": {...}}
   */
  @Column({ type: 'json' })
  templateData: any;

  /**
   * Placeholders that need to be filled when using the template
   * @example {"courseName": "{{COURSE_NAME}}", "semester": "{{SEMESTER}}"}
   */
  @Column({ type: 'json', nullable: true })
  placeholders: any;

  /**
   * Whether this template is available globally (across all courses)
   * @default false
   */
  @Column({ default: false })
  isGlobal: boolean;

  /**
   * Whether this template is currently active and available for use
   * @default true
   */
  @Column({ default: true })
  isActive: boolean;

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
   * Timestamp when the template was created
   * @format date-time
   */
  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  /**
   * Timestamp when the template was last updated
   * @format date-time
   */
  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
  updatedAt: Date;

  /**
   * The course this template belongs to (null for global templates)
   */
  @ManyToOne(() => Course, (course) => course.templates)
  course: Course;
}