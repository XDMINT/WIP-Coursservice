// @vitest-environment jsdom
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import LearningProcessPanel from '../LearningProcessPanel.vue'
import { TaskAssessmentStatus, TaskGradingMode, TaskProgressStatus, TaskUnlockMode, TaskUnlockSource, TaskWorkMode, type LearningPath, type LearningTask, type StudentProgressOverview } from '@/services/learningTask.service'
import { DARK_THEME_NAME, LIGHT_THEME_NAME } from '@/services/theme.service'

const learningTaskServiceMock = vi.hoisted(() => ({
  assessTaskManually: vi.fn(),
  completeTask: vi.fn(),
  createTask: vi.fn(),
  deleteTask: vi.fn(),
  failTask: vi.fn(),
  getMyLearningPath: vi.fn(),
  getProgressOverview: vi.fn(),
  listTasks: vi.fn(),
  mockEvaluateTask: vi.fn(),
  manuallyUnlockTask: vi.fn(),
  resetTaskAssessment: vi.fn(),
  selfConfirmTask: vi.fn(),
  startGroupTask: vi.fn(),
  startTask: vi.fn(),
  submitGroupTask: vi.fn(),
  submitTask: vi.fn(),
  updateTask: vi.fn()
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

const baseTasks: LearningTask[] = [
  {
    id: 'task-1',
    courseId: 'course-id',
    title: 'Grundlagen kennenlernen',
    description: 'Einführung',
    type: 'DEMO_TASK',
    order: 1,
    unlockMode: TaskUnlockMode.IMMEDIATE,
    gradingMode: TaskGradingMode.SELF_CONFIRMATION,
    maxPoints: null,
    passThreshold: null,
    feedbackRequired: false,
    allowRetries: true,
    isPublished: true
  },
  {
    id: 'task-2',
    courseId: 'course-id',
    title: 'Grundlagen anwenden',
    description: 'Vertiefung',
    type: 'DEMO_TASK',
    order: 2,
    unlockMode: TaskUnlockMode.AUTOMATIC,
    prerequisiteTaskId: 'task-1',
    gradingMode: TaskGradingMode.MANUAL,
    maxPoints: 10,
    passThreshold: 50,
    feedbackRequired: true,
    allowRetries: true,
    isPublished: true
  },
  {
    id: 'task-3',
    courseId: 'course-id',
    title: 'Abschlussaufgabe bearbeiten',
    description: 'Abschluss',
    type: 'DEMO_TASK',
    order: 3,
    unlockMode: TaskUnlockMode.MANUAL,
    prerequisiteTaskId: 'task-2',
    gradingMode: TaskGradingMode.AUTOMATIC_MOCK,
    maxPoints: 10,
    passThreshold: 50,
    feedbackRequired: false,
    allowRetries: true,
    isPublished: true
  }
]

const createPath = (statuses: Record<string, TaskProgressStatus>): LearningPath => {
  const tasks = baseTasks.map((task) => {
    const status = statuses[task.id] ?? TaskProgressStatus.LOCKED

    return {
      ...task,
      status,
      completionPercentage: status === TaskProgressStatus.COMPLETED ? 100 : 0,
      locked: status === TaskProgressStatus.LOCKED,
      lockedReason: status !== TaskProgressStatus.LOCKED ? undefined : task.id === 'task-2' ? 'Diese Aufgabe wird freigeschaltet, sobald "Grundlagen kennenlernen" erfolgreich abgeschlossen wurde.' : 'Diese Aufgabe muss durch eine Lehrperson freigeschaltet werden.'
    }
  })

  return {
    courseId: 'course-id',
    studentId: '3',
    totalTasks: tasks.length,
    completedTasks: tasks.filter((task) => task.status === TaskProgressStatus.COMPLETED).length,
    inProgressTasks: tasks.filter((task) => task.status === TaskProgressStatus.IN_PROGRESS).length,
    availableTasks: tasks.filter((task) => task.status === TaskProgressStatus.AVAILABLE).length,
    failedTasks: tasks.filter((task) => task.status === TaskProgressStatus.FAILED).length,
    lockedTasks: tasks.filter((task) => task.status === TaskProgressStatus.LOCKED).length,
    progressPercentage: 0,
    tasks
  }
}

const createProgressOverview = (task3Status = TaskProgressStatus.LOCKED): StudentProgressOverview[] => [
  {
    enrollmentId: 'enrollment-3',
    studentId: '3',
    totalTasks: 3,
    completedTasks: 1,
    inProgressTasks: 0,
    availableTasks: task3Status === TaskProgressStatus.AVAILABLE ? 2 : 1,
    failedTasks: 0,
    lockedTasks: task3Status === TaskProgressStatus.LOCKED ? 1 : 0,
    progressPercentage: 33,
    tasks: [
      {
        taskId: 'task-1',
        title: 'Grundlagen kennenlernen',
        order: 1,
        status: TaskProgressStatus.COMPLETED,
        completionPercentage: 100
      },
      {
        taskId: 'task-3',
        title: 'Abschlussaufgabe bearbeiten',
        order: 3,
        status: task3Status,
        completionPercentage: 0,
        unlockSource: task3Status === TaskProgressStatus.AVAILABLE ? TaskUnlockSource.MANUAL : undefined
      }
    ]
  }
]

const buttonStub = {
  emits: ['click'],
  template: '<button type="button" @click="$emit(\'click\')"><slot /></button>'
}
const passThroughStub = {
  template: '<div><slot /></div>'
}

const mountPanel = (canManage = false, extraProps: Partial<InstanceType<typeof LearningProcessPanel>['$props']> = {}) =>
  mount(LearningProcessPanel, {
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
        'v-chip': {
          template: '<span class="chip"><slot /></span>'
        },
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
        'v-select': passThroughStub,
        'v-switch': passThroughStub,
        'v-textarea': passThroughStub,
        'v-text-field': passThroughStub
      }
    }
  })

const findButtonByText = (wrapper: ReturnType<typeof mount>, text: string) => wrapper.findAll('button').find((button) => button.text().includes(text))

describe('LearningProcessPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows a loading state while tasks are requested', async () => {
    learningTaskServiceMock.getMyLearningPath.mockReturnValueOnce(new Promise(() => undefined))

    const wrapper = mountPanel()
    await nextTick()

    expect(wrapper.find('.loading').exists()).toBe(true)
  })

  it('shows empty and error states', async () => {
    learningTaskServiceMock.getMyLearningPath.mockResolvedValueOnce({
      ...createPath({}),
      tasks: [],
      totalTasks: 0
    })
    const emptyWrapper = mountPanel()
    await flushPromises()

    expect(emptyWrapper.text()).toContain('Keine Aufgaben vorhanden')

    learningTaskServiceMock.getMyLearningPath.mockRejectedValueOnce(new Error('Kein Zugriff'))
    const errorWrapper = mountPanel()
    await flushPromises()

    expect(errorWrapper.text()).toContain('Kein Zugriff')
  })

  it('shows locked tasks with reasons and without actions', async () => {
    learningTaskServiceMock.getMyLearningPath.mockResolvedValueOnce(
      createPath({
        'task-1': TaskProgressStatus.AVAILABLE,
        'task-2': TaskProgressStatus.LOCKED,
        'task-3': TaskProgressStatus.LOCKED
      })
    )

    const wrapper = mountPanel()
    await flushPromises()

    expect(wrapper.text()).toContain('Gesperrt')
    expect(wrapper.text()).toContain('mdi-lock-outline')
    expect(wrapper.text()).toContain('Grundlagen kennenlernen')
    expect(wrapper.text()).toContain('Diese Aufgabe muss durch eine Lehrperson freigeschaltet werden.')
    expect(wrapper.findAll('button').filter((button) => button.text().includes('Aufgabe beginnen'))).toHaveLength(1)
  })

  it('starts an available task', async () => {
    learningTaskServiceMock.getMyLearningPath.mockResolvedValueOnce(
      createPath({
        'task-1': TaskProgressStatus.AVAILABLE,
        'task-2': TaskProgressStatus.LOCKED,
        'task-3': TaskProgressStatus.LOCKED
      })
    )
    learningTaskServiceMock.startTask.mockResolvedValueOnce(
      createPath({
        'task-1': TaskProgressStatus.IN_PROGRESS,
        'task-2': TaskProgressStatus.LOCKED,
        'task-3': TaskProgressStatus.LOCKED
      })
    )

    const wrapper = mountPanel()
    await flushPromises()
    await findButtonByText(wrapper, 'Aufgabe beginnen')?.trigger('click')
    await flushPromises()

    expect(learningTaskServiceMock.startTask).toHaveBeenCalledWith('task-1')
    expect(wrapper.text()).toContain('Begonnen')
  })

  it('does not show a durable success state after a failed start request', async () => {
    learningTaskServiceMock.getMyLearningPath.mockResolvedValueOnce(
      createPath({
        'task-1': TaskProgressStatus.AVAILABLE,
        'task-2': TaskProgressStatus.LOCKED,
        'task-3': TaskProgressStatus.LOCKED
      })
    )
    learningTaskServiceMock.startTask.mockRejectedValueOnce(new Error('Serverfehler'))

    const wrapper = mountPanel()
    await flushPromises()
    await findButtonByText(wrapper, 'Aufgabe beginnen')?.trigger('click')
    await flushPromises()

    expect(learningTaskServiceMock.startTask).toHaveBeenCalledWith('task-1')
    expect(wrapper.text()).toContain('Serverfehler')
    expect(wrapper.text()).toContain('Verfügbar')
    expect(wrapper.text()).not.toContain('Begonnen')
  })

  it('updates the path after a successful self confirmation', async () => {
    learningTaskServiceMock.getMyLearningPath.mockResolvedValueOnce(
      createPath({
        'task-1': TaskProgressStatus.IN_PROGRESS,
        'task-2': TaskProgressStatus.LOCKED,
        'task-3': TaskProgressStatus.LOCKED
      })
    )
    learningTaskServiceMock.selfConfirmTask.mockResolvedValueOnce(
      createPath({
        'task-1': TaskProgressStatus.COMPLETED,
        'task-2': TaskProgressStatus.AVAILABLE,
        'task-3': TaskProgressStatus.LOCKED
      })
    )

    const wrapper = mountPanel()
    await flushPromises()
    await findButtonByText(wrapper, 'Als erledigt markieren')?.trigger('click')
    await flushPromises()
    await findButtonByText(wrapper, 'Bestätigen')?.trigger('click')
    await flushPromises()

    expect(learningTaskServiceMock.selfConfirmTask).toHaveBeenCalledWith('task-1')
    expect(wrapper.text()).toContain('Aufgabe als erledigt markiert.')
    expect(wrapper.text()).toContain('Erfolgreich abgeschlossen')
    expect(wrapper.text()).toContain('mdi-check-circle-outline')
    expect(wrapper.text()).toContain('Verfügbar')
    expect(wrapper.text()).toContain('Abschlussaufgabe bearbeiten')
    expect(wrapper.text()).toContain('Gesperrt')
  })

  it('uses distinct student actions for manual and mock assessed tasks', async () => {
    learningTaskServiceMock.getMyLearningPath.mockResolvedValueOnce(
      createPath({
        'task-1': TaskProgressStatus.COMPLETED,
        'task-2': TaskProgressStatus.IN_PROGRESS,
        'task-3': TaskProgressStatus.IN_PROGRESS
      })
    )
    learningTaskServiceMock.submitTask.mockResolvedValueOnce(
      createPath({
        'task-1': TaskProgressStatus.COMPLETED,
        'task-2': TaskProgressStatus.SUBMITTED,
        'task-3': TaskProgressStatus.IN_PROGRESS
      })
    )
    learningTaskServiceMock.mockEvaluateTask.mockResolvedValueOnce(
      createPath({
        'task-1': TaskProgressStatus.COMPLETED,
        'task-2': TaskProgressStatus.SUBMITTED,
        'task-3': TaskProgressStatus.COMPLETED
      })
    )

    const wrapper = mountPanel()
    await flushPromises()

    expect(wrapper.text()).toContain('Aufgabe abgeben')
    expect(wrapper.text()).toContain('Abgabe simulieren')
    expect(wrapper.text()).not.toContain('Bestanden markieren')
    expect(wrapper.text()).not.toContain('Erfolgreich abschließen')

    await findButtonByText(wrapper, 'Aufgabe abgeben')?.trigger('click')
    await flushPromises()

    expect(learningTaskServiceMock.submitTask).toHaveBeenCalledWith('task-2')
    expect(wrapper.text()).toContain('Wartet auf Bewertung')

    await findButtonByText(wrapper, 'Abgabe simulieren')?.trigger('click')
    await flushPromises()

    expect(learningTaskServiceMock.mockEvaluateTask).toHaveBeenCalledWith('task-3', true)
    expect(wrapper.text()).toContain('Demo-Abgabe wurde automatisch bewertet.')
  })

  it('labels group tasks and uses group-specific student actions', async () => {
    const initialPath = createPath({
      'task-1': TaskProgressStatus.COMPLETED,
      'task-2': TaskProgressStatus.IN_PROGRESS,
      'task-3': TaskProgressStatus.LOCKED
    })
    initialPath.tasks = initialPath.tasks.map((task) =>
      task.id === 'task-2'
        ? {
            ...task,
            workMode: TaskWorkMode.GROUP,
            group: {
              id: 'group-1',
              name: 'Gruppe A',
              status: TaskProgressStatus.IN_PROGRESS
            }
          }
        : task
    )
    const submittedPath = {
      ...initialPath,
      tasks: initialPath.tasks.map((task) =>
        task.id === 'task-2'
          ? { ...task, status: TaskProgressStatus.SUBMITTED }
          : task
      )
    }
    learningTaskServiceMock.getMyLearningPath.mockResolvedValueOnce(initialPath)
    learningTaskServiceMock.submitGroupTask.mockResolvedValueOnce(submittedPath)

    const wrapper = mountPanel()
    await flushPromises()

    expect(wrapper.text()).toContain('Gruppenaufgabe')
    expect(wrapper.text()).toContain('Gruppe A')
    expect(wrapper.text()).toContain('Gruppenaufgabe abgeben')
    expect(wrapper.text()).not.toContain('Als erledigt markieren')

    await findButtonByText(wrapper, 'Gruppenaufgabe abgeben')?.trigger('click')
    await flushPromises()

    expect(learningTaskServiceMock.submitGroupTask).toHaveBeenCalledWith('task-2')
    expect(learningTaskServiceMock.submitTask).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Wartet auf Bewertung')
  })

  it('shows management functions only for teachers', async () => {
    learningTaskServiceMock.getMyLearningPath.mockResolvedValueOnce(
      createPath({
        'task-1': TaskProgressStatus.AVAILABLE
      })
    )
    const studentWrapper = mountPanel(false)
    await flushPromises()

    expect(studentWrapper.text()).not.toContain('Aufgabenverwaltung')

    learningTaskServiceMock.listTasks.mockResolvedValueOnce(baseTasks)
    learningTaskServiceMock.getProgressOverview.mockResolvedValueOnce(createProgressOverview())
    const teacherWrapper = mountPanel(true)
    await flushPromises()

    expect(teacherWrapper.text()).toContain('Aufgabenverwaltung')
    expect(teacherWrapper.text()).toContain('Freischalten')
  })

  it('lets teachers manually unlock a task', async () => {
    learningTaskServiceMock.listTasks.mockResolvedValue(baseTasks)
    learningTaskServiceMock.getProgressOverview.mockResolvedValue(createProgressOverview())
    learningTaskServiceMock.manuallyUnlockTask.mockResolvedValue(createProgressOverview(TaskProgressStatus.AVAILABLE)[0])

    const wrapper = mountPanel(true)
    await flushPromises()
    await findButtonByText(wrapper, 'Freischalten')?.trigger('click')
    await flushPromises()

    expect(learningTaskServiceMock.manuallyUnlockTask).toHaveBeenCalledWith('task-3', '3')
    expect(wrapper.text()).toContain('Verfügbar')
    expect(learningTaskServiceMock.getProgressOverview).toHaveBeenCalledTimes(1)
  })

  it('lets teachers assess submitted manual tasks in a selected run', async () => {
    const submittedOverview: StudentProgressOverview[] = [
      {
        enrollmentId: 'enrollment-3',
        studentId: '3',
        totalTasks: 3,
        completedTasks: 1,
        inProgressTasks: 0,
        availableTasks: 1,
        failedTasks: 0,
        lockedTasks: 1,
        progressPercentage: 33,
        tasks: [
          {
            taskId: 'task-2',
            title: 'Grundlagen anwenden',
            order: 2,
            status: TaskProgressStatus.SUBMITTED,
            completionPercentage: 0,
            assessment: {
              id: 'assessment-1',
              courseRunId: 'run-1',
              courseVersionId: 'version-1',
              taskId: 'task-2',
              studentId: '3',
              gradingMode: TaskGradingMode.MANUAL,
              status: TaskAssessmentStatus.PENDING_REVIEW,
              points: null,
              maxPoints: 10,
              passThreshold: 50,
              passed: null
            }
          }
        ]
      }
    ]

    learningTaskServiceMock.listTasks.mockResolvedValue(baseTasks)
    learningTaskServiceMock.getProgressOverview.mockResolvedValue(submittedOverview)
    learningTaskServiceMock.assessTaskManually.mockResolvedValue({
      ...submittedOverview[0].tasks[0].assessment,
      status: TaskAssessmentStatus.PASSED,
      points: 10,
      passed: true
    })

    const wrapper = mountPanel(true, {
      courseRunId: 'run-1'
    })
    await flushPromises()
    await findButtonByText(wrapper, 'Bewerten')?.trigger('click')
    await flushPromises()
    await findButtonByText(wrapper, 'Bewertung speichern')?.trigger('click')
    await flushPromises()

    expect(learningTaskServiceMock.assessTaskManually).toHaveBeenCalledWith('course-id', 'run-1', 'task-2', '3', {
      feedback: null,
      maxPoints: 10,
      passed: true,
      points: 10
    })
    expect(wrapper.text()).toContain('Aufgabe als bestanden bewertet.')
  })

  it('loads historical teacher data by run and disables editing actions', async () => {
    learningTaskServiceMock.listTasks.mockResolvedValue(baseTasks)
    learningTaskServiceMock.getProgressOverview.mockResolvedValue(createProgressOverview())

    const wrapper = mountPanel(true, {
      courseRunId: 'run-1',
      readOnly: true
    })
    await flushPromises()

    expect(learningTaskServiceMock.listTasks).toHaveBeenCalledWith('course-id', 'run-1', undefined)
    expect(learningTaskServiceMock.getProgressOverview).toHaveBeenCalledWith('course-id', 'run-1')
    expect(wrapper.text()).toContain('Historischer Kursdurchlauf')
    expect(wrapper.text()).not.toContain('Neue Aufgabe')
    expect(wrapper.text()).not.toContain('Freischalten')
  })

  it('keeps the teacher overview unchanged when manual unlock fails', async () => {
    learningTaskServiceMock.listTasks.mockResolvedValue(baseTasks)
    learningTaskServiceMock.getProgressOverview.mockResolvedValue(createProgressOverview())
    learningTaskServiceMock.manuallyUnlockTask.mockRejectedValueOnce(new Error('Freischaltung fehlgeschlagen'))

    const wrapper = mountPanel(true)
    await flushPromises()
    await findButtonByText(wrapper, 'Freischalten')?.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Freischaltung fehlgeschlagen')
    expect(wrapper.text()).toContain('Gesperrt')
    expect(wrapper.text()).not.toContain('Aufgabe freigeschaltet.')
  })

  it.each([LIGHT_THEME_NAME, DARK_THEME_NAME])('renders the student task view in %s', async (themeName) => {
    document.documentElement.dataset.theme = themeName
    learningTaskServiceMock.getMyLearningPath.mockResolvedValueOnce(
      createPath({
        'task-1': TaskProgressStatus.COMPLETED,
        'task-2': TaskProgressStatus.AVAILABLE,
        'task-3': TaskProgressStatus.LOCKED
      })
    )

    const wrapper = mountPanel(false)
    await flushPromises()

    expect(wrapper.text()).toContain('Erfolgreich abgeschlossen')
    expect(wrapper.text()).toContain('Verfügbar')
    expect(wrapper.text()).toContain('Gesperrt')
  })

  it('loads server progress when opened and does not replace it with local defaults', async () => {
    learningTaskServiceMock.getMyLearningPath.mockResolvedValueOnce(
      createPath({
        'task-1': TaskProgressStatus.COMPLETED,
        'task-2': TaskProgressStatus.COMPLETED,
        'task-3': TaskProgressStatus.AVAILABLE
      })
    )

    const wrapper = mountPanel(false)
    await flushPromises()

    expect(learningTaskServiceMock.getMyLearningPath).toHaveBeenCalledWith('course-id')
    expect(wrapper.text()).toContain('2 von 3 Aufgaben erfolgreich abgeschlossen.')
    expect(wrapper.text()).toContain('Abschlussaufgabe bearbeiten')
    expect(wrapper.text()).toContain('Verfügbar')
    expect(wrapper.text()).not.toContain('Noch keine Aufgaben verfügbar.')
  })

  it('ignores selected run ids for students and loads their active learning path', async () => {
    learningTaskServiceMock.getMyLearningPath.mockResolvedValueOnce(
      createPath({
        'task-1': TaskProgressStatus.AVAILABLE
      })
    )

    mountPanel(false, {
      courseRunId: 'historical-run'
    })
    await flushPromises()

    expect(learningTaskServiceMock.getMyLearningPath).toHaveBeenCalledWith('course-id')
    expect(learningTaskServiceMock.listTasks).not.toHaveBeenCalled()
    expect(learningTaskServiceMock.getProgressOverview).not.toHaveBeenCalled()
  })
})
