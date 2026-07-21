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

import { Task } from './task.entity';

export enum TaskDependencyCondition {
  COMPLETED = 'COMPLETED',
  PASSED = 'PASSED',
  FAILED = 'FAILED',
  SUBMITTED = 'SUBMITTED',
}

export enum TaskDependencyOperator {
  ALL_OF = 'ALL_OF',
  ANY_OF = 'ANY_OF',
}

@Index('uq_task_dependency_target_prerequisite', ['taskId', 'prerequisiteTaskId'], {
  unique: true,
})
@Entity('task_dependency')
export class TaskDependency {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  taskId: string;

  @ManyToOne(() => Task, (task) => task.dependencies, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'taskId' })
  task: Task;

  @Column({ type: 'uuid' })
  prerequisiteTaskId: string;

  @ManyToOne(() => Task, (task) => task.dependentTasks, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'prerequisiteTaskId' })
  prerequisiteTask: Task;

  @Column({ type: 'varchar', default: TaskDependencyCondition.PASSED })
  condition: TaskDependencyCondition;

  @Column({ type: 'varchar', default: TaskDependencyOperator.ALL_OF })
  operator: TaskDependencyOperator;

  @Column({ nullable: true })
  createdBy?: string | null;

  @Column({ nullable: true })
  updatedBy?: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
