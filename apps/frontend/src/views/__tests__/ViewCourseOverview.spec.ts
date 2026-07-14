// @vitest-environment jsdom
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import ViewCourseOverview from '../ViewCourseOverview.vue'
import CourseRoles from '@/enums/CourseRoles'

const courseServiceMock = vi.hoisted(() => ({
  changeUserRole: vi.fn(),
  getCourseContext: vi.fn(),
  getCourseMembers: vi.fn(),
  listCourseVersions: vi.fn(),
  leaveCourse: vi.fn()
}))

const routerPushMock = vi.hoisted(() => vi.fn())

vi.mock('@/services/course.service', () => ({
  default: courseServiceMock
}))

vi.mock('@/services/apiErrors', () => ({
  getApiErrorMessage: (error: Error) => error.message,
  normalizeApiError: (error: Error) => ({ kind: 'error', message: error.message })
}))

vi.mock('@/stores/authUserStore', () => ({
  useAuthUserStore: () => ({
    auth: {
      user: {
        id: 1
      }
    }
  })
}))

vi.mock('vue-router', () => ({
  useRoute: () => ({
    params: {
      id: 'course-id'
    },
    path: '/course/course-id'
  }),
  useRouter: () => ({
    push: routerPushMock
  })
}))

const passThroughStub = {
  template: '<div><slot /></div>'
}

const buttonStub = {
  emits: ['click'],
  template: '<button type="button" @click="$emit(\'click\')"><slot /></button>'
}

const courseContext = (role: CourseRoles, permissions: Record<string, boolean>) => ({
  course: {
    id: 'course-id',
    name: 'Webtechnologien',
    description: 'Demo course',
    recurrenceType: 'SEMESTER'
  },
  currentRun: {
    id: 'run-2',
    courseId: 'course-id',
    label: 'Wintersemester 2026/27',
    status: 'PUBLISHED',
    isActive: true
  },
  currentVersion: {
    id: 'version-2',
    courseId: 'course-id',
    courseRunId: 'run-2',
    versionNumber: 2,
    label: 'Version 2',
    content: {},
    status: 'PUBLISHED',
    createdAt: '2026-01-01T10:00:00.000Z',
    createdBy: '1',
    isActive: true
  },
  role,
  permissions
})

const mountView = () =>
  mount(ViewCourseOverview, {
    global: {
      stubs: {
        CourseResultsPanel: {
          props: ['courseRunId', 'readOnly'],
          template: '<div class="results-panel">results {{ courseRunId }} {{ readOnly ? "readonly" : "editable" }}</div>'
        },
        CourseRunsPanel: {
          emits: ['selected', 'updated'],
          props: ['selectedRunId'],
          data: () => ({
            oldRun: {
              id: 'run-1',
              courseId: 'course-id',
              label: 'Sommersemester 2026',
              status: 'ARCHIVED',
              isActive: false
            }
          }),
          template: '<div class="runs-panel"><button type="button" class="select-old" @click="$emit(\'selected\', oldRun)">Alter Durchlauf</button></div>'
        },
        CourseVersionsPanel: {
          template: '<div class="versions-panel">Inhaltsversionen</div>'
        },
        DialogConfirmVue: passThroughStub,
        DialogCreateCourse: passThroughStub,
        LearningMaterialsPanel: {
          props: ['courseRunId', 'readOnly'],
          template: '<div class="materials-panel">materials {{ courseRunId }} {{ readOnly ? "readonly" : "editable" }}</div>'
        },
        LearningProcessPanel: {
          props: ['courseRunId', 'readOnly'],
          template: '<div class="process-panel">tasks {{ courseRunId }} {{ readOnly ? "readonly" : "editable" }}</div>'
        },
        'v-alert': {
          template: '<div class="alert"><slot /></div>'
        },
        'v-breadcrumbs': passThroughStub,
        'v-btn': buttonStub,
        'v-card': passThroughStub,
        'v-card-text': passThroughStub,
        'v-chip': passThroughStub,
        'v-data-table': passThroughStub,
        'v-divider': passThroughStub,
        'v-empty-state': passThroughStub,
        'v-icon': passThroughStub,
        'v-pagination': passThroughStub,
        'v-progress-linear': passThroughStub,
        'v-select': passThroughStub,
        'v-snackbar': passThroughStub,
        'v-tab': passThroughStub,
        'v-tabs': passThroughStub,
        'v-tabs-window': passThroughStub,
        'v-tabs-window-item': passThroughStub,
        'v-tooltip': passThroughStub,
        VTooltip: passThroughStub
      }
    }
  })

describe('ViewCourseOverview', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    courseServiceMock.getCourseMembers.mockResolvedValue({ data: [] })
    courseServiceMock.listCourseVersions.mockResolvedValue([
      {
        id: 'version-1',
        courseId: 'course-id',
        courseRunId: 'run-1',
        versionNumber: 1,
        label: 'Version 1',
        content: {},
        status: 'PUBLISHED',
        createdAt: '2026-01-01T10:00:00.000Z',
        createdBy: '1',
        isActive: true
      }
    ])
  })

  it('hides run and version history for students', async () => {
    courseServiceMock.getCourseContext.mockResolvedValueOnce(
      courseContext(CourseRoles.STUDENT, {
        'course.content.read': true,
        'course.content.manage': false,
        'course.manage': false,
        'course.members.manage': false,
        'course.results.own.read': true,
        'course.results.all.read': false
      })
    )

    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.text()).not.toContain('Durchläufe')
    expect(wrapper.text()).not.toContain('Inhaltsversionen')
    expect(wrapper.find('.runs-panel').exists()).toBe(false)
    expect(wrapper.find('.materials-panel').text()).toContain('editable')
  })

  it('passes the selected historical run to content panels for teachers', async () => {
    courseServiceMock.getCourseContext.mockResolvedValueOnce(
      courseContext(CourseRoles.TEACHER, {
        'course.content.read': true,
        'course.content.manage': true,
        'course.manage': true,
        'course.members.manage': true,
        'course.results.own.read': true,
        'course.results.all.read': true
      })
    )

    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.text()).toContain('Durchläufe')
    expect(wrapper.text()).toContain('materials run-2 editable')

    await wrapper.find('.select-old').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Sommersemester 2026 wird als historischer Durchlauf angezeigt.')
    expect(wrapper.text()).toContain('materials run-1 readonly')
    expect(wrapper.text()).toContain('tasks run-1 readonly')
    expect(wrapper.text()).toContain('results run-1 readonly')
    expect(courseServiceMock.getCourseMembers).toHaveBeenLastCalledWith('course-id', 'run-1')
  })
})
