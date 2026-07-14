# Learning Process

Der lernfortschrittsabhaengige Lernprozess ist im bestehenden Course Service
implementiert. Es gibt keinen separaten Task Service, keinen neuen Container und
keinen direkten Zugriff auf Datenbanken anderer Services.

## Datenmodell

`Task` repraesentiert einen Lernschritt im Kurs:

- `id`
- `courseId`
- `courseRunId`
- `courseVersionId`
- `title`
- `description`
- `type`
- `order`
- `unlockMode`
- `workMode`
- `prerequisiteTaskId`
- `completionCriteria`
- `gradingMode`
- `maxPoints`
- `passThreshold`
- `feedbackRequired`
- `allowRetries`
- `isPublished`
- `demoKey` fuer deterministische Demo-Daten
- `createdBy`, `updatedBy`, `createdAt`, `updatedAt`

`TaskProgress` repraesentiert den individuellen Fortschritt eines
Studierenden:

- `studentId` indirekt ueber `Enrollment`
- `taskId`
- `status`
- `completionPercentage`
- `unlockedAt`
- `startedAt`
- `completedAt`
- `resultPassed`
- `resultRecordedAt`
- `unlockSource`

Pro Kombination aus Aufgabe und Einschreibung ist nur ein Fortschrittsdatensatz
zulaessig.

`workMode` unterscheidet `INDIVIDUAL` und `GROUP`. Einzelaufgaben werden pro
Studierendem bearbeitet und bewertet. Gruppenaufgaben werden durch die Gruppe
bearbeitet; Fortschritt und Bewertung werden anschliessend auf die individuellen
Lernpfade der aktuellen Gruppenmitglieder gespiegelt.

`TaskAssessment` repraesentiert die fachliche Bewertung einer Aufgabe in einem
konkreten Kursdurchlauf:

- `courseRunId`
- `courseVersionId`
- `taskId`
- `assessmentTargetType`
- `studentId` bei `INDIVIDUAL`
- `groupId` bei `GROUP`
- `gradingMode`
- `status`
- `points`
- `maxPoints`
- `passThreshold`
- `passed`
- `feedback`
- `submissionData`
- `assessedBy`
- `assessedAt`
- `createdAt`, `updatedAt`

Pro Kombination aus Kursdurchlauf, Aufgabe und Bewertungsziel gibt es maximal
eine Aufgabenbewertung. Neue Kursdurchlaeufe kopieren Aufgaben,
Freischaltregeln und Bewertungsregeln, aber keine Fortschritte, Abgaben oder
Bewertungen.

`CourseGroup`, `GroupMembership` und `GroupTaskProgress` bilden die einfache
Gruppenfunktion der Mini-Version ab. Gruppen gehoeren genau zu einem
`CourseRun`; Studierende koennen pro CourseRun nur einer Gruppe angehoeren.
Gruppen, Gruppenmitglieder, Gruppenfortschritte und Gruppenbewertungen werden
nicht in neue CourseRuns kopiert.

## Statuswerte

- `LOCKED`: Die Aufgabe ist noch nicht verfuegbar.
- `AVAILABLE`: Die Aufgabe ist verfuegbar und kann begonnen werden.
- `IN_PROGRESS`: Der Studierende hat die Aufgabe begonnen.
- `SUBMITTED`: Eine bewertete Aufgabe wurde abgegeben und wartet auf
  Bewertung.
- `COMPLETED`: Die Aufgabe wurde erfolgreich abgeschlossen.
- `FAILED`: Die Aufgabe wurde nicht erfolgreich abgeschlossen.

Eine Aufgabe ist nie gleichzeitig abgeschlossen und gesperrt. Der
Fortschrittsstatus beschreibt den Lernfluss, nicht automatisch das fachliche
Bestehen. Fuer bewertete Aufgaben entscheidet `TaskAssessment.passed`, ob
automatische Folgeschritte freigeschaltet werden.

## Bewertungsmodi

- `NOT_GRADED`: Die Aufgabe ist nicht bewertet. Studierende markieren sie als
  erledigt; es entsteht keine fachliche Bestehensbewertung.
- `SELF_CONFIRMATION`: Studierende bestaetigen selbst, dass sie die Aufgabe
  erledigt haben. Diese Bestaetigung erzeugt eine bestandene
  Aufgabenbewertung, ist aber keine Lehrendenbewertung.
- `MANUAL`: Studierende geben die Aufgabe ab. Lehrende bewerten sie
  anschliessend manuell als bestanden oder nicht bestanden und koennen Punkte
  sowie Feedback erfassen.
- `AUTOMATIC_MOCK`: Studierende simulieren eine Abgabe. Der Course Service ruft
  einen Mock-Evaluator ueber die `TaskEvaluationProvider`-Schnittstelle auf.

Die Aufgaben-Bestehensregel ist zentral in
`apps/backend/src/task-assessment.rules.ts` abgelegt. Standardmaessig gilt:
50 Prozent oder mehr der maximalen Punkte bestehen die Aufgabe. Im aktuellen
Mini-Projekt ist diese Aufgabenbewertung die zentrale aktive Bewertungsquelle.
Ein spaeteres Kursergebnis muesste als eigene Aggregation aus
`TaskAssessment`-Daten modelliert werden.

Der Mock-Evaluator ist in `apps/backend/src/task-evaluation.provider.ts`
gekapselt. Dadurch kann spaeter ein echter Aufgabenservice oder Object-/Code-
Evaluator angebunden werden, ohne die Fortschritts- und Freischaltlogik im
Course Service zu duplizieren.

## Freischaltmodi

- `IMMEDIATE`: Die Aufgabe ist fuer eingeschriebene Studierende sofort
  verfuegbar.
- `AUTOMATIC`: Die Aufgabe wird automatisch verfuegbar, wenn die definierte
  Voraussetzung erfolgreich abgeschlossen wurde.
- `MANUAL`: Die Aufgabe bleibt gesperrt, bis eine Lehrperson sie fuer einen
  Studierenden freischaltet.

Jede Aufgabe kann aktuell maximal eine direkte Voraussetzung haben. Der Course
Service verhindert Selbstreferenzen, Voraussetzungen aus anderen Kursen und
zyklische Abhaengigkeiten.

## Berechtigungen

Lehrende und Tutorinnen mit `course.content.manage` duerfen Aufgaben
konfigurieren, Reihenfolgen aendern, Voraussetzungen setzen und manuell
freischalten. Rollen mit `course.results.all.read` sehen die
Fortschrittsuebersicht aller Studierenden.

Studierende duerfen die Aufgaben ihres belegten Kurses und den eigenen
Fortschritt sehen. Sie duerfen verfuegbare Aufgaben beginnen, unbewertete
Aufgaben als erledigt markieren, Selbstbestaetigungen ausloesen, manuelle
Aufgaben abgeben und Demo-Abgaben fuer `AUTOMATIC_MOCK` simulieren. Sie duerfen
keine Aufgabe direkt als bestanden oder nicht bestanden setzen.
Bei Gruppenaufgaben duerfen Studierende nur fuer ihre eigene Gruppe starten
oder abgeben. Studierende ohne Gruppe sehen den Hinweis, dass sie sich an die
Lehrperson wenden sollen. Gruppenbewertungen setzen ausschliesslich
Lehrende/Admins.
Gesperrte Aufgaben, Aufgaben anderer Kurse und Fortschritte anderer
Studierender koennen sie nicht veraendern.

Nicht eingeschriebene Nutzer erhalten keinen Zugriff auf kursinterne Aufgaben
oder Fortschrittsdaten.

## API

Alle Pfade liegen unter `/api`.

- `GET /courses/:courseId/tasks`
- `GET /courses/:courseId/tasks/my-progress`
- `GET /courses/:courseId/tasks/progress-overview`
- `GET /courses/:courseId/tasks/progress/:studentId`
- `POST /courses/:courseId/tasks`
- `PUT /courses/:courseId/tasks/sort-order`
- `GET /courses/tasks/:id`
- `PUT /courses/tasks/:id`
- `PUT /courses/tasks/:id/release-config`
- `DELETE /courses/tasks/:id`
- `POST /courses/tasks/:id/publish`
- `POST /courses/tasks/:id/unpublish`
- `POST /courses/tasks/:id/start`
- `POST /courses/tasks/:id/complete`
- `POST /courses/tasks/:id/fail`
- `POST /courses/tasks/:id/self-confirm`
- `POST /courses/tasks/:id/submit`
- `POST /courses/tasks/:id/mock-evaluate`
- `POST /courses/tasks/:id/manual-unlock`
- `POST /courses/tasks/:id/group/start`
- `POST /courses/tasks/:id/group/submit`
- `GET /courses/:courseId/runs/:runId/assessments`
- `GET /courses/:courseId/runs/:runId/tasks/:taskId/assessments`
- `POST /courses/:courseId/runs/:runId/tasks/:taskId/assessments/:studentId/manual`
- `POST /courses/:courseId/runs/:runId/tasks/:taskId/assessments/:studentId/reset`
- `GET /courses/:courseId/runs/:runId/groups`
- `POST /courses/:courseId/runs/:runId/groups`
- `GET /courses/:courseId/runs/:runId/groups/my`
- `PUT /courses/:courseId/runs/:runId/groups/:groupId`
- `DELETE /courses/:courseId/runs/:runId/groups/:groupId`
- `POST /courses/:courseId/runs/:runId/groups/:groupId/members`
- `DELETE /courses/:courseId/runs/:runId/groups/:groupId/members/:studentId`
- `PUT /courses/:courseId/runs/:runId/tasks/:taskId/groups/:groupId/manual-assessment`

Controller delegieren Freischalt- und Abschlusslogik an den Course Service. Die
API gibt DTOs aus, keine TypeORM-Entitaeten.

Die alten `complete`- und `fail`-Routen bleiben aus Kompatibilitaetsgruenden
vorhanden. `complete` delegiert fachlich auf Selbstbestaetigung, `fail` ist nur
noch fuer Rollen mit Verwaltungsrecht erlaubt. Neue Frontend-Flows verwenden
die expliziten Routen `self-confirm`, `submit` und `mock-evaluate`.

## Demo-Daten

In `APP_ENV=development`, `APP_ENV=test` oder `APP_ENV=demo` legt
`CourseDemoSeedService` idempotent einen Demo-Kurs an, sofern
`COURSE_DEMO_SEED_DISABLED` nicht aktiviert ist.

Demo-Kurs:

- `external_id`: `demo-learning-process`
- Lehrperson: Demo-Nutzer `1`
- Studierender: Demo-Nutzer `3`
- weitere Demo-Studierende: `4` in Gruppe A, `5` ohne Gruppe
- Gruppe: `Gruppe A` im aktiven Wintersemester-Run

Demo-Aufgaben:

1. `Grundlagen kennenlernen`
   - `IMMEDIATE`
   - keine Voraussetzung
   - `SELF_CONFIRMATION`
2. `Grundlagen anwenden`
   - `AUTOMATIC`
   - Voraussetzung: Aufgabe 1 erfolgreich abgeschlossen
   - `MANUAL`
   - `GROUP`
   - 10 Punkte, Bestehensgrenze 50 Prozent
3. `Abschlussaufgabe bearbeiten`
   - `MANUAL`
   - bleibt gesperrt, bis eine Lehrperson freischaltet
   - `AUTOMATIC_MOCK`
   - 10 Punkte, Bestehensgrenze 50 Prozent

Der Seed nutzt `external_id` und `demoKey`, damit wiederholte Starts keine
Duplikate erzeugen. Produktive Migrationen erzeugen keine Demo-Daten.

## Demo-Ablauf

1. Als Demo-Studierender `student` anmelden.
2. Demo-Kurs `Demo-Kurs Lernprozess` oeffnen.
3. Aufgabe 1 ist verfuegbar; Aufgabe 2 und Aufgabe 3 sind gesperrt.
4. Aufgabe 1 beginnen und als erledigt markieren.
5. Aufgabe 2 wird automatisch verfuegbar.
6. Aufgabe 2 abgeben. Sie steht nun auf `SUBMITTED` und wartet auf Bewertung.
7. Als Demo-Lehrperson `admin` anmelden und Aufgabe 2 fuer Student `3`
   manuell bewerten.
8. Nach bestandener Bewertung bleibt Aufgabe 3 zunaechst gesperrt, bis sie
   manuell freigeschaltet wird.
9. Aufgabe 3 als Lehrperson fuer Student `3` freischalten.
10. Als Student ist Aufgabe 3 verfuegbar und kann per Demo-Abgabe automatisch
    bewertet werden.

## Integrationsgrenze Aufgabenservice

Der Course Service erzeugt keinen hypothetischen externen Aufgabenservice und
greift auf keine fremde Datenbank zu. Aufgabenabgaben und Bewertungen laufen
derzeit intern ueber `TaskAssessment` und den `TaskEvaluationProvider`.

Wenn spaeter ein echter Aufgabenservice angebunden wird, ist die Grenze
API-basiert:

- Der Course Service uebergibt Kursdurchlauf, Aufgabenreferenz, Studierenden-ID
  und fachlich notwendige Abgabedaten.
- Der externe Service liefert ein bewertetes Ergebnis oder einen
  Bearbeitungsstatus zurueck.
- Voruebergehende Nichterreichbarkeit wird als kontrollierter Fehler behandelt;
  Fortschritt wird dabei nicht als bestanden gespeichert.
- Der Course Service speichert nur notwendige Ergebnisdaten, Referenzen,
  Quelle, Feedback und Audit-Metadaten.
- Freischaltungen bleiben im Course Service und werden nur nach erfolgreicher
  Bewertung ausgeloest.
