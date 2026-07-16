/**
 * Calendar Event Entity - Represents events in the course calendar
 * 
 * This entity stores information about course-related events such as lectures,
 * exams, deadlines, and other important dates.
 * 
 * @module CalendarEventEntity
 */
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { Course } from './course.entity';

/**
 * Calendar Event Entity Class
 * 
 * Represents a calendar event associated with a course
 */
@Entity()
export class CalendarEvent {
  /**
   * Unique identifier for the calendar event (UUID)
   * @example "550e8400-e29b-41d4-a716-446655440000"
   */
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Title of the calendar event
   * @example "Midterm Exam"
   */
  @Column()
  title: string;

  /**
   * Detailed description of the event
   * @example "Covers chapters 1-6, 2 hours duration"
   */
  @Column()
  description: string;

  /**
   * Type of calendar event
   * @example "EXAM", "LECTURE", "DEADLINE", "MEETING"
   */
  @Column()
  eventType: string;

  /**
   * Start date and time of the event
   * @format date-time
   * @example "2026-11-15T09:00:00Z"
   */
  @Column()
  startTime: Date;

  /**
   * End date and time of the event
   * @format date-time
   * @example "2026-11-15T11:00:00Z"
   */
  @Column()
  endTime: Date;

  /**
   * Physical location of the event
   * @example "Room 101, Building A"
   */
  @Column()
  location: string;

  /**
   * Online meeting link (for virtual events)
   * @example "https://zoom.us/j/123456789"
   */
  @Column({ nullable: true })
  onlineLink: string;

  /**
   * Whether the event is an all-day event
   * @default false
   */
  @Column({ default: false })
  isAllDay: boolean;

  /**
   * Whether the event is recurring
   * @default false
   */
  @Column({ default: false })
  isRecurring: boolean;

  /**
   * Recurrence pattern for recurring events (JSON format)
   * @example {"frequency": "weekly", "interval": 1, "endDate": "2026-12-15"}
   */
  @Column({ type: 'json', nullable: true })
  recurrencePattern: any;

  /**
   * ID of related content (e.g., assignment ID for deadline events)
   * @example "assignment-uuid-here"
   */
  @Column({ nullable: true })
  relatedContentId: string;

  /**
   * Type of related content
   * @example "ASSIGNMENT", "LEARNING_MATERIAL"
   */
  @Column({ nullable: true })
  relatedContentType: string;

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
   * Timestamp when the event was created
   * @format date-time
   */
  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  /**
   * Timestamp when the event was last updated
   * @format date-time
   */
  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
  updatedAt: Date;

  /**
   * The course this calendar event belongs to
   */
  @ManyToOne(() => Course, (course) => course.calendarEvents)
  course: Course;
}