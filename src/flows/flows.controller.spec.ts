import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { FlowsController } from './flows.controller';
import { FlowsService } from './flows.service';
import { MetricsService } from '../metrics/metrics.service';
import { CreateFlowDto } from './dto/create-flow.dto';
import { UpdateFlowDto } from './dto/update-flow.dto';
import { TenantContext } from '../common/interfaces/tenant-context.interface';

describe('FlowsController', () => {
  let controller: FlowsController;
  let flowsService: jest.Mocked<FlowsService>;
  let metricsService: jest.Mocked<MetricsService>;

  const mockTenantContext: TenantContext = {
    orgId: 'test-org-123',
    userId: 'test-user-456',
  };

  const mockFlow = {
    id: 'flow-123',
    name: 'Test Flow',
    description: 'A test workflow',
    version: 1,
    orgId: mockTenantContext.orgId,
    steps: [
      {
        id: 'step-1',
        type: 'action',
        name: 'Send Message',
        config: {
          actionKey: 'send_message',
          parameters: {
            message: 'Hello World',
          },
        },
      },
    ],
    settings: {
      timeout: 30000,
      retryAttempts: 3,
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockExecutionResult = {
    executionId: 'exec-123',
    status: 'started',
    flowId: 'flow-123',
    startedAt: new Date(),
  };

  beforeEach(async () => {
    const mockFlowsService = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      execute: jest.fn(),
      getExecution: jest.fn(),
      cancelExecution: jest.fn(),
      retryExecution: jest.fn(),
      getStatistics: jest.fn(),
    };

    const mockMetricsService = {
      incrementFlowOperation: jest.fn(),
      recordFlowCreation: jest.fn(),
      recordFlowUpdate: jest.fn(),
      recordFlowDeletion: jest.fn(),
      recordFlowExecution: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [FlowsController],
      providers: [
        { provide: FlowsService, useValue: mockFlowsService },
        { provide: MetricsService, useValue: mockMetricsService },
      ],
    }).compile();

    controller = module.get<FlowsController>(FlowsController);
    flowsService = module.get(FlowsService);
    metricsService = module.get(MetricsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create a new flow successfully', async () => {
      const createFlowDto: CreateFlowDto = {
        name: 'Test Flow',
        description: 'A test workflow',
        steps: [
          {
            id: 'step-1',
            type: 'action',
            name: 'Send Message',
            config: {
              actionKey: 'send_message',
              parameters: {
                message: 'Hello World',
              },
            },
          },
        ],
        settings: {
          timeout: 30000,
          retryAttempts: 3,
        },
      };

      flowsService.create.mockResolvedValue(mockFlow);

      const result = await controller.create(createFlowDto, mockTenantContext);

      expect(result).toEqual(mockFlow);
      expect(flowsService.create).toHaveBeenCalledWith(createFlowDto, mockTenantContext);
      expect(metricsService.recordFlowCreation).toHaveBeenCalledWith({
        orgId: mockTenantContext.orgId,
        flowName: createFlowDto.name,
        stepCount: createFlowDto.steps.length,
      });
    });

    it('should handle duplicate flow name error', async () => {
      const createFlowDto: CreateFlowDto = {
        name: 'Existing Flow',
        description: 'This will fail',
        steps: [],
        settings: {},
      };

      flowsService.create.mockRejectedValue(
        new BadRequestException('Flow with name "Existing Flow" already exists')
      );

      await expect(controller.create(createFlowDto, mockTenantContext))
        .rejects.toThrow(BadRequestException);

      expect(flowsService.create).toHaveBeenCalledWith(createFlowDto, mockTenantContext);
      expect(metricsService.recordFlowCreation).not.toHaveBeenCalled();
    });

    it('should validate flow steps structure', async () => {
      const createFlowDto: CreateFlowDto = {
        name: 'Invalid Flow',
        description: 'Flow with invalid steps',
        steps: [
          {
            id: '', // Invalid: empty ID
            type: 'invalid-type' as any, // Invalid: not a valid step type
            name: '',
            config: {},
          },
        ],
        settings: {},
      };

      flowsService.create.mockResolvedValue(mockFlow);

      await controller.create(createFlowDto, mockTenantContext);

      expect(flowsService.create).toHaveBeenCalledWith(createFlowDto, mockTenantContext);
    });
  });

  describe('findAll', () => {
    it('should return array of flows for organization', async () => {
      const mockFlows = [
        mockFlow,
        { ...mockFlow, id: 'flow-456', name: 'Another Flow' },
      ];
      flowsService.findAll.mockResolvedValue(mockFlows);

      const result = await controller.findAll(mockTenantContext);

      expect(result).toEqual(mockFlows);
      expect(flowsService.findAll).toHaveBeenCalledWith(mockTenantContext);
      expect(metricsService.incrementFlowOperation).toHaveBeenCalledWith({
        orgId: mockTenantContext.orgId,
        operation: 'list',
      });
    });

    it('should return empty array when no flows exist', async () => {
      flowsService.findAll.mockResolvedValue([]);

      const result = await controller.findAll(mockTenantContext);

      expect(result).toEqual([]);
      expect(flowsService.findAll).toHaveBeenCalledWith(mockTenantContext);
    });
  });

  describe('findOne', () => {
    it('should return a specific flow by ID', async () => {
      flowsService.findOne.mockResolvedValue(mockFlow);

      const result = await controller.findOne('flow-123', mockTenantContext);

      expect(result).toEqual(mockFlow);
      expect(flowsService.findOne).toHaveBeenCalledWith('flow-123', mockTenantContext);
      expect(metricsService.incrementFlowOperation).toHaveBeenCalledWith({
        orgId: mockTenantContext.orgId,
        operation: 'get',
        flowId: 'flow-123',
      });
    });

    it('should throw NotFoundException when flow does not exist', async () => {
      flowsService.findOne.mockRejectedValue(new NotFoundException('Flow not found'));

      await expect(controller.findOne('non-existent-flow', mockTenantContext))
        .rejects.toThrow(NotFoundException);

      expect(flowsService.findOne).toHaveBeenCalledWith('non-existent-flow', mockTenantContext);
    });
  });

  describe('update', () => {
    it('should update a flow successfully', async () => {
      const updateFlowDto: UpdateFlowDto = {
        name: 'Updated Flow Name',
        description: 'Updated description',
      };

      const updatedFlow = { ...mockFlow, ...updateFlowDto };
      flowsService.update.mockResolvedValue(updatedFlow);

      const result = await controller.update('flow-123', updateFlowDto, mockTenantContext);

      expect(result).toEqual(updatedFlow);
      expect(flowsService.update).toHaveBeenCalledWith('flow-123', updateFlowDto, mockTenantContext);
      expect(metricsService.recordFlowUpdate).toHaveBeenCalledWith({
        orgId: mockTenantContext.orgId,
        flowId: 'flow-123',
        updatedFields: Object.keys(updateFlowDto),
      });
    });

    it('should handle partial updates', async () => {
      const partialUpdateDto: UpdateFlowDto = {
        description: 'Only description updated',
      };

      const updatedFlow = { ...mockFlow, description: partialUpdateDto.description };
      flowsService.update.mockResolvedValue(updatedFlow);

      const result = await controller.update('flow-123', partialUpdateDto, mockTenantContext);

      expect(result).toEqual(updatedFlow);
      expect(flowsService.update).toHaveBeenCalledWith('flow-123', partialUpdateDto, mockTenantContext);
    });
  });

  describe('remove', () => {
    it('should remove a flow successfully', async () => {
      flowsService.remove.mockResolvedValue(undefined);

      await controller.remove('flow-123', mockTenantContext);

      expect(flowsService.remove).toHaveBeenCalledWith('flow-123', mockTenantContext);
      expect(metricsService.recordFlowDeletion).toHaveBeenCalledWith({
        orgId: mockTenantContext.orgId,
        flowId: 'flow-123',
      });
    });

    it('should throw NotFoundException when removing non-existent flow', async () => {
      flowsService.remove.mockRejectedValue(new NotFoundException('Flow not found'));

      await expect(controller.remove('non-existent-flow', mockTenantContext))
        .rejects.toThrow(NotFoundException);

      expect(flowsService.remove).toHaveBeenCalledWith('non-existent-flow', mockTenantContext);
    });
  });

  describe('execute', () => {
    it('should execute a flow successfully', async () => {
      const executeData = {
        flowId: 'flow-123',
        variables: {
          userId: 'user-123',
          message: 'Test execution',
        },
      };

      flowsService.execute.mockResolvedValue(mockExecutionResult);

      const result = await controller.execute(executeData, mockTenantContext);

      expect(result).toEqual(mockExecutionResult);
      expect(flowsService.execute).toHaveBeenCalledWith(executeData.flowId, executeData.variables, mockTenantContext);
      expect(metricsService.recordFlowExecution).toHaveBeenCalledWith({
        orgId: mockTenantContext.orgId,
        flowId: 'flow-123',
        executionId: 'exec-123',
        status: 'started',
      });
    });

    it('should handle flow execution errors', async () => {
      const executeData = {
        flowId: 'flow-123',
        variables: {},
      };

      flowsService.execute.mockRejectedValue(
        new BadRequestException('Flow execution failed: invalid variables')
      );

      await expect(controller.execute(executeData, mockTenantContext))
        .rejects.toThrow(BadRequestException);

      expect(flowsService.execute).toHaveBeenCalledWith(executeData.flowId, executeData.variables, mockTenantContext);
    });

    it('should execute flow without variables', async () => {
      const executeData = {
        flowId: 'flow-123',
      };

      flowsService.execute.mockResolvedValue(mockExecutionResult);

      const result = await controller.execute(executeData, mockTenantContext);

      expect(result).toEqual(mockExecutionResult);
      expect(flowsService.execute).toHaveBeenCalledWith('flow-123', undefined, mockTenantContext);
    });
  });

  describe('getExecution', () => {
    it('should return execution status successfully', async () => {
      const mockExecution = {
        executionId: 'exec-123',
        flowId: 'flow-123',
        status: 'running',
        progress: 0.5,
        startedAt: new Date(),
        variables: { userId: 'user-123' },
      };

      flowsService.getExecution.mockResolvedValue(mockExecution);

      const result = await controller.getExecution('exec-123', mockTenantContext);

      expect(result).toEqual(mockExecution);
      expect(flowsService.getExecution).toHaveBeenCalledWith('exec-123', mockTenantContext);
    });

    it('should throw NotFoundException for non-existent execution', async () => {
      flowsService.getExecution.mockRejectedValue(new NotFoundException('Execution not found'));

      await expect(controller.getExecution('non-existent-exec', mockTenantContext))
        .rejects.toThrow(NotFoundException);
    });
  });

  describe('cancelExecution', () => {
    it('should cancel execution successfully', async () => {
      const cancelResult = {
        executionId: 'exec-123',
        status: 'cancelled',
        cancelledAt: new Date(),
      };

      flowsService.cancelExecution.mockResolvedValue(cancelResult);

      const result = await controller.cancelExecution('exec-123', mockTenantContext);

      expect(result).toEqual(cancelResult);
      expect(flowsService.cancelExecution).toHaveBeenCalledWith('exec-123', mockTenantContext);
    });
  });

  describe('retryExecution', () => {
    it('should retry execution successfully', async () => {
      const retryResult = {
        newExecutionId: 'exec-456',
        status: 'started',
        retryAttempt: 2,
      };

      flowsService.retryExecution.mockResolvedValue(retryResult);

      const result = await controller.retryExecution('exec-123', mockTenantContext);

      expect(result).toEqual(retryResult);
      expect(flowsService.retryExecution).toHaveBeenCalledWith('exec-123', mockTenantContext);
    });
  });

  describe('getStatistics', () => {
    it('should return flow statistics successfully', async () => {
      const mockStats = {
        totalExecutions: 152,
        successfulExecutions: 140,
        failedExecutions: 12,
        averageExecutionTime: 4250.5,
        lastExecutionAt: new Date(),
      };

      flowsService.getStatistics.mockResolvedValue(mockStats);

      const result = await controller.getStatistics('flow-123', mockTenantContext);

      expect(result).toEqual(mockStats);
      expect(flowsService.getStatistics).toHaveBeenCalledWith('flow-123', mockTenantContext);
    });

    it('should handle statistics for flow with no executions', async () => {
      const mockStats = {
        totalExecutions: 0,
        successfulExecutions: 0,
        failedExecutions: 0,
        averageExecutionTime: 0,
        lastExecutionAt: null,
      };

      flowsService.getStatistics.mockResolvedValue(mockStats);

      const result = await controller.getStatistics('flow-123', mockTenantContext);

      expect(result).toEqual(mockStats);
    });
  });

  describe('error handling', () => {
    it('should propagate service errors correctly', async () => {
      const serviceError = new BadRequestException('Service-level validation error');
      flowsService.create.mockRejectedValue(serviceError);

      const createDto: CreateFlowDto = {
        name: 'Test Flow',
        description: 'Test',
        steps: [],
        settings: {},
      };

      await expect(controller.create(createDto, mockTenantContext))
        .rejects.toThrow(BadRequestException);
    });

    it('should handle unexpected errors gracefully', async () => {
      const unexpectedError = new Error('Unexpected database error');
      flowsService.findAll.mockRejectedValue(unexpectedError);

      await expect(controller.findAll(mockTenantContext))
        .rejects.toThrow('Unexpected database error');
    });
  });
});