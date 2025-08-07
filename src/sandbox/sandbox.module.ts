import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SandboxService } from './sandbox.service';
import { DaytonaClientImpl } from './daytona-client';

/**
 * SandboxModule - Daytona Integration Module
 *
 * Provides sandbox execution capabilities through the Daytona platform.
 * This module encapsulates all sandbox-related services and makes them
 * available for dependency injection throughout the application.
 *
 * Exports:
 * - SandboxService: Main service for sync/async code execution
 *
 * Dependencies:
 * - ConfigModule: For environment variable access
 * - AwsSecretsService: Available globally via CommonModule
 */
@Global()
@Module({
  imports: [ConfigModule],
  providers: [SandboxService, DaytonaClientImpl],
  exports: [SandboxService],
})
export class SandboxModule {}
