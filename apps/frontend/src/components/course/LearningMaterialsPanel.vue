<template>
  <div class="learning-materials">
    <v-alert v-if="errorMessage" class="mb-4" type="error" variant="tonal">
      {{ errorMessage }}
    </v-alert>

    <v-progress-linear v-if="loading" class="mb-4" color="primary" indeterminate />

    <div v-if="canManage" class="management">
      <v-expansion-panels v-model="managementPanel" variant="accordion">
        <v-expansion-panel value="upload">
          <v-expansion-panel-title>
            <v-icon start> mdi-upload </v-icon>
            Datei hochladen
          </v-expansion-panel-title>
          <v-expansion-panel-text>
            <v-row>
              <v-col cols="12" md="4">
                <v-text-field v-model="uploadForm.title" label="Titel" variant="underlined" />
              </v-col>
              <v-col cols="12" md="3">
                <v-select v-model="uploadForm.type" :items="fileTypeOptions" label="Materialtyp" variant="underlined" />
              </v-col>
              <v-col cols="12" md="5">
                <v-file-input v-model="uploadForm.file" label="Datei" prepend-icon="mdi-paperclip" variant="underlined" show-size />
              </v-col>
              <v-col cols="12" md="6">
                <v-text-field v-model="uploadForm.description" label="Beschreibung" variant="underlined" />
              </v-col>
              <v-col cols="12" md="6">
                <v-text-field v-model="uploadForm.tags" label="Tags" variant="underlined" />
              </v-col>
            </v-row>
            <v-progress-linear v-if="uploadProgress > 0 && uploadProgress < 100" class="mb-3" color="primary" :model-value="uploadProgress" />
            <v-btn color="primary" prepend-icon="mdi-upload" :loading="uploading" @click="submitUpload"> Hochladen </v-btn>
          </v-expansion-panel-text>
        </v-expansion-panel>

        <v-expansion-panel value="link">
          <v-expansion-panel-title>
            <v-icon start> mdi-link-variant </v-icon>
            Externen Link anlegen
          </v-expansion-panel-title>
          <v-expansion-panel-text>
            <v-row>
              <v-col cols="12" md="4">
                <v-text-field v-model="linkForm.title" label="Titel" variant="underlined" />
              </v-col>
              <v-col cols="12" md="4">
                <v-text-field v-model="linkForm.url" label="URL" variant="underlined" />
              </v-col>
              <v-col cols="12" md="4">
                <v-text-field v-model="linkForm.tags" label="Tags" variant="underlined" />
              </v-col>
              <v-col cols="12">
                <v-text-field v-model="linkForm.description" label="Beschreibung" variant="underlined" />
              </v-col>
            </v-row>
            <v-btn color="primary" prepend-icon="mdi-link-plus" :loading="savingLink" @click="submitLink"> Link speichern </v-btn>
          </v-expansion-panel-text>
        </v-expansion-panel>
      </v-expansion-panels>
    </div>

    <v-data-table :headers="headers" :items="materials" item-value="id" :items-per-page="8" density="comfortable">
      <template #[`item.type`]="{ item }">
        <v-chip label size="small">
          {{ materialTypeLabel(item.type) }}
        </v-chip>
      </template>

      <template #[`item.title`]="{ item }">
        <div class="material-title">
          <strong>{{ item.title }}</strong>
          <span v-if="item.description">{{ item.description }}</span>
        </div>
      </template>

      <template #[`item.tags`]="{ item }">
        <div class="tags">
          <v-chip v-for="tag in item.tags" :key="tag" label size="x-small">
            {{ tag }}
          </v-chip>
        </div>
      </template>

      <template #[`item.fileSize`]="{ item }">
        {{ formatLearningMaterialFileSize(item.fileSize) }}
      </template>

      <template #[`item.publishedAt`]="{ item }">
        {{ formatDate(item.publishedAt ?? item.updatedAt) }}
      </template>

      <template #[`item.publicationStatus`]="{ item }">
        <v-chip :color="item.isPublished ? 'success' : 'status-locked'" label size="small">
          <v-icon start>
            {{ item.isPublished ? 'mdi-check-circle-outline' : 'mdi-file-lock-outline' }}
          </v-icon>
          {{ item.isPublished ? 'Freigegeben' : 'Entwurf' }}
        </v-chip>
      </template>

      <template #[`item.actions`]="{ item, index }">
        <div class="actions">
          <v-btn icon="mdi-open-in-new" size="small" variant="text" @click="openMaterial(item)" />
          <template v-if="canManage">
            <v-btn icon="mdi-pencil" size="small" variant="text" @click="openEditDialog(item)" />
            <v-btn :icon="item.isPublished ? 'mdi-eye-off' : 'mdi-eye'" size="small" variant="text" @click="togglePublication(item)" />
            <v-btn icon="mdi-arrow-up" size="small" variant="text" :disabled="index === 0" @click="moveMaterial(index, -1)" />
            <v-btn icon="mdi-arrow-down" size="small" variant="text" :disabled="index === materials.length - 1" @click="moveMaterial(index, 1)" />
            <v-btn icon="mdi-delete" color="error" size="small" variant="text" @click="deleteMaterial(item)" />
          </template>
        </div>
      </template>

      <template #no-data>
        <v-empty-state icon="mdi-folder-open-outline" title="Keine Lernmaterialien vorhanden" text="Für diesen Kurs wurden noch keine freigegebenen Lernmaterialien gefunden." />
      </template>
    </v-data-table>

    <v-dialog v-model="editDialog" width="720px">
      <v-card>
        <v-card-title>Material bearbeiten</v-card-title>
        <v-card-text>
          <v-text-field v-model="editForm.title" label="Titel" variant="underlined" />
          <v-text-field v-model="editForm.description" label="Beschreibung" variant="underlined" />
          <v-text-field v-if="editForm.type === LearningMaterialType.EXTERNAL_LINK" v-model="editForm.url" label="URL" variant="underlined" />
          <v-text-field v-model="editForm.tags" label="Tags" variant="underlined" />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="editDialog = false"> Abbrechen </v-btn>
          <v-btn color="primary" variant="flat" :loading="savingEdit" @click="saveEdit"> Speichern </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-snackbar v-model="successSnackbar" :timeout="2500">
      {{ successMessage }}
    </v-snackbar>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import learningMaterialService, { LearningMaterialPublicationStatus, LearningMaterialType, type LearningMaterial, formatLearningMaterialFileSize } from '@/services/learningMaterial.service'
import { getApiErrorMessage } from '@/services/apiErrors'

const props = defineProps<{
  courseId: string
  canManage: boolean
}>()

const loading = ref(false)
const uploading = ref(false)
const savingLink = ref(false)
const savingEdit = ref(false)
const errorMessage = ref('')
const successSnackbar = ref(false)
const successMessage = ref('')
const uploadProgress = ref(0)
const managementPanel = ref<string | undefined>(undefined)
const materials = ref<LearningMaterial[]>([])
const editDialog = ref(false)
const editingMaterialId = ref<string | null>(null)

const uploadForm = reactive({
  description: '',
  file: null as File | File[] | null,
  tags: '',
  title: '',
  type: LearningMaterialType.DOCUMENT
})

const linkForm = reactive({
  description: '',
  tags: '',
  title: '',
  url: ''
})

const editForm = reactive({
  description: '',
  tags: '',
  title: '',
  type: LearningMaterialType.DOCUMENT,
  url: ''
})

const fileTypeOptions = [LearningMaterialType.DOCUMENT, LearningMaterialType.PRESENTATION, LearningMaterialType.VIDEO, LearningMaterialType.OTHER_FILE]

const headers = computed(() => [{ title: 'Typ', key: 'type', sortable: false }, { title: 'Titel', key: 'title' }, { title: 'Tags', key: 'tags', sortable: false }, { title: 'Größe', key: 'fileSize' }, { title: 'Freigabe', key: 'publishedAt' }, ...(props.canManage ? [{ title: 'Status', key: 'publicationStatus' }] : []), { title: '', key: 'actions', sortable: false, align: 'end' as const }])

onMounted(() => {
  loadMaterials()
})

const parseTags = (tags: string): string[] =>
  tags
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)

const showSuccess = (message: string) => {
  successMessage.value = message
  successSnackbar.value = true
}

const setError = (error: unknown) => {
  errorMessage.value = getApiErrorMessage(error)
}

const loadMaterials = () => {
  loading.value = true
  errorMessage.value = ''

  learningMaterialService
    .listMaterials(props.courseId)
    .then((response) => {
      materials.value = response
    })
    .catch(setError)
    .finally(() => {
      loading.value = false
    })
}

const selectedUploadFile = computed(() => {
  if (Array.isArray(uploadForm.file)) {
    return uploadForm.file[0]
  }

  return uploadForm.file
})

const submitUpload = () => {
  if (!uploadForm.title || selectedUploadFile.value == null) {
    errorMessage.value = 'Titel und Datei sind erforderlich.'
    return
  }

  uploading.value = true
  uploadProgress.value = 0
  errorMessage.value = ''

  learningMaterialService
    .uploadMaterial(
      props.courseId,
      {
        description: uploadForm.description,
        file: selectedUploadFile.value,
        tags: parseTags(uploadForm.tags),
        title: uploadForm.title,
        type: uploadForm.type
      },
      (percentage) => {
        uploadProgress.value = percentage
      }
    )
    .then(() => {
      uploadForm.description = ''
      uploadForm.file = null
      uploadForm.tags = ''
      uploadForm.title = ''
      uploadProgress.value = 100
      showSuccess('Material wurde hochgeladen.')
      loadMaterials()
    })
    .catch(setError)
    .finally(() => {
      uploading.value = false
    })
}

const submitLink = () => {
  if (!linkForm.title || !linkForm.url) {
    errorMessage.value = 'Titel und URL sind erforderlich.'
    return
  }

  savingLink.value = true
  errorMessage.value = ''

  learningMaterialService
    .createExternalLink(props.courseId, {
      description: linkForm.description,
      tags: parseTags(linkForm.tags),
      title: linkForm.title,
      type: LearningMaterialType.EXTERNAL_LINK,
      url: linkForm.url
    })
    .then(() => {
      linkForm.description = ''
      linkForm.tags = ''
      linkForm.title = ''
      linkForm.url = ''
      showSuccess('Link wurde angelegt.')
      loadMaterials()
    })
    .catch(setError)
    .finally(() => {
      savingLink.value = false
    })
}

const openMaterial = (material: LearningMaterial) => {
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
    .catch(setError)
}

const openEditDialog = (material: LearningMaterial) => {
  editingMaterialId.value = material.id
  editForm.description = material.description ?? ''
  editForm.tags = material.tags.join(', ')
  editForm.title = material.title
  editForm.type = material.type
  editForm.url = material.url ?? ''
  editDialog.value = true
}

const saveEdit = () => {
  if (!editingMaterialId.value || !editForm.title) {
    errorMessage.value = 'Titel ist erforderlich.'
    return
  }

  savingEdit.value = true
  errorMessage.value = ''

  learningMaterialService
    .updateMaterial(editingMaterialId.value, {
      description: editForm.description,
      tags: parseTags(editForm.tags),
      title: editForm.title,
      type: editForm.type,
      url: editForm.url
    })
    .then(() => {
      editDialog.value = false
      showSuccess('Material wurde aktualisiert.')
      loadMaterials()
    })
    .catch(setError)
    .finally(() => {
      savingEdit.value = false
    })
}

const togglePublication = (material: LearningMaterial) => {
  const request = material.publicationStatus === LearningMaterialPublicationStatus.PUBLISHED ? learningMaterialService.withdrawMaterial(material.id) : learningMaterialService.publishMaterial(material.id)

  request
    .then(() => {
      showSuccess(material.isPublished ? 'Material wurde zurückgezogen.' : 'Material wurde freigegeben.')
      loadMaterials()
    })
    .catch(setError)
}

const moveMaterial = (index: number, direction: number) => {
  const targetIndex = index + direction

  if (targetIndex < 0 || targetIndex >= materials.value.length) {
    return
  }

  const reordered = [...materials.value]
  const [material] = reordered.splice(index, 1)
  reordered.splice(targetIndex, 0, material)
  materials.value = reordered

  learningMaterialService
    .updateSortOrder(props.courseId, reordered)
    .then((response) => {
      materials.value = response
    })
    .catch((error) => {
      setError(error)
      loadMaterials()
    })
}

const deleteMaterial = (material: LearningMaterial) => {
  if (!window.confirm(`Material "${material.title}" löschen?`)) {
    return
  }

  learningMaterialService
    .deleteMaterial(material.id)
    .then(() => {
      showSuccess('Material wurde gelöscht.')
      loadMaterials()
    })
    .catch(setError)
}

const materialTypeLabel = (type: LearningMaterialType): string =>
  ({
    [LearningMaterialType.DOCUMENT]: 'Dokument',
    [LearningMaterialType.PRESENTATION]: 'Präsentation',
    [LearningMaterialType.VIDEO]: 'Video',
    [LearningMaterialType.EXTERNAL_LINK]: 'Link',
    [LearningMaterialType.OTHER_FILE]: 'Datei'
  })[type]

const formatDate = (date?: string): string => {
  if (!date) return ''
  return new Intl.DateTimeFormat('de-DE', {
    dateStyle: 'medium'
  }).format(new Date(date))
}

defineExpose({
  loadMaterials,
  materials,
  submitLink,
  submitUpload
})
</script>

<style scoped>
.learning-materials {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.management {
  margin-bottom: 8px;
}

.material-title {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 220px;
}

.material-title span {
  color: rgb(var(--v-theme-on-surface-variant));
  font-size: 0.875rem;
}

.tags,
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.actions {
  justify-content: flex-end;
}
</style>
