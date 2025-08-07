import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';
import { PrismaService } from '../prisma.service';
import { AwsSecretsService } from '../aws-secrets.service';
import { RedisCacheService } from '../cache/redis-cache.service';
import CacheKeys from '../cache/cache-keys';

export interface ToolCredentials {
  [key: string]: string;
}

export interface StoredCredentials {
  toolId: string;
  toolName: string;
  credentials: ToolCredentials;
  maskedCredentials: any;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class ToolSecretsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly awsSecrets: AwsSecretsService,
    private readonly cacheService: RedisCacheService,
    @InjectPinoLogger(ToolSecretsService.name)
    private readonly logger: PinoLogger,
  ) {}

  private generateSecretName(orgId: string, toolId: string): string {
    return `tolstoy/${orgId}/${toolId}`;
  }

  private maskCredential(value: string): string {
    if (!value || value.length <= 8) {
      return '***';
    }
    return value.substring(0, 4) + '*'.repeat(value.length - 8) + value.substring(value.length - 4);
  }

  private maskCredentials(credentials: ToolCredentials): any {
    const masked: any = {};
    Object.keys(credentials).forEach(key => {
      masked[key] = this.maskCredential(credentials[key]);
    });
    return masked;
  }

  private validateCredentials(credentials: ToolCredentials): void {
    if (!credentials || typeof credentials !== 'object') {
      throw new BadRequestException('Credentials must be an object');
    }

    const keys = Object.keys(credentials);
    if (keys.length === 0) {
      throw new BadRequestException('Credentials cannot be empty');
    }

    // Validate credential keys and values
    keys.forEach(key => {
      if (typeof key !== 'string' || key.trim().length === 0) {
        throw new BadRequestException('Credential keys must be non-empty strings');
      }

      const value = credentials[key];
      if (typeof value !== 'string' || value.trim().length === 0) {
        throw new BadRequestException(`Credential value for '${key}' must be a non-empty string`);
      }

      // Security check: prevent storing common sensitive field names
      const lowerKey = key.toLowerCase();
      if (
        lowerKey.includes('secret') ||
        lowerKey.includes('password') ||
        lowerKey.includes('token') ||
        lowerKey.includes('key')
      ) {
        if (value.length < 8) {
          throw new BadRequestException(
            `Credential '${key}' appears to be sensitive but is too short (minimum 8 characters)`,
          );
        }
      }
    });
  }

  async storeCredentials(
    orgId: string,
    toolId: string,
    credentials: ToolCredentials,
  ): Promise<StoredCredentials> {
    this.logger.info({ toolId, orgId }, 'Storing credentials for tool');

    // Validate inputs
    this.validateCredentials(credentials);

    // Check cache for tool metadata first
    const toolCacheKey = CacheKeys.toolMeta(orgId, toolId);
    let tool = await this.cacheService.get(toolCacheKey);

    if (!tool) {
      // Verify tool exists and belongs to organization
      tool = await this.prisma.tool.findFirst({
        where: { id: toolId, orgId },
      });

      if (!tool) {
        throw new NotFoundException(`Tool ${toolId} not found in organization ${orgId}`);
      }

      // Cache tool metadata
      await this.cacheService.set(toolCacheKey, tool, { ttl: CacheKeys.TTL.TOOL_META });
    }

    const secretName = this.generateSecretName(orgId, toolId);

    try {
      // Check if secret already exists
      const secretExists = await this.awsSecrets.secretExists(secretName);

      if (secretExists) {
        // Update existing secret
        await this.awsSecrets.updateSecret(secretName, credentials);
        this.logger.info({ toolId, orgId, secretName }, 'Updated existing credentials');
      } else {
        // Create new secret
        await this.awsSecrets.createSecret(
          secretName,
          credentials,
          `Tool credentials for ${(tool as any).name} in organization ${orgId}`,
        );
        this.logger.info({ toolId, orgId, secretName }, 'Created new credentials');
      }

      // Update tool record with secret name
      await this.prisma.tool.update({
        where: { id: toolId },
        data: { secretName },
      });

      // Invalidate caches related to this tool
      await this.invalidateToolCaches(orgId, toolId);

      const result = {
        toolId,
        toolName: (tool as any).name,
        credentials,
        maskedCredentials: this.maskCredentials(credentials),
        createdAt: (tool as any).createdAt,
        updatedAt: new Date(),
      };

      // Cache the stored credentials metadata (not the actual credentials)
      const credentialsCacheKey = CacheKeys.toolCredentials(orgId, toolId);
      await this.cacheService.set(
        credentialsCacheKey,
        {
          hasCredentials: true,
          maskedCredentials: result.maskedCredentials,
          updatedAt: result.updatedAt,
        },
        { ttl: CacheKeys.TTL.TOOLS },
      );

      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown credentials storage error';
      this.logger.error({ toolId, orgId, error: errorMsg }, 'Failed to store credentials for tool');
      throw new BadRequestException(`Failed to store credentials: ${errorMsg}`);
    }
  }

  async getCredentials(
    orgId: string,
    toolId: string,
    maskValues: boolean = true,
  ): Promise<StoredCredentials> {
    this.logger.info({ toolId, orgId, maskValues }, 'Retrieving credentials for tool');

    // Check cache for tool metadata first
    const toolCacheKey = CacheKeys.toolMeta(orgId, toolId);
    let tool = await this.cacheService.get(toolCacheKey);

    if (!tool) {
      // Verify tool exists and belongs to organization
      tool = await this.prisma.tool.findFirst({
        where: { id: toolId, orgId },
      });

      if (!tool) {
        throw new NotFoundException(`Tool ${toolId} not found in organization ${orgId}`);
      }

      // Cache tool metadata
      await this.cacheService.set(toolCacheKey, tool, { ttl: CacheKeys.TTL.TOOL_META });
    }

    if (!(tool as any).secretName) {
      throw new NotFoundException(`No credentials stored for tool ${toolId}`);
    }

    try {
      if (maskValues) {
        // For masked values, try to get from cache first
        const credentialsCacheKey = CacheKeys.toolCredentials(orgId, toolId);
        const cachedMeta = await this.cacheService.get(credentialsCacheKey);

        if (cachedMeta && (cachedMeta as any).maskedCredentials) {
          this.logger.debug(
            { toolId, orgId, cached: true },
            'Retrieved masked credentials from cache',
          );

          return {
            toolId,
            toolName: (tool as any).name,
            credentials: {}, // Always empty for masked requests
            maskedCredentials: (cachedMeta as any).maskedCredentials,
            createdAt: (tool as any).createdAt,
            updatedAt: (cachedMeta as any).updatedAt || (tool as any).updatedAt,
          };
        }
      }

      // Fetch from AWS Secrets Manager
      const credentials = await this.awsSecrets.getSecretAsJson((tool as any).secretName);
      const maskedCredentials = this.maskCredentials(credentials);

      // Cache the masked credentials metadata
      if (maskValues) {
        const credentialsCacheKey = CacheKeys.toolCredentials(orgId, toolId);
        await this.cacheService.set(
          credentialsCacheKey,
          {
            hasCredentials: true,
            maskedCredentials,
            updatedAt: (tool as any).updatedAt,
          },
          { ttl: CacheKeys.TTL.TOOLS },
        );
      }

      return {
        toolId,
        toolName: (tool as any).name,
        credentials: maskValues ? {} : credentials,
        maskedCredentials,
        createdAt: (tool as any).createdAt,
        updatedAt: (tool as any).updatedAt,
      };
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : 'Unknown credentials retrieval error';
      this.logger.error(
        { toolId, orgId, error: errorMsg },
        'Failed to retrieve credentials for tool',
      );
      throw new BadRequestException(`Failed to retrieve credentials: ${errorMsg}`);
    }
  }

  async deleteCredentials(orgId: string, toolId: string): Promise<void> {
    this.logger.info({ toolId, orgId }, 'Deleting credentials for tool');

    // Check cache for tool metadata first
    const toolCacheKey = CacheKeys.toolMeta(orgId, toolId);
    let tool = await this.cacheService.get(toolCacheKey);

    if (!tool) {
      // Verify tool exists and belongs to organization
      tool = await this.prisma.tool.findFirst({
        where: { id: toolId, orgId },
      });

      if (!tool) {
        throw new NotFoundException(`Tool ${toolId} not found in organization ${orgId}`);
      }
    }

    if (!(tool as any).secretName) {
      throw new NotFoundException(`No credentials stored for tool ${toolId}`);
    }

    try {
      // Delete secret from AWS
      await this.awsSecrets.deleteSecret((tool as any).secretName, false); // Use soft delete by default

      // Remove secret name from tool record
      await this.prisma.tool.update({
        where: { id: toolId },
        data: { secretName: null },
      });

      // Invalidate all related caches
      await this.invalidateToolCaches(orgId, toolId);

      this.logger.info(
        { toolId, orgId },
        'Successfully deleted credentials for tool and invalidated caches',
      );
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : 'Unknown credentials deletion error';
      this.logger.error(
        { toolId, orgId, error: errorMsg },
        'Failed to delete credentials for tool',
      );
      const errorMsg2 = error instanceof Error ? error.message : 'Unknown deletion error';
      throw new BadRequestException(`Failed to delete credentials: ${errorMsg2}`);
    }
  }

  async listToolsWithCredentials(orgId: string): Promise<
    Array<{
      toolId: string;
      toolName: string;
      baseUrl: string;
      authType: string;
      hasCredentials: boolean;
      credentialKeys?: string[];
    }>
  > {
    this.logger.info({ orgId }, 'Listing tools with credentials for organization');

    // Try to get the tools list from cache first
    const toolsListCacheKey = CacheKeys.toolList(orgId);
    const cachedResult = await this.cacheService.get(toolsListCacheKey);

    if (cachedResult) {
      this.logger.debug({ orgId, cached: true }, 'Retrieved tools list from cache');
      return cachedResult as any;
    }

    const tools = await this.prisma.tool.findMany({
      where: { orgId },
      select: {
        id: true,
        name: true,
        baseUrl: true,
        authType: true,
        secretName: true,
      },
    });

    const result = await Promise.all(
      tools.map(async tool => {
        let credentialKeys: string[] = [];

        if ((tool as any).secretName) {
          // Check cache for credential keys first
          const credentialsCacheKey = CacheKeys.toolCredentials(orgId, tool.id);
          const cachedMeta = await this.cacheService.get(credentialsCacheKey);

          if (cachedMeta && (cachedMeta as any).maskedCredentials) {
            credentialKeys = Object.keys((cachedMeta as any).maskedCredentials);
          } else {
            // Fallback to AWS Secrets Manager
            try {
              const credentials = await this.awsSecrets.getSecretAsJson((tool as any).secretName);
              credentialKeys = Object.keys(credentials);

              // Cache the metadata for future use
              await this.cacheService.set(
                credentialsCacheKey,
                {
                  hasCredentials: true,
                  maskedCredentials: this.maskCredentials(credentials),
                  updatedAt: new Date(),
                },
                { ttl: CacheKeys.TTL.TOOLS },
              );
            } catch (error) {
              const errorMsg =
                error instanceof Error ? error.message : 'Unknown credential keys error';
              this.logger.warn(
                { toolId: tool.id, orgId, error: errorMsg },
                'Failed to retrieve credential keys for tool',
              );
            }
          }
        }

        return {
          toolId: tool.id,
          toolName: (tool as any).name,
          baseUrl: tool.baseUrl,
          authType: tool.authType,
          hasCredentials: !!(tool as any).secretName,
          credentialKeys: (tool as any).secretName ? credentialKeys : undefined,
        };
      }),
    );

    // Cache the result
    await this.cacheService.set(toolsListCacheKey, result, { ttl: CacheKeys.TTL.TOOLS });

    this.logger.debug(
      { orgId, toolCount: result.length, cached: false },
      'Retrieved and cached tools list',
    );

    return result;
  }

  /**
   * Invalidate all caches related to a specific tool
   * @param orgId Organization ID
   * @param toolId Tool ID
   */
  private async invalidateToolCaches(orgId: string, toolId: string): Promise<void> {
    try {
      // Invalidate individual tool caches
      await Promise.all([
        this.cacheService.del(CacheKeys.toolMeta(orgId, toolId)),
        this.cacheService.del(CacheKeys.toolCredentials(orgId, toolId)),
        this.cacheService.del(CacheKeys.toolList(orgId)), // Invalidate tools list as it includes this tool
      ]);

      this.logger.debug({ orgId, toolId }, 'Invalidated tool caches');
    } catch (error) {
      this.logger.error(
        {
          orgId,
          toolId,
          error: error instanceof Error ? error.message : 'Unknown cache invalidation error',
        },
        'Failed to invalidate tool caches',
      );
    }
  }

  /**
   * Invalidate all tool-related caches for an organization
   * @param orgId Organization ID
   */
  async invalidateOrgToolCaches(orgId: string): Promise<void> {
    try {
      const pattern = CacheKeys.toolsPattern(orgId);
      const deletedCount = await this.cacheService.delPattern(pattern);

      this.logger.info(
        {
          orgId,
          deletedKeys: deletedCount,
        },
        'Invalidated all tool caches for organization',
      );
    } catch (error) {
      this.logger.error(
        {
          orgId,
          error: error instanceof Error ? error.message : 'Unknown cache invalidation error',
        },
        'Failed to invalidate organization tool caches',
      );
    }
  }

  /**
   * Warm up cache for organization tools
   * @param orgId Organization ID
   */
  async warmupToolsCache(orgId: string): Promise<void> {
    try {
      this.logger.info({ orgId }, 'Warming up tools cache');

      // This will populate the cache
      await this.listToolsWithCredentials(orgId);

      this.logger.info({ orgId }, 'Tools cache warmup completed');
    } catch (error) {
      this.logger.error(
        {
          orgId,
          error: error instanceof Error ? error.message : 'Unknown cache invalidation error',
        },
        'Failed to warm up tools cache',
      );
    }
  }
}
