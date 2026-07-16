# WIP Coursservice

Dieses Repository ist eine zusammengefuehrte Monorepo-Anwendung fuer ein universitaeres Abschlussprojekt. Die aktuelle Architektur ist eine Docker-Compose-basierte, erweiterbare Servicearchitektur mit Traefik als Edge Router. Das bestehende Backend bildet den Course Service und bleibt fachlich zusammen; weitere Services werden nur bei echter fachlicher Abgrenzung ergaenzt.

## Architektur

```text
Browser
  |
  v
Traefik (:8080 auf dem Host)
  |----------------------|
  v                      v
Frontend                Backend / Course Service (/api)
                           |
                           v
                    Course PostgreSQL
```

Traefik ist der einzige oeffentlich veroeffentlichte Compose-Service. Frontend, Backend und PostgreSQL haben im produktionsnahen Compose-Betrieb keine eigenen Host-Ports.

## Technologien

- Frontend: Vue 3, Vite, TypeScript, Vuetify, Pinia, Axios, Vitest
- Backend: NestJS, TypeScript, TypeORM
- Datenbank: PostgreSQL 16
- Edge Routing: Traefik 3
- Betrieb: Docker Compose

## Struktur

```text
.
├── apps/
│   ├── frontend/          # Vue/Vite SPA
│   ├── course-service/    # NestJS Course Service
│   └── task-service/      # Mini Task Service mit eigener Aufgabenablage
├── api-contracts/         # vorhandene OpenAPI-Vertraege
├── docs/
│   ├── architecture.md
│   └── decisions/
├── compose.yaml
├── .env.example
└── README.md
```

## Konfiguration

Kopiere fuer lokale Anpassungen die Beispieldatei:

```sh
cp .env.example .env
```

Die Beispielwerte enthalten keine echten Secrets. `PUBLIC_API_BASE_URL=/api` ist oeffentlich im Browser sichtbar und kein Secret. Datenbankpasswoerter muessen fuer produktionsnahe Umgebungen geaendert und ausserhalb des Repositories verwaltet werden.

## Start mit Docker Compose

```sh
docker compose up --build
```

Oeffentliche URLs:

- Frontend: `http://127.0.0.1:8080/`
- Backend-Health: `http://127.0.0.1:8080/api/health`
- API-Basis: `http://127.0.0.1:8080/api`

Course PostgreSQL ist nur im internen Compose-Netzwerk `coursservice-course-internal` erreichbar. Das Traefik-Dashboard ist deaktiviert.

Lokale Datenbankdaten liegen im benannten Docker-Volume `wip-coursservice_course-postgres-data`. Zum Zuruecksetzen lokaler Daten:

```sh
docker compose down -v
```

## Lokale Entwicklung

Frontend:

```sh
cd apps/frontend
npm install
npm run dev
```

Der Vite-Dev-Server laeuft standardmaessig auf Port `8085` und proxyt `/api` an `http://localhost:3000`. Der Proxy-Zielhost kann mit `INTERNAL_API_PROXY_TARGET` angepasst werden.

Backend:

```sh
cd apps/course-service
npm install
npm run start:dev
```

Das Backend hoert standardmaessig auf Port `3000` und stellt seine Routen unter `/api` bereit. Fuer lokale Entwicklung benoetigt es eine PostgreSQL-Instanz und die Variablen aus `.env.example`.

## Build, Tests und Qualitaet

Frontend:

```sh
cd apps/frontend
npm run type-check
npm test
npm run lint
npm run build
```

Backend:

```sh
cd apps/course-service
npm run typecheck
npm test -- --runInBand
npm run test:e2e
npm run build
```

Compose und Docker:

```sh
docker compose config
docker compose build
docker compose up -d
docker compose ps
```

## Datenbankmigrationen

Der Course Service verwendet TypeORM-Migrationen und `synchronize: false`. Beim Compose-Start wird die Migration standardmaessig durch `DATABASE_MIGRATIONS_RUN=true` ausgefuehrt. Die aktuelle Initialmigration liegt unter `apps/course-service/src/migrations/`.

PostgreSQL nutzt in Compose das benannte Volume `course-postgres-data`.
Ein normales `docker compose restart` oder `docker compose down` mit
anschliessendem `docker compose up -d` behaelt Kurs-, Aufgaben- und
Fortschrittsdaten. Nur `docker compose down -v` entfernt das Volume und ist als
vollstaendiger lokaler Datenreset zu verstehen.

## Course-Service-Grundlage

Der Course Service stellt fuer fachliche Kurs-Features einen zentralen Kurskontext bereit:

- `GET /api/courses/:courseId/context` liefert Kurs-DTO, Rolle und Permission-Flags fuer den aktuellen Nutzer.
- Der Frontend-API-Client sendet den aktuellen Demo-Nutzer als `X-User-Id`; Backend-Berechtigungen bleiben verbindlich.
- Rollen werden fachlich als `TEACHER`, `TUTOR` und `STUDENT` gefuehrt. Der alte UI-Wert `OWNER` wird beim Mapping noch als `TEACHER` verstanden.
- Fehlerantworten enthalten ein konsistentes Format mit `statusCode`, `code`, `error`, `message`, `path` und `timestamp`.

Details stehen in [docs/course-service-api.md](/Users/timguenther/Desktop/dev/WIP-Coursservice/docs/course-service-api.md).

## Lernmaterialien

Der Course Service verwaltet Lernmaterialien innerhalb eines Kurses. Dateien
werden nicht in PostgreSQL gespeichert, sondern ueber einen lokalen
Storage-Provider in das persistente Compose-Volume `course-materials-data`
geschrieben. Downloads laufen immer ueber autorisierte Backend-Endpunkte.

Konfiguration:

- `COURSE_MATERIAL_STORAGE_PATH=/app/storage/materials` im Container
- `COURSE_MATERIAL_MAX_FILE_SIZE_BYTES=52428800` als Upload-Limit

Details stehen in [docs/learning-materials.md](/Users/timguenther/Desktop/dev/WIP-Coursservice/docs/learning-materials.md).

## Lernprozess

Der Course Service verwaltet nur die kursbezogene Aufgabenreferenz fuer den
lernfortschrittsabhaengigen Demo-Lernprozess. Aufgabeninhalte liegen im
`task-service`; Reihenfolge, Freischaltung, Arbeitsmodus, Fortschritt und
Assessments bleiben im Course Service. Aufgaben koennen sofort, automatisch
nach erfolgreicher Voraussetzung oder manuell durch Lehrende freigeschaltet
werden.

In `development`, `test` und `demo` wird ein deterministischer Demo-Kurs mit den
drei Aufgaben `Grundlagen kennenlernen`, `Grundlagen anwenden` und
`Abschlussaufgabe bearbeiten` idempotent angelegt. Der Seed kann mit
`COURSE_DEMO_SEED_DISABLED=true` deaktiviert werden.
Der Seed stellt nur fehlende Demo-Stammdaten sicher und ueberschreibt keine
bestehenden Fortschrittsdaten.

Details stehen in [docs/learning-process.md](/Users/timguenther/Desktop/dev/WIP-Coursservice/docs/learning-process.md).

## Bewertungen und Noten

Der Course Service speichert Kursergebnisse pro Kurs und studentischer
Einschreibung. Ergebnisse koennen manuell eingetragen, automatisch aus finalen
Assignment-Punkten berechnet oder bewusst manuell ueberschrieben werden.

Die zentrale Bestehensregel lautet: mehr als 50 Prozent ist bestanden, exakt
50 Prozent oder weniger ist nicht bestanden.

Details stehen in [docs/course-results.md](/Users/timguenther/Desktop/dev/WIP-Coursservice/docs/course-results.md).

## Frontend Theme

Das Vue/Vuetify-Frontend verwendet zentrale Light- und Dark-Themes und folgt
standardmaessig der Systemeinstellung des Endgeraets. Die Theme-Erkennung liegt
zentral im Frontend und reagiert auf `prefers-color-scheme`-Aenderungen zur
Laufzeit.

Details und Regeln fuer neue Komponenten stehen in
[docs/frontend-theme.md](/Users/timguenther/Desktop/dev/WIP-Coursservice/docs/frontend-theme.md).

## Traefik

Traefik uebernimmt nur technische Aufgaben am Systemrand:

- Routing von `/api` und `/api/*` zum Backend
- Routing aller anderen Pfade zum Frontend
- Access Logs
- Docker Provider mit `exposedByDefault=false`

Traefik enthaelt keine Geschaeftslogik, keine fachliche Autorisierung und keine Datenzugriffe.

## Erweiterung um weitere Services

Der aktuelle Kern bleibt in `compose.yaml`. Weitere fachlich eigenstaendige Services koennen ueber zusaetzliche Compose-Dateien ergaenzt werden:

```sh
docker compose -f compose.yaml -f compose.group-task.yaml up --build
```

Dabei gilt:

- Der neue Service haengt am gemeinsamen `coursservice-proxy-network`.
- Er bekommt ein eigenes internes Netzwerk und eine eigene Datenhaltung.
- Seine Datenbank veroeffentlicht keinen Host-Port.
- Interne Servicekommunikation laeuft direkt ueber Docker-DNS, zum Beispiel `http://course-service:3000` und `http://task-service:3000`.
- Gleiche interne Container-Ports sind erlaubt, weil Docker-Service-Namen die Adressierung trennen.

Ein kompatibles Beispiel steht in [docs/service-integration.md](/Users/timguenther/Desktop/dev/WIP-Coursservice/docs/service-integration.md).

## Hinweise

- Das Backend ist der aktuelle Course Service und bleibt zusammen: ein Prozess, ein Image, eine Course-Datenbank.
- Der ehemalige Dagu/Workflow-Service und Kubernetes-/Helm-Konfigurationen wurden entfernt, weil sie im aktuellen Projekt nicht referenziert und fuer den Ein-Personen-Betrieb nicht angemessen waren.
- Einige tiefere historische Kurs-Controller-Routen enthalten noch doppelte Pfadsegmente wie `/api/courses/courses/...`. Diese wurden nicht in diesem Umbau geaendert, um keine fachlichen API-Pfade ohne weitergehende Abstimmung zu brechen.
