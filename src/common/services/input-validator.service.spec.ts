import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { InputValidatorService, InputParameter } from './input-validator.service';

describe('InputValidatorService', () => {
  let service: InputValidatorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [InputValidatorService],
    }).compile();

    service = module.get<InputValidatorService>(InputValidatorService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('validate', () => {
    it('should validate correct string input', () => {
      const schema: InputParameter[] = [
        { name: 'title', type: 'string', required: true }
      ];
      const result = service.validate(schema, { title: 'Test' });
      expect(result.title).toBe('Test');
    });

    it('should validate correct number input', () => {
      const schema: InputParameter[] = [
        { name: 'count', type: 'number', required: true }
      ];
      const result = service.validate(schema, { count: 42 });
      expect(result.count).toBe(42);
    });

    it('should validate correct boolean input', () => {
      const schema: InputParameter[] = [
        { name: 'enabled', type: 'boolean', required: true }
      ];
      const result = service.validate(schema, { enabled: true });
      expect(result.enabled).toBe(true);
    });

    it('should validate correct enum input', () => {
      const schema: InputParameter[] = [
        { 
          name: 'priority', 
          type: 'enum', 
          required: true, 
          options: ['low', 'medium', 'high'] 
        }
      ];
      const result = service.validate(schema, { priority: 'high' });
      expect(result.priority).toBe('high');
    });

    it('should validate array input', () => {
      const schema: InputParameter[] = [
        { name: 'tags', type: 'array', required: true }
      ];
      const result = service.validate(schema, { tags: ['tag1', 'tag2'] });
      expect(result.tags).toEqual(['tag1', 'tag2']);
    });

    it('should validate object input', () => {
      const schema: InputParameter[] = [
        { name: 'metadata', type: 'object', required: true }
      ];
      const result = service.validate(schema, { metadata: { key: 'value' } });
      expect(result.metadata).toEqual({ key: 'value' });
    });

    it('should throw BadRequestException for missing required field', () => {
      const schema: InputParameter[] = [
        { name: 'title', type: 'string', required: true }
      ];
      
      expect(() => service.validate(schema, {})).toThrow(BadRequestException);
    });

    it('should handle optional fields correctly', () => {
      const schema: InputParameter[] = [
        { name: 'title', type: 'string', required: true },
        { name: 'note', type: 'string', required: false }
      ];
      const result = service.validate(schema, { title: 'Test' });
      expect(result.title).toBe('Test');
      expect(result.note).toBeUndefined();
    });

    it('should apply default values', () => {
      const schema: InputParameter[] = [
        { name: 'priority', type: 'string', required: false, default: 'medium' }
      ];
      const result = service.validate(schema, {});
      expect(result.priority).toBe('medium');
    });

    it('should validate string with min length', () => {
      const schema: InputParameter[] = [
        { 
          name: 'title', 
          type: 'string', 
          required: true, 
          validation: { min: 3 } 
        }
      ];
      const result = service.validate(schema, { title: 'Test' });
      expect(result.title).toBe('Test');
    });

    it('should throw for string below min length', () => {
      const schema: InputParameter[] = [
        { 
          name: 'title', 
          type: 'string', 
          required: true, 
          validation: { min: 5 } 
        }
      ];
      
      expect(() => service.validate(schema, { title: 'Hi' })).toThrow(BadRequestException);
    });

    it('should validate string with max length', () => {
      const schema: InputParameter[] = [
        { 
          name: 'title', 
          type: 'string', 
          required: true, 
          validation: { max: 10 } 
        }
      ];
      const result = service.validate(schema, { title: 'Short' });
      expect(result.title).toBe('Short');
    });

    it('should throw for string above max length', () => {
      const schema: InputParameter[] = [
        { 
          name: 'title', 
          type: 'string', 
          required: true, 
          validation: { max: 5 } 
        }
      ];
      
      expect(() => service.validate(schema, { title: 'This is too long' })).toThrow(BadRequestException);
    });

    it('should validate email format', () => {
      const schema: InputParameter[] = [
        { 
          name: 'email', 
          type: 'string', 
          required: true, 
          validation: { email: true } 
        }
      ];
      const result = service.validate(schema, { email: 'test@example.com' });
      expect(result.email).toBe('test@example.com');
    });

    it('should throw for invalid email format', () => {
      const schema: InputParameter[] = [
        { 
          name: 'email', 
          type: 'string', 
          required: true, 
          validation: { email: true } 
        }
      ];
      
      expect(() => service.validate(schema, { email: 'invalid-email' })).toThrow(BadRequestException);
    });

    it('should validate URL format', () => {
      const schema: InputParameter[] = [
        { 
          name: 'website', 
          type: 'string', 
          required: true, 
          validation: { url: true } 
        }
      ];
      const result = service.validate(schema, { website: 'https://example.com' });
      expect(result.website).toBe('https://example.com');
    });

    it('should throw for invalid URL format', () => {
      const schema: InputParameter[] = [
        { 
          name: 'website', 
          type: 'string', 
          required: true, 
          validation: { url: true } 
        }
      ];
      
      expect(() => service.validate(schema, { website: 'not-a-url' })).toThrow(BadRequestException);
    });

    it('should validate number with min value', () => {
      const schema: InputParameter[] = [
        { 
          name: 'count', 
          type: 'number', 
          required: true, 
          validation: { min: 1 } 
        }
      ];
      const result = service.validate(schema, { count: 5 });
      expect(result.count).toBe(5);
    });

    it('should throw for number below min value', () => {
      const schema: InputParameter[] = [
        { 
          name: 'count', 
          type: 'number', 
          required: true, 
          validation: { min: 1 } 
        }
      ];
      
      expect(() => service.validate(schema, { count: 0 })).toThrow(BadRequestException);
    });

    it('should validate number with max value', () => {
      const schema: InputParameter[] = [
        { 
          name: 'count', 
          type: 'number', 
          required: true, 
          validation: { max: 100 } 
        }
      ];
      const result = service.validate(schema, { count: 50 });
      expect(result.count).toBe(50);
    });

    it('should throw for number above max value', () => {
      const schema: InputParameter[] = [
        { 
          name: 'count', 
          type: 'number', 
          required: true, 
          validation: { max: 100 } 
        }
      ];
      
      expect(() => service.validate(schema, { count: 150 })).toThrow(BadRequestException);
    });

    it('should validate string with regex pattern', () => {
      const schema: InputParameter[] = [
        { 
          name: 'code', 
          type: 'string', 
          required: true, 
          validation: { pattern: '^[A-Z]{3}-\\d{3}$' } 
        }
      ];
      const result = service.validate(schema, { code: 'ABC-123' });
      expect(result.code).toBe('ABC-123');
    });

    it('should throw for string not matching regex pattern', () => {
      const schema: InputParameter[] = [
        { 
          name: 'code', 
          type: 'string', 
          required: true, 
          validation: { pattern: '^[A-Z]{3}-\\d{3}$' } 
        }
      ];
      
      expect(() => service.validate(schema, { code: 'invalid-code' })).toThrow(BadRequestException);
    });

    it('should throw for enum without options', () => {
      const schema: InputParameter[] = [
        { name: 'status', type: 'enum', required: true }
      ];
      
      expect(() => service.validate(schema, { status: 'active' })).toThrow(BadRequestException);
    });

    it('should throw for enum with empty options', () => {
      const schema: InputParameter[] = [
        { name: 'status', type: 'enum', required: true, options: [] }
      ];
      
      expect(() => service.validate(schema, { status: 'active' })).toThrow(BadRequestException);
    });

    it('should throw for invalid enum value', () => {
      const schema: InputParameter[] = [
        { 
          name: 'status', 
          type: 'enum', 
          required: true, 
          options: ['active', 'inactive'] 
        }
      ];
      
      expect(() => service.validate(schema, { status: 'pending' })).toThrow(BadRequestException);
    });

    it('should handle multiple validation errors', () => {
      const schema: InputParameter[] = [
        { name: 'title', type: 'string', required: true },
        { name: 'count', type: 'number', required: true }
      ];
      
      expect(() => service.validate(schema, {})).toThrow(BadRequestException);
    });

    it('should validate complex schema with multiple fields', () => {
      const schema: InputParameter[] = [
        { name: 'title', type: 'string', required: true, validation: { min: 3 } },
        { name: 'priority', type: 'enum', required: true, options: ['low', 'high'] },
        { name: 'count', type: 'number', required: false, default: 1 },
        { name: 'active', type: 'boolean', required: false, default: true }
      ];
      
      const result = service.validate(schema, { 
        title: 'Test Task', 
        priority: 'high' 
      });
      
      expect(result.title).toBe('Test Task');
      expect(result.priority).toBe('high');
      expect(result.count).toBe(1);
      expect(result.active).toBe(true);
    });
  });

  describe('validateAsync', () => {
    it('should return a promise that resolves with valid input', async () => {
      const schema: InputParameter[] = [
        { name: 'title', type: 'string', required: true }
      ];
      const result = await service.validateAsync(schema, { title: 'Test' });
      expect(result.title).toBe('Test');
    });

    it('should return a promise that rejects with invalid input', async () => {
      const schema: InputParameter[] = [
        { name: 'title', type: 'string', required: true }
      ];
      await expect(service.validateAsync(schema, {})).rejects.toThrow(BadRequestException);
    });
  });

  describe('getSchemaDescription', () => {
    it('should return schema description object', () => {
      const schema: InputParameter[] = [
        {
          name: 'title',
          type: 'string',
          required: true,
          description: 'Task title',
          label: 'Title',
          control: 'text',
          validation: { min: 3 }
        },
        {
          name: 'priority',
          type: 'enum',
          required: false,
          options: ['low', 'high'],
          default: 'low',
          control: 'select'
        }
      ];

      const description = service.getSchemaDescription(schema);

      expect(description).toEqual({
        title: {
          type: 'string',
          required: true,
          description: 'Task title',
          label: 'Title',
          control: 'text',
          validation: { min: 3 },
          default: undefined,
          options: undefined
        },
        priority: {
          type: 'enum',
          required: false,
          description: undefined,
          label: undefined,
          control: 'select',
          options: ['low', 'high'],
          default: 'low',
          validation: undefined
        }
      });
    });
  });
});