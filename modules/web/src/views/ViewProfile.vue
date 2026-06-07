<template>
  <div class="profile">
    <v-card>
      <v-card-title>Profil</v-card-title>
      <v-card-text>
        <p>LogInStatus: {{ status }}</p>
        <p>Benutzername: {{ firstName }}</p>
        <p>Email: {{ email }}</p>
        <p>Rollen: {{ role }}</p>
        <v-alert class="mt-4" type="info" variant="tonal" density="comfortable"> Das Profil wird aktuell aus dem lokalen Demo-Login gespeist. </v-alert>
      </v-card-text>
    </v-card>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useAuthUserStore } from '../stores/authUserStore'

const authUserStore = useAuthUserStore()
const userInformation = authUserStore.user

const status = ref(authUserStore.isLoggedIn)
const firstName = ref(userInformation?.username)
const email = ref(userInformation?.email)
const role = ref(userInformation?.roles)
</script>
