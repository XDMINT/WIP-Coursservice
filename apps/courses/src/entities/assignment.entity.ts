/**
 * Assignment Entity - Represents homework, projects, or assessments in a course
 * 
 * This entity stores information about assignments including their due dates,
 * grading criteria, and associated grades.
 * 
 * @module AssignmentEntity
 */
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany } from 'typeorm';
import { Course } from './course.entity';
import { Grade } from './grade.entity';

/**
 * Assignment Entity Class
 * 
 * Represents an assignment, homework, project, or assessment within a course
 */
@Entity()
export class Assignment {
  /**
   * Unique identifier for the assignment (UUID)
   * @example "550e8400-e29b-41d4-a716-446655440000"
   */
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Title of the assignment
   * @example "Homework 1: Binary Search Implementation"
   */
  @Column()
  title: string;

  /**
   * Detailed description of the assignment requirements
   * @example "Implement a binary search algorithm in JavaScript..."
   */
  @Column()
  description: string;

  /**
   * Type of assignment
   * @example "HOMEWORK", "PROJECT", "EXAM", "QUIZ"
   */
  @Column()
  type: string;

  /**
   * Maximum points available for this assignment
   * @example 100
   */
  @Column()
  maxPoints: number;

  /**
   * Weight of this assignment in overall course grade (1.0 = 100%)
   * @example 0.2 (20% of final grade)
   */
  @Column()
  weight: number;

  /**
   * Due date and time for the assignment
   * @format date-time
   * @example "2026-10-15T23:59:59Z"
   */
  @Column()
  dueDate: Date;

  /**
   * Whether the assignment is published and visible to students
   * @default false
   */
  @Column({ default: false })
  isPublished: boolean;

  /**
   * Whether the assignment has been graded
   * @default false
   */
  @Column({ default: false })
  isGraded: boolean;

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
   * Timestamp when the assignment was created
   * @format date-time
   */
  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  /**
   * Timestamp when the assignment was last updated
   * @format date-time
   */
  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
  updatedAt: Date;

  /**
   * The course this assignment belongs to
   */
  @ManyToOne(() => Course, (course) => course.assignments)
  course: Course;

  /**
   * Grades submitted for this assignment by students
   */
  @OneToMany(() => Grade, (grade) => grade.assignment)
  grades: Grade[];
}