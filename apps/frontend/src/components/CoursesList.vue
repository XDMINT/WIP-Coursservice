<template>
  <div class="courses-overview">
    <v-alert
      v-if="errorMessage"
      class="mb-4"
      type="error"
      variant="tonal"
    >
      {{ errorMessage }}
    </v-alert>
    <v-progress-linear
      v-if="loading"
      class="mb-4"
      color="primary"
      indeterminate
    />

    <div class="courses-toolbar">
      <v-text-field
        v-model="search"
        class="search-bar"
        density="compact"
        hide-details
        label="Kurse suchen"
        prepend-icon="mdi-magnify"
        variant="underlined"
      />

      <div class="filters">
        <v-checkbox
          v-model="checkboxActive"
          density="compact"
          hide-details
          label="Nur aktive Kurse"
        />
        <v-checkbox
          v-model="checkboxFriedberg"
          density="compact"
          hide-details
          label="Friedberg"
          @click="checkboxGießen = false"
        />
        <v-checkbox
          v-model="checkboxGießen"
          density="compact"
          hide-details
          label="Gießen"
          @click="checkboxFriedberg = false"
        />
      </div>
    </div>

    <template v-if="studentOverview">
      <section
        class="course-section"
        aria-labelledby="student-active-courses"
      >
        <div class="section-heading">
          <div>
            <h2 id="student-active-courses">
              Meine Kurse
            </h2>
            <p>Dein aktueller Lernbereich mit dem nächsten sinnvollen Schritt.</p>
          </div>
          <v-chip
            label
            size="small"
          >
            {{ studentActiveCourses.length }}
          </v-chip>
        </div>

        <v-empty-state
          v-if="studentActiveCourses.length === 0"
          icon="mdi-school-outline"
          title="Keine aktiven Kurse"
          text="Du hast aktuell keinen Kurs, in dem noch Lernschritte offen sind."
        />

        <div
          v-else
          class="student-course-grid"
        >
          <article
            v-for="item in studentActiveCourses"
            :key="item.course.id"
            class="student-course-card"
          >
            <div class="student-course-card__main">
              <v-chip
                color="primary"
                label
                size="small"
                variant="tonal"
              >
                Eingeschrieben
              </v-chip>
              <h3>{{ item.course.name }}</h3>
              <p>{{ shortDescription(item.course.description) }}</p>
            </div>

            <div class="student-course-card__progress">
              <strong>{{ progressText(item) }}</strong>
              <v-progress-linear
                :model-value="courseProgress(item).progressPercentage"
                color="primary"
                height="9"
                rounded
              />
              <span>{{ Math.round(courseProgress(item).progressPercentage) }} % abgeschlossen</span>
            </div>

            <div class="student-course-card__signals">
              <span>
                <v-icon size="18">
                  mdi-arrow-right-circle-outline
                </v-icon>
                {{ nextActionText(item) }}
              </span>
              <span v-if="courseProgress(item).taskHint">
                <v-icon size="18">
                  mdi-clipboard-text-outline
                </v-icon>
                {{ courseProgress(item).taskHint }}
              </span>
              <span v-if="materialHint(item)">
                <v-icon size="18">
                  mdi-folder-open-outline
                </v-icon>
                {{ materialHint(item) }}
              </span>
            </div>

            <div class="student-course-card__actions">
              <v-btn
                color="primary"
                prepend-icon="mdi-play-circle-outline"
                variant="flat"
                @click="openCourseFromItem(item)"
              >
                Weiterlernen
              </v-btn>
              <v-btn
                v-if="courseProgress(item).hasFeedback"
                prepend-icon="mdi-message-text-outline"
                variant="text"
                @click="openCourseFromItem(item)"
              >
                Feedback ansehen
              </v-btn>
            </div>
          </article>
        </div>
      </section>

      <section
        class="course-section"
        aria-labelledby="student-available-courses"
      >
        <div class="section-heading">
          <div>
            <h2 id="student-available-courses">
              Verfügbare Kurse
            </h2>
            <p>Kurse, in die du dich einschreiben kannst.</p>
          </div>
          <v-chip
            label
            size="small"
          >
            {{ displayedAvailableCourses.length }}
          </v-chip>
        </div>

        <v-empty-state
          v-if="displayedAvailableCourses.length === 0"
          icon="mdi-school-search"
          title="Keine verfügbaren Kurse"
          text="Für die aktuelle Auswahl gibt es keine freigegebenen Kurse zur Einschreibung."
        />

        <div
          v-else
          class="student-course-grid student-course-grid--compact"
        >
          <article
            v-for="item in displayedAvailableCourses"
            :key="item.course.id"
            class="student-course-card"
          >
            <div class="student-course-card__main">
              <v-chip
                color="info"
                label
                size="small"
                variant="tonal"
              >
                Verfügbar
              </v-chip>
              <h3>{{ item.course.name }}</h3>
              <p>{{ shortDescription(item.course.description) }}</p>
            </div>

            <div class="student-course-card__signals">
              <span>
                <v-icon size="18">
                  mdi-calendar-range
                </v-icon>
                {{ runLabel(item) }}
              </span>
              <span v-if="item.course.requiresEnrollmentKey">
                <v-icon size="18">
                  mdi-key-outline
                </v-icon>
                Einschreibeschlüssel erforderlich
              </span>
            </div>

            <div class="student-course-card__actions">
              <v-btn
                color="primary"
                prepend-icon="mdi-account-plus"
                :loading="enrollingCourseId === String(item.course.id)"
                variant="flat"
                @click="enrollAvailableCourse(item)"
              >
                Einschreiben
              </v-btn>
            </div>
          </article>
        </div>
      </section>

      <section
        class="course-section"
        aria-labelledby="student-completed-courses"
      >
        <div class="section-heading">
          <div>
            <h2 id="student-completed-courses">
              Abgeschlossene Kurse
            </h2>
            <p>Kurse, bei denen alle aktuellen Lernschritte erledigt sind.</p>
          </div>
          <v-chip
            label
            size="small"
          >
            {{ studentCompletedCourses.length }}
          </v-chip>
        </div>

        <v-empty-state
          v-if="studentCompletedCourses.length === 0"
          icon="mdi-check-circle-outline"
          title="Noch keine abgeschlossenen Kurse"
          text="Abgeschlossene Kurse erscheinen hier, sobald alle Lernschritte erledigt sind."
        />

        <div
          v-else
          class="student-course-grid student-course-grid--compact"
        >
          <article
            v-for="item in studentCompletedCourses"
            :key="item.course.id"
            class="student-course-card student-course-card--completed"
          >
            <div class="student-course-card__main">
              <v-chip
                color="success"
                label
                size="small"
                variant="tonal"
              >
                Abgeschlossen
              </v-chip>
              <h3>{{ item.course.name }}</h3>
              <p>{{ progressText(item) }}</p>
            </div>
            <div class="student-course-card__actions">
              <v-btn
                prepend-icon="mdi-open-in-new"
                variant="outlined"
                @click="openCourseFromItem(item)"
              >
                Kurs öffnen
              </v-btn>
              <v-btn
                v-if="courseProgress(item).hasFeedback"
                prepend-icon="mdi-message-text-outline"
                variant="text"
                @click="openCourseFromItem(item)"
              >
                Feedback ansehen
              </v-btn>
            </div>
          </article>
        </div>
      </section>
    </template>

    <template v-else>
      <section
        class="course-section"
        aria-labelledby="managed-courses"
      >
        <div class="section-heading">
          <div>
            <h2 id="managed-courses">
              Kursverwaltung
            </h2>
            <p>Kompakte Übersicht über Durchlauf, Inhalte, Teilnehmende und Bewertungen.</p>
          </div>
          <v-chip
            label
            size="small"
          >
            {{ displayedMyCourses.length }}
          </v-chip>
        </div>

        <v-empty-state
          v-if="displayedMyCourses.length === 0"
          icon="mdi-school-outline"
          title="Keine verwalteten Kurse"
          text="Für die aktuelle Auswahl wurden keine Kurse gefunden."
        />

        <div
          v-else
          class="management-list"
        >
          <article
            v-for="item in displayedMyCourses"
            :key="item.course.id"
            class="management-row"
          >
            <div class="management-row__title">
              <v-chip
                :color="statusColor(item.course.status)"
                label
                size="small"
                variant="tonal"
              >
                {{ item.course.status ?? 'PUBLISHED' }}
              </v-chip>
              <div>
                <h3>{{ item.course.name }}</h3>
                <p>{{ shortDescription(item.course.description) }}</p>
              </div>
            </div>

            <div class="management-row__meta">
              <div>
                <span>Durchlauf</span>
                <strong>{{ runLabel(item) }}</strong>
              </div>
              <div>
                <span>Aktive Version</span>
                <strong>{{ activeVersionLabel(item) }}</strong>
              </div>
              <div>
                <span>Teilnehmende</span>
                <strong>{{ item.course.currentRun?.enrollmentCount ?? 0 }}</strong>
              </div>
              <div>
                <span>Inhalte</span>
                <strong>{{ item.course.currentRun?.taskCount ?? 0 }} Aufgaben · {{ item.course.currentRun?.materialCount ?? 0 }} Materialien</strong>
              </div>
              <div>
                <span>Letzte Änderung</span>
                <strong>{{ formatDate(item.course.updatedAt ?? item.course.creationDate) }}</strong>
              </div>
            </div>

            <div class="management-row__actions">
              <v-btn
                color="primary"
                size="small"
                variant="flat"
                @click="openCourseTab(item, 'details')"
              >
                Verwalten
              </v-btn>
              <v-btn
                size="small"
                variant="text"
                @click="openCourseTab(item, 'mitglieder')"
              >
                Teilnehmende
              </v-btn>
              <v-btn
                size="small"
                variant="text"
                @click="openCourseTab(item, 'aufgaben')"
              >
                Inhalte bearbeiten
              </v-btn>
              <v-btn
                size="small"
                variant="text"
                @click="openCourseTab(item, 'bewertungen')"
              >
                Bewertungen
              </v-btn>
              <v-btn
                size="small"
                variant="text"
                @click="openCourseTab(item, 'durchlaeufe')"
              >
                Durchläufe
              </v-btn>
            </div>
          </article>
        </div>
      </section>

      <section
        v-if="displayedAvailableCourses.length > 0"
        class="course-section"
        aria-labelledby="management-available-courses"
      >
        <div class="section-heading">
          <div>
            <h2 id="management-available-courses">
              Weitere verfügbare Kurse
            </h2>
            <p>Kurse, in denen du noch keine Rolle hast.</p>
          </div>
          <v-chip
            label
            size="small"
          >
            {{ displayedAvailableCourses.length }}
          </v-chip>
        </div>

        <div class="management-list">
          <article
            v-for="item in displayedAvailableCourses"
            :key="item.course.id"
            class="management-row"
          >
            <div class="management-row__title">
              <v-chip
                color="info"
                label
                size="small"
                variant="tonal"
              >
                Verfügbar
              </v-chip>
              <div>
                <h3>{{ item.course.name }}</h3>
                <p>{{ shortDescription(item.course.description) }}</p>
              </div>
            </div>
            <div class="management-row__actions">
              <v-btn
                color="primary"
                prepend-icon="mdi-account-plus"
                :loading="enrollingCourseId === String(item.course.id)"
                size="small"
                variant="flat"
                @click="enrollAvailableCourse(item)"
              >
                Einschreiben
              </v-btn>
            </div>
          </article>
        </div>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthUserStore } from '../stores/authUserStore'
import type CourseAndParticipationPL from '@/model/course/CourseAndParticipationPL'
import courseService, { type CourseVersion } from '../services/course.service'
import type Semester from '@/model/Semester'
import { getApiErrorMessage } from '@/services/apiErrors'
import GlobalRoles from '@/enums/GlobalRoles'
import CourseRoles from '@/enums/CourseRoles'
import learningTaskService, {
  TaskAssessmentStatus,
  TaskGradingMode,
  TaskProgressStatus,
  type LearningPath,
  type StudentLearningTask
} from '@/services/learningTask.service'

type StudentCourseProgress = {
  completedTasks: number
  hasFeedback: boolean
  loading: boolean
  nextAction: string
  progressPercentage: number
  taskHint: string
  totalTasks: number
}

const router = useRouter()
const authUserStore = useAuthUserStore()

const search = ref('')
const loading = ref(false)
const errorMessage = ref('')
const enrollingCourseId = ref('')
const myCourses = ref<CourseAndParticipationPL[]>([])
const availableCourses = ref<CourseAndParticipationPL[]>([])
const studentProgressByCourseId = ref<Record<string, StudentCourseProgress>>({})
const activeVersionByCourseId = ref<Record<string, string>>({})

const checkboxActive = ref(true)
const checkboxFriedberg = ref(false)
const checkboxGießen = ref(false)

const globalRoles = computed(() => authUserStore.user?.roles ?? [])
const isGlobalAdmin = computed(() => globalRoles.value.includes(GlobalRoles.ROLE_ADMIN))
const hasManagementMembership = computed(() =>
  myCourses.value.some((item) =>
    item.membershipRole === CourseRoles.TEACHER ||
    item.membershipRole === CourseRoles.TUTOR
  )
)
const studentOverview = computed(() => !isGlobalAdmin.value && !hasManagementMembership.value)

const displayedMyCourses = computed(() => filterCourses(myCourses.value))
const displayedAvailableCourses = computed(() => filterCourses(availableCourses.value))
const studentActiveCourses = computed(() =>
  displayedMyCourses.value.filter((item) => !isCompletedCourse(item))
)
const studentCompletedCourses = computed(() =>
  displayedMyCourses.value.filter((item) => isCompletedCourse(item))
)

const loadCourses = async () => {
  const userId = authUserStore.auth.user?.id
  if (userId == null) {
    errorMessage.value = 'Sie müssen angemeldet sein, um Kurse zu laden.'
    return
  }

  loading.value = true
  errorMessage.value = ''
  studentProgressByCourseId.value = {}
  activeVersionByCourseId.value = {}

  try {
    const [enrolledCourses, enrollableCourses] = await Promise.all([
      courseService.getEnrolledCourses(),
      courseService.getAvailableCourses()
    ])

    myCourses.value = enrolledCourses
    availableCourses.value = enrollableCourses

    if (studentOverview.value) {
      await loadStudentProgress(enrolledCourses)
    } else {
      await loadActiveVersions(enrolledCourses)
    }
  } catch (error) {
    errorMessage.value = getApiErrorMessage(error)
  } finally {
    loading.value = false
  }
}

const loadStudentProgress = async (courses: CourseAndParticipationPL[]) => {
  const progressEntries = await Promise.all(
    courses.map(async (item) => {
      const courseId = String(item.course.id)

      try {
        const learningPath = await learningTaskService.getMyLearningPath(item.course.id)
        return [courseId, mapLearningPathToProgress(learningPath)] as const
      } catch {
        return [courseId, emptyStudentProgress('Fortschritt konnte nicht geladen werden.')] as const
      }
    })
  )

  studentProgressByCourseId.value = Object.fromEntries(progressEntries)
}

const loadActiveVersions = async (courses: CourseAndParticipationPL[]) => {
  const versionEntries = await Promise.all(
    courses.map(async (item) => {
      const courseId = String(item.course.id)
      const runId = item.course.currentRun?.id

      if (!runId) {
        return [courseId, 'Kein aktiver Durchlauf'] as const
      }

      try {
        const versions = await courseService.listCourseVersions(item.course.id, runId)
        const activeVersion = versions.find((version: CourseVersion) => version.isActive) ?? versions[0]
        return [courseId, activeVersion ? versionLabel(activeVersion) : 'Keine Version'] as const
      } catch {
        return [courseId, 'Nicht geladen'] as const
      }
    })
  )

  activeVersionByCourseId.value = Object.fromEntries(versionEntries)
}

const mapLearningPathToProgress = (learningPath: LearningPath): StudentCourseProgress => {
  const nextTask = findNextTask(learningPath.tasks)
  const openTaskCount = learningPath.tasks.filter((task) =>
    [TaskProgressStatus.AVAILABLE, TaskProgressStatus.IN_PROGRESS, TaskProgressStatus.SUBMITTED].includes(task.status)
  ).length
  const pendingReviewCount = learningPath.tasks.filter((task) =>
    task.status === TaskProgressStatus.SUBMITTED ||
    task.assessment?.status === TaskAssessmentStatus.PENDING_REVIEW ||
    task.assessment?.status === TaskAssessmentStatus.SUBMITTED
  ).length

  return {
    completedTasks: learningPath.completedTasks,
    hasFeedback: learningPath.tasks.some((task) => Boolean(task.assessment?.feedback)),
    loading: false,
    nextAction: nextActionForTask(nextTask, learningPath),
    progressPercentage: learningPath.progressPercentage,
    taskHint: pendingReviewCount > 0
      ? `${pendingReviewCount} Abgabe${pendingReviewCount === 1 ? '' : 'n'} wartet auf Bewertung`
      : openTaskCount > 0
        ? `${openTaskCount} offene Lernschritte`
        : '',
    totalTasks: learningPath.totalTasks
  }
}

const emptyStudentProgress = (nextAction = 'Kurs öffnen'): StudentCourseProgress => ({
  completedTasks: 0,
  hasFeedback: false,
  loading: false,
  nextAction,
  progressPercentage: 0,
  taskHint: '',
  totalTasks: 0
})

const findNextTask = (tasks: StudentLearningTask[]) =>
  [...tasks]
    .sort((left, right) => left.order - right.order)
    .find((task) =>
      task.status === TaskProgressStatus.IN_PROGRESS ||
      task.status === TaskProgressStatus.AVAILABLE ||
      task.status === TaskProgressStatus.SUBMITTED ||
      (task.status === TaskProgressStatus.FAILED && task.allowRetries) ||
      task.status === TaskProgressStatus.LOCKED
    ) ?? null

const nextActionForTask = (task: StudentLearningTask | null, learningPath: LearningPath): string => {
  if (!task) {
    return learningPath.totalTasks > 0 ? 'Feedback ansehen' : 'Kurs öffnen'
  }

  if (task.status === TaskProgressStatus.SUBMITTED) {
    return `Feedback ansehen: ${task.title}`
  }

  if (task.status === TaskProgressStatus.LOCKED) {
    return `Nächster Schritt gesperrt: ${task.title}`
  }

  if (task.gradingMode === TaskGradingMode.MANUAL) {
    return `Nächster Schritt: ${task.title}`
  }

  return `Nächster Schritt: ${task.title}`
}

const filterCourses = (courses: CourseAndParticipationPL[]) => {
  const normalizedSearch = search.value.trim().toLowerCase()
  let filteredList = courses
  if (checkboxActive.value) filteredList = filteredList.filter((item) => ifActiveSemester(item.course.semester as Semester))
  if (checkboxFriedberg.value) filteredList = filteredList.filter((item) => item.course.location === 'Friedberg')
  if (checkboxGießen.value) filteredList = filteredList.filter((item) => item.course.location === 'Gießen')
  if (normalizedSearch) {
    filteredList = filteredList.filter((item) =>
      `${item.course.name} ${item.course.description} ${item.course.location}`.toLowerCase().includes(normalizedSearch)
    )
  }
  return filteredList
}

const openCourseFromItem = (item: CourseAndParticipationPL) => {
  router.push('/course/' + item.course.id)
}

const openCourseTab = (item: CourseAndParticipationPL, tab: string) => {
  router.push({
    path: '/course/' + item.course.id,
    query: { tab }
  })
}

const enrollAvailableCourse = (item: CourseAndParticipationPL) => {
  if (item.course.requiresEnrollmentKey) {
    router.push('/course/' + item.course.id + '/signup')
    return
  }

  enrollingCourseId.value = String(item.course.id)
  errorMessage.value = ''

  courseService
    .enrollCourse(item.course.id)
    .then(() => {
      router.push('/course/' + item.course.id)
    })
    .catch((error) => {
      errorMessage.value = getApiErrorMessage(error)
    })
    .finally(() => {
      enrollingCourseId.value = ''
    })
}

const courseProgress = (item: CourseAndParticipationPL): StudentCourseProgress =>
  studentProgressByCourseId.value[String(item.course.id)] ?? emptyStudentProgress()

const isCompletedCourse = (item: CourseAndParticipationPL) => {
  const progress = courseProgress(item)
  return progress.totalTasks > 0 && progress.completedTasks >= progress.totalTasks
}

const progressText = (item: CourseAndParticipationPL) => {
  const progress = courseProgress(item)
  if (progress.totalTasks === 0) return 'Noch keine Lernschritte verfügbar'
  return `${progress.completedTasks} von ${progress.totalTasks} Lernschritten abgeschlossen`
}

const nextActionText = (item: CourseAndParticipationPL) => courseProgress(item).nextAction

const materialHint = (item: CourseAndParticipationPL) => {
  const materialCount = item.course.currentRun?.materialCount ?? 0
  return materialCount > 0 ? 'Neue Materialien verfügbar' : ''
}

const shortDescription = (description?: string) => {
  const normalizedDescription = description?.trim()
  if (!normalizedDescription) return 'Keine Kurzbeschreibung hinterlegt.'
  if (normalizedDescription.length <= 160) return normalizedDescription
  return `${normalizedDescription.slice(0, 157)}...`
}

const runLabel = (item: CourseAndParticipationPL) => item.course.currentRun?.label ?? 'Kein aktiver Durchlauf'

const activeVersionLabel = (item: CourseAndParticipationPL) =>
  activeVersionByCourseId.value[String(item.course.id)] ?? 'Wird geladen'

const versionLabel = (version: CourseVersion) =>
  version.label || `Version ${version.versionNumber}`

const statusColor = (status?: string) => {
  if (status === 'ARCHIVED') return 'status-locked'
  if (status === 'DRAFT') return 'warning'
  return 'success'
}

const formatDate = (value?: string) => {
  if (!value) return '-'

  return new Intl.DateTimeFormat('de-DE', {
    dateStyle: 'medium'
  }).format(new Date(value))
}

const ifActiveSemester = (semester: Semester) => {
  return Date.now() > Date.parse(semester.startDate) && Date.now() < Date.parse(semester.endDate)
}

defineExpose({
  loadCourses
})
</script>

<style scoped lang="scss">
.courses-overview {
  display: flex;
  flex-direction: column;
  gap: 24px;
  margin: 20px;
}

.courses-toolbar {
  align-items: flex-start;
  display: flex;
  gap: 20px;
  justify-content: space-between;
}

.search-bar {
  max-width: 420px;
}

.filters {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-end;
}

.course-section {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.section-heading {
  align-items: flex-start;
  display: flex;
  gap: 12px;
  justify-content: space-between;

  h2 {
    font-size: 1.25rem;
    font-weight: 600;
    margin: 0 0 4px;
  }

  p {
    color: rgb(var(--v-theme-on-surface-variant));
    margin: 0;
  }
}

.student-course-grid {
  display: grid;
  gap: 14px;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
}

.student-course-grid--compact {
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
}

.student-course-card,
.management-row {
  background: rgb(var(--v-theme-surface));
  border: 1px solid rgba(var(--v-theme-outline), 0.28);
  border-radius: 8px;
}

.student-course-card {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-height: 240px;
  padding: 16px;
}

.student-course-card--completed {
  min-height: 170px;
}

.student-course-card__main {
  display: flex;
  flex-direction: column;
  gap: 8px;

  h3 {
    font-size: 1.08rem;
    font-weight: 600;
    line-height: 1.3;
    margin: 0;
  }

  p {
    color: rgb(var(--v-theme-on-surface-variant));
    margin: 0;
  }
}

.student-course-card__progress {
  display: flex;
  flex-direction: column;
  gap: 8px;

  span {
    color: rgb(var(--v-theme-on-surface-variant));
    font-size: 0.9rem;
  }
}

.student-course-card__signals {
  display: flex;
  flex-direction: column;
  gap: 8px;

  span {
    align-items: center;
    color: rgb(var(--v-theme-on-surface-variant));
    display: flex;
    gap: 8px;
  }
}

.student-course-card__actions,
.management-row__actions {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: auto;
}

.management-list {
  display: grid;
  gap: 10px;
}

.management-row {
  display: grid;
  gap: 14px;
  grid-template-columns: minmax(220px, 1.1fr) minmax(420px, 1.8fr) minmax(300px, auto);
  padding: 14px;
}

.management-row__title {
  align-items: flex-start;
  display: flex;
  gap: 10px;
  min-width: 0;

  h3 {
    font-size: 1rem;
    font-weight: 600;
    margin: 0 0 4px;
  }

  p {
    color: rgb(var(--v-theme-on-surface-variant));
    margin: 0;
    overflow-wrap: anywhere;
  }
}

.management-row__meta {
  display: grid;
  gap: 10px;
  grid-template-columns: repeat(5, minmax(110px, 1fr));

  span {
    color: rgb(var(--v-theme-on-surface-variant));
    display: block;
    font-size: 0.78rem;
  }

  strong {
    display: block;
    font-size: 0.9rem;
    font-weight: 600;
    margin-top: 2px;
  }
}

.management-row__actions {
  justify-content: flex-end;
}

@media (max-width: 1180px) {
  .management-row {
    grid-template-columns: 1fr;
  }

  .management-row__actions {
    justify-content: flex-start;
  }
}

@media (max-width: 780px) {
  .courses-overview {
    margin: 14px;
  }

  .courses-toolbar,
  .section-heading {
    flex-direction: column;
  }

  .filters {
    justify-content: flex-start;
  }

  .search-bar {
    max-width: none;
    width: 100%;
  }

  .management-row__meta {
    grid-template-columns: 1fr;
  }
}
</style>
