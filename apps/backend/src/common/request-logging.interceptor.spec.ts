import { of } from 'rxjs';
import { Logger } from '@nestjs/common';

import { RequestLoggingInterceptor } from './request-logging.interceptor';
import { runWithRequestContext } from './request-context';

describe('RequestLoggingInterceptor', () => {
  it('logs request metadata without tokens or request bodies', (done) => {
    const logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    const interceptor = new RequestLoggingInterceptor();
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          body: {
            password: 'secret-password',
          },
          headers: {
            authorization: 'Bearer secret-token',
            'x-user-id': '3',
            'x-user-roles': 'STUDENT',
          },
          method: 'POST',
          originalUrl: '/api/courses/course-id/enroll?key=secret',
          query: {},
          requestId: 'request-id',
          url: '/api/courses/course-id/enroll?key=secret',
        }),
        getResponse: () => ({
          statusCode: 201,
        }),
      }),
    };
    const next = {
      handle: () => of({ ok: true }),
    };

    runWithRequestContext(
      { requestId: 'request-id', actorUserId: '3', actorRole: 'STUDENT' },
      () => {
        interceptor.intercept(context as any, next as any).subscribe({
          complete: () => {
            const serializedLogs = logSpy.mock.calls.flat().join('\n');

            expect(serializedLogs).toContain('http_request');
            expect(serializedLogs).toContain('/api/courses/course-id/enroll');
            expect(serializedLogs).not.toContain('secret-token');
            expect(serializedLogs).not.toContain('secret-password');
            expect(serializedLogs).not.toContain('authorization');

            logSpy.mockRestore();
            done();
          },
        });
      },
    );
  });
});
