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

export interface ActionMetricLabels {
  readonly orgId: string;
  readonly toolKey: string;
  readonly actionKey: string;
}

export interface ActionCounterLabels extends ActionMetricLabels {
  readonly status: string; // 'started' | 'success' | 'error'
}

export interface AuthInjectionMetricLabels {
  readonly orgId: string;
  readonly stepId: string;
  readonly stepType: string;
  readonly toolName: string;
  readonly authType: string; // 'apiKey' | 'oauth2' | 'none'
}

@Injectable()
export class MetricsService {
  public readonly stepExecutionHistogram: Histogram<keyof StepMetricLabels>;
  public readonly stepRetriesCounter: Counter<keyof StepMetricLabels>;
  public readonly stepErrorsCounter: Counter<keyof StepMetricLabels>;
  public readonly webhookDispatchCounter: Counter<keyof WebhookCounterLabels>;
  public readonly webhookDispatchHistogram: Histogram<keyof WebhookMetricLabels>;
  public readonly actionExecutionCounter: Counter<keyof ActionCounterLabels>;
  public readonly actionExecutionDuration: Histogram<keyof ActionMetricLabels>;
  public readonly authInjectionCounter: Counter<keyof AuthInjectionMetricLabels>;

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

    this.actionExecutionCounter = new Counter({
      name: 'action_execution_total',
      help: 'Total number of single action executions',
      labelNames: ['orgId', 'toolKey', 'actionKey', 'status'] as readonly (
        | 'orgId'
        | 'toolKey'
        | 'actionKey'
        | 'status'
      )[],
      registers: [register],
    });

    this.actionExecutionDuration = new Histogram({
      name: 'action_execution_seconds',
      help: 'Single action execution duration in seconds',
      labelNames: ['orgId', 'toolKey', 'actionKey'] as readonly (
        | 'orgId'
        | 'toolKey'
        | 'actionKey'
      )[],
      buckets: [0.1, 0.5, 1, 5, 10, 30],
      registers: [register],
    });

    this.authInjectionCounter = new Counter({
      name: 'auth_injection_total',
      help: 'Total number of auth header injections for flow steps',
      labelNames: ['orgId', 'stepId', 'stepType', 'toolName', 'authType'] as readonly (
        | 'orgId'
        | 'stepId'
        | 'stepType'
        | 'toolName'
        | 'authType'
      )[],
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

  incrementAuthInjection(labels: AuthInjectionMetricLabels): void {
    this.authInjectionCounter.labels(labels).inc();
  }
}
