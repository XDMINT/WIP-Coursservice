// @vitest-environment jsdom
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import CourseGroupsPanel from '../CourseGroupsPanel.vue'
import { TaskAssessmentStatus, TaskGradingMode, TaskProgressStatus, TaskUnlockMode, TaskWorkMode } from '@/services/learningTask.service'

const courseServiceMock = vi.hoisted(() => ({
  addStudyGroupMember: vi.fn(),
  createStudyGroup: vi.fn(),
  deleteStudyGroup: vi.fn(),
  getCourseMembers: vi.fn(),
  getMyStudyGroup: vi.fn(),
  listStudyGroups: vi.fn(),
  removeStudyGroupMember: vi.fn(),
  updateStudyGroup: vi.fn()
}))

const learningTaskServiceMock = vi.hoisted(() => ({
  assessGroupTaskManually: vi.fn(),
  listTasks: vi.fn()
}))

vi.mock('@/services/course.service', () => ({
  default: courseServiceMock
}))

vi.mock('@/services/learningTask.service', async () => {
  const actual = await vi.importActual<typeof import('@/services/learningTask.service')>('@/services/learningTask.service')

  return {
    ...actual,
    default: learningTaskServiceMock
  }
})

vi.mock('@/services/apiErrors', () => ({
  getApiErrorMessage: (error: Error) => error.message
}))

const passThroughStub = {
  template: '<div><slot /></div>'
}

const buttonStub = {
  emits: ['click'],
  template: '<button type="button" @click="$emit(\'click\')"><slot /></button>'
}

const fieldStub = {
  props: ['label'],
  template: '<label>{{ label }}</label>'
}

const group = {
  id: 'group-1',
  courseId: 'course-id',
  courseRunId: 'run-1',
  name: 'Gruppe A',
  description: 'Demo-Gruppe',
  isActive: true,
  memberCount: 1,
  members: [
    {
      studentId: '3',
      role: 'MEMBER' as const
    }
  ],
  taskProgress: [
    {
      id: 'group-progress-1',
      taskId: 'task-2',
      groupId: 'group-1',
      status: TaskProgressStatus.SUBMITTED,
      assessment: {
        id: 'assessment-1',
        taskId: 'task-2',
        groupId: 'group-1',
        status: TaskAssessmentStatus.PENDING_REVIEW,
        points: null,
        maxPoints: 10,
        passed: null,
        feedback: null
      }
    }
  ]
}

const groupTask = {
  id: 'task-2',
  courseId: 'course-id',
  courseRunId: 'run-1',
  courseVersionId: 'version-1',
  title: 'Gruppenaufgabe',
  description: 'Gemeinsam bearbeiten',
  type: 'DEMO_TASK',
  order: 2,
  unlockMode: TaskUnlockMode.IMMEDIATE,
  gradingMode: TaskGradingMode.MANUAL,
  workMode: TaskWorkMode.GROUP,
  maxPoints: 10,
  passThreshold: 50,
  feedbackRequired: true,
  allowRetries: false,
  isPublished: true
}

const mountPanel = (canManage: boolean) =>
  mount(CourseGroupsPanel, {
    props: {
      canManage,
      courseId: 'course-id',
      courseRunId: 'run-1'
    },
    global: {
      stubs: {
        'v-alert': passThroughStub,
        'v-btn': buttonStub,
        'v-card': passThroughStub,
        'v-card-actions': passThroughStub,
        'v-card-text': passThroughStub,
        'v-card-title': passThroughStub,
        'v-chip': passThroughStub,
        'v-dialog': {
          props: ['modelValue'],
          template: '<div v-if="modelValue" class="dialog"><slot /></div>'
        },
        'v-empty-state': {
          props: ['title', 'text'],
          template: '<div class="empty">{{ title }} {{ text }}</div>'
        },
        'v-icon': passThroughStub,
        'v-progress-linear': {
          template: '<div class="loading">loading</div>'
        },
        'v-select': fieldStub,
        'v-textarea': fieldStub,
        'v-text-field': fieldStub,
        'v-tooltip': passThroughStub
      }
    }
  })

const findButtonByText = (wrapper: ReturnType<typeof mount>, text: string) =>
  wrapper.findAll('button').find((button) => button.text().includes(text))

describe('CourseGroupsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    courseServiceMock.listStudyGroups.mockResolvedValue([group])
    learningTaskServiceMock.listTasks.mockResolvedValue([groupTask])
    courseServiceMock.getCourseMembers.mockResolvedValue({
      data: [
        {
          user: {
            id: 3,
            username: 'Student 3'
          },
          role: 'STUDENT'
        }
      ]
    })
  })

  it('shows the teacher group management and can submit a group assessment', async () => {
    courseServiceMock.listStudyGroups.mockResolvedValueOnce([group])
    learningTaskServiceMock.assessGroupTaskManually.mockResolvedValueOnce({
      id: 'assessment-1',
      courseRunId: 'run-1',
      courseVersionId: 'version-1',
      taskId: 'task-2',
      assessmentTargetType: 'GROUP',
      groupId: 'group-1',
      status: TaskAssessmentStatus.PASSED,
      passed: true,
      gradingMode: TaskGradingMode.MANUAL
    })

    const wrapper = mountPanel(true)
    await flushPromises()

    expect(wrapper.text()).toContain('Gruppenverwaltung')
    expect(wrapper.text()).toContain('Gruppe A')
    expect(wrapper.text()).toContain('Student 3')
    expect(wrapper.text()).toContain('Gruppenaufgabe')

    await findButtonByText(wrapper, 'Bewerten')?.trigger('click')
    await flushPromises()
    await findButtonByText(wrapper, 'Bewertung speichern')?.trigger('click')
    await flushPromises()

    expect(learningTaskServiceMock.assessGroupTaskManually).toHaveBeenCalledWith(
      'course-id',
      'run-1',
      'task-2',
      'group-1',
      {
        feedback: null,
        maxPoints: 10,
        passed: true,
        points: 10
      }
    )
  })

  it('shows the required hint for students without a group', async () => {
    courseServiceMock.getMyStudyGroup.mockResolvedValueOnce(null)

    const wrapper = mountPanel(false)
    await flushPromises()

    expect(wrapper.text()).toContain('Du bist noch keiner Gruppe zugeordnet. Bitte wende dich an die Lehrperson.')
    expect(wrapper.text()).not.toContain('Gruppenverwaltung')
  })

  it('shows the own group and group assessment for students', async () => {
    courseServiceMock.getMyStudyGroup.mockResolvedValueOnce({
      ...group,
      taskProgress: [
        {
          ...group.taskProgress[0],
          status: TaskProgressStatus.COMPLETED,
          assessment: {
            ...group.taskProgress[0].assessment,
            status: TaskAssessmentStatus.PASSED,
            passed: true
          }
        }
      ]
    })

    const wrapper = mountPanel(false)
    await flushPromises()

    expect(wrapper.text()).toContain('Meine Gruppe')
    expect(wrapper.text()).toContain('Gruppe A')
    expect(wrapper.text()).toContain('Gruppenaufgabe')
    expect(wrapper.text()).toContain('Bestanden')
  })

  it('shows deletion errors for groups with progress', async () => {
    courseServiceMock.listStudyGroups.mockResolvedValueOnce([group])
    courseServiceMock.deleteStudyGroup.mockRejectedValueOnce(
      new Error('Diese Gruppe kann nicht gelöscht werden, da bereits Fortschritt oder Bewertungen vorhanden sind.'),
    )

    const wrapper = mountPanel(true)
    await flushPromises()
    await findButtonByText(wrapper, 'Löschen')?.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Diese Gruppe kann nicht gelöscht werden')
  })
})
