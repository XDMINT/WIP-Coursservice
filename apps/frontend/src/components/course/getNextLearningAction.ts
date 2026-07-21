import type { LearningMaterial } from '@/services/learningMaterial.service'
import {
  TaskAssessmentStatus,
  TaskGradingMode,
  TaskProgressStatus,
  type StudentLearningTask
} from '@/services/learningTask.service'

export type NextLearningAction = {
  detail?: string
  icon: string
  message: string
  tone: 'info' | 'primary' | 'success' | 'warning'
}

export type LearningStepReflection = {
  detail?: string
  icon: string
  message: string
  resultLabel: string
  tone: 'info' | 'success' | 'warning'
}

const sortedTasks = (tasks: StudentLearningTask[]) =>
  [...tasks].sort((left, right) => left.order - right.order)

const isPendingReview = (task: StudentLearningTask) =>
  task.status === TaskProgressStatus.SUBMITTED ||
  task.assessment?.status === TaskAssessmentStatus.PENDING_REVIEW ||
  task.assessment?.status === TaskAssessmentStatus.SUBMITTED

const isFailed = (task: StudentLearningTask) =>
  task.status === TaskProgressStatus.FAILED ||
  task.resultPassed === false ||
  task.assessment?.passed === false ||
  task.assessment?.status === TaskAssessmentStatus.FAILED

const isCompleted = (task: StudentLearningTask) =>
  task.status === TaskProgressStatus.COMPLETED ||
  task.resultPassed === true ||
  task.assessment?.passed === true ||
  task.assessment?.status === TaskAssessmentStatus.PASSED

const isLocked = (task: StudentLearningTask) =>
  task.locked || task.status === TaskProgressStatus.LOCKED

const findMaterialForTask = (
  task: StudentLearningTask,
  materials: LearningMaterial[]
) =>
  materials.find((material) => material.releaseAfterTaskId === task.id && !material.locked) ??
  materials.find((material) => !material.releaseAfterTaskId && !material.locked)

const dependencyIdsForTask = (task: StudentLearningTask) => {
  const dependencyIds = (task.dependencies ?? [])
    .map((dependency) => dependency.prerequisiteTaskId)
    .filter(Boolean)

  if (dependencyIds.length === 0 && task.prerequisiteTaskId) {
    dependencyIds.push(task.prerequisiteTaskId)
  }

  return dependencyIds
}

const lockReasonForTask = (
  task: StudentLearningTask,
  tasks: StudentLearningTask[]
) => {
  if (task.lockedReason) {
    return task.lockedReason
  }

  const prerequisite = dependencyIdsForTask(task)
    .map((dependencyId) => tasks.find((candidate) => candidate.id === dependencyId))
    .find(Boolean)

  return prerequisite
    ? `Schließe zuerst „${prerequisite.title}“ ab, um diesen Schritt freizuschalten.`
    : 'Dieser Lernschritt wird später freigeschaltet.'
}

export const getNextLearningAction = (
  tasks: StudentLearningTask[],
  materials: LearningMaterial[] = []
): NextLearningAction => {
  const orderedTasks = sortedTasks(tasks)
  const firstUnlockedMaterial = materials.find((material) => !material.locked)

  if (orderedTasks.length === 0) {
    return firstUnlockedMaterial
      ? {
        detail: 'Es gibt aktuell noch keine Aufgaben in deiner Lernreise.',
        icon: 'mdi-book-open-page-variant-outline',
        message: `Schau dir zuerst das Material „${firstUnlockedMaterial.title}“ an.`,
        tone: 'info'
      }
      : {
        detail: 'Sobald Aufgaben oder Materialien freigegeben sind, erscheint hier dein nächster Schritt.',
        icon: 'mdi-map-search-outline',
        message: 'Noch keine Lernschritte verfügbar.',
        tone: 'info'
      }
  }

  let firstLockedTask: StudentLearningTask | null = null

  for (const task of orderedTasks) {
    if (isFailed(task) && task.assessment?.feedback) {
      const material = findMaterialForTask(task, materials)

      return {
        detail: material
          ? `Arbeite anschließend das Material „${material.title}“ erneut durch.`
          : 'Nutze die Rückmeldung, bevor du die Aufgabe erneut bearbeitest.',
        icon: 'mdi-message-alert-outline',
        message: `Wiederhole „${task.title}“ anhand des Feedbacks.`,
        tone: 'warning'
      }
    }

    if (isPendingReview(task)) {
      return {
        detail: 'Du kannst deine Abgabe weiter öffnen, solange sie noch nicht bewertet wurde.',
        icon: 'mdi-file-clock-outline',
        message: `Deine Abgabe zu „${task.title}“ wartet auf Bewertung.`,
        tone: 'info'
      }
    }

    if (task.status === TaskProgressStatus.IN_PROGRESS) {
      return {
        detail: task.gradingMode === TaskGradingMode.MANUAL
          ? 'Sende deine Bearbeitung ab, damit sie bewertet werden kann.'
          : 'Schließe den begonnenen Lernschritt ab, bevor du weitergehst.',
        icon: 'mdi-progress-pencil',
        message: `Setze „${task.title}“ fort.`,
        tone: 'primary'
      }
    }

    if (task.status === TaskProgressStatus.AVAILABLE) {
      const isManual = task.gradingMode === TaskGradingMode.MANUAL

      return {
        detail: isManual
          ? 'Bereite deine Abgabe vor und sende sie anschließend ein.'
          : 'Dieser Lernschritt ist jetzt verfügbar.',
        icon: isManual ? 'mdi-file-edit-outline' : 'mdi-play-circle-outline',
        message: isManual
          ? `Bearbeite als Nächstes „${task.title}“.`
          : `Starte „${task.title}“.`,
        tone: 'primary'
      }
    }

    if (!firstLockedTask && isLocked(task)) {
      firstLockedTask = task
    }
  }

  if (firstLockedTask) {
    return {
      detail: 'Sobald die Voraussetzung erfüllt ist, erscheint der Schritt automatisch in deiner Lernreise.',
      icon: 'mdi-lock-open-variant-outline',
      message: lockReasonForTask(firstLockedTask, orderedTasks),
      tone: 'info'
    }
  }

  return {
    detail: 'Du hast alle aktuell freigegebenen Lernschritte erledigt.',
    icon: 'mdi-check-decagram-outline',
    message: 'Alle Lernschritte sind abgeschlossen.',
    tone: 'success'
  }
}

export const getLearningStepReflection = (
  task: StudentLearningTask,
  tasks: StudentLearningTask[],
  materials: LearningMaterial[] = []
): LearningStepReflection | null => {
  const orderedTasks = sortedTasks(tasks)
  const nextUnlockedTask = orderedTasks.find((candidate) =>
    dependencyIdsForTask(candidate).includes(task.id) &&
    !isLocked(candidate) &&
    [TaskProgressStatus.AVAILABLE, TaskProgressStatus.IN_PROGRESS].includes(candidate.status)
  )
  const material = findMaterialForTask(task, materials)
  const hasRelevantState =
    Boolean(task.assessment) ||
    Boolean(task.assessment?.feedback) ||
    isPendingReview(task) ||
    isCompleted(task) ||
    isFailed(task) ||
    Boolean(nextUnlockedTask)

  if (!hasRelevantState) {
    return null
  }

  if (isPendingReview(task) && !isCompleted(task) && !isFailed(task)) {
    return {
      icon: 'mdi-file-clock-outline',
      message: 'Deine Abgabe wartet auf Bewertung.',
      resultLabel: 'noch offen',
      tone: 'info'
    }
  }

  if (isFailed(task)) {
    return {
      detail: material
        ? `Feedback ansehen und Material „${material.title}“ erneut bearbeiten.`
        : 'Feedback ansehen und die Aufgabe erneut bearbeiten.',
      icon: 'mdi-alert-circle-outline',
      message: 'Feedback ansehen und gezielt wiederholen.',
      resultLabel: 'nicht bestanden',
      tone: 'warning'
    }
  }

  if (isCompleted(task)) {
    return {
      detail: nextUnlockedTask
        ? `Nächster Schritt: Aufgabe „${nextUnlockedTask.title}“ ist freigeschaltet.`
        : task.assessment?.feedback
          ? 'Feedback deiner Lehrperson ist vorhanden.'
          : 'Dieser Lernschritt ist erledigt.',
      icon: 'mdi-check-circle-outline',
      message: nextUnlockedTask
        ? 'Ein weiterer Lernschritt ist jetzt verfügbar.'
        : 'Dieser Lernschritt ist abgeschlossen.',
      resultLabel: task.assessment?.passed === true || task.resultPassed === true
        ? 'bestanden'
        : 'abgeschlossen',
      tone: 'success'
    }
  }

  if (task.assessment?.feedback) {
    return {
      detail: 'Feedback deiner Lehrperson ist vorhanden.',
      icon: 'mdi-message-text-outline',
      message: 'Rückmeldung ansehen.',
      resultLabel: 'Feedback vorhanden',
      tone: 'info'
    }
  }

  if (nextUnlockedTask) {
    return {
      detail: `Nächster Schritt: Aufgabe „${nextUnlockedTask.title}“ ist freigeschaltet.`,
      icon: 'mdi-lock-open-variant-outline',
      message: 'Ein weiterer Lernschritt ist verfügbar.',
      resultLabel: 'freigeschaltet',
      tone: 'info'
    }
  }

  return null
}
