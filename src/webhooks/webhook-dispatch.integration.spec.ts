import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { InngestService } from 'nestjs-inngest';
import { register } from 'prom-client';
import { of } from 'rxjs';
import { FlowExecutorService } from '../flows/flow-executor.service';
import { WebhooksService } from './webhooks.service';
import { DispatchWebhookHandler } from './dispatch-webhook.handler';
import { WebhookSignatureService } from './webhook-signature.service';
import { WebhookDispatchLogService } from './webhook-dispatch-log.service';
import { MetricsService } from '../metrics/metrics.service';
import { PrismaService } from '../prisma.service';
import { AblyService } from '../ably/ably.service';
import { SecretsResolver } from '../secrets/secrets-resolver.service';
import { OAuthTokenService } from '../oauth/oauth-token.service';
import { InputValidatorService } from '../common/services/input-validator.service';
import { ConditionEvaluatorService } from '../common/services/condition-evaluator.service';
import { SandboxService } from '../sandbox/sandbox.service';
import { ExecutionLogsService } from '../execution-logs/execution-logs.service';

describe('Webhook Dispatch Integration', () => {
  let flowExecutor: FlowExecutorService;
  let webhookHandler: DispatchWebhookHandler;
  let mockInngestService: any;
  let mockHttpService: any;
  let mockWebhooksService: any;
  let mockPrismaService: any;
  let mockAblyService: any;
  // let metricsService: MetricsService;

  const testWebhook = {
    id: 'webhook-123',
    url: 'https://api.example.com/webhook',
    secret: 'webhook-secret-key',
    enabled: true,
    eventTypes: ['step.completed', 'flow.completed'],
    orgId: 'org-456',
  };

  const testTenant = {
    orgId: 'org-456',
    userId: 'user-789',
  };

  beforeEach(async () => {
    // Clear all metrics before each test
    register.clear();

    mockInngestService = {
      send: jest.fn().mockResolvedValue(undefined),
    };

    mockHttpService = {
      post: jest.fn().mockReturnValue(
        of({
          status: 200,
          data: { received: true },
          statusText: 'OK',
          headers: {},
          config: {} as any,
        }),
      ),
    };

    mockWebhooksService = {
      getWebhooksForEvent: jest.fn().mockResolvedValue([testWebhook]),
    };

    mockPrismaService = {
      flow: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'flow-123',
          name: 'Test Flow',
          steps: [
            {
              id: 'step-1',
              type: 'http',
              name: 'HTTP Request',
              config: { url: 'https://api.test.com', method: 'GET' },
            },
          ],
          orgId: 'org-456',
        }),
      },
      executionLog: {
        create: jest.fn().mockResolvedValue({
          id: 'exec-123',
          flowId: 'flow-123',
          status: 'running',
        }),
        update: jest.fn().mockResolvedValue({
          id: 'exec-123',
          status: 'completed',
        }),
      },
    };

    mockAblyService = {
      createStepEvent: jest.fn().mockResolvedValue({
        stepId: 'step-1',
        status: 'completed',
        timestamp: new Date().toISOString(),
      }),
      publishStepEvent: jest.fn().mockResolvedValue(undefined),
      createExecutionEvent: jest.fn().mockResolvedValue({
        executionId: 'exec-123',
        status: 'completed',
        timestamp: new Date().toISOString(),
      }),
      publishExecutionEvent: jest.fn().mockResolvedValue(undefined),
    };

    const mockLogger = {
      info: jest.fn(),
      debug: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FlowExecutorService,
        DispatchWebhookHandler,
        WebhookSignatureService,
        WebhookDispatchLogService,
        MetricsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: AblyService,
          useValue: mockAblyService,
        },
        {
          provide: WebhooksService,
          useValue: mockWebhooksService,
        },
        {
          provide: HttpService,
          useValue: mockHttpService,
        },
        {
          provide: InngestService,
          useValue: mockInngestService,
        },
        {
          provide: SecretsResolver,
          useValue: {
            getToolSecrets: jest.fn().mockResolvedValue({}),
          },
        },
        {
          provide: OAuthTokenService,
          useValue: {
            getValidTokens: jest.fn().mockResolvedValue(null),
          },
        },
        {
          provide: InputValidatorService,
          useValue: {
            validateAndTransform: jest.fn().mockReturnValue({}),
          },
        },
        {
          provide: ConditionEvaluatorService,
          useValue: {
            evaluate: jest.fn().mockReturnValue(true),
          },
        },
        {
          provide: SandboxService,
          useValue: {
            executeSync: jest.fn().mockResolvedValue({ success: true, output: {} }),
          },
        },
        {
          provide: ExecutionLogsService,
          useValue: {
            markStepStarted: jest.fn().mockResolvedValue({ id: 'log-123' }),
            markStepCompleted: jest.fn().mockResolvedValue({ id: 'log-123' }),
            markStepFailed: jest.fn().mockResolvedValue({ id: 'log-123' }),
            markStepSkipped: jest.fn().mockResolvedValue({ id: 'log-123' }),
          },
        },
        {
          provide: `PinoLogger:${FlowExecutorService.name}`,
          useValue: mockLogger,
        },
        {
          provide: `PinoLogger:${DispatchWebhookHandler.name}`,
          useValue: mockLogger,
        },
        {
          provide: `PinoLogger:${WebhookDispatchLogService.name}`,
          useValue: mockLogger,
        },
      ],
    }).compile();

    flowExecutor = module.get(FlowExecutorService);
    webhookHandler = module.get(DispatchWebhookHandler);
    // metricsService = module.get(MetricsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Webhook Dispatch Integration', () => {
    it('should dispatch webhook when dispatchWebhook is called directly', async () => {
      // Test the dispatchWebhook method directly
      const testPayload = {
        orgId: 'org-456',
        flowId: 'flow-123',
        executionId: 'exec-123',
        stepKey: 'step-1',
        status: 'completed',
        output: { result: 'success' },
      };

      await (flowExecutor as any).dispatchWebhook('step.completed', testPayload);

      expect(mockInngestService.send).toHaveBeenCalledWith({
        name: 'webhook.dispatch',
        data: {
          orgId: 'org-456',
          eventType: 'step.completed',
          payload: testPayload,
        },
      });
    });

    it('should handle dispatchWebhook failure gracefully', async () => {
      mockInngestService.send.mockRejectedValue(new Error('Inngest service unavailable'));

      const testPayload = {
        orgId: 'org-456',
        flowId: 'flow-123',
        executionId: 'exec-123',
      };

      // Should not throw error even if dispatch fails
      await expect(
        (flowExecutor as any).dispatchWebhook('step.completed', testPayload),
      ).resolves.not.toThrow();
    });

    it('should handle webhook dispatch processing', async () => {
      const mockEvent = {
        data: {
          orgId: 'org-456',
          eventType: 'step.completed',
          payload: {
            orgId: 'org-456',
            flowId: 'flow-123',
            executionId: 'exec-123',
            stepKey: 'step-1',
            status: 'completed',
            output: { result: 'success' },
          },
        },
      };

      const mockStep = {
        run: jest
          .fn()
          .mockImplementationOnce((name, callback) => callback())
          .mockImplementationOnce((name, callback) => callback()),
      };

      // Execute webhook dispatch handler
      const result = await webhookHandler.handler({
        step: mockStep,
        event: mockEvent,
      });

      expect(result.dispatched).toBe(1);
      expect(result.results).toHaveLength(1);
      expect((result.results[0] as { success: boolean }).success).toBe(true);

      // Verify webhook was called
      expect(mockHttpService.post).toHaveBeenCalledWith(
        'https://api.example.com/webhook',
        expect.objectContaining({
          eventType: 'step.completed',
          data: mockEvent.data.payload,
        }),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'x-webhook-event': 'step.completed',
            'x-webhook-signature': expect.stringMatching(/^sha256=/),
          }),
          timeout: 30000,
          maxRedirects: 3,
        }),
      );

      // Verify metrics were recorded
      const metricsString = await register.metrics();
      expect(metricsString).toContain('webhook_dispatch_total');
      expect(metricsString).toContain('webhook_dispatch_seconds');
      expect(metricsString).toContain('orgId="org-456"');
      expect(metricsString).toContain('eventType="step.completed"');
      expect(metricsString).toContain('url="https://api.example.com/webhook"');
      expect(metricsString).toContain('success="true"');
    });

    it('should record failure metrics when webhook dispatch fails', async () => {
      // Mock HTTP service to throw an error
      mockHttpService.post.mockImplementation(() => {
        throw new Error('Network timeout');
      });

      const mockEvent = {
        data: {
          orgId: 'org-456',
          eventType: 'step.completed',
          payload: {
            orgId: 'org-456',
            flowId: 'flow-123',
            executionId: 'exec-123',
            stepKey: 'step-1',
            status: 'completed',
            output: { result: 'success' },
          },
        },
      };

      const mockStep = {
        run: jest
          .fn()
          .mockImplementationOnce((name, callback) => callback())
          .mockImplementationOnce(async (name, callback) => {
            // This should throw an error from the HTTP service and simulate Inngest retry behavior
            return await callback();
          }),
      };

      // Execute webhook dispatch handler and expect it to throw
      await expect(
        webhookHandler.handler({
          step: mockStep,
          event: mockEvent,
        }),
      ).rejects.toThrow('Network timeout');

      // Verify failure metrics were recorded
      const metricsString = await register.metrics();
      expect(metricsString).toContain('webhook_dispatch_total');
      expect(metricsString).toContain('webhook_dispatch_seconds');
      expect(metricsString).toContain('orgId="org-456"');
      expect(metricsString).toContain('eventType="step.completed"');
      expect(metricsString).toContain('url="https://api.example.com/webhook"');
      expect(metricsString).toContain('success="false"');
    });

    it('should gracefully handle missing Inngest service', async () => {
      // Clear metrics before creating a second module
      register.clear();

      // Create flow executor without Inngest service
      const moduleWithoutInngest: TestingModule = await Test.createTestingModule({
        providers: [
          FlowExecutorService,
          MetricsService,
          {
            provide: PrismaService,
            useValue: mockPrismaService,
          },
          {
            provide: AblyService,
            useValue: mockAblyService,
          },
          {
            provide: SecretsResolver,
            useValue: { getToolSecrets: jest.fn().mockResolvedValue({}) },
          },
          {
            provide: OAuthTokenService,
            useValue: { getValidTokens: jest.fn().mockResolvedValue(null) },
          },
          {
            provide: InputValidatorService,
            useValue: { validateAndTransform: jest.fn().mockReturnValue({}) },
          },
          {
            provide: ConditionEvaluatorService,
            useValue: { evaluate: jest.fn().mockReturnValue(true) },
          },
          {
            provide: SandboxService,
            useValue: { executeSync: jest.fn().mockResolvedValue({ success: true, output: {} }) },
          },
          {
            provide: ExecutionLogsService,
            useValue: {
              markStepStarted: jest.fn().mockResolvedValue({ id: 'log-123' }),
              markStepCompleted: jest.fn().mockResolvedValue({ id: 'log-123' }),
              markStepFailed: jest.fn().mockResolvedValue({ id: 'log-123' }),
              markStepSkipped: jest.fn().mockResolvedValue({ id: 'log-123' }),
            },
          },
          {
            provide: `PinoLogger:${FlowExecutorService.name}`,
            useValue: { info: jest.fn(), debug: jest.fn(), error: jest.fn(), warn: jest.fn() },
          },
        ],
      }).compile();

      const flowExecutorWithoutInngest = moduleWithoutInngest.get(FlowExecutorService);

      // Mock HTTP request to succeed
      jest.spyOn(flowExecutorWithoutInngest as any, 'executeHttpRequest').mockResolvedValue({
        success: true,
        output: { status: 200, data: { result: 'ok' } },
        metadata: { duration: 1500 },
      });

      // Should not throw error when Inngest is not available
      const result = await flowExecutorWithoutInngest.executeFlow('flow-123', testTenant, {});
      expect(result.status).toBe('completed');
    });
  });
});
