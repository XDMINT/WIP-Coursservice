import { ArgumentsHost } from '@nestjs/common';

import { ApiValidationError } from './api-errors';
import { HttpExceptionFilter } from './http-exception.filter';

describe('HttpExceptionFilter', () => {
  it('returns a consistent error response for domain errors', () => {
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    const host = {
      switchToHttp: () => ({
        getRequest: () => ({ url: '/api/courses/course-id' }),
        getResponse: () => ({ status }),
      }),
    } as unknown as ArgumentsHost;

    new HttpExceptionFilter().catch(
      new ApiValidationError('Course title is required', ['title must not be empty']),
      host,
    );

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'VALIDATION_FAILED',
        details: ['title must not be empty'],
        error: 'BAD_REQUEST',
        message: 'Course title is required',
        path: '/api/courses/course-id',
        statusCode: 400,
        timestamp: expect.any(String),
      }),
    );
  });
});
