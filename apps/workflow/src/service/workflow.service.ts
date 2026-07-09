import { Injectable, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common';
import { TriggerWorkflowRequest, WorkflowDefinitionDto, WorkflowExecutionDto } from "../generated";
import status = WorkflowExecutionDto.status;
import {ConfigService} from "@nestjs/config";

@Injectable()
export class WorkflowsService {
    private readonly logger = new Logger(WorkflowsService.name);

    private readonly daguApiUrl: string;
    private readonly authHeader: string;

    // TODO: Move to .env later
    constructor(private readonly configService: ConfigService) {
        this.daguApiUrl = this.configService.get<string>('DAGU_API_URL') || 'http://localhost:8080/api/v1';

        const username = this.configService.get<string>('DAGU_AUTH_BASIC_USERNAME');
        const password = this.configService.get<string>('DAGU_AUTH_BASIC_PASSWORD');

        this.authHeader = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
    }


    private get defaultHeaders() {
        return {
            'Authorization': this.authHeader,
            'Content-Type': 'application/json',
        };
    }

    async getWorkflows(): Promise<WorkflowDefinitionDto[]> {
        this.logger.log('Fetching all workflow definitions from DAGU via Fetch');

        try {
            const response = await fetch(`${this.daguApiUrl}/dags`, {
                headers: this.defaultHeaders
            });

            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

            const data = await response.json();
            const dags = data.dags || [];

            return dags.map(item => {
                const dagConfig = item.dag || {};
                return {
                    id: item.fileName || dagConfig.name,
                    name: dagConfig.name || item.fileName,
                    description: dagConfig.description || 'No description provided',
                    parameter_schema: dagConfig.params ? { info: dagConfig.params } : {},
                };
            });
        } catch (error) {
            this.logger.error(`Failed to fetch workflows: ${(error as Error).message}`);
            throw new InternalServerErrorException('Could not fetch workflow definitions.');
        }
    }

    async triggerWorkflow(workflowId: string, payload: TriggerWorkflowRequest): Promise<WorkflowExecutionDto> {
        this.logger.log(`Sends Request at local DAGU: Workflow [${workflowId}]`);

        try {
            const response = await fetch(`${this.daguApiUrl}/dags/${workflowId}/start`, {
                method: 'POST',
                headers: this.defaultHeaders,
                body: JSON.stringify({
                    params: JSON.stringify(payload.parameters),
                }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `Status ${response.status}`);
            }

            const data = await response.json();

            return {
                id: data.dagRunId || data.run_id || 'unknown',
                workflow_id: workflowId,
                status: status.RUNNING,
                triggered: true,
                started_at: new Date().toISOString(),
            };
        } catch (error) {
            this.logger.error(`DAGU Error: ${(error as Error).message}`);
            throw new InternalServerErrorException('Couldn\'t start real Workflow in DAGU.');
        }
    }

    async getExecutionState(executionId: string): Promise<WorkflowExecutionDto> {
        try {
            const url = new URL(`${this.daguApiUrl}/dag-runs`);
            url.searchParams.append('runID', executionId);

            const response = await fetch(url.toString(), {
                headers: this.defaultHeaders
            });

            if (!response.ok) throw new Error(`Status ${response.status}`);

            const data = await response.json();
            const dagRuns = data.dagRuns || [];

            const daguData = dagRuns.find(run =>
                run.dagRunId === executionId || run.runID === executionId
            );

            if (!daguData) {
                throw new NotFoundException(`Execution with ID ${executionId} not found`);
            }

            return {
                id: daguData.dagRunId,
                workflow_id: daguData.dagID || 'unknown',
                status: this.mapDaguStatusToOpenApi(daguData.statusLabel || daguData.status),
                started_at: daguData.startedAt,
                finished_at: daguData.finishedAt || null,
                triggered: daguData.triggerType === 'manual',
            };
        } catch (error) {
            if (error instanceof NotFoundException) throw error;
            this.logger.error(`DAGU Fetch Error: ${(error as Error).message}`);
            throw new InternalServerErrorException('Could not fetch execution state.');
        }
    }

    async listExecutions(): Promise<WorkflowExecutionDto[]> {
        try {
            const response = await fetch(`${this.daguApiUrl}/dag-runs`, {
                headers: this.defaultHeaders
            });

            if (!response.ok) throw new Error(`Status ${response.status}`);

            const data = await response.json();
            const runs = data.dagRuns || [];

            return runs.map(run => ({
                id: run.dagRunId,
                workflow_id: run.dagID || 'unknown',
                status: this.mapDaguStatusToOpenApi(run.statusLabel || run.status),
                started_at: run.startedAt,
                finished_at: run.finishedAt || null,
                triggered: run.triggerType === 'manual'
            }));
        } catch (error) {
            this.logger.error(`Failed to fetch executions: ${(error as Error).message}`);
            throw new InternalServerErrorException('Could not fetch workflow executions.');
        }
    }

    private mapDaguStatusToOpenApi(daguStatus: string | number): status {
        const normalized = typeof daguStatus === 'string' ? daguStatus.toLowerCase() : daguStatus;

        switch (normalized) {
            case 1:
            case 'running':
                return status.RUNNING;
            case 2:
            case 'succeeded':
            case 'success':
                return status.COMPLETED;
            case 3:
            case 'failed':
            case 'error':
                return status.FAILED;
            case 6:
            case 'retrying':
                return status.RETRYING;
            default:
                return status.RUNNING;
        }
    }
}