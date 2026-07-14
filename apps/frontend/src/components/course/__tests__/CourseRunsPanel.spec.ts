// @vitest-environment jsdom
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import CourseRunsPanel from '../CourseRunsPanel.vue'

const courseServiceMock = vi.hoisted(() => ({
  activateCourseRun: vi.fn(),
  createCourseRun: vi.fn(),
  createSpecialCourseRun: vi.fn(),
  deleteOrArchiveCourseRun: vi.fn(),
  getCourseRunPlan: vi.fn(),
  listCourseVersionTemplates: vi.fn(),
  listCourseRuns: vi.fn(),
  updateCourseRunPlanTemplate: vi.fn()
}))

vi.mock('@/services/course.service', () => ({
  default: courseServiceMock
}))

vi.mock('@/services/apiErrors', () => ({
  getApiErrorMessage: (error: Error) => error.message
}))

const passThroughStub = {
  template: '<div><slot /></div>'
}

const buttonStub = {
  emits: ['click'],
  props: ['prependIcon', 'loading'],
  template: '<button type="button" @click="$emit(\'click\')"><span>{{ prependIcon }}</span><slot /></button>'
}

const runsFixture = [
  {
    id: 'run-2',
    courseId: 'course-id',
    label: 'Wintersemester 2026/27',
    startDate: '2026-10-01',
    endDate: '2027-03-31',
    status: 'PUBLISHED',
    isActive: true,
    enrollmentCount: 2,
    materialCount: 4,
    taskCount: 3,
    resultCount: 1,
    progressCount: 0,
    assignmentCount: 0
  },
  {
    id: 'run-1',
    courseId: 'course-id',
    label: 'Sommersemester 2026',
    startDate: '2026-04-01',
    endDate: '2026-09-30',
    status: 'ARCHIVED',
    isActive: false,
    enrollmentCount: 1,
    materialCount: 4,
    taskCount: 3,
    resultCount: 1,
    progressCount: 2,
    assignmentCount: 0
  }
]

const versionTemplatesFixture = [
  {
    id: 'version-2',
    courseId: 'course-id',
    courseRunId: 'run-2',
    courseRunLabel: 'Wintersemester 2026/27',
    versionNumber: 2,
    content: {},
    changeSummary: 'Aktive Struktur',
    createdAt: '2026-10-02T10:00:00.000Z',
    createdBy: '1',
    isActive: true,
    status: 'PUBLISHED'
  },
  {
    id: 'version-1',
    courseId: 'course-id',
    courseRunId: 'run-1',
    courseRunLabel: 'Sommersemester 2026',
    versionNumber: 1,
    content: {},
    changeSummary: 'Bewährte Vorlage',
    createdAt: '2026-04-02T10:00:00.000Z',
    createdBy: '1',
    isActive: false,
    status: 'PUBLISHED'
  }
]

const runPlanFixture = {
  recurrenceType: 'SEMESTER',
  currentRun: runsFixture[0],
  nextRun: {
    label: 'Sommersemester 2027',
    startDate: '2027-04-01',
    endDate: '2027-09-30'
  },
  templateStrategy: 'ACTIVE_VERSION_OF_CURRENT_RUN',
  templateVersion: versionTemplatesFixture[0],
  regularPlanningAvailable: true
}

const mountPanel = (canManage = false, extraProps: Partial<InstanceType<typeof CourseRunsPanel>['$props']> = {}) =>
  mount(CourseRunsPanel, {
    props: {
      canManage,
      courseId: 'course-id',
      recurrenceType: 'SEMESTER',
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
        'v-checkbox': passThroughStub,
        'v-chip': passThroughStub,
        'v-data-table': {
          props: ['items'],
          template:
            '<div><slot v-if="items.length === 0" name="no-data" /><div v-for="item in items" :key="item.id" class="row"><slot name="item.label" :item="item" /><slot name="item.period" :item="item" /><slot name="item.status" :item="item" /><slot name="item.isActive" :item="item" /><slot name="item.counts" :item="item" /><slot name="item.actions" :item="item" /></div></div>'
        },
        'v-empty-state': {
          props: ['title', 'text'],
          template: '<div class="empty">{{ title }} {{ text }}</div>'
        },
        'v-dialog': {
          props: ['modelValue'],
          template: '<div v-if="modelValue" class="dialog"><slot /></div>'
        },
        'v-icon': passThroughStub,
        'v-progress-linear': {
          template: '<div class="loading" />'
        },
        'v-select': {
          props: ['items', 'itemTitle', 'itemValue', 'modelValue'],
          emits: ['update:modelValue'],
          template:
            '<div class="select"><slot /><button v-for="item in items" :key="item.id || item.value" type="button" class="select-option" @click="$emit(\'update:modelValue\', item[itemValue] || item.id || item.value)">{{ typeof itemTitle === "function" ? itemTitle(item) : item[itemTitle] }}</button></div>'
        },
        'v-spacer': passThroughStub,
        'v-text-field': passThroughStub
      }
    }
  })

const findButtonByText = (wrapper: ReturnType<typeof mount>, text: string) => wrapper.findAll('button').find((button) => button.text().includes(text))

describe('CourseRunsPanel', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    courseServiceMock.getCourseRunPlan.mockResolvedValue(runPlanFixture)
    courseServiceMock.listCourseVersionTemplates.mockResolvedValue([])
  })

  it('shows a loading state while runs are requested', async () => {
    courseServiceMock.listCourseRuns.mockReturnValueOnce(new Promise(() => undefined))

    const wrapper = mountPanel()
    await nextTick()

    expect(wrapper.find('.loading').exists()).toBe(true)
  })

  it('shows an empty state for courses without runs', async () => {
    courseServiceMock.listCourseRuns.mockResolvedValueOnce([])

    const wrapper = mountPanel()
    await flushPromises()

    expect(wrapper.text()).toContain('Keine Durchläufe vorhanden')
  })

  it('shows API errors', async () => {
    courseServiceMock.listCourseRuns.mockRejectedValueOnce(new Error('Kein Zugriff'))

    const wrapper = mountPanel()
    await flushPromises()

    expect(wrapper.text()).toContain('Kein Zugriff')
  })

  it('renders runs read-only for students and warns for old runs', async () => {
    courseServiceMock.listCourseRuns.mockResolvedValueOnce(runsFixture)

    const wrapper = mountPanel(false)
    await flushPromises()

    expect(courseServiceMock.listCourseRuns).toHaveBeenCalledWith('course-id')
    expect(wrapper.text()).toContain('Wintersemester 2026/27')
    expect(wrapper.text()).toContain('Semesterweise')
    expect(wrapper.text()).not.toContain('Durchlaufplanung')
    expect(courseServiceMock.getCourseRunPlan).not.toHaveBeenCalled()
    ;(wrapper.vm as unknown as { selectRun: (runId: string) => void }).selectRun('run-1')
    await flushPromises()

    expect(wrapper.text()).toContain('Sommersemester 2026 ist nicht der aktive Durchlauf')
    expect(wrapper.text()).toContain('Alter Durchlauf')
  })

  it('lets teachers prepare and activate planned runs', async () => {
    courseServiceMock.listCourseRuns
      .mockResolvedValueOnce(runsFixture)
      .mockResolvedValueOnce(runsFixture)
      .mockResolvedValueOnce(runsFixture)
    courseServiceMock.listCourseVersionTemplates.mockResolvedValueOnce(versionTemplatesFixture).mockResolvedValueOnce(versionTemplatesFixture)
    courseServiceMock.getCourseRunPlan.mockResolvedValueOnce(runPlanFixture).mockResolvedValueOnce(runPlanFixture)
    courseServiceMock.updateCourseRunPlanTemplate.mockResolvedValueOnce(runPlanFixture)
    courseServiceMock.createCourseRun.mockResolvedValueOnce({
      ...runsFixture[1],
      id: 'run-3',
      label: 'Sommersemester 2027'
    })
    courseServiceMock.activateCourseRun.mockResolvedValueOnce(runsFixture[1])

    const wrapper = mountPanel(true)
    await flushPromises()

    expect(wrapper.text()).toContain('Durchlaufplanung')
    expect(wrapper.text()).toContain('Sommersemester 2027')
    expect(wrapper.text()).toContain('Nächsten Semesterdurchlauf vorbereiten')
    expect(wrapper.text()).toContain('Wintersemester 2026/27 · Version 2 · Aktive Struktur')
    await findButtonByText(wrapper, 'Aktivieren')?.trigger('click')
    await flushPromises()

    expect(courseServiceMock.activateCourseRun).toHaveBeenCalledWith('course-id', 'run-1')

    await findButtonByText(wrapper, 'Nächsten Semesterdurchlauf vorbereiten')?.trigger('click')
    await flushPromises()

    expect(courseServiceMock.updateCourseRunPlanTemplate).toHaveBeenCalledWith('course-id', {
      sourceVersionId: null,
      strategy: 'ACTIVE_VERSION_OF_CURRENT_RUN'
    })
    expect(courseServiceMock.createCourseRun).toHaveBeenCalledWith('course-id', {
      activate: false,
      status: 'PUBLISHED'
    })
  })

  it('prepares a run with the selected course version template', async () => {
    courseServiceMock.listCourseRuns.mockResolvedValueOnce(runsFixture).mockResolvedValueOnce(runsFixture)
    courseServiceMock.listCourseVersionTemplates.mockResolvedValueOnce(versionTemplatesFixture).mockResolvedValueOnce(versionTemplatesFixture)
    courseServiceMock.getCourseRunPlan.mockResolvedValueOnce(runPlanFixture).mockResolvedValueOnce({
      ...runPlanFixture,
      templateStrategy: 'SPECIFIC_VERSION',
      templateVersion: versionTemplatesFixture[1]
    })
    courseServiceMock.updateCourseRunPlanTemplate.mockResolvedValueOnce({
      ...runPlanFixture,
      templateStrategy: 'SPECIFIC_VERSION',
      templateVersion: versionTemplatesFixture[1]
    })
    courseServiceMock.createCourseRun.mockResolvedValueOnce({
      ...runsFixture[1],
      id: 'run-3',
      label: 'Sommersemester 2027'
    })

    const wrapper = mountPanel(true)
    await flushPromises()

    await findButtonByText(wrapper, 'Ausgewählte Inhaltsversion')?.trigger('click')
    await findButtonByText(wrapper, 'Sommersemester 2026 · Version 1')?.trigger('click')

    await findButtonByText(wrapper, 'Nächsten Semesterdurchlauf vorbereiten')?.trigger('click')
    await flushPromises()

    expect(courseServiceMock.updateCourseRunPlanTemplate).toHaveBeenCalledWith('course-id', {
      strategy: 'SPECIFIC_VERSION',
      sourceVersionId: 'version-1'
    })
    expect(courseServiceMock.createCourseRun).toHaveBeenCalledWith('course-id', {
      activate: false,
      status: 'PUBLISHED'
    })
  })

  it('shows the continuous-course hint and special run action', async () => {
    courseServiceMock.listCourseRuns.mockResolvedValueOnce(runsFixture).mockResolvedValueOnce(runsFixture)
    courseServiceMock.getCourseRunPlan.mockResolvedValueOnce({
      ...runPlanFixture,
      recurrenceType: 'CONTINUOUS',
      nextRun: null,
      regularPlanningAvailable: false
    })
    courseServiceMock.createSpecialCourseRun.mockResolvedValueOnce({
      ...runsFixture[0],
      id: 'run-special',
      label: 'Sonderdurchlauf'
    })

    const wrapper = mountPanel(true, {
      recurrenceType: 'CONTINUOUS'
    })
    await flushPromises()

    expect(wrapper.text()).toContain('Dieser Kurs ist dauerhaft angelegt')
    expect(wrapper.text()).toContain('Sonderdurchlauf erstellen')

    await findButtonByText(wrapper, 'Sonderdurchlauf erstellen')?.trigger('click')
    await flushPromises()

    expect(courseServiceMock.createSpecialCourseRun).toHaveBeenCalledWith('course-id', {
      activate: false,
      endDate: undefined,
      label: undefined,
      sourceVersionId: undefined,
      startDate: undefined,
      status: 'PUBLISHED'
    })
  })

  it('shows a confirmation dialog and archives historical runs with data', async () => {
    courseServiceMock.listCourseRuns.mockResolvedValueOnce(runsFixture).mockResolvedValueOnce(runsFixture)
    courseServiceMock.deleteOrArchiveCourseRun.mockResolvedValueOnce({
      action: 'ARCHIVED',
      reason: 'Archiviert',
      run: {
        ...runsFixture[1],
        status: 'ARCHIVED'
      }
    })

    const wrapper = mountPanel(true)
    await flushPromises()

    await findButtonByText(wrapper, 'Löschen')?.trigger('click')
    await flushPromises()

    expect(wrapper.find('.dialog').exists()).toBe(true)
    expect(wrapper.text()).toContain('Durchlauf archivieren')

    await findButtonByText(wrapper, 'Bestätigen')?.trigger('click')
    await flushPromises()

    expect(courseServiceMock.deleteOrArchiveCourseRun).toHaveBeenCalledWith('course-id', 'run-1')
    expect(wrapper.text()).toContain('Archiviert')
  })

  it('emits the selected run for the parent course view', async () => {
    courseServiceMock.listCourseRuns.mockResolvedValueOnce(runsFixture)

    const wrapper = mountPanel(true, {
      selectedRunId: 'run-2'
    })
    await flushPromises()
    ;(wrapper.vm as unknown as { selectRun: (runId: string) => void }).selectRun('run-1')
    await flushPromises()

    expect(wrapper.emitted('selected')?.at(-1)?.[0]).toEqual(
      expect.objectContaining({
        id: 'run-1',
        label: 'Sommersemester 2026'
      })
    )
  })
})
