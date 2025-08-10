import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { AuthConfigService, OrgAuthConfig } from './auth-config.service';
import { PrismaService } from '../prisma.service';
import { AwsSecretsService } from '../aws-secrets.service';
import { RedisCacheService } from '../cache/redis-cache.service';

describe('Named Auth Configurations Integration', () => {
  let authConfigService: AuthConfigService;
  let prismaService: any;
  let awsSecretsService: any;
  let cacheService: any;

  const mockTool = {
    id: 'tool-123',
    name: 'testTool',
    orgId: 'org-456',
  };

  const mockOrg = {
    id: 'org-456',
    name: 'Test Organization',
  };

  beforeEach(async () => {
    const mockPrismaService = {
      tool: {
        findUnique: jest.fn().mockResolvedValue(mockTool),
      },
      toolAuthConfig: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        upsert: jest.fn(),
        updateMany: jest.fn(),
        deleteMany: jest.fn(),
      },
    };

    const mockAwsSecretsService = {
      secretExists: jest.fn().mockResolvedValue(false),
      createSecret: jest.fn(),
      updateSecret: jest.fn(),
      getSecret: jest.fn(),
    };

    const mockCacheService = {
      get: jest.fn().mockResolvedValue(null),
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

    authConfigService = module.get<AuthConfigService>(AuthConfigService);
    prismaService = module.get(PrismaService);
    awsSecretsService = module.get(AwsSecretsService);
    cacheService = module.get(RedisCacheService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Named Configuration Management', () => {
    it('should create multiple named configurations for the same tool', async () => {
      const productionConfig = {
        id: 'config-prod',
        orgId: 'org-456',
        toolId: 'tool-123',
        name: 'production',
        type: 'apiKey',
        config: {
          headerName: 'Authorization',
          headerValue: 'Bearer prod-key-123',
          apiKey: 'Bearer prod-key-123',
        },
        isDefault: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        tool: mockTool,
      };

      const stagingConfig = {
        id: 'config-staging',
        orgId: 'org-456',
        toolId: 'tool-123',
        name: 'staging',
        type: 'apiKey',
        config: {
          headerName: 'Authorization',
          headerValue: 'Bearer staging-key-123',
          apiKey: 'Bearer staging-key-123',
        },
        isDefault: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        tool: mockTool,
      };

      // Mock creating production config
      prismaService.toolAuthConfig.upsert.mockResolvedValueOnce(productionConfig);

      const result1 = await authConfigService.setOrgAuthConfig(
        'org-456',
        'tool-123',
        'apiKey',
        { headerName: 'Authorization', headerValue: 'Bearer prod-key-123' },
        'production',
        true,
      );

      expect(result1.name).toBe('production');
      expect(result1.isDefault).toBe(true);

      // Mock creating staging config
      prismaService.toolAuthConfig.upsert.mockResolvedValueOnce(stagingConfig);

      const result2 = await authConfigService.setOrgAuthConfig(
        'org-456',
        'tool-123',
        'apiKey',
        { headerName: 'Authorization', headerValue: 'Bearer staging-key-123' },
        'staging',
        false,
      );

      expect(result2.name).toBe('staging');
      expect(result2.isDefault).toBe(false);

      // Verify that when setting the first as default, updateMany was called to unset others
      expect(prismaService.toolAuthConfig.updateMany).toHaveBeenCalledWith({
        where: {
          orgId: 'org-456',
          toolId: 'tool-123',
          isDefault: true,
        },
        data: {
          isDefault: false,
        },
      });
    });

    it('should retrieve specific named configuration', async () => {
      const mockConfig = {
        id: 'config-123',
        orgId: 'org-456',
        toolId: 'tool-123',
        name: 'development',
        type: 'oauth2',
        config: {
          clientId: 'dev-client-123',
          clientSecret: 'dev-secret-456',
          accessToken: 'dev-access-token',
          redirectUri: 'https://tolstoy.getpullse.com/api/auth/oauth/callback',
          callbackUrl: 'https://tolstoy.getpullse.com/api/auth/oauth/callback',
        },
        isDefault: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        tool: mockTool,
      };

      prismaService.toolAuthConfig.findFirst.mockResolvedValue(mockConfig);

      const result = await authConfigService.getOrgAuthConfig('org-456', 'tool-123', 'development');

      expect(result.name).toBe('development');
      expect(result.type).toBe('oauth2');
      expect(result.isDefault).toBe(false);
      expect(prismaService.toolAuthConfig.findFirst).toHaveBeenCalledWith({
        where: {
          orgId: 'org-456',
          toolId: 'tool-123',
          name: 'development',
        },
        include: {
          tool: true,
        },
      });
    });

    it('should list all configurations for a tool', async () => {
      const mockConfigs = [
        {
          id: 'config-prod',
          orgId: 'org-456',
          toolId: 'tool-123',
          name: 'production',
          type: 'apiKey',
          config: { headerName: 'Authorization', headerValue: 'Bearer prod-key' },
          isDefault: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          tool: mockTool,
        },
        {
          id: 'config-staging',
          orgId: 'org-456',
          toolId: 'tool-123',
          name: 'staging',
          type: 'apiKey',
          config: { headerName: 'Authorization', headerValue: 'Bearer staging-key' },
          isDefault: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          tool: mockTool,
        },
        {
          id: 'config-dev',
          orgId: 'org-456',
          toolId: 'tool-123',
          name: 'development',
          type: 'oauth2',
          config: { clientId: 'dev-client', clientSecret: 'dev-secret' },
          isDefault: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          tool: mockTool,
        },
      ];

      prismaService.toolAuthConfig.findMany.mockResolvedValue(mockConfigs);

      const results = await authConfigService.listOrgAuthConfigs('org-456', 'tool-123');

      expect(results).toHaveLength(3);
      expect(results[0].name).toBe('production');
      expect(results[0].isDefault).toBe(true);
      expect(results[1].name).toBe('staging');
      expect(results[2].name).toBe('development');

      expect(prismaService.toolAuthConfig.findMany).toHaveBeenCalledWith({
        where: {
          orgId: 'org-456',
          toolId: 'tool-123',
        },
        include: {
          tool: true,
        },
        orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
      });
    });

    it('should get default configuration correctly', async () => {
      const defaultConfig = {
        id: 'config-default',
        orgId: 'org-456',
        toolId: 'tool-123',
        name: 'production',
        type: 'apiKey',
        config: { headerName: 'Authorization', headerValue: 'Bearer default-key' },
        isDefault: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        tool: mockTool,
      };

      // Mock finding config marked as default
      prismaService.toolAuthConfig.findFirst.mockResolvedValue(defaultConfig);

      const result = await authConfigService.getDefaultOrgAuthConfig('org-456', 'tool-123');

      expect(result.name).toBe('production');
      expect(result.isDefault).toBe(true);

      // Should first look for isDefault: true
      expect(prismaService.toolAuthConfig.findFirst).toHaveBeenCalledWith({
        where: {
          orgId: 'org-456',
          toolId: 'tool-123',
          isDefault: true,
        },
        include: {
          tool: true,
        },
      });
    });

    it('should delete specific named configuration', async () => {
      prismaService.toolAuthConfig.deleteMany.mockResolvedValue({ count: 1 });

      await authConfigService.deleteOrgAuthConfig('org-456', 'tool-123', 'staging');

      expect(prismaService.toolAuthConfig.deleteMany).toHaveBeenCalledWith({
        where: {
          orgId: 'org-456',
          toolId: 'tool-123',
          name: 'staging',
        },
      });

      expect(cacheService.del).toHaveBeenCalledWith(
        'auth:org:org-456:tool:tool-123:config:staging',
      );
    });

    it('should delete all configurations for a tool', async () => {
      prismaService.toolAuthConfig.deleteMany.mockResolvedValue({ count: 3 });

      await authConfigService.deleteAllOrgAuthConfigs('org-456', 'tool-123');

      expect(prismaService.toolAuthConfig.deleteMany).toHaveBeenCalledWith({
        where: {
          orgId: 'org-456',
          toolId: 'tool-123',
        },
      });
    });

    it('should throw NotFoundException when named config not found', async () => {
      prismaService.toolAuthConfig.findFirst.mockResolvedValue(null);

      await expect(
        authConfigService.getOrgAuthConfig('org-456', 'tool-123', 'nonexistent'),
      ).rejects.toThrow(
        new NotFoundException(
          "No auth config 'nonexistent' for tool tool-123 in organization org-456",
        ),
      );
    });
  });

  describe('Required Configuration Names', () => {
    it('should require configuration name when creating configs', async () => {
      const mockConfig = {
        id: 'config-test',
        orgId: 'org-456',
        toolId: 'tool-123',
        name: 'test-config',
        type: 'apiKey',
        config: {
          headerName: 'Authorization',
          headerValue: 'Bearer test-key',
          apiKey: 'Bearer test-key',
        },
        isDefault: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        tool: mockTool,
      };

      prismaService.toolAuthConfig.upsert.mockResolvedValue(mockConfig);

      const result = await authConfigService.setOrgAuthConfig(
        'org-456',
        'tool-123',
        'apiKey',
        { headerName: 'Authorization', headerValue: 'Bearer test-key' },
        'test-config',
      );

      expect(result.name).toBe('test-config');
      expect(result.isDefault).toBe(false);

      expect(prismaService.toolAuthConfig.upsert).toHaveBeenCalledWith({
        where: {
          orgId_toolId_name: { orgId: 'org-456', toolId: 'tool-123', name: 'test-config' },
        },
        create: {
          orgId: 'org-456',
          toolId: 'tool-123',
          name: 'test-config',
          type: 'apiKey',
          config: {
            headerName: 'Authorization',
            headerValue: 'Bearer test-key',
            apiKey: 'Bearer test-key',
          },
          isDefault: false,
        },
        update: expect.any(Object),
        include: {
          tool: true,
        },
      });
    });
  });
});
