import { Test, TestingModule } from '@nestjs/testing';
import { PinoLogger } from 'nestjs-pino';
import { SecretsResolver } from './secrets-resolver.service';
import { AwsSecretsService } from '../aws-secrets.service';
import { RedisCacheService } from '../cache/redis-cache.service';
import CacheKeys from '../cache/cache-keys';

describe('SecretsResolver - Cache Integration', () => {
  let service: SecretsResolver;
  let mockAwsSecretsService: any;
  let mockCacheService: any;
  let mockLogger: any;

  const mockCredentials = {
    accessToken: 'token-123',
    refreshToken: 'refresh-456',
    apiKey: 'api-key-789',
    expiresAt: Date.now() + 3600000,
  };

  beforeEach(async () => {
    mockAwsSecretsService = {
      getSecretAsJson: jest.fn(),
      secretExists: jest.fn(),
      updateSecret: jest.fn(),
      createSecret: jest.fn(),
    } as any;

    mockCacheService = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      delPattern: jest.fn(),
    } as any;

    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      error: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SecretsResolver,
        {
          provide: AwsSecretsService,
          useValue: mockAwsSecretsService,
        },
        {
          provide: RedisCacheService,
          useValue: mockCacheService,
        },
        {
          provide: `PinoLogger:${SecretsResolver.name}`,
          useValue: mockLogger,
        },
      ],
    }).compile();

    service = module.get(SecretsResolver);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getToolCredentials', () => {
    const orgId = 'org-123';
    const toolName = 'github';
    const cacheKey = CacheKeys.secrets(orgId, toolName);

    it('should return cached credentials if available', async () => {
      mockCacheService.get.mockResolvedValue(mockCredentials);

      const result = await service.getToolCredentials(toolName, orgId);

      expect(mockCacheService.get).toHaveBeenCalledWith(cacheKey);
      expect(mockAwsSecretsService.getSecretAsJson).not.toHaveBeenCalled();
      expect(result).toEqual(mockCredentials);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        { toolName, orgId, cached: true },
        'Retrieved credentials from cache'
      );
    });

    it('should fetch from AWS and cache if not in cache', async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockAwsSecretsService.getSecretAsJson.mockResolvedValue(mockCredentials);
      mockCacheService.set.mockResolvedValue();

      const result = await service.getToolCredentials(toolName, orgId);

      expect(mockCacheService.get).toHaveBeenCalledWith(cacheKey);
      expect(mockAwsSecretsService.getSecretAsJson).toHaveBeenCalledWith('tolstoy/github/org-123');
      expect(mockCacheService.set).toHaveBeenCalledWith(
        cacheKey,
        mockCredentials,
        { ttl: CacheKeys.TTL.SECRETS }
      );
      expect(result).toEqual(mockCredentials);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        { toolName, orgId, cached: false },
        'Retrieving credentials from AWS Secrets Manager'
      );
    });

    it('should handle AWS errors without caching', async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockAwsSecretsService.getSecretAsJson.mockRejectedValue(new Error('Secret not found'));

      await expect(service.getToolCredentials(toolName, orgId)).rejects.toThrow(
        'Tool credentials not found for github'
      );

      expect(mockCacheService.set).not.toHaveBeenCalled();
      expect(mockLogger.error).toHaveBeenCalledWith(
        { toolName, orgId, error: 'Secret not found' },
        'Failed to retrieve credentials for tool'
      );
    });

    it('should handle cache errors gracefully', async () => {
      mockCacheService.get.mockRejectedValue(new Error('Cache error'));
      mockAwsSecretsService.getSecretAsJson.mockResolvedValue(mockCredentials);
      mockCacheService.set.mockResolvedValue();

      const result = await service.getToolCredentials(toolName, orgId);

      // Should fallback to AWS and still work
      expect(result).toEqual(mockCredentials);
      expect(mockAwsSecretsService.getSecretAsJson).toHaveBeenCalled();
    });
  });

  describe('setToolCredentials', () => {
    const orgId = 'org-123';
    const toolName = 'github';
    const cacheKey = CacheKeys.secrets(orgId, toolName);

    it('should invalidate cache after updating credentials', async () => {
      mockAwsSecretsService.secretExists.mockResolvedValue(true);
      mockAwsSecretsService.updateSecret.mockResolvedValue();
      mockCacheService.del.mockResolvedValue();

      await service.setToolCredentials(toolName, orgId, mockCredentials);

      expect(mockAwsSecretsService.updateSecret).toHaveBeenCalledWith(
        'tolstoy/github/org-123',
        mockCredentials
      );
      expect(mockCacheService.del).toHaveBeenCalledWith(cacheKey);
      expect(mockLogger.info).toHaveBeenCalledWith(
        { toolName, orgId },
        'Successfully stored credentials and invalidated cache'
      );
    });

    it('should invalidate cache after creating new credentials', async () => {
      mockAwsSecretsService.secretExists.mockResolvedValue(false);
      mockAwsSecretsService.createSecret.mockResolvedValue();
      mockCacheService.del.mockResolvedValue();

      await service.setToolCredentials(toolName, orgId, mockCredentials);

      expect(mockAwsSecretsService.createSecret).toHaveBeenCalledWith(
        'tolstoy/github/org-123',
        mockCredentials,
        'Credentials for github - Organization org-123'
      );
      expect(mockCacheService.del).toHaveBeenCalledWith(cacheKey);
    });
  });

  describe('updateOAuthTokens', () => {
    const orgId = 'org-123';
    const toolName = 'github';
    const cacheKey = CacheKeys.secrets(orgId, toolName);
    const tokens = {
      accessToken: 'new-token-456',
      refreshToken: 'new-refresh-789',
      expiresAt: Date.now() + 3600000,
      scope: 'read:user',
      tokenType: 'Bearer',
    };

    it('should invalidate cache after updating OAuth tokens', async () => {
      mockCacheService.get.mockResolvedValue(mockCredentials);
      mockAwsSecretsService.secretExists.mockResolvedValue(true);
      mockAwsSecretsService.updateSecret.mockResolvedValue();
      mockCacheService.del.mockResolvedValue();

      await service.updateOAuthTokens(toolName, orgId, tokens);

      expect(mockCacheService.del).toHaveBeenCalledWith(cacheKey);
      expect(mockLogger.info).toHaveBeenCalledWith(
        { toolName, orgId },
        'Successfully updated OAuth tokens and invalidated cache'
      );
    });
  });

  describe('deleteToolCredentials', () => {
    const orgId = 'org-123';
    const toolName = 'github';
    const cacheKey = CacheKeys.secrets(orgId, toolName);

    it('should invalidate cache when deleting credentials', async () => {
      mockCacheService.del.mockResolvedValue();

      await service.deleteToolCredentials(toolName, orgId);

      expect(mockCacheService.del).toHaveBeenCalledWith(cacheKey);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        { toolName, orgId },
        'Deleting credentials - AWS Secrets Manager will schedule deletion, not immediate'
      );
    });

    it('should handle cache deletion errors', async () => {
      mockCacheService.del.mockRejectedValue(new Error('Cache deletion failed'));

      await service.deleteToolCredentials(toolName, orgId);

      expect(mockLogger.error).toHaveBeenCalledWith(
        { toolName, orgId, error: 'Cache deletion failed' },
        'Failed to invalidate cache during credential deletion'
      );
    });
  });

  describe('bulk operations', () => {
    const orgId = 'org-123';

    describe('invalidateOrgSecrets', () => {
      it('should invalidate all secrets for organization', async () => {
        const pattern = CacheKeys.secretsPattern(orgId);
        mockCacheService.delPattern.mockResolvedValue(5);

        await service.invalidateOrgSecrets(orgId);

        expect(mockCacheService.delPattern).toHaveBeenCalledWith(pattern);
        expect(mockLogger.info).toHaveBeenCalledWith(
          { orgId, deletedKeys: 5 },
          'Invalidated all cached secrets for organization'
        );
      });

      it('should handle invalidation errors', async () => {
        mockCacheService.delPattern.mockRejectedValue(new Error('Bulk delete failed'));

        await service.invalidateOrgSecrets(orgId);

        expect(mockLogger.error).toHaveBeenCalledWith(
          { orgId, error: 'Bulk delete failed' },
          'Failed to invalidate organization secrets cache'
        );
      });
    });

    describe('warmupCache', () => {
      it('should warm up cache for multiple tools', async () => {
        const toolNames = ['github', 'slack', 'jira'];
        mockCacheService.get.mockResolvedValue(null);
        mockAwsSecretsService.getSecretAsJson
          .mockResolvedValueOnce(mockCredentials)
          .mockResolvedValueOnce(mockCredentials)
          .mockResolvedValueOnce(mockCredentials);
        mockCacheService.set.mockResolvedValue();

        await service.warmupCache(orgId, toolNames);

        expect(mockAwsSecretsService.getSecretAsJson).toHaveBeenCalledTimes(3);
        expect(mockCacheService.set).toHaveBeenCalledTimes(3);
        expect(mockLogger.info).toHaveBeenCalledWith(
          { orgId, tools: 3 },
          'Cache warmup completed'
        );
      });

      it('should skip tools without credentials during warmup', async () => {
        const toolNames = ['github', 'nonexistent'];
        mockCacheService.get.mockResolvedValue(null);
        mockAwsSecretsService.getSecretAsJson
          .mockResolvedValueOnce(mockCredentials)
          .mockRejectedValueOnce(new Error('Secret not found'));
        mockCacheService.set.mockResolvedValueOnce();

        await service.warmupCache(orgId, toolNames);

        expect(mockLogger.debug).toHaveBeenCalledWith(
          {
            toolName: 'nonexistent',
            orgId,
            error: 'Secret not found',
          },
          'Skipped warmup for tool without credentials'
        );
      });
    });
  });
});