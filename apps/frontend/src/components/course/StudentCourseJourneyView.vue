<template>
  <div class="student-course-journey">
    <v-alert
      v-if="errorMessage"
      type="error"
      variant="tonal"
    >
      {{ errorMessage }}
    </v-alert>

    <v-alert
      v-if="successMessage"
      type="success"
      variant="tonal"
    >
      {{ successMessage }}
    </v-alert>

    <v-progress-linear
      v-if="loading"
      color="primary"
      indeterminate
    />

    <template v-else>
      <JourneyProgressSummary
        :course-description="courseDescription"
        :course-name="courseName"
        :course-run-label="courseRunLabel"
        :group-name="groupName"
        :last-feedback="lastFeedback"
        :next-action-label="nextActionLabel"
        :next-task="nextTask"
        :pending-review-count="pendingReviewCount"
        :progress="learningPath"
      />

      <section
        v-if="nextLearningAction"
        class="next-learning-action"
        aria-labelledby="next-learning-action-title"
      >
        <div class="next-learning-action__icon">
          <v-icon size="24">
            {{ nextLearningAction.icon }}
          </v-icon>
        </div>
        <div>
          <h2 id="next-learning-action-title">
            Nächste sinnvolle Aktion
          </h2>
          <p>{{ nextLearningAction.message }}</p>
          <span v-if="nextLearningAction.detail">
            {{ nextLearningAction.detail }}
          </span>
        </div>
      </section>

      <v-alert
        v-if="groupStatusMessage"
        density="comfortable"
        type="info"
        variant="tonal"
      >
        {{ groupStatusMessage }}
      </v-alert>

      <section
        class="journey-section"
        aria-labelledby="learning-journey-title"
      >
        <div class="journey-section__heading">
          <div>
            <h2 id="learning-journey-title">
              Lernreise
            </h2>
            <p>Arbeite die Schritte der Reihe nach durch. Gesperrte Inhalte zeigen dir, was noch fehlt.</p>
          </div>
          <v-btn
            variant="text"
            @click="loadData"
          >
            <v-icon start>
              mdi-refresh
            </v-icon>
            Aktualisieren
          </v-btn>
        </div>

        <v-empty-state
          v-if="studentTasks.length === 0"
          icon="mdi-map-outline"
          title="Noch keine Lernschritte verfügbar"
          text="Für diesen Kurs wurden noch keine freigegebenen Aufgaben angelegt."
        />

        <div
          v-else
          class="journey-step-list"
        >
          <LearningJourneyStepCard
            v-for="task in studentTasks"
            :key="task.id"
            :is-next="task.id === nextTask?.id"
            :materials="materialsForTask(task.id)"
            :reflection="reflectionForTask(task)"
            :task="task"
            @open-material="openMaterial"
            @task-action="handleTaskAction"
          />
        </div>
      </section>

      <section
        v-if="unassignedMaterials.length > 0"
        class="journey-section"
        aria-labelledby="extra-materials-title"
      >
        <div class="journey-section__heading">
          <div>
            <h2 id="extra-materials-title">
              Weitere Materialien
            </h2>
            <p>Diese Inhalte sind keinem einzelnen Lernschritt zugeordnet.</p>
          </div>
        </div>
        <JourneyMaterialList
          :materials="unassignedMaterials"
          title="Zusatzmaterial"
          @open="openMaterial"
        />
      </section>
    </template>

    <v-dialog
      v-if="submissionDialogOpen || submissionTask"
      v-model="submissionDialogOpen"
      max-width="640"
    >
      <v-card>
        <v-card-title>Abgabe bearbeiten</v-card-title>
        <v-card-text>
          <div class="submission-form">
            <p v-if="submissionTask">
              {{ submissionTask.order }}. {{ submissionTask.title }}
            </p>
            <v-textarea
              v-model="submissionForm.text"
              label="Bearbeitung oder Kommentar"
              rows="5"
              variant="outlined"
            />
            <v-text-field
              v-model="submissionForm.link"
              label="Externer Abgabelink"
              placeholder="https://..."
              variant="outlined"
            />
            <div
              v-if="existingSubmissionFileLabel && !selectedSubmissionFile"
              class="submission-form__existing-file"
            >
              <v-icon size="18">
                mdi-paperclip
              </v-icon>
              Vorhandene Datei bleibt erhalten: {{ existingSubmissionFileLabel }}
            </div>
            <v-file-input
              v-model="submissionFile"
              accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.zip,.png,.jpg,.jpeg,.webp,.gif,.csv,.md,.txt,.mp4,.mov,.webm"
              clearable
              label="Datei hochladen"
              show-size
              variant="outlined"
            />
            <v-progress-linear
              v-if="uploadProgress > 0 && uploadProgress < 100"
              :model-value="uploadProgress"
              color="primary"
              height="8"
              rounded
            />
            <v-alert
              v-if="submissionValidationMessage"
              density="compact"
              type="warning"
              variant="tonal"
            >
              {{ submissionValidationMessage }}
            </v-alert>
          </div>
        </v-card-text>
        <v-card-actions class="submission-form__actions">
          <v-btn
            variant="text"
            @click="closeSubmissionDialog"
          >
            Abbrechen
          </v-btn>
          <v-btn
            color="primary"
            :disabled="Boolean(submissionValidationMessage)"
            :loading="savingSubmission"
            @click="saveSubmission"
          >
            Abgabe senden
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import courseService, { type StudyGroup } from '@/services/course.service'
import learningMaterialService, { LearningMaterialType, type LearningMaterial } from '@/services/learningMaterial.service'
import learningTaskService, {
  TaskAssessmentStatus,
  TaskProgressStatus,
  TaskWorkMode,
  type LearningPath,
  type StudentLearningTask,
  type TaskSubmissionData
} from '@/services/learningTask.service'
import { getApiErrorMessage } from '@/services/apiErrors'
import JourneyMaterialList from './JourneyMaterialList.vue'
import JourneyProgressSummary from './JourneyProgressSummary.vue'
import LearningJourneyStepCard, { type JourneyTaskAction } from './LearningJourneyStepCard.vue'
import { getLearningStepReflection, getNextLearningAction } from './getNextLearningAction'

const props = defineProps<{
  courseDescription?: string
  courseId: string
  courseName: string
  courseRunId?: string
  courseRunLabel?: string
}>()

const loading = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const learningPath = ref<LearningPath | null>(null)
const materials = ref<LearningMaterial[]>([])
const studyGroup = ref<StudyGroup | null>(null)
const savingSubmission = ref(false)
const submissionDialogOpen = ref(false)
const submissionFile = ref<File | File[] | null>(null)
const submissionTask = ref<StudentLearningTask | null>(null)
const uploadProgress = ref(0)
const submissionForm = reactive({
  link: '',
  text: ''
})

const MAX_TASK_SUBMISSION_FILE_SIZE = 50 * 1024 * 1024
const ALLOWED_TASK_SUBMISSION_MIME_TYPES = [
  'application/msword',
  'application/pdf',
  'application/vnd.ms-excel',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/zip',
  'image/gif',
  'image/jpeg',
  'image/png',
  'image/webp',
  'text/csv',
  'text/markdown',
  'text/plain',
  'video/mp4',
  'video/quicktime',
  'video/webm'
]

const studentTasks = computed(() =>
  [...(learningPath.value?.tasks ?? [])].sort((left, right) => left.order - right.order)
)

const materialsByTaskId = computed(() => {
  const grouped = new Map<string, LearningMaterial[]>()

  for (const material of materials.value) {
    if (!material.releaseAfterTaskId) {
      continue
    }

    grouped.set(material.releaseAfterTaskId, [...(grouped.get(material.releaseAfterTaskId) ?? []), material])
  }

  return grouped
})

const unassignedMaterials = computed(() => materials.value.filter((material) => !material.releaseAfterTaskId))

const groupName = computed(() => studyGroup.value?.name ?? studentTasks.value.find((task) => task.group?.name)?.group?.name)

const groupStatusMessage = computed(() => {
  if (groupName.value) {
    return `Du bist in ${groupName.value}. Gruppenaufgaben bearbeitest du gemeinsam mit deiner Gruppe.`
  }

  const hasGroupTask = studentTasks.value.some((task) => task.workMode === TaskWorkMode.GROUP)

  return hasGroupTask ? 'In diesem Kurs gibt es Gruppenaufgaben. Du bist aktuell noch keiner Gruppe zugeordnet.' : ''
})

const pendingReviewCount = computed(() =>
  studentTasks.value.filter((task) =>
    task.status === TaskProgressStatus.SUBMITTED ||
    task.assessment?.status === TaskAssessmentStatus.PENDING_REVIEW ||
    task.assessment?.status === TaskAssessmentStatus.SUBMITTED
  ).length
)

const lastFeedback = computed(() =>
  [...studentTasks.value]
    .reverse()
    .find((task) => Boolean(task.assessment?.feedback))
    ?.assessment?.feedback ?? ''
)

const nextTask = computed(() => {
  const tasks = studentTasks.value

  return (
    tasks.find((task) => task.status === TaskProgressStatus.IN_PROGRESS) ??
    tasks.find((task) => task.status === TaskProgressStatus.AVAILABLE || (task.status === TaskProgressStatus.FAILED && task.allowRetries)) ??
    tasks.find((task) => task.status === TaskProgressStatus.SUBMITTED) ??
    tasks.find((task) => task.status === TaskProgressStatus.LOCKED) ??
    null
  )
})

const nextLearningAction = computed(() =>
  getNextLearningAction(studentTasks.value, materials.value)
)

const nextActionLabel = computed(() => {
  if (!nextTask.value) return ''

  return nextLearningAction.value.detail ?? nextLearningAction.value.message
})

const selectedSubmissionFile = computed(() => {
  if (Array.isArray(submissionFile.value)) {
    return submissionFile.value[0] ?? null
  }

  return submissionFile.value
})

const currentSubmissionData = computed<TaskSubmissionData | null>(() => submissionTask.value?.assessment?.submissionData ?? null)
const existingSubmissionFileLabel = computed(() => {
  const file = currentSubmissionData.value?.file

  if (!file?.originalFileName) {
    return ''
  }

  return file.fileSize === undefined
    ? file.originalFileName
    : `${file.originalFileName} · ${formatFileSize(file.fileSize)}`
})

const submissionValidationMessage = computed(() => {
  const text = submissionForm.text.trim()
  const link = submissionForm.link.trim()
  const file = selectedSubmissionFile.value
  const keepsExistingFile = Boolean(existingSubmissionFileLabel.value && !file)

  if (!text && !link && !file && !keepsExistingFile) {
    return 'Erfasse einen Text, einen Link oder lade eine Datei hoch.'
  }

  if (link) {
    try {
      const parsedUrl = new URL(link)

      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        return 'Der Link muss mit http oder https beginnen.'
      }
    } catch {
      return 'Der Link ist keine gültige URL.'
    }
  }

  if (file) {
    if (file.size > MAX_TASK_SUBMISSION_FILE_SIZE) {
      return 'Die Datei ist zu groß. Maximal erlaubt sind 50 MB.'
    }

    if (file.type && !ALLOWED_TASK_SUBMISSION_MIME_TYPES.includes(file.type)) {
      return 'Dieser Dateityp ist für Abgaben nicht erlaubt.'
    }
  }

  return ''
})

onMounted(() => {
  loadData()
})

watch(
  () => [props.courseId, props.courseRunId],
  () => loadData()
)

const loadData = async () => {
  loading.value = true
  errorMessage.value = ''
  successMessage.value = ''

  try {
    const [loadedPath, loadedMaterials, loadedGroup] = await Promise.all([
      learningTaskService.getMyLearningPath(props.courseId),
      learningMaterialService.listMaterials(props.courseId),
      props.courseRunId ? courseService.getMyStudyGroup(props.courseId, props.courseRunId) : Promise.resolve(null)
    ])

    learningPath.value = loadedPath
    materials.value = loadedMaterials
    studyGroup.value = loadedGroup
  } catch (error) {
    errorMessage.value = getApiErrorMessage(error)
  } finally {
    loading.value = false
  }
}

const materialsForTask = (taskId: string): LearningMaterial[] => materialsByTaskId.value.get(taskId) ?? []

const reflectionForTask = (task: StudentLearningTask) =>
  getLearningStepReflection(task, studentTasks.value, materials.value)

const handleTaskAction = async (action: JourneyTaskAction, task: StudentLearningTask) => {
  errorMessage.value = ''
  successMessage.value = ''

  try {
    if (action === 'start') {
      learningPath.value = task.workMode === TaskWorkMode.GROUP
        ? await learningTaskService.startGroupTask(task.id)
        : await learningTaskService.startTask(task.id)
      successMessage.value = task.workMode === TaskWorkMode.GROUP ? 'Gruppenaufgabe begonnen.' : 'Aufgabe gestartet.'
    }

    if (action === 'self-confirm') {
      learningPath.value = await learningTaskService.selfConfirmTask(task.id)
      successMessage.value = 'Lernschritt als erledigt markiert.'
    }

    if (action === 'open-submission') {
      openSubmissionDialog(task)
      return
    }

    if (action === 'mock-evaluate') {
      learningPath.value = await learningTaskService.mockEvaluateTask(task.id)
      successMessage.value = 'Demo-Abgabe wurde automatisch bewertet.'
    }

    materials.value = await learningMaterialService.listMaterials(props.courseId)
  } catch (error) {
    errorMessage.value = getApiErrorMessage(error)
  }
}

const openSubmissionDialog = (task: StudentLearningTask) => {
  submissionTask.value = task
  submissionForm.text = typeof task.assessment?.submissionData?.text === 'string'
    ? task.assessment.submissionData.text
    : ''
  submissionForm.link = typeof task.assessment?.submissionData?.link === 'string'
    ? task.assessment.submissionData.link
    : ''
  submissionFile.value = null
  uploadProgress.value = 0
  submissionDialogOpen.value = true
}

const closeSubmissionDialog = () => {
  submissionDialogOpen.value = false
  submissionTask.value = null
  submissionForm.link = ''
  submissionForm.text = ''
  submissionFile.value = null
  uploadProgress.value = 0
}

const saveSubmission = async () => {
  const task = submissionTask.value

  if (!task || submissionValidationMessage.value) {
    return
  }

  savingSubmission.value = true
  errorMessage.value = ''
  successMessage.value = ''

  const file = selectedSubmissionFile.value
  const submissionData = {
    link: submissionForm.link.trim() || undefined,
    text: submissionForm.text.trim() || undefined
  }
  const keepExistingFile = Boolean(existingSubmissionFileLabel.value && !file)

  try {
    if (file) {
      learningPath.value = task.workMode === TaskWorkMode.GROUP
        ? await learningTaskService.submitGroupTaskWithUpload(task.id, {
          ...submissionData,
          file,
          keepExistingFile
        }, (percentage) => {
          uploadProgress.value = percentage
        })
        : await learningTaskService.submitTaskWithUpload(task.id, {
          ...submissionData,
          file,
          keepExistingFile
        }, (percentage) => {
          uploadProgress.value = percentage
        })
    } else {
      learningPath.value = task.workMode === TaskWorkMode.GROUP
        ? await learningTaskService.submitGroupTask(task.id, submissionData, { keepExistingFile })
        : await learningTaskService.submitTask(task.id, submissionData, { keepExistingFile })
    }

    successMessage.value = 'Deine Abgabe wartet jetzt auf Bewertung.'
    closeSubmissionDialog()
    materials.value = await learningMaterialService.listMaterials(props.courseId)
  } catch (error) {
    errorMessage.value = getApiErrorMessage(error)
  } finally {
    savingSubmission.value = false
  }
}

const openMaterial = (material: LearningMaterial) => {
  errorMessage.value = ''

  if (material.locked) {
    errorMessage.value = material.lockedReason ?? 'Dieses Material ist noch gesperrt.'
    return
  }

  if (material.type === LearningMaterialType.EXTERNAL_LINK && material.url) {
    window.open(material.url, '_blank', 'noopener')
    return
  }

  learningMaterialService
    .downloadMaterial(material.id)
    .then((blob) => {
      const objectUrl = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = objectUrl
      anchor.download = material.originalFileName ?? material.title
      anchor.click()
      URL.revokeObjectURL(objectUrl)
    })
    .catch((error) => {
      errorMessage.value = getApiErrorMessage(error)
    })
}

defineExpose({
  handleTaskAction,
  loadData,
  materials,
  openMaterial,
  openSubmissionDialog,
  saveSubmission
})

const formatFileSize = (size: number): string => {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}
</script>

<style scoped>
.student-course-journey {
  display: flex;
  flex-direction: column;
  gap: 20px;
  margin-top: 16px;
}

.journey-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.next-learning-action {
  align-items: flex-start;
  background: rgba(var(--v-theme-primary), 0.08);
  border: 1px solid rgba(var(--v-theme-primary), 0.32);
  border-radius: 8px;
  display: flex;
  gap: 14px;
  padding: 16px;
}

.next-learning-action__icon {
  align-items: center;
  background: rgba(var(--v-theme-primary), 0.12);
  border-radius: 8px;
  color: rgb(var(--v-theme-primary));
  display: inline-flex;
  flex: 0 0 auto;
  height: 42px;
  justify-content: center;
  width: 42px;
}

.next-learning-action h2 {
  font-size: 1rem;
  font-weight: 700;
  margin: 0 0 4px;
}

.next-learning-action p {
  font-size: 1.03rem;
  font-weight: 600;
  margin: 0;
}

.next-learning-action span {
  color: rgb(var(--v-theme-on-surface-variant));
  display: block;
  margin-top: 4px;
}

.journey-section__heading {
  align-items: flex-start;
  display: flex;
  gap: 16px;
  justify-content: space-between;
}

.journey-section__heading h2 {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0 0 4px;
}

.journey-section__heading p {
  color: rgb(var(--v-theme-on-surface-variant));
  margin: 0;
}

.journey-step-list {
  display: grid;
  gap: 16px;
}

.submission-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.submission-form p {
  margin: 0;
}

.submission-form__existing-file {
  align-items: center;
  color: rgb(var(--v-theme-on-surface-variant));
  display: flex;
  gap: 8px;
}

.submission-form__actions {
  justify-content: flex-end;
}

@media (max-width: 720px) {
  .journey-section__heading {
    align-items: stretch;
    flex-direction: column;
  }
}
</style>
