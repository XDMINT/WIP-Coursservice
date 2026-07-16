import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { getCurrentRequestContext } from './common/request-context';
import { AuditEvent, AuditEventType } from './entities/audit-event.entity';

export type RecordAuditEventInput = {
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
};

export type AuditEventListOptions = {
  courseId: string;
  courseRunId?: string;
  eventType?: string;
  from?: Date;
  to?: Date;
  limit: number;
};

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(
    @InjectRepository(AuditEvent)
    private readonly auditEventRepository: Repository<AuditEvent>,
  ) {}

  async recordEvent(input: RecordAuditEventInput): Promise<void> {
    const requestContext = getCurrentRequestContext();
    const auditEvent = this.auditEventRepository.create({
      eventType: input.eventType,
      actorUserId: input.actorUserId ?? requestContext?.actorUserId ?? null,
      actorRole: input.actorRole ?? requestContext?.actorRole ?? null,
      courseId: input.courseId ?? null,
      courseRunId: input.courseRunId ?? null,
      courseVersionId: input.courseVersionId ?? null,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      summary: input.summary,
      metadataJson: input.metadataJson ?? null,
      requestId: input.requestId ?? requestContext?.requestId ?? null,
    });

    try {
      await this.auditEventRepository.save(auditEvent);
    } catch (error) {
      this.logger.error(
        JSON.stringify({
          level: 'error',
          event: 'audit_event_write_failed',
          eventType: input.eventType,
          courseId: input.courseId,
          entityType: input.entityType,
          entityId: input.entityId,
          requestId: input.requestId ?? requestContext?.requestId,
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
        }),
      );
    }
  }

  async listEvents(options: AuditEventListOptions): Promise<AuditEvent[]> {
    const query = this.auditEventRepository
      .createQueryBuilder('auditEvent')
      .where('auditEvent.courseId = :courseId', { courseId: options.courseId })
      .orderBy('auditEvent.createdAt', 'DESC')
      .limit(options.limit);

    if (options.courseRunId) {
      query.andWhere('auditEvent.courseRunId = :courseRunId', {
        courseRunId: options.courseRunId,
      });
    }

    if (options.eventType) {
      query.andWhere('auditEvent.eventType = :eventType', {
        eventType: options.eventType,
      });
    }

    if (options.from) {
      query.andWhere('auditEvent.createdAt >= :from', {
        from: options.from,
      });
    }

    if (options.to) {
      query.andWhere('auditEvent.createdAt <= :to', {
        to: options.to,
      });
    }

    return query.getMany();
  }
}
