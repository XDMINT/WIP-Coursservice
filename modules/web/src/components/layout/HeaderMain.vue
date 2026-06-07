<template>
  <v-app-bar v-if="$router.currentRoute.value.name != 'ViewLogin' && pageSettingsStore.showHeader == true" :elevation="1">
    <v-app-bar-nav-icon @click.stop="showSideBar = !showSideBar" />
    <v-toolbar-title>
      <router-link to="/">
        <IconFBS class="icon" />
      </router-link>
    </v-toolbar-title>
    <v-spacer />
    <v-btn v-if="isLoggedIn" to="/profile" variant="text" prepend-icon="mdi-account"> Profil </v-btn>
    <v-btn v-if="isLoggedIn" variant="text" prepend-icon="mdi-logout" @click="logout"> Abmelden </v-btn>
  </v-app-bar>

  <v-navigation-drawer v-if="$router.currentRoute.value.name != 'ViewLogin' && pageSettingsStore.showHeader == true" v-model="showSideBar" width="220" expand-on-hover rail>
    <v-list density="compact" active-class="active" nav>
      <v-list-item to="/" active-class="active" prepend-icon="mdi-human-greeting" title="Willkommen" value="introduction" />
      <v-list-item to="/home" active-class="active" prepend-icon="mdi-home-variant" title="Startseite" value="home" />
      <v-list-item to="/course" active-class="active" prepend-icon="mdi-file-multiple" title="Alle Kurse" value="course" />
      <v-list-item v-if="isLoggedIn" to="/profile" active-class="active" prepend-icon="mdi-account" title="Profil" value="profile" />
    </v-list>
  </v-navigation-drawer>

  <v-app-bar v-if="$router.currentRoute.value.name != 'ViewLogin' && pageSettingsStore.showHeader == false" :elevation="1">
    <v-app-bar-title>
      <router-link to="/">
        <IconFBS class="icon" />
      </router-link>
    </v-app-bar-title>

    <template #append>
      <v-btn to="/course" active-class="active" prepend-icon="mdi-file-multiple">
        <span v-if="!smAndDown"> Alle Kurse </span>
        <v-tooltip v-if="smAndDown" activator="parent" location="bottom"> Alle Kurse </v-tooltip>
      </v-btn>
      <v-btn v-if="isLoggedIn" to="/profile" active-class="active" prepend-icon="mdi-account">
        <span v-if="!smAndDown"> Profil </span>
        <v-tooltip v-if="smAndDown" activator="parent" location="bottom"> Profil </v-tooltip>
      </v-btn>
      <v-btn v-if="isLoggedIn" icon @click="pageSettingsStore.showHeader = !pageSettingsStore.showHeader">
        <v-icon>{{ pageSettingsStore.showHeader ? 'mdi-eye-off' : 'mdi-eye' }}</v-icon>
        <v-tooltip activator="parent" location="bottom"> Toggle Bar </v-tooltip>
      </v-btn>
      <v-btn v-if="isLoggedIn" icon @click="logout">
        <v-icon>mdi-logout</v-icon>
        <v-tooltip activator="parent" location="bottom"> Abmelden </v-tooltip>
      </v-btn>
    </template>
  </v-app-bar>
</template>

<script setup lang="ts">
import IconFBS from '@/components/icons/IconFBS.vue'

import { usePageSettingsStore } from '@/stores/pageSettingsStore'
import { useAuthUserStore } from '@/stores/authUserStore'

import { RouterLink } from 'vue-router'
import { computed, ref } from 'vue'
import { useDisplay } from 'vuetify'
import { useRouter } from 'vue-router'

const { smAndDown } = useDisplay()

const showSideBar = ref(true)
const router = useRouter()
const authUserStore = useAuthUserStore()
const isLoggedIn = computed(() => authUserStore.isLoggedIn)

const pageSettingsStore = usePageSettingsStore()

const logout = () => {
  authUserStore.logout().then(() => {
    router.push('/login')
  })
}
</script>

<style scoped lang="scss">
.icon {
  height: 35px;
  width: auto;
  margin-right: 20px;
}
</style>
