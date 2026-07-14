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
    "recurrenceType": "SEMESTER",
    "status": "PUBLISHED",
    "requiresEnrollmentKey": false
  },
  "currentRun": {
    "id": "run-id",
    "courseId": "course-id",
    "label": "Wintersemester 2026/27",
    "startDate": "2026-10-01",
    "endDate": "2027-03-31",
    "status": "PUBLISHED",
    "isActive": true
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

## Course Runs And Content Versions

The domain separates three concepts:

- `Course`: the long-lived course master data such as title, owner, status,
  recurrence type and base settings.
- `CourseRun`: a concrete offering of the course, for example
  `Sommersemester 2026`, `Wintersemester 2026/27`, `2027` or a continuous run.
- `CourseVersion`: a content snapshot within one course run.

Supported recurrence types are `SEMESTER`, `YEARLY` and `CONTINUOUS`.
Semester runs use the documented fallback calendar: summer semester from
`04-01` to `09-30`, winter semester from `10-01` to `03-31`. Yearly runs span
one calendar year. Continuous courses keep one ongoing run and do not propose a
regular next run.

Relevant paths:

- `GET /api/courses/:courseId/run-plan`
- `POST /api/courses/:courseId/run-plan/template`
- `GET /api/courses/:courseId/runs`
- `GET /api/courses/:courseId/runs/current`
- `GET /api/courses/:courseId/runs/:runId`
- `POST /api/courses/:courseId/runs/next`
- `POST /api/courses/:courseId/runs/special`
- `POST /api/courses/:courseId/runs/:runId/activate`
- `DELETE /api/courses/:courseId/runs/:runId`
- `GET /api/courses/:courseId/version-templates`

Creating a course creates the initial active run. New regular runs are prepared
through `POST /runs/next`; clients do not freely provide the label or period.
The service calculates the next run from the course rhythm:

- semester: `Sommersemester 2026` -> `Wintersemester 2026/27`,
  `Wintersemester 2026/27` -> `Sommersemester 2027`
- yearly: `2026` -> `2027`
- continuous: no regular next run is proposed

`GET /run-plan` returns the current run, the calculated next run and the
currently selected content template. `POST /run-plan/template` stores the
strategy for the next prepared run. The mini-project supports
`ACTIVE_VERSION_OF_CURRENT_RUN` and `SPECIFIC_VERSION`; `EMPTY` is available in
the backend for deliberately empty runs. If no specific version is configured,
the active content version of the current run is used.

`POST /runs/special` is a controlled exception for administrative
Sonderdurchläufe. It requires an explicit label and is not the normal workflow.
The frontend labels this action separately from the regular rhythm-based
planning.

Copied content includes learning materials, file references, material metadata,
tasks, task ordering, prerequisite links and material release rules. Task and
material records receive new ids, and task references are remapped to the copied
tasks. Person-bound or assessment data is not copied: enrollments, task
progress, grades, course results, assignments/submissions, individual unlocks
and comments start empty for the new run.
`POST /runs/next` leaves the new run inactive by default; teachers activate it
with the separate activate endpoint or by sending `activate: true`.

Existing course-level data is migrated into one initial active run per course.
Enrollment, materials, tasks, assignments, course results and content versions
then carry a run reference. Existing routes such as `/courses/:id/materials`,
`/courses/:id/tasks`, `/courses/:id/results` and `/courses/:id/versions`
default to the current active run.

## Course Catalog And Enrollment

The course overview uses actor-aware endpoints. The current user is taken from
`X-User-Id`; clients must not submit another student id for self-enrollment.

Relevant paths:

- `GET /api/courses/enrolled`
- `GET /api/courses/available`
- `POST /api/courses/:courseId/enroll`
- `DELETE /api/courses/:courseId/enrollment`

`GET /api/courses/enrolled` returns courses where the actor is enrolled plus
courses owned by teaching users. `GET /api/courses/available` returns published
courses that the actor is not already enrolled in and does not own.

Enrollment is idempotent for existing student enrollments in the current active
run. Draft and archived courses cannot be joined. Teaching memberships and
course owners are not converted into student enrollments. When a student
enrolls, immediate published learning tasks of the active run are initialized as
available without changing existing progress.

## Course Content Versions

Course versions are content snapshots scoped to exactly one CourseRun. Version
numbers are unique within that run, and at most one content version can be
active per run. `sourceVersionId` optionally documents that a version was
created by copying content from an earlier version of the same course.
Content versions remain manually manageable inside a run; this is separate from
the rhythm-based run planning.

Relevant paths:

- `GET /api/courses/:courseId/versions`
- `GET /api/courses/:courseId/runs/:runId/versions`
- `GET /api/courses/:courseId/versions/:versionId`
- `POST /api/courses/:courseId/versions`
- `POST /api/courses/:courseId/runs/:runId/versions`
- `POST /api/courses/:courseId/versions/:versionId/activate`
- `DELETE /api/courses/:courseId/runs/:runId/versions/:versionId`

Teaching roles with course-management permission create versions and activate a
specific version. Students do not use the version-management endpoints; they see
the released materials and tasks of the active version of their active
enrollment run. A version request always filters by `courseId` and `versionId`,
so a version id from another course is not visible through the current course
route.

Deleting a CourseVersion is controlled: active versions, the only version in a
run, versions referenced by another version as `sourceVersionId`, and versions
inside archived runs are rejected with a validation error. Since material files
are referenced through learning-material records, deleting a version snapshot
does not remove physical files.

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
Alle Ergebnislisten und Neuberechnungen beziehen sich auf den aktuellen aktiven
Course Run.

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
