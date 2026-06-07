import type CourseAndParticipationPL from '@/model/course/CourseAndParticipationPL'
import type CoursePL from '@/model/course/CoursePL'
import type Member from '@/model/course/Member'
import type Semester from '@/model/Semester'
import type User from '@/model/User'
import GlobalRoles from '@/enums/GlobalRoles'
import CourseRoles from '@/enums/CourseRoles'

type DemoDatabase = {
  semesters: Semester[]
  courses: CoursePL[]
  membersByCourseId: Record<number, Member[]>
}

const STORAGE_KEY = 'vue-web-template-demo-database'

const createUser = (id: number, username: string, email: string, roles: GlobalRoles[]): User => ({
  token: `demo-token-${id}`,
  id,
  username,
  email,
  roles,
  type: 'Bearer'
})

export const demoUsers = {
  admin: createUser(1, 'admin', 'admin@demo.local', [GlobalRoles.ROLE_ADMIN, GlobalRoles.ROLE_USER]),
  tutor: createUser(2, 'tutor', 'tutor@demo.local', [GlobalRoles.ROLE_USER]),
  student: createUser(3, 'student', 'student@demo.local', [GlobalRoles.ROLE_USER])
}

export const createDemoUserFromUsername = (username: string): User => {
  const normalized = username.trim().toLowerCase()

  if (normalized.includes('admin')) {
    return { ...demoUsers.admin, username, email: `${username}@demo.local`, token: `demo-token-${username}` }
  }

  if (normalized.includes('tutor')) {
    return { ...demoUsers.tutor, username, email: `${username}@demo.local`, token: `demo-token-${username}` }
  }

  return { ...demoUsers.student, username, email: `${username}@demo.local`, token: `demo-token-${username}` }
}

const createSemester = (id: number, name: string, startDate: string, endDate: string): Semester => ({
  id,
  name,
  startDate,
  endDate
})

const createCourse = (id: number, name: string, description: string, semester: Semester, owner: number, keyPassword: string, location: string, active = true, creationDate = new Date().toISOString()): CoursePL => ({
  id,
  name,
  description,
  active,
  creationDate,
  semester,
  owner,
  keyPassword,
  location
})

const createMember = (user: User, role: string): Member => ({
  user: {
    id: user.id,
    username: user.username,
    firstName: user.username,
    lastName: role === CourseRoles.OWNER ? 'Administrator' : role === CourseRoles.TUTOR ? 'Tutor' : 'Student',
    roles: user.roles.map((entry, index) => ({
      id: index + 1,
      name: entry
    }))
  },
  role
})

const createDefaultDatabase = (): DemoDatabase => {
  const spring = createSemester(1, 'Sommersemester 2026', '2026-03-01', '2026-09-30')
  const winter = createSemester(2, 'Wintersemester 2025/26', '2025-10-01', '2026-02-28')
  const nextWinter = createSemester(3, 'Wintersemester 2026/27', '2026-10-01', '2027-02-28')

  const courses = [
    createCourse(1, 'Software Engineering Grundlagen', 'Grundlagen der Teamarbeit, Versionsverwaltung und sauberer Architektur in studentischen Projekten.', spring, demoUsers.admin.id, '', 'Gießen', true, '2026-03-08T08:30:00.000Z'),
    createCourse(2, 'Webentwicklung im Projekt', 'Ein Beispielkurs für Einsteigerinnen und Einsteiger mit Vue, Routing und Formularen.', spring, demoUsers.tutor.id, 'web123', 'Friedberg', true, '2026-04-12T09:00:00.000Z'),
    createCourse(3, 'Einführung in Informationssysteme', 'Historische Beispielkurse können weiterhin als Vorlage dienen, auch wenn das Backend später ersetzt wird.', winter, demoUsers.admin.id, '', 'Gießen', false, '2025-10-15T10:15:00.000Z')
  ]

  return {
    semesters: [spring, winter, nextWinter],
    courses,
    membersByCourseId: {
      1: [createMember(demoUsers.admin, CourseRoles.OWNER), createMember(demoUsers.tutor, CourseRoles.TUTOR), createMember(demoUsers.student, CourseRoles.STUDENT)],
      2: [createMember(demoUsers.tutor, CourseRoles.OWNER)],
      3: [createMember(demoUsers.admin, CourseRoles.OWNER), createMember(demoUsers.student, CourseRoles.STUDENT)]
    }
  }
}

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value))

const loadDatabase = (): DemoDatabase => {
  const stored = localStorage.getItem(STORAGE_KEY)

  if (!stored) {
    return createDefaultDatabase()
  }

  try {
    return JSON.parse(stored) as DemoDatabase
  } catch {
    return createDefaultDatabase()
  }
}

const database = loadDatabase()

const persist = () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(database))
}

const nextCourseId = () => Math.max(...database.courses.map((course) => course.id), 0) + 1

export const listSemesters = () => clone(database.semesters)

export const listCoursesForUser = (userId: number): CourseAndParticipationPL[] =>
  database.courses.map((course) => ({
    course: clone(course),
    member: getCourseMembers(course.id).some((member) => member.user.id === userId)
  }))

export const getCourseById = (courseId: number): CoursePL | undefined => clone(database.courses.find((course) => course.id === courseId))

export const upsertCourse = (course: CoursePL, ownerId: number): CoursePL => {
  const existingIndex = database.courses.findIndex((entry) => entry.id === course.id)
  const savedCourse = {
    ...clone(course),
    id: course.id && course.id > 0 ? course.id : nextCourseId(),
    owner: ownerId,
    creationDate: course.creationDate || new Date().toISOString()
  }

  if (existingIndex >= 0) {
    database.courses[existingIndex] = savedCourse
  } else {
    database.courses.push(savedCourse)
    database.membersByCourseId[savedCourse.id] = [createMember(demoUsers.admin.id === ownerId ? demoUsers.admin : ownerId === demoUsers.tutor.id ? demoUsers.tutor : demoUsers.student, CourseRoles.OWNER)]
  }

  persist()
  return clone(savedCourse)
}

export const removeCourse = (courseId: number) => {
  database.courses = database.courses.filter((course) => course.id !== courseId)
  delete database.membersByCourseId[courseId]
  persist()
}

export const joinCourse = (courseId: number, key: string, userId: number) => {
  const course = database.courses.find((entry) => entry.id === courseId)

  if (!course) {
    throw new Error('Course not found')
  }

  if (course.keyPassword !== '' && course.keyPassword !== key) {
    const error = new Error('Invalid course key') as Error & { response?: { status: number } }
    error.response = { status: 403 }
    throw error
  }

  const memberList = database.membersByCourseId[courseId] ?? []
  const existingMember = memberList.find((member) => member.user.id === userId)

  if (!existingMember) {
    const user = userId === demoUsers.admin.id ? demoUsers.admin : userId === demoUsers.tutor.id ? demoUsers.tutor : demoUsers.student
    memberList.push(createMember(user, CourseRoles.STUDENT))
  }

  database.membersByCourseId[courseId] = memberList
  persist()
}

export const leaveCourse = (courseId: number, userId?: number) => {
  if (userId == null) {
    return
  }

  const memberList = database.membersByCourseId[courseId] ?? []
  database.membersByCourseId[courseId] = memberList.filter((member) => member.user.id !== userId || member.role === CourseRoles.OWNER)
  persist()
}

export const getUserRoleInCourse = (userId: number, courseId: number) => {
  const course = database.courses.find((entry) => entry.id === courseId)

  if (!course) {
    return CourseRoles.NONE
  }

  if (course.owner === userId) {
    return CourseRoles.OWNER
  }

  const member = getCourseMembers(courseId).find((entry) => entry.user.id === userId)
  return (member?.role as CourseRoles) ?? CourseRoles.NONE
}

export const changeUserRole = (courseId: number, userId: number, role: string) => {
  const memberList = database.membersByCourseId[courseId] ?? []
  const member = memberList.find((entry) => entry.user.id === userId)

  if (member) {
    member.role = role
  } else {
    const user = userId === demoUsers.admin.id ? demoUsers.admin : userId === demoUsers.tutor.id ? demoUsers.tutor : demoUsers.student
    memberList.push(createMember(user, role))
  }

  database.membersByCourseId[courseId] = memberList
  persist()
}

export const getCourseMembers = (courseId: number): Member[] => clone(database.membersByCourseId[courseId] ?? [])
