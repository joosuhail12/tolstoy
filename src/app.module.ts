import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
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

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
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
      .forRoutes('users', 'tools', 'actions', 'flows', 'execution-logs', 'webhooks');
  }
}