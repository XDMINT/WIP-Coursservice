/**
 * Grade Entity - Represents student grades for assignments
 * 
 * This entity stores grading information including points achieved,
 * feedback, and grading timestamps for student submissions.
 * 
 * @module GradeEntity
 */
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { Enrollment } from './enrollment.entity';
import { Assignment } from './assignment.entity';

/**
 * Grade Entity Class
 * 
 * Represents a grade given to a student for a specific assignment
 */
@Entity()
export class Grade {
  /**
   * Unique identifier for the grade (UUID)
   * @example "550e8400-e29b-41d4-a716-446655440000"
   */
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Points achieved by the student for this assignment
   * @example 85
   */
  @Column()
  pointsAchieved: number;

  /**
   * Feedback provided by the grader
   * @example "Good implementation, but could use more comments"
   */
  @Column()
  feedback: string;

  /**
   * User ID of the grader (typically an instructor)
   * @example "teacher-123"
   */
  @Column()
  gradedBy: string;

  /**
   * Timestamp when the grade was assigned
   * @format date-time
   * @example "2026-10-20T15:30:00Z"
   */
  @Column()
  gradedAt: Date;

  /**
   * Whether this is the final grade (no further changes expected)
   * @default false
   */
  @Column({ default: false })
  isFinal: boolean;

  /**
   * User ID of the last editor
   * @example "teacher-123"
   */
  @Column()
  updatedBy: string;

  /**
   * Timestamp when the grade was last updated
   * @format date-time
   */
  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
  updatedAt: Date;

  /**
   * The enrollment this grade belongs to (student-course relationship)
   */
  @ManyToOne(() => Enrollment, (enrollment) => enrollment.grades)
  enrollment: Enrollment;

  /**
   * The assignment this grade is for
   */
  @ManyToOne(() => Assignment, (assignment) => assignment.grades)
  assignment: Assignment;
}