import { MiddlewareConsumer, Module, NestModule, OnModuleInit } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { IncomingMessage, ServerResponse } from 'http';
import { makeCounterProvider, makeHistogramProvider } from '@willsoto/nestjs-prometheus';
import { SentryModule } from '@sentry/nestjs/setup';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TenantMiddleware } from './common/middleware/tenant.middleware';
import { CommonModule } from './common/common.module';
import { CacheModule } from './cache/cache.module';
import { MetricsModule } from './metrics/metrics.module';
import { AwsSecretsService } from './aws-secrets.service';
import { RedisCacheService } from './cache/redis-cache.service';
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
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [
    SentryModule.forRoot(),
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL || 'info',
        transport:
          process.env.NODE_ENV !== 'production'
            ? {
                target: 'pino-pretty',
                options: {
                  colorize: true,
                  translateTime: 'SYS:standard',
                  ignore: 'pid,hostname',
                },
              }
            : undefined,
        formatters: {
          level(level) {
            return { level };
          },
        },
        serializers: {
          req: (req: {
            id?: string;
            method: string;
            url: string;
            headers: Record<string, unknown>;
          }) => ({
            id: req.id,
            method: req.method,
            url: req.url,
            headers: {
              'x-org-id': req.headers['x-org-id'],
              'x-user-id': req.headers['x-user-id'],
              'x-request-id': req.headers['x-request-id'],
            },
          }),
          res: (res: { statusCode: number }) => ({
            statusCode: res.statusCode,
          }),
        },
        customSuccessMessage: (
          req: IncomingMessage,
          _res: ServerResponse<IncomingMessage>,
          responseTime: number,
        ) => `${req.method || 'UNKNOWN'} ${req.url || 'unknown'} completed in ${responseTime}ms`,
        customErrorMessage: (
          req: IncomingMessage,
          _res: ServerResponse<IncomingMessage>,
          error: Error,
        ) =>
          `Error on ${req.method || 'UNKNOWN'} ${req.url || 'unknown'}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        customProps: (req: IncomingMessage) => ({
          orgId: req.headers['x-org-id'],
          userId: req.headers['x-user-id'],
          requestId: req.headers['x-request-id'],
        }),
      },
    }),
    CommonModule,
    CacheModule,
    MetricsModule,
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
    AuthModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    AwsSecretsService,
    SecretsResolver,
    OAuthTokenService,
    AblyService,
    makeCounterProvider({
      name: 'http_requests_total',
      help: 'HTTP Requests Total',
      labelNames: ['method', 'route', 'status'],
    }),
    makeHistogramProvider({
      name: 'http_request_duration_seconds',
      help: 'HTTP request duration in seconds',
      labelNames: ['method', 'route', 'status'],
      buckets: [0.1, 0.5, 1, 2, 5],
    }),
  ],
  exports: [AwsSecretsService, SecretsResolver, OAuthTokenService, AblyService],
})
export class AppModule implements NestModule, OnModuleInit {
  constructor(
    private readonly awsSecretsService: AwsSecretsService,
    private readonly cacheService: RedisCacheService,
  ) {}

  async onModuleInit() {
    // Configure cache service for AWS Secrets Manager after all dependencies are initialized
    this.awsSecretsService.setCacheService(this.cacheService);
  }

  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(TenantMiddleware)
      .exclude('organizations/(.*)', '/', '/health', '/status', '/metrics', 'webhooks/event-types')
      .forRoutes(
        'users',
        'tools',
        'actions',
        'flows',
        'execution-logs',
        'webhooks',
        'tools/:toolId/secrets',
      );
  }
}
