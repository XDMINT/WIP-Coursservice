// @vitest-environment jsdom
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import CourseVersionsPanel from '../CourseVersionsPanel.vue'

const courseServiceMock = vi.hoisted(() => ({
  activateCourseVersion: vi.fn(),
  createCourseVersion: vi.fn(),
  deleteCourseVersion: vi.fn(),
  listCourseVersions: vi.fn()
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
  props: ['prependIcon', 'loading', 'disabled'],
  template: '<button type="button" :disabled="disabled" @click="$emit(\'click\')"><span>{{ prependIcon }}</span><slot /></button>'
}

const versionsFixture = [
  {
    id: 'version-2',
    courseId: 'course-id',
    courseRunId: 'run-2',
    courseRunLabel: 'Wintersemester 2026/27',
    versionNumber: 2,
    content: {
      course: {
        title: 'Aktive Version',
        description: 'Aktive Beschreibung'
      },
      courseRun: {
        label: 'Wintersemester 2026/27'
      },
      learningMaterials: [
        {
          id: 'material-1',
          title: 'Foliensatz',
          description: 'Slides zur aktiven Version',
          type: 'PRESENTATION',
          publicationStatus: 'PUBLISHED'
        }
      ],
      tasks: [
        {
          id: 'task-1',
          order: 1,
          title: 'Grundlagen',
          description: 'Erste Aufgabe der aktiven Version',
          unlockMode: 'IMMEDIATE',
          isPublished: true
        }
      ]
    },
    changeSummary: 'Aktualisiert',
    createdAt: '2026-01-02T10:00:00.000Z',
    createdBy: '1',
    isActive: true,
    status: 'PUBLISHED',
    sourceVersionId: 'old-version-2',
    sourceVersionNumber: 2,
    sourceVersionLabel: 'Bewährte Struktur',
    sourceRunLabel: 'Sommersemester 2026'
  },
  {
    id: 'version-1',
    courseId: 'course-id',
    courseRunId: 'run-2',
    courseRunLabel: 'Wintersemester 2026/27',
    versionNumber: 1,
    content: { course: { title: 'Alte Version' } },
    changeSummary: 'Initial',
    createdAt: '2026-01-01T10:00:00.000Z',
    createdBy: '1',
    isActive: false,
    status: 'PUBLISHED'
  }
]

const mountPanel = (canManage = false, extraProps: Partial<InstanceType<typeof CourseVersionsPanel>['$props']> = {}) =>
  mount(CourseVersionsPanel, {
    props: {
      canManage,
      courseId: 'course-id',
      courseRunId: 'run-2',
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
            '<div><slot v-if="items.length === 0" name="no-data" /><div v-for="item in items" :key="item.id" class="row"><slot name="item.versionNumber" :item="item" /><slot name="item.isActive" :item="item" /><span>{{ item.changeSummary }}</span><slot name="item.createdAt" :item="item" /><slot name="item.content" :item="item" /><slot name="item.actions" :item="item" /></div></div>'
        },
        'v-empty-state': {
          props: ['title', 'text'],
          template: '<div class="empty">{{ title }} {{ text }}</div>'
        },
        'v-icon': passThroughStub,
        'v-dialog': {
          props: ['modelValue'],
          template: '<div v-if="modelValue" class="dialog"><slot /></div>'
        },
        'v-progress-linear': {
          template: '<div class="loading" />'
        },
        'v-select': {
          props: ['modelValue'],
          emits: ['update:modelValue'],
          template: '<select :value="modelValue" @change="$emit(\'update:modelValue\', $event.target.value)"><slot /></select>'
        },
        'v-spacer': passThroughStub,
        'v-text-field': passThroughStub
      }
    }
  })

const findButtonByText = (wrapper: ReturnType<typeof mount>, text: string) => wrapper.findAll('button').find((button) => button.text().includes(text))

describe('CourseVersionsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows a loading state while versions are requested', async () => {
    courseServiceMock.listCourseVersions.mockReturnValueOnce(new Promise(() => undefined))

    const wrapper = mountPanel()
    await nextTick()

    expect(wrapper.find('.loading').exists()).toBe(true)
  })

  it('shows an empty state for courses without versions', async () => {
    courseServiceMock.listCourseVersions.mockResolvedValueOnce([])

    const wrapper = mountPanel()
    await flushPromises()

    expect(wrapper.text()).toContain('Keine Kursversionen vorhanden')
  })

  it('shows API errors', async () => {
    courseServiceMock.listCourseVersions.mockRejectedValueOnce(new Error('Kein Zugriff'))

    const wrapper = mountPanel()
    await flushPromises()

    expect(wrapper.text()).toContain('Kein Zugriff')
  })

  it('renders versions read-only for students', async () => {
    courseServiceMock.listCourseVersions.mockResolvedValueOnce(versionsFixture)

    const wrapper = mountPanel(false)
    await flushPromises()

    expect(courseServiceMock.listCourseVersions).toHaveBeenCalledWith('course-id', 'run-2')
    expect(wrapper.text()).toContain('Version 2')
    expect(wrapper.text()).toContain('Aktive Version')
    expect(wrapper.text()).toContain('1 Materialien · 1 Aufgaben')
    expect(wrapper.text()).toContain('Foliensatz')
    expect(wrapper.text()).toContain('Grundlagen')
    expect(wrapper.text()).toContain('Anzeigen')
    expect(wrapper.text()).not.toContain('Neue Version')
    expect(wrapper.text()).not.toContain('Aktivieren')
    expect(wrapper.text()).not.toContain('Löschen')
  })

  it('shows a hint when an older version is selected', async () => {
    courseServiceMock.listCourseVersions.mockResolvedValueOnce(versionsFixture)

    const wrapper = mountPanel(false)
    await flushPromises()
    ;(wrapper.vm as unknown as { selectVersion: (versionId: string) => void }).selectVersion('version-1')
    await flushPromises()

    expect(wrapper.text()).toContain('Du siehst Version 1 dieses Durchlaufs. Die aktuell aktive Version ist Version 2.')
    expect(wrapper.text()).toContain('Aktuelle Version anzeigen')
    expect(wrapper.text()).toContain('Legacy-Version ohne Aufgaben-/Material-Snapshot')
  })

  it('lets teachers create and activate versions', async () => {
    courseServiceMock.listCourseVersions
      .mockResolvedValueOnce(versionsFixture)
      .mockResolvedValueOnce(versionsFixture)
      .mockResolvedValueOnce(versionsFixture)
    courseServiceMock.activateCourseVersion.mockResolvedValueOnce(versionsFixture[1])
    courseServiceMock.createCourseVersion.mockResolvedValueOnce({
      ...versionsFixture[0],
      id: 'version-3',
      versionNumber: 3
    })

    const wrapper = mountPanel(true)
    await flushPromises()

    expect(wrapper.text()).toContain('Neue Version')
    await findButtonByText(wrapper, 'Aktivieren')?.trigger('click')
    await flushPromises()

    expect(courseServiceMock.activateCourseVersion).toHaveBeenCalledWith('course-id', 'version-1', 'run-2')

    await findButtonByText(wrapper, 'Neue Version')?.trigger('click')
    await flushPromises()

    expect(courseServiceMock.createCourseVersion).toHaveBeenCalledWith('course-id', '', true, 'run-2', {
      copyMode: 'ACTIVE',
      sourceVersionId: undefined
    })
  })

  it('shows source information and lets teachers delete inactive versions', async () => {
    courseServiceMock.listCourseVersions.mockResolvedValueOnce(versionsFixture).mockResolvedValueOnce([versionsFixture[0]])
    courseServiceMock.deleteCourseVersion.mockResolvedValueOnce(undefined)

    const wrapper = mountPanel(true)
    await flushPromises()

    expect(wrapper.text()).toContain('Diese Version basiert auf Sommersemester 2026 · Version 2 · Bewährte Struktur.')
    const deleteButtons = wrapper.findAll('button').filter((button) => button.text().includes('Löschen'))
    expect(deleteButtons[0].attributes('disabled')).toBeDefined()

    await deleteButtons[1].trigger('click')
    await flushPromises()
    expect(wrapper.find('.dialog').exists()).toBe(true)

    const confirmDeleteButton = wrapper.findAll('button').filter((button) => button.text().includes('Löschen')).at(-1)
    await confirmDeleteButton?.trigger('click')
    await flushPromises()

    expect(courseServiceMock.deleteCourseVersion).toHaveBeenCalledWith('course-id', 'run-2', 'version-1')
    expect(wrapper.text()).toContain('Kursversion wurde gelöscht.')
  })

  it('hides management actions in read-only historical views', async () => {
    courseServiceMock.listCourseVersions.mockResolvedValueOnce(versionsFixture)

    const wrapper = mountPanel(true, { readOnly: true })
    await flushPromises()

    expect(wrapper.text()).toContain('Verwaltungsaktionen sind deaktiviert')
    expect(wrapper.text()).not.toContain('Neue Version')
    expect(wrapper.text()).not.toContain('Aktivieren')
    expect(wrapper.text()).not.toContain('Löschen')
  })
})
