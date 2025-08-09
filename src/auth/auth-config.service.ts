import { Injectable, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { AwsSecretsService } from '../aws-secrets.service';
import { RedisCacheService } from '../cache/redis-cache.service';
import axios, { AxiosResponse } from 'axios';

export interface OrgAuthConfig {
  id: string;
  orgId: string;
  toolId: string;
  type: string; // "apiKey" | "oauth2" - kept as string to match Prisma generated type
  config: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserCredential {
  id: string;
  orgId: string;
  userId: string;
  toolId: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface RefreshedTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

export interface TokenRefreshResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
}

@Injectable()
export class AuthConfigService {
  private readonly logger = new Logger(AuthConfigService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly awsSecrets: AwsSecretsService,
    private readonly cache: RedisCacheService,
  ) {}

  /**
   * Validate tool access - ensure toolId exists and belongs to orgId
   */
  private async validateToolAccess(toolId: string, orgId: string): Promise<{ id: string; name: string; orgId: string }> {
    try {
      const tool = await this.prisma.tool.findUnique({
        where: { id: toolId },
        select: { id: true, name: true, orgId: true }
      });

      if (!tool) {
        throw new NotFoundException(`Tool with ID ${toolId} not found`);
      }

      if (tool.orgId !== orgId) {
        this.logger.warn(`Unauthorized access attempt: tool ${toolId} does not belong to org ${orgId}`);
        throw new UnauthorizedException(`Tool ${toolId} does not belong to organization ${orgId}`);
      }

      this.logger.debug(`Validated tool access: ${tool.name} (${toolId}) for org ${orgId}`);
      return tool;
    } catch (error) {
      this.logger.error(`Tool validation failed for ${toolId} in org ${orgId}: ${error.message}`);
      throw error;
    }
  }

  private orgConfigKey(orgId: string, toolId: string): string {
    return `auth:org:${orgId}:tool:${toolId}`;
  }

  private _userCredKey(orgId: string, userId: string, toolId: string): string {
    // Reserved for future user credential caching
    return `auth:user:${orgId}:${userId}:tool:${toolId}`;
  }

  /**
   * Load org-level auth config (apiKey or oauth2)
   * First validates tool access, checks cache, then database, then syncs to AWS Secrets Manager
   */
  async getOrgAuthConfig(orgId: string, toolId: string): Promise<OrgAuthConfig> {
    // Validate tool access first
    const tool = await this.validateToolAccess(toolId, orgId);
    
    const cacheKey = this.orgConfigKey(orgId, toolId);

    this.logger.debug(`Loading org auth config for ${orgId}:${toolId}`);

    // Check cache first
    const cached = await this.cache.get(cacheKey);
    if (cached && typeof cached === 'object' && 'id' in cached) {
      this.logger.debug(`Found cached auth config for ${orgId}:${toolId}`);
      return cached as OrgAuthConfig;
    }

    // Load from database using toolId directly
    const record = await this.prisma.toolAuthConfig.findFirst({
      where: {
        orgId,
        toolId,
      },
      include: {
        tool: true,
      },
    });

    if (!record) {
      this.logger.warn(`No auth config found for org ${orgId} and tool ${toolId}`);
      throw new NotFoundException(`No auth config for tool ${toolId} in organization ${orgId}`);
    }

    const config = record.config;

    // Persist in AWS Secrets Manager as well for backup/sync
    try {
      const configToSync =
        config && typeof config === 'object' && config !== null
          ? (config as Record<string, unknown>)
          : {};
      await this.syncToSecretsManager(`tolstoy/${orgId}/tools/${toolId}/config`, configToSync);
      this.logger.debug(`Synced auth config to AWS Secrets Manager for ${orgId}:${toolId}`);
    } catch (error) {
      this.logger.warn(`Failed to sync auth config to AWS Secrets Manager: ${error.message}`);
      // Continue execution - don't fail if secrets manager is unavailable
    }

    // Cache for 10 minutes
    await this.cache.set(cacheKey, config, { ttl: 600 });

    this.logger.debug(`Loaded and cached auth config for ${orgId}:${toolId}`);
    return {
      id: record.id,
      orgId: record.orgId,
      toolId: record.toolId,
      type: record.type,
      config: record.config as Record<string, unknown>,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  /**
   * Load user-level OAuth tokens and credentials
   */
  async getUserCredentials(
    orgId: string,
    userId: string,
    toolId: string,
  ): Promise<UserCredential> {
    // Validate tool access first
    await this.validateToolAccess(toolId, orgId);
    
    this.logger.debug(`Loading user credentials for ${orgId}:${userId}:${toolId}`);

    const cred = await this.prisma.userCredential.findFirst({
      where: {
        orgId,
        userId,
        toolId,
      },
      include: {
        tool: true,
      },
    });

    if (!cred) {
      this.logger.warn(
        `No user credentials found for user ${userId} and tool ${toolId} in org ${orgId}`,
      );
      throw new NotFoundException(
        `No user credentials for user ${userId} & tool ${toolId} in organization ${orgId}`,
      );
    }

    this.logger.debug(`Found user credentials for ${orgId}:${userId}:${toolId}`);
    return cred;
  }

  /**
   * Refresh OAuth tokens if expired
   * Returns current access token if still valid, otherwise refreshes and updates
   */
  async refreshUserToken(cred: {
    accessToken: string;
    refreshToken: string;
    expiresAt: Date;
    id: string;
    orgId: string;
    toolId: string;
  }): Promise<string> {
    // Check if token is still valid (with 5 minute buffer)
    const expirationBuffer = 5 * 60 * 1000; // 5 minutes in milliseconds
    const now = new Date();
    const expiresAt = new Date(cred.expiresAt);

    if (expiresAt.getTime() > now.getTime() + expirationBuffer) {
      this.logger.debug(`Access token still valid for credential ${cred.id}`);
      return cred.accessToken;
    }

    this.logger.debug(
      `Access token expired or expiring soon for credential ${cred.id}, refreshing...`,
    );

    try {
      // Get the tool to determine the toolKey and OAuth configuration
      const tool = await this.prisma.tool.findUnique({
        where: { id: cred.toolId },
      });

      if (!tool) {
        throw new Error(`Tool not found for credential ${cred.id}`);
      }

      // Load OAuth configuration for token refresh
      const orgConfig = await this.getOrgAuthConfig(cred.orgId, cred.toolId);

      if (orgConfig.type !== 'oauth2') {
        throw new Error(`Tool ${tool.name} is not configured for OAuth2 authentication`);
      }

      const oauthConfig = this.validateRefreshConfig(orgConfig.config, tool.name);

      // Perform token refresh
      const refreshedTokens = await this.performTokenRefresh(
        cred.refreshToken,
        oauthConfig,
        tool.name,
      );

      // Calculate new expiration time
      const newExpiresAt = refreshedTokens.expires_in
        ? new Date(Date.now() + refreshedTokens.expires_in * 1000)
        : new Date(Date.now() + 3600000); // Default 1 hour

      // Update credentials in database
      const updatedCred = await this.prisma.userCredential.update({
        where: { id: cred.id },
        data: {
          accessToken: refreshedTokens.access_token,
          refreshToken: refreshedTokens.refresh_token || cred.refreshToken,
          expiresAt: newExpiresAt,
          updatedAt: new Date(),
        },
      });

      this.logger.debug(`Successfully refreshed token for credential ${cred.id}`);

      // Optionally cache the new token briefly for performance
      const cacheKey = `token:${cred.id}`;
      await this.cache.set(cacheKey, refreshedTokens.access_token, { ttl: 300 }); // 5 minutes

      return refreshedTokens.access_token;
    } catch (error) {
      this.logger.error(`Failed to refresh token for credential ${cred.id}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Store or update org-level auth configuration
   */
  async setOrgAuthConfig(
    orgId: string,
    toolId: string,
    type: string, // 'apiKey' | 'oauth2'
    config: Record<string, unknown>,
  ): Promise<OrgAuthConfig> {
    // Validate tool access first
    await this.validateToolAccess(toolId, orgId);
    
    this.logger.debug(`Setting org auth config for ${orgId}:${toolId}`);

    const authConfig = await this.prisma.toolAuthConfig.upsert({
      where: {
        orgId_toolId: { orgId, toolId },
      },
      create: {
        orgId,
        toolId,
        type,
        config: config as any,
      },
      update: {
        type,
        config: config as any,
        updatedAt: new Date(),
      },
      include: {
        tool: true,
      },
    });

    // Invalidate cache
    const cacheKey = this.orgConfigKey(orgId, toolId);
    await this.cache.del(cacheKey);

    this.logger.debug(`Successfully set auth config for ${orgId}:${toolId}`);
    return {
      id: authConfig.id,
      orgId: authConfig.orgId,
      toolId: authConfig.toolId,
      type: authConfig.type,
      config: authConfig.config as Record<string, unknown>,
      createdAt: authConfig.createdAt,
      updatedAt: authConfig.updatedAt,
    };
  }

  /**
   * Store or update user credentials
   */
  async setUserCredentials(
    orgId: string,
    userId: string,
    toolId: string,
    accessToken: string,
    refreshToken: string,
    expiresAt: Date,
  ): Promise<UserCredential> {
    // Validate tool access first
    await this.validateToolAccess(toolId, orgId);
    
    this.logger.debug(`Setting user credentials for ${orgId}:${userId}:${toolId}`);

    const credential = await this.prisma.userCredential.upsert({
      where: {
        orgId_userId_toolId: { orgId, userId, toolId },
      },
      create: {
        orgId,
        userId,
        toolId,
        accessToken,
        refreshToken,
        expiresAt,
      },
      update: {
        accessToken,
        refreshToken,
        expiresAt,
        updatedAt: new Date(),
      },
    });

    this.logger.debug(`Successfully set credentials for ${orgId}:${userId}:${toolId}`);
    return credential;
  }

  /**
   * Delete org auth configuration
   */
  async deleteOrgAuthConfig(orgId: string, toolId: string): Promise<void> {
    // Validate tool access first
    await this.validateToolAccess(toolId, orgId);
    
    this.logger.debug(`Deleting org auth config for ${orgId}:${toolId}`);

    const deleted = await this.prisma.toolAuthConfig.deleteMany({
      where: { orgId, toolId },
    });

    if (deleted.count === 0) {
      throw new NotFoundException(`No auth config found for org ${orgId} and tool ${toolId}`);
    }

    // Clean up cache
    const cacheKey = this.orgConfigKey(orgId, toolId);
    await this.cache.del(cacheKey);

    this.logger.debug(`Successfully deleted auth config for ${orgId}:${toolId}`);
  }

  /**
   * Delete user credentials
   */
  async deleteUserCredentials(orgId: string, userId: string, toolId: string): Promise<void> {
    // Validate tool access first
    await this.validateToolAccess(toolId, orgId);
    
    this.logger.debug(`Deleting user credentials for ${orgId}:${userId}:${toolId}`);

    const deleted = await this.prisma.userCredential.deleteMany({
      where: { orgId, userId, toolId },
    });

    if (deleted.count === 0) {
      throw new NotFoundException(
        `No credentials found for user ${userId} and tool ${toolId} in org ${orgId}`,
      );
    }

    this.logger.debug(`Successfully deleted credentials for ${orgId}:${userId}:${toolId}`);
  }

  /**
   * Validate OAuth configuration has required fields for token refresh
   */
  private validateRefreshConfig(config: Record<string, unknown>, toolKey: string) {
    if (!config.clientId) {
      throw new Error(`Missing clientId for OAuth2 configuration of ${toolKey}`);
    }

    if (!config.clientSecret) {
      throw new Error(`Missing clientSecret for OAuth2 configuration of ${toolKey}`);
    }

    return {
      clientId: config.clientId as string,
      clientSecret: config.clientSecret as string,
      tokenUrl: config.tokenUrl as string | undefined,
    };
  }

  /**
   * Perform OAuth token refresh with the provider
   */
  private async performTokenRefresh(
    refreshToken: string,
    config: { clientId: string; clientSecret: string; tokenUrl?: string },
    toolKey: string,
  ): Promise<TokenRefreshResponse> {
    try {
      const tokenUrl = config.tokenUrl || this.getDefaultTokenUrl(toolKey);

      const requestData = {
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: config.clientId,
        client_secret: config.clientSecret,
      };

      this.logger.debug(`Refreshing token for ${toolKey} at ${tokenUrl}`);

      const response: AxiosResponse<TokenRefreshResponse> = await axios.post(
        tokenUrl,
        new URLSearchParams(requestData),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Accept: 'application/json',
            'User-Agent': 'Tolstoy/1.0',
          },
          timeout: 30000,
        },
      );

      if (response.status !== 200) {
        throw new Error(`Token refresh failed with status: ${response.status}`);
      }

      const tokenData = response.data;

      if (!tokenData.access_token) {
        throw new Error('No access token received from OAuth provider during refresh');
      }

      this.logger.debug(`Successfully refreshed token for ${toolKey}`);

      return tokenData;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const errorDetails = {
          status: error.response?.status,
          data: error.response?.data,
          message: error.message,
        };
        this.logger.error(`Token refresh HTTP error for ${toolKey}:`, errorDetails);
        throw new Error(
          `Failed to refresh token: ${error.response?.data?.error || error.message}`,
        );
      }

      this.logger.error(`Token refresh error for ${toolKey}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get default token URL for known providers (for refresh)
   */
  private getDefaultTokenUrl(toolKey: string): string {
    const urls: Record<string, string> = {
      github: 'https://github.com/login/oauth/access_token',
      google: 'https://oauth2.googleapis.com/token',
      microsoft: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
      slack: 'https://slack.com/api/oauth.v2.access',
      discord: 'https://discord.com/api/oauth2/token',
      linkedin: 'https://www.linkedin.com/oauth/v2/accessToken',
      facebook: 'https://graph.facebook.com/v18.0/oauth/access_token',
    };

    const url = urls[toolKey.toLowerCase()];
    if (!url) {
      throw new Error(
        `No default token URL configured for ${toolKey}. Please specify tokenUrl in OAuth config.`,
      );
    }

    return url;
  }

  /**
   * Helper method to create or update a secret in AWS Secrets Manager
   */
  private async syncToSecretsManager(
    secretName: string,
    value: Record<string, unknown>,
  ): Promise<void> {
    const secretValue = typeof value === 'string' ? value : JSON.stringify(value);

    try {
      // Check if secret exists
      const exists = await this.awsSecrets.secretExists(secretName);

      if (exists) {
        await this.awsSecrets.updateSecret(secretName, secretValue);
      } else {
        await this.awsSecrets.createSecret(secretName, secretValue, 'Tolstoy auth configuration');
      }
    } catch (error) {
      this.logger.warn(`Failed to sync to secrets manager: ${error.message}`);
      throw error;
    }
  }
}
