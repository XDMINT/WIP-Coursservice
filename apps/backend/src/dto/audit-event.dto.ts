import { AuditEvent, AuditEventType } from '../entities/audit-event.entity';

export type AuditEventListQueryDto = {
  eventType?: AuditEventType | string;
  courseRunId?: string;
  from?: string;
  to?: string;
  limit?: string | number;
};

export type AuditEventResponseDto = {
  id: string;
  eventType: AuditEventType;
  actorUserId?: string | null;
  actorRole?: string | null;
  courseId?: string | null;
  courseRunId?: string | null;
  courseVersionId?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  summary: string;
  metadataJson?: Record<string, unknown> | null;
  requestId?: string | null;
  createdAt: string;
};

export const mapAuditEventToDto = (event: AuditEvent): AuditEventResponseDto => ({
  id: event.id,
  eventType: event.eventType,
  actorUserId: event.actorUserId,
  actorRole: event.actorRole,
  courseId: event.courseId,
  courseRunId: event.courseRunId,
  courseVersionId: event.courseVersionId,
  entityType: event.entityType,
  entityId: event.entityId,
  summary: event.summary,
  metadataJson: event.metadataJson,
  requestId: event.requestId,
  createdAt: event.createdAt instanceof Date
    ? event.createdAt.toISOString()
    : String(event.createdAt),
});
