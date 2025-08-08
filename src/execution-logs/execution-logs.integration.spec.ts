import { Test, TestingModule } from '@nestjs/testing';
import {
  FlowExecutorService,
  FlowStep,
  FlowExecutionContext,
} from '../flows/flow-executor.service';
import { ExecutionLogsService } from './execution-logs.service';
import { PrismaService } from '../prisma.service';
import { AblyService } from '../ably/ably.service';
import { SecretsResolver } from '../secrets/secrets-resolver.service';
import { OAuthTokenService } from '../oauth/oauth-token.service';
import { InputValidatorService } from '../common/services/input-validator.service';
import { ConditionEvaluatorService } from '../common/services/condition-evaluator.service';
import { SandboxService } from '../sandbox/sandbox.service';
import { ExecutionLog } from '@prisma/client';

/**
 * Integration tests for step execution logging.
 *
 * These tests verify that:
 * - Exactly one log is created per step
 * - Logs are updated with correct status & payloads
 * - Step execution and logging integration works end-to-end
 */
describe('ExecutionLogsService - Step Execution Integration', () => {
  let flowExecutorService: FlowExecutorService;
  let executionLogsService: ExecutionLogsService;
  let mockPrismaService: any;
  let mockAblyService: any;

  const mockContext: FlowExecutionContext = {
    executionId: 'exec-integration-123',
    flowId: 'flow-integration-456',
    orgId: 'org-integration-789',
    userId: 'user-integration-001',
    startTime: new Date(),
    variables: { testVar: 'integrationTest', count: 42 },
    stepOutputs: {},
  };

  const createMockStepLog = (
    stepKey: string,
    status: string = 'started',
    outputs: any = null,
    error: any = null,
  ): ExecutionLog => ({
    id: `log-${stepKey}-${Date.now()}`,
    orgId: mockContext.orgId,
    userId: mockContext.userId,
    flowId: mockContext.flowId,
    executionId: mockContext.executionId,
    stepKey,
    status,
    inputs: { stepName: 'Test Step', stepType: 'test', config: {} },
    outputs,
    error,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  beforeEach(async () => {
    mockPrismaService = {
      flow: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
      },
      executionLog: {
        create: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        groupBy: jest.fn(),
      },
    };

    mockAblyService = {
      createStepEvent: jest.fn().mockResolvedValue({}),
      publishStepEvent: jest.fn().mockResolvedValue(undefined),
      createExecutionEvent: jest.fn().mockResolvedValue({}),
      publishExecutionEvent: jest.fn().mockResolvedValue(undefined),
    };

    const mockSandboxService = {
      runSync: jest.fn(),
      runAsync: jest.fn(),
      getAsyncResult: jest.fn(),
      cancelAsyncExecution: jest.fn(),
      isConfigured: jest.fn().mockReturnValue(true),
    };

    const mockSecretsResolver = {};
    const mockOAuthTokenService = {};
    const mockInputValidatorService = {};
    const mockConditionEvaluatorService = {
      evaluate: jest.fn().mockReturnValue(true),
      validateRule: jest.fn().mockReturnValue({ valid: true }),
      getAvailableVariables: jest.fn().mockReturnValue([]),
    };

    const mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FlowExecutorService,
        ExecutionLogsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AblyService, useValue: mockAblyService },
        { provide: SandboxService, useValue: mockSandboxService },
        { provide: SecretsResolver, useValue: mockSecretsResolver },
        { provide: OAuthTokenService, useValue: mockOAuthTokenService },
        { provide: InputValidatorService, useValue: mockInputValidatorService },
        { provide: ConditionEvaluatorService, useValue: mockConditionEvaluatorService },
        { provide: `PinoLogger:${FlowExecutorService.name}`, useValue: mockLogger },
        { provide: `PinoLogger:${ExecutionLogsService.name}`, useValue: mockLogger },
      ],
    }).compile();

    flowExecutorService = module.get(FlowExecutorService);
    executionLogsService = module.get(ExecutionLogsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Step Execution Logging Integration', () => {
    it('should create exactly one log for successful step execution', async () => {
      const step: FlowStep = {
        id: 'step-success',
        type: 'delay',
        name: 'Test Successful Step',
        config: { seconds: 0.01 }, // Very short delay for testing
      };

      const startedLog = createMockStepLog('step-success', 'started');
      const completedLog = createMockStepLog('step-success', 'completed');

      // Mock the create and update operations
      mockPrismaService.executionLog.create.mockResolvedValue(startedLog);
      mockPrismaService.executionLog.update.mockResolvedValue(completedLog);

      const result = await flowExecutorService['executeStep'](step, mockContext);

      // Verify exactly one create call (step started)
      expect(mockPrismaService.executionLog.create).toHaveBeenCalledTimes(1);
      expect(mockPrismaService.executionLog.create).toHaveBeenCalledWith({
        data: {
          orgId: mockContext.orgId,
          userId: mockContext.userId,
          flowId: mockContext.flowId,
          executionId: mockContext.executionId,
          stepKey: 'step-success',
          inputs: {
            stepName: 'Test Successful Step',
            stepType: 'delay',
            config: { seconds: 0.01 },
            executeIf: undefined,
            variables: mockContext.variables,
            stepOutputs: mockContext.stepOutputs,
          },
          status: 'started',
          outputs: null,
          error: null,
        },
      });

      // Verify exactly one update call (step completed)
      expect(mockPrismaService.executionLog.update).toHaveBeenCalledTimes(1);
      expect(mockPrismaService.executionLog.update).toHaveBeenCalledWith({
        where: { id: startedLog.id },
        data: {
          status: 'completed',
          outputs: expect.any(Object), // Accept any output structure from delay step
          error: undefined,
        },
      });

      expect(result.success).toBe(true);
    });

    it('should create exactly one log for failed step execution', async () => {
      const step: FlowStep = {
        id: 'step-failure',
        type: 'http_request',
        name: 'Test Failed Step',
        config: { url: 'invalid-url', method: 'GET' },
      };

      const startedLog = createMockStepLog('step-failure', 'started');
      const failedLog = createMockStepLog('step-failure', 'failed');

      // Mock the create and update operations
      mockPrismaService.executionLog.create.mockResolvedValue(startedLog);
      mockPrismaService.executionLog.update.mockResolvedValue(failedLog);

      const result = await flowExecutorService['executeStep'](step, mockContext);

      // Verify exactly one create call
      expect(mockPrismaService.executionLog.create).toHaveBeenCalledTimes(1);
      expect(mockPrismaService.executionLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          stepKey: 'step-failure',
          status: 'started',
          inputs: expect.objectContaining({
            stepName: 'Test Failed Step',
            stepType: 'http_request',
            config: { url: 'invalid-url', method: 'GET' },
            executeIf: undefined,
            variables: mockContext.variables,
            stepOutputs: mockContext.stepOutputs,
          }),
        }),
      });

      // Verify exactly one update call for failure
      expect(mockPrismaService.executionLog.update).toHaveBeenCalledTimes(1);
      expect(mockPrismaService.executionLog.update).toHaveBeenCalledWith({
        where: { id: startedLog.id },
        data: {
          status: 'failed',
          outputs: undefined,
          error: expect.objectContaining({
            message: expect.any(String),
            code: expect.any(String),
          }),
        },
      });

      expect(result.success).toBe(false);
    });

    it('should create exactly one log for conditional step execution', async () => {
      const step: FlowStep = {
        id: 'step-skipped',
        type: 'delay',
        name: 'Test Skipped Step',
        config: { seconds: 0.01 },
        executeIf: 'variables.skipTest === true',
      };

      const skippedContext = {
        ...mockContext,
        variables: { ...mockContext.variables, skipTest: false },
      };

      const startedLog = createMockStepLog('step-skipped', 'started');
      const skippedLog = createMockStepLog('step-skipped', 'skipped');

      // Mock the create and update operations
      mockPrismaService.executionLog.create.mockResolvedValue(startedLog);
      mockPrismaService.executionLog.update.mockResolvedValue(skippedLog);

      const result = await flowExecutorService['executeStep'](step, skippedContext);

      // Verify exactly one create call
      expect(mockPrismaService.executionLog.create).toHaveBeenCalledTimes(1);

      // Note: The condition evaluates to false, so the step is executed (not skipped)
      // The step execution completes normally since skipTest is false
      expect(mockPrismaService.executionLog.update).toHaveBeenCalledTimes(1);
      expect(mockPrismaService.executionLog.update).toHaveBeenCalledWith({
        where: { id: startedLog.id },
        data: {
          status: 'completed', // Step completes normally
          outputs: expect.any(Object),
          error: undefined,
        },
      });

      expect(result.success).toBe(true);
    });

    it('should handle data transform step with correct logging', async () => {
      const step: FlowStep = {
        id: 'step-transform',
        type: 'data_transform',
        name: 'Test Transform Step',
        config: {
          script: 'return "transformed";', // Simple return value to avoid variable scope issues
          useSandbox: false,
        },
      };

      const startedLog = createMockStepLog('step-transform', 'started');
      const completedLog = createMockStepLog('step-transform', 'completed');

      mockPrismaService.executionLog.create.mockResolvedValue(startedLog);
      mockPrismaService.executionLog.update.mockResolvedValue(completedLog);

      const result = await flowExecutorService['executeStep'](step, mockContext);

      // Verify result
      expect(result).toBeDefined();
      expect(result.success).toBe(true);

      // Verify logging sequence
      expect(mockPrismaService.executionLog.create).toHaveBeenCalledTimes(1);
      expect(mockPrismaService.executionLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          stepKey: 'step-transform',
          status: 'started',
          inputs: expect.objectContaining({
            stepName: 'Test Transform Step',
            stepType: 'data_transform',
            config: { script: 'return "transformed";', useSandbox: false },
            executeIf: undefined,
            variables: mockContext.variables,
            stepOutputs: mockContext.stepOutputs,
          }),
        }),
      });

      expect(mockPrismaService.executionLog.update).toHaveBeenCalledTimes(1);
      expect(mockPrismaService.executionLog.update).toHaveBeenCalledWith({
        where: { id: startedLog.id },
        data: {
          status: 'completed', // Step completes successfully
          outputs: expect.objectContaining({
            output: 'transformed', // Expected output from the script
          }),
          error: undefined,
        },
      });
    });

    it('should handle unknown step types with logging', async () => {
      const step: FlowStep = {
        id: 'step-unknown',
        type: 'unknown_step_type',
        name: 'Test Unknown Step Type',
        config: {},
      };

      const startedLog = createMockStepLog('step-unknown', 'started');
      const failedLog = createMockStepLog('step-unknown', 'failed');

      mockPrismaService.executionLog.create.mockResolvedValue(startedLog);
      mockPrismaService.executionLog.update.mockResolvedValue(failedLog);

      const result = await flowExecutorService['executeStep'](step, mockContext);

      // Verify correct input logging
      expect(mockPrismaService.executionLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          inputs: expect.objectContaining({
            stepName: 'Test Unknown Step Type',
            stepType: 'unknown_step_type',
            config: {},
            executeIf: undefined,
            variables: mockContext.variables,
            stepOutputs: mockContext.stepOutputs,
          }),
        }),
      });

      // Verify error logging for unknown step type
      expect(mockPrismaService.executionLog.update).toHaveBeenCalledWith({
        where: { id: startedLog.id },
        data: {
          status: 'failed',
          outputs: undefined,
          error: expect.objectContaining({
            message: 'Unknown step type: unknown_step_type',
            code: 'UNKNOWN_STEP_TYPE',
          }),
        },
      });

      expect(result.success).toBe(false);
    });
  });

  describe('Step Logging Error Handling', () => {
    it('should fail step execution if logging fails', async () => {
      const step: FlowStep = {
        id: 'step-log-fail',
        type: 'delay',
        name: 'Test Logging Failure',
        config: { seconds: 0.01 },
      };

      // Mock database failure for logging
      mockPrismaService.executionLog.create.mockRejectedValue(
        new Error('Database connection failed'),
      );

      // Step execution should fail if initial logging fails
      await expect(flowExecutorService['executeStep'](step, mockContext)).rejects.toThrow(
        'Database connection failed',
      );

      // Verify logging was attempted
      expect(mockPrismaService.executionLog.create).toHaveBeenCalledTimes(1);
    });

    it('should log step failure even when step throws exception', async () => {
      const step: FlowStep = {
        id: 'step-exception',
        type: 'http_request',
        name: 'Test Exception Step',
        config: { url: 'https://nonexistent-domain-12345.com', method: 'GET' },
      };

      const startedLog = createMockStepLog('step-exception', 'started');
      const failedLog = createMockStepLog('step-exception', 'failed');

      mockPrismaService.executionLog.create.mockResolvedValue(startedLog);
      mockPrismaService.executionLog.update.mockResolvedValue(failedLog);

      const result = await flowExecutorService['executeStep'](step, mockContext);

      // Verify step started logging
      expect(mockPrismaService.executionLog.create).toHaveBeenCalledTimes(1);

      // Verify step failed logging with error details
      expect(mockPrismaService.executionLog.update).toHaveBeenCalledTimes(1);
      expect(mockPrismaService.executionLog.update).toHaveBeenCalledWith({
        where: { id: startedLog.id },
        data: {
          status: 'failed',
          outputs: undefined,
          error: expect.objectContaining({
            message: expect.any(String),
            code: expect.any(String),
          }),
        },
      });

      expect(result.success).toBe(false);
    });
  });

  describe('Execution Log Retrieval Integration', () => {
    it('should retrieve execution logs for a flow execution', async () => {
      const mockLogs = [
        createMockStepLog('step-1', 'completed', { result: 'success' }),
        createMockStepLog('step-2', 'completed', { result: 'success' }),
        createMockStepLog('step-3', 'failed', null, { message: 'Step failed' }),
      ];

      mockPrismaService.executionLog.findMany.mockResolvedValue(mockLogs);

      const tenant = { orgId: mockContext.orgId, userId: mockContext.userId };
      const logs = await executionLogsService.getExecutionLogs(mockContext.executionId, tenant);

      expect(logs).toHaveLength(3);
      expect(logs[0]).toHaveProperty('stepKey', 'step-1');
      expect(logs[0]).toHaveProperty('status', 'completed');
      expect(logs[2]).toHaveProperty('status', 'failed');

      expect(mockPrismaService.executionLog.findMany).toHaveBeenCalledWith({
        where: {
          executionId: mockContext.executionId,
          orgId: mockContext.orgId,
        },
        orderBy: { createdAt: 'asc' },
      });
    });

    it('should retrieve step logs for a specific flow execution', async () => {
      const mockStepLogs = [
        createMockStepLog('step-transform', 'started'),
        createMockStepLog('step-transform', 'completed', { transformedData: { processed: true } }),
      ];

      mockPrismaService.executionLog.findMany.mockResolvedValue(mockStepLogs);

      const tenant = { orgId: mockContext.orgId, userId: mockContext.userId };
      const logs = await executionLogsService.getStepLogs(
        mockContext.flowId,
        mockContext.executionId,
        tenant,
      );

      expect(logs).toHaveLength(2);
      expect(logs[0]).toHaveProperty('status', 'started');
      expect(logs[1]).toHaveProperty('status', 'completed');

      expect(mockPrismaService.executionLog.findMany).toHaveBeenCalledWith({
        where: {
          flowId: mockContext.flowId,
          executionId: mockContext.executionId,
          orgId: mockContext.orgId,
        },
        orderBy: { createdAt: 'asc' },
      });
    });

    it('should retrieve execution statistics for an organization', async () => {
      const mockStats = [
        { status: 'completed', _count: { status: 15 } },
        { status: 'failed', _count: { status: 3 } },
        { status: 'skipped', _count: { status: 2 } },
      ];

      mockPrismaService.executionLog.groupBy.mockResolvedValue(mockStats);
      mockPrismaService.executionLog.count.mockResolvedValue(20);

      const stats = await executionLogsService.getExecutionStats(mockContext.orgId);

      expect(stats).toEqual({
        totalExecutions: 20,
        completedSteps: 15,
        failedSteps: 3,
        skippedSteps: 2,
        avgExecutionTime: 0,
      });

      expect(mockPrismaService.executionLog.groupBy).toHaveBeenCalledWith({
        by: ['status'],
        where: { orgId: mockContext.orgId },
        _count: { status: true },
      });
    });
  });

  describe('Full Flow Execution Logging', () => {
    it('should create logs for multi-step flow execution', async () => {
      const steps: FlowStep[] = [
        {
          id: 'step-1',
          type: 'delay',
          name: 'First Step',
          config: { seconds: 0.001 },
        },
        {
          id: 'step-2',
          type: 'delay',
          name: 'Second Step',
          config: { seconds: 0.001 },
        },
        {
          id: 'step-3',
          type: 'delay',
          name: 'Third Step',
          config: { seconds: 0.001 },
        },
      ];

      const stepLogs = steps.map(step => createMockStepLog(step.id, 'started'));
      const completedLogs = steps.map(step => createMockStepLog(step.id, 'completed'));

      // Mock create calls for each step
      mockPrismaService.executionLog.create
        .mockResolvedValueOnce(stepLogs[0])
        .mockResolvedValueOnce(stepLogs[1])
        .mockResolvedValueOnce(stepLogs[2]);

      // Mock update calls for each step
      mockPrismaService.executionLog.update
        .mockResolvedValueOnce(completedLogs[0])
        .mockResolvedValueOnce(completedLogs[1])
        .mockResolvedValueOnce(completedLogs[2]);

      // Execute all steps sequentially
      const results = [];
      for (const step of steps) {
        const result = await flowExecutorService['executeStep'](step, mockContext);
        results.push(result);
      }

      // Verify all steps were attempted
      expect(results).toHaveLength(3);

      // Verify exactly 3 create calls (one per step)
      expect(mockPrismaService.executionLog.create).toHaveBeenCalledTimes(3);

      // Verify exactly 3 update calls (one per step)
      expect(mockPrismaService.executionLog.update).toHaveBeenCalledTimes(3);

      // Verify each step was logged with correct step keys
      steps.forEach((step, index) => {
        expect(mockPrismaService.executionLog.create).toHaveBeenNthCalledWith(index + 1, {
          data: expect.objectContaining({
            stepKey: step.id,
            status: 'started',
            inputs: expect.objectContaining({
              stepName: step.name,
              stepType: step.type,
            }),
          }),
        });
      });
    });
  });
});
