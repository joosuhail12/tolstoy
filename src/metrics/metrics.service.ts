import { Injectable } from '@nestjs/common';
import { Counter, Histogram, register } from 'prom-client';

export interface StepMetricLabels {
  readonly orgId: string;
  readonly flowId: string;
  readonly stepKey: string;
}

export interface HttpMetricLabels {
  readonly method: string;
  readonly route: string;
  readonly status: string;
}

export interface WebhookMetricLabels {
  readonly orgId: string;
  readonly eventType: string;
  readonly url: string;
}

export interface WebhookCounterLabels extends WebhookMetricLabels {
  readonly success: string; // 'true' | 'false'
}

@Injectable()
export class MetricsService {
  public readonly stepExecutionHistogram: Histogram<keyof StepMetricLabels>;
  public readonly stepRetriesCounter: Counter<keyof StepMetricLabels>;
  public readonly stepErrorsCounter: Counter<keyof StepMetricLabels>;
  public readonly webhookDispatchCounter: Counter<keyof WebhookCounterLabels>;
  public readonly webhookDispatchHistogram: Histogram<keyof WebhookMetricLabels>;

  constructor() {
    this.stepExecutionHistogram = new Histogram({
      name: 'step_execution_seconds',
      help: 'Step execution duration in seconds',
      labelNames: ['orgId', 'flowId', 'stepKey'] as readonly ('orgId' | 'flowId' | 'stepKey')[],
      buckets: [0.1, 0.5, 1, 5, 10],
      registers: [register],
    });

    this.stepRetriesCounter = new Counter({
      name: 'step_retries_total',
      help: 'Total number of step retries',
      labelNames: ['orgId', 'flowId', 'stepKey'] as readonly ('orgId' | 'flowId' | 'stepKey')[],
      registers: [register],
    });

    this.stepErrorsCounter = new Counter({
      name: 'step_errors_total',
      help: 'Total number of step errors',
      labelNames: ['orgId', 'flowId', 'stepKey'] as readonly ('orgId' | 'flowId' | 'stepKey')[],
      registers: [register],
    });

    this.webhookDispatchCounter = new Counter({
      name: 'webhook_dispatch_total',
      help: 'Total number of webhook dispatch attempts',
      labelNames: ['orgId', 'eventType', 'url', 'success'] as readonly (
        | 'orgId'
        | 'eventType'
        | 'url'
        | 'success'
      )[],
      registers: [register],
    });

    this.webhookDispatchHistogram = new Histogram({
      name: 'webhook_dispatch_seconds',
      help: 'Webhook dispatch latency in seconds',
      labelNames: ['orgId', 'eventType', 'url'] as readonly ('orgId' | 'eventType' | 'url')[],
      buckets: [0.1, 0.5, 1, 2, 5],
      registers: [register],
    });
  }

  recordStepDuration(labels: StepMetricLabels, duration: number): void {
    this.stepExecutionHistogram.labels(labels).observe(duration / 1000);
  }

  incrementStepRetries(labels: StepMetricLabels): void {
    this.stepRetriesCounter.labels(labels).inc();
  }

  incrementStepErrors(labels: StepMetricLabels): void {
    this.stepErrorsCounter.labels(labels).inc();
  }

  startStepTimer(labels: StepMetricLabels) {
    return this.stepExecutionHistogram.labels(labels).startTimer();
  }

  incrementWebhookDispatch(labels: WebhookCounterLabels): void {
    this.webhookDispatchCounter.labels(labels).inc();
  }

  recordWebhookDuration(labels: WebhookMetricLabels, duration: number): void {
    this.webhookDispatchHistogram.labels(labels).observe(duration / 1000);
  }

  startWebhookTimer(labels: WebhookMetricLabels) {
    return this.webhookDispatchHistogram.labels(labels).startTimer();
  }
}
