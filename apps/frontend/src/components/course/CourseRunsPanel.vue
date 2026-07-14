<template>
  <div class="course-runs">
    <v-alert v-if="errorMessage" class="mb-4" type="error" variant="tonal">
      {{ errorMessage }}
    </v-alert>
    <v-alert v-if="successMessage" class="mb-4" type="success" variant="tonal">
      {{ successMessage }}
    </v-alert>

    <v-progress-linear v-if="loading" class="mb-4" color="primary" indeterminate />

    <section v-if="canManage" class="run-plan">
      <div class="run-plan__header">
        <div>
          <p class="eyebrow">Durchlaufplanung</p>
          <h3>{{ recurrenceLabel }}</h3>
        </div>
        <v-chip label size="small">
          Kursrhythmus
        </v-chip>
      </div>

      <v-progress-linear v-if="planLoading" class="mb-4" color="primary" indeterminate />

      <div class="run-plan__grid">
        <div>
          <dt>Aktueller Durchlauf</dt>
          <dd>{{ currentPlanRun?.label ?? 'Kein aktiver Durchlauf' }}</dd>
          <small>{{ currentPlanRun ? formatPeriod(currentPlanRun) : '-' }}</small>
        </div>
        <div>
          <dt>Nächster geplanter Durchlauf</dt>
          <dd>{{ nextPlannedRun?.label ?? 'Kein regelmäßiger Folgedurchlauf' }}</dd>
          <small>{{ nextPlannedRun ? formatPeriod(nextPlannedRun) : continuousHint }}</small>
        </div>
        <div>
          <dt>Inhaltsvorlage</dt>
          <dd>{{ selectedTemplateSummary }}</dd>
          <small>Teilnehmende, Fortschritte und Bewertungen werden nicht übernommen.</small>
        </div>
      </div>

      <div v-if="runPlan?.regularPlanningAvailable" class="run-plan__controls">
        <v-select
          v-model="planTemplateStrategy"
          :items="templateStrategyOptions"
          item-title="title"
          item-value="value"
          label="Inhaltsvorlage für neue Durchläufe"
          variant="underlined"
          hide-details
        />
        <v-select
          v-if="planTemplateStrategy === 'SPECIFIC_VERSION'"
          v-model="plannedSourceVersionId"
          :items="versionTemplates"
          :item-title="templateLabel"
          item-value="id"
          label="Konkrete Inhaltsversion"
          :loading="templatesLoading"
          variant="underlined"
          hide-details
        />
        <v-btn color="primary" prepend-icon="mdi-calendar-plus" :loading="creating" @click="createRun">
          {{ createRunButtonText }}
        </v-btn>
      </div>

      <v-alert v-else-if="runPlan" class="mt-4" type="info" variant="tonal">
        Dieser Kurs ist dauerhaft angelegt. Es wird nicht automatisch ein neuer Durchlauf erzeugt.
      </v-alert>

      <details v-if="isContinuousCourse" class="special-run">
        <summary>Sonderdurchlauf erstellen</summary>
        <div class="special-run__controls">
          <v-text-field v-model="specialRunLabel" label="Bezeichnung des Sonderdurchlaufs" variant="underlined" hide-details />
          <v-text-field v-model="specialRunStartDate" label="Startdatum" type="date" variant="underlined" hide-details />
          <v-text-field v-model="specialRunEndDate" label="Enddatum" type="date" variant="underlined" hide-details />
          <v-select
            v-model="specialRunSourceVersionId"
            clearable
            :items="versionTemplates"
            :item-title="templateLabel"
            item-value="id"
            label="Inhalte übernehmen aus"
            :loading="templatesLoading"
            variant="underlined"
            hide-details
          />
          <v-btn color="warning" variant="tonal" prepend-icon="mdi-calendar-alert" :loading="creatingSpecial" @click="createSpecialRun"> Sonderdurchlauf erstellen </v-btn>
        </div>
      </details>
    </section>

    <div v-if="runs.length > 0" class="run-selector">
      <v-select v-model="selectedRunId" label="Durchlauf" :items="runs" item-title="label" item-value="id" variant="underlined" hide-details @update:model-value="selectRun" />
      <v-chip label size="small">
        {{ recurrenceLabel }}
      </v-chip>
    </div>

    <v-alert v-if="selectedRun && !selectedRun.isActive" class="mb-4" type="warning" variant="tonal">
      {{ selectedRun.label }} ist nicht der aktive Durchlauf. Durchlaufbezogene Inhalte werden hier schreibgeschützt betrachtet.
    </v-alert>

    <v-data-table :headers="headers" :items="runs" item-value="id" :items-per-page="8" density="comfortable">
      <template #[`item.label`]="{ item }">
        <div class="run-label">
          <v-icon size="small">mdi-calendar-range</v-icon>
          <span>{{ item.label }}</span>
        </div>
      </template>

      <template #[`item.period`]="{ item }">
        {{ formatPeriod(item) }}
      </template>

      <template #[`item.status`]="{ item }">
        <v-chip label size="small">
          {{ statusLabel(item.status) }}
        </v-chip>
      </template>

      <template #[`item.isActive`]="{ item }">
        <v-chip :color="item.isActive ? 'success' : undefined" label size="small">
          <v-icon start>
            {{ item.isActive ? 'mdi-check-circle-outline' : 'mdi-archive-outline' }}
          </v-icon>
          {{ item.isActive ? 'Aktiv' : 'Archiv' }}
        </v-chip>
      </template>

      <template #[`item.counts`]="{ item }">
        {{ item.enrollmentCount ?? 0 }} TN · {{ item.versionCount ?? 0 }} Vers. · {{ item.materialCount ?? 0 }} Mat. · {{ item.taskCount ?? 0 }} Aufg.
      </template>

      <template #[`item.actions`]="{ item }">
        <div class="row-actions">
          <v-btn size="small" variant="text" prepend-icon="mdi-eye-outline" @click="selectRun(item.id)"> Anzeigen </v-btn>
          <v-btn v-if="canManage && !item.isActive" size="small" variant="text" prepend-icon="mdi-check" @click="activateRun(item.id)"> Aktivieren </v-btn>
          <v-btn v-if="canManage && !item.isActive" size="small" variant="text" color="error" prepend-icon="mdi-delete-outline" @click="openDeleteDialog(item)"> Löschen </v-btn>
        </div>
      </template>

      <template #no-data>
        <v-empty-state icon="mdi-calendar-blank-outline" title="Keine Durchläufe vorhanden" text="Für diesen Kurs wurde noch kein Durchlauf angelegt." />
      </template>
    </v-data-table>

    <section v-if="selectedRun" class="selected-run">
      <div class="selected-run__heading">
        <h3>{{ selectedRun.label }}</h3>
        <v-chip :color="selectedRun.isActive ? 'success' : undefined" label size="small">
          {{ selectedRun.isActive ? 'Aktiver Durchlauf' : 'Alter Durchlauf' }}
        </v-chip>
      </div>
      <dl>
        <div>
          <dt>Zeitraum</dt>
          <dd>{{ formatPeriod(selectedRun) }}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>{{ statusLabel(selectedRun.status) }}</dd>
        </div>
        <div>
          <dt>Teilnehmende</dt>
          <dd>{{ selectedRun.enrollmentCount ?? 0 }}</dd>
        </div>
        <div>
          <dt>Inhaltsversionen</dt>
          <dd>{{ selectedRun.versionCount ?? 0 }}</dd>
        </div>
        <div>
          <dt>Materialien</dt>
          <dd>{{ selectedRun.materialCount ?? 0 }}</dd>
        </div>
        <div>
          <dt>Aufgaben</dt>
          <dd>{{ selectedRun.taskCount ?? 0 }}</dd>
        </div>
      </dl>
    </section>

    <v-dialog v-model="deleteDialog" width="520px">
      <v-card>
        <v-card-title>{{ pendingDeletionModeTitle }}</v-card-title>
        <v-card-text>
          <p>
            {{ pendingRun?.label }} wird {{ pendingDeletionModeText }}.
          </p>
          <p class="delete-hint">
            Aktive oder letzte Durchläufe können nicht gelöscht werden. Durchläufe mit Teilnehmenden, Fortschritt, Bewertungen oder Abgaben werden archiviert.
          </p>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="deleteDialog = false"> Abbrechen </v-btn>
          <v-btn color="error" variant="flat" :loading="deleting" @click="confirmDeleteRun"> Bestätigen </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import courseService, { type CourseRecurrenceType, type CourseRun, type CourseRunPlan, type CourseRunTemplateStrategy, type CourseVersion } from '@/services/course.service'
import { getApiErrorMessage } from '@/services/apiErrors'

const props = defineProps<{
  courseId: string
  recurrenceType?: CourseRecurrenceType
  canManage: boolean
  selectedRunId?: string
}>()
const emit = defineEmits<{
  (event: 'updated'): void
  (event: 'selected', run: CourseRun): void
}>()

const loading = ref(false)
const planLoading = ref(false)
const templatesLoading = ref(false)
const creating = ref(false)
const creatingSpecial = ref(false)
const deleting = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const runs = ref<CourseRun[]>([])
const versionTemplates = ref<CourseVersion[]>([])
const runPlan = ref<CourseRunPlan | null>(null)
const selectedRunId = ref(props.selectedRunId ?? '')
const deleteDialog = ref(false)
const pendingRun = ref<CourseRun | null>(null)
const planTemplateStrategy = ref<CourseRunTemplateStrategy>('ACTIVE_VERSION_OF_CURRENT_RUN')
const plannedSourceVersionId = ref('')
const specialRunLabel = ref('')
const specialRunStartDate = ref('')
const specialRunEndDate = ref('')
const specialRunSourceVersionId = ref('')

const templateStrategyOptions: { title: string; value: CourseRunTemplateStrategy }[] = [
  {
    title: 'Aktive Inhaltsversion des aktuellen Durchlaufs',
    value: 'ACTIVE_VERSION_OF_CURRENT_RUN'
  },
  {
    title: 'Ausgewählte Inhaltsversion',
    value: 'SPECIFIC_VERSION'
  }
]

const headers = computed(() => [
  { title: 'Durchlauf', key: 'label' },
  { title: 'Zeitraum', key: 'period', sortable: false },
  { title: 'Status', key: 'status' },
  { title: 'Aktiv', key: 'isActive' },
  { title: 'Umfang', key: 'counts', sortable: false },
  { title: '', key: 'actions', sortable: false, align: 'end' as const }
])

const selectedRun = computed(() => runs.value.find((run) => run.id === selectedRunId.value))
const pendingDeletionWillArchive = computed(() => pendingRun.value ? runHasHistoricalData(pendingRun.value) : false)
const pendingDeletionModeTitle = computed(() => pendingDeletionWillArchive.value ? 'Durchlauf archivieren' : 'Durchlauf löschen')
const pendingDeletionModeText = computed(() => pendingDeletionWillArchive.value ? 'archiviert, weil historische Daten vorhanden sind' : 'endgültig gelöscht, sofern der Server keine historischen Daten findet')
const isContinuousCourse = computed(() => (runPlan.value?.recurrenceType ?? props.recurrenceType) === 'CONTINUOUS')
const recurrenceLabel = computed(() => {
  const recurrenceType = runPlan.value?.recurrenceType ?? props.recurrenceType

  if (recurrenceType === 'SEMESTER') return 'Semesterweise'
  if (recurrenceType === 'YEARLY') return 'Jährlich'
  return 'Dauerhaft'
})
const currentPlanRun = computed(() => runPlan.value?.currentRun ?? runs.value.find((run) => run.isActive))
const nextPlannedRun = computed(() => runPlan.value?.nextRun ?? null)
const continuousHint = 'Dieser Kurs ist dauerhaft angelegt.'
const createRunButtonText = computed(() => {
  const recurrenceType = runPlan.value?.recurrenceType ?? props.recurrenceType

  if (recurrenceType === 'SEMESTER') return 'Nächsten Semesterdurchlauf vorbereiten'
  if (recurrenceType === 'YEARLY') return 'Nächsten Jahresdurchlauf vorbereiten'
  return 'Nächsten Durchlauf vorbereiten'
})
const selectedTemplateSummary = computed(() => {
  if (planTemplateStrategy.value === 'SPECIFIC_VERSION') {
    const selectedTemplate = versionTemplates.value.find((version) => version.id === plannedSourceVersionId.value) ?? runPlan.value?.templateVersion

    return selectedTemplate ? templateLabel(selectedTemplate) : 'Keine konkrete Inhaltsversion ausgewählt'
  }

  return runPlan.value?.templateVersion ? templateLabel(runPlan.value.templateVersion) : 'Aktive Inhaltsversion des aktuellen Durchlaufs'
})

onMounted(() => {
  loadRuns()
  if (props.canManage) {
    loadVersionTemplates()
    loadRunPlan()
  }
})

watch(
  () => props.selectedRunId,
  (runId) => {
    if (runId && runId !== selectedRunId.value) {
      selectedRunId.value = runId
    }
  }
)

const setSelectedRunId = (runId: string) => {
  selectedRunId.value = runId
  const run = runs.value.find((candidate) => candidate.id === runId)

  if (run) {
    emit('selected', run)
  }
}

const loadRuns = () => {
  loading.value = true
  errorMessage.value = ''

  courseService
    .listCourseRuns(props.courseId)
    .then((response) => {
      runs.value = response
      if (!runs.value.some((run) => run.id === selectedRunId.value)) {
        setSelectedRunId(props.selectedRunId && runs.value.some((run) => run.id === props.selectedRunId) ? props.selectedRunId : (runs.value.find((run) => run.isActive)?.id ?? runs.value[0]?.id ?? ''))
      }
    })
    .catch((error) => {
      errorMessage.value = getApiErrorMessage(error)
    })
    .finally(() => {
      loading.value = false
    })
}

const loadVersionTemplates = () => {
  templatesLoading.value = true

  courseService
    .listCourseVersionTemplates(props.courseId)
    .then((response) => {
      versionTemplates.value = response
    })
    .catch((error) => {
      errorMessage.value = getApiErrorMessage(error)
    })
    .finally(() => {
      templatesLoading.value = false
    })
}

const syncRunPlanSelection = (plan: CourseRunPlan) => {
  planTemplateStrategy.value = plan.templateStrategy === 'SPECIFIC_VERSION'
    ? 'SPECIFIC_VERSION'
    : 'ACTIVE_VERSION_OF_CURRENT_RUN'
  plannedSourceVersionId.value = plan.templateStrategy === 'SPECIFIC_VERSION' && plan.templateVersion
    ? plan.templateVersion.id
    : ''
}

const loadRunPlan = () => {
  planLoading.value = true
  errorMessage.value = ''

  courseService
    .getCourseRunPlan(props.courseId)
    .then((plan) => {
      runPlan.value = plan
      syncRunPlanSelection(plan)
    })
    .catch((error) => {
      errorMessage.value = getApiErrorMessage(error)
    })
    .finally(() => {
      planLoading.value = false
    })
}

const createRun = () => {
  if (planTemplateStrategy.value === 'SPECIFIC_VERSION' && !plannedSourceVersionId.value) {
    errorMessage.value = 'Bitte wähle eine Inhaltsversion als Vorlage aus.'
    return
  }

  creating.value = true
  errorMessage.value = ''
  successMessage.value = ''

  courseService
    .updateCourseRunPlanTemplate(props.courseId, {
      strategy: planTemplateStrategy.value,
      sourceVersionId: planTemplateStrategy.value === 'SPECIFIC_VERSION'
        ? plannedSourceVersionId.value
        : null
    })
    .then((plan) => {
      runPlan.value = plan
      return courseService.createCourseRun(props.courseId, {
        status: 'PUBLISHED',
        activate: false
      })
    })
    .then((createdRun) => {
      setSelectedRunId(createdRun.id)
      successMessage.value = `${createdRun.label} wurde ohne Teilnehmende, Fortschritte und Bewertungen vorbereitet.`
      emit('updated')
      loadRuns()
      loadVersionTemplates()
      loadRunPlan()
    })
    .catch((error) => {
      errorMessage.value = getApiErrorMessage(error)
    })
    .finally(() => {
      creating.value = false
    })
}

const createSpecialRun = () => {
  creatingSpecial.value = true
  errorMessage.value = ''
  successMessage.value = ''

  courseService
    .createSpecialCourseRun(props.courseId, {
      label: specialRunLabel.value.trim() || undefined,
      startDate: specialRunStartDate.value || undefined,
      endDate: specialRunEndDate.value || undefined,
      sourceVersionId: specialRunSourceVersionId.value || undefined,
      status: 'PUBLISHED',
      activate: false
    })
    .then((createdRun) => {
      specialRunLabel.value = ''
      specialRunStartDate.value = ''
      specialRunEndDate.value = ''
      specialRunSourceVersionId.value = ''
      setSelectedRunId(createdRun.id)
      successMessage.value = `${createdRun.label} wurde als Sonderdurchlauf erstellt.`
      emit('updated')
      loadRuns()
      loadVersionTemplates()
      loadRunPlan()
    })
    .catch((error) => {
      errorMessage.value = getApiErrorMessage(error)
    })
    .finally(() => {
      creatingSpecial.value = false
    })
}

const activateRun = (runId: string) => {
  errorMessage.value = ''
  successMessage.value = ''

  courseService
    .activateCourseRun(props.courseId, runId)
    .then((run) => {
      setSelectedRunId(run.id)
      emit('updated')
      loadRuns()
    })
    .catch((error) => {
      errorMessage.value = getApiErrorMessage(error)
    })
}

const selectRun = (runId: string) => {
  setSelectedRunId(runId)
}

const runHasHistoricalData = (run: CourseRun) =>
  (run.enrollmentCount ?? 0) > 0 ||
  (run.progressCount ?? 0) > 0 ||
  (run.resultCount ?? 0) > 0 ||
  (run.assignmentCount ?? 0) > 0

const openDeleteDialog = (run: CourseRun) => {
  pendingRun.value = run
  deleteDialog.value = true
  errorMessage.value = ''
  successMessage.value = ''
}

const confirmDeleteRun = () => {
  if (!pendingRun.value) return

  deleting.value = true
  errorMessage.value = ''
  successMessage.value = ''

  courseService
    .deleteOrArchiveCourseRun(props.courseId, pendingRun.value.id)
    .then((result) => {
      deleteDialog.value = false
      successMessage.value = result.action === 'ARCHIVED' ? (result.reason ?? 'Durchlauf wurde archiviert.') : 'Durchlauf wurde gelöscht.'
      if (result.action === 'ARCHIVED' && result.run) {
        setSelectedRunId(result.run.id)
      }
      emit('updated')
      loadRuns()
    })
    .catch((error) => {
      errorMessage.value = getApiErrorMessage(error)
    })
    .finally(() => {
      deleting.value = false
    })
}

const formatDate = (value?: string) => {
  if (!value) return ''

  return new Intl.DateTimeFormat('de-DE', {
    dateStyle: 'medium'
  }).format(new Date(value))
}

const formatPeriod = (run: Pick<CourseRun, 'startDate' | 'endDate'>) => {
  const start = formatDate(run.startDate)
  const end = formatDate(run.endDate)

  if (start && end) return `${start} bis ${end}`
  if (start) return `ab ${start}`
  if (end) return `bis ${end}`
  return '-'
}

const statusLabel = (status: CourseRun['status']) => {
  if (status === 'PUBLISHED') return 'Veröffentlicht'
  if (status === 'ARCHIVED') return 'Archiviert'
  return 'Entwurf'
}

const templateLabel = (version: CourseVersion) => {
  const runLabel = version.courseRunLabel ?? 'Unbekannter Durchlauf'
  const summary = version.changeSummary || version.label || ''
  const activeSuffix = version.isActive ? ' · Aktive Version' : ''
  const summaryPart = summary ? ` · ${summary}` : ''
  const createdPart = version.createdAt ? ` · ${formatDate(version.createdAt)}` : ''

  return `${runLabel} · Version ${version.versionNumber}${summaryPart}${createdPart}${activeSuffix}`
}

defineExpose({
  activateRun,
  createRun,
  createSpecialRun,
  confirmDeleteRun,
  loadRunPlan,
  loadVersionTemplates,
  loadRuns,
  openDeleteDialog,
  selectRun,
  templateLabel
})
</script>

<style scoped lang="scss">
.course-runs {
  min-height: 320px;
}

.run-plan {
  border: 1px solid rgb(var(--v-theme-outline-variant));
  border-radius: 8px;
  margin-bottom: 20px;
  padding: 16px;
}

.run-plan__header,
.run-plan__controls,
.special-run__controls {
  display: flex;
  align-items: end;
  gap: 16px;
}

.run-plan__header {
  align-items: start;
  justify-content: space-between;
  margin-bottom: 16px;

  h3 {
    font-size: 1.1rem;
    font-weight: 600;
    margin: 2px 0 0;
  }
}

.eyebrow {
  color: rgb(var(--v-theme-on-surface-variant));
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0;
  margin: 0;
  text-transform: uppercase;
}

.run-plan__grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
  margin-bottom: 16px;

  dt {
    color: rgb(var(--v-theme-on-surface-variant));
    font-size: 0.8rem;
  }

  dd {
    font-weight: 600;
    margin: 4px 0;
  }

  small {
    color: rgb(var(--v-theme-on-surface-variant));
    display: block;
  }
}

.run-plan__controls {
  display: grid;
  grid-template-columns: minmax(220px, 0.9fr) minmax(260px, 1.2fr) auto;
}

.special-run {
  margin-top: 16px;

  summary {
    color: rgb(var(--v-theme-warning));
    cursor: pointer;
    font-weight: 600;
  }
}

.special-run__controls {
  display: grid;
  grid-template-columns: minmax(180px, 1fr) 150px 150px minmax(260px, 1.4fr) auto;
  margin-top: 12px;
}

.run-selector {
  display: flex;
  align-items: end;
  gap: 16px;
  margin-bottom: 16px;
}

.run-label,
.row-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.delete-hint {
  color: rgb(var(--v-theme-on-surface-variant));
  font-size: 0.9rem;
  margin-top: 12px;
}

.row-actions {
  justify-content: flex-end;
}

.selected-run {
  margin-top: 24px;

  &__heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 16px;

    h3 {
      margin: 0;
      font-size: 1.1rem;
      font-weight: 500;
    }
  }

  dl {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 12px;
    margin: 0;
  }

  div {
    padding-block: 8px;
    border-bottom: 1px solid rgb(var(--v-theme-outline-variant));
  }

  dt {
    color: rgb(var(--v-theme-on-surface-variant));
    font-size: 0.8rem;
  }

  dd {
    margin: 4px 0 0;
  }
}

@media (max-width: 900px) {
  .run-plan__controls,
  .run-plan__grid,
  .special-run__controls {
    grid-template-columns: 1fr;
  }

  .run-selector {
    align-items: stretch;
    flex-direction: column;
  }
}
</style>
