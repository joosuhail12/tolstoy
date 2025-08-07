import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Redis } from '@upstash/redis';
import { RedisCacheService } from './redis-cache.service';
import { AwsSecretsService } from '../aws-secrets.service';
import CacheKeys from './cache-keys';

// Mock the Upstash Redis client
jest.mock('@upstash/redis', () => ({
  Redis: jest.fn(),
}));

describe('RedisCacheService', () => {
  let service: RedisCacheService;
  let mockRedis: any;
  let mockConfigService: any;
  let mockAwsSecretsService: any;
  let mockLogger: any;

  beforeEach(async () => {
    // Create mock Redis instance
    mockRedis = {
      ping: jest.fn(),
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      keys: jest.fn(),
      exists: jest.fn(),
      expire: jest.fn(),
      mget: jest.fn(),
      pipeline: jest.fn(),
      setex: jest.fn(),
    } as any;

    // Mock Redis constructor
    (Redis as unknown as jest.Mock).mockImplementation(() => mockRedis);

    mockConfigService = {
      get: jest.fn(),
    } as any;

    mockAwsSecretsService = {
      getSecret: jest.fn(),
    } as any;

    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RedisCacheService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: AwsSecretsService,
          useValue: mockAwsSecretsService,
        },
        {
          provide: `PinoLogger:${RedisCacheService.name}`,
          useValue: mockLogger,
        },
      ],
    }).compile();

    service = module.get(RedisCacheService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize with AWS Secrets Manager credentials', async () => {
      mockAwsSecretsService.getSecret
        .mockResolvedValueOnce('https://redis-url.upstash.io')
        .mockResolvedValueOnce('redis-token-123');
      mockRedis.ping.mockResolvedValue('PONG');

      // Initialize service
      await service['initializeRedis']();

      expect(mockAwsSecretsService.getSecret).toHaveBeenCalledWith(
        'tolstoy/env',
        'UPSTASH_REDIS_REST_URL',
      );
      expect(mockAwsSecretsService.getSecret).toHaveBeenCalledWith(
        'tolstoy/env',
        'UPSTASH_REDIS_REST_TOKEN',
      );
      expect(Redis).toHaveBeenCalledWith({
        url: 'https://redis-url.upstash.io',
        token: 'redis-token-123',
      });
      expect(mockRedis.ping).toHaveBeenCalled();
    });

    it('should fallback to environment variables if AWS Secrets fail', async () => {
      mockAwsSecretsService.getSecret.mockRejectedValue(new Error('Secrets not found'));
      mockConfigService.get
        .mockReturnValueOnce('https://env-redis-url.upstash.io')
        .mockReturnValueOnce('env-redis-token-123');
      mockRedis.ping.mockResolvedValue('PONG');

      // Initialize service
      await service['initializeRedis']();

      expect(mockConfigService.get).toHaveBeenCalledWith('UPSTASH_REDIS_REST_URL');
      expect(mockConfigService.get).toHaveBeenCalledWith('UPSTASH_REDIS_REST_TOKEN');
      expect(Redis).toHaveBeenCalledWith({
        url: 'https://env-redis-url.upstash.io',
        token: 'env-redis-token-123',
      });
    });

    it('should handle initialization failures gracefully', async () => {
      mockAwsSecretsService.getSecret.mockRejectedValue(new Error('Secrets not found'));
      mockConfigService.get.mockReturnValue(undefined);

      // Initialize service - should not throw
      await service['initializeRedis']();

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.any(String) }),
        'Failed to initialize Redis cache service - operating in fallback mode',
      );
    });
  });

  describe('cache operations', () => {
    beforeEach(async () => {
      // Setup successful initialization
      mockConfigService.get
        .mockReturnValueOnce('https://redis-url.upstash.io')
        .mockReturnValueOnce('redis-token-123');
      mockRedis.ping.mockResolvedValue('PONG');
      await service['initializeRedis']();
    });

    describe('get', () => {
      it('should retrieve value from cache', async () => {
        const testKey = 'test-key';
        const testValue = { data: 'test-value' };
        mockRedis.get.mockResolvedValue(testValue);

        const result = await service.get(testKey);

        expect(mockRedis.get).toHaveBeenCalledWith(testKey);
        expect(result).toEqual(testValue);
        expect(mockLogger.debug).toHaveBeenCalledWith({ key: testKey, cached: true }, 'Cache hit');
      });

      it('should return null for cache miss', async () => {
        const testKey = 'missing-key';
        mockRedis.get.mockResolvedValue(null);

        const result = await service.get(testKey);

        expect(result).toBeNull();
        expect(mockLogger.debug).toHaveBeenCalledWith(
          { key: testKey, cached: false },
          'Cache miss',
        );
      });

      it('should handle Redis errors gracefully', async () => {
        const testKey = 'error-key';
        mockRedis.get.mockRejectedValue(new Error('Redis connection failed'));

        const result = await service.get(testKey);

        expect(result).toBeNull();
        expect(mockLogger.error).toHaveBeenCalledWith(
          { key: testKey, error: 'Redis connection failed' },
          'Redis GET error',
        );
      });
    });

    describe('set', () => {
      it('should set value with default TTL', async () => {
        const testKey = 'test-key';
        const testValue = { data: 'test-value' };
        mockRedis.set.mockResolvedValue('OK');

        await service.set(testKey, testValue);

        expect(mockRedis.set).toHaveBeenCalledWith(testKey, testValue, {
          ex: CacheKeys.TTL.MEDIUM,
        });
        expect(mockLogger.debug).toHaveBeenCalledWith(
          {
            key: testKey,
            ttl: `${CacheKeys.TTL.MEDIUM}s`,
            nx: undefined,
            cached: true,
          },
          'Cache set',
        );
      });

      it('should set value with custom TTL', async () => {
        const testKey = 'test-key';
        const testValue = 'test-value';
        const customTTL = 1800;
        mockRedis.set.mockResolvedValue('OK');

        await service.set(testKey, testValue, { ttl: customTTL });

        expect(mockRedis.set).toHaveBeenCalledWith(testKey, testValue, { ex: customTTL });
      });

      it('should set value with NX option', async () => {
        const testKey = 'test-key';
        const testValue = 'test-value';
        mockRedis.set.mockResolvedValue('OK');

        await service.set(testKey, testValue, { nx: true });

        expect(mockRedis.set).toHaveBeenCalledWith(testKey, testValue, {
          ex: CacheKeys.TTL.MEDIUM,
          nx: true,
        });
      });

      it('should handle Redis errors gracefully', async () => {
        const testKey = 'error-key';
        const testValue = 'test-value';
        mockRedis.set.mockRejectedValue(new Error('Redis connection failed'));

        // Should not throw error
        await service.set(testKey, testValue);

        expect(mockLogger.error).toHaveBeenCalledWith(
          { key: testKey, error: 'Redis connection failed' },
          'Redis SET error',
        );
      });
    });

    describe('del', () => {
      it('should delete key from cache', async () => {
        const testKey = 'test-key';
        mockRedis.del.mockResolvedValue(1);

        await service.del(testKey);

        expect(mockRedis.del).toHaveBeenCalledWith(testKey);
        expect(mockLogger.debug).toHaveBeenCalledWith({ key: testKey }, 'Cache key deleted');
      });

      it('should handle Redis errors gracefully', async () => {
        const testKey = 'error-key';
        mockRedis.del.mockRejectedValue(new Error('Redis connection failed'));

        await service.del(testKey);

        expect(mockLogger.error).toHaveBeenCalledWith(
          { key: testKey, error: 'Redis connection failed' },
          'Redis DEL error',
        );
      });
    });

    describe('delPattern', () => {
      it('should delete multiple keys matching pattern', async () => {
        const pattern = 'test:*';
        const matchingKeys = ['test:key1', 'test:key2', 'test:key3'];
        mockRedis.keys.mockResolvedValue(matchingKeys);
        mockRedis.del.mockResolvedValue(3);

        const deletedCount = await service.delPattern(pattern);

        expect(mockRedis.keys).toHaveBeenCalledWith(pattern);
        expect(mockRedis.del).toHaveBeenCalledWith(...matchingKeys);
        expect(deletedCount).toBe(3);
        expect(mockLogger.info).toHaveBeenCalledWith(
          {
            pattern,
            keysFound: 3,
            keysDeleted: 3,
          },
          'Bulk cache invalidation completed',
        );
      });

      it('should handle empty pattern results', async () => {
        const pattern = 'nonexistent:*';
        mockRedis.keys.mockResolvedValue([]);

        const deletedCount = await service.delPattern(pattern);

        expect(deletedCount).toBe(0);
        expect(mockLogger.debug).toHaveBeenCalledWith({ pattern }, 'No keys found for pattern');
      });
    });

    describe('batch operations', () => {
      it('should get multiple keys at once', async () => {
        const keys = ['key1', 'key2', 'key3'];
        const values = ['value1', null, 'value3'];
        mockRedis.mget.mockResolvedValue(values);

        const results = await service.mget(keys);

        expect(mockRedis.mget).toHaveBeenCalledWith(...keys);
        expect(results).toEqual(values);
        expect(mockLogger.debug).toHaveBeenCalledWith(
          {
            keys: 3,
            hits: 2,
            misses: 1,
          },
          'Batch cache get completed',
        );
      });

      it('should set multiple key-value pairs', async () => {
        const keyValuePairs: Array<[string, any, number?]> = [
          ['key1', 'value1', 300],
          ['key2', 'value2'],
          ['key3', 'value3', 600],
        ];

        const mockPipeline = {
          setex: jest.fn(),
          set: jest.fn(),
          exec: jest.fn().mockResolvedValue([]),
        };
        mockRedis.pipeline.mockReturnValue(mockPipeline as any);

        await service.mset(keyValuePairs);

        expect(mockRedis.pipeline).toHaveBeenCalled();
        expect(mockPipeline.setex).toHaveBeenCalledWith('key1', 300, 'value1');
        expect(mockPipeline.set).toHaveBeenCalledWith('key2', 'value2');
        expect(mockPipeline.setex).toHaveBeenCalledWith('key3', 600, 'value3');
        expect(mockPipeline.exec).toHaveBeenCalled();
      });
    });
  });

  describe('cache metrics', () => {
    beforeEach(async () => {
      mockConfigService.get
        .mockReturnValueOnce('https://redis-url.upstash.io')
        .mockReturnValueOnce('redis-token-123');
      mockRedis.ping.mockResolvedValue('PONG');
      await service['initializeRedis']();
    });

    it('should track cache hits and misses', async () => {
      mockRedis.get
        .mockResolvedValueOnce('cached-value') // Hit
        .mockResolvedValueOnce(null); // Miss

      await service.get('hit-key');
      await service.get('miss-key');

      const metrics = service.getMetrics();
      expect(metrics.hits).toBe(1);
      expect(metrics.misses).toBe(1);
      expect(metrics.hitRate).toBe(50);
    });

    it('should track operation counts', async () => {
      mockRedis.get.mockResolvedValue('value');
      mockRedis.set.mockResolvedValue('OK');
      mockRedis.del.mockResolvedValue(1);

      await service.get('test-key');
      await service.set('test-key', 'value');
      await service.del('test-key');

      const metrics = service.getMetrics();
      expect(metrics.operations.get).toBe(1);
      expect(metrics.operations.set).toBe(1);
      expect(metrics.operations.delete).toBe(1);
    });

    it('should reset metrics', () => {
      service.resetMetrics();
      const metrics = service.getMetrics();
      expect(metrics.hits).toBe(0);
      expect(metrics.misses).toBe(0);
      expect(metrics.hitRate).toBe(0);
      expect(metrics.operations.get).toBe(0);
      expect(metrics.operations.set).toBe(0);
      expect(metrics.operations.delete).toBe(0);
    });
  });

  describe('connection status', () => {
    it('should return connection status', async () => {
      mockConfigService.get
        .mockReturnValueOnce('https://redis-url.upstash.io')
        .mockReturnValueOnce('redis-token-123');
      mockRedis.ping.mockResolvedValue('PONG');
      await service['initializeRedis']();

      const status = service.getConnectionStatus();
      expect(status.connected).toBe(true);
      expect(status.error).toBeNull();
      expect(status.metrics).toBeDefined();
    });

    it('should test connection with ping', async () => {
      mockConfigService.get
        .mockReturnValueOnce('https://redis-url.upstash.io')
        .mockReturnValueOnce('redis-token-123');
      mockRedis.ping.mockResolvedValue('PONG');
      await service['initializeRedis']();

      const pingResult = await service.ping();
      expect(pingResult).toBe(true);
      expect(mockRedis.ping).toHaveBeenCalled();
    });
  });

  describe('fallback mode', () => {
    beforeEach(async () => {
      // Simulate failed initialization
      mockConfigService.get.mockReturnValue(undefined);
      await service['initializeRedis']();
    });

    it('should handle operations gracefully when Redis unavailable', async () => {
      const result = await service.get('test-key');
      expect(result).toBeNull();

      await service.set('test-key', 'value');
      await service.del('test-key');

      const deletedCount = await service.delPattern('test:*');
      expect(deletedCount).toBe(0);

      const exists = await service.exists('test-key');
      expect(exists).toBe(false);
    });

    it('should report unavailable status', () => {
      const status = service.getConnectionStatus();
      expect(status.connected).toBe(false);
      expect(status.error).toBeDefined();
    });
  });
});

describe('CacheKeys', () => {
  describe('key generation', () => {
    it('should generate correct cache keys', () => {
      expect(CacheKeys.secrets('org123', 'github')).toBe('secrets:org123:github');
      expect(CacheKeys.flow('org123', 'flow456')).toBe('flow:org123:flow456');
      expect(CacheKeys.flowList('org123')).toBe('flows:org123');
      expect(CacheKeys.toolMeta('org123', 'tool789')).toBe('tool-meta:org123:tool789');
      expect(CacheKeys.awsSecret('secret123', 'key456')).toBe('aws-secret:secret123:key456');
      expect(CacheKeys.awsSecret('secret123')).toBe('aws-secret:secret123');
    });

    it('should generate correct patterns', () => {
      expect(CacheKeys.secretsPattern('org123')).toBe('secrets:org123:*');
      expect(CacheKeys.flowsPattern('org123')).toBe('flow*:org123*');
      expect(CacheKeys.toolsPattern('org123')).toBe('tool*:org123*');
    });
  });

  describe('TTL constants', () => {
    it('should have correct TTL values', () => {
      expect(CacheKeys.TTL.SHORT).toBe(300);
      expect(CacheKeys.TTL.MEDIUM).toBe(600);
      expect(CacheKeys.TTL.LONG).toBe(1800);
      expect(CacheKeys.TTL.SECRETS).toBe(600);
      expect(CacheKeys.TTL.FLOWS).toBe(300);
      expect(CacheKeys.TTL.TOOLS).toBe(300);
    });
  });
});
