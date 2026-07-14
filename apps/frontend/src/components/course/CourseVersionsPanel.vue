<template>
  <div class="course-versions">
    <v-alert v-if="errorMessage" class="mb-4" type="error" variant="tonal">
      {{ errorMessage }}
    </v-alert>
    <v-alert v-if="successMessage" class="mb-4" type="success" variant="tonal">
      {{ successMessage }}
    </v-alert>

    <v-progress-linear v-if="loading" class="mb-4" color="primary" indeterminate />

    <v-alert v-if="readOnly" class="mb-4" type="info" variant="tonal">
      Diese Versionsansicht gehört zu einem historischen Durchlauf. Verwaltungsaktionen sind deaktiviert.
    </v-alert>

    <div v-if="canManageVersions" class="version-actions">
      <v-text-field v-model="newVersionSummary" label="Änderungsnotiz" variant="underlined" hide-details />
      <v-select v-model="newVersionCopyMode" :items="copyModeOptions" label="Inhalt" variant="underlined" hide-details />
      <v-select
        v-if="newVersionCopyMode === 'SOURCE'"
        v-model="newVersionSourceId"
        :items="versions"
        :item-title="versionOptionLabel"
        item-value="id"
        label="Quellversion"
        variant="underlined"
        hide-details
      />
      <v-btn color="primary" prepend-icon="mdi-source-branch-plus" :loading="creating" @click="createVersion"> Neue Version </v-btn>
    </div>

    <v-data-table :headers="headers" :items="versions" item-value="id" :items-per-page="6" density="comfortable">
      <template #[`item.versionNumber`]="{ item }"> Version {{ item.versionNumber }} </template>

      <template #[`item.isActive`]="{ item }">
        <v-chip :color="item.isActive ? 'success' : undefined" label size="small">
          <v-icon start>
            {{ item.isActive ? 'mdi-check-circle-outline' : 'mdi-archive-outline' }}
          </v-icon>
          {{ item.isActive ? 'Aktiv' : 'Archiv' }}
        </v-chip>
      </template>

      <template #[`item.createdAt`]="{ item }">
        {{ formatDate(item.createdAt) }}
      </template>

      <template #[`item.content`]="{ item }">
        <div class="content-preview">
          <strong>{{ snapshotCourseTitle(item) }}</strong>
          <span>{{ snapshotSummary(item) }}</span>
        </div>
      </template>

      <template #[`item.actions`]="{ item }">
        <div class="row-actions">
          <v-btn size="small" variant="text" prepend-icon="mdi-eye-outline" @click="selectVersion(item.id)"> Anzeigen </v-btn>
          <v-btn v-if="canManageVersions && !item.isActive" size="small" variant="text" prepend-icon="mdi-check" @click="activateVersion(item.id)"> Aktivieren </v-btn>
          <v-btn v-if="canManageVersions" size="small" variant="text" color="error" prepend-icon="mdi-delete-outline" :disabled="!canDeleteVersion(item)" @click="openDeleteDialog(item)"> Löschen </v-btn>
        </div>
      </template>

      <template #no-data>
        <v-empty-state icon="mdi-history" title="Keine Kursversionen vorhanden" text="Für diesen Kurs wurden noch keine Versionen gespeichert." />
      </template>
    </v-data-table>

    <section v-if="selectedVersion" class="selected-version">
      <v-alert v-if="activeVersion && selectedVersion.id !== activeVersion.id" class="mb-4" type="info" variant="tonal">
        Du siehst Version {{ selectedVersion.versionNumber }} dieses Durchlaufs. Die aktuell aktive Version ist Version {{ activeVersion.versionNumber }}.
      </v-alert>

      <v-alert v-if="selectedVersion.sourceVersionId" class="mb-4" type="info" variant="tonal">
        Diese Version basiert auf {{ sourceVersionDescription(selectedVersion) }}.
      </v-alert>

      <div class="selected-version__heading">
        <h3>Version {{ selectedVersion.versionNumber }}</h3>
        <v-btn v-if="activeVersion && selectedVersion.id !== activeVersion.id" size="small" variant="text" prepend-icon="mdi-history" @click="selectVersion(activeVersion.id)"> Aktuelle Version anzeigen </v-btn>
      </div>

      <p v-if="selectedVersion.changeSummary" class="selected-version__summary">
        {{ selectedVersion.changeSummary }}
      </p>

      <v-alert v-if="!selectedSnapshotHasVersionedContent" class="mb-4" type="warning" variant="tonal">
        Diese ältere Version enthält noch keinen Aufgaben- und Material-Snapshot. Erstelle eine neue Version, damit Aufgaben und Materialien mitgespeichert werden.
      </v-alert>

      <div class="content-detail">
        <section>
          <h4>Kursdaten</h4>
          <dl>
            <div>
              <dt>Titel</dt>
              <dd>{{ selectedSnapshot.course?.title ?? '-' }}</dd>
            </div>
            <div>
              <dt>Beschreibung</dt>
              <dd>{{ selectedSnapshot.course?.description ?? '-' }}</dd>
            </div>
            <div>
              <dt>Durchlauf</dt>
              <dd>{{ selectedSnapshot.courseRun?.label ?? '-' }}</dd>
            </div>
          </dl>
        </section>

        <section>
          <h4>Materialien</h4>
          <v-empty-state v-if="selectedMaterials.length === 0" icon="mdi-folder-open-outline" title="Keine Materialien im Snapshot" text="Diese Version enthält keine gespeicherten Lernmaterialien." />
          <ul v-else class="snapshot-list">
            <li v-for="material in selectedMaterials" :key="material.id ?? material.title">
              <strong>{{ material.title }}</strong>
              <span>{{ materialTypeLabel(material.type) }} · {{ material.publicationStatus ?? 'Status unbekannt' }}</span>
              <p v-if="material.description">{{ material.description }}</p>
            </li>
          </ul>
        </section>

        <section>
          <h4>Aufgaben</h4>
          <v-empty-state v-if="selectedTasks.length === 0" icon="mdi-clipboard-text-outline" title="Keine Aufgaben im Snapshot" text="Diese Version enthält keine gespeicherten Aufgaben." />
          <ul v-else class="snapshot-list">
            <li v-for="task in selectedTasks" :key="task.id ?? task.title">
              <strong>{{ task.order }}. {{ task.title }}</strong>
              <span>{{ task.unlockMode ?? 'Freischaltung unbekannt' }} · {{ task.isPublished ? 'Freigegeben' : 'Entwurf' }}</span>
              <p v-if="task.description">{{ task.description }}</p>
            </li>
          </ul>
        </section>
      </div>
    </section>

    <v-dialog v-model="deleteDialog" width="520px">
      <v-card>
        <v-card-title>Kursversion löschen</v-card-title>
        <v-card-text>
          <p>
            Version {{ pendingVersion?.versionNumber }} wird gelöscht. Die aktive oder einzige Version eines Durchlaufs kann nicht gelöscht werden.
          </p>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="deleteDialog = false"> Abbrechen </v-btn>
          <v-btn color="error" variant="flat" :loading="deleting" @click="confirmDeleteVersion"> Löschen </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import courseService, { type CourseVersion } from '@/services/course.service'
import { getApiErrorMessage } from '@/services/apiErrors'

const props = defineProps<{
  courseId: string
  courseRunId?: string
  canManage: boolean
  readOnly?: boolean
}>()
const emit = defineEmits<{
  (event: 'active-version', version: CourseVersion): void
  (event: 'updated'): void
}>()

const loading = ref(false)
const creating = ref(false)
const deleting = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const newVersionSummary = ref('')
const newVersionCopyMode = ref<'ACTIVE' | 'SOURCE' | 'EMPTY'>('ACTIVE')
const newVersionSourceId = ref('')
const versions = ref<CourseVersion[]>([])
const selectedVersionId = ref('')
const deleteDialog = ref(false)
const pendingVersion = ref<CourseVersion | null>(null)

const headers = computed(() => [
  { title: 'Version', key: 'versionNumber' },
  { title: 'Status', key: 'isActive' },
  { title: 'Änderung', key: 'changeSummary' },
  { title: 'Erstellt am', key: 'createdAt' },
  { title: 'Ersteller', key: 'createdBy' },
  { title: 'Snapshot', key: 'content', sortable: false },
  ...(props.canManage ? [{ title: '', key: 'actions', sortable: false, align: 'end' as const }] : [])
])

const canManageVersions = computed(() => props.canManage && props.readOnly !== true)
const activeVersion = computed(() => versions.value.find((version) => version.isActive))
const selectedVersion = computed(() => versions.value.find((version) => version.id === selectedVersionId.value))
const selectedSnapshot = computed(() => readVersionContent(selectedVersion.value?.content))
const selectedMaterials = computed(() => selectedSnapshot.value.learningMaterials ?? [])
const selectedTasks = computed(() => selectedSnapshot.value.tasks ?? [])
const selectedSnapshotHasVersionedContent = computed(() => hasVersionedContent(selectedVersion.value?.content))
const copyModeOptions = [
  { title: 'Aktive Version kopieren', value: 'ACTIVE' },
  { title: 'Andere Version kopieren', value: 'SOURCE' },
  { title: 'Leere Inhaltsversion', value: 'EMPTY' }
]

onMounted(() => {
  loadVersions()
})

watch(
  () => props.courseRunId,
  () => {
    selectedVersionId.value = ''
    loadVersions()
  }
)

const loadVersions = () => {
  loading.value = true
  errorMessage.value = ''

  courseService
    .listCourseVersions(props.courseId, props.courseRunId)
    .then((response) => {
      versions.value = response
      if (!versions.value.some((version) => version.id === selectedVersionId.value)) {
        selectedVersionId.value = activeVersion.value?.id ?? versions.value[0]?.id ?? ''
      }
      if (activeVersion.value) {
        emit('active-version', activeVersion.value)
      }
    })
    .catch((error) => {
      errorMessage.value = getApiErrorMessage(error)
    })
    .finally(() => {
      loading.value = false
    })
}

const createVersion = () => {
  if (newVersionCopyMode.value === 'SOURCE' && !newVersionSourceId.value) {
    errorMessage.value = 'Bitte wähle eine Quellversion aus.'
    return
  }

  creating.value = true
  errorMessage.value = ''
  successMessage.value = ''

  courseService
    .createCourseVersion(props.courseId, newVersionSummary.value, true, props.courseRunId, {
      copyMode: newVersionCopyMode.value,
      sourceVersionId: newVersionCopyMode.value === 'SOURCE' ? newVersionSourceId.value : undefined
    })
    .then(() => {
      newVersionSummary.value = ''
      newVersionCopyMode.value = 'ACTIVE'
      newVersionSourceId.value = ''
      emit('updated')
      loadVersions()
    })
    .catch((error) => {
      errorMessage.value = getApiErrorMessage(error)
    })
    .finally(() => {
      creating.value = false
    })
}

const activateVersion = (versionId: string) => {
  errorMessage.value = ''
  successMessage.value = ''

  courseService
    .activateCourseVersion(props.courseId, versionId, props.courseRunId)
    .then(() => {
      emit('updated')
      loadVersions()
    })
    .catch((error) => {
      errorMessage.value = getApiErrorMessage(error)
    })
}

const selectVersion = (versionId: string) => {
  selectedVersionId.value = versionId
}

const versionOptionLabel = (version: CourseVersion) => {
  const label = version.label || version.changeSummary || ''
  const summary = label ? ` · ${label}` : ''
  const active = version.isActive ? ' · aktiv' : ''

  return `Version ${version.versionNumber}${summary}${active}`
}

const canDeleteVersion = (version: CourseVersion) => !version.isActive && versions.value.length > 1

const openDeleteDialog = (version: CourseVersion) => {
  if (!canDeleteVersion(version)) return

  pendingVersion.value = version
  deleteDialog.value = true
  errorMessage.value = ''
  successMessage.value = ''
}

const confirmDeleteVersion = () => {
  const version = pendingVersion.value
  const runId = props.courseRunId ?? version?.courseRunId

  if (!version || !runId) {
    errorMessage.value = 'Diese Version kann ohne Kursdurchlauf nicht gelöscht werden.'
    return
  }

  deleting.value = true
  errorMessage.value = ''
  successMessage.value = ''

  courseService
    .deleteCourseVersion(props.courseId, runId, version.id)
    .then(() => {
      deleteDialog.value = false
      pendingVersion.value = null
      successMessage.value = 'Kursversion wurde gelöscht.'
      emit('updated')
      loadVersions()
    })
    .catch((error) => {
      errorMessage.value = getApiErrorMessage(error)
    })
    .finally(() => {
      deleting.value = false
    })
}

const formatDate = (value?: string) => {
  if (!value) return '-'

  return new Intl.DateTimeFormat('de-DE', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value))
}

type SnapshotMaterial = {
  id?: string
  title?: string
  description?: string
  type?: string
  publicationStatus?: string
}

type SnapshotTask = {
  id?: string
  title?: string
  description?: string
  order?: number
  unlockMode?: string
  isPublished?: boolean
}

type VersionSnapshot = {
  course?: {
    title?: string
    description?: string
  }
  courseRun?: {
    label?: string
  }
  learningMaterials?: SnapshotMaterial[]
  tasks?: SnapshotTask[]
}

const readVersionContent = (content?: Record<string, unknown>): VersionSnapshot => {
  const snapshot = (content ?? {}) as VersionSnapshot

  return {
    course: snapshot.course,
    courseRun: snapshot.courseRun,
    learningMaterials: Array.isArray(snapshot.learningMaterials) ? snapshot.learningMaterials : [],
    tasks: Array.isArray(snapshot.tasks) ? snapshot.tasks : []
  }
}

const snapshotCourseTitle = (version: CourseVersion) => readVersionContent(version.content).course?.title ?? 'Ohne Kurstitel'

const snapshotSummary = (version: CourseVersion) => {
  if (!hasVersionedContent(version.content)) {
    return 'Legacy-Version ohne Aufgaben-/Material-Snapshot'
  }

  const snapshot = readVersionContent(version.content)
  const materialCount = snapshot.learningMaterials?.length ?? 0
  const taskCount = snapshot.tasks?.length ?? 0

  return `${materialCount} Materialien · ${taskCount} Aufgaben`
}

const sourceVersionDescription = (version: CourseVersion) => {
  const runLabel = version.sourceRunLabel ?? 'einem früheren Durchlauf'
  const versionLabel = version.sourceVersionNumber
    ? `Version ${version.sourceVersionNumber}`
    : 'einer früheren Version'
  const summary = version.sourceVersionLabel ? ` · ${version.sourceVersionLabel}` : ''

  return `${runLabel} · ${versionLabel}${summary}`
}

function hasVersionedContent(content?: Record<string, unknown>) {
  return (
    Object.prototype.hasOwnProperty.call(content ?? {}, 'learningMaterials') &&
    Object.prototype.hasOwnProperty.call(content ?? {}, 'tasks')
  )
}

const materialTypeLabel = (type?: string) => {
  if (type === 'DOCUMENT') return 'Dokument'
  if (type === 'PRESENTATION') return 'Präsentation'
  if (type === 'VIDEO') return 'Video'
  if (type === 'EXTERNAL_LINK') return 'Link'
  if (type === 'OTHER_FILE') return 'Datei'
  return 'Material'
}

defineExpose({
  activateVersion,
  canDeleteVersion,
  confirmDeleteVersion,
  createVersion,
  loadVersions,
  openDeleteDialog,
  selectVersion,
  sourceVersionDescription,
  snapshotSummary
})
</script>

<style scoped lang="scss">
.course-versions {
  min-height: 320px;
}

.version-actions {
  display: grid;
  grid-template-columns: minmax(220px, 1fr) minmax(180px, 220px) minmax(220px, 1fr) auto;
  gap: 16px;
  align-items: end;
  margin-bottom: 20px;
}

.row-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.content-preview {
  display: grid;
  gap: 4px;
  max-width: min(520px, 48vw);

  span {
    color: rgb(var(--v-theme-on-surface-variant));
    font-size: 0.85rem;
  }
}

.selected-version {
  margin-top: 24px;

  &__heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 12px;

    h3 {
      margin: 0;
      font-size: 1.1rem;
      font-weight: 500;
    }
  }

  &__summary {
    margin: 0 0 12px;
  }
}

.content-detail {
  display: grid;
  gap: 20px;

  h4 {
    font-size: 1rem;
    font-weight: 500;
    margin: 0 0 10px;
  }

  dl {
    display: grid;
    gap: 10px;
    margin: 0;
  }

  dt {
    color: rgb(var(--v-theme-on-surface-variant));
    font-size: 0.8rem;
  }

  dd {
    margin: 2px 0 0;
  }
}

.snapshot-list {
  display: grid;
  gap: 10px;
  list-style: none;
  margin: 0;
  padding: 0;

  li {
    border-bottom: 1px solid rgb(var(--v-theme-outline-variant));
    padding-bottom: 10px;
  }

  span {
    color: rgb(var(--v-theme-on-surface-variant));
    display: block;
    font-size: 0.85rem;
    margin-top: 2px;
  }

  p {
    margin: 6px 0 0;
  }
}

@media (max-width: 760px) {
  .version-actions {
    grid-template-columns: 1fr;
  }

  .content-preview {
    max-width: 72vw;
  }
}
</style>
