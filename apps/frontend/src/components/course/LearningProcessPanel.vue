<template>
  <div class="learning-process">
    <v-alert v-if="errorMessage" class="mb-4" type="error" variant="tonal">
      {{ errorMessage }}
    </v-alert>

    <v-alert v-if="successMessage" class="mb-4" type="success" variant="tonal">
      {{ successMessage }}
    </v-alert>

    <v-progress-linear v-if="loading" class="mb-4" color="primary" indeterminate />

    <template v-else-if="canManage">
      <v-alert v-if="readOnly" class="mb-4" type="info" variant="tonal">
        Historischer Kursdurchlauf: Aufgaben und Fortschritt werden schreibgeschützt angezeigt.
      </v-alert>

      <section class="process-section">
        <div class="section-toolbar">
          <div>
            <h2>Aufgabenverwaltung</h2>
            <p>Freischaltmodus, Voraussetzung und Reihenfolge konfigurieren.</p>
          </div>
          <v-btn v-if="canEdit" color="primary" variant="outlined" @click="showCreateForm = !showCreateForm">
            <v-icon start> mdi-plus </v-icon>
            Neue Aufgabe
          </v-btn>
        </div>

        <div v-if="canEdit && showCreateForm" class="task-form">
          <div class="task-form__main">
            <v-text-field v-model="newTask.title" label="Titel" density="compact" />
            <v-text-field v-model="newTask.description" label="Beschreibung" density="compact" />
            <v-text-field v-model.number="newTask.order" label="Reihenfolge" type="number" density="compact" />
          </div>
          <div class="task-form__grid">
            <v-select v-model="newTask.unlockMode" :items="unlockModeOptions" item-title="title" item-value="value" label="Freischaltmodus" density="compact" />
            <v-select v-model="newTask.dependencyOperator" :items="dependencyOperatorOptions" item-title="title" item-value="value" label="Regel" density="compact" :disabled="newTask.unlockMode !== TaskUnlockMode.AUTOMATIC" />
            <v-select :model-value="newTask.dependencyTaskIds" :items="createPrerequisiteOptions" item-title="title" item-value="id" label="Voraussetzungen" density="compact" multiple chips closable-chips :disabled="newTask.unlockMode !== TaskUnlockMode.AUTOMATIC" @update:model-value="setNewTaskDependencyIds" />
            <v-select v-model="newTask.learningPathType" :items="learningPathTypeOptions" item-title="title" item-value="value" label="Pfadtyp" density="compact" />
            <v-select v-model="newTask.workMode" :items="workModeOptions" item-title="title" item-value="value" label="Bearbeitung" density="compact" />
            <v-select v-model="newTask.gradingMode" :items="gradingModeOptions" item-title="title" item-value="value" label="Bewertungsmodus" density="compact" />
            <v-text-field v-model.number="newTask.maxPoints" label="Max. Punkte" type="number" density="compact" :disabled="!requiresPoints(newTask.gradingMode)" />
            <v-text-field v-model.number="newTask.passThreshold" label="Bestehensgrenze %" type="number" density="compact" :disabled="!requiresPoints(newTask.gradingMode)" />
          </div>
          <div v-if="newTask.unlockMode === TaskUnlockMode.AUTOMATIC && newTask.dependencyTaskIds.length > 0" class="dependency-condition-list">
            <div v-for="dependencyId in newTask.dependencyTaskIds" :key="`new-${dependencyId}`" class="dependency-condition-row">
              <span>{{ getDependencyTaskLabel(dependencyId) }}</span>
              <v-select :model-value="newTask.dependencyConditions[dependencyId] ?? TaskDependencyCondition.PASSED" :items="dependencyConditionOptions" item-title="title" item-value="value" label="Bedingung" density="compact" hide-details @update:model-value="setNewTaskDependencyCondition(dependencyId, $event)" />
            </div>
          </div>
          <div class="task-form__toggles">
            <v-switch v-model="newTask.feedbackRequired" label="Feedback erforderlich" color="primary" hide-details />
            <v-switch v-model="newTask.allowRetries" label="Wiederholen erlaubt" color="primary" hide-details />
          </div>
          <v-alert v-if="newTaskValidationMessage" class="mb-3" type="warning" variant="tonal" density="compact">
            {{ newTaskValidationMessage }}
          </v-alert>
          <div class="row-actions">
            <v-btn color="primary" :disabled="Boolean(newTaskValidationMessage)" @click="submitNewTask"> Anlegen </v-btn>
            <v-btn variant="text" @click="resetNewTask"> Abbrechen </v-btn>
          </div>
        </div>

        <v-empty-state v-if="tasks.length === 0" icon="mdi-clipboard-text-outline" title="Keine Aufgaben vorhanden" text="Für diesen Kurs wurden noch keine Aufgaben angelegt." />

        <div v-else class="teacher-task-list">
          <article v-for="task in sortedTasks" :key="task.id" class="teacher-task-card" :class="{ 'teacher-task-card--draft': !task.isPublished }" data-testid="teacher-task-row">
            <header class="teacher-task-card__header">
              <div class="teacher-task-card__heading">
                <v-text-field v-model.number="task.order" class="teacher-task-card__order" label="Nr." type="number" density="compact" hide-details :disabled="!canEdit" />
                <div class="teacher-task-card__summary">
                  <strong>{{ task.order }}. {{ task.title || 'Unbenannte Aufgabe' }}</strong>
                  <div class="teacher-task-card__chips">
                    <v-chip size="small" variant="tonal" label>{{ formatUnlockMode(task.unlockMode) }}</v-chip>
                    <v-chip size="small" variant="tonal" label>{{ formatTaskLearningPathType(task.learningPathType) }}</v-chip>
                    <v-chip size="small" variant="tonal" label>{{ formatTaskWorkMode(task.workMode) }}</v-chip>
                    <v-chip size="small" variant="tonal" label>{{ formatGradingMode(task.gradingMode) }}</v-chip>
                    <v-chip size="small" :color="task.isPublished ? 'primary' : undefined" variant="tonal" label>
                      {{ task.isPublished ? 'Freigegeben' : 'Entwurf' }}
                    </v-chip>
                  </div>
                </div>
              </div>

              <div v-if="canEdit" class="row-actions teacher-task-card__actions">
                <v-btn size="small" color="primary" variant="flat" :disabled="Boolean(getTaskValidationMessage(task))" @click="saveTask(task)">
                  <v-icon start>mdi-content-save-outline</v-icon>
                  Speichern
                </v-btn>
                <v-btn size="small" variant="text" color="error" @click="requestDeleteTask(task)">
                  <v-icon start>mdi-delete-outline</v-icon>
                  Löschen
                </v-btn>
              </div>
            </header>

            <div class="teacher-task-card__identity">
              <v-text-field v-model="task.title" label="Titel" density="compact" hide-details :disabled="!canEdit" />
              <v-textarea v-model="task.description" label="Beschreibung" density="compact" rows="2" auto-grow hide-details :disabled="!canEdit" />
            </div>

            <div class="teacher-task-card__body">
              <section class="teacher-task-card__group">
                <span class="teacher-task-card__group-title">Freischaltung</span>
                <div class="teacher-task-card__release">
                  <v-select v-model="task.unlockMode" :items="unlockModeOptions" item-title="title" item-value="value" label="Modus" density="compact" hide-details :disabled="!canEdit" />
                  <v-select v-model="task.dependencyOperator" :items="dependencyOperatorOptions" item-title="title" item-value="value" label="Regel" density="compact" hide-details :disabled="!canEdit || task.unlockMode !== TaskUnlockMode.AUTOMATIC" />
                  <v-select :model-value="getTaskDependencyIds(task)" :items="getPrerequisiteOptions(task)" item-title="title" item-value="id" label="Voraussetzungen" density="compact" hide-details multiple chips closable-chips :disabled="!canEdit || task.unlockMode !== TaskUnlockMode.AUTOMATIC" @update:model-value="setTaskDependencyIds(task, $event)" />
                </div>
                <div v-if="task.unlockMode === TaskUnlockMode.AUTOMATIC && (task.dependencies?.length ?? 0) > 0" class="dependency-condition-list">
                  <div v-for="dependency in task.dependencies" :key="`${task.id}-${dependency.prerequisiteTaskId}`" class="dependency-condition-row">
                    <span>{{ getDependencyTaskLabel(dependency.prerequisiteTaskId) }}</span>
                    <v-select v-model="dependency.condition" :items="dependencyConditionOptions" item-title="title" item-value="value" label="Bedingung" density="compact" hide-details :disabled="!canEdit" />
                  </div>
                </div>
              </section>

              <section class="teacher-task-card__group">
                <span class="teacher-task-card__group-title">Bewertung</span>
                <div class="teacher-task-card__assessment">
                  <v-select v-model="task.learningPathType" :items="learningPathTypeOptions" item-title="title" item-value="value" label="Pfad" density="compact" hide-details :disabled="!canEdit" />
                  <v-select v-model="task.workMode" :items="workModeOptions" item-title="title" item-value="value" label="Bearbeitung" density="compact" hide-details :disabled="!canEdit" />
                  <v-select v-model="task.gradingMode" :items="gradingModeOptions" item-title="title" item-value="value" label="Modus" density="compact" hide-details :disabled="!canEdit" />
                  <v-text-field v-model.number="task.maxPoints" label="Punkte" type="number" density="compact" hide-details :disabled="!canEdit || !requiresPoints(task.gradingMode)" />
                  <v-text-field v-model.number="task.passThreshold" label="Grenze %" type="number" density="compact" hide-details :disabled="!canEdit || !requiresPoints(task.gradingMode)" />
                </div>
              </section>

              <section class="teacher-task-card__group">
                <span class="teacher-task-card__group-title">Optionen</span>
                <div class="teacher-task-card__options">
                  <v-switch v-model="task.feedbackRequired" label="Feedback" color="primary" hide-details :disabled="!canEdit" />
                  <v-switch v-model="task.allowRetries" label="Wiederholen" color="primary" hide-details :disabled="!canEdit" />
                  <v-switch v-model="task.isPublished" label="Freigegeben" color="primary" hide-details :disabled="!canEdit" />
                </div>
              </section>
            </div>

            <v-alert v-if="getTaskValidationMessage(task)" class="teacher-task-card__message" type="warning" variant="tonal" density="compact">
              {{ getTaskValidationMessage(task) }}
            </v-alert>
          </article>
        </div>
      </section>

      <section class="process-section">
        <div class="section-toolbar">
          <div>
            <h2>Fortschritt</h2>
            <p>Manuelle Aufgaben für einzelne Studierende freischalten.</p>
          </div>
          <v-btn variant="text" @click="loadTeacherData">
            <v-icon start> mdi-refresh </v-icon>
            Aktualisieren
          </v-btn>
        </div>

        <v-empty-state v-if="progressOverview.length === 0" icon="mdi-account-school-outline" title="Keine Studierenden vorhanden" text="Für diesen Kurs liegen noch keine Fortschrittsdaten vor." />

        <div v-else class="student-progress-list">
          <div v-for="student in progressOverview" :key="student.studentId" class="student-progress-row">
            <div class="student-progress-row__header">
              <div>
                <strong>Student {{ student.studentId }}</strong>
                <span>{{ student.completedTasks }} von {{ student.totalTasks }} abgeschlossen</span>
              </div>
              <v-progress-linear :model-value="student.progressPercentage" color="primary" height="8" rounded />
            </div>
            <div class="teacher-progress-tasks">
              <div v-for="progress in student.tasks" :key="`${student.studentId}-${progress.taskId}`" class="teacher-progress-task">
                <span>{{ progress.order }}. {{ progress.title }}</span>
                <v-chip size="small" :color="getStatusPresentation(progress.status).color" label>
                  <v-icon start>
                    {{ getStatusPresentation(progress.status).icon }}
                  </v-icon>
                  {{ getStatusPresentation(progress.status).label }}
                </v-chip>
                <v-btn v-if="canManuallyUnlock(progress.taskId, progress.status)" size="small" variant="outlined" @click="manualUnlock(progress.taskId, student.studentId)"> Freischalten </v-btn>
                <v-btn v-if="canAssessManually(progress)" size="small" color="primary" variant="outlined" @click="openManualAssessment(progress, student.studentId)"> Bewerten </v-btn>
                <v-btn v-if="canResetManualAssessment(progress)" size="small" color="warning" variant="outlined" @click="resetManualAssessment(progress, student.studentId)"> Bewertung zurücksetzen </v-btn>
              </div>
            </div>
          </div>
        </div>
      </section>
    </template>

    <template v-else>
      <section class="process-section">
        <div class="section-toolbar">
          <div>
            <h2>Lernprozess</h2>
            <p>{{ progressSummary }}</p>
          </div>
          <v-progress-linear class="student-progress" :model-value="learningPath?.progressPercentage ?? 0" color="primary" height="10" rounded />
        </div>

        <v-empty-state v-if="studentTasks.length === 0" icon="mdi-clipboard-text-outline" title="Keine Aufgaben vorhanden" text="Für diesen Kurs wurden noch keine freigegebenen Aufgaben angelegt." />

        <div v-else class="student-task-list">
          <article v-for="task in studentTasks" :key="task.id" class="student-task" :class="`student-task--${task.status.toLowerCase()}`">
            <div class="student-task__header">
              <span class="student-task__order">{{ task.order }}</span>
              <v-chip size="small" :color="getStatusPresentation(task.status).color" label>
                <v-icon start>
                  {{ getStatusPresentation(task.status).icon }}
                </v-icon>
                {{ getStatusPresentation(task.status).label }}
              </v-chip>
            </div>
            <h3>{{ task.title }}</h3>
            <p>{{ task.description }}</p>
            <div class="student-task__assessment">
              <span>{{ formatTaskWorkMode(task.workMode) }}<template v-if="task.workMode === TaskWorkMode.GROUP && task.group?.name"> · {{ task.group.name }}</template></span>
              <span>{{ formatTaskLearningPathType(task.learningPathType) }}</span>
              <span>Bewertung: {{ formatGradingMode(task.gradingMode) }}</span>
              <span>{{ formatAssessmentStatus(task.assessment?.status) }}</span>
              <span v-if="task.assessment?.points !== undefined && task.assessment?.points !== null">
                {{ task.assessment.points }} / {{ task.assessment.maxPoints ?? task.maxPoints ?? '-' }} Punkte
              </span>
              <span v-if="task.assessment?.passed === true">Bestanden</span>
              <span v-if="task.assessment?.passed === false">Nicht bestanden</span>
            </div>
            <v-alert v-if="task.assessment?.feedback" type="info" variant="tonal" density="compact">
              {{ task.assessment.feedback }}
            </v-alert>
            <v-alert v-if="task.lockedReason" type="info" variant="tonal" density="compact">
              {{ task.lockedReason }}
            </v-alert>
            <div class="student-task__meta">
              <span>{{ formatUnlockMode(task.unlockMode) }}</span>
              <span v-if="task.unlockedAt">Freigeschaltet am {{ formatDate(task.unlockedAt) }}</span>
              <span v-if="task.completedAt">Abgeschlossen am {{ formatDate(task.completedAt) }}</span>
            </div>
            <div class="student-task__actions">
              <v-btn v-if="canStartTask(task)" color="primary" variant="outlined" @click="startTask(task)"> {{ task.workMode === TaskWorkMode.GROUP ? 'Gruppenaufgabe beginnen' : 'Aufgabe beginnen' }} </v-btn>
              <v-btn v-if="canCompleteTask(task)" color="primary" @click="requestSelfConfirmation(task)"> Als erledigt markieren </v-btn>
              <v-btn v-if="canSubmitTask(task)" color="primary" @click="submitTask(task)"> {{ task.workMode === TaskWorkMode.GROUP ? 'Gruppenaufgabe abgeben' : 'Aufgabe abgeben' }} </v-btn>
              <v-btn v-if="canMockEvaluateTask(task)" color="primary" @click="mockEvaluateTask(task, true)"> Abgabe simulieren </v-btn>
            </div>
          </article>
        </div>
      </section>
    </template>

    <v-dialog v-model="confirmation.open" max-width="460">
      <v-card class="confirmation-dialog">
        <v-card-title>{{ confirmation.title }}</v-card-title>
        <v-card-text>{{ confirmation.text }}</v-card-text>
        <v-card-actions class="row-actions row-actions--end">
          <v-btn variant="text" @click="closeConfirmation"> Abbrechen </v-btn>
          <v-btn color="primary" @click="executeConfirmedAction"> Bestätigen </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="manualAssessment.open" max-width="520">
      <v-card class="confirmation-dialog">
        <v-card-title>Manuelle Bewertung</v-card-title>
        <v-card-text>
          <div class="assessment-dialog">
            <p>{{ manualAssessment.title }}</p>
            <v-select v-model="manualAssessment.passed" :items="manualAssessmentResultOptions" item-title="title" item-value="value" label="Ergebnis" density="compact" />
            <v-text-field v-model.number="manualAssessment.points" label="Punkte" type="number" density="compact" />
            <v-textarea v-model="manualAssessment.feedback" label="Feedback" density="compact" rows="3" />
          </div>
        </v-card-text>
        <v-card-actions class="row-actions row-actions--end">
          <v-btn variant="text" @click="closeManualAssessment"> Abbrechen </v-btn>
          <v-btn color="primary" @click="submitManualAssessment"> Bewertung speichern </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import learningTaskService, { TaskDependencyCondition, TaskDependencyOperator, TaskGradingMode, TaskLearningPathType, TaskProgressStatus, TaskUnlockMode, TaskWorkMode, formatAssessmentStatus, formatGradingMode, formatTaskLearningPathType, formatTaskWorkMode, formatUnlockMode, type LearningPath, type LearningTask, type LearningTaskProgress, type StudentLearningTask, type StudentProgressOverview } from '@/services/learningTask.service'
import { getApiErrorMessage } from '@/services/apiErrors'
import { getTaskStatusPresentation } from '@/services/statusPresentation'

const props = defineProps<{
  courseId: string | number
  canManage: boolean
  courseRunId?: string
  courseVersionId?: string
  readOnly?: boolean
}>()

const loading = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const learningPath = ref<LearningPath | null>(null)
const tasks = ref<LearningTask[]>([])
const progressOverview = ref<StudentProgressOverview[]>([])
const showCreateForm = ref(false)

const newTask = reactive({
  title: '',
  description: '',
  order: 1,
  unlockMode: TaskUnlockMode.IMMEDIATE,
  workMode: TaskWorkMode.INDIVIDUAL,
  gradingMode: TaskGradingMode.NOT_GRADED,
  maxPoints: null as number | null,
  passThreshold: 50,
  feedbackRequired: false,
  allowRetries: true,
  prerequisiteTaskId: null as string | null,
  dependencyOperator: TaskDependencyOperator.ALL_OF,
  dependencyTaskIds: [] as string[],
  dependencyConditions: {} as Record<string, TaskDependencyCondition>,
  learningPathType: TaskLearningPathType.STANDARD
})

const confirmation = reactive<{
  open: boolean
  title: string
  text: string
  action: null | (() => Promise<void>)
}>({
  open: false,
  title: '',
  text: '',
  action: null
})

const unlockModeOptions = [
  { title: 'Sofort verfügbar', value: TaskUnlockMode.IMMEDIATE },
  { title: 'Nach Voraussetzung', value: TaskUnlockMode.AUTOMATIC },
  { title: 'Manuell freischalten', value: TaskUnlockMode.MANUAL }
]
const dependencyOperatorOptions = [
  { title: 'Alle Voraussetzungen', value: TaskDependencyOperator.ALL_OF },
  { title: 'Eine Voraussetzung reicht', value: TaskDependencyOperator.ANY_OF }
]
const dependencyConditionOptions = [
  { title: 'bestanden', value: TaskDependencyCondition.PASSED },
  { title: 'nicht bestanden', value: TaskDependencyCondition.FAILED },
  { title: 'abgegeben', value: TaskDependencyCondition.SUBMITTED },
  { title: 'abgeschlossen', value: TaskDependencyCondition.COMPLETED }
]
const learningPathTypeOptions = [
  { title: 'Standard', value: TaskLearningPathType.STANDARD },
  { title: 'Wiederholung', value: TaskLearningPathType.REMEDIAL },
  { title: 'Vertiefung', value: TaskLearningPathType.DEEPENING },
  { title: 'Praxis', value: TaskLearningPathType.PRACTICE }
]
const gradingModeOptions = [
  { title: 'Keine Bewertung', value: TaskGradingMode.NOT_GRADED },
  { title: 'Selbstbestätigung', value: TaskGradingMode.SELF_CONFIRMATION },
  { title: 'Manuelle Bewertung', value: TaskGradingMode.MANUAL },
  { title: 'Automatisch (Mock)', value: TaskGradingMode.AUTOMATIC_MOCK }
]
const workModeOptions = [
  { title: 'Einzelaufgabe', value: TaskWorkMode.INDIVIDUAL },
  { title: 'Gruppenaufgabe', value: TaskWorkMode.GROUP }
]
const manualAssessmentResultOptions = [
  { title: 'Als bestanden bewerten', value: true },
  { title: 'Als nicht bestanden bewerten', value: false }
]

const manualAssessment = reactive<{
  open: boolean
  taskId: string
  studentId: string
  title: string
  passed: boolean
  points: number | null
  feedback: string
}>({
  open: false,
  taskId: '',
  studentId: '',
  title: '',
  passed: true,
  points: null,
  feedback: ''
})

const sortedTasks = computed(() => [...tasks.value].sort((a, b) => a.order - b.order))
const studentTasks = computed(() => learningPath.value?.tasks ?? [])
const canEdit = computed(() => props.canManage && props.readOnly !== true)
const readOnly = computed(() => props.canManage && props.readOnly === true)
const effectiveCourseRunId = computed(() => (props.canManage ? props.courseRunId : undefined))
const effectiveCourseVersionId = computed(() => (props.canManage ? props.courseVersionId : undefined))
const progressSummary = computed(() => {
  if (!learningPath.value) return 'Fortschritt wird geladen.'
  if (learningPath.value.totalTasks === 0) return 'Noch keine Aufgaben verfügbar.'
  return `${learningPath.value.completedTasks} von ${learningPath.value.totalTasks} Aufgaben erfolgreich abgeschlossen.`
})
const createPrerequisiteOptions = computed(() =>
  sortedTasks.value.map((task) => ({
    id: task.id,
    title: `${task.order}. ${task.title}`
  }))
)

const normalizeTaskForEditing = (task: LearningTask): LearningTask => {
  const dependencies = task.dependencies?.length
    ? task.dependencies
    : task.prerequisiteTaskId
      ? [{
        prerequisiteTaskId: task.prerequisiteTaskId,
        condition: TaskDependencyCondition.PASSED,
        operator: task.dependencyOperator ?? TaskDependencyOperator.ALL_OF
      }]
      : []

  return {
    ...task,
    dependencyOperator: task.dependencyOperator ?? dependencies[0]?.operator ?? TaskDependencyOperator.ALL_OF,
    dependencies,
    learningPathType: task.learningPathType ?? TaskLearningPathType.STANDARD
  }
}

const getDependencyTaskLabel = (taskId: string) => {
  const task = getTaskById(taskId)

  return task ? `${task.order}. ${task.title}` : 'Unbekannte Aufgabe'
}

const setNewTaskDependencyIds = (value: unknown) => {
  const selectedIds = Array.isArray(value)
    ? value.map((entry) => String(entry)).filter(Boolean)
    : []
  const nextConditions: Record<string, TaskDependencyCondition> = {}

  for (const dependencyId of selectedIds) {
    nextConditions[dependencyId] =
      newTask.dependencyConditions[dependencyId] ?? TaskDependencyCondition.PASSED
  }

  newTask.dependencyTaskIds = selectedIds
  newTask.dependencyConditions = nextConditions
}

const setNewTaskDependencyCondition = (dependencyId: string, value: unknown) => {
  newTask.dependencyConditions[dependencyId] = Object.values(TaskDependencyCondition).includes(value as TaskDependencyCondition)
    ? value as TaskDependencyCondition
    : TaskDependencyCondition.PASSED
}

const getNewTaskDependencyPayload = () =>
  newTask.dependencyTaskIds.map((prerequisiteTaskId) => ({
    prerequisiteTaskId,
    condition: newTask.dependencyConditions[prerequisiteTaskId] ?? TaskDependencyCondition.PASSED
  }))

const getTaskDependencyPayload = (task: LearningTask) =>
  (task.dependencies ?? []).map((dependency) => ({
    prerequisiteTaskId: dependency.prerequisiteTaskId,
    condition: dependency.condition ?? TaskDependencyCondition.PASSED
  }))

const newTaskValidationMessage = computed(() => {
  if (newTask.title.trim().length === 0) {
    return 'Ein Titel ist erforderlich.'
  }

  if (newTask.unlockMode === TaskUnlockMode.AUTOMATIC && newTask.dependencyTaskIds.length === 0) {
    return 'Automatische Freischaltung benötigt mindestens eine Voraussetzung.'
  }

  if (requiresPoints(newTask.gradingMode) && (!newTask.maxPoints || newTask.maxPoints <= 0)) {
    return 'Bewertete Aufgaben benötigen eine maximale Punktzahl.'
  }

  return ''
})

onMounted(() => {
  loadData()
})

watch(
  () => [props.courseId, effectiveCourseRunId.value, effectiveCourseVersionId.value, props.canManage, props.readOnly],
  () => loadData()
)

const loadData = () => {
  if (props.canManage) {
    return loadTeacherData()
  }

  return loadStudentData()
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

const loadStudentData = () =>
  withLoading(async () => {
    learningPath.value = await learningTaskService.getMyLearningPath(props.courseId)
  })

const loadTeacherData = () =>
  withLoading(async () => {
    tasks.value = []
    progressOverview.value = []
    const [loadedTasks, loadedOverview] = await Promise.all([learningTaskService.listTasks(props.courseId, effectiveCourseRunId.value, effectiveCourseVersionId.value), learningTaskService.getProgressOverview(props.courseId, effectiveCourseRunId.value)])
    tasks.value = loadedTasks.map(normalizeTaskForEditing)
    progressOverview.value = loadedOverview
  })

const resetNewTask = () => {
  newTask.title = ''
  newTask.description = ''
  newTask.order = sortedTasks.value.length + 1
  newTask.unlockMode = TaskUnlockMode.IMMEDIATE
  newTask.workMode = TaskWorkMode.INDIVIDUAL
  newTask.gradingMode = TaskGradingMode.NOT_GRADED
  newTask.maxPoints = null
  newTask.passThreshold = 50
  newTask.feedbackRequired = false
  newTask.allowRetries = true
  newTask.prerequisiteTaskId = null
  newTask.dependencyOperator = TaskDependencyOperator.ALL_OF
  newTask.dependencyTaskIds = []
  newTask.dependencyConditions = {}
  newTask.learningPathType = TaskLearningPathType.STANDARD
  showCreateForm.value = false
}

const requiresPoints = (gradingMode: TaskGradingMode) =>
  gradingMode === TaskGradingMode.MANUAL || gradingMode === TaskGradingMode.AUTOMATIC_MOCK

const submitNewTask = async () => {
  if (!canEdit.value) {
    errorMessage.value = 'Aufgaben historischer Durchläufe können nicht bearbeitet werden.'
    return
  }

  if (newTaskValidationMessage.value) {
    errorMessage.value = newTaskValidationMessage.value
    return
  }

  try {
    await learningTaskService.createTask(props.courseId, {
      title: newTask.title.trim(),
      description: newTask.description.trim(),
      order: newTask.order,
      type: 'DEMO_TASK',
      unlockMode: newTask.unlockMode,
      prerequisiteTaskId: newTask.unlockMode === TaskUnlockMode.IMMEDIATE ? null : (newTask.dependencyTaskIds[0] ?? null),
      dependencyOperator: newTask.dependencyOperator,
      dependencies: newTask.unlockMode === TaskUnlockMode.AUTOMATIC ? getNewTaskDependencyPayload() : [],
      learningPathType: newTask.learningPathType,
      workMode: newTask.workMode,
      gradingMode: newTask.gradingMode,
      maxPoints: requiresPoints(newTask.gradingMode) ? newTask.maxPoints : null,
      passThreshold: requiresPoints(newTask.gradingMode) ? newTask.passThreshold : null,
      feedbackRequired: newTask.feedbackRequired,
      allowRetries: newTask.allowRetries,
      isPublished: true
    })
    successMessage.value = 'Aufgabe angelegt.'
    resetNewTask()
    await loadTeacherData()
  } catch (error) {
    errorMessage.value = getApiErrorMessage(error)
  }
}

const getPrerequisiteOptions = (task: LearningTask) =>
  sortedTasks.value
    .filter((candidate) => candidate.id !== task.id && !wouldCreateCycle(task.id, candidate.id))
    .map((candidate) => ({
      id: candidate.id,
      title: `${candidate.order}. ${candidate.title}`
    }))

const getTaskById = (taskId?: string) => tasks.value.find((task) => task.id === taskId)

const getTaskDependencyIds = (task: LearningTask): string[] => {
  const ids = (task.dependencies ?? [])
    .map((dependency) => dependency.prerequisiteTaskId)
    .filter(Boolean)

  if (ids.length === 0 && task.prerequisiteTaskId) {
    ids.push(task.prerequisiteTaskId)
  }

  return [...new Set(ids)]
}

const setTaskDependencyIds = (task: LearningTask, value: unknown) => {
  const selectedIds = Array.isArray(value)
    ? value.map((entry) => String(entry)).filter(Boolean)
    : []
  const existingDependenciesByTaskId = new Map(
    (task.dependencies ?? []).map((dependency) => [
      dependency.prerequisiteTaskId,
      dependency
    ])
  )

  task.dependencies = selectedIds.map((prerequisiteTaskId) => ({
    prerequisiteTaskId,
    condition: existingDependenciesByTaskId.get(prerequisiteTaskId)?.condition ?? TaskDependencyCondition.PASSED,
    operator: task.dependencyOperator ?? TaskDependencyOperator.ALL_OF
  }))
  task.prerequisiteTaskId = selectedIds[0] ?? undefined
}

const wouldCreateCycle = (taskId: string, prerequisiteTaskId?: string | null): boolean => {
  const stack = prerequisiteTaskId ? [prerequisiteTaskId] : []
  const visitedTaskIds = new Set<string>()

  while (stack.length > 0) {
    const currentTaskId = stack.pop()

    if (!currentTaskId) {
      continue
    }

    if (currentTaskId === taskId) {
      return true
    }

    if (visitedTaskIds.has(currentTaskId)) {
      return true
    }

    visitedTaskIds.add(currentTaskId)
    stack.push(...getTaskDependencyIds(getTaskById(currentTaskId) ?? ({} as LearningTask)))
  }

  return false
}

const getTaskValidationMessage = (task: LearningTask): string => {
  if (task.title.trim().length === 0) {
    return 'Ein Titel ist erforderlich.'
  }

  const dependencyIds = getTaskDependencyIds(task)

  if (task.unlockMode === TaskUnlockMode.IMMEDIATE && dependencyIds.length > 0) {
    return 'Sofort verfügbare Aufgaben dürfen keine Voraussetzung haben.'
  }

  if (task.unlockMode === TaskUnlockMode.AUTOMATIC && dependencyIds.length === 0) {
    return 'Automatische Freischaltung benötigt mindestens eine Voraussetzung.'
  }

  if (requiresPoints(task.gradingMode) && (!task.maxPoints || task.maxPoints <= 0)) {
    return 'Bewertete Aufgaben benötigen eine maximale Punktzahl.'
  }

  if (dependencyIds.includes(task.id)) {
    return 'Eine Aufgabe darf nicht von sich selbst abhängen.'
  }

  if (dependencyIds.some((dependencyId) => wouldCreateCycle(task.id, dependencyId))) {
    return 'Diese Voraussetzung würde einen Zyklus erzeugen.'
  }

  return ''
}

const saveTask = async (task: LearningTask) => {
  if (!canEdit.value) {
    errorMessage.value = 'Aufgaben historischer Durchläufe können nicht bearbeitet werden.'
    return
  }

  const validationMessage = getTaskValidationMessage(task)

  if (validationMessage) {
    errorMessage.value = validationMessage
    return
  }

  try {
    await learningTaskService.updateTask(task.id, {
      title: task.title.trim(),
      description: task.description.trim(),
      order: task.order,
      type: task.type,
      unlockMode: task.unlockMode,
      prerequisiteTaskId: task.unlockMode === TaskUnlockMode.IMMEDIATE ? null : (getTaskDependencyIds(task)[0] ?? null),
      dependencyOperator: task.dependencyOperator ?? TaskDependencyOperator.ALL_OF,
      dependencies: task.unlockMode === TaskUnlockMode.AUTOMATIC ? getTaskDependencyPayload(task) : [],
      learningPathType: task.learningPathType ?? TaskLearningPathType.STANDARD,
      workMode: task.workMode,
      gradingMode: task.gradingMode,
      maxPoints: requiresPoints(task.gradingMode) ? task.maxPoints ?? null : null,
      passThreshold: requiresPoints(task.gradingMode) ? task.passThreshold ?? 50 : null,
      feedbackRequired: task.feedbackRequired,
      allowRetries: task.allowRetries,
      isPublished: task.isPublished
    })
    successMessage.value = 'Aufgabe gespeichert.'
    await loadTeacherData()
  } catch (error) {
    errorMessage.value = getApiErrorMessage(error)
  }
}

const requestDeleteTask = (task: LearningTask) => {
  if (!canEdit.value) return

  openConfirmation('Aufgabe löschen', `Soll "${task.title}" wirklich gelöscht werden?`, async () => {
    await learningTaskService.deleteTask(task.id)
    successMessage.value = 'Aufgabe gelöscht.'
    await loadTeacherData()
  })
}

const canStartTask = (task: StudentLearningTask) => task.status === TaskProgressStatus.AVAILABLE || (task.status === TaskProgressStatus.FAILED && task.allowRetries)
const canCompleteTask = (task: StudentLearningTask) =>
  task.status === TaskProgressStatus.IN_PROGRESS &&
  task.workMode !== TaskWorkMode.GROUP &&
  (task.gradingMode === TaskGradingMode.NOT_GRADED || task.gradingMode === TaskGradingMode.SELF_CONFIRMATION)
const canSubmitTask = (task: StudentLearningTask) => task.status === TaskProgressStatus.IN_PROGRESS && task.gradingMode === TaskGradingMode.MANUAL
const canMockEvaluateTask = (task: StudentLearningTask) => task.status === TaskProgressStatus.IN_PROGRESS && task.workMode !== TaskWorkMode.GROUP && task.gradingMode === TaskGradingMode.AUTOMATIC_MOCK

const startTask = async (task: StudentLearningTask) => {
  try {
    learningPath.value = task.workMode === TaskWorkMode.GROUP
      ? await learningTaskService.startGroupTask(task.id)
      : await learningTaskService.startTask(task.id)
    successMessage.value = task.workMode === TaskWorkMode.GROUP ? 'Gruppenaufgabe begonnen.' : 'Aufgabe begonnen.'
  } catch (error) {
    errorMessage.value = getApiErrorMessage(error)
  }
}

const requestSelfConfirmation = (task: StudentLearningTask) => {
  openConfirmation('Bearbeitung bestätigen', `Soll "${task.title}" als erledigt markiert werden?`, async () => {
    learningPath.value = await learningTaskService.selfConfirmTask(task.id)
    successMessage.value = 'Aufgabe als erledigt markiert.'
  })
}

const submitTask = async (task: StudentLearningTask) => {
  try {
    learningPath.value = task.workMode === TaskWorkMode.GROUP
      ? await learningTaskService.submitGroupTask(task.id)
      : await learningTaskService.submitTask(task.id)
    successMessage.value = task.workMode === TaskWorkMode.GROUP ? 'Gruppenaufgabe abgegeben. Sie wartet jetzt auf Bewertung.' : 'Aufgabe abgegeben. Sie wartet jetzt auf Bewertung.'
  } catch (error) {
    errorMessage.value = getApiErrorMessage(error)
  }
}

const mockEvaluateTask = async (task: StudentLearningTask, passed: boolean) => {
  try {
    learningPath.value = await learningTaskService.mockEvaluateTask(task.id, passed)
    successMessage.value = 'Demo-Abgabe wurde automatisch bewertet.'
  } catch (error) {
    errorMessage.value = getApiErrorMessage(error)
  }
}

const canManuallyUnlock = (taskId: string, status: TaskProgressStatus) => {
  const task = tasks.value.find((candidate) => candidate.id === taskId)

  return canEdit.value && status === TaskProgressStatus.LOCKED && task?.unlockMode === TaskUnlockMode.MANUAL && task.workMode !== TaskWorkMode.GROUP
}
const canAssessManually = (progress: LearningTaskProgress) =>
  canEdit.value &&
  getTaskById(progress.taskId)?.gradingMode === TaskGradingMode.MANUAL &&
  getTaskById(progress.taskId)?.workMode !== TaskWorkMode.GROUP &&
  [TaskProgressStatus.SUBMITTED, TaskProgressStatus.COMPLETED, TaskProgressStatus.FAILED].includes(progress.status)
const canResetManualAssessment = (progress: LearningTaskProgress) =>
  canEdit.value &&
  getTaskById(progress.taskId)?.gradingMode === TaskGradingMode.MANUAL &&
  getTaskById(progress.taskId)?.workMode !== TaskWorkMode.GROUP &&
  (progress.assessment?.passed === true || progress.assessment?.passed === false)

const upsertProgressOverview = (updatedOverview: StudentProgressOverview) => {
  const existingIndex = progressOverview.value.findIndex((student) => student.studentId === updatedOverview.studentId)

  if (existingIndex >= 0) {
    progressOverview.value.splice(existingIndex, 1, updatedOverview)
    return
  }

  progressOverview.value.push(updatedOverview)
}

const manualUnlock = async (taskId: string, studentId: string) => {
  if (!canEdit.value) {
    errorMessage.value = 'Fortschritt historischer Durchläufe kann nicht bearbeitet werden.'
    return
  }

  try {
    const updatedOverview = await learningTaskService.manuallyUnlockTask(taskId, studentId)
    upsertProgressOverview(updatedOverview)
    successMessage.value = 'Aufgabe freigeschaltet.'
  } catch (error) {
    errorMessage.value = getApiErrorMessage(error)
  }
}

const openManualAssessment = (progress: LearningTaskProgress, studentId: string) => {
  const task = getTaskById(progress.taskId)

  if (!task) return

  manualAssessment.open = true
  manualAssessment.taskId = task.id
  manualAssessment.studentId = studentId
  manualAssessment.title = `${progress.order}. ${progress.title}`
  manualAssessment.passed = progress.assessment?.passed ?? true
  manualAssessment.points = progress.assessment?.points ?? (progress.assessment?.passed === false ? 0 : task.maxPoints ?? null)
  manualAssessment.feedback = progress.assessment?.feedback ?? ''
}

const closeManualAssessment = () => {
  manualAssessment.open = false
  manualAssessment.taskId = ''
  manualAssessment.studentId = ''
  manualAssessment.title = ''
  manualAssessment.passed = true
  manualAssessment.points = null
  manualAssessment.feedback = ''
}

const submitManualAssessment = async () => {
  if (!canEdit.value || !props.courseRunId) {
    errorMessage.value = 'Bewertungen sind nur im ausgewählten Durchlauf möglich.'
    return
  }

  const task = getTaskById(manualAssessment.taskId)

  if (!task) return

  try {
    await learningTaskService.assessTaskManually(props.courseId, props.courseRunId, task.id, manualAssessment.studentId, {
      maxPoints: task.maxPoints ?? null,
      points: manualAssessment.points,
      passed: manualAssessment.passed,
      feedback: manualAssessment.feedback.trim() || null
    })
    successMessage.value = manualAssessment.passed ? 'Aufgabe als bestanden bewertet.' : 'Aufgabe als nicht bestanden bewertet.'
    closeManualAssessment()
    await loadTeacherData()
  } catch (error) {
    errorMessage.value = getApiErrorMessage(error)
  }
}

const resetManualAssessment = async (progress: LearningTaskProgress, studentId: string) => {
  if (!canEdit.value || !props.courseRunId) {
    errorMessage.value = 'Bewertungen sind nur im ausgewählten Durchlauf möglich.'
    return
  }

  try {
    await learningTaskService.resetTaskAssessment(props.courseId, props.courseRunId, progress.taskId, studentId)
    successMessage.value = 'Bewertung zurückgesetzt.'
    await loadTeacherData()
  } catch (error) {
    errorMessage.value = getApiErrorMessage(error)
  }
}

const openConfirmation = (title: string, text: string, action: () => Promise<void>) => {
  confirmation.title = title
  confirmation.text = text
  confirmation.action = action
  confirmation.open = true
}

const closeConfirmation = () => {
  confirmation.open = false
  confirmation.action = null
}

const executeConfirmedAction = async () => {
  const action = confirmation.action
  closeConfirmation()

  if (!action) return

  try {
    await action()
  } catch (error) {
    errorMessage.value = getApiErrorMessage(error)
  }
}

const getStatusPresentation = getTaskStatusPresentation

const formatDate = (value: string) =>
  new Intl.DateTimeFormat('de-DE', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value))
</script>

<style scoped lang="scss">
.learning-process {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.process-section {
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

.student-progress {
  flex: 0 0 220px;
  margin-top: 8px;
}

.student-task-list,
.student-progress-list,
.teacher-task-list {
  display: grid;
  gap: 12px;
}

.student-task,
.student-progress-row,
.teacher-task-card,
.task-form {
  background: rgb(var(--v-theme-surface));
  border: 1px solid rgba(var(--v-theme-outline), 0.28);
  border-radius: 8px;
  padding: 16px;
}

.student-task {
  display: grid;
  gap: 12px;

  h3 {
    font-size: 1.1rem;
    margin: 0;
  }

  p {
    margin: 0;
  }
}

.student-task--locked {
  background: rgb(var(--v-theme-surface-muted));
}

.student-task--completed {
  border-color: rgba(var(--v-theme-status-completed), 0.72);
}

.student-task--failed {
  border-color: rgba(var(--v-theme-status-failed), 0.72);
}

.student-task--in_progress {
  border-color: rgba(var(--v-theme-status-progress), 0.72);
}

.student-task__header,
.student-task__actions,
.row-actions {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.student-task__header {
  justify-content: space-between;
}

.student-task__order {
  align-items: center;
  background: rgb(var(--v-theme-primary));
  border-radius: 999px;
  color: rgb(var(--v-theme-on-primary));
  display: inline-flex;
  font-size: 0.85rem;
  height: 28px;
  justify-content: center;
  width: 28px;
}

.student-task__meta {
  color: rgb(var(--v-theme-on-surface-variant));
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  font-size: 0.9rem;
}

.student-task__assessment {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 12px;
  font-size: 0.9rem;
}

.task-form {
  display: grid;
  gap: 12px;
}

.task-form__main,
.task-form__grid {
  display: grid;
  gap: 12px;
}

.task-form__main {
  grid-template-columns: minmax(180px, 1fr) minmax(220px, 1.6fr) 140px;
}

.task-form__grid {
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
}

.task-form__toggles {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 8px 20px;
}

.dependency-condition-list {
  display: grid;
  gap: 8px;
}

.dependency-condition-row {
  align-items: center;
  background: rgba(var(--v-theme-surface-variant), 0.28);
  border: 1px solid rgba(var(--v-theme-outline), 0.12);
  border-radius: 8px;
  display: grid;
  gap: 10px;
  grid-template-columns: minmax(180px, 1fr) minmax(180px, 240px);
  padding: 8px 10px;

  span {
    font-size: 0.9rem;
    line-height: 1.3;
    overflow-wrap: anywhere;
  }
}

.teacher-task-card {
  display: grid;
  gap: 14px;
}

.teacher-task-card--draft {
  border-style: dashed;
}

.teacher-task-card__header {
  align-items: flex-start;
  border-bottom: 1px solid rgba(var(--v-theme-outline), 0.16);
  display: flex;
  gap: 16px;
  justify-content: space-between;
  padding-bottom: 12px;
}

.teacher-task-card__heading {
  align-items: center;
  display: grid;
  gap: 12px;
  grid-template-columns: 72px minmax(0, 1fr);
  min-width: 0;
}

.teacher-task-card__summary {
  min-width: 0;

  strong {
    display: block;
    font-size: 1rem;
    line-height: 1.25;
    overflow-wrap: anywhere;
  }
}

.teacher-task-card__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 6px;
}

.teacher-task-card__actions {
  flex: 0 0 auto;
  justify-content: flex-end;
}

.teacher-task-card__identity {
  display: grid;
  gap: 12px;
  grid-template-columns: minmax(220px, 0.75fr) minmax(300px, 1.25fr);
}

.teacher-task-card__body {
  display: grid;
  gap: 14px;
  grid-template-columns: minmax(300px, 1fr) minmax(380px, 1.2fr) minmax(210px, 0.7fr);
}

.teacher-task-card__group {
  align-content: start;
  display: grid;
  gap: 8px;
  min-width: 0;
}

.teacher-task-card__group-title {
  color: rgb(var(--v-theme-on-surface-variant));
  font-size: 0.78rem;
  font-weight: 700;
  line-height: 1;
  text-transform: uppercase;
}

.teacher-task-card__release {
  display: grid;
  gap: 10px;
  grid-template-columns: minmax(140px, 0.8fr) minmax(160px, 0.9fr) minmax(210px, 1.3fr);
}

.teacher-task-card__assessment {
  display: grid;
  gap: 10px;
  grid-template-columns: minmax(180px, 1fr) 104px 116px;
}

.teacher-task-card__options {
  background: rgba(var(--v-theme-surface-variant), 0.34);
  border: 1px solid rgba(var(--v-theme-outline), 0.12);
  border-radius: 8px;
  display: grid;
  gap: 2px;
  padding: 6px 10px;
}

.teacher-task-card__options :deep(.v-selection-control) {
  min-height: 34px;
}

.teacher-task-card__options :deep(.v-label) {
  font-size: 0.9rem;
  line-height: 1.2;
  white-space: nowrap;
}

.teacher-task-card__order :deep(input) {
  text-align: center;
}

.teacher-task-card__message {
  margin-top: 2px;
}

.student-progress-row {
  display: grid;
  gap: 12px;
}

.student-progress-row__header {
  display: grid;
  gap: 8px;

  div {
    align-items: baseline;
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    justify-content: space-between;
  }

  span {
    color: rgb(var(--v-theme-on-surface-variant));
  }
}

.teacher-progress-tasks {
  display: grid;
  gap: 8px;
}

.teacher-progress-task {
  align-items: center;
  display: grid;
  gap: 8px;
  grid-template-columns: minmax(180px, 1fr) max-content max-content max-content max-content;
}

.confirmation-dialog {
  border-radius: 8px;

  h3 {
    font-size: 1.1rem;
    margin: 0 0 8px;
  }

  p {
    margin: 0 0 16px;
  }
}

.assessment-dialog {
  display: grid;
  gap: 12px;
}

.row-actions--end {
  justify-content: flex-end;
}

@media (max-width: 960px) {
  .section-toolbar,
  .student-progress-row__header div {
    align-items: stretch;
    flex-direction: column;
  }

  .student-progress {
    flex: none;
    width: 100%;
  }

  .task-form__main,
  .task-form__grid,
  .teacher-task-card__identity,
  .teacher-task-card__body,
  .teacher-task-card__release,
  .teacher-task-card__assessment,
  .dependency-condition-row,
  .teacher-progress-task {
    grid-template-columns: 1fr;
  }

  .teacher-task-card__header {
    align-items: stretch;
    flex-direction: column;
  }

  .teacher-task-card__actions {
    justify-content: flex-start;
  }
}
</style>
