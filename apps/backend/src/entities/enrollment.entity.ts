/**
 * Enrollment Entity - Represents student enrollment in courses
 * 
 * This entity tracks which students are enrolled in which courses and their roles
 * (student, teacher, tutor) within those courses.
 * 
 * @module EnrollmentEntity
 */
import {
    Column,
    CreateDateColumn,
    Entity,
    JoinColumn,
    ManyToOne,
    OneToMany,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from 'typeorm';

import { Course } from './course.entity';
import { Grade } from './grade.entity';
import { TaskProgress } from './task-progress.entity';
import { CourseResult } from './course-result.entity';

/**
 * Course Member Role Enum
 * 
 * Defines different roles that users can have within a course
 */
export enum CourseMemberRole {
    /** Regular student enrolled in the course */
    STUDENT = 'STUDENT',
    /** Instructor or professor teaching the course */
    TEACHER = 'TEACHER',
    /** Teaching assistant or tutor */
    TUTOR = 'TUTOR',
}

/**
 * Enrollment Entity Class
 * 
 * Represents a user's enrollment in a specific course
 */
@Entity('enrollments')
export class Enrollment {
    /**
     * Unique identifier for the enrollment (UUID)
     * @example "550e8400-e29b-41d4-a716-446655440000"
     */
    @PrimaryGeneratedColumn('uuid')
    id: string;

    /**
     * ID of the course this enrollment belongs to
     * @example "course-uuid-here"
     */
    @Column({ name: 'course_id', type: 'uuid' })
    courseId: string;

    /**
     * The course this enrollment belongs to
     */
    @ManyToOne(() => Course, (course) => course.enrollments, {
        onDelete: 'CASCADE',
    })
    @JoinColumn({ name: 'course_id' })
    course: Course;

    /**
     * ID of the user who is enrolled
     * @example "student-uuid-here"
     */
    @Column({ name: 'user_id' })
    userId: string;

    /**
     * Role of the user within the course
     */
    @Column({
        type: 'enum',
        enum: CourseMemberRole,
    })
    role: CourseMemberRole;

    @Column({ nullable: true })
    createdBy?: string;

    @Column({ nullable: true })
    updatedBy?: string;

    /**
     * Timestamp when the user enrolled in the course
     * @format date-time
     */
    @CreateDateColumn()
    enrolledAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;

    /**
     * Grades received by this student for assignments in the course
     */
    @OneToMany(() => Grade, (grade) => grade.enrollment)
    grades: Grade[];

    /**
     * Progress records for tasks completed by this student
     */
    @OneToMany(() => TaskProgress, (progress) => progress.enrollment)
    taskProgress: TaskProgress[];

    @OneToMany(() => CourseResult, (result) => result.enrollment)
    courseResults: CourseResult[];
}
