<template>
  <article
    class="journey-step"
    :class="{
      'journey-step--locked': isLocked,
      'journey-step--next': isNext && !isLocked
    }"
  >
    <div class="journey-step__rail">
      <span>{{ task.order }}</span>
    </div>

    <div class="journey-step__content">
      <header class="journey-step__header">
        <div>
          <div class="journey-step__chips">
            <v-chip
              :color="statusPresentation.color"
              label
              size="small"
              variant="tonal"
            >
              <v-icon start>
                {{ statusPresentation.icon }}
              </v-icon>
              {{ statusPresentation.label }}
            </v-chip>
            <v-chip
              label
              size="small"
              variant="tonal"
            >
              <v-icon start>
                {{ task.workMode === TaskWorkMode.GROUP ? 'mdi-account-multiple-outline' : 'mdi-account-outline' }}
              </v-icon>
              {{ formatTaskWorkMode(task.workMode) }}
            </v-chip>
          </div>
          <h3>{{ task.title }}</h3>
          <p v-if="!isLocked">
            {{ task.description }}
          </p>
          <p
            v-else
            class="journey-step__locked-copy"
          >
            Details werden sichtbar, sobald dieser Lernschritt freigeschaltet ist.
          </p>
        </div>

        <v-chip
          v-if="isNext"
          color="primary"
          label
          size="small"
          variant="tonal"
        >
          <v-icon start>
            mdi-arrow-right-circle-outline
          </v-icon>
          Nächster Schritt
        </v-chip>
      </header>

      <v-alert
        v-if="task.lockedReason"
        density="compact"
        type="info"
        variant="tonal"
      >
        {{ task.lockedReason }}
      </v-alert>

      <template v-if="!isLocked">
        <div
          v-if="task.group?.name"
          class="journey-step__hint"
        >
          <v-icon size="18">
            mdi-account-multiple-outline
          </v-icon>
          Diese Gruppenaufgabe bearbeitest du mit {{ task.group.name }}.
        </div>

        <JourneyMaterialList
          :materials="materials"
          title="Begleitmaterial"
          @open="$emit('open-material', $event)"
        />

        <div
          v-if="hasSubmission"
          class="journey-step__submission"
        >
          <h4>Deine Abgabe</h4>
          <p v-if="submissionText">
            {{ submissionText }}
          </p>
          <a
            v-if="submissionLink"
            :href="submissionLink"
            rel="noopener"
            target="_blank"
          >
            Link öffnen
          </a>
          <span v-if="submissionFileLabel">
            <v-icon size="18">
              mdi-paperclip
            </v-icon>
            {{ submissionFileLabel }}
          </span>
        </div>

        <JourneyAssessmentStatus
          :assessment="task.assessment"
          :grading-mode="task.gradingMode"
          :max-points="task.maxPoints"
        />
      </template>

      <div
        v-if="isLocked"
        class="journey-step__hint"
      >
        <v-icon
          color="status-locked"
          size="18"
        >
          mdi-lock-outline
        </v-icon>
        Diese Aufgabe ist noch nicht bearbeitbar.
      </div>

      <div class="journey-step__footer">
        <div class="journey-step__meta">
          <span v-if="task.unlockedAt">Freigeschaltet am {{ formatDate(task.unlockedAt) }}</span>
          <span v-if="task.completedAt">Abgeschlossen am {{ formatDate(task.completedAt) }}</span>
          <span v-if="task.assessment?.assessedAt">Bewertet am {{ formatDate(task.assessment.assessedAt) }}</span>
        </div>

        <v-btn
          v-if="primaryAction"
          color="primary"
          :prepend-icon="primaryAction.icon"
          variant="flat"
          @click="$emit('task-action', primaryAction.type, task)"
        >
          {{ primaryAction.label }}
        </v-btn>
      </div>
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { LearningMaterial } from '@/services/learningMaterial.service'
import {
  TaskGradingMode,
  TaskProgressStatus,
  TaskWorkMode,
  formatTaskWorkMode,
  type StudentLearningTask,
  type TaskSubmissionData
} from '@/services/learningTask.service'
import { getTaskStatusPresentation } from '@/services/statusPresentation'
import JourneyAssessmentStatus from './JourneyAssessmentStatus.vue'
import JourneyMaterialList from './JourneyMaterialList.vue'

export type JourneyTaskAction = 'start' | 'self-confirm' | 'open-submission' | 'mock-evaluate'

const props = defineProps<{
  isNext?: boolean
  materials: LearningMaterial[]
  task: StudentLearningTask
}>()

defineEmits<{
  'open-material': [material: LearningMaterial]
  'task-action': [action: JourneyTaskAction, task: StudentLearningTask]
}>()

const statusPresentation = computed(() => getTaskStatusPresentation(props.task.status))
const isLocked = computed(() => props.task.locked || props.task.status === TaskProgressStatus.LOCKED)
const submissionData = computed<TaskSubmissionData | null>(() => props.task.assessment?.submissionData ?? null)
const submissionText = computed(() => typeof submissionData.value?.text === 'string' ? submissionData.value.text : '')
const submissionLink = computed(() => typeof submissionData.value?.link === 'string' ? submissionData.value.link : '')
const submissionFileLabel = computed(() => {
  const file = submissionData.value?.file

  if (!file?.originalFileName) {
    return ''
  }

  return file.fileSize === undefined
    ? file.originalFileName
    : `${file.originalFileName} · ${formatFileSize(file.fileSize)}`
})
const hasSubmission = computed(() =>
  Boolean(submissionText.value || submissionLink.value || submissionFileLabel.value)
)

const primaryAction = computed<{ icon: string; label: string; type: JourneyTaskAction } | null>(() => {
  const task = props.task

  if (isLocked.value) {
    return null
  }

  if (task.status === TaskProgressStatus.AVAILABLE || (task.status === TaskProgressStatus.FAILED && task.allowRetries)) {
    if (task.gradingMode === TaskGradingMode.MANUAL) {
      return {
        icon: 'mdi-file-edit-outline',
        label: 'Aufgabe bearbeiten',
        type: 'open-submission'
      }
    }

    return {
      icon: task.workMode === TaskWorkMode.GROUP ? 'mdi-account-multiple-plus-outline' : 'mdi-play-circle-outline',
      label: task.workMode === TaskWorkMode.GROUP ? 'Gruppenaufgabe beginnen' : 'Aufgabe starten',
      type: 'start'
    }
  }

  if (
    task.gradingMode === TaskGradingMode.MANUAL &&
    [TaskProgressStatus.IN_PROGRESS, TaskProgressStatus.SUBMITTED].includes(task.status)
  ) {
    return {
      icon: 'mdi-file-edit-outline',
      label: hasSubmission.value ? 'Aufgabe weiter bearbeiten' : 'Aufgabe bearbeiten',
      type: 'open-submission'
    }
  }

  if (task.status !== TaskProgressStatus.IN_PROGRESS) {
    return null
  }

  if (
    task.workMode !== TaskWorkMode.GROUP &&
    (task.gradingMode === TaskGradingMode.NOT_GRADED || task.gradingMode === TaskGradingMode.SELF_CONFIRMATION)
  ) {
    return {
      icon: 'mdi-check-circle-outline',
      label: 'Als erledigt markieren',
      type: 'self-confirm'
    }
  }

  if (task.workMode !== TaskWorkMode.GROUP && task.gradingMode === TaskGradingMode.AUTOMATIC_MOCK) {
    return {
      icon: 'mdi-auto-fix',
      label: 'Demo-Abgabe auslösen',
      type: 'mock-evaluate'
    }
  }

  return null
})

const formatDate = (value: string) =>
  new Intl.DateTimeFormat('de-DE', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value))

const formatFileSize = (size: number): string => {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}
</script>

<style scoped>
.journey-step {
  display: grid;
  gap: 14px;
  grid-template-columns: 42px minmax(0, 1fr);
  position: relative;
}

.journey-step:not(:last-child)::before {
  background: rgba(var(--v-theme-outline), 0.35);
  bottom: -18px;
  content: '';
  left: 20px;
  position: absolute;
  top: 46px;
  width: 2px;
}

.journey-step__rail {
  align-items: center;
  display: flex;
  justify-content: center;
}

.journey-step__rail span {
  align-items: center;
  background: rgb(var(--v-theme-surface));
  border: 1px solid rgba(var(--v-theme-outline), 0.36);
  border-radius: 999px;
  display: inline-flex;
  font-weight: 700;
  height: 40px;
  justify-content: center;
  width: 40px;
  z-index: 1;
}

.journey-step--next .journey-step__rail span {
  border-color: rgb(var(--v-theme-primary));
  color: rgb(var(--v-theme-primary));
}

.journey-step__content {
  background: rgb(var(--v-theme-surface));
  border: 1px solid rgba(var(--v-theme-outline), 0.28);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 16px;
}

.journey-step--next .journey-step__content {
  border-color: rgba(var(--v-theme-primary), 0.68);
}

.journey-step--locked .journey-step__content {
  background: rgba(var(--v-theme-surface-variant), 0.18);
  border-style: dashed;
}

.journey-step--locked .journey-step__rail span {
  background: rgba(var(--v-theme-surface-variant), 0.28);
  color: rgb(var(--v-theme-on-surface-variant));
}

.journey-step__header {
  align-items: flex-start;
  display: flex;
  gap: 16px;
  justify-content: space-between;
}

.journey-step__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 8px;
}

.journey-step h3 {
  font-size: 1.12rem;
  font-weight: 600;
  line-height: 1.3;
  margin: 0;
}

.journey-step p {
  color: rgb(var(--v-theme-on-surface-variant));
  margin: 6px 0 0;
}

.journey-step__locked-copy {
  font-style: italic;
}

.journey-step__hint,
.journey-step__meta {
  color: rgb(var(--v-theme-on-surface-variant));
  font-size: 0.9rem;
}

.journey-step__hint {
  align-items: center;
  display: flex;
  gap: 8px;
}

.journey-step__submission {
  border-left: 3px solid rgb(var(--v-theme-primary));
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-left: 12px;
}

.journey-step__submission h4 {
  font-size: 0.95rem;
  font-weight: 600;
  margin: 0;
}

.journey-step__submission p {
  margin: 0;
}

.journey-step__submission a,
.journey-step__submission span {
  align-items: center;
  color: rgb(var(--v-theme-on-surface-variant));
  display: inline-flex;
  gap: 6px;
  overflow-wrap: anywhere;
}

.journey-step__footer {
  align-items: center;
  display: flex;
  gap: 16px;
  justify-content: space-between;
}

.journey-step__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

@media (max-width: 720px) {
  .journey-step {
    grid-template-columns: 1fr;
  }

  .journey-step::before {
    display: none;
  }

  .journey-step__rail {
    justify-content: flex-start;
  }

  .journey-step__header,
  .journey-step__footer {
    align-items: stretch;
    flex-direction: column;
  }
}
</style>
