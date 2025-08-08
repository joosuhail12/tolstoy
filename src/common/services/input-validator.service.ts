import { Injectable, BadRequestException } from '@nestjs/common';
import { z, ZodObject, ZodSchema } from 'zod';
import * as Sentry from '@sentry/nestjs';

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
