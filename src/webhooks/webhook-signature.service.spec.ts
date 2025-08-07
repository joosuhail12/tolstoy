import { Test, TestingModule } from '@nestjs/testing';
import { WebhookSignatureService } from './webhook-signature.service';

describe('WebhookSignatureService', () => {
  let service: WebhookSignatureService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [WebhookSignatureService],
    }).compile();

    service = module.get(WebhookSignatureService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateSignature', () => {
    it('should generate consistent signature for same payload and secret', () => {
      const payload = { test: 'data' };
      const secret = 'test-secret';

      const signature1 = service.generateSignature(payload, secret);
      const signature2 = service.generateSignature(payload, secret);

      expect(signature1).toBe(signature2);
      expect(signature1).toMatch(/^sha256=[a-f0-9]{64}$/);
    });

    it('should generate different signatures for different payloads', () => {
      const secret = 'test-secret';
      const payload1 = { test: 'data1' };
      const payload2 = { test: 'data2' };

      const signature1 = service.generateSignature(payload1, secret);
      const signature2 = service.generateSignature(payload2, secret);

      expect(signature1).not.toBe(signature2);
    });

    it('should generate different signatures for different secrets', () => {
      const payload = { test: 'data' };
      const secret1 = 'secret1';
      const secret2 = 'secret2';

      const signature1 = service.generateSignature(payload, secret1);
      const signature2 = service.generateSignature(payload, secret2);

      expect(signature1).not.toBe(signature2);
    });

    it('should handle string payloads', () => {
      const payload = 'test string payload';
      const secret = 'test-secret';

      const signature = service.generateSignature(payload, secret);

      expect(signature).toMatch(/^sha256=[a-f0-9]{64}$/);
    });
  });

  describe('verifySignature', () => {
    it('should verify valid signature', () => {
      const payload = { test: 'data' };
      const secret = 'test-secret';
      const signature = service.generateSignature(payload, secret);

      const isValid = service.verifySignature(payload, signature, secret);

      expect(isValid).toBe(true);
    });

    it('should reject invalid signature', () => {
      const payload = { test: 'data' };
      const secret = 'test-secret';
      const invalidSignature = 'sha256=invalid';

      const isValid = service.verifySignature(payload, invalidSignature, secret);

      expect(isValid).toBe(false);
    });

    it('should reject if signature is missing', () => {
      const payload = { test: 'data' };
      const secret = 'test-secret';

      const isValid = service.verifySignature(payload, '', secret);

      expect(isValid).toBe(false);
    });

    it('should reject if secret is missing', () => {
      const payload = { test: 'data' };
      const signature = 'sha256=somesignature';

      const isValid = service.verifySignature(payload, signature, '');

      expect(isValid).toBe(false);
    });
  });

  describe('generateWebhookHeaders', () => {
    it('should generate headers with signature when secret provided', () => {
      const eventType = 'flow.completed';
      const payload = { test: 'data' };
      const secret = 'test-secret';

      const headers = service.generateWebhookHeaders(eventType, payload, secret);

      expect(headers['x-webhook-event']).toBe(eventType);
      expect(headers['x-webhook-timestamp']).toBeDefined();
      expect(headers['x-webhook-delivery']).toMatch(/^whd_\d+_[a-f0-9]{16}$/);
      expect(headers['x-webhook-signature']).toMatch(/^sha256=[a-f0-9]{64}$/);
    });

    it('should generate headers without signature when secret not provided', () => {
      const eventType = 'flow.completed';
      const payload = { test: 'data' };

      const headers = service.generateWebhookHeaders(eventType, payload);

      expect(headers['x-webhook-event']).toBe(eventType);
      expect(headers['x-webhook-timestamp']).toBeDefined();
      expect(headers['x-webhook-delivery']).toBeDefined();
      expect(headers['x-webhook-signature']).toBeUndefined();
    });
  });

  describe('verifyWebhookRequest', () => {
    it('should verify valid webhook request', () => {
      const body = { test: 'data' };
      const secret = 'test-secret';
      const timestamp = Date.now();
      const payloadWithTimestamp = { timestamp, ...body };
      const signature = service.generateSignature(payloadWithTimestamp, secret);

      const headers = {
        'x-webhook-signature': signature,
        'x-webhook-timestamp': timestamp.toString(),
      };

      const result = service.verifyWebhookRequest(body, headers, secret);

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject request with missing signature', () => {
      const body = { test: 'data' };
      const headers = {
        'x-webhook-timestamp': Date.now().toString(),
      };

      const result = service.verifyWebhookRequest(body, headers, 'secret');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Missing signature header');
    });

    it('should reject request with missing timestamp', () => {
      const body = { test: 'data' };
      const headers = {
        'x-webhook-signature': 'sha256=test',
      };

      const result = service.verifyWebhookRequest(body, headers, 'secret');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Missing timestamp header');
    });

    it('should reject request with invalid timestamp format', () => {
      const body = { test: 'data' };
      const headers = {
        'x-webhook-signature': 'sha256=test',
        'x-webhook-timestamp': 'invalid',
      };

      const result = service.verifyWebhookRequest(body, headers, 'secret');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid timestamp format');
    });

    it('should reject request with old timestamp (replay attack)', () => {
      const body = { test: 'data' };
      const oldTimestamp = Date.now() - 10 * 60 * 1000; // 10 minutes ago
      const headers = {
        'x-webhook-signature': 'sha256=test',
        'x-webhook-timestamp': oldTimestamp.toString(),
      };

      const result = service.verifyWebhookRequest(body, headers, 'secret');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('replay attack');
    });

    it('should reject request with invalid signature', () => {
      const body = { test: 'data' };
      const headers = {
        'x-webhook-signature': 'sha256=invalidsignature',
        'x-webhook-timestamp': Date.now().toString(),
      };

      const result = service.verifyWebhookRequest(body, headers, 'secret');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid signature');
    });
  });

  describe('generateDeliveryId', () => {
    it('should generate unique delivery IDs', () => {
      const id1 = service.generateDeliveryId();
      const id2 = service.generateDeliveryId();

      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^whd_\d+_[a-f0-9]{16}$/);
      expect(id2).toMatch(/^whd_\d+_[a-f0-9]{16}$/);
    });
  });

  describe('createWebhookPayload', () => {
    it('should create webhook payload with metadata', () => {
      const eventType = 'flow.completed';
      const data = { flowId: 'flow-123' };
      const metadata = { orgId: 'org-123', webhookId: 'webhook-123' };

      const payload = service.createWebhookPayload(eventType, data, metadata);

      expect(payload.eventType).toBe(eventType);
      expect(payload.data).toEqual(data);
      expect(payload.timestamp).toBeDefined();
      expect(payload.metadata).toBeDefined();
      expect(payload.metadata?.orgId).toBe('org-123');
      expect(payload.metadata?.webhookId).toBe('webhook-123');
      expect(payload.metadata?.deliveryId).toMatch(/^whd_\d+_[a-f0-9]{16}$/);
    });

    it('should create webhook payload without metadata', () => {
      const eventType = 'flow.completed';
      const data = { flowId: 'flow-123' };

      const payload = service.createWebhookPayload(eventType, data);

      expect(payload.eventType).toBe(eventType);
      expect(payload.data).toEqual(data);
      expect(payload.timestamp).toBeDefined();
      expect(payload.metadata).toBeUndefined();
    });
  });

  describe('generateWebhookSecret', () => {
    it('should generate webhook secret with correct format', () => {
      const secret = service.generateWebhookSecret();

      expect(secret).toMatch(/^whsec_[a-f0-9]{48}$/);
    });

    it('should generate unique secrets', () => {
      const secret1 = service.generateWebhookSecret();
      const secret2 = service.generateWebhookSecret();

      expect(secret1).not.toBe(secret2);
    });
  });

  describe('isValidWebhookUrl', () => {
    const originalEnv = process.env.NODE_ENV;

    afterEach(() => {
      process.env.NODE_ENV = originalEnv;
    });

    it('should accept valid HTTPS URL', () => {
      const isValid = service.isValidWebhookUrl('https://example.com/webhook');
      expect(isValid).toBe(true);
    });

    it('should accept valid HTTP URL', () => {
      const isValid = service.isValidWebhookUrl('http://example.com/webhook');
      expect(isValid).toBe(true);
    });

    it('should reject invalid URL', () => {
      const isValid = service.isValidWebhookUrl('not-a-url');
      expect(isValid).toBe(false);
    });

    it('should reject non-HTTP protocols', () => {
      const isValid = service.isValidWebhookUrl('ftp://example.com/webhook');
      expect(isValid).toBe(false);
    });

    it('should allow localhost in development', () => {
      process.env.NODE_ENV = 'development';
      const isValid = service.isValidWebhookUrl('http://localhost:3000/webhook');
      expect(isValid).toBe(true);
    });

    it('should reject localhost in production', () => {
      process.env.NODE_ENV = 'production';
      const isValid = service.isValidWebhookUrl('http://localhost:3000/webhook');
      expect(isValid).toBe(false);
    });

    it('should reject local IPs in production', () => {
      process.env.NODE_ENV = 'production';
      expect(service.isValidWebhookUrl('http://127.0.0.1/webhook')).toBe(false);
      expect(service.isValidWebhookUrl('http://192.168.1.1/webhook')).toBe(false);
      expect(service.isValidWebhookUrl('http://10.0.0.1/webhook')).toBe(false);
    });
  });
});
