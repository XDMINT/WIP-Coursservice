import { randomUUID } from 'crypto';
import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

import { getRequestActor } from './request-actor';
import { runWithRequestContext } from './request-context';

export type RequestWithContext = Request & {
  requestId?: string;
};

const firstHeaderValue = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

const normalizeRequestId = (value: string | undefined): string =>
  value && value.trim().length > 0 ? value.trim() : randomUUID();

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(request: RequestWithContext, response: Response, next: NextFunction): void {
    const requestId = normalizeRequestId(
      firstHeaderValue(request.headers['x-request-id']) ??
        firstHeaderValue(request.headers['x-correlation-id']),
    );
    const actor = getRequestActor(request);

    request.requestId = requestId;
    response.setHeader('X-Request-ID', requestId);

    runWithRequestContext(
      {
        requestId,
        actorUserId: actor.userId,
        actorRole: actor.globalRoles[0],
      },
      next,
    );
  }
}
