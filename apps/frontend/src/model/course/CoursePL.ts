import type Semester from '../Semester'

export default interface CoursePL {
  id: string | number
  name: string
  description: string
  active: boolean
  status?: string
  recurrenceType?: 'SEMESTER' | 'YEARLY' | 'CONTINUOUS'
  creationDate: string
  semester: Semester
  owner: number
  keyPassword: string
  requiresEnrollmentKey?: boolean
  location: string
  currentRun?: {
    id: string
    label: string
    startDate?: string
    endDate?: string
    status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
    isActive: boolean
  }
  initialRunLabel?: string
  initialRunStartDate?: string
  initialRunEndDate?: string
}
