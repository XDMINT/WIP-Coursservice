import { Test, TestingModule } from '@nestjs/testing';
import { WorkflowController} from "./workflow.controller";
import { WorkflowsService} from "../service/workflow.service";

describe('WorkflowController', () => {
  let controller: WorkflowController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WorkflowController],
      providers: [
        {
          provide: WorkflowsService,
          useValue: {
            getWorkflows: jest.fn(),
            triggerWorkflow: jest.fn(),
            getExecutionState: jest.fn(),
            listExecutions: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<WorkflowController>(WorkflowController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});