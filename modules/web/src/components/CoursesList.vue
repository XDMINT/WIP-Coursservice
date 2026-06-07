<template>
  <div class="container">
    <v-alert class="mb-4" type="info" variant="tonal" density="comfortable"> Diese Liste nutzt Mock-Daten. Tausche die Service-Schicht später gegen echte Backend-Calls aus. </v-alert>
    <v-text-field v-model="search" label="Search" density="compact" prepend-icon="mdi-magnify" variant="underlined" hide-details class="search-bar" />
    <v-row>
      <v-checkbox v-model="checkboxActive" label="Nur aktive Kurse anzeigen" @change="filterCourseList" />
      <v-checkbox v-model="checkboxFriedberg" label="Friedberg" @change="filterCourseList" @click="checkboxGießen = false" />
      <v-checkbox v-model="checkboxGießen" label="Gießen" @change="filterCourseList" @click="checkboxFriedberg = false" />
      <v-checkbox v-model="checkboxParticipation" label="Teilnahme" @change="filterCourseList" />
    </v-row>
    <v-data-table :headers="headers" :items="displayedCourses" :sort-by="sortBy" item-value="name" class="elevation-1" :search="search" density="default" height="480px" @click:row="openCourseOrSignUp">
      <template #[`item.course.active`]="{ item }">
        <v-icon v-if="!ifActiveSemester(item.course.semester as Semester)" icon="mdi-close-circle" color="gray" />
        <v-icon v-if="ifActiveSemester(item.course.semester as Semester)" icon="mdi-check-circle" color="success" />
      </template>
      <template #[`item.member`]="{ item }">
        <v-icon v-if="item.member == true" icon="mdi-check-bold" color="success" />
      </template>
    </v-data-table>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthUserStore } from '../stores/authUserStore'
import type CourseAndParticipationPL from '@/model/course/CourseAndParticipationPL'
import courseService from '../services/course.service'
import type Semester from '@/model/Semester'

type DataTableHeader = {
  title: string
  align?: 'start' | 'center' | 'end'
  key: string
}

type DataTableSortItem = {
  key: string
  order: 'asc' | 'desc'
}

const router = useRouter()
const authUserStore = useAuthUserStore()

const search = ref('')

const headers = ref<DataTableHeader[]>([
  { title: 'Semester', align: 'start', key: 'course.semester.name' },
  { title: 'Aktiv', align: 'start', key: 'course.active' },
  { title: 'Kursname', align: 'start', key: 'course.name' },
  { title: 'Standort', align: 'start', key: 'course.location' },
  { title: 'Teilnahme', align: 'start', key: 'member' }
])

// sort by semester.name and standort
const sortBy = ref<DataTableSortItem[]>([{ key: 'course.name', order: 'asc' }])

// Courses lists
const displayedCourses = ref<CourseAndParticipationPL[]>([])
const allCourses = ref<CourseAndParticipationPL[]>([])

// Checkboxes
const checkboxActive = ref(true)
const checkboxFriedberg = ref(false)
const checkboxGießen = ref(false)
const checkboxParticipation = ref(false)

const loadCourses = () => {
  const userId = authUserStore.auth.user?.id
  if (userId != undefined) {
    courseService
      .getAllCourses(userId)
      .then((data) => {
        allCourses.value = data
        displayedCourses.value = allCourses.value

        filterCourseList()
      })
      .catch((error) => {
        console.log(error)
      })
  } else {
    console.log('userId is undefined')
  }
}

const filterCourseList = () => {
  let filteredList: CourseAndParticipationPL[] = allCourses.value
  if (checkboxActive.value) filteredList = filteredList.filter((item) => ifActiveSemester(item.course.semester as Semester))
  if (checkboxFriedberg.value) filteredList = filteredList.filter((item) => item.course.location == 'Friedberg')
  if (checkboxGießen.value) filteredList = filteredList.filter((item) => item.course.location == 'Gießen')
  if (checkboxParticipation.value) filteredList = filteredList.filter((item) => item.member == true)
  displayedCourses.value = filteredList
}

const openCourseOrSignUp = (row: any, item: any) => {
  if (item.item.member == false) router.push('/course/' + item.item.course.id + '/signup')
  else router.push('/course/' + item.item.course.id)
}

const ifActiveSemester = (semester: Semester) => {
  if (Date.now() > Date.parse(semester.startDate) && Date.now() < Date.parse(semester.endDate)) return true
  else return false
}

defineExpose({
  loadCourses
})
</script>

<style scoped lang="scss">
.container {
  width: auto;
  margin: 20px 20px;
}

.search-bar {
  margin-bottom: 20px;
}
</style>
