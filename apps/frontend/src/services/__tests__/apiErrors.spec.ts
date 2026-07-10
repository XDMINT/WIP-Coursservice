import { describe, expect, it } from 'vitest'

import { normalizeApiError } from '../apiErrors'

const createHttpError = (status: number, data: unknown = {}) =>
  ({
    message: 'Request failed',
    response: {
      status,
      data
    }
  }) as Error

describe('apiErrors', () => {
  it.each([
    [401, 'UNAUTHORIZED', 'unauthorized'],
    [403, 'COURSE_ACCESS_DENIED', 'forbidden'],
    [404, 'COURSE_NOT_FOUND', 'not-found'],
    [400, 'VALIDATION_FAILED', 'validation']
  ])('normalizes %s responses', (status, code, kind) => {
    const error = normalizeApiError(
      createHttpError(status as number, {
        code,
        message: 'Backend message',
        details: ['field is required']
      })
    )

    expect(error.kind).toBe(kind)
    expect(error.status).toBe(status)
    expect(error.code).toBe(code)
    expect(error.message).toBe('Backend message')
    expect(error.details).toEqual(['field is required'])
    expect(error.response?.status).toBe(status)
  })

  it('treats missing response metadata as a network error', () => {
    const error = normalizeApiError(new Error('Network Error'))

    expect(error.kind).toBe('network')
    expect(error.message).toBe('Network Error')
  })
})
