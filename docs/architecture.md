# Architektur

## Ausgangslage

Das Repository wurde aus einem Frontend- und einem Backend-Repository zusammengefuehrt. Das Backend enthielt Spuren einer frueheren Kubernetes-/Microservice-Architektur mit Traefik, Helm-Werten, Dagu-Workflow-Service und separaten Service-Namen. Fuer das aktuelle Abschlussprojekt ist diese Betriebsform zu komplex.

## Ziel

Die Anwendung ist eine Docker-Compose-basierte, erweiterbare Servicearchitektur mit Traefik als Edge Router und Database-per-Service-Ansatz. Der aktuelle Kern besteht aus vier deploybaren Compose-Komponenten:

```text
traefik
frontend
backend
course-postgres
```

Das Backend bildet aktuell den Course Service und bleibt fachlich zusammen. Es wird nicht kuenstlich in weitere Services zerlegt. Weitere fachlich eigenstaendige Services koennen spaeter ueber zusaetzliche Compose-Dateien ergaenzt werden, wenn ihr fachlicher und betrieblicher Nutzen belegt ist.

## Request-Fluss

```text
Browser -> Traefik -> Frontend
Browser -> Traefik -> Backend/Course Service -> Course PostgreSQL
```

Traefik routet `/api` und `/api/*` an den Course Service. Alle anderen Pfade werden an das Frontend weitergeleitet. Es wird kein `StripPrefix` verwendet, weil das Backend selbst den globalen Prefix `/api` setzt.

Fuer spaetere Services sind eigene externe Pfade vorgesehen, zum Beispiel `/api/groups` oder `/api/tasks`. Traefik bleibt dabei ein externer Edge Router und wird nicht zum verpflichtenden Vermittler interner Servicekommunikation.

## Komponenten

- Frontend: Vue/Vite-SPA, statisch durch Nginx im Container ausgeliefert.
- Backend: aktueller Course Service als NestJS-Anwendung mit TypeORM, globalem `/api`-Prefix, Health-Endpunkt und zentraler Fehlerantwort.
- Course PostgreSQL: relationale Datenbank des Course Service mit eigenem Volume und `pg_isready`-Healthcheck.
- Traefik: technischer Edge Router mit Docker Provider und `exposedByDefault=false`.

## Netzwerke

```text
proxy-network:
  traefik
  frontend
  backend

course-internal:
  backend
  course-postgres
```

`course-internal` ist als internes Docker-Netzwerk definiert. Course PostgreSQL ist nicht im Proxy-Netzwerk und veroeffentlicht keinen Host-Port. Frontend und Backend veroeffentlichen ebenfalls keine Host-Ports; nur Traefik veroeffentlicht `8080:80`.

Das Backend besitzt fuer Lernmaterial-Dateien zusaetzlich das persistente Volume
`course-materials-data`. Dieses Volume ist kein eigener Service und wird nicht
oeffentlich exponiert; Dateidownloads laufen ueber autorisierte Course-Service-
Endpunkte.

Interne synchrone Kommunikation zwischen spaeteren Services soll direkt ueber Docker-DNS erfolgen, zum Beispiel `http://group-task-service:8080` oder `http://backend:3000`. Sie soll nicht unnoetig ueber Traefik laufen.

## Backend-Struktur

Der vorhandene fachliche Schwerpunkt ist Kursverwaltung. Die aktuelle Struktur vermeidet zusaetzliche Microservices und nutzt NestJS-Module:

```text
apps/backend/src/
├── app.module.ts
├── courses.module.ts
├── courses.controller.ts
├── courses.service.ts
├── courses.permissions.ts
├── dto/
├── entities/
├── migrations/
├── config/
└── common/
```

Die groesste verbleibende Codequalitaetsgrenze ist `courses.service.ts`, der viele fachliche Unterbereiche enthaelt. Diese Unterbereiche sollten spaeter innerhalb desselben Backend-Prozesses in kleinere NestJS-Provider aufgeteilt werden, ohne Netzwerkkommunikation einzufuehren.

Der lernfortschrittsabhaengige Lernprozess nutzt die vorhandenen
`Task`- und `TaskProgress`-Tabellen im Course Service. Weil der frueher geplante
Group/Task Service aktuell nicht verfuegbar ist, stellt der Course Service fuer
das Mini-Projekt eine kleine, klar abgegrenzte Aufgabenrepraesentation bereit.
Ein spaeterer externer Task Service wuerde Ergebnisse ueber eine dokumentierte
API melden; der Course Service bleibt fuer Fortschritt und Freischaltregeln
verantwortlich.

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
