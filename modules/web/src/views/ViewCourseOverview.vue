<template>
  <DialogConfirmVue ref="dialogConfirm" />
  <div class="course-overview">
    <!-- Breadcrumb -->
    <v-breadcrumbs
      class="breadcrumbs"
      :items="breadcrumbItems"
    />

    <!-- Header: Titel + Rolle-Chip + Action-Icons -->
    <div class="course-header">
      <div class="course-header__left">
        <h1 class="course-title">
          {{ courseName }}
        </h1>
        <v-chip
          class="mt-2"
          prepend-icon="mdi-account-circle"
          label
        >
          {{ currentRole }}
        </v-chip>
      </div>
      <div class="course-header__actions">
        <v-btn
          variant="text"
          color="black"
          icon
        >
          <v-icon size="x-large">
            mdi-archive
          </v-icon>
          <v-tooltip
            activator="parent"
            location="bottom"
          >
            Archivieren
          </v-tooltip>
        </v-btn>
        <v-btn
          variant="text"
          color="black"
          icon
        >
          <v-icon size="x-large">
            mdi-cog
          </v-icon>
          <v-tooltip
            activator="parent"
            location="bottom"
          >
            Kurs bearbeiten
          </v-tooltip>
        </v-btn>
        <v-btn
          variant="text"
          color="black"
          icon
        >
          <v-icon size="x-large">
            mdi-logout-variant
          </v-icon>
          <v-tooltip
            activator="parent"
            location="bottom"
          >
            Kurs verlassen
          </v-tooltip>
        </v-btn>
      </div>
    </div>

    <!-- Tab-System -->
    <v-card
      class="mt-4"
      variant="outlined"
    >
      <v-tabs
        v-model="activeTab"
        color="black"
      >
        <v-tab value="details">
          <v-icon start>
            mdi-text-box-outline
          </v-icon>
          kurs details
        </v-tab>
        <v-tab value="aufgaben">
          <v-icon start>
            mdi-pencil
          </v-icon>
          Aufgaben
        </v-tab>
        <v-tab value="mitglieder">
          <v-icon start>
            mdi-account-group
          </v-icon>
          Mitglieder
        </v-tab>
        <v-tab value="historie">
          <v-icon start>
            mdi-history
          </v-icon>
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

        <!-- Tab 2: Aufgaben (Platzhalter) -->
        <v-tabs-window-item value="aufgaben">
          <v-card-text class="tab-content">
            <v-empty-state
              icon="mdi-pencil-outline"
              title="Keine Aufgaben vorhanden"
              text="Für diesen Kurs wurden noch keine Aufgaben angelegt."
            />
          </v-card-text>
        </v-tabs-window-item>

        <!-- Tab 3: Mitglieder -->
        <v-tabs-window-item value="mitglieder">
          <v-data-table
            :headers="memberHeaders"
            :items="members"
            item-value="email"
            :items-per-page="5"
            density="default"
          >
            <!-- E-Mail als Link -->
            <template #[`item.user.email`]="{ item }">
              <a :href="`mailto:${item.user.email}`">{{ item.user.email }}</a>
            </template>

            <!-- Rolle als Select -->
            <template #[`item.role`]="{ item }">
              <v-select
                v-model="item.role"
                :items="roleOptions"
                variant="plain"
                hide-details
                class="role-select"
                :disabled="item.role === 'OWNER'"
                @update:model-value="changeRole(item)"
              />
            </template>

            <!-- Aktion: Löschen -->
            <template #[`item.actions`]="{ item }">
              <v-btn
                icon
                variant="text"
                color="black"
                size="small"
                :disabled="item.role === 'OWNER'"
                @click="kickUser(item)"
              >
                <v-icon>mdi-close-box</v-icon>
              </v-btn>
            </template>

            <!-- Rolle: Select mit changeRole-Handler -->
            <!-- Footer mit "Alle entfernen" + Pagination -->
            <template #bottom="{ pageCount, page, setPage }">
              <v-divider />
              <div class="table-footer">
                <v-btn
                  variant="outlined"
                  size="small"
                  @click="kickAllMembers"
                >
                  Alle Mitglieder entfernen
                </v-btn>
                <v-pagination
                  :model-value="page"
                  :length="pageCount"
                  :total-visible="5"
                  density="compact"
                  @update:model-value="setPage($event)"
                />
              </div>
            </template>
          </v-data-table>
        </v-tabs-window-item>

        <!-- Tab 4: Kurs Historie -->
        <v-tabs-window-item value="historie">
          <v-data-table
            :headers="historieHeaders"
            :items="courseHistory"
            item-value="semester"
            :items-per-page="5"
            density="default"
          >
            <!-- Aufgaben als Chip -->
            <template #[`item.aufgaben`]="{ item }">
              <v-chip
                label
                size="small"
              >
                {{ item.aufgaben }} Aufgaben
              </v-chip>
            </template>

            <!-- Mitglieder als Chip -->
            <template #[`item.mitglieder`]="{ item }">
              <v-chip
                label
                size="small"
              >
                {{ item.mitglieder }} Mitglieder
              </v-chip>
            </template>

            <!-- Footer mit Pagination -->
            <template #bottom="{ pageCount, page, setPage }">
              <v-divider />
              <div class="table-footer table-footer--end">
                <v-pagination
                  :model-value="page"
                  :length="pageCount"
                  :total-visible="5"
                  density="compact"
                  @update:model-value="setPage($event)"
                />
              </div>
            </template>
          </v-data-table>
        </v-tabs-window-item>
      </v-tabs-window>
    </v-card>
  </div>
  <v-snackbar
    v-model="snackbarSuccess"
    :timeout="2500"
  >
    Rolle erfolgreich geändert
  </v-snackbar>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthUserStore } from '@/stores/authUserStore'
import courseService from '@/services/course.service'
import type CoursePL from '@/model/course/CoursePL'
import type Member from '@/model/course/Member'
import DialogConfirmVue from '@/dialog/DialogConfirm.vue'

const route = useRoute()
const router = useRouter()
const authUserStore = useAuthUserStore()

// ── Seiten-Metadaten ──────────────────────────────────────────────────────────

const courseId = ref(Number(route.params.id))
const userId = ref<number | null>(authUserStore.auth.user?.id ?? null)
const course = ref<CoursePL>()
const currentRole = ref('')
const dialogConfirm = ref<typeof DialogConfirmVue>()
const snackbarSuccess = ref(false)

const courseName = computed(() => course.value?.name ?? '...')

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
  courseService.getUserRoleInCourse(userId.value, courseId.value).then((role) => {
    if (role === 'NONE') {
      router.push(route.path + '/signup')
    } else {
      currentRole.value = role.toLowerCase()
      loadCourse()
      loadMembers()
    }
  })
})

const loadCourse = () => {
  courseService.getCourse(courseId.value).then((response) => {
    course.value = response.data
  })
}

// ── Tab-Steuerung ─────────────────────────────────────────────────────────────

const activeTab = ref('details')

// ── Mitglieder-Tab ────────────────────────────────────────────────────────────

const roleOptions = ['STUDENT', 'TUTOR', 'OWNER']

const memberHeaders = [
  { title: 'Name', align: 'start' as const, key: 'user.lastName' },
  { title: 'Vorname', align: 'start' as const, key: 'user.firstName' },
  { title: 'E-Mail', align: 'start' as const, key: 'user.email' },
  { title: 'Rolle', align: 'start' as const, key: 'role', width: '160px' },
  { title: 'Aktion', align: 'center' as const, key: 'actions', sortable: false, width: '80px' }
]

const members = ref<Member[]>([])

const loadMembers = () => {
  courseService.getCourseMembers(courseId.value).then((response) => {
    members.value = response.data
  })
}

const kickUser = (member: Member) => {
  if (dialogConfirm.value) {
    dialogConfirm.value
      .openDialog(`Entferne Nutzer: ${member.user.firstName} ${member.user.lastName}`, 'Wollen Sie den Nutzer wirklich aus dem Kurs entfernen?', 'Entfernen')
      .then((result: boolean) => {
        if (result) {
          courseService.leaveCourse(courseId.value, member.user.id).then(() => loadMembers())
        }
      })
  }
}

const kickAllMembers = () => {
  if (dialogConfirm.value) {
    dialogConfirm.value
      .openDialog('Alle Mitglieder entfernen', 'Wollen Sie wirklich alle Mitglieder aus dem Kurs entfernen?', 'Entfernen')
      .then((result: boolean) => {
        if (result) {
          members.value.forEach((m) => {
            if (m.role !== 'OWNER') courseService.leaveCourse(courseId.value, m.user.id)
          })
          loadMembers()
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
    .catch(() => loadMembers())
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
  { semester: 'Sommersemester 26', rolle: 'OWNER', aufgaben: 3, mitglieder: 25 },
  { semester: 'Wintersemester 25/26', rolle: 'TUTOR', aufgaben: 8, mitglieder: 22 },
  { semester: 'Sommersemester 25', rolle: 'STUDENT', aufgaben: 6, mitglieder: 30 },
  { semester: 'Wintersemester 24/25', rolle: 'STUDENT', aufgaben: 5, mitglieder: 18 },
  { semester: 'Sommersemester 24', rolle: 'TUTOR', aufgaben: 4, mitglieder: 27 },
  { semester: 'Wintersemester 23/24', rolle: 'OWNER', aufgaben: 10, mitglieder: 35 },
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



