// @vitest-environment jsdom
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import StudentCourseJourneyView from '../StudentCourseJourneyView.vue'
import { DARK_THEME_NAME, LIGHT_THEME_NAME } from '@/services/theme.service'

const courseServiceMock = vi.hoisted(() => ({
  getMyStudyGroup: vi.fn()
}))
const learningMaterialServiceMock = vi.hoisted(() => ({
  downloadMaterial: vi.fn(),
  listMaterials: vi.fn()
}))
const learningTaskServiceMock = vi.hoisted(() => ({
  getMyLearningPath: vi.fn(),
  mockEvaluateTask: vi.fn(),
  selfConfirmTask: vi.fn(),
  startGroupTask: vi.fn(),
  startTask: vi.fn(),
  submitGroupTask: vi.fn(),
  submitTask: vi.fn()
}))

vi.mock('@/services/course.service', () => ({
  default: courseServiceMock
}))

vi.mock('@/services/learningMaterial.service', () => ({
  default: learningMaterialServiceMock,
  LearningMaterialType: {
    DOCUMENT: 'DOCUMENT',
    EXTERNAL_LINK: 'EXTERNAL_LINK',
    OTHER_FILE: 'OTHER_FILE',
    PRESENTATION: 'PRESENTATION',
    VIDEO: 'VIDEO'
  },
  formatLearningMaterialFileSize: (size?: number) => (size == null ? '' : `${size} B`)
}))

vi.mock('@/services/learningTask.service', () => ({
  default: learningTaskServiceMock,
  TaskAssessmentStatus: {
    AUTO_EVALUATED: 'AUTO_EVALUATED',
    FAILED: 'FAILED',
    NOT_SUBMITTED: 'NOT_SUBMITTED',
    PASSED: 'PASSED',
    PENDING_REVIEW: 'PENDING_REVIEW',
    SUBMITTED: 'SUBMITTED'
  },
  TaskGradingMode: {
    AUTOMATIC_MOCK: 'AUTOMATIC_MOCK',
    MANUAL: 'MANUAL',
    NOT_GRADED: 'NOT_GRADED',
    SELF_CONFIRMATION: 'SELF_CONFIRMATION'
  },
  TaskProgressStatus: {
    AVAILABLE: 'AVAILABLE',
    COMPLETED: 'COMPLETED',
    FAILED: 'FAILED',
    IN_PROGRESS: 'IN_PROGRESS',
    LOCKED: 'LOCKED',
    SUBMITTED: 'SUBMITTED'
  },
  TaskWorkMode: {
    GROUP: 'GROUP',
    INDIVIDUAL: 'INDIVIDUAL'
  },
  formatTaskWorkMode: (mode?: string) => (mode === 'GROUP' ? 'Gruppenaufgabe' : 'Einzelaufgabe')
}))

vi.mock('@/services/apiErrors', () => ({
  getApiErrorMessage: (error: Error) => error.message
}))

const passThroughStub = {
  template: '<div><slot /></div>'
}
const buttonStub = {
  emits: ['click'],
  props: ['disabled', 'prependIcon'],
  template: '<button type="button" :disabled="disabled" @click="$emit(\'click\')"><span>{{ prependIcon }}</span><slot /></button>'
}
const textFieldStub = {
  emits: ['update:modelValue'],
  props: ['modelValue'],
  template: '<input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />'
}
const textAreaStub = {
  emits: ['update:modelValue'],
  props: ['modelValue'],
  template: '<textarea :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />'
}

const baseLearningPath = {
  availableTasks: 1,
  completedTasks: 1,
  courseId: 'course-id',
  failedTasks: 0,
  inProgressTasks: 0,
  lockedTasks: 1,
  progressPercentage: 33,
  studentId: '3',
  totalTasks: 3,
  tasks: [
    {
      id: 'task-1',
      allowRetries: true,
      assessment: {
        id: 'assessment-1',
        assessmentTargetType: 'INDIVIDUAL',
        courseRunId: 'run-1',
        courseVersionId: 'version-1',
        feedback: 'Gut gemacht.',
        gradingMode: 'SELF_CONFIRMATION',
        passed: true,
        status: 'PASSED',
        taskId: 'task-1'
      },
      completionPercentage: 100,
      courseId: 'course-id',
      description: 'Einstieg',
      feedbackRequired: false,
      gradingMode: 'SELF_CONFIRMATION',
      isPublished: true,
      locked: false,
      order: 1,
      status: 'COMPLETED',
      title: 'Grundlagen kennenlernen',
      type: 'DEMO_TASK',
      unlockMode: 'IMMEDIATE',
      workMode: 'INDIVIDUAL'
    },
    {
      id: 'task-2',
      allowRetries: true,
      assessment: null,
      completionPercentage: 0,
      courseId: 'course-id',
      description: 'Arbeite mit deiner Gruppe.',
      feedbackRequired: true,
      gradingMode: 'MANUAL',
      group: {
        id: 'group-1',
        name: 'Gruppe A',
        status: 'AVAILABLE'
      },
      isPublished: true,
      locked: false,
      maxPoints: 10,
      order: 2,
      status: 'AVAILABLE',
      title: 'Grundlagen anwenden',
      type: 'DEMO_TASK',
      unlockMode: 'AUTOMATIC',
      workMode: 'GROUP'
    },
    {
      id: 'task-3',
      allowRetries: true,
      assessment: null,
      completionPercentage: 0,
      courseId: 'course-id',
      description: 'Vertiefung',
      feedbackRequired: false,
      gradingMode: 'AUTOMATIC_MOCK',
      isPublished: true,
      locked: true,
      lockedReason: 'Schließe zuerst „Grundlagen anwenden“ ab.',
      order: 3,
      status: 'LOCKED',
      title: 'Automatische Demo-Bewertung auslösen',
      type: 'DEMO_TASK',
      unlockMode: 'AUTOMATIC',
      workMode: 'INDIVIDUAL'
    }
  ]
}

const materialsFixture = [
  {
    id: 'material-1',
    courseId: 'course-id',
    description: 'Material zur Gruppenaufgabe',
    fileSize: 1234,
    isPublished: true,
    locked: false,
    publicationStatus: 'PUBLISHED',
    releaseAfterTaskId: 'task-2',
    releaseMode: 'AFTER_TASK_COMPLETION',
    tags: [],
    title: 'Arbeitsblatt Gruppe',
    type: 'DOCUMENT',
    visibleForStudents: true
  },
  {
    id: 'material-2',
    courseId: 'course-id',
    description: 'Später sichtbar',
    isPublished: true,
    locked: true,
    lockedReason: 'Dieses Material wird freigeschaltet, sobald Aufgabe 2 abgeschlossen wurde.',
    publicationStatus: 'PUBLISHED',
    releaseAfterTaskId: 'task-3',
    releaseMode: 'AFTER_TASK_COMPLETION',
    tags: [],
    title: 'Vertiefungslösung',
    type: 'DOCUMENT',
    visibleForStudents: false
  },
  {
    id: 'material-3',
    courseId: 'course-id',
    description: 'Begriffe',
    isPublished: true,
    locked: false,
    publicationStatus: 'PUBLISHED',
    releaseMode: 'IMMEDIATE',
    tags: [],
    title: 'Glossar',
    type: 'EXTERNAL_LINK',
    url: 'https://example.com',
    visibleForStudents: true
  }
]

const mountJourney = () =>
  mount(StudentCourseJourneyView, {
    props: {
      courseDescription: 'Demo course',
      courseId: 'course-id',
      courseName: 'Webtechnologien',
      courseRunId: 'run-1',
      courseRunLabel: 'Wintersemester 2026/27'
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
        'v-dialog': passThroughStub,
        'v-empty-state': {
          props: ['title', 'text'],
          template: '<div class="empty">{{ title }} {{ text }}</div>'
        },
        'v-file-input': passThroughStub,
        'v-icon': passThroughStub,
        'v-progress-linear': {
          template: '<div class="loading" />'
        },
        'v-text-field': textFieldStub,
        'v-textarea': textAreaStub
      }
    }
  })

const findButtonByText = (wrapper: ReturnType<typeof mount>, text: string) => wrapper.findAll('button').find((button) => button.text().includes(text))

describe('StudentCourseJourneyView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    courseServiceMock.getMyStudyGroup.mockResolvedValue({
      id: 'group-1',
      courseId: 'course-id',
      courseRunId: 'run-1',
      isActive: true,
      memberCount: 1,
      members: [{ studentId: '3', role: 'MEMBER' }],
      name: 'Gruppe A'
    })
    learningMaterialServiceMock.listMaterials.mockResolvedValue(materialsFixture)
    learningTaskServiceMock.getMyLearningPath.mockResolvedValue(baseLearningPath)
  })

  it('renders the learning journey with progress, next action, feedback and materials', async () => {
    const wrapper = mountJourney()
    await flushPromises()

    expect(wrapper.text()).toContain('Deine Lernreise')
    expect(wrapper.text()).toContain('Du hast 1 von 3 Lernschritten abgeschlossen.')
    expect(wrapper.text()).toContain('Nächster Schritt')
    expect(wrapper.text()).toContain('Grundlagen anwenden')
    expect(wrapper.text()).toContain('Aufgabe bearbeiten')
    expect(wrapper.text()).toContain('Anmerkung zur Bewertung')
    expect(wrapper.text()).toContain('Gut gemacht.')
    expect(wrapper.text()).toContain('Arbeitsblatt Gruppe')
    expect(wrapper.text()).toContain('Glossar')
    expect(wrapper.text()).toContain('Weitere Materialien')
  })

  it('shows locked task reasons and disables locked materials', async () => {
    const wrapper = mountJourney()
    await flushPromises()

    expect(wrapper.text()).toContain('Schließe zuerst „Grundlagen anwenden“ ab.')
    expect(wrapper.text()).toContain('Details werden sichtbar, sobald dieser Lernschritt freigeschaltet ist.')
    expect(wrapper.find('.journey-step--locked').exists()).toBe(true)
    expect(wrapper.text()).not.toContain('Dieses Material wird freigeschaltet, sobald Aufgabe 2 abgeschlossen wurde.')
    expect(findButtonByText(wrapper, 'Noch gesperrt')).toBeUndefined()
    expect(learningMaterialServiceMock.downloadMaterial).not.toHaveBeenCalled()
  })

  it('starts non-manual group tasks through the existing API service', async () => {
    const nonManualPath = {
      ...baseLearningPath,
      tasks: baseLearningPath.tasks.map((task) =>
        task.id === 'task-2'
          ? {
            ...task,
            gradingMode: 'NOT_GRADED'
          }
          : task
      )
    }
    learningTaskServiceMock.getMyLearningPath.mockResolvedValueOnce(nonManualPath)
    learningTaskServiceMock.startGroupTask.mockResolvedValueOnce({
      ...nonManualPath,
      tasks: nonManualPath.tasks.map((task) => task.id === 'task-2' ? { ...task, status: 'IN_PROGRESS' } : task)
    })

    const wrapper = mountJourney()
    await flushPromises()

    await findButtonByText(wrapper, 'Gruppenaufgabe beginnen')?.trigger('click')
    await flushPromises()

    expect(learningTaskServiceMock.startGroupTask).toHaveBeenCalledWith('task-2')
    expect(wrapper.text()).toContain('Gruppenaufgabe begonnen.')
  })

  it('submits manual task work for teacher review', async () => {
    learningTaskServiceMock.submitGroupTask.mockResolvedValueOnce({
      ...baseLearningPath,
      tasks: baseLearningPath.tasks.map((task) =>
        task.id === 'task-2'
          ? {
            ...task,
            assessment: {
              id: 'assessment-2',
              assessmentTargetType: 'GROUP',
              courseRunId: 'run-1',
              courseVersionId: 'version-1',
              gradingMode: 'MANUAL',
              groupId: 'group-1',
              status: 'PENDING_REVIEW',
              submissionData: {
                text: 'Meine Lösung'
              },
              taskId: 'task-2'
            },
            status: 'SUBMITTED'
          }
          : task
      )
    })

    const wrapper = mountJourney()
    await flushPromises()

    await findButtonByText(wrapper, 'Aufgabe bearbeiten')?.trigger('click')
    await wrapper.find('textarea').setValue('Meine Lösung')
    await findButtonByText(wrapper, 'Abgabe senden')?.trigger('click')
    await flushPromises()

    expect(learningTaskServiceMock.submitGroupTask).toHaveBeenCalledWith('task-2', {
      link: undefined,
      text: 'Meine Lösung'
    }, {
      keepExistingFile: false
    })
    expect(wrapper.text()).toContain('Deine Abgabe wartet jetzt auf Bewertung.')
  })

  it.each([LIGHT_THEME_NAME, DARK_THEME_NAME])('renders in %s without hiding status text', async (themeName) => {
    document.documentElement.dataset.theme = themeName

    const wrapper = mountJourney()
    await flushPromises()

    expect(wrapper.text()).toContain('Erfolgreich abgeschlossen')
    expect(wrapper.text()).toContain('Verfügbar')
    expect(wrapper.text()).toContain('Gesperrt')
  })
})
