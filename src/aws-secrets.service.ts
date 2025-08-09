import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { ConfigService } from '@nestjs/config';
import {
  CreateSecretCommand,
  DeleteSecretCommand,
  DescribeSecretCommand,
  GetSecretValueCommand,
  PutSecretValueCommand,
  ResourceNotFoundException,
  SecretsManagerClient,
} from '@aws-sdk/client-secrets-manager';
import { RedisCacheService } from './cache/redis-cache.service';
import CacheKeys from './cache/cache-keys';

@Injectable()
export class AwsSecretsService {
  private client: SecretsManagerClient;
  private region: string;
  // Remove in-memory cache - will use Redis instead
  private cacheService: RedisCacheService | null = null;

  constructor(
    private configService: ConfigService,
    @InjectPinoLogger(AwsSecretsService.name)
    private readonly logger: PinoLogger,
  ) {
    this.region = this.configService.get('AWS_REGION', 'us-east-1');
    this.client = new SecretsManagerClient({
      region: this.region,
      maxAttempts: 3,
      retryMode: 'adaptive',
    });

    this.logger.info({ region: this.region }, 'AWS Secrets Manager client initialized');
  }

  /**
   * Set the cache service after dependency injection is complete
   * This prevents circular dependencies during initialization
   */
  setCacheService(cacheService: RedisCacheService): void {
    this.cacheService = cacheService;
    this.logger.debug('Redis cache service configured for AWS Secrets Manager');
  }

  async getSecret(secretId: string, key?: string): Promise<string> {
    const cacheKey = CacheKeys.awsSecret(secretId, key);

    // Check Redis cache first if available
    if (this.cacheService) {
      const cached = await this.cacheService.get(cacheKey);
      if (cached) {
        this.logger.debug({ secretId, key, cached: true }, 'Using cached secret from Redis');
        return typeof cached === 'string' ? cached : JSON.stringify(cached);
      }
    }

    try {
      this.logger.info({ secretId, key }, 'Retrieving secret from AWS');

      // Add retry logic with exponential backoff
      let lastError: Error;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const command = new GetSecretValueCommand({ SecretId: secretId });
          const response = await this.client.send(command);

          if (!response.SecretString) {
            throw new Error(`Secret ${secretId} has no SecretString value`);
          }

          let resultValue: string;

          // If no specific key is requested, return the entire secret string
          if (!key) {
            resultValue = response.SecretString;
            this.logger.info({ secretId, fromCache: false }, 'Successfully retrieved secret');
          } else {
            // Parse JSON and extract specific key
            const secrets = JSON.parse(response.SecretString);

            if (!Object.prototype.hasOwnProperty.call(secrets, key)) {
              throw new Error(
                `Key '${key}' not found in secret ${secretId}. Available keys: ${Object.keys(secrets).join(', ')}`,
              );
            }

            resultValue = secrets[key];
            this.logger.info(
              { secretId, key, fromCache: false },
              'Successfully retrieved secret key',
            );
          }

          // Cache the result in Redis
          if (this.cacheService) {
            await this.cacheService.set(cacheKey, resultValue, { ttl: CacheKeys.TTL.CONFIG });
          }

          return resultValue;
        } catch (error) {
          lastError = error as Error;
          if (attempt < 3) {
            const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
            const errorMsg =
              error instanceof Error ? error.message : 'Unknown secret retrieval error';
            this.logger.warn(
              { secretId, key, attempt, delay, error: errorMsg },
              'Secret retrieval failed, retrying',
            );
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }

      throw lastError;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown secret retrieval error';
      this.logger.error(
        { secretId, key, error: errorMsg, attempts: 3 },
        'Failed to retrieve secret after all attempts',
      );

      // Try to get stale cached value from Redis as fallback
      if (this.cacheService) {
        try {
          const staleCache = await this.cacheService.get(cacheKey);
          if (staleCache) {
            this.logger.warn(
              { secretId, key, cached: true, stale: true },
              'Using stale cached value from Redis due to error',
            );
            return typeof staleCache === 'string' ? staleCache : JSON.stringify(staleCache);
          }
        } catch (cacheError) {
          const cacheErrorMsg =
            cacheError instanceof Error ? cacheError.message : 'Unknown cache error';
          this.logger.debug({ error: cacheErrorMsg }, 'Could not retrieve stale cache value');
        }
      }

      throw error;
    }
  }

  async getSecretAsJson(secretId: string): Promise<Record<string, unknown>> {
    try {
      const secretString = await this.getSecret(secretId);
      return JSON.parse(secretString);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown JSON parsing error';
      this.logger.error({ secretId, error: errorMsg }, 'Failed to parse secret as JSON');
      throw error;
    }
  }

  async getDatabaseUrl(secretId: string = 'tolstoy/env'): Promise<string> {
    return this.getSecret(secretId, 'DATABASE_URL');
  }

  async getDatabaseDirectUrl(secretId: string = 'tolstoy/env'): Promise<string> {
    return this.getSecret(secretId, 'DIRECT_URL');
  }

  async getDaytonaApiKey(secretId: string = 'tolstoy/env'): Promise<string> {
    return this.getSecret(secretId, 'DAYTONA_API_KEY');
  }

  async getDaytonaBaseUrl(secretId: string = 'tolstoy/env'): Promise<string> {
    return this.getSecret(secretId, 'DAYTONA_BASE_URL');
  }

  async getDaytonaSyncTimeout(secretId: string = 'tolstoy/env'): Promise<string> {
    return this.getSecret(secretId, 'DAYTONA_SYNC_TIMEOUT');
  }

  async getDaytonaAsyncTimeout(secretId: string = 'tolstoy/env'): Promise<string> {
    return this.getSecret(secretId, 'DAYTONA_ASYNC_TIMEOUT');
  }

  async getAblyApiKey(secretId: string = 'tolstoy/env'): Promise<string> {
    return this.getSecret(secretId, 'ABLY_API_KEY');
  }

  async getInngestApiKey(secretId: string = 'tolstoy/env'): Promise<string> {
    return this.getSecret(secretId, 'INNGEST_API_KEY');
  }

  async getInngestWebhookSecret(secretId: string = 'tolstoy/env'): Promise<string> {
    return this.getSecret(secretId, 'INNGEST_WEBHOOK_SECRET');
  }

  async getInngestEventKey(secretId: string = 'tolstoy/env'): Promise<string> {
    return this.getSecret(secretId, 'INNGEST_EVENT_KEY');
  }

  async getInngestSigningKey(secretId: string = 'tolstoy/env'): Promise<string> {
    return this.getSecret(secretId, 'INNGEST_SIGNING_KEY');
  }

  async getInngestConfig(secretId: string = 'tolstoy/env'): Promise<{
    apiKey: string;
    webhookSecret: string;
    eventKey: string;
    signingKey: string;
  }> {
    const secrets = await this.getSecretAsJson(secretId);
    return {
      apiKey: String(secrets.INNGEST_API_KEY),
      webhookSecret: String(secrets.INNGEST_WEBHOOK_SECRET),
      eventKey: String(secrets.INNGEST_EVENT_KEY),
      signingKey: String(secrets.INNGEST_SIGNING_KEY),
    };
  }

  async getHcpClientId(secretId: string = 'tolstoy/env'): Promise<string> {
    return this.getSecret(secretId, 'HCP_CLIENT_ID');
  }

  async getHcpClientSecret(secretId: string = 'tolstoy/env'): Promise<string> {
    return this.getSecret(secretId, 'HCP_CLIENT_SECRET');
  }

  async getHcpServicePrincipalId(secretId: string = 'tolstoy/env'): Promise<string> {
    return this.getSecret(secretId, 'HCP_SERVICE_PRINCIPAL_ID');
  }

  async getHcpConfig(secretId: string = 'tolstoy/env'): Promise<{
    clientId: string;
    clientSecret: string;
    servicePrincipalId: string;
  }> {
    const secrets = await this.getSecretAsJson(secretId);
    return {
      clientId: String(secrets.HCP_CLIENT_ID),
      clientSecret: String(secrets.HCP_CLIENT_SECRET),
      servicePrincipalId: String(secrets.HCP_SERVICE_PRINCIPAL_ID),
    };
  }

  async getStainlessToken(secretId: string = 'tolstoy/env'): Promise<string> {
    return this.getSecret(secretId, 'STAINLESS_TOKEN');
  }

  async getSentryDsn(secretId: string = 'tolstoy/env'): Promise<string> {
    return this.getSecret(secretId, 'SENTRY_DSN');
  }

  async getUpstashRedisUrl(secretId: string = 'tolstoy/env'): Promise<string> {
    return this.getSecret(secretId, 'UPSTASH_REDIS_REST_URL');
  }

  async getUpstashRedisToken(secretId: string = 'tolstoy/env'): Promise<string> {
    return this.getSecret(secretId, 'UPSTASH_REDIS_REST_TOKEN');
  }

  async getRedisConfig(secretId: string = 'tolstoy/env'): Promise<{
    url: string;
    token: string;
  }> {
    const secrets = await this.getSecretAsJson(secretId);
    return {
      url: String(secrets.UPSTASH_REDIS_REST_URL),
      token: String(secrets.UPSTASH_REDIS_REST_TOKEN),
    };
  }

  async validateSecretAccess(secretId: string): Promise<boolean> {
    try {
      await this.getSecret(secretId);
      return true;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown secret access error';
      this.logger.error({ secretId, error: errorMsg }, 'Cannot access secret');
      return false;
    }
  }

  async updateSecret(
    secretId: string,
    secretValue: string | Record<string, unknown>,
  ): Promise<void> {
    try {
      this.logger.info({ secretId }, 'Updating secret value');

      const secretString =
        typeof secretValue === 'string' ? secretValue : JSON.stringify(secretValue);

      const command = new PutSecretValueCommand({
        SecretId: secretId,
        SecretString: secretString,
      });

      await this.client.send(command);

      // Clear Redis cache for this secret
      if (this.cacheService) {
        const pattern = CacheKeys.awsSecret(secretId, '*');
        await this.cacheService.delPattern(pattern);
      }

      this.logger.info({ secretId }, 'Successfully updated secret and cleared cache');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown secret update error';
      this.logger.error({ secretId, error: errorMsg }, 'Failed to update secret');
      throw error;
    }
  }

  async createSecret(
    secretName: string,
    secretValue: string | Record<string, unknown>,
    description?: string,
  ): Promise<void> {
    try {
      this.logger.info({ secretName, description }, 'Creating new secret');

      const secretString =
        typeof secretValue === 'string' ? secretValue : JSON.stringify(secretValue);

      const command = new CreateSecretCommand({
        Name: secretName,
        SecretString: secretString,
        Description: description,
      });

      await this.client.send(command);
      this.logger.info({ secretName }, 'Successfully created secret');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown secret creation error';
      this.logger.error({ secretName, error: errorMsg }, 'Failed to create secret');
      throw error;
    }
  }

  async secretExists(secretId: string): Promise<boolean> {
    try {
      const command = new DescribeSecretCommand({ SecretId: secretId });
      await this.client.send(command);
      return true;
    } catch (error) {
      if (error instanceof ResourceNotFoundException) {
        return false;
      }
      throw error;
    }
  }

  async updateSecretKey(secretId: string, key: string, value: string): Promise<void> {
    try {
      const existingSecret = await this.getSecretAsJson(secretId);
      existingSecret[key] = value;
      await this.updateSecret(secretId, existingSecret);
      this.logger.info({ secretId, key }, 'Successfully updated secret key');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown secret key update error';
      this.logger.error({ secretId, key, error: errorMsg }, 'Failed to update secret key');
      throw error;
    }
  }

  async deleteSecret(secretId: string, forceDelete: boolean = false): Promise<void> {
    try {
      this.logger.info({ secretId, forceDelete }, 'Deleting secret');

      const command = new DeleteSecretCommand({
        SecretId: secretId,
        ForceDeleteWithoutRecovery: forceDelete,
      });

      await this.client.send(command);

      // Clear Redis cache for this secret
      if (this.cacheService) {
        const pattern = CacheKeys.awsSecret(secretId, '*');
        await this.cacheService.delPattern(pattern);
      }

      this.logger.info({ secretId }, 'Successfully deleted secret and cleared cache');
    } catch (error) {
      if (error instanceof ResourceNotFoundException) {
        this.logger.warn({ secretId }, 'Secret not found, may already be deleted');
        return; // Don't throw error if secret doesn't exist
      }
      const errorMsg = error instanceof Error ? error.message : 'Unknown secret deletion error';
      this.logger.error({ secretId, error: errorMsg }, 'Failed to delete secret');
      throw error;
    }
  }

  async clearCache(): Promise<void> {
    if (this.cacheService) {
      try {
        const pattern = 'aws-secret:*';
        const deletedCount = await this.cacheService.delPattern(pattern);
        this.logger.info(
          { deletedKeys: deletedCount },
          'AWS Secrets Manager cache cleared from Redis',
        );
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown cache clearing error';
        this.logger.error({ error: errorMsg }, 'Failed to clear AWS Secrets Manager cache');
      }
    } else {
      this.logger.debug('No cache service available to clear');
    }
  }

  /**
   * Get cache metrics for monitoring
   */
  getCacheMetrics(): Record<string, unknown> {
    if (this.cacheService) {
      const metrics = this.cacheService.getMetrics();
      return {
        hitRate: metrics.hitRate,
        hits: metrics.hits,
        misses: metrics.misses,
        operations: metrics.operations,
      };
    }
    return { error: 'Cache service not available' };
  }
}
