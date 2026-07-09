/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type WorkflowExecutionDto = {
    /**
     * Die eindeutige ID des Laufs (dagRunId)
     */
    id: string;
    /**
     * Der Name des zugrunde liegenden Workflows (z.B. "init")
     */
    workflow_id: string;
    status: WorkflowExecutionDto.status;
    started_at?: string;
    finished_at?: string | null;
    triggered?: boolean;
};
export namespace WorkflowExecutionDto {
    export enum status {
        RUNNING = 'RUNNING',
        COMPLETED = 'COMPLETED',
        FAILED = 'FAILED',
        RETRYING = 'RETRYING',
    }
}

