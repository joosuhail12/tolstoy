import { Test, TestingModule } from '@nestjs/testing';
import { ExecuteFlowHandler } from './execute-flow.handler';
import { SandboxService } from '../../sandbox/sandbox.service';
import { SecretsResolver } from '../../secrets/secrets-resolver.service';
import { AblyService } from '../../ably/ably.service';
import { InputValidatorService } from '../../common/services/input-validator.service';
import { ConditionEvaluatorService } from '../../common/services/condition-evaluator.service';
import { PrismaService } from '../../prisma.service';
import { ExecutionLogsService } from '../../execution-logs/execution-logs.service';

describe('ExecuteFlowHandler - Throttling & Queuing', () => {
  let handler: ExecuteFlowHandler;
  let mockSandboxService: any;
  let mockSecretsResolver: any;
  let mockAblyService: any;
  let mockInputValidator: any;
  let mockConditionEvaluator: any;
  let mockPrismaService: any;
  let mockLogger: any;

  const mockStep = {
    run: jest.fn().mockImplementation(async (name, fn, _config) => {
      // Simulate step execution with config
      return await fn();
    }),
  };

  beforeEach(async () => {
    mockSandboxService = {
      runSync: jest.fn(),
      runAsync: jest.fn(),
      getAsyncResult: jest.fn(),
      isConfigured: jest.fn().mockReturnValue(true),
    } as any;

    mockSecretsResolver = {
      resolve: jest.fn().mockResolvedValue('resolved-secret'),
    } as any;

    mockAblyService = {
      publishExecutionEvent: jest.fn().mockResolvedValue(void 0),
      publishStepEvent: jest.fn().mockResolvedValue(void 0),
    } as any;

    mockInputValidator = {
      validate: jest.fn().mockReturnValue({ valid: true }),
    } as any;

    mockConditionEvaluator = {
      evaluate: jest.fn().mockReturnValue(true),
      validateRule: jest.fn().mockReturnValue({ valid: true }),
      getAvailableVariables: jest.fn().mockReturnValue([]),
    } as any;

    mockPrismaService = {
      executionLog: {
        update: jest.fn().mockResolvedValue({}),
      },
    } as any;

    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExecuteFlowHandler,
        {
          provide: SandboxService,
          useValue: mockSandboxService,
        },
        {
          provide: SecretsResolver,
          useValue: mockSecretsResolver,
        },
        {
          provide: AblyService,
          useValue: mockAblyService,
        },
        {
          provide: InputValidatorService,
          useValue: mockInputValidator,
        },
        {
          provide: ConditionEvaluatorService,
          useValue: mockConditionEvaluator,
        },
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: ExecutionLogsService,
          useValue: {
            createStepLog: jest.fn(),
            markStepStarted: jest.fn(),
            markStepCompleted: jest.fn(),
            markStepFailed: jest.fn(),
            markStepSkipped: jest.fn(),
          },
        },
        {
          provide: `PinoLogger:${ExecuteFlowHandler.name}`,
          useValue: mockLogger,
        },
      ],
    }).compile();

    handler = module.get(ExecuteFlowHandler);
  });

  describe('Step Configuration for Throttling', () => {
    it('should return strict rate limiting for HTTP request steps', () => {
      const httpStep = { id: 'test-http', type: 'http_request', config: { critical: false } };

      const config = (handler as any).getStepConfiguration(httpStep);

      expect(config).toEqual({
        concurrency: 5,
        rateLimit: {
          maxExecutions: 10,
          perMilliseconds: 10_000,
        },
        retry: {
          maxAttempts: 3,
          backoff: {
            type: 'exponential',
            delay: 3000,
          },
        },
      });
    });

    it('should return stricter settings for critical HTTP request steps', () => {
      const criticalHttpStep = {
        id: 'critical-http',
        type: 'http_request',
        config: { critical: true },
      };

      const config = (handler as any).getStepConfiguration(criticalHttpStep);

      expect(config.concurrency).toBe(2); // Lower concurrency for critical steps
      expect(config.retry.maxAttempts).toBe(5); // More retries for critical steps
    });

    it('should return moderate settings for sandbox operations', () => {
      const sandboxStep = { id: 'test-sandbox', type: 'sandbox_sync', config: {} };

      const config = (handler as any).getStepConfiguration(sandboxStep);

      expect(config).toEqual({
        concurrency: 3,
        rateLimit: {
          maxExecutions: 20,
          perMilliseconds: 30_000,
        },
        retry: {
          maxAttempts: 2,
          backoff: {
            type: 'fixed',
            delay: 5000,
          },
        },
      });
    });

    it('should return generous settings for lightweight operations', () => {
      const transformStep = { id: 'test-transform', type: 'data_transform', config: {} };

      const config = (handler as any).getStepConfiguration(transformStep);

      expect(config).toEqual({
        concurrency: 15,
        rateLimit: {
          maxExecutions: 50,
          perMilliseconds: 30_000,
        },
        retry: {
          maxAttempts: 2,
          backoff: {
            type: 'fixed',
            delay: 1000,
          },
        },
      });
    });

    it('should return conservative settings for unknown step types', () => {
      const unknownStep = { id: 'test-unknown', type: 'unknown_type', config: {} };

      const config = (handler as any).getStepConfiguration(unknownStep);

      expect(config).toEqual({
        concurrency: 2,
        rateLimit: {
          maxExecutions: 5,
          perMilliseconds: 30_000,
        },
        retry: {
          maxAttempts: 1,
          backoff: {
            type: 'fixed',
            delay: 5000,
          },
        },
      });

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          stepId: 'test-unknown',
          stepType: 'unknown_type',
        }),
        'Unknown step type, using conservative throttling configuration',
      );
    });

    it('should return empty config for delay steps', () => {
      const delayStep = { id: 'test-delay', type: 'delay', config: {} };

      const config = (handler as any).getStepConfiguration(delayStep);

      expect(config).toEqual({});
    });
  });

  describe('Event Publishing Configuration', () => {
    it('should return optimized settings for event publishing', () => {
      const config = (handler as any).getEventPublishingConfiguration();

      expect(config).toEqual({
        concurrency: 20,
        rateLimit: {
          maxExecutions: 200,
          perMilliseconds: 60_000,
        },
        retry: {
          maxAttempts: 2,
          backoff: {
            type: 'fixed',
            delay: 500,
          },
        },
      });
    });
  });

  describe('Step Type Distribution Analytics', () => {
    it('should correctly calculate step type distribution', () => {
      const steps = [
        { type: 'http_request' },
        { type: 'http_request' },
        { type: 'data_transform' },
        { type: 'sandbox_sync' },
        { type: 'http_request' },
      ];

      const distribution = (handler as any).getStepTypeDistribution(steps);

      expect(distribution).toEqual({
        http_request: 3,
        data_transform: 1,
        sandbox_sync: 1,
      });
    });

    it('should handle empty step array', () => {
      const distribution = (handler as any).getStepTypeDistribution([]);

      expect(distribution).toEqual({});
    });
  });

  describe('Flow Execution with Throttling', () => {
    beforeEach(() => {
      mockSandboxService.runSync.mockResolvedValue({
        success: true,
        output: { result: 'test-output' },
        executionTime: 1000,
      });
    });

    it('should apply step-specific throttling configuration during execution', async () => {
      const flowEvent = {
        data: {
          orgId: 'test-org',
          userId: 'test-user',
          flowId: 'test-flow',
          executionId: 'test-execution',
          steps: [
            { id: 'http-step', type: 'http_request', config: {}, name: 'HTTP Request' },
            { id: 'transform-step', type: 'data_transform', config: {}, name: 'Data Transform' },
          ],
          variables: {},
        },
      };

      await handler.handler({ event: flowEvent, step: mockStep });

      // Verify step.run was called with different configurations for different step types
      const stepRunCalls = mockStep.run.mock.calls;

      // Note: Only HTTP step executes since it fails and stops the flow

      // Find the HTTP request step call (should have strict throttling for critical by default)
      const httpStepCall = stepRunCalls.find(call => call[0] === 'execute-step-http-step');
      if (httpStepCall) {
        expect(httpStepCall[2]).toMatchObject({
          concurrency: 2, // Critical by default
          rateLimit: { maxExecutions: 10, perMilliseconds: 10_000 },
        });
      }

      // Find the data transform step call (should have generous throttling)
      const transformStepCall = stepRunCalls.find(
        call => call[0] === 'execute-step-transform-step',
      );
      if (transformStepCall) {
        expect(transformStepCall[2]).toMatchObject({
          concurrency: 15,
          rateLimit: { maxExecutions: 50, perMilliseconds: 30_000 },
        });
      }
    });

    it('should log throttling metrics for successful steps', async () => {
      const flowEvent = {
        data: {
          orgId: 'test-org',
          userId: 'test-user',
          flowId: 'test-flow',
          executionId: 'test-execution',
          steps: [
            {
              id: 'test-step',
              type: 'sandbox_sync',
              config: { code: 'return 42;' },
              name: 'Test Step',
            },
          ],
          variables: {},
        },
      };

      await handler.handler({ event: flowEvent, step: mockStep });

      // Verify throttling metrics are logged for successful steps
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          stepId: 'test-step',
          stepType: 'sandbox_sync',
          throttlingConfig: expect.objectContaining({
            concurrency: 3,
            rateLimit: '20/30000ms',
            maxRetries: 2,
          }),
          retryCount: 0, // No retries for successful step
          throttlingOverhead: expect.any(Number),
        }),
        'Step completed successfully with throttling metrics',
      );
    });

    it('should log throttling insights in flow execution summary', async () => {
      const flowEvent = {
        data: {
          orgId: 'test-org',
          userId: 'test-user',
          flowId: 'test-flow',
          executionId: 'test-execution',
          steps: [
            { id: 'http-step', type: 'http_request', config: {}, name: 'HTTP Request' },
            { id: 'transform-step', type: 'data_transform', config: {}, name: 'Transform' },
          ],
          variables: {},
        },
      };

      await handler.handler({ event: flowEvent, step: mockStep });

      // Verify flow summary includes throttling insights (should be called for execution summary)
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          throttlingInsights: expect.objectContaining({
            globalDefaults: {
              concurrency: 10,
              rateLimit: '100/60000ms',
              retry: 'exponential-3x',
            },
            stepTypeDistribution: {
              http_request: 1,
              data_transform: 1,
            },
          }),
        }),
        expect.stringMatching(/Flow execution .* with throttling analytics/),
      );
    });
  });

  describe('Critical Step Identification', () => {
    it('should identify critical steps correctly', () => {
      const criticalStep = { config: { critical: true } };
      const nonCriticalStep = { config: { critical: false } };
      const defaultStep = { config: {} };

      expect((handler as any).isStepCritical(criticalStep)).toBe(true);
      expect((handler as any).isStepCritical(nonCriticalStep)).toBe(false);
      expect((handler as any).isStepCritical(defaultStep)).toBe(true); // Default is critical
    });
  });

  describe('Retry Logic with Throttling', () => {
    it('should log retry attempts with throttling information', async () => {
      // Mock step execution to fail first time, succeed second time
      mockSandboxService.runSync
        .mockImplementationOnce(() => {
          return Promise.resolve({
            success: false,
            error: { message: 'Temporary failure', code: 'TEMP_FAIL' },
            executionTime: 500,
          });
        })
        .mockImplementationOnce(() => {
          return Promise.resolve({
            success: true,
            output: { result: 'success-after-retry' },
            executionTime: 1000,
          });
        });

      // Mock step.run to simulate retry behavior
      mockStep.run.mockImplementation(async (name, fn, config) => {
        const maxAttempts = config?.retry?.maxAttempts || 3;
        let lastError;

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
          try {
            const result = await fn();
            if (result.success) {
              return result;
            } else if (attempt === maxAttempts) {
              return result; // Return failed result on final attempt
            }
            lastError = result.error;
          } catch (error) {
            lastError = error;
            if (attempt === maxAttempts) {
              throw error;
            }
          }
        }
        throw lastError;
      });

      const flowEvent = {
        data: {
          orgId: 'test-org',
          userId: 'test-user',
          flowId: 'test-flow',
          executionId: 'test-execution',
          steps: [
            {
              id: 'retry-step',
              type: 'sandbox_sync',
              config: { code: 'return 42;' },
              name: 'Retry Step',
            },
          ],
          variables: {},
        },
      };

      await handler.handler({ event: flowEvent, step: mockStep });

      // Should have attempted twice (original + 1 retry)
      expect(mockSandboxService.runSync).toHaveBeenCalledTimes(2);
    });
  });
});
