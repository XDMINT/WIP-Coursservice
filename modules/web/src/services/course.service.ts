import type CoursePL from '../model/course/CoursePL'
import type CourseAndParticipationPL from '../model/course/CourseAndParticipationPL'
import type Member from '../model/course/Member'
import type CourseRoles from '@/enums/CourseRoles'
import { changeUserRole, getCourseById, getCourseMembers, getUserRoleInCourse, joinCourse, leaveCourse, listCoursesForUser, removeCourse, upsertCourse } from './mockData'

class CourseService {
  getCourse(id: number): Promise<{ data: CoursePL }> {
    return new Promise((resolve, reject) => {
      const course = getCourseById(id)

      if (!course) {
        reject(new Error('Course not found'))
        return
      }

      resolve({ data: course })
    })
  }

  getAllCourses(userId: number): Promise<CourseAndParticipationPL[]> {
    return Promise.resolve(listCoursesForUser(userId))
  }

  postCourse(course: CoursePL) {
    const ownerId = course.owner ?? 0
    const savedCourse = upsertCourse(course, ownerId)
    return Promise.resolve({ data: savedCourse })
  }

  putCourse(course: CoursePL) {
    const savedCourse = upsertCourse(course, course.owner)
    return Promise.resolve({ data: savedCourse })
  }

  joinCourse(courseId: number, key: string, userId: number) {
    joinCourse(courseId, key, userId)
    return Promise.resolve({ status: 200 })
  }

  leaveCourse(courseId: number, userId?: number) {
    leaveCourse(courseId, userId)
    return Promise.resolve({ status: 200 })
  }

  getUserRoleInCourse(userId: number, courseId: number): Promise<CourseRoles> {
    return Promise.resolve(getUserRoleInCourse(userId, courseId))
  }

  changeUserRole(courseId: number, userId: number, role: string) {
    changeUserRole(courseId, userId, role)
    return Promise.resolve({ status: 200 })
  }

  deleteCourse(courseId: number) {
    removeCourse(courseId)
    return Promise.resolve({ status: 200 })
  }

  getCourseMembers(courseId: number) {
    return Promise.resolve({ data: getCourseMembers(courseId) })
  }

  getCourseMembersAsMap(courseId: number): Promise<Map<number, Member>> {
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
