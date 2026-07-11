<template>
  <v-parallax class="background">
    <slot />
  </v-parallax>
</template>

<style scoped lang="scss">
.background {
  height: 100vh;
  width: 100vw;
  display: flex;
  justify-content: center;
  align-items: center;

  background: rgb(var(--v-theme-background));
}
</style>
