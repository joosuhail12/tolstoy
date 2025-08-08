import { Injectable, Scope } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';

export type LoggingContextValue = string | number | boolean | undefined;

export interface LoggingContext {
  orgId?: string;
  userId?: string;
  requestId?: string;
  flowId?: string;
  stepId?: string;
  executionId?: string;
  [key: string]: LoggingContextValue;
}

@Injectable({ scope: Scope.DEFAULT })
export class LoggingContextService {
  private readonly asyncLocalStorage = new AsyncLocalStorage();

  /**
   * Run callback within a new logging context
   */
  run(context: LoggingContext, callback: () => unknown): unknown {
    return this.asyncLocalStorage.run(context, callback);
  }

  runSync(context: LoggingContext, callback: () => void): void {
    return this.asyncLocalStorage.run(context, callback);
  }

  runAsync(context: LoggingContext, callback: () => Promise<unknown>): Promise<unknown> {
    return this.asyncLocalStorage.run(context, callback);
  }

  /**
   * Get the current logging context
   */
  getContext(): LoggingContext | undefined {
    return this.asyncLocalStorage.getStore() as LoggingContext | undefined;
  }

  /**
   * Update the current context with additional metadata
   */
  updateContext(updates: Partial<LoggingContext>): void {
    const currentContext = this.getContext();
    if (currentContext) {
      Object.assign(currentContext, updates);
    }
  }

  /**
   * Get a specific value from the current context
   */
  get(key: keyof LoggingContext): LoggingContextValue {
    const context = this.getContext();
    return context?.[key];
  }

  /**
   * Set a specific value in the current context
   */
  set(key: keyof LoggingContext, value: LoggingContextValue): void {
    const context = this.getContext();
    if (context) {
      context[key] = value;
    }
  }

  /**
   * Create a child context with additional metadata
   */
  createChildContext(additionalContext: Partial<LoggingContext>): LoggingContext {
    const currentContext = this.getContext() || {};
    return { ...currentContext, ...additionalContext };
  }

  /**
   * Get tenant context (orgId, userId) for multi-tenant operations
   */
  getTenantContext(): { orgId?: string | undefined; userId?: string | undefined } {
    const context = this.getContext();
    return {
      orgId: context?.orgId,
      userId: context?.userId,
    };
  }

  /**
   * Get tracing context (requestId, flowId, etc.) for operation tracing
   */
  getTracingContext(): {
    requestId?: string;
    flowId?: string;
    stepId?: string;
    executionId?: string;
  } {
    const context = this.getContext();
    const result: {
      requestId?: string;
      flowId?: string;
      stepId?: string;
      executionId?: string;
    } = {};

    if (context?.requestId !== undefined) {
      result.requestId = context.requestId;
    }
    if (context?.flowId !== undefined) {
      result.flowId = context.flowId;
    }
    if (context?.stepId !== undefined) {
      result.stepId = context.stepId;
    }
    if (context?.executionId !== undefined) {
      result.executionId = context.executionId;
    }

    return result;
  }
}
