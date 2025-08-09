import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { InputValidatorService } from './input-validator.service';
import { MetricsService } from '../../metrics/metrics.service';
import { ActionInputParam, InputParam } from '../../actions/types';

describe('InputValidatorService', () => {
  let service: InputValidatorService;
  let metricsService: any;

  const mockMetricsService = {
    incrementValidationErrors: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [InputValidatorService, { provide: MetricsService, useValue: mockMetricsService }],
    }).compile();

    service = module.get<InputValidatorService>(InputValidatorService);
    metricsService = module.get(MetricsService);

    jest.clearAllMocks();
  });

  describe('validateEnhanced', () => {
    const context = {
      orgId: 'org-123',
      actionKey: 'test-action',
      contextType: 'action-execution',
    };

    describe('string validation', () => {
      it('should validate required string fields', () => {
        const params: ActionInputParam[] = [
          {
            name: 'email',
            label: 'Email Address',
            type: 'string',
            required: true,
            control: 'text',
          },
        ];

        const result = service.validateEnhanced(params, { email: 'test@example.com' }, context);

        expect(result).toEqual({ email: 'test@example.com' });
      });

      it('should apply default values for optional fields', () => {
        const params: ActionInputParam[] = [
          {
            name: 'name',
            label: 'Name',
            type: 'string',
            required: false,
            control: 'text',
            default: 'Anonymous',
          },
        ];

        const result = service.validateEnhanced(params, {}, context);

        expect(result).toEqual({ name: 'Anonymous' });
      });

      it('should validate string pattern constraints', () => {
        const params: ActionInputParam[] = [
          {
            name: 'phone',
            label: 'Phone Number',
            type: 'string',
            required: true,
            control: 'text',
            validation: {
              pattern: '^\\+?[1-9]\\d{1,14}$',
            },
          },
        ];

        const validResult = service.validateEnhanced(params, { phone: '+1234567890' }, context);
        expect(validResult).toEqual({ phone: '+1234567890' });

        expect(() => {
          service.validateEnhanced(params, { phone: 'invalid-phone' }, context);
        }).toThrow(BadRequestException);
      });

      it('should validate minimum and maximum length', () => {
        const params: ActionInputParam[] = [
          {
            name: 'password',
            label: 'Password',
            type: 'string',
            required: true,
            control: 'text',
            validation: {
              min: 8,
              max: 20,
            },
          },
        ];

        const validResult = service.validateEnhanced(params, { password: 'validpass123' }, context);
        expect(validResult).toEqual({ password: 'validpass123' });

        expect(() => {
          service.validateEnhanced(params, { password: 'short' }, context);
        }).toThrow(BadRequestException);

        expect(() => {
          service.validateEnhanced(params, { password: 'a'.repeat(25) }, context);
        }).toThrow(BadRequestException);
      });
    });

    describe('number validation', () => {
      it('should validate required number fields', () => {
        const params: ActionInputParam[] = [
          {
            name: 'age',
            label: 'Age',
            type: 'number',
            required: true,
            control: 'number',
          },
        ];

        const result = service.validateEnhanced(params, { age: 25 }, context);
        expect(result).toEqual({ age: 25 });
      });

      it('should convert string numbers to numbers', () => {
        const params: ActionInputParam[] = [
          {
            name: 'count',
            label: 'Count',
            type: 'number',
            required: true,
            control: 'number',
          },
        ];

        const result = service.validateEnhanced(params, { count: '42' }, context);
        expect(result).toEqual({ count: 42 });
      });

      it('should handle optional number fields with empty values', () => {
        const params: ActionInputParam[] = [
          {
            name: 'score',
            label: 'Score',
            type: 'number',
            required: false,
            control: 'number',
            default: 0,
          },
        ];

        const result1 = service.validateEnhanced(params, { score: '' }, context);
        expect(result1).toEqual({ score: 0 });

        const result2 = service.validateEnhanced(params, {}, context);
        expect(result2).toEqual({ score: 0 });
      });

      it('should validate number range constraints', () => {
        const params: ActionInputParam[] = [
          {
            name: 'percentage',
            label: 'Percentage',
            type: 'number',
            required: true,
            control: 'number',
            validation: {
              min: 0,
              max: 100,
            },
          },
        ];

        const validResult = service.validateEnhanced(params, { percentage: 75 }, context);
        expect(validResult).toEqual({ percentage: 75 });

        expect(() => {
          service.validateEnhanced(params, { percentage: -10 }, context);
        }).toThrow(BadRequestException);

        expect(() => {
          service.validateEnhanced(params, { percentage: 150 }, context);
        }).toThrow(BadRequestException);
      });
    });

    describe('boolean validation', () => {
      it('should validate boolean fields', () => {
        const params: ActionInputParam[] = [
          {
            name: 'enabled',
            label: 'Enabled',
            type: 'boolean',
            required: true,
            control: 'checkbox',
          },
        ];

        const result1 = service.validateEnhanced(params, { enabled: true }, context);
        expect(result1).toEqual({ enabled: true });

        const result2 = service.validateEnhanced(params, { enabled: false }, context);
        expect(result2).toEqual({ enabled: false });
      });

      it('should convert string booleans', () => {
        const params: ActionInputParam[] = [
          {
            name: 'active',
            label: 'Active',
            type: 'boolean',
            required: true,
            control: 'checkbox',
          },
        ];

        const result1 = service.validateEnhanced(params, { active: 'true' }, context);
        expect(result1).toEqual({ active: true });

        const result2 = service.validateEnhanced(params, { active: '1' }, context);
        expect(result2).toEqual({ active: true });

        const result3 = service.validateEnhanced(params, { active: 'false' }, context);
        expect(result3).toEqual({ active: false });

        const result4 = service.validateEnhanced(params, { active: '0' }, context);
        expect(result4).toEqual({ active: false });
      });
    });

    describe('enum validation', () => {
      it('should validate enum fields', () => {
        const params: ActionInputParam[] = [
          {
            name: 'status',
            label: 'Status',
            type: 'enum',
            required: true,
            control: 'select',
            options: ['pending', 'active', 'inactive'],
          },
        ];

        const result = service.validateEnhanced(params, { status: 'active' }, context);
        expect(result).toEqual({ status: 'active' });

        expect(() => {
          service.validateEnhanced(params, { status: 'invalid-status' }, context);
        }).toThrow(BadRequestException);
      });

      it('should apply default enum values', () => {
        const params: ActionInputParam[] = [
          {
            name: 'priority',
            label: 'Priority',
            type: 'enum',
            required: false,
            control: 'select',
            options: ['low', 'medium', 'high'],
            default: 'medium',
          },
        ];

        const result = service.validateEnhanced(params, {}, context);
        expect(result).toEqual({ priority: 'medium' });
      });
    });

    describe('date validation', () => {
      it('should validate date fields', () => {
        const params: ActionInputParam[] = [
          {
            name: 'dueDate',
            label: 'Due Date',
            type: 'date',
            required: true,
            control: 'date-picker',
          },
        ];

        const dateString = '2023-12-25';
        const result = service.validateEnhanced(params, { dueDate: dateString }, context);
        expect(result.dueDate).toBe(dateString); // Date validation currently returns string
      });
    });

    describe('visibility conditions (visibleIf)', () => {
      it('should hide fields based on JSONLogic conditions', () => {
        const params: ActionInputParam[] = [
          {
            name: 'type',
            label: 'Type',
            type: 'enum',
            required: true,
            control: 'select',
            options: ['email', 'sms'],
          },
          {
            name: 'emailAddress',
            label: 'Email Address',
            type: 'string',
            required: true,
            control: 'text',
            visibleIf: { '==': [{ var: 'type' }, 'email'] },
          },
          {
            name: 'phoneNumber',
            label: 'Phone Number',
            type: 'string',
            required: true,
            control: 'text',
            visibleIf: { '==': [{ var: 'type' }, 'sms'] },
          },
        ];

        // When type is 'email', only emailAddress should be visible
        const result1 = service.validateEnhanced(
          params,
          { type: 'email', emailAddress: 'test@example.com' },
          context,
        );
        expect(result1).toEqual({ type: 'email', emailAddress: 'test@example.com' });

        // When type is 'sms', only phoneNumber should be visible
        const result2 = service.validateEnhanced(
          params,
          { type: 'sms', phoneNumber: '+1234567890' },
          context,
        );
        expect(result2).toEqual({ type: 'sms', phoneNumber: '+1234567890' });
      });

      it('should handle complex JSONLogic conditions', () => {
        const params: ActionInputParam[] = [
          {
            name: 'hasAdvanced',
            label: 'Has Advanced Options',
            type: 'boolean',
            required: false,
            control: 'checkbox',
            default: false,
          },
          {
            name: 'level',
            label: 'Level',
            type: 'number',
            required: false,
            control: 'number',
            default: 1,
          },
          {
            name: 'advancedOption',
            label: 'Advanced Option',
            type: 'string',
            required: false,
            control: 'text',
            visibleIf: { and: [{ var: 'hasAdvanced' }, { '>': [{ var: 'level' }, 2] }] },
          },
        ];

        // Should be visible when hasAdvanced=true AND level>2
        const result = service.validateEnhanced(
          params,
          { hasAdvanced: true, level: 3, advancedOption: 'test' },
          context,
        );
        expect(result.advancedOption).toBe('test');
      });
    });

    describe('required field validation', () => {
      it('should throw error for missing required fields', () => {
        const params: ActionInputParam[] = [
          {
            name: 'requiredField',
            label: 'Required Field',
            type: 'string',
            required: true,
            control: 'text',
          },
        ];

        expect(() => {
          service.validateEnhanced(params, {}, context);
        }).toThrow(BadRequestException);
      });

      it('should not require optional fields', () => {
        const params: ActionInputParam[] = [
          {
            name: 'optionalField',
            label: 'Optional Field',
            type: 'string',
            required: false,
            control: 'text',
          },
        ];

        const result = service.validateEnhanced(params, {}, context);
        expect(result).toEqual({});
      });
    });

    describe('error handling and metrics', () => {
      it('should record validation error metrics', () => {
        const params: ActionInputParam[] = [
          {
            name: 'email',
            label: 'Email',
            type: 'string',
            required: true,
            control: 'text',
            validation: {
              format: 'email',
            },
          },
        ];

        expect(() => {
          service.validateEnhanced(params, { email: 'invalid-email' }, context);
        }).toThrow(BadRequestException);

        // Verify metrics were recorded
        expect(metricsService.incrementValidationErrors).toHaveBeenCalledWith({
          orgId: 'org-123',
          actionKey: 'test-action',
          context: 'action-execution',
          errorType: expect.any(String),
        });
      });

      it('should categorize validation errors correctly', () => {
        const params: ActionInputParam[] = [
          {
            name: 'count',
            label: 'Count',
            type: 'number',
            required: true,
            control: 'number',
            validation: {
              min: 1,
              max: 10,
            },
          },
        ];

        expect(() => {
          service.validateEnhanced(params, { count: 15 }, context);
        }).toThrow(BadRequestException);

        expect(metricsService.incrementValidationErrors).toHaveBeenCalledWith({
          orgId: 'org-123',
          actionKey: 'test-action',
          context: 'action-execution',
          errorType: 'range-validation',
        });
      });

      it('should handle multiple validation errors', () => {
        const params: ActionInputParam[] = [
          {
            name: 'name',
            label: 'Name',
            type: 'string',
            required: true,
            control: 'text',
          },
          {
            name: 'email',
            label: 'Email',
            type: 'string',
            required: true,
            control: 'text',
            validation: {
              format: 'email',
            },
          },
        ];

        expect(() => {
          service.validateEnhanced(params, { email: 'invalid-email' }, context);
        }).toThrow(BadRequestException);

        // Should record metrics for the validation failure
        expect(metricsService.incrementValidationErrors).toHaveBeenCalled();
      });
    });

    describe('legacy format compatibility', () => {
      it('should handle legacy InputParam format', () => {
        const legacyParams: InputParam[] = [
          {
            name: 'oldField',
            type: 'string',
            required: true,
            description: 'Legacy field',
          },
        ];

        const result = service.validateEnhanced(legacyParams, { oldField: 'value' }, context);
        expect(result).toEqual({ oldField: 'value' });
      });

      it('should migrate legacy params to enhanced format', () => {
        const legacyParams: InputParam[] = [
          {
            name: 'legacyEnum',
            type: 'enum',
            required: false,
            options: ['option1', 'option2'],
            default: 'option1',
          },
        ];

        const result = service.validateEnhanced(legacyParams, {}, context);
        expect(result).toEqual({ legacyEnum: 'option1' });
      });
    });

    describe('edge cases', () => {
      it('should handle empty input data', () => {
        const params: ActionInputParam[] = [
          {
            name: 'optional',
            label: 'Optional',
            type: 'string',
            required: false,
            control: 'text',
            default: 'default-value',
          },
        ];

        const result = service.validateEnhanced(params, null, context);
        expect(result).toEqual({ optional: 'default-value' });
      });

      it('should handle undefined context', () => {
        const params: ActionInputParam[] = [
          {
            name: 'field',
            label: 'Field',
            type: 'string',
            required: true,
            control: 'text',
          },
        ];

        const result = service.validateEnhanced(params, { field: 'value' });
        expect(result).toEqual({ field: 'value' });

        // Should not throw when context is undefined
        expect(() => {
          service.validateEnhanced(params, {});
        }).toThrow(BadRequestException);

        // Metrics should not be called without context
        expect(metricsService.incrementValidationErrors).not.toHaveBeenCalled();
      });

      it('should handle unexpected data types gracefully', () => {
        const params: ActionInputParam[] = [
          {
            name: 'number',
            label: 'Number',
            type: 'number',
            required: true,
            control: 'number',
          },
        ];

        expect(() => {
          service.validateEnhanced(params, { number: 'not-a-number' }, context);
        }).toThrow(BadRequestException);
      });
    });
  });
});
