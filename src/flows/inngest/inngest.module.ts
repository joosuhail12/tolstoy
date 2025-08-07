import { Module } from '@nestjs/common';
import { InngestModule as NestInngestModule } from 'nestjs-inngest';
import { AwsSecretsService } from '../../aws-secrets.service';
import { ExecuteFlowHandler } from './execute-flow.handler';
import { InngestExecutionService } from './inngest-execution.service';

/**
 * Inngest Integration Module
 * 
 * Configures Inngest for durable workflow orchestration with credentials
 * loaded from AWS Secrets Manager at runtime.
 */
@Module({
  imports: [
    NestInngestModule.forRootAsync({
      imports: [], // AwsSecretsService is globally available
      inject: [AwsSecretsService],
      useFactory: async (secretsService: AwsSecretsService) => {
        try {
          // Fetch Inngest credentials from AWS Secrets Manager
          const config = await secretsService.getInngestConfig();
          
          return {
            appId: 'tolstoy-workflow-engine',
            inngest: {
              id: 'tolstoy',
              name: 'Tolstoy Workflow Engine',
              eventKey: config.apiKey,
            },
            serve: {
              servePort: process.env.PORT || 3000,
              serveHost: process.env.HOST || 'localhost',
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
          };
        }
      },
    }),
  ],
  providers: [
    ExecuteFlowHandler,
    InngestExecutionService,
  ],
  exports: [
    InngestExecutionService,
  ],
})
export class InngestModule {}