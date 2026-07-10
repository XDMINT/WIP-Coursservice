import { describe, expect, it, vi } from 'vitest'

import courseService from '../course.service'
import { apiClient } from '../apiClient'
import CourseRoles from '@/enums/CourseRoles'

vi.mock('../apiClient', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn()
  }
}))

describe('courseService', () => {
  it('loads a course through the central API client', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: {
        id: 'course-id',
        title: 'Database Systems',
        description: 'Relational modeling',
        semester: 'Summer 2026',
        status: 'PUBLISHED',
        owner_id: 42,
        key_password: 'join',
        location: 'Friedberg'
      }
    })

    await expect(courseService.getCourse('course-id')).resolves.toEqual({
      data: {
        id: 'course-id',
        name: 'Database Systems',
        description: 'Relational modeling',
        active: true,
        creationDate: '',
        semester: {
          id: 0,
          name: 'Summer 2026',
          startDate: '2000-01-01',
          endDate: '2099-12-31'
        },
        owner: 42,
        keyPassword: 'join',
        requiresEnrollmentKey: true,
        location: 'Friedberg'
      }
    })
    expect(apiClient.get).toHaveBeenCalledWith('/courses/course-id')
  })

  it('loads course context with normalized permissions', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: {
        course: {
          id: 'course-id',
          title: 'Database Systems',
          description: 'Relational modeling',
          semester: 'Summer 2026',
          status: 'PUBLISHED',
          owner_id: 42
        },
        membership: {
          userId: '42',
          role: 'TEACHER'
        },
        permissions: {
          'course.content.read': true,
          'course.content.manage': true,
          'course.manage': true,
          'course.members.manage': true,
          'course.results.own.read': true,
          'course.results.all.read': true
        }
      }
    })

    await expect(courseService.getCourseContext('course-id')).resolves.toEqual({
      course: expect.objectContaining({
        id: 'course-id',
        name: 'Database Systems'
      }),
      role: CourseRoles.TEACHER,
      permissions: expect.objectContaining({
        'course.manage': true,
        'course.members.manage': true
      })
    })
    expect(apiClient.get).toHaveBeenCalledWith('/courses/course-id/context')
  })

  it('keeps legacy OWNER role responses compatible as TEACHER', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: 'OWNER' })

    await expect(courseService.getUserRoleInCourse(42, 'course-id')).resolves.toBe(CourseRoles.TEACHER)
  })
})
