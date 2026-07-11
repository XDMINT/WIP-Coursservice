<template>
  <div class="course-results">
    <v-alert
      v-if="errorMessage"
      class="mb-4"
      type="error"
      variant="tonal"
    >
      {{ errorMessage }}
    </v-alert>

    <v-alert
      v-if="successMessage"
      class="mb-4"
      type="success"
      variant="tonal"
    >
      {{ successMessage }}
    </v-alert>

    <v-progress-linear
      v-if="loading"
      class="mb-4"
      color="primary"
      indeterminate
    />

    <template v-else-if="canManage">
      <section class="results-section">
        <div class="section-toolbar">
          <div>
            <h2>Bewertungen</h2>
            <p>Kursergebnisse einsehen, manuell bewerten oder automatisch aus Aufgabenpunkten berechnen.</p>
          </div>
          <div class="toolbar-actions">
            <v-btn
              variant="text"
              @click="loadTeacherResults"
            >
              <v-icon start>
                mdi-refresh
              </v-icon>
              Aktualisieren
            </v-btn>
            <v-btn
              color="primary"
              variant="outlined"
              :loading="saving"
              @click="recalculateAllResults"
            >
              <v-icon start>
                mdi-calculator-variant-outline
              </v-icon>
              Alle neu berechnen
            </v-btn>
          </div>
        </div>

        <div class="filter-bar">
          <v-select
            v-model="passStatusFilter"
            :items="passStatusFilterOptions"
            item-title="title"
            item-value="value"
            label="Status"
            density="compact"
            hide-details
          />
          <v-select
            v-model="sourceFilter"
            :items="sourceFilterOptions"
            item-title="title"
            item-value="value"
            label="Quelle"
            density="compact"
            hide-details
          />
        </div>

        <v-data-table
          :headers="teacherHeaders"
          :items="teacherResults"
          item-value="studentId"
          :items-per-page="pageSize"
          density="comfortable"
        >
          <template #[`item.studentId`]="{ item }">
            <strong>Student {{ item.studentId }}</strong>
          </template>

          <template #[`item.points`]="{ item }">
            {{ formatPoints(item.pointsAchieved) }} / {{ formatPoints(item.maxPoints) }}
          </template>

          <template #[`item.percentage`]="{ item }">
            {{ formatPercentage(item.percentage) }}
          </template>

          <template #[`item.manualGrade`]="{ item }">
            {{ item.manualGrade || '-' }}
          </template>

          <template #[`item.passStatus`]="{ item }">
            <v-chip
              :color="getPassStatusPresentation(item.passStatus).color"
              label
              size="small"
            >
              <v-icon start>
                {{ getPassStatusPresentation(item.passStatus).icon }}
              </v-icon>
              {{ formatPassStatus(item.passStatus) }}
            </v-chip>
          </template>

          <template #[`item.source`]="{ item }">
            <v-chip
              label
              size="small"
              variant="outlined"
            >
              <v-icon start>
                {{ getSourceIcon(item.source) }}
              </v-icon>
              {{ formatResultSource(item.source) }}
            </v-chip>
          </template>

          <template #[`item.actions`]="{ item }">
            <div class="table-actions">
              <v-btn
                size="small"
                variant="text"
                @click="openManualDialog(item)"
              >
                <v-icon start>
                  mdi-pencil
                </v-icon>
                Bewerten
              </v-btn>
              <v-btn
                size="small"
                variant="text"
                @click="recalculateResult(item)"
              >
                <v-icon start>
                  mdi-calculator-variant-outline
                </v-icon>
                Berechnen
              </v-btn>
            </div>
          </template>

          <template #no-data>
            <v-empty-state
              icon="mdi-account-school-outline"
              title="Keine Teilnehmenden gefunden"
              text="Für die aktuelle Filterung liegen keine Bewertungen vor."
            />
          </template>

          <template #bottom>
            <v-divider />
            <div class="table-footer">
              <span>{{ resultList.total }} Einträge</span>
              <v-pagination
                v-model="page"
                :length="pageCount"
                :total-visible="5"
                density="compact"
              />
            </div>
          </template>
        </v-data-table>
      </section>
    </template>

    <template v-else>
      <section class="results-section">
        <div class="section-toolbar">
          <div>
            <h2>Meine Bewertung</h2>
            <p>{{ studentSummary }}</p>
          </div>
        </div>

        <v-empty-state
          v-if="!myResult || myResult.passStatus === CoursePassStatus.NOT_ASSESSED"
          icon="mdi-clipboard-clock-outline"
          title="Noch keine Bewertung vorhanden"
          text="Ihre Bewertung wurde noch nicht veröffentlicht oder berechnet."
        />

        <div
          v-else
          class="result-summary"
        >
          <div class="result-summary__status">
            <v-icon
              :color="getPassStatusPresentation(myResult.passStatus).color"
              size="36"
            >
              {{ getPassStatusPresentation(myResult.passStatus).icon }}
            </v-icon>
            <div>
              <span>Bestehensstatus</span>
              <strong>{{ formatPassStatus(myResult.passStatus) }}</strong>
            </div>
          </div>

          <dl class="result-details">
            <div>
              <dt>Erreichte Punkte</dt>
              <dd>{{ formatPoints(myResult.pointsAchieved) }}</dd>
            </div>
            <div>
              <dt>Maximal erreichbare Punkte</dt>
              <dd>{{ formatPoints(myResult.maxPoints) }}</dd>
            </div>
            <div>
              <dt>Prozentwert</dt>
              <dd>{{ formatPercentage(myResult.percentage) }}</dd>
            </div>
            <div>
              <dt>Note / manuelle Bewertung</dt>
              <dd>{{ myResult.manualGrade || '-' }}</dd>
            </div>
            <div>
              <dt>Bewertungsquelle</dt>
              <dd>{{ formatResultSource(myResult.source) }}</dd>
            </div>
            <div>
              <dt>Bewertungsmodus</dt>
              <dd>{{ formatResultMode(myResult.assessmentMode) }}</dd>
            </div>
          </dl>

          <v-alert
            v-if="myResult.comment"
            type="info"
            variant="tonal"
            density="comfortable"
          >
            {{ myResult.comment }}
          </v-alert>
        </div>
      </section>
    </template>

    <v-dialog
      v-model="manualDialogOpen"
      max-width="720"
    >
      <v-card>
        <v-card-title>Bewertung eintragen</v-card-title>
        <v-card-text>
          <div class="manual-form">
            <v-select
              v-model="manualForm.passStatus"
              :items="manualPassStatusOptions"
              item-title="title"
              item-value="value"
              label="Bestehensstatus"
              density="compact"
            />
            <v-text-field
              v-model.number="manualForm.pointsAchieved"
              label="Erreichte Punkte"
              type="number"
              density="compact"
            />
            <v-text-field
              v-model.number="manualForm.maxPoints"
              label="Maximal erreichbare Punkte"
              type="number"
              density="compact"
            />
            <v-text-field
              v-model="manualForm.manualGrade"
              label="Note / Bewertung"
              density="compact"
            />
            <v-text-field
              v-model="manualForm.comment"
              label="Kommentar"
              density="compact"
            />
          </div>
          <v-alert
            v-if="manualValidationMessage"
            type="warning"
            variant="tonal"
            density="compact"
          >
            {{ manualValidationMessage }}
          </v-alert>
        </v-card-text>
        <v-card-actions class="dialog-actions">
          <v-btn
            variant="text"
            @click="manualDialogOpen = false"
          >
            Abbrechen
          </v-btn>
          <v-btn
            color="primary"
            :disabled="Boolean(manualValidationMessage)"
            :loading="saving"
            @click="saveManualResult"
          >
            Speichern
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog
      v-model="overwriteDialogOpen"
      max-width="520"
    >
      <v-card>
        <v-card-title>Automatische Bewertung überschreiben?</v-card-title>
        <v-card-text>Diese Bewertung wurde automatisch berechnet. Eine manuelle Eingabe wird als Überschreibung dokumentiert.</v-card-text>
        <v-card-actions class="dialog-actions">
          <v-btn
            variant="text"
            @click="overwriteDialogOpen = false"
          >
            Abbrechen
          </v-btn>
          <v-btn
            color="primary"
            @click="confirmManualOverride"
          >
            Überschreiben
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import courseResultService, { CoursePassStatus, CourseResultSource, formatPassStatus, formatPercentage, formatPoints, formatResultMode, formatResultSource, type CourseResult, type CourseResultList } from '@/services/courseResult.service'
import { getApiErrorMessage } from '@/services/apiErrors'

const props = defineProps<{
  courseId: string | number
  canManage: boolean
}>()

const loading = ref(false)
const saving = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const myResult = ref<CourseResult | null>(null)
const resultList = ref<CourseResultList>({
  items: [],
  page: 1,
  pageSize: 10,
  total: 0
})
const page = ref(1)
const pageSize = ref(10)
const passStatusFilter = ref<CoursePassStatus | ''>('')
const sourceFilter = ref<CourseResultSource | ''>('')
const manualDialogOpen = ref(false)
const overwriteDialogOpen = ref(false)
const editingResult = ref<CourseResult | null>(null)
const pendingOverrideResult = ref<CourseResult | null>(null)

const manualForm = reactive({
  comment: '',
  manualGrade: '',
  maxPoints: null as number | null,
  passStatus: CoursePassStatus.PASSED,
  pointsAchieved: null as number | null
})

const teacherHeaders = [
  { title: 'Teilnehmer', key: 'studentId' },
  { title: 'Punkte', key: 'points', sortable: false },
  { title: 'Prozent', key: 'percentage' },
  { title: 'Note', key: 'manualGrade' },
  { title: 'Status', key: 'passStatus' },
  { title: 'Quelle', key: 'source' },
  { title: '', key: 'actions', sortable: false, align: 'end' as const }
]

const passStatusFilterOptions = [
  { title: 'Alle', value: '' },
  { title: formatPassStatus(CoursePassStatus.NOT_ASSESSED), value: CoursePassStatus.NOT_ASSESSED },
  { title: formatPassStatus(CoursePassStatus.PASSED), value: CoursePassStatus.PASSED },
  { title: formatPassStatus(CoursePassStatus.FAILED), value: CoursePassStatus.FAILED }
]

const sourceFilterOptions = [
  { title: 'Alle', value: '' },
  { title: formatResultSource(CourseResultSource.AUTOMATIC_CALCULATION), value: CourseResultSource.AUTOMATIC_CALCULATION },
  { title: formatResultSource(CourseResultSource.MANUAL_ENTRY), value: CourseResultSource.MANUAL_ENTRY },
  { title: formatResultSource(CourseResultSource.MANUAL_OVERRIDE), value: CourseResultSource.MANUAL_OVERRIDE }
]

const manualPassStatusOptions = [
  { title: formatPassStatus(CoursePassStatus.PASSED), value: CoursePassStatus.PASSED },
  { title: formatPassStatus(CoursePassStatus.FAILED), value: CoursePassStatus.FAILED }
]

const teacherResults = computed(() => resultList.value.items)
const pageCount = computed(() => Math.max(1, Math.ceil(resultList.value.total / resultList.value.pageSize)))
const studentSummary = computed(() => {
  if (!myResult.value || myResult.value.passStatus === CoursePassStatus.NOT_ASSESSED) {
    return 'Noch nicht bewertet.'
  }

  return `${formatPassStatus(myResult.value.passStatus)} mit ${formatPercentage(myResult.value.percentage)}.`
})

const manualValidationMessage = computed(() => {
  const pointsAchieved = manualForm.pointsAchieved
  const maxPoints = manualForm.maxPoints
  const hasValue = (value: unknown) => value !== null && value !== undefined && value !== ''
  const hasPoints = hasValue(pointsAchieved)
  const hasMaxPoints = hasValue(maxPoints)

  if (hasPoints !== hasMaxPoints) {
    return 'Erreichte und maximale Punkte müssen gemeinsam angegeben werden.'
  }

  if (hasPoints && Number(pointsAchieved) < 0) {
    return 'Punkte dürfen nicht negativ sein.'
  }

  if (hasMaxPoints && Number(maxPoints) < 0) {
    return 'Maximale Punkte dürfen nicht negativ sein.'
  }

  if (hasPoints && hasMaxPoints && Number(pointsAchieved) > Number(maxPoints)) {
    return 'Erreichte Punkte dürfen nicht über den maximal erreichbaren Punkten liegen.'
  }

  return ''
})

onMounted(() => {
  loadData()
})

watch(
  () => [props.courseId, props.canManage],
  () => loadData()
)

watch([page, passStatusFilter, sourceFilter], () => {
  if (props.canManage) {
    loadTeacherResults()
  }
})

const loadData = () => {
  if (props.canManage) {
    return loadTeacherResults()
  }

  return loadStudentResult()
}

const withLoading = async (action: () => Promise<void>) => {
  loading.value = true
  errorMessage.value = ''

  try {
    await action()
  } catch (error) {
    errorMessage.value = getApiErrorMessage(error)
  } finally {
    loading.value = false
  }
}

const loadStudentResult = () =>
  withLoading(async () => {
    myResult.value = await courseResultService.getMyResult(props.courseId)
  })

const loadTeacherResults = () =>
  withLoading(async () => {
    resultList.value = await courseResultService.listResults(props.courseId, {
      page: page.value,
      pageSize: pageSize.value,
      passStatus: passStatusFilter.value,
      source: sourceFilter.value
    })
  })

const updateResultInList = (updatedResult: CourseResult) => {
  const index = resultList.value.items.findIndex((result) => result.studentId === updatedResult.studentId)

  if (index >= 0) {
    resultList.value.items.splice(index, 1, updatedResult)
    return
  }

  resultList.value.items.push(updatedResult)
}

const fillManualForm = (result: CourseResult) => {
  editingResult.value = result
  manualForm.passStatus = result.passStatus === CoursePassStatus.FAILED ? CoursePassStatus.FAILED : CoursePassStatus.PASSED
  manualForm.pointsAchieved = result.pointsAchieved ?? null
  manualForm.maxPoints = result.maxPoints ?? null
  manualForm.manualGrade = result.manualGrade ?? ''
  manualForm.comment = result.comment ?? ''
  manualDialogOpen.value = true
}

const openManualDialog = (result: CourseResult) => {
  if (result.source === CourseResultSource.AUTOMATIC_CALCULATION) {
    pendingOverrideResult.value = result
    overwriteDialogOpen.value = true
    return
  }

  fillManualForm(result)
}

const confirmManualOverride = () => {
  overwriteDialogOpen.value = false

  if (pendingOverrideResult.value) {
    fillManualForm(pendingOverrideResult.value)
  }

  pendingOverrideResult.value = null
}

const saveManualResult = async () => {
  if (!editingResult.value || manualValidationMessage.value) return

  saving.value = true
  errorMessage.value = ''

  try {
    const updatedResult = await courseResultService.saveManualResult(props.courseId, editingResult.value.studentId, {
      comment: manualForm.comment || null,
      manualGrade: manualForm.manualGrade || null,
      maxPoints: manualForm.maxPoints,
      passStatus: manualForm.passStatus,
      pointsAchieved: manualForm.pointsAchieved
    })
    updateResultInList(updatedResult)
    successMessage.value = 'Bewertung gespeichert.'
    manualDialogOpen.value = false
  } catch (error) {
    errorMessage.value = getApiErrorMessage(error)
  } finally {
    saving.value = false
  }
}

const recalculateResult = async (result: CourseResult) => {
  saving.value = true
  errorMessage.value = ''

  try {
    const updatedResult = await courseResultService.recalculateResult(props.courseId, result.studentId)
    updateResultInList(updatedResult)
    successMessage.value = 'Bewertung neu berechnet.'
  } catch (error) {
    errorMessage.value = getApiErrorMessage(error)
  } finally {
    saving.value = false
  }
}

const recalculateAllResults = async () => {
  saving.value = true
  errorMessage.value = ''

  try {
    resultList.value = await courseResultService.recalculateAll(props.courseId)
    page.value = resultList.value.page
    successMessage.value = 'Alle Bewertungen wurden neu berechnet.'
  } catch (error) {
    errorMessage.value = getApiErrorMessage(error)
  } finally {
    saving.value = false
  }
}

const getPassStatusPresentation = (status: CoursePassStatus) => {
  const presentation = {
    [CoursePassStatus.FAILED]: {
      color: 'error',
      icon: 'mdi-close-circle-outline'
    },
    [CoursePassStatus.NOT_ASSESSED]: {
      color: 'status-locked',
      icon: 'mdi-clock-outline'
    },
    [CoursePassStatus.PASSED]: {
      color: 'success',
      icon: 'mdi-check-circle-outline'
    }
  }

  return presentation[status]
}

const getSourceIcon = (source?: CourseResultSource) => {
  if (source === CourseResultSource.AUTOMATIC_CALCULATION) return 'mdi-calculator-variant-outline'
  if (source === CourseResultSource.MANUAL_OVERRIDE) return 'mdi-pencil-alert-outline'
  if (source === CourseResultSource.MANUAL_ENTRY) return 'mdi-pencil-outline'
  return 'mdi-minus-circle-outline'
}
</script>

<style scoped lang="scss">
.course-results,
.results-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.section-toolbar {
  align-items: flex-start;
  display: flex;
  gap: 16px;
  justify-content: space-between;

  h2 {
    font-size: 1.25rem;
    margin: 0 0 4px;
  }

  p {
    color: rgb(var(--v-theme-on-surface-variant));
    margin: 0;
  }
}

.toolbar-actions,
.table-actions,
.dialog-actions {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-end;
}

.filter-bar {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(2, minmax(180px, 260px));
}

.result-summary {
  background: rgb(var(--v-theme-surface));
  border: 1px solid rgba(var(--v-theme-outline), 0.28);
  border-radius: 8px;
  display: grid;
  gap: 18px;
  padding: 18px;
}

.result-summary__status {
  align-items: center;
  display: flex;
  gap: 12px;

  span {
    color: rgb(var(--v-theme-on-surface-variant));
    display: block;
    font-size: 0.9rem;
  }

  strong {
    display: block;
    font-size: 1.15rem;
  }
}

.result-details {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  margin: 0;

  div {
    background: rgb(var(--v-theme-surface-muted));
    border-radius: 8px;
    padding: 12px;
  }

  dt {
    color: rgb(var(--v-theme-on-surface-variant));
    font-size: 0.85rem;
  }

  dd {
    font-weight: 600;
    margin: 4px 0 0;
  }
}

.manual-form {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(2, minmax(180px, 1fr));
}

.table-footer {
  align-items: center;
  display: flex;
  justify-content: space-between;
  padding: 8px 16px;
}

@media (max-width: 720px) {
  .section-toolbar,
  .toolbar-actions,
  .table-footer {
    align-items: stretch;
    flex-direction: column;
  }

  .filter-bar,
  .manual-form {
    grid-template-columns: 1fr;
  }
}
</style>
