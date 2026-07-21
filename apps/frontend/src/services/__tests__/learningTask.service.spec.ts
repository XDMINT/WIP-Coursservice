import { beforeEach, describe, expect, it, vi } from 'vitest'

import learningTaskService, { TaskAssessmentStatus, TaskGradingMode, TaskLearningPathType, TaskProgressStatus, TaskUnlockMode, formatAssessmentStatus, formatGradingMode, formatTaskLearningPathType, formatTaskStatus, formatUnlockMode } from '../learningTask.service'
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

  it('starts and self-confirms tasks through actor-aware task endpoints', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({
      data: {
        tasks: []
      }
    })

    await learningTaskService.startTask('task-id')
    await learningTaskService.selfConfirmTask('task-id')

    expect(apiClient.post).toHaveBeenNthCalledWith(1, '/courses/tasks/task-id/start')
    expect(apiClient.post).toHaveBeenNthCalledWith(2, '/courses/tasks/task-id/self-confirm')
  })

  it('submits, mock-evaluates and manually assesses tasks through dedicated endpoints', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({
      data: {
        tasks: []
      }
    })

    await learningTaskService.submitTask('task-id', { answer: 'demo' })
    await learningTaskService.mockEvaluateTask('task-id', false)
    await learningTaskService.assessTaskManually('course-id', 'run-id', 'task-id', 'student-id', {
      feedback: 'Bitte nacharbeiten.',
      maxPoints: 10,
      passed: false,
      points: 4
    })
    await learningTaskService.resetTaskAssessment('course-id', 'run-id', 'task-id', 'student-id')

    expect(apiClient.post).toHaveBeenNthCalledWith(1, '/courses/tasks/task-id/submit', {
      submissionData: {
        answer: 'demo'
      }
    })
    expect(apiClient.post).toHaveBeenNthCalledWith(2, '/courses/tasks/task-id/mock-evaluate', {
      passed: false
    })
    expect(apiClient.post).toHaveBeenNthCalledWith(3, '/courses/course-id/runs/run-id/tasks/task-id/assessments/student-id/manual', {
      feedback: 'Bitte nacharbeiten.',
      maxPoints: 10,
      passed: false,
      points: 4
    })
    expect(apiClient.post).toHaveBeenNthCalledWith(4, '/courses/course-id/runs/run-id/tasks/task-id/assessments/student-id/reset')
  })

  it('submits task work with a file through multipart upload', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({
      data: {
        tasks: []
      }
    })
    const file = new File(['demo'], 'loesung.pdf', { type: 'application/pdf' })

    await learningTaskService.submitTaskWithUpload('task-id', {
      file,
      keepExistingFile: true,
      link: 'https://example.com/abgabe',
      text: 'Meine Lösung'
    })

    expect(apiClient.post).toHaveBeenCalledWith(
      '/courses/tasks/task-id/submit-upload',
      expect.any(FormData),
      expect.objectContaining({
        headers: {
          'Content-Type': 'multipart/form-data'
        },
        onUploadProgress: expect.any(Function)
      })
    )

    const formData = vi.mocked(apiClient.post).mock.calls[0][1] as FormData
    expect(formData.get('text')).toBe('Meine Lösung')
    expect(formData.get('link')).toBe('https://example.com/abgabe')
    expect(formData.get('keepExistingFile')).toBe('true')
    expect(formData.get('file')).toBe(file)
  })

  it('downloads submitted task files as blobs', async () => {
    const blob = new Blob(['demo'])
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: blob
    })

    await expect(learningTaskService.downloadTaskSubmissionFile('assessment-id')).resolves.toBe(blob)
    expect(apiClient.get).toHaveBeenCalledWith('/courses/task-assessments/assessment-id/submission-file', {
      responseType: 'blob'
    })
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
    expect(formatTaskStatus(TaskProgressStatus.SUBMITTED)).toBe('Wartet auf Bewertung')
    expect(formatGradingMode(TaskGradingMode.AUTOMATIC_MOCK)).toBe('Automatisch bewertet (Mock)')
    expect(formatTaskLearningPathType(TaskLearningPathType.REMEDIAL)).toBe('Wiederholung')
    expect(formatTaskLearningPathType(TaskLearningPathType.DEEPENING)).toBe('Vertiefung')
    expect(formatTaskLearningPathType(TaskLearningPathType.PRACTICE)).toBe('Praxis')
    expect(formatAssessmentStatus(TaskAssessmentStatus.PENDING_REVIEW)).toBe('Wartet auf Bewertung')
    expect(formatUnlockMode(TaskUnlockMode.AUTOMATIC)).toBe('Automatisch')
    expect(formatUnlockMode(TaskUnlockMode.MANUAL)).toBe('Manuell')
  })
})
