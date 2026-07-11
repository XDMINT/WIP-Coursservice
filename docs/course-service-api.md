# Course Service API Foundation

The Course Service remains available below the public `/api` prefix through Traefik.
Frontend requests use relative paths and the central API client adds the current
demo user as `X-User-Id`.

## Course Context

`GET /api/courses/:courseId/context`

Returns the course DTO, the current user's course membership and computed
permission flags. The endpoint is intended as the stable entry point for course
feature screens.

```json
{
  "course": {
    "id": "course-id",
    "title": "Database Systems",
    "status": "PUBLISHED",
    "requiresEnrollmentKey": false
  },
  "membership": {
    "userId": "42",
    "role": "TEACHER"
  },
  "permissions": {
    "course.content.read": true,
    "course.content.manage": true,
    "course.manage": true,
    "course.members.manage": true,
    "course.results.own.read": true,
    "course.results.all.read": true
  }
}
```

Non-members receive `403 COURSE_ACCESS_DENIED`. Students only receive internal
course context for published courses.

## Permission Matrix

| Action | TEACHER | TUTOR | STUDENT |
| --- | --- | --- | --- |
| Read released course content | Yes | Yes | Yes, with membership and release |
| Create or edit course content | Yes | Yes | No |
| Manage course settings | Yes | No | No |
| Manage course members | Yes | Yes | No |
| Read own results | Yes | Yes | Yes |
| Read other students' results | Yes | Yes | No |

Backend checks use central Course Service permission functions. Frontend
permission flags are only presentation hints and are not the security boundary.

## Learning Process

The Course Service exposes the current mini-project task representation and
learning-progress release rules. Responses are DTOs and include computed student
status values such as `LOCKED`, `AVAILABLE`, `IN_PROGRESS`, `COMPLETED` and
`FAILED`.

Relevant paths:

- `GET /api/courses/:courseId/tasks`
- `GET /api/courses/:courseId/tasks/my-progress`
- `GET /api/courses/:courseId/tasks/progress-overview`
- `POST /api/courses/tasks/:id/start`
- `POST /api/courses/tasks/:id/complete`
- `POST /api/courses/tasks/:id/fail`
- `POST /api/courses/tasks/:id/manual-unlock`

Students can only change their own progress and only for available tasks.
Teaching roles manage task configuration and manual unlocks. The demo completion
actions call the same service-level use case intended for a later grading
system: `recordTaskResult(studentId, taskId, passed)`.

## Course Results

Kursergebnisse liegen unter `/api/courses/:courseId/results`.

Relevant paths:

- `GET /api/courses/:courseId/results/me`
- `GET /api/courses/:courseId/results?page=1&pageSize=10&passStatus=PASSED&source=MANUAL_OVERRIDE`
- `PUT /api/courses/:courseId/results/:studentId/manual`
- `POST /api/courses/:courseId/results/:studentId/recalculate`
- `POST /api/courses/:courseId/results/recalculate`

Studierende erhalten ausschliesslich ihr eigenes Ergebnis. Teaching roles sehen
eine paginierte Teilnehmeruebersicht, koennen manuelle Bewertungen speichern und
automatische Neuberechnungen aus finalen Assignment-Punkten ausloesen.

Die Bestehensregel ist zentral im Backend abgelegt: mehr als 50 Prozent ist
bestanden; exakt 50 Prozent oder weniger ist nicht bestanden.

## Error Format

Course Service errors use a consistent JSON shape:

```json
{
  "statusCode": 403,
  "code": "COURSE_ACCESS_DENIED",
  "error": "FORBIDDEN",
  "message": "You do not have permission to access this course resource",
  "path": "/api/courses/course-id/context",
  "timestamp": "2026-07-09T20:00:00.000Z"
}
```

Validation errors may include a `details` array.
