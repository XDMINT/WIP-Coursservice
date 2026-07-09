import {
    Column,
    CreateDateColumn,
    Entity,
    OneToMany,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from 'typeorm';

import { CourseVersion } from './course-version.entity';
import { CourseGroup } from './course-group.entity';
import { Enrollment } from './enrollment.entity';


export enum CourseStatus {
    DRAFT = 'DRAFT',
    PUBLISHED = 'PUBLISHED',
    ARCHIVED = 'ARCHIVED',
}

@Entity('courses')
export class Course {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ unique: true })
    external_id: string;

    @Column()
    title: string;

    @Column({ type: 'text', nullable: true })
    description?: string;

    @Column()
    semester: string;

    @Column({
        type: 'enum',
        enum: CourseStatus,
        default: CourseStatus.DRAFT,
    })
    status: CourseStatus;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;

    @OneToMany(() => CourseVersion, (version) => version.course)
    versions: CourseVersion[];

    @OneToMany(() => Enrollment, (enrollment) => enrollment.course)
    enrollments: Enrollment[];

    @OneToMany(() => CourseGroup, (group) => group.course)
    groups: CourseGroup[];
}