import { Injectable, BadRequestException } from '@nestjs/common';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';
import * as jsonLogic from 'json-logic-js';

export interface ConditionContext {
  /** Input variables from the flow execution */
  inputs: Record<string, any>;
  /** Variables passed to the flow */
  variables: Record<string, any>;
  /** Outputs from previous steps */
  stepOutputs: Record<string, any>;
  /** Current step configuration */
  currentStep?: Record<string, any>;
  /** Organization context */
  orgId?: string;
  /** User context */
  userId?: string;
  /** Flow execution metadata */
  meta?: {
    flowId?: string;
    executionId?: string;
    stepId?: string;
  };
}

export interface ConditionRule {
  /** JSONLogic rule or custom condition format */
  rule: any;
  /** Optional description of the condition */
  description?: string;
  /** Condition type for validation */
  type?: 'jsonlogic' | 'custom';
}

/**
 * Service for evaluating conditional expressions used in executeIf rules
 *
 * Supports multiple condition formats:
 * 1. JSONLogic - Standard JSONLogic expressions
 * 2. Simple expressions - Basic field comparisons
 * 3. Custom DSL - Tolstoy-specific condition language
 */
@Injectable()
export class ConditionEvaluatorService {
  constructor(
    @InjectPinoLogger(ConditionEvaluatorService.name)
    private readonly logger: PinoLogger,
  ) {
    // Add custom operations to JSONLogic
    this.registerCustomOperations();
  }

  /**
   * Evaluate a condition rule against the provided context
   */
  evaluate(rule: any, context: ConditionContext): boolean {
    if (!rule) {
      // No rule means always execute
      return true;
    }

    try {
      // Log condition evaluation for debugging
      this.logger.debug(
        {
          rule,
          contextKeys: Object.keys(context),
          orgId: context.orgId,
          executionId: context.meta?.executionId,
        },
        'Evaluating executeIf condition',
      );

      // Handle different rule formats
      const result = this.evaluateRule(rule, context);

      this.logger.debug(
        {
          rule,
          result,
          orgId: context.orgId,
          executionId: context.meta?.executionId,
        },
        'Condition evaluation completed',
      );

      return Boolean(result);
    } catch (error) {
      this.logger.error(
        {
          rule,
          error: error instanceof Error ? error.message : 'Unknown error',
          orgId: context.orgId,
          executionId: context.meta?.executionId,
        },
        'Failed to evaluate executeIf condition',
      );

      throw new BadRequestException(
        `Invalid executeIf rule: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'INVALID_CONDITION_RULE',
      );
    }
  }

  /**
   * Validate a condition rule without executing it
   */
  validateRule(rule: any): { valid: boolean; error?: string } {
    if (!rule) {
      return { valid: true };
    }

    try {
      // Test with mock context
      const mockContext = {
        inputs: { test: 'value' },
        variables: { test: 'value' },
        stepOutputs: { test: 'value' },
      };

      this.evaluateRule(rule, mockContext);
      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get available context variables for condition building
   */
  getAvailableVariables(): string[] {
    return [
      'inputs.*',
      'variables.*',
      'stepOutputs.*',
      'currentStep.*',
      'orgId',
      'userId',
      'meta.flowId',
      'meta.executionId',
      'meta.stepId',
    ];
  }

  /**
   * Internal rule evaluation logic
   */
  private evaluateRule(rule: any, context: ConditionContext): any {
    // Set current context for custom operations
    this.currentContext = context;

    try {
      // Handle JSONLogic format
      if (this.isJSONLogicRule(rule)) {
        return jsonLogic.apply(rule, context);
      }

      // Handle simple comparison format
      if (this.isSimpleComparisonRule(rule)) {
        return this.evaluateSimpleComparison(rule, context);
      }

      // Handle custom DSL format
      if (this.isCustomDSLRule(rule)) {
        return this.evaluateCustomDSL(rule, context);
      }

      // Default: treat as JSONLogic
      return jsonLogic.apply(rule, context);
    } finally {
      // Clear current context
      this.currentContext = null;
    }
  }

  /**
   * Check if rule is in JSONLogic format
   */
  private isJSONLogicRule(rule: any): boolean {
    if (!rule || typeof rule !== 'object') {
      return false;
    }

    // JSONLogic rules typically have operators as keys
    const operators = [
      '==',
      '!=',
      '===',
      '!==',
      '<',
      '<=',
      '>',
      '>=',
      'and',
      'or',
      'not',
      '!',
      'if',
      '?:',
      'var',
      'missing',
      'missing_some',
      'in',
      'cat',
      'substr',
      'merge',
      '+',
      '-',
      '*',
      '/',
      '%',
      'min',
      'max',
      'reduce',
      'map',
      'filter',
      'all',
      'none',
      'some',
      // Custom operations we've added
      'exists',
      'isEmpty',
      'regex',
    ];

    return operators.some(op => op in rule);
  }

  /**
   * Check if rule is a simple comparison
   */
  private isSimpleComparisonRule(rule: any): boolean {
    return (
      rule && typeof rule === 'object' && 'field' in rule && 'operator' in rule && 'value' in rule
    );
  }

  /**
   * Check if rule is custom DSL format
   */
  private isCustomDSLRule(rule: any): boolean {
    return rule && typeof rule === 'object' && 'type' in rule && rule.type === 'custom';
  }

  /**
   * Evaluate simple comparison rules
   * Format: { field: "inputs.priority", operator: "==", value: "high" }
   */
  private evaluateSimpleComparison(rule: any, context: ConditionContext): boolean {
    const { field, operator, value } = rule;

    const fieldValue = this.getFieldValue(field, context);

    switch (operator) {
      case '==':
      case 'equals':
        return fieldValue == value;
      case '===':
      case 'strictEquals':
        return fieldValue === value;
      case '!=':
      case 'notEquals':
        return fieldValue != value;
      case '!==':
      case 'strictNotEquals':
        return fieldValue !== value;
      case '>':
      case 'greaterThan':
        return Number(fieldValue) > Number(value);
      case '>=':
      case 'greaterThanOrEqual':
        return Number(fieldValue) >= Number(value);
      case '<':
      case 'lessThan':
        return Number(fieldValue) < Number(value);
      case '<=':
      case 'lessThanOrEqual':
        return Number(fieldValue) <= Number(value);
      case 'contains':
        return String(fieldValue).includes(String(value));
      case 'startsWith':
        return String(fieldValue).startsWith(String(value));
      case 'endsWith':
        return String(fieldValue).endsWith(String(value));
      case 'in':
        return Array.isArray(value) && value.includes(fieldValue);
      case 'notIn':
        return Array.isArray(value) && !value.includes(fieldValue);
      case 'exists':
        return fieldValue !== undefined && fieldValue !== null;
      case 'notExists':
        return fieldValue === undefined || fieldValue === null;
      default:
        throw new Error(`Unknown operator: ${operator}`);
    }
  }

  /**
   * Evaluate custom DSL rules (extensible for future custom logic)
   */
  private evaluateCustomDSL(rule: any, context: ConditionContext): boolean {
    const { type, ...config } = rule;

    switch (type) {
      case 'timeWindow':
        return this.evaluateTimeWindow(config, context);
      case 'userRole':
        return this.evaluateUserRole(config, context);
      case 'stepOutput':
        return this.evaluateStepOutput(config, context);
      default:
        throw new Error(`Unknown custom rule type: ${type}`);
    }
  }

  /**
   * Get field value from context using dot notation
   */
  private getFieldValue(field: string, context: ConditionContext): any {
    const parts = field.split('.');
    let value: any = context;

    for (const part of parts) {
      if (value && typeof value === 'object' && part in value) {
        value = value[part];
      } else {
        return undefined;
      }
    }

    return value;
  }

  /**
   * Register custom JSONLogic operations
   */
  private registerCustomOperations(): void {
    // Add custom 'exists' operation
    jsonLogic.add_operation('exists', (field: string) => {
      if (!this.currentContext) {
        return false;
      }
      const value = this.getFieldValue(field, this.currentContext);
      return value !== undefined && value !== null;
    });

    // Add custom 'isEmpty' operation
    jsonLogic.add_operation('isEmpty', (field: string) => {
      if (!this.currentContext) {
        return true;
      }
      const value = this.getFieldValue(field, this.currentContext);
      if (value === undefined || value === null) {
        return true;
      }
      if (typeof value === 'string') {
        return value.trim() === '';
      }
      if (Array.isArray(value)) {
        return value.length === 0;
      }
      if (typeof value === 'object') {
        return Object.keys(value).length === 0;
      }
      return false;
    });

    // Add custom 'regex' operation
    jsonLogic.add_operation('regex', (pattern: string, value: string) => {
      try {
        const regex = new RegExp(pattern);
        return regex.test(String(value));
      } catch {
        return false;
      }
    });
  }

  private currentContext: ConditionContext | null = null;

  /**
   * Custom DSL: Time window evaluation
   */
  private evaluateTimeWindow(config: any, context: ConditionContext): boolean {
    const { start, end, timezone = 'UTC' } = config;
    const now = new Date();

    // Implementation would depend on specific time window logic
    // This is a placeholder for custom time-based conditions
    return true;
  }

  /**
   * Custom DSL: User role evaluation
   */
  private evaluateUserRole(config: any, context: ConditionContext): boolean {
    const { roles } = config;
    // This would integrate with your user role system
    // Placeholder implementation
    return true;
  }

  /**
   * Custom DSL: Step output evaluation
   */
  private evaluateStepOutput(config: any, context: ConditionContext): boolean {
    const { stepId, condition } = config;
    const stepOutput = context.stepOutputs?.[stepId];

    if (!stepOutput) {
      return false;
    }

    // Apply condition to step output
    return this.evaluateRule(condition, {
      ...context,
      inputs: stepOutput,
    });
  }
}
