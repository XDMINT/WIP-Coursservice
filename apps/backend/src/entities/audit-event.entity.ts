import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export enum AuditEventType {
  COURSE_CREATED = 'COURSE_CREATED',
  COURSE_UPDATED = 'COURSE_UPDATED',
  COURSE_RUN_CREATED = 'COURSE_RUN_CREATED',
  COURSE_RUN_ACTIVATED = 'COURSE_RUN_ACTIVATED',
  CONTENT_VERSION_CREATED = 'CONTENT_VERSION_CREATED',
  CONTENT_VERSION_ACTIVATED = 'CONTENT_VERSION_ACTIVATED',
  CONTENT_VERSION_DELETED = 'CONTENT_VERSION_DELETED',
  CONTENT_VERSION_ARCHIVED = 'CONTENT_VERSION_ARCHIVED',
  MATERIAL_CREATED = 'MATERIAL_CREATED',
  MATERIAL_UPDATED = 'MATERIAL_UPDATED',
  MATERIAL_DELETED = 'MATERIAL_DELETED',
  TASK_CREATED = 'TASK_CREATED',
  TASK_UPDATED = 'TASK_UPDATED',
  TASK_DELETED = 'TASK_DELETED',
  STUDENT_ENROLLED = 'STUDENT_ENROLLED',
  STUDENT_REMOVED = 'STUDENT_REMOVED',
  TASK_STARTED = 'TASK_STARTED',
  TASK_SUBMITTED = 'TASK_SUBMITTED',
  PROGRESS_UPDATED = 'PROGRESS_UPDATED',
  TASK_COMPLETED = 'TASK_COMPLETED',
  TASK_FAILED = 'TASK_FAILED',
  ASSESSMENT_SUBMITTED = 'ASSESSMENT_SUBMITTED',
  ASSESSMENT_MANUALLY_GRADED = 'ASSESSMENT_MANUALLY_GRADED',
  ASSESSMENT_AUTO_EVALUATED = 'ASSESSMENT_AUTO_EVALUATED',
  ASSESSMENT_RESET = 'ASSESSMENT_RESET',
}

@Index('idx_audit_events_course_created', ['courseId', 'createdAt'])
@Index('idx_audit_events_run_created', ['courseRunId', 'createdAt'])
@Index('idx_audit_events_type_created', ['eventType', 'createdAt'])
@Entity('audit_events')
export class AuditEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  eventType: AuditEventType;

  @Column({ nullable: true })
  actorUserId?: string | null;

  @Column({ nullable: true })
  actorRole?: string | null;

  @Column({ type: 'uuid', nullable: true })
  courseId?: string | null;

  @Column({ type: 'uuid', nullable: true })
  courseRunId?: string | null;

  @Column({ type: 'uuid', nullable: true })
  courseVersionId?: string | null;

  @Column({ nullable: true })
  entityType?: string | null;

  @Column({ nullable: true })
  entityId?: string | null;

  @Column({ type: 'text' })
  summary: string;

  @Column({ type: 'jsonb', nullable: true })
  metadataJson?: Record<string, unknown> | null;

  @Column({ nullable: true })
  requestId?: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
