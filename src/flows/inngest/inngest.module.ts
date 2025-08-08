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
    NestInngestModule.forRootAsync({
      imports: [], // AwsSecretsService is globally available
      inject: [AwsSecretsService],
      useFactory: async (secretsService: AwsSecretsService) => {
        try {
          // Fetch Inngest credentials from AWS Secrets Manager
          const eventKey = await secretsService.getSecret('tolstoy/env', 'INNGEST_API_KEY');

          return {
            appId: 'tolstoy-workflow-engine',
            inngest: {
              id: 'tolstoy',
              name: 'Tolstoy Workflow Engine',
              eventKey: eventKey,
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
          return {
            appId: 'tolstoy-workflow-engine',
            inngest: {
              id: 'tolstoy',
              name: 'Tolstoy Workflow Engine',
              eventKey: process.env.INNGEST_API_KEY || 'dev-key',
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
