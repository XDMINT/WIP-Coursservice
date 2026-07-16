# Architektur

## Ausgangslage

Das Repository wurde aus einem Frontend- und einem Backend-Repository zusammengefuehrt. Das Backend enthielt Spuren einer frueheren Kubernetes-/Microservice-Architektur mit Traefik, Helm-Werten, Dagu-Workflow-Service und separaten Service-Namen.

## Ziel

Die Anwendung ist eine Docker-Compose-basierte, erweiterbare Servicearchitektur mit Traefik als Edge Router und Database-per-Service-Ansatz. Der aktuelle Kern besteht aus vier deploybaren Compose-Komponenten:

```text
traefik
frontend
course-service
task-service
course-db
```

Der Course Service bildet die kursbezogene Fachdomaene. Der separate `task-service`
ist bewusst klein; er verwaltet Aufgabeninhalte in einer eigenen Dateiablage und
uebernimmt die deterministische Mock-Auswertung automatischer Demo-Aufgaben.
Weitere fachlich eigenstaendige
Services koennen spaeter ueber zusaetzliche Compose-Dateien ergaenzt werden, wenn
ihr fachlicher und betrieblicher Nutzen belegt ist.

## Request-Fluss

```text
Browser -> Traefik -> Frontend
Browser -> Traefik -> Course Service -> Course PostgreSQL
Course Service -> Task Service -> Task-Service-Volume
```

Traefik routet `/api` und `/api/*` an den Course Service. Alle anderen Pfade werden an das Frontend weitergeleitet. Es wird kein `StripPrefix` verwendet, weil das Backend selbst den globalen Prefix `/api` setzt.

Fuer spaetere Services sind eigene externe Pfade vorgesehen, zum Beispiel `/api/groups` oder `/api/tasks`. Traefik bleibt dabei ein externer Edge Router und wird nicht zum verpflichtenden Vermittler interner Servicekommunikation.

## Komponenten

- Frontend: Vue/Vite-SPA, statisch durch Nginx im Container ausgeliefert.
- Course Service: NestJS-Anwendung mit TypeORM, globalem `/api`-Prefix, Health-Endpunkt und zentraler Fehlerantwort.
- Task Service: kleiner Node-Service fuer Aufgabeninhalte, CRUD-Endpunkte, `POST /api/tasks/evaluate` und `GET /api/health`.
- Course PostgreSQL: relationale Datenbank des Course Service mit eigenem Volume und `pg_isready`-Healthcheck.
- Traefik: technischer Edge Router mit Docker Provider, `exposedByDefault=false`
  und JSON-Access-Logs ohne Header.

## Netzwerke

```text
proxy-network:
  traefik
  frontend
  course-service

course-internal:
  course-service
  task-service
  course-db
```

`course-internal` ist als internes Docker-Netzwerk definiert. Course PostgreSQL
und Task Service sind nicht im Proxy-Netzwerk und veroeffentlichen keinen
Host-Port. Frontend und Course Service veroeffentlichen ebenfalls keine
Host-Ports; nur Traefik veroeffentlicht `8080:80`.

Der Course Service besitzt fuer Lernmaterial-Dateien zusaetzlich das persistente
Volume `course-materials-data`. Der Task Service besitzt mit
`task-service-data` ein eigenes Volume fuer seine Aufgabenablage. Beide Volumes
werden nicht oeffentlich exponiert.

Interne synchrone Kommunikation zwischen spaeteren Services soll direkt ueber Docker-DNS erfolgen, zum Beispiel `http://group-task-service:8080` oder `http://course-service:3000`. Sie soll nicht unnoetig ueber Traefik laufen.

## Course-Service-Struktur

Der fachliche Schwerpunkt ist Kursverwaltung. Der Course Service nutzt NestJS-
Module und kapselt die interne Fachlogik in kleinere Provider:

```text
apps/course-service/src/
├── app.module.ts
├── courses.module.ts
├── courses.controller.ts
├── courses.service.ts
├── domain/
├── courses.permissions.ts
├── dto/
├── entities/
├── migrations/
├── config/
└── common/
```

`courses.service.ts` bleibt als Fassade fuer bestehende Controller- und Testschnittstellen bestehen. Fachlich abgegrenzte Unterbereiche liegen unter `domain/`.

Der lernfortschrittsabhaengige Lernprozess nutzt im Course Service nur noch
kursbezogene Task-Referenzen, `TaskProgress` und `TaskAssessment`. Vollstaendige
Aufgabeninhalte liegen im Task Service und werden ueber `TaskServiceClient`
geladen. Der Course Service kombiniert diese Inhalte mit Kursdurchlauf,
Inhaltsversion, Freischaltregeln, Fortschritt und Bewertung im Kurskontext.

Die einfache Gruppenarbeit der Mini-Version liegt ebenfalls bewusst im Course
Service. Gruppen sind CourseRun-bezogen, werden von Lehrenden/Admins verwaltet
und nutzen das bestehende `TaskAssessment`-Modell mit Zieltyp `GROUP` statt
eines zweiten Bewertungssystems. Neue CourseRuns uebernehmen Aufgabenregeln
inklusive `workMode`, aber keine Gruppen, Gruppenmitglieder,
Gruppenfortschritte oder Gruppenbewertungen.

## Kurskontext und Berechtigungen

Fachliche Kurs-Features sollen den zentralen Kurskontext verwenden:

```text
Frontend -> GET /api/courses/:courseId/context -> Course Service
```

Der Kontext enthaelt das Kurs-DTO, die Rolle des aktuellen Nutzers und berechnete Permission-Flags. Rollenpruefungen sind im Backend in `courses.permissions.ts` zentralisiert; Controller und UI-Komponenten sollen keine fachlichen Magic Strings als Sicherheitsgrenze verwenden. Das Frontend nutzt Permission-Flags fuer Darstellung und Interaktion, aber alle geschuetzten Operationen werden weiterhin im Course Service geprueft.

Die aktuell verbindlichen Rollen sind `TEACHER`, `TUTOR` und `STUDENT`. Fuer alte Frontend-Daten wird `OWNER` beim Mapping als `TEACHER` verstanden.

## Datenbank

Der Course Service kontrolliert seine eigene PostgreSQL-Instanz. TypeORM laeuft mit `synchronize: false`; die Initialmigration erzeugt das Kursschema reproduzierbar. Weitere Migrationen ergaenzen Audit-Felder fuer Kurse und Einschreibungen sowie die Metadaten fuer Lernmaterialien. Migrationen werden im Compose-Betrieb standardmaessig beim Backend-Start ausgefuehrt.

Demo-Daten fuer den Lernprozess werden nicht in produktiven Migrationen
angelegt. `CourseDemoSeedService` erzeugt sie nur in `development`, `test` oder
`demo` und arbeitet idempotent ueber stabile Demo-Schluessel.

Grosse Binaerdaten fuer Lernmaterialien werden nicht in PostgreSQL gespeichert.
PostgreSQL enthaelt nur Metadaten wie Materialtyp, Dateiname, MIME-Type,
Dateigroesse, Tags, Sortierung und Veroeffentlichungsstatus.

Ein spaeterer eigenstaendiger Service darf eine eigene PostgreSQL-Instanz, eigene Migrationen, eigene Zugangsdaten, ein eigenes Volume und ein eigenes internes Netzwerk besitzen. Kein Service darf direkt auf die Datenbank, Tabellen oder Repositories eines anderen Services zugreifen. Serviceuebergreifender Datenaustausch erfolgt ueber dokumentierte APIs oder bei spaeter begruendetem Bedarf ueber Events.

## Logging und Audit

Die Mini-Version nutzt keine externe zentrale Logging-Infrastruktur. Technische
Backend-Logs und Request-Logs werden strukturiert ueber stdout/stderr
ausgegeben und koennen mit `docker compose logs course-service` gelesen werden. Jeder
API-Request erhaelt eine `X-Request-ID`, die in Request-Logs, Fehlerlogs und
Audit-Events verwendet wird.

Fachliche Audit-Events werden persistent in PostgreSQL in `audit_events`
gespeichert. Sie dokumentieren erfolgreiche Aenderungen an Kursen,
Durchlaeufen, Inhaltsversionen, Materialien, Aufgaben, Einschreibungen,
Lernfortschritt und Bewertungen. Lehrende mit Kursverwaltungsrecht koennen die
letzten Ereignisse ueber die Audit-Ansicht im Kurs einsehen; Studierende sehen
diese Ansicht nicht. Details stehen in `docs/logging-audit.md`.

## Sicherheit und Konfiguration

Secrets stehen nicht im Repository. `.env.example` dokumentiert nur Platzhalter. PostgreSQL veroeffentlicht keinen Host-Port. Frontend und Backend veroeffentlichen ebenfalls keine Host-Ports. Das Traefik-Dashboard ist deaktiviert.

Optionale Integrationen duerfen den Start des Course Service nicht verhindern, solange der fremde Service nicht eingebunden ist. Service-URLs muessen ueber Umgebungsvariablen konfigurierbar sein und duerfen nicht fest im Anwendungscode stehen.

## Entfernte Altlasten

Entfernt wurden:

- alter `docker-compose.yml` mit MySQL, Dagu und ungeschuetztem Dashboard
- Dagu/Workflow-Service und zugehoerige Workflows
- Helm-`values.yaml` und Kubernetes-Service-DNS-Werte
- altes Kursduplikat unter `courses/`
- kaputte Dockerfiles mit `services/...`-Pfaden
- IDE- und temporaere Dateien

## Qualitaetssicherung

Ausgefuehrte Pruefungen:

- Backend TypeScript-Typecheck, Unit-Test, application-level Smoke-Test, Build
- Frontend Typecheck, Vitest, Lint, Build
- `docker compose config`
- `docker compose build`
- `docker compose up -d`
- HTTP-Smoke ueber Traefik fuer `/`, direkte Frontend-Route und `/api/health`
- API-Schreib- und Leseanfrage ueber Traefik bis PostgreSQL

Bekannte Risiken:

- Frontend-Lint meldet bestehende Vue-Style-Warnungen, aber keine Fehler.
- npm audit meldet transitive Verwundbarkeiten in Frontend- und Backend-Abhaengigkeiten.
- Einige historische Controller-Pfade enthalten doppelte Segmente wie `/api/courses/courses/...`.
