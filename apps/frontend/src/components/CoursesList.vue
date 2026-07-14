<template>
  <div class="container">
    <v-alert v-if="errorMessage" class="mb-4" type="error" variant="tonal">
      {{ errorMessage }}
    </v-alert>
    <v-progress-linear v-if="loading" class="mb-4" color="primary" indeterminate />

    <v-text-field v-model="search" label="Search" density="compact" prepend-icon="mdi-magnify" variant="underlined" hide-details class="search-bar" />

    <v-row class="filters">
      <v-checkbox v-model="checkboxActive" label="Nur aktive Kurse anzeigen" />
      <v-checkbox v-model="checkboxFriedberg" label="Friedberg" @click="checkboxGießen = false" />
      <v-checkbox v-model="checkboxGießen" label="Gießen" @click="checkboxFriedberg = false" />
    </v-row>

    <section class="course-section">
      <div class="section-heading">
        <h2>Meine Kurse</h2>
        <v-chip label size="small">{{ displayedMyCourses.length }}</v-chip>
      </div>

      <v-data-table :headers="myCourseHeaders" :items="displayedMyCourses" :sort-by="sortBy" item-value="course.id" class="elevation-1" :search="search" density="default" height="320px" @click:row="openCourse">
        <template #[`item.course.active`]="{ item }">
          <v-icon v-if="!ifActiveSemester(item.course.semester as Semester)" icon="mdi-close-circle" color="status-locked" />
          <v-icon v-else icon="mdi-check-circle" color="success" />
        </template>

        <template #[`item.membershipRole`]="{ item }">
          {{ roleLabel(item.membershipRole) }}
        </template>

        <template #[`item.actions`]="{ item }">
          <v-btn icon="mdi-open-in-new" size="small" variant="text" @click.stop="openCourseFromItem(item)" />
        </template>

        <template #no-data>
          <v-empty-state icon="mdi-school-outline" title="Keine eigenen Kurse vorhanden" text="Für die aktuelle Auswahl wurden keine Kurse gefunden." />
        </template>
      </v-data-table>
    </section>

    <section class="course-section">
      <div class="section-heading">
        <h2>Verfügbare Kurse</h2>
        <v-chip label size="small">{{ displayedAvailableCourses.length }}</v-chip>
      </div>

      <v-data-table :headers="availableCourseHeaders" :items="displayedAvailableCourses" :sort-by="sortBy" item-value="course.id" class="elevation-1" :search="search" density="default" height="320px" @click:row="openSignup">
        <template #[`item.course.active`]="{ item }">
          <v-icon v-if="!ifActiveSemester(item.course.semester as Semester)" icon="mdi-close-circle" color="status-locked" />
          <v-icon v-else icon="mdi-check-circle" color="success" />
        </template>

        <template #[`item.actions`]="{ item }">
          <v-btn color="primary" size="small" variant="flat" prepend-icon="mdi-account-plus" :loading="enrollingCourseId === String(item.course.id)" @click.stop="enrollAvailableCourse(item)"> Einschreiben </v-btn>
        </template>

        <template #no-data>
          <v-empty-state icon="mdi-school-search" title="Keine verfügbaren Kurse" text="Für die aktuelle Auswahl gibt es keine freigegebenen Kurse zur Einschreibung." />
        </template>
      </v-data-table>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthUserStore } from '../stores/authUserStore'
import type CourseAndParticipationPL from '@/model/course/CourseAndParticipationPL'
import courseService from '../services/course.service'
import type Semester from '@/model/Semester'
import { getApiErrorMessage } from '@/services/apiErrors'

type DataTableHeader = {
  title: string
  align?: 'start' | 'center' | 'end'
  key: string
  sortable?: boolean
}

type DataTableSortItem = {
  key: string
  order: 'asc' | 'desc'
}

const router = useRouter()
const authUserStore = useAuthUserStore()

const search = ref('')
const loading = ref(false)
const errorMessage = ref('')
const enrollingCourseId = ref('')

const myCourseHeaders = ref<DataTableHeader[]>([
  { title: 'Semester', align: 'start', key: 'course.semester.name' },
  { title: 'Semester aktiv', align: 'start', key: 'course.active' },
  { title: 'Kursname', align: 'start', key: 'course.name' },
  { title: 'Kurzbeschreibung', align: 'start', key: 'course.description' },
  { title: 'Status', align: 'start', key: 'course.status' },
  { title: 'Standort', align: 'start', key: 'course.location' },
  { title: 'Owner', align: 'start', key: 'course.owner' },
  { title: 'Rolle', align: 'start', key: 'membershipRole' },
  { title: '', align: 'end', key: 'actions', sortable: false }
])

const availableCourseHeaders = ref<DataTableHeader[]>([
  { title: 'Semester', align: 'start', key: 'course.semester.name' },
  { title: 'Semester aktiv', align: 'start', key: 'course.active' },
  { title: 'Kursname', align: 'start', key: 'course.name' },
  { title: 'Kurzbeschreibung', align: 'start', key: 'course.description' },
  { title: 'Status', align: 'start', key: 'course.status' },
  { title: 'Standort', align: 'start', key: 'course.location' },
  { title: 'Owner', align: 'start', key: 'course.owner' },
  { title: '', align: 'end', key: 'actions', sortable: false }
])

const sortBy = ref<DataTableSortItem[]>([{ key: 'course.name', order: 'asc' }])

const myCourses = ref<CourseAndParticipationPL[]>([])
const availableCourses = ref<CourseAndParticipationPL[]>([])

const checkboxActive = ref(true)
const checkboxFriedberg = ref(false)
const checkboxGießen = ref(false)

const displayedMyCourses = computed(() => filterCourses(myCourses.value))
const displayedAvailableCourses = computed(() => filterCourses(availableCourses.value))

const loadCourses = () => {
  const userId = authUserStore.auth.user?.id
  if (userId == null) {
    errorMessage.value = 'Sie müssen angemeldet sein, um Kurse zu laden.'
    return
  }

  loading.value = true
  errorMessage.value = ''

  Promise.all([courseService.getEnrolledCourses(), courseService.getAvailableCourses()])
    .then(([enrolledCourses, enrollableCourses]) => {
      myCourses.value = enrolledCourses
      availableCourses.value = enrollableCourses
    })
    .catch((error) => {
      errorMessage.value = getApiErrorMessage(error)
    })
    .finally(() => {
      loading.value = false
    })
}

const filterCourses = (courses: CourseAndParticipationPL[]) => {
  let filteredList = courses
  if (checkboxActive.value) filteredList = filteredList.filter((item) => ifActiveSemester(item.course.semester as Semester))
  if (checkboxFriedberg.value) filteredList = filteredList.filter((item) => item.course.location == 'Friedberg')
  if (checkboxGießen.value) filteredList = filteredList.filter((item) => item.course.location == 'Gießen')
  return filteredList
}

const openCourse = (_row: unknown, item: { item: CourseAndParticipationPL }) => {
  openCourseFromItem(item.item)
}

const openSignup = (_row: unknown, item: { item: CourseAndParticipationPL }) => {
  router.push('/course/' + item.item.course.id + '/signup')
}

const openCourseFromItem = (item: CourseAndParticipationPL) => {
  router.push('/course/' + item.course.id)
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

const roleLabel = (role?: string) => {
  if (role === 'TEACHER') return 'Lehrend'
  if (role === 'TUTOR') return 'Tutor'
  if (role === 'STUDENT') return 'Studierend'
  return 'Mitglied'
}

const ifActiveSemester = (semester: Semester) => {
  return Date.now() > Date.parse(semester.startDate) && Date.now() < Date.parse(semester.endDate)
}

defineExpose({
  loadCourses
})
</script>

<style scoped lang="scss">
.container {
  width: auto;
  margin: 20px;
}

.search-bar {
  margin-bottom: 20px;
}

.filters {
  margin-bottom: 8px;
}

.course-section {
  margin-top: 24px;
}

.section-heading {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;

  h2 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 500;
  }
}
</style>
