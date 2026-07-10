import { describe, expect, it } from 'vitest'

import { TaskProgressStatus } from '../learningTask.service'
import { getTaskStatusPresentation, gradingStatusPresentation } from '../statusPresentation'

describe('statusPresentation', () => {
  it('describes task states with text, icon and semantic theme color', () => {
    expect(getTaskStatusPresentation(TaskProgressStatus.LOCKED)).toEqual({
      color: 'status-locked',
      icon: 'mdi-lock-outline',
      label: 'Gesperrt'
    })
    expect(getTaskStatusPresentation(TaskProgressStatus.COMPLETED)).toEqual({
      color: 'status-completed',
      icon: 'mdi-check-circle-outline',
      label: 'Erfolgreich abgeschlossen'
    })
  })

  it('documents reusable grading state presentations for the next feature', () => {
    expect(gradingStatusPresentation.PASSED).toMatchObject({
      icon: expect.stringContaining('check'),
      label: 'Bestanden'
    })
    expect(gradingStatusPresentation.NOT_GRADED).toMatchObject({
      icon: expect.any(String),
      label: 'Noch nicht bewertet'
    })
  })
})
