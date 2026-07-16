import { Task, TaskGradingMode, TaskUnlockMode, TaskWorkMode } from '../entities/task.entity';
import {
  TaskAssessment,
  TaskAssessmentStatus,
  TaskAssessmentTargetType,
} from '../entities/task-assessment.entity';
import {
  TaskProgress,
  TaskProgressStatus,
  TaskUnlockSource,
} from '../entities/task-progress.entity';

export type LearningTaskResponseDto = {
  id: string;
  externalTaskId: string;
  courseId: string;
  courseRunId?: string;
  courseVersionId?: string;
  title: string;
  description: string;
  type: string;
  content?: Record<string, unknown>;
  order: number;
  unlockMode: TaskUnlockMode;
  prerequisiteTaskId?: string;
  completionCriteria?: Record<string, unknown>;
  gradingMode: TaskGradingMode;
  workMode: TaskWorkMode;
  maxPoints?: number | null;
  passThreshold?: number | null;
  feedbackRequired: boolean;
  allowRetries: boolean;
  isPublished: boolean;
  demoKey?: string;
  createdBy: string;
  updatedBy: string;
  createdAt?: string;
  updatedAt?: string;
};

export type StudentLearningTaskResponseDto = LearningTaskResponseDto & {
  status: TaskProgressStatus;
  completionPercentage: number;
  locked: boolean;
  lockedReason?: string;
  unlockedAt?: string;
  startedAt?: string;
  completedAt?: string;
  resultPassed?: boolean;
  unlockSource?: TaskUnlockSource;
  assessment?: TaskAssessmentResponseDto | null;
  group?: StudentTaskGroupContextDto | null;
};

export type LearningPathResponseDto = {
  courseId: string;
  studentId: string;
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  availableTasks: number;
  failedTasks: number;
  lockedTasks: number;
  progressPercentage: number;
  tasks: StudentLearningTaskResponseDto[];
};

export type LearningTaskProgressDto = {
  taskId: string;
  title: string;
  order: number;
  status: TaskProgressStatus;
  completionPercentage: number;
  unlockedAt?: string;
  startedAt?: string;
  completedAt?: string;
  resultPassed?: boolean;
  unlockSource?: TaskUnlockSource;
  assessment?: TaskAssessmentResponseDto | null;
  groupId?: string | null;
  groupName?: string | null;
};

export type StudentTaskGroupContextDto = {
  id: string;
  name: string;
  status?: TaskProgressStatus;
  startedAt?: string | null;
  submittedAt?: string | null;
  completedAt?: string | null;
};

export type StudentProgressOverviewDto = {
  enrollmentId: string;
  studentId: string;
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  availableTasks: number;
  failedTasks: number;
  lockedTasks: number;
  progressPercentage: number;
  tasks: LearningTaskProgressDto[];
};

export type CreateLearningTaskDto = {
  externalTaskId?: string;
  title?: string;
  description?: string;
  type?: string;
  content?: Record<string, unknown> | null;
  order?: number | string;
  unlockMode?: TaskUnlockMode | string;
  prerequisiteTaskId?: string | null;
  completionCriteria?: Record<string, unknown> | null;
  gradingMode?: TaskGradingMode | string;
  workMode?: TaskWorkMode | string;
  maxPoints?: number | string | null;
  passThreshold?: number | string | null;
  feedbackRequired?: boolean;
  allowRetries?: boolean;
  isPublished?: boolean;
};

export type UpdateLearningTaskDto = Partial<CreateLearningTaskDto>;

export type UpdateLearningTaskSortDto = {
  items?: Array<{
    id?: string;
    order?: number;
  }>;
};

export type UpdateLearningTaskReleaseConfigDto = {
  unlockMode?: TaskUnlockMode | string;
  prerequisiteTaskId?: string | null;
};

export type ManualUnlockLearningTaskDto = {
  studentId?: string | number;
};

export type SubmitLearningTaskDto = {
  keepExistingFile?: boolean;
  submissionData?: Record<string, unknown>;
};

export type MockEvaluateLearningTaskDto = {
  submissionData?: Record<string, unknown>;
  passed?: boolean;
};

export type ManualTaskAssessmentDto = {
  points?: number | string | null;
  maxPoints?: number | string | null;
  passed?: boolean;
  feedback?: string | null;
};

export type TaskAssessmentResponseDto = {
  id: string;
  courseRunId: string;
  courseVersionId: string;
  taskId: string;
  assessmentTargetType: TaskAssessmentTargetType;
  studentId?: string | null;
  groupId?: string | null;
  gradingMode: TaskGradingMode;
  status: TaskAssessmentStatus;
  points?: number | null;
  maxPoints?: number | null;
  passThreshold?: number | null;
  passed?: boolean | null;
  feedback?: string | null;
  submissionData?: Record<string, unknown> | null;
  assessedBy?: string | null;
  assessedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

const toIsoString = (value?: Date): string | undefined =>
  value instanceof Date ? value.toISOString() : undefined;

export const mapLearningTaskToDto = (task: Task): LearningTaskResponseDto => ({
  id: task.id,
  externalTaskId: task.externalTaskId,
  courseId: task.courseId,
  courseRunId: task.courseRunId,
  courseVersionId: task.courseVersionId,
  title: task.title ?? 'Aufgabe',
  description: task.description ?? '',
  type: task.type ?? 'MOCK',
  content: task.content,
  order: task.order,
  unlockMode: task.unlockMode,
  prerequisiteTaskId: task.prerequisiteTaskId,
  completionCriteria: task.completionCriteria,
  gradingMode: task.gradingMode ?? TaskGradingMode.NOT_GRADED,
  workMode: task.workMode ?? TaskWorkMode.INDIVIDUAL,
  maxPoints: task.maxPoints === undefined || task.maxPoints === null
    ? null
    : Number(task.maxPoints),
  passThreshold: task.passThreshold === undefined || task.passThreshold === null
    ? null
    : Number(task.passThreshold),
  feedbackRequired: task.feedbackRequired === true,
  allowRetries: task.allowRetries === true,
  isPublished: task.isPublished,
  demoKey: task.demoKey,
  createdBy: task.createdBy,
  updatedBy: task.updatedBy,
  createdAt: toIsoString(task.createdAt),
  updatedAt: toIsoString(task.updatedAt),
});

export const mapLearningTaskWithProgressToDto = (
  task: Task,
  progress: TaskProgress | null,
  lockedReason?: string,
  assessment?: TaskAssessment | null,
  group?: StudentTaskGroupContextDto | null,
): StudentLearningTaskResponseDto => ({
  ...mapLearningTaskToDto(task),
  status: progress?.status ?? TaskProgressStatus.LOCKED,
  completionPercentage: progress?.completionPercentage ?? 0,
  locked: !progress || progress.status === TaskProgressStatus.LOCKED,
  lockedReason,
  unlockedAt: toIsoString(progress?.unlockedAt),
  startedAt: toIsoString(progress?.startedAt),
  completedAt: toIsoString(progress?.completedAt),
  resultPassed: progress?.resultPassed,
  unlockSource: progress?.unlockSource,
  assessment: assessment ? mapTaskAssessmentToDto(assessment) : null,
  group: group ?? null,
});

export const mapTaskProgressToDto = (
  task: Task,
  progress: TaskProgress | null,
  assessment?: TaskAssessment | TaskAssessmentResponseDto | null,
  group?: StudentTaskGroupContextDto | null,
): LearningTaskProgressDto => ({
  taskId: task.id,
  title: task.title ?? 'Aufgabe',
  order: task.order,
  status: progress?.status ?? TaskProgressStatus.LOCKED,
  completionPercentage: progress?.completionPercentage ?? 0,
  unlockedAt: toIsoString(progress?.unlockedAt),
  startedAt: toIsoString(progress?.startedAt),
  completedAt: toIsoString(progress?.completedAt),
  resultPassed: progress?.resultPassed,
  unlockSource: progress?.unlockSource,
  assessment: assessment
    ? 'courseRun' in assessment
      ? mapTaskAssessmentToDto(assessment)
      : assessment
    : null,
  groupId: group?.id ?? null,
  groupName: group?.name ?? null,
});

export const mapTaskAssessmentToDto = (
  assessment: TaskAssessment,
): TaskAssessmentResponseDto => ({
  id: assessment.id,
  courseRunId: assessment.courseRunId,
  courseVersionId: assessment.courseVersionId,
  taskId: assessment.taskId,
  assessmentTargetType:
    assessment.assessmentTargetType ?? TaskAssessmentTargetType.INDIVIDUAL,
  studentId: assessment.studentId,
  groupId: assessment.groupId,
  gradingMode: assessment.gradingMode,
  status: assessment.status,
  points: assessment.points === undefined || assessment.points === null
    ? null
    : Number(assessment.points),
  maxPoints: assessment.maxPoints === undefined || assessment.maxPoints === null
    ? null
    : Number(assessment.maxPoints),
  passThreshold: assessment.passThreshold === undefined || assessment.passThreshold === null
    ? null
    : Number(assessment.passThreshold),
  passed: assessment.passed,
  feedback: assessment.feedback,
  submissionData: sanitizeTaskSubmissionDataForResponse(assessment.submissionData),
  assessedBy: assessment.assessedBy,
  assessedAt: toIsoString(assessment.assessedAt ?? undefined),
  createdAt: toIsoString(assessment.createdAt),
  updatedAt: toIsoString(assessment.updatedAt),
});

const sanitizeTaskSubmissionDataForResponse = (
  submissionData?: Record<string, unknown> | null,
): Record<string, unknown> | null => {
  if (!submissionData || typeof submissionData !== 'object') {
    return submissionData ?? null;
  }

  const sanitized: Record<string, unknown> = { ...submissionData };

  if (
    sanitized.file &&
    typeof sanitized.file === 'object' &&
    !Array.isArray(sanitized.file)
  ) {
    const { storageKey: _storageKey, ...publicFile } =
      sanitized.file as Record<string, unknown>;
    sanitized.file = publicFile;
  }

  return sanitized;
};
