<template>
  <div class="container">
    <v-card class="card" variant="outlined">
      <v-card-item>
        <v-card-title>Für den Kurs {{ course?.name }} einschreiben</v-card-title>

        <v-card-subtitle>
          Semester: {{ course?.semester.name }} <br />
          Standort: {{ course?.location }}
        </v-card-subtitle>
        <v-alert v-if="errorMessage" class="mt-4" type="error" variant="tonal" density="comfortable">
          {{ errorMessage }}
        </v-alert>
      </v-card-item>

      <v-text-field v-if="course?.requiresEnrollmentKey" v-model="key" label="Einschreibeschlüssel" class="textfield" variant="solo" />
      <v-card-actions>
        <v-btn class="button mb-3" color="warning" :loading="signingUp" @click="signup"> Einschreiben </v-btn>
      </v-card-actions>
    </v-card>
  </div>
  <v-snackbar v-model="snackbarSuccess" :timeout="2500"> Einschreibung erfolgreich </v-snackbar>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthUserStore } from '../stores/authUserStore'
import type CoursePL from '../model/course/CoursePL'
import courseService from '../services/course.service'
import { getApiErrorMessage, normalizeApiError } from '@/services/apiErrors'

const route = useRoute()
const router = useRouter()
const authUserStore = useAuthUserStore()
const course = ref<CoursePL>()
const key = ref('')
const courseId = ref(String(route.params.id))
const snackbarSuccess = ref(false)
const errorMessage = ref('')
const signingUp = ref(false)

onMounted(() => {
  courseService
    .getCourse(courseId.value)
    .then((response) => {
      course.value = response.data
    })
    .catch((error) => {
      errorMessage.value = getApiErrorMessage(error)
    })
})

const signup = () => {
  if (authUserStore.auth.user?.id == null) {
    router.push('/login')
    return
  }

  signingUp.value = true
  errorMessage.value = ''

  courseService
    .enrollCourse(courseId.value, key.value)
    .then(() => {
      snackbarSuccess.value = true
      router.push('/course/' + courseId.value)
    })
    .catch((error) => {
      const apiError = normalizeApiError(error)
      errorMessage.value = apiError.kind === 'forbidden' ? 'Einschreibung nicht möglich. Prüfen Sie den Einschreibeschlüssel oder den Kursstatus.' : getApiErrorMessage(apiError)
    })
    .finally(() => {
      signingUp.value = false
    })
}
</script>

<style scoped lang="scss">
.card {
  max-width: 600px;
}

.button {
  margin-left: 36%;
}

.textfield {
  margin-left: 40px;
  margin-right: 40px;
}

.container {
  position: relative;
  left: 32%;
  top: 30%;
}
</style>
