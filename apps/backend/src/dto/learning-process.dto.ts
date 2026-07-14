import { Task, TaskUnlockMode } from '../entities/task.entity';
import {
  TaskProgress,
  TaskProgressStatus,
  TaskUnlockSource,
} from '../entities/task-progress.entity';

export type LearningTaskResponseDto = {
  id: string;
  courseId: string;
  courseRunId?: string;
  courseVersionId?: string;
  title: string;
  description: string;
  type: string;
  order: number;
  unlockMode: TaskUnlockMode;
  prerequisiteTaskId?: string;
  completionCriteria?: Record<string, unknown>;
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
  title?: string;
  description?: string;
  type?: string;
  order?: number | string;
  unlockMode?: TaskUnlockMode | string;
  prerequisiteTaskId?: string | null;
  completionCriteria?: Record<string, unknown> | null;
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

const toIsoString = (value?: Date): string | undefined =>
  value instanceof Date ? value.toISOString() : undefined;

export const mapLearningTaskToDto = (task: Task): LearningTaskResponseDto => ({
  id: task.id,
  courseId: task.courseId,
  courseRunId: task.courseRunId,
  courseVersionId: task.courseVersionId,
  title: task.title,
  description: task.description,
  type: task.type,
  order: task.order,
  unlockMode: task.unlockMode,
  prerequisiteTaskId: task.prerequisiteTaskId,
  completionCriteria: task.completionCriteria,
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
});

export const mapTaskProgressToDto = (
  task: Task,
  progress: TaskProgress | null,
): LearningTaskProgressDto => ({
  taskId: task.id,
  title: task.title,
  order: task.order,
  status: progress?.status ?? TaskProgressStatus.LOCKED,
  completionPercentage: progress?.completionPercentage ?? 0,
  unlockedAt: toIsoString(progress?.unlockedAt),
  startedAt: toIsoString(progress?.startedAt),
  completedAt: toIsoString(progress?.completedAt),
  resultPassed: progress?.resultPassed,
  unlockSource: progress?.unlockSource,
});
