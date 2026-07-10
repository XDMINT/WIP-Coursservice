import { TaskProgressStatus } from './learningTask.service'

export type StatusPresentation = {
  label: string
  icon: string
  color: string
}

const taskStatusPresentation: Record<TaskProgressStatus, StatusPresentation> = {
  [TaskProgressStatus.AVAILABLE]: {
    color: 'status-available',
    icon: 'mdi-play-circle-outline',
    label: 'Verfügbar'
  },
  [TaskProgressStatus.COMPLETED]: {
    color: 'status-completed',
    icon: 'mdi-check-circle-outline',
    label: 'Erfolgreich abgeschlossen'
  },
  [TaskProgressStatus.FAILED]: {
    color: 'status-failed',
    icon: 'mdi-alert-circle-outline',
    label: 'Nicht erfolgreich abgeschlossen'
  },
  [TaskProgressStatus.IN_PROGRESS]: {
    color: 'status-progress',
    icon: 'mdi-progress-clock',
    label: 'Begonnen'
  },
  [TaskProgressStatus.LOCKED]: {
    color: 'status-locked',
    icon: 'mdi-lock-outline',
    label: 'Gesperrt'
  }
}

export type GradingStatus = 'PASSED' | 'FAILED' | 'NOT_GRADED' | 'MANUALLY_GRADED' | 'AUTOMATICALLY_CALCULATED'

export const gradingStatusPresentation: Record<GradingStatus, StatusPresentation> = {
  AUTOMATICALLY_CALCULATED: {
    color: 'info',
    icon: 'mdi-calculator-variant-outline',
    label: 'Automatisch berechnet'
  },
  FAILED: {
    color: 'error',
    icon: 'mdi-close-circle-outline',
    label: 'Nicht bestanden'
  },
  MANUALLY_GRADED: {
    color: 'secondary',
    icon: 'mdi-account-edit-outline',
    label: 'Manuell bewertet'
  },
  NOT_GRADED: {
    color: 'status-locked',
    icon: 'mdi-timer-sand',
    label: 'Noch nicht bewertet'
  },
  PASSED: {
    color: 'success',
    icon: 'mdi-check-decagram-outline',
    label: 'Bestanden'
  }
}

export const getTaskStatusPresentation = (status: TaskProgressStatus): StatusPresentation => taskStatusPresentation[status] ?? taskStatusPresentation[TaskProgressStatus.LOCKED]
