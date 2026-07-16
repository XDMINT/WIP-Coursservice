import { beforeEach, describe, expect, it, vi } from 'vitest'

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
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loads a course through the central API client', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: {
        id: 'course-id',
        title: 'Database Systems',
        description: 'Relational modeling',
        semester: 'Summer 2026',
        status: 'PUBLISHED',
        recurrenceType: 'SEMESTER',
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
        recurrenceType: 'SEMESTER',
        creationDate: '',
        updatedAt: '',
        semester: {
          id: 0,
          name: 'Summer 2026',
          startDate: '2000-01-01',
          endDate: '2099-12-31'
        },
        owner: 42,
        keyPassword: 'join',
        requiresEnrollmentKey: true,
        location: 'Friedberg',
        status: 'PUBLISHED'
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
          recurrence_type: 'YEARLY',
          status: 'PUBLISHED',
          owner_id: 42
        },
        currentRun: {
          id: 'run-2026',
          courseId: 'course-id',
          label: '2026',
          startDate: '2026-01-01',
          endDate: '2026-12-31',
          status: 'PUBLISHED',
          isActive: true
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
        name: 'Database Systems',
        recurrenceType: 'YEARLY'
      }),
      currentRun: expect.objectContaining({
        id: 'run-2026',
        label: '2026'
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

  it('loads enrolled and available course catalogs from dedicated endpoints', async () => {
    vi.mocked(apiClient.get)
      .mockResolvedValueOnce({
        data: [
          {
            id: 'enrolled-course',
            title: 'Enrolled',
            status: 'PUBLISHED',
            enrolled: true,
            membershipRole: 'STUDENT',
            canEnroll: false
          }
        ]
      })
      .mockResolvedValueOnce({
        data: [
          {
            id: 'available-course',
            title: 'Available',
            status: 'PUBLISHED',
            enrolled: false,
            canEnroll: true
          }
        ]
      })

    await expect(courseService.getEnrolledCourses()).resolves.toEqual([
      expect.objectContaining({
        canEnroll: false,
        member: true,
        membershipRole: 'STUDENT'
      })
    ])
    await expect(courseService.getAvailableCourses()).resolves.toEqual([
      expect.objectContaining({
        canEnroll: true,
        member: false
      })
    ])
    expect(apiClient.get).toHaveBeenNthCalledWith(1, '/courses/enrolled')
    expect(apiClient.get).toHaveBeenNthCalledWith(2, '/courses/available')
  })

  it('also accepts list responses wrapped in a data property', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: {
        data: [
          {
            id: 'enrolled-course',
            title: 'Enrolled',
            status: 'PUBLISHED',
            enrolled: true,
            membershipRole: 'STUDENT',
            canEnroll: false
          }
        ]
      }
    })

    await expect(courseService.getEnrolledCourses()).resolves.toEqual([
      expect.objectContaining({
        member: true,
        membershipRole: 'STUDENT'
      })
    ])
  })

  it('reports a clear error when a list endpoint returns an object', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: {
        id: 'course-id',
        title: 'Not a list'
      }
    })

    await expect(courseService.getAvailableCourses()).rejects.toThrow(
      'Verfügbare Kurse lieferte keine Liste.',
    )
  })

  it('enrolls through the actor-aware enrollment endpoint', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({ status: 201 })

    await expect(courseService.enrollCourse('course-id', 'join')).resolves.toMatchObject({
      status: 201
    })
    expect(apiClient.post).toHaveBeenCalledWith('/courses/course-id/enroll', { key: 'join' })
  })

  it('normalizes course version responses', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: [
        {
          id: 'version-2',
          course_id: 'course-id',
          course_run_id: 'run-1',
          courseRunLabel: 'Sommersemester 2026',
          version_number: 2,
          label: 'Version 2',
          content: { course: { title: 'Demo' } },
          change_summary: 'Aktualisiert',
          status: 'PUBLISHED',
          sourceVersionId: 'old-version',
          sourceVersionNumber: 1,
          sourceVersionLabel: 'Initial',
          sourceRunLabel: 'Sommersemester 2025',
          created_at: '2026-01-01T10:00:00.000Z',
          created_by: '1',
          is_active: true
        }
      ]
    })

    await expect(courseService.listCourseVersions('course-id')).resolves.toEqual([
      {
        id: 'version-2',
        courseId: 'course-id',
        courseRunId: 'run-1',
        courseRunLabel: 'Sommersemester 2026',
        versionNumber: 2,
        label: 'Version 2',
        content: { course: { title: 'Demo' } },
        changeSummary: 'Aktualisiert',
        status: 'PUBLISHED',
        sourceVersionId: 'old-version',
        sourceVersionNumber: 1,
        sourceVersionLabel: 'Initial',
        sourceRunLabel: 'Sommersemester 2025',
        createdAt: '2026-01-01T10:00:00.000Z',
        createdBy: '1',
        isActive: true
      }
    ])
    expect(apiClient.get).toHaveBeenCalledWith('/courses/course-id/versions')
  })

  it('uses run-specific course version endpoints and template lists when requested', async () => {
    vi.mocked(apiClient.get)
      .mockResolvedValueOnce({
        data: [
          {
            id: 'version-1',
            courseId: 'course-id',
            courseRunId: 'run-1',
            courseRunLabel: 'Sommersemester 2026',
            versionNumber: 1,
            content: {},
            isActive: false
          }
        ]
      })
      .mockResolvedValueOnce({
        data: [
          {
            id: 'template-1',
            courseId: 'course-id',
            courseRunId: 'run-old',
            courseRunLabel: 'Sommersemester 2025',
            versionNumber: 2,
            content: {},
            isActive: true
          }
        ]
      })

    await expect(courseService.listCourseVersions('course-id', 'run-1')).resolves.toEqual([
      expect.objectContaining({
        courseRunId: 'run-1',
        id: 'version-1'
      })
    ])
    await expect(courseService.listCourseVersionTemplates('course-id')).resolves.toEqual([
      expect.objectContaining({
        courseRunLabel: 'Sommersemester 2025',
        id: 'template-1'
      })
    ])
    expect(apiClient.get).toHaveBeenNthCalledWith(1, '/courses/course-id/runs/run-1/versions')
    expect(apiClient.get).toHaveBeenNthCalledWith(2, '/courses/course-id/content-version-templates')
  })

  it('creates and activates course versions through course-specific endpoints', async () => {
    vi.mocked(apiClient.post)
      .mockResolvedValueOnce({
        data: {
          id: 'version-3',
          courseId: 'course-id',
          versionNumber: 3,
          content: {},
          changeSummary: 'Neu',
          createdAt: '2026-01-01T10:00:00.000Z',
          createdBy: '1',
          isActive: true
        }
      })
      .mockResolvedValueOnce({
        data: {
          id: 'version-1',
          courseId: 'course-id',
          versionNumber: 1,
          content: {},
          isActive: true
        }
      })

    await expect(courseService.createCourseVersion('course-id', 'Neu', true, 'run-1')).resolves.toMatchObject({
      id: 'version-3',
      isActive: true,
      versionNumber: 3
    })
    await expect(courseService.activateCourseVersion('course-id', 'version-1')).resolves.toMatchObject({
      id: 'version-1',
      isActive: true
    })
    expect(apiClient.post).toHaveBeenNthCalledWith(1, '/courses/course-id/runs/run-1/versions', {
      activate: true,
      changeSummary: 'Neu'
    })
    expect(apiClient.post).toHaveBeenNthCalledWith(2, '/courses/course-id/versions/version-1/activate')
  })

  it('maps and manages course runs through course-specific endpoints', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: [
        {
          id: 'run-2',
          course_id: 'course-id',
          label: 'Wintersemester 2026/27',
          start_date: '2026-10-01',
          end_date: '2027-03-31',
          status: 'PUBLISHED',
          is_active: true,
          enrollmentCount: 2,
          materialCount: 4,
          taskCount: 3
        }
      ]
    })
    vi.mocked(apiClient.post)
      .mockResolvedValueOnce({
        data: {
          id: 'run-3',
          courseId: 'course-id',
          label: 'Sommersemester 2027',
          status: 'PUBLISHED',
          isActive: false
        }
      })
      .mockResolvedValueOnce({
        data: {
          id: 'run-2',
          courseId: 'course-id',
          label: 'Wintersemester 2026/27',
          status: 'PUBLISHED',
          isActive: true
        }
      })
    vi.mocked(apiClient.delete).mockResolvedValueOnce({
      data: {
        action: 'ARCHIVED',
        reason: 'Historische Daten vorhanden',
        run: {
          id: 'run-1',
          courseId: 'course-id',
          label: 'Sommersemester 2026',
          status: 'ARCHIVED',
          isActive: false
        }
      }
    })

    await expect(courseService.listCourseRuns('course-id')).resolves.toEqual([
      expect.objectContaining({
        id: 'run-2',
        courseId: 'course-id',
        label: 'Wintersemester 2026/27',
        startDate: '2026-10-01',
        isActive: true,
        materialCount: 4
      })
    ])
    await expect(
      courseService.createCourseRun('course-id', {
        label: 'Sommersemester 2027',
        activate: false
      })
    ).resolves.toMatchObject({
      id: 'run-3',
      label: 'Sommersemester 2027'
    })
    await expect(courseService.activateCourseRun('course-id', 'run-2')).resolves.toMatchObject({
      id: 'run-2',
      isActive: true
    })
    await expect(courseService.deleteOrArchiveCourseRun('course-id', 'run-1')).resolves.toMatchObject({
      action: 'ARCHIVED',
      run: expect.objectContaining({
        id: 'run-1',
        status: 'ARCHIVED'
      })
    })
    expect(apiClient.get).toHaveBeenCalledWith('/courses/course-id/runs')
    expect(apiClient.post).toHaveBeenNthCalledWith(1, '/courses/course-id/runs/next', {
      label: 'Sommersemester 2027',
      activate: false
    })
    expect(apiClient.post).toHaveBeenNthCalledWith(2, '/courses/course-id/runs/run-2/activate')
    expect(apiClient.delete).toHaveBeenCalledWith('/courses/course-id/runs/run-1')
  })

  it('deletes course versions through the selected run endpoint', async () => {
    vi.mocked(apiClient.delete).mockResolvedValueOnce({ status: 204 })

    await expect(courseService.deleteCourseVersion('course-id', 'run-1', 'version-1')).resolves.toBeUndefined()

    expect(apiClient.delete).toHaveBeenCalledWith('/courses/course-id/runs/run-1/versions/version-1')
  })

  it('loads and updates the course run plan', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: {
        recurrenceType: 'SEMESTER',
        currentRun: {
          id: 'run-1',
          courseId: 'course-id',
          label: 'Sommersemester 2026',
          status: 'PUBLISHED',
          isActive: true
        },
        nextRun: {
          label: 'Wintersemester 2026/27',
          startDate: '2026-10-01',
          endDate: '2027-03-31'
        },
        templateStrategy: 'ACTIVE_VERSION_OF_CURRENT_RUN',
        templateVersion: {
          id: 'version-2',
          courseId: 'course-id',
          courseRunId: 'run-1',
          courseRunLabel: 'Sommersemester 2026',
          versionNumber: 2,
          content: {},
          status: 'PUBLISHED',
          createdAt: '2026-04-02T10:00:00.000Z',
          createdBy: '1',
          isActive: true
        },
        regularPlanningAvailable: true
      }
    })
    vi.mocked(apiClient.post).mockResolvedValueOnce({
      data: {
        recurrenceType: 'SEMESTER',
        currentRun: {
          id: 'run-1',
          courseId: 'course-id',
          label: 'Sommersemester 2026',
          status: 'PUBLISHED',
          isActive: true
        },
        nextRun: null,
        templateStrategy: 'SPECIFIC_VERSION',
        templateVersion: null,
        regularPlanningAvailable: true
      }
    })

    await expect(courseService.getCourseRunPlan('course-id')).resolves.toMatchObject({
      currentRun: expect.objectContaining({
        label: 'Sommersemester 2026'
      }),
      nextRun: {
        endDate: '2027-03-31',
        label: 'Wintersemester 2026/27',
        startDate: '2026-10-01'
      },
      templateVersion: expect.objectContaining({
        id: 'version-2'
      })
    })
    await expect(
      courseService.updateCourseRunPlanTemplate('course-id', {
        strategy: 'SPECIFIC_VERSION',
        sourceVersionId: 'version-2'
      })
    ).resolves.toMatchObject({
      templateStrategy: 'SPECIFIC_VERSION'
    })

    expect(apiClient.get).toHaveBeenCalledWith('/courses/course-id/run-plan')
    expect(apiClient.post).toHaveBeenCalledWith('/courses/course-id/run-plan/template', {
      strategy: 'SPECIFIC_VERSION',
      sourceVersionId: 'version-2'
    })
  })

  it('creates special course runs through the exception endpoint', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({
      data: {
        id: 'run-special',
        courseId: 'course-id',
        label: 'Sonderdurchlauf',
        status: 'PUBLISHED',
        isActive: false
      }
    })

    await expect(
      courseService.createSpecialCourseRun('course-id', {
        label: 'Sonderdurchlauf',
        startDate: '2027-05-01'
      })
    ).resolves.toMatchObject({
      id: 'run-special',
      label: 'Sonderdurchlauf'
    })

    expect(apiClient.post).toHaveBeenCalledWith('/courses/course-id/runs/special', {
      label: 'Sonderdurchlauf',
      startDate: '2027-05-01'
    })
  })

  it('loads members for a selected course run', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: [
        {
          id: 'enrollment-id',
          role: 'STUDENT',
          userId: '3'
        }
      ]
    })

    await expect(courseService.getCourseMembers('course-id', 'run-id')).resolves.toEqual({
      data: [
        expect.objectContaining({
          role: CourseRoles.STUDENT,
          user: expect.objectContaining({
            id: 3,
            username: 'user-3'
          })
        })
      ]
    })
    expect(apiClient.get).toHaveBeenCalledWith('/courses/course-id/runs/run-id/enrollments')
  })

  it('loads audit events through course and run scoped endpoints', async () => {
    vi.mocked(apiClient.get)
      .mockResolvedValueOnce({
        data: [
          {
            id: 'audit-1',
            event_type: 'COURSE_CREATED',
            actor_user_id: '1',
            actor_role: 'TEACHER',
            course_id: 'course-id',
            course_run_id: 'run-id',
            course_version_id: 'version-id',
            entity_type: 'course',
            entity_id: 'course-id',
            summary: 'Kurs erstellt',
            request_id: 'request-id',
            created_at: '2026-07-14T12:00:00.000Z'
          }
        ]
      })
      .mockResolvedValueOnce({
        data: []
      })

    await expect(courseService.listAuditEvents('course-id')).resolves.toEqual([
      {
        id: 'audit-1',
        eventType: 'COURSE_CREATED',
        actorUserId: '1',
        actorRole: 'TEACHER',
        courseId: 'course-id',
        courseRunId: 'run-id',
        courseVersionId: 'version-id',
        entityType: 'course',
        entityId: 'course-id',
        summary: 'Kurs erstellt',
        metadataJson: undefined,
        requestId: 'request-id',
        createdAt: '2026-07-14T12:00:00.000Z'
      }
    ])
    await expect(
      courseService.listAuditEvents('course-id', {
        courseRunId: 'run-id',
        eventType: 'TASK_CREATED',
        limit: 25
      })
    ).resolves.toEqual([])

    expect(apiClient.get).toHaveBeenNthCalledWith(1, '/courses/course-id/audit-events', {
      params: {
        eventType: undefined,
        from: undefined,
        to: undefined,
        limit: undefined
      }
    })
    expect(apiClient.get).toHaveBeenNthCalledWith(2, '/courses/course-id/runs/run-id/audit-events', {
      params: {
        eventType: 'TASK_CREATED',
        from: undefined,
        to: undefined,
        limit: 25
      }
    })
  })
})
