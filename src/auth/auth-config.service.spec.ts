import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { AuthConfigService, OrgAuthConfig, UserCredential } from './auth-config.service';
import { PrismaService } from '../prisma.service';
import { AwsSecretsService } from '../aws-secrets.service';
import { RedisCacheService } from '../cache/redis-cache.service';

describe('AuthConfigService', () => {
  let service: AuthConfigService;
  let prismaService: any;
  let awsSecretsService: any;
  let cacheService: any;

  const mockOrgAuthConfig: OrgAuthConfig = {
    id: 'config-123',
    orgId: 'org-456',
    toolId: 'tool-789',
    type: 'apiKey',
    config: { apiKey: 'secret-api-key-123' },
    createdAt: new Date('2023-01-01'),
    updatedAt: new Date('2023-01-02'),
  };

  const mockUserCredential: UserCredential = {
    id: 'cred-123',
    orgId: 'org-456',
    userId: 'user-789',
    toolId: 'tool-789',
    accessToken: 'access-token-123',
    refreshToken: 'refresh-token-123',
    expiresAt: new Date(Date.now() + 3600000), // 1 hour from now
    createdAt: new Date('2023-01-01'),
    updatedAt: new Date('2023-01-02'),
  };

  const mockTool = {
    id: 'tool-789',
    name: 'testTool',
    baseUrl: 'https://api.test.com',
    authType: 'oauth2',
    orgId: 'org-456',
  };

  beforeEach(async () => {
    const mockPrismaService = {
      toolAuthConfig: {
        findFirst: jest.fn(),
        upsert: jest.fn(),
        deleteMany: jest.fn(),
      },
      userCredential: {
        findFirst: jest.fn(),
        update: jest.fn(),
        upsert: jest.fn(),
        deleteMany: jest.fn(),
      },
      tool: {
        findUnique: jest.fn(),
      },
    };

    const mockAwsSecretsService = {
      secretExists: jest.fn(),
      createSecret: jest.fn(),
      updateSecret: jest.fn(),
      getSecret: jest.fn(),
    };

    const mockCacheService = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthConfigService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AwsSecretsService, useValue: mockAwsSecretsService },
        { provide: RedisCacheService, useValue: mockCacheService },
      ],
    }).compile();

    service = module.get<AuthConfigService>(AuthConfigService);
    prismaService = module.get(PrismaService);
    awsSecretsService = module.get(AwsSecretsService);
    cacheService = module.get(RedisCacheService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getOrgAuthConfig', () => {
    it('should return cached config when available', async () => {
      const cachedConfig = {
        id: 'cached-config-123',
        orgId: 'org-456',
        toolId: 'testTool',
        type: 'apiKey',
        config: { apiKey: 'cached-key' },
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      cacheService.get.mockResolvedValue(cachedConfig);

      const result = await service.getOrgAuthConfig('org-456', 'testTool');

      expect(result).toEqual(cachedConfig);
      expect(cacheService.get).toHaveBeenCalledWith('auth:org:org-456:tool:testTool');
      expect(prismaService.toolAuthConfig.findFirst).not.toHaveBeenCalled();
    });

    it('should load from database and cache when not in cache', async () => {
      cacheService.get.mockResolvedValue(null);
      prismaService.toolAuthConfig.findFirst.mockResolvedValue({
        ...mockOrgAuthConfig,
        tool: mockTool,
      } as any);
      awsSecretsService.secretExists.mockResolvedValue(false);
      awsSecretsService.createSecret.mockResolvedValue(undefined);

      const result = await service.getOrgAuthConfig('org-456', 'testTool');

      expect(result).toEqual(mockOrgAuthConfig);
      expect(prismaService.toolAuthConfig.findFirst).toHaveBeenCalledWith({
        where: { orgId: 'org-456', tool: { name: 'testTool' } },
        include: { tool: true },
      });
      expect(awsSecretsService.secretExists).toHaveBeenCalledWith(
        'tolstoy/org-456/tools/testTool/config',
      );
      expect(awsSecretsService.createSecret).toHaveBeenCalledWith(
        'tolstoy/org-456/tools/testTool/config',
        JSON.stringify(mockOrgAuthConfig.config),
        'Tolstoy auth configuration',
      );
      expect(cacheService.set).toHaveBeenCalledWith(
        'auth:org:org-456:tool:testTool',
        mockOrgAuthConfig.config,
        { ttl: 600 },
      );
    });

    it('should throw NotFoundException when no config found', async () => {
      cacheService.get.mockResolvedValue(null);
      prismaService.toolAuthConfig.findFirst.mockResolvedValue(null);

      await expect(service.getOrgAuthConfig('org-456', 'nonexistentTool')).rejects.toThrow(
        new NotFoundException('No auth config for tool nonexistentTool in organization org-456'),
      );
    });

    it('should continue execution if AWS Secrets Manager fails', async () => {
      cacheService.get.mockResolvedValue(null);
      prismaService.toolAuthConfig.findFirst.mockResolvedValue({
        ...mockOrgAuthConfig,
        tool: mockTool,
      } as any);
      awsSecretsService.secretExists.mockRejectedValue(new Error('AWS Error'));

      const result = await service.getOrgAuthConfig('org-456', 'testTool');

      expect(result).toEqual(mockOrgAuthConfig);
      expect(cacheService.set).toHaveBeenCalled();
    });
  });

  describe('getUserCredentials', () => {
    it('should return user credentials when found', async () => {
      prismaService.userCredential.findFirst.mockResolvedValue({
        ...mockUserCredential,
        tool: mockTool,
      } as any);

      const result = await service.getUserCredentials('org-456', 'user-789', 'testTool');

      expect(result).toEqual({
        ...mockUserCredential,
        tool: mockTool,
      });
      expect(prismaService.userCredential.findFirst).toHaveBeenCalledWith({
        where: { orgId: 'org-456', userId: 'user-789', tool: { name: 'testTool' } },
        include: { tool: true },
      });
    });

    it('should throw NotFoundException when no credentials found', async () => {
      prismaService.userCredential.findFirst.mockResolvedValue(null);

      await expect(service.getUserCredentials('org-456', 'user-789', 'testTool')).rejects.toThrow(
        new NotFoundException(
          'No user credentials for user user-789 & tool testTool in organization org-456',
        ),
      );
    });
  });

  describe('refreshUserToken', () => {
    it('should return existing token if still valid', async () => {
      const validCred = {
        ...mockUserCredential,
        expiresAt: new Date(Date.now() + 3600000), // 1 hour from now
      };

      const result = await service.refreshUserToken(validCred);

      expect(result).toBe(validCred.accessToken);
      expect(prismaService.userCredential.update).not.toHaveBeenCalled();
    });

    it('should throw error for expired token (placeholder implementation)', async () => {
      const expiredCred = {
        ...mockUserCredential,
        expiresAt: new Date(Date.now() - 3600000), // 1 hour ago
      };

      await expect(service.refreshUserToken(expiredCred)).rejects.toThrow(
        'OAuth refresh not yet implemented. Please implement based on your OAuth provider.',
      );
    });
  });

  describe('setOrgAuthConfig', () => {
    it('should create or update org auth config and invalidate cache', async () => {
      const newConfig = { apiKey: 'new-key' };
      prismaService.toolAuthConfig.upsert.mockResolvedValue({
        ...mockOrgAuthConfig,
        tool: mockTool,
        config: newConfig,
      } as any);

      const result = await service.setOrgAuthConfig('org-456', 'tool-789', 'apiKey', newConfig);

      expect(result).toEqual({
        ...mockOrgAuthConfig,
        config: newConfig,
      });
      expect(prismaService.toolAuthConfig.upsert).toHaveBeenCalledWith({
        where: { orgId_toolId: { orgId: 'org-456', toolId: 'tool-789' } },
        create: {
          orgId: 'org-456',
          toolId: 'tool-789',
          type: 'apiKey',
          config: newConfig,
        },
        update: {
          type: 'apiKey',
          config: newConfig,
          updatedAt: expect.any(Date),
        },
        include: { tool: true },
      });
      expect(cacheService.del).toHaveBeenCalledWith('auth:org:org-456:tool:testTool');
    });
  });

  describe('setUserCredentials', () => {
    it('should create or update user credentials', async () => {
      const expiresAt = new Date(Date.now() + 3600000);
      prismaService.userCredential.upsert.mockResolvedValue({
        ...mockUserCredential,
        accessToken: 'new-access-token',
        expiresAt,
      } as any);

      const result = await service.setUserCredentials(
        'org-456',
        'user-789',
        'tool-789',
        'new-access-token',
        'new-refresh-token',
        expiresAt,
      );

      expect(result).toEqual({
        ...mockUserCredential,
        accessToken: 'new-access-token',
        expiresAt,
      });
      expect(prismaService.userCredential.upsert).toHaveBeenCalledWith({
        where: {
          orgId_userId_toolId: { orgId: 'org-456', userId: 'user-789', toolId: 'tool-789' },
        },
        create: {
          orgId: 'org-456',
          userId: 'user-789',
          toolId: 'tool-789',
          accessToken: 'new-access-token',
          refreshToken: 'new-refresh-token',
          expiresAt,
        },
        update: {
          accessToken: 'new-access-token',
          refreshToken: 'new-refresh-token',
          expiresAt,
          updatedAt: expect.any(Date),
        },
      });
    });
  });

  describe('deleteOrgAuthConfig', () => {
    it('should delete org auth config and clean up cache', async () => {
      prismaService.toolAuthConfig.deleteMany.mockResolvedValue({ count: 1 });
      prismaService.tool.findUnique.mockResolvedValue(mockTool as any);

      await service.deleteOrgAuthConfig('org-456', 'tool-789');

      expect(prismaService.toolAuthConfig.deleteMany).toHaveBeenCalledWith({
        where: { orgId: 'org-456', toolId: 'tool-789' },
      });
      expect(cacheService.del).toHaveBeenCalledWith('auth:org:org-456:tool:testTool');
    });

    it('should throw NotFoundException when no config to delete', async () => {
      prismaService.toolAuthConfig.deleteMany.mockResolvedValue({ count: 0 });

      await expect(service.deleteOrgAuthConfig('org-456', 'tool-789')).rejects.toThrow(
        new NotFoundException('No auth config found for org org-456 and tool tool-789'),
      );
    });
  });

  describe('deleteUserCredentials', () => {
    it('should delete user credentials', async () => {
      prismaService.userCredential.deleteMany.mockResolvedValue({ count: 1 });

      await service.deleteUserCredentials('org-456', 'user-789', 'tool-789');

      expect(prismaService.userCredential.deleteMany).toHaveBeenCalledWith({
        where: { orgId: 'org-456', userId: 'user-789', toolId: 'tool-789' },
      });
    });

    it('should throw NotFoundException when no credentials to delete', async () => {
      prismaService.userCredential.deleteMany.mockResolvedValue({ count: 0 });

      await expect(
        service.deleteUserCredentials('org-456', 'user-789', 'tool-789'),
      ).rejects.toThrow(
        new NotFoundException(
          'No credentials found for user user-789 and tool tool-789 in org org-456',
        ),
      );
    });
  });

  describe('private helper methods', () => {
    it('should generate correct cache keys', () => {
      const orgKey = service['orgConfigKey']('org-123', 'tool-456');
      const userKey = service['_userCredKey']('org-123', 'user-456', 'tool-789');

      expect(orgKey).toBe('auth:org:org-123:tool:tool-456');
      expect(userKey).toBe('auth:user:org-123:user-456:tool:tool-789');
    });
  });
});
