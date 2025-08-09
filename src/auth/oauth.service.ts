import { BadRequestException, Injectable, Logger, UnauthorizedException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import axios, { AxiosResponse } from 'axios';
import { AuthConfigService } from './auth-config.service';
import { RedisCacheService } from '../cache/redis-cache.service';
import { PrismaService } from '../prisma.service';

export interface OAuthState {
  orgId: string;
  userId: string;
  toolId: string; // Changed from toolKey to toolId for security and uniqueness
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
  redirectUri?: string; // Single callback URL (backward compatibility)
  redirectUris?: string[]; // Multiple callback URLs for multi-environment support  
  allowedDomains?: string[]; // Allowed domains for dynamic callback generation
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
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
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

  /**
   * Build redirect URI for OAuth callback based on current domain configuration
   * Supports multiple environments and domain validation
   */
  private buildRedirectUri(allowedDomains?: string[], requestHost?: string): string {
    let baseUrl: string;

    // If a specific host is requested and it's in allowed domains, use it
    if (requestHost && allowedDomains && allowedDomains.length > 0) {
      const isAllowed = allowedDomains.some(domain => 
        requestHost === domain || 
        requestHost.endsWith(`.${domain}`) ||
        domain === '*' // Wildcard allows any domain
      );
      
      if (isAllowed) {
        const protocol = requestHost.includes('localhost') || requestHost.includes('127.0.0.1') ? 'http' : 'https';
        baseUrl = `${protocol}://${requestHost}`;
        this.logger.debug(`Using requested host for callback: ${baseUrl}`);
      } else {
        this.logger.warn(`Requested host ${requestHost} not in allowed domains: ${allowedDomains.join(', ')}`);
        baseUrl = this.getDefaultBaseUrl();
      }
    } else {
      baseUrl = this.getDefaultBaseUrl();
    }

    return `${baseUrl}/auth/oauth/callback`;
  }

  /**
   * Get the default base URL for OAuth callbacks
   */
  private getDefaultBaseUrl(): string {
    return this.configService.get('NODE_ENV') === 'production'
      ? `https://${this.configService.get('DOMAIN', 'tolstoy.getpullse.com')}`
      : `http://localhost:${this.configService.get('PORT', '3000')}`;
  }

  /**
   * Select the appropriate redirect URI based on configuration and request context
   * Uses centralized callback URL /auth/oauth/callback
   */
  private selectRedirectUri(config: OAuthConfig, requestHost?: string): string {
    // Priority 1: Explicit single redirect URI (backward compatibility)
    if (config.redirectUri) {
      const validatedUri = this.validateRedirectUri(config.redirectUri);
      this.logger.debug(`Using configured redirectUri: ${validatedUri}`);
      return validatedUri;
    }

    // Priority 2: Multiple redirect URIs - select based on request host
    if (config.redirectUris && config.redirectUris.length > 0) {
      // Validate all configured URIs
      const validatedUris = config.redirectUris.map(uri => this.validateRedirectUri(uri));
      
      if (requestHost) {
        // Find matching redirect URI for the request host
        const matchingUri = validatedUris.find(uri => {
          const uriHost = new URL(uri).hostname;
          return uriHost === requestHost || requestHost.endsWith(`.${uriHost}`);
        });
        
        if (matchingUri) {
          this.logger.debug(`Using matching redirectUri: ${matchingUri} for host: ${requestHost}`);
          return matchingUri;
        }
      }
      
      // If no match or no requestHost, use the first validated URI
      this.logger.debug(`Using first configured redirectUri: ${validatedUris[0]}`);
      return validatedUris[0];
    }

    // Priority 3: Dynamic generation with domain validation (centralized callback)
    this.logger.debug(`Using dynamic redirect URI generation with centralized callback`);
    const dynamicUri = this.buildRedirectUri(config.allowedDomains, requestHost);
    return this.validateRedirectUri(dynamicUri);
  }

  /**
   * Validate redirect URI for security and correctness
   * Validates centralized callback URL /auth/oauth/callback
   */
  private validateRedirectUri(redirectUri: string): string {
    try {
      const url = new URL(redirectUri);

      // Security checks
      if (!['http:', 'https:'].includes(url.protocol)) {
        throw new BadRequestException(
          `Invalid protocol in redirect URI. Only HTTP and HTTPS are allowed.`,
        );
      }

      // Prevent local file access and other dangerous schemes
      if (url.protocol === 'file:' || url.protocol === 'ftp:') {
        throw new BadRequestException(
          `Dangerous protocol ${url.protocol} not allowed in redirect URI`,
        );
      }

      // Check for suspicious patterns
      if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
        // Allow localhost only in development
        if (this.configService.get('NODE_ENV') !== 'development') {
          this.logger.warn(`Localhost redirect URI used in production: ${redirectUri}`);
        }
      }

      // Validate that it uses our centralized callback path
      if (!url.pathname.includes('/auth/oauth/callback')) {
        this.logger.warn(
          `Redirect URI doesn't match expected centralized callback path: ${redirectUri}`,
        );
      }

      // Check for open redirects (basic detection)
      const suspiciousParams = ['redirect', 'url', 'return_to', 'next'];
      const hasRedirectParam = suspiciousParams.some(param => url.searchParams.has(param));
      if (hasRedirectParam) {
        this.logger.warn(`Potentially suspicious redirect parameters in URI: ${redirectUri}`);
      }

      return redirectUri;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(`Invalid redirect URI format: ${error.message}`);
    }
  }

  /**
   * Generate OAuth authorization URL with state parameter
   * Uses toolId for security and centralized callback URL
   */
  async getAuthorizeUrl(
    toolId: string,
    orgId: string,
    userId: string,
    requestHost?: string,
  ): Promise<{ url: string; state: string; toolKey: string }> {
    try {
      // First validate that tool exists and belongs to organization
      const tool = await this.validateToolAccess(toolId, orgId);
      const toolKey = tool.name; // Get tool name for provider-specific logic

      this.logger.log(`Generating OAuth URL for tool ${toolKey} (${toolId}), org ${orgId}, user ${userId}`);

      // Load org OAuth configuration using toolId
      const orgConfig = await this.authConfig.getOrgAuthConfig(orgId, toolId);

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
        toolId, // Store toolId instead of toolKey for security
        timestamp: Date.now(),
      };

      const stateKey = `oauth:state:${state}`;
      await this.redisCache.set(stateKey, JSON.stringify(stateData), { ttl: 300 }); // 5 minutes

      // Build authorization URL
      const authorizeUrl = oauthConfig.authorizeUrl || this.getDefaultAuthorizeUrl(toolKey);

      // Select appropriate redirect URI with multi-environment support (centralized callback)
      const redirectUri = this.selectRedirectUri(oauthConfig, requestHost);

      const params = new URLSearchParams({
        response_type: 'code',
        client_id: oauthConfig.clientId,
        redirect_uri: redirectUri,
        state,
        ...(oauthConfig.scope && { scope: oauthConfig.scope }),
      });

      const fullUrl = `${authorizeUrl}?${params.toString()}`;

      this.logger.log(
        `Generated OAuth URL for ${toolKey}: ${authorizeUrl}?client_id=${oauthConfig.clientId}&...`,
      );

      return { url: fullUrl, state, toolKey };
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
  ): Promise<{ credentialId: string; toolKey: string; toolId: string; orgId: string }> {
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

      const stateData: OAuthState = JSON.parse(
        typeof stateDataStr === 'string' ? stateDataStr : JSON.stringify(stateDataStr),
      );
      const { orgId, userId, toolId } = stateData;

      // Validate state timestamp (additional security)
      const stateAge = Date.now() - stateData.timestamp;
      if (stateAge > 300000) {
        // 5 minutes
        throw new UnauthorizedException('OAuth state has expired');
      }

      // Validate tool access and get tool details
      const tool = await this.validateToolAccess(toolId, orgId);
      const toolKey = tool.name;

      this.logger.log(`Validated state for tool ${toolKey} (${toolId}), org ${orgId}, user ${userId}`);

      // Load OAuth configuration for token exchange
      const orgConfig = await this.authConfig.getOrgAuthConfig(orgId, toolId);
      const oauthConfig = this.validateOAuthConfig(orgConfig.config, toolKey);

      // Use the same redirect URI resolution logic as in authorization
      // Note: We don't have requestHost in callback, so we use the same selection logic
      const redirectUri = this.selectRedirectUri(oauthConfig);

      // Exchange authorization code for tokens
      const tokenResponse = await this.exchangeCodeForTokens(code, oauthConfig, toolKey, redirectUri);

      // Calculate expiration time
      const expiresAt = tokenResponse.expires_in
        ? new Date(Date.now() + tokenResponse.expires_in * 1000)
        : new Date(Date.now() + 3600000); // Default 1 hour

      // Store user credentials using the toolId from state
      const credential = await this.authConfig.setUserCredentials(
        orgId,
        userId,
        toolId, // Use toolId from the validated state
        tokenResponse.access_token,
        tokenResponse.refresh_token || '',
        expiresAt,
      );

      // Note: Credentials are stored in database, AWS Secrets Manager sync handled by AuthConfigService
      this.logger.debug(`Credentials stored for ${toolKey} user ${userId}`);

      this.logger.log(`Successfully completed OAuth flow for ${toolKey} user ${userId}`);

      return {
        credentialId: credential.id,
        toolKey,
        toolId,
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
    redirectUri: string,
  ): Promise<OAuthTokenResponse> {
    try {
      const tokenUrl = config.tokenUrl || this.getDefaultTokenUrl(toolKey);

      const requestData = {
        grant_type: 'authorization_code',
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code,
        redirect_uri: redirectUri,
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
      }

      this.logger.error(`Token exchange error for ${toolKey}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Validate OAuth configuration has required fields
   */
  private validateOAuthConfig(config: Record<string, unknown>, toolKey: string): OAuthConfig {
    if (!config.clientId) {
      throw new BadRequestException(`Missing clientId for OAuth2 configuration of ${toolKey}`);
    }

    if (!config.clientSecret) {
      throw new BadRequestException(`Missing clientSecret for OAuth2 configuration of ${toolKey}`);
    }

    // Validate redirectUris array if provided
    if (config.redirectUris && !Array.isArray(config.redirectUris)) {
      throw new BadRequestException(`redirectUris must be an array for ${toolKey}`);
    }

    // Validate allowedDomains array if provided
    if (config.allowedDomains && !Array.isArray(config.allowedDomains)) {
      throw new BadRequestException(`allowedDomains must be an array for ${toolKey}`);
    }

    return {
      clientId: config.clientId as string,
      clientSecret: config.clientSecret as string,
      redirectUri: config.redirectUri as string | undefined,
      redirectUris: config.redirectUris as string[] | undefined,
      allowedDomains: config.allowedDomains as string[] | undefined,
      scope: config.scope as string | undefined,
      authorizeUrl: config.authorizeUrl as string | undefined,
      tokenUrl: config.tokenUrl as string | undefined,
    };
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
