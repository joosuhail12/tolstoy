import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { AwsSecretsService } from '../aws-secrets.service';
import { RedisCacheService } from '../cache/redis-cache.service';

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

@Injectable()
export class AuthConfigService {
  private readonly logger = new Logger(AuthConfigService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly awsSecrets: AwsSecretsService,
    private readonly cache: RedisCacheService,
  ) {}

  private orgConfigKey(orgId: string, toolKey: string): string {
    return `auth:org:${orgId}:tool:${toolKey}`;
  }

  private userCredKey(orgId: string, userId: string, toolKey: string): string {
    return `auth:user:${orgId}:${userId}:tool:${toolKey}`;
  }

  /**
   * Load org-level auth config (apiKey or oauth2)
   * First checks cache, then database, then syncs to AWS Secrets Manager
   */
  async getOrgAuthConfig(orgId: string, toolKey: string): Promise<ToolAuthConfig> {
    const cacheKey = this.orgConfigKey(orgId, toolKey);

    this.logger.debug(`Loading org auth config for ${orgId}:${toolKey}`);

    // Check cache first
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      this.logger.debug(`Found cached auth config for ${orgId}:${toolKey}`);
      return cached;
    }

    // Load from database with tool relation
    const record = await this.prisma.toolAuthConfig.findFirst({
      where: {
        orgId,
        tool: { name: toolKey }, // Assuming tool identifier is 'name' field
      },
      include: {
        tool: true,
      },
    });

    if (!record) {
      this.logger.warn(`No auth config found for org ${orgId} and tool ${toolKey}`);
      throw new NotFoundException(`No auth config for tool ${toolKey} in organization ${orgId}`);
    }

    const config = record.config;

    // Persist in AWS Secrets Manager as well for backup/sync
    try {
      await this.syncToSecretsManager(`tolstoy/${orgId}/tools/${toolKey}/config`, config);
      this.logger.debug(`Synced auth config to AWS Secrets Manager for ${orgId}:${toolKey}`);
    } catch (error) {
      this.logger.warn(`Failed to sync auth config to AWS Secrets Manager: ${error.message}`);
      // Continue execution - don't fail if secrets manager is unavailable
    }

    // Cache for 10 minutes
    await this.cache.set(cacheKey, config, { ttl: 600 });

    this.logger.debug(`Loaded and cached auth config for ${orgId}:${toolKey}`);
    return config;
  }

  /**
   * Load user-level OAuth tokens and credentials
   */
  async getUserCredentials(
    orgId: string,
    userId: string,
    toolKey: string,
  ): Promise<UserCredential> {
    this.logger.debug(`Loading user credentials for ${orgId}:${userId}:${toolKey}`);

    const cred = await this.prisma.userCredential.findFirst({
      where: {
        orgId,
        userId,
        tool: { name: toolKey }, // Assuming tool identifier is 'name' field
      },
      include: {
        tool: true,
      },
    });

    if (!cred) {
      this.logger.warn(
        `No user credentials found for user ${userId} and tool ${toolKey} in org ${orgId}`,
      );
      throw new NotFoundException(
        `No user credentials for user ${userId} & tool ${toolKey} in organization ${orgId}`,
      );
    }

    this.logger.debug(`Found user credentials for ${orgId}:${userId}:${toolKey}`);
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

    // TODO: Implement OAuth2 refresh using your OAuth client
    // For now, this is a placeholder that would need to be implemented
    // based on the specific OAuth provider (Google, Microsoft, etc.)

    try {
      // Placeholder for OAuth refresh logic
      // const refreshed = await this.oauthClient.refresh(cred.refreshToken);

      // For demo purposes, we'll throw an error indicating this needs implementation
      throw new Error(
        'OAuth refresh not yet implemented. Please implement based on your OAuth provider.',
      );

      /* Implementation would look like this:
      const refreshed: RefreshedTokens = await this.refreshTokenWithProvider(cred.refreshToken);

      // Update both DB and potentially Secrets Manager
      const updatedCred = await this.prisma.userCredential.update({
        where: { id: cred.id },
        data: {
          accessToken: refreshed.accessToken,
          refreshToken: refreshed.refreshToken,
          expiresAt: refreshed.expiresAt,
        },
      });

      this.logger.debug(`Successfully refreshed token for credential ${cred.id}`);

      // Optionally cache the new token briefly
      // await this.cache.set(`token:${cred.id}`, refreshed.accessToken, 300);

      return refreshed.accessToken;
      */

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
    this.logger.debug(`Setting org auth config for ${orgId}:${toolId}`);

    const authConfig = await this.prisma.toolAuthConfig.upsert({
      where: {
        orgId_toolId: { orgId, toolId },
      },
      create: {
        orgId,
        toolId,
        type,
        config,
      },
      update: {
        type,
        config,
        updatedAt: new Date(),
      },
      include: {
        tool: true,
      },
    });

    // Invalidate cache
    const cacheKey = this.orgConfigKey(orgId, authConfig.tool.name);
    await this.cache.del(cacheKey);

    this.logger.debug(`Successfully set auth config for ${orgId}:${toolId}`);
    return authConfig;
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
    this.logger.debug(`Deleting org auth config for ${orgId}:${toolId}`);

    const deleted = await this.prisma.toolAuthConfig.deleteMany({
      where: { orgId, toolId },
    });

    if (deleted.count === 0) {
      throw new NotFoundException(`No auth config found for org ${orgId} and tool ${toolId}`);
    }

    // Clean up cache
    const tool = await this.prisma.tool.findUnique({ where: { id: toolId } });
    if (tool) {
      const cacheKey = this.orgConfigKey(orgId, tool.name);
      await this.cache.del(cacheKey);
    }

    this.logger.debug(`Successfully deleted auth config for ${orgId}:${toolId}`);
  }

  /**
   * Delete user credentials
   */
  async deleteUserCredentials(orgId: string, userId: string, toolId: string): Promise<void> {
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
   * Helper method to create or update a secret in AWS Secrets Manager
   */
  private async syncToSecretsManager(secretName: string, value: Record<string, unknown>): Promise<void> {
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
