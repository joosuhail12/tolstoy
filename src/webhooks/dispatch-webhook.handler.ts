import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { InngestFunction } from 'nestjs-inngest';
import { WebhooksService } from './webhooks.service';
import { WebhookSignatureService, WebhookPayload } from './webhook-signature.service';
import { WebhookDispatchLogService } from './webhook-dispatch-log.service';
import {
  MetricsService,
  WebhookMetricLabels,
  WebhookCounterLabels,
} from '../metrics/metrics.service';
import { firstValueFrom } from 'rxjs';

export interface WebhookEventPayload {
  orgId: string;
  flowId: string;
  executionId: string;
  stepKey?: string;
  status: string;
  output?: Record<string, unknown>;
  error?: {
    message: string;
    code?: string;
    stack?: string;
  };
  [key: string]: unknown;
}

export interface WebhookDispatchEvent {
  data: {
    orgId: string;
    eventType: string;
    payload: WebhookEventPayload;
  };
}

export interface InngestStepContext {
  run: (name: string, fn: () => Promise<unknown>) => Promise<unknown>;
}

export interface InngestEvent {
  data: WebhookDispatchEvent['data'];
}

export interface InngestHandlerParams {
  step: InngestStepContext;
  event: InngestEvent;
}

@Injectable()
export class DispatchWebhookHandler {
  constructor(
    private readonly webhookService: WebhooksService,
    private readonly webhookSignatureService: WebhookSignatureService,
    private readonly httpService: HttpService,
    private readonly metricsService: MetricsService,
    private readonly webhookDispatchLogService: WebhookDispatchLogService,
    @InjectPinoLogger(DispatchWebhookHandler.name)
    private readonly logger: PinoLogger,
  ) {}

  @InngestFunction({
    id: 'dispatch-webhook',
    name: 'Dispatch Webhook',
    triggers: [{ event: 'webhook.dispatch' }],
    retries: 5,
  })
  async handler({ step, event }: InngestHandlerParams) {
    const { orgId, eventType, payload } = event.data;

    this.logger.info(
      { orgId, eventType, executionId: payload.executionId, flowId: payload.flowId },
      'Processing webhook dispatch event',
    );

    // Fetch all enabled webhooks for this event type
    const webhooks = await step.run('fetch-webhooks', async () => {
      return this.webhookService.getWebhooksForEvent(orgId, eventType);
    });

    if (!Array.isArray(webhooks) || webhooks.length === 0) {
      this.logger.debug({ orgId, eventType }, 'No webhooks found for event type');
      return { dispatched: 0, results: [] };
    }

    this.logger.info(
      { orgId, eventType, webhookCount: webhooks.length },
      'Found webhooks for dispatch',
    );

    const results: Array<{
      success: boolean;
      webhookId: string;
      url: string;
      statusCode?: number;
      deliveryId: string;
      duration: number;
    }> = [];

    // Dispatch to each webhook with individual retry logic
    for (const webhook of webhooks) {
      const result = await step.run(`webhook-${webhook.id}`, async () => {
        const startTime = Date.now();

        // Prepare metrics labels
        const metricLabels: WebhookMetricLabels = {
          orgId,
          eventType,
          url: webhook.url,
        };

        // Start metrics timer
        const endTimer = this.metricsService.startWebhookTimer(metricLabels);

        let headers: Record<string, string> = {};

        try {
          // Create standardized webhook payload
          const webhookPayload: WebhookPayload = this.webhookSignatureService.createWebhookPayload(
            eventType,
            payload,
            {
              orgId,
              webhookId: webhook.id,
            },
          );

          // Generate headers with signature if webhook has a secret
          const webhookHeaders = this.webhookSignatureService.generateWebhookHeaders(
            eventType,
            webhookPayload,
            webhook.secret || undefined,
          );

          // Convert to Record<string, string> for HTTP client
          headers = Object.fromEntries(
            Object.entries(webhookHeaders).filter(([, value]) => value !== undefined),
          ) as Record<string, string>;

          this.logger.debug(
            {
              webhookId: webhook.id,
              url: webhook.url,
              eventType,
              deliveryId: headers['x-webhook-delivery'] || 'unknown',
            },
            'Sending webhook',
          );

          // Make HTTP request to webhook URL
          const response = await firstValueFrom(
            this.httpService.post(webhook.url, webhookPayload, {
              headers: {
                'Content-Type': 'application/json',
                ...headers,
              },
              timeout: 30000, // 30 second timeout
              maxRedirects: 3,
            }),
          );

          const duration = Date.now() - startTime;

          // End timer and record success metrics
          endTimer();
          const successLabels: WebhookCounterLabels = { ...metricLabels, success: 'true' };
          this.metricsService.incrementWebhookDispatch(successLabels);

          // Log to database
          await this.webhookDispatchLogService.logDispatchAttempt({
            webhookId: webhook.id,
            orgId,
            eventType,
            url: webhook.url,
            status: 'success',
            statusCode: response.status,
            duration,
            deliveryId: headers['x-webhook-delivery'] || 'unknown',
          });

          this.logger.info(
            {
              webhookId: webhook.id,
              url: webhook.url,
              statusCode: response.status,
              deliveryId: headers['x-webhook-delivery'] || 'unknown',
              duration,
              orgId,
              eventType,
            },
            'Webhook delivered successfully',
          );

          return {
            success: true,
            webhookId: webhook.id,
            url: webhook.url,
            statusCode: response.status,
            deliveryId: headers['x-webhook-delivery'] || 'unknown',
            duration,
          };
        } catch (error) {
          const duration = Date.now() - startTime;
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          const statusCode =
            (error as { response?: { status?: number } })?.response?.status || null;

          // End timer and record failure metrics
          endTimer();
          const failureLabels: WebhookCounterLabels = { ...metricLabels, success: 'false' };
          this.metricsService.incrementWebhookDispatch(failureLabels);

          // Log to database
          await this.webhookDispatchLogService.logDispatchAttempt({
            webhookId: webhook.id,
            orgId,
            eventType,
            url: webhook.url,
            status: 'failure',
            statusCode: statusCode || undefined,
            duration,
            error: {
              message: errorMessage,
              stack: error instanceof Error ? error.stack : undefined,
            },
            deliveryId: headers['x-webhook-delivery'] || 'unknown',
          });

          this.logger.error(
            {
              webhookId: webhook.id,
              url: webhook.url,
              error: errorMessage,
              statusCode,
              duration,
              orgId,
              eventType,
              deliveryId: headers['x-webhook-delivery'] || 'unknown',
            },
            `Webhook ${webhook.url} failed: ${errorMessage}`,
          );

          // Re-throw error to trigger Inngest retry
          throw new Error(`Webhook ${webhook.url} failed: ${errorMessage}`);
        }
      });

      results.push(
        result as {
          success: boolean;
          webhookId: string;
          url: string;
          statusCode?: number;
          deliveryId: string;
          duration: number;
        },
      );
    }

    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    this.logger.info(
      {
        orgId,
        eventType,
        dispatched: results.length,
        successful: successful.length,
        failed: failed.length,
      },
      'Webhook dispatch completed',
    );

    return {
      dispatched: results.length,
      results,
    };
  }
}
