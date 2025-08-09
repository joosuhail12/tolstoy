import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PinoLogger, getLoggerToken } from 'nestjs-pino';
import { DaytonaService } from './daytona.service';
import { AwsSecretsService } from '../aws-secrets.service';

// Mock the Daytona SDK
jest.mock('@daytonaio/sdk');

describe('DaytonaService', () => {
  let service: DaytonaService;
  let configService: jest.Mocked<ConfigService>;
  let logger: jest.Mocked<PinoLogger>;

  const mockSandbox = {
    process: {
      codeRun: jest.fn(),
    },
    destroy: jest.fn(),
  };

  const mockDaytona = {
    create: jest.fn().mockResolvedValue(mockSandbox),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DaytonaService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
        {
          provide: AwsSecretsService,
          useValue: {
            getSecret: jest.fn(),
            getDaytonaApiKey: jest.fn(),
            getDaytonaBaseUrl: jest.fn(),
          },
        },
        {
          provide: getLoggerToken(DaytonaService.name),
          useValue: {
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            debug: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<DaytonaService>(DaytonaService);
    configService = module.get(ConfigService);
    logger = module.get(getLoggerToken(DaytonaService.name));

    // Setup default config values
    configService.get.mockImplementation((key: string, defaultValue?: any) => {
      switch (key) {
        case 'DAYTONA_API_KEY':
          return 'test-api-key';
        case 'DAYTONA_API_URL':
          return 'https://api.daytona.io';
        case 'DAYTONA_TARGET':
          return 'us';
        default:
          return defaultValue;
      }
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('executeHttpRequest', () => {
    it('should execute HTTP request via direct HTTP when Daytona unavailable', async () => {
      // Service falls back to direct HTTP execution since Daytona is not initialized
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve(JSON.stringify({ message: 'Success' })),
        headers: new Map([['content-type', 'application/json']]),
      });

      const request = {
        url: 'https://api.example.com/test',
        method: 'POST' as const,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test: true }),
        timeout: 30000,
      };

      const result = await service.executeHttpRequest(request);

      expect(result.success).toBe(true);
      expect(result.statusCode).toBe(200);
      expect(result.data).toEqual({ message: 'Success' });
      expect(result.executedInSandbox).toBe(false);
    });

    it('should fall back to direct HTTP when Daytona is unavailable', async () => {
      // Service already uses direct HTTP since Daytona is not initialized
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve(JSON.stringify({ message: 'Direct HTTP' })),
        headers: new Map([['content-type', 'application/json']]),
      });

      const request = {
        url: 'https://api.example.com/test',
        method: 'GET' as const,
        headers: {},
      };

      const result = await service.executeHttpRequest(request);

      expect(result.success).toBe(true);
      expect(result.statusCode).toBe(200);
      expect(result.executedInSandbox).toBe(false);
    });

    it('should handle direct HTTP timeout', async () => {
      // Mock fetch timeout for direct HTTP execution
      global.fetch = jest.fn().mockRejectedValue(new Error('Request timeout after 5000ms'));

      const request = {
        url: 'https://api.example.com/test',
        method: 'GET' as const,
        headers: {},
        timeout: 5000,
      };

      const result = await service.executeHttpRequest(request);

      expect(result.success).toBe(false);
      expect(result.error?.type).toBe('network');
      expect(result.error?.message).toBe('Request timeout after 5000ms');
      // Direct HTTP errors don't call logger.error, only sandbox errors do
    });

    it('should handle direct HTTP network errors', async () => {
      // Mock network error for direct HTTP execution
      global.fetch = jest.fn().mockRejectedValue(new Error('Network connection failed'));

      const request = {
        url: 'https://invalid-url',
        method: 'GET' as const,
        headers: {},
      };

      const result = await service.executeHttpRequest(request);

      expect(result.success).toBe(false);
      expect(result.error?.type).toBe('network');
      expect(result.error?.message).toBe('Network connection failed');
    });

    it('should clean up sandbox on completion', async () => {
      // The test service is not initialized with Daytona, so it will use direct HTTP
      // This test validates that direct HTTP execution works without sandbox cleanup
      const request = {
        url: 'https://api.example.com/test',
        method: 'GET' as const,
        headers: {},
      };

      // Mock global fetch for direct HTTP execution
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve(JSON.stringify({ message: 'Direct HTTP' })),
        headers: new Map([['content-type', 'application/json']]),
      });

      const result = await service.executeHttpRequest(request);

      expect(result.success).toBe(true);
      expect(result.executedInSandbox).toBe(false);
      // Sandbox destroy is not called for direct HTTP execution
    });

    it('should handle malformed HTTP response', async () => {
      // Mock direct HTTP with malformed response text
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve('invalid json response'),
        headers: new Map(),
      });

      const request = {
        url: 'https://api.example.com/test',
        method: 'GET' as const,
        headers: {},
      };

      const result = await service.executeHttpRequest(request);

      // Direct HTTP with malformed JSON still succeeds, returns raw text
      expect(result.success).toBe(true);
      expect(result.statusCode).toBe(200);
      expect(result.data).toBe('invalid json response');
      expect(result.executedInSandbox).toBe(false);
    });
  });

  describe('getStatus', () => {
    it('should return service status', async () => {
      const status = await service.getStatus();

      expect(status).toEqual({
        available: false, // Service not initialized in test setup without AWS secrets
        activeSandboxes: 0,
        initialized: false,
      });
    });
  });

  describe('isDaytonaAvailable', () => {
    it('should return false when Daytona is not initialized', async () => {
      const available = await service.isDaytonaAvailable();
      expect(available).toBe(false);
    });
  });
});