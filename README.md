# VueWebTemplate

Dieses Repository stellt eine reduzierte Projektvorlage auf Basis von Vue 3 und Vuetify bereit.
Der Fokus liegt auf einem gut verständlichen Frontend-Startpunkt mit lokaler Mock-Datenbasis,
damit Funktionen schrittweise durch echte API-Aufrufe ersetzt werden koennen.

## Projektueberblick

- Frontend: Vue 3 + TypeScript + Vuetify
- Build und Dev-Server: Vite
- State Management: Pinia
- Routing: Vue Router
- Datenzugriff im Template: lokale Mock-Services in src/services

## Anforderungen

- Visual Studio Code
- Node.js 22 (empfohlen: aktueller 22.x-Stand)
- npm
- Git

## Empfohlene VS-Code-Erweiterungen

- Vue - Official
- ESLint
- Prettier
- Vite
- Path Intellisense

## Empfohlene VS-Code-Einstellungen

Die folgenden Einstellungen sind eine auf dieses Repository angepasste Uebernahme
der ProjektSetup-Empfehlungen:

```json
{
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit"
  },
  "files.autoSave": "afterDelay",
  "typescript.updateImportsOnFileMove.enabled": "always",
  "[vue]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[typescript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[javascript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[json]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[jsonc]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[html]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  }
}
```

## Einstieg

1. In das Web-Modul wechseln:

   ```sh
   cd modules/web
   ```

2. Abhaengigkeiten installieren:

   ```sh
   npm install
   ```

3. Entwicklungsserver starten:

   ```sh
   npm run dev
   ```

Weitere Details zu Skripten, Struktur und Entwicklungsablauf stehen in modules/web/README.md.
