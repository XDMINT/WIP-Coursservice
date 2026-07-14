import { beforeEach, describe, expect, it, vi } from 'vitest'

import learningTaskService, { TaskProgressStatus, TaskUnlockMode, formatTaskStatus, formatUnlockMode } from '../learningTask.service'
import { apiClient } from '../apiClient'

vi.mock('../apiClient', () => ({
  apiClient: {
    delete: vi.fn(),
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn()
  }
}))

describe('learningTaskService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loads the student learning path through a relative course API path', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: {
        courseId: 'course-id',
        tasks: []
      }
    })

    await expect(learningTaskService.getMyLearningPath('course-id')).resolves.toMatchObject({
      courseId: 'course-id'
    })
    expect(apiClient.get).toHaveBeenCalledWith('/courses/course-id/tasks/my-progress')
  })

  it('loads teacher task and progress data through selected course run API paths', async () => {
    vi.mocked(apiClient.get)
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: [] })

    await expect(learningTaskService.listTasks('course-id', 'run-id')).resolves.toEqual([])
    await expect(learningTaskService.getProgressOverview('course-id', 'run-id')).resolves.toEqual([])

    expect(apiClient.get).toHaveBeenNthCalledWith(1, '/courses/course-id/runs/run-id/tasks')
    expect(apiClient.get).toHaveBeenNthCalledWith(2, '/courses/course-id/runs/run-id/progress')
  })

  it('starts and completes tasks through actor-aware task endpoints', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({
      data: {
        tasks: []
      }
    })

    await learningTaskService.startTask('task-id')
    await learningTaskService.completeTask('task-id')

    expect(apiClient.post).toHaveBeenNthCalledWith(1, '/courses/tasks/task-id/start')
    expect(apiClient.post).toHaveBeenNthCalledWith(2, '/courses/tasks/task-id/complete')
  })

  it('unlocks manual tasks for a selected student', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({
      data: {
        studentId: '3'
      }
    })

    await learningTaskService.manuallyUnlockTask('task-id', '3')

    expect(apiClient.post).toHaveBeenCalledWith('/courses/tasks/task-id/manual-unlock', {
      studentId: '3'
    })
  })

  it('formats task statuses and unlock modes for display', () => {
    expect(formatTaskStatus(TaskProgressStatus.LOCKED)).toBe('Gesperrt')
    expect(formatTaskStatus(TaskProgressStatus.COMPLETED)).toBe('Erfolgreich abgeschlossen')
    expect(formatUnlockMode(TaskUnlockMode.AUTOMATIC)).toBe('Automatisch')
    expect(formatUnlockMode(TaskUnlockMode.MANUAL)).toBe('Manuell')
  })
})
