import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { AxiosResponse } from 'axios';
import { register } from 'prom-client';
import { of, throwError } from 'rxjs';
import { DispatchWebhookHandler } from './dispatch-webhook.handler';
import { WebhooksService } from './webhooks.service';
import { WebhookSignatureService } from './webhook-signature.service';
import { WebhookDispatchLogService } from './webhook-dispatch-log.service';
import { MetricsService } from '../metrics/metrics.service';

describe('DispatchWebhookHandler', () => {
  let handler: DispatchWebhookHandler;
  let mockWebhooksService: any;
  let mockWebhookSignatureService: any;
  let mockHttpService: any;
  let mockLogger: any;
  let mockMetricsService: any;
  let mockWebhookDispatchLogService: any;

  const mockWebhook = {
    id: 'webhook-1',
    url: 'https://example.com/webhook',
    secret: 'webhook-secret',
    enabled: true,
    eventTypes: ['step.completed'],
  };

  const mockEvent = {
    data: {
      orgId: 'org-123',
      eventType: 'step.completed',
      payload: {
        orgId: 'org-123',
        flowId: 'flow-456',
        executionId: 'exec-789',
        stepKey: 'step-1',
        status: 'completed',
        output: { result: 'success' },
        stepName: 'Test Step',
        duration: 1500,
      },
    },
  };

  const mockStep = {
    run: jest.fn(),
  };

  beforeEach(async () => {
    // Clear metrics before each test
    register.clear();

    mockWebhooksService = {
      getWebhooksForEvent: jest.fn(),
    };

    mockWebhookSignatureService = {
      createWebhookPayload: jest.fn(),
      generateWebhookHeaders: jest.fn(),
    };

    mockHttpService = {
      post: jest.fn(),
    };

    mockLogger = {
      info: jest.fn(),
      debug: jest.fn(),
      error: jest.fn(),
    };

    mockMetricsService = {
      startWebhookTimer: jest.fn().mockReturnValue(jest.fn()),
      incrementWebhookDispatch: jest.fn(),
      recordWebhookDuration: jest.fn(),
    };

    mockWebhookDispatchLogService = {
      logDispatchAttempt: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DispatchWebhookHandler,
        {
          provide: WebhooksService,
          useValue: mockWebhooksService,
        },
        {
          provide: WebhookSignatureService,
          useValue: mockWebhookSignatureService,
        },
        {
          provide: HttpService,
          useValue: mockHttpService,
        },
        {
          provide: MetricsService,
          useValue: mockMetricsService,
        },
        {
          provide: WebhookDispatchLogService,
          useValue: mockWebhookDispatchLogService,
        },
        {
          provide: `PinoLogger:${DispatchWebhookHandler.name}`,
          useValue: mockLogger,
        },
      ],
    }).compile();

    handler = module.get(DispatchWebhookHandler);
  });

  afterEach(() => {
    jest.clearAllMocks();
    register.clear();
  });

  describe('handler', () => {
    it('should dispatch webhook successfully', async () => {
      // Mock step.run to execute the callback immediately
      mockStep.run
        .mockImplementationOnce((stepName, callback) => callback())
        .mockImplementationOnce((stepName, callback) => callback());

      mockWebhooksService.getWebhooksForEvent.mockResolvedValue([mockWebhook]);
      mockWebhookSignatureService.createWebhookPayload.mockReturnValue({
        eventType: 'step.completed',
        timestamp: Date.now(),
        data: mockEvent.data.payload,
        metadata: {
          orgId: 'org-123',
          webhookId: 'webhook-1',
          deliveryId: 'whd_123_456',
        },
      });

      mockWebhookSignatureService.generateWebhookHeaders.mockReturnValue({
        'x-webhook-event': 'step.completed',
        'x-webhook-timestamp': '1234567890',
        'x-webhook-delivery': 'whd_123_456',
        'x-webhook-signature': 'sha256=abcdef123456',
      });

      const mockResponse: AxiosResponse = {
        status: 200,
        data: { success: true },
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      mockHttpService.post.mockReturnValue(of(mockResponse));

      const result = await handler.handler({ step: mockStep, event: mockEvent });

      expect(result.dispatched).toBe(1);
      expect(result.results).toHaveLength(1);
      expect((result.results[0] as { success: boolean }).success).toBe(true);
      expect((result.results[0] as { statusCode: number }).statusCode).toBe(200);

      expect(mockWebhooksService.getWebhooksForEvent).toHaveBeenCalledWith(
        'org-123',
        'step.completed',
      );
      expect(mockWebhookSignatureService.createWebhookPayload).toHaveBeenCalled();
      expect(mockWebhookSignatureService.generateWebhookHeaders).toHaveBeenCalled();

      // Verify metrics were recorded
      expect(mockMetricsService.startWebhookTimer).toHaveBeenCalledWith({
        orgId: 'org-123',
        eventType: 'step.completed',
        url: 'https://example.com/webhook',
      });
      expect(mockMetricsService.incrementWebhookDispatch).toHaveBeenCalledWith({
        orgId: 'org-123',
        eventType: 'step.completed',
        url: 'https://example.com/webhook',
        success: 'true',
      });

      // Verify database logging
      expect(mockWebhookDispatchLogService.logDispatchAttempt).toHaveBeenCalledWith({
        webhookId: 'webhook-1',
        orgId: 'org-123',
        eventType: 'step.completed',
        url: 'https://example.com/webhook',
        status: 'success',
        statusCode: 200,
        duration: expect.any(Number),
        deliveryId: 'whd_123_456',
      });

      expect(mockHttpService.post).toHaveBeenCalledWith(
        'https://example.com/webhook',
        expect.any(Object),
        {
          headers: {
            'Content-Type': 'application/json',
            'x-webhook-event': 'step.completed',
            'x-webhook-timestamp': '1234567890',
            'x-webhook-delivery': 'whd_123_456',
            'x-webhook-signature': 'sha256=abcdef123456',
          },
          timeout: 30000,
          maxRedirects: 3,
        },
      );
    });

    it('should handle no webhooks found', async () => {
      mockStep.run.mockImplementationOnce((stepName, callback) => callback());
      mockWebhooksService.getWebhooksForEvent.mockResolvedValue([]);

      const result = await handler.handler({ step: mockStep, event: mockEvent });

      expect(result.dispatched).toBe(0);
      expect(result.results).toEqual([]);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        { orgId: 'org-123', eventType: 'step.completed' },
        'No webhooks found for event type',
      );
    });

    it('should handle webhook without secret', async () => {
      const webhookWithoutSecret = { ...mockWebhook, secret: null };

      mockStep.run
        .mockImplementationOnce((stepName, callback) => callback())
        .mockImplementationOnce((stepName, callback) => callback());

      mockWebhooksService.getWebhooksForEvent.mockResolvedValue([webhookWithoutSecret]);
      mockWebhookSignatureService.createWebhookPayload.mockReturnValue({
        eventType: 'step.completed',
        timestamp: Date.now(),
        data: mockEvent.data.payload,
        metadata: {
          orgId: 'org-123',
          webhookId: 'webhook-1',
          deliveryId: 'whd_123_456',
        },
      });

      mockWebhookSignatureService.generateWebhookHeaders.mockReturnValue({
        'x-webhook-event': 'step.completed',
        'x-webhook-timestamp': '1234567890',
        'x-webhook-delivery': 'whd_123_456',
      });

      const mockResponse: AxiosResponse = {
        status: 200,
        data: { success: true },
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      mockHttpService.post.mockReturnValue(of(mockResponse));

      const result = await handler.handler({ step: mockStep, event: mockEvent });

      expect(result.dispatched).toBe(1);
      expect(mockWebhookSignatureService.generateWebhookHeaders).toHaveBeenCalledWith(
        'step.completed',
        expect.any(Object),
        undefined,
      );
    });

    it('should handle HTTP request failure', async () => {
      mockStep.run
        .mockImplementationOnce((stepName, callback) => callback())
        .mockImplementationOnce(async (stepName, callback) => {
          // Execute callback to trigger the actual HTTP call and error handling
          return await callback();
        });

      mockWebhooksService.getWebhooksForEvent.mockResolvedValue([mockWebhook]);
      mockWebhookSignatureService.createWebhookPayload.mockReturnValue({
        eventType: 'step.completed',
        timestamp: Date.now(),
        data: mockEvent.data.payload,
        metadata: {
          orgId: 'org-123',
          webhookId: 'webhook-1',
          deliveryId: 'whd_123_456',
        },
      });

      mockWebhookSignatureService.generateWebhookHeaders.mockReturnValue({
        'x-webhook-event': 'step.completed',
        'x-webhook-timestamp': '1234567890',
        'x-webhook-delivery': 'whd_123_456',
        'x-webhook-signature': 'sha256=abcdef123456',
      });

      mockHttpService.post.mockReturnValue(throwError(() => new Error('Network error')));

      await expect(handler.handler({ step: mockStep, event: mockEvent })).rejects.toThrow(
        'Webhook https://example.com/webhook failed: Network error',
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        {
          webhookId: 'webhook-1',
          url: 'https://example.com/webhook',
          error: 'Network error',
          statusCode: null,
          duration: expect.any(Number),
          orgId: 'org-123',
          eventType: 'step.completed',
          deliveryId: 'whd_123_456',
        },
        'Webhook https://example.com/webhook failed: Network error',
      );

      // Verify failure metrics were recorded
      expect(mockMetricsService.startWebhookTimer).toHaveBeenCalledWith({
        orgId: 'org-123',
        eventType: 'step.completed',
        url: 'https://example.com/webhook',
      });
      expect(mockMetricsService.incrementWebhookDispatch).toHaveBeenCalledWith({
        orgId: 'org-123',
        eventType: 'step.completed',
        url: 'https://example.com/webhook',
        success: 'false',
      });

      // Verify failure database logging
      expect(mockWebhookDispatchLogService.logDispatchAttempt).toHaveBeenCalledWith({
        webhookId: 'webhook-1',
        orgId: 'org-123',
        eventType: 'step.completed',
        url: 'https://example.com/webhook',
        status: 'failure',
        statusCode: undefined,
        duration: expect.any(Number),
        error: {
          message: 'Network error',
          stack: expect.any(String),
        },
        deliveryId: 'whd_123_456',
      });
    });

    it('should handle multiple webhooks', async () => {
      const webhook2 = {
        id: 'webhook-2',
        url: 'https://example2.com/webhook',
        secret: null,
        enabled: true,
        eventTypes: ['step.completed'],
      };

      mockStep.run
        .mockImplementationOnce((stepName, callback) => callback())
        .mockImplementationOnce((stepName, callback) => callback())
        .mockImplementationOnce((stepName, callback) => callback());

      mockWebhooksService.getWebhooksForEvent.mockResolvedValue([mockWebhook, webhook2]);
      mockWebhookSignatureService.createWebhookPayload.mockReturnValue({
        eventType: 'step.completed',
        timestamp: Date.now(),
        data: mockEvent.data.payload,
      });

      mockWebhookSignatureService.generateWebhookHeaders
        .mockReturnValueOnce({
          'x-webhook-event': 'step.completed',
          'x-webhook-timestamp': '1234567890',
          'x-webhook-delivery': 'whd_123_456',
          'x-webhook-signature': 'sha256=abcdef123456',
        })
        .mockReturnValueOnce({
          'x-webhook-event': 'step.completed',
          'x-webhook-timestamp': '1234567891',
          'x-webhook-delivery': 'whd_123_457',
        });

      const mockResponse: AxiosResponse = {
        status: 200,
        data: { success: true },
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      mockHttpService.post.mockReturnValue(of(mockResponse));

      const result = await handler.handler({ step: mockStep, event: mockEvent });

      expect(result.dispatched).toBe(2);
      expect(result.results).toHaveLength(2);
      expect(result.results.every(r => (r as { success: boolean }).success)).toBe(true);

      expect(mockStep.run).toHaveBeenCalledTimes(3); // 1 fetch + 2 dispatch calls
      expect(mockHttpService.post).toHaveBeenCalledTimes(2);
    });

    it('should handle flow completion events', async () => {
      const flowEvent = {
        data: {
          orgId: 'org-123',
          eventType: 'flow.completed',
          payload: {
            orgId: 'org-123',
            flowId: 'flow-456',
            executionId: 'exec-789',
            status: 'completed',
            output: { finalResult: 'success' },
            totalSteps: 5,
            completedSteps: 5,
            failedSteps: 0,
            skippedSteps: 0,
            duration: 15000,
          },
        },
      };

      mockStep.run
        .mockImplementationOnce((stepName, callback) => callback())
        .mockImplementationOnce((stepName, callback) => callback());

      mockWebhooksService.getWebhooksForEvent.mockResolvedValue([
        { ...mockWebhook, eventTypes: ['flow.completed'] },
      ]);
      mockWebhookSignatureService.createWebhookPayload.mockReturnValue({
        eventType: 'flow.completed',
        timestamp: Date.now(),
        data: flowEvent.data.payload,
      });
      mockWebhookSignatureService.generateWebhookHeaders.mockReturnValue({
        'x-webhook-event': 'flow.completed',
        'x-webhook-timestamp': '1234567890',
        'x-webhook-delivery': 'whd_123_456',
        'x-webhook-signature': 'sha256=abcdef123456',
      });

      const mockResponse: AxiosResponse = {
        status: 200,
        data: { success: true },
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      mockHttpService.post.mockReturnValue(of(mockResponse));

      const result = await handler.handler({ step: mockStep, event: flowEvent });

      expect(result.dispatched).toBe(1);
      expect(mockWebhooksService.getWebhooksForEvent).toHaveBeenCalledWith(
        'org-123',
        'flow.completed',
      );
    });
  });
});
