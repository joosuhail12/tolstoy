import { Injectable, Scope } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';

export interface LoggingContext {
  orgId?: string;
  userId?: string;
  requestId?: string;
  flowId?: string;
  stepId?: string;
  executionId?: string;
  [key: string]: any;
}

@Injectable({ scope: Scope.DEFAULT })
export class LoggingContextService {
  private readonly asyncLocalStorage = new AsyncLocalStorage<LoggingContext>();

  /**
   * Run callback within a new logging context
   */
  run<T>(context: LoggingContext, callback: () => T): T {
    return this.asyncLocalStorage.run(context, callback);
  }

  /**
   * Get the current logging context
   */
  getContext(): LoggingContext | undefined {
    return this.asyncLocalStorage.getStore();
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
  get<T>(key: keyof LoggingContext): T | undefined {
    const context = this.getContext();
    return context?.[key] as T;
  }

  /**
   * Set a specific value in the current context
   */
  set(key: keyof LoggingContext, value: any): void {
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
  getTenantContext(): { orgId?: string; userId?: string } {
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
    return {
      requestId: context?.requestId,
      flowId: context?.flowId,
      stepId: context?.stepId,
      executionId: context?.executionId,
    };
  }
}