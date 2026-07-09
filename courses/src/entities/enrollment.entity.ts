import {
    Column,
    CreateDateColumn,
    Entity,
    JoinColumn,
    ManyToOne,
    PrimaryGeneratedColumn,
} from 'typeorm';

import { Course } from './course.entity';

export enum CourseMemberRole {
    STUDENT = 'STUDENT',
    TEACHER = 'TEACHER',
    TUTOR = 'TUTOR',
}

@Entity('enrollments')
export class Enrollment {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column('uuid')
    course_id: string;

    @ManyToOne(() => Course, (course) => course.enrollments, {
        onDelete: 'CASCADE',
    })
    @JoinColumn({ name: 'course_id' })
    course: Course;

    @Column('uuid')
    user_id: string;

    @Column({
        type: 'enum',
        enum: CourseMemberRole,
    })
    role: CourseMemberRole;

    @CreateDateColumn()
    enrolled_at: Date;
}