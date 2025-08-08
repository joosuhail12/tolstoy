import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionLogsService, CreateStepLogData } from './execution-logs.service';
import { PrismaService } from '../prisma.service';
import { TenantContext } from '../common/interfaces/tenant-context.interface';

describe('ExecutionLogsService - Step Logging', () => {
  let service: ExecutionLogsService;
  let mockPrismaService: any;

  const mockTenant: TenantContext = {
    orgId: 'org-123',
    userId: 'user-456',
  };

  const mockStepLogData: CreateStepLogData = {
    orgId: 'org-123',
    userId: 'user-456',
    flowId: 'flow-789',
    executionId: 'exec-abc',
    stepKey: 'step-1',
    inputs: {
      stepName: 'test-step',
      stepType: 'webhook',
      config: { message: 'Hello World' },
      variables: {},
      stepOutputs: {},
    },
  };

  const mockExecutionLog = {
    id: 'log-id-123',
    orgId: 'org-123',
    userId: 'user-456',
    flowId: 'flow-789',
    executionId: 'exec-abc',
    stepKey: 'step-1',
    status: 'started',
    inputs: {
      stepName: 'test-step',
      stepType: 'webhook',
      config: { message: 'Hello World' },
      variables: {},
      stepOutputs: {},
    },
    outputs: null,
    error: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    mockPrismaService = {
      executionLog: {
        create: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        groupBy: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExecutionLogsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get(ExecutionLogsService) as ExecutionLogsService;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createStepLog', () => {
    it('should create a step log with started status', async () => {
      mockPrismaService.executionLog.create.mockResolvedValue(mockExecutionLog);

      const result = await service.createStepLog(mockStepLogData);

      expect(result).toEqual(mockExecutionLog);
      expect(mockPrismaService.executionLog.create).toHaveBeenCalledWith({
        data: {
          orgId: 'org-123',
          userId: 'user-456',
          flowId: 'flow-789',
          executionId: 'exec-abc',
          stepKey: 'step-1',
          inputs: {
            stepName: 'test-step',
            stepType: 'webhook',
            config: { message: 'Hello World' },
            variables: {},
            stepOutputs: {},
          },
          status: 'started',
          outputs: undefined,
          error: undefined,
        },
      });
    });

    it('should create a step log with custom status', async () => {
      const customData = { ...mockStepLogData, status: 'custom' };
      mockPrismaService.executionLog.create.mockResolvedValue({
        ...mockExecutionLog,
        status: 'custom',
      });

      await service.createStepLog(customData);

      expect(mockPrismaService.executionLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          status: 'custom',
        }),
      });
    });
  });

  describe('updateStepStatus', () => {
    it('should update step status and outputs', async () => {
      const updatedLog = {
        ...mockExecutionLog,
        status: 'completed',
        outputs: { result: 'success' },
      };
      mockPrismaService.executionLog.update.mockResolvedValue(updatedLog);

      const result = await service.updateStepStatus('log-id-123', 'completed', {
        outputs: { result: 'success' },
      });

      expect(result).toEqual(updatedLog);
      expect(mockPrismaService.executionLog.update).toHaveBeenCalledWith({
        where: { id: 'log-id-123' },
        data: {
          status: 'completed',
          outputs: { result: 'success' },
          error: undefined,
        },
      });
    });

    it('should update step status with error', async () => {
      const error = { message: 'Step failed', code: 'STEP_ERROR' };
      const updatedLog = { ...mockExecutionLog, status: 'failed', error };
      mockPrismaService.executionLog.update.mockResolvedValue(updatedLog);

      const result = await service.updateStepStatus('log-id-123', 'failed', { error });

      expect(result).toEqual(updatedLog);
      expect(mockPrismaService.executionLog.update).toHaveBeenCalledWith({
        where: { id: 'log-id-123' },
        data: {
          status: 'failed',
          outputs: undefined,
          error,
        },
      });
    });
  });

  describe('markStepStarted', () => {
    it('should create a step log in started status', async () => {
      mockPrismaService.executionLog.create.mockResolvedValue(mockExecutionLog);

      const result = await service.markStepStarted(
        'org-123',
        'user-456',
        'flow-789',
        'exec-abc',
        'step-1',
        {
          stepName: 'test-step',
          stepType: 'action',
          config: { action: 'test' },
          variables: {},
          stepOutputs: {},
        },
      );

      expect(result).toEqual(mockExecutionLog);
      expect(mockPrismaService.executionLog.create).toHaveBeenCalledWith({
        data: {
          orgId: 'org-123',
          userId: 'user-456',
          flowId: 'flow-789',
          executionId: 'exec-abc',
          stepKey: 'step-1',
          inputs: {
            stepName: 'test-step',
            stepType: 'action',
            config: { action: 'test' },
            variables: {},
            stepOutputs: {},
          },
          status: 'started',
          outputs: undefined,
          error: undefined,
        },
      });
    });
  });

  describe('markStepCompleted', () => {
    it('should update step to completed status with outputs', async () => {
      const outputs = { result: 'success', data: { id: 123 } };
      const updatedLog = { ...mockExecutionLog, status: 'completed', outputs };
      mockPrismaService.executionLog.update.mockResolvedValue(updatedLog);

      const result = await service.markStepCompleted('log-id-123', outputs);

      expect(result).toEqual(updatedLog);
      expect(mockPrismaService.executionLog.update).toHaveBeenCalledWith({
        where: { id: 'log-id-123' },
        data: {
          status: 'completed',
          outputs,
          error: undefined,
        },
      });
    });
  });

  describe('markStepFailed', () => {
    it('should update step to failed status with error details', async () => {
      const error = new Error('Network timeout');
      (error as any).code = 'ETIMEDOUT';

      const expectedError = {
        message: 'Network timeout',
        code: 'ETIMEDOUT',
        stack: error.stack,
      };

      const updatedLog = { ...mockExecutionLog, status: 'failed', error: expectedError };
      mockPrismaService.executionLog.update.mockResolvedValue(updatedLog);

      const result = await service.markStepFailed('log-id-123', error);

      expect(result).toEqual(updatedLog);
      expect(mockPrismaService.executionLog.update).toHaveBeenCalledWith({
        where: { id: 'log-id-123' },
        data: {
          status: 'failed',
          outputs: undefined,
          error: expectedError,
        },
      });
    });

    it('should handle unknown error objects', async () => {
      const error = { custom: 'error object' };
      const expectedError = {
        message: 'Unknown error',
        code: 'UNKNOWN_ERROR',
        stack: undefined,
        custom: 'error object',
      };

      mockPrismaService.executionLog.update.mockResolvedValue(mockExecutionLog);

      await service.markStepFailed('log-id-123', error);

      expect(mockPrismaService.executionLog.update).toHaveBeenCalledWith({
        where: { id: 'log-id-123' },
        data: {
          status: 'failed',
          outputs: undefined,
          error: expectedError,
        },
      });
    });
  });

  describe('markStepSkipped', () => {
    it('should update step to skipped status', async () => {
      const updatedLog = { ...mockExecutionLog, status: 'skipped' };
      mockPrismaService.executionLog.update.mockResolvedValue(updatedLog);

      const result = await service.markStepSkipped('log-id-123');

      expect(result).toEqual(updatedLog);
      expect(mockPrismaService.executionLog.update).toHaveBeenCalledWith({
        where: { id: 'log-id-123' },
        data: {
          status: 'skipped',
          outputs: undefined,
          error: undefined,
        },
      });
    });

    it('should update step to skipped status with reason', async () => {
      const reason = 'executeIf condition failed';
      const updatedLog = {
        ...mockExecutionLog,
        status: 'skipped',
        outputs: { skipReason: reason },
      };
      mockPrismaService.executionLog.update.mockResolvedValue(updatedLog);

      const result = await service.markStepSkipped('log-id-123', reason);

      expect(result).toEqual(updatedLog);
      expect(mockPrismaService.executionLog.update).toHaveBeenCalledWith({
        where: { id: 'log-id-123' },
        data: {
          status: 'skipped',
          outputs: { skipReason: reason },
          error: undefined,
        },
      });
    });
  });

  describe('getExecutionLogs', () => {
    it('should return execution logs for a specific execution', async () => {
      const mockLogs = [
        { ...mockExecutionLog, stepKey: 'step-1' },
        { ...mockExecutionLog, stepKey: 'step-2' },
      ];
      mockPrismaService.executionLog.findMany.mockResolvedValue(mockLogs);

      const result = await service.getExecutionLogs('exec-abc', mockTenant);

      expect(result).toEqual(mockLogs);
      expect(mockPrismaService.executionLog.findMany).toHaveBeenCalledWith({
        where: {
          executionId: 'exec-abc',
          orgId: 'org-123',
        },
        orderBy: { createdAt: 'asc' },
      });
    });
  });

  describe('getStepLogs', () => {
    it('should return step logs for a specific flow execution', async () => {
      const mockLogs = [mockExecutionLog];
      mockPrismaService.executionLog.findMany.mockResolvedValue(mockLogs);

      const result = await service.getStepLogs('flow-789', 'exec-abc', mockTenant);

      expect(result).toEqual(mockLogs);
      expect(mockPrismaService.executionLog.findMany).toHaveBeenCalledWith({
        where: {
          flowId: 'flow-789',
          executionId: 'exec-abc',
          orgId: 'org-123',
        },
        orderBy: { createdAt: 'asc' },
      });
    });
  });

  describe('getExecutionStats', () => {
    it('should return aggregated execution statistics', async () => {
      const mockStats = [
        { status: 'completed', _count: { status: 10 } },
        { status: 'failed', _count: { status: 3 } },
        { status: 'skipped', _count: { status: 2 } },
      ];

      mockPrismaService.executionLog.groupBy.mockResolvedValue(mockStats);
      mockPrismaService.executionLog.count.mockResolvedValue(15);

      const result = await service.getExecutionStats('org-123');

      expect(result).toEqual({
        totalExecutions: 15,
        completedSteps: 10,
        failedSteps: 3,
        skippedSteps: 2,
        avgExecutionTime: 0,
      });

      expect(mockPrismaService.executionLog.groupBy).toHaveBeenCalledWith({
        by: ['status'],
        where: { orgId: 'org-123' },
        _count: { status: true },
      });
      expect(mockPrismaService.executionLog.count).toHaveBeenCalledWith({
        where: { orgId: 'org-123' },
      });
    });

    it('should return stats with time range filter', async () => {
      const timeRange = {
        from: new Date('2023-01-01'),
        to: new Date('2023-12-31'),
      };

      mockPrismaService.executionLog.groupBy.mockResolvedValue([]);
      mockPrismaService.executionLog.count.mockResolvedValue(0);

      await service.getExecutionStats('org-123', timeRange);

      expect(mockPrismaService.executionLog.groupBy).toHaveBeenCalledWith({
        by: ['status'],
        where: {
          orgId: 'org-123',
          createdAt: {
            gte: timeRange.from,
            lte: timeRange.to,
          },
        },
        _count: { status: true },
      });
    });
  });
});
