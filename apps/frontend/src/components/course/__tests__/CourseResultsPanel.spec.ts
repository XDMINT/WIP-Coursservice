// @vitest-environment jsdom
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import CourseResultsPanel from '../CourseResultsPanel.vue'
import { TaskAssessmentStatus, TaskGradingMode, TaskProgressStatus, TaskUnlockMode, type LearningPath, type LearningTask, type StudentProgressOverview } from '@/services/learningTask.service'

const learningTaskServiceMock = vi.hoisted(() => ({
  assessTaskManually: vi.fn(),
  downloadTaskSubmissionFile: vi.fn(),
  getMyLearningPath: vi.fn(),
  getProgressOverview: vi.fn(),
  listTasks: vi.fn(),
  resetTaskAssessment: vi.fn()
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
const formControlStub = {
  props: ['label'],
  template: '<label>{{ label }}</label>'
}

const tasks: LearningTask[] = [
  {
    allowRetries: false,
    courseId: 'course-id',
    courseRunId: 'run-1',
    courseVersionId: 'version-1',
    description: 'Selbstbestätigung',
    feedbackRequired: false,
    gradingMode: TaskGradingMode.SELF_CONFIRMATION,
    id: 'task-1',
    isPublished: true,
    maxPoints: null,
    order: 1,
    passThreshold: null,
    title: 'Grundlagen kennenlernen',
    type: 'DEMO_TASK',
    unlockMode: TaskUnlockMode.IMMEDIATE
  },
  {
    allowRetries: false,
    courseId: 'course-id',
    courseRunId: 'run-1',
    courseVersionId: 'version-1',
    description: 'Manuelle Aufgabe',
    feedbackRequired: true,
    gradingMode: TaskGradingMode.MANUAL,
    id: 'task-2',
    isPublished: true,
    maxPoints: 10,
    order: 2,
    passThreshold: 50,
    prerequisiteTaskId: 'task-1',
    title: 'Grundlagen anwenden',
    type: 'DEMO_TASK',
    unlockMode: TaskUnlockMode.AUTOMATIC
  },
  {
    allowRetries: false,
    courseId: 'course-id',
    courseRunId: 'run-1',
    courseVersionId: 'version-1',
    description: 'Mock-Aufgabe',
    feedbackRequired: false,
    gradingMode: TaskGradingMode.AUTOMATIC_MOCK,
    id: 'task-3',
    isPublished: true,
    maxPoints: 10,
    order: 3,
    passThreshold: 50,
    prerequisiteTaskId: 'task-2',
    title: 'Automatische Demo-Bewertung auslösen',
    type: 'DEMO_TASK',
    unlockMode: TaskUnlockMode.AUTOMATIC
  }
]

const createProgressOverview = (): StudentProgressOverview[] => [
  {
    availableTasks: 0,
    completedTasks: 1,
    enrollmentId: 'enrollment-3',
    failedTasks: 0,
    inProgressTasks: 0,
    lockedTasks: 1,
    progressPercentage: 33,
    studentId: '3',
    tasks: [
      {
        assessment: {
          courseRunId: 'run-1',
          courseVersionId: 'version-1',
          gradingMode: TaskGradingMode.SELF_CONFIRMATION,
          id: 'assessment-1',
          passed: true,
          status: TaskAssessmentStatus.PASSED,
          studentId: '3',
          taskId: 'task-1'
        },
        completionPercentage: 100,
        order: 1,
        status: TaskProgressStatus.COMPLETED,
        taskId: 'task-1',
        title: 'Grundlagen kennenlernen'
      },
      {
        assessment: {
          courseRunId: 'run-1',
          courseVersionId: 'version-1',
          feedback: 'Bitte prüfen.',
          gradingMode: TaskGradingMode.MANUAL,
          id: 'assessment-2',
          maxPoints: 10,
          passed: null,
          passThreshold: 50,
          points: null,
          status: TaskAssessmentStatus.PENDING_REVIEW,
          studentId: '3',
          submissionData: {
            file: {
              fileSize: 2048,
              originalFileName: 'loesung.pdf'
            },
            link: 'https://example.com/abgabe',
            text: 'Meine Abgabe'
          },
          taskId: 'task-2'
        },
        completionPercentage: 75,
        order: 2,
        status: TaskProgressStatus.SUBMITTED,
        taskId: 'task-2',
        title: 'Grundlagen anwenden'
      },
      {
        assessment: null,
        completionPercentage: 0,
        order: 3,
        status: TaskProgressStatus.LOCKED,
        taskId: 'task-3',
        title: 'Automatische Demo-Bewertung auslösen'
      }
    ],
    totalTasks: 3
  }
]

const createLearningPath = (): LearningPath => ({
  availableTasks: 0,
  completedTasks: 2,
  courseId: 'course-id',
  failedTasks: 0,
  inProgressTasks: 0,
  lockedTasks: 1,
  progressPercentage: 66,
  studentId: '3',
  tasks: [
    {
      ...tasks[0],
      assessment: {
        courseRunId: 'run-1',
        courseVersionId: 'version-1',
        gradingMode: TaskGradingMode.SELF_CONFIRMATION,
        id: 'assessment-1',
        passed: true,
        status: TaskAssessmentStatus.PASSED,
        studentId: '3',
        taskId: 'task-1'
      },
      completionPercentage: 100,
      locked: false,
      status: TaskProgressStatus.COMPLETED
    },
    {
      ...tasks[1],
      assessment: {
        courseRunId: 'run-1',
        courseVersionId: 'version-1',
        feedback: 'Gut nachgebessert.',
        gradingMode: TaskGradingMode.MANUAL,
        id: 'assessment-2',
        maxPoints: 10,
        passed: true,
        passThreshold: 50,
        points: 8,
        status: TaskAssessmentStatus.PASSED,
        studentId: '3',
        taskId: 'task-2'
      },
      completionPercentage: 100,
      locked: false,
      status: TaskProgressStatus.COMPLETED
    },
    {
      ...tasks[2],
      assessment: null,
      completionPercentage: 0,
      locked: true,
      status: TaskProgressStatus.LOCKED
    }
  ],
  totalTasks: 3
})

const mountPanel = (canManage = false, extraProps: Partial<InstanceType<typeof CourseResultsPanel>['$props']> = {}) =>
  mount(CourseResultsPanel, {
    props: {
      canManage,
      courseId: 'course-id',
      ...extraProps
    },
    global: {
      stubs: {
        'v-alert': {
          template: '<div class="alert"><slot /></div>'
        },
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
          template: '<div class="loading" />'
        },
        'v-select': formControlStub,
        'v-text-field': formControlStub,
        'v-textarea': formControlStub
      }
    }
  })

describe('CourseResultsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows a loading state while the own task assessments are requested', async () => {
    learningTaskServiceMock.getMyLearningPath.mockReturnValueOnce(new Promise(() => undefined))

    const wrapper = mountPanel(false)
    await nextTick()

    expect(wrapper.find('.loading').exists()).toBe(true)
  })

  it('shows student task assessments from the learning path', async () => {
    learningTaskServiceMock.getMyLearningPath.mockResolvedValueOnce(createLearningPath())

    const wrapper = mountPanel(false)
    await flushPromises()

    expect(learningTaskServiceMock.getMyLearningPath).toHaveBeenCalledWith('course-id')
    expect(wrapper.text()).toContain('Meine Bewertungen')
    expect(wrapper.text()).toContain('Grundlagen anwenden')
    expect(wrapper.text()).toContain('Manuelle Bewertung')
    expect(wrapper.text()).toContain('8 / 10')
    expect(wrapper.text()).toContain('Gut nachgebessert.')
  })

  it('ignores selected run ids for students and loads active task assessments', async () => {
    learningTaskServiceMock.getMyLearningPath.mockResolvedValueOnce(createLearningPath())

    mountPanel(false, {
      courseRunId: 'historical-run'
    })
    await flushPromises()

    expect(learningTaskServiceMock.getMyLearningPath).toHaveBeenCalledWith('course-id')
    expect(learningTaskServiceMock.getProgressOverview).not.toHaveBeenCalled()
  })

  it('shows teacher assessment overview from the same learning task data', async () => {
    learningTaskServiceMock.listTasks.mockResolvedValueOnce(tasks)
    learningTaskServiceMock.getProgressOverview.mockResolvedValueOnce(createProgressOverview())

    const wrapper = mountPanel(true, {
      courseRunId: 'run-1'
    })
    await flushPromises()

    expect(learningTaskServiceMock.listTasks).toHaveBeenCalledWith('course-id', 'run-1')
    expect(learningTaskServiceMock.getProgressOverview).toHaveBeenCalledWith('course-id', 'run-1')
    expect(wrapper.text()).toContain('Aufgabenbewertungen')
    expect(wrapper.text()).toContain('Student 3')
    expect(wrapper.text()).toContain('Wartet auf Bewertung')
    expect(wrapper.text()).toContain('Meine Abgabe')
    expect(wrapper.text()).toContain('Abgabelink öffnen')
    expect(wrapper.text()).toContain('loesung.pdf')
    expect(wrapper.text()).toContain('Bewerten')
    expect(wrapper.text()).not.toContain('Alle neu berechnen')
  })

  it('stores manual task assessments from the teacher dialog', async () => {
    learningTaskServiceMock.listTasks.mockResolvedValue(tasks)
    learningTaskServiceMock.getProgressOverview.mockResolvedValue(createProgressOverview())
    learningTaskServiceMock.assessTaskManually.mockResolvedValue({
      courseRunId: 'run-1',
      courseVersionId: 'version-1',
      gradingMode: TaskGradingMode.MANUAL,
      id: 'assessment-2',
      passed: true,
      status: TaskAssessmentStatus.PASSED,
      studentId: '3',
      taskId: 'task-2'
    })

    const wrapper = mountPanel(true, {
      courseRunId: 'run-1'
    })
    await flushPromises()
    const row = (wrapper.vm as any).filteredAssessmentRows.find((entry: any) => entry.taskId === 'task-2')
    ;(wrapper.vm as any).openManualDialog(row)
    ;(wrapper.vm as any).manualForm.points = 8
    ;(wrapper.vm as any).manualForm.feedback = 'Gut nachgebessert.'
    await (wrapper.vm as any).saveManualAssessment()
    await flushPromises()

    expect(learningTaskServiceMock.assessTaskManually).toHaveBeenCalledWith('course-id', 'run-1', 'task-2', '3', {
      feedback: 'Gut nachgebessert.',
      maxPoints: 10,
      passed: true,
      points: 8
    })
    expect(wrapper.text()).toContain('Aufgabenbewertung gespeichert.')
  })

  it('resets task assessments through the same endpoint used by the task view', async () => {
    const overview = createProgressOverview()
    overview[0].tasks[1].assessment = {
      ...overview[0].tasks[1].assessment!,
      passed: true,
      points: 8,
      status: TaskAssessmentStatus.PASSED
    }
    overview[0].tasks[1].status = TaskProgressStatus.COMPLETED
    learningTaskServiceMock.listTasks.mockResolvedValue(tasks)
    learningTaskServiceMock.getProgressOverview.mockResolvedValue(overview)
    learningTaskServiceMock.resetTaskAssessment.mockResolvedValue({
      ...overview[0].tasks[1].assessment,
      passed: null,
      status: TaskAssessmentStatus.PENDING_REVIEW
    })

    const wrapper = mountPanel(true, {
      courseRunId: 'run-1'
    })
    await flushPromises()
    const row = (wrapper.vm as any).filteredAssessmentRows.find((entry: any) => entry.taskId === 'task-2')
    await (wrapper.vm as any).resetAssessment(row)
    await flushPromises()

    expect(learningTaskServiceMock.resetTaskAssessment).toHaveBeenCalledWith('course-id', 'run-1', 'task-2', '3')
    expect(wrapper.text()).toContain('Aufgabenbewertung zurückgesetzt.')
  })

  it('loads historical assessment data by run and hides editing actions', async () => {
    learningTaskServiceMock.listTasks.mockResolvedValueOnce(tasks)
    learningTaskServiceMock.getProgressOverview.mockResolvedValueOnce(createProgressOverview())

    const wrapper = mountPanel(true, {
      courseRunId: 'run-1',
      readOnly: true
    })
    await flushPromises()

    expect(learningTaskServiceMock.listTasks).toHaveBeenCalledWith('course-id', 'run-1')
    expect(learningTaskServiceMock.getProgressOverview).toHaveBeenCalledWith('course-id', 'run-1')
    expect(wrapper.text()).toContain('Historischer Kursdurchlauf')
    expect(wrapper.text()).not.toContain('Bewerten')
    expect(wrapper.text()).not.toContain('Bewertung zurücksetzen')
  })
})
