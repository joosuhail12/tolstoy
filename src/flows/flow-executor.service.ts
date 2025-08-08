import { Injectable, Optional } from '@nestjs/common';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';
import { Flow, ExecutionLog, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { AblyService } from '../ably/ably.service';
import { TenantContext } from '../common/interfaces/tenant-context.interface';
import { SecretsResolver } from '../secrets/secrets-resolver.service';
import { OAuthTokenService } from '../oauth/oauth-token.service';
import { InputValidatorService } from '../common/services/input-validator.service';
import {
  ConditionEvaluatorService,
  ConditionContext,
} from '../common/services/condition-evaluator.service';
import { SandboxService, SandboxExecutionContext } from '../sandbox/sandbox.service';
import { InngestService } from 'nestjs-inngest';
import { ExecutionLogsService } from '../execution-logs/execution-logs.service';

export interface FlowStepConfig {
  [key: string]: unknown;
}

export interface FlowStepCondition {
  [key: string]: unknown;
}

export interface FlowVariables {
  [key: string]: unknown;
}

export interface StepOutputs {
  [key: string]: unknown;
}

export interface StepOutput {
  [key: string]: unknown;
}

export interface FlowStep {
  id: string;
  type: string;
  name: string;
  config: FlowStepConfig;
  executeIf?: string | FlowStepCondition;
  dependsOn?: string[];
  retryPolicy?: {
    maxRetries: number;
    backoffStrategy: 'fixed' | 'exponential';
    delayMs: number;
  };
}

export interface FlowExecutionContext {
  executionId: string;
  flowId: string;
  orgId: string;
  userId: string;
  startTime: Date;
  variables: FlowVariables;
  stepOutputs: StepOutputs;
}

export interface StepExecutionError {
  message: string;
  code?: string;
  stack?: string;
}

export interface StepExecutionMetadata {
  duration: number;
  retryAttempt?: number;
  skipReason?: string;
  [key: string]: unknown;
}

export interface StepExecutionResult {
  success: boolean;
  skipped?: boolean;
  output?: StepOutput;
  error?: StepExecutionError;
  metadata?: StepExecutionMetadata;
}

@Injectable()
export class FlowExecutorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ablyService: AblyService,
    private readonly secretsResolver: SecretsResolver,
    private readonly oauthService: OAuthTokenService,
    private readonly inputValidator: InputValidatorService,
    private readonly conditionEvaluator: ConditionEvaluatorService,
    private readonly sandboxService: SandboxService,
    private readonly executionLogsService: ExecutionLogsService,
    @Optional() private readonly inngestService: InngestService,
    @InjectPinoLogger(FlowExecutorService.name)
    private readonly logger: PinoLogger,
  ) {}

  async executeFlow(
    flowId: string,
    tenant: TenantContext,
    inputVariables: FlowVariables = {},
  ): Promise<ExecutionLog> {
    const startTime = new Date();
    const executionId = this.generateExecutionId();

    this.logger.info(
      { flowId, executionId, orgId: tenant.orgId, userId: tenant.userId },
      'Starting flow execution',
    );

    const flow = await this.prisma.flow.findUnique({
      where: { id: flowId, orgId: tenant.orgId },
    });

    if (!flow) {
      throw new Error(`Flow ${flowId} not found or access denied`);
    }

    const executionContext: FlowExecutionContext = {
      executionId,
      flowId,
      orgId: tenant.orgId,
      userId: tenant.userId,
      startTime,
      variables: inputVariables,
      stepOutputs: {},
    };

    const steps = this.parseFlowSteps(flow.steps);

    await this.publishExecutionStarted(executionContext, flow, steps.length);

    const executionLog = await this.createExecutionLog(
      executionId,
      flowId,
      tenant,
      'running',
      inputVariables,
    );

    let executionStatus: 'completed' | 'failed' | 'cancelled' = 'completed';
    let executionError: { message: string; code?: string } | undefined;
    let completedSteps = 0;
    let failedSteps = 0;
    let skippedSteps = 0;

    try {
      for (const step of steps) {
        try {
          const stepResult = await this.executeStep(step, executionContext);

          if (stepResult.skipped) {
            skippedSteps++;
            this.logger.info(
              {
                stepId: step.id,
                stepType: step.type,
                flowId: flowId,
                executionId: executionId,
                skipReason: stepResult.metadata?.skipReason,
              },
              'Step skipped due to executeIf condition',
            );
            // Skipped steps don't contribute output but don't fail the flow
            continue;
          }

          if (stepResult.success) {
            completedSteps++;
            executionContext.stepOutputs[step.id] = stepResult.output;
          } else {
            failedSteps++;

            if (this.isStepCritical(step)) {
              executionStatus = 'failed';
              executionError = stepResult.error || { message: 'Step execution failed' };
              break;
            } else {
              this.logger.warn(
                { stepId: step.id, stepType: step.type, flowId: flowId, executionId: executionId },
                'Non-critical step failed, continuing execution',
              );
            }
          }
        } catch (error) {
          failedSteps++;
          this.logger.error(
            {
              stepId: step.id,
              stepType: step.type,
              flowId: flowId,
              executionId: executionId,
              error: error instanceof Error ? error.message : 'Unknown error',
            },
            'Unexpected error in step execution',
          );

          if (this.isStepCritical(step)) {
            executionStatus = 'failed';
            executionError = {
              message: error instanceof Error ? error.message : 'Unknown error',
              code:
                error instanceof Error && (error as any).code
                  ? (error as any).code
                  : 'EXECUTION_ERROR',
            };
            break;
          }
        }
      }

      const duration = Date.now() - startTime.getTime();

      await this.publishExecutionCompleted(executionContext, flow, executionStatus, {
        totalSteps: steps.length,
        completedSteps,
        failedSteps,
        skippedSteps,
        duration,
        output: executionContext.stepOutputs,
        error: executionError,
      });

      const updatedLog = await this.updateExecutionLog(
        executionLog.id,
        executionStatus,
        executionContext.stepOutputs,
        executionError?.message,
      );

      this.logger.info(
        {
          flowId,
          executionId,
          status: executionStatus,
          completedSteps,
          failedSteps,
          skippedSteps,
          totalSteps: steps.length,
          duration,
        },
        `Flow execution ${executionStatus}`,
      );

      return updatedLog;
    } catch (error) {
      const duration = Date.now() - startTime.getTime();

      await this.publishExecutionCompleted(executionContext, flow, 'failed', {
        totalSteps: steps.length,
        completedSteps,
        failedSteps: failedSteps + 1,
        skippedSteps,
        duration,
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          code:
            error instanceof Error && (error as any).code ? (error as any).code : 'EXECUTION_ERROR',
        },
      });

      const updatedLog = await this.updateExecutionLog(
        executionLog.id,
        'failed',
        executionContext.stepOutputs,
        error instanceof Error ? error.message : 'Unknown error',
      );

      this.logger.error(
        { flowId, executionId, error: error instanceof Error ? error.message : 'Unknown error' },
        'Flow execution failed',
      );
      return updatedLog;
    }
  }

  private async executeStep(
    step: FlowStep,
    context: FlowExecutionContext,
  ): Promise<StepExecutionResult> {
    const startTime = Date.now();

    // Create step execution log
    const stepLog = await this.executionLogsService.markStepStarted(
      context.orgId,
      context.userId,
      context.flowId,
      context.executionId,
      step.id,
      {
        stepName: step.name,
        stepType: step.type,
        config: step.config,
        executeIf:
          typeof step.executeIf === 'string' ? step.executeIf : JSON.stringify(step.executeIf),
        variables: context.variables,
        stepOutputs: context.stepOutputs,
      },
    );

    // Check executeIf condition before executing the step
    if (step.executeIf) {
      try {
        const conditionContext: ConditionContext = {
          inputs: context.variables,
          variables: context.variables,
          stepOutputs: context.stepOutputs,
          currentStep: step,
          orgId: context.orgId,
          userId: context.userId,
          meta: {
            flowId: context.flowId,
            executionId: context.executionId,
            stepId: step.id,
          },
        };

        const shouldExecute = this.conditionEvaluator.evaluate(step.executeIf, conditionContext);

        if (!shouldExecute) {
          const duration = Date.now() - startTime;
          const skipReason = 'executeIf condition evaluated to false';

          this.logger.info(
            {
              stepId: step.id,
              stepType: step.type,
              flowId: context.flowId,
              executionId: context.executionId,
              executeIf: step.executeIf,
              skipReason,
            },
            'Step skipped due to executeIf condition',
          );

          // Update step log to skipped
          await this.executionLogsService.markStepSkipped(stepLog.id, skipReason);

          // Publish step skipped event
          await this.publishStepSkipped(step, context, skipReason);

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
            flowId: context.flowId,
            executionId: context.executionId,
            executeIf: step.executeIf,
            error: error instanceof Error ? error.message : 'Unknown error',
          },
          'Failed to evaluate executeIf condition, proceeding with step execution',
        );

        // If condition evaluation fails, proceed with step execution to be safe
      }
    }

    await this.publishStepStarted(step, context);

    try {
      this.logger.debug(
        {
          stepId: step.id,
          stepType: step.type,
          flowId: context.flowId,
          executionId: context.executionId,
        },
        'Executing step',
      );

      const result = await this.executeStepByType(step, context);
      const duration = Date.now() - startTime;

      const stepResult: StepExecutionResult = {
        ...result,
        metadata: {
          ...result.metadata,
          duration,
        },
      };

      if (result.success) {
        // Update step log to completed
        await this.executionLogsService.markStepCompleted(stepLog.id, {
          output: result.output,
          duration,
          metadata: result.metadata,
        });

        await this.publishStepCompleted(step, context, stepResult);
      } else {
        // Update step log to failed
        await this.executionLogsService.markStepFailed(stepLog.id, result.error);

        await this.publishStepFailed(step, context, stepResult);
      }

      return stepResult;
    } catch (error) {
      const duration = Date.now() - startTime;
      const stepResult: StepExecutionResult = {
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          code:
            error instanceof Error && (error as any).code
              ? (error as any).code
              : 'STEP_EXECUTION_ERROR',
          stack: error instanceof Error ? error.stack : 'No stack trace',
        },
        metadata: { duration },
      };

      // Update step log to failed (for exception case)
      await this.executionLogsService.markStepFailed(stepLog.id, stepResult.error);

      await this.publishStepFailed(step, context, stepResult);
      return stepResult;
    }
  }

  private async executeStepByType(
    step: FlowStep,
    context: FlowExecutionContext,
  ): Promise<StepExecutionResult> {
    switch (step.type) {
      case 'action':
        return this.executeAction(step, context);
      case 'http_request':
        return this.executeHttpRequest(step, context);
      case 'oauth_api_call':
        return this.executeOAuthApiCall(step, context);
      case 'webhook':
        return this.executeWebhook(step, context);
      case 'data_transform':
        return this.executeDataTransform(step, context);
      case 'conditional':
        return this.executeConditional(step, context);
      case 'delay':
        return this.executeDelay(step, context);
      case 'sandbox_sync':
        return this.executeSandboxSync(step, context);
      case 'sandbox_async':
        return this.executeSandboxAsync(step, context);
      case 'code_execution':
        return this.executeCodeExecution(step, context);
      default:
        return {
          success: false,
          error: {
            message: `Unknown step type: ${step.type}`,
            code: 'UNKNOWN_STEP_TYPE',
          },
        };
    }
  }

  private async executeHttpRequest(
    step: FlowStep,
    _context: FlowExecutionContext,
  ): Promise<StepExecutionResult> {
    const { url, method = 'GET', headers = {}, body } = step.config;
    const urlStr = url as string;
    const methodStr = method as string;

    try {
      const response = await fetch(urlStr, {
        method: methodStr,
        headers: {
          'Content-Type': 'application/json',
          ...(typeof headers === 'object' && headers !== null ? headers : {}),
        },
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
          headers: Object.fromEntries(response.headers.entries()),
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

  private async executeOAuthApiCall(
    step: FlowStep,
    context: FlowExecutionContext,
  ): Promise<StepExecutionResult> {
    const { toolName, url, method = 'GET', headers = {}, body } = step.config;
    const urlStr = url as string;
    const methodStr = method as string;
    const toolNameStr = toolName as string;

    try {
      const accessToken = await this.oauthService.getValidAccessToken(toolNameStr, context.orgId);

      const response = await fetch(urlStr, {
        method: methodStr,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          ...(typeof headers === 'object' && headers !== null ? headers : {}),
        },
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
          headers: Object.fromEntries(response.headers.entries()),
        },
        error: response.ok
          ? undefined
          : {
              message: `HTTP ${response.status}: ${response.statusText}`,
              code: 'OAUTH_API_ERROR',
            },
      };
    } catch (error) {
      return {
        success: false,
        error: {
          message: `OAuth API call failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          code: 'OAUTH_ERROR',
        },
      };
    }
  }

  private async executeWebhook(
    _step: FlowStep,
    _context: FlowExecutionContext,
  ): Promise<StepExecutionResult> {
    return {
      success: true,
      output: { message: 'Webhook step executed (placeholder)' },
    };
  }

  private async executeDataTransform(
    step: FlowStep,
    context: FlowExecutionContext,
  ): Promise<StepExecutionResult> {
    const { script, useSandbox = true } = step.config;

    if (useSandbox && this.sandboxService.isConfigured()) {
      // Use sandbox for secure execution
      const sandboxCode = `
        // Data transformation script
        const input = context.stepOutputs;
        const flowContext = context;
        
        ${script}
      `;

      try {
        const sandboxContext: SandboxExecutionContext = {
          orgId: context.orgId,
          userId: context.userId,
          flowId: context.flowId,
          stepId: step.id,
          executionId: context.executionId,
          variables: context.variables,
          stepOutputs: context.stepOutputs,
        };

        const result = await this.sandboxService.runSync(sandboxCode, sandboxContext);

        return {
          success: result.success,
          output: (result.output || {}) as StepOutput,
          error: result.error,
          metadata: {
            duration: result.executionTime || 0,
            executionTime: result.executionTime,
            sandboxMode: 'sync',
            stepType: 'data_transform',
          },
        };
      } catch (error) {
        return {
          success: false,
          error: {
            message: `Sandbox data transform failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            code: 'SANDBOX_TRANSFORM_ERROR',
          },
        };
      }
    } else {
      // Fallback to direct execution (less secure)
      try {
        const transformFunction = new Function('input', 'context', script as string);
        const result = transformFunction(context.stepOutputs, context);

        return {
          success: true,
          output: (result || {}) as StepOutput,
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
    step: FlowStep,
    context: FlowExecutionContext,
  ): Promise<StepExecutionResult> {
    const { condition, useSandbox = true } = step.config;

    if (useSandbox && this.sandboxService.isConfigured()) {
      // Use sandbox for secure condition evaluation
      const sandboxCode = `
        // Conditional evaluation
        const context = arguments[0];
        return ${condition};
      `;

      try {
        const sandboxContext: SandboxExecutionContext = {
          orgId: context.orgId,
          userId: context.userId,
          flowId: context.flowId,
          stepId: step.id,
          executionId: context.executionId,
          variables: context.variables,
          stepOutputs: context.stepOutputs,
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
      } catch (error) {
        return {
          success: false,
          error: {
            message: `Sandbox condition evaluation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            code: 'SANDBOX_CONDITION_ERROR',
          },
        };
      }
    } else {
      // Fallback to direct execution (less secure)
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

  private async executeAction(
    step: FlowStep,
    context: FlowExecutionContext,
  ): Promise<StepExecutionResult> {
    const { actionId, inputs } = step.config;
    const actionIdStr = actionId as string;

    if (!actionIdStr) {
      return {
        success: false,
        error: {
          message: 'Action ID is required for action step',
          code: 'MISSING_ACTION_ID',
        },
      };
    }

    try {
      const action = await this.prisma.action.findUnique({
        where: { id: actionIdStr },
        include: { tool: true },
      });

      if (!action) {
        return {
          success: false,
          error: {
            message: `Action with ID ${actionId} not found`,
            code: 'ACTION_NOT_FOUND',
          },
        };
      }

      if (action.orgId !== context.orgId) {
        return {
          success: false,
          error: {
            message: 'Access denied: Action belongs to different organization',
            code: 'ACTION_ACCESS_DENIED',
          },
        };
      }

      let validatedInputs = inputs || {};

      if (action.inputSchema && Array.isArray(action.inputSchema)) {
        try {
          validatedInputs = this.inputValidator.validate(action.inputSchema as any[], inputs);
        } catch (validationError) {
          return {
            success: false,
            error: {
              message: `Input validation failed: ${validationError instanceof Error ? validationError.message : 'Unknown validation error'}`,
              code: 'INPUT_VALIDATION_ERROR',
            },
          };
        }
      }

      const resolvedInputs = await this.resolveActionInputs(
        validatedInputs as Record<string, unknown>,
        context,
      );
      const executionResult = await this.executeActionRequest(
        action as unknown as Record<string, unknown>,
        resolvedInputs as Record<string, unknown>,
      );

      return {
        success: executionResult.success,
        output: executionResult.output,
        error: executionResult.error,
      };
    } catch (error) {
      return {
        success: false,
        error: {
          message: `Action execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          code: 'ACTION_EXECUTION_ERROR',
        },
      };
    }
  }

  private async resolveActionInputs(
    inputs: unknown,
    context: FlowExecutionContext,
  ): Promise<unknown> {
    if (typeof inputs !== 'object' || inputs === null) {
      return inputs;
    }

    const resolved: Record<string, unknown> | unknown[] = Array.isArray(inputs) ? [] : {};

    for (const [key, value] of Object.entries(inputs)) {
      if (typeof value === 'string' && value.includes('{{')) {
        resolved[key] = this.resolveTemplate(value, context);
      } else if (typeof value === 'object' && value !== null) {
        resolved[key] = await this.resolveActionInputs(value, context);
      } else {
        resolved[key] = value;
      }
    }

    return resolved;
  }

  private resolveTemplate(template: string, context: FlowExecutionContext): string {
    return template.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
      const trimmedPath = (path as string).trim();

      if (trimmedPath.startsWith('steps.')) {
        const stepPath = trimmedPath.substring(6);
        return String(this.getNestedValue(context.stepOutputs, stepPath));
      }

      if (trimmedPath.startsWith('variables.')) {
        const varPath = trimmedPath.substring(10);
        return String(this.getNestedValue(context.variables, varPath));
      }

      if (context.variables[trimmedPath] !== undefined) {
        return String(context.variables[trimmedPath]);
      }

      return match;
    });
  }

  private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    return path.split('.').reduce((current, key) => {
      return current && typeof current === 'object' && key in current
        ? (current as Record<string, unknown>)[key]
        : undefined;
    }, obj as unknown);
  }

  private async executeActionRequest(
    action: Record<string, unknown>,
    inputs: Record<string, unknown>,
  ): Promise<StepExecutionResult> {
    const { tool, endpoint, method, headers } = action;
    const toolObj = tool as { baseUrl: string };
    const url = `${toolObj.baseUrl}${endpoint as string}`;
    const methodStr = method as string;

    try {
      const requestHeaders = {
        'Content-Type': 'application/json',
        ...(typeof headers === 'object' && headers !== null ? headers : {}),
      };

      const requestBody = ['GET', 'HEAD'].includes(methodStr.toUpperCase())
        ? undefined
        : JSON.stringify(inputs);

      const response = await fetch(url, {
        method: methodStr.toUpperCase(),
        headers: requestHeaders,
        body: requestBody,
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
          headers: Object.fromEntries(response.headers.entries()),
        },
        error: response.ok
          ? undefined
          : {
              message: `HTTP ${response.status}: ${response.statusText}`,
              code: 'ACTION_HTTP_ERROR',
            },
      };
    } catch (error) {
      return {
        success: false,
        error: {
          message: `Action request failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          code: 'ACTION_NETWORK_ERROR',
        },
      };
    }
  }

  /**
   * Execute code synchronously in Daytona sandbox
   * Blocks until execution completes
   */
  private async executeSandboxSync(
    step: FlowStep,
    context: FlowExecutionContext,
  ): Promise<StepExecutionResult> {
    const { code, language } = step.config;

    if (!code) {
      return {
        success: false,
        error: {
          message: 'Code is required for sandbox_sync step',
          code: 'MISSING_CODE',
        },
      };
    }

    try {
      const sandboxContext: SandboxExecutionContext = {
        orgId: context.orgId,
        userId: context.userId,
        flowId: context.flowId,
        stepId: step.id,
        executionId: context.executionId,
        variables: context.variables,
        stepOutputs: context.stepOutputs,
      };

      const result = await this.sandboxService.runSync(code as string, sandboxContext);

      return {
        success: result.success,
        output: (result.output || {}) as StepOutput,
        error: result.error,
        metadata: {
          duration: result.executionTime || 0,
          executionTime: result.executionTime,
          sandboxMode: 'sync',
          language: language || 'javascript',
        },
      };
    } catch (error) {
      return {
        success: false,
        error: {
          message: `Sandbox sync execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          code: 'SANDBOX_SYNC_ERROR',
        },
      };
    }
  }

  /**
   * Execute code asynchronously in Daytona sandbox
   * Returns immediately with session info
   */
  private async executeSandboxAsync(
    step: FlowStep,
    context: FlowExecutionContext,
  ): Promise<StepExecutionResult> {
    const { code, language, pollInterval = 1000, maxPollAttempts = 300 } = step.config;

    if (!code) {
      return {
        success: false,
        error: {
          message: 'Code is required for sandbox_async step',
          code: 'MISSING_CODE',
        },
      };
    }

    try {
      const sandboxContext: SandboxExecutionContext = {
        orgId: context.orgId,
        userId: context.userId,
        flowId: context.flowId,
        stepId: step.id,
        executionId: context.executionId,
        variables: context.variables,
        stepOutputs: context.stepOutputs,
      };

      // Start async execution
      const sessionId = await this.sandboxService.runAsync(code as string, sandboxContext);

      // Poll for completion or return session info for later retrieval
      if (step.config.waitForCompletion !== false) {
        // Poll for completion
        let attempts = 0;
        const maxAttemptsNum = maxPollAttempts as number;
        const pollIntervalNum = pollInterval as number;
        while (attempts < maxAttemptsNum) {
          await new Promise(resolve => setTimeout(resolve, pollIntervalNum));
          attempts++;

          const asyncResult = await this.sandboxService.getAsyncResult(sessionId, sandboxContext);

          if (asyncResult.status === 'completed' || asyncResult.status === 'failed') {
            const result = asyncResult.result;
            return {
              success: result?.success || false,
              output: (result?.output || {}) as StepOutput,
              error: result?.error,
              metadata: {
                duration: result?.executionTime || 0,
                executionTime: result?.executionTime,
                sandboxMode: 'async',
                sessionId: asyncResult.sessionId,
                pollAttempts: attempts,
                language: language || 'javascript',
              },
            };
          }
        }

        // Timeout reached
        return {
          success: false,
          output: { sessionId },
          error: {
            message: `Async execution timed out after ${maxAttemptsNum} attempts`,
            code: 'SANDBOX_ASYNC_TIMEOUT',
          },
          metadata: {
            duration: maxAttemptsNum * pollIntervalNum,
            sandboxMode: 'async',
            sessionId,
            pollAttempts: attempts,
            language: language || 'javascript',
          },
        };
      } else {
        // Return immediately with session info
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
            language: language || 'javascript',
          },
        };
      }
    } catch (error) {
      return {
        success: false,
        error: {
          message: `Sandbox async execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          code: 'SANDBOX_ASYNC_ERROR',
        },
      };
    }
  }

  /**
   * Generic code execution step - chooses sync or async based on config
   * This provides backward compatibility and flexibility
   */
  private async executeCodeExecution(
    step: FlowStep,
    context: FlowExecutionContext,
  ): Promise<StepExecutionResult> {
    const { mode = 'sync' } = step.config;

    if (mode === 'async') {
      return this.executeSandboxAsync(step, context);
    } else {
      return this.executeSandboxSync(step, context);
    }
  }

  private async executeDelay(
    step: FlowStep,
    _context: FlowExecutionContext,
  ): Promise<StepExecutionResult> {
    const { delayMs } = step.config;

    await new Promise(resolve => setTimeout(resolve, delayMs as number));

    return {
      success: true,
      output: { delayedFor: delayMs },
    };
  }

  private async publishStepStarted(step: FlowStep, context: FlowExecutionContext): Promise<void> {
    const event = await this.ablyService.createStepEvent(
      step.id,
      'started',
      context.executionId,
      context.orgId,
      context.flowId,
      { stepName: step.name },
    );

    await this.ablyService.publishStepEvent(event);
  }

  private async publishStepCompleted(
    step: FlowStep,
    context: FlowExecutionContext,
    result: StepExecutionResult,
  ): Promise<void> {
    const event = await this.ablyService.createStepEvent(
      step.id,
      'completed',
      context.executionId,
      context.orgId,
      context.flowId,
      {
        stepName: step.name,
        output: result.output,
        duration: result.metadata?.duration,
      },
    );

    await this.ablyService.publishStepEvent(event);

    // Dispatch webhook after Ably event
    await this.dispatchWebhook('step.completed', {
      orgId: context.orgId,
      flowId: context.flowId,
      executionId: context.executionId,
      stepKey: step.id,
      status: 'completed',
      output: result.output,
      stepName: step.name,
      duration: result.metadata?.duration,
    });
  }

  private async publishStepFailed(
    step: FlowStep,
    context: FlowExecutionContext,
    result: StepExecutionResult,
  ): Promise<void> {
    const event = await this.ablyService.createStepEvent(
      step.id,
      'failed',
      context.executionId,
      context.orgId,
      context.flowId,
      {
        stepName: step.name,
        error: result.error,
        duration: result.metadata?.duration,
      },
    );

    await this.ablyService.publishStepEvent(event);

    // Dispatch webhook after Ably event
    await this.dispatchWebhook('step.failed', {
      orgId: context.orgId,
      flowId: context.flowId,
      executionId: context.executionId,
      stepKey: step.id,
      status: 'failed',
      error: result.error,
      stepName: step.name,
      duration: result.metadata?.duration,
    });
  }

  private async publishStepSkipped(
    step: FlowStep,
    context: FlowExecutionContext,
    skipReason: string,
  ): Promise<void> {
    const event = await this.ablyService.createStepEvent(
      step.id,
      'skipped',
      context.executionId,
      context.orgId,
      context.flowId,
      {
        stepName: step.name,
        skipReason,
        executeIf: step.executeIf,
      },
    );

    await this.ablyService.publishStepEvent(event);

    // Dispatch webhook after Ably event
    await this.dispatchWebhook('step.skipped', {
      orgId: context.orgId,
      flowId: context.flowId,
      executionId: context.executionId,
      stepKey: step.id,
      status: 'skipped',
      stepName: step.name,
      skipReason,
      executeIf: step.executeIf,
    });
  }

  private async publishExecutionStarted(
    context: FlowExecutionContext,
    flow: Flow,
    totalSteps: number,
  ): Promise<void> {
    const event = await this.ablyService.createExecutionEvent(
      context.executionId,
      'started',
      context.orgId,
      context.flowId,
      { totalSteps },
    );

    await this.ablyService.publishExecutionEvent(event);
  }

  private async publishExecutionCompleted(
    context: FlowExecutionContext,
    flow: Flow,
    status: 'completed' | 'failed' | 'cancelled',
    options: {
      totalSteps: number;
      completedSteps: number;
      failedSteps: number;
      skippedSteps?: number;
      duration: number;
      output?: any;
      error?: { message: string; code?: string };
    },
  ): Promise<void> {
    const event = await this.ablyService.createExecutionEvent(
      context.executionId,
      status,
      context.orgId,
      context.flowId,
      options,
    );

    await this.ablyService.publishExecutionEvent(event);

    // Dispatch webhook after Ably event
    const eventType = status === 'completed' ? 'flow.completed' : 'flow.failed';
    await this.dispatchWebhook(eventType, {
      orgId: context.orgId,
      flowId: context.flowId,
      executionId: context.executionId,
      status,
      output: options.output,
      error: options.error,
      totalSteps: options.totalSteps,
      completedSteps: options.completedSteps,
      failedSteps: options.failedSteps,
      skippedSteps: options.skippedSteps,
      duration: options.duration,
    });
  }

  private parseFlowSteps(stepsData: unknown): FlowStep[] {
    if (Array.isArray(stepsData)) {
      return stepsData;
    }

    if (typeof stepsData === 'string') {
      return JSON.parse(stepsData);
    }

    return [];
  }

  private isStepCritical(step: FlowStep): boolean {
    return step.config?.critical !== false;
  }

  private generateExecutionId(): string {
    return `exec_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  }

  private async createExecutionLog(
    executionId: string,
    flowId: string,
    tenant: TenantContext,
    status: string,
    input: FlowVariables,
  ): Promise<ExecutionLog> {
    return this.prisma.executionLog.create({
      data: {
        id: executionId,
        flowId,
        orgId: tenant.orgId,
        userId: tenant.userId,
        executionId: executionId,
        stepKey: 'flow_start',
        status,
        inputs: input as unknown as Prisma.InputJsonValue,
        outputs: null,
      },
    });
  }

  private async updateExecutionLog(
    executionId: string,
    status: string,
    output: StepOutputs,
    _error?: string,
  ): Promise<ExecutionLog> {
    return this.prisma.executionLog.update({
      where: { id: executionId },
      data: {
        status,
        outputs: output as unknown as Prisma.InputJsonValue,
      },
    });
  }

  private async dispatchWebhook(
    eventType: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
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
