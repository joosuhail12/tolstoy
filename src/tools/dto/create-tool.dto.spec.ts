import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateToolDto } from './create-tool.dto';

describe('CreateToolDto', () => {
  it('should pass validation with valid data', async () => {
    const validData = {
      name: 'Test Tool',
      baseUrl: 'https://api.test.com',
      authType: 'apiKey',
    };

    const dto = plainToInstance(CreateToolDto, validData);
    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  describe('name validation', () => {
    it('should fail validation when name is empty', async () => {
      const invalidData = {
        name: '',
        baseUrl: 'https://api.test.com',
        authType: 'apiKey',
      };

      const dto = plainToInstance(CreateToolDto, invalidData);
      const errors = await validate(dto);

      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('name');
      expect(errors[0].constraints).toHaveProperty('isNotEmpty');
    });

    it('should fail validation when name is missing', async () => {
      const invalidData = {
        baseUrl: 'https://api.test.com',
        authType: 'apiKey',
      };

      const dto = plainToInstance(CreateToolDto, invalidData);
      const errors = await validate(dto);

      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('name');
      expect(errors[0].constraints).toHaveProperty('isNotEmpty');
    });

    it('should fail validation when name is not a string', async () => {
      const invalidData = {
        name: 123,
        baseUrl: 'https://api.test.com',
        authType: 'apiKey',
      };

      const dto = plainToInstance(CreateToolDto, invalidData);
      const errors = await validate(dto);

      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('name');
      expect(errors[0].constraints).toHaveProperty('isString');
    });

    it('should pass validation with single character name', async () => {
      const validData = {
        name: 'A',
        baseUrl: 'https://api.test.com',
        authType: 'apiKey',
      };

      const dto = plainToInstance(CreateToolDto, validData);
      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
    });

    it('should pass validation with long name', async () => {
      const validData = {
        name: 'A'.repeat(100),
        baseUrl: 'https://api.test.com',
        authType: 'apiKey',
      };

      const dto = plainToInstance(CreateToolDto, validData);
      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
    });

    it('should pass validation with name at minimum length', async () => {
      const validData = {
        name: 'AB',
        baseUrl: 'https://api.test.com',
        authType: 'apiKey',
      };

      const dto = plainToInstance(CreateToolDto, validData);
      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
    });

    it('should pass validation with name at maximum length', async () => {
      const validData = {
        name: 'A'.repeat(100),
        baseUrl: 'https://api.test.com',
        authType: 'apiKey',
      };

      const dto = plainToInstance(CreateToolDto, validData);
      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
    });
  });

  describe('baseUrl validation', () => {
    it('should fail validation when baseUrl is not a valid URL', async () => {
      const invalidData = {
        name: 'Test Tool',
        baseUrl: 'not-a-url',
        authType: 'apiKey',
      };

      const dto = plainToInstance(CreateToolDto, invalidData);
      const errors = await validate(dto);

      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('baseUrl');
      expect(errors[0].constraints).toHaveProperty('isUrl');
    });

    it('should fail validation when baseUrl is missing', async () => {
      const invalidData = {
        name: 'Test Tool',
        authType: 'apiKey',
      };

      const dto = plainToInstance(CreateToolDto, invalidData);
      const errors = await validate(dto);

      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('baseUrl');
      expect(errors[0].constraints).toHaveProperty('isNotEmpty');
    });

    it('should fail validation when baseUrl is empty', async () => {
      const invalidData = {
        name: 'Test Tool',
        baseUrl: '',
        authType: 'apiKey',
      };

      const dto = plainToInstance(CreateToolDto, invalidData);
      const errors = await validate(dto);

      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('baseUrl');
      expect(errors[0].constraints).toHaveProperty('isNotEmpty');
    });

    it('should pass validation with HTTP URL', async () => {
      const validData = {
        name: 'Test Tool',
        baseUrl: 'http://api.test.com',
        authType: 'apiKey',
      };

      const dto = plainToInstance(CreateToolDto, validData);
      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
    });

    it('should pass validation with HTTPS URL', async () => {
      const validData = {
        name: 'Test Tool',
        baseUrl: 'https://api.test.com',
        authType: 'apiKey',
      };

      const dto = plainToInstance(CreateToolDto, validData);
      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
    });

    it('should pass validation with URL containing path', async () => {
      const validData = {
        name: 'Test Tool',
        baseUrl: 'https://api.test.com/v1',
        authType: 'apiKey',
      };

      const dto = plainToInstance(CreateToolDto, validData);
      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
    });

    it('should pass validation with URL containing port', async () => {
      const validData = {
        name: 'Test Tool',
        baseUrl: 'https://api.test.com:8443',
        authType: 'apiKey',
      };

      const dto = plainToInstance(CreateToolDto, validData);
      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
    });
  });

  describe('authType validation', () => {
    it('should pass validation with apiKey auth type', async () => {
      const validData = {
        name: 'Test Tool',
        baseUrl: 'https://api.test.com',
        authType: 'apiKey',
      };

      const dto = plainToInstance(CreateToolDto, validData);
      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
    });

    it('should pass validation with oauth auth type', async () => {
      const validData = {
        name: 'Test Tool',
        baseUrl: 'https://api.test.com',
        authType: 'oauth',
      };

      const dto = plainToInstance(CreateToolDto, validData);
      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
    });

    it('should pass validation with none auth type', async () => {
      const validData = {
        name: 'Test Tool',
        baseUrl: 'https://api.test.com',
        authType: 'none',
      };

      const dto = plainToInstance(CreateToolDto, validData);
      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
    });

    it('should pass validation with any auth type string', async () => {
      const validData = {
        name: 'Test Tool',
        baseUrl: 'https://api.test.com',
        authType: 'custom-auth-type',
      };

      const dto = plainToInstance(CreateToolDto, validData);
      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
    });

    it('should fail validation when authType is missing', async () => {
      const invalidData = {
        name: 'Test Tool',
        baseUrl: 'https://api.test.com',
      };

      const dto = plainToInstance(CreateToolDto, invalidData);
      const errors = await validate(dto);

      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('authType');
      expect(errors[0].constraints).toHaveProperty('isNotEmpty');
    });

    it('should fail validation when authType is not a string', async () => {
      const invalidData = {
        name: 'Test Tool',
        baseUrl: 'https://api.test.com',
        authType: 123,
      };

      const dto = plainToInstance(CreateToolDto, invalidData);
      const errors = await validate(dto);

      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('authType');
      expect(errors[0].constraints).toHaveProperty('isString');
    });
  });

  describe('multiple validation errors', () => {
    it('should return multiple validation errors when multiple fields are invalid', async () => {
      const invalidData = {
        name: '',
        baseUrl: 'not-a-url',
        authType: '',
      };

      const dto = plainToInstance(CreateToolDto, invalidData);
      const errors = await validate(dto);

      expect(errors.length).toBeGreaterThanOrEqual(2);
      
      const errorProperties = errors.map(error => error.property);
      expect(errorProperties).toContain('name');
      expect(errorProperties).toContain('baseUrl');
    });

    it('should return all validation errors for a single field', async () => {
      const invalidData = {
        name: 123, // Not a string
        baseUrl: 'https://api.test.com',
        authType: 'apiKey',
      };

      const dto = plainToInstance(CreateToolDto, invalidData);
      const errors = await validate(dto);

      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('name');
      // Should have both isString and isNotEmpty constraints
      expect(Object.keys(errors[0].constraints || {})).toContain('isString');
    });
  });

  describe('edge cases', () => {
    it('should handle null values', async () => {
      const invalidData = {
        name: null,
        baseUrl: null,
        authType: null,
      };

      const dto = plainToInstance(CreateToolDto, invalidData);
      const errors = await validate(dto);

      expect(errors.length).toBeGreaterThan(0);
      
      const errorProperties = errors.map(error => error.property);
      expect(errorProperties).toContain('name');
      expect(errorProperties).toContain('baseUrl');
      expect(errorProperties).toContain('authType');
    });

    it('should handle undefined values', async () => {
      const invalidData = {
        name: undefined,
        baseUrl: undefined,
        authType: undefined,
      };

      const dto = plainToInstance(CreateToolDto, invalidData);
      const errors = await validate(dto);

      expect(errors.length).toBeGreaterThan(0);
      
      const errorProperties = errors.map(error => error.property);
      expect(errorProperties).toContain('name');
      expect(errorProperties).toContain('baseUrl');
      expect(errorProperties).toContain('authType');
    });

    it('should handle extra properties gracefully', async () => {
      const dataWithExtraProps = {
        name: 'Test Tool',
        baseUrl: 'https://api.test.com',
        authType: 'apiKey',
        extraProperty: 'should be ignored',
        anotherExtra: 123,
      };

      const dto = plainToInstance(CreateToolDto, dataWithExtraProps);
      const errors = await validate(dto);

      // Should pass validation despite extra properties
      expect(errors).toHaveLength(0);
      // Note: plainToInstance preserves extra properties by default
      // This is normal behavior in NestJS with class-validator
      expect(dto.name).toBe('Test Tool');
      expect(dto.baseUrl).toBe('https://api.test.com');
      expect(dto.authType).toBe('apiKey');
    });
  });
});