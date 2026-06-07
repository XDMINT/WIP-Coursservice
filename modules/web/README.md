# Web-Modul (Vue 3 + Vuetify)

Dieses Frontend dient als schlanke Ausgangsbasis fuer studentische Projekte.
Die aktuelle Variante laeuft mit lokalen Mock-Services und ohne aktives Backend,
damit Struktur und Datenfluss im Frontend schnell nachvollziehbar bleiben.

## Anforderungen

- Node.js 22
- npm
- Visual Studio Code

## Schnellstart

```sh
npm install
npm run dev
```

Der Vite-Server nutzt in diesem Projekt standardmaessig Port 8085.

## Verfuegbare Skripte

```sh
npm run dev
npm run build
npm run preview
npm run type-check
npm run lint
npm run format
```

## Architektur und Stack

Uebernommen aus den ProjektSetup-Leitideen und auf dieses Modul angepasst:

- Vue 3 als SPA-Framework
- Vuetify als UI-Komponentenbibliothek
- Vue Router fuer clientseitige Navigation
- Pinia fuer State Management
- TypeScript fuer typsichere Entwicklung
- Vite als Build-Tool und Dev-Server
- Axios als typische HTTP-Schicht fuer spaetere API-Integration

## Projektstruktur (vereinfacht)

```text
modules/web/
├── src/
│   ├── components/        # Wiederverwendbare Vue-Komponenten
│   ├── views/             # Seiten-Komponenten
│   ├── services/          # Mock-Services und spaetere API-Services
│   ├── router/            # Vue Router Konfiguration
│   ├── stores/            # Pinia Stores
│   ├── plugins/           # Vuetify/Webfont Plugin Setup
│   ├── assets/            # Styles und statische Assets
│   ├── enums/             # Enums und Konstanten
│   ├── model/             # TypeScript-Datenmodelle
│   ├── App.vue            # Root-Komponente
│   └── main.ts            # Entry Point
├── package.json
├── vite.config.ts
├── tsconfig.json
└── eslint.config.mjs
```

## Empfohlene VS-Code-Einstellungen

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

## Hinweis zur Weiterentwicklung

Die vorhandenen Mock-Services in src/services sind als Uebergangsloesung gedacht.
Beim Anbinden eines Backends koennen sie schrittweise durch echte API-Services ersetzt werden.
