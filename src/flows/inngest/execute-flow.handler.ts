import { Injectable, Optional } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { InngestFunction, InngestService } from 'nestjs-inngest';
import { SandboxExecutionContext, SandboxService } from '../../sandbox/sandbox.service';
import { SecretsResolver } from '../../secrets/secrets-resolver.service';
import { AblyService } from '../../ably/ably.service';
import { InputValidatorService } from '../../common/services/input-validator.service';
import {
  ConditionContext,
  ConditionEvaluatorService,
} from '../../common/services/condition-evaluator.service';
import { PrismaService } from '../../prisma.service';
import { Prisma } from '@prisma/client';
import { ExecutionLogsService } from '../../execution-logs/execution-logs.service';
import {
  AuthInjectionMetricLabels,
  MetricsService,
  StepMetricLabels,
} from '../../metrics/metrics.service';
import { AuthConfigService } from '../../auth/auth-config.service';

// Step Configuration Interfaces
interface SandboxSyncConfig {
  code: string;
  language?: string;
  critical?: boolean;
}

interface SandboxAsyncConfig {
  code: string;
  language?: string;
  waitForCompletion?: boolean;
  pollInterval?: number;
  maxPollAttempts?: number;
  critical?: boolean;
}

interface HttpRequestConfig {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: Record<string, unknown>;
  critical?: boolean;
}

interface DataTransformConfig {
  script: string;
  useSandbox?: boolean;
  critical?: boolean;
}

interface ConditionalConfig {
  condition: string;
  useSandbox?: boolean;
  critical?: boolean;
}

interface DelayConfig {
  delayMs: number;
  critical?: boolean;
}

interface CodeExecutionConfig {
  code: string;
  language?: string;
  mode?: 'sync' | 'async';
  waitForCompletion?: boolean;
  pollInterval?: number;
  maxPollAttempts?: number;
  critical?: boolean;
}

type StepConfigType =
  | SandboxSyncConfig
  | SandboxAsyncConfig
  | HttpRequestConfig
  | DataTransformConfig
  | ConditionalConfig
  | DelayConfig
  | CodeExecutionConfig;

interface RateLimitConfig {
  maxExecutions: number;
  perMilliseconds: number;
}

interface RetryConfig {
  maxAttempts: number;
  backoff: {
    type: 'fixed' | 'exponential';
    delay: number;
  };
}

interface StepThrottlingConfig {
  concurrency?: number;
  rateLimit?: RateLimitConfig;
  retry?: RetryConfig;
}

interface FlowExecutionEventStep {
  id: string;
  type: string;
  name: string;
  config: StepConfigType;
  dependsOn?: string[];
  executeIf?: string | Record<string, unknown>;
}

interface FlowExecutionEventData {
  orgId: string;
  userId: string;
  flowId: string;
  executionId: string;
  steps: FlowExecutionEventStep[];
  variables: Record<string, unknown>;
}

export interface FlowExecutionEvent {
  data: FlowExecutionEventData;
}

interface StepExecutionError {
  message: string;
  code?: string;
  stack?: string;
}

interface StepExecutionMetadata {
  duration: number;
  skipReason?: string;
  stepType?: string;
  stepId?: string;
  timestamp?: string;
  executionTime?: number;
  sandboxMode?: string;
  sessionId?: string;
  pollAttempts?: number;
  executionMode?: string;
  [key: string]: unknown;
}

interface StepExecutionResult {
  success: boolean;
  skipped?: boolean;
  output?: Record<string, unknown>;
  error?: StepExecutionError;
  metadata?: StepExecutionMetadata;
}

interface HandlerEvent {
  data: FlowExecutionEventData;
}

interface InngestStep {
  run<T>(name: string, fn: () => Promise<T>): Promise<T>;
}

interface HandlerParams {
  event: HandlerEvent;
  step: InngestStep;
}

interface FlowStepConfig {
  id: string;
  type: string;
  name: string;
  config: StepConfigType;
  dependsOn?: string[];
  executeIf?: string | Record<string, unknown>;
}

interface ExecutionContext {
  orgId: string;
  userId: string;
  flowId: string;
  executionId: string;
  variables: Record<string, unknown>;
  stepOutputs: Record<string, unknown>;
  authHeaders?: Record<string, string>;
}

interface WebhookDispatchPayload {
  orgId: string;
  executionId: string;
  [key: string]: unknown;
}

/**
 * Durable Flow Execution Handler
 *
 * Processes multi-step workflows with durability, retry logic, and real-time updates.
 * Each step is wrapped in step.run() for automatic retry and progress tracking.
 */
@Injectable()
export class ExecuteFlowHandler {
  constructor(
    @Optional() private readonly sandboxService: SandboxService,
    private readonly _secretsResolver: SecretsResolver, // Reserved for future secret resolution
    private readonly ablyService: AblyService,
    private readonly _inputValidator: InputValidatorService, // Reserved for future input validation
    private readonly conditionEvaluator: ConditionEvaluatorService,
    private readonly prisma: PrismaService,
    private readonly _executionLogsService: ExecutionLogsService, // Reserved for future execution logging
    private readonly metricsService: MetricsService,
    private readonly authConfig: AuthConfigService,
    @Optional() private readonly inngestService: InngestService,
    @InjectPinoLogger(ExecuteFlowHandler.name)
    private readonly logger: PinoLogger,
  ) {}

  @InngestFunction({
    id: 'execute-flow',
    name: 'Execute Tolstoy Flow',
    triggers: [{ event: 'flow.execute' }],
    concurrency: {
      limit: 10,
    },
    retries: 3,
  })
  async handler({ event, step }: HandlerParams): Promise<unknown> {
    const { orgId, userId, flowId, executionId, steps, variables } = event.data;

    this.logger.info(
      {
        orgId,
        userId,
        flowId,
        executionId,
        stepCount: steps.length,
        throttlingEnabled: true,
        globalDefaults: {
          concurrency: 10,
          rateLimit: '100/min',
          retry: 'exponential-3x',
        },
      },
      'Starting durable flow execution with throttling',
    );

    // Update execution log to running status
    await step.run('update-execution-status', async () => {
      await this.prisma.executionLog.update({
        where: { id: executionId },
        data: { status: 'running' },
      });

      // Publish execution started event
      await this.ablyService.publishExecutionEvent({
        executionId,
        status: 'started',
        timestamp: new Date().toISOString(),
        orgId,
        flowId,
        totalSteps: steps.length,
      });

      return { status: 'execution_started' };
    });

    const stepOutputs: Record<string, unknown> = {};
    let completedSteps = 0;
    let failedSteps = 0;
    let executionError: StepExecutionError | undefined = undefined;

    // Execute each step durably
    for (const flowStep of steps) {
      try {
        const stepStartTime = Date.now();
        let retryCount = 0;

        const stepResult = await step.run(`execute-step-${flowStep.id}`, async () => {
          retryCount++;

          // Prepare metrics labels
          const metricLabels: StepMetricLabels = {
            orgId,
            flowId,
            stepKey: flowStep.id,
          };

          // Log retry attempts and increment retry metrics
          if (retryCount > 1) {
            this.metricsService.incrementStepRetries(metricLabels);

            this.logger.info(
              {
                stepId: flowStep.id,
                stepType: flowStep.type,
                executionId,
                retryAttempt: retryCount - 1,
                totalRetriesAllowed: this.getStepConfiguration(flowStep).retry?.maxAttempts || 3,
              },
              'Step retry attempt due to throttling or failure',
            );
          }

          return this.executeStep(flowStep, {
            orgId,
            userId,
            flowId,
            executionId,
            variables,
            stepOutputs,
          });
        });

        const stepEndTime = Date.now();
        const stepTotalTime = stepEndTime - stepStartTime;

        if (stepResult.skipped) {
          // Handle skipped steps
          this.logger.info(
            {
              stepId: flowStep.id,
              stepType: flowStep.type,
              executionId,
              duration: stepResult.metadata?.duration,
              skipReason: stepResult.metadata?.skipReason,
            },
            'Step skipped in durable workflow',
          );

          // Publish step skipped event
          await step.run(`publish-step-skipped-${flowStep.id}`, async () => {
            await this.ablyService.publishStepEvent({
              stepId: flowStep.id,
              status: 'skipped',
              timestamp: new Date().toISOString(),
              executionId,
              orgId,
              flowId,
              stepName: flowStep.name,
              duration: stepResult.metadata?.duration,
              metadata: {
                skipReason: stepResult.metadata?.skipReason,
                executeIf: flowStep.executeIf,
              },
            });
          });

          // Skipped steps don't contribute output but don't fail the flow
          continue;
        } else if (stepResult.success) {
          stepOutputs[flowStep.id] = stepResult.output;
          completedSteps++;

          // Publish step completed event
          await step.run(`publish-step-completed-${flowStep.id}`, async () => {
            await this.ablyService.publishStepEvent({
              stepId: flowStep.id,
              status: 'completed',
              timestamp: new Date().toISOString(),
              executionId,
              orgId,
              flowId,
              stepName: flowStep.name,
              output: stepResult.output,
              duration: stepResult.metadata?.duration,
            });
          });

          // Calculate potential throttling overhead (time spent waiting vs actual execution)
          const actualExecutionTime = stepResult.metadata?.duration || 0;
          const throttlingOverhead = stepTotalTime - actualExecutionTime;
          const stepConfig = this.getStepConfiguration(flowStep);

          this.logger.info(
            {
              stepId: flowStep.id,
              stepType: flowStep.type,
              executionId,
              duration: stepResult.metadata?.duration,
              totalStepTime: stepTotalTime,
              throttlingOverhead,
              retryCount: retryCount - 1, // Subtract 1 since first attempt isn't a retry
              throttlingConfig: {
                concurrency: stepConfig.concurrency,
                rateLimit: stepConfig.rateLimit
                  ? `${stepConfig.rateLimit.maxExecutions}/${stepConfig.rateLimit.perMilliseconds}ms`
                  : 'global',
                maxRetries: stepConfig.retry?.maxAttempts || 'global',
              },
            },
            'Step completed successfully with throttling metrics',
          );
        } else {
          failedSteps++;
          executionError = stepResult.error;

          // Publish step failed event
          await step.run(`publish-step-failed-${flowStep.id}`, async () => {
            await this.ablyService.publishStepEvent({
              stepId: flowStep.id,
              status: 'failed',
              timestamp: new Date().toISOString(),
              executionId,
              orgId,
              flowId,
              stepName: flowStep.name,
              error: stepResult.error,
              duration: stepResult.metadata?.duration,
            });
          });

          // Calculate throttling metrics for failed steps too
          const actualExecutionTime = stepResult.metadata?.duration || 0;
          const throttlingOverhead = stepTotalTime - actualExecutionTime;
          const stepConfig = this.getStepConfiguration(flowStep);

          this.logger.error(
            {
              stepId: flowStep.id,
              stepType: flowStep.type,
              executionId,
              error: stepResult.error,
              totalStepTime: stepTotalTime,
              throttlingOverhead,
              retryCount: retryCount - 1,
              throttlingConfig: {
                concurrency: stepConfig.concurrency,
                rateLimit: stepConfig.rateLimit
                  ? `${stepConfig.rateLimit.maxExecutions}/${stepConfig.rateLimit.perMilliseconds}ms`
                  : 'global',
                maxRetries: stepConfig.retry?.maxAttempts || 'global',
              },
              finalRetryExhausted: retryCount > (stepConfig.retry?.maxAttempts || 3),
            },
            'Step failed with throttling metrics',
          );

          // Check if step is critical
          if (this.isStepCritical(flowStep)) {
            this.logger.warn(
              {
                stepId: flowStep.id,
                executionId,
              },
              'Critical step failed, stopping execution',
            );
            break;
          }
        }
      } catch (error) {
        failedSteps++;
        executionError = {
          message: error instanceof Error ? error.message : 'Unknown error',
          code:
            error instanceof Error && 'code' in error && typeof error.code === 'string'
              ? error.code
              : 'STEP_EXECUTION_ERROR',
        };

        this.logger.error(
          {
            stepId: flowStep.id,
            executionId,
            error: error instanceof Error ? error.message : 'Unknown error',
          },
          'Unexpected error during step execution',
        );

        if (this.isStepCritical(flowStep)) {
          break;
        }
      }
    }

    // Determine final execution status
    const executionStatus = failedSteps > 0 && executionError ? 'failed' : 'completed';

    // Update final execution status
    await step.run('finalize-execution', async () => {
      await this.prisma.executionLog.update({
        where: { id: executionId },
        data: {
          status: executionStatus,
          outputs: stepOutputs as unknown as Prisma.InputJsonValue,
        },
      });

      // Publish execution completed event
      await this.ablyService.publishExecutionEvent({
        executionId,
        status: executionStatus,
        timestamp: new Date().toISOString(),
        orgId,
        flowId,
        totalSteps: steps.length,
        completedSteps,
        failedSteps,
        output: stepOutputs,
        error: executionError,
      });

      return {
        status: 'execution_completed',
        finalStatus: executionStatus,
      };
    });

    // Calculate overall flow metrics with throttling insights

    this.logger.info(
      {
        orgId,
        flowId,
        executionId,
        status: executionStatus,
        completedSteps,
        failedSteps,
        totalSteps: steps.length,
        throttlingInsights: {
          globalDefaults: {
            concurrency: 10,
            rateLimit: '100/60000ms',
            retry: 'exponential-3x',
          },
          stepTypeDistribution: this.getStepTypeDistribution(steps),
          averageThrottlingOverhead: 'calculated-per-step', // Individual steps logged above
          totalRetries: 'summed-across-steps', // Individual retries logged above
        },
      },
      `Flow execution ${executionStatus} with throttling analytics`,
    );

    return {
      executionId,
      status: executionStatus,
      completedSteps,
      failedSteps,
      totalSteps: steps.length,
      stepOutputs,
      error: executionError,
    };
  }

  /**
   * Build authentication headers for a step based on the tool configuration
   */
  private async buildAuthHeaders(
    step: FlowStepConfig,
    context: ExecutionContext,
  ): Promise<Record<string, string>> {
    try {
      // For steps that don't require external API calls, return empty headers
      const stepTypesRequiringAuth = ['http_request', 'oauth_api_call'];
      if (!stepTypesRequiringAuth.includes(step.type)) {
        return {};
      }

      // Extract tool name from step config or context
      // For http_request steps, we need to determine the tool from the URL or step metadata
      let toolName: string | undefined;

      // Check if step config has tool information
      const stepConfig = step.config as any;
      if (stepConfig?.toolName) {
        toolName = stepConfig.toolName as string;
      } else if (stepConfig?.url) {
        // Try to infer tool name from URL domain if available
        try {
          const url = new URL(typeof stepConfig.url === 'string' ? stepConfig.url : '');
          const domain = url.hostname.toLowerCase();

          // Map common domains to tool names
          const domainToolMap: Record<string, string> = {
            'api.slack.com': 'Slack',
            'api.github.com': 'GitHub',
            'api.notion.com': 'Notion',
            'api.linear.app': 'Linear',
            'hooks.slack.com': 'Slack',
            'discord.com': 'Discord',
            'api.discord.com': 'Discord',
          };

          toolName = domainToolMap[domain];
        } catch (error) {
          this.logger.debug(
            {
              stepId: step.id,
              url: stepConfig.url,
              error: error instanceof Error ? error.message : 'Unknown error',
            },
            'Failed to parse URL for tool name inference',
          );
        }
      }

      if (!toolName) {
        this.logger.debug(
          {
            stepId: step.id,
            stepType: step.type,
          },
          'No tool name found for step, skipping auth header injection',
        );
        return {};
      }

      // Get organization auth configuration for the tool
      const orgAuth = await this.authConfig.getOrgAuthConfig(context.orgId, toolName);
      const authHeaders: Record<string, string> = {};

      if (orgAuth) {
        // Handle API Key authentication
        if (orgAuth.type === 'apiKey' && orgAuth.config) {
          const config = orgAuth.config;
          if (config.headerName && config.headerValue) {
            authHeaders[config.headerName as string] = config.headerValue as string;
          } else if (config.apiKey) {
            // Default to Authorization header if no specific header name is configured
            authHeaders['Authorization'] = `Bearer ${config.apiKey}`;
          }
        } else if (orgAuth.type === 'oauth2' && context.userId) {
          // Handle OAuth2 authentication (requires user context)
          try {
            const userCredentials = await this.authConfig.getUserCredentials(
              context.orgId,
              context.userId,
              toolName,
            );

            if (userCredentials?.accessToken) {
              authHeaders['Authorization'] = `Bearer ${userCredentials.accessToken}`;
            }
          } catch (error) {
            this.logger.warn(
              {
                stepId: step.id,
                orgId: context.orgId,
                userId: context.userId,
                toolName,
                error: error instanceof Error ? error.message : 'Unknown error',
              },
              'Failed to retrieve user credentials for OAuth2 authentication',
            );
          }
        }
      }

      this.logger.debug(
        {
          stepId: step.id,
          stepType: step.type,
          toolName,
          authType: orgAuth?.type,
          hasAuthHeaders: Object.keys(authHeaders).length > 0,
          headerNames: Object.keys(authHeaders),
        },
        'Built authentication headers for step',
      );

      // Record metrics for auth injection
      const authType = orgAuth?.type || 'none';
      const metricsLabels: AuthInjectionMetricLabels = {
        orgId: context.orgId,
        stepId: step.id,
        stepType: step.type,
        toolName: toolName || 'unknown',
        authType,
      };
      this.metricsService.incrementAuthInjection(metricsLabels);

      return authHeaders;
    } catch (error) {
      this.logger.error(
        {
          stepId: step.id,
          stepType: step.type,
          orgId: context.orgId,
          userId: context.userId,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        'Failed to build authentication headers for step',
      );
      return {};
    }
  }

  /**
   * Execute a single flow step with proper context and error handling
   */
  private async executeStep(
    step: FlowStepConfig,
    context: ExecutionContext,
  ): Promise<StepExecutionResult> {
    const startTime = Date.now();

    // Prepare metrics labels
    const metricLabels: StepMetricLabels = {
      orgId: context.orgId,
      flowId: context.flowId,
      stepKey: step.id,
    };

    // Start metrics timer
    const endTimer = this.metricsService.startStepTimer(metricLabels);

    // Build authentication headers for this step
    const authHeaders = await this.buildAuthHeaders(step, context);

    // Add auth headers to context for this step execution
    const contextWithAuth: ExecutionContext = {
      ...context,
      authHeaders,
    };

    // Check executeIf condition before executing the step
    if (step.executeIf) {
      try {
        const conditionContext: ConditionContext = {
          inputs: contextWithAuth.variables,
          variables: contextWithAuth.variables,
          stepOutputs: contextWithAuth.stepOutputs,
          currentStep: step as unknown as Record<string, unknown>,
          orgId: contextWithAuth.orgId,
          userId: contextWithAuth.userId,
          meta: {
            flowId: contextWithAuth.flowId,
            executionId: contextWithAuth.executionId,
            stepId: step.id,
          },
        };

        const shouldExecute = this.conditionEvaluator.evaluate(step.executeIf, conditionContext);

        if (!shouldExecute) {
          const duration = Date.now() - startTime;
          const skipReason = 'executeIf condition evaluated to false';

          // End metrics timer for skipped step
          endTimer();

          this.logger.info(
            {
              stepId: step.id,
              stepType: step.type,
              flowId: contextWithAuth.flowId,
              executionId: contextWithAuth.executionId,
              executeIf: step.executeIf,
              skipReason,
            },
            'Step skipped due to executeIf condition in durable workflow',
          );

          return {
            success: true,
            skipped: true,
            metadata: {
              duration,
              skipReason,
              stepType: step.type,
              stepId: step.id,
              timestamp: new Date().toISOString(),
            },
          };
        }
      } catch (error) {
        this.logger.error(
          {
            stepId: step.id,
            stepType: step.type,
            flowId: contextWithAuth.flowId,
            executionId: contextWithAuth.executionId,
            executeIf: step.executeIf,
            error: error instanceof Error ? error.message : 'Unknown error',
          },
          'Failed to evaluate executeIf condition in durable workflow, proceeding with step execution',
        );

        // If condition evaluation fails, proceed with step execution to be safe
      }
    }

    try {
      let result: StepExecutionResult;

      switch (step.type) {
        case 'sandbox_sync':
          result = await this.executeSandboxSync(step, contextWithAuth);
          break;

        case 'sandbox_async':
          result = await this.executeSandboxAsync(step, contextWithAuth);
          break;

        case 'code_execution':
          result = await this.executeCodeExecution(step, contextWithAuth);
          break;

        case 'data_transform':
          result = await this.executeDataTransform(step, contextWithAuth);
          break;

        case 'conditional':
          result = await this.executeConditional(step, contextWithAuth);
          break;

        case 'http_request':
          result = await this.executeHttpRequest(step, contextWithAuth);
          break;

        case 'delay':
          result = await this.executeDelay(step, contextWithAuth);
          break;

        default:
          result = {
            success: false,
            error: {
              message: `Unknown step type: ${step.type}`,
              code: 'UNKNOWN_STEP_TYPE',
            },
          };
      }

      const duration = Date.now() - startTime;

      // End metrics timer and record error if step failed
      endTimer();
      if (!result.success) {
        this.metricsService.incrementStepErrors(metricLabels);
      }

      return {
        ...result,
        metadata: {
          ...result.metadata,
          duration,
        },
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      // End metrics timer and record error for exception case
      endTimer();
      this.metricsService.incrementStepErrors(metricLabels);

      return {
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          code:
            error instanceof Error && 'code' in error && typeof error.code === 'string'
              ? error.code
              : 'STEP_EXECUTION_ERROR',
          stack: error instanceof Error ? error.stack : 'No stack trace',
        },
        metadata: { duration },
      };
    }
  }

  private async executeSandboxSync(
    step: FlowStepConfig,
    context: ExecutionContext,
  ): Promise<StepExecutionResult> {
    const config = step.config as SandboxSyncConfig;
    const { code, language } = config;

    if (!code) {
      return {
        success: false,
        error: {
          message: 'Code is required for sandbox_sync step',
          code: 'MISSING_CODE',
        },
      };
    }

    if (!this.sandboxService) {
      return {
        success: false,
        error: {
          message: 'SandboxService is not available',
          code: 'SANDBOX_UNAVAILABLE',
        },
      };
    }

    const sandboxContext: SandboxExecutionContext = {
      orgId: context.orgId,
      userId: context.userId,
      flowId: context.flowId,
      stepId: step.id,
      executionId: context.executionId,
      variables: context.variables,
      stepOutputs: context.stepOutputs,
      authHeaders: context.authHeaders,
    };

    const result = await this.sandboxService.runSync(code, sandboxContext);

    return {
      success: result.success,
      output: result.output as Record<string, unknown>,
      error: result.error,
      metadata: {
        duration: result.executionTime || 0,
        executionTime: result.executionTime,
        sandboxMode: 'sync',
        language: language || 'javascript',
      },
    };
  }

  private async executeSandboxAsync(
    step: FlowStepConfig,
    context: ExecutionContext,
  ): Promise<StepExecutionResult> {
    const config = step.config as SandboxAsyncConfig;
    const { code, waitForCompletion = false, pollInterval = 1000, maxPollAttempts = 300 } = config;

    if (!code) {
      return {
        success: false,
        error: {
          message: 'Code is required for sandbox_async step',
          code: 'MISSING_CODE',
        },
      };
    }

    if (!this.sandboxService) {
      return {
        success: false,
        error: {
          message: 'SandboxService is not available',
          code: 'SANDBOX_UNAVAILABLE',
        },
      };
    }

    const sandboxContext: SandboxExecutionContext = {
      orgId: context.orgId,
      userId: context.userId,
      flowId: context.flowId,
      stepId: step.id,
      executionId: context.executionId,
      variables: context.variables,
      stepOutputs: context.stepOutputs,
      authHeaders: context.authHeaders,
    };

    const sessionId = await this.sandboxService.runAsync(code, sandboxContext);

    if (!waitForCompletion) {
      return {
        success: true,
        output: {
          sessionId,
          message: 'Async execution started - use getAsyncResult to retrieve results',
        },
        metadata: {
          duration: 0,
          sandboxMode: 'async',
          sessionId,
        },
      };
    }

    // Poll for completion
    let attempts = 0;
    while (attempts < maxPollAttempts) {
      await new Promise(resolve => setTimeout(resolve, pollInterval));
      attempts++;

      const asyncResult = await this.sandboxService.getAsyncResult(sessionId, sandboxContext);

      if (asyncResult.status === 'completed' || asyncResult.status === 'failed') {
        const result = asyncResult.result;
        return {
          success: result?.success || false,
          output: result?.output as Record<string, unknown>,
          error: result?.error,
          metadata: {
            duration: result?.executionTime || 0,
            executionTime: result?.executionTime,
            sandboxMode: 'async',
            sessionId: asyncResult.sessionId,
            pollAttempts: attempts,
          },
        };
      }
    }

    // Timeout
    return {
      success: false,
      output: { sessionId },
      error: {
        message: `Async execution timed out after ${maxPollAttempts} attempts`,
        code: 'SANDBOX_ASYNC_TIMEOUT',
      },
      metadata: {
        duration: maxPollAttempts * pollInterval,
        sandboxMode: 'async',
        sessionId,
        pollAttempts: attempts,
      },
    };
  }

  private async executeCodeExecution(
    step: FlowStepConfig,
    context: ExecutionContext,
  ): Promise<StepExecutionResult> {
    const config = step.config as CodeExecutionConfig;
    const { mode = 'sync' } = config;

    if (mode === 'async') {
      return this.executeSandboxAsync(step, context);
    } else {
      return this.executeSandboxSync(step, context);
    }
  }

  private async executeDataTransform(
    step: FlowStepConfig,
    context: ExecutionContext,
  ): Promise<StepExecutionResult> {
    const config = step.config as DataTransformConfig;
    const { script, useSandbox = true } = config;

    if (useSandbox && this.sandboxService && this.sandboxService.isConfigured()) {
      const sandboxCode = `
        const input = context.stepOutputs;
        const flowContext = context;
        
        ${script}
      `;

      const sandboxContext: SandboxExecutionContext = {
        orgId: context.orgId,
        userId: context.userId,
        flowId: context.flowId,
        stepId: step.id,
        executionId: context.executionId,
        variables: context.variables,
        stepOutputs: context.stepOutputs,
        authHeaders: context.authHeaders,
      };

      const result = await this.sandboxService.runSync(sandboxCode, sandboxContext);

      return {
        success: result.success,
        output: result.output as Record<string, unknown>,
        error: result.error,
        metadata: {
          duration: result.executionTime || 0,
          executionTime: result.executionTime,
          sandboxMode: 'sync',
          stepType: 'data_transform',
        },
      };
    } else {
      // Fallback to direct execution
      try {
        const transformFunction = new Function('input', 'context', script);
        const result = transformFunction(context.stepOutputs, context);

        return {
          success: true,
          output: result,
          metadata: {
            duration: 0,
            executionMode: 'direct',
          },
        };
      } catch (error) {
        return {
          success: false,
          error: {
            message: `Data transform failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            code: 'TRANSFORM_ERROR',
          },
        };
      }
    }
  }

  private async executeConditional(
    step: FlowStepConfig,
    context: ExecutionContext,
  ): Promise<StepExecutionResult> {
    const config = step.config as ConditionalConfig;
    const { condition, useSandbox = true } = config;

    if (useSandbox && this.sandboxService && this.sandboxService.isConfigured()) {
      const sandboxCode = `
        const context = arguments[0];
        return ${condition};
      `;

      const sandboxContext: SandboxExecutionContext = {
        orgId: context.orgId,
        userId: context.userId,
        flowId: context.flowId,
        stepId: step.id,
        executionId: context.executionId,
        variables: context.variables,
        stepOutputs: context.stepOutputs,
        authHeaders: context.authHeaders,
      };

      const result = await this.sandboxService.runSync(sandboxCode, sandboxContext);

      return {
        success: result.success,
        output: { conditionResult: result.output },
        error: result.error,
        metadata: {
          duration: result.executionTime || 0,
          executionTime: result.executionTime,
          sandboxMode: 'sync',
          stepType: 'conditional',
        },
      };
    } else {
      // Fallback to direct execution
      try {
        const conditionFunction = new Function('context', `return ${condition}`);
        const result = conditionFunction(context);

        return {
          success: true,
          output: { conditionResult: result },
          metadata: {
            duration: 0,
            executionMode: 'direct',
          },
        };
      } catch (error) {
        return {
          success: false,
          error: {
            message: `Condition evaluation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            code: 'CONDITION_ERROR',
          },
        };
      }
    }
  }

  private async executeHttpRequest(
    step: FlowStepConfig,
    context: ExecutionContext,
  ): Promise<StepExecutionResult> {
    const config = step.config as HttpRequestConfig;
    const { url, method = 'GET', headers = {}, body } = config;

    try {
      // Merge authentication headers with existing headers
      const requestHeaders = {
        'Content-Type': 'application/json',
        ...headers,
        ...(context.authHeaders || {}),
      };

      this.logger.debug(
        {
          stepId: step.id,
          method,
          url,
          hasAuthHeaders: Object.keys(context.authHeaders || {}).length > 0,
          authHeaderNames: Object.keys(context.authHeaders || {}),
        },
        'Executing HTTP request with authentication headers',
      );

      const response = await fetch(url, {
        method,
        headers: requestHeaders,
        body: body ? JSON.stringify(body) : undefined,
      });

      const responseData = await response.text();
      let parsedData;

      try {
        parsedData = JSON.parse(responseData);
      } catch {
        parsedData = responseData;
      }

      return {
        success: response.ok,
        output: {
          status: response.status,
          statusText: response.statusText,
          data: parsedData,
          headers: Object.fromEntries(response.headers as unknown as Iterable<[string, string]>),
        },
        error: response.ok
          ? undefined
          : {
              message: `HTTP ${response.status}: ${response.statusText}`,
              code: 'HTTP_ERROR',
            },
      };
    } catch (error) {
      return {
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          code: 'NETWORK_ERROR',
        },
      };
    }
  }

  private async executeDelay(
    step: FlowStepConfig,
    _context: ExecutionContext,
  ): Promise<StepExecutionResult> {
    const config = step.config as DelayConfig;
    const { delayMs } = config;

    await new Promise(resolve => setTimeout(resolve, delayMs));

    return {
      success: true,
      output: { delayedFor: delayMs },
    };
  }

  /**
   * Get step-specific configuration for throttling and retry behavior
   * Different step types have different resource requirements and failure tolerance
   */
  private getStepConfiguration(step: FlowStepConfig): StepThrottlingConfig {
    const stepType = step.type;
    const isCritical = this.isStepCritical(step);

    // Log configuration selection for monitoring
    this.logger.debug(
      {
        stepId: step.id,
        stepType,
        isCritical,
      },
      'Determining step configuration for throttling',
    );

    switch (stepType) {
      case 'http_request':
      case 'oauth_api_call':
        // External API calls: strict rate limiting to respect API limits
        return {
          concurrency: isCritical ? 2 : 5, // Lower concurrency for critical API calls
          rateLimit: {
            maxExecutions: 10,
            perMilliseconds: 10_000, // 10 requests per 10 seconds
          },
          retry: {
            maxAttempts: isCritical ? 5 : 3,
            backoff: {
              type: 'exponential',
              delay: 3000, // Start with 3s for API calls
            },
          },
        };

      case 'sandbox_sync':
      case 'sandbox_async':
      case 'code_execution':
        // Compute-heavy operations: moderate concurrency, longer delays
        return {
          concurrency: 3,
          rateLimit: {
            maxExecutions: 20,
            perMilliseconds: 30_000, // 20 executions per 30 seconds
          },
          retry: {
            maxAttempts: 2, // Code execution failures often require investigation
            backoff: {
              type: 'fixed',
              delay: 5000, // Fixed 5s delay for compute operations
            },
          },
        };

      case 'data_transform':
      case 'conditional':
        // Lightweight operations: higher concurrency, faster retry
        return {
          concurrency: 15,
          rateLimit: {
            maxExecutions: 50,
            perMilliseconds: 30_000, // 50 transforms per 30 seconds
          },
          retry: {
            maxAttempts: 2,
            backoff: {
              type: 'fixed',
              delay: 1000, // Quick 1s retry for lightweight ops
            },
          },
        };

      case 'delay':
        // Delay steps: no throttling needed, just inherit defaults
        return {};

      default:
        // Unknown step types: use conservative settings
        this.logger.warn(
          {
            stepId: step.id,
            stepType,
          },
          'Unknown step type, using conservative throttling configuration',
        );

        return {
          concurrency: 2,
          rateLimit: {
            maxExecutions: 5,
            perMilliseconds: 30_000, // Very conservative: 5 per 30 seconds
          },
          retry: {
            maxAttempts: 1, // Single retry for unknown types
            backoff: {
              type: 'fixed',
              delay: 5000,
            },
          },
        };
    }
  }

  /**
   * Get configuration for event publishing steps
   * Event publishing should be fast and reliable but not block execution
   */
  private _getEventPublishingConfiguration(): StepThrottlingConfig {
    // Reserved for future event publishing optimization
    return {
      concurrency: 20, // Higher concurrency for event publishing
      rateLimit: {
        maxExecutions: 200,
        perMilliseconds: 60_000, // 200 events per minute - generous for real-time updates
      },
      retry: {
        maxAttempts: 2, // Quick retry for event publishing failures
        backoff: {
          type: 'fixed',
          delay: 500, // Fast retry - 500ms
        },
      },
    };
  }

  /**
   * Calculate step type distribution for throttling analytics
   */
  private getStepTypeDistribution(steps: FlowStepConfig[]): Record<string, number> {
    return steps.reduce(
      (acc, step) => {
        acc[step.type] = (acc[step.type] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );
  }

  private isStepCritical(step: FlowStepConfig): boolean {
    const config = step.config as { critical?: boolean };
    return config.critical !== false;
  }

  private async _dispatchWebhook(
    eventType: string,
    payload: WebhookDispatchPayload,
  ): Promise<void> {
    // Reserved for future webhook dispatching
    if (!this.inngestService) {
      this.logger.debug('InngestService not available, skipping webhook dispatch');
      return;
    }

    try {
      await this.inngestService.send({
        name: 'webhook.dispatch',
        data: {
          orgId: payload.orgId,
          eventType,
          payload,
        },
      });

      this.logger.debug(
        {
          eventType,
          orgId: payload.orgId,
          executionId: payload.executionId,
        },
        'Webhook dispatch event queued',
      );
    } catch (error) {
      this.logger.error(
        {
          eventType,
          orgId: payload.orgId,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        'Failed to queue webhook dispatch event',
      );
      // Don't throw error - webhook dispatch failure shouldn't fail the flow
    }
  }
}
