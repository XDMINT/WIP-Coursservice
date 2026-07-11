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

import { Course } from './course.entity';
import { Enrollment } from './enrollment.entity';

export enum CourseResultMode {
  MANUAL = 'MANUAL',
  AUTOMATIC = 'AUTOMATIC',
}

export enum CourseResultSource {
  MANUAL_ENTRY = 'MANUAL_ENTRY',
  AUTOMATIC_CALCULATION = 'AUTOMATIC_CALCULATION',
  MANUAL_OVERRIDE = 'MANUAL_OVERRIDE',
}

export enum CoursePassStatus {
  PASSED = 'PASSED',
  FAILED = 'FAILED',
  NOT_ASSESSED = 'NOT_ASSESSED',
}

@Index('uq_course_result_course_enrollment', ['courseId', 'enrollmentId'], {
  unique: true,
})
@Index('idx_course_result_course_student', ['courseId', 'studentId'])
@Entity('course_result')
export class CourseResult {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  courseId: string;

  @ManyToOne(() => Course, (course) => course.results, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'courseId' })
  course: Course;

  @Column({ type: 'uuid' })
  enrollmentId: string;

  @ManyToOne(() => Enrollment, (enrollment) => enrollment.courseResults, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'enrollmentId' })
  enrollment: Enrollment;

  @Column()
  studentId: string;

  @Column({ type: 'varchar' })
  assessmentMode: CourseResultMode;

  @Column({ type: 'numeric', precision: 10, scale: 2, nullable: true })
  pointsAchieved?: number | null;

  @Column({ type: 'numeric', precision: 10, scale: 2, nullable: true })
  maxPoints?: number | null;

  @Column({ type: 'numeric', precision: 5, scale: 2, nullable: true })
  percentage?: number | null;

  @Column({ nullable: true })
  manualGrade?: string | null;

  @Column({ type: 'varchar', default: CoursePassStatus.NOT_ASSESSED })
  passStatus: CoursePassStatus;

  @Column({ type: 'varchar' })
  source: CourseResultSource;

  @Column({ type: 'text', nullable: true })
  comment?: string | null;

  @Column({ nullable: true })
  gradedBy?: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  gradedAt?: Date | null;

  @Column({ type: 'jsonb', nullable: true })
  sourceDetails?: Record<string, unknown> | null;

  @Column({ nullable: true })
  createdBy?: string;

  @Column({ nullable: true })
  updatedBy?: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
