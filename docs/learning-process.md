# Learning Process

Der lernfortschrittsabhaengige Lernprozess ist im bestehenden Course Service
implementiert. Es gibt keinen separaten Task Service, keinen neuen Container und
keinen direkten Zugriff auf Datenbanken anderer Services.

## Datenmodell

`Task` repraesentiert einen Lernschritt im Kurs:

- `id`
- `courseId`
- `title`
- `description`
- `type`
- `order`
- `unlockMode`
- `prerequisiteTaskId`
- `completionCriteria`
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

## Statuswerte

- `LOCKED`: Die Aufgabe ist noch nicht verfuegbar.
- `AVAILABLE`: Die Aufgabe ist verfuegbar und kann begonnen werden.
- `IN_PROGRESS`: Der Studierende hat die Aufgabe begonnen.
- `COMPLETED`: Die Aufgabe wurde erfolgreich abgeschlossen.
- `FAILED`: Die Aufgabe wurde nicht erfolgreich abgeschlossen.

Eine Aufgabe ist nie gleichzeitig abgeschlossen und gesperrt. Wiederholte
erfolgreiche Abschlussmeldungen sind idempotent und erzeugen keine doppelten
Progress-Datensaetze oder mehrfachen Freischaltungen.

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
Fortschritt sehen. Sie duerfen verfuegbare Aufgaben beginnen und im aktuellen
Mini-Projekt einen Erfolg oder Misserfolg simuliert melden. Gesperrte Aufgaben,
Aufgaben anderer Kurse und Fortschritte anderer Studierender koennen sie nicht
veraendern.

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
- `POST /courses/tasks/:id/manual-unlock`

Controller delegieren Freischalt- und Abschlusslogik an den Course Service. Die
API gibt DTOs aus, keine TypeORM-Entitaeten.

## Demo-Daten

In `APP_ENV=development`, `APP_ENV=test` oder `APP_ENV=demo` legt
`CourseDemoSeedService` idempotent einen Demo-Kurs an, sofern
`COURSE_DEMO_SEED_DISABLED` nicht aktiviert ist.

Demo-Kurs:

- `external_id`: `demo-learning-process`
- Lehrperson: Demo-Nutzer `1`
- Studierender: Demo-Nutzer `3`

Demo-Aufgaben:

1. `Grundlagen kennenlernen`
   - `IMMEDIATE`
   - keine Voraussetzung
2. `Grundlagen anwenden`
   - `AUTOMATIC`
   - Voraussetzung: Aufgabe 1 erfolgreich abgeschlossen
3. `Abschlussaufgabe bearbeiten`
   - `MANUAL`
   - bleibt gesperrt, bis eine Lehrperson freischaltet

Der Seed nutzt `external_id` und `demoKey`, damit wiederholte Starts keine
Duplikate erzeugen. Produktive Migrationen erzeugen keine Demo-Daten.

## Demo-Ablauf

1. Als Demo-Studierender `student` anmelden.
2. Demo-Kurs `Demo-Kurs Lernprozess` oeffnen.
3. Aufgabe 1 ist verfuegbar; Aufgabe 2 und Aufgabe 3 sind gesperrt.
4. Aufgabe 1 beginnen und erfolgreich abschliessen.
5. Aufgabe 2 wird automatisch verfuegbar.
6. Aufgabe 3 bleibt gesperrt.
7. Als Demo-Lehrperson `admin` anmelden.
8. Im Aufgaben-Tab Aufgabe 3 fuer Student `3` manuell freischalten.
9. Als Student ist Aufgabe 3 verfuegbar.

## Vorbereitung Bewertungssystem

Die UI-Aktionen `Erfolgreich abschliessen` und `Nicht erfolgreich abschliessen`
sind bewusst als Demo- beziehungsweise Basisfunktion markiert. Sie simulieren
das Ergebnis, das spaeter von einem Aufgaben- oder Bewertungssystem kommen
koennte.

Die fachliche Service-Methode `recordTaskResult(studentId, taskId, passed,
actorUserId?)` ist der vorbereitete Einstiegspunkt fuer das naechste Feature.
Ein spaeteres Bewertungssystem soll diese Methode beziehungsweise eine darauf
aufbauende Application-Funktion verwenden und keine eigene Abschluss- oder
Freischaltlogik duplizieren.

Der Course Service bleibt fuer Lernfortschritt und Freischaltregeln
verantwortlich. Ein spaeterer externer Task Service wuerde Ergebnisse ueber eine
dokumentierte Schnittstelle melden; der Course Service greift niemals direkt auf
eine fremde Service-Datenbank zu.
