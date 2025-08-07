import { Injectable } from '@nestjs/common';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';
import { SecretsResolver, OAuthTokens } from '../secrets/secrets-resolver.service';
import axios, { AxiosResponse } from 'axios';

export interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  tokenEndpoint: string;
  refreshEndpoint?: string;
  scope?: string;
}

export interface TokenRefreshResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
}

@Injectable()
export class OAuthTokenService {
  constructor(
    private readonly secretsResolver: SecretsResolver,
    @InjectPinoLogger(OAuthTokenService.name)
    private readonly logger: PinoLogger,
  ) {}

  async getValidAccessToken(toolName: string, orgId: string): Promise<string> {
    try {
      const isExpired = await this.secretsResolver.isTokenExpired(toolName, orgId);

      if (isExpired) {
        this.logger.info({ toolName, orgId, expired: true }, 'Token expired, attempting refresh');
        await this.refreshToken(toolName, orgId);
      }

      const tokens = await this.secretsResolver.getOAuthTokens(toolName, orgId);
      return tokens.accessToken;
    } catch (error) {
      this.logger.error(
        { toolName, orgId, error: error instanceof Error ? error.message : 'Unknown error' },
        'Failed to get valid access token',
      );
      throw new Error(`Unable to obtain valid access token for ${toolName}`);
    }
  }

  async refreshToken(toolName: string, orgId: string): Promise<OAuthTokens> {
    try {
      this.logger.info({ toolName, orgId }, 'Refreshing OAuth token');

      const currentTokens = await this.secretsResolver.getOAuthTokens(toolName, orgId);
      const credentials = await this.secretsResolver.getToolCredentials(toolName, orgId);

      if (!currentTokens.refreshToken) {
        throw new Error(`No refresh token available for ${toolName}`);
      }

      if (!credentials.clientId || !credentials.clientSecret) {
        throw new Error(`OAuth client credentials not found for ${toolName}`);
      }

      const oauthConfig: OAuthConfig = {
        clientId: credentials.clientId,
        clientSecret: credentials.clientSecret,
        tokenEndpoint: credentials.tokenEndpoint || this.getDefaultTokenEndpoint(toolName),
      };

      const refreshedTokens = await this.performTokenRefresh(
        oauthConfig,
        currentTokens.refreshToken,
      );

      const newTokens: OAuthTokens = {
        accessToken: refreshedTokens.access_token,
        refreshToken: refreshedTokens.refresh_token || currentTokens.refreshToken,
        expiresAt: refreshedTokens.expires_in
          ? Date.now() + refreshedTokens.expires_in * 1000
          : currentTokens.expiresAt,
        scope: refreshedTokens.scope || currentTokens.scope,
        tokenType: refreshedTokens.token_type || currentTokens.tokenType,
      };

      await this.secretsResolver.updateOAuthTokens(toolName, orgId, newTokens);

      this.logger.info(
        { toolName, orgId, expiresIn: refreshedTokens.expires_in },
        'Successfully refreshed token',
      );
      return newTokens;
    } catch (error) {
      this.logger.error(
        { toolName, orgId, error: error instanceof Error ? error.message : 'Unknown error' },
        'Failed to refresh token',
      );
      throw error;
    }
  }

  private async performTokenRefresh(
    config: OAuthConfig,
    refreshToken: string,
  ): Promise<TokenRefreshResponse> {
    const tokenEndpoint = config.refreshEndpoint || config.tokenEndpoint;

    const requestData = {
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: config.clientId,
      client_secret: config.clientSecret,
    };

    if (config.scope) {
      requestData['scope'] = config.scope;
    }

    try {
      const response: AxiosResponse<TokenRefreshResponse> = await axios.post(
        tokenEndpoint,
        new URLSearchParams(requestData),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Accept: 'application/json',
          },
          timeout: 30000,
        },
      );

      if (response.status !== 200) {
        throw new Error(`Token refresh failed with status: ${response.status}`);
      }

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        this.logger.error(
          {
            status: error.response?.status,
            responseData: error.response?.data,
            message: error instanceof Error ? error.message : 'Unknown error',
          },
          'Token refresh HTTP error',
        );
      }
      throw error;
    }
  }

  async storeInitialTokens(
    toolName: string,
    orgId: string,
    tokens: OAuthTokens,
    config: Partial<OAuthConfig>,
  ): Promise<void> {
    try {
      this.logger.info({ toolName, orgId }, 'Storing initial OAuth tokens');

      const credentials = {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: tokens.expiresAt,
        scope: tokens.scope,
        tokenType: tokens.tokenType,
        clientId: config.clientId,
        clientSecret: config.clientSecret,
        tokenEndpoint: config.tokenEndpoint,
        createdAt: new Date().toISOString(),
      };

      await this.secretsResolver.setToolCredentials(toolName, orgId, credentials);
      this.logger.info({ toolName, orgId }, 'Successfully stored initial tokens');
    } catch (error) {
      this.logger.error(
        { toolName, orgId, error: error instanceof Error ? error.message : 'Unknown error' },
        'Failed to store initial tokens',
      );
      throw error;
    }
  }

  async updateOAuthTokens(
    toolName: string,
    orgId: string,
    tokens: OAuthTokens,
  ): Promise<OAuthTokens> {
    await this.secretsResolver.updateOAuthTokens(toolName, orgId, tokens);
    return tokens;
  }

  async revokeToken(toolName: string, orgId: string): Promise<void> {
    try {
      this.logger.info({ toolName, orgId }, 'Revoking OAuth token');

      const tokens = await this.secretsResolver.getOAuthTokens(toolName, orgId);
      const credentials = await this.secretsResolver.getToolCredentials(toolName, orgId);

      const revokeEndpoint = credentials.revokeEndpoint || this.getDefaultRevokeEndpoint(toolName);

      if (revokeEndpoint) {
        try {
          await axios.post(revokeEndpoint, {
            token: tokens.accessToken,
            client_id: credentials.clientId,
            client_secret: credentials.clientSecret,
          });
          this.logger.info({ toolName, orgId }, 'Successfully revoked token at provider');
        } catch (error) {
          this.logger.warn(
            { toolName, orgId, error: error instanceof Error ? error.message : 'Unknown error' },
            'Failed to revoke token at provider',
          );
        }
      }

      await this.secretsResolver.deleteToolCredentials(toolName, orgId);
      this.logger.info({ toolName, orgId }, 'Successfully removed stored tokens');
    } catch (error) {
      this.logger.error(
        { toolName, orgId, error: error instanceof Error ? error.message : 'Unknown error' },
        'Failed to revoke token',
      );
      throw error;
    }
  }

  private getDefaultTokenEndpoint(toolName: string): string {
    const endpoints: Record<string, string> = {
      github: 'https://github.com/login/oauth/access_token',
      google: 'https://oauth2.googleapis.com/token',
      microsoft: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
      slack: 'https://slack.com/api/oauth.v2.access',
      discord: 'https://discord.com/api/oauth2/token',
    };

    const endpoint = endpoints[toolName.toLowerCase()];
    if (!endpoint) {
      throw new Error(`No default token endpoint configured for ${toolName}`);
    }

    return endpoint;
  }

  private getDefaultRevokeEndpoint(toolName: string): string | null {
    const endpoints: Record<string, string> = {
      github: 'https://api.github.com/applications/{client_id}/token',
      google: 'https://oauth2.googleapis.com/revoke',
      microsoft: 'https://login.microsoftonline.com/common/oauth2/v2.0/logout',
    };

    return endpoints[toolName.toLowerCase()] || null;
  }

  async validateTokenHealth(toolName: string, orgId: string): Promise<boolean> {
    try {
      const tokens = await this.secretsResolver.getOAuthTokens(toolName, orgId);

      if (!tokens.accessToken) {
        return false;
      }

      const isExpired = await this.secretsResolver.isTokenExpired(toolName, orgId);

      if (isExpired && !tokens.refreshToken) {
        return false;
      }

      return true;
    } catch (error) {
      this.logger.debug(
        { toolName, orgId, error: error instanceof Error ? error.message : 'Unknown error' },
        'Token health check failed',
      );
      return false;
    }
  }
}
