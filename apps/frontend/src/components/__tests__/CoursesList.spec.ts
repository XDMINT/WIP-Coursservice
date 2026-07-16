// @vitest-environment jsdom
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import CoursesList from '../CoursesList.vue'

const courseServiceMock = vi.hoisted(() => ({
  enrollCourse: vi.fn(),
  getAvailableCourses: vi.fn(),
  getEnrolledCourses: vi.fn(),
  listCourseVersions: vi.fn()
}))

const learningTaskServiceMock = vi.hoisted(() => ({
  getMyLearningPath: vi.fn()
}))

const authUserStoreMock = vi.hoisted(() => ({
  auth: {
    user: {
      id: 3,
      roles: ['ROLE_USER']
    }
  },
  user: {
    id: 3,
    roles: ['ROLE_USER']
  }
}))

const routerMock = vi.hoisted(() => ({
  push: vi.fn()
}))

vi.mock('@/services/course.service', () => ({
  default: courseServiceMock
}))

vi.mock('@/services/learningTask.service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/learningTask.service')>()

  return {
    ...actual,
    default: learningTaskServiceMock
  }
})

vi.mock('@/services/apiErrors', () => ({
  getApiErrorMessage: (error: Error) => error.message
}))

vi.mock('@/stores/authUserStore', () => ({
  useAuthUserStore: () => authUserStoreMock
}))

vi.mock('vue-router', () => ({
  useRouter: () => routerMock
}))

const passThroughStub = {
  template: '<div><slot /></div>'
}

const buttonStub = {
  emits: ['click'],
  props: ['icon', 'loading', 'prependIcon', 'size', 'variant'],
  template: '<button type="button" @click="$emit(\'click\', $event)"><span>{{ icon }}</span><span>{{ prependIcon }}</span><slot /></button>'
}

const courseFixture = (id: string, name: string, overrides: Record<string, unknown> = {}) => ({
  course: {
    id,
    name,
    description: '',
    active: true,
    status: 'PUBLISHED',
    creationDate: '2026-01-10T10:00:00.000Z',
    updatedAt: '2026-07-01T10:00:00.000Z',
    semester: {
      id: 0,
      name: 'Demo',
      startDate: '2000-01-01',
      endDate: '2099-12-31'
    },
    owner: 1,
    keyPassword: '',
    requiresEnrollmentKey: false,
    location: 'Friedberg',
    currentRun: {
      id: 'run-1',
      label: 'Sommer 2026',
      status: 'PUBLISHED',
      isActive: true,
      enrollmentCount: 12,
      materialCount: 3,
      taskCount: 5,
      versionCount: 2
    },
    ...overrides
  },
  member: false,
  canEnroll: true
})

const learningPathFixture = (overrides: Record<string, unknown> = {}) => ({
  courseId: 'enrolled-course',
  studentId: '3',
  totalTasks: 2,
  completedTasks: 1,
  inProgressTasks: 0,
  availableTasks: 1,
  failedTasks: 0,
  lockedTasks: 0,
  progressPercentage: 50,
  tasks: [
    {
      id: 'task-1',
      courseId: 'enrolled-course',
      title: 'Grundlagen kennenlernen',
      description: '',
      type: 'LESSON',
      order: 1,
      unlockMode: 'IMMEDIATE',
      gradingMode: 'SELF_CONFIRMATION',
      feedbackRequired: false,
      allowRetries: false,
      isPublished: true,
      status: 'COMPLETED',
      completionPercentage: 100,
      locked: false,
      assessment: {
        feedback: 'Gut gemacht',
        status: 'PASSED'
      }
    },
    {
      id: 'task-2',
      courseId: 'enrolled-course',
      title: 'Grundlagen anwenden',
      description: '',
      type: 'ASSIGNMENT',
      order: 2,
      unlockMode: 'AUTOMATIC',
      gradingMode: 'MANUAL',
      feedbackRequired: true,
      allowRetries: true,
      isPublished: true,
      status: 'AVAILABLE',
      completionPercentage: 0,
      locked: false
    }
  ],
  ...overrides
})

const mountList = () =>
  mount(CoursesList, {
    global: {
      stubs: {
        'v-alert': {
          template: '<div class="alert"><slot /></div>'
        },
        'v-btn': buttonStub,
        'v-checkbox': passThroughStub,
        'v-chip': passThroughStub,
        'v-empty-state': {
          props: ['title', 'text'],
          template: '<div class="empty">{{ title }} {{ text }}</div>'
        },
        'v-icon': passThroughStub,
        'v-progress-linear': {
          props: ['modelValue', 'indeterminate'],
          template: '<div class="loading" />'
        },
        'v-text-field': passThroughStub
      }
    }
  })

const findButtonByText = (wrapper: ReturnType<typeof mount>, text: string) =>
  wrapper.findAll('button').find((button) => button.text().includes(text))

const resetAuthUser = (roles = ['ROLE_USER']) => {
  authUserStoreMock.auth.user = {
    id: 3,
    roles
  }
  authUserStoreMock.user = authUserStoreMock.auth.user
}

describe('CoursesList', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetAuthUser()
  })

  it('shows a loading state while course catalogs are requested', async () => {
    courseServiceMock.getEnrolledCourses.mockReturnValueOnce(new Promise(() => undefined))
    courseServiceMock.getAvailableCourses.mockReturnValueOnce(new Promise(() => undefined))

    const wrapper = mountList()
    ;(wrapper.vm as unknown as { loadCourses: () => void }).loadCourses()
    await nextTick()

    expect(wrapper.find('.loading').exists()).toBe(true)
  })

  it('shows student empty states for active, available and completed courses', async () => {
    courseServiceMock.getEnrolledCourses.mockResolvedValueOnce([])
    courseServiceMock.getAvailableCourses.mockResolvedValueOnce([])

    const wrapper = mountList()
    ;(wrapper.vm as unknown as { loadCourses: () => void }).loadCourses()
    await flushPromises()

    expect(wrapper.text()).toContain('Meine Kurse')
    expect(wrapper.text()).toContain('Verfügbare Kurse')
    expect(wrapper.text()).toContain('Abgeschlossene Kurse')
    expect(wrapper.text()).toContain('Keine aktiven Kurse')
    expect(wrapper.text()).toContain('Keine verfügbaren Kurse')
    expect(wrapper.text()).toContain('Noch keine abgeschlossenen Kurse')
  })

  it('shows API errors while loading course catalogs', async () => {
    courseServiceMock.getEnrolledCourses.mockRejectedValueOnce(new Error('Kein Zugriff'))
    courseServiceMock.getAvailableCourses.mockResolvedValueOnce([])

    const wrapper = mountList()
    ;(wrapper.vm as unknown as { loadCourses: () => void }).loadCourses()
    await flushPromises()

    expect(wrapper.text()).toContain('Kein Zugriff')
  })

  it('renders a learning-oriented student overview and enrolls directly when no key is required', async () => {
    courseServiceMock.getEnrolledCourses.mockResolvedValueOnce([
      {
        ...courseFixture('enrolled-course', 'Eingeschriebener Kurs', {
          description: 'Ein Kurs zum Weiterlernen.',
          currentRun: {
            id: 'run-1',
            label: 'Sommer 2026',
            status: 'PUBLISHED',
            isActive: true,
            materialCount: 2,
            taskCount: 2
          }
        }),
        member: true,
        membershipRole: 'STUDENT',
        canEnroll: false
      }
    ])
    courseServiceMock.getAvailableCourses.mockResolvedValueOnce([
      courseFixture('available-course', 'Freier Kurs')
    ])
    learningTaskServiceMock.getMyLearningPath.mockResolvedValueOnce(learningPathFixture())
    courseServiceMock.enrollCourse.mockResolvedValueOnce({})

    const wrapper = mountList()
    ;(wrapper.vm as unknown as { loadCourses: () => void }).loadCourses()
    await flushPromises()

    expect(wrapper.text()).toContain('Eingeschriebener Kurs')
    expect(wrapper.text()).toContain('Weiterlernen')
    expect(wrapper.text()).toContain('Nächster Schritt: Grundlagen anwenden')
    expect(wrapper.text()).toContain('1 von 2 Lernschritten abgeschlossen')
    expect(wrapper.text()).toContain('Neue Materialien verfügbar')
    expect(wrapper.text()).toContain('Feedback ansehen')
    expect(wrapper.text()).not.toContain('Kursverwaltung')
    expect(wrapper.text()).not.toContain('Teilnehmende')

    await findButtonByText(wrapper, 'Einschreiben')?.trigger('click')
    await flushPromises()

    expect(courseServiceMock.enrollCourse).toHaveBeenCalledWith('available-course')
    expect(routerMock.push).toHaveBeenCalledWith('/course/available-course')
  })

  it('routes to the signup view when an enrollment key is required', async () => {
    courseServiceMock.getEnrolledCourses.mockResolvedValueOnce([])
    courseServiceMock.getAvailableCourses.mockResolvedValueOnce([
      courseFixture('key-course', 'Schlüsselkurs', {
        requiresEnrollmentKey: true
      })
    ])

    const wrapper = mountList()
    ;(wrapper.vm as unknown as { loadCourses: () => void }).loadCourses()
    await flushPromises()

    await findButtonByText(wrapper, 'Einschreiben')?.trigger('click')

    expect(courseServiceMock.enrollCourse).not.toHaveBeenCalled()
    expect(routerMock.push).toHaveBeenCalledWith('/course/key-course/signup')
  })

  it('shows enrollment errors without moving the course locally', async () => {
    courseServiceMock.getEnrolledCourses.mockResolvedValueOnce([])
    courseServiceMock.getAvailableCourses.mockResolvedValueOnce([
      courseFixture('available-course', 'Freier Kurs')
    ])
    courseServiceMock.enrollCourse.mockRejectedValueOnce(new Error('Kurs nicht verfügbar'))

    const wrapper = mountList()
    ;(wrapper.vm as unknown as { loadCourses: () => void }).loadCourses()
    await flushPromises()

    await findButtonByText(wrapper, 'Einschreiben')?.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Kurs nicht verfügbar')
    expect(wrapper.text()).toContain('Freier Kurs')
    expect(routerMock.push).not.toHaveBeenCalledWith('/course/available-course')
  })

  it('renders the compact organizational overview for teacher memberships', async () => {
    courseServiceMock.getEnrolledCourses.mockResolvedValueOnce([
      {
        ...courseFixture('teacher-course', 'Verwalteter Kurs', {
          description: 'Organisatorischer Kurs.',
          currentRun: {
            id: 'run-1',
            label: 'Sommer 2026',
            status: 'PUBLISHED',
            isActive: true,
            enrollmentCount: 12,
            materialCount: 3,
            taskCount: 8,
            versionCount: 2
          }
        }),
        member: true,
        membershipRole: 'TEACHER',
        canEnroll: false
      }
    ])
    courseServiceMock.getAvailableCourses.mockResolvedValueOnce([])
    courseServiceMock.listCourseVersions.mockResolvedValueOnce([
      {
        id: 'version-2',
        courseId: 'teacher-course',
        versionNumber: 2,
        label: 'Aktive Sommer-Version',
        content: {},
        changeSummary: '',
        status: 'PUBLISHED',
        createdAt: '2026-07-01T10:00:00.000Z',
        createdBy: 'teacher',
        isActive: true
      }
    ])

    const wrapper = mountList()
    ;(wrapper.vm as unknown as { loadCourses: () => void }).loadCourses()
    await flushPromises()

    expect(wrapper.text()).toContain('Kursverwaltung')
    expect(wrapper.text()).toContain('Verwalteter Kurs')
    expect(wrapper.text()).toContain('Sommer 2026')
    expect(wrapper.text()).toContain('Aktive Sommer-Version')
    expect(wrapper.text()).toContain('12')
    expect(wrapper.text()).toContain('8 Aufgaben · 3 Materialien')
    expect(wrapper.text()).toContain('Verwalten')
    expect(wrapper.text()).toContain('Teilnehmende')
    expect(wrapper.text()).toContain('Inhalte bearbeiten')
    expect(wrapper.text()).toContain('Bewertungen')
    expect(wrapper.text()).toContain('Durchläufe')
    expect(wrapper.text()).not.toContain('Weiterlernen')
    expect(learningTaskServiceMock.getMyLearningPath).not.toHaveBeenCalled()
  })
})
