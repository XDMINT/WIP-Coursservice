# Learning Materials

Learning materials are implemented inside the existing Course Service. No
separate file service, MinIO, or direct public file path is introduced.

## Storage

Uploaded files are stored outside PostgreSQL in the backend container at
`COURSE_MATERIAL_STORAGE_PATH`. Docker Compose mounts this path to the persistent
`course-materials-data` volume.

The storage implementation is isolated behind `LocalMaterialStorage`, so a later
object storage implementation can replace it without changing controllers or UI
code.

Security properties:

- File names are sanitized before being exposed as metadata.
- Storage keys are generated server-side and are not derived from user input.
- Path traversal in storage keys is rejected.
- Downloads stream files through the authorized backend endpoint.
- Draft or archived files are never directly exposed to students.
- Uploads are limited by `COURSE_MATERIAL_MAX_FILE_SIZE_BYTES`.

Allowed MIME types currently include common documents, presentations, images,
text files, ZIP archives and videos. Executables and unknown binary uploads are
rejected.

## Roles

| Action | TEACHER | TUTOR | STUDENT |
| --- | --- | --- | --- |
| List materials | All non-archived | All non-archived | Published only |
| Upload file | Yes | Yes | No |
| Create external link | Yes | Yes | No |
| Edit metadata | Yes | Yes | No |
| Publish or withdraw | Yes | Yes | No |
| Archive material | Yes | Yes | No |
| Download file | Yes | Yes | Published only |

The frontend uses permission flags for presentation, but all permissions are
enforced by the backend.

## API

All paths are below `/api`.

- `GET /courses/:courseId/materials`
- `GET /courses/materials/:id`
- `POST /courses/:courseId/materials/upload`
- `POST /courses/:courseId/materials/link`
- `PUT /courses/materials/:id`
- `PUT /courses/:courseId/materials/sort-order`
- `POST /courses/materials/:id/publish`
- `POST /courses/materials/:id/withdraw`
- `DELETE /courses/materials/:id`
- `GET /courses/materials/:id/download`

Upload uses `multipart/form-data` with a required `file` field plus metadata
fields such as `title`, `description`, `type`, `tags`, and `sortOrder`.

External links are stored only after URL validation and must use `http` or
`https`.
