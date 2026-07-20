import { Injectable } from '@nestjs/common';

import {
  TaskEvaluationInput,
  TaskEvaluationResult,
  TaskServiceClient,
} from './task-service.client';

@Injectable()
export class TaskEvaluationClient {
  constructor(private readonly taskServiceClient: TaskServiceClient) {}

  async evaluateSubmission(
    input: TaskEvaluationInput,
  ): Promise<TaskEvaluationResult> {
    return this.taskServiceClient.evaluateSubmission(input);
  }
}

export type {
  TaskEvaluationInput,
  TaskEvaluationResult,
} from './task-service.client';
