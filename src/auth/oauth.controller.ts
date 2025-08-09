import {
  BadRequestException,
  Controller,
  Get,
  Headers,
  HttpStatus,
  Logger,
  Param,
  Query,
  Req,
  Res,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Request, Response } from 'express';
import { OAuthService } from './oauth.service';
import { MetricsService } from '../metrics/metrics.service';
import {
  OAuthCallbackQueryDto,
  OAuthLoginQueryDto,
  OAuthToolParamDto,
} from './dto/oauth-request.dto';
import { OAuthCallbackResponseDto, OAuthErrorResponseDto } from './dto/oauth-response.dto';

@ApiTags('OAuth Authentication')
@Controller('auth')
export class OAuthController {
  private readonly logger = new Logger(OAuthController.name);

  constructor(
    private readonly oauthService: OAuthService,
    private readonly metricsService: MetricsService,
  ) {}

  @Get(':toolId/login')
  @ApiOperation({
    summary: 'Initiate OAuth2 login for a user',
    description:
      'Redirects the user to the OAuth provider authorization page. The user must grant permission, after which they will be redirected back to the callback endpoint.',
  })
  @ApiParam({
    name: 'toolId',
    description: 'Tool unique identifier (database ID)',
    example: 'cme3zjbwc0000uppplgvx1hse',
  })
  @ApiQuery({
    name: 'userId',
    description: 'User ID for whom to initiate OAuth',
    required: true,
    example: 'user_123',
  })
  @ApiHeader({
    name: 'X-Org-ID',
    description: 'Organization identifier',
    required: true,
    example: 'org_456',
  })
  @ApiResponse({
    status: 302,
    description: 'Redirects to OAuth provider authorization URL',
  })
  @ApiBadRequestResponse({
    description: 'Invalid request parameters or tool not configured for OAuth',
    type: OAuthErrorResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid organization ID',
    type: OAuthErrorResponseDto,
  })
  @ApiBearerAuth()
  @UsePipes(new ValidationPipe({ transform: true }))
  async initiateLogin(
    @Param() params: OAuthToolParamDto,
    @Query() query: OAuthLoginQueryDto,
    @Headers('X-Org-ID') orgId: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    try {
      if (!orgId) {
        throw new BadRequestException('X-Org-ID header is required');
      }

      const { toolId } = params;
      const { userId } = query;

      this.logger.log(`Initiating OAuth login for tool ${toolId}, org ${orgId}, user ${userId}`);

      // Record metrics (we'll need toolKey for metrics, so we'll get it from the service response)
      // For now, we'll use toolId for logging and update metrics after getting tool details

      // Extract request host for multi-environment callback support
      const requestHost = req.get('host') || req.hostname;

      // Generate authorization URL with request context
      const { url, toolKey } = await this.oauthService.getAuthorizeUrl(toolId, orgId, userId, requestHost);

      // Record metrics using toolKey
      this.metricsService.incrementOAuthRedirect({ orgId, toolKey });

      this.logger.log(`Redirecting to OAuth provider for tool ${toolKey} (${toolId})`);

      // Redirect to OAuth provider
      res.redirect(HttpStatus.FOUND, url);
    } catch (error) {
      this.logger.error(`OAuth login initiation failed: ${error.message}`, error.stack);

      // Note: Error metrics for redirects are not tracked in the new schema
      // as we only track successful redirects

      if (error instanceof BadRequestException) {
        res.status(HttpStatus.BAD_REQUEST).json({
          success: false,
          message: error.message,
          code: 'BAD_REQUEST',
        });
      } else {
        res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
          success: false,
          message: 'Failed to initiate OAuth login',
          code: 'INTERNAL_ERROR',
        });
      }
    }
  }

  @Get('callback')
  @ApiOperation({
    summary: 'Handle OAuth2 callback from provider',
    description:
      'Processes the authorization code returned by the OAuth provider, exchanges it for access tokens, and stores the user credentials.',
  })
  @ApiQuery({
    name: 'code',
    description: 'Authorization code from OAuth provider',
    required: true,
    example: 'abc123def456',
  })
  @ApiQuery({
    name: 'state',
    description: 'State parameter to validate request origin',
    required: true,
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @ApiQuery({
    name: 'error',
    description: 'Error code if authorization was denied',
    required: false,
    example: 'access_denied',
  })
  @ApiQuery({
    name: 'error_description',
    description: 'Human-readable error description',
    required: false,
    example: 'The user denied the request',
  })
  @ApiResponse({
    status: 200,
    description: 'OAuth callback processed successfully',
    type: OAuthCallbackResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid callback parameters or authorization error',
    type: OAuthErrorResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Invalid or expired state parameter',
    type: OAuthErrorResponseDto,
  })
  @UsePipes(new ValidationPipe({ transform: true }))
  async handleCallback(
    @Query() query: OAuthCallbackQueryDto,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {

    try {
      // Security logging - capture key request details for monitoring
      const requestHost = req.get('host');
      const userAgent = req.get('user-agent');
      const referer = req.get('referer');
      const clientIp = req.ip || req.connection.remoteAddress;

      this.logger.log(
        `Processing OAuth callback from ${clientIp} (${requestHost})`,
        {
          requestHost,
          userAgent,
          referer,
          clientIp,
        },
      );

      // Check if OAuth provider returned an error
      if (query.error) {
        this.logger.warn(
          `OAuth provider returned error: ${query.error} - ${query.error_description}`,
        );

        // Note: We don't have orgId here for error cases, so we'll record error metrics
        // without orgId or skip error metrics for simplicity

        const response: OAuthErrorResponseDto = {
          success: false,
          message: query.error_description || `OAuth authorization failed: ${query.error}`,
          code: query.error.toUpperCase(),
        };

        // Return HTML page for user-friendly error display
        const errorHtml = this.generateErrorPage(response.message, 'oauth');
        res.status(HttpStatus.BAD_REQUEST).send(errorHtml);
        return;
      }

      if (!query.code) {
        throw new BadRequestException('Missing authorization code');
      }

      if (!query.state) {
        throw new BadRequestException('Missing state parameter');
      }

      // Process the callback
      const result = await this.oauthService.handleCallback(query.code, query.state);

      this.logger.log(`Successfully completed OAuth callback for ${result.toolKey} (${result.toolId})`);

      // Basic security check now that we have toolKey
      if (referer && !this.isValidReferer(referer, result.toolKey)) {
        this.logger.warn(`Suspicious referer in OAuth callback: ${referer} for ${result.toolKey}`);
      }

      // Record success metrics
      this.metricsService.incrementOAuthCallback({
        orgId: result.orgId,
        toolKey: result.toolKey,
        success: 'true',
      });

      // Return user-friendly success page
      const successHtml = this.generateSuccessPage(result.toolKey);
      res.status(HttpStatus.OK).send(successHtml);
    } catch (error) {
      this.logger.error(`OAuth callback failed: ${error.message}`, error.stack);

      // Record failure metrics (without specific tool info since we couldn't parse the state)
      this.metricsService.incrementOAuthCallback({
        orgId: 'unknown',
        toolKey: 'unknown',
        success: 'false',
      });

      const errorResponse: OAuthErrorResponseDto = {
        success: false,
        message: error.message || 'Failed to process OAuth callback',
        code: 'CALLBACK_ERROR',
      };

      // Return HTML error page
      const errorHtml = this.generateErrorPage(errorResponse.message, 'oauth');
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).send(errorHtml);
    }
  }

  /**
   * Generate user-friendly success page
   */
  private generateSuccessPage(toolKey: string): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>OAuth Authorization Successful</title>
    <style>
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            display: flex; justify-content: center; align-items: center; min-height: 100vh;
            margin: 0; background-color: #f5f5f5;
        }
        .container {
            background: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            text-align: center; max-width: 400px;
        }
        .success-icon { color: #22c55e; font-size: 48px; margin-bottom: 20px; }
        h1 { color: #1f2937; margin-bottom: 16px; font-size: 24px; }
        p { color: #6b7280; line-height: 1.5; margin-bottom: 20px; }
        .tool-name { font-weight: 600; color: #059669; text-transform: capitalize; }
        .close-button {
            background: #3b82f6; color: white; border: none; padding: 12px 24px;
            border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 500;
        }
        .close-button:hover { background: #2563eb; }
    </style>
</head>
<body>
    <div class="container">
        <div class="success-icon">✓</div>
        <h1>Authorization Successful!</h1>
        <p>You have successfully authorized Tolstoy to access your <span class="tool-name">${toolKey}</span> account.</p>
        <p>You can now close this window and return to the application.</p>
        <button class="close-button" onclick="window.close()">Close Window</button>
    </div>
    <script>
        // Auto-close after 5 seconds if window was opened as popup
        if (window.opener) {
            setTimeout(() => window.close(), 5000);
        }
    </script>
</body>
</html>
    `;
  }

  /**
   * Generate user-friendly error page
   */
  private generateErrorPage(message: string, toolKey: string): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>OAuth Authorization Failed</title>
    <style>
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            display: flex; justify-content: center; align-items: center; min-height: 100vh;
            margin: 0; background-color: #f5f5f5;
        }
        .container {
            background: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            text-align: center; max-width: 400px;
        }
        .error-icon { color: #ef4444; font-size: 48px; margin-bottom: 20px; }
        h1 { color: #1f2937; margin-bottom: 16px; font-size: 24px; }
        p { color: #6b7280; line-height: 1.5; margin-bottom: 20px; }
        .tool-name { font-weight: 600; color: #dc2626; text-transform: capitalize; }
        .error-message { 
            background: #fef2f2; border: 1px solid #fecaca; padding: 12px; 
            border-radius: 6px; color: #dc2626; font-size: 14px; margin-bottom: 20px;
        }
        .close-button {
            background: #6b7280; color: white; border: none; padding: 12px 24px;
            border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 500;
        }
        .close-button:hover { background: #4b5563; }
    </style>
</head>
<body>
    <div class="container">
        <div class="error-icon">⚠</div>
        <h1>Authorization Failed</h1>
        <p>There was a problem authorizing Tolstoy to access your <span class="tool-name">${toolKey}</span> account.</p>
        <div class="error-message">${message}</div>
        <p>Please try again or contact support if the problem persists.</p>
        <button class="close-button" onclick="window.close()">Close Window</button>
    </div>
    <script>
        // Auto-close after 10 seconds if window was opened as popup
        if (window.opener) {
            setTimeout(() => window.close(), 10000);
        }
    </script>
</body>
</html>
    `;
  }

  /**
   * Validate referer to ensure callback is coming from expected OAuth providers
   */
  private isValidReferer(referer: string, toolKey: string): boolean {
    try {
      const refererUrl = new URL(referer);
      
      // List of trusted OAuth provider domains
      const trustedDomains: Record<string, string[]> = {
        github: ['github.com'],
        google: ['accounts.google.com', 'oauth2.googleapis.com'],
        microsoft: ['login.microsoftonline.com', 'login.live.com'],
        slack: ['slack.com'],
        discord: ['discord.com'],
        linkedin: ['linkedin.com', 'www.linkedin.com'],
        facebook: ['facebook.com', 'www.facebook.com'],
      };

      const allowedDomains = trustedDomains[toolKey.toLowerCase()] || [];
      
      // Check if referer domain is in the allowed list
      return allowedDomains.some(domain => 
        refererUrl.hostname === domain || 
        refererUrl.hostname.endsWith(`.${domain}`)
      );
    } catch {
      // Invalid URL format
      return false;
    }
  }
}
