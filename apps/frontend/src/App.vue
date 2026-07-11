<template>
  <v-app>
    <HeaderMain />

    <v-main class="bg-background">
      <BreadCrumb v-if="showBreadcrumb" :link="router.currentRoute.value.fullPath" />
      <RouterView />
    </v-main>

    <FooterMain />
  </v-app>
</template>

<script setup lang="ts">
import { RouterView, useRouter } from 'vue-router'
import { onMounted, ref, watch } from 'vue'

import BreadCrumb from '@/components/BreadCrumb.vue'
import FooterMain from '@/components/layout/FooterMain.vue'
import HeaderMain from '@/components/layout/HeaderMain.vue'

const router = useRouter()

const hideBreadcrumbIn = ['Home', 'ViewLogin', 'ViewIntroduction', 'View404Page']
const showBreadcrumb = ref(true)

watch(
  () => router.currentRoute.value.name,
  (newVal) => {
    showBreadcrumb.value = true

    hideBreadcrumbIn.forEach((route) => {
      //console.log(`if ${route} == ${newVal}`);
      if (route == newVal) {
        showBreadcrumb.value = false
      }
    })
  }
)

onMounted(() => {})
</script>

<style lang="scss">
html,
body,
#app {
  min-height: 100%;
}

body {
  margin: 0;
}

.v-application {
  background: rgb(var(--v-theme-background));
  color: rgb(var(--v-theme-on-background));
}
</style>
