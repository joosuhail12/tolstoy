import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AwsSecretsService } from '../aws-secrets.service';
import * as Sentry from '@sentry/nestjs';
import { nodeProfilingIntegration } from '@sentry/profiling-node';

@Injectable()
export class SentryConfigService {
  constructor(
    private readonly configService: ConfigService,
    private readonly awsSecretsService: AwsSecretsService,
  ) {}

  /**
   * Initialize Sentry with configuration from AWS Secrets Manager
   * This should be called during application bootstrap
   */
  async initializeSentry(): Promise<void> {
    try {
      let sentryDsn: string | undefined;

      // Try to get Sentry DSN from AWS Secrets Manager first
      try {
        sentryDsn = await this.awsSecretsService.getSentryDsn();
        console.log('Retrieved Sentry DSN from AWS Secrets Manager');
      } catch {
        // Fallback to environment variable
        sentryDsn = this.configService.get<string>('SENTRY_DSN');
        console.log('Using Sentry DSN from environment variable');
      }

      if (!sentryDsn) {
        console.log('Sentry DSN not found - skipping Sentry initialization');
        return;
      }

      const nodeEnv = this.configService.get<string>('NODE_ENV', 'development');

      Sentry.init({
        dsn: sentryDsn,
        integrations: [nodeProfilingIntegration()],
        environment: nodeEnv,

        // Tracing
        tracesSampleRate: nodeEnv === 'production' ? 0.25 : 1.0, // Capture 25% in prod, 100% in dev

        // Set sampling rate for profiling - this is evaluated only once per SDK.init call
        profileSessionSampleRate: nodeEnv === 'production' ? 0.1 : 1.0,

        // Trace lifecycle automatically enables profiling during active traces
        profileLifecycle: 'trace',

        // Send structured logs to Sentry
        enableLogs: true,

        // Setting this option to true will send default PII data to Sentry.
        // For example, automatic IP address collection on events
        sendDefaultPii: false, // Keep false for privacy

        beforeSend(event) {
          // Filter out sensitive information
          if (event.request?.data) {
            delete event.request.data;
          }

          // Remove sensitive headers
          if (event.request?.headers) {
            const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key', 'x-auth-token'];
            sensitiveHeaders.forEach(header => {
              if (event.request?.headers?.[header]) {
                event.request.headers[header] = '[REDACTED]';
              }
            });
          }

          return event;
        },
      });

      console.log(
        `Sentry initialized for ${nodeEnv} environment with AWS Secrets Manager integration`,
      );
    } catch (error) {
      console.error('Failed to initialize Sentry with AWS Secrets Manager:', error);
      console.log('Falling back to environment variable-based Sentry initialization');

      // Fall back to the original environment variable approach
      const sentryDsn = this.configService.get<string>('SENTRY_DSN');
      if (sentryDsn) {
        const nodeEnv = this.configService.get<string>('NODE_ENV', 'development');

        Sentry.init({
          dsn: sentryDsn,
          integrations: [nodeProfilingIntegration()],
          environment: nodeEnv,
          tracesSampleRate: nodeEnv === 'production' ? 0.25 : 1.0,
          profileSessionSampleRate: nodeEnv === 'production' ? 0.1 : 1.0,
          profileLifecycle: 'trace',
          enableLogs: true,
          sendDefaultPii: false,
          beforeSend(event) {
            if (event.request?.data) {
              delete event.request.data;
            }
            if (event.request?.headers) {
              const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key', 'x-auth-token'];
              sensitiveHeaders.forEach(header => {
                if (event.request?.headers?.[header]) {
                  event.request.headers[header] = '[REDACTED]';
                }
              });
            }
            return event;
          },
        });

        console.log(`Sentry initialized for ${nodeEnv} environment with fallback configuration`);
      }
    }
  }

  /**
   * Get the current Sentry DSN (for monitoring/health checks)
   */
  async getSentryDsn(): Promise<string | null> {
    try {
      return await this.awsSecretsService.getSentryDsn();
    } catch {
      return this.configService.get<string>('SENTRY_DSN') || null;
    }
  }

  /**
   * Check if Sentry is properly configured
   */
  async isSentryConfigured(): Promise<boolean> {
    const dsn = await this.getSentryDsn();
    return !!dsn;
  }
}
