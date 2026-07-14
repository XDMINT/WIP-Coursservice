import { apiClient } from './apiClient'

export enum TaskUnlockMode {
  IMMEDIATE = 'IMMEDIATE',
  AUTOMATIC = 'AUTOMATIC',
  MANUAL = 'MANUAL'
}

export enum TaskProgressStatus {
  LOCKED = 'LOCKED',
  AVAILABLE = 'AVAILABLE',
  IN_PROGRESS = 'IN_PROGRESS',
  SUBMITTED = 'SUBMITTED',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED'
}

export enum TaskGradingMode {
  NOT_GRADED = 'NOT_GRADED',
  SELF_CONFIRMATION = 'SELF_CONFIRMATION',
  MANUAL = 'MANUAL',
  AUTOMATIC_MOCK = 'AUTOMATIC_MOCK'
}

export enum TaskWorkMode {
  INDIVIDUAL = 'INDIVIDUAL',
  GROUP = 'GROUP'
}

export enum TaskAssessmentStatus {
  NOT_SUBMITTED = 'NOT_SUBMITTED',
  SUBMITTED = 'SUBMITTED',
  PENDING_REVIEW = 'PENDING_REVIEW',
  PASSED = 'PASSED',
  FAILED = 'FAILED',
  AUTO_EVALUATED = 'AUTO_EVALUATED'
}

export enum TaskUnlockSource {
  IMMEDIATE = 'IMMEDIATE',
  AUTOMATIC = 'AUTOMATIC',
  MANUAL = 'MANUAL'
}

export type LearningTask = {
  id: string
  courseId: string
  courseRunId?: string
  courseVersionId?: string
  title: string
  description: string
  type: string
  order: number
  unlockMode: TaskUnlockMode
  prerequisiteTaskId?: string
  completionCriteria?: Record<string, unknown>
  gradingMode: TaskGradingMode
  workMode?: TaskWorkMode
  maxPoints?: number | null
  passThreshold?: number | null
  feedbackRequired: boolean
  allowRetries: boolean
  isPublished: boolean
  demoKey?: string
  createdAt?: string
  updatedAt?: string
}

export type StudentLearningTask = LearningTask & {
  status: TaskProgressStatus
  completionPercentage: number
  locked: boolean
  lockedReason?: string
  unlockedAt?: string
  startedAt?: string
  completedAt?: string
  resultPassed?: boolean
  unlockSource?: TaskUnlockSource
  assessment?: TaskAssessment | null
  group?: StudentTaskGroupContext | null
}

export type LearningPath = {
  courseId: string
  studentId: string
  totalTasks: number
  completedTasks: number
  inProgressTasks: number
  availableTasks: number
  failedTasks: number
  lockedTasks: number
  progressPercentage: number
  tasks: StudentLearningTask[]
}

export type LearningTaskProgress = {
  taskId: string
  title: string
  order: number
  status: TaskProgressStatus
  completionPercentage: number
  unlockedAt?: string
  startedAt?: string
  completedAt?: string
  resultPassed?: boolean
  unlockSource?: TaskUnlockSource
  assessment?: TaskAssessment | null
  groupId?: string | null
  groupName?: string | null
}

export type TaskAssessment = {
  id: string
  courseRunId: string
  courseVersionId: string
  taskId: string
  assessmentTargetType: 'INDIVIDUAL' | 'GROUP'
  studentId?: string | null
  groupId?: string | null
  gradingMode: TaskGradingMode
  status: TaskAssessmentStatus
  points?: number | null
  maxPoints?: number | null
  passThreshold?: number | null
  passed?: boolean | null
  feedback?: string | null
  assessedBy?: string | null
  assessedAt?: string | null
  createdAt?: string
  updatedAt?: string
}

export type StudentTaskGroupContext = {
  id: string
  name: string
  status?: TaskProgressStatus
  startedAt?: string | null
  submittedAt?: string | null
  completedAt?: string | null
}

export type StudentProgressOverview = {
  enrollmentId: string
  studentId: string
  totalTasks: number
  completedTasks: number
  inProgressTasks: number
  availableTasks: number
  failedTasks: number
  lockedTasks: number
  progressPercentage: number
  tasks: LearningTaskProgress[]
}

export type UpsertLearningTaskInput = {
  title?: string
  description?: string
  type?: string
  order?: number
  unlockMode?: TaskUnlockMode
  prerequisiteTaskId?: string | null
  completionCriteria?: Record<string, unknown>
  gradingMode?: TaskGradingMode
  workMode?: TaskWorkMode
  maxPoints?: number | null
  passThreshold?: number | null
  feedbackRequired?: boolean
  allowRetries?: boolean
  isPublished?: boolean
}

class LearningTaskService {
  async listTasks(courseId: string | number, courseRunId?: string, courseVersionId?: string): Promise<LearningTask[]> {
    const path = courseRunId && courseVersionId
      ? `/courses/${courseId}/runs/${courseRunId}/versions/${courseVersionId}/tasks`
      : courseRunId ? `/courses/${courseId}/runs/${courseRunId}/tasks` : `/courses/${courseId}/tasks`
    const response = await apiClient.get<LearningTask[]>(path)
    return response.data
  }

  async getMyLearningPath(courseId: string | number): Promise<LearningPath> {
    const response = await apiClient.get<LearningPath>(`/courses/${courseId}/tasks/my-progress`)
    return response.data
  }

  async getProgressOverview(courseId: string | number, courseRunId?: string): Promise<StudentProgressOverview[]> {
    const path = courseRunId ? `/courses/${courseId}/runs/${courseRunId}/progress` : `/courses/${courseId}/tasks/progress-overview`
    const response = await apiClient.get<StudentProgressOverview[]>(path)
    return response.data
  }

  async createTask(courseId: string | number, input: UpsertLearningTaskInput): Promise<LearningTask> {
    const response = await apiClient.post<LearningTask>(`/courses/${courseId}/tasks`, input)
    return response.data
  }

  async updateTask(taskId: string, input: UpsertLearningTaskInput): Promise<LearningTask> {
    const response = await apiClient.put<LearningTask>(`/courses/tasks/${taskId}`, input)
    return response.data
  }

  async updateReleaseConfig(taskId: string, input: Pick<UpsertLearningTaskInput, 'prerequisiteTaskId' | 'unlockMode'>): Promise<LearningTask> {
    const response = await apiClient.put<LearningTask>(`/courses/tasks/${taskId}/release-config`, input)
    return response.data
  }

  async updateSortOrder(courseId: string | number, items: Array<{ id: string; order: number }>): Promise<LearningTask[]> {
    const response = await apiClient.put<LearningTask[]>(`/courses/${courseId}/tasks/sort-order`, { items })
    return response.data
  }

  async deleteTask(taskId: string): Promise<void> {
    await apiClient.delete(`/courses/tasks/${taskId}`)
  }

  async startTask(taskId: string): Promise<LearningPath> {
    const response = await apiClient.post<LearningPath>(`/courses/tasks/${taskId}/start`)
    return response.data
  }

  async completeTask(taskId: string): Promise<LearningPath> {
    const response = await apiClient.post<LearningPath>(`/courses/tasks/${taskId}/complete`)
    return response.data
  }

  async submitTask(taskId: string, submissionData: Record<string, unknown> = {}): Promise<LearningPath> {
    const response = await apiClient.post<LearningPath>(`/courses/tasks/${taskId}/submit`, { submissionData })
    return response.data
  }

  async startGroupTask(taskId: string): Promise<LearningPath> {
    const response = await apiClient.post<LearningPath>(`/courses/tasks/${taskId}/group/start`)
    return response.data
  }

  async submitGroupTask(taskId: string, submissionData: Record<string, unknown> = {}): Promise<LearningPath> {
    const response = await apiClient.post<LearningPath>(`/courses/tasks/${taskId}/group/submit`, { submissionData })
    return response.data
  }

  async selfConfirmTask(taskId: string): Promise<LearningPath> {
    const response = await apiClient.post<LearningPath>(`/courses/tasks/${taskId}/self-confirm`)
    return response.data
  }

  async mockEvaluateTask(taskId: string, passed = true): Promise<LearningPath> {
    const response = await apiClient.post<LearningPath>(`/courses/tasks/${taskId}/mock-evaluate`, { passed })
    return response.data
  }

  async failTask(taskId: string): Promise<LearningPath> {
    const response = await apiClient.post<LearningPath>(`/courses/tasks/${taskId}/fail`)
    return response.data
  }

  async assessTaskManually(courseId: string | number, runId: string, taskId: string, studentId: string | number, input: { points?: number | null; maxPoints?: number | null; passed?: boolean; feedback?: string | null }): Promise<TaskAssessment> {
    const response = await apiClient.post<TaskAssessment>(`/courses/${courseId}/runs/${runId}/tasks/${taskId}/assessments/${studentId}/manual`, input)
    return response.data
  }

  async assessGroupTaskManually(courseId: string | number, runId: string, taskId: string, groupId: string, input: { points?: number | null; maxPoints?: number | null; passed?: boolean; feedback?: string | null }): Promise<TaskAssessment> {
    const response = await apiClient.put<TaskAssessment>(`/courses/${courseId}/runs/${runId}/tasks/${taskId}/groups/${groupId}/manual-assessment`, input)
    return response.data
  }

  async resetTaskAssessment(courseId: string | number, runId: string, taskId: string, studentId: string | number): Promise<TaskAssessment> {
    const response = await apiClient.post<TaskAssessment>(`/courses/${courseId}/runs/${runId}/tasks/${taskId}/assessments/${studentId}/reset`)
    return response.data
  }

  async listTaskAssessments(courseId: string | number, runId: string, taskId?: string): Promise<TaskAssessment[]> {
    const path = taskId
      ? `/courses/${courseId}/runs/${runId}/tasks/${taskId}/assessments`
      : `/courses/${courseId}/runs/${runId}/assessments`
    const response = await apiClient.get<TaskAssessment[]>(path)
    return response.data
  }

  async manuallyUnlockTask(taskId: string, studentId: string | number): Promise<StudentProgressOverview> {
    const response = await apiClient.post<StudentProgressOverview>(`/courses/tasks/${taskId}/manual-unlock`, { studentId })
    return response.data
  }
}

export const formatTaskStatus = (status: TaskProgressStatus): string => {
  const labels: Record<TaskProgressStatus, string> = {
    [TaskProgressStatus.AVAILABLE]: 'Verfügbar',
    [TaskProgressStatus.COMPLETED]: 'Erfolgreich abgeschlossen',
    [TaskProgressStatus.FAILED]: 'Nicht erfolgreich abgeschlossen',
    [TaskProgressStatus.IN_PROGRESS]: 'Begonnen',
    [TaskProgressStatus.SUBMITTED]: 'Wartet auf Bewertung',
    [TaskProgressStatus.LOCKED]: 'Gesperrt'
  }

  return labels[status] ?? status
}

export const formatGradingMode = (mode: TaskGradingMode): string => {
  const labels: Record<TaskGradingMode, string> = {
    [TaskGradingMode.AUTOMATIC_MOCK]: 'Automatisch bewertet (Mock)',
    [TaskGradingMode.MANUAL]: 'Manuelle Bewertung',
    [TaskGradingMode.NOT_GRADED]: 'Keine Bewertung',
    [TaskGradingMode.SELF_CONFIRMATION]: 'Selbstbestätigung'
  }

  return labels[mode] ?? mode
}

export const formatTaskWorkMode = (mode?: TaskWorkMode): string => {
  const labels: Record<TaskWorkMode, string> = {
    [TaskWorkMode.INDIVIDUAL]: 'Einzelaufgabe',
    [TaskWorkMode.GROUP]: 'Gruppenaufgabe'
  }

  return labels[mode ?? TaskWorkMode.INDIVIDUAL] ?? 'Einzelaufgabe'
}

export const formatAssessmentStatus = (status?: TaskAssessmentStatus): string => {
  if (!status) return 'Noch nicht bewertet'

  const labels: Record<TaskAssessmentStatus, string> = {
    [TaskAssessmentStatus.AUTO_EVALUATED]: 'Automatisch bewertet',
    [TaskAssessmentStatus.FAILED]: 'Nicht bestanden',
    [TaskAssessmentStatus.NOT_SUBMITTED]: 'Nicht abgegeben',
    [TaskAssessmentStatus.PASSED]: 'Bestanden',
    [TaskAssessmentStatus.PENDING_REVIEW]: 'Wartet auf Bewertung',
    [TaskAssessmentStatus.SUBMITTED]: 'Abgegeben'
  }

  return labels[status] ?? status
}

export const formatUnlockMode = (mode: TaskUnlockMode): string => {
  const labels: Record<TaskUnlockMode, string> = {
    [TaskUnlockMode.AUTOMATIC]: 'Automatisch',
    [TaskUnlockMode.IMMEDIATE]: 'Sofort verfügbar',
    [TaskUnlockMode.MANUAL]: 'Manuell'
  }

  return labels[mode] ?? mode
}

export default new LearningTaskService()
