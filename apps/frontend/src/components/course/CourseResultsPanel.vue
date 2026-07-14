<template>
  <div class="course-assessments">
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
      <v-alert
        v-if="readOnly"
        class="mb-4"
        type="info"
        variant="tonal"
      >
        Historischer Kursdurchlauf: Aufgabenbewertungen werden schreibgeschützt angezeigt.
      </v-alert>

      <section class="assessment-section">
        <div class="section-toolbar">
          <div>
            <h2>Bewertungen</h2>
            <p>Aufgabenbewertungen aus diesem Kursdurchlauf einsehen und manuelle Abgaben bewerten.</p>
          </div>
          <v-btn
            variant="text"
            @click="loadTeacherAssessments"
          >
            <v-icon start>
              mdi-refresh
            </v-icon>
            Aktualisieren
          </v-btn>
        </div>

        <div class="assessment-summary">
          <div>
            <span>Offen</span>
            <strong>{{ pendingReviewCount }}</strong>
          </div>
          <div>
            <span>Bestanden</span>
            <strong>{{ passedCount }}</strong>
          </div>
          <div>
            <span>Nicht bestanden</span>
            <strong>{{ failedCount }}</strong>
          </div>
        </div>

        <div class="filter-bar">
          <v-select
            v-model="taskFilter"
            :items="taskFilterOptions"
            item-title="title"
            item-value="value"
            label="Aufgabe"
            density="compact"
            hide-details
          />
          <v-select
            v-model="studentFilter"
            :items="studentFilterOptions"
            item-title="title"
            item-value="value"
            label="Student"
            density="compact"
            hide-details
          />
          <v-select
            v-model="statusFilter"
            :items="statusFilterOptions"
            item-title="title"
            item-value="value"
            label="Bewertungsstatus"
            density="compact"
            hide-details
          />
        </div>

        <v-empty-state
          v-if="filteredAssessmentRows.length === 0"
          icon="mdi-clipboard-clock-outline"
          title="Keine Aufgabenbewertungen gefunden"
          text="Für die aktuelle Filterung liegen keine Aufgabenbewertungen oder Abgaben vor."
        />

        <div
          v-else
          class="assessment-list"
        >
          <article
            v-for="row in filteredAssessmentRows"
            :key="row.rowId"
            class="assessment-row"
          >
            <div class="assessment-row__main">
              <div>
                <span class="assessment-row__eyebrow">Student {{ row.studentId }}</span>
                <h3>{{ row.order }}. {{ row.taskTitle }}</h3>
              </div>
              <div class="assessment-row__chips">
                <v-chip
                  size="small"
                  label
                  variant="outlined"
                >
                  {{ formatGradingMode(row.gradingMode) }}
                </v-chip>
                <v-chip
                  size="small"
                  :color="getProgressColor(row.progressStatus)"
                  label
                >
                  {{ formatTaskStatus(row.progressStatus) }}
                </v-chip>
                <v-chip
                  size="small"
                  :color="getAssessmentColor(row)"
                  label
                >
                  {{ displayAssessmentStatus(row) }}
                </v-chip>
              </div>
            </div>

            <div class="assessment-row__details">
              <div>
                <span>Punkte</span>
                <strong>{{ formatPoints(row.assessment?.points) }} / {{ formatPoints(row.assessment?.maxPoints ?? row.maxPoints) }}</strong>
              </div>
              <div>
                <span>Grenze</span>
                <strong>{{ formatThreshold(row.assessment?.passThreshold ?? row.passThreshold) }}</strong>
              </div>
              <div>
                <span>Feedback</span>
                <strong>{{ row.assessment?.feedback || '-' }}</strong>
              </div>
            </div>

            <div
              v-if="canEdit"
              class="assessment-row__actions"
            >
              <v-btn
                v-if="canAssessManually(row)"
                size="small"
                color="primary"
                variant="outlined"
                @click="openManualDialog(row)"
              >
                Bewerten
              </v-btn>
              <v-btn
                v-if="canResetAssessment(row)"
                size="small"
                color="warning"
                variant="text"
                @click="resetAssessment(row)"
              >
                Bewertung zurücksetzen
              </v-btn>
            </div>
          </article>
        </div>
      </section>
    </template>

    <template v-else>
      <section class="assessment-section">
        <div class="section-toolbar">
          <div>
            <h2>Meine Bewertungen</h2>
            <p>{{ studentSummary }}</p>
          </div>
        </div>

        <v-empty-state
          v-if="studentAssessmentRows.length === 0"
          icon="mdi-clipboard-clock-outline"
          title="Noch keine Aufgabenbewertung vorhanden"
          text="Bewertungen entstehen durch Selbstbestätigung, Abgabe oder automatische Demo-Bewertung."
        />

        <div
          v-else
          class="assessment-list"
        >
          <article
            v-for="row in studentAssessmentRows"
            :key="row.id"
            class="assessment-row"
          >
            <div class="assessment-row__main">
              <div>
                <span class="assessment-row__eyebrow">{{ formatGradingMode(row.gradingMode) }}</span>
                <h3>{{ row.order }}. {{ row.title }}</h3>
              </div>
              <div class="assessment-row__chips">
                <v-chip
                  size="small"
                  :color="getProgressColor(row.status)"
                  label
                >
                  {{ formatTaskStatus(row.status) }}
                </v-chip>
                <v-chip
                  size="small"
                  :color="getStudentAssessmentColor(row)"
                  label
                >
                  {{ displayStudentAssessmentStatus(row) }}
                </v-chip>
              </div>
            </div>

            <div class="assessment-row__details">
              <div>
                <span>Punkte</span>
                <strong>{{ formatPoints(row.assessment?.points) }} / {{ formatPoints(row.assessment?.maxPoints ?? row.maxPoints) }}</strong>
              </div>
              <div>
                <span>Ergebnis</span>
                <strong>{{ displayPassed(row.assessment?.passed) }}</strong>
              </div>
              <div>
                <span>Feedback</span>
                <strong>{{ row.assessment?.feedback || '-' }}</strong>
              </div>
            </div>
          </article>
        </div>
      </section>
    </template>

    <v-dialog
      v-model="manualDialogOpen"
      max-width="520"
    >
      <v-card>
        <v-card-title>Aufgabe bewerten</v-card-title>
        <v-card-text>
          <div class="manual-form">
            <p>{{ manualForm.title }}</p>
            <v-select
              v-model="manualForm.passed"
              :items="manualResultOptions"
              item-title="title"
              item-value="value"
              label="Ergebnis"
              density="compact"
            />
            <v-text-field
              v-model.number="manualForm.points"
              label="Punkte"
              type="number"
              density="compact"
            />
            <v-textarea
              v-model="manualForm.feedback"
              label="Feedback"
              density="compact"
              rows="3"
            />
            <v-alert
              v-if="manualValidationMessage"
              type="warning"
              variant="tonal"
              density="compact"
            >
              {{ manualValidationMessage }}
            </v-alert>
          </div>
        </v-card-text>
        <v-card-actions class="dialog-actions">
          <v-btn
            variant="text"
            @click="closeManualDialog"
          >
            Abbrechen
          </v-btn>
          <v-btn
            color="primary"
            :disabled="Boolean(manualValidationMessage)"
            :loading="saving"
            @click="saveManualAssessment"
          >
            Bewertung speichern
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import learningTaskService, { TaskAssessmentStatus, TaskGradingMode, TaskProgressStatus, formatAssessmentStatus, formatGradingMode, formatTaskStatus, type LearningPath, type LearningTask, type StudentLearningTask, type StudentProgressOverview, type TaskAssessment } from '@/services/learningTask.service'
import { getApiErrorMessage } from '@/services/apiErrors'

type AssessmentFilterStatus = TaskAssessmentStatus | 'NO_ASSESSMENT' | ''

type AssessmentRow = {
  rowId: string
  studentId: string
  taskId: string
  taskTitle: string
  order: number
  gradingMode: TaskGradingMode
  progressStatus: TaskProgressStatus
  assessment?: TaskAssessment | null
  maxPoints?: number | null
  passThreshold?: number | null
  feedbackRequired: boolean
}

const props = defineProps<{
  courseId: string | number
  canManage: boolean
  courseRunId?: string
  readOnly?: boolean
}>()

const loading = ref(false)
const saving = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const tasks = ref<LearningTask[]>([])
const progressOverview = ref<StudentProgressOverview[]>([])
const learningPath = ref<LearningPath | null>(null)
const taskFilter = ref('')
const studentFilter = ref('')
const statusFilter = ref<AssessmentFilterStatus>('')
const manualDialogOpen = ref(false)

const manualForm = reactive<{
  feedback: string
  feedbackRequired: boolean
  maxPoints: number | null
  passed: boolean
  points: number | null
  studentId: string
  taskId: string
  title: string
}>({
  feedback: '',
  feedbackRequired: false,
  maxPoints: null,
  passed: true,
  points: null,
  studentId: '',
  taskId: '',
  title: ''
})

const manualResultOptions = [
  { title: 'Bestanden', value: true },
  { title: 'Nicht bestanden', value: false }
]

const canEdit = computed(() => props.canManage && props.readOnly !== true)
const readOnly = computed(() => props.canManage && props.readOnly === true)
const effectiveCourseRunId = computed(() => (props.canManage ? props.courseRunId : undefined))
const taskById = computed(() => new Map(tasks.value.map((task) => [task.id, task])))

const assessmentRows = computed<AssessmentRow[]>(() =>
  progressOverview.value.flatMap((student) =>
    student.tasks.map((progress) => {
      const task = taskById.value.get(progress.taskId)
      const assessment = progress.assessment ?? null
      const gradingMode = assessment?.gradingMode ?? task?.gradingMode ?? TaskGradingMode.NOT_GRADED

      return {
        assessment,
        feedbackRequired: task?.feedbackRequired === true,
        gradingMode,
        maxPoints: assessment?.maxPoints ?? task?.maxPoints ?? null,
        order: progress.order,
        passThreshold: assessment?.passThreshold ?? task?.passThreshold ?? null,
        progressStatus: progress.status,
        rowId: `${student.studentId}-${progress.taskId}`,
        studentId: student.studentId,
        taskId: progress.taskId,
        taskTitle: progress.title
      }
    })
  )
)

const filteredAssessmentRows = computed(() =>
  assessmentRows.value.filter((row) => {
    if (taskFilter.value && row.taskId !== taskFilter.value) return false
    if (studentFilter.value && row.studentId !== studentFilter.value) return false
    if (statusFilter.value) {
      if (statusFilter.value === 'NO_ASSESSMENT') {
        return !row.assessment
      }
      return row.assessment?.status === statusFilter.value
    }

    return true
  })
)

const studentAssessmentRows = computed(() =>
  (learningPath.value?.tasks ?? []).filter(
    (task) => task.gradingMode !== TaskGradingMode.NOT_GRADED || task.assessment,
  )
)

const pendingReviewCount = computed(() =>
  assessmentRows.value.filter((row) => row.assessment?.status === TaskAssessmentStatus.PENDING_REVIEW).length
)
const passedCount = computed(() =>
  assessmentRows.value.filter((row) => row.assessment?.passed === true).length
)
const failedCount = computed(() =>
  assessmentRows.value.filter((row) => row.assessment?.passed === false).length
)

const taskFilterOptions = computed(() => [
  { title: 'Alle Aufgaben', value: '' },
  ...tasks.value
    .slice()
    .sort((left, right) => left.order - right.order)
    .map((task) => ({
      title: `${task.order}. ${task.title}`,
      value: task.id
    }))
])

const studentFilterOptions = computed(() => [
  { title: 'Alle Studierenden', value: '' },
  ...progressOverview.value.map((student) => ({
    title: `Student ${student.studentId}`,
    value: student.studentId
  }))
])

const statusFilterOptions = [
  { title: 'Alle Status', value: '' },
  { title: formatAssessmentStatus(TaskAssessmentStatus.PENDING_REVIEW), value: TaskAssessmentStatus.PENDING_REVIEW },
  { title: formatAssessmentStatus(TaskAssessmentStatus.PASSED), value: TaskAssessmentStatus.PASSED },
  { title: formatAssessmentStatus(TaskAssessmentStatus.FAILED), value: TaskAssessmentStatus.FAILED },
  { title: formatAssessmentStatus(TaskAssessmentStatus.AUTO_EVALUATED), value: TaskAssessmentStatus.AUTO_EVALUATED },
  { title: formatAssessmentStatus(TaskAssessmentStatus.NOT_SUBMITTED), value: TaskAssessmentStatus.NOT_SUBMITTED },
  { title: 'Ohne Bewertung', value: 'NO_ASSESSMENT' }
]

const studentSummary = computed(() => {
  if (!learningPath.value) return 'Bewertungen werden geladen.'
  if (studentAssessmentRows.value.length === 0) return 'Noch keine bewerteten Aufgaben.'

  return `${studentAssessmentRows.value.length} Aufgaben mit Bewertungsbezug.`
})

const manualValidationMessage = computed(() => {
  if (manualForm.points !== null && manualForm.points < 0) {
    return 'Punkte dürfen nicht negativ sein.'
  }

  if (manualForm.maxPoints !== null && manualForm.maxPoints <= 0) {
    return 'Maximale Punkte müssen größer als 0 sein.'
  }

  if (
    manualForm.points !== null &&
    manualForm.maxPoints !== null &&
    manualForm.points > manualForm.maxPoints
  ) {
    return 'Punkte dürfen nicht über der maximalen Punktzahl liegen.'
  }

  if (manualForm.feedbackRequired && manualForm.feedback.trim().length === 0) {
    return 'Für diese Aufgabe ist Feedback erforderlich.'
  }

  return ''
})

onMounted(() => {
  loadData()
})

watch(
  () => [props.courseId, effectiveCourseRunId.value, props.canManage, props.readOnly],
  () => loadData()
)

const loadData = () => {
  if (props.canManage) {
    return loadTeacherAssessments()
  }

  return loadStudentAssessments()
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

const loadTeacherAssessments = () =>
  withLoading(async () => {
    const [loadedTasks, loadedOverview] = await Promise.all([
      learningTaskService.listTasks(props.courseId, effectiveCourseRunId.value),
      learningTaskService.getProgressOverview(props.courseId, effectiveCourseRunId.value)
    ])
    tasks.value = loadedTasks
    progressOverview.value = loadedOverview
  })

const loadStudentAssessments = () =>
  withLoading(async () => {
    learningPath.value = await learningTaskService.getMyLearningPath(props.courseId)
  })

const displayAssessmentStatus = (row: AssessmentRow): string => {
  if (!row.assessment && row.gradingMode === TaskGradingMode.NOT_GRADED) {
    return 'Keine Bewertung'
  }

  return formatAssessmentStatus(row.assessment?.status)
}

const displayStudentAssessmentStatus = (task: StudentLearningTask): string => {
  if (!task.assessment && task.gradingMode === TaskGradingMode.NOT_GRADED) {
    return 'Keine Bewertung'
  }

  return formatAssessmentStatus(task.assessment?.status)
}

const displayPassed = (passed?: boolean | null): string => {
  if (passed === true) return 'Bestanden'
  if (passed === false) return 'Nicht bestanden'
  return '-'
}

const formatPoints = (value?: number | null): string => {
  if (value === null || value === undefined) return '-'

  return new Intl.NumberFormat('de-DE', {
    maximumFractionDigits: 2
  }).format(value)
}

const formatThreshold = (value?: number | null): string => {
  if (value === null || value === undefined) return '-'

  return `${formatPoints(value)} %`
}

const getAssessmentColor = (row: AssessmentRow): string => {
  const status = row.assessment?.status

  if (status === TaskAssessmentStatus.PASSED || status === TaskAssessmentStatus.AUTO_EVALUATED) return 'success'
  if (status === TaskAssessmentStatus.FAILED) return 'error'
  if (status === TaskAssessmentStatus.PENDING_REVIEW || status === TaskAssessmentStatus.SUBMITTED) return 'warning'

  return row.gradingMode === TaskGradingMode.NOT_GRADED ? 'default' : 'status-locked'
}

const getStudentAssessmentColor = (task: StudentLearningTask): string =>
  getAssessmentColor({
    assessment: task.assessment,
    feedbackRequired: task.feedbackRequired,
    gradingMode: task.gradingMode,
    maxPoints: task.maxPoints,
    order: task.order,
    passThreshold: task.passThreshold,
    progressStatus: task.status,
    rowId: task.id,
    studentId: learningPath.value?.studentId ?? '',
    taskId: task.id,
    taskTitle: task.title
  })

const getProgressColor = (status: TaskProgressStatus): string => {
  if (status === TaskProgressStatus.COMPLETED) return 'success'
  if (status === TaskProgressStatus.FAILED) return 'error'
  if (status === TaskProgressStatus.SUBMITTED) return 'warning'
  if (status === TaskProgressStatus.IN_PROGRESS) return 'info'

  return 'default'
}

const canAssessManually = (row: AssessmentRow) =>
  canEdit.value &&
  row.gradingMode === TaskGradingMode.MANUAL &&
  [TaskProgressStatus.SUBMITTED, TaskProgressStatus.COMPLETED, TaskProgressStatus.FAILED].includes(row.progressStatus)

const canResetAssessment = (row: AssessmentRow) =>
  canEdit.value &&
  row.gradingMode === TaskGradingMode.MANUAL &&
  Boolean(row.assessment) &&
  (row.assessment?.passed === true || row.assessment?.passed === false)

const openManualDialog = (row: AssessmentRow) => {
  if (!canAssessManually(row)) return

  manualForm.feedback = row.assessment?.feedback ?? ''
  manualForm.feedbackRequired = row.feedbackRequired
  manualForm.maxPoints = row.maxPoints ?? null
  manualForm.passed = row.assessment?.passed ?? true
  manualForm.points = row.assessment?.points ?? (row.assessment?.passed === false ? 0 : row.maxPoints ?? null)
  manualForm.studentId = row.studentId
  manualForm.taskId = row.taskId
  manualForm.title = `${row.order}. ${row.taskTitle} · Student ${row.studentId}`
  manualDialogOpen.value = true
}

const closeManualDialog = () => {
  manualDialogOpen.value = false
  manualForm.feedback = ''
  manualForm.feedbackRequired = false
  manualForm.maxPoints = null
  manualForm.passed = true
  manualForm.points = null
  manualForm.studentId = ''
  manualForm.taskId = ''
  manualForm.title = ''
}

const saveManualAssessment = async () => {
  if (!canEdit.value || !props.courseRunId || manualValidationMessage.value) {
    return
  }

  saving.value = true
  errorMessage.value = ''

  try {
    await learningTaskService.assessTaskManually(props.courseId, props.courseRunId, manualForm.taskId, manualForm.studentId, {
      feedback: manualForm.feedback.trim() || null,
      maxPoints: manualForm.maxPoints,
      passed: manualForm.passed,
      points: manualForm.points
    })
    successMessage.value = 'Aufgabenbewertung gespeichert.'
    closeManualDialog()
    await loadTeacherAssessments()
  } catch (error) {
    errorMessage.value = getApiErrorMessage(error)
  } finally {
    saving.value = false
  }
}

const resetAssessment = async (row: AssessmentRow) => {
  if (!canEdit.value || !props.courseRunId) {
    return
  }

  saving.value = true
  errorMessage.value = ''

  try {
    await learningTaskService.resetTaskAssessment(props.courseId, props.courseRunId, row.taskId, row.studentId)
    successMessage.value = 'Aufgabenbewertung zurückgesetzt.'
    await loadTeacherAssessments()
  } catch (error) {
    errorMessage.value = getApiErrorMessage(error)
  } finally {
    saving.value = false
  }
}
</script>

<style scoped lang="scss">
.course-assessments,
.assessment-section {
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

.assessment-summary {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(3, minmax(140px, 1fr));

  div {
    background: rgb(var(--v-theme-surface));
    border: 1px solid rgba(var(--v-theme-outline), 0.28);
    border-radius: 8px;
    padding: 14px;
  }

  span {
    color: rgb(var(--v-theme-on-surface-variant));
    display: block;
    font-size: 0.86rem;
  }

  strong {
    display: block;
    font-size: 1.35rem;
    margin-top: 4px;
  }
}

.filter-bar {
  display: grid;
  gap: 12px;
  grid-template-columns: minmax(220px, 1.4fr) minmax(160px, 0.8fr) minmax(180px, 1fr);
}

.assessment-list {
  display: grid;
  gap: 12px;
}

.assessment-row {
  background: rgb(var(--v-theme-surface));
  border: 1px solid rgba(var(--v-theme-outline), 0.28);
  border-radius: 8px;
  display: grid;
  gap: 14px;
  padding: 16px;
}

.assessment-row__main {
  align-items: flex-start;
  display: flex;
  gap: 12px;
  justify-content: space-between;

  h3 {
    font-size: 1rem;
    margin: 2px 0 0;
  }
}

.assessment-row__eyebrow {
  color: rgb(var(--v-theme-on-surface-variant));
  font-size: 0.84rem;
}

.assessment-row__chips,
.assessment-row__actions,
.dialog-actions {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-end;
}

.assessment-row__details {
  display: grid;
  gap: 10px;
  grid-template-columns: minmax(110px, 0.6fr) minmax(90px, 0.45fr) minmax(220px, 1.6fr);

  div {
    background: rgb(var(--v-theme-surface-muted));
    border-radius: 8px;
    padding: 10px 12px;
  }

  span {
    color: rgb(var(--v-theme-on-surface-variant));
    display: block;
    font-size: 0.82rem;
  }

  strong {
    display: block;
    font-weight: 600;
    margin-top: 3px;
  }
}

.manual-form {
  display: grid;
  gap: 12px;

  p {
    margin: 0;
  }
}

@media (max-width: 820px) {
  .section-toolbar,
  .assessment-row__main {
    align-items: stretch;
    flex-direction: column;
  }

  .assessment-summary,
  .filter-bar,
  .assessment-row__details {
    grid-template-columns: 1fr;
  }

  .assessment-row__chips,
  .assessment-row__actions,
  .dialog-actions {
    justify-content: flex-start;
  }
}
</style>
