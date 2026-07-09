import {
    Column,
    Entity,
    JoinColumn,
    ManyToOne,
    PrimaryColumn,
} from 'typeorm';
import { CourseGroup } from './course-group.entity';

@Entity('group_memberships')
export class GroupMembership {
    @PrimaryColumn('uuid')
    group_id: string;

    @PrimaryColumn('uuid')
    user_id: string;

    @ManyToOne(() => CourseGroup, (group) => group.memberships, {
        onDelete: 'CASCADE',
    })
    @JoinColumn({ name: 'group_id' })
    group: CourseGroup;
}