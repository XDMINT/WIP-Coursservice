// @vitest-environment jsdom
import { flushPromises, mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import AuditEventsPanel from '../AuditEventsPanel.vue'

const courseServiceMock = vi.hoisted(() => ({
  listAuditEvents: vi.fn()
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
  template: '<button type="button" @click="$emit(\'click\')"><slot /></button>'
}

const dataTableStub = {
  props: ['items'],
  template: `
    <div class="audit-table">
      <div v-if="items.length === 0"><slot name="no-data" /></div>
      <div v-for="item in items" :key="item.id" class="audit-row">
        {{ item.eventType }} {{ item.actorUserId }} {{ item.actorRole }} {{ item.summary }}
      </div>
    </div>
  `
}

const mountPanel = () =>
  mount(AuditEventsPanel, {
    props: {
      courseId: 'course-id',
      courseRunId: 'run-1'
    },
    global: {
      stubs: {
        'v-alert': passThroughStub,
        'v-btn': buttonStub,
        'v-chip': passThroughStub,
        'v-data-table': dataTableStub,
        'v-empty-state': {
          props: ['title', 'text'],
          template: '<div class="empty-state">{{ title }} {{ text }}</div>'
        },
        'v-progress-linear': {
          template: '<div class="loading">loading</div>'
        },
        'v-select': passThroughStub,
        'v-text-field': passThroughStub
      }
    }
  })

describe('AuditEventsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows a loading state while audit events are requested', async () => {
    courseServiceMock.listAuditEvents.mockReturnValueOnce(new Promise(() => undefined))

    const wrapper = mountPanel()
    await nextTick()

    expect(wrapper.text()).toContain('loading')
  })

  it('loads and displays audit events for the selected run', async () => {
    courseServiceMock.listAuditEvents.mockResolvedValueOnce([
      {
        id: 'audit-1',
        eventType: 'COURSE_CREATED',
        actorUserId: '1',
        actorRole: 'TEACHER',
        courseRunId: 'run-1',
        courseVersionId: 'version-1',
        summary: 'Kurs erstellt: Webtechnologien',
        createdAt: '2026-07-14T12:00:00.000Z'
      }
    ])

    const wrapper = mountPanel()
    await flushPromises()

    expect(courseServiceMock.listAuditEvents).toHaveBeenCalledWith('course-id', {
      courseRunId: 'run-1',
      eventType: undefined,
      from: undefined,
      to: undefined,
      limit: 100
    })
    expect(wrapper.text()).toContain('COURSE_CREATED')
    expect(wrapper.text()).toContain('Kurs erstellt: Webtechnologien')
  })

  it('shows an empty state when no audit events exist', async () => {
    courseServiceMock.listAuditEvents.mockResolvedValueOnce([])

    const wrapper = mountPanel()
    await flushPromises()

    expect(wrapper.text()).toContain('Keine Audit-Ereignisse')
  })

  it('shows an error state when loading fails', async () => {
    courseServiceMock.listAuditEvents.mockRejectedValueOnce(new Error('Kein Zugriff'))

    const wrapper = mountPanel()
    await flushPromises()

    expect(wrapper.text()).toContain('Kein Zugriff')
  })
})
