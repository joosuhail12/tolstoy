import { Test, TestingModule } from '@nestjs/testing';
import { InngestExecutionService } from './inngest-execution.service';
import { InngestService } from 'nestjs-inngest';
import { PrismaService } from '../../prisma.service';
import { PinoLogger } from 'nestjs-pino';

describe('InngestExecutionService', () => {
  let service: InngestExecutionService;
  let inngestService: InngestService;
  let prismaService: PrismaService;
  let logger: PinoLogger;

  const mockTenant = {
    orgId: 'test-org-123',
    userId: 'test-user-456',
  };

  const mockFlow = {
    id: 'test-flow-789',
    orgId: 'test-org-123',
    name: 'Test Flow',
    steps: [
      {
        id: 'step-1',
        type: 'sandbox_sync',
        name: 'Test Step',
        config: { code: 'return "test";' },
      },
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockExecutionLog = {
    id: 'exec_123456_abc123',
    flowId: 'test-flow-789',
    orgId: 'test-org-123',
    userId: 'test-user-456',
    stepId: 'flow_start',
    status: 'queued',
    inputs: { testVar: 'testValue' },
    outputs: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const mockInngestService = {
      send: jest.fn().mockResolvedValue(undefined),
    };

    const mockPrismaService = {
      flow: {
        findUnique: jest.fn(),
      },
      executionLog: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        count: jest.fn(),
        groupBy: jest.fn(),
      },
    };

    const mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InngestExecutionService,
        { provide: InngestService, useValue: mockInngestService },
        { provide: PrismaService, useValue: mockPrismaService },
        { 
          provide: `PinoLogger:${InngestExecutionService.name}`, 
          useValue: mockLogger 
        },
      ],
    }).compile();

    service = module.get(InngestExecutionService);
    inngestService = module.get(InngestService);
    prismaService = module.get(PrismaService);
    logger = module.get(`PinoLogger:${InngestExecutionService.name}`);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('executeFlow', () => {
    it('should successfully enqueue a flow for execution', async () => {
      // Setup mocks
      (prismaService.flow.findUnique as jest.Mock).mockResolvedValue(mockFlow);
      (prismaService.executionLog.create as jest.Mock).mockResolvedValue(mockExecutionLog);

      // Execute
      const result = await service.executeFlow(
        'test-flow-789',
        mockTenant,
        { testVar: 'testValue' }
      );

      // Assertions
      expect(prismaService.flow.findUnique).toHaveBeenCalledWith({
        where: { id: 'test-flow-789', orgId: 'test-org-123' },
      });

      expect(result).toMatchObject({
        flowId: 'test-flow-789',
        status: 'queued',
      });

      expect(result.executionId).toMatch(/^exec_\d+_[a-z0-9]{6}$/);
    });

    it('should throw error when flow not found', async () => {
      (prismaService.flow.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.executeFlow('nonexistent-flow', mockTenant, {})
      ).rejects.toThrow('Flow nonexistent-flow not found or access denied');

      expect(prismaService.executionLog.create).not.toHaveBeenCalled();
      expect(inngestService.send).not.toHaveBeenCalled();
    });
  });

  describe('getExecutionStatus', () => {
    it('should return execution status', async () => {
      const mockExecution = {
        ...mockExecutionLog,
        status: 'completed',
        outputs: { result: 'success' },
      };

      (prismaService.executionLog.findUnique as jest.Mock).mockResolvedValue(mockExecution);

      const result = await service.getExecutionStatus('exec_123456_abc123', mockTenant);

      expect(result).toMatchObject({
        executionId: 'exec_123456_abc123',
        flowId: 'test-flow-789',
        status: 'completed',
      });
    });

    it('should throw error when execution not found', async () => {
      (prismaService.executionLog.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.getExecutionStatus('nonexistent-exec', mockTenant)
      ).rejects.toThrow('Execution nonexistent-exec not found or access denied');
    });
  });

  describe('getFlowExecutions', () => {
    it('should return list of executions', async () => {
      const mockExecutions = [
        {
          ...mockExecutionLog,
          user: { id: 'test-user-456', email: 'test@example.com' },
        },
      ];

      (prismaService.executionLog.findMany as jest.Mock).mockResolvedValue(mockExecutions);

      const result = await service.getFlowExecutions('test-flow-789', mockTenant);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        executionId: 'exec_123456_abc123',
        flowId: 'test-flow-789',
        status: 'queued',
      });
    });
  });

  describe('cancelExecution', () => {
    it('should successfully cancel a running execution', async () => {
      (prismaService.executionLog.updateMany as jest.Mock).mockResolvedValue({ count: 1 });

      await service.cancelExecution('exec_123456_abc123', mockTenant);

      expect(prismaService.executionLog.updateMany).toHaveBeenCalledWith({
        where: {
          id: 'exec_123456_abc123',
          orgId: 'test-org-123',
          status: { in: ['queued', 'running'] },
        },
        data: { status: 'cancelled' },
      });
    });

    it('should throw error when execution cannot be cancelled', async () => {
      (prismaService.executionLog.updateMany as jest.Mock).mockResolvedValue({ count: 0 });

      await expect(
        service.cancelExecution('exec_123456_abc123', mockTenant)
      ).rejects.toThrow('Execution exec_123456_abc123 not found or cannot be cancelled');
    });
  });

  describe('retryExecution', () => {
    it('should retry a failed execution', async () => {
      const failedExecution = {
        ...mockExecutionLog,
        status: 'failed',
        inputs: { testVar: 'retryValue' },
      };

      (prismaService.executionLog.findUnique as jest.Mock).mockResolvedValue(failedExecution);
      (prismaService.flow.findUnique as jest.Mock).mockResolvedValue(mockFlow);
      (prismaService.executionLog.create as jest.Mock).mockResolvedValue({ 
        ...mockExecutionLog, 
        id: 'exec_retry_123',
      });

      const result = await service.retryExecution('exec_123456_abc123', mockTenant);

      expect(result.status).toBe('queued');
    });

    it('should throw error when execution is not failed', async () => {
      const runningExecution = {
        ...mockExecutionLog,
        status: 'running',
      };

      (prismaService.executionLog.findUnique as jest.Mock).mockResolvedValue(runningExecution);

      await expect(
        service.retryExecution('exec_123456_abc123', mockTenant)
      ).rejects.toThrow('Execution exec_123456_abc123 is not in failed state');
    });
  });

  describe('getExecutionMetrics', () => {
    it('should return execution metrics', async () => {
      const mockGroupBy = [
        { status: 'completed', _count: { status: 5 } },
        { status: 'failed', _count: { status: 2 } },
        { status: 'running', _count: { status: 1 } },
      ];

      (prismaService.executionLog.groupBy as jest.Mock).mockResolvedValue(mockGroupBy);
      (prismaService.executionLog.count as jest.Mock).mockResolvedValue(8);

      const result = await service.getExecutionMetrics('test-flow-789', mockTenant);

      expect(result).toMatchObject({
        totalExecutions: 8,
        statusBreakdown: {
          completed: 5,
          failed: 2,
          running: 1,
        },
        successRate: 62.5,
      });
    });
  });

  describe('private methods', () => {
    it('should generate unique execution IDs', () => {
      const id1 = service['generateExecutionId']();
      const id2 = service['generateExecutionId']();

      expect(id1).toMatch(/^exec_\d+_[a-z0-9]{6}$/);
      expect(id2).toMatch(/^exec_\d+_[a-z0-9]{6}$/);
      expect(id1).not.toBe(id2);
    });

    it('should parse flow steps correctly', () => {
      const arraySteps = [{ id: 'step-1', type: 'test' }];
      const stringSteps = JSON.stringify(arraySteps);
      const invalidSteps = null;

      expect(service['parseFlowSteps'](arraySteps)).toEqual(arraySteps);
      expect(service['parseFlowSteps'](stringSteps)).toEqual(arraySteps);
      expect(service['parseFlowSteps'](invalidSteps)).toEqual([]);
    });
  });
});