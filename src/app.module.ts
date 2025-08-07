import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TenantMiddleware } from './common/middleware/tenant.middleware';
import { CommonModule } from './common/common.module';
import { AwsSecretsService } from './aws-secrets.service';
import { SecretsResolver } from './secrets/secrets-resolver.service';
import { OAuthTokenService } from './oauth/oauth-token.service';
import { AblyService } from './ably/ably.service';

// Feature Modules
import { OrganizationsModule } from './organizations/organizations.module';
import { UsersModule } from './users/users.module';
import { ToolsModule } from './tools/tools.module';
import { ActionsModule } from './actions/actions.module';
import { FlowsModule } from './flows/flows.module';
import { ExecutionLogsModule } from './execution-logs/execution-logs.module';
import { HealthModule } from './health/health.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { ToolSecretsModule } from './tool-secrets/tool-secrets.module';
import { SandboxModule } from './sandbox/sandbox.module';
import { InngestModule } from './flows/inngest/inngest.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL || 'info',
        transport: process.env.NODE_ENV !== 'production' ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        } : undefined,
        formatters: {
          level(level) {
            return { level };
          },
        },
        serializers: {
          req: (req: any) => ({
            id: req.id,
            method: req.method,
            url: req.url,
            headers: {
              'x-org-id': req.headers['x-org-id'],
              'x-user-id': req.headers['x-user-id'],
              'x-request-id': req.headers['x-request-id'],
            },
          }),
          res: (res: any) => ({
            statusCode: res.statusCode,
          }),
        },
        customSuccessMessage: (req: any, res: any, responseTime: number) =>
          `${req.method} ${req.url} completed in ${responseTime}ms`,
        customErrorMessage: (req: any, res: any, error: Error) =>
          `Error on ${req.method} ${req.url}: ${error.message}`,
        customProps: (req: any) => ({
          orgId: req.headers['x-org-id'],
          userId: req.headers['x-user-id'],
          requestId: req.id || req.headers['x-request-id'],
        }),
      },
    }),
    CommonModule,
    HealthModule,
    OrganizationsModule,
    UsersModule,
    ToolsModule,
    ActionsModule,
    FlowsModule,
    ExecutionLogsModule,
    WebhooksModule,
    ToolSecretsModule,
    SandboxModule,
    InngestModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    AwsSecretsService,
    SecretsResolver,
    OAuthTokenService,
    AblyService
  ],
  exports: [
    AwsSecretsService,
    SecretsResolver,
    OAuthTokenService,
    AblyService
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(TenantMiddleware)
      .exclude('organizations/(.*)', '/', '/health', '/status', 'webhooks/event-types')
      .forRoutes('users', 'tools', 'actions', 'flows', 'execution-logs', 'webhooks', 'tools/:toolId/secrets');
  }
}