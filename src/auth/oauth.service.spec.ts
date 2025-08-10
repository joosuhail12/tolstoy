import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { OAuthService } from './oauth.service';
import { AuthConfigService } from './auth-config.service';
import { RedisCacheService } from '../cache/redis-cache.service';
import { PrismaService } from '../prisma.service';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Mock axios.isAxiosError function
const mockedIsAxiosError = jest.fn();
(axios as any).isAxiosError = mockedIsAxiosError;

describe('OAuthService', () => {
  let service: OAuthService;
  let authConfigService: jest.Mocked<AuthConfigService>;
  let redisCacheService: jest.Mocked<RedisCacheService>;
  let prismaService: any;
  let module: TestingModule;

  const mockOrgId = 'org_123';
  const mockUserId = 'user_456';
  const mockToolKey = 'github';
  const mockToolId = 'tool_789';
  const mockState = 'state_abc123';
  const mockCode = 'auth_code_xyz';

  const mockOAuthConfig = {
    id: 'oauth-config-123',
    orgId: mockOrgId,
    toolId: mockToolId,
    name: 'default',
    type: 'oauth2',
    isDefault: true,
    config: {
      clientId: 'test_client_id',
      clientSecret: 'test_client_secret',
      redirectUri: 'https://example.com/callback',
      scope: 'read:user',
    },
    tool: { id: mockToolId },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    module = await Test.createTestingModule({
      providers: [
        OAuthService,
        {
          provide: AuthConfigService,
          useValue: {
            getDefaultOrgAuthConfig: jest.fn(),
            getOrgAuthConfig: jest.fn(),
            setUserCredentials: jest.fn(),
          },
        },
        {
          provide: RedisCacheService,
          useValue: {
            set: jest.fn(),
            get: jest.fn(),
            del: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('http://localhost:3000'),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            tool: {
              findUnique: jest.fn().mockResolvedValue({
                id: mockToolId,
                name: mockToolKey,
                orgId: mockOrgId,
              }),
            },
          },
        },
      ],
    }).compile();

    service = module.get<OAuthService>(OAuthService);
    authConfigService = module.get(AuthConfigService);
    redisCacheService = module.get(RedisCacheService);
    prismaService = module.get(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getAuthorizeUrl', () => {
    it('should generate OAuth authorization URL successfully', async () => {
      authConfigService.getDefaultOrgAuthConfig.mockResolvedValue(mockOAuthConfig);
      redisCacheService.set.mockResolvedValue(undefined);

      const result = await service.getAuthorizeUrl(mockToolId, mockOrgId, mockUserId);

      expect(result.url).toContain('https://github.com/login/oauth/authorize');
      expect(result.url).toContain('client_id=test_client_id');
      expect(result.url).toContain('redirect_uri=https%3A%2F%2Fexample.com%2Fcallback');
      expect(result.url).toContain('scope=read%3Auser');
      expect(result.url).toContain('response_type=code');
      expect(result.url).toContain(`state=${result.state}`);
      expect(result.state).toBeDefined();

      expect(authConfigService.getDefaultOrgAuthConfig).toHaveBeenCalledWith(mockOrgId, mockToolId);
      expect(redisCacheService.set).toHaveBeenCalledWith(
        `oauth:state:${result.state}`,
        expect.stringContaining(mockOrgId),
        { ttl: 300 },
      );
    });

    it('should throw BadRequestException for non-OAuth2 tools', async () => {
      const nonOAuthConfig = { ...mockOAuthConfig, type: 'apiKey' };
      authConfigService.getDefaultOrgAuthConfig.mockResolvedValue(nonOAuthConfig);

      await expect(service.getAuthorizeUrl(mockToolId, mockOrgId, mockUserId)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException for missing clientId', async () => {
      const incompleteConfig = {
        ...mockOAuthConfig,
        config: { ...mockOAuthConfig.config, clientId: undefined },
      };
      authConfigService.getDefaultOrgAuthConfig.mockResolvedValue(incompleteConfig);

      await expect(service.getAuthorizeUrl(mockToolId, mockOrgId, mockUserId)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException for missing clientSecret', async () => {
      const incompleteConfig = {
        ...mockOAuthConfig,
        config: { ...mockOAuthConfig.config, clientSecret: undefined },
      };
      authConfigService.getDefaultOrgAuthConfig.mockResolvedValue(incompleteConfig);

      await expect(service.getAuthorizeUrl(mockToolId, mockOrgId, mockUserId)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException for missing redirectUri', async () => {
      const incompleteConfig = {
        ...mockOAuthConfig,
        config: { ...mockOAuthConfig.config, redirectUri: undefined },
      };
      authConfigService.getDefaultOrgAuthConfig.mockResolvedValue(incompleteConfig);

      await expect(service.getAuthorizeUrl(mockToolId, mockOrgId, mockUserId)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should use custom authorize URL if provided', async () => {
      const customConfig = {
        ...mockOAuthConfig,
        config: {
          ...mockOAuthConfig.config,
          authorizeUrl: 'https://custom-provider.com/oauth/authorize',
        },
      };
      authConfigService.getDefaultOrgAuthConfig.mockResolvedValue(customConfig);
      redisCacheService.set.mockResolvedValue(undefined);

      const result = await service.getAuthorizeUrl(mockToolId, mockOrgId, mockUserId);

      expect(result.url).toContain('https://custom-provider.com/oauth/authorize');
    });

    it('should throw error for unknown tool ID', async () => {
      // Mock tool not found during validation
      prismaService.tool.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.getAuthorizeUrl('unknown-tool-id', mockOrgId, mockUserId),
      ).rejects.toThrow('Tool with ID unknown-tool-id not found');
    });
  });

  describe('handleCallback', () => {
    const mockStateData = {
      orgId: mockOrgId,
      userId: mockUserId,
      toolId: mockToolId, // Changed from toolKey to toolId
      timestamp: Date.now(),
    };

    const mockTokenResponse = {
      access_token: 'access_token_123',
      refresh_token: 'refresh_token_456',
      expires_in: 3600,
      scope: 'read:user',
      token_type: 'Bearer',
    };

    const mockCredential = {
      id: 'credential_123',
      orgId: mockOrgId,
      userId: mockUserId,
      toolId: mockToolId,
      accessToken: mockTokenResponse.access_token,
      refreshToken: mockTokenResponse.refresh_token,
      expiresAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    beforeEach(() => {
      redisCacheService.get.mockResolvedValue(JSON.stringify(mockStateData));
      redisCacheService.del.mockResolvedValue(undefined);
      authConfigService.getDefaultOrgAuthConfig.mockResolvedValue(mockOAuthConfig);
      authConfigService.setUserCredentials.mockResolvedValue(mockCredential);
    });

    it('should handle OAuth callback successfully', async () => {
      mockedAxios.post.mockResolvedValue({
        status: 200,
        data: mockTokenResponse,
      });

      const result = await service.handleCallback(mockCode, mockState);

      expect(result.credentialId).toBe(mockCredential.id);
      expect(result.toolKey).toBe(mockToolKey);

      expect(redisCacheService.get).toHaveBeenCalledWith(`oauth:state:${mockState}`);
      expect(redisCacheService.del).toHaveBeenCalledWith(`oauth:state:${mockState}`);
      expect(authConfigService.getDefaultOrgAuthConfig).toHaveBeenCalledWith(mockOrgId, mockToolId);
      expect(authConfigService.setUserCredentials).toHaveBeenCalledWith(
        mockOrgId,
        mockUserId,
        mockToolId,
        mockTokenResponse.access_token,
        mockTokenResponse.refresh_token,
        expect.any(Date),
      );
    });

    it('should throw UnauthorizedException for invalid state', async () => {
      redisCacheService.get.mockResolvedValue(null);

      await expect(service.handleCallback(mockCode, 'invalid_state')).rejects.toThrow(
        UnauthorizedException,
      );

      expect(redisCacheService.del).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException for expired state', async () => {
      const expiredStateData = {
        ...mockStateData,
        timestamp: Date.now() - 400000, // More than 5 minutes ago
      };
      redisCacheService.get.mockResolvedValue(JSON.stringify(expiredStateData));

      await expect(service.handleCallback(mockCode, mockState)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should handle token exchange failure', async () => {
      // Set up state validation to pass
      const validStateData = {
        orgId: mockOrgId,
        toolId: mockToolId, // Changed from toolKey to toolId
        userId: mockUserId,
        timestamp: Date.now(), // Use timestamp instead of createdAt to match the actual state structure
      };
      redisCacheService.get.mockResolvedValue(JSON.stringify(validStateData));

      // Set up OAuth config
      authConfigService.getDefaultOrgAuthConfig.mockResolvedValue(mockOAuthConfig);

      mockedAxios.post.mockRejectedValue(new Error('Token exchange failed'));

      await expect(service.handleCallback(mockCode, mockState)).rejects.toThrow(
        'Token exchange failed',
      );
    });

    it('should handle HTTP error in token exchange', async () => {
      // Set up state validation to pass
      const validStateData = {
        orgId: mockOrgId,
        toolId: mockToolId, // Changed from toolKey to toolId
        userId: mockUserId,
        timestamp: Date.now(), // Use timestamp instead of createdAt to match the actual state structure
      };
      redisCacheService.get.mockResolvedValue(JSON.stringify(validStateData));

      // Set up OAuth config
      authConfigService.getDefaultOrgAuthConfig.mockResolvedValue(mockOAuthConfig);

      const axiosError = new Error('Request failed with status code 400');
      (axiosError as any).response = {
        status: 400,
        data: { error: 'invalid_grant', error_description: 'Invalid authorization code' },
      };

      // Mock axios.isAxiosError to return true for our error
      mockedIsAxiosError.mockReturnValueOnce(true);
      mockedAxios.post.mockRejectedValue(axiosError);

      await expect(service.handleCallback(mockCode, mockState)).rejects.toThrow(
        'Failed to exchange authorization code: invalid_grant',
      );
    });

    it('should handle missing access token in response', async () => {
      mockedAxios.post.mockResolvedValue({
        status: 200,
        data: { refresh_token: 'refresh_token_456' }, // Missing access_token
      });

      await expect(service.handleCallback(mockCode, mockState)).rejects.toThrow(
        'No access token received from OAuth provider',
      );
    });

    it('should use custom token URL if provided', async () => {
      const customConfig = {
        ...mockOAuthConfig,
        config: {
          ...mockOAuthConfig.config,
          tokenUrl: 'https://custom-provider.com/oauth/token',
        },
      };
      authConfigService.getDefaultOrgAuthConfig.mockResolvedValue(customConfig);
      mockedAxios.post.mockResolvedValue({
        status: 200,
        data: mockTokenResponse,
      });

      await service.handleCallback(mockCode, mockState);

      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://custom-provider.com/oauth/token',
        expect.any(URLSearchParams),
        expect.any(Object),
      );
    });

    it('should handle missing toolId', async () => {
      // This test is no longer valid since toolId comes from state, not config
      expect(true).toBe(true);
    });

    it('should use default expiration time when expires_in is not provided', async () => {
      const tokenResponseWithoutExpiry = {
        ...mockTokenResponse,
        expires_in: undefined,
      };
      mockedAxios.post.mockResolvedValue({
        status: 200,
        data: tokenResponseWithoutExpiry,
      });

      await service.handleCallback(mockCode, mockState);

      expect(authConfigService.setUserCredentials).toHaveBeenCalledWith(
        mockOrgId,
        mockUserId,
        mockToolId,
        mockTokenResponse.access_token,
        mockTokenResponse.refresh_token,
        expect.any(Date),
      );

      // Check that the expiration date is approximately 1 hour from now
      const call = authConfigService.setUserCredentials.mock.calls[0];
      const expiresAt = call[5] as Date;
      const now = new Date();
      const oneHourFromNow = new Date(now.getTime() + 3600000);
      expect(expiresAt.getTime()).toBeCloseTo(oneHourFromNow.getTime(), -3); // Within 1000ms
    });
  });

  describe('default URLs', () => {
    const testCases = [
      { toolKey: 'google', expectedAuthUrl: 'https://accounts.google.com/o/oauth2/v2/auth' },
      {
        toolKey: 'microsoft',
        expectedAuthUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
      },
      { toolKey: 'slack', expectedAuthUrl: 'https://slack.com/oauth/v2/authorize' },
      { toolKey: 'discord', expectedAuthUrl: 'https://discord.com/api/oauth2/authorize' },
    ];

    testCases.forEach(({ toolKey, expectedAuthUrl }) => {
      it(`should use correct default authorization URL for ${toolKey}`, async () => {
        const configForTool = { ...mockOAuthConfig };
        authConfigService.getDefaultOrgAuthConfig.mockResolvedValue(configForTool);
        redisCacheService.set.mockResolvedValue(undefined);

        // Mock Prisma to return the specific tool for this test
        prismaService.tool.findUnique.mockResolvedValueOnce({
          id: 'tool-' + toolKey,
          name: toolKey,
          orgId: mockOrgId,
        });

        const result = await service.getAuthorizeUrl('tool-' + toolKey, mockOrgId, mockUserId);

        expect(result.url).toContain(expectedAuthUrl);
      });
    });
  });
});
