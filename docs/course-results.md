# Bewertungen

Das Mini-Projekt verwendet ein einheitliches Bewertungssystem:
`TaskAssessment`.

## Fachliche Trennung

- Aufgaben definieren die Bewertungsregeln: `gradingMode`, `maxPoints`,
  `passThreshold`, `feedbackRequired` und `allowRetries`.
- `TaskAssessment` speichert das konkrete Bewertungsergebnis eines Studenten
  fuer eine Aufgabe in einem CourseRun und einer CourseVersion.
- Der Lernfortschritt bleibt getrennt und beschreibt nur den Bearbeitungsstand:
  `LOCKED`, `AVAILABLE`, `IN_PROGRESS`, `SUBMITTED`, `COMPLETED`, `FAILED`.
- Bewertungsergebnisse aktualisieren den Lernfortschritt, zum Beispiel:
  manuell bestanden -> `COMPLETED`, manuell nicht bestanden -> `FAILED`,
  abgegeben aber nicht bewertet -> `SUBMITTED`.

## Reiter Bewertungen

Der Reiter `Bewertungen` ist keine zweite Bewertungslogik. Er ist eine
Teacher-/Admin-Ansicht auf dieselben `TaskAssessment`-Daten, die auch in der
Aufgabenansicht verwendet werden.

Lehrende sehen dort:

- Aufgaben eines Kursdurchlaufs
- Studierende des Kursdurchlaufs
- offene manuelle Abgaben
- bestandene und nicht bestandene Aufgaben
- Punkte und Feedback
- Lernfortschritt je Aufgabe

Manuelle Bewertungen werden ueber dieselben Assessment-Endpunkte gespeichert
wie in der Aufgabenansicht. Danach ist das Ergebnis in beiden Ansichten
sichtbar.

## Aktive API

- `GET /api/courses/:courseId/runs/:runId/assessments`
- `GET /api/courses/:courseId/runs/:runId/tasks/:taskId/assessments`
- `POST /api/courses/:courseId/runs/:runId/tasks/:taskId/assessments/:studentId/manual`
- `POST /api/courses/:courseId/runs/:runId/tasks/:taskId/assessments/:studentId/reset`

Studentische Aktionen laufen ebenfalls ueber Aufgaben-Endpunkte und schreiben
`TaskAssessment`, wenn der Bewertungsmodus dies vorsieht:

- `POST /api/courses/tasks/:id/self-confirm`
- `POST /api/courses/tasks/:id/submit`
- `POST /api/courses/tasks/:id/mock-evaluate`

## Mock-Bewertung

Der Mock-Aufgabenservice ist ueber `TaskEvaluationProvider` gekapselt und
schreibt normale `TaskAssessment`-Eintraege. Er erzeugt keine separate
Bewertungsstruktur.

## Zukuenftige Gesamtnoten

Falls spaeter eine Gesamtnote oder ein Kursergebnis benoetigt wird, muss diese
fachlich als separate Aggregation aus Aufgabenbewertungen modelliert werden.
Im aktuellen Mini-Projekt ist `TaskAssessment` die zentrale und einzige aktive
Bewertungsquelle.
