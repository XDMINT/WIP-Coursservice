import type CoursePL from './CoursePL'

export default interface CourseAndParticipationPL {
  course: CoursePL
  member: boolean
  canEnroll?: boolean
  membershipRole?: string
}
