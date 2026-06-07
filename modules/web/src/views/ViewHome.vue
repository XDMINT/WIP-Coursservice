<template>
  <div class="container">
    <v-card class="card">
      <v-card-title class="card-title">
        <span>Kursverwaltung als Vorlage</span>
      </v-card-title>
      <v-card-subtitle class="card-subtitle">
        <span>Subtitle.</span>
      </v-card-subtitle>
      <v-card-text class="card-text">
        <p>Hier siehst du die Kursliste, die Kursansicht, die Mitgliederverwaltung und den einfachen Login. Die Daten kommen aktuell aus lokalen Beispieldaten und sollten später durch echte Services ersetzt werden.</p>
      </v-card-text>
      <v-card-actions class="card-action">
        <v-btn to="/course"> ZU DEN KURSEN </v-btn>
      </v-card-actions>
    </v-card>

    <v-card class="card">
      <v-card-title class="card-title">
        <span>Beispieldaten</span>
      </v-card-title>
      <v-card-subtitle class="card-subtitle">
        <span>Lokale Mock-Daten statt API</span>
      </v-card-subtitle>
      <v-card-text class="card-text">
        <p>Die eingebauten Services simulieren Kurs-, Semester- und Login-Daten. Das ist absichtlich nur ein Startpunkt für studentische Projekte und soll später gegen eine echte Backend-Anbindung ausgetauscht werden.</p>
        <br />
        <v-card variant="outlined" class="newscard">
          <v-card-title class="newscard_title"> Hinweis: </v-card-title>
          <v-card-text>
            <p v-for="item in test" :key="item">
              {{ item }}
            </p>
          </v-card-text>
        </v-card>
      </v-card-text>

      <v-card-actions>
        <v-btn to="/login"> ZUM DEMO-LOGIN </v-btn>
      </v-card-actions>
    </v-card>
  </div>
</template>

<script setup lang="ts">
const test = ['Die Implementierung nutzt aktuell nur lokale Demo-Daten.', 'Ersetze die Services später durch echte API-Calls oder ein eigenes Backend.']
</script>

<style scoped lang="scss">
.container {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  row-gap: 2rem;
  column-gap: 1.5rem;
  grid-template-areas:
    'card card'
    'card card';
  padding: 2.5rem 2rem;
  background-color: rgb(var(--v-theme-primary));
}

.card {
  // fit to parent
  width: 100%;
  height: 100%;
  // center content
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.card-title {
  padding-bottom: 0;
}

.card-subtitle {
  color: rgb(var(--v-theme-primary-dark));
}

.newscard_title {
  color: rgb(var(--v-theme-primary-dark));
}
</style>
