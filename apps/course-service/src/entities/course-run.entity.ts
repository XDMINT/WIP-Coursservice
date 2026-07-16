import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { Course } from './course.entity';
import { CourseVersion } from './course-version.entity';
import { Enrollment } from './enrollment.entity';
import { CourseGroup } from './course-group.entity';
import { GroupTaskProgress } from './group-task-progress.entity';
import { LearningMaterial } from './learning-material.entity';
import { Task } from './task.entity';
import { Assignment } from './assignment.entity';
import { CourseResult } from './course-result.entity';

export enum CourseRecurrenceType {
  SEMESTER = 'SEMESTER',
  YEARLY = 'YEARLY',
  CONTINUOUS = 'CONTINUOUS',
}

export enum CourseRunStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  ARCHIVED = 'ARCHIVED',
}

@Index('idx_course_runs_course_id', ['courseId'])
@Index('uq_course_runs_active_per_course', ['courseId'], {
  unique: true,
  where: '"isActive" = true',
})
@Entity('course_runs')
export class CourseRun {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  courseId: string;

  @ManyToOne(() => Course, (course) => course.runs, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'courseId' })
  course: Course;

  @Column()
  label: string;

  @Column({ type: 'date', nullable: true })
  startDate?: string;

  @Column({ type: 'date', nullable: true })
  endDate?: string;

  @Column({ type: 'varchar', default: CourseRunStatus.DRAFT })
  status: CourseRunStatus;

  @Column({ type: 'uuid', nullable: true })
  sourceRunId?: string | null;

  @ManyToOne(() => CourseRun, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'sourceRunId' })
  sourceRun?: CourseRun | null;

  @Column({ default: false })
  isActive: boolean;

  @Column({ nullable: true })
  createdBy?: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @OneToMany(() => CourseVersion, (version) => version.courseRun)
  versions: CourseVersion[];

  @OneToMany(() => Enrollment, (enrollment) => enrollment.courseRun)
  enrollments: Enrollment[];

  @OneToMany(() => CourseGroup, (group) => group.courseRun)
  groups: CourseGroup[];

  @OneToMany(() => LearningMaterial, (material) => material.courseRun)
  learningMaterials: LearningMaterial[];

  @OneToMany(() => Task, (task) => task.courseRun)
  tasks: Task[];

  @OneToMany(() => GroupTaskProgress, (progress) => progress.courseRun)
  groupTaskProgress: GroupTaskProgress[];

  @OneToMany(() => Assignment, (assignment) => assignment.courseRun)
  assignments: Assignment[];

  @OneToMany(() => CourseResult, (result) => result.courseRun)
  results: CourseResult[];
}
