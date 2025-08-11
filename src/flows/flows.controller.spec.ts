import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { FlowsController } from './flows.controller';
import { FlowsService } from './flows.service';
import { FlowExecutorService } from './flow-executor.service';
import { InngestExecutionService } from './inngest/inngest-execution.service';
import { CreateFlowDto } from './dto/create-flow.dto';
import { UpdateFlowDto } from './dto/update-flow.dto';
import { TenantContext } from '../common/interfaces/tenant-context.interface';

describe('FlowsController', () => {
  let controller: FlowsController;
  let flowsService: jest.Mocked<FlowsService>;
  let flowExecutorService: jest.Mocked<FlowExecutorService>;
  let inngestExecutionService: jest.Mocked<InngestExecutionService>;

  const mockTenantContext: TenantContext = {
    orgId: 'test-org-123',
    userId: 'test-user-456',
  };

  const mockFlow = {
    id: 'flow-123',
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
    };

    const mockFlowExecutorService = {
      executeFlow: jest.fn(),
      getExecutionStatus: jest.fn(),
      cancelExecution: jest.fn(),
      retryExecution: jest.fn(),
    };

    const mockInngestExecutionService = {
      getExecutions: jest.fn(),
      getExecutionMetrics: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [FlowsController],
      providers: [
        { provide: FlowsService, useValue: mockFlowsService },
        { provide: FlowExecutorService, useValue: mockFlowExecutorService },
        { provide: InngestExecutionService, useValue: mockInngestExecutionService },
        {
          provide: `PinoLogger:FlowsController`,
          useValue: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
        },
      ],
    }).compile();

    controller = module.get<FlowsController>(FlowsController);
    flowsService = module.get(FlowsService);
    flowExecutorService = module.get(FlowExecutorService);
    inngestExecutionService = module.get(InngestExecutionService);
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
        version: 1,
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
    });

    it('should handle duplicate flow name error', async () => {
      const createFlowDto: CreateFlowDto = {
        name: 'Existing Flow',
        description: 'This will fail',
        version: 1,
        steps: [],
        settings: {},
      };

      flowsService.create.mockRejectedValue(
        new BadRequestException('Flow with name "Existing Flow" already exists'),
      );

      await expect(controller.create(createFlowDto, mockTenantContext)).rejects.toThrow(
        BadRequestException,
      );

      expect(flowsService.create).toHaveBeenCalledWith(createFlowDto, mockTenantContext);
    });

    it('should validate flow steps structure', async () => {
      const createFlowDto: CreateFlowDto = {
        name: 'Invalid Flow',
        description: 'Flow with invalid steps',
        version: 1,
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
      const mockFlows = [mockFlow, { ...mockFlow, id: 'flow-456', name: 'Another Flow' }];
      flowsService.findAll.mockResolvedValue(mockFlows);

      const result = await controller.findAll(mockTenantContext);

      expect(result).toEqual(mockFlows);
      expect(flowsService.findAll).toHaveBeenCalledWith(mockTenantContext);
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
    });

    it('should throw NotFoundException when flow does not exist', async () => {
      flowsService.findOne.mockRejectedValue(new NotFoundException('Flow not found'));

      await expect(controller.findOne('non-existent-flow', mockTenantContext)).rejects.toThrow(
        NotFoundException,
      );

      expect(flowsService.findOne).toHaveBeenCalledWith('non-existent-flow', mockTenantContext);
    });
  });

  describe('update', () => {
    it('should update a flow successfully', async () => {
      const updateFlowDto: UpdateFlowDto = {
        name: 'Updated Flow Name',
        description: 'Updated description',
      };

      const updatedFlow = { ...mockFlow };
      flowsService.update.mockResolvedValue(updatedFlow);

      const result = await controller.update('flow-123', updateFlowDto, mockTenantContext);

      expect(result).toEqual(updatedFlow);
      expect(flowsService.update).toHaveBeenCalledWith(
        'flow-123',
        updateFlowDto,
        mockTenantContext,
      );
    });

    it('should handle partial updates', async () => {
      const partialUpdateDto: UpdateFlowDto = {
        description: 'Only description updated',
      };

      const updatedFlow = { ...mockFlow };
      flowsService.update.mockResolvedValue(updatedFlow);

      const result = await controller.update('flow-123', partialUpdateDto, mockTenantContext);

      expect(result).toEqual(updatedFlow);
      expect(flowsService.update).toHaveBeenCalledWith(
        'flow-123',
        partialUpdateDto,
        mockTenantContext,
      );
    });
  });

  describe('remove', () => {
    it('should remove a flow successfully', async () => {
      flowsService.remove.mockResolvedValue(undefined);

      await controller.remove('flow-123', mockTenantContext);

      expect(flowsService.remove).toHaveBeenCalledWith('flow-123', mockTenantContext);
    });

    it('should throw NotFoundException when removing non-existent flow', async () => {
      flowsService.remove.mockRejectedValue(new NotFoundException('Flow not found'));

      await expect(controller.remove('non-existent-flow', mockTenantContext)).rejects.toThrow(
        NotFoundException,
      );

      expect(flowsService.remove).toHaveBeenCalledWith('non-existent-flow', mockTenantContext);
    });
  });
});
