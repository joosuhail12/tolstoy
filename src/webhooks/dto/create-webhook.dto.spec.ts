import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateWebhookDto } from './create-webhook.dto';

describe('CreateWebhookDto', () => {
  it('should pass validation with valid minimal data', async () => {
    const validData = {
      name: 'Test Webhook',
      url: 'https://api.test.com/webhook',
      eventTypes: ['flow.execution.completed'],
    };

    const dto = plainToInstance(CreateWebhookDto, validData);
    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('should pass validation with complete valid data', async () => {
    const validData = {
      name: 'Complete Webhook',
      url: 'https://api.test.com/webhook',
      eventTypes: ['flow.execution.completed', 'flow.execution.failed'],
      enabled: true,
      secret: 'webhook_secret_12345678',
      headers: {
        'X-API-Key': 'test-key',
        'Content-Type': 'application/json',
      },
    };

    const dto = plainToInstance(CreateWebhookDto, validData);
    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  describe('name validation', () => {
    it('should fail validation when name is empty', async () => {
      const invalidData = {
        name: '',
        url: 'https://api.test.com/webhook',
        eventTypes: ['flow.execution.completed'],
      };

      const dto = plainToInstance(CreateWebhookDto, invalidData);
      const errors = await validate(dto);

      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('name');
      expect(errors[0].constraints).toHaveProperty('isNotEmpty');
    });

    it('should fail validation when name is missing', async () => {
      const invalidData = {
        url: 'https://api.test.com/webhook',
        eventTypes: ['flow.execution.completed'],
      };

      const dto = plainToInstance(CreateWebhookDto, invalidData);
      const errors = await validate(dto);

      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('name');
      expect(errors[0].constraints).toHaveProperty('isNotEmpty');
    });

    it('should fail validation when name is not a string', async () => {
      const invalidData = {
        name: 123,
        url: 'https://api.test.com/webhook',
        eventTypes: ['flow.execution.completed'],
      };

      const dto = plainToInstance(CreateWebhookDto, invalidData);
      const errors = await validate(dto);

      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('name');
      expect(errors[0].constraints).toHaveProperty('isString');
    });

    it('should fail validation when name is too short', async () => {
      const invalidData = {
        name: 'Ab',
        url: 'https://api.test.com/webhook',
        eventTypes: ['flow.execution.completed'],
      };

      const dto = plainToInstance(CreateWebhookDto, invalidData);
      const errors = await validate(dto);

      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('name');
      expect(errors[0].constraints).toHaveProperty('minLength');
    });

    it('should fail validation when name is too long', async () => {
      const invalidData = {
        name: 'A'.repeat(101),
        url: 'https://api.test.com/webhook',
        eventTypes: ['flow.execution.completed'],
      };

      const dto = plainToInstance(CreateWebhookDto, invalidData);
      const errors = await validate(dto);

      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('name');
      expect(errors[0].constraints).toHaveProperty('maxLength');
    });

    it('should pass validation with name at minimum length', async () => {
      const validData = {
        name: 'ABC',
        url: 'https://api.test.com/webhook',
        eventTypes: ['flow.execution.completed'],
      };

      const dto = plainToInstance(CreateWebhookDto, validData);
      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
    });

    it('should pass validation with name at maximum length', async () => {
      const validData = {
        name: 'A'.repeat(100),
        url: 'https://api.test.com/webhook',
        eventTypes: ['flow.execution.completed'],
      };

      const dto = plainToInstance(CreateWebhookDto, validData);
      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
    });
  });

  describe('url validation', () => {
    it('should fail validation when url is not a valid URL', async () => {
      const invalidData = {
        name: 'Test Webhook',
        url: 'not-a-url',
        eventTypes: ['flow.execution.completed'],
      };

      const dto = plainToInstance(CreateWebhookDto, invalidData);
      const errors = await validate(dto);

      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('url');
      expect(errors[0].constraints).toHaveProperty('isUrl');
    });

    it('should fail validation when url is missing', async () => {
      const invalidData = {
        name: 'Test Webhook',
        eventTypes: ['flow.execution.completed'],
      };

      const dto = plainToInstance(CreateWebhookDto, invalidData);
      const errors = await validate(dto);

      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('url');
      expect(errors[0].constraints).toHaveProperty('isNotEmpty');
    });

    it('should fail validation when url is empty', async () => {
      const invalidData = {
        name: 'Test Webhook',
        url: '',
        eventTypes: ['flow.execution.completed'],
      };

      const dto = plainToInstance(CreateWebhookDto, invalidData);
      const errors = await validate(dto);

      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('url');
      expect(errors[0].constraints).toHaveProperty('isNotEmpty');
    });

    it('should pass validation with HTTP URL', async () => {
      const validData = {
        name: 'Test Webhook',
        url: 'http://api.test.com/webhook',
        eventTypes: ['flow.execution.completed'],
      };

      const dto = plainToInstance(CreateWebhookDto, validData);
      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
    });

    it('should pass validation with HTTPS URL', async () => {
      const validData = {
        name: 'Test Webhook',
        url: 'https://api.test.com/webhook',
        eventTypes: ['flow.execution.completed'],
      };

      const dto = plainToInstance(CreateWebhookDto, validData);
      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
    });

    it('should pass validation with URL containing path and query parameters', async () => {
      const validData = {
        name: 'Test Webhook',
        url: 'https://api.test.com/webhooks/v1?token=abc123',
        eventTypes: ['flow.execution.completed'],
      };

      const dto = plainToInstance(CreateWebhookDto, validData);
      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
    });

    it('should pass validation with URL containing port', async () => {
      const validData = {
        name: 'Test Webhook',
        url: 'https://api.test.com:8443/webhook',
        eventTypes: ['flow.execution.completed'],
      };

      const dto = plainToInstance(CreateWebhookDto, validData);
      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
    });

    it('should fail validation with non-HTTP(S) URL', async () => {
      const invalidUrls = [
        'ftp://api.test.com/webhook',
        'ws://api.test.com/webhook',
        'file:///etc/passwd',
        'javascript:alert(1)',
      ];

      for (const url of invalidUrls) {
        const invalidData = {
          name: 'Test Webhook',
          url,
          eventTypes: ['flow.execution.completed'],
        };

        const dto = plainToInstance(CreateWebhookDto, invalidData);
        const errors = await validate(dto);

        expect(errors).toHaveLength(1);
        expect(errors[0].property).toBe('url');
        expect(errors[0].constraints).toHaveProperty('isUrl');
      }
    });
  });

  describe('eventTypes validation', () => {
    it('should fail validation when eventTypes is empty array', async () => {
      const invalidData = {
        name: 'Test Webhook',
        url: 'https://api.test.com/webhook',
        eventTypes: [],
      };

      const dto = plainToInstance(CreateWebhookDto, invalidData);
      const errors = await validate(dto);

      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('eventTypes');
      expect(errors[0].constraints).toHaveProperty('arrayNotEmpty');
    });

    it('should fail validation when eventTypes is missing', async () => {
      const invalidData = {
        name: 'Test Webhook',
        url: 'https://api.test.com/webhook',
      };

      const dto = plainToInstance(CreateWebhookDto, invalidData);
      const errors = await validate(dto);

      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('eventTypes');
      expect(errors[0].constraints).toHaveProperty('arrayNotEmpty');
    });

    it('should fail validation when eventTypes is not an array', async () => {
      const invalidData = {
        name: 'Test Webhook',
        url: 'https://api.test.com/webhook',
        eventTypes: 'flow.execution.completed',
      };

      const dto = plainToInstance(CreateWebhookDto, invalidData);
      const errors = await validate(dto);

      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('eventTypes');
      expect(errors[0].constraints).toHaveProperty('isArray');
    });

    it('should fail validation when eventTypes contains non-string values', async () => {
      const invalidData = {
        name: 'Test Webhook',
        url: 'https://api.test.com/webhook',
        eventTypes: ['flow.execution.completed', 123, null],
      };

      const dto = plainToInstance(CreateWebhookDto, invalidData);
      const errors = await validate(dto);

      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('eventTypes');
      expect(errors[0].constraints).toHaveProperty('isString');
    });

    it('should fail validation when eventTypes contains duplicate values', async () => {
      const invalidData = {
        name: 'Test Webhook',
        url: 'https://api.test.com/webhook',
        eventTypes: ['flow.execution.completed', 'flow.execution.completed'],
      };

      const dto = plainToInstance(CreateWebhookDto, invalidData);
      const errors = await validate(dto);

      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('eventTypes');
      expect(errors[0].constraints).toHaveProperty('arrayUnique');
    });

    it('should pass validation with single event type', async () => {
      const validData = {
        name: 'Test Webhook',
        url: 'https://api.test.com/webhook',
        eventTypes: ['flow.execution.completed'],
      };

      const dto = plainToInstance(CreateWebhookDto, validData);
      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
    });

    it('should pass validation with multiple unique event types', async () => {
      const validData = {
        name: 'Test Webhook',
        url: 'https://api.test.com/webhook',
        eventTypes: [
          'flow.execution.completed',
          'flow.execution.failed',
          'user.created',
          'organization.updated',
        ],
      };

      const dto = plainToInstance(CreateWebhookDto, validData);
      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
    });
  });

  describe('enabled validation (optional)', () => {
    it('should pass validation when enabled is omitted', async () => {
      const validData = {
        name: 'Test Webhook',
        url: 'https://api.test.com/webhook',
        eventTypes: ['flow.execution.completed'],
      };

      const dto = plainToInstance(CreateWebhookDto, validData);
      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
    });

    it('should pass validation when enabled is true', async () => {
      const validData = {
        name: 'Test Webhook',
        url: 'https://api.test.com/webhook',
        eventTypes: ['flow.execution.completed'],
        enabled: true,
      };

      const dto = plainToInstance(CreateWebhookDto, validData);
      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
    });

    it('should pass validation when enabled is false', async () => {
      const validData = {
        name: 'Test Webhook',
        url: 'https://api.test.com/webhook',
        eventTypes: ['flow.execution.completed'],
        enabled: false,
      };

      const dto = plainToInstance(CreateWebhookDto, validData);
      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
    });

    it('should fail validation when enabled is not a boolean', async () => {
      const invalidData = {
        name: 'Test Webhook',
        url: 'https://api.test.com/webhook',
        eventTypes: ['flow.execution.completed'],
        enabled: 'true',
      };

      const dto = plainToInstance(CreateWebhookDto, invalidData);
      const errors = await validate(dto);

      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('enabled');
      expect(errors[0].constraints).toHaveProperty('isBoolean');
    });
  });

  describe('secret validation (optional)', () => {
    it('should pass validation when secret is omitted', async () => {
      const validData = {
        name: 'Test Webhook',
        url: 'https://api.test.com/webhook',
        eventTypes: ['flow.execution.completed'],
      };

      const dto = plainToInstance(CreateWebhookDto, validData);
      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
    });

    it('should pass validation with valid secret', async () => {
      const validData = {
        name: 'Test Webhook',
        url: 'https://api.test.com/webhook',
        eventTypes: ['flow.execution.completed'],
        secret: 'webhook_secret_12345678',
      };

      const dto = plainToInstance(CreateWebhookDto, validData);
      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
    });

    it('should fail validation when secret is too short', async () => {
      const invalidData = {
        name: 'Test Webhook',
        url: 'https://api.test.com/webhook',
        eventTypes: ['flow.execution.completed'],
        secret: 'short',
      };

      const dto = plainToInstance(CreateWebhookDto, invalidData);
      const errors = await validate(dto);

      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('secret');
      expect(errors[0].constraints).toHaveProperty('minLength');
    });

    it('should fail validation when secret is too long', async () => {
      const invalidData = {
        name: 'Test Webhook',
        url: 'https://api.test.com/webhook',
        eventTypes: ['flow.execution.completed'],
        secret: 'A'.repeat(257),
      };

      const dto = plainToInstance(CreateWebhookDto, invalidData);
      const errors = await validate(dto);

      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('secret');
      expect(errors[0].constraints).toHaveProperty('maxLength');
    });

    it('should fail validation when secret is not a string', async () => {
      const invalidData = {
        name: 'Test Webhook',
        url: 'https://api.test.com/webhook',
        eventTypes: ['flow.execution.completed'],
        secret: 12345,
      };

      const dto = plainToInstance(CreateWebhookDto, invalidData);
      const errors = await validate(dto);

      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('secret');
      expect(errors[0].constraints).toHaveProperty('isString');
    });

    it('should pass validation with secret at minimum length', async () => {
      const validData = {
        name: 'Test Webhook',
        url: 'https://api.test.com/webhook',
        eventTypes: ['flow.execution.completed'],
        secret: 'A'.repeat(16),
      };

      const dto = plainToInstance(CreateWebhookDto, validData);
      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
    });

    it('should pass validation with secret at maximum length', async () => {
      const validData = {
        name: 'Test Webhook',
        url: 'https://api.test.com/webhook',
        eventTypes: ['flow.execution.completed'],
        secret: 'A'.repeat(256),
      };

      const dto = plainToInstance(CreateWebhookDto, validData);
      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
    });
  });

  describe('headers validation (optional)', () => {
    it('should pass validation when headers is omitted', async () => {
      const validData = {
        name: 'Test Webhook',
        url: 'https://api.test.com/webhook',
        eventTypes: ['flow.execution.completed'],
      };

      const dto = plainToInstance(CreateWebhookDto, validData);
      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
    });

    it('should pass validation with valid headers', async () => {
      const validData = {
        name: 'Test Webhook',
        url: 'https://api.test.com/webhook',
        eventTypes: ['flow.execution.completed'],
        headers: {
          'X-API-Key': 'test-key',
          'Content-Type': 'application/json',
          'User-Agent': 'MyApp/1.0',
        },
      };

      const dto = plainToInstance(CreateWebhookDto, validData);
      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
    });

    it('should pass validation with empty headers object', async () => {
      const validData = {
        name: 'Test Webhook',
        url: 'https://api.test.com/webhook',
        eventTypes: ['flow.execution.completed'],
        headers: {},
      };

      const dto = plainToInstance(CreateWebhookDto, validData);
      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
    });

    it('should fail validation when headers is not an object', async () => {
      const invalidData = {
        name: 'Test Webhook',
        url: 'https://api.test.com/webhook',
        eventTypes: ['flow.execution.completed'],
        headers: 'not-an-object',
      };

      const dto = plainToInstance(CreateWebhookDto, invalidData);
      const errors = await validate(dto);

      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('headers');
      expect(errors[0].constraints).toHaveProperty('isObject');
    });

    it('should fail validation when headers is an array', async () => {
      const invalidData = {
        name: 'Test Webhook',
        url: 'https://api.test.com/webhook',
        eventTypes: ['flow.execution.completed'],
        headers: ['X-API-Key', 'test-key'],
      };

      const dto = plainToInstance(CreateWebhookDto, invalidData);
      const errors = await validate(dto);

      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('headers');
      expect(errors[0].constraints).toHaveProperty('isObject');
    });
  });

  describe('multiple validation errors', () => {
    it('should return multiple validation errors when multiple fields are invalid', async () => {
      const invalidData = {
        name: '',
        url: 'not-a-url',
        eventTypes: [],
        enabled: 'not-boolean',
        secret: 'short',
        headers: 'not-object',
      };

      const dto = plainToInstance(CreateWebhookDto, invalidData);
      const errors = await validate(dto);

      expect(errors.length).toBeGreaterThan(0);
      
      const errorProperties = errors.map(error => error.property);
      expect(errorProperties).toContain('name');
      expect(errorProperties).toContain('url');
      expect(errorProperties).toContain('eventTypes');
      expect(errorProperties).toContain('enabled');
      expect(errorProperties).toContain('secret');
      expect(errorProperties).toContain('headers');
    });
  });

  describe('edge cases', () => {
    it('should handle null values', async () => {
      const invalidData = {
        name: null,
        url: null,
        eventTypes: null,
        enabled: null,
        secret: null,
        headers: null,
      };

      const dto = plainToInstance(CreateWebhookDto, invalidData);
      const errors = await validate(dto);

      expect(errors.length).toBeGreaterThan(0);
      
      const errorProperties = errors.map(error => error.property);
      expect(errorProperties).toContain('name');
      expect(errorProperties).toContain('url');
      expect(errorProperties).toContain('eventTypes');
    });

    it('should handle undefined values', async () => {
      const invalidData = {
        name: undefined,
        url: undefined,
        eventTypes: undefined,
      };

      const dto = plainToInstance(CreateWebhookDto, invalidData);
      const errors = await validate(dto);

      expect(errors.length).toBeGreaterThan(0);
      
      const errorProperties = errors.map(error => error.property);
      expect(errorProperties).toContain('name');
      expect(errorProperties).toContain('url');
      expect(errorProperties).toContain('eventTypes');
    });

    it('should handle extra properties gracefully', async () => {
      const dataWithExtraProps = {
        name: 'Test Webhook',
        url: 'https://api.test.com/webhook',
        eventTypes: ['flow.execution.completed'],
        extraProperty: 'should be ignored',
        anotherExtra: 123,
      };

      const dto = plainToInstance(CreateWebhookDto, dataWithExtraProps);
      const errors = await validate(dto);

      // Should pass validation despite extra properties
      expect(errors).toHaveLength(0);
      // Verify the main properties are preserved
      expect(dto.name).toBe('Test Webhook');
      expect(dto.url).toBe('https://api.test.com/webhook');
      expect(dto.eventTypes).toEqual(['flow.execution.completed']);
    });
  });
});