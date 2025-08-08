import { Injectable, Logger, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import axios, { AxiosResponse } from 'axios';
import { AuthConfigService } from './auth-config.service';
import { RedisCacheService } from '../cache/redis-cache.service';

export interface OAuthState {
  orgId: string;
  userId: string;
  toolKey: string;
  timestamp: number;
}

export interface OAuthTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
}

export interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scope?: string;
  authorizeUrl?: string;
  tokenUrl?: string;
}

@Injectable()
export class OAuthService {
  private readonly logger = new Logger(OAuthService.name);

  constructor(
    private readonly authConfig: AuthConfigService,
    private readonly redisCache: RedisCacheService,
  ) {}

  /**
   * Generate OAuth authorization URL with state parameter
   */
  async getAuthorizeUrl(
    toolKey: string,
    orgId: string,
    userId: string,
  ): Promise<{ url: string; state: string }> {
    try {
      this.logger.log(`Generating OAuth URL for tool ${toolKey}, org ${orgId}, user ${userId}`);

      // Load org OAuth configuration
      const orgConfig = await this.authConfig.getOrgAuthConfig(orgId, toolKey);

      if (orgConfig.type !== 'oauth2') {
        throw new BadRequestException(
          `Tool ${toolKey} is not configured for OAuth2 authentication`,
        );
      }

      const oauthConfig = this.validateOAuthConfig(orgConfig.config, toolKey);

      // Generate and store state
      const state = randomUUID();
      const stateData: OAuthState = {
        orgId,
        userId,
        toolKey,
        timestamp: Date.now(),
      };

      const stateKey = `oauth:state:${state}`;
      await this.redisCache.set(stateKey, JSON.stringify(stateData), { ttl: 300 }); // 5 minutes

      // Build authorization URL
      const authorizeUrl = oauthConfig.authorizeUrl || this.getDefaultAuthorizeUrl(toolKey);
      const params = new URLSearchParams({
        response_type: 'code',
        client_id: oauthConfig.clientId,
        redirect_uri: oauthConfig.redirectUri,
        state,
        ...(oauthConfig.scope && { scope: oauthConfig.scope }),
      });

      const fullUrl = `${authorizeUrl}?${params.toString()}`;

      this.logger.log(
        `Generated OAuth URL for ${toolKey}: ${authorizeUrl}?client_id=${oauthConfig.clientId}&...`,

      return { url: fullUrl, state };
    } catch (error) {
      this.logger.error(`Failed to generate OAuth URL: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Handle OAuth callback: validate state and exchange code for tokens
   */
  async handleCallback(
    code: string,
    state: string,
  ): Promise<{ credentialId: string; toolKey: string; orgId: string }> {
    try {
      this.logger.log(`Processing OAuth callback with state: ${state}`);

      // Validate and retrieve state
      const stateKey = `oauth:state:${state}`;
      const stateDataStr = await this.redisCache.get(stateKey);

      if (!stateDataStr) {
        throw new UnauthorizedException('Invalid or expired OAuth state parameter');
      }

      // Clean up state immediately
      await this.redisCache.del(stateKey);

      const stateData: OAuthState = JSON.parse(stateDataStr);
      const { orgId, userId, toolKey } = stateData;

      // Validate state timestamp (additional security)
      const stateAge = Date.now() - stateData.timestamp;
      if (stateAge > 300000) {
        // 5 minutes
        throw new UnauthorizedException('OAuth state has expired');
      }

      this.logger.log(`Validated state for tool ${toolKey}, org ${orgId}, user ${userId}`);

      // Load OAuth configuration for token exchange
      const orgConfig = await this.authConfig.getOrgAuthConfig(orgId, toolKey);
      const oauthConfig = this.validateOAuthConfig(orgConfig.config, toolKey);

      // Exchange authorization code for tokens
      const tokenResponse = await this.exchangeCodeForTokens(code, oauthConfig, toolKey);

      // Calculate expiration time
      const expiresAt = tokenResponse.expires_in
        ? new Date(Date.now() + tokenResponse.expires_in * 1000)
        : new Date(Date.now() + 3600000); // Default 1 hour

      // We need to get the toolId from the loaded config since setUserCredentials expects toolId
      // The orgConfig should include the tool relation with the actual ID
      const toolId = orgConfig.tool?.id || orgConfig.toolId;
      if (!toolId) {
        throw new Error(`Could not determine toolId for ${toolKey}`);
      }

      // Store user credentials
      const credential = await this.authConfig.setUserCredentials(
        orgId,
        userId,
        toolId, // Use the actual toolId from the database
        tokenResponse.access_token,
        tokenResponse.refresh_token || '',
        expiresAt,
      );

      // Optionally sync to AWS Secrets Manager
      try {
        const secretName = `tolstoy/${orgId}/users/${userId}/tools/${toolKey}`;
        const secretValue = {
          accessToken: tokenResponse.access_token,
          refreshToken: tokenResponse.refresh_token,
          expiresAt: expiresAt.toISOString(),
          scope: tokenResponse.scope,
          tokenType: tokenResponse.token_type || 'Bearer',
          createdAt: new Date().toISOString(),
        };

        // Note: This assumes AwsSecretsService is available through AuthConfigService
        // The actual sync is handled by the AuthConfigService internally
        this.logger.debug(`Credentials stored for ${toolKey} user ${userId}`);
      } catch (syncError) {
        this.logger.warn(`Failed to sync credentials to AWS Secrets Manager: ${syncError.message}`);
        // Continue execution - don't fail the entire flow for sync issues
      }

      this.logger.log(`Successfully completed OAuth flow for ${toolKey} user ${userId}`);

      return {
        credentialId: credential.id,
        toolKey,
        orgId,
      };
    } catch (error) {
      this.logger.error(`OAuth callback failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Exchange authorization code for access tokens
   */
  private async exchangeCodeForTokens(
    code: string,
    config: OAuthConfig,
    toolKey: string,
  ): Promise<OAuthTokenResponse> {
    try {
      const tokenUrl = config.tokenUrl || this.getDefaultTokenUrl(toolKey);

      const requestData = {
        grant_type: 'authorization_code',
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code,
        redirect_uri: config.redirectUri,
        ...(config.scope && { scope: config.scope }),
      };

      this.logger.debug(`Exchanging code for tokens at ${tokenUrl}`);

      const response: AxiosResponse<OAuthTokenResponse> = await axios.post(
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
        throw new Error(`Token exchange failed with status: ${response.status}`);
      }

      const tokenData = response.data;

      if (!tokenData.access_token) {
        throw new Error('No access token received from OAuth provider');
      }

      this.logger.debug(`Successfully exchanged code for tokens for ${toolKey}`);

      return tokenData;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const errorDetails = {
          status: error.response?.status,
          data: error.response?.data,
          message: error.message,
        };
        this.logger.error(`Token exchange HTTP error for ${toolKey}:`, errorDetails);
        throw new Error(
          `Failed to exchange authorization code: ${error.response?.data?.error || error.message}`,
        );

      this.logger.error(`Token exchange error for ${toolKey}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Validate OAuth configuration has required fields
   */
  private validateOAuthConfig(config: any, toolKey: string): OAuthConfig {
    if (!config.clientId) {
      throw new BadRequestException(`Missing clientId for OAuth2 configuration of ${toolKey}`);
    }

    if (!config.clientSecret) {
      throw new BadRequestException(`Missing clientSecret for OAuth2 configuration of ${toolKey}`);
    }

    if (!config.redirectUri) {
      throw new BadRequestException(`Missing redirectUri for OAuth2 configuration of ${toolKey}`);
    }

    return config as OAuthConfig;
  }

  /**
   * Get default authorization URL for known providers
   */
  private getDefaultAuthorizeUrl(toolKey: string): string {
    const urls: Record<string, string> = {
      github: 'https://github.com/login/oauth/authorize',
      google: 'https://accounts.google.com/o/oauth2/v2/auth',
      microsoft: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
      slack: 'https://slack.com/oauth/v2/authorize',
      discord: 'https://discord.com/api/oauth2/authorize',
      linkedin: 'https://www.linkedin.com/oauth/v2/authorization',
      facebook: 'https://www.facebook.com/v18.0/dialog/oauth',
    };

    const url = urls[toolKey.toLowerCase()];
    if (!url) {
      throw new BadRequestException(
        `No default authorization URL configured for ${toolKey}. Please specify authorizeUrl in OAuth config.`,
      );
    }

    return url;
  }

  /**
   * Get default token URL for known providers
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
      throw new BadRequestException(
        `No default token URL configured for ${toolKey}. Please specify tokenUrl in OAuth config.`,
      );
    }

    return url;
  }
}
