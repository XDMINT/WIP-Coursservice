/**
 * Course Version Entity - Represents different versions of course content
 * 
 * This entity stores historical versions of course content, allowing for
 * version control, rollbacks, and tracking changes over time.
 * 
 * @module CourseVersionEntity
 */
import {
    Column,
    CreateDateColumn,
    Entity,
    Index,
    JoinColumn,
    ManyToOne,
    OneToMany,
    PrimaryGeneratedColumn,
} from 'typeorm';
import { Course } from './course.entity';
import { CourseRun } from './course-run.entity';
import { LearningMaterial } from './learning-material.entity';
import { Task } from './task.entity';

export enum CourseVersionStatus {
    PUBLISHED = 'PUBLISHED',
    ARCHIVED = 'ARCHIVED',
}

/**
 * Course Version Entity Class
 * 
 * Represents a specific version of a course's content and structure
 */
@Index('uq_course_versions_run_version_number', ['course_run_id', 'version_number'], {
    unique: true,
    where: '"course_run_id" IS NOT NULL',
})
@Index('uq_course_versions_active_per_run', ['course_run_id'], {
    unique: true,
    where: '"course_run_id" IS NOT NULL AND "is_active" = true',
})
@Entity('course_versions')
export class CourseVersion {
    /**
     * Unique identifier for the course version (UUID)
     * @example "550e8400-e29b-41d4-a716-446655440000"
     */
    @PrimaryGeneratedColumn('uuid')
    id: string;

    /**
     * ID of the course this version belongs to
     * @example "course-uuid-here"
     */
    @Column('uuid')
    course_id: string;

    /**
     * The course this version belongs to
     */
    @ManyToOne(() => Course, (course) => course.versions, {
        onDelete: 'CASCADE',
    })
    @JoinColumn({ name: 'course_id' })
    course: Course;

    @Column({ name: 'course_run_id', type: 'uuid', nullable: true })
    course_run_id?: string;

    @ManyToOne(() => CourseRun, (run) => run.versions, {
        nullable: true,
        onDelete: 'CASCADE',
    })
    @JoinColumn({ name: 'course_run_id' })
    courseRun?: CourseRun;

    /**
     * Version number for this course version
     * @example 1, 2, 3, etc.
     */
    @Column()
    version_number: number;

    @Column({ type: 'varchar', nullable: true })
    label?: string | null;

    /**
     * Complete content of the course in this version (JSON format)
     * @example {"learningMaterials": [...], "assignments": [...], "structure": {...}}
     */
    @Column({ type: 'json' })
    content: Record<string, any>;

    @Column({ type: 'text', nullable: true })
    change_summary?: string;

    @Column({ type: 'varchar', default: CourseVersionStatus.PUBLISHED })
    status: CourseVersionStatus;

    @Column({ type: 'uuid', nullable: true })
    sourceVersionId?: string | null;

    @ManyToOne(() => CourseVersion, {
        nullable: true,
        onDelete: 'SET NULL',
    })
    @JoinColumn({ name: 'sourceVersionId' })
    sourceVersion?: CourseVersion | null;

    /**
     * Timestamp when this version was created
     * @format date-time
     */
    @CreateDateColumn()
    created_at: Date;

    /**
     * User ID of who created this version
     * @example "teacher-123"
     */
    @Column()
    created_by: string;

    /**
     * Whether this is the currently active version
     * @default false
     */
    @Column({ default: false })
    is_active: boolean;

    @OneToMany(() => LearningMaterial, (material) => material.courseVersion)
    learningMaterials?: LearningMaterial[];

    @OneToMany(() => Task, (task) => task.courseVersion)
    tasks?: Task[];
}
