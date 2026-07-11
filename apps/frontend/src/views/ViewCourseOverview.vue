<template>
  <DialogConfirmVue ref="dialogConfirm" />
  <div class="course-overview">
    <v-alert v-if="pageError" class="mb-4" :type="pageErrorType" variant="tonal">
      {{ pageError }}
    </v-alert>

    <v-progress-linear v-if="loading" class="mb-4" color="primary" indeterminate />

    <!-- Breadcrumb -->
    <v-breadcrumbs class="breadcrumbs" :items="breadcrumbItems" />

    <!-- Header: Titel + Rolle-Chip + Action-Icons -->
    <div class="course-header">
      <div class="course-header__left">
        <h1 class="course-title">
          {{ courseName }}
        </h1>
        <v-chip class="mt-2" prepend-icon="mdi-account-circle" label>
          {{ currentRole || '...' }}
        </v-chip>
      </div>
      <div v-if="!pageError" class="course-header__actions">
        <v-btn v-if="canManageCourse" variant="text" color="primary" icon @click="editCourse">
          <v-icon size="x-large"> mdi-cog </v-icon>
          <v-tooltip activator="parent" location="bottom"> Kurs bearbeiten </v-tooltip>
        </v-btn>
        <v-btn variant="text" color="primary" icon @click="leaveCourse">
          <v-icon size="x-large"> mdi-logout-variant </v-icon>
          <v-tooltip activator="parent" location="bottom"> Kurs verlassen </v-tooltip>
        </v-btn>
      </div>
    </div>

    <!-- Tab-System -->
    <v-card v-if="!loading && !pageError" class="mt-4" variant="outlined">
      <v-tabs v-model="activeTab" color="primary">
        <v-tab value="details">
          <v-icon start> mdi-text-box-outline </v-icon>
          kurs details
        </v-tab>
        <v-tab value="aufgaben">
          <v-icon start> mdi-pencil </v-icon>
          Aufgaben
        </v-tab>
        <v-tab value="materialien">
          <v-icon start> mdi-folder-multiple-outline </v-icon>
          Materialien
        </v-tab>
        <v-tab v-if="canReadResults" value="bewertungen">
          <v-icon start> mdi-school-outline </v-icon>
          Bewertung
        </v-tab>
        <v-tab v-if="canManageMembers" value="mitglieder">
          <v-icon start> mdi-account-group </v-icon>
          Mitglieder
        </v-tab>
        <v-tab value="historie">
          <v-icon start> mdi-history </v-icon>
          Kurs historie
        </v-tab>
      </v-tabs>

      <v-divider />

      <v-tabs-window v-model="activeTab">
        <!-- Tab 1: Kurs Details -->
        <v-tabs-window-item value="details">
          <v-card-text class="tab-content">
            <p class="text-body-1">
              {{ course?.description }}
            </p>
          </v-card-text>
        </v-tabs-window-item>

        <v-tabs-window-item value="aufgaben">
          <v-card-text class="tab-content">
            <LearningProcessPanel :course-id="courseId" :can-manage="canManageContent" />
          </v-card-text>
        </v-tabs-window-item>

        <v-tabs-window-item value="materialien">
          <v-card-text class="tab-content">
            <LearningMaterialsPanel :course-id="courseId" :can-manage="canManageContent" />
          </v-card-text>
        </v-tabs-window-item>

        <v-tabs-window-item v-if="canReadResults" value="bewertungen">
          <v-card-text class="tab-content">
            <CourseResultsPanel :course-id="courseId" :can-manage="canManageResults" />
          </v-card-text>
        </v-tabs-window-item>

        <!-- Tab 3: Mitglieder -->
        <v-tabs-window-item v-if="canManageMembers" value="mitglieder">
          <v-data-table :headers="memberHeaders" :items="members" item-value="email" :items-per-page="5" density="default">
            <!-- E-Mail als Link -->
            <template #[`item.user.email`]="{ item }">
              <a :href="`mailto:${item.user.email}`">{{ item.user.email }}</a>
            </template>

            <!-- Rolle als Select -->
            <template #[`item.role`]="{ item }">
              <v-select v-model="item.role" :items="roleOptions" variant="plain" hide-details class="role-select" :disabled="!canManageMembers || item.role === 'TEACHER'" @update:model-value="changeRole(item)" />
            </template>

            <!-- Aktion: Löschen -->
            <template #[`item.actions`]="{ item }">
              <v-btn icon variant="text" color="primary" size="small" :disabled="!canManageMembers || item.role === 'TEACHER'" @click="kickUser(item)">
                <v-icon>mdi-close-box</v-icon>
              </v-btn>
            </template>

            <template #no-data>
              <v-empty-state icon="mdi-account-group-outline" title="Keine Mitglieder vorhanden" text="In diesem Kurs gibt es noch keine weiteren eingeschriebenen Personen." />
            </template>

            <!-- Rolle: Select mit changeRole-Handler -->
            <!-- Footer mit "Alle entfernen" + Pagination -->
            <template #bottom="{ pageCount, page, setPage }">
              <v-divider />
              <div class="table-footer">
                <v-btn v-if="canManageMembers" variant="outlined" size="small" @click="kickAllMembers"> Alle Mitglieder entfernen </v-btn>
                <v-pagination :model-value="page" :length="pageCount" :total-visible="5" density="compact" @update:model-value="setPage($event)" />
              </div>
            </template>
          </v-data-table>
        </v-tabs-window-item>

        <!-- Tab 4: Kurs Historie -->
        <v-tabs-window-item value="historie">
          <v-data-table :headers="historieHeaders" :items="courseHistory" item-value="semester" :items-per-page="5" density="default">
            <!-- Aufgaben als Chip -->
            <template #[`item.aufgaben`]="{ item }">
              <v-chip label size="small"> {{ item.aufgaben }} Aufgaben </v-chip>
            </template>

            <!-- Mitglieder als Chip -->
            <template #[`item.mitglieder`]="{ item }">
              <v-chip label size="small"> {{ item.mitglieder }} Mitglieder </v-chip>
            </template>

            <!-- Footer mit Pagination -->
            <template #bottom="{ pageCount, page, setPage }">
              <v-divider />
              <div class="table-footer table-footer--end">
                <v-pagination :model-value="page" :length="pageCount" :total-visible="5" density="compact" @update:model-value="setPage($event)" />
              </div>
            </template>
          </v-data-table>
        </v-tabs-window-item>
      </v-tabs-window>
    </v-card>
  </div>
  <v-snackbar v-model="snackbarSuccess" :timeout="2500"> Rolle erfolgreich geändert </v-snackbar>
  <v-snackbar v-model="snackbarError" :timeout="3500">
    {{ snackbarErrorMessage }}
  </v-snackbar>
  <DialogCreateCourse ref="dialogCreateCourse" />
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthUserStore } from '@/stores/authUserStore'
import courseService from '@/services/course.service'
import type CoursePL from '@/model/course/CoursePL'
import type Member from '@/model/course/Member'
import DialogConfirmVue from '@/dialog/DialogConfirm.vue'
import DialogCreateCourse from '@/dialog/DialogCreateCourse.vue'
import { getApiErrorMessage, normalizeApiError } from '@/services/apiErrors'
import CourseRoles from '@/enums/CourseRoles'
import LearningMaterialsPanel from '@/components/course/LearningMaterialsPanel.vue'
import LearningProcessPanel from '@/components/course/LearningProcessPanel.vue'
import CourseResultsPanel from '@/components/course/CourseResultsPanel.vue'

const route = useRoute()
const router = useRouter()
const authUserStore = useAuthUserStore()

// ── Seiten-Metadaten ──────────────────────────────────────────────────────────

const courseId = ref(String(route.params.id))
const userId = ref<number | null>(authUserStore.auth.user?.id ?? null)
const course = ref<CoursePL>()
const currentRole = ref('')
const dialogConfirm = ref<typeof DialogConfirmVue>()
const dialogCreateCourse = ref<typeof DialogCreateCourse>()
const snackbarSuccess = ref(false)
const snackbarError = ref(false)
const snackbarErrorMessage = ref('')
const loading = ref(true)
const pageError = ref('')
const pageErrorType = ref<'error' | 'warning'>('error')
const permissions = ref<Record<string, boolean>>({})

const courseName = computed(() => course.value?.name ?? '...')
const canManageContent = computed(() => permissions.value['course.content.manage'] === true)
const canManageCourse = computed(() => permissions.value['course.manage'] === true)
const canManageMembers = computed(() => permissions.value['course.members.manage'] === true)
const canReadResults = computed(() => permissions.value['course.results.own.read'] === true || permissions.value['course.results.all.read'] === true)
const canManageResults = computed(() => permissions.value['course.results.all.read'] === true)

const breadcrumbItems = computed(() => [
  { title: 'Dashboard', disabled: false, href: '/#/home' },
  { title: 'Kursverwaltung', disabled: false, href: '/#/course' },
  { title: courseName.value, disabled: true, href: '' }
])

onMounted(() => {
  if (userId.value == null) {
    router.push('/login')
    return
  }
  loadCourseContext()
})

const showSnackbarError = (message: string) => {
  snackbarErrorMessage.value = message
  snackbarError.value = true
}

const loadCourseContext = () => {
  loading.value = true
  pageError.value = ''

  courseService
    .getCourseContext(courseId.value)
    .then((context) => {
      course.value = context.course
      currentRole.value = context.role
      permissions.value = context.permissions

      if (context.role === CourseRoles.NONE) {
        router.push(route.path + '/signup')
        return
      }

      if (canManageMembers.value) {
        loadMembers()
      }
    })
    .catch((error) => {
      const apiError = normalizeApiError(error)

      if (apiError.kind === 'forbidden') {
        pageErrorType.value = 'warning'
        pageError.value = 'Sie haben keinen Zugriff auf die internen Inhalte dieses Kurses.'
        return
      }

      if (apiError.kind === 'not-found') {
        pageErrorType.value = 'warning'
        pageError.value = 'Der Kurs wurde nicht gefunden.'
        return
      }

      if (apiError.kind === 'unauthorized') {
        router.push('/login')
        return
      }

      pageErrorType.value = 'error'
      pageError.value = getApiErrorMessage(apiError)
    })
    .finally(() => {
      loading.value = false
    })
}

// ── Tab-Steuerung ─────────────────────────────────────────────────────────────

const activeTab = ref('details')

// ── Mitglieder-Tab ────────────────────────────────────────────────────────────

const roleOptions = ['STUDENT', 'TUTOR', 'TEACHER']

const memberHeaders = [
  { title: 'Name', align: 'start' as const, key: 'user.lastName' },
  { title: 'Vorname', align: 'start' as const, key: 'user.firstName' },
  { title: 'E-Mail', align: 'start' as const, key: 'user.email' },
  { title: 'Rolle', align: 'start' as const, key: 'role', width: '160px' },
  { title: 'Aktion', align: 'center' as const, key: 'actions', sortable: false, width: '80px' }
]

const members = ref<Member[]>([])

const loadMembers = () => {
  courseService
    .getCourseMembers(courseId.value)
    .then((response) => {
      members.value = response.data
    })
    .catch((error) => showSnackbarError(getApiErrorMessage(error)))
}

const kickUser = (member: Member) => {
  if (dialogConfirm.value) {
    dialogConfirm.value.openDialog(`Entferne Nutzer: ${member.user.firstName} ${member.user.lastName}`, 'Wollen Sie den Nutzer wirklich aus dem Kurs entfernen?', 'Entfernen').then((result: boolean) => {
      if (result) {
        courseService
          .leaveCourse(courseId.value, member.user.id)
          .then(() => loadMembers())
          .catch((error) => showSnackbarError(getApiErrorMessage(error)))
      }
    })
  }
}

const kickAllMembers = () => {
  if (dialogConfirm.value) {
    dialogConfirm.value.openDialog('Alle Mitglieder entfernen', 'Wollen Sie wirklich alle Mitglieder aus dem Kurs entfernen?', 'Entfernen').then((result: boolean) => {
      if (result) {
        Promise.all(members.value.filter((m) => m.role !== 'TEACHER').map((m) => courseService.leaveCourse(courseId.value, m.user.id)))
          .then(() => loadMembers())
          .catch((error) => showSnackbarError(getApiErrorMessage(error)))
      }
    })
  }
}

const changeRole = (member: Member) => {
  courseService
    .changeUserRole(courseId.value, member.user.id, member.role)
    .then(() => {
      snackbarSuccess.value = true
      loadMembers()
    })
    .catch((error) => {
      showSnackbarError(getApiErrorMessage(error))
      loadMembers()
    })
}

const leaveCourse = () => {
  if (dialogConfirm.value) {
    dialogConfirm.value.openDialog(`Verlasse Kurs: ${course.value?.name}`, 'Willst du den Kurs wirklich verlassen?', 'Verlassen').then((result: boolean) => {
      if (result) {
        courseService
          .leaveCourse(courseId.value, userId.value ?? undefined)
          .then(() => router.push('/course'))
          .catch((error) => showSnackbarError(getApiErrorMessage(error)))
      }
    })
  }
}

const editCourse = () => {
  if (dialogCreateCourse.value) {
    dialogCreateCourse.value
      .openDialog(courseId.value)
      .then(() => loadCourseContext())
      .catch((error: unknown) => showSnackbarError(getApiErrorMessage(error)))
  }
}

// ── Kurs-Historie-Tab (wird später vom Backend befüllt) ───────────────────────

interface CourseHistoryEntry {
  semester: string
  rolle: string
  aufgaben: number
  mitglieder: number
}

const historieHeaders = [
  { title: 'Semester', align: 'start' as const, key: 'semester' },
  { title: 'Rolle', align: 'start' as const, key: 'rolle' },
  { title: 'Aufgaben', align: 'start' as const, key: 'aufgaben' },
  { title: 'Mitglieder', align: 'start' as const, key: 'mitglieder' }
]

const courseHistory = ref<CourseHistoryEntry[]>([
  { semester: 'Sommersemester 26', rolle: 'TEACHER', aufgaben: 3, mitglieder: 25 },
  { semester: 'Wintersemester 25/26', rolle: 'TUTOR', aufgaben: 8, mitglieder: 22 },
  { semester: 'Sommersemester 25', rolle: 'STUDENT', aufgaben: 6, mitglieder: 30 },
  { semester: 'Wintersemester 24/25', rolle: 'STUDENT', aufgaben: 5, mitglieder: 18 },
  { semester: 'Sommersemester 24', rolle: 'TUTOR', aufgaben: 4, mitglieder: 27 },
  { semester: 'Wintersemester 23/24', rolle: 'TEACHER', aufgaben: 10, mitglieder: 35 },
  { semester: 'Sommersemester 23', rolle: 'TUTOR', aufgaben: 7, mitglieder: 20 }
])
</script>

<style scoped lang="scss">
.course-overview {
  width: auto;
  margin: 0 20px 20px;
}

.breadcrumbs {
  padding-left: 0;
  margin-bottom: 8px;
}

.course-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 8px;

  &__left {
    display: flex;
    flex-direction: column;
  }

  &__actions {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-top: 4px;
  }
}

.course-title {
  font-size: 2rem;
  font-weight: 400;
  line-height: 1.2;
}

.tab-content {
  padding: 24px;
  min-height: 320px;
}

.table-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;

  &--end {
    justify-content: flex-end;
  }
}

.role-select {
  width: 110px;
}
</style>
