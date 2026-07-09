/**
 * Group Membership Entity - Represents student membership in course groups
 * 
 * This entity tracks which students belong to which groups and their roles
 * within those groups.
 * 
 * @module GroupMembershipEntity
 */
import {
    Column,
    CreateDateColumn,
    Entity,
    JoinColumn,
    ManyToOne,
    PrimaryColumn,
    UpdateDateColumn,
} from 'typeorm';
import { CourseGroup } from './course-group.entity';

/**
 * Membership Role Enum
 * 
 * Defines different roles that members can have within a group
 */
export enum MembershipRole {
    /** Regular group member */
    MEMBER = 'MEMBER',
    /** Group leader with additional privileges */
    LEADER = 'LEADER',
    /** Co-leader who shares leadership responsibilities */
    CO_LEADER = 'CO_LEADER',
}

/**
 * Group Membership Entity Class
 * 
 * Represents a student's membership in a specific group
 */
@Entity('group_memberships')
export class GroupMembership {
    /**
     * ID of the group this membership belongs to
     * @example "group-uuid-here"
     */
    @PrimaryColumn('uuid')
    group_id: string;

    /**
     * ID of the user who is a member of the group
     * @example "student-uuid-here"
     */
    @PrimaryColumn('uuid')
    user_id: string;

    /**
     * The group this membership belongs to
     */
    @ManyToOne(() => CourseGroup, (group) => group.memberships, {
        onDelete: 'CASCADE',
    })
    @JoinColumn({ name: 'group_id' })
    group: CourseGroup;

    /**
     * Role of the member within the group
     * @default MembershipRole.MEMBER
     */
    @Column({
        type: 'enum',
        enum: MembershipRole,
        default: MembershipRole.MEMBER,
    })
    role: MembershipRole;

    /**
     * Timestamp when the user joined the group
     * @format date-time
     */
    @Column({ nullable: true })
    joined_at: Date;

    /**
     * Timestamp when the user left the group (null if still active)
     * @format date-time
     */
    @Column({ nullable: true })
    left_at: Date;

    /**
     * Individual grade for the member's contribution to the group
     * @example 90.5
     */
    @Column({ type: 'decimal', precision: 3, scale: 2, default: 0, nullable: true })
    individual_grade: number;

    /**
     * Feedback on the member's individual performance
     * @example "Consistently contributed high-quality work to group projects"
     */
    @Column({ type: 'text', nullable: true })
    individual_feedback?: string;

    /**
     * User ID of who added this member to the group
     * @example "teacher-123"
     */
    @Column({ nullable: true })
    added_by: string;

    /**
     * Timestamp when the membership record was created
     * @format date-time
     */
    @CreateDateColumn()
    created_at: Date;

    /**
     * Timestamp when the membership record was last updated
     * @format date-time
     */
    @UpdateDateColumn()
    updated_at: Date;
}