import { Injectable, Logger } from '@nestjs/common';
import { AwsSecretsService } from '../aws-secrets.service';

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
  private readonly logger = new Logger(SecretsResolver.name);

  constructor(private readonly awsSecretsService: AwsSecretsService) {}

  async getToolCredentials(toolName: string, orgId: string): Promise<ToolCredentials> {
    const secretId = this.buildToolSecretId(toolName, orgId);
    
    try {
      this.logger.debug(`Retrieving credentials for tool: ${toolName}, org: ${orgId}`);
      const credentials = await this.awsSecretsService.getSecretAsJson(secretId);
      return credentials as ToolCredentials;
    } catch (error) {
      this.logger.error(`Failed to retrieve credentials for ${toolName}/${orgId}:`, error);
      throw new Error(`Tool credentials not found for ${toolName}`);
    }
  }

  async setToolCredentials(toolName: string, orgId: string, credentials: ToolCredentials): Promise<void> {
    const secretId = this.buildToolSecretId(toolName, orgId);
    
    try {
      this.logger.log(`Setting credentials for tool: ${toolName}, org: ${orgId}`);
      
      const secretExists = await this.awsSecretsService.secretExists(secretId);
      
      if (secretExists) {
        await this.awsSecretsService.updateSecret(secretId, credentials);
      } else {
        await this.awsSecretsService.createSecret(
          secretId, 
          credentials, 
          `Credentials for ${toolName} - Organization ${orgId}`
        );
      }
      
      this.logger.log(`Successfully stored credentials for ${toolName}/${orgId}`);
    } catch (error) {
      this.logger.error(`Failed to store credentials for ${toolName}/${orgId}:`, error);
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
      tokenType: credentials.tokenType || 'Bearer'
    };
  }

  async updateOAuthTokens(toolName: string, orgId: string, tokens: OAuthTokens): Promise<void> {
    const secretId = this.buildToolSecretId(toolName, orgId);
    
    try {
      this.logger.log(`Updating OAuth tokens for ${toolName}/${orgId}`);
      
      let existingCredentials: ToolCredentials = {};
      
      try {
        existingCredentials = await this.getToolCredentials(toolName, orgId);
      } catch (error) {
        this.logger.debug(`No existing credentials found for ${toolName}/${orgId}, creating new`);
      }

      const updatedCredentials: ToolCredentials = {
        ...existingCredentials,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: tokens.expiresAt,
        scope: tokens.scope,
        tokenType: tokens.tokenType,
        lastUpdated: new Date().toISOString()
      };

      await this.setToolCredentials(toolName, orgId, updatedCredentials);
      this.logger.log(`Successfully updated OAuth tokens for ${toolName}/${orgId}`);
    } catch (error) {
      this.logger.error(`Failed to update OAuth tokens for ${toolName}/${orgId}:`, error);
      throw error;
    }
  }

  async isTokenExpired(toolName: string, orgId: string): Promise<boolean> {
    try {
      const tokens = await this.getOAuthTokens(toolName, orgId);
      const now = Date.now();
      const bufferTime = 5 * 60 * 1000; // 5 minutes buffer
      
      return tokens.expiresAt > 0 && (tokens.expiresAt - bufferTime) <= now;
    } catch (error) {
      this.logger.debug(`Could not check token expiration for ${toolName}/${orgId}:`, error);
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
    } catch (error) {
      this.logger.debug(`No existing credentials found for ${toolName}/${orgId}, creating new`);
    }

    const updatedCredentials: ToolCredentials = {
      ...existingCredentials,
      apiKey,
      lastUpdated: new Date().toISOString()
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
    const secretId = this.buildToolSecretId(toolName, orgId);
    this.logger.warn(`Deleting credentials for ${toolName}/${orgId} - Note: AWS Secrets Manager will schedule deletion, not immediate`);
  }

  private buildToolSecretId(toolName: string, orgId: string): string {
    const sanitizedToolName = toolName.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const sanitizedOrgId = orgId.toLowerCase().replace(/[^a-z0-9]/g, '-');
    return `tolstoy/${sanitizedToolName}/${sanitizedOrgId}`;
  }

  async listAvailableTools(orgId: string): Promise<string[]> {
    this.logger.debug(`Listing available tools for org: ${orgId}`);
    return [];
  }
}