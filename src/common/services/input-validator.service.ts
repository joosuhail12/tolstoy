import { Injectable, BadRequestException, Optional } from '@nestjs/common';
import { z, ZodObject, ZodSchema } from 'zod';
import * as Sentry from '@sentry/nestjs';
import * as jsonLogic from 'json-logic-js';
import {
  ActionInputParam,
  InputParam,
  isEnhancedInputParam,
  migrateToEnhancedParam,
} from '../../actions/types';
import { MetricsService, ValidationMetricLabels } from '../../metrics/metrics.service';

export type InputParameterDefaultValue =
  | string
  | number
  | boolean
  | string[]
  | Record<string, unknown>;

export interface InputValidationRules {
  min?: number;
  max?: number;
  pattern?: string;
  email?: boolean;
  url?: boolean;
}

export interface InputParameter {
  name: string;
  label?: string;
  type: 'string' | 'number' | 'boolean' | 'enum' | 'array' | 'object';
  required: boolean;
  description?: string;
  control?: 'text' | 'textarea' | 'select' | 'checkbox' | 'number';
  default?: InputParameterDefaultValue;
  options?: string[];
  validation?: InputValidationRules;
}

export type ValidatedInputData = Record<
  string,
  string | number | boolean | string[] | Record<string, unknown>
>;

export interface ValidationErrorDetail {
  field: string;
  message: string;
  code: string;
}

export interface SchemaPropertyDescription {
  type: 'string' | 'number' | 'boolean' | 'enum' | 'array' | 'object';
  required: boolean;
  description?: string | undefined;
  label?: string | undefined;
  control?: 'text' | 'textarea' | 'select' | 'checkbox' | 'number' | undefined;
  default?: InputParameterDefaultValue | undefined;
  options?: string[] | undefined;
  validation?: InputValidationRules | undefined;
}

@Injectable()
export class InputValidatorService {
  constructor(@Optional() private readonly metricsService?: MetricsService) {}

  /**
   * Enhanced validation method supporting both legacy and new formats
   */
  validateEnhanced(
    params: InputParam[],
    inputData: unknown,
    context?: { orgId: string; actionKey?: string; contextType?: string },
  ): ValidatedInputData {
    // Convert legacy params to enhanced format for processing
    const enhancedParams = params.map(param =>
      isEnhancedInputParam(param) ? param : migrateToEnhancedParam(param),
    );

    try {
      // Pre-filter parameters based on visibility conditions
      const visibleParams = this.filterVisibleParams(enhancedParams, inputData || {});
      
      const schema = this.buildEnhancedZodSchema(visibleParams);
      const validated = schema.parse(inputData || {}) as ValidatedInputData;

      return validated;
    } catch (err: unknown) {
      // Record validation error metrics if context is provided
      if (context && this.metricsService) {
        this.recordValidationErrorMetrics(err, context);
      }
      return this.handleValidationError(err, enhancedParams, inputData);
    }
  }

  /**
   * Filter parameters based on visibility conditions
   */
  private filterVisibleParams(
    params: ActionInputParam[],
    inputData: Record<string, unknown>,
  ): ActionInputParam[] {
    return params.filter((param) => {
      if (!param.visibleIf) {
        return true; // Always visible if no condition
      }

      try {
        return jsonLogic.apply(param.visibleIf, inputData);
      } catch (error) {
        // Log visibility evaluation error but include field by default
        console.warn(`Failed to evaluate visibility condition for ${param.name}:`, error);
        return true;
      }
    });
  }

  /**
   * Build Zod schema from enhanced ActionInputParam format
   */
  buildEnhancedZodSchema(params: ActionInputParam[]): ZodObject<Record<string, ZodSchema>> {
    const shape: Record<string, ZodSchema> = {};

    for (const param of params) {
      let base: ZodSchema;

      // Build base schema based on type
      switch (param.type) {
        case 'string':
          base = z.string();
          // Apply validation constraints for strings
          if (param.validation) {
            base = this.applyStringValidation(base as z.ZodString, param);
          }
          break;
        case 'number': {
          // For numbers, we need to handle preprocessing and validation together
          let numberSchema = z.number();
          if (param.validation) {
            numberSchema = this.applyNumberValidation(numberSchema, param);
          }

          // For optional numbers, handle empty/null/undefined by returning undefined
          if (!param.required) {
            base = z.preprocess(val => {
              if (val === '' || val === null || val === undefined) {
                return undefined;
              }
              const num = Number(val);
              return isNaN(num) ? val : num;
            }, numberSchema.optional());
          } else {
            base = z.preprocess(val => {
              if (val === '' || val === null || val === undefined) {
                return val;
              } // Let Zod handle required validation
              const num = Number(val);
              return isNaN(num) ? val : num;
            }, numberSchema);
          }
          break;
        }
        case 'boolean':
          base = z.preprocess(val => {
            if (typeof val === 'string') {
              return val.toLowerCase() === 'true' || val === '1';
            }
            return Boolean(val);
          }, z.boolean());
          break;
        case 'enum':
          if (!param.options || param.options.length === 0) {
            const error = new BadRequestException(
              `Enum parameter '${param.name}' must have options defined`,
            );
            this.captureSchemaError(error, param);
            throw error;
          }
          base = z.enum(param.options as [string, ...string[]]);
          break;
        case 'date':
          base = z
            .string()
            .refine(val => !isNaN(Date.parse(val)), { message: 'Invalid date format' });
          break;
        default:
          base = z.any();
      }

      // Apply default value
      if (param.default !== undefined) {
        base = base.default(param.default);
      }

      // Make optional if not required (except for numbers which handle this internally)
      if (!param.required && param.type !== 'number') {
        base = base.optional();
      }

      shape[param.name] = base;
    }

    return z.object(shape);
  }

  /**
   * Apply string validation constraints
   */
  private applyStringValidation(schema: z.ZodString, param: ActionInputParam): z.ZodString {
    const { validation } = param;
    if (!validation) {
      return schema;
    }

    let stringSchema = schema;

    if (validation.min !== undefined) {
      stringSchema = stringSchema.min(validation.min, validation.message);
    }
    if (validation.max !== undefined) {
      stringSchema = stringSchema.max(validation.max, validation.message);
    }
    if (validation.pattern) {
      stringSchema = stringSchema.regex(
        new RegExp(validation.pattern),
        validation.message || 'Pattern validation failed',
      );
    }
    if (validation.format === 'email') {
      stringSchema = stringSchema.email(validation.message || 'Invalid email format');
    }
    if (validation.format === 'url') {
      stringSchema = stringSchema.url(validation.message || 'Invalid URL format');
    }

    return stringSchema;
  }

  /**
   * Apply number validation constraints
   */
  private applyNumberValidation(schema: z.ZodNumber, param: ActionInputParam): z.ZodNumber {
    const { validation } = param;
    if (!validation) {
      return schema;
    }

    let numberSchema = schema;

    if (validation.min !== undefined) {
      numberSchema = numberSchema.min(validation.min, validation.message);
    }
    if (validation.max !== undefined) {
      numberSchema = numberSchema.max(validation.max, validation.message);
    }

    return numberSchema;
  }


  /**
   * Handle validation errors with enhanced error reporting
   */
  private handleValidationError(
    err: unknown,
    params: ActionInputParam[],
    inputData: unknown,
  ): ValidatedInputData {
    if (err instanceof z.ZodError) {
      const formattedErrors: ValidationErrorDetail[] = err.issues.map(issue => ({
        field: issue.path.join('.'),
        message: issue.message,
        code: issue.code,
      }));

      // Enhanced Sentry reporting
      Sentry.addBreadcrumb({
        message: 'Enhanced input validation failed',
        category: 'validation',
        level: 'warning',
        data: {
          errorCount: err.issues.length,
          fields: err.issues.map(issue => issue.path.join('.')),
          inputKeys:
            inputData && typeof inputData === 'object' && inputData !== null
              ? Object.keys(inputData)
              : [],
          parameterCount: params.length,
          enhancedFormat: true,
        },
      });

      Sentry.withScope(scope => {
        scope.setTag('errorType', 'enhanced-validation');
        scope.setLevel('warning');
        scope.setContext('enhancedValidationFailure', {
          issues: formattedErrors,
          inputDataKeys:
            inputData && typeof inputData === 'object' && inputData !== null
              ? Object.keys(inputData)
              : [],
          parameters: params.map(p => ({
            name: p.name,
            type: p.type,
            required: p.required,
            control: p.control,
            hasVisibility: !!p.visibleIf,
          })),
        });
        Sentry.captureException(err);
      });

      throw new BadRequestException({
        message: 'Input validation failed',
        errors: formattedErrors,
        details: err.issues,
      });
    }

    // Handle non-Zod errors
    this.captureValidationError(err, params, inputData);
    throw new BadRequestException({
      message: 'Input validation failed',
      error: err instanceof Error ? err.message : 'Unknown validation error',
    });
  }

  /**
   * Capture schema building errors
   */
  private captureSchemaError(error: Error, param: ActionInputParam): void {
    Sentry.withScope(scope => {
      scope.setTag('errorType', 'enhanced-schema-building');
      scope.setLevel('error');
      scope.setContext('enhancedSchemaBuildingError', {
        parameterName: param.name,
        parameterType: param.type,
        parameterControl: param.control,
        hasOptions: !!param.options?.length,
        reason: 'enum-without-options',
      });
      Sentry.captureException(error);
    });
  }

  /**
   * Capture validation errors
   */
  private captureValidationError(
    err: unknown,
    params: ActionInputParam[],
    inputData: unknown,
  ): void {
    Sentry.withScope(scope => {
      scope.setTag('errorType', 'enhanced-validation-unknown');
      scope.setLevel('error');
      scope.setContext('enhancedValidationError', {
        errorMessage: err instanceof Error ? err.message : 'Unknown error',
        inputDataKeys:
          inputData && typeof inputData === 'object' && inputData !== null
            ? Object.keys(inputData)
            : [],
        parameterCount: params.length,
        enhancedFormat: true,
      });
      Sentry.captureException(err);
    });
  }

  /**
   * Record validation error metrics
   */
  private recordValidationErrorMetrics(
    err: unknown,
    context: { orgId: string; actionKey?: string; contextType?: string },
  ): void {
    if (!this.metricsService) {
      return;
    }

    if (err instanceof z.ZodError) {
      // Count different types of validation errors
      const errorTypeCounts: Record<string, number> = {};

      for (const issue of err.issues) {
        let errorType: string;
        switch (issue.code) {
          case 'invalid_type':
            errorType = 'type-validation';
            break;
          case 'too_small':
          case 'too_big':
            errorType = 'range-validation';
            break;
          case 'invalid_format':
            errorType = 'format-validation';
            break;
          case 'custom':
            errorType = 'custom-validation';
            break;
          case 'unrecognized_keys':
            errorType = 'unknown-field';
            break;
          case 'invalid_union':
            errorType = 'union-validation';
            break;
          default:
            errorType = 'unknown-validation';
        }

        errorTypeCounts[errorType] = (errorTypeCounts[errorType] || 0) + 1;
      }

      // Record metrics for each error type
      for (const [errorType, count] of Object.entries(errorTypeCounts)) {
        const labels: ValidationMetricLabels = {
          orgId: context.orgId,
          actionKey: context.actionKey || 'unknown',
          context: context.contextType || 'unknown',
          errorType,
        };

        for (let i = 0; i < count; i++) {
          this.metricsService.incrementValidationErrors(labels);
        }
      }
    } else {
      // Record general validation error
      const labels: ValidationMetricLabels = {
        orgId: context.orgId,
        actionKey: context.actionKey || 'unknown',
        context: context.contextType || 'unknown',
        errorType: 'system-error',
      };
      this.metricsService.incrementValidationErrors(labels);
    }
  }

  /**
   * Get enhanced schema description for UI generation
   */
  getEnhancedSchemaDescription(params: ActionInputParam[]): Record<string, ActionInputParam> {
    return params.reduce(
      (acc, param) => {
        acc[param.name] = param;
        return acc;
      },
      {} as Record<string, ActionInputParam>,
    );
  }
  buildZodSchema(paramList: InputParameter[]): ZodObject<Record<string, ZodSchema>> {
    const shape: Record<string, ZodSchema> = {};

    for (const param of paramList) {
      let base: ZodSchema;

      switch (param.type) {
        case 'string':
          base = z.string();
          if (param.validation?.min) {
            base = (base as z.ZodString).min(param.validation.min);
          }
          if (param.validation?.max) {
            base = (base as z.ZodString).max(param.validation.max);
          }
          if (param.validation?.pattern) {
            base = (base as z.ZodString).regex(new RegExp(param.validation.pattern));
          }
          if (param.validation?.email) {
            base = (base as z.ZodString).email();
          }
          if (param.validation?.url) {
            base = (base as z.ZodString).url();
          }
          break;
        case 'number':
          base = z.number();
          if (param.validation?.min !== undefined) {
            base = (base as z.ZodNumber).min(param.validation.min);
          }
          if (param.validation?.max !== undefined) {
            base = (base as z.ZodNumber).max(param.validation.max);
          }
          break;
        case 'boolean':
          base = z.boolean();
          break;
        case 'enum':
          if (!param.options || param.options.length === 0) {
            const error = new BadRequestException(
              `Enum parameter '${param.name}' must have options defined`,
            );

            // Capture schema building error in Sentry
            Sentry.withScope(scope => {
              scope.setTag('errorType', 'schema-building');
              scope.setLevel('error');
              scope.setContext('schemaBuildingError', {
                parameterName: param.name,
                parameterType: param.type,
                reason: 'enum-without-options',
              });

              Sentry.captureException(error);
            });

            throw error;
          }
          base = z.enum(param.options as [string, ...string[]]);
          break;
        case 'array':
          base = z.array(z.unknown());
          break;
        case 'object':
          base = z.object({}).passthrough();
          break;
        default:
          base = z.unknown();
      }

      if (param.default !== undefined && param.default !== null) {
        base = base.default(param.default);
      }

      shape[param.name] = param.required ? base : base.optional();
    }

    return z.object(shape);
  }

  validate(paramList: InputParameter[], inputData: unknown): ValidatedInputData {
    try {
      const schema = this.buildZodSchema(paramList);
      return schema.parse(inputData || {}) as ValidatedInputData;
    } catch (err: unknown) {
      if (err instanceof z.ZodError) {
        const formattedErrors: ValidationErrorDetail[] = err.issues.map(issue => ({
          field: issue.path.join('.'),
          message: issue.message,
          code: issue.code,
        }));

        // Add Sentry breadcrumb for validation failure
        Sentry.addBreadcrumb({
          message: 'Input validation failed',
          category: 'validation',
          level: 'warning',
          data: {
            errorCount: err.issues.length,
            fields: err.issues.map(issue => issue.path.join('.')),
            inputKeys:
              inputData && typeof inputData === 'object' && inputData !== null
                ? Object.keys(inputData)
                : [],
            parameterCount: paramList.length,
          },
        });

        // Capture validation error details in Sentry
        Sentry.withScope(scope => {
          scope.setTag('errorType', 'validation');
          scope.setLevel('warning');
          scope.setContext('validationFailure', {
            issues: formattedErrors,
            inputDataKeys:
              inputData && typeof inputData === 'object' && inputData !== null
                ? Object.keys(inputData)
                : [],
            parameters: paramList.map(p => ({ name: p.name, type: p.type, required: p.required })),
          });

          Sentry.captureException(err);
        });

        throw new BadRequestException({
          message: 'Input validation failed',
          errors: formattedErrors,
          details: err.issues,
        });
      }

      // For non-Zod errors, capture with different context
      Sentry.withScope(scope => {
        scope.setTag('errorType', 'validation-unknown');
        scope.setLevel('error');
        scope.setContext('validationError', {
          errorMessage: err instanceof Error ? err.message : 'Unknown error',
          inputDataKeys:
            inputData && typeof inputData === 'object' && inputData !== null
              ? Object.keys(inputData)
              : [],
          parameterCount: paramList.length,
        });

        Sentry.captureException(err);
      });

      throw new BadRequestException({
        message: 'Input validation failed',
        error: err instanceof Error ? err.message : 'Unknown validation error',
      });
    }
  }

  validateAsync(paramList: InputParameter[], inputData: unknown): Promise<ValidatedInputData> {
    try {
      const result = this.validate(paramList, inputData);
      return Promise.resolve(result);
    } catch (error) {
      return Promise.reject(error);
    }
  }

  getSchemaDescription(paramList: InputParameter[]): Record<string, SchemaPropertyDescription> {
    return paramList.reduce(
      (acc, param) => {
        acc[param.name] = {
          type: param.type,
          required: param.required,
          description: param.description,
          label: param.label,
          control: param.control,
          default: param.default,
          options: param.options,
          validation: param.validation,
        };
        return acc;
      },
      {} as Record<string, SchemaPropertyDescription>,
    );
  }
}
