import { Injectable } from '@nestjs/common';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';
import { Flow, ExecutionLog } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { AblyService, FlowStepEvent, FlowExecutionEvent } from '../ably/ably.service';
import { TenantContext } from '../common/interfaces/tenant-context.interface';
import { SecretsResolver } from '../secrets/secrets-resolver.service';
import { OAuthTokenService } from '../oauth/oauth-token.service';
import { InputValidatorService } from '../common/services/input-validator.service';

export interface FlowStep {
  id: string;
  type: string;
  name: string;
  config: any;
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
  variables: Record<string, any>;
  stepOutputs: Record<string, any>;
}

export interface StepExecutionResult {
  success: boolean;
  output?: any;
  error?: {
    message: string;
    code?: string;
    stack?: string;
  };
  metadata?: {
    duration: number;
    retryAttempt?: number;
    [key: string]: any;
  };
}

@Injectable()
export class FlowExecutorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ablyService: AblyService,
    private readonly secretsResolver: SecretsResolver,
    private readonly oauthService: OAuthTokenService,
    private readonly inputValidator: InputValidatorService,
    @InjectPinoLogger(FlowExecutorService.name)
    private readonly logger: PinoLogger,
  ) {}

  async executeFlow(
    flowId: string,
    tenant: TenantContext,
    inputVariables: Record<string, any> = {}
  ): Promise<ExecutionLog> {
    const startTime = new Date();
    const executionId = this.generateExecutionId();

    this.logger.info({ flowId, executionId, orgId: tenant.orgId, userId: tenant.userId }, 'Starting flow execution');

    const flow = await this.prisma.flow.findUnique({
      where: { id: flowId, orgId: tenant.orgId }
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
      stepOutputs: {}
    };

    const steps = this.parseFlowSteps(flow.steps);
    
    await this.publishExecutionStarted(executionContext, flow, steps.length);

    const executionLog = await this.createExecutionLog(
      executionId,
      flowId,
      tenant,
      'running',
      inputVariables
    );

    let executionStatus: 'completed' | 'failed' | 'cancelled' = 'completed';
    let executionError: { message: string; code?: string } | undefined;
    let completedSteps = 0;
    let failedSteps = 0;

    try {
      for (const step of steps) {
        try {
          const stepResult = await this.executeStep(step, executionContext);
          
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
              this.logger.warn({ stepId: step.id, stepType: step.type, flowId: flowId, executionId: executionId }, 'Non-critical step failed, continuing execution');
            }
          }
        } catch (error) {
          failedSteps++;
          this.logger.error({ stepId: step.id, stepType: step.type, flowId: flowId, executionId: executionId, error: error.message }, 'Unexpected error in step execution');
          
          if (this.isStepCritical(step)) {
            executionStatus = 'failed';
            executionError = { 
              message: error.message, 
              code: error.code || 'EXECUTION_ERROR' 
            };
            break;
          }
        }
      }

      const duration = Date.now() - startTime.getTime();
      
      await this.publishExecutionCompleted(
        executionContext, 
        flow, 
        executionStatus, 
        {
          totalSteps: steps.length,
          completedSteps,
          failedSteps,
          duration,
          output: executionContext.stepOutputs,
          error: executionError
        }
      );

      const updatedLog = await this.updateExecutionLog(
        executionLog.id,
        executionStatus,
        executionContext.stepOutputs,
        executionError?.message
      );

      this.logger.info({
        flowId,
        executionId,
        status: executionStatus,
        completedSteps,
        totalSteps: steps.length,
        duration
      }, `Flow execution ${executionStatus}`);

      return updatedLog;

    } catch (error) {
      const duration = Date.now() - startTime.getTime();
      
      await this.publishExecutionCompleted(
        executionContext,
        flow,
        'failed',
        {
          totalSteps: steps.length,
          completedSteps,
          failedSteps: failedSteps + 1,
          duration,
          error: { message: error.message, code: error.code || 'EXECUTION_ERROR' }
        }
      );

      const updatedLog = await this.updateExecutionLog(
        executionLog.id,
        'failed',
        executionContext.stepOutputs,
        error.message
      );

      this.logger.error({ flowId, executionId, error: error.message }, 'Flow execution failed');
      return updatedLog;
    }
  }

  private async executeStep(
    step: FlowStep,
    context: FlowExecutionContext
  ): Promise<StepExecutionResult> {
    const startTime = Date.now();
    
    await this.publishStepStarted(step, context);
    
    try {
      this.logger.debug({ stepId: step.id, stepType: step.type, flowId: context.flowId, executionId: context.executionId }, 'Executing step');
      
      const result = await this.executeStepByType(step, context);
      const duration = Date.now() - startTime;
      
      const stepResult: StepExecutionResult = {
        ...result,
        metadata: {
          ...result.metadata,
          duration
        }
      };

      if (result.success) {
        await this.publishStepCompleted(step, context, stepResult);
      } else {
        await this.publishStepFailed(step, context, stepResult);
      }

      return stepResult;

    } catch (error) {
      const duration = Date.now() - startTime;
      const stepResult: StepExecutionResult = {
        success: false,
        error: {
          message: error.message,
          code: error.code || 'STEP_EXECUTION_ERROR',
          stack: error.stack
        },
        metadata: { duration }
      };

      await this.publishStepFailed(step, context, stepResult);
      return stepResult;
    }
  }

  private async executeStepByType(
    step: FlowStep,
    context: FlowExecutionContext
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
      default:
        return {
          success: false,
          error: {
            message: `Unknown step type: ${step.type}`,
            code: 'UNKNOWN_STEP_TYPE'
          }
        };
    }
  }

  private async executeHttpRequest(
    step: FlowStep,
    context: FlowExecutionContext
  ): Promise<StepExecutionResult> {
    const { url, method = 'GET', headers = {}, body } = step.config;
    
    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers
        },
        body: body ? JSON.stringify(body) : undefined
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
          headers: Object.fromEntries(response.headers.entries())
        },
        error: response.ok ? undefined : {
          message: `HTTP ${response.status}: ${response.statusText}`,
          code: 'HTTP_ERROR'
        }
      };
    } catch (error) {
      return {
        success: false,
        error: {
          message: error.message,
          code: 'NETWORK_ERROR'
        }
      };
    }
  }

  private async executeOAuthApiCall(
    step: FlowStep,
    context: FlowExecutionContext
  ): Promise<StepExecutionResult> {
    const { toolName, url, method = 'GET', headers = {}, body } = step.config;
    
    try {
      const accessToken = await this.oauthService.getValidAccessToken(toolName, context.orgId);
      
      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          ...headers
        },
        body: body ? JSON.stringify(body) : undefined
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
          headers: Object.fromEntries(response.headers.entries())
        },
        error: response.ok ? undefined : {
          message: `HTTP ${response.status}: ${response.statusText}`,
          code: 'OAUTH_API_ERROR'
        }
      };
    } catch (error) {
      return {
        success: false,
        error: {
          message: `OAuth API call failed: ${error.message}`,
          code: 'OAUTH_ERROR'
        }
      };
    }
  }

  private async executeWebhook(step: FlowStep, context: FlowExecutionContext): Promise<StepExecutionResult> {
    return {
      success: true,
      output: { message: 'Webhook step executed (placeholder)' }
    };
  }

  private async executeDataTransform(step: FlowStep, context: FlowExecutionContext): Promise<StepExecutionResult> {
    const { script } = step.config;
    
    try {
      const transformFunction = new Function('input', 'context', script);
      const result = transformFunction(context.stepOutputs, context);
      
      return {
        success: true,
        output: result
      };
    } catch (error) {
      return {
        success: false,
        error: {
          message: `Data transform failed: ${error.message}`,
          code: 'TRANSFORM_ERROR'
        }
      };
    }
  }

  private async executeConditional(step: FlowStep, context: FlowExecutionContext): Promise<StepExecutionResult> {
    const { condition } = step.config;
    
    try {
      const conditionFunction = new Function('context', `return ${condition}`);
      const result = conditionFunction(context);
      
      return {
        success: true,
        output: { conditionResult: result }
      };
    } catch (error) {
      return {
        success: false,
        error: {
          message: `Condition evaluation failed: ${error.message}`,
          code: 'CONDITION_ERROR'
        }
      };
    }
  }

  private async executeAction(
    step: FlowStep,
    context: FlowExecutionContext
  ): Promise<StepExecutionResult> {
    const { actionId, inputs } = step.config;

    if (!actionId) {
      return {
        success: false,
        error: {
          message: 'Action ID is required for action step',
          code: 'MISSING_ACTION_ID'
        }
      };
    }

    try {
      const action = await this.prisma.action.findUnique({
        where: { id: actionId },
        include: { tool: true }
      });

      if (!action) {
        return {
          success: false,
          error: {
            message: `Action with ID ${actionId} not found`,
            code: 'ACTION_NOT_FOUND'
          }
        };
      }

      if (action.orgId !== context.orgId) {
        return {
          success: false,
          error: {
            message: 'Access denied: Action belongs to different organization',
            code: 'ACTION_ACCESS_DENIED'
          }
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
              message: `Input validation failed: ${validationError.message}`,
              code: 'INPUT_VALIDATION_ERROR'
            }
          };
        }
      }

      const resolvedInputs = await this.resolveActionInputs(validatedInputs, context);
      const executionResult = await this.executeActionRequest(action, resolvedInputs);

      return {
        success: executionResult.success,
        output: executionResult.output,
        error: executionResult.error
      };

    } catch (error) {
      return {
        success: false,
        error: {
          message: `Action execution failed: ${error.message}`,
          code: 'ACTION_EXECUTION_ERROR'
        }
      };
    }
  }

  private async resolveActionInputs(inputs: any, context: FlowExecutionContext): Promise<any> {
    if (typeof inputs !== 'object' || inputs === null) {
      return inputs;
    }

    const resolved: any = Array.isArray(inputs) ? [] : {};

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

  private resolveTemplate(template: string, context: FlowExecutionContext): any {
    return template.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
      const trimmedPath = path.trim();
      
      if (trimmedPath.startsWith('steps.')) {
        const stepPath = trimmedPath.substring(6);
        return this.getNestedValue(context.stepOutputs, stepPath);
      }
      
      if (trimmedPath.startsWith('variables.')) {
        const varPath = trimmedPath.substring(10);
        return this.getNestedValue(context.variables, varPath);
      }
      
      if (context.variables[trimmedPath] !== undefined) {
        return context.variables[trimmedPath];
      }
      
      return match;
    });
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);
  }

  private async executeActionRequest(action: any, inputs: any): Promise<StepExecutionResult> {
    const { tool, endpoint, method, headers } = action;
    const url = `${tool.baseUrl}${endpoint}`;

    try {
      const requestHeaders = {
        'Content-Type': 'application/json',
        ...headers
      };

      const requestBody = ['GET', 'HEAD'].includes(method.toUpperCase()) ? undefined : JSON.stringify(inputs);

      const response = await fetch(url, {
        method: method.toUpperCase(),
        headers: requestHeaders,
        body: requestBody
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
          headers: Object.fromEntries(response.headers.entries())
        },
        error: response.ok ? undefined : {
          message: `HTTP ${response.status}: ${response.statusText}`,
          code: 'ACTION_HTTP_ERROR'
        }
      };
    } catch (error) {
      return {
        success: false,
        error: {
          message: `Action request failed: ${error.message}`,
          code: 'ACTION_NETWORK_ERROR'
        }
      };
    }
  }

  private async executeDelay(step: FlowStep, context: FlowExecutionContext): Promise<StepExecutionResult> {
    const { delayMs } = step.config;
    
    await new Promise(resolve => setTimeout(resolve, delayMs));
    
    return {
      success: true,
      output: { delayedFor: delayMs }
    };
  }

  private async publishStepStarted(step: FlowStep, context: FlowExecutionContext): Promise<void> {
    const event = await this.ablyService.createStepEvent(
      step.id,
      'started',
      context.executionId,
      context.orgId,
      context.flowId,
      { stepName: step.name }
    );
    
    await this.ablyService.publishStepEvent(event);
  }

  private async publishStepCompleted(
    step: FlowStep,
    context: FlowExecutionContext,
    result: StepExecutionResult
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
        duration: result.metadata?.duration
      }
    );
    
    await this.ablyService.publishStepEvent(event);
  }

  private async publishStepFailed(
    step: FlowStep,
    context: FlowExecutionContext,
    result: StepExecutionResult
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
        duration: result.metadata?.duration
      }
    );
    
    await this.ablyService.publishStepEvent(event);
  }

  private async publishExecutionStarted(
    context: FlowExecutionContext,
    flow: Flow,
    totalSteps: number
  ): Promise<void> {
    const event = await this.ablyService.createExecutionEvent(
      context.executionId,
      'started',
      context.orgId,
      context.flowId,
      { totalSteps }
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
      duration: number;
      output?: any;
      error?: { message: string; code?: string };
    }
  ): Promise<void> {
    const event = await this.ablyService.createExecutionEvent(
      context.executionId,
      status,
      context.orgId,
      context.flowId,
      options
    );
    
    await this.ablyService.publishExecutionEvent(event);
  }

  private parseFlowSteps(stepsData: any): FlowStep[] {
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
    input: any
  ): Promise<ExecutionLog> {
    return this.prisma.executionLog.create({
      data: {
        id: executionId,
        flowId,
        orgId: tenant.orgId,
        userId: tenant.userId,
        stepId: 'flow_start',
        status,
        inputs: input,
        outputs: null
      }
    });
  }

  private async updateExecutionLog(
    executionId: string,
    status: string,
    output: any,
    error?: string
  ): Promise<ExecutionLog> {
    return this.prisma.executionLog.update({
      where: { id: executionId },
      data: {
        status,
        outputs: output
      }
    });
  }
}