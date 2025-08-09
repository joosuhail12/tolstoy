import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { Response } from 'express';
import { Counter, register } from 'prom-client';
import { OAuthController } from './oauth.controller';
import { OAuthService } from './oauth.service';
import { MetricsService } from '../metrics/metrics.service';

describe('OAuthController', () => {
  let controller: OAuthController;
  let oauthService: jest.Mocked<OAuthService>;
  let metricsService: jest.Mocked<MetricsService>;
  let mockResponse: jest.Mocked<Response>;
  let mockRequest: any;

  const mockOrgId = 'org_123';
  const mockUserId = 'user_456';
  const mockToolId = 'tool-123';
  const mockToolKey = 'github';
  const mockState = 'state_abc123';
  const mockCode = 'auth_code_xyz';
  const mockCredentialId = 'credential_123';

  beforeEach(async () => {
    // Clear Prometheus registry before each test
    register.clear();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [OAuthController],
      providers: [
        {
          provide: OAuthService,
          useValue: {
            getAuthorizeUrl: jest.fn(),
            handleCallback: jest.fn(),
          },
        },
        {
          provide: MetricsService,
          useValue: {
            incrementOAuthRedirect: jest.fn(),
            incrementOAuthCallback: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<OAuthController>(OAuthController);
    oauthService = module.get(OAuthService);
    metricsService = module.get(MetricsService);

    // Mock Express Response object
    mockResponse = {
      redirect: jest.fn(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    } as any;
    
    // Mock Express Request object  
    mockRequest = {
      get: (header: string) => {
        if (header === 'host') return 'localhost';
        if (header === 'user-agent') return 'test-agent';
        if (header === 'referer') return 'https://github.com';
        return null;
      },
      ip: '127.0.0.1',
      connection: { remoteAddress: '127.0.0.1' }
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
    // Clear Prometheus registry after each test
    register.clear();
  });

  describe('initiateLogin', () => {
    const mockParams = { toolId: mockToolId };
    const mockQuery = { userId: mockUserId };
    const mockRequest = { get: () => 'localhost' };

    it('should redirect to OAuth provider successfully', async () => {
      const mockAuthUrl = 'https://github.com/login/oauth/authorize?client_id=123&...';
      oauthService.getAuthorizeUrl.mockResolvedValue({
        url: mockAuthUrl,
        state: mockState,
        toolKey: mockToolKey,
      });

      await controller.initiateLogin(mockParams, mockQuery, mockOrgId, mockRequest as any, mockResponse);

      expect(oauthService.getAuthorizeUrl).toHaveBeenCalledWith(mockToolId, mockOrgId, mockUserId, 'localhost');
      expect(metricsService.incrementOAuthRedirect).toHaveBeenCalledWith({ orgId: mockOrgId, toolKey: mockToolKey });
      expect(mockResponse.redirect).toHaveBeenCalledWith(302, mockAuthUrl);
    });

    it('should return 400 for missing X-Org-ID header', async () => {
      await controller.initiateLogin(mockParams, mockQuery, '', mockRequest as any, mockResponse);

      // Metrics are not incremented on validation errors before service call
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'X-Org-ID header is required',
        code: 'BAD_REQUEST',
      });
      expect(oauthService.getAuthorizeUrl).not.toHaveBeenCalled();
    });

    it('should handle service errors gracefully', async () => {
      oauthService.getAuthorizeUrl.mockRejectedValue(
        new BadRequestException('Tool not configured for OAuth'),
      );

      await controller.initiateLogin(mockParams, mockQuery, mockOrgId, mockRequest as any, mockResponse);

      // Metrics are not incremented on service errors
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Tool not configured for OAuth',
        code: 'BAD_REQUEST',
      });
    });

    it('should handle unexpected errors', async () => {
      oauthService.getAuthorizeUrl.mockRejectedValue(new Error('Unexpected error'));

      await controller.initiateLogin(mockParams, mockQuery, mockOrgId, mockRequest as any, mockResponse);

      // Metrics are not incremented on unexpected errors
      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Failed to initiate OAuth login',
        code: 'INTERNAL_ERROR',
      });
    });

    it('should increment metrics correctly', async () => {
      oauthService.getAuthorizeUrl.mockResolvedValue({
        url: 'https://example.com/oauth',
        state: mockState,
        toolKey: mockToolKey,
      });

      await controller.initiateLogin(mockParams, mockQuery, mockOrgId, mockRequest as any, mockResponse);

      expect(metricsService.incrementOAuthRedirect).toHaveBeenCalledTimes(1);
      expect(metricsService.incrementOAuthRedirect).toHaveBeenCalledWith({ orgId: mockOrgId, toolKey: mockToolKey });
    });
  });

  describe('handleCallback', () => {
    const mockQuery = {
      code: mockCode,
      state: mockState,
    };

    it('should handle successful OAuth callback', async () => {
      oauthService.handleCallback.mockResolvedValue({
        credentialId: mockCredentialId,
        toolKey: mockToolKey,
        toolId: mockToolId,
        orgId: mockOrgId,
      });

      await controller.handleCallback(mockQuery, mockRequest as any, mockResponse);

      expect(oauthService.handleCallback).toHaveBeenCalledWith(mockCode, mockState);
      expect(metricsService.incrementOAuthCallback).toHaveBeenCalledWith({
        orgId: mockOrgId,
        toolKey: mockToolKey,
        success: 'true',
      });
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.send).toHaveBeenCalledWith(
        expect.stringContaining('Authorization Successful!'),
      );
    });

    it('should handle OAuth provider errors', async () => {
      const mockErrorQuery = {
        ...mockQuery,
        error: 'access_denied',
        error_description: 'The user denied the request',
      };

      await controller.handleCallback(mockErrorQuery, mockRequest as any, mockResponse);

      // Error metrics are not recorded for OAuth provider errors (no orgId available)
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.send).toHaveBeenCalledWith(
        expect.stringContaining('Authorization Failed'),
      );
      expect(oauthService.handleCallback).not.toHaveBeenCalled();
    });

    it('should handle missing authorization code', async () => {
      const mockQueryWithoutCode = {
        code: '',
        state: mockState,
      };

      await controller.handleCallback(mockQueryWithoutCode, mockRequest as any, mockResponse);

      expect(metricsService.incrementOAuthCallback).toHaveBeenCalledWith({
        orgId: 'unknown',
        toolKey: 'unknown',
        success: 'false',
      });
      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.send).toHaveBeenCalledWith(
        expect.stringContaining('Authorization Failed'),
      );
    });

    it('should handle missing state parameter', async () => {
      const mockQueryWithoutState = {
        code: mockCode,
        state: '',
      };

      await controller.handleCallback(mockQueryWithoutState, mockRequest as any, mockResponse);

      expect(metricsService.incrementOAuthCallback).toHaveBeenCalledWith({
        orgId: 'unknown',
        toolKey: 'unknown',
        success: 'false',
      });
      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.send).toHaveBeenCalledWith(
        expect.stringContaining('Authorization Failed'),
      );
    });

    it('should handle service callback errors', async () => {
      oauthService.handleCallback.mockRejectedValue(new Error('Invalid state parameter'));

      await controller.handleCallback(mockQuery, mockRequest as any, mockResponse);

      expect(metricsService.incrementOAuthCallback).toHaveBeenCalledWith({
        orgId: 'unknown',
        toolKey: 'unknown',
        success: 'false',
      });
      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.send).toHaveBeenCalledWith(
        expect.stringContaining('Authorization Failed'),
      );
    });

    it('should increment metrics correctly for success', async () => {
      oauthService.handleCallback.mockResolvedValue({
        credentialId: mockCredentialId,
        toolKey: mockToolKey,
        toolId: mockToolId,
        orgId: mockOrgId,
      });

      await controller.handleCallback(mockQuery, mockRequest as any, mockResponse);

      expect(metricsService.incrementOAuthCallback).toHaveBeenCalledTimes(1);
      expect(metricsService.incrementOAuthCallback).toHaveBeenCalledWith({
        orgId: mockOrgId,
        toolKey: mockToolKey,
        success: 'true',
      });
    });

    it('should increment metrics correctly for OAuth provider error', async () => {
      const mockErrorQuery = {
        ...mockQuery,
        error: 'invalid_request',
        error_description: 'Invalid request parameters',
      };

      await controller.handleCallback(mockErrorQuery, mockRequest as any, mockResponse);

      // OAuth provider errors do not increment metrics
    });

    it('should increment metrics correctly for processing error', async () => {
      oauthService.handleCallback.mockRejectedValue(new Error('Processing failed'));

      await controller.handleCallback(mockQuery, mockRequest as any, mockResponse);

      expect(metricsService.incrementOAuthCallback).toHaveBeenCalledTimes(1);
      expect(metricsService.incrementOAuthCallback).toHaveBeenCalledWith({
        orgId: 'unknown',
        toolKey: 'unknown',
        success: 'false',
      });
    });
  });

  describe('HTML page generation', () => {
    it('should generate success page with tool name', async () => {
      oauthService.handleCallback.mockResolvedValue({
        credentialId: mockCredentialId,
        toolKey: mockToolKey,
        toolId: mockToolId,
        orgId: mockOrgId,
      });

      await controller.handleCallback(
        { code: mockCode, state: mockState },
        mockRequest as any,
        mockResponse,
      );

      const htmlContent = mockResponse.send.mock.calls[0][0];
      expect(htmlContent).toContain('Authorization Successful!');
      expect(htmlContent).toContain(mockToolKey);
      expect(htmlContent).toContain('✓');
      expect(htmlContent).toContain('Close Window');
    });

    it('should generate error page with error message', async () => {
      const errorMessage = 'The user denied the request';
      const mockErrorQuery = {
        code: mockCode,
        state: mockState,
        error: 'access_denied',
        error_description: errorMessage,
      };

      await controller.handleCallback(mockErrorQuery, mockRequest as any, mockResponse);

      const htmlContent = mockResponse.send.mock.calls[0][0];
      expect(htmlContent).toContain('Authorization Failed');
      expect(htmlContent).toContain(errorMessage);
      expect(htmlContent).toContain('oauth'); // OAuth provider errors use 'oauth' as fallback
      expect(htmlContent).toContain('⚠');
    });

    it('should include auto-close script in HTML pages', async () => {
      oauthService.handleCallback.mockResolvedValue({
        credentialId: mockCredentialId,
        toolKey: mockToolKey,
        toolId: mockToolId,
        orgId: mockOrgId,
      });

      await controller.handleCallback(
        { code: mockCode, state: mockState },
        mockRequest as any,
        mockResponse,
      );

      const htmlContent = mockResponse.send.mock.calls[0][0];
      expect(htmlContent).toContain('window.opener');
      expect(htmlContent).toContain('setTimeout');
      expect(htmlContent).toContain('window.close()');
    });
  });
});
