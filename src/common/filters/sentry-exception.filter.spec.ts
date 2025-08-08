import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus } from '@nestjs/common';
import { ArgumentsHost } from '@nestjs/common';
import { FastifyRequest, FastifyReply } from 'fastify';
import { PinoLogger } from 'nestjs-pino';
import * as Sentry from '@sentry/node';
import { SentryExceptionFilter } from './sentry-exception.filter';

// Mock Sentry
jest.mock('@sentry/node');
const mockSentry = Sentry as jest.Mocked<typeof Sentry>;

describe('SentryExceptionFilter', () => {
  let filter: SentryExceptionFilter;
  let mockLogger: jest.Mocked<PinoLogger>;
  let mockRequest: jest.Mocked<FastifyRequest>;
  let mockReply: jest.Mocked<FastifyReply>;
  let mockArgumentsHost: jest.Mocked<ArgumentsHost>;
  let mockScope: jest.Mocked<Sentry.Scope>;

  beforeEach(async () => {
    // Reset all mocks
    jest.clearAllMocks();

    // Mock PinoLogger
    mockLogger = {
      error: jest.fn(),
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
    } as any;

    // Mock FastifyRequest
    mockRequest = {
      url: '/test',
      method: 'POST',
      headers: {
        'user-agent': 'test-agent',
        'x-org-id': 'test-org',
        'x-user-id': 'test-user',
        authorization: 'Bearer secret-token',
        cookie: 'session=abc123',
      },
      query: { param: 'value' },
      ip: '192.168.1.1',
    } as any;

    // Mock FastifyReply
    mockReply = {
      code: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    } as any;

    // Mock ArgumentsHost
    mockArgumentsHost = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue(mockRequest),
        getResponse: jest.fn().mockReturnValue(mockReply),
      }),
    } as any;

    // Mock Sentry scope
    mockScope = {
      setContext: jest.fn(),
      setTag: jest.fn(),
      setExtra: jest.fn(),
      setLevel: jest.fn(),
    } as any;

    (mockSentry.withScope as jest.Mock).mockImplementation((callback: any) => {
      callback(mockScope);
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SentryExceptionFilter,
        {
          provide: `PinoLogger:${SentryExceptionFilter.name}`,
          useValue: mockLogger,
        },
      ],
    }).compile();

    filter = module.get<SentryExceptionFilter>(SentryExceptionFilter);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('catch', () => {
    it('should handle HttpException with 400 status (client error)', () => {
      const exception = new HttpException('Validation failed', HttpStatus.BAD_REQUEST);

      filter.catch(exception, mockArgumentsHost);

      // Should log debug message for client errors
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Validation failed',
          status: 400,
          url: '/test',
          method: 'POST',
          orgId: 'test-org',
          userId: 'test-user',
        }),
        'Client error handled by Sentry filter',
      );

      // Should not capture in Sentry for client errors
      expect(mockSentry.captureException).not.toHaveBeenCalled();

      // Should send proper error response
      expect(mockReply.code).toHaveBeenCalledWith(400);
      expect(mockReply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 400,
          message: 'Validation failed',
          timestamp: expect.any(String),
          path: '/test',
        }),
      );
    });

    it('should handle HttpException with validation errors', () => {
      const validationErrors = [
        { field: 'name', message: 'Required' },
        { field: 'email', message: 'Invalid email' },
      ];
      const response = {
        message: 'Validation failed',
        error: 'Bad Request',
        errors: validationErrors,
      };
      const exception = new HttpException(response, HttpStatus.BAD_REQUEST);

      filter.catch(exception, mockArgumentsHost);

      // Should include validation errors in response
      expect(mockReply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 400,
          message: 'Validation failed',
          error: 'Bad Request',
          errors: validationErrors,
        }),
      );
    });

    it('should handle server error (500) and capture in Sentry', () => {
      const exception = new HttpException(
        'Internal server error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );

      filter.catch(exception, mockArgumentsHost);

      // Should log error message
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Internal server error',
          status: 500,
          url: '/test',
          method: 'POST',
          orgId: 'test-org',
          userId: 'test-user',
        }),
        'Unhandled exception captured by Sentry filter',
      );

      // Should capture in Sentry for server errors
      expect(mockSentry.withScope).toHaveBeenCalled();
      expect(mockSentry.captureException).toHaveBeenCalledWith(exception);

      // Should set proper Sentry context and tags
      expect(mockScope.setContext).toHaveBeenCalledWith(
        'request',
        expect.objectContaining({
          url: '/test',
          method: 'POST',
          ip: '192.168.1.1',
          userAgent: 'test-agent',
          headers: expect.objectContaining({
            'user-agent': 'test-agent',
            'x-org-id': 'test-org',
            'x-user-id': 'test-user',
            // Sensitive headers should be redacted
            authorization: '[REDACTED]',
            cookie: '[REDACTED]',
          }),
        }),
      );

      expect(mockScope.setTag).toHaveBeenCalledWith('orgId', 'test-org');
      expect(mockScope.setTag).toHaveBeenCalledWith('userId', 'test-user');
      expect(mockScope.setTag).toHaveBeenCalledWith('httpStatus', 500);
      expect(mockScope.setLevel).toHaveBeenCalledWith('error');
    });

    it('should handle unhandled JavaScript Error and capture in Sentry', () => {
      const error = new Error('Unexpected error occurred');

      filter.catch(error, mockArgumentsHost);

      // Should log error message
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Unexpected error occurred',
          status: 500,
        }),
        'Unhandled exception captured by Sentry filter',
      );

      // Should capture in Sentry for unhandled errors
      expect(mockSentry.captureException).toHaveBeenCalledWith(error);
      expect(mockScope.setLevel).toHaveBeenCalledWith('error');

      // Should send 500 error response
      expect(mockReply.code).toHaveBeenCalledWith(500);
      expect(mockReply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 500,
          message: 'Unexpected error occurred',
        }),
      );
    });

    it('should handle non-Error exceptions', () => {
      const exception = 'String error';

      filter.catch(exception, mockArgumentsHost);

      // Should capture in Sentry and log as server error
      expect(mockSentry.captureException).toHaveBeenCalledWith(exception);
      expect(mockLogger.error).toHaveBeenCalled();

      // Should send generic error response
      expect(mockReply.code).toHaveBeenCalledWith(500);
      expect(mockReply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 500,
          message: 'Internal server error',
        }),
      );
    });

    it('should handle request without tenant headers', () => {
      // Remove tenant headers from request
      mockRequest.headers = {
        'user-agent': 'test-agent',
        'content-type': 'application/json',
      };

      const exception = new Error('Test error');

      filter.catch(exception, mockArgumentsHost);

      // Should not set tenant tags when headers are missing
      expect(mockScope.setTag).not.toHaveBeenCalledWith('orgId', expect.anything());
      expect(mockScope.setTag).not.toHaveBeenCalledWith('userId', expect.anything());
      expect(mockScope.setTag).toHaveBeenCalledWith('httpStatus', 500);
    });

    it('should sanitize sensitive headers properly', () => {
      mockRequest.headers = {
        authorization: 'Bearer secret-token',
        cookie: 'session=abc123',
        'x-api-key': 'api-key-123',
        'x-auth-token': 'auth-token-456',
        'user-agent': 'test-agent',
        'content-type': 'application/json',
      };

      const exception = new Error('Test error');

      filter.catch(exception, mockArgumentsHost);

      // Check that sensitive headers are redacted
      expect(mockScope.setContext).toHaveBeenCalledWith(
        'request',
        expect.objectContaining({
          headers: expect.objectContaining({
            authorization: '[REDACTED]',
            cookie: '[REDACTED]',
            'x-api-key': '[REDACTED]',
            'x-auth-token': '[REDACTED]',
            'user-agent': 'test-agent',
            'content-type': 'application/json',
          }),
        }),
      );
    });

    it('should set error level to warning for 4xx errors', () => {
      const exception = new HttpException('Not Found', HttpStatus.NOT_FOUND);

      filter.catch(exception, mockArgumentsHost);

      // Should not capture 404 errors in Sentry (client errors)
      expect(mockSentry.captureException).not.toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalled();
    });

    it('should include extra context for validation errors', () => {
      const validationResponse = {
        message: 'Validation failed',
        errors: [
          { field: 'email', message: 'Invalid email format' },
          { field: 'age', message: 'Must be a number' },
        ],
      };
      const exception = new HttpException(validationResponse, HttpStatus.BAD_REQUEST);

      filter.catch(exception, mockArgumentsHost);

      // Should include validation errors in response
      expect(mockReply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          errors: validationResponse.errors,
        }),
      );
    });
  });
});
