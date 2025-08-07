import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { InternalServerErrorException } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { SandboxService, SandboxExecutionContext } from './sandbox.service';
import { DaytonaClientImpl } from './daytona-client';

describe('SandboxService', () => {
  let service: SandboxService;
  let configService: any;
  let daytonaClient: any;
  let logger: any;

  const mockContext: SandboxExecutionContext = {
    orgId: 'org-123',
    userId: 'user-456',
    flowId: 'flow-789',
    stepId: 'step-001',
    executionId: 'exec-123',
    variables: { input: 'test' },
    stepOutputs: { previousStep: 'output' },
  };

  const mockSyncResult = {
    success: true,
    output: { result: 'execution successful', logs: ['Log entry 1'] },
    executionTime: 1500,
  };

  const mockSessionResponse = {
    sessionId: 'session-123',
    status: 'pending' as const,
    createdAt: '2025-01-01T00:00:00Z',
  };

  const mockAsyncResult = {
    sessionId: 'session-123',
    status: 'completed' as const,
    output: { result: 'async execution successful' },
    executionTime: 2500,
    completedAt: '2025-01-01T00:01:00Z',
  };

  beforeEach(async () => {
    const mockConfigService = {
      get: jest.fn(),
    };

    const mockDaytonaClient = {
      run: jest.fn(),
      startSession: jest.fn(),
      getSessionResult: jest.fn(),
      cancelSession: jest.fn(),
    };

    const mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SandboxService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: DaytonaClientImpl,
          useValue: mockDaytonaClient,
        },
        {
          provide: `PinoLogger:${SandboxService.name}`,
          useValue: mockLogger,
        },
      ],
    }).compile();

    service = module.get(SandboxService);
    configService = module.get(ConfigService);
    daytonaClient = module.get(DaytonaClientImpl);
    logger = module.get(`PinoLogger:${SandboxService.name}`);

    // Default config values
    configService.get.mockImplementation((key: string) => {
      switch (key) {
        case 'DAYTONA_API_KEY':
          return 'test-api-key';
        case 'DAYTONA_BASE_URL':
          return 'https://api.daytona.dev';
        case 'DAYTONA_SYNC_TIMEOUT':
          return 30000;
        case 'DAYTONA_ASYNC_TIMEOUT':
          return 300000;
        default:
          return undefined;
      }
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Service Initialization', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should log configuration on startup', async () => {
      // Clear existing mock calls
      jest.clearAllMocks();

      // Create a fresh service instance to verify logging behavior
      await Test.createTestingModule({
        providers: [
          SandboxService,
          { provide: ConfigService, useValue: configService },
          { provide: DaytonaClientImpl, useValue: daytonaClient },
          { provide: `PinoLogger:${SandboxService.name}`, useValue: logger },
        ],
      }).compile();

      // The log should have been called during construction above
      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          baseUrl: 'https://api.daytona.dev',
          syncTimeout: 30000,
          asyncTimeout: 300000,
        }),
        'Daytona sandbox service configured',
      );
    });

    it('should warn when API key is not configured', () => {
      configService.get.mockImplementation((key: string) => {
        if (key === 'DAYTONA_API_KEY') {
          return undefined;
        }
        return 'default-value';
      });

      // Create new service instance to trigger initialization
      const testModule = Test.createTestingModule({
        providers: [
          SandboxService,
          { provide: ConfigService, useValue: configService },
          { provide: DaytonaClientImpl, useValue: daytonaClient },
          { provide: `PinoLogger:${SandboxService.name}`, useValue: logger },
        ],
      }).compile();

      expect(logger.warn).toHaveBeenCalledWith(
        'DAYTONA_API_KEY not configured - sandbox execution will be disabled',
      );
    });
  });

  describe('runSync', () => {
    it('should execute code synchronously and return success result', async () => {
      daytonaClient.run.mockResolvedValue(mockSyncResult);

      const result = await service.runSync('console.log("test");', mockContext);

      expect(daytonaClient.run).toHaveBeenCalledWith({
        code: 'console.log("test");',
        context: expect.objectContaining({
          variables: mockContext.variables,
          stepOutputs: mockContext.stepOutputs,
          meta: expect.objectContaining({
            orgId: 'org-123',
            userId: 'user-456',
            flowId: 'flow-789',
          }),
        }),
        language: 'javascript',
        timeout: 30000,
      });

      expect(result).toEqual({
        success: true,
        output: mockSyncResult.output,
        executionTime: 1500,
      });

      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          orgId: 'org-123',
          mode: 'sync',
          executionTime: 1500,
        }),
        'Synchronous sandbox execution completed successfully',
      );
    });

    it('should handle execution errors', async () => {
      const errorResult = {
        success: false,
        output: null,
        error: { message: 'Syntax error', code: 'SYNTAX_ERROR' },
        executionTime: 500,
      };

      daytonaClient.run.mockResolvedValue(errorResult);

      const result = await service.runSync('invalid code', mockContext);

      expect(result).toEqual({
        success: false,
        output: null,
        error: { message: 'Syntax error', code: 'SYNTAX_ERROR' },
        executionTime: 500,
      });

      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Syntax error',
          mode: 'sync',
        }),
        'Synchronous sandbox execution failed',
      );
    });

    it('should handle client exceptions', async () => {
      const error = new Error('Network timeout');
      daytonaClient.run.mockRejectedValue(error);

      await expect(service.runSync('console.log("test");', mockContext)).rejects.toThrow(
        InternalServerErrorException,
      );

      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Network timeout',
          mode: 'sync',
        }),
        'Synchronous sandbox execution error',
      );
    });

    it('should detect different programming languages', async () => {
      daytonaClient.run.mockResolvedValue(mockSyncResult);

      // Test Python detection
      await service.runSync('print("hello")', mockContext);
      expect(daytonaClient.run).toHaveBeenLastCalledWith(
        expect.objectContaining({ language: 'python' }),
      );

      // Test Go detection
      await service.runSync('fmt.Print("hello")', mockContext);
      expect(daytonaClient.run).toHaveBeenLastCalledWith(
        expect.objectContaining({ language: 'go' }),
      );

      // Test Rust detection
      await service.runSync('println!("hello")', mockContext);
      expect(daytonaClient.run).toHaveBeenLastCalledWith(
        expect.objectContaining({ language: 'rust' }),
      );
    });
  });

  describe('runAsync', () => {
    it('should start async execution and return session ID', async () => {
      daytonaClient.startSession.mockResolvedValue(mockSessionResponse);

      const sessionId = await service.runAsync('console.log("async test");', mockContext);

      expect(daytonaClient.startSession).toHaveBeenCalledWith({
        code: 'console.log("async test");',
        context: expect.objectContaining({
          variables: mockContext.variables,
          stepOutputs: mockContext.stepOutputs,
        }),
        language: 'javascript',
        timeout: 300000,
      });

      expect(sessionId).toBe('session-123');

      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: 'session-123',
          mode: 'async',
        }),
        'Asynchronous sandbox session started',
      );
    });

    it('should handle session start failures', async () => {
      const error = new Error('Failed to start session');
      daytonaClient.startSession.mockRejectedValue(error);

      await expect(service.runAsync('console.log("test");', mockContext)).rejects.toThrow(
        InternalServerErrorException,
      );

      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Failed to start session',
          mode: 'async',
        }),
        'Failed to start asynchronous sandbox execution',
      );
    });
  });

  describe('getAsyncResult', () => {
    it('should retrieve completed async result', async () => {
      daytonaClient.getSessionResult.mockResolvedValue(mockAsyncResult);

      const result = await service.getAsyncResult('session-123', mockContext);

      expect(daytonaClient.getSessionResult).toHaveBeenCalledWith('session-123');

      expect(result).toEqual({
        sessionId: 'session-123',
        status: 'completed',
        result: {
          success: true,
          output: mockAsyncResult.output,
          executionTime: 2500,
          sessionId: 'session-123',
        },
      });

      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: 'session-123',
          status: 'completed',
          mode: 'async',
        }),
        'Asynchronous sandbox execution completed',
      );
    });

    it('should handle pending async result', async () => {
      const pendingResult = {
        sessionId: 'session-123',
        status: 'running' as const,
      };

      daytonaClient.getSessionResult.mockResolvedValue(pendingResult);

      const result = await service.getAsyncResult('session-123');

      expect(result).toEqual({
        sessionId: 'session-123',
        status: 'running',
      });

      expect(logger.debug).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: 'session-123',
          status: 'running',
        }),
        'Asynchronous sandbox execution still in progress',
      );
    });

    it('should handle failed async result', async () => {
      const failedResult = {
        sessionId: 'session-123',
        status: 'failed' as const,
        error: { message: 'Runtime error', code: 'RUNTIME_ERROR' },
        executionTime: 1000,
      };

      daytonaClient.getSessionResult.mockResolvedValue(failedResult);

      const result = await service.getAsyncResult('session-123');

      expect(result).toEqual({
        sessionId: 'session-123',
        status: 'failed',
        result: {
          success: false,
          error: failedResult.error,
          executionTime: 1000,
          sessionId: 'session-123',
        },
      });
    });

    it('should handle getSessionResult exceptions', async () => {
      const error = new Error('Session not found');
      daytonaClient.getSessionResult.mockRejectedValue(error);

      await expect(service.getAsyncResult('invalid-session')).rejects.toThrow(
        InternalServerErrorException,
      );

      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: 'invalid-session',
          error: 'Session not found',
        }),
        'Failed to retrieve asynchronous sandbox result',
      );
    });
  });

  describe('cancelAsyncExecution', () => {
    it('should cancel async execution successfully', async () => {
      daytonaClient.cancelSession.mockResolvedValue();

      await service.cancelAsyncExecution('session-123', mockContext);

      expect(daytonaClient.cancelSession).toHaveBeenCalledWith('session-123');

      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: 'session-123',
          mode: 'async',
        }),
        'Cancelling asynchronous sandbox execution',
      );

      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: 'session-123',
        }),
        'Asynchronous sandbox execution cancelled',
      );
    });

    it('should handle cancellation failures', async () => {
      const error = new Error('Cannot cancel completed session');
      daytonaClient.cancelSession.mockRejectedValue(error);

      await expect(service.cancelAsyncExecution('session-123')).rejects.toThrow(
        InternalServerErrorException,
      );

      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Cannot cancel completed session',
        }),
        'Failed to cancel asynchronous sandbox execution',
      );
    });
  });

  describe('Configuration Methods', () => {
    it('should return correct configuration status', async () => {
      expect(service.isConfigured()).toBe(true);

      const healthInfo = await service.getHealthInfo();
      expect(healthInfo).toEqual({
        configured: true,
        apiKeyPresent: true,
        baseUrl: 'https://api.daytona.dev',
        syncTimeout: 30000,
        asyncTimeout: 300000,
      });
    });

    it('should return unconfigured when API key is missing', async () => {
      configService.get.mockImplementation((key: string) => {
        if (key === 'DAYTONA_API_KEY') {
          return undefined;
        }
        return 'default-value';
      });

      expect(service.isConfigured()).toBe(false);

      const healthInfo = await service.getHealthInfo();
      expect(healthInfo.configured).toBe(false);
      expect(healthInfo.apiKeyPresent).toBe(false);
    });
  });

  describe('Context Building', () => {
    it('should build execution context with all required fields', async () => {
      daytonaClient.run.mockResolvedValue(mockSyncResult);

      await service.runSync('test code', mockContext);

      const calledWith = daytonaClient.run.mock.calls[0][0];
      const context = calledWith.context;

      expect(context).toHaveProperty('variables', mockContext.variables);
      expect(context).toHaveProperty('stepOutputs', mockContext.stepOutputs);
      expect(context).toHaveProperty('meta');
      expect(context.meta).toMatchObject({
        orgId: 'org-123',
        userId: 'user-456',
        flowId: 'flow-789',
        stepId: 'step-001',
        executionId: 'exec-123',
      });
      expect(context).toHaveProperty('utils');
      expect(context.utils).toHaveProperty('log');
      expect(context.utils).toHaveProperty('error');
      expect(context.utils).toHaveProperty('warn');
    });

    it('should provide working utility functions in context', async () => {
      daytonaClient.run.mockResolvedValue(mockSyncResult);

      await service.runSync('test code', mockContext);

      const calledWith = daytonaClient.run.mock.calls[0][0];
      const utils = calledWith.context.utils;

      const logResult = utils.log('test message', { data: 'test' });
      expect(logResult).toMatchObject({
        type: 'log',
        message: 'test message',
        data: { data: 'test' },
        timestamp: expect.any(String),
      });

      const errorResult = utils.error('error message');
      expect(errorResult).toMatchObject({
        type: 'error',
        message: 'error message',
      });
    });
  });

  describe('Language Detection', () => {
    it('should detect JavaScript correctly', async () => {
      daytonaClient.run.mockResolvedValue(mockSyncResult);

      const jsCode = 'function test() { console.log("hello"); }';
      await service.runSync(jsCode, mockContext);

      expect(daytonaClient.run).toHaveBeenCalledWith(
        expect.objectContaining({ language: 'javascript' }),
      );
    });

    it('should detect Python correctly', async () => {
      daytonaClient.run.mockResolvedValue(mockSyncResult);

      const pythonCode = 'def hello():\n    print("hello")';
      await service.runSync(pythonCode, mockContext);

      expect(daytonaClient.run).toHaveBeenCalledWith(
        expect.objectContaining({ language: 'python' }),
      );
    });

    it('should default to JavaScript for unknown patterns', async () => {
      daytonaClient.run.mockResolvedValue(mockSyncResult);

      const unknownCode = 'some unknown code pattern';
      await service.runSync(unknownCode, mockContext);

      expect(daytonaClient.run).toHaveBeenCalledWith(
        expect.objectContaining({ language: 'javascript' }),
      );
    });
  });
});
