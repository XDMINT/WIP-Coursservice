import { HttpStatus } from '@nestjs/common';

export type ApiErrorCode =
  | 'BAD_REQUEST'
  | 'COURSE_ACCESS_DENIED'
  | 'COURSE_NOT_FOUND'
  | 'COURSE_RUN_NOT_FOUND'
  | 'FORBIDDEN'
  | 'MATERIAL_ACCESS_DENIED'
  | 'MATERIAL_NOT_FOUND'
  | 'STORAGE_ERROR'
  | 'TASK_ACCESS_DENIED'
  | 'TASK_ASSESSMENT_DENIED'
  | 'TASK_LOCKED'
  | 'TASK_NOT_FOUND'
  | 'UNAUTHORIZED'
  | 'VALIDATION_FAILED';

export class ApiError extends Error {
  constructor(
    public readonly statusCode: HttpStatus,
    public readonly code: ApiErrorCode,
    message: string,
    public readonly details?: string[],
  ) {
    super(message);
  }
}

export class ApiValidationError extends ApiError {
  constructor(message: string, details?: string[]) {
    super(HttpStatus.BAD_REQUEST, 'VALIDATION_FAILED', message, details);
  }
}

export class ApiUnauthorizedError extends ApiError {
  constructor(message = 'Authentication is required') {
    super(HttpStatus.UNAUTHORIZED, 'UNAUTHORIZED', message);
  }
}

export class ApiForbiddenError extends ApiError {
  constructor(message = 'Access denied', code: ApiErrorCode = 'FORBIDDEN') {
    super(HttpStatus.FORBIDDEN, code, message);
  }
}

export class ApiNotFoundError extends ApiError {
  constructor(message = 'Resource not found', code: ApiErrorCode = 'COURSE_NOT_FOUND') {
    super(HttpStatus.NOT_FOUND, code, message);
  }
}
