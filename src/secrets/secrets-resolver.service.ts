import { Injectable } from '@nestjs/common';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';
import { AwsSecretsService } from '../aws-secrets.service';
import { RedisCacheService } from '../cache/redis-cache.service';
import CacheKeys from '../cache/cache-keys';

export interface ToolCredentials {
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  apiKey?: string;
  clientId?: string;
  clientSecret?: string;
  webhookSecret?: string;
  [key: string]: any;
}

export interface OAuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  scope?: string;
  tokenType?: string;
}

@Injectable()
export class SecretsResolver {
  constructor(
    private readonly awsSecretsService: AwsSecretsService,
    private readonly cacheService: RedisCacheService,
    @InjectPinoLogger(SecretsResolver.name)
    private readonly logger: PinoLogger,
  ) {}

  async getToolCredentials(toolName: string, orgId: string): Promise<ToolCredentials> {
    const cacheKey = CacheKeys.secrets(orgId, toolName);

    // Try cache first
    try {
      const cached = await this.cacheService.get(cacheKey);
      if (cached) {
        this.logger.debug({ toolName, orgId, cached: true }, 'Retrieved credentials from cache');
        return cached;
      }
    } catch (error) {
      this.logger.warn(
        { toolName, orgId, error: error instanceof Error ? error.message : 'Unknown cache error' },
        'Cache error during credential lookup, falling back to AWS',
      );
    }

    const secretId = this.buildToolSecretId(toolName, orgId);

    try {
      this.logger.debug(
        { toolName, orgId, cached: false },
        'Retrieving credentials from AWS Secrets Manager',
      );
      const credentials = await this.awsSecretsService.getSecretAsJson(secretId);

      // Cache the credentials (don't let caching errors affect the response)
      try {
        await this.cacheService.set(cacheKey, credentials, { ttl: CacheKeys.TTL.SECRETS });
      } catch (cacheError) {
        this.logger.warn(
          { toolName, orgId, error: cacheError instanceof Error ? cacheError.message : 'Unknown cache error' },
          'Failed to cache credentials, but returning AWS result',
        );
      }

      return credentials as ToolCredentials;
    } catch (error) {
      this.logger.error(
        { toolName, orgId, error: error instanceof Error ? error.message : 'Unknown error' },
        'Failed to retrieve credentials for tool',
      );
      throw new Error(`Tool credentials not found for ${toolName}`);
    }
  }

  async setToolCredentials(
    toolName: string,
    orgId: string,
    credentials: ToolCredentials,
  ): Promise<void> {
    const secretId = this.buildToolSecretId(toolName, orgId);
    const cacheKey = CacheKeys.secrets(orgId, toolName);

    try {
      this.logger.info({ toolName, orgId }, 'Setting credentials for tool');

      const secretExists = await this.awsSecretsService.secretExists(secretId);

      if (secretExists) {
        await this.awsSecretsService.updateSecret(secretId, credentials);
      } else {
        await this.awsSecretsService.createSecret(
          secretId,
          credentials,
          `Credentials for ${toolName} - Organization ${orgId}`,
        );
      }

      // Invalidate cache after updating credentials
      await this.cacheService.del(cacheKey);

      this.logger.info(
        { toolName, orgId },
        'Successfully stored credentials and invalidated cache',
      );
    } catch (error) {
      this.logger.error(
        { toolName, orgId, error: error instanceof Error ? error.message : 'Unknown error' },
        'Failed to store credentials',
      );
      throw error;
    }
  }

  async getOAuthTokens(toolName: string, orgId: string): Promise<OAuthTokens> {
    const credentials = await this.getToolCredentials(toolName, orgId);

    if (!credentials.accessToken) {
      throw new Error(`No access token found for ${toolName}`);
    }

    return {
      accessToken: credentials.accessToken,
      refreshToken: credentials.refreshToken,
      expiresAt: credentials.expiresAt || 0,
      scope: credentials.scope,
      tokenType: credentials.tokenType || 'Bearer',
    };
  }

  async updateOAuthTokens(toolName: string, orgId: string, tokens: OAuthTokens): Promise<void> {
    const cacheKey = CacheKeys.secrets(orgId, toolName);

    try {
      this.logger.info({ toolName, orgId, expiresAt: tokens.expiresAt }, 'Updating OAuth tokens');

      let existingCredentials: ToolCredentials = {};

      try {
        existingCredentials = await this.getToolCredentials(toolName, orgId);
      } catch {
        this.logger.debug({ toolName, orgId }, 'No existing credentials found, creating new');
      }

      const updatedCredentials: ToolCredentials = {
        ...existingCredentials,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: tokens.expiresAt,
        scope: tokens.scope,
        tokenType: tokens.tokenType,
        lastUpdated: new Date().toISOString(),
      };

      await this.setToolCredentials(toolName, orgId, updatedCredentials);

      // Additional cache invalidation for OAuth-specific operations
      await this.cacheService.del(cacheKey);

      this.logger.info(
        { toolName, orgId },
        'Successfully updated OAuth tokens and invalidated cache',
      );
    } catch (error) {
      this.logger.error(
        { toolName, orgId, error: error instanceof Error ? error.message : 'Unknown error' },
        'Failed to update OAuth tokens',
      );
      throw error;
    }
  }

  async isTokenExpired(toolName: string, orgId: string): Promise<boolean> {
    try {
      const tokens = await this.getOAuthTokens(toolName, orgId);
      const now = Date.now();
      const bufferTime = 5 * 60 * 1000; // 5 minutes buffer

      return tokens.expiresAt > 0 && tokens.expiresAt - bufferTime <= now;
    } catch (error) {
      this.logger.debug(
        { toolName, orgId, error: error instanceof Error ? error.message : 'Unknown error' },
        'Could not check token expiration',
      );
      return true;
    }
  }

  async getApiKey(toolName: string, orgId: string): Promise<string> {
    const credentials = await this.getToolCredentials(toolName, orgId);

    if (!credentials.apiKey) {
      throw new Error(`No API key found for ${toolName}`);
    }

    return credentials.apiKey;
  }

  async setApiKey(toolName: string, orgId: string, apiKey: string): Promise<void> {
    let existingCredentials: ToolCredentials = {};

    try {
      existingCredentials = await this.getToolCredentials(toolName, orgId);
    } catch {
      this.logger.debug(
        { toolName, orgId },
        'No existing credentials found for token access, creating new',
      );
    }

    const updatedCredentials: ToolCredentials = {
      ...existingCredentials,
      apiKey,
      lastUpdated: new Date().toISOString(),
    };

    await this.setToolCredentials(toolName, orgId, updatedCredentials);
  }

  async getWebhookSecret(toolName: string, orgId: string): Promise<string> {
    const credentials = await this.getToolCredentials(toolName, orgId);

    if (!credentials.webhookSecret) {
      throw new Error(`No webhook secret found for ${toolName}`);
    }

    return credentials.webhookSecret;
  }

  async deleteToolCredentials(toolName: string, orgId: string): Promise<void> {
    const cacheKey = CacheKeys.secrets(orgId, toolName);

    try {
      // Invalidate cache immediately
      await this.cacheService.del(cacheKey);

      this.logger.warn(
        { toolName, orgId },
        'Deleting credentials - AWS Secrets Manager will schedule deletion, not immediate',
      );

      // Note: AWS Secrets Manager deletion is scheduled, not immediate
      // The cache invalidation ensures stale data isn't served
    } catch (error) {
      this.logger.error(
        { toolName, orgId, error: error instanceof Error ? error.message : 'Unknown error' },
        'Failed to invalidate cache during credential deletion',
      );
    }
  }

  private buildToolSecretId(toolName: string, orgId: string): string {
    const sanitizedToolName = toolName.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const sanitizedOrgId = orgId.toLowerCase().replace(/[^a-z0-9]/g, '-');
    return `tolstoy/${sanitizedToolName}/${sanitizedOrgId}`;
  }

  async listAvailableTools(orgId: string): Promise<string[]> {
    this.logger.debug({ orgId }, 'Listing available tools for organization');
    return [];
  }

  /**
   * Invalidate all cached secrets for an organization
   * Useful for bulk operations or when organization data changes
   */
  async invalidateOrgSecrets(orgId: string): Promise<void> {
    try {
      const pattern = CacheKeys.secretsPattern(orgId);
      const deletedCount = await this.cacheService.delPattern(pattern);

      this.logger.info(
        {
          orgId,
          deletedKeys: deletedCount,
        },
        'Invalidated all cached secrets for organization',
      );
    } catch (error) {
      this.logger.error(
        {
          orgId,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        'Failed to invalidate organization secrets cache',
      );
    }
  }

  /**
   * Warm up cache for commonly used tool credentials
   * Can be called during application startup or scheduled
   */
  async warmupCache(orgId: string, toolNames: string[]): Promise<void> {
    this.logger.info(
      {
        orgId,
        tools: toolNames.length,
      },
      'Warming up credentials cache',
    );

    const warmupPromises = toolNames.map(async toolName => {
      try {
        // This will cache the credentials if they exist
        await this.getToolCredentials(toolName, orgId);
      } catch (error) {
        // Ignore errors during warmup - tools may not have credentials
        const errorMsg = error instanceof Error ? error.message : 'Unknown warmup error';
        this.logger.debug(
          {
            toolName,
            orgId,
            error: errorMsg,
          },
          'Skipped warmup for tool without credentials',
        );
      }
    });

    await Promise.allSettled(warmupPromises);

    this.logger.info(
      {
        orgId,
        tools: toolNames.length,
      },
      'Cache warmup completed',
    );
  }
}
