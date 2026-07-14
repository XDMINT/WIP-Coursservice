import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { CourseGroup } from './course-group.entity';
import { CourseRun } from './course-run.entity';
import { CourseVersion } from './course-version.entity';
import { Task } from './task.entity';
import type { TaskProgressStatus } from './task-progress.entity';

@Index('uq_group_task_progress_run_task_group', ['courseRunId', 'taskId', 'groupId'], {
  unique: true,
})
@Index('idx_group_task_progress_run_group', ['courseRunId', 'groupId'])
@Index('idx_group_task_progress_task', ['taskId'])
@Entity('group_task_progress')
export class GroupTaskProgress {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  courseRunId: string;

  @ManyToOne(() => CourseRun, (run) => run.groupTaskProgress, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'courseRunId' })
  courseRun: CourseRun;

  @Column({ type: 'uuid' })
  courseVersionId: string;

  @ManyToOne(() => CourseVersion, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'courseVersionId' })
  courseVersion: CourseVersion;

  @Column({ type: 'uuid' })
  taskId: string;

  @ManyToOne(() => Task, (task) => task.groupProgress, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'taskId' })
  task: Task;

  @Column({ type: 'uuid' })
  groupId: string;

  @ManyToOne(() => CourseGroup, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'groupId' })
  group: CourseGroup;

  @Column({ type: 'varchar', default: 'AVAILABLE' })
  status: TaskProgressStatus;

  @Column({ type: 'jsonb', nullable: true })
  progressData?: Record<string, unknown> | null;

  @Column({ type: 'timestamptz', nullable: true })
  startedAt?: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  submittedAt?: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  completedAt?: Date | null;

  @Column({ nullable: true })
  createdBy?: string | null;

  @Column({ nullable: true })
  updatedBy?: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
