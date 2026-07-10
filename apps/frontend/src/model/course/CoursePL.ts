import type Semester from '../Semester'

export default interface CoursePL {
  id: string | number
  name: string
  description: string
  active: boolean
  creationDate: string
  semester: Semester
  owner: number
  keyPassword: string
  requiresEnrollmentKey?: boolean
  location: string
}
