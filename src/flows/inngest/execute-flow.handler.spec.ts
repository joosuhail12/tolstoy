import { Test, TestingModule } from '@nestjs/testing';
import { ExecuteFlowHandler } from './execute-flow.handler';
import { SandboxService } from '../../sandbox/sandbox.service';
import { SecretsResolver } from '../../secrets/secrets-resolver.service';
import { AblyService } from '../../ably/ably.service';
import { InputValidatorService } from '../../common/services/input-validator.service';
import { ConditionEvaluatorService } from '../../common/services/condition-evaluator.service';
import { PrismaService } from '../../prisma.service';
import { PinoLogger } from 'nestjs-pino';

describe('ExecuteFlowHandler', () => {
  let handler: ExecuteFlowHandler;

  const mockEvent = {
    data: {
      orgId: 'test-org-123',
      userId: 'test-user-456',
      flowId: 'test-flow-789',
      executionId: 'exec_123456_abc123',
      steps: [
        {
          id: 'step-1',
          type: 'sandbox_sync',
          name: 'Test Step',
          config: { code: 'return "test";' },
        },
      ],
      variables: { testVar: 'testValue' },
    },
  };

  beforeEach(async () => {
    const mockSandboxService = {
      runSync: jest.fn().mockResolvedValue({
        success: true,
        output: 'test output',
        executionTime: 150,
      }),
      runAsync: jest.fn().mockResolvedValue('session-123'),
      getAsyncResult: jest.fn().mockResolvedValue({
        status: 'completed',
        result: { success: true, output: 'async result', executionTime: 200 },
        sessionId: 'session-123',
      }),
      isConfigured: jest.fn().mockReturnValue(true),
    };

    const mockSecretsResolver = {
      resolve: jest.fn().mockResolvedValue({}),
    };

    const mockInputValidator = {
      validate: jest.fn().mockReturnValue({ isValid: true }),
    };

    const mockConditionEvaluator = {
      evaluate: jest.fn().mockReturnValue(true),
      validateRule: jest.fn().mockReturnValue({ valid: true }),
      getAvailableVariables: jest.fn().mockReturnValue([]),
    };

    const mockAblyService = {
      publishStepEvent: jest.fn().mockResolvedValue(undefined),
      publishExecutionEvent: jest.fn().mockResolvedValue(undefined),
    };

    const mockPrismaService = {
      executionLog: {
        update: jest.fn().mockResolvedValue({}),
        create: jest.fn().mockResolvedValue({}),
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
        ExecuteFlowHandler,
        { provide: SandboxService, useValue: mockSandboxService },
        { provide: SecretsResolver, useValue: mockSecretsResolver },
        { provide: AblyService, useValue: mockAblyService },
        { provide: InputValidatorService, useValue: mockInputValidator },
        { provide: ConditionEvaluatorService, useValue: mockConditionEvaluator },
        { provide: PrismaService, useValue: mockPrismaService },
        {
          provide: `PinoLogger:${ExecuteFlowHandler.name}`,
          useValue: mockLogger,
        },
      ],
    }).compile();

    handler = module.get(ExecuteFlowHandler);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('handler', () => {
    it('should be defined', () => {
      expect(handler).toBeDefined();
    });

    it('should have correct structure', () => {
      expect(typeof handler.handler).toBe('function');
      expect(handler).toBeInstanceOf(ExecuteFlowHandler);
    });
  });

  describe('step execution methods', () => {
    it('should handle sandbox sync execution', async () => {
      const stepConfig = {
        id: 'step-1',
        type: 'sandbox_sync',
        config: { code: 'return "hello";' },
      };

      const context = {
        orgId: 'test-org',
        userId: 'test-user',
        flowId: 'test-flow',
        executionId: 'test-exec',
        variables: {},
        stepOutputs: {},
      };

      // Test private method indirectly through public interface
      const result = await handler['executeStep'](stepConfig, context);
      
      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
    });

    it('should handle unknown step types', async () => {
      const stepConfig = {
        id: 'step-1',
        type: 'unknown_type',
        config: {},
      };

      const context = {
        orgId: 'test-org',
        userId: 'test-user',
        flowId: 'test-flow',
        executionId: 'test-exec',
        variables: {},
        stepOutputs: {},
      };

      const result = await handler['executeStep'](stepConfig, context);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('Unknown step type');
    });
  });

  describe('utility methods', () => {
    it('should identify critical steps correctly', () => {
      const criticalStep = { config: { critical: true } };
      const nonCriticalStep = { config: { critical: false } };
      const defaultStep = { config: {} };

      expect(handler['isStepCritical'](criticalStep)).toBe(true);
      expect(handler['isStepCritical'](nonCriticalStep)).toBe(false);
      expect(handler['isStepCritical'](defaultStep)).toBe(true); // default is critical
    });
  });

  describe('error handling', () => {
    it('should handle step execution errors gracefully', async () => {
      const stepConfig = {
        id: 'step-1',
        type: 'sandbox_sync',
        config: { code: null }, // Invalid config to trigger error
      };

      const context = {
        orgId: 'test-org',
        userId: 'test-user',
        flowId: 'test-flow',
        executionId: 'test-exec',
        variables: {},
        stepOutputs: {},
      };

      const result = await handler['executeStep'](stepConfig, context);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.metadata?.duration).toBeGreaterThanOrEqual(0);
    });
  });
});