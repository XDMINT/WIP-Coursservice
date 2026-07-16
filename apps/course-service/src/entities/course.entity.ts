/**
 * Course Entity - Represents a course in the learning platform
 * 
 * This entity stores all information about a course including its metadata,
 * status, and relationships to other entities like learning materials,
 * assignments, enrollments, etc.
 * 
 * @module CourseEntity
 */
import {
    Column,
    CreateDateColumn,
    Entity,
    OneToMany,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from 'typeorm';

import { CourseVersion } from './course-version.entity';
import { CourseRecurrenceType, CourseRun } from './course-run.entity';
import { CourseGroup } from './course-group.entity';
import { Enrollment } from './enrollment.entity';
import { LearningMaterial } from './learning-material.entity';
import { Assignment } from './assignment.entity';
import { ContentRelease } from './content-release.entity';
import { CalendarEvent } from './calendar-event.entity';
import { Task } from './task.entity';
import { ContentTemplate } from './content-template.entity';
import { CourseResult } from './course-result.entity';

/**
 * Course Status Enum
 * 
 * Defines the possible states a course can be in
 */
export enum CourseStatus {
    /** Course is in draft mode and not visible to students */
    DRAFT = 'DRAFT',
    /** Course is published and visible to enrolled students */
    PUBLISHED = 'PUBLISHED',
    /** Course is archived and no longer active */
    ARCHIVED = 'ARCHIVED',
}

export enum CourseRunTemplateStrategy {
    ACTIVE_VERSION_OF_CURRENT_RUN = 'ACTIVE_VERSION_OF_CURRENT_RUN',
    SPECIFIC_VERSION = 'SPECIFIC_VERSION',
    EMPTY = 'EMPTY',
}

/**
 * Course Entity Class
 * 
 * Represents a course with all its properties and relationships
 */
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

    @Column({ nullable: true })
    semester?: string;

    @Column({
        name: 'recurrence_type',
        type: 'varchar',
        default: CourseRecurrenceType.CONTINUOUS,
    })
    recurrenceType: CourseRecurrenceType;

    @Column({
        name: 'content_template_strategy',
        type: 'varchar',
        default: CourseRunTemplateStrategy.ACTIVE_VERSION_OF_CURRENT_RUN,
    })
    contentTemplateStrategy: CourseRunTemplateStrategy;

    @Column({
        name: 'planned_source_version_id',
        type: 'uuid',
        nullable: true,
    })
    plannedSourceVersionId?: string | null;

    @Column({
        type: 'enum',
        enum: CourseStatus,
        default: CourseStatus.DRAFT,
    })
    status: CourseStatus;

    @Column({ nullable: true })
    location?: string;

    @Column({ nullable: true })
    key_password?: string;

    @Column({ nullable: true })
    owner_id?: number;

    @Column({ nullable: true })
    created_by?: string;

    @Column({ nullable: true })
    updated_by?: string;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;

    @OneToMany(() => CourseVersion, (version) => version.course)
    versions: CourseVersion[];

    @OneToMany(() => CourseRun, (run) => run.course)
    runs: CourseRun[];

    @OneToMany(() => Enrollment, (enrollment) => enrollment.course)
    enrollments: Enrollment[];

    @OneToMany(() => CourseGroup, (group) => group.course)
    groups: CourseGroup[];

    @OneToMany(() => LearningMaterial, (material) => material.course)
    learningMaterials: LearningMaterial[];

    @OneToMany(() => Assignment, (assignment) => assignment.course)
    assignments: Assignment[];

    @OneToMany(() => ContentRelease, (release) => release.course)
    contentReleases: ContentRelease[];

    @OneToMany(() => CalendarEvent, (event) => event.course)
    calendarEvents: CalendarEvent[];

    @OneToMany(() => Task, (task) => task.course)
    tasks: Task[];

    @OneToMany(() => ContentTemplate, (template) => template.course)
    templates: ContentTemplate[];

    @OneToMany(() => CourseResult, (result) => result.course)
    results: CourseResult[];
}
