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
          <v-text-field v-model="newTask.title" label="Titel" density="compact" />
          <v-text-field v-model="newTask.description" label="Beschreibung" density="compact" />
          <div class="task-form__grid">
            <v-text-field v-model.number="newTask.order" label="Reihenfolge" type="number" density="compact" />
            <v-select v-model="newTask.unlockMode" :items="unlockModeOptions" label="Freischaltmodus" density="compact" />
            <v-select v-model="newTask.prerequisiteTaskId" :items="createPrerequisiteOptions" item-title="title" item-value="id" label="Voraussetzung" density="compact" clearable :disabled="newTask.unlockMode === TaskUnlockMode.IMMEDIATE" />
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
          <div v-for="task in sortedTasks" :key="task.id" class="teacher-task-row" data-testid="teacher-task-row">
            <v-text-field v-model.number="task.order" label="Reihenfolge" type="number" density="compact" hide-details :disabled="!canEdit" />
            <v-text-field v-model="task.title" label="Titel" density="compact" hide-details :disabled="!canEdit" />
            <v-text-field v-model="task.description" label="Beschreibung" density="compact" hide-details :disabled="!canEdit" />
            <v-select v-model="task.unlockMode" :items="unlockModeOptions" label="Freischaltmodus" density="compact" hide-details :disabled="!canEdit" />
            <v-select v-model="task.prerequisiteTaskId" :items="getPrerequisiteOptions(task)" item-title="title" item-value="id" label="Voraussetzung" density="compact" hide-details clearable :disabled="!canEdit || task.unlockMode === TaskUnlockMode.IMMEDIATE" />
            <v-switch v-model="task.isPublished" label="Freigegeben" color="primary" hide-details :disabled="!canEdit" />
            <div v-if="canEdit" class="row-actions">
              <v-btn size="small" color="primary" :disabled="Boolean(getTaskValidationMessage(task))" @click="saveTask(task)"> Speichern </v-btn>
              <v-btn size="small" variant="text" color="error" @click="requestDeleteTask(task)"> Löschen </v-btn>
            </div>
            <v-alert v-if="getTaskValidationMessage(task)" class="teacher-task-row__message" type="warning" variant="tonal" density="compact">
              {{ getTaskValidationMessage(task) }}
            </v-alert>
          </div>
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
            <v-alert v-if="task.lockedReason" type="info" variant="tonal" density="compact">
              {{ task.lockedReason }}
            </v-alert>
            <div class="student-task__meta">
              <span>{{ formatUnlockMode(task.unlockMode) }}</span>
              <span v-if="task.unlockedAt">Freigeschaltet am {{ formatDate(task.unlockedAt) }}</span>
              <span v-if="task.completedAt">Abgeschlossen am {{ formatDate(task.completedAt) }}</span>
            </div>
            <div class="student-task__actions">
              <v-btn v-if="canStartTask(task)" color="primary" variant="outlined" @click="startTask(task)"> Aufgabe beginnen </v-btn>
              <v-btn v-if="canCompleteTask(task)" color="primary" @click="requestTaskResult(task, 'complete')"> Erfolgreich abschließen </v-btn>
              <v-btn v-if="canFailTask(task)" color="error" variant="outlined" @click="requestTaskResult(task, 'fail')"> Nicht erfolgreich abschließen </v-btn>
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
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import learningTaskService, { TaskProgressStatus, TaskUnlockMode, formatUnlockMode, type LearningPath, type LearningTask, type StudentLearningTask, type StudentProgressOverview } from '@/services/learningTask.service'
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
  prerequisiteTaskId: null as string | null
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

const unlockModeOptions = [TaskUnlockMode.IMMEDIATE, TaskUnlockMode.AUTOMATIC, TaskUnlockMode.MANUAL]

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
const newTaskValidationMessage = computed(() => {
  if (newTask.title.trim().length === 0) {
    return 'Ein Titel ist erforderlich.'
  }

  if (newTask.unlockMode === TaskUnlockMode.AUTOMATIC && !newTask.prerequisiteTaskId) {
    return 'Automatische Freischaltung benötigt eine Voraussetzung.'
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
    tasks.value = loadedTasks
    progressOverview.value = loadedOverview
  })

const resetNewTask = () => {
  newTask.title = ''
  newTask.description = ''
  newTask.order = sortedTasks.value.length + 1
  newTask.unlockMode = TaskUnlockMode.IMMEDIATE
  newTask.prerequisiteTaskId = null
  showCreateForm.value = false
}

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
      prerequisiteTaskId: newTask.unlockMode === TaskUnlockMode.IMMEDIATE ? null : newTask.prerequisiteTaskId,
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

const wouldCreateCycle = (taskId: string, prerequisiteTaskId?: string | null): boolean => {
  let currentTaskId = prerequisiteTaskId ?? undefined
  const visitedTaskIds = new Set<string>()

  while (currentTaskId) {
    if (currentTaskId === taskId) {
      return true
    }

    if (visitedTaskIds.has(currentTaskId)) {
      return true
    }

    visitedTaskIds.add(currentTaskId)
    currentTaskId = getTaskById(currentTaskId)?.prerequisiteTaskId
  }

  return false
}

const getTaskValidationMessage = (task: LearningTask): string => {
  if (task.title.trim().length === 0) {
    return 'Ein Titel ist erforderlich.'
  }

  if (task.unlockMode === TaskUnlockMode.IMMEDIATE && task.prerequisiteTaskId) {
    return 'Sofort verfügbare Aufgaben dürfen keine Voraussetzung haben.'
  }

  if (task.unlockMode === TaskUnlockMode.AUTOMATIC && !task.prerequisiteTaskId) {
    return 'Automatische Freischaltung benötigt eine Voraussetzung.'
  }

  if (task.prerequisiteTaskId === task.id) {
    return 'Eine Aufgabe darf nicht von sich selbst abhängen.'
  }

  if (wouldCreateCycle(task.id, task.prerequisiteTaskId)) {
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
      prerequisiteTaskId: task.unlockMode === TaskUnlockMode.IMMEDIATE ? null : (task.prerequisiteTaskId ?? null),
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

const canStartTask = (task: StudentLearningTask) => task.status === TaskProgressStatus.AVAILABLE || task.status === TaskProgressStatus.FAILED
const canCompleteTask = (task: StudentLearningTask) => task.status === TaskProgressStatus.IN_PROGRESS
const canFailTask = (task: StudentLearningTask) => task.status === TaskProgressStatus.IN_PROGRESS

const startTask = async (task: StudentLearningTask) => {
  try {
    learningPath.value = await learningTaskService.startTask(task.id)
    successMessage.value = 'Aufgabe begonnen.'
  } catch (error) {
    errorMessage.value = getApiErrorMessage(error)
  }
}

const requestTaskResult = (task: StudentLearningTask, result: 'complete' | 'fail') => {
  openConfirmation(result === 'complete' ? 'Aufgabe erfolgreich abschließen' : 'Aufgabe nicht erfolgreich abschließen', `Soll "${task.title}" wirklich als ${result === 'complete' ? 'erfolgreich' : 'nicht erfolgreich'} abgeschlossen werden?`, async () => {
    learningPath.value = result === 'complete' ? await learningTaskService.completeTask(task.id) : await learningTaskService.failTask(task.id)
    successMessage.value = result === 'complete' ? 'Aufgabe erfolgreich abgeschlossen.' : 'Aufgabe als nicht erfolgreich abgeschlossen.'
  })
}

const canManuallyUnlock = (taskId: string, status: TaskProgressStatus) => canEdit.value && status === TaskProgressStatus.LOCKED && tasks.value.find((task) => task.id === taskId)?.unlockMode === TaskUnlockMode.MANUAL

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
.teacher-task-row,
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

.task-form__grid {
  display: grid;
  gap: 12px;
  grid-template-columns: minmax(120px, 160px) minmax(180px, 1fr) minmax(180px, 1fr);
}

.teacher-task-row {
  display: grid;
  gap: 12px;
  grid-template-columns: 110px minmax(160px, 1fr) minmax(180px, 1.4fr) 170px minmax(180px, 1fr) 150px auto;
}

.teacher-task-row__message {
  grid-column: 1 / -1;
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
  grid-template-columns: minmax(180px, 1fr) max-content max-content;
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

  .task-form__grid,
  .teacher-task-row,
  .teacher-progress-task {
    grid-template-columns: 1fr;
  }
}
</style>
