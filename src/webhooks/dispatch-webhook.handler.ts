import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { InngestFunction } from 'nestjs-inngest';
import { WebhooksService } from './webhooks.service';
import { WebhookSignatureService, WebhookPayload } from './webhook-signature.service';
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
  run: <T>(name: string, fn: () => Promise<T>) => Promise<T>;
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

    if (webhooks.length === 0) {
      this.logger.debug({ orgId, eventType }, 'No webhooks found for event type');
      return { dispatched: 0, results: [] };
    }

    this.logger.info(
      { orgId, eventType, webhookCount: webhooks.length },
      'Found webhooks for dispatch',
    );

    const results = [];

    // Dispatch to each webhook with individual retry logic
    for (const webhook of webhooks) {
      const result = await step.run(`webhook-${webhook.id}`, async () => {
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
          const headers = this.webhookSignatureService.generateWebhookHeaders(
            eventType,
            webhookPayload,
            webhook.secret || undefined,
          );

          this.logger.debug(
            {
              webhookId: webhook.id,
              url: webhook.url,
              eventType,
              deliveryId: headers['x-webhook-delivery'],
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

          this.logger.info(
            {
              webhookId: webhook.id,
              url: webhook.url,
              statusCode: response.status,
              deliveryId: headers['x-webhook-delivery'],
            },
            'Webhook delivered successfully',
          );

          return {
            success: true,
            webhookId: webhook.id,
            url: webhook.url,
            statusCode: response.status,
            deliveryId: headers['x-webhook-delivery'],
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          const statusCode =
            (error as { response?: { status?: number } })?.response?.status || null;

          this.logger.error(
            {
              webhookId: webhook.id,
              url: webhook.url,
              error: errorMessage,
              statusCode,
            },
            'Webhook delivery failed',
          );

          // Re-throw error to trigger Inngest retry
          throw new Error(`Webhook ${webhook.url} failed: ${errorMessage}`);
        }
      });

      results.push(result);
    }

    this.logger.info(
      {
        orgId,
        eventType,
        dispatched: results.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
      },
      'Webhook dispatch completed',
    );

    return {
      dispatched: results.length,
      results,
    };
  }
}
