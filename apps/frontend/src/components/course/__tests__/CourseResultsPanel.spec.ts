// @vitest-environment jsdom
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import CourseResultsPanel from '../CourseResultsPanel.vue'

const resultServiceMock = vi.hoisted(() => ({
  getMyResult: vi.fn(),
  listResults: vi.fn(),
  recalculateAll: vi.fn(),
  recalculateResult: vi.fn(),
  saveManualResult: vi.fn()
}))

vi.mock('@/services/courseResult.service', () => {
  const CoursePassStatus = {
    FAILED: 'FAILED',
    NOT_ASSESSED: 'NOT_ASSESSED',
    PASSED: 'PASSED'
  }
  const CourseResultSource = {
    AUTOMATIC_CALCULATION: 'AUTOMATIC_CALCULATION',
    MANUAL_ENTRY: 'MANUAL_ENTRY',
    MANUAL_OVERRIDE: 'MANUAL_OVERRIDE'
  }
  const CourseResultMode = {
    AUTOMATIC: 'AUTOMATIC',
    MANUAL: 'MANUAL'
  }
  const passLabels = {
    FAILED: 'Nicht bestanden',
    NOT_ASSESSED: 'Noch nicht bewertet',
    PASSED: 'Bestanden'
  }
  const sourceLabels = {
    AUTOMATIC_CALCULATION: 'Automatisch berechnet',
    MANUAL_ENTRY: 'Manuell eingetragen',
    MANUAL_OVERRIDE: 'Manuell überschrieben'
  }

  return {
    CoursePassStatus,
    CourseResultMode,
    CourseResultSource,
    default: resultServiceMock,
    formatPassStatus: (status: keyof typeof passLabels) => passLabels[status],
    formatPercentage: (value?: number | null) => (value == null ? '-' : `${value} %`),
    formatPoints: (value?: number | null) => (value == null ? '-' : String(value)),
    formatResultMode: (mode?: string) => mode ?? 'Offen',
    formatResultSource: (source?: keyof typeof sourceLabels) => (source ? sourceLabels[source] : 'Keine Bewertung')
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
  props: ['icon'],
  template: '<button type="button" @click="$emit(\'click\')"><span>{{ icon }}</span><slot /></button>'
}
const formControlStub = {
  props: ['label'],
  template: '<label>{{ label }}</label>'
}

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
        'v-data-table': {
          props: ['items'],
          template:
            '<div><slot v-if="items.length === 0" name="no-data" /><div v-for="item in items" :key="item.studentId"><slot name="item.studentId" :item="item" /><slot name="item.points" :item="item" /><slot name="item.percentage" :item="item" /><slot name="item.manualGrade" :item="item" /><slot name="item.passStatus" :item="item" /><slot name="item.source" :item="item" /><slot name="item.actions" :item="item" /></div><slot name="bottom" /></div>'
        },
        'v-dialog': {
          props: ['modelValue'],
          template: '<div v-if="modelValue" class="dialog"><slot /></div>'
        },
        'v-divider': passThroughStub,
        'v-empty-state': {
          props: ['title', 'text'],
          template: '<div class="empty">{{ title }} {{ text }}</div>'
        },
        'v-icon': passThroughStub,
        'v-pagination': formControlStub,
        'v-progress-linear': {
          template: '<div class="loading" />'
        },
        'v-select': formControlStub,
        'v-text-field': formControlStub
      }
    }
  })

const automaticResult = {
  assessmentMode: 'AUTOMATIC',
  courseId: 'course-id',
  enrollmentId: 'enrollment-3',
  maxPoints: 100,
  passStatus: 'PASSED',
  percentage: 80,
  pointsAchieved: 80,
  source: 'AUTOMATIC_CALCULATION',
  studentId: '3'
}

describe('CourseResultsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows a loading state while the own result is requested', async () => {
    resultServiceMock.getMyResult.mockReturnValueOnce(new Promise(() => undefined))

    const wrapper = mountPanel(false)
    await nextTick()

    expect(wrapper.find('.loading').exists()).toBe(true)
  })

  it('shows a clear empty state for students without a result', async () => {
    resultServiceMock.getMyResult.mockResolvedValueOnce({
      courseId: 'course-id',
      enrollmentId: 'enrollment-3',
      passStatus: 'NOT_ASSESSED',
      studentId: '3'
    })

    const wrapper = mountPanel(false)
    await flushPromises()

    expect(wrapper.text()).toContain('Noch keine Bewertung vorhanden')
    expect(wrapper.text()).toContain('Noch nicht bewertet.')
  })

  it('shows student result details with source and non-color status text', async () => {
    resultServiceMock.getMyResult.mockResolvedValueOnce({
      ...automaticResult,
      comment: 'Gut gemacht.',
      manualGrade: '2.0',
      source: 'MANUAL_OVERRIDE'
    })

    const wrapper = mountPanel(false)
    await flushPromises()

    expect(wrapper.text()).toContain('Bestanden')
    expect(wrapper.text()).toContain('Erreichte Punkte80')
    expect(wrapper.text()).toContain('Maximal erreichbare Punkte100')
    expect(wrapper.text()).toContain('Manuell überschrieben')
    expect(wrapper.text()).toContain('Gut gemacht.')
  })

  it('ignores selected run ids for students and loads the own active result', async () => {
    resultServiceMock.getMyResult.mockResolvedValueOnce({
      courseId: 'course-id',
      enrollmentId: 'enrollment-3',
      passStatus: 'NOT_ASSESSED',
      studentId: '3'
    })

    mountPanel(false, {
      courseRunId: 'historical-run'
    })
    await flushPromises()

    expect(resultServiceMock.getMyResult).toHaveBeenCalledWith('course-id')
    expect(resultServiceMock.listResults).not.toHaveBeenCalled()
  })

  it('shows API errors', async () => {
    resultServiceMock.getMyResult.mockRejectedValueOnce(new Error('Kein Zugriff'))

    const wrapper = mountPanel(false)
    await flushPromises()

    expect(wrapper.text()).toContain('Kein Zugriff')
  })

  it('renders teacher overview and asks before overriding automatic results', async () => {
    resultServiceMock.listResults.mockResolvedValueOnce({
      items: [automaticResult],
      page: 1,
      pageSize: 10,
      total: 1
    })

    const wrapper = mountPanel(true)
    await flushPromises()

    expect(wrapper.text()).toContain('Bewertungen')
    expect(wrapper.text()).toContain('Student 3')
    expect(wrapper.text()).toContain('Automatisch berechnet')

    await wrapper
      .findAll('button')
      .find((button) => button.text().includes('Bewerten'))
      ?.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Automatische Bewertung überschreiben?')
  })

  it('validates manual points before saving', async () => {
    resultServiceMock.listResults.mockResolvedValueOnce({
      items: [automaticResult],
      page: 1,
      pageSize: 10,
      total: 1
    })

    const wrapper = mountPanel(true)
    await flushPromises()
    ;(wrapper.vm as any).fillManualForm(automaticResult)
    ;(wrapper.vm as any).manualForm.pointsAchieved = 101
    ;(wrapper.vm as any).manualForm.maxPoints = 100
    await nextTick()

    expect(wrapper.text()).toContain('Erreichte Punkte dürfen nicht über den maximal erreichbaren Punkten liegen.')
    await (wrapper.vm as any).saveManualResult()
    expect(resultServiceMock.saveManualResult).not.toHaveBeenCalled()
  })

  it('stores manual results from the teacher dialog', async () => {
    resultServiceMock.listResults.mockResolvedValueOnce({
      items: [automaticResult],
      page: 1,
      pageSize: 10,
      total: 1
    })
    resultServiceMock.saveManualResult.mockResolvedValueOnce({
      ...automaticResult,
      assessmentMode: 'MANUAL',
      manualGrade: '2.0',
      source: 'MANUAL_OVERRIDE'
    })

    const wrapper = mountPanel(true)
    await flushPromises()
    ;(wrapper.vm as any).fillManualForm(automaticResult)
    ;(wrapper.vm as any).manualForm.manualGrade = '2.0'
    ;(wrapper.vm as any).manualForm.passStatus = 'PASSED'
    await (wrapper.vm as any).saveManualResult()
    await flushPromises()

    expect(resultServiceMock.saveManualResult).toHaveBeenCalledWith('course-id', '3', expect.objectContaining({ manualGrade: '2.0' }))
    expect(wrapper.text()).toContain('Bewertung gespeichert.')
  })

  it('loads historical results by run and hides editing actions', async () => {
    resultServiceMock.listResults.mockResolvedValueOnce({
      items: [automaticResult],
      page: 1,
      pageSize: 10,
      total: 1
    })

    const wrapper = mountPanel(true, {
      courseRunId: 'run-1',
      readOnly: true
    })
    await flushPromises()

    expect(resultServiceMock.listResults).toHaveBeenCalledWith(
      'course-id',
      expect.objectContaining({
        page: 1,
        pageSize: 10
      }),
      'run-1'
    )
    expect(wrapper.text()).toContain('Historischer Kursdurchlauf')
    expect(wrapper.text()).not.toContain('Bewerten')
    expect(wrapper.text()).not.toContain('Berechnen')
  })
})
