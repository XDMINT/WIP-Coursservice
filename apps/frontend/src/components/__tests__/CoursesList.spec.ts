// @vitest-environment jsdom
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import CoursesList from '../CoursesList.vue'

const courseServiceMock = vi.hoisted(() => ({
  enrollCourse: vi.fn(),
  getAvailableCourses: vi.fn(),
  getEnrolledCourses: vi.fn()
}))

const routerMock = vi.hoisted(() => ({
  push: vi.fn()
}))

vi.mock('@/services/course.service', () => ({
  default: courseServiceMock
}))

vi.mock('@/services/apiErrors', () => ({
  getApiErrorMessage: (error: Error) => error.message
}))

vi.mock('@/stores/authUserStore', () => ({
  useAuthUserStore: () => ({
    auth: {
      user: {
        id: 3
      }
    }
  })
}))

vi.mock('vue-router', () => ({
  useRouter: () => routerMock
}))

const passThroughStub = {
  template: '<div><slot /></div>'
}

const buttonStub = {
  emits: ['click'],
  props: ['icon', 'prependIcon', 'loading'],
  template: '<button type="button" @click="$emit(\'click\', $event)"><span>{{ icon }}</span><span>{{ prependIcon }}</span><slot /></button>'
}

const courseFixture = (id: string, name: string, overrides: Record<string, unknown> = {}) => ({
  course: {
    id,
    name,
    description: '',
    active: true,
    creationDate: '',
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
    ...overrides
  },
  member: false,
  canEnroll: true
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
        'v-data-table': {
          props: ['items'],
          template:
            '<div class="data-table"><slot v-if="items.length === 0" name="no-data" /><div v-for="item in items" :key="item.course.id" class="row"><span>{{ item.course.name }}</span><slot name="item.course.active" :item="item" /><slot name="item.membershipRole" :item="item" /><slot name="item.actions" :item="item" /></div></div>'
        },
        'v-empty-state': {
          props: ['title', 'text'],
          template: '<div class="empty">{{ title }} {{ text }}</div>'
        },
        'v-icon': passThroughStub,
        'v-progress-linear': {
          template: '<div class="loading" />'
        },
        'v-row': passThroughStub,
        'v-text-field': passThroughStub
      }
    }
  })

const findButtonByText = (wrapper: ReturnType<typeof mount>, text: string) => wrapper.findAll('button').find((button) => button.text().includes(text))

describe('CoursesList', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows a loading state while course catalogs are requested', async () => {
    courseServiceMock.getEnrolledCourses.mockReturnValueOnce(new Promise(() => undefined))
    courseServiceMock.getAvailableCourses.mockReturnValueOnce(new Promise(() => undefined))

    const wrapper = mountList()
    ;(wrapper.vm as unknown as { loadCourses: () => void }).loadCourses()
    await nextTick()

    expect(wrapper.find('.loading').exists()).toBe(true)
  })

  it('shows empty states for both course sections', async () => {
    courseServiceMock.getEnrolledCourses.mockResolvedValueOnce([])
    courseServiceMock.getAvailableCourses.mockResolvedValueOnce([])

    const wrapper = mountList()
    ;(wrapper.vm as unknown as { loadCourses: () => void }).loadCourses()
    await flushPromises()

    expect(wrapper.text()).toContain('Meine Kurse')
    expect(wrapper.text()).toContain('Verfügbare Kurse')
    expect(wrapper.text()).toContain('Keine eigenen Kurse vorhanden')
    expect(wrapper.text()).toContain('Keine verfügbaren Kurse')
  })

  it('shows API errors while loading course catalogs', async () => {
    courseServiceMock.getEnrolledCourses.mockRejectedValueOnce(new Error('Kein Zugriff'))
    courseServiceMock.getAvailableCourses.mockResolvedValueOnce([])

    const wrapper = mountList()
    ;(wrapper.vm as unknown as { loadCourses: () => void }).loadCourses()
    await flushPromises()

    expect(wrapper.text()).toContain('Kein Zugriff')
  })

  it('renders enrolled and available courses separately and enrolls directly when no key is required', async () => {
    courseServiceMock.getEnrolledCourses.mockResolvedValueOnce([
      {
        ...courseFixture('enrolled-course', 'Eingeschriebener Kurs'),
        member: true,
        membershipRole: 'STUDENT',
        canEnroll: false
      }
    ])
    courseServiceMock.getAvailableCourses.mockResolvedValueOnce([
      courseFixture('available-course', 'Freier Kurs')
    ])
    courseServiceMock.enrollCourse.mockResolvedValueOnce({})

    const wrapper = mountList()
    ;(wrapper.vm as unknown as { loadCourses: () => void }).loadCourses()
    await flushPromises()

    expect(wrapper.text()).toContain('Eingeschriebener Kurs')
    expect(wrapper.text()).toContain('Freier Kurs')

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
})
