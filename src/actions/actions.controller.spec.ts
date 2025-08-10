import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ActionsController } from './actions.controller';
import { ActionsService } from './actions.service';
import { MetricsService } from '../metrics/metrics.service';
import { CreateActionDto } from './dto/create-action.dto';
import { UpdateActionDto } from './dto/update-action.dto';
import { ExecuteActionDto } from './dto/execute-action.dto';
import { TenantContext } from '../common/interfaces/tenant-context.interface';

describe('ActionsController', () => {
  let controller: ActionsController;
  let actionsService: jest.Mocked<ActionsService>;
  let metricsService: jest.Mocked<MetricsService>;

  const mockTenantContext: TenantContext = {
    orgId: 'test-org-123',
    userId: 'test-user-456',
  };

  const mockAction = {
    id: 'action-123',
    key: 'test_action',
    name: 'Test Action',
    method: 'POST',
    endpoint: '/api/test',
    toolId: 'tool-123',
    orgId: mockTenantContext.orgId,
    headers: { 'Content-Type': 'application/json' },
    inputSchema: [
      {
        name: 'message',
        type: 'string',
        required: true,
        label: 'Message',
        control: 'text',
      },
    ],
    executeIf: null,
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const mockActionsService = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      findByKey: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      executeAction: jest.fn(),
    };

    const mockMetricsService = {
      incrementActionOperation: jest.fn(),
      recordActionCreation: jest.fn(),
      recordActionUpdate: jest.fn(),
      recordActionDeletion: jest.fn(),
      // No recordActionExecution method in MetricsService
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ActionsController],
      providers: [
        { provide: ActionsService, useValue: mockActionsService },
        { provide: MetricsService, useValue: mockMetricsService },
      ],
    }).compile();

    controller = module.get<ActionsController>(ActionsController);
    actionsService = module.get(ActionsService);
    metricsService = module.get(MetricsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create a new action successfully', async () => {
      const createActionDto: CreateActionDto = {
        name: 'Test Action',
        key: 'test_action',
        method: 'POST',
        endpoint: '/api/test',
        toolId: 'tool-123',
        inputSchema: [
          {
            name: 'message',
            type: 'string',
            required: true,
            label: 'Message',
            control: 'text',
          },
        ],
        outputSchema: [],
      };

      actionsService.create.mockResolvedValue(mockAction);

      const result = await controller.create(createActionDto, mockTenantContext);

      expect(result).toEqual(mockAction);
      expect(actionsService.create).toHaveBeenCalledWith(createActionDto, mockTenantContext);
      expect(metricsService.recordActionCreation).toHaveBeenCalledWith({
        orgId: mockTenantContext.orgId,
        actionKey: createActionDto.key,
        toolId: createActionDto.toolId,
        method: createActionDto.method,
      });
    });

    it('should handle duplicate action key error', async () => {
      const createActionDto: CreateActionDto = {
        name: 'Duplicate Action',
        key: 'existing_action',
        method: 'GET',
        endpoint: '/api/duplicate',
        toolId: 'tool-123',
        inputSchema: [],
        outputSchema: [],
      };

      actionsService.create.mockRejectedValue(
        new BadRequestException('Action with key "existing_action" already exists'),
      );

      await expect(controller.create(createActionDto, mockTenantContext)).rejects.toThrow(
        BadRequestException,
      );

      expect(actionsService.create).toHaveBeenCalledWith(createActionDto, mockTenantContext);
      expect(metricsService.recordActionCreation).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should return array of actions for organization', async () => {
      const mockActions = [
        mockAction,
        { ...mockAction, id: 'action-456', key: 'another_action', name: 'Another Action' },
      ];
      actionsService.findAll.mockResolvedValue(mockActions);

      const result = await controller.findAll(mockTenantContext);

      expect(result).toEqual(mockActions);
      expect(actionsService.findAll).toHaveBeenCalledWith(mockTenantContext);
      expect(metricsService.incrementActionOperation).toHaveBeenCalledWith({
        orgId: mockTenantContext.orgId,
        operation: 'list',
      });
    });

    it('should return empty array when no actions exist', async () => {
      actionsService.findAll.mockResolvedValue([]);

      const result = await controller.findAll(mockTenantContext);

      expect(result).toEqual([]);
      expect(actionsService.findAll).toHaveBeenCalledWith(mockTenantContext);
    });
  });

  describe('findOne', () => {
    it('should return a specific action by ID', async () => {
      actionsService.findOne.mockResolvedValue(mockAction);

      const result = await controller.findOne('action-123', mockTenantContext);

      expect(result).toEqual(mockAction);
      expect(actionsService.findOne).toHaveBeenCalledWith('action-123', mockTenantContext);
      expect(metricsService.incrementActionOperation).toHaveBeenCalledWith({
        orgId: mockTenantContext.orgId,
        operation: 'get',
        actionId: 'action-123',
      });
    });

    it('should throw NotFoundException when action does not exist', async () => {
      actionsService.findOne.mockRejectedValue(new NotFoundException('Action not found'));

      await expect(controller.findOne('non-existent-action', mockTenantContext)).rejects.toThrow(
        NotFoundException,
      );

      expect(actionsService.findOne).toHaveBeenCalledWith('non-existent-action', mockTenantContext);
    });
  });

  describe('update', () => {
    it('should update an action successfully', async () => {
      const updateActionDto: UpdateActionDto = {
        name: 'Updated Action Name',
        endpoint: '/api/updated',
      };

      const updatedAction = { ...mockAction, ...updateActionDto };
      actionsService.update.mockResolvedValue(updatedAction);

      const result = await controller.update('action-123', updateActionDto, mockTenantContext);

      expect(result).toEqual(updatedAction);
      expect(actionsService.update).toHaveBeenCalledWith(
        'action-123',
        updateActionDto,
        mockTenantContext,
      );
      expect(metricsService.recordActionUpdate).toHaveBeenCalledWith({
        orgId: mockTenantContext.orgId,
        actionId: 'action-123',
        updatedFields: Object.keys(updateActionDto),
      });
    });

    it('should handle partial updates', async () => {
      const partialUpdateDto: UpdateActionDto = {
        name: 'Only Name Updated',
      };

      const updatedAction = { ...mockAction, name: partialUpdateDto.name };
      actionsService.update.mockResolvedValue(updatedAction);

      const result = await controller.update('action-123', partialUpdateDto, mockTenantContext);

      expect(result).toEqual(updatedAction);
      expect(actionsService.update).toHaveBeenCalledWith(
        'action-123',
        partialUpdateDto,
        mockTenantContext,
      );
    });

    it('should throw NotFoundException when updating non-existent action', async () => {
      const updateDto: UpdateActionDto = { name: 'Updated Name' };
      actionsService.update.mockRejectedValue(new NotFoundException('Action not found'));

      await expect(
        controller.update('non-existent-action', updateDto, mockTenantContext),
      ).rejects.toThrow(NotFoundException);

      expect(actionsService.update).toHaveBeenCalledWith(
        'non-existent-action',
        updateDto,
        mockTenantContext,
      );
    });
  });

  describe('remove', () => {
    it('should remove an action successfully', async () => {
      actionsService.remove.mockResolvedValue(undefined);

      await controller.remove('action-123', mockTenantContext);

      expect(actionsService.remove).toHaveBeenCalledWith('action-123', mockTenantContext);
      expect(metricsService.recordActionDeletion).toHaveBeenCalledWith({
        orgId: mockTenantContext.orgId,
        actionId: 'action-123',
      });
    });

    it('should throw NotFoundException when removing non-existent action', async () => {
      actionsService.remove.mockRejectedValue(new NotFoundException('Action not found'));

      await expect(controller.remove('non-existent-action', mockTenantContext)).rejects.toThrow(
        NotFoundException,
      );

      expect(actionsService.remove).toHaveBeenCalledWith('non-existent-action', mockTenantContext);
    });
  });

  describe('execute', () => {
    it('should execute an action successfully', async () => {
      const executeDto: ExecuteActionDto = {
        message: 'Hello, World!',
      };

      const executionResult = {
        success: true,
        executionId: 'exec-123',
        duration: 1250,
        data: { result: 'Action executed successfully' },
      };

      actionsService.executeAction.mockResolvedValue(executionResult);

      const result = await controller.execute('org-123', 'user-456', 'test_action', executeDto);

      expect(result).toEqual(executionResult);
      expect(actionsService.executeAction).toHaveBeenCalledWith(
        'test_action',
        executeDto,
        mockTenantContext,
      );
      expect(metricsService.recordActionExecution).toHaveBeenCalledWith({
        orgId: mockTenantContext.orgId,
        actionKey: 'test_action',
        success: true,
        duration: 1250,
      });
    });

    it('should handle action execution failure', async () => {
      const executeDto: ExecuteActionDto = {
        message: 'This will fail',
      };

      const executionResult = {
        success: false,
        executionId: 'exec-456',
        duration: 500,
        data: { error: 'API returned 500' },
      };

      actionsService.executeAction.mockResolvedValue(executionResult);

      const result = await controller.execute('org-123', 'user-456', 'test_action', executeDto);

      expect(result).toEqual(executionResult);
      expect(actionsService.executeAction).toHaveBeenCalledWith(
        'test_action',
        executeDto,
        mockTenantContext,
      );
      expect(metricsService.recordActionExecution).toHaveBeenCalledWith({
        orgId: mockTenantContext.orgId,
        actionKey: 'test_action',
        success: false,
        duration: 500,
      });
    });

    it('should throw NotFoundException when executing non-existent action', async () => {
      const executeDto: ExecuteActionDto = { inputs: { message: 'test' } };
      actionsService.executeAction.mockRejectedValue(
        new NotFoundException('Action with key "non_existent_action" not found'),
      );

      await expect(
        controller.execute('non_existent_action', executeDto, mockTenantContext),
      ).rejects.toThrow(NotFoundException);

      expect(actionsService.executeAction).toHaveBeenCalledWith(
        'non_existent_action',
        executeDto,
        mockTenantContext,
      );
    });

    it('should handle validation errors in execution input', async () => {
      const invalidExecuteDto = {}; // Missing required fields

      actionsService.executeAction.mockRejectedValue(
        new BadRequestException('Validation failed: message is required'),
      );

      await expect(
        controller.execute(
          'org-123',
          'user-456',
          'test_action',
          invalidExecuteDto as ExecuteActionDto,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('error handling', () => {
    it('should propagate service errors correctly', async () => {
      const serviceError = new BadRequestException('Service-level validation error');
      actionsService.create.mockRejectedValue(serviceError);

      const createDto: CreateActionDto = {
        name: 'Test Action',
        key: 'test_action',
        method: 'POST',
        endpoint: '/api/test',
        toolId: 'tool-123',
        headers: {},
        inputSchema: [],
      };

      await expect(controller.create(createDto, mockTenantContext)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should handle unexpected errors gracefully', async () => {
      const unexpectedError = new Error('Unexpected database error');
      actionsService.findAll.mockRejectedValue(unexpectedError);

      await expect(controller.findAll(mockTenantContext)).rejects.toThrow(
        'Unexpected database error',
      );
    });
  });

  describe('tenant context validation', () => {
    it('should work with valid tenant context', async () => {
      actionsService.findAll.mockResolvedValue([mockAction]);

      const result = await controller.findAll(mockTenantContext);

      expect(result).toEqual([mockAction]);
      expect(actionsService.findAll).toHaveBeenCalledWith(mockTenantContext);
    });

    it('should handle missing tenant context appropriately', async () => {
      const emptyTenantContext = {} as TenantContext;
      actionsService.findAll.mockResolvedValue([]);

      await controller.findAll(emptyTenantContext);

      expect(actionsService.findAll).toHaveBeenCalledWith(emptyTenantContext);
    });
  });
});
