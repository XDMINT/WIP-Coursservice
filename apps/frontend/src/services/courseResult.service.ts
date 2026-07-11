import { apiClient } from './apiClient'

export enum CourseResultMode {
  AUTOMATIC = 'AUTOMATIC',
  MANUAL = 'MANUAL'
}

export enum CourseResultSource {
  AUTOMATIC_CALCULATION = 'AUTOMATIC_CALCULATION',
  MANUAL_ENTRY = 'MANUAL_ENTRY',
  MANUAL_OVERRIDE = 'MANUAL_OVERRIDE'
}

export enum CoursePassStatus {
  FAILED = 'FAILED',
  NOT_ASSESSED = 'NOT_ASSESSED',
  PASSED = 'PASSED'
}

export type CourseResult = {
  id?: string
  courseId: string
  enrollmentId: string
  studentId: string
  assessmentMode?: CourseResultMode
  pointsAchieved?: number | null
  maxPoints?: number | null
  percentage?: number | null
  manualGrade?: string | null
  passStatus: CoursePassStatus
  source?: CourseResultSource
  comment?: string | null
  gradedBy?: string | null
  gradedAt?: string | null
  updatedAt?: string | null
  sourceDetails?: Record<string, unknown> | null
}

export type CourseResultList = {
  items: CourseResult[]
  page: number
  pageSize: number
  total: number
}

export type CourseResultListParams = {
  page?: number
  pageSize?: number
  passStatus?: CoursePassStatus | ''
  source?: CourseResultSource | ''
}

export type ManualCourseResultInput = {
  pointsAchieved?: number | null
  maxPoints?: number | null
  manualGrade?: string | null
  passStatus: CoursePassStatus
  comment?: string | null
}

export const formatPassStatus = (status?: CoursePassStatus): string => {
  const labels: Record<CoursePassStatus, string> = {
    [CoursePassStatus.FAILED]: 'Nicht bestanden',
    [CoursePassStatus.NOT_ASSESSED]: 'Noch nicht bewertet',
    [CoursePassStatus.PASSED]: 'Bestanden'
  }

  return status ? labels[status] : labels[CoursePassStatus.NOT_ASSESSED]
}

export const formatResultSource = (source?: CourseResultSource): string => {
  if (!source) return 'Keine Bewertung'

  const labels: Record<CourseResultSource, string> = {
    [CourseResultSource.AUTOMATIC_CALCULATION]: 'Automatisch berechnet',
    [CourseResultSource.MANUAL_ENTRY]: 'Manuell eingetragen',
    [CourseResultSource.MANUAL_OVERRIDE]: 'Manuell überschrieben'
  }

  return labels[source]
}

export const formatResultMode = (mode?: CourseResultMode): string => {
  if (!mode) return 'Offen'

  const labels: Record<CourseResultMode, string> = {
    [CourseResultMode.AUTOMATIC]: 'Automatisch',
    [CourseResultMode.MANUAL]: 'Manuell'
  }

  return labels[mode]
}

export const formatPoints = (value?: number | null): string => {
  if (value === null || value === undefined) return '-'

  return new Intl.NumberFormat('de-DE', {
    maximumFractionDigits: 2
  }).format(value)
}

export const formatPercentage = (value?: number | null): string => {
  if (value === null || value === undefined) return '-'

  return `${new Intl.NumberFormat('de-DE', {
    maximumFractionDigits: 2
  }).format(value)} %`
}

class CourseResultService {
  async getMyResult(courseId: string | number): Promise<CourseResult> {
    const response = await apiClient.get<CourseResult>(`/courses/${courseId}/results/me`)

    return response.data
  }

  async listResults(courseId: string | number, params: CourseResultListParams = {}): Promise<CourseResultList> {
    const response = await apiClient.get<CourseResultList>(`/courses/${courseId}/results`, {
      params: {
        page: params.page,
        pageSize: params.pageSize,
        passStatus: params.passStatus || undefined,
        source: params.source || undefined
      }
    })

    return response.data
  }

  async saveManualResult(courseId: string | number, studentId: string, input: ManualCourseResultInput): Promise<CourseResult> {
    const response = await apiClient.put<CourseResult>(`/courses/${courseId}/results/${studentId}/manual`, input)

    return response.data
  }

  async recalculateResult(courseId: string | number, studentId: string): Promise<CourseResult> {
    const response = await apiClient.post<CourseResult>(`/courses/${courseId}/results/${studentId}/recalculate`)

    return response.data
  }

  async recalculateAll(courseId: string | number): Promise<CourseResultList> {
    const response = await apiClient.post<CourseResultList>(`/courses/${courseId}/results/recalculate`)

    return response.data
  }
}

export default new CourseResultService()
