import { Test, TestingModule } from '@nestjs/testing';
import { Response } from 'express';
import { HttpStatus } from '@nestjs/common';
import { OAuthController } from './oauth.controller';
import { OAuthService } from './oauth.service';
import { MetricsService } from '../metrics/metrics.service';

describe('OAuthController - Metrics', () => {
  let controller: OAuthController;
  let oauthService: jest.Mocked<OAuthService>;
  let metricsService: jest.Mocked<MetricsService>;
  let mockResponse: Partial<Response>;

  beforeEach(async () => {
    const mockOAuthService = {
      getAuthorizeUrl: jest.fn(),
      handleCallback: jest.fn(),
    };

    const mockMetricsService = {
      incrementOAuthRedirect: jest.fn(),
      incrementOAuthCallback: jest.fn(),
    };

    mockResponse = {
      redirect: jest.fn(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      send: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [OAuthController],
      providers: [
        { provide: OAuthService, useValue: mockOAuthService },
        { provide: MetricsService, useValue: mockMetricsService },
      ],
    }).compile();

    controller = module.get<OAuthController>(OAuthController);
    oauthService = module.get(OAuthService);
    metricsService = module.get(MetricsService);
  });

  describe('initiateLogin', () => {
    it('should increment OAuth redirect metrics on successful redirect', async () => {
      const params = { toolKey: 'github' };
      const query = { userId: 'user-123' };
      const orgId = 'org-456';
      const mockUrl = 'https://github.com/login/oauth/authorize?...';

      oauthService.getAuthorizeUrl.mockResolvedValue({ url: mockUrl, state: 'state-123' });

      await controller.initiateLogin(params, query, orgId, mockResponse as Response);

      expect(metricsService.incrementOAuthRedirect).toHaveBeenCalledWith({
        orgId: 'org-456',
        toolKey: 'github',
      });

      expect(mockResponse.redirect).toHaveBeenCalledWith(HttpStatus.FOUND, mockUrl);
    });

    it('should not increment metrics when orgId is missing', async () => {
      const params = { toolKey: 'github' };
      const query = { userId: 'user-123' };

      await controller.initiateLogin(params, query, '', mockResponse as Response);

      expect(metricsService.incrementOAuthRedirect).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    });
  });

  describe('handleCallback', () => {
    it('should increment OAuth callback success metrics', async () => {
      const params = { toolKey: 'github' };
      const query = { code: 'auth-code', state: 'state-123' };
      const mockResult = {
        credentialId: 'cred-456',
        toolKey: 'github',
        orgId: 'org-456',
      };

      oauthService.handleCallback.mockResolvedValue(mockResult);

      await controller.handleCallback(params, query, mockResponse as Response);

      expect(metricsService.incrementOAuthCallback).toHaveBeenCalledWith({
        orgId: 'org-456',
        toolKey: 'github',
        success: 'true',
      });

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.OK);
    });

    it('should increment OAuth callback failure metrics on error', async () => {
      const params = { toolKey: 'github' };
      const query = { code: 'auth-code', state: 'state-123' };

      oauthService.handleCallback.mockRejectedValue(new Error('Invalid state'));

      await controller.handleCallback(params, query, mockResponse as Response);

      expect(metricsService.incrementOAuthCallback).toHaveBeenCalledWith({
        orgId: 'unknown', // Fallback when we can't extract orgId from state
        toolKey: 'github',
        success: 'false',
      });

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    });

    it('should not increment success metrics when OAuth provider returns error', async () => {
      const params = { toolKey: 'github' };
      const query = {
        code: '',
        state: '',
        error: 'access_denied',
        error_description: 'User denied access',
      };

      await controller.handleCallback(params, query, mockResponse as Response);

      // No metrics should be recorded for provider errors
      expect(metricsService.incrementOAuthCallback).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    });
  });
});
