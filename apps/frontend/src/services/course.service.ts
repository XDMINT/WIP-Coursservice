import type CoursePL from '../model/course/CoursePL'
import type CourseAndParticipationPL from '../model/course/CourseAndParticipationPL'
import type Member from '../model/course/Member'
import CourseRoles from '@/enums/CourseRoles'
import { apiClient } from './apiClient'
import type { TaskAssessmentStatus, TaskProgressStatus } from './learningTask.service'

type CourseId = string | number

type BackendCourse = {
  id: string
  title: string
  description?: string
  semester?: string
  status?: string
  recurrenceType?: CourseRecurrenceType
  recurrence_type?: CourseRecurrenceType
  created_at?: string
  createdAt?: string
  updated_at?: string
  updatedAt?: string
  owner_id?: number
  ownerId?: number
  key_password?: string
  keyPassword?: string
  requiresEnrollmentKey?: boolean
  location?: string
  currentRun?: BackendCourseRun
}

type BackendEnrollment = {
  id?: string
  userId?: string
  user_id?: string
  role: string
}

type BackendCourseCatalogItem = BackendCourse & {
  enrolled?: boolean
  membershipRole?: string
  canEnroll?: boolean
  currentRun?: BackendCourseRun
}

export type CourseRecurrenceType = 'SEMESTER' | 'YEARLY' | 'CONTINUOUS'
export type CourseRunStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
export type CourseRunTemplateStrategy = 'ACTIVE_VERSION_OF_CURRENT_RUN' | 'SPECIFIC_VERSION' | 'EMPTY'

type BackendCourseRun = {
  id: string
  courseId?: string
  course_id?: string
  label: string
  startDate?: string
  start_date?: string
  endDate?: string
  end_date?: string
  status: CourseRunStatus
  sourceRunId?: string | null
  source_run_id?: string | null
  isActive?: boolean
  is_active?: boolean
  createdBy?: string
  created_by?: string
  createdAt?: string
  created_at?: string
  updatedAt?: string
  updated_at?: string
  enrollmentCount?: number
  materialCount?: number
  taskCount?: number
  versionCount?: number
  resultCount?: number
  progressCount?: number
  assignmentCount?: number
}

type BackendCourseRunDeletion = {
  action: 'DELETED' | 'ARCHIVED'
  reason?: string
  run?: BackendCourseRun
}

type BackendCourseRunPlan = {
  recurrenceType?: CourseRecurrenceType
  recurrence_type?: CourseRecurrenceType
  currentRun: BackendCourseRun
  current_run?: BackendCourseRun
  nextRun?: Partial<BackendCourseRun> | null
  next_run?: Partial<BackendCourseRun> | null
  templateStrategy?: CourseRunTemplateStrategy
  template_strategy?: CourseRunTemplateStrategy
  templateVersion?: BackendCourseVersion | null
  template_version?: BackendCourseVersion | null
  regularPlanningAvailable?: boolean
  regular_planning_available?: boolean
}

type BackendCourseVersion = {
  id: string
  courseId?: string
  course_id?: string
  courseRunId?: string
  course_run_id?: string
  courseRunLabel?: string
  course_run_label?: string
  versionNumber?: number
  version_number?: number
  label?: string | null
  content?: Record<string, unknown>
  changeSummary?: string
  change_summary?: string
  status?: 'PUBLISHED' | 'ARCHIVED'
  sourceVersionId?: string | null
  source_version_id?: string | null
  sourceVersionNumber?: number
  source_version_number?: number
  sourceVersionLabel?: string | null
  source_version_label?: string | null
  sourceRunLabel?: string
  source_run_label?: string
  createdAt?: string
  created_at?: string
  createdBy?: string
  created_by?: string
  isActive?: boolean
  is_active?: boolean
}

type BackendAuditEvent = {
  id: string
  eventType?: string
  event_type?: string
  actorUserId?: string | null
  actor_user_id?: string | null
  actorRole?: string | null
  actor_role?: string | null
  courseId?: string | null
  course_id?: string | null
  courseRunId?: string | null
  course_run_id?: string | null
  courseVersionId?: string | null
  course_version_id?: string | null
  entityType?: string | null
  entity_type?: string | null
  entityId?: string | null
  entity_id?: string | null
  summary: string
  metadataJson?: Record<string, unknown> | null
  metadata_json?: Record<string, unknown> | null
  requestId?: string | null
  request_id?: string | null
  createdAt?: string
  created_at?: string
}

export type CoursePermissionKey = 'course.content.read' | 'course.content.manage' | 'course.manage' | 'course.members.manage' | 'course.results.own.read' | 'course.results.all.read'

export type CourseContext = {
  course: CoursePL
  role: CourseRoles
  permissions: Record<CoursePermissionKey, boolean>
  currentRun?: CourseRun
  currentVersion?: CourseVersion
}

export type CourseRun = {
  id: string
  courseId: string
  label: string
  startDate?: string
  endDate?: string
  status: CourseRunStatus
  sourceRunId?: string | null
  isActive: boolean
  createdBy?: string
  createdAt?: string
  updatedAt?: string
  enrollmentCount?: number
  materialCount?: number
  taskCount?: number
  versionCount?: number
  resultCount?: number
  progressCount?: number
  assignmentCount?: number
}

export type CreateCourseRunPayload = {
  label?: string
  startDate?: string
  endDate?: string
  status?: CourseRunStatus
  activate?: boolean
  sourceVersionId?: string
}

export type UpdateCourseRunPlanTemplatePayload = {
  strategy: CourseRunTemplateStrategy
  sourceVersionId?: string | null
}

export type CourseRunDeletion = {
  action: 'DELETED' | 'ARCHIVED'
  reason?: string
  run?: CourseRun
}

export type CourseVersion = {
  id: string
  courseId: string
  courseRunId?: string
  courseRunLabel?: string
  versionNumber: number
  label?: string | null
  content: Record<string, unknown>
  changeSummary: string
  status: 'PUBLISHED' | 'ARCHIVED'
  sourceVersionId?: string | null
  sourceVersionNumber?: number
  sourceVersionLabel?: string | null
  sourceRunLabel?: string
  createdAt: string
  createdBy: string
  isActive: boolean
}

export type CourseRunPlan = {
  recurrenceType: CourseRecurrenceType
  currentRun: CourseRun
  nextRun?: Pick<CourseRun, 'label' | 'startDate' | 'endDate'> | null
  templateStrategy: CourseRunTemplateStrategy
  templateVersion?: CourseVersion | null
  regularPlanningAvailable: boolean
}

export type AuditEvent = {
  id: string
  eventType: string
  actorUserId?: string | null
  actorRole?: string | null
  courseId?: string | null
  courseRunId?: string | null
  courseVersionId?: string | null
  entityType?: string | null
  entityId?: string | null
  summary: string
  metadataJson?: Record<string, unknown> | null
  requestId?: string | null
  createdAt: string
}

export type StudyGroupMember = {
  studentId: string
  role: 'MEMBER' | 'LEADER' | 'CO_LEADER'
  joinedAt?: string | null
}

export type StudyGroupTaskProgress = {
  id: string
  taskId: string
  groupId: string
  status: TaskProgressStatus
  startedAt?: string | null
  submittedAt?: string | null
  completedAt?: string | null
  assessment?: {
    id: string
    taskId: string
    groupId?: string | null
    status: TaskAssessmentStatus
    points?: number | null
    maxPoints?: number | null
    passed?: boolean | null
    feedback?: string | null
  } | null
}

export type StudyGroup = {
  id: string
  courseId: string
  courseRunId?: string | null
  name: string
  description?: string | null
  isActive: boolean
  createdBy?: string | null
  createdAt?: string
  updatedAt?: string
  members: StudyGroupMember[]
  memberCount: number
  taskProgress?: StudyGroupTaskProgress[]
}

export type AuditEventQuery = {
  courseRunId?: string
  eventType?: string
  from?: string
  to?: string
  limit?: number
}

type BackendCourseContext = {
  course: BackendCourse
  currentRun?: BackendCourseRun
  currentVersion?: BackendCourseVersion
  membership: {
    userId: string
    role: string
  }
  permissions: Record<CoursePermissionKey, boolean>
}

type MaybeListResponse<T> = T[] | { data?: T[] }

export const normalizeCourseRole = (role?: string | null): CourseRoles => {
  if (role === 'OWNER') return CourseRoles.TEACHER
  if (role === CourseRoles.TEACHER) return CourseRoles.TEACHER
  if (role === CourseRoles.TUTOR) return CourseRoles.TUTOR
  if (role === CourseRoles.STUDENT) return CourseRoles.STUDENT
  return CourseRoles.NONE
}

const mapCourseFromBackend = (course: BackendCourse): CoursePL => ({
  id: course.id,
  name: course.title,
  description: course.description ?? '',
  active: course.status !== 'ARCHIVED',
  status: course.status,
  recurrenceType: course.recurrenceType ?? course.recurrence_type ?? 'CONTINUOUS',
  creationDate: course.created_at ?? course.createdAt ?? '',
  updatedAt: course.updated_at ?? course.updatedAt ?? course.created_at ?? course.createdAt ?? '',
  semester: {
    id: 0,
    name: course.semester ?? 'Unbekanntes Semester',
    startDate: '2000-01-01',
    endDate: '2099-12-31'
  },
  owner: course.owner_id ?? course.ownerId ?? 0,
  keyPassword: course.key_password ?? course.keyPassword ?? '',
  requiresEnrollmentKey: course.requiresEnrollmentKey ?? Boolean(course.key_password ?? course.keyPassword),
  location: course.location ?? '',
  ...(course.currentRun ? { currentRun: mapCourseRunFromBackend(course.currentRun) } : {})
})

const mapCourseToBackend = (course: CoursePL) => ({
  title: course.name,
  description: course.description,
  semester: course.semester?.name,
  status: course.active === false ? 'DRAFT' : 'PUBLISHED',
  recurrenceType: course.recurrenceType ?? 'CONTINUOUS',
  initialRunLabel: course.initialRunLabel,
  initialRunStartDate: course.initialRunStartDate,
  initialRunEndDate: course.initialRunEndDate,
  ownerId: course.owner,
  keyPassword: course.keyPassword,
  location: course.location
})

const mapCourseCatalogItemFromBackend = (item: BackendCourseCatalogItem): CourseAndParticipationPL => ({
  course: mapCourseFromBackend({
    ...item,
    currentRun: item.currentRun
  }),
  member: item.enrolled === true,
  canEnroll: item.canEnroll === true,
  membershipRole: item.membershipRole
})

const mapEnrollmentToMember = (enrollment: BackendEnrollment): Member => {
  const rawUserId = enrollment.userId ?? enrollment.user_id ?? '0'
  const numericUserId = Number(rawUserId)

  return {
    user: {
      id: Number.isFinite(numericUserId) ? numericUserId : 0,
      username: `user-${rawUserId}`,
      email: '',
      firstName: '',
      lastName: '',
      roles: []
    },
    role: normalizeCourseRole(enrollment.role)
  }
}

const mapCourseVersionFromBackend = (version: BackendCourseVersion): CourseVersion => ({
  id: version.id,
  courseId: version.courseId ?? version.course_id ?? '',
  ...((version.courseRunId ?? version.course_run_id)
    ? { courseRunId: version.courseRunId ?? version.course_run_id }
    : {}),
  courseRunLabel: version.courseRunLabel ?? version.course_run_label,
  versionNumber: version.versionNumber ?? version.version_number ?? 0,
  label: version.label,
  content: version.content ?? {},
  changeSummary: version.changeSummary ?? version.change_summary ?? '',
  status: version.status ?? 'PUBLISHED',
  sourceVersionId: version.sourceVersionId ?? version.source_version_id,
  sourceVersionNumber: version.sourceVersionNumber ?? version.source_version_number,
  sourceVersionLabel: version.sourceVersionLabel ?? version.source_version_label,
  sourceRunLabel: version.sourceRunLabel ?? version.source_run_label,
  createdAt: version.createdAt ?? version.created_at ?? '',
  createdBy: version.createdBy ?? version.created_by ?? '',
  isActive: version.isActive ?? version.is_active ?? false
})

const mapAuditEventFromBackend = (event: BackendAuditEvent): AuditEvent => ({
  id: event.id,
  eventType: event.eventType ?? event.event_type ?? '',
  actorUserId: event.actorUserId ?? event.actor_user_id,
  actorRole: event.actorRole ?? event.actor_role,
  courseId: event.courseId ?? event.course_id,
  courseRunId: event.courseRunId ?? event.course_run_id,
  courseVersionId: event.courseVersionId ?? event.course_version_id,
  entityType: event.entityType ?? event.entity_type,
  entityId: event.entityId ?? event.entity_id,
  summary: event.summary,
  metadataJson: event.metadataJson ?? event.metadata_json,
  requestId: event.requestId ?? event.request_id,
  createdAt: event.createdAt ?? event.created_at ?? ''
})

const mapCourseRunFromBackend = (run: BackendCourseRun): CourseRun => ({
  id: run.id,
  courseId: run.courseId ?? run.course_id ?? '',
  label: run.label,
  startDate: run.startDate ?? run.start_date,
  endDate: run.endDate ?? run.end_date,
  status: run.status,
  sourceRunId: run.sourceRunId ?? run.source_run_id,
  isActive: run.isActive ?? run.is_active ?? false,
  createdBy: run.createdBy ?? run.created_by,
  createdAt: run.createdAt ?? run.created_at,
  updatedAt: run.updatedAt ?? run.updated_at,
  enrollmentCount: run.enrollmentCount,
  materialCount: run.materialCount,
  taskCount: run.taskCount,
  versionCount: run.versionCount,
  resultCount: run.resultCount,
  progressCount: run.progressCount,
  assignmentCount: run.assignmentCount
})

const mapCourseRunDeletionFromBackend = (result: BackendCourseRunDeletion): CourseRunDeletion => ({
  action: result.action,
  reason: result.reason,
  run: result.run ? mapCourseRunFromBackend(result.run) : undefined
})

const mapCourseRunPlanFromBackend = (plan: BackendCourseRunPlan): CourseRunPlan => {
  const nextRun = plan.nextRun ?? plan.next_run ?? null
  const templateVersion = plan.templateVersion ?? plan.template_version ?? null

  return {
    recurrenceType: plan.recurrenceType ?? plan.recurrence_type ?? 'CONTINUOUS',
    currentRun: mapCourseRunFromBackend(plan.currentRun ?? plan.current_run ?? {
      id: '',
      courseId: '',
      label: '',
      status: 'DRAFT',
      isActive: false
    }),
    nextRun: nextRun
      ? {
          label: nextRun.label ?? '',
          startDate: nextRun.startDate ?? nextRun.start_date,
          endDate: nextRun.endDate ?? nextRun.end_date
        }
      : null,
    templateStrategy: plan.templateStrategy ?? plan.template_strategy ?? 'ACTIVE_VERSION_OF_CURRENT_RUN',
    templateVersion: templateVersion ? mapCourseVersionFromBackend(templateVersion) : null,
    regularPlanningAvailable: plan.regularPlanningAvailable ?? plan.regular_planning_available ?? false
  }
}

const readListResponse = <T>(payload: MaybeListResponse<T>, endpointLabel: string): T[] => {
  if (Array.isArray(payload)) {
    return payload
  }

  if (payload && typeof payload === 'object' && Array.isArray(payload.data)) {
    return payload.data
  }

  throw new Error(`${endpointLabel} lieferte keine Liste.`)
}

class CourseService {
  async getCourse(id: CourseId): Promise<{ data: CoursePL }> {
    const response = await apiClient.get<BackendCourse>(`/courses/${id}`)

    return {
      data: mapCourseFromBackend(response.data)
    }
  }

  async getCourseContext(id: CourseId): Promise<CourseContext> {
    const response = await apiClient.get<BackendCourseContext>(`/courses/${id}/context`)

    return {
      course: mapCourseFromBackend(response.data.course),
      role: normalizeCourseRole(response.data.membership.role),
      permissions: response.data.permissions,
      ...(response.data.currentRun ? { currentRun: mapCourseRunFromBackend(response.data.currentRun) } : {}),
      ...(response.data.currentVersion ? { currentVersion: mapCourseVersionFromBackend(response.data.currentVersion) } : {})
    }
  }

  async getAllCourses(): Promise<CourseAndParticipationPL[]> {
    const [enrolledCourses, availableCourses] = await Promise.all([this.getEnrolledCourses(), this.getAvailableCourses()])

    return [...enrolledCourses, ...availableCourses]
  }

  async getEnrolledCourses(): Promise<CourseAndParticipationPL[]> {
    const response = await apiClient.get<MaybeListResponse<BackendCourseCatalogItem>>('/courses/enrolled')

    return readListResponse(response.data, 'Eingeschriebene Kurse').map(mapCourseCatalogItemFromBackend)
  }

  async getAvailableCourses(): Promise<CourseAndParticipationPL[]> {
    const response = await apiClient.get<MaybeListResponse<BackendCourseCatalogItem>>('/courses/available')

    return readListResponse(response.data, 'Verfügbare Kurse').map(mapCourseCatalogItemFromBackend)
  }

  async postCourse(course: CoursePL) {
    const response = await apiClient.post<BackendCourse>('/courses', mapCourseToBackend(course))
    return { data: mapCourseFromBackend(response.data) }
  }

  async putCourse(course: CoursePL) {
    const response = await apiClient.put<BackendCourse>(`/courses/${course.id}`, mapCourseToBackend(course))
    return { data: mapCourseFromBackend(response.data) }
  }

  enrollCourse(courseId: CourseId, key?: string) {
    return apiClient.post(`/courses/${courseId}/enroll`, { key })
  }

  joinCourse(courseId: CourseId, key: string) {
    return this.enrollCourse(courseId, key)
  }

  leaveCourse(courseId: CourseId, userId?: number) {
    return apiClient.post(`/courses/${courseId}/leave`, { userId })
  }

  async getUserRoleInCourse(userId: number, courseId: CourseId): Promise<CourseRoles> {
    const response = await apiClient.get<string | null>(`/courses/${courseId}/user/${userId}/role`)
    return normalizeCourseRole(response.data)
  }

  changeUserRole(courseId: CourseId, userId: number, role: string) {
    return apiClient.put(`/courses/${courseId}/user/${userId}/role`, { role })
  }

  deleteCourse(courseId: CourseId) {
    return apiClient.delete(`/courses/${courseId}`)
  }

  async getCourseMembers(courseId: CourseId, courseRunId?: string) {
    const path = courseRunId ? `/courses/${courseId}/runs/${courseRunId}/enrollments` : `/courses/${courseId}/members`
    const response = await apiClient.get<MaybeListResponse<BackendEnrollment>>(path)
    return {
      data: readListResponse(response.data, 'Kursmitglieder').map(mapEnrollmentToMember)
    }
  }

  async listCourseVersions(courseId: CourseId, courseRunId?: string): Promise<CourseVersion[]> {
    const path = courseRunId ? `/courses/${courseId}/runs/${courseRunId}/versions` : `/courses/${courseId}/versions`
    const response = await apiClient.get<MaybeListResponse<BackendCourseVersion>>(path)

    return readListResponse(response.data, 'Kursversionen').map(mapCourseVersionFromBackend)
  }

  async listCourseVersionTemplates(courseId: CourseId): Promise<CourseVersion[]> {
    const response = await apiClient.get<MaybeListResponse<BackendCourseVersion>>(`/courses/${courseId}/content-version-templates`)

    return readListResponse(response.data, 'Kursversionsvorlagen').map(mapCourseVersionFromBackend)
  }

  async getCourseVersion(courseId: CourseId, versionId: string): Promise<CourseVersion> {
    const response = await apiClient.get<BackendCourseVersion>(`/courses/${courseId}/versions/${versionId}`)

    return mapCourseVersionFromBackend(response.data)
  }

  async createCourseVersion(
    courseId: CourseId,
    changeSummary: string,
    activate = true,
    courseRunId?: string,
    options: { copyMode?: 'ACTIVE' | 'SOURCE' | 'EMPTY'; sourceVersionId?: string; label?: string } = {}
  ): Promise<CourseVersion> {
    const path = courseRunId ? `/courses/${courseId}/runs/${courseRunId}/versions` : `/courses/${courseId}/versions`
    const payload: Record<string, unknown> = {
      activate,
      changeSummary
    }

    if (options.copyMode) payload.copyMode = options.copyMode
    if (options.sourceVersionId) payload.sourceVersionId = options.sourceVersionId
    if (options.label) payload.label = options.label

    const response = await apiClient.post<BackendCourseVersion>(path, payload)

    return mapCourseVersionFromBackend(response.data)
  }

  async activateCourseVersion(courseId: CourseId, versionId: string, courseRunId?: string): Promise<CourseVersion> {
    const path = courseRunId
      ? `/courses/${courseId}/runs/${courseRunId}/versions/${versionId}/activate`
      : `/courses/${courseId}/versions/${versionId}/activate`
    const response = await apiClient.post<BackendCourseVersion>(path)

    return mapCourseVersionFromBackend(response.data)
  }

  async listCourseRuns(courseId: CourseId): Promise<CourseRun[]> {
    const response = await apiClient.get<MaybeListResponse<BackendCourseRun>>(`/courses/${courseId}/runs`)

    return readListResponse(response.data, 'Kursdurchläufe').map(mapCourseRunFromBackend)
  }

  async getCurrentCourseRun(courseId: CourseId): Promise<CourseRun> {
    const response = await apiClient.get<BackendCourseRun>(`/courses/${courseId}/runs/current`)

    return mapCourseRunFromBackend(response.data)
  }

  async createCourseRun(courseId: CourseId, payload: CreateCourseRunPayload = {}): Promise<CourseRun> {
    const response = await apiClient.post<BackendCourseRun>(`/courses/${courseId}/runs/next`, payload)

    return mapCourseRunFromBackend(response.data)
  }

  async createSpecialCourseRun(courseId: CourseId, payload: CreateCourseRunPayload = {}): Promise<CourseRun> {
    const response = await apiClient.post<BackendCourseRun>(`/courses/${courseId}/runs/special`, payload)

    return mapCourseRunFromBackend(response.data)
  }

  async getCourseRunPlan(courseId: CourseId): Promise<CourseRunPlan> {
    const response = await apiClient.get<BackendCourseRunPlan>(`/courses/${courseId}/run-plan`)

    return mapCourseRunPlanFromBackend(response.data)
  }

  async updateCourseRunPlanTemplate(courseId: CourseId, payload: UpdateCourseRunPlanTemplatePayload): Promise<CourseRunPlan> {
    const response = await apiClient.post<BackendCourseRunPlan>(`/courses/${courseId}/run-plan/template`, payload)

    return mapCourseRunPlanFromBackend(response.data)
  }

  async activateCourseRun(courseId: CourseId, runId: string): Promise<CourseRun> {
    const response = await apiClient.post<BackendCourseRun>(`/courses/${courseId}/runs/${runId}/activate`)

    return mapCourseRunFromBackend(response.data)
  }

  async deleteOrArchiveCourseRun(courseId: CourseId, runId: string): Promise<CourseRunDeletion> {
    const response = await apiClient.delete<BackendCourseRunDeletion>(`/courses/${courseId}/runs/${runId}`)

    return mapCourseRunDeletionFromBackend(response.data)
  }

  async deleteCourseVersion(courseId: CourseId, courseRunId: string, versionId: string): Promise<void> {
    await apiClient.delete(`/courses/${courseId}/runs/${courseRunId}/versions/${versionId}`)
  }

  async listAuditEvents(courseId: CourseId, query: AuditEventQuery = {}): Promise<AuditEvent[]> {
    const path = query.courseRunId
      ? `/courses/${courseId}/runs/${query.courseRunId}/audit-events`
      : `/courses/${courseId}/audit-events`
    const response = await apiClient.get<MaybeListResponse<BackendAuditEvent>>(path, {
      params: {
        eventType: query.eventType || undefined,
        from: query.from || undefined,
        to: query.to || undefined,
        limit: query.limit
      }
    })

    return readListResponse(response.data, 'Audit-Ereignisse').map(mapAuditEventFromBackend)
  }

  async listStudyGroups(courseId: CourseId, courseRunId: string): Promise<StudyGroup[]> {
    const response = await apiClient.get<MaybeListResponse<StudyGroup>>(`/courses/${courseId}/runs/${courseRunId}/groups`)

    return readListResponse(response.data, 'Gruppen')
  }

  async getMyStudyGroup(courseId: CourseId, courseRunId: string): Promise<StudyGroup | null> {
    const response = await apiClient.get<StudyGroup | null>(`/courses/${courseId}/runs/${courseRunId}/groups/my`)

    return response.data
  }

  async createStudyGroup(courseId: CourseId, courseRunId: string, payload: { name: string; description?: string | null }): Promise<StudyGroup> {
    const response = await apiClient.post<StudyGroup>(`/courses/${courseId}/runs/${courseRunId}/groups`, payload)

    return response.data
  }

  async updateStudyGroup(courseId: CourseId, courseRunId: string, groupId: string, payload: { name?: string; description?: string | null }): Promise<StudyGroup> {
    const response = await apiClient.put<StudyGroup>(`/courses/${courseId}/runs/${courseRunId}/groups/${groupId}`, payload)

    return response.data
  }

  async deleteStudyGroup(courseId: CourseId, courseRunId: string, groupId: string): Promise<void> {
    await apiClient.delete(`/courses/${courseId}/runs/${courseRunId}/groups/${groupId}`)
  }

  async addStudyGroupMember(courseId: CourseId, courseRunId: string, groupId: string, studentId: string | number): Promise<StudyGroup> {
    const response = await apiClient.post<StudyGroup>(`/courses/${courseId}/runs/${courseRunId}/groups/${groupId}/members`, { studentId })

    return response.data
  }

  async removeStudyGroupMember(courseId: CourseId, courseRunId: string, groupId: string, studentId: string | number): Promise<StudyGroup> {
    const response = await apiClient.delete<StudyGroup>(`/courses/${courseId}/runs/${courseRunId}/groups/${groupId}/members/${studentId}`)

    return response.data
  }

  getCourseMembersAsMap(courseId: CourseId, courseRunId?: string): Promise<Map<number, Member>> {
    const map: Map<number, Member> = new Map()
    return new Promise<Map<number, Member>>((resolve) => {
      this.getCourseMembers(courseId, courseRunId).then((response) => {
        response.data.forEach((element: Member) => {
          map.set(element.user.id, element)
        })
        resolve(map)
      })
    })
  }
}

export default new CourseService()
