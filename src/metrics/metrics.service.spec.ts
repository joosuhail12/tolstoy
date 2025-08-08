import { Test, TestingModule } from '@nestjs/testing';
import { register } from 'prom-client';
import {
  MetricsService,
  StepMetricLabels,
  WebhookMetricLabels,
  WebhookCounterLabels,
} from './metrics.service';

describe('MetricsService', () => {
  let service: MetricsService;

  beforeEach(async () => {
    // Clear all metrics before each test
    register.clear();

    const module: TestingModule = await Test.createTestingModule({
      providers: [MetricsService],
    }).compile();

    service = module.get<MetricsService>(MetricsService);
  });

  afterEach(() => {
    // Clear all metrics after each test
    register.clear();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should have all required metrics defined', () => {
    expect(service.stepExecutionHistogram).toBeDefined();
    expect(service.stepRetriesCounter).toBeDefined();
    expect(service.stepErrorsCounter).toBeDefined();
    expect(service.webhookDispatchCounter).toBeDefined();
    expect(service.webhookDispatchHistogram).toBeDefined();
  });

  describe('step execution metrics', () => {
    const testLabels: StepMetricLabels = {
      orgId: 'test-org-123',
      flowId: 'test-flow-456',
      stepKey: 'test-step-789',
    };

    it('should record step duration in seconds', async () => {
      const duration = 1500; // 1.5 seconds in ms

      service.recordStepDuration(testLabels, duration);

      // Get metrics string to verify recording
      const metricsString = await register.metrics();
      expect(metricsString).toContain('step_execution_seconds');
      expect(metricsString).toContain('orgId="test-org-123"');
      expect(metricsString).toContain('flowId="test-flow-456"');
      expect(metricsString).toContain('stepKey="test-step-789"');
    });

    it('should increment step retries counter', async () => {
      service.incrementStepRetries(testLabels);
      service.incrementStepRetries(testLabels); // Increment again

      const metricsString = await register.metrics();
      expect(metricsString).toContain('step_retries_total');
      expect(metricsString).toContain('2'); // Should show 2 retries
    });

    it('should increment step errors counter', async () => {
      service.incrementStepErrors(testLabels);

      const metricsString = await register.metrics();
      expect(metricsString).toContain('step_errors_total');
      expect(metricsString).toContain('1'); // Should show 1 error
    });

    it('should start and end timer correctly', () => {
      const endTimer = service.startStepTimer(testLabels);
      expect(endTimer).toBeInstanceOf(Function);

      // End the timer
      const duration = endTimer();
      expect(typeof duration).toBe('number');
    });

    it('should handle different label combinations', async () => {
      const labels1: StepMetricLabels = {
        orgId: 'org-1',
        flowId: 'flow-1',
        stepKey: 'step-1',
      };

      const labels2: StepMetricLabels = {
        orgId: 'org-2',
        flowId: 'flow-2',
        stepKey: 'step-2',
      };

      service.incrementStepErrors(labels1);
      service.incrementStepRetries(labels2);

      const metricsString = await register.metrics();

      // Should contain both label combinations
      expect(metricsString).toContain('orgId="org-1"');
      expect(metricsString).toContain('orgId="org-2"');
      expect(metricsString).toContain('flowId="flow-1"');
      expect(metricsString).toContain('flowId="flow-2"');
    });
  });

  describe('metric labels type safety', () => {
    it('should accept valid StepMetricLabels', () => {
      const validLabels: StepMetricLabels = {
        orgId: 'test-org',
        flowId: 'test-flow',
        stepKey: 'test-step',
      };

      // These should all work without type errors
      service.recordStepDuration(validLabels, 1000);
      service.incrementStepRetries(validLabels);
      service.incrementStepErrors(validLabels);
      service.startStepTimer(validLabels);
    });
  });

  describe('histogram buckets', () => {
    it('should use correct buckets for step execution histogram', async () => {
      const testLabels: StepMetricLabels = {
        orgId: 'test-org',
        flowId: 'test-flow',
        stepKey: 'test-step',
      };

      // Test different durations to hit different buckets
      service.recordStepDuration(testLabels, 50); // 0.05s (bucket: 0.1)
      service.recordStepDuration(testLabels, 300); // 0.3s (bucket: 0.5)
      service.recordStepDuration(testLabels, 800); // 0.8s (bucket: 1)
      service.recordStepDuration(testLabels, 3000); // 3s (bucket: 5)
      service.recordStepDuration(testLabels, 8000); // 8s (bucket: 10)

      const metricsString = await register.metrics();

      // Should have histogram buckets
      expect(metricsString).toContain('le="0.1"');
      expect(metricsString).toContain('le="0.5"');
      expect(metricsString).toContain('le="1"');
      expect(metricsString).toContain('le="5"');
      expect(metricsString).toContain('le="10"');
      expect(metricsString).toContain('le="+Inf"');
    });
  });

  describe('webhook dispatch metrics', () => {
    const testWebhookLabels: WebhookMetricLabels = {
      orgId: 'test-org-123',
      eventType: 'step.completed',
      url: 'https://api.example.com/webhook',
    };

    const testWebhookCounterLabels: WebhookCounterLabels = {
      ...testWebhookLabels,
      success: 'true',
    };

    it('should increment webhook dispatch counter', async () => {
      service.incrementWebhookDispatch(testWebhookCounterLabels);
      service.incrementWebhookDispatch(testWebhookCounterLabels); // Increment again

      const metricsString = await register.metrics();
      expect(metricsString).toContain('webhook_dispatch_total');
      expect(metricsString).toContain('orgId="test-org-123"');
      expect(metricsString).toContain('eventType="step.completed"');
      expect(metricsString).toContain('url="https://api.example.com/webhook"');
      expect(metricsString).toContain('success="true"');
      expect(metricsString).toContain('2'); // Should show 2 dispatches
    });

    it('should record webhook dispatch duration', async () => {
      const duration = 1200; // 1.2 seconds in ms

      service.recordWebhookDuration(testWebhookLabels, duration);

      const metricsString = await register.metrics();
      expect(metricsString).toContain('webhook_dispatch_seconds');
      expect(metricsString).toContain('orgId="test-org-123"');
      expect(metricsString).toContain('eventType="step.completed"');
      expect(metricsString).toContain('url="https://api.example.com/webhook"');
    });

    it('should start and end webhook timer correctly', () => {
      const endTimer = service.startWebhookTimer(testWebhookLabels);
      expect(endTimer).toBeInstanceOf(Function);

      // End the timer
      const duration = endTimer();
      expect(typeof duration).toBe('number');
    });

    it('should handle success and failure counters separately', async () => {
      const successLabels: WebhookCounterLabels = { ...testWebhookLabels, success: 'true' };
      const failureLabels: WebhookCounterLabels = { ...testWebhookLabels, success: 'false' };

      service.incrementWebhookDispatch(successLabels);
      service.incrementWebhookDispatch(successLabels);
      service.incrementWebhookDispatch(failureLabels);

      const metricsString = await register.metrics();

      // Should contain both success and failure metrics
      expect(metricsString).toContain('success="true"');
      expect(metricsString).toContain('success="false"');
    });

    it('should use correct buckets for webhook dispatch histogram', async () => {
      const testLabels: WebhookMetricLabels = {
        orgId: 'test-org',
        eventType: 'flow.completed',
        url: 'https://webhook.example.com',
      };

      // Test different durations to hit different buckets
      service.recordWebhookDuration(testLabels, 80); // 0.08s (bucket: 0.1)
      service.recordWebhookDuration(testLabels, 400); // 0.4s (bucket: 0.5)
      service.recordWebhookDuration(testLabels, 900); // 0.9s (bucket: 1)
      service.recordWebhookDuration(testLabels, 1500); // 1.5s (bucket: 2)
      service.recordWebhookDuration(testLabels, 3000); // 3s (bucket: 5)

      const metricsString = await register.metrics();

      // Should have histogram buckets
      expect(metricsString).toContain('le="0.1"');
      expect(metricsString).toContain('le="0.5"');
      expect(metricsString).toContain('le="1"');
      expect(metricsString).toContain('le="2"');
      expect(metricsString).toContain('le="5"');
      expect(metricsString).toContain('le="+Inf"');
    });

    it('should handle different webhook URLs and event types', async () => {
      const webhook1Labels: WebhookCounterLabels = {
        orgId: 'org-1',
        eventType: 'step.completed',
        url: 'https://webhook1.example.com',
        success: 'true',
      };

      const webhook2Labels: WebhookCounterLabels = {
        orgId: 'org-1',
        eventType: 'flow.failed',
        url: 'https://webhook2.example.com',
        success: 'false',
      };

      service.incrementWebhookDispatch(webhook1Labels);
      service.incrementWebhookDispatch(webhook2Labels);

      const metricsString = await register.metrics();

      // Should contain both webhook configurations
      expect(metricsString).toContain('url="https://webhook1.example.com"');
      expect(metricsString).toContain('url="https://webhook2.example.com"');
      expect(metricsString).toContain('eventType="step.completed"');
      expect(metricsString).toContain('eventType="flow.failed"');
    });
  });

  describe('webhook metric labels type safety', () => {
    it('should accept valid WebhookMetricLabels', () => {
      const validLabels: WebhookMetricLabels = {
        orgId: 'test-org',
        eventType: 'step.completed',
        url: 'https://webhook.example.com',
      };

      // These should all work without type errors
      service.recordWebhookDuration(validLabels, 1000);
      service.startWebhookTimer(validLabels);
    });

    it('should accept valid WebhookCounterLabels', () => {
      const validLabels: WebhookCounterLabels = {
        orgId: 'test-org',
        eventType: 'flow.failed',
        url: 'https://webhook.example.com',
        success: 'false',
      };

      // This should work without type errors
      service.incrementWebhookDispatch(validLabels);
    });
  });
});
