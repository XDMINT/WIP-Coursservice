<template>
  <div class="audit-events">
    <v-alert v-if="errorMessage" class="mb-4" type="error" variant="tonal">
      {{ errorMessage }}
    </v-alert>

    <div class="audit-toolbar">
      <v-select v-model="filters.eventType" :items="eventTypeOptions" item-title="title" item-value="value" label="Ereignis" density="compact" clearable hide-details />
      <v-text-field v-model="filters.from" label="Von" type="date" density="compact" hide-details />
      <v-text-field v-model="filters.to" label="Bis" type="date" density="compact" hide-details />
      <v-btn variant="text" prepend-icon="mdi-refresh" :loading="loading" @click="loadAuditEvents">Aktualisieren</v-btn>
    </div>

    <v-progress-linear v-if="loading" class="mb-3" color="primary" indeterminate />

    <v-data-table :headers="headers" :items="events" item-value="id" :items-per-page="10" density="comfortable">
      <template #[`item.createdAt`]="{ item }">
        {{ formatDateTime(item.createdAt) }}
      </template>

      <template #[`item.eventType`]="{ item }">
        <v-chip size="small" variant="tonal">
          {{ formatEventType(item.eventType) }}
        </v-chip>
      </template>

      <template #[`item.actorUserId`]="{ item }">
        <span>{{ item.actorUserId || 'System' }}</span>
      </template>

      <template #[`item.actorRole`]="{ item }">
        <span>{{ item.actorRole || '-' }}</span>
      </template>

      <template #[`item.courseRunId`]="{ item }">
        <span>{{ shortId(item.courseRunId) }}</span>
      </template>

      <template #[`item.courseVersionId`]="{ item }">
        <span>{{ shortId(item.courseVersionId) }}</span>
      </template>

      <template #no-data>
        <v-empty-state icon="mdi-file-search-outline" title="Keine Audit-Ereignisse" text="Für diese Ansicht wurden noch keine fachlichen Ereignisse protokolliert." />
      </template>
    </v-data-table>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref, watch } from 'vue'
import courseService, { type AuditEvent } from '@/services/course.service'
import { getApiErrorMessage } from '@/services/apiErrors'

const props = defineProps<{
  courseId: string
  courseRunId?: string
}>()

const loading = ref(false)
const errorMessage = ref('')
const events = ref<AuditEvent[]>([])
const filters = reactive({
  eventType: '',
  from: '',
  to: ''
})

const headers = [
  { title: 'Zeitpunkt', key: 'createdAt', align: 'start' as const, width: '180px' },
  { title: 'Ereignis', key: 'eventType', align: 'start' as const, width: '220px' },
  { title: 'Akteur', key: 'actorUserId', align: 'start' as const, width: '120px' },
  { title: 'Rolle', key: 'actorRole', align: 'start' as const, width: '110px' },
  { title: 'Durchlauf', key: 'courseRunId', align: 'start' as const, width: '120px' },
  { title: 'Version', key: 'courseVersionId', align: 'start' as const, width: '120px' },
  { title: 'Kurzbeschreibung', key: 'summary', align: 'start' as const }
]

const eventTypeOptions = [
  { title: 'Kurs erstellt', value: 'COURSE_CREATED' },
  { title: 'Kurs aktualisiert', value: 'COURSE_UPDATED' },
  { title: 'Durchlauf erstellt', value: 'COURSE_RUN_CREATED' },
  { title: 'Durchlauf aktiviert', value: 'COURSE_RUN_ACTIVATED' },
  { title: 'Inhaltsversion erstellt', value: 'CONTENT_VERSION_CREATED' },
  { title: 'Inhaltsversion aktiviert', value: 'CONTENT_VERSION_ACTIVATED' },
  { title: 'Material erstellt', value: 'MATERIAL_CREATED' },
  { title: 'Material aktualisiert', value: 'MATERIAL_UPDATED' },
  { title: 'Material gelöscht', value: 'MATERIAL_DELETED' },
  { title: 'Aufgabe erstellt', value: 'TASK_CREATED' },
  { title: 'Aufgabe aktualisiert', value: 'TASK_UPDATED' },
  { title: 'Aufgabe gelöscht', value: 'TASK_DELETED' },
  { title: 'Einschreibung', value: 'STUDENT_ENROLLED' },
  { title: 'Fortschritt', value: 'PROGRESS_UPDATED' },
  { title: 'Aufgabe gestartet', value: 'TASK_STARTED' },
  { title: 'Aufgabe abgegeben', value: 'TASK_SUBMITTED' },
  { title: 'Bewertung abgegeben', value: 'ASSESSMENT_SUBMITTED' },
  { title: 'Manuell bewertet', value: 'ASSESSMENT_MANUALLY_GRADED' },
  { title: 'Automatisch bewertet', value: 'ASSESSMENT_AUTO_EVALUATED' },
  { title: 'Bewertung zurückgesetzt', value: 'ASSESSMENT_RESET' }
]

const eventTypeLabels = new Map(eventTypeOptions.map((option) => [option.value, option.title]))

const loadAuditEvents = async () => {
  loading.value = true
  errorMessage.value = ''

  try {
    events.value = await courseService.listAuditEvents(props.courseId, {
      courseRunId: props.courseRunId,
      eventType: filters.eventType || undefined,
      from: filters.from || undefined,
      to: filters.to || undefined,
      limit: 100
    })
  } catch (error) {
    errorMessage.value = getApiErrorMessage(error)
    events.value = []
  } finally {
    loading.value = false
  }
}

const formatDateTime = (value?: string) => {
  if (!value) return '-'

  return new Intl.DateTimeFormat('de-DE', {
    dateStyle: 'short',
    timeStyle: 'short'
  }).format(new Date(value))
}

const formatEventType = (eventType: string) => eventTypeLabels.get(eventType) ?? eventType

const shortId = (value?: string | null) => (value ? value.slice(0, 8) : '-')

watch(
  () => props.courseRunId,
  () => {
    loadAuditEvents()
  },
)

watch(
  () => ({ ...filters }),
  () => {
    loadAuditEvents()
  },
)

onMounted(loadAuditEvents)
</script>

<style scoped lang="scss">
.audit-events {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.audit-toolbar {
  display: grid;
  grid-template-columns: minmax(220px, 1.3fr) minmax(140px, 0.7fr) minmax(140px, 0.7fr) auto;
  gap: 12px;
  align-items: center;
}

@media (max-width: 900px) {
  .audit-toolbar {
    grid-template-columns: 1fr;
  }
}
</style>
