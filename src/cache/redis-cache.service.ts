import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';
import { Redis } from '@upstash/redis';
import { AwsSecretsService } from '../aws-secrets.service';
import { CacheKeys } from './cache-keys';

export interface CacheMetrics {
  hits: number;
  misses: number;
  hitRate: number;
  operations: {
    get: number;
    set: number;
    delete: number;
  };
}

export interface CacheSetOptions {
  ttl?: number;
  nx?: boolean; // Set only if key doesn't exist
  px?: number; // TTL in milliseconds
}

@Injectable()
export class RedisCacheService {
  private redis: Redis | null = null;
  private isConnected = false;
  private connectionError: Error | null = null;

  // Performance metrics
  private metrics: CacheMetrics = {
    hits: 0,
    misses: 0,
    hitRate: 0,
    operations: {
      get: 0,
      set: 0,
      delete: 0,
    },
  };

  constructor(
    private readonly configService: ConfigService,
    private readonly awsSecretsService: AwsSecretsService,
    @InjectPinoLogger(RedisCacheService.name)
    private readonly logger: PinoLogger,
  ) {
    this.initializeRedis();
  }

  /**
   * Initialize Redis connection with credentials from AWS Secrets Manager
   */
  private async initializeRedis(): Promise<void> {
    try {
      // Try to get Redis credentials from AWS Secrets Manager first
      let redisUrl: string | undefined;
      let redisToken: string | undefined;

      try {
        redisUrl = await this.awsSecretsService.getSecret('tolstoy/env', 'UPSTASH_REDIS_REST_URL');
        redisToken = await this.awsSecretsService.getSecret(
          'tolstoy/env',
          'UPSTASH_REDIS_REST_TOKEN',
        );
        this.logger.info('Retrieved Redis credentials from AWS Secrets Manager');
      } catch (error) {
        // Fallback to environment variables
        redisUrl = this.configService.get('UPSTASH_REDIS_REST_URL');
        redisToken = this.configService.get('UPSTASH_REDIS_REST_TOKEN');
        this.logger.info('Using Redis credentials from environment variables');
      }

      if (!redisUrl || !redisToken) {
        throw new Error('Redis credentials not found in AWS Secrets or environment variables');
      }

      this.redis = new Redis({
        url: redisUrl,
        token: redisToken,
      });

      // Test connection
      await this.redis.ping();
      this.isConnected = true;
      this.connectionError = null;

      this.logger.info('Redis cache service initialized successfully');
    } catch (error) {
      this.connectionError = error as Error;
      this.isConnected = false;
      this.logger.error(
        { error: error instanceof Error ? error.message : 'Unknown initialization error' },
        'Failed to initialize Redis cache service - operating in fallback mode',
      );

      // Don't throw error - allow service to operate without cache
    }
  }

  /**
   * Get value from cache
   * @param key Cache key
   * @returns Cached value or null if not found/error
   */
  async get(key: string): Promise<any> {
    if (!this.isRedisAvailable()) {
      return null;
    }

    try {
      this.metrics.operations.get++;

      const value = await this.redis!.get(key);

      if (value !== null) {
        this.metrics.hits++;
        this.updateHitRate();
        this.logger.debug({ key, cached: true }, 'Cache hit');
        return value as any;
      } else {
        this.metrics.misses++;
        this.updateHitRate();
        this.logger.debug({ key, cached: false }, 'Cache miss');
        return null;
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown Redis GET error';
      this.logger.error({ key, error: errorMsg }, 'Redis GET error');
      this.metrics.misses++;
      this.updateHitRate();
      return null;
    }
  }

  /**
   * Set value in cache
   * @param key Cache key
   * @param value Value to cache
   * @param options Cache options including TTL
   */
  async set(key: string, value: any, options: CacheSetOptions = {}): Promise<void> {
    if (!this.isRedisAvailable()) {
      return;
    }

    try {
      this.metrics.operations.set++;

      const { ttl = CacheKeys.TTL.MEDIUM, nx, px } = options;

      const redisOptions: any = {};

      // Set TTL (prefer px for milliseconds, fallback to ex for seconds)
      if (px) {
        redisOptions.px = px;
      } else {
        redisOptions.ex = ttl;
      }

      // Set only if key doesn't exist
      if (nx) {
        redisOptions.nx = true;
      }

      await this.redis!.set(key, value, redisOptions);

      this.logger.debug(
        {
          key,
          ttl: px ? `${px}ms` : `${ttl}s`,
          nx,
          cached: true,
        },
        'Cache set',
      );
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown Redis SET error';
      this.logger.error({ key, error: errorMsg }, 'Redis SET error');
      // Don't throw error - allow application to continue without caching
    }
  }

  /**
   * Delete key from cache
   * @param key Cache key to delete
   */
  async del(key: string): Promise<void> {
    if (!this.isRedisAvailable()) {
      return;
    }

    try {
      this.metrics.operations.delete++;

      await this.redis!.del(key);

      this.logger.debug({ key }, 'Cache key deleted');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown Redis DEL error';
      this.logger.error({ key, error: errorMsg }, 'Redis DEL error');
    }
  }

  /**
   * Delete multiple keys matching a pattern
   * @param pattern Redis pattern (supports * wildcard)
   */
  async delPattern(pattern: string): Promise<number> {
    if (!this.isRedisAvailable()) {
      return 0;
    }

    try {
      // Get all keys matching the pattern
      const keys = await this.redis!.keys(pattern);

      if (keys.length === 0) {
        this.logger.debug({ pattern }, 'No keys found for pattern');
        return 0;
      }

      // Delete all matching keys
      const deletedCount = await this.redis!.del(...keys);

      this.logger.info(
        {
          pattern,
          keysFound: keys.length,
          keysDeleted: deletedCount,
        },
        'Bulk cache invalidation completed',
      );

      return deletedCount;
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : 'Unknown Redis pattern delete error';
      this.logger.error({ pattern, error: errorMsg }, 'Redis pattern delete error');
      return 0;
    }
  }

  /**
   * Check if key exists in cache
   * @param key Cache key
   * @returns True if key exists, false otherwise
   */
  async exists(key: string): Promise<boolean> {
    if (!this.isRedisAvailable()) {
      return false;
    }

    try {
      const exists = await this.redis!.exists(key);
      return exists === 1;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown Redis EXISTS error';
      this.logger.error({ key, error: errorMsg }, 'Redis EXISTS error');
      return false;
    }
  }

  /**
   * Set TTL for existing key
   * @param key Cache key
   * @param ttl TTL in seconds
   */
  async expire(key: string, ttl: number): Promise<void> {
    if (!this.isRedisAvailable()) {
      return;
    }

    try {
      await this.redis!.expire(key, ttl);
      this.logger.debug({ key, ttl }, 'TTL updated for cache key');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown Redis EXPIRE error';
      this.logger.error({ key, ttl, error: errorMsg }, 'Redis EXPIRE error');
    }
  }

  /**
   * Get multiple keys at once for better performance
   * @param keys Array of cache keys
   * @returns Array of values (null for missing keys)
   */
  async mget(keys: string[]): Promise<(any | null)[]> {
    if (!this.isRedisAvailable() || keys.length === 0) {
      return new Array(keys.length).fill(null);
    }

    try {
      this.metrics.operations.get += keys.length;

      const values = await this.redis!.mget(...keys);

      // Count hits and misses
      const hits = values.filter(v => v !== null).length;
      const misses = values.length - hits;

      this.metrics.hits += hits;
      this.metrics.misses += misses;
      this.updateHitRate();

      this.logger.debug(
        {
          keys: keys.length,
          hits,
          misses,
        },
        'Batch cache get completed',
      );

      return values;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown Redis MGET error';
      this.logger.error({ keys: keys.length, error: errorMsg }, 'Redis MGET error');
      this.metrics.misses += keys.length;
      this.updateHitRate();
      return new Array(keys.length).fill(null);
    }
  }

  /**
   * Set multiple key-value pairs at once
   * @param keyValuePairs Array of [key, value, ttl?] tuples
   */
  async mset(keyValuePairs: any[]): Promise<void> {
    if (!this.isRedisAvailable() || keyValuePairs.length === 0) {
      return;
    }

    try {
      // Use pipeline for better performance
      const pipeline = this.redis!.pipeline();

      keyValuePairs.forEach(([key, value, ttl]) => {
        if (ttl) {
          pipeline.setex(key, ttl, value);
        } else {
          pipeline.set(key, value);
        }
      });

      await pipeline.exec();

      this.metrics.operations.set += keyValuePairs.length;

      this.logger.debug(
        {
          pairs: keyValuePairs.length,
        },
        'Batch cache set completed',
      );
    } catch (error) {
      this.logger.error(
        {
          pairs: keyValuePairs.length,
          error: error instanceof Error ? error.message : 'Unknown Redis MSET error',
        },
        'Redis MSET error',
      );
    }
  }

  /**
   * Get current cache metrics
   * @returns Cache performance metrics
   */
  getMetrics(): CacheMetrics {
    return { ...this.metrics };
  }

  /**
   * Reset cache metrics
   */
  resetMetrics(): void {
    this.metrics = {
      hits: 0,
      misses: 0,
      hitRate: 0,
      operations: {
        get: 0,
        set: 0,
        delete: 0,
      },
    };
  }

  /**
   * Check if Redis is available and connected
   * @returns True if Redis is available for operations
   */
  isRedisAvailable(): boolean {
    return this.isConnected && this.redis !== null;
  }

  /**
   * Get Redis connection status
   * @returns Connection status information
   */
  getConnectionStatus(): {
    connected: boolean;
    error: string | null;
    metrics: CacheMetrics;
  } {
    return {
      connected: this.isConnected,
      error: this.connectionError?.message || null,
      metrics: this.getMetrics(),
    };
  }

  /**
   * Test Redis connection
   * @returns True if ping successful
   */
  async ping(): Promise<boolean> {
    if (!this.redis) {
      return false;
    }

    try {
      const result = await this.redis.ping();
      return result === 'PONG';
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown Redis ping error';
      this.logger.error({ error: errorMsg }, 'Redis ping failed');
      return false;
    }
  }

  /**
   * Close Redis connection (cleanup)
   */
  async disconnect(): Promise<void> {
    if (this.redis) {
      this.isConnected = false;
      this.redis = null;
      this.logger.info('Redis connection closed');
    }
  }

  /**
   * Update hit rate calculation
   */
  private updateHitRate(): void {
    const total = this.metrics.hits + this.metrics.misses;
    this.metrics.hitRate = total > 0 ? (this.metrics.hits / total) * 100 : 0;
  }
}
