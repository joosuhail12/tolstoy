import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { InputValidatorService } from './input-validator.service';
import { ActionInputParam } from '../../actions/types';

describe('InputValidatorService - Enhanced Features', () => {
  let service: InputValidatorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [InputValidatorService],
    }).compile();

    service = module.get<InputValidatorService>(InputValidatorService);
  });

  describe('Enhanced Validation', () => {
    describe('String Type Validation', () => {
      it('should validate string parameters with min/max length', () => {
        const params: ActionInputParam[] = [
          {
            name: 'message',
            type: 'string',
            required: true,
            control: 'text',
            validation: {
              min: 3,
              max: 10,
            },
          },
        ];

        const validData = { message: 'hello' };
        const result = service.validateEnhanced(params, validData);
        expect(result).toEqual(validData);

        // Test min length validation
        expect(() => {
          service.validateEnhanced(params, { message: 'hi' });
        }).toThrow(BadRequestException);

        // Test max length validation
        expect(() => {
          service.validateEnhanced(params, { message: 'this is too long' });
        }).toThrow(BadRequestException);
      });

      it('should validate string parameters with pattern', () => {
        const params: ActionInputParam[] = [
          {
            name: 'email',
            type: 'string',
            required: true,
            control: 'text',
            validation: {
              format: 'email',
            },
          },
        ];

        const validData = { email: 'test@example.com' };
        const result = service.validateEnhanced(params, validData);
        expect(result).toEqual(validData);

        expect(() => {
          service.validateEnhanced(params, { email: 'invalid-email' });
        }).toThrow(BadRequestException);
      });

      it('should validate string parameters with regex pattern', () => {
        const params: ActionInputParam[] = [
          {
            name: 'code',
            type: 'string',
            required: true,
            control: 'text',
            validation: {
              pattern: '^[A-Z]{3}-\\d{3}$',
              message: 'Code must be in format ABC-123',
            },
          },
        ];

        const validData = { code: 'ABC-123' };
        const result = service.validateEnhanced(params, validData);
        expect(result).toEqual(validData);

        expect(() => {
          service.validateEnhanced(params, { code: 'invalid-code' });
        }).toThrow(BadRequestException);
      });
    });

    describe('Number Type Validation', () => {
      it('should validate number parameters with min/max values', () => {
        const params: ActionInputParam[] = [
          {
            name: 'age',
            type: 'number',
            required: true,
            control: 'number',
            validation: {
              min: 18,
              max: 120,
            },
          },
        ];

        const validData = { age: 25 };
        const result = service.validateEnhanced(params, validData);
        expect(result).toEqual(validData);

        // Test min value validation
        expect(() => {
          service.validateEnhanced(params, { age: 17 });
        }).toThrow(BadRequestException);

        // Test max value validation
        expect(() => {
          service.validateEnhanced(params, { age: 121 });
        }).toThrow(BadRequestException);
      });

      it('should preprocess string numbers', () => {
        const params: ActionInputParam[] = [
          {
            name: 'count',
            type: 'number',
            required: true,
            control: 'number',
          },
        ];

        const result = service.validateEnhanced(params, { count: '42' });
        expect(result).toEqual({ count: 42 });
      });

      it('should handle empty string as undefined for optional numbers', () => {
        const params: ActionInputParam[] = [
          {
            name: 'optionalCount',
            type: 'number',
            required: false,
            control: 'number',
          },
        ];

        // Empty string should be processed as undefined, which means field is omitted
        const result = service.validateEnhanced(params, { optionalCount: '' });
        expect(result).toEqual({});

        // Test with other falsy values
        const nullResult = service.validateEnhanced(params, { optionalCount: null });
        expect(nullResult).toEqual({});

        const undefinedResult = service.validateEnhanced(params, { optionalCount: undefined });
        expect(undefinedResult).toEqual({});
      });
    });

    describe('Boolean Type Validation', () => {
      it('should validate boolean parameters', () => {
        const params: ActionInputParam[] = [
          {
            name: 'isActive',
            type: 'boolean',
            required: true,
            control: 'checkbox',
          },
        ];

        const validData = { isActive: true };
        const result = service.validateEnhanced(params, validData);
        expect(result).toEqual(validData);
      });

      it('should preprocess string booleans', () => {
        const params: ActionInputParam[] = [
          {
            name: 'enabled',
            type: 'boolean',
            required: true,
            control: 'checkbox',
          },
        ];

        // Test string 'true'
        let result = service.validateEnhanced(params, { enabled: 'true' });
        expect(result).toEqual({ enabled: true });

        // Test string 'false'
        result = service.validateEnhanced(params, { enabled: 'false' });
        expect(result).toEqual({ enabled: false });

        // Test string '1'
        result = service.validateEnhanced(params, { enabled: '1' });
        expect(result).toEqual({ enabled: true });

        // Test string '0'
        result = service.validateEnhanced(params, { enabled: '0' });
        expect(result).toEqual({ enabled: false });
      });
    });

    describe('Enum Type Validation', () => {
      it('should validate enum parameters', () => {
        const params: ActionInputParam[] = [
          {
            name: 'status',
            type: 'enum',
            required: true,
            control: 'select',
            options: ['draft', 'published', 'archived'],
          },
        ];

        const validData = { status: 'published' };
        const result = service.validateEnhanced(params, validData);
        expect(result).toEqual(validData);

        expect(() => {
          service.validateEnhanced(params, { status: 'invalid' });
        }).toThrow(BadRequestException);
      });

      it('should throw error for enum without options', () => {
        const params: ActionInputParam[] = [
          {
            name: 'invalidEnum',
            type: 'enum',
            required: true,
            control: 'select',
            // Missing options
          },
        ];

        expect(() => {
          service.validateEnhanced(params, { invalidEnum: 'test' });
        }).toThrow(BadRequestException);
      });
    });

    describe('Date Type Validation', () => {
      it('should validate date parameters', () => {
        const params: ActionInputParam[] = [
          {
            name: 'birthDate',
            type: 'date',
            required: true,
            control: 'date-picker',
          },
        ];

        const validData = { birthDate: '2023-12-25' };
        const result = service.validateEnhanced(params, validData);
        expect(result).toEqual(validData);

        // Test ISO date
        const isoResult = service.validateEnhanced(params, {
          birthDate: '2023-12-25T10:00:00.000Z',
        });
        expect(isoResult).toEqual({ birthDate: '2023-12-25T10:00:00.000Z' });

        expect(() => {
          service.validateEnhanced(params, { birthDate: 'invalid-date' });
        }).toThrow(BadRequestException);
      });
    });

    describe('Default Values', () => {
      it('should apply default values for missing optional fields', () => {
        const params: ActionInputParam[] = [
          {
            name: 'title',
            type: 'string',
            required: false,
            control: 'text',
            default: 'Default Title',
          },
          {
            name: 'count',
            type: 'number',
            required: false,
            control: 'number',
            default: 0,
          },
          {
            name: 'enabled',
            type: 'boolean',
            required: false,
            control: 'checkbox',
            default: false,
          },
        ];

        const result = service.validateEnhanced(params, {});
        expect(result).toEqual({
          title: 'Default Title',
          count: 0,
          enabled: false,
        });
      });

      it('should not override provided values with defaults', () => {
        const params: ActionInputParam[] = [
          {
            name: 'title',
            type: 'string',
            required: false,
            control: 'text',
            default: 'Default Title',
          },
        ];

        const result = service.validateEnhanced(params, { title: 'Custom Title' });
        expect(result).toEqual({ title: 'Custom Title' });
      });
    });

    describe('Required Fields', () => {
      it('should enforce required fields', () => {
        const params: ActionInputParam[] = [
          {
            name: 'requiredField',
            type: 'string',
            required: true,
            control: 'text',
          },
          {
            name: 'optionalField',
            type: 'string',
            required: false,
            control: 'text',
          },
        ];

        // Valid case
        const result = service.validateEnhanced(params, {
          requiredField: 'value',
          optionalField: 'optional',
        });
        expect(result).toEqual({
          requiredField: 'value',
          optionalField: 'optional',
        });

        // Missing required field
        expect(() => {
          service.validateEnhanced(params, { optionalField: 'optional' });
        }).toThrow(BadRequestException);

        // Missing optional field is OK
        const partialResult = service.validateEnhanced(params, { requiredField: 'value' });
        expect(partialResult).toEqual({ requiredField: 'value' });
      });
    });

    describe('Visibility Conditions', () => {
      it('should hide fields based on visibleIf conditions', () => {
        const params: ActionInputParam[] = [
          {
            name: 'type',
            type: 'enum',
            required: true,
            control: 'select',
            options: ['email', 'sms'],
          },
          {
            name: 'emailAddress',
            type: 'string',
            required: false,
            control: 'text',
            visibleIf: { '===': [{ var: 'type' }, 'email'] },
          },
          {
            name: 'phoneNumber',
            type: 'string',
            required: false,
            control: 'text',
            visibleIf: { '===': [{ var: 'type' }, 'sms'] },
          },
        ];

        // When type is email, phoneNumber should be hidden
        const emailResult = service.validateEnhanced(params, {
          type: 'email',
          emailAddress: 'test@example.com',
          phoneNumber: '123-456-7890',
        });
        expect(emailResult).toEqual({
          type: 'email',
          emailAddress: 'test@example.com',
          // phoneNumber should be removed
        });

        // When type is sms, emailAddress should be hidden
        const smsResult = service.validateEnhanced(params, {
          type: 'sms',
          emailAddress: 'test@example.com',
          phoneNumber: '123-456-7890',
        });
        expect(smsResult).toEqual({
          type: 'sms',
          phoneNumber: '123-456-7890',
          // emailAddress should be removed
        });
      });

      it('should handle complex visibility conditions', () => {
        const params: ActionInputParam[] = [
          {
            name: 'enabled',
            type: 'boolean',
            required: true,
            control: 'checkbox',
          },
          {
            name: 'priority',
            type: 'enum',
            required: false,
            control: 'select',
            options: ['low', 'high'],
          },
          {
            name: 'urgentNote',
            type: 'string',
            required: false,
            control: 'textarea',
            visibleIf: {
              and: [
                { '===': [{ var: 'enabled' }, true] },
                { '===': [{ var: 'priority' }, 'high'] },
              ],
            },
          },
        ];

        // All conditions met - field should be visible
        const visibleResult = service.validateEnhanced(params, {
          enabled: true,
          priority: 'high',
          urgentNote: 'This is urgent!',
        });
        expect(visibleResult).toEqual({
          enabled: true,
          priority: 'high',
          urgentNote: 'This is urgent!',
        });

        // Conditions not met - field should be hidden
        const hiddenResult = service.validateEnhanced(params, {
          enabled: false,
          priority: 'high',
          urgentNote: 'This should be hidden',
        });
        expect(hiddenResult).toEqual({
          enabled: false,
          priority: 'high',
          // urgentNote should be removed
        });
      });

      it('should handle invalid visibility conditions gracefully', () => {
        const params: ActionInputParam[] = [
          {
            name: 'field',
            type: 'string',
            required: false,
            control: 'text',
            visibleIf: { invalid: 'condition' }, // Invalid JSONLogic
          },
        ];

        // Should not throw error, field should remain visible
        const result = service.validateEnhanced(params, { field: 'value' });
        expect(result).toEqual({ field: 'value' });
      });
    });

    describe('Custom Validation Messages', () => {
      it('should use custom validation messages', () => {
        const params: ActionInputParam[] = [
          {
            name: 'code',
            type: 'string',
            required: true,
            control: 'text',
            validation: {
              pattern: '^[A-Z]{2}\\d{4}$',
              message: 'Code must be 2 uppercase letters followed by 4 digits',
            },
          },
        ];

        try {
          service.validateEnhanced(params, { code: 'invalid' });
        } catch (error) {
          expect(error).toBeInstanceOf(BadRequestException);
          expect(error.message).toBe('Input validation failed');
        }
      });
    });
  });

  describe('Legacy Compatibility', () => {
    it('should handle mixed legacy and enhanced parameters', () => {
      const params = [
        // Legacy format
        {
          name: 'legacyField',
          type: 'string',
          required: true,
          description: 'Legacy field',
        },
        // Enhanced format
        {
          name: 'enhancedField',
          type: 'string' as const,
          required: true,
          control: 'text' as const,
          label: 'Enhanced Field',
          description: 'Enhanced field with metadata',
        },
      ];

      const result = service.validateEnhanced(params, {
        legacyField: 'legacy value',
        enhancedField: 'enhanced value',
      });

      expect(result).toEqual({
        legacyField: 'legacy value',
        enhancedField: 'enhanced value',
      });
    });
  });

  describe('Schema Description', () => {
    it('should generate enhanced schema descriptions', () => {
      const params: ActionInputParam[] = [
        {
          name: 'title',
          label: 'Title',
          description: 'The title of the item',
          type: 'string',
          required: true,
          control: 'text',
          validation: {
            min: 1,
            max: 100,
          },
          ui: {
            placeholder: 'Enter title...',
            hint: 'Keep it concise',
          },
        },
        {
          name: 'priority',
          label: 'Priority',
          description: 'Item priority level',
          type: 'enum',
          required: false,
          control: 'select',
          options: ['low', 'medium', 'high'],
          default: 'medium',
        },
      ];

      const description = service.getEnhancedSchemaDescription(params);

      expect(description).toHaveProperty('title');
      expect(description.title).toEqual(params[0]);
      expect(description).toHaveProperty('priority');
      expect(description.priority).toEqual(params[1]);
    });
  });

  describe('Error Handling', () => {
    it('should provide detailed error information', () => {
      const params: ActionInputParam[] = [
        {
          name: 'email',
          type: 'string',
          required: true,
          control: 'text',
          validation: {
            format: 'email',
          },
        },
        {
          name: 'age',
          type: 'number',
          required: true,
          control: 'number',
          validation: {
            min: 18,
          },
        },
      ];

      try {
        service.validateEnhanced(params, {
          email: 'invalid-email',
          age: 17,
        });
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect(error.response).toHaveProperty('errors');
        expect(error.response.errors).toHaveLength(2);
        expect(error.response.errors[0]).toHaveProperty('field');
        expect(error.response.errors[0]).toHaveProperty('message');
        expect(error.response.errors[0]).toHaveProperty('code');
      }
    });
  });
});
