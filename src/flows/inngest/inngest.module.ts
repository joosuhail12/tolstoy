import { Module } from '@nestjs/common';
import { InngestModule as NestInngestModule } from 'nestjs-inngest';
import { AwsSecretsService } from '../../aws-secrets.service';
import { ExecuteFlowHandler } from './execute-flow.handler';
import { InngestExecutionService } from './inngest-execution.service';
import { SecretsResolver } from '../../secrets/secrets-resolver.service';
import { AblyService } from '../../ably/ably.service';
import { CommonModule } from '../../common/common.module';
import { CacheModule } from '../../cache/cache.module';
import { ExecutionLogsModule } from '../../execution-logs/execution-logs.module';
import { MetricsModule } from '../../metrics/metrics.module';
import { AuthModule } from '../../auth/auth.module';

/**
 * Inngest Integration Module
 *
 * Configures Inngest for durable workflow orchestration with credentials
 * loaded from AWS Secrets Manager at runtime.
 */
@Module({
  imports: [
    CommonModule,
    CacheModule,
    ExecutionLogsModule,
    MetricsModule,
    AuthModule,
    NestInngestModule.forRootAsync({
      imports: [], // AwsSecretsService is globally available
      inject: [AwsSecretsService],
      useFactory: async (secretsService: AwsSecretsService) => {
        try {
          // Fetch Inngest credentials from AWS Secrets Manager
          const inngestConfig = await secretsService.getInngestConfig();
          
          console.log('Inngest Config loaded from AWS Secrets:', {
            hasEventKey: !!inngestConfig.eventKey,
            hasSigningKey: !!inngestConfig.signingKey,
            eventKeyLength: inngestConfig.eventKey?.length,
            signingKeyLength: inngestConfig.signingKey?.length,
          });

          return {
            appId: 'tolstoy-workflow-engine',
            signingKey: inngestConfig.signingKey, // This will be INNGEST_API_KEY from AWS
            eventKey: inngestConfig.eventKey, // This will be INNGEST_EVENT_KEY from AWS
            inngest: {
              id: 'tolstoy',
              name: 'Tolstoy Workflow Engine',
              eventKey: inngestConfig.eventKey, // Also keep it here for compatibility
            },
            serve: {
              servePort: process.env.PORT || 3000,
              serveHost: process.env.HOST || 'localhost',
            },
            defaults: {
              // Global concurrency limit: max 10 concurrent step executions across all functions
              concurrency: 10,
              // Global rate limiting: max 100 steps per minute to respect external API limits
              rateLimit: {
                maxExecutions: 100,
                perMilliseconds: 60_000, // 60 seconds
              },
              // Global retry policy: exponential backoff for resilient error handling
              retry: {
                maxAttempts: 3,
                backoff: {
                  type: 'exponential',
                  delay: 2000, // Start with 2s, then 4s, 8s
                },
              },
            },
          };
        } catch (error) {
          console.error('Failed to load Inngest configuration from AWS Secrets:', error);

          // Fallback to environment variables if AWS Secrets fail
          console.log('Using fallback environment variables for Inngest config:', {
            hasEventKey: !!process.env.INNGEST_EVENT_KEY,
            hasSigningKey: !!process.env.INNGEST_SIGNING_KEY,
            eventKeyLength: process.env.INNGEST_EVENT_KEY?.length,
            signingKeyLength: process.env.INNGEST_SIGNING_KEY?.length,
          });
          
          return {
            appId: 'tolstoy-workflow-engine',
            signingKey: process.env.INNGEST_API_KEY || 'dev-key', // INNGEST_API_KEY is the signing key
            eventKey: process.env.INNGEST_EVENT_KEY || 'dev-key', // INNGEST_EVENT_KEY is the event key
            inngest: {
              id: 'tolstoy',
              name: 'Tolstoy Workflow Engine',
              eventKey: process.env.INNGEST_EVENT_KEY || 'dev-key',
            },
            serve: {
              servePort: process.env.PORT || 3000,
              serveHost: process.env.HOST || 'localhost',
            },
            defaults: {
              // Global concurrency limit: max 10 concurrent step executions across all functions
              concurrency: 10,
              // Global rate limiting: max 100 steps per minute to respect external API limits
              rateLimit: {
                maxExecutions: 100,
                perMilliseconds: 60_000, // 60 seconds
              },
              // Global retry policy: exponential backoff for resilient error handling
              retry: {
                maxAttempts: 3,
                backoff: {
                  type: 'exponential',
                  delay: 2000, // Start with 2s, then 4s, 8s
                },
              },
            },
          };
        }
      },
    }),
  ],
  providers: [ExecuteFlowHandler, InngestExecutionService, SecretsResolver, AblyService],
  exports: [InngestExecutionService],
})
export class InngestModule {}
