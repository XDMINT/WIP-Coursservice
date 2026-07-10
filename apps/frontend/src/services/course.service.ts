import type CoursePL from '../model/course/CoursePL'
import type CourseAndParticipationPL from '../model/course/CourseAndParticipationPL'
import type Member from '../model/course/Member'
import CourseRoles from '@/enums/CourseRoles'
import { apiClient } from './apiClient'

type CourseId = string | number

type BackendCourse = {
  id: string
  title: string
  description?: string
  semester?: string
  status?: string
  created_at?: string
  createdAt?: string
  owner_id?: number
  ownerId?: number
  key_password?: string
  keyPassword?: string
  requiresEnrollmentKey?: boolean
  location?: string
}

type BackendEnrollment = {
  id?: string
  userId?: string
  user_id?: string
  role: string
}

export type CoursePermissionKey = 'course.content.read' | 'course.content.manage' | 'course.manage' | 'course.members.manage' | 'course.results.own.read' | 'course.results.all.read'

export type CourseContext = {
  course: CoursePL
  role: CourseRoles
  permissions: Record<CoursePermissionKey, boolean>
}

type BackendCourseContext = {
  course: BackendCourse
  membership: {
    userId: string
    role: string
  }
  permissions: Record<CoursePermissionKey, boolean>
}

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
  creationDate: course.created_at ?? course.createdAt ?? '',
  semester: {
    id: 0,
    name: course.semester ?? 'Unbekanntes Semester',
    startDate: '2000-01-01',
    endDate: '2099-12-31'
  },
  owner: course.owner_id ?? course.ownerId ?? 0,
  keyPassword: course.key_password ?? course.keyPassword ?? '',
  requiresEnrollmentKey: course.requiresEnrollmentKey ?? Boolean(course.key_password ?? course.keyPassword),
  location: course.location ?? ''
})

const mapCourseToBackend = (course: CoursePL) => ({
  title: course.name,
  description: course.description,
  semester: course.semester?.name,
  status: course.active === false ? 'DRAFT' : 'PUBLISHED',
  ownerId: course.owner,
  keyPassword: course.keyPassword,
  location: course.location
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
      permissions: response.data.permissions
    }
  }

  async getAllCourses(userId: number): Promise<CourseAndParticipationPL[]> {
    const response = await apiClient.get<BackendCourse[]>('/courses', {
      params: { userId }
    })

    return response.data.map((course) => ({
      course: mapCourseFromBackend(course),
      member: true
    }))
  }

  async postCourse(course: CoursePL) {
    const response = await apiClient.post<BackendCourse>('/courses', mapCourseToBackend(course))
    return { data: mapCourseFromBackend(response.data) }
  }

  async putCourse(course: CoursePL) {
    const response = await apiClient.put<BackendCourse>(`/courses/${course.id}`, mapCourseToBackend(course))
    return { data: mapCourseFromBackend(response.data) }
  }

  joinCourse(courseId: CourseId, key: string, userId: number) {
    return apiClient.post(`/courses/${courseId}/join`, { key, userId })
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

  async getCourseMembers(courseId: CourseId) {
    const response = await apiClient.get<BackendEnrollment[]>(`/courses/${courseId}/members`)
    return { data: response.data.map(mapEnrollmentToMember) }
  }

  getCourseMembersAsMap(courseId: CourseId): Promise<Map<number, Member>> {
    const map: Map<number, Member> = new Map()
    return new Promise<Map<number, Member>>((resolve) => {
      this.getCourseMembers(courseId).then((response) => {
        response.data.forEach((element: Member) => {
          map.set(element.user.id, element)
        })
        resolve(map)
      })
    })
  }
}

export default new CourseService()
