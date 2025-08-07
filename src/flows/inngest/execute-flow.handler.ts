import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { InngestFunction } from 'nestjs-inngest';
import { SandboxService, SandboxExecutionContext } from '../../sandbox/sandbox.service';
import { SecretsResolver } from '../../secrets/secrets-resolver.service';
import { AblyService } from '../../ably/ably.service';
import { InputValidatorService } from '../../common/services/input-validator.service';
import { PrismaService } from '../../prisma.service';

interface FlowExecutionEvent {
  data: {
    orgId: string;
    userId: string;
    flowId: string;
    executionId: string;
    steps: Array<{
      id: string;
      type: string;
      name: string;
      config: any;
      dependsOn?: string[];
    }>;
    variables: Record<string, any>;
  };
}

interface StepExecutionResult {
  success: boolean;
  output?: any;
  error?: {
    message: string;
    code?: string;
    stack?: string;
  };
  metadata?: {
    duration: number;
    [key: string]: any;
  };
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
    private readonly sandboxService: SandboxService,
    private readonly secretsResolver: SecretsResolver,
    private readonly ablyService: AblyService,
    private readonly inputValidator: InputValidatorService,
    private readonly prisma: PrismaService,
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
  async handler(
    { event, step }: any,
  ): Promise<any> {
    const { orgId, userId, flowId, executionId, steps, variables } = event.data;

    this.logger.info({
      orgId,
      userId,
      flowId,
      executionId,
      stepCount: steps.length,
    }, 'Starting durable flow execution');

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

    const stepOutputs: Record<string, any> = {};
    let completedSteps = 0;
    let failedSteps = 0;
    let executionError: any = null;

    // Execute each step durably
    for (const flowStep of steps) {
      try {
        const stepResult = await step.run(
          `execute-step-${flowStep.id}`,
          async () => {
            return this.executeStep(flowStep, {
              orgId,
              userId,
              flowId,
              executionId,
              variables,
              stepOutputs,
            });
          }
        );

        if (stepResult.success) {
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

          this.logger.info({
            stepId: flowStep.id,
            stepType: flowStep.type,
            executionId,
            duration: stepResult.metadata?.duration,
          }, 'Step completed successfully');

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

          this.logger.error({
            stepId: flowStep.id,
            stepType: flowStep.type,
            executionId,
            error: stepResult.error,
          }, 'Step failed');

          // Check if step is critical
          if (this.isStepCritical(flowStep)) {
            this.logger.warn({
              stepId: flowStep.id,
              executionId,
            }, 'Critical step failed, stopping execution');
            break;
          }
        }
      } catch (error) {
        failedSteps++;
        executionError = {
          message: error.message,
          code: error.code || 'STEP_EXECUTION_ERROR',
        };

        this.logger.error({
          stepId: flowStep.id,
          executionId,
          error: error.message,
        }, 'Unexpected error during step execution');

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
          outputs: stepOutputs,
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

    this.logger.info({
      orgId,
      flowId,
      executionId,
      status: executionStatus,
      completedSteps,
      failedSteps,
      totalSteps: steps.length,
    }, `Flow execution ${executionStatus}`);

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
   * Execute a single flow step with proper context and error handling
   */
  private async executeStep(
    step: any,
    context: {
      orgId: string;
      userId: string;
      flowId: string;
      executionId: string;
      variables: Record<string, any>;
      stepOutputs: Record<string, any>;
    }
  ): Promise<StepExecutionResult> {
    const startTime = Date.now();

    try {
      let result: StepExecutionResult;

      switch (step.type) {
        case 'sandbox_sync':
          result = await this.executeSandboxSync(step, context);
          break;

        case 'sandbox_async':
          result = await this.executeSandboxAsync(step, context);
          break;

        case 'code_execution':
          result = await this.executeCodeExecution(step, context);
          break;

        case 'data_transform':
          result = await this.executeDataTransform(step, context);
          break;

        case 'conditional':
          result = await this.executeConditional(step, context);
          break;

        case 'http_request':
          result = await this.executeHttpRequest(step, context);
          break;

        case 'delay':
          result = await this.executeDelay(step, context);
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
      
      return {
        ...result,
        metadata: {
          ...result.metadata,
          duration,
        },
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      
      return {
        success: false,
        error: {
          message: error.message,
          code: error.code || 'STEP_EXECUTION_ERROR',
          stack: error.stack,
        },
        metadata: { duration },
      };
    }
  }

  private async executeSandboxSync(
    step: any,
    context: any
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

    const sandboxContext: SandboxExecutionContext = {
      orgId: context.orgId,
      userId: context.userId,
      flowId: context.flowId,
      stepId: step.id,
      executionId: context.executionId,
      variables: context.variables,
      stepOutputs: context.stepOutputs,
    };

    const result = await this.sandboxService.runSync(code, sandboxContext);
    
    return {
      success: result.success,
      output: result.output,
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
    step: any,
    context: any
  ): Promise<StepExecutionResult> {
    const { code, waitForCompletion = false, pollInterval = 1000, maxPollAttempts = 300 } = step.config;

    if (!code) {
      return {
        success: false,
        error: {
          message: 'Code is required for sandbox_async step',
          code: 'MISSING_CODE',
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
          output: result?.output,
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
    step: any,
    context: any
  ): Promise<StepExecutionResult> {
    const { mode = 'sync' } = step.config;

    if (mode === 'async') {
      return this.executeSandboxAsync(step, context);
    } else {
      return this.executeSandboxSync(step, context);
    }
  }

  private async executeDataTransform(
    step: any,
    context: any
  ): Promise<StepExecutionResult> {
    const { script, useSandbox = true } = step.config;
    
    if (useSandbox && this.sandboxService.isConfigured()) {
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
      };

      const result = await this.sandboxService.runSync(sandboxCode, sandboxContext);
      
      return {
        success: result.success,
        output: result.output,
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
            message: `Data transform failed: ${error.message}`,
            code: 'TRANSFORM_ERROR',
          },
        };
      }
    }
  }

  private async executeConditional(
    step: any,
    context: any
  ): Promise<StepExecutionResult> {
    const { condition, useSandbox = true } = step.config;
    
    if (useSandbox && this.sandboxService.isConfigured()) {
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
            message: `Condition evaluation failed: ${error.message}`,
            code: 'CONDITION_ERROR',
          },
        };
      }
    }
  }

  private async executeHttpRequest(
    step: any,
    context: any
  ): Promise<StepExecutionResult> {
    const { url, method = 'GET', headers = {}, body } = step.config;
    
    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers,
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
        error: response.ok ? undefined : {
          message: `HTTP ${response.status}: ${response.statusText}`,
          code: 'HTTP_ERROR',
        },
      };
    } catch (error) {
      return {
        success: false,
        error: {
          message: error.message,
          code: 'NETWORK_ERROR',
        },
      };
    }
  }

  private async executeDelay(
    step: any,
    context: any
  ): Promise<StepExecutionResult> {
    const { delayMs } = step.config;
    
    await new Promise(resolve => setTimeout(resolve, delayMs));
    
    return {
      success: true,
      output: { delayedFor: delayMs },
    };
  }

  private isStepCritical(step: any): boolean {
    return step.config?.critical !== false;
  }
}