import { Injectable, BadRequestException } from '@nestjs/common';
import { z, ZodObject, ZodSchema } from 'zod';

export interface InputParameter {
  name: string;
  label?: string;
  type: 'string' | 'number' | 'boolean' | 'enum' | 'array' | 'object';
  required: boolean;
  description?: string;
  control?: 'text' | 'textarea' | 'select' | 'checkbox' | 'number';
  default?: any;
  options?: string[];
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    email?: boolean;
    url?: boolean;
  };
}

@Injectable()
export class InputValidatorService {
  buildZodSchema(paramList: InputParameter[]): ZodObject<any> {
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
            throw new BadRequestException(`Enum parameter '${param.name}' must have options defined`);
          }
          base = z.enum(param.options as [string, ...string[]]);
          break;
        case 'array':
          base = z.array(z.any());
          break;
        case 'object':
          base = z.object({}).passthrough();
          break;
        default:
          base = z.any();
      }

      if (param.default !== undefined && param.default !== null) {
        base = base.default(param.default);
      }

      shape[param.name] = param.required ? base : base.optional();
    }

    return z.object(shape);
  }

  validate(paramList: InputParameter[], inputData: any): any {
    try {
      const schema = this.buildZodSchema(paramList);
      return schema.parse(inputData || {});
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        const formattedErrors = err.issues.map(issue => ({
          field: issue.path.join('.'),
          message: issue.message,
          code: issue.code
        }));

        throw new BadRequestException({
          message: 'Input validation failed',
          errors: formattedErrors,
          details: err.issues
        });
      }

      throw new BadRequestException({
        message: 'Input validation failed',
        error: err.message || 'Unknown validation error'
      });
    }
  }

  validateAsync(paramList: InputParameter[], inputData: any): Promise<any> {
    try {
      const result = this.validate(paramList, inputData);
      return Promise.resolve(result);
    } catch (error) {
      return Promise.reject(error);
    }
  }

  getSchemaDescription(paramList: InputParameter[]): Record<string, any> {
    return paramList.reduce((acc, param) => {
      acc[param.name] = {
        type: param.type,
        required: param.required,
        description: param.description,
        label: param.label,
        control: param.control,
        default: param.default,
        options: param.options,
        validation: param.validation
      };
      return acc;
    }, {} as Record<string, any>);
  }
}