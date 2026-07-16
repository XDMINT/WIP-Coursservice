# Logging und Audit-Logging

Die Anwendung nutzt keine externe zentrale Logging-Infrastruktur. Stattdessen
werden technische Logs containerkonform ausgegeben und fachlich relevante
Ereignisse als Audit-Events persistiert. Dadurch bleibt die Loesung fuer das
Mini-Projekt schlank, aber nachvollziehbar.

## Technische Logs

Der Backend-Service schreibt strukturierte JSON-Nutzlasten ueber den NestJS-
Logger nach stdout beziehungsweise stderr. Die Logs sind damit direkt ueber
Docker sichtbar:

```bash
docker compose logs course-service
```

Geloggte technische Ereignisse:

- Backend-Start und aktives `APP_ENV`
- erfolgreicher Backend-Listen-Start mit Port
- erfolgreiche Datenbankverbindung
- Status der ausgefuehrten Migrationen
- Demo-Seed gestartet, uebersprungen, abgeschlossen oder fehlgeschlagen
- Warnungen bei fehlender Konfiguration
- unerwartete Fehler mit Stacktrace nur serverseitig

Es werden keine Tokens, Passwoerter, Authorization-Header, vollstaendige
Request-Bodies oder Datei-Inhalte geloggt.

## Request- und Fehlerlogging

Eine Request-Context-Middleware erzeugt pro Request eine Correlation-ID:

- vorhandene Header `X-Request-ID` oder `X-Correlation-ID` werden uebernommen
- sonst wird serverseitig eine UUID erzeugt
- die ID wird als `X-Request-ID` in der Response zurueckgegeben
- Request-Logs, Fehlerlogs und Audit-Events nutzen denselben Context

Das zentrale Request-Logging schreibt pro API-Request:

- HTTP-Methode
- Pfad ohne Query-Parameter
- Statuscode
- Dauer in Millisekunden
- User-ID, falls verfuegbar
- Rolle, falls verfuegbar
- Request-ID

Der globale Exception-Filter gibt weiterhin nur saubere API-Fehlerantworten an
Clients zurueck. Stacktraces bleiben in den Serverlogs.

## Fachliches Audit-Logging

Fachlich relevante Ereignisse werden in PostgreSQL in `audit_events`
gespeichert. Dieses Log dient nicht der technischen Fehlersuche, sondern der
fachlichen Nachvollziehbarkeit.

Die Tabelle enthaelt unter anderem:

- Event-Typ
- Akteur und Rolle
- Kurs, Kursdurchlauf und Inhaltsversion
- Entitaetstyp und Entitaets-ID
- Kurzbeschreibung
- reduzierte Metadaten als JSON
- Request-ID
- Zeitstempel

Das Schreiben ist zentral in `AuditLogService` gekapselt. Fachservices rufen
`recordEvent` erst nach erfolgreichen Aenderungen auf. Falls das Audit-Log
selbst nicht geschrieben werden kann, wird dies technisch geloggt; die
urspruengliche Fachaktion wird dadurch nicht unkontrolliert zerstoert.

## Geloggte Fachereignisse

Aktuell werden insbesondere diese Ereignisse protokolliert:

- `COURSE_CREATED`, `COURSE_UPDATED`
- `COURSE_RUN_CREATED`, `COURSE_RUN_ACTIVATED`
- `CONTENT_VERSION_CREATED`, `CONTENT_VERSION_ACTIVATED`,
  `CONTENT_VERSION_DELETED`
- `MATERIAL_CREATED`, `MATERIAL_UPDATED`, `MATERIAL_DELETED`
- `TASK_CREATED`, `TASK_UPDATED`, `TASK_DELETED`
- `STUDENT_ENROLLED`, `STUDENT_REMOVED`
- `TASK_STARTED`, `TASK_SUBMITTED`, `PROGRESS_UPDATED`,
  `TASK_COMPLETED`, `TASK_FAILED`
- `ASSESSMENT_SUBMITTED`, `ASSESSMENT_MANUALLY_GRADED`,
  `ASSESSMENT_AUTO_EVALUATED`, `ASSESSMENT_RESET`

Bewertungsdetails werden nur reduziert gespeichert, zum Beispiel Punkte,
Maximalpunkte und Bestehensstatus. Feedbacktexte und Abgabeinhalte werden nicht
vollstaendig in Audit-Metadaten kopiert.

## Zugriff

Lehrende mit Kursverwaltungsrecht koennen Audit-Events einsehen:

```text
GET /api/courses/:courseId/audit-events
GET /api/courses/:courseId/runs/:runId/audit-events
```

Unterstuetzte Filter:

- `eventType`
- `courseRunId` ueber den run-spezifischen Pfad
- `from`
- `to`
- `limit`, maximal 100

Studierende erhalten keinen Zugriff auf die Audit-API und sehen im Frontend
keinen Audit-Reiter.

## Traefik

Traefik schreibt einfache JSON-Access-Logs. Header werden standardmaessig nicht
geloggt, damit keine sensiblen Werte wie Tokens oder Cookies in Proxy-Logs
landen.

## Grenzen der Mini-Loesung

Es gibt bewusst kein ELK, Loki, Grafana oder Kubernetes-Logging. Die technische
Suche erfolgt ueber Docker-Logs, fachliche Nachvollziehbarkeit ueber
`audit_events`. Fuer ein groesseres Produktionssystem waeren spaeter zentrale
Log-Aggregation, Retention-Regeln, Export und differenziertere Admin-Rechte zu
ergaenzen.
