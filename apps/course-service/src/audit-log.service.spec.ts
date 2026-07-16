import { Logger } from '@nestjs/common';

import { AuditLogService } from './audit-log.service';
import { runWithRequestContext } from './common/request-context';
import { AuditEventType } from './entities/audit-event.entity';

describe('AuditLogService', () => {
  it('adds the current request id and actor context to audit events', async () => {
    const repository = {
      create: jest.fn((event) => event),
      save: jest.fn().mockResolvedValue(undefined),
    };
    const service = new AuditLogService(repository as any);

    await runWithRequestContext(
      { requestId: 'request-123', actorUserId: '1', actorRole: 'TEACHER' },
      () =>
        service.recordEvent({
          eventType: AuditEventType.COURSE_CREATED,
          courseId: 'course-id',
          entityType: 'course',
          entityId: 'course-id',
          summary: 'Kurs erstellt',
        }),
    );

    expect(repository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        actorRole: 'TEACHER',
        actorUserId: '1',
        requestId: 'request-123',
      }),
    );
  });

  it('does not throw when audit persistence fails', async () => {
    const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const repository = {
      create: jest.fn((event) => event),
      save: jest.fn().mockRejectedValue(new Error('database unavailable')),
    };
    const service = new AuditLogService(repository as any);

    await expect(
      service.recordEvent({
        eventType: AuditEventType.TASK_CREATED,
        courseId: 'course-id',
        entityType: 'task',
        entityId: 'task-id',
        summary: 'Aufgabe erstellt',
      }),
    ).resolves.toBeUndefined();

    errorSpy.mockRestore();
  });
});
