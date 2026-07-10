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
    JoinColumn,
    ManyToOne,
    PrimaryGeneratedColumn,
} from 'typeorm';
import { Course } from './course.entity';

/**
 * Course Version Entity Class
 * 
 * Represents a specific version of a course's content and structure
 */
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

    /**
     * Version number for this course version
     * @example 1, 2, 3, etc.
     */
    @Column()
    version_number: number;

    /**
     * Complete content of the course in this version (JSON format)
     * @example {"learningMaterials": [...], "assignments": [...], "structure": {...}}
     */
    @Column({ type: 'json' })
    content: Record<string, any>;

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
}