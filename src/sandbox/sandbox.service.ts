import { Injectable, InternalServerErrorException, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';
import { DaytonaClientImpl } from './daytona-client';
import { AwsSecretsService } from '../aws-secrets.service';

export interface SandboxExecutionContext {
  orgId: string;
  userId: string;
  flowId: string;
  stepId: string;
  executionId: string;
  variables?: any;
  stepOutputs?: any;
}

export interface SandboxExecutionResult {
  success: boolean;
  output?: any;
  error?: {
    message: string;
    code?: string;
    stack?: string;
  };
  executionTime: number;
  sessionId?: string; // For async executions
}

export interface AsyncSandboxResult {
  sessionId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: SandboxExecutionResult;
}

/**
 * SandboxService - Daytona Integration Layer
 * 
 * Provides a clean interface for executing code in Daytona sandboxes
 * with both synchronous and asynchronous execution modes.
 * 
 * Features:
 * - Sync execution: runSync() - blocks until completion
 * - Async execution: runAsync() + getAsyncResult() - session-based
 * - Context-aware logging with tenant isolation
 * - Error handling and timeout management
 * - Security through sandboxed execution
 */
@Injectable()
export class SandboxService {
  
  constructor(
    private readonly configService: ConfigService,
    private readonly client: DaytonaClientImpl,
    @InjectPinoLogger(SandboxService.name)
    private readonly logger: PinoLogger,
    @Optional() private readonly awsSecretsService?: AwsSecretsService,
  ) {
    this.validateConfiguration();
  }

  /**
   * Execute code synchronously in a Daytona sandbox
   * 
   * @param code - The code to execute (JavaScript, Python, etc.)
   * @param context - Execution context with tenant info and variables
   * @returns Promise<SandboxExecutionResult> - Execution result with output or error
   */
  async runSync(code: string, context: SandboxExecutionContext): Promise<SandboxExecutionResult> {
    const { orgId, userId, flowId, stepId, executionId } = context;
    
    this.logger.info({
      orgId,
      userId,
      flowId,
      stepId,
      executionId,
      codeLength: code.length,
      mode: 'sync'
    }, 'Starting synchronous sandbox execution');

    try {
      const daytonaResult = await this.client.run({
        code,
        context: this.buildExecutionContext(context),
        language: this.detectLanguage(code),
        timeout: await this.getSyncTimeout(),
      });

      const result: SandboxExecutionResult = {
        success: daytonaResult.success,
        output: daytonaResult.output,
        error: daytonaResult.error,
        executionTime: daytonaResult.executionTime,
      };

      if (result.success) {
        this.logger.info({
          orgId,
          userId,
          flowId,
          stepId,
          executionId,
          executionTime: result.executionTime,
          mode: 'sync'
        }, 'Synchronous sandbox execution completed successfully');
      } else {
        this.logger.warn({
          orgId,
          userId,
          flowId,
          stepId,
          executionId,
          error: result.error?.message,
          executionTime: result.executionTime,
          mode: 'sync'
        }, 'Synchronous sandbox execution failed');
      }

      return result;

    } catch (error) {
      this.logger.error({
        orgId,
        userId,
        flowId,
        stepId,
        executionId,
        error: error instanceof Error ? error.message : 'Unknown error',
        mode: 'sync'
      }, 'Synchronous sandbox execution error');

      throw new InternalServerErrorException(
        `Sandbox sync execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error
      );
    }
  }

  /**
   * Start asynchronous code execution in a Daytona sandbox
   * 
   * @param code - The code to execute
   * @param context - Execution context with tenant info and variables
   * @returns Promise<string> - Session ID for tracking the execution
   */
  async runAsync(code: string, context: SandboxExecutionContext): Promise<string> {
    const { orgId, userId, flowId, stepId, executionId } = context;
    
    this.logger.info({
      orgId,
      userId,
      flowId,
      stepId,
      executionId,
      codeLength: code.length,
      mode: 'async'
    }, 'Starting asynchronous sandbox execution');

    try {
      const sessionResponse = await this.client.startSession({
        code,
        context: this.buildExecutionContext(context),
        language: this.detectLanguage(code),
        timeout: await this.getAsyncTimeout(),
      });

      this.logger.info({
        orgId,
        userId,
        flowId,
        stepId,
        executionId,
        sessionId: sessionResponse.sessionId,
        mode: 'async'
      }, 'Asynchronous sandbox session started');

      return sessionResponse.sessionId;

    } catch (error) {
      this.logger.error({
        orgId,
        userId,
        flowId,
        stepId,
        executionId,
        error: error instanceof Error ? error.message : 'Unknown error',
        mode: 'async'
      }, 'Failed to start asynchronous sandbox execution');

      throw new InternalServerErrorException(
        `Sandbox async execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error
      );
    }
  }

  /**
   * Get the result of an asynchronous sandbox execution
   * 
   * @param sessionId - The session ID returned from runAsync()
   * @param context - Optional context for logging (recommended)
   * @returns Promise<AsyncSandboxResult> - Current status and result if completed
   */
  async getAsyncResult(
    sessionId: string, 
    context?: Partial<SandboxExecutionContext>
  ): Promise<AsyncSandboxResult> {
    const logContext = context ? {
      orgId: context.orgId,
      userId: context.userId,
      flowId: context.flowId,
      stepId: context.stepId,
      executionId: context.executionId,
    } : {};

    this.logger.debug({
      ...logContext,
      sessionId,
      mode: 'async'
    }, 'Retrieving asynchronous sandbox result');

    try {
      const sessionResult = await this.client.getSessionResult(sessionId);

      const result: AsyncSandboxResult = {
        sessionId: sessionResult.sessionId,
        status: sessionResult.status,
      };

      if (sessionResult.status === 'completed' || sessionResult.status === 'failed') {
        result.result = {
          success: sessionResult.status === 'completed' && !sessionResult.error,
          output: sessionResult.output,
          error: sessionResult.error,
          executionTime: sessionResult.executionTime || 0,
          sessionId: sessionResult.sessionId,
        };

        this.logger.info({
          ...logContext,
          sessionId,
          status: sessionResult.status,
          executionTime: sessionResult.executionTime,
          mode: 'async'
        }, 'Asynchronous sandbox execution completed');
      } else {
        this.logger.debug({
          ...logContext,
          sessionId,
          status: sessionResult.status,
          mode: 'async'
        }, 'Asynchronous sandbox execution still in progress');
      }

      return result;

    } catch (error) {
      this.logger.error({
        ...logContext,
        sessionId,
        error: error instanceof Error ? error.message : 'Unknown error',
        mode: 'async'
      }, 'Failed to retrieve asynchronous sandbox result');

      throw new InternalServerErrorException(
        `Fetching sandbox async result failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error
      );
    }
  }

  /**
   * Cancel an ongoing asynchronous sandbox execution
   * 
   * @param sessionId - The session ID to cancel
   * @param context - Optional context for logging
   */
  async cancelAsyncExecution(
    sessionId: string, 
    context?: Partial<SandboxExecutionContext>
  ): Promise<void> {
    const logContext = context ? {
      orgId: context.orgId,
      userId: context.userId,
      flowId: context.flowId,
      stepId: context.stepId,
      executionId: context.executionId,
    } : {};

    this.logger.warn({
      ...logContext,
      sessionId,
      mode: 'async'
    }, 'Cancelling asynchronous sandbox execution');

    try {
      await this.client.cancelSession(sessionId);

      this.logger.info({
        ...logContext,
        sessionId,
        mode: 'async'
      }, 'Asynchronous sandbox execution cancelled');

    } catch (error) {
      this.logger.error({
        ...logContext,
        sessionId,
        error: error instanceof Error ? error.message : 'Unknown error',
        mode: 'async'
      }, 'Failed to cancel asynchronous sandbox execution');

      throw new InternalServerErrorException(
        `Failed to cancel sandbox execution: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error
      );
    }
  }

  /**
   * Check if the sandbox service is properly configured
   */
  isConfigured(): boolean {
    return !!this.configService.get('DAYTONA_API_KEY');
  }

  /**
   * Get sandbox service health information
   */
  async getHealthInfo(): Promise<{
    configured: boolean;
    apiKeyPresent: boolean;
    baseUrl: string;
    syncTimeout: number;
    asyncTimeout: number;
  }> {
    return {
      configured: this.isConfigured(),
      apiKeyPresent: !!this.configService.get('DAYTONA_API_KEY'),
      baseUrl: this.configService.get('DAYTONA_BASE_URL') || 'https://api.daytona.dev',
      syncTimeout: await this.getSyncTimeout(),
      asyncTimeout: await this.getAsyncTimeout(),
    };
  }

  private validateConfiguration(): void {
    const apiKey = this.configService.get('DAYTONA_API_KEY');
    
    if (!apiKey) {
      this.logger.warn('DAYTONA_API_KEY not configured - sandbox execution will be disabled');
    } else {
      this.logger.info({
        baseUrl: this.configService.get('DAYTONA_BASE_URL') || 'https://api.daytona.dev',
        syncTimeout: this.configService.get('DAYTONA_SYNC_TIMEOUT') || 30000,
        asyncTimeout: this.configService.get('DAYTONA_ASYNC_TIMEOUT') || 300000,
      }, 'Daytona sandbox service configured');
    }
  }

  private buildExecutionContext(context: SandboxExecutionContext): any {
    return {
      // Provide access to flow variables and step outputs
      variables: context.variables || {},
      stepOutputs: context.stepOutputs || {},
      
      // Metadata for the execution
      meta: {
        orgId: context.orgId,
        userId: context.userId,
        flowId: context.flowId,
        stepId: context.stepId,
        executionId: context.executionId,
        timestamp: new Date().toISOString(),
      },
      
      // Utility functions available in sandbox
      utils: {
        log: (message: string, data?: any) => ({ type: 'log', message, data, timestamp: new Date().toISOString() }),
        error: (message: string, data?: any) => ({ type: 'error', message, data, timestamp: new Date().toISOString() }),
        warn: (message: string, data?: any) => ({ type: 'warn', message, data, timestamp: new Date().toISOString() }),
      },
    };
  }

  private detectLanguage(code: string): string {
    // Simple language detection based on code patterns
    if (code.includes('def ') || code.includes('import ') || code.includes('print(')) {
      return 'python';
    }
    if (code.includes('function ') || code.includes('const ') || code.includes('console.log')) {
      return 'javascript';
    }
    if (code.includes('func ') || code.includes('package ') || code.includes('fmt.Print')) {
      return 'go';
    }
    if (code.includes('fn ') || code.includes('let mut ') || code.includes('println!')) {
      return 'rust';
    }
    
    // Default to JavaScript for web-based execution
    return 'javascript';
  }

  private async getSyncTimeout(): Promise<number> {
    try {
      const useAwsSecrets = this.configService.get('USE_AWS_SECRETS') === 'true';
      if (useAwsSecrets && this.awsSecretsService) {
        const timeout = await this.awsSecretsService.getDaytonaSyncTimeout();
        return parseInt(timeout, 10);
      }
    } catch (error) {
      // Fall back to environment variable
    }
    return this.configService.get('DAYTONA_SYNC_TIMEOUT') || 30000;
  }

  private async getAsyncTimeout(): Promise<number> {
    try {
      const useAwsSecrets = this.configService.get('USE_AWS_SECRETS') === 'true';
      if (useAwsSecrets && this.awsSecretsService) {
        const timeout = await this.awsSecretsService.getDaytonaAsyncTimeout();
        return parseInt(timeout, 10);
      }
    } catch (error) {
      // Fall back to environment variable
    }
    return this.configService.get('DAYTONA_ASYNC_TIMEOUT') || 300000;
  }
}