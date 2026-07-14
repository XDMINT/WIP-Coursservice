import { describe, expect, it, vi } from 'vitest'

import courseResultService, { CoursePassStatus, CourseResultSource, formatPassStatus, formatPercentage, formatPoints, formatResultSource } from '../courseResult.service'
import { apiClient } from '../apiClient'

vi.mock('../apiClient', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn()
  }
}))

describe('courseResultService', () => {
  it('loads own course results through the central API client', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: {
        courseId: 'course-id',
        enrollmentId: 'enrollment-3',
        passStatus: CoursePassStatus.NOT_ASSESSED,
        studentId: '3'
      }
    })

    await expect(courseResultService.getMyResult('course-id')).resolves.toMatchObject({
      passStatus: CoursePassStatus.NOT_ASSESSED,
      studentId: '3'
    })
    expect(apiClient.get).toHaveBeenCalledWith('/courses/course-id/results/me')
  })

  it('lists course results with filters and pagination', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: {
        items: [],
        page: 2,
        pageSize: 10,
        total: 0
      }
    })

    await courseResultService.listResults('course-id', {
      page: 2,
      pageSize: 10,
      passStatus: CoursePassStatus.PASSED,
      source: CourseResultSource.MANUAL_OVERRIDE
    })

    expect(apiClient.get).toHaveBeenCalledWith('/courses/course-id/results', {
      params: {
        page: 2,
        pageSize: 10,
        passStatus: CoursePassStatus.PASSED,
        source: CourseResultSource.MANUAL_OVERRIDE
      }
    })
  })

  it('lists course results for a selected run', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: {
        items: [],
        page: 1,
        pageSize: 10,
        total: 0
      }
    })

    await courseResultService.listResults('course-id', { page: 1, pageSize: 10 }, 'run-id')

    expect(apiClient.get).toHaveBeenCalledWith('/courses/course-id/runs/run-id/results', {
      params: {
        page: 1,
        pageSize: 10,
        passStatus: undefined,
        source: undefined
      }
    })
  })

  it('stores manual results and triggers recalculation endpoints', async () => {
    vi.mocked(apiClient.put).mockResolvedValueOnce({ data: { studentId: '3' } })
    vi.mocked(apiClient.post)
      .mockResolvedValueOnce({ data: { studentId: '3' } })
      .mockResolvedValueOnce({ data: { items: [] } })

    await courseResultService.saveManualResult('course-id', '3', {
      manualGrade: '2.0',
      passStatus: CoursePassStatus.PASSED
    })
    await courseResultService.recalculateResult('course-id', '3')
    await courseResultService.recalculateAll('course-id')

    expect(apiClient.put).toHaveBeenCalledWith('/courses/course-id/results/3/manual', {
      manualGrade: '2.0',
      passStatus: CoursePassStatus.PASSED
    })
    expect(apiClient.post).toHaveBeenCalledWith('/courses/course-id/results/3/recalculate')
    expect(apiClient.post).toHaveBeenCalledWith('/courses/course-id/results/recalculate')
  })

  it('formats result labels without relying only on colors', () => {
    expect(formatPassStatus(CoursePassStatus.PASSED)).toBe('Bestanden')
    expect(formatPassStatus(CoursePassStatus.FAILED)).toBe('Nicht bestanden')
    expect(formatResultSource(CourseResultSource.MANUAL_OVERRIDE)).toBe('Manuell überschrieben')
    expect(formatPoints(12.5)).toBe('12,5')
    expect(formatPercentage(50)).toBe('50 %')
  })
})
