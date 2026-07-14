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
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED'
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

  async failTask(taskId: string): Promise<LearningPath> {
    const response = await apiClient.post<LearningPath>(`/courses/tasks/${taskId}/fail`)
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
    [TaskProgressStatus.LOCKED]: 'Gesperrt'
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
