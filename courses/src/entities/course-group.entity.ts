import {
    Column,
    CreateDateColumn,
    Entity,
    JoinColumn,
    ManyToOne,
    OneToMany,
    PrimaryGeneratedColumn,
} from 'typeorm';
import { Course } from './course.entity';
import { GroupMembership } from './group-membership.entity';

@Entity('groups')
export class CourseGroup {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column('uuid')
    course_id: string;

    @ManyToOne(() => Course, (course) => course.groups, {
        onDelete: 'CASCADE',
    })
    @JoinColumn({ name: 'course_id' })
    course: Course;

    @Column()
    name: string;

    @CreateDateColumn()
    created_at: Date;

    @OneToMany(() => GroupMembership, (membership) => membership.group)
    memberships: GroupMembership[];
}