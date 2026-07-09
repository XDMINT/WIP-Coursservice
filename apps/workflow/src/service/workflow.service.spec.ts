import { Test, TestingModule } from '@nestjs/testing';
import { WorkflowsService} from "./workflow.service";
import { InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { WorkflowExecutionDto} from "../generated";
import status = WorkflowExecutionDto.status;
import {ConfigService} from "@nestjs/config";

describe('WorkflowsService', () => {
  let service: WorkflowsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkflowsService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'DAGU_API_URL') return 'http://localhost:8080/api/v1';
              if (key === 'DAGU_AUTH_BASIC_USERNAME') return 'admin';
              if (key === 'DAGU_AUTH_BASIC_PASSWORD') return 'admin';
              return null;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<WorkflowsService>(WorkflowsService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getWorkflows', () => {
    it('should successfully fetch and map workflows', async () => {
      const mockDaguResponse = {
        dags: [
          {
            fileName: 'init',
            dag: { name: 'init', description: 'Init Semester Workflow' },
          },
        ],
      };

      jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => mockDaguResponse,
      } as Response);

      const result = await service.getWorkflows();

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: 'init',
        name: 'init',
        description: 'Init Semester Workflow',
        parameter_schema: {},
      });
    });

    it('should throw InternalServerErrorException when fetch fails', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: false,
        status: 500,
      } as Response);

      await expect(service.getWorkflows()).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('triggerWorkflow', () => {
    it('should successfully start a workflow and return execution state', async () => {
      const mockTriggerResponse = { dagRunId: 'run-123' };

      jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => mockTriggerResponse,
      } as Response);

      const result = await service.triggerWorkflow('init', { parameters: { semester: 'WS2026' } });

      expect(result.id).toBe('run-123');
      expect(result.status).toBe(status.RUNNING);
      expect(result.triggered).toBe(true);
    });
  });

  describe('getExecutionState', () => {
    it('should find and correctly map the requested execution', async () => {
      const targetId = '019e2b9f-a4f1';
      const mockDagRunsResponse = {
        dagRuns: [
          {
            dagRunId: 'wrong-id',
            dagID: 'init',
            statusLabel: 'running',
            triggerType: 'scheduler',
          },
          {
            dagRunId: targetId,
            dagID: 'init',
            statusLabel: 'succeeded',
            triggerType: 'manual',
            startedAt: '2026-05-15T12:00:00Z',
          },
        ],
      };

      jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => mockDagRunsResponse,
      } as Response);

      const result = await service.getExecutionState(targetId);

      expect(result.id).toBe(targetId);
      expect(result.status).toBe(status.COMPLETED);
      expect(result.triggered).toBe(true);
    });

    it('should throw NotFoundException if execution is not in the list', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({ dagRuns: [] }),
      } as Response);

      await expect(service.getExecutionState('non-existent-id')).rejects.toThrow(NotFoundException);
    });
  });
});