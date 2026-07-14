import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable, catchError, tap, throwError } from 'rxjs';

import { getCurrentRequestContext } from './request-context';
import { getRequestActor } from './request-actor';
import { RequestWithContext } from './request-context.middleware';

const pathWithoutQuery = (request: Request): string =>
  (request.originalUrl ?? request.url ?? '').split('?')[0];

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(RequestLoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<RequestWithContext>();
    const response = http.getResponse<Response>();
    const startedAt = Date.now();
    const actor = getRequestActor(request);

    const logRequest = (statusCode: number): void => {
      const requestContext = getCurrentRequestContext();

      this.logger.log(
        JSON.stringify({
          level: 'info',
          event: 'http_request',
          method: request.method,
          path: pathWithoutQuery(request),
          status: statusCode,
          durationMs: Date.now() - startedAt,
          userId: requestContext?.actorUserId ?? actor.userId,
          role: requestContext?.actorRole ?? actor.globalRoles[0],
          requestId: requestContext?.requestId ?? request.requestId,
        }),
      );
    };

    return next.handle().pipe(
      tap(() => logRequest(response.statusCode)),
      catchError((error: unknown) => {
        const statusCode =
          typeof error === 'object' &&
          error !== null &&
          'getStatus' in error &&
          typeof (error as { getStatus: () => number }).getStatus === 'function'
            ? (error as { getStatus: () => number }).getStatus()
            : typeof error === 'object' &&
                error !== null &&
                'statusCode' in error &&
                Number.isFinite(Number((error as { statusCode?: unknown }).statusCode))
              ? Number((error as { statusCode?: unknown }).statusCode)
            : 500;

        logRequest(statusCode);

        return throwError(() => error);
      }),
    );
  }
}
