import { Test, TestingModule } from '@nestjs/testing';
import { register } from 'prom-client';
import { FlowExecutorService, FlowStep, FlowExecutionContext } from './flow-executor.service';
import { SandboxService } from '../sandbox/sandbox.service';
import { PrismaService } from '../prisma.service';
import { AblyService } from '../ably/ably.service';
import { SecretsResolver } from '../secrets/secrets-resolver.service';
import { OAuthTokenService } from '../oauth/oauth-token.service';
import { InputValidatorService } from '../common/services/input-validator.service';
import { ConditionEvaluatorService } from '../common/services/condition-evaluator.service';
import { ExecutionLogsService } from '../execution-logs/execution-logs.service';
import { MetricsService } from '../metrics/metrics.service';
import { InngestService } from 'nestjs-inngest';

describe('FlowExecutorService - Sandbox Integration', () => {
  let flowExecutorService: FlowExecutorService;
  let sandboxService: any;
  let ablyService: any;
  // let metricsService: MetricsService;

  const mockContext: FlowExecutionContext = {
    executionId: 'exec-123',
    flowId: 'flow-456',
    orgId: 'org-789',
    userId: 'user-001',
    startTime: new Date(),
    variables: { testVar: 'testValue' },
    stepOutputs: { previousStep: { result: 'previous output' } },
  };

  const mockSuccessfulSandboxResult = {
    success: true,
    output: { result: 'Code executed successfully', logs: ['Execution log'] },
    executionTime: 1250,
  };

  const mockFailedSandboxResult = {
    success: false,
    output: null,
    error: { message: 'Syntax error', code: 'SYNTAX_ERROR' },
    executionTime: 500,
  };

  beforeEach(async () => {
    // Clear all metrics before each test
    register.clear();

    const mockSandboxService = {
      runSync: jest.fn(),
      runAsync: jest.fn(),
      getAsyncResult: jest.fn(),
      cancelAsyncExecution: jest.fn(),
      isConfigured: jest.fn().mockReturnValue(true),
    };

    const mockPrismaService = {
      flow: { findUnique: jest.fn() },
      executionLog: { create: jest.fn(), update: jest.fn() },
    };

    const mockAblyService = {
      createStepEvent: jest.fn(),
      publishStepEvent: jest.fn(),
      createExecutionEvent: jest.fn(),
      publishExecutionEvent: jest.fn(),
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

    const mockExecutionLogsService = {
      markStepStarted: jest.fn().mockResolvedValue({ id: 'log-123' }),
      markStepCompleted: jest.fn().mockResolvedValue({ id: 'log-123' }),
      markStepFailed: jest.fn().mockResolvedValue({ id: 'log-123' }),
      markStepSkipped: jest.fn().mockResolvedValue({ id: 'log-123' }),
    };

    const mockInngestService = {
      send: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FlowExecutorService,
        MetricsService,
        { provide: SandboxService, useValue: mockSandboxService },
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AblyService, useValue: mockAblyService },
        { provide: SecretsResolver, useValue: mockSecretsResolver },
        { provide: OAuthTokenService, useValue: mockOAuthTokenService },
        { provide: InputValidatorService, useValue: mockInputValidatorService },
        { provide: ConditionEvaluatorService, useValue: mockConditionEvaluatorService },
        { provide: ExecutionLogsService, useValue: mockExecutionLogsService },
        { provide: InngestService, useValue: mockInngestService },
        { provide: `PinoLogger:${FlowExecutorService.name}`, useValue: mockLogger },
      ],
    }).compile();

    flowExecutorService = module.get(FlowExecutorService);
    sandboxService = module.get(SandboxService);
    ablyService = module.get(AblyService);
    // metricsService = module.get(MetricsService);

    // Default mock implementations
    ablyService.createStepEvent.mockResolvedValue({} as any);
    ablyService.publishStepEvent.mockResolvedValue();
  });

  afterEach(() => {
    jest.clearAllMocks();
    register.clear();
  });

  describe('Sandbox Sync Execution', () => {
    it('should execute sandbox_sync step successfully', async () => {
      const step: FlowStep = {
        id: 'step-sandbox-sync',
        type: 'sandbox_sync',
        name: 'Test Sync Execution',
        config: {
          code: 'console.log("Hello from sandbox"); return { result: "success" };',
          language: 'javascript',
        },
      };

      sandboxService.runSync.mockResolvedValue(mockSuccessfulSandboxResult);

      const result = await flowExecutorService['executeStep'](step, mockContext);

      expect(sandboxService.runSync).toHaveBeenCalledWith(
        'console.log("Hello from sandbox"); return { result: "success" };',
        expect.objectContaining({
          orgId: 'org-789',
          userId: 'user-001',
          flowId: 'flow-456',
          stepId: 'step-sandbox-sync',
          executionId: 'exec-123',
          variables: mockContext.variables,
          stepOutputs: mockContext.stepOutputs,
        }),
      );

      expect(result).toMatchObject({
        success: true,
        output: mockSuccessfulSandboxResult.output,
        metadata: expect.objectContaining({
          executionTime: 1250,
          sandboxMode: 'sync',
          language: 'javascript',
        }),
      });

      // Verify metrics were recorded
      const metricsString = await register.metrics();
      expect(metricsString).toContain('step_execution_seconds');
      expect(metricsString).toContain('orgId="org-789"');
      expect(metricsString).toContain('flowId="flow-456"');
      expect(metricsString).toContain('stepKey="step-sandbox-sync"');
    });

    it('should handle sandbox_sync execution failures', async () => {
      const step: FlowStep = {
        id: 'step-sandbox-sync-fail',
        type: 'sandbox_sync',
        name: 'Test Sync Failure',
        config: {
          code: 'invalid javascript syntax %%%',
        },
      };

      sandboxService.runSync.mockResolvedValue(mockFailedSandboxResult);

      const result = await flowExecutorService['executeStep'](step, mockContext);

      expect(result).toMatchObject({
        success: false,
        error: {
          message: 'Syntax error',
          code: 'SYNTAX_ERROR',
        },
        metadata: expect.objectContaining({
          sandboxMode: 'sync',
          executionTime: 500,
        }),
      });

      // Verify error metrics were recorded
      const metricsString = await register.metrics();
      expect(metricsString).toContain('step_errors_total');
      expect(metricsString).toContain('orgId="org-789"');
      expect(metricsString).toContain('flowId="flow-456"');
      expect(metricsString).toContain('stepKey="step-sandbox-sync-fail"');
      expect(metricsString).toContain('1'); // Should show 1 error
    });

    it('should handle missing code in sandbox_sync step', async () => {
      const step: FlowStep = {
        id: 'step-no-code',
        type: 'sandbox_sync',
        name: 'Test No Code',
        config: {},
      };

      const result = await flowExecutorService['executeStep'](step, mockContext);

      expect(result).toMatchObject({
        success: false,
        error: {
          message: 'Code is required for sandbox_sync step',
          code: 'MISSING_CODE',
        },
      });

      expect(sandboxService.runSync).not.toHaveBeenCalled();

      // Verify error metrics were recorded even for configuration errors
      const metricsString = await register.metrics();
      expect(metricsString).toContain('step_errors_total');
      expect(metricsString).toContain('stepKey="step-no-code"');
    });
  });

  describe('Sandbox Async Execution', () => {
    it('should execute sandbox_async step with immediate return', async () => {
      const step: FlowStep = {
        id: 'step-sandbox-async',
        type: 'sandbox_async',
        name: 'Test Async Execution',
        config: {
          code: 'console.log("Async execution"); return { result: "async success" };',
          waitForCompletion: false,
        },
      };

      sandboxService.runAsync.mockResolvedValue('session-123');

      const result = await flowExecutorService['executeStep'](step, mockContext);

      expect(sandboxService.runAsync).toHaveBeenCalledWith(
        'console.log("Async execution"); return { result: "async success" };',
        expect.objectContaining({
          stepId: 'step-sandbox-async',
        }),
      );

      expect(result).toMatchObject({
        success: true,
        output: {
          sessionId: 'session-123',
          message: 'Async execution started - use getAsyncResult to retrieve results',
        },
        metadata: expect.objectContaining({
          sandboxMode: 'async',
          sessionId: 'session-123',
        }),
      });
    });

    it('should execute sandbox_async step with completion waiting', async () => {
      const step: FlowStep = {
        id: 'step-sandbox-async-wait',
        type: 'sandbox_async',
        name: 'Test Async With Wait',
        config: {
          code: 'return { result: "completed" };',
          waitForCompletion: true,
          pollInterval: 100,
          maxPollAttempts: 5,
        },
      };

      sandboxService.runAsync.mockResolvedValue('session-456');

      // Mock the polling sequence: running -> completed
      sandboxService.getAsyncResult
        .mockResolvedValueOnce({
          sessionId: 'session-456',
          status: 'running',
        })
        .mockResolvedValueOnce({
          sessionId: 'session-456',
          status: 'completed',
          result: {
            success: true,
            output: { result: 'completed async execution' },
            executionTime: 2000,
            sessionId: 'session-456',
          },
        });

      const result = await flowExecutorService['executeStep'](step, mockContext);

      expect(sandboxService.getAsyncResult).toHaveBeenCalledTimes(2);
      expect(result).toMatchObject({
        success: true,
        output: { result: 'completed async execution' },
        metadata: expect.objectContaining({
          sandboxMode: 'async',
          sessionId: 'session-456',
          pollAttempts: 2,
          executionTime: 2000,
        }),
      });
    });

    it('should timeout on async execution polling', async () => {
      const step: FlowStep = {
        id: 'step-async-timeout',
        type: 'sandbox_async',
        name: 'Test Async Timeout',
        config: {
          code: 'while(true) { /* infinite loop */ }',
          waitForCompletion: true,
          pollInterval: 50,
          maxPollAttempts: 3,
        },
      };

      sandboxService.runAsync.mockResolvedValue('session-timeout');

      // Always return 'running' to trigger timeout
      sandboxService.getAsyncResult.mockResolvedValue({
        sessionId: 'session-timeout',
        status: 'running',
      });

      const result = await flowExecutorService['executeStep'](step, mockContext);

      expect(sandboxService.getAsyncResult).toHaveBeenCalledTimes(3);
      expect(result).toMatchObject({
        success: false,
        output: { sessionId: 'session-timeout' },
        error: {
          message: 'Async execution timed out after 3 attempts',
          code: 'SANDBOX_ASYNC_TIMEOUT',
        },
        metadata: expect.objectContaining({
          sandboxMode: 'async',
          sessionId: 'session-timeout',
          pollAttempts: 3,
        }),
      });
    });

    it('should handle async execution failures', async () => {
      const step: FlowStep = {
        id: 'step-async-fail',
        type: 'sandbox_async',
        name: 'Test Async Failure',
        config: {
          code: 'throw new Error("Runtime error");',
          waitForCompletion: true,
          pollInterval: 100,
          maxPollAttempts: 5,
        },
      };

      sandboxService.runAsync.mockResolvedValue('session-fail');
      sandboxService.getAsyncResult.mockResolvedValue({
        sessionId: 'session-fail',
        status: 'failed',
        result: {
          success: false,
          error: { message: 'Runtime error', code: 'RUNTIME_ERROR' },
          executionTime: 800,
          sessionId: 'session-fail',
        },
      });

      const result = await flowExecutorService['executeStep'](step, mockContext);

      expect(result).toMatchObject({
        success: false,
        error: {
          message: 'Runtime error',
          code: 'RUNTIME_ERROR',
        },
        metadata: expect.objectContaining({
          sandboxMode: 'async',
          executionTime: 800,
        }),
      });
    });
  });

  describe('Generic Code Execution', () => {
    it('should use sync mode by default for code_execution step', async () => {
      const step: FlowStep = {
        id: 'step-code-default',
        type: 'code_execution',
        name: 'Test Code Execution Default',
        config: {
          code: 'return "default mode";',
        },
      };

      sandboxService.runSync.mockResolvedValue(mockSuccessfulSandboxResult);

      const result = await flowExecutorService['executeStep'](step, mockContext);

      expect(sandboxService.runSync).toHaveBeenCalled();
      expect(sandboxService.runAsync).not.toHaveBeenCalled();
      expect(result.success).toBe(true);
    });

    it('should use async mode when specified in code_execution step', async () => {
      const step: FlowStep = {
        id: 'step-code-async',
        type: 'code_execution',
        name: 'Test Code Execution Async',
        config: {
          code: 'return "async mode";',
          mode: 'async',
          waitForCompletion: false,
        },
      };

      sandboxService.runAsync.mockResolvedValue('session-code');

      const result = await flowExecutorService['executeStep'](step, mockContext);

      expect(sandboxService.runAsync).toHaveBeenCalled();
      expect(sandboxService.runSync).not.toHaveBeenCalled();
      expect(result).toMatchObject({
        success: true,
        output: expect.objectContaining({
          sessionId: 'session-code',
        }),
      });
    });
  });

  describe('Enhanced Data Transform with Sandbox', () => {
    it('should use sandbox for data_transform when configured', async () => {
      const step: FlowStep = {
        id: 'step-transform-sandbox',
        type: 'data_transform',
        name: 'Test Sandbox Transform',
        config: {
          script: 'return input.previousStep.result.toUpperCase();',
          useSandbox: true,
        },
      };

      const transformResult = {
        success: true,
        output: 'PREVIOUS OUTPUT',
        executionTime: 750,
      };

      sandboxService.isConfigured.mockReturnValue(true);
      sandboxService.runSync.mockResolvedValue(transformResult);

      const result = await flowExecutorService['executeStep'](step, mockContext);

      expect(sandboxService.runSync).toHaveBeenCalledWith(
        expect.stringContaining('return input.previousStep.result.toUpperCase();'),
        expect.objectContaining({
          stepId: 'step-transform-sandbox',
        }),
      );

      expect(result).toMatchObject({
        success: true,
        output: 'PREVIOUS OUTPUT',
        metadata: expect.objectContaining({
          sandboxMode: 'sync',
          stepType: 'data_transform',
          executionTime: 750,
        }),
      });
    });

    it('should fallback to direct execution when sandbox disabled for data_transform', async () => {
      const step: FlowStep = {
        id: 'step-transform-direct',
        type: 'data_transform',
        name: 'Test Direct Transform',
        config: {
          script: 'return "direct execution";',
          useSandbox: false,
        },
      };

      const result = await flowExecutorService['executeStep'](step, mockContext);

      expect(sandboxService.runSync).not.toHaveBeenCalled();
      expect(result).toMatchObject({
        success: true,
        output: 'direct execution',
        metadata: expect.objectContaining({
          executionMode: 'direct',
        }),
      });
    });
  });

  describe('Enhanced Conditional with Sandbox', () => {
    it('should use sandbox for conditional when configured', async () => {
      const step: FlowStep = {
        id: 'step-conditional-sandbox',
        type: 'conditional',
        name: 'Test Sandbox Conditional',
        config: {
          condition: 'context.variables.testVar === "testValue"',
          useSandbox: true,
        },
      };

      const conditionResult = {
        success: true,
        output: true,
        executionTime: 200,
      };

      sandboxService.isConfigured.mockReturnValue(true);
      sandboxService.runSync.mockResolvedValue(conditionResult);

      const result = await flowExecutorService['executeStep'](step, mockContext);

      expect(sandboxService.runSync).toHaveBeenCalledWith(
        expect.stringContaining('context.variables.testVar === "testValue"'),
        expect.objectContaining({
          stepId: 'step-conditional-sandbox',
        }),
      );

      expect(result).toMatchObject({
        success: true,
        output: { conditionResult: true },
        metadata: expect.objectContaining({
          sandboxMode: 'sync',
          stepType: 'conditional',
          executionTime: 200,
        }),
      });
    });

    it('should fallback to direct execution when sandbox disabled for conditional', async () => {
      const step: FlowStep = {
        id: 'step-conditional-direct',
        type: 'conditional',
        name: 'Test Direct Conditional',
        config: {
          condition: 'true',
          useSandbox: false,
        },
      };

      const result = await flowExecutorService['executeStep'](step, mockContext);

      expect(sandboxService.runSync).not.toHaveBeenCalled();
      expect(result).toMatchObject({
        success: true,
        output: { conditionResult: true },
        metadata: expect.objectContaining({
          executionMode: 'direct',
        }),
      });
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle sandbox service exceptions gracefully', async () => {
      const step: FlowStep = {
        id: 'step-exception',
        type: 'sandbox_sync',
        name: 'Test Exception Handling',
        config: {
          code: 'console.log("test");',
        },
      };

      const error = new Error('Sandbox service unavailable');
      sandboxService.runSync.mockRejectedValue(error);

      const result = await flowExecutorService['executeStep'](step, mockContext);

      expect(result).toMatchObject({
        success: false,
        error: {
          message: 'Sandbox sync execution failed: Sandbox service unavailable',
          code: 'SANDBOX_SYNC_ERROR',
        },
      });
    });

    it('should handle unknown step types', async () => {
      const step: FlowStep = {
        id: 'step-unknown',
        type: 'unknown_sandbox_type',
        name: 'Test Unknown Type',
        config: {},
      };

      const result = await flowExecutorService['executeStep'](step, mockContext);

      expect(result).toMatchObject({
        success: false,
        error: {
          message: 'Unknown step type: unknown_sandbox_type',
          code: 'UNKNOWN_STEP_TYPE',
        },
      });
    });
  });
});
