/**
 * Course Group Entity - Represents student groups within courses
 * 
 * This entity manages workgroups, study groups, project teams, and other
 * collaborative groups formed within courses.
 * 
 * @module CourseGroupEntity
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
import { GroupMembership } from './group-membership.entity';

/**
 * Group Type Enum
 * 
 * Defines different types of groups that can be formed within courses
 */
export enum GroupType {
    /** Group for collaborative study sessions */
    STUDY_GROUP = 'STUDY_GROUP',
    /** Group for project work and team assignments */
    PROJECT_GROUP = 'PROJECT_GROUP',
    /** Group for discussion and debate activities */
    DISCUSSION_GROUP = 'DISCUSSION_GROUP',
    /** General working group for various activities */
    WORKGROUP = 'WORKGROUP',
    /** Other types of groups not covered by the above */
    OTHER = 'OTHER',
}

/**
 * Course Group Entity Class
 * 
 * Represents a group of students working together within a course
 */
@Entity('groups')
export class CourseGroup {
    /**
     * Unique identifier for the group (UUID)
     * @example "550e8400-e29b-41d4-a716-446655440000"
     */
    @PrimaryGeneratedColumn('uuid')
    id: string;

    /**
     * ID of the course this group belongs to
     * @example "course-uuid-here"
     */
    @Column('uuid')
    course_id: string;

    /**
     * The course this group belongs to
     */
    @ManyToOne(() => Course, (course) => course.groups, {
        onDelete: 'CASCADE',
    })
    @JoinColumn({ name: 'course_id' })
    course: Course;

    /**
     * Name of the group
     * @example "Project Team Alpha"
     */
    @Column()
    name: string;

    /**
     * Description of the group's purpose and activities
     * @example "Team working on the semester project for CS101"
     */
    @Column({ type: 'text', nullable: true })
    description?: string;

    /**
     * Type of group
     * @default GroupType.WORKGROUP
     */
    @Column({
        type: 'enum',
        enum: GroupType,
        default: GroupType.WORKGROUP,
    })
    group_type: GroupType;

    /**
     * Whether the group is currently active
     * @default true
     */
    @Column({ default: true })
    is_active: boolean;

    /**
     * Overall grade for the group (for group assignments)
     * @example 92.5
     */
    @Column({ type: 'decimal', precision: 5, scale: 2, default: 0, nullable: true })
    group_grade: number;

    /**
     * Feedback on the group's performance
     * @example "Excellent teamwork and project delivery"
     */
    @Column({ type: 'text', nullable: true })
    group_feedback?: string;

    /**
     * User ID of the creator (typically an instructor)
     * @example "teacher-123"
     */
    @Column({ nullable: true })
    created_by: string;

    /**
     * Timestamp when the group was created
     * @format date-time
     */
    @CreateDateColumn()
    created_at: Date;

    /**
     * Timestamp when the group was last updated
     * @format date-time
     */
    @UpdateDateColumn()
    updated_at: Date;

    /**
     * User ID of the last editor
     * @example "teacher-123"
     */
    @Column({ nullable: true })
    updated_by: string;

    /**
     * Group membership records for this group
     */
    @OneToMany(() => GroupMembership, (membership) => membership.group)
    memberships: GroupMembership[];
}
