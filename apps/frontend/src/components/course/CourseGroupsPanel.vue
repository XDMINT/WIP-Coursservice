<template>
  <div class="course-groups">
    <v-alert v-if="errorMessage" type="error" variant="tonal">
      {{ errorMessage }}
    </v-alert>
    <v-alert v-if="successMessage" type="success" variant="tonal">
      {{ successMessage }}
    </v-alert>
    <v-alert v-if="readOnly" type="info" variant="tonal">
      Historischer Kursdurchlauf: Gruppen werden schreibgeschützt angezeigt.
    </v-alert>

    <v-progress-linear v-if="loading" color="primary" indeterminate />

    <template v-else-if="canManage">
      <section class="groups-section">
        <div class="section-toolbar">
          <div>
            <h2>Gruppenverwaltung</h2>
            <p>Gruppen gehören zum ausgewählten Kursdurchlauf.</p>
          </div>
          <v-btn v-if="canEdit" color="primary" variant="outlined" @click="showCreateForm = !showCreateForm">
            <v-icon start>mdi-plus</v-icon>
            Gruppe anlegen
          </v-btn>
        </div>

        <div v-if="canEdit && showCreateForm" class="group-create-form">
          <v-text-field v-model="newGroup.name" label="Gruppenname" density="compact" hide-details />
          <v-textarea v-model="newGroup.description" label="Beschreibung" density="compact" rows="2" hide-details />
          <div class="row-actions">
            <v-btn color="primary" :disabled="newGroup.name.trim().length === 0" @click="createGroup">Anlegen</v-btn>
            <v-btn variant="text" @click="resetCreateForm">Abbrechen</v-btn>
          </div>
        </div>

        <v-empty-state v-if="groups.length === 0" icon="mdi-account-multiple-plus-outline" title="Keine Gruppen vorhanden" text="Für diesen Kursdurchlauf wurden noch keine Gruppen angelegt." />

        <div v-else class="group-list">
          <article v-for="group in groups" :key="group.id" class="group-card">
            <header class="group-card__header">
              <div>
                <h3>{{ group.name }}</h3>
                <p>{{ group.description || 'Keine Beschreibung hinterlegt.' }}</p>
              </div>
              <v-chip size="small" variant="tonal" label>
                {{ group.memberCount }} Mitglieder
              </v-chip>
            </header>

            <div v-if="canEdit" class="group-card__edit">
              <v-text-field v-model="group.name" label="Name" density="compact" hide-details />
              <v-text-field v-model="group.description" label="Beschreibung" density="compact" hide-details />
              <div class="row-actions">
                <v-btn size="small" color="primary" variant="flat" @click="saveGroup(group)">
                  <v-icon start>mdi-content-save-outline</v-icon>
                  Speichern
                </v-btn>
                <v-btn size="small" color="error" variant="text" @click="deleteGroup(group)">
                  <v-icon start>mdi-delete-outline</v-icon>
                  Löschen
                </v-btn>
              </div>
            </div>

            <section class="group-card__block">
              <span class="block-title">Mitglieder</span>
              <div v-if="group.members.length === 0" class="muted-line">Noch keine Studierenden zugewiesen.</div>
              <div v-else class="member-list">
                <v-chip v-for="member in group.members" :key="member.studentId" size="small" variant="tonal" label>
                  {{ studentLabel(member.studentId) }}
                  <v-btn v-if="canEdit" class="chip-action" size="x-small" icon variant="text" @click.stop="removeMember(group, member.studentId)">
                    <v-icon size="small">mdi-close</v-icon>
                    <v-tooltip activator="parent" location="bottom">Aus Gruppe entfernen</v-tooltip>
                  </v-btn>
                </v-chip>
              </div>
              <div v-if="canEdit" class="member-add">
                <v-select v-model="selectedStudentByGroup[group.id]" :items="assignableStudentOptions(group)" item-title="title" item-value="value" label="Studierende zuweisen" density="compact" hide-details />
                <v-btn variant="outlined" :disabled="!selectedStudentByGroup[group.id]" @click="addMember(group)">
                  <v-icon start>mdi-account-plus-outline</v-icon>
                  Zuweisen
                </v-btn>
              </div>
            </section>

            <section class="group-card__block">
              <span class="block-title">Gruppenaufgaben</span>
              <div v-if="groupTasks.length === 0" class="muted-line">Keine Gruppenaufgaben in der aktiven Inhaltsversion.</div>
              <div v-else class="group-task-list">
                <div v-for="task in groupTasks" :key="`${group.id}-${task.id}`" class="group-task-row">
                  <div>
                    <strong>{{ task.order }}. {{ task.title }}</strong>
                    <span>{{ task.maxPoints ?? '-' }} Punkte · {{ formatTaskStatus(groupTaskStatus(group, task.id)) }}</span>
                  </div>
                  <v-chip size="small" :color="groupTaskAssessment(group, task.id)?.passed === true ? 'primary' : undefined" variant="tonal" label>
                    {{ formatAssessmentStatus(groupTaskAssessment(group, task.id)?.status) }}
                  </v-chip>
                  <v-btn v-if="canEdit && task.gradingMode === TaskGradingMode.MANUAL" size="small" color="primary" variant="outlined" @click="openAssessment(group, task)">
                    Bewerten
                  </v-btn>
                </div>
              </div>
            </section>
          </article>
        </div>
      </section>
    </template>

    <template v-else>
      <section class="groups-section">
        <div class="section-toolbar">
          <div>
            <h2>Meine Gruppe</h2>
            <p>Gruppenaufgaben werden gemeinsam bearbeitet und bewertet.</p>
          </div>
        </div>

        <v-alert v-if="!myGroup" type="info" variant="tonal">
          Du bist noch keiner Gruppe zugeordnet. Bitte wende dich an die Lehrperson.
        </v-alert>

        <article v-else class="group-card">
          <header class="group-card__header">
            <div>
              <h3>{{ myGroup.name }}</h3>
              <p>{{ myGroup.description || 'Keine Beschreibung hinterlegt.' }}</p>
            </div>
            <v-chip size="small" variant="tonal" label>{{ myGroup.memberCount }} Mitglieder</v-chip>
          </header>

          <section class="group-card__block">
            <span class="block-title">Mitglieder</span>
            <div class="member-list">
              <v-chip v-for="member in myGroup.members" :key="member.studentId" size="small" variant="tonal" label>
                {{ studentLabel(member.studentId) }}
              </v-chip>
            </div>
          </section>

          <section class="group-card__block">
            <span class="block-title">Gruppenaufgaben</span>
            <div v-if="groupTasks.length === 0" class="muted-line">Aktuell sind keine Gruppenaufgaben verfügbar.</div>
            <div v-else class="group-task-list">
              <div v-for="task in groupTasks" :key="task.id" class="group-task-row">
                <div>
                  <strong>{{ task.order }}. {{ task.title }}</strong>
                  <span>{{ formatTaskStatus(groupTaskStatus(myGroup, task.id)) }} · {{ formatAssessmentStatus(groupTaskAssessment(myGroup, task.id)?.status) }}</span>
                </div>
                <v-chip size="small" variant="tonal" label>
                  {{ groupTaskAssessment(myGroup, task.id)?.passed === true ? 'Bestanden' : groupTaskAssessment(myGroup, task.id)?.passed === false ? 'Nicht bestanden' : 'Noch offen' }}
                </v-chip>
              </div>
            </div>
          </section>
        </article>
      </section>
    </template>

    <v-dialog v-model="assessmentDialog.open" max-width="520">
      <v-card class="assessment-dialog">
        <v-card-title>Gruppenaufgabe bewerten</v-card-title>
        <v-card-text>
          <div class="assessment-dialog__body">
            <p>{{ assessmentDialog.groupName }} · {{ assessmentDialog.taskTitle }}</p>
            <v-select v-model="assessmentDialog.passed" :items="assessmentResultOptions" item-title="title" item-value="value" label="Ergebnis" density="compact" />
            <v-text-field v-model.number="assessmentDialog.points" label="Punkte" type="number" density="compact" />
            <v-textarea v-model="assessmentDialog.feedback" label="Feedback" density="compact" rows="3" />
          </div>
        </v-card-text>
        <v-card-actions class="row-actions row-actions--end">
          <v-btn variant="text" @click="closeAssessment">Abbrechen</v-btn>
          <v-btn color="primary" @click="submitAssessment">Bewertung speichern</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import courseService, { type StudyGroup } from '@/services/course.service'
import learningTaskService, { formatAssessmentStatus, formatTaskStatus, TaskGradingMode, TaskProgressStatus, TaskWorkMode, type LearningTask } from '@/services/learningTask.service'
import { getApiErrorMessage } from '@/services/apiErrors'

const props = defineProps<{
  courseId: string | number
  courseRunId?: string
  canManage: boolean
  readOnly?: boolean
}>()

const loading = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const groups = ref<StudyGroup[]>([])
const myGroup = ref<StudyGroup | null>(null)
const tasks = ref<LearningTask[]>([])
const members = ref<Array<{ id: number; label: string; role: string }>>([])
const showCreateForm = ref(false)
const selectedStudentByGroup = reactive<Record<string, string | null>>({})
const newGroup = reactive({
  name: '',
  description: ''
})
const assessmentDialog = reactive({
  open: false,
  groupId: '',
  groupName: '',
  taskId: '',
  taskTitle: '',
  maxPoints: null as number | null,
  points: null as number | null,
  passed: true,
  feedback: ''
})

const assessmentResultOptions = [
  { title: 'Bestanden', value: true },
  { title: 'Nicht bestanden', value: false }
]

const canEdit = computed(() => props.canManage && props.readOnly !== true)
const readOnly = computed(() => props.readOnly === true)
const groupTasks = computed(() =>
  tasks.value
    .filter((task) => task.workMode === TaskWorkMode.GROUP)
    .sort((left, right) => left.order - right.order)
)

onMounted(() => loadData())

watch(
  () => [props.courseId, props.courseRunId, props.canManage, props.readOnly],
  () => loadData()
)

const loadData = async () => {
  if (!props.courseRunId) {
    errorMessage.value = 'Für die Gruppenansicht ist ein Kursdurchlauf erforderlich.'
    return
  }

  loading.value = true
  errorMessage.value = ''

  try {
    if (props.canManage) {
      const [loadedGroups, loadedTasks, loadedMembers] = await Promise.all([
        courseService.listStudyGroups(props.courseId, props.courseRunId),
        learningTaskService.listTasks(props.courseId, props.courseRunId),
        courseService.getCourseMembers(props.courseId, props.courseRunId)
      ])
      groups.value = loadedGroups
      tasks.value = loadedTasks
      members.value = loadedMembers.data
        .filter((member) => member.role === 'STUDENT')
        .map((member) => ({
          id: member.user.id,
          label: member.user.username || `Student ${member.user.id}`,
          role: member.role
        }))
      return
    }

    const [loadedGroup, loadedTasks] = await Promise.all([
      courseService.getMyStudyGroup(props.courseId, props.courseRunId),
      learningTaskService.listTasks(props.courseId)
    ])
    myGroup.value = loadedGroup
    tasks.value = loadedTasks
  } catch (error) {
    errorMessage.value = getApiErrorMessage(error)
  } finally {
    loading.value = false
  }
}

const resetCreateForm = () => {
  newGroup.name = ''
  newGroup.description = ''
  showCreateForm.value = false
}

const createGroup = async () => {
  if (!props.courseRunId) return

  try {
    await courseService.createStudyGroup(props.courseId, props.courseRunId, {
      name: newGroup.name.trim(),
      description: newGroup.description.trim() || null
    })
    successMessage.value = 'Gruppe angelegt.'
    resetCreateForm()
    await loadData()
  } catch (error) {
    errorMessage.value = getApiErrorMessage(error)
  }
}

const saveGroup = async (group: StudyGroup) => {
  if (!props.courseRunId) return

  try {
    await courseService.updateStudyGroup(props.courseId, props.courseRunId, group.id, {
      name: group.name.trim(),
      description: group.description?.trim() || null
    })
    successMessage.value = 'Gruppe gespeichert.'
    await loadData()
  } catch (error) {
    errorMessage.value = getApiErrorMessage(error)
  }
}

const deleteGroup = async (group: StudyGroup) => {
  if (!props.courseRunId) return

  try {
    await courseService.deleteStudyGroup(props.courseId, props.courseRunId, group.id)
    successMessage.value = 'Gruppe gelöscht.'
    await loadData()
  } catch (error) {
    errorMessage.value = getApiErrorMessage(error)
  }
}

const addMember = async (group: StudyGroup) => {
  if (!props.courseRunId || !selectedStudentByGroup[group.id]) return

  try {
    await courseService.addStudyGroupMember(props.courseId, props.courseRunId, group.id, selectedStudentByGroup[group.id] as string)
    selectedStudentByGroup[group.id] = null
    successMessage.value = 'Studierende:r zugewiesen.'
    await loadData()
  } catch (error) {
    errorMessage.value = getApiErrorMessage(error)
  }
}

const removeMember = async (group: StudyGroup, studentId: string) => {
  if (!props.courseRunId) return

  try {
    await courseService.removeStudyGroupMember(props.courseId, props.courseRunId, group.id, studentId)
    successMessage.value = 'Mitglied entfernt.'
    await loadData()
  } catch (error) {
    errorMessage.value = getApiErrorMessage(error)
  }
}

const studentLabel = (studentId: string) => {
  const member = members.value.find((entry) => String(entry.id) === String(studentId))

  return member?.label ?? `Student ${studentId}`
}

const assignedStudentIds = computed(() =>
  new Set(groups.value.flatMap((group) => group.members.map((member) => String(member.studentId))))
)

const assignableStudentOptions = (group: StudyGroup) =>
  members.value
    .filter((member) => !assignedStudentIds.value.has(String(member.id)) || group.members.some((entry) => String(entry.studentId) === String(member.id)))
    .map((member) => ({
      title: member.label,
      value: String(member.id)
    }))

const groupTaskProgress = (group: StudyGroup, taskId: string) =>
  group.taskProgress?.find((progress) => progress.taskId === taskId)

const groupTaskAssessment = (group: StudyGroup, taskId: string) =>
  groupTaskProgress(group, taskId)?.assessment ?? null

const groupTaskStatus = (group: StudyGroup, taskId: string) =>
  (groupTaskProgress(group, taskId)?.status as TaskProgressStatus | undefined) ?? TaskProgressStatus.AVAILABLE

const openAssessment = (group: StudyGroup, task: LearningTask) => {
  const assessment = groupTaskAssessment(group, task.id)
  assessmentDialog.open = true
  assessmentDialog.groupId = group.id
  assessmentDialog.groupName = group.name
  assessmentDialog.taskId = task.id
  assessmentDialog.taskTitle = task.title
  assessmentDialog.maxPoints = task.maxPoints ?? null
  assessmentDialog.points = assessment?.points ?? (assessment?.passed === false ? 0 : task.maxPoints ?? null)
  assessmentDialog.passed = assessment?.passed ?? true
  assessmentDialog.feedback = assessment?.feedback ?? ''
}

const closeAssessment = () => {
  assessmentDialog.open = false
  assessmentDialog.groupId = ''
  assessmentDialog.groupName = ''
  assessmentDialog.taskId = ''
  assessmentDialog.taskTitle = ''
  assessmentDialog.maxPoints = null
  assessmentDialog.points = null
  assessmentDialog.passed = true
  assessmentDialog.feedback = ''
}

const submitAssessment = async () => {
  if (!props.courseRunId) return

  try {
    await learningTaskService.assessGroupTaskManually(props.courseId, props.courseRunId, assessmentDialog.taskId, assessmentDialog.groupId, {
      maxPoints: assessmentDialog.maxPoints,
      points: assessmentDialog.points,
      passed: assessmentDialog.passed,
      feedback: assessmentDialog.feedback.trim() || null
    })
    successMessage.value = 'Gruppenbewertung gespeichert.'
    closeAssessment()
    await loadData()
  } catch (error) {
    errorMessage.value = getApiErrorMessage(error)
  }
}
</script>

<style scoped lang="scss">
.course-groups,
.groups-section {
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
    margin: 0 0 4px;
  }

  p {
    color: rgba(var(--v-theme-on-surface), 0.7);
    margin: 0;
  }
}

.group-create-form,
.group-card {
  background: rgba(var(--v-theme-surface-variant), 0.18);
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 8px;
  padding: 16px;
}

.group-create-form,
.group-card__edit,
.member-add {
  display: grid;
  gap: 12px;
}

.group-list {
  display: grid;
  gap: 14px;
}

.group-card {
  display: grid;
  gap: 16px;
}

.group-card__header {
  align-items: flex-start;
  display: flex;
  gap: 16px;
  justify-content: space-between;

  h3 {
    margin: 0 0 4px;
  }

  p {
    color: rgba(var(--v-theme-on-surface), 0.7);
    margin: 0;
  }
}

.group-card__edit {
  grid-template-columns: minmax(180px, 0.8fr) minmax(260px, 1.2fr) auto;
}

.group-card__block {
  display: grid;
  gap: 10px;
}

.block-title {
  color: rgba(var(--v-theme-on-surface), 0.68);
  font-size: 0.82rem;
  font-weight: 700;
  text-transform: uppercase;
}

.member-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.member-add {
  align-items: center;
  grid-template-columns: minmax(220px, 360px) auto;
}

.chip-action {
  margin-inline-end: -8px;
}

.group-task-list {
  display: grid;
  gap: 8px;
}

.group-task-row {
  align-items: center;
  background: rgba(var(--v-theme-surface), 0.52);
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 6px;
  display: grid;
  gap: 12px;
  grid-template-columns: minmax(220px, 1fr) auto auto;
  padding: 12px;

  div {
    display: grid;
    gap: 3px;
  }

  span {
    color: rgba(var(--v-theme-on-surface), 0.7);
  }
}

.row-actions {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.row-actions--end {
  justify-content: flex-end;
}

.muted-line {
  color: rgba(var(--v-theme-on-surface), 0.65);
}

.assessment-dialog__body {
  display: grid;
  gap: 12px;
}

@media (max-width: 900px) {
  .section-toolbar,
  .group-card__header {
    flex-direction: column;
  }

  .group-card__edit,
  .member-add,
  .group-task-row {
    grid-template-columns: 1fr;
  }
}
</style>
