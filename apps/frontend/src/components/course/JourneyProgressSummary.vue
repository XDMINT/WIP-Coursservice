<template>
  <section
    class="journey-summary"
    aria-label="Kursfortschritt"
  >
    <div class="journey-summary__heading">
      <div>
        <p class="journey-summary__eyebrow">
          Deine Lernreise
        </p>
        <h2>{{ courseName }}</h2>
        <p v-if="courseDescription">
          {{ courseDescription }}
        </p>
      </div>
      <v-chip
        v-if="courseRunLabel"
        prepend-icon="mdi-calendar-range"
        label
        variant="tonal"
      >
        {{ courseRunLabel }}
      </v-chip>
    </div>

    <div class="journey-summary__body">
      <div class="journey-summary__progress">
        <strong>{{ completedLabel }}</strong>
        <v-progress-linear
          :model-value="progress?.progressPercentage ?? 0"
          color="primary"
          height="10"
          rounded
        />
        <span>{{ Math.round(progress?.progressPercentage ?? 0) }} % abgeschlossen</span>
      </div>

      <div class="journey-summary__next">
        <span>Nächster Schritt</span>
        <strong>{{ nextTask?.title ?? 'Im Moment ist nichts offen.' }}</strong>
        <p v-if="nextTask">
          {{ nextTask.locked ? nextTask.lockedReason || 'Dieser Schritt wird später freigeschaltet.' : nextActionLabel }}
        </p>
        <p v-else>
          Alle aktuell verfügbaren Lernschritte sind erledigt.
        </p>
      </div>

      <div class="journey-summary__signals">
        <span v-if="groupName">
          <v-icon size="18">mdi-account-multiple-outline</v-icon>
          Gruppe: {{ groupName }}
        </span>
        <span v-if="pendingReviewCount > 0">
          <v-icon size="18">mdi-file-clock-outline</v-icon>
          {{ pendingReviewCount }} Abgabe{{ pendingReviewCount === 1 ? '' : 'n' }} wartet auf Bewertung
        </span>
        <span v-if="lastFeedback">
          <v-icon size="18">mdi-message-text-outline</v-icon>
          Letzte Rückmeldung vorhanden
        </span>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { LearningPath, StudentLearningTask } from '@/services/learningTask.service'

const props = defineProps<{
  courseDescription?: string
  courseName: string
  courseRunLabel?: string
  groupName?: string
  lastFeedback?: string
  nextActionLabel?: string
  nextTask?: StudentLearningTask | null
  pendingReviewCount: number
  progress: LearningPath | null
}>()

const completedLabel = computed(() => {
  if (!props.progress || props.progress.totalTasks === 0) {
    return 'Noch keine Lernschritte verfügbar.'
  }

  return `Du hast ${props.progress.completedTasks} von ${props.progress.totalTasks} Lernschritten abgeschlossen.`
})
</script>

<style scoped>
.journey-summary {
  border: 1px solid rgba(var(--v-theme-outline), 0.28);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 20px;
}

.journey-summary__heading {
  align-items: flex-start;
  display: flex;
  gap: 16px;
  justify-content: space-between;
}

.journey-summary__heading h2 {
  font-size: 1.45rem;
  font-weight: 600;
  line-height: 1.25;
  margin: 0;
}

.journey-summary__heading p {
  color: rgb(var(--v-theme-on-surface-variant));
  margin: 6px 0 0;
}

.journey-summary__eyebrow {
  color: rgb(var(--v-theme-primary)) !important;
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0;
  margin: 0 0 4px !important;
  text-transform: uppercase;
}

.journey-summary__body {
  display: grid;
  gap: 16px;
  grid-template-columns: minmax(220px, 1.25fr) minmax(220px, 1fr) minmax(180px, 0.85fr);
}

.journey-summary__progress,
.journey-summary__next,
.journey-summary__signals {
  background: rgba(var(--v-theme-surface-variant), 0.22);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 14px;
}

.journey-summary__progress strong,
.journey-summary__next strong {
  font-weight: 600;
}

.journey-summary__progress span,
.journey-summary__next span,
.journey-summary__next p,
.journey-summary__signals span {
  color: rgb(var(--v-theme-on-surface-variant));
  font-size: 0.9rem;
  margin: 0;
}

.journey-summary__signals span {
  align-items: center;
  display: flex;
  gap: 6px;
}

@media (max-width: 960px) {
  .journey-summary__body {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 720px) {
  .journey-summary__heading {
    flex-direction: column;
  }
}
</style>
