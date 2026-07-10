// @vitest-environment jsdom
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import LearningMaterialsPanel from '../LearningMaterialsPanel.vue'
import { DARK_THEME_NAME, LIGHT_THEME_NAME } from '@/services/theme.service'

const materialServiceMock = vi.hoisted(() => ({
  createExternalLink: vi.fn(),
  deleteMaterial: vi.fn(),
  downloadMaterial: vi.fn(),
  listMaterials: vi.fn(),
  publishMaterial: vi.fn(),
  updateMaterial: vi.fn(),
  updateSortOrder: vi.fn(),
  uploadMaterial: vi.fn(),
  withdrawMaterial: vi.fn()
}))

vi.mock('@/services/learningMaterial.service', () => ({
  default: materialServiceMock,
  LearningMaterialPublicationStatus: {
    ARCHIVED: 'ARCHIVED',
    DRAFT: 'DRAFT',
    PUBLISHED: 'PUBLISHED'
  },
  LearningMaterialType: {
    DOCUMENT: 'DOCUMENT',
    EXTERNAL_LINK: 'EXTERNAL_LINK',
    OTHER_FILE: 'OTHER_FILE',
    PRESENTATION: 'PRESENTATION',
    VIDEO: 'VIDEO'
  },
  formatLearningMaterialFileSize: (size?: number) => (size == null ? '' : `${size} B`)
}))

vi.mock('@/services/apiErrors', () => ({
  getApiErrorMessage: (error: Error) => error.message
}))

const passThroughStub = {
  template: '<div><slot /></div>'
}
const buttonStub = {
  emits: ['click'],
  props: ['icon', 'prependIcon'],
  template: '<button type="button" @click="$emit(\'click\')"><span>{{ icon }}</span><span>{{ prependIcon }}</span><slot /></button>'
}
const formControlStub = {
  props: ['label'],
  template: '<label>{{ label }}</label>'
}

const materialsFixture = [
  {
    id: 'material-1',
    courseId: 'course-id',
    title: 'Grundlagenfolien',
    description: 'Einführung',
    type: 'PRESENTATION',
    tags: ['demo'],
    fileSize: 2048,
    isPublished: true,
    publicationStatus: 'PUBLISHED',
    publishedAt: '2026-01-02T10:00:00.000Z',
    updatedAt: '2026-01-02T10:00:00.000Z',
    originalFileName: 'folien.pdf'
  },
  {
    id: 'material-2',
    courseId: 'course-id',
    title: 'Linkentwurf',
    description: '',
    type: 'EXTERNAL_LINK',
    tags: [],
    fileSize: undefined,
    isPublished: false,
    publicationStatus: 'DRAFT',
    publishedAt: null,
    updatedAt: '2026-01-03T10:00:00.000Z',
    url: 'https://example.com'
  }
]

const mountPanel = (canManage = false) =>
  mount(LearningMaterialsPanel, {
    props: {
      canManage,
      courseId: 'course-id'
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
        'v-col': passThroughStub,
        'v-data-table': {
          props: ['items'],
          template:
            '<div><slot v-if="items.length === 0" name="no-data" /><div v-for="(item, index) in items" :key="item.id"><slot name="item.type" :item="item" /><slot name="item.title" :item="item" /><slot name="item.tags" :item="item" /><slot name="item.fileSize" :item="item" /><slot name="item.publicationStatus" :item="item" /><slot name="item.actions" :item="item" :index="index" /></div></div>'
        },
        'v-dialog': {
          props: ['modelValue'],
          template: '<div v-if="modelValue" class="dialog"><slot /></div>'
        },
        'v-empty-state': {
          props: ['title', 'text'],
          template: '<div class="empty">{{ title }} {{ text }}</div>'
        },
        'v-expansion-panel': passThroughStub,
        'v-expansion-panel-text': passThroughStub,
        'v-expansion-panel-title': passThroughStub,
        'v-expansion-panels': passThroughStub,
        'v-file-input': formControlStub,
        'v-icon': passThroughStub,
        'v-progress-linear': {
          template: '<div class="loading" />'
        },
        VProgressLinear: {
          template: '<div class="loading" />'
        },
        'v-row': passThroughStub,
        'v-select': formControlStub,
        'v-snackbar': passThroughStub,
        'v-spacer': passThroughStub,
        'v-text-field': formControlStub
      }
    }
  })

const findButtonByText = (wrapper: ReturnType<typeof mount>, text: string) => wrapper.findAll('button').find((button) => button.text().includes(text))

describe('LearningMaterialsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows a loading state while materials are requested', async () => {
    materialServiceMock.listMaterials.mockReturnValueOnce(new Promise(() => undefined))

    const wrapper = mountPanel()
    await nextTick()

    expect(wrapper.find('.loading').exists()).toBe(true)
  })

  it('shows an empty state for courses without visible materials', async () => {
    materialServiceMock.listMaterials.mockResolvedValueOnce([])

    const wrapper = mountPanel()
    await flushPromises()

    expect(wrapper.text()).toContain('Keine Lernmaterialien vorhanden')
  })

  it('shows API errors', async () => {
    materialServiceMock.listMaterials.mockRejectedValueOnce(new Error('Kein Zugriff'))

    const wrapper = mountPanel()
    await flushPromises()

    expect(wrapper.text()).toContain('Kein Zugriff')
  })

  it('validates uploads before sending them', async () => {
    materialServiceMock.listMaterials.mockResolvedValueOnce([])

    const wrapper = mountPanel(true)
    await flushPromises()
    ;(wrapper.vm as unknown as { submitUpload: () => void }).submitUpload()
    await flushPromises()

    expect(wrapper.text()).toContain('Titel und Datei sind erforderlich.')
    expect(materialServiceMock.uploadMaterial).not.toHaveBeenCalled()
  })

  it.each([LIGHT_THEME_NAME, DARK_THEME_NAME])('renders management forms, status icons and edit dialog in %s', async (themeName) => {
    document.documentElement.dataset.theme = themeName
    materialServiceMock.listMaterials.mockResolvedValueOnce(materialsFixture)

    const wrapper = mountPanel(true)
    await flushPromises()

    expect(wrapper.text()).toContain('Datei hochladen')
    expect(wrapper.text()).toContain('Externen Link anlegen')
    expect(wrapper.text()).toContain('Freigegeben')
    expect(wrapper.text()).toContain('mdi-check-circle-outline')
    expect(wrapper.text()).toContain('Entwurf')
    expect(wrapper.text()).toContain('mdi-file-lock-outline')

    await findButtonByText(wrapper, 'mdi-pencil')?.trigger('click')
    await flushPromises()

    expect(wrapper.find('.dialog').exists()).toBe(true)
    expect(wrapper.text()).toContain('Material bearbeiten')
    expect(wrapper.text()).toContain('Beschreibung')
    expect(wrapper.text()).toContain('Tags')
  })
})
