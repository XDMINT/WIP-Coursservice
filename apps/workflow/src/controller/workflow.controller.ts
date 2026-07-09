import {Controller, Post, Param, Body, Get} from '@nestjs/common';
import { WorkflowsService } from "../service/workflow.service";
import {TriggerWorkflowRequest, WorkflowDefinitionDto, WorkflowExecutionDto} from '../generated';

@Controller('workflows')
export class WorkflowController {
    constructor(private readonly workflowService: WorkflowsService) {}

    @Get()
    async listWorkflows(): Promise<WorkflowDefinitionDto[]> {
        return this.workflowService.getWorkflows();
    }

    @Get('executions')
    async listExecutions(): Promise<WorkflowExecutionDto[]> {
        return this.workflowService.listExecutions();
    }

    @Get('executions/:execution_id')
    async getExecutionState(
        @Param('execution_id') executionId: string,
    ): Promise<WorkflowExecutionDto> {
        return this.workflowService.getExecutionState(executionId);
    }

    @Post(':workflows/:workflowId/run')
    async triggerWorkflow(
        @Param('workflowId') workflowId: string,
        @Body() payload: TriggerWorkflowRequest,
    ): Promise<WorkflowExecutionDto> {
        return this.workflowService.triggerWorkflow(workflowId, payload);
    }
}