import { Injectable, ServiceUnavailableException } from '@nestjs/common';

import { Task } from './entities/task.entity';
import { TASK_PASS_THRESHOLD_PERCENT } from './task-assessment.rules';

export type TaskServiceTask = {
  id: string;
  title: string;
  description: string;
  type: string;
  content?: Record<string, unknown>;
  defaultMaxScore?: number | null;
  defaultPassThreshold?: number | null;
  mockEvaluationMode?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type TaskServiceTaskPayload = {
  id?: string;
  title: string;
  description?: string;
  type?: string;
  content?: Record<string, unknown>;
  defaultMaxScore?: number | null;
  defaultPassThreshold?: number | null;
  mockEvaluationMode?: string | null;
};

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

type TaskServiceEvaluationResponse = {
  score?: number | string;
  points?: number | string;
  maxScore?: number | string;
  maxPoints?: number | string;
  passed?: boolean;
  feedback?: string;
};

@Injectable()
export class TaskServiceClient {
  private readonly taskServiceUrl = (process.env.TASK_SERVICE_URL ?? 'http://task-service:3000')
    .replace(/\/+$/, '');

  async getTask(taskId: string): Promise<TaskServiceTask> {
    const payload = await this.request(`/api/tasks/${encodeURIComponent(taskId)}`, {
      method: 'GET',
    });

    return this.normalizeTaskPayload(payload);
  }

  async getTasks(taskIds: string[]): Promise<Map<string, TaskServiceTask>> {
    const uniqueTaskIds = [...new Set(taskIds.filter(Boolean).map(String))];

    if (uniqueTaskIds.length === 0) {
      return new Map();
    }

    const params = new URLSearchParams();
    params.set('ids', uniqueTaskIds.join(','));
    const payload = await this.request(`/api/tasks?${params.toString()}`, {
      method: 'GET',
    });

    if (!Array.isArray(payload)) {
      throw new ServiceUnavailableException(
        'Task Service lieferte keine gültige Aufgabenliste.',
      );
    }

    return new Map(payload.map((task) => {
      const normalizedTask = this.normalizeTaskPayload(task);

      return [normalizedTask.id, normalizedTask];
    }));
  }

  async createTask(payload: TaskServiceTaskPayload): Promise<TaskServiceTask> {
    return this.normalizeTaskPayload(await this.request('/api/tasks', {
      method: 'POST',
      body: payload,
    }));
  }

  async updateTask(taskId: string, payload: Partial<TaskServiceTaskPayload>): Promise<TaskServiceTask> {
    return this.normalizeTaskPayload(await this.request(`/api/tasks/${encodeURIComponent(taskId)}`, {
      method: 'PUT',
      body: payload,
    }));
  }

  async deleteTask(taskId: string): Promise<void> {
    await this.request(`/api/tasks/${encodeURIComponent(taskId)}`, {
      method: 'DELETE',
      expectJson: false,
    });
  }

  async evaluateSubmission(input: TaskEvaluationInput): Promise<TaskEvaluationResult> {
    const response = await this.request('/api/tasks/evaluate', {
      method: 'POST',
      body: {
        courseRunId: input.task.courseRunId,
        maxScore: input.task.maxPoints ?? undefined,
        passThresholdPercent: input.task.passThreshold ?? TASK_PASS_THRESHOLD_PERCENT,
        studentId: input.studentId,
        submission: input.submissionData ?? {},
        taskId: input.task.externalTaskId,
      },
    }) as TaskServiceEvaluationResponse;
    const points = Number(response.score ?? response.points);
    const maxPoints = Number(response.maxScore ?? response.maxPoints);

    if (
      !Number.isFinite(points) ||
      !Number.isFinite(maxPoints) ||
      maxPoints <= 0 ||
      typeof response.passed !== 'boolean'
    ) {
      throw new ServiceUnavailableException(
        'Task Service lieferte kein gültiges Bewertungsergebnis.',
      );
    }

    return {
      points,
      maxPoints,
      passed: response.passed,
      feedback: response.feedback ?? '',
    };
  }

  private async request(
    path: string,
    options: {
      method: 'GET' | 'POST' | 'PUT' | 'DELETE';
      body?: unknown;
      expectJson?: boolean;
    },
  ): Promise<unknown> {
    let response: Response;

    try {
      response = await fetch(`${this.taskServiceUrl}${path}`, {
        method: options.method,
        headers: options.body === undefined
          ? undefined
          : {
            'content-type': 'application/json',
          },
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
      });
    } catch {
      throw new ServiceUnavailableException(
        'Task Service ist aktuell nicht erreichbar.',
      );
    }

    if (response.status === 204 || options.expectJson === false) {
      if (!response.ok) {
        throw new ServiceUnavailableException(
          `Task Service Anfrage fehlgeschlagen: ${response.status}`,
        );
      }

      return {};
    }

    let payload: unknown;

    try {
      payload = await response.json();
    } catch {
      payload = {};
    }

    if (!response.ok) {
      throw new ServiceUnavailableException(
        `Task Service Anfrage fehlgeschlagen: ${this.extractErrorMessage(payload)}`,
      );
    }

    return payload;
  }

  private normalizeTaskPayload(payload: unknown): TaskServiceTask {
    if (!payload || typeof payload !== 'object') {
      throw new ServiceUnavailableException(
        'Task Service lieferte keine gültige Aufgabe.',
      );
    }

    const task = payload as Partial<TaskServiceTask>;

    if (
      typeof task.id !== 'string' ||
      typeof task.title !== 'string' ||
      typeof task.description !== 'string' ||
      typeof task.type !== 'string'
    ) {
      throw new ServiceUnavailableException(
        'Task Service lieferte keine gültige Aufgabe.',
      );
    }

    return {
      id: task.id,
      title: task.title,
      description: task.description,
      type: task.type,
      content: task.content && typeof task.content === 'object'
        ? task.content
        : {},
      defaultMaxScore: task.defaultMaxScore === undefined || task.defaultMaxScore === null
        ? null
        : Number(task.defaultMaxScore),
      defaultPassThreshold:
        task.defaultPassThreshold === undefined || task.defaultPassThreshold === null
          ? null
          : Number(task.defaultPassThreshold),
      mockEvaluationMode: task.mockEvaluationMode ?? null,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
    };
  }

  private extractErrorMessage(payload: unknown): string {
    if (
      payload &&
      typeof payload === 'object' &&
      'message' in payload &&
      typeof payload.message === 'string'
    ) {
      return payload.message;
    }

    return 'Unbekannter Fehler';
  }
}
