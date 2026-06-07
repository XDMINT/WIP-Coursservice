<template>
  <BasicBackground>
    <v-card class="card">
      <v-card-title class="title">
        <span>Kurs-Template</span>

        <!-- <span> <IconEWiLL /> </span> -->
      </v-card-title>
      <v-card-text class="text"> Dieses Projekt ist als Ausgangslage für studentische Folgeprojekte gedacht. Es zeigt die Kursverwaltung mit lokalen Beispiel-Daten und bewusst einfachen Services. </v-card-text>
      <v-card-actions>
        <v-spacer>
          <v-btn variant="flat" color="primary-dark" to="/course"> Zu den Kursen </v-btn>
        </v-spacer>
      </v-card-actions>
    </v-card>
  </BasicBackground>
</template>

<script setup lang="ts">
import BasicBackground from '@/components/BasicBackground.vue'
</script>

<style scoped lang="scss">
.card {
  width: 700px;
  margin: auto;
  padding: 20px;
  text-align: center;
}

.title {
  font-size: xx-large;
  display: grid;
  grid-gap: 10px;
  grid-template-columns: repeat(1, 1fr);
  align-items: center;
  justify-items: stretch;
  margin-bottom: 15px;
}

.text {
  font-size: large;
  display: grid;
  grid-gap: 20px;
  grid-template-columns: repeat(1, 1fr);
  align-items: center;
  justify-items: stretch;
}
</style>
