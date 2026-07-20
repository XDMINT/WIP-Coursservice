import { describe, expect, it } from 'vitest'

import {
  LearningMaterialPublicationStatus,
  LearningMaterialReleaseMode,
  LearningMaterialType,
  type LearningMaterial
} from '@/services/learningMaterial.service'
import {
  TaskAssessmentStatus,
  TaskGradingMode,
  TaskProgressStatus,
  TaskUnlockMode,
  TaskWorkMode,
  type StudentLearningTask
} from '@/services/learningTask.service'
import { getLearningStepReflection, getNextLearningAction } from '../getNextLearningAction'

const task = (overrides: Partial<StudentLearningTask>): StudentLearningTask => ({
  allowRetries: true,
  assessment: null,
  completionPercentage: 0,
  courseId: 'course-id',
  description: 'Beschreibung',
  feedbackRequired: false,
  gradingMode: TaskGradingMode.SELF_CONFIRMATION,
  id: 'task-id',
  isPublished: true,
  locked: false,
  order: 1,
  status: TaskProgressStatus.AVAILABLE,
  title: 'Grundlagen kennenlernen',
  type: 'DEMO_TASK',
  unlockMode: TaskUnlockMode.IMMEDIATE,
  workMode: TaskWorkMode.INDIVIDUAL,
  ...overrides
})

const material = (overrides: Partial<LearningMaterial>): LearningMaterial => ({
  courseId: 'course-id',
  id: 'material-id',
  isPublished: true,
  locked: false,
  publicationStatus: LearningMaterialPublicationStatus.PUBLISHED,
  releaseMode: LearningMaterialReleaseMode.IMMEDIATE,
  tags: [],
  title: 'Einführung',
  type: LearningMaterialType.DOCUMENT,
  visibleForStudents: true,
  ...overrides
})

describe('getNextLearningAction', () => {
  it('recommends starting an available task', () => {
    const action = getNextLearningAction([
      task({
        status: TaskProgressStatus.AVAILABLE,
        title: 'Grundlagen kennenlernen'
      })
    ])

    expect(action.message).toBe('Starte „Grundlagen kennenlernen“.')
    expect(action.tone).toBe('primary')
  })

  it('recommends continuing an in-progress task', () => {
    const action = getNextLearningAction([
      task({
        status: TaskProgressStatus.IN_PROGRESS,
        title: 'Grundlagen anwenden'
      })
    ])

    expect(action.message).toBe('Setze „Grundlagen anwenden“ fort.')
    expect(action.detail).toContain('Schließe den begonnenen Lernschritt ab')
  })

  it('shows that a submitted task waits for review', () => {
    const action = getNextLearningAction([
      task({
        assessment: {
          assessmentTargetType: 'INDIVIDUAL',
          courseRunId: 'run-id',
          courseVersionId: 'version-id',
          gradingMode: TaskGradingMode.MANUAL,
          id: 'assessment-id',
          status: TaskAssessmentStatus.PENDING_REVIEW,
          taskId: 'task-id'
        },
        gradingMode: TaskGradingMode.MANUAL,
        status: TaskProgressStatus.SUBMITTED,
        title: 'Grundlagen anwenden'
      })
    ])

    expect(action.message).toBe('Deine Abgabe zu „Grundlagen anwenden“ wartet auf Bewertung.')
    expect(action.icon).toBe('mdi-file-clock-outline')
  })

  it('recommends feedback and material after a failed task with feedback', () => {
    const action = getNextLearningAction([
      task({
        assessment: {
          assessmentTargetType: 'INDIVIDUAL',
          courseRunId: 'run-id',
          courseVersionId: 'version-id',
          feedback: 'Bitte wiederhole die Grundlagen.',
          gradingMode: TaskGradingMode.MANUAL,
          id: 'assessment-id',
          passed: false,
          status: TaskAssessmentStatus.FAILED,
          taskId: 'task-id'
        },
        gradingMode: TaskGradingMode.MANUAL,
        status: TaskProgressStatus.FAILED,
        title: 'Grundlagen anwenden'
      })
    ], [
      material({
        releaseAfterTaskId: 'task-id',
        title: 'Einführung'
      })
    ])

    expect(action.message).toBe('Wiederhole „Grundlagen anwenden“ anhand des Feedbacks.')
    expect(action.detail).toBe('Arbeite anschließend das Material „Einführung“ erneut durch.')
    expect(action.tone).toBe('warning')
  })

  it('shows a completion message when all tasks are done', () => {
    const action = getNextLearningAction([
      task({
        assessment: {
          assessmentTargetType: 'INDIVIDUAL',
          courseRunId: 'run-id',
          courseVersionId: 'version-id',
          gradingMode: TaskGradingMode.SELF_CONFIRMATION,
          id: 'assessment-id',
          passed: true,
          status: TaskAssessmentStatus.PASSED,
          taskId: 'task-id'
        },
        resultPassed: true,
        status: TaskProgressStatus.COMPLETED
      })
    ])

    expect(action.message).toBe('Alle Lernschritte sind abgeschlossen.')
    expect(action.tone).toBe('success')
  })
})

describe('getLearningStepReflection', () => {
  it('mentions the next unlocked task after a completed prerequisite', () => {
    const completed = task({
      id: 'task-1',
      resultPassed: true,
      status: TaskProgressStatus.COMPLETED,
      title: 'Grundlagen kennenlernen'
    })
    const unlocked = task({
      id: 'task-2',
      order: 2,
      prerequisiteTaskId: 'task-1',
      status: TaskProgressStatus.AVAILABLE,
      title: 'Grundlagen anwenden',
      unlockMode: TaskUnlockMode.AUTOMATIC
    })

    const reflection = getLearningStepReflection(completed, [completed, unlocked])

    expect(reflection?.resultLabel).toBe('bestanden')
    expect(reflection?.detail).toBe('Nächster Schritt: Aufgabe „Grundlagen anwenden“ ist freigeschaltet.')
  })
})
