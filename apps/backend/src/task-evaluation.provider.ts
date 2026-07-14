import { Task } from './entities/task.entity';
import {
  TASK_PASS_THRESHOLD_PERCENT,
  calculateTaskAssessmentPassed,
} from './task-assessment.rules';

export type TaskEvaluationInput = {
  task: Task;
  studentId: string;
  submissionData?: Record<string, unknown>;
};

export type TaskEvaluationResult = {
  points: number;
  maxPoints: number;
  passed: boolean;
  feedback: string;
};

export interface TaskEvaluationProvider {
  evaluateSubmission(input: TaskEvaluationInput): Promise<TaskEvaluationResult>;
}

export class MockTaskEvaluationProvider implements TaskEvaluationProvider {
  async evaluateSubmission(input: TaskEvaluationInput): Promise<TaskEvaluationResult> {
    const requestedPassed = input.submissionData?.passed;
    const maxPoints = Number(input.task.maxPoints ?? 10);
    const normalizedMaxPoints = Number.isFinite(maxPoints) && maxPoints > 0
      ? maxPoints
      : 10;
    const threshold = Number(input.task.passThreshold ?? TASK_PASS_THRESHOLD_PERCENT);
    const shouldPass = requestedPassed === false ? false : true;
    const points = shouldPass
      ? Math.max(0, Math.min(normalizedMaxPoints, Math.ceil(normalizedMaxPoints * Math.max(threshold, 1) / 100)))
      : Math.max(0, Math.floor(normalizedMaxPoints * Math.max(threshold - 1, 0) / 100));
    const passed = calculateTaskAssessmentPassed(points, normalizedMaxPoints, threshold) ?? shouldPass;

    return {
      points,
      maxPoints: normalizedMaxPoints,
      passed,
      feedback: passed
        ? 'Demo-Bewertung erfolgreich.'
        : 'Demo-Bewertung nicht erfolgreich.',
    };
  }
}
