<template>
  <div class="journey-assessment">
    <v-chip
      :color="assessmentPresentation.color"
      label
      size="small"
      variant="tonal"
    >
      <v-icon start>
        {{ assessmentPresentation.icon }}
      </v-icon>
      {{ assessmentPresentation.label }}
    </v-chip>

    <span
      v-if="pointsLabel"
      class="journey-assessment__points"
    >
      {{ pointsLabel }}
    </span>

    <div
      v-if="assessment?.feedback"
      class="journey-assessment__feedback"
    >
      <strong>Anmerkung zur Bewertung</strong>
      <p>{{ assessment.feedback }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { TaskAssessmentStatus, TaskGradingMode, type TaskAssessment } from '@/services/learningTask.service'

const props = defineProps<{
  assessment?: TaskAssessment | null
  gradingMode: TaskGradingMode
  maxPoints?: number | null
}>()

const assessmentPresentation = computed(() => {
  if (props.gradingMode === TaskGradingMode.NOT_GRADED && !props.assessment) {
    return {
      color: 'status-locked',
      icon: 'mdi-minus-circle-outline',
      label: 'Keine Bewertung vorgesehen'
    }
  }

  if (!props.assessment) {
    return {
      color: 'status-locked',
      icon: 'mdi-timer-sand',
      label: 'Noch keine Bewertung'
    }
  }

  if (props.assessment.passed === true || props.assessment.status === TaskAssessmentStatus.PASSED) {
    return {
      color: 'success',
      icon: 'mdi-check-decagram-outline',
      label: 'Bestanden'
    }
  }

  if (props.assessment.passed === false || props.assessment.status === TaskAssessmentStatus.FAILED) {
    return {
      color: 'error',
      icon: 'mdi-close-circle-outline',
      label: 'Nicht bestanden'
    }
  }

  if (props.assessment.status === TaskAssessmentStatus.PENDING_REVIEW || props.assessment.status === TaskAssessmentStatus.SUBMITTED) {
    return {
      color: 'info',
      icon: 'mdi-file-clock-outline',
      label: 'Wartet auf Bewertung'
    }
  }

  if (props.assessment.status === TaskAssessmentStatus.AUTO_EVALUATED) {
    return {
      color: 'info',
      icon: 'mdi-calculator-variant-outline',
      label: 'Automatisch bewertet'
    }
  }

  return {
    color: 'status-locked',
    icon: 'mdi-timer-sand',
    label: 'Noch keine Bewertung'
  }
})

const formatNumber = (value: number) =>
  new Intl.NumberFormat('de-DE', {
    maximumFractionDigits: 2
  }).format(value)

const pointsLabel = computed(() => {
  const points = props.assessment?.points

  if (points === null || points === undefined) {
    return ''
  }

  const maxPoints = props.assessment?.maxPoints ?? props.maxPoints

  if (maxPoints === null || maxPoints === undefined) {
    return `${formatNumber(points)} Punkte`
  }

  return `${formatNumber(points)} von ${formatNumber(maxPoints)} Punkten`
})
</script>

<style scoped>
.journey-assessment {
  align-items: flex-start;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.journey-assessment__points {
  color: rgb(var(--v-theme-on-surface-variant));
  font-size: 0.875rem;
}

.journey-assessment__feedback {
  background: rgba(var(--v-theme-surface-variant), 0.24);
  border-left: 3px solid rgb(var(--v-theme-primary));
  border-radius: 0 8px 8px 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 12px;
  width: 100%;
}

.journey-assessment__feedback strong {
  font-size: 0.88rem;
  font-weight: 600;
}

.journey-assessment__feedback p {
  color: rgb(var(--v-theme-on-surface-variant));
  margin: 0;
  overflow-wrap: anywhere;
}
</style>
