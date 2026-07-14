import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ApiError } from './api-errors';
import { getCurrentRequestContext } from './request-context';
import { getRequestActor } from './request-actor';
import { RequestWithContext } from './request-context.middleware';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const http = host.switchToHttp();
    const response = http.getResponse<Response>();
    const request = http.getRequest<RequestWithContext>();
    const normalizedException = this.normalizeException(exception);
    const status = normalizedException.getStatus();
    const exceptionResponse = normalizedException.getResponse();
    const message = this.getResponseMessage(exceptionResponse, normalizedException);
    const code = this.getResponseCode(exception, exceptionResponse, status);
    const requestContext = getCurrentRequestContext();
    const requestId = requestContext?.requestId ?? request.requestId;

    this.logUnexpectedError(exception, request, status, requestId);

    response.status(status).json({
      statusCode: status,
      code,
      error: this.getResponseError(exceptionResponse, status),
      message,
      details:
        exception instanceof ApiError && exception.details
          ? exception.details
          : undefined,
      path: request.url,
      requestId,
      timestamp: new Date().toISOString(),
    });
  }

  private logUnexpectedError(
    exception: unknown,
    request: Request,
    status: number,
    requestId?: string,
  ): void {
    if (
      status < HttpStatus.INTERNAL_SERVER_ERROR &&
      (exception instanceof HttpException || exception instanceof ApiError)
    ) {
      return;
    }

    const actor = getRequestActor(request);
    const requestContext = getCurrentRequestContext();
    const error = exception instanceof Error ? exception : undefined;

    this.logger.error(
      JSON.stringify({
        level: 'error',
        event: 'unexpected_error',
        errorType: error?.name ?? typeof exception,
        message: error?.message ?? 'Unknown error',
        stack: error?.stack,
        path: (request.originalUrl ?? request.url ?? '').split('?')[0],
        requestId,
        userId: requestContext?.actorUserId ?? actor.userId,
        role: requestContext?.actorRole ?? actor.globalRoles[0],
      }),
    );
  }

  private normalizeException(exception: unknown): HttpException {
    if (exception instanceof ApiError) {
      return new HttpException(
        {
          code: exception.code,
          details: exception.details,
          error: HttpStatus[exception.statusCode],
          message: exception.message,
        },
        exception.statusCode,
      );
    }

    if (exception instanceof HttpException) {
      return exception;
    }

    if (exception instanceof Error) {
      const message = exception.message || 'Internal server error';
      const lowerMessage = message.toLowerCase();

      if (lowerMessage.includes('not found')) {
        return new NotFoundException(message);
      }

      if (
        lowerMessage.includes('invalid') ||
        lowerMessage.includes('required') ||
        lowerMessage.includes('file too large') ||
        lowerMessage.includes('unexpected field')
      ) {
        return new BadRequestException(message);
      }
    }

    return new InternalServerErrorException('Internal server error');
  }

  private getResponseError(exceptionResponse: unknown, status: number): string {
    return typeof exceptionResponse === 'object' &&
      exceptionResponse !== null &&
      'error' in exceptionResponse
      ? String(exceptionResponse.error)
      : HttpStatus[status];
  }

  private getResponseMessage(
    exceptionResponse: unknown,
    normalizedException: HttpException,
  ): string | string[] {
    return typeof exceptionResponse === 'object' &&
      exceptionResponse !== null &&
      'message' in exceptionResponse
      ? (exceptionResponse.message as string | string[])
      : normalizedException.message;
  }

  private getResponseCode(
    exception: unknown,
    exceptionResponse: unknown,
    status: number,
  ): string {
    if (exception instanceof ApiError) {
      return exception.code;
    }

    if (
      typeof exceptionResponse === 'object' &&
      exceptionResponse !== null &&
      'code' in exceptionResponse
    ) {
      return String(exceptionResponse.code);
    }

    if (status === HttpStatus.BAD_REQUEST) {
      return 'BAD_REQUEST';
    }

    if (status === HttpStatus.UNAUTHORIZED) {
      return 'UNAUTHORIZED';
    }

    if (status === HttpStatus.FORBIDDEN) {
      return 'FORBIDDEN';
    }

    if (status === HttpStatus.NOT_FOUND) {
      return 'NOT_FOUND';
    }

    return 'INTERNAL_SERVER_ERROR';
  }
}
