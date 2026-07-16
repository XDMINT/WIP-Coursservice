import { TaskAssessmentStatus } from './entities/task-assessment.entity';

export const TASK_PASS_THRESHOLD_PERCENT = 50;

export const calculateTaskAssessmentPassed = (
  points: number | null | undefined,
  maxPoints: number | null | undefined,
  passThreshold = TASK_PASS_THRESHOLD_PERCENT,
): boolean | null => {
  if (
    points === undefined ||
    points === null ||
    maxPoints === undefined ||
    maxPoints === null ||
    maxPoints <= 0
  ) {
    return null;
  }

  return (points / maxPoints) * 100 >= passThreshold;
};

export const taskAssessmentStatusFromPassed = (
  passed: boolean,
): TaskAssessmentStatus => passed ? TaskAssessmentStatus.PASSED : TaskAssessmentStatus.FAILED;
