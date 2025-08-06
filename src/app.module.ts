import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from './prisma.service';
import { TenantMiddleware } from './common/middleware/tenant.middleware';

// Feature Modules
import { OrganizationsModule } from './organizations/organizations.module';
import { UsersModule } from './users/users.module';
import { ToolsModule } from './tools/tools.module';
import { ActionsModule } from './actions/actions.module';
import { FlowsModule } from './flows/flows.module';
import { ExecutionLogsModule } from './execution-logs/execution-logs.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    OrganizationsModule,
    UsersModule,
    ToolsModule,
    ActionsModule,
    FlowsModule,
    ExecutionLogsModule,
  ],
  controllers: [AppController],
  providers: [AppService, PrismaService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(TenantMiddleware)
      .exclude('organizations/(.*)', '/', '/health')
      .forRoutes('users', 'tools', 'actions', 'flows', 'execution-logs');
  }
}