import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';
import { ConfigService } from '@nestjs/config';
import { Realtime } from 'ably';
import { AwsSecretsService } from '../aws-secrets.service';

export interface FlowStepEvent {
  stepId: string;
  status: 'started' | 'completed' | 'failed' | 'skipped';
  timestamp: string;
  executionId: string;
  orgId: string;
  flowId: string;
  stepName?: string;
  output?: unknown;
  error?: {
    message: string;
    code?: string;
    stack?: string;
  };
  duration?: number;
  skipReason?: string; // Reason for skipping the step
  executeIf?: Record<string, unknown>; // The condition that caused the skip
  metadata?: {
    [key: string]: unknown;
  };
}

export interface FlowExecutionEvent {
  executionId: string;
  status: 'started' | 'completed' | 'failed' | 'cancelled';
  timestamp: string;
  orgId: string;
  flowId: string;
  totalSteps?: number;
  completedSteps?: number;
  failedSteps?: number;
  skippedSteps?: number;
  duration?: number;
  output?: unknown;
  error?: {
    message: string;
    code?: string;
  };
}

@Injectable()
export class AblyService implements OnModuleDestroy {
  private client: Realtime | null = null;
  private isInitialized = false;
  private initPromise: Promise<void> | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly awsSecretsService: AwsSecretsService,
    @InjectPinoLogger(AblyService.name)
    private readonly logger: PinoLogger,
  ) {}

  private async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this.doInitialize();
    return this.initPromise;
  }

  private async doInitialize(): Promise<void> {
    try {
      this.logger.info('Initializing Ably client');

      const apiKey = await this.getAblyApiKey();

      if (!apiKey) {
        this.logger.warn('Ably API key not found - real-time events will be disabled');
        return;
      }

      this.client = new Realtime({
        key: apiKey,
        clientId: `tolstoy-backend-${process.env.NODE_ENV || 'development'}`,
        environment: this.configService.get('ABLY_ENVIRONMENT', 'production'),
        logLevel: this.configService.get('NODE_ENV') === 'production' ? 1 : 3,
        autoConnect: true,
        disconnectedRetryTimeout: 5000,
        suspendedRetryTimeout: 10000,
        realtimeRequestTimeout: 10000,
      });

      this.client.connection.on('connected', () => {
        this.logger.info({ connectionState: 'connected' }, 'Ably connection established');
      });

      this.client.connection.on('disconnected', () => {
        this.logger.warn({ connectionState: 'disconnected' }, 'Ably connection lost');
      });

      this.client.connection.on('failed', error => {
        this.logger.error(
          {
            error: error instanceof Error ? error.message : 'Unknown error',
            connectionState: 'failed',
          },
          'Ably connection failed',
        );
      });

      this.isInitialized = true;
      this.logger.info(
        { isInitialized: this.isInitialized },
        'Ably service initialized successfully',
      );
    } catch (error) {
      this.logger.error(
        { error: error instanceof Error ? error.message : 'Unknown error' },
        'Failed to initialize Ably client',
      );
      this.client = null;
    }
  }

  private async getAblyApiKey(): Promise<string | null> {
    try {
      const envKey = this.configService.get('ABLY_API_KEY');
      if (envKey) {
        return envKey;
      }

      const secretKey = await this.awsSecretsService.getAblyApiKey();
      return secretKey;
    } catch (error) {
      this.logger.debug(
        { error: error instanceof Error ? error.message : 'Unknown error' },
        'Ably API key not found in secrets',
      );
      return null;
    }
  }

  async publishStepEvent(event: FlowStepEvent): Promise<void> {
    await this.initialize();

    if (!this.client) {
      this.logger.debug(
        { stepId: event.stepId, status: event.status },
        'Ably client not available - skipping step event publication',
      );
      return;
    }

    const channel = this.getFlowExecutionChannel(event.orgId, event.executionId);

    try {
      this.logger.debug(
        { channel, stepId: event.stepId, status: event.status, executionId: event.executionId },
        'Publishing step event to channel',
      );

      await this.publishWithRetry(channel, 'step-status', event);

      this.logger.debug(
        { stepId: event.stepId, status: event.status },
        'Step event published successfully',
      );
    } catch (error) {
      this.logger.error(
        {
          stepId: event.stepId,
          status: event.status,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        'Failed to publish step event',
      );
    }
  }

  async publishExecutionEvent(event: FlowExecutionEvent): Promise<void> {
    await this.initialize();

    if (!this.client) {
      this.logger.debug(
        { executionId: event.executionId, status: event.status },
        'Ably client not available - skipping execution event publication',
      );
      return;
    }

    const channel = this.getFlowExecutionChannel(event.orgId, event.executionId);

    try {
      this.logger.debug(
        { channel, executionId: event.executionId, status: event.status, flowId: event.flowId },
        'Publishing execution event to channel',
      );

      await this.publishWithRetry(channel, 'execution-status', event);

      this.logger.info(
        { executionId: event.executionId, status: event.status },
        'Execution event published',
      );
    } catch (error) {
      this.logger.error(
        {
          executionId: event.executionId,
          status: event.status,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        'Failed to publish execution event',
      );
    }
  }

  private async publishWithRetry(
    channelName: string,
    eventName: string,
    data: unknown,
    maxRetries: number = 3,
  ): Promise<void> {
    if (!this.client) {
      throw new Error('Ably client not available');
    }

    const channel = this.client.channels.get(channelName);
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await channel.publish(eventName, data);
        return;
      } catch (error) {
        lastError = error as Error;

        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 1000;
          this.logger.warn(
            {
              channelName,
              eventName,
              attempt,
              delay,
              error: error instanceof Error ? error.message : 'Unknown error',
            },
            'Ably publish attempt failed, retrying',
          );
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error('Failed to publish after retries');
  }

  private getFlowExecutionChannel(orgId: string, executionId: string): string {
    return `flows.${orgId}.${executionId}`;
  }

  getFlowOrgChannel(orgId: string): string {
    return `flows.${orgId}`;
  }

  async publishCustomEvent(
    orgId: string,
    executionId: string,
    eventName: string,
    data: unknown,
  ): Promise<void> {
    await this.initialize();

    if (!this.client) {
      this.logger.debug(
        { eventName },
        'Ably client not available - skipping custom event publication',
      );
      return;
    }

    const channel = this.getFlowExecutionChannel(orgId, executionId);

    try {
      await this.publishWithRetry(channel, eventName, {
        ...data,
        timestamp: new Date().toISOString(),
        orgId,
        executionId,
      });

      this.logger.debug({ channel, eventName }, 'Custom event published');
    } catch (error) {
      this.logger.error(
        { eventName, error: error instanceof Error ? error.message : 'Unknown error' },
        'Failed to publish custom event',
      );
    }
  }

  async createStepEvent(
    stepId: string,
    status: FlowStepEvent['status'],
    executionId: string,
    orgId: string,
    flowId: string,
    options: {
      stepName?: string;
      output?: unknown;
      error?: { message: string; code?: string; stack?: string };
      duration?: number;
      skipReason?: string;
      executeIf?: Record<string, unknown>;
      metadata?: { [key: string]: unknown };
    } = {},
  ): Promise<FlowStepEvent> {
    return {
      stepId,
      status,
      timestamp: new Date().toISOString(),
      executionId,
      orgId,
      flowId,
      ...options,
    };
  }

  async createExecutionEvent(
    executionId: string,
    status: FlowExecutionEvent['status'],
    orgId: string,
    flowId: string,
    options: {
      totalSteps?: number;
      completedSteps?: number;
      failedSteps?: number;
      skippedSteps?: number;
      duration?: number;
      output?: unknown;
      error?: { message: string; code?: string };
    } = {},
  ): Promise<FlowExecutionEvent> {
    return {
      executionId,
      status,
      timestamp: new Date().toISOString(),
      orgId,
      flowId,
      ...options,
    };
  }

  async getConnectionState(): Promise<string | null> {
    await this.initialize();
    return this.client ? this.client.connection.state : null;
  }

  async isConnected(): Promise<boolean> {
    const state = await this.getConnectionState();
    return state === 'connected';
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      this.logger.info('Disconnecting Ably client');
      this.client.close();
      this.client = null;
      this.isInitialized = false;
      this.initPromise = null;
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.disconnect();
  }
}
