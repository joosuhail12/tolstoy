import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateActionDto } from './create-action.dto';

// Define test interfaces based on the actual DTO structure
interface InputSchemaItem {
  name: string;
  type: string;
  required?: boolean;
  description?: string;
}

describe('CreateActionDto', () => {
  const validInputSchema: InputSchemaItem[] = [
    {
      name: 'message',
      type: 'string',
      required: true,
      description: 'Message to send',
    },
  ];

  const validHeaders = {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer {token}',
  };

  it('should pass validation with valid data', async () => {
    const validData = {
      name: 'Test Action',
      key: 'test_action',
      method: 'POST',
      endpoint: '/api/test',
      toolId: 'tool-123',
      inputSchema: validInputSchema,
      headers: validHeaders,
    };

    const dto = plainToInstance(CreateActionDto, validData);
    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  describe('name validation', () => {
    it('should fail validation when name is empty', async () => {
      const invalidData = {
        name: '',
        key: 'test_action',
        method: 'POST',
        endpoint: '/api/test',
        toolId: 'tool-123',
        inputSchema: validInputSchema,
        headers: validHeaders,
      };

      const dto = plainToInstance(CreateActionDto, invalidData);
      const errors = await validate(dto);

      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('name');
      expect(errors[0].constraints).toHaveProperty('isNotEmpty');
    });

    it('should fail validation when name is missing', async () => {
      const invalidData = {
        key: 'test_action',
        method: 'POST',
        endpoint: '/api/test',
        toolId: 'tool-123',
        inputSchema: validInputSchema,
        headers: validHeaders,
      };

      const dto = plainToInstance(CreateActionDto, invalidData);
      const errors = await validate(dto);

      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('name');
      expect(errors[0].constraints).toHaveProperty('isNotEmpty');
    });

    it('should fail validation when name is not a string', async () => {
      const invalidData = {
        name: 123,
        key: 'test_action',
        method: 'POST',
        endpoint: '/api/test',
        toolId: 'tool-123',
        inputSchema: validInputSchema,
        headers: validHeaders,
      };

      const dto = plainToInstance(CreateActionDto, invalidData);
      const errors = await validate(dto);

      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('name');
      expect(errors[0].constraints).toHaveProperty('isString');
    });
  });

  describe('key validation', () => {
    it('should pass validation with valid key', async () => {
      const validKeys = [
        'test_action',
        'send_message',
        'create_user',
        'get_data',
        'action123',
      ];

      for (const key of validKeys) {
        const validData = {
          name: 'Test Action',
          key,
          method: 'POST',
          endpoint: '/api/test',
          toolId: 'tool-123',
          inputSchema: validInputSchema,
          headers: validHeaders,
        };

        const dto = plainToInstance(CreateActionDto, validData);
        const errors = await validate(dto);

        expect(errors).toHaveLength(0);
      }
    });

    it('should fail validation when key is empty', async () => {
      const invalidData = {
        name: 'Test Action',
        key: '',
        method: 'POST',
        endpoint: '/api/test',
        toolId: 'tool-123',
        inputSchema: validInputSchema,
        headers: validHeaders,
      };

      const dto = plainToInstance(CreateActionDto, invalidData);
      const errors = await validate(dto);

      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('key');
      expect(errors[0].constraints).toHaveProperty('isNotEmpty');
    });

    it('should fail validation when key is missing', async () => {
      const invalidData = {
        name: 'Test Action',
        method: 'POST',
        endpoint: '/api/test',
        toolId: 'tool-123',
        inputSchema: validInputSchema,
        headers: validHeaders,
      };

      const dto = plainToInstance(CreateActionDto, invalidData);
      const errors = await validate(dto);

      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('key');
      expect(errors[0].constraints).toHaveProperty('isNotEmpty');
    });
  });

  describe('method validation', () => {
    it('should pass validation with valid HTTP methods', async () => {
      const validMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

      for (const method of validMethods) {
        const validData = {
          name: 'Test Action',
          key: 'test_action',
          method,
          endpoint: '/api/test',
          toolId: 'tool-123',
          inputSchema: validInputSchema,
          headers: validHeaders,
        };

        const dto = plainToInstance(CreateActionDto, validData);
        const errors = await validate(dto);

        expect(errors).toHaveLength(0);
      }
    });

    it('should pass validation with any method string', async () => {
      const validData = {
        name: 'Test Action',
        key: 'test_action',
        method: 'CUSTOM_METHOD',
        endpoint: '/api/test',
        toolId: 'tool-123',
        inputSchema: validInputSchema,
        headers: validHeaders,
      };

      const dto = plainToInstance(CreateActionDto, validData);
      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
    });
  });

  describe('endpoint validation', () => {
    it('should pass validation with valid endpoints', async () => {
      const validEndpoints = [
        '/api/test',
        '/v1/users',
        '/messages/send',
        '/data',
        '/complex/path/with/params',
        '/api/v2/users/{userId}',
        '/search?query={q}',
      ];

      for (const endpoint of validEndpoints) {
        const validData = {
          name: 'Test Action',
          key: 'test_action',
          method: 'POST',
          endpoint,
          toolId: 'tool-123',
          inputSchema: validInputSchema,
          headers: validHeaders,
        };

        const dto = plainToInstance(CreateActionDto, validData);
        const errors = await validate(dto);

        expect(errors).toHaveLength(0);
      }
    });

    it('should fail validation when endpoint is empty', async () => {
      const invalidData = {
        name: 'Test Action',
        key: 'test_action',
        method: 'POST',
        endpoint: '',
        toolId: 'tool-123',
        inputSchema: validInputSchema,
        headers: validHeaders,
      };

      const dto = plainToInstance(CreateActionDto, invalidData);
      const errors = await validate(dto);

      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('endpoint');
      expect(errors[0].constraints).toHaveProperty('isNotEmpty');
    });
  });

  describe('toolId validation', () => {
    it('should fail validation when toolId is empty', async () => {
      const invalidData = {
        name: 'Test Action',
        key: 'test_action',
        method: 'POST',
        endpoint: '/api/test',
        toolId: '',
        inputSchema: validInputSchema,
        headers: validHeaders,
      };

      const dto = plainToInstance(CreateActionDto, invalidData);
      const errors = await validate(dto);

      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('toolId');
      expect(errors[0].constraints).toHaveProperty('isNotEmpty');
    });

    it('should fail validation when toolId is missing', async () => {
      const invalidData = {
        name: 'Test Action',
        key: 'test_action',
        method: 'POST',
        endpoint: '/api/test',
        inputSchema: validInputSchema,
        headers: validHeaders,
      };

      const dto = plainToInstance(CreateActionDto, invalidData);
      const errors = await validate(dto);

      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('toolId');
      expect(errors[0].constraints).toHaveProperty('isNotEmpty');
    });
  });

  describe('headers validation', () => {
    it('should pass validation with valid headers', async () => {
      const validData = {
        name: 'Test Action',
        key: 'test_action',
        method: 'POST',
        endpoint: '/api/test',
        toolId: 'tool-123',
        inputSchema: validInputSchema,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer token',
          'X-API-Key': 'key123',
        },
      };

      const dto = plainToInstance(CreateActionDto, validData);
      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
    });

    it('should fail validation when headers is missing', async () => {
      const invalidData = {
        name: 'Test Action',
        key: 'test_action',
        method: 'POST',
        endpoint: '/api/test',
        toolId: 'tool-123',
        inputSchema: validInputSchema,
      };

      const dto = plainToInstance(CreateActionDto, invalidData);
      const errors = await validate(dto);

      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('headers');
      expect(errors[0].constraints).toHaveProperty('isNotEmpty');
    });

    it('should fail validation when headers is not an object', async () => {
      const invalidData = {
        name: 'Test Action',
        key: 'test_action',
        method: 'POST',
        endpoint: '/api/test',
        toolId: 'tool-123',
        inputSchema: validInputSchema,
        headers: 'not-an-object',
      };

      const dto = plainToInstance(CreateActionDto, invalidData);
      const errors = await validate(dto);

      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('headers');
      expect(errors[0].constraints).toHaveProperty('isObject');
    });
  });

  describe('inputSchema validation', () => {
    it('should pass validation with valid input schema', async () => {
      const complexInputSchema: InputSchemaItem[] = [
        {
          name: 'message',
          type: 'string',
          required: true,
          description: 'Message to send',
        },
        {
          name: 'priority',
          type: 'number',
          required: false,
          description: 'Message priority',
        },
        {
          name: 'urgent',
          type: 'boolean',
          required: false,
          description: 'Mark as urgent',
        },
      ];

      const validData = {
        name: 'Test Action',
        key: 'test_action',
        method: 'POST',
        endpoint: '/api/test',
        toolId: 'tool-123',
        inputSchema: complexInputSchema,
        headers: validHeaders,
      };

      const dto = plainToInstance(CreateActionDto, validData);
      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
    });

    it('should fail validation when inputSchema is not an array', async () => {
      const invalidData = {
        name: 'Test Action',
        key: 'test_action',
        method: 'POST',
        endpoint: '/api/test',
        toolId: 'tool-123',
        inputSchema: 'not-an-array',
        headers: validHeaders,
      };

      const dto = plainToInstance(CreateActionDto, invalidData);
      const errors = await validate(dto);

      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('inputSchema');
      expect(errors[0].constraints).toHaveProperty('isArray');
    });

    it('should fail validation when inputSchema is missing', async () => {
      const invalidData = {
        name: 'Test Action',
        key: 'test_action',
        method: 'POST',
        endpoint: '/api/test',
        toolId: 'tool-123',
        headers: validHeaders,
      };

      const dto = plainToInstance(CreateActionDto, invalidData);
      const errors = await validate(dto);

      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('inputSchema');
      expect(errors[0].constraints).toHaveProperty('isNotEmpty');
    });
  });

  describe('optional fields', () => {
    it('should pass validation when optional fields are omitted', async () => {
      const minimalData = {
        name: 'Test Action',
        key: 'test_action',
        method: 'POST',
        endpoint: '/api/test',
        toolId: 'tool-123',
        inputSchema: [],
        headers: validHeaders,
      };

      const dto = plainToInstance(CreateActionDto, minimalData);
      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
    });

    it('should pass validation with optional executeIf', async () => {
      const validData = {
        name: 'Test Action',
        key: 'test_action',
        method: 'POST',
        endpoint: '/api/test',
        toolId: 'tool-123',
        inputSchema: validInputSchema,
        headers: validHeaders,
        executeIf: { 'user.role': 'admin' },
      };

      const dto = plainToInstance(CreateActionDto, validData);
      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
    });

    it('should pass validation with optional version', async () => {
      const validData = {
        name: 'Test Action',
        key: 'test_action',
        method: 'POST',
        endpoint: '/api/test',
        toolId: 'tool-123',
        inputSchema: validInputSchema,
        headers: validHeaders,
        version: 1,
      };

      const dto = plainToInstance(CreateActionDto, validData);
      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
    });
  });

  describe('multiple validation errors', () => {
    it('should return multiple validation errors when multiple fields are invalid', async () => {
      const invalidData = {
        name: '',
        key: '',
        method: '',
        endpoint: '',
        toolId: '',
        inputSchema: 'not-an-array',
        headers: 'not-an-object',
      };

      const dto = plainToInstance(CreateActionDto, invalidData);
      const errors = await validate(dto);

      expect(errors.length).toBeGreaterThan(0);
      
      const errorProperties = errors.map(error => error.property);
      expect(errorProperties).toContain('name');
      expect(errorProperties).toContain('key');
      expect(errorProperties).toContain('method');
      expect(errorProperties).toContain('endpoint');
      expect(errorProperties).toContain('toolId');
      expect(errorProperties).toContain('inputSchema');
      expect(errorProperties).toContain('headers');
    });
  });
});