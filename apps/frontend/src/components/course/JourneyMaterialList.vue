<template>
  <div
    v-if="materials.length > 0"
    class="journey-materials"
  >
    <h4>{{ title }}</h4>

    <div class="journey-materials__list">
      <article
        v-for="material in materials"
        :key="material.id"
        class="journey-material"
      >
        <div class="journey-material__main">
          <v-icon
            :color="material.locked ? 'status-locked' : undefined"
            size="20"
          >
            {{ materialIcon(material) }}
          </v-icon>
          <div>
            <strong>{{ material.title }}</strong>
            <span v-if="material.description">{{ material.description }}</span>
            <span v-if="material.fileSize">{{ formatLearningMaterialFileSize(material.fileSize) }}</span>
            <span
              v-if="material.lockedReason"
              class="journey-material__locked"
            >{{ material.lockedReason }}</span>
          </div>
        </div>

        <v-btn
          :disabled="material.locked"
          :prepend-icon="material.locked ? 'mdi-lock-outline' : material.type === LearningMaterialType.EXTERNAL_LINK ? 'mdi-open-in-new' : 'mdi-download-outline'"
          size="small"
          variant="text"
          @click="$emit('open', material)"
        >
          {{ material.locked ? 'Noch gesperrt' : material.type === LearningMaterialType.EXTERNAL_LINK ? 'Öffnen' : 'Herunterladen' }}
        </v-btn>
      </article>
    </div>
  </div>
</template>

<script setup lang="ts">
import { LearningMaterialType, type LearningMaterial, formatLearningMaterialFileSize } from '@/services/learningMaterial.service'

defineProps<{
  materials: LearningMaterial[]
  title: string
}>()

defineEmits<{
  open: [material: LearningMaterial]
}>()

const materialIcon = (material: LearningMaterial): string => {
  if (material.locked) return 'mdi-file-lock-outline'
  if (material.type === LearningMaterialType.DOCUMENT) return 'mdi-file-document-outline'
  if (material.type === LearningMaterialType.PRESENTATION) return 'mdi-presentation'
  if (material.type === LearningMaterialType.VIDEO) return 'mdi-video-outline'
  if (material.type === LearningMaterialType.EXTERNAL_LINK) return 'mdi-link-variant'
  return 'mdi-file-outline'
}
</script>

<style scoped>
.journey-materials {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.journey-materials h4 {
  font-size: 0.95rem;
  font-weight: 600;
  margin: 0;
}

.journey-materials__list {
  display: grid;
  gap: 8px;
}

.journey-material {
  align-items: center;
  border: 1px solid rgba(var(--v-theme-outline), 0.22);
  border-radius: 8px;
  display: flex;
  gap: 12px;
  justify-content: space-between;
  padding: 10px 12px;
}

.journey-material__main {
  align-items: flex-start;
  display: flex;
  gap: 10px;
  min-width: 0;
}

.journey-material__main div {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.journey-material__main strong,
.journey-material__main span {
  overflow-wrap: anywhere;
}

.journey-material__main span {
  color: rgb(var(--v-theme-on-surface-variant));
  font-size: 0.82rem;
}

.journey-material__locked {
  color: rgb(var(--v-theme-warning));
}

@media (max-width: 720px) {
  .journey-material {
    align-items: stretch;
    flex-direction: column;
  }
}
</style>
