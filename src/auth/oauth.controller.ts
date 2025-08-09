import {
  BadRequestException,
  Controller,
  Get,
  Headers,
  HttpStatus,
  Logger,
  Param,
  Query,
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
import { Response } from 'express';
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

  @Get(':toolKey/login')
  @ApiOperation({
    summary: 'Initiate OAuth2 login for a user',
    description:
      'Redirects the user to the OAuth provider authorization page. The user must grant permission, after which they will be redirected back to the callback endpoint.',
  })
  @ApiParam({
    name: 'toolKey',
    description: 'Tool identifier (e.g., "github", "google")',
    example: 'github',
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
    @Res() res: Response,
  ): Promise<void> {
    try {
      if (!orgId) {
        throw new BadRequestException('X-Org-ID header is required');
      }

      const { toolKey } = params;
      const { userId } = query;

      this.logger.log(`Initiating OAuth login for tool ${toolKey}, org ${orgId}, user ${userId}`);

      // Record metrics
      this.metricsService.incrementOAuthRedirect({ orgId, toolKey });

      // Generate authorization URL
      const { url } = await this.oauthService.getAuthorizeUrl(toolKey, orgId, userId);

      this.logger.log(`Redirecting to OAuth provider for ${toolKey}`);

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

  @Get(':toolKey/callback')
  @ApiOperation({
    summary: 'Handle OAuth2 callback from provider',
    description:
      'Processes the authorization code returned by the OAuth provider, exchanges it for access tokens, and stores the user credentials.',
  })
  @ApiParam({
    name: 'toolKey',
    description: 'Tool identifier that matches the login request',
    example: 'github',
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
    @Param() params: OAuthToolParamDto,
    @Query() query: OAuthCallbackQueryDto,
    @Res() res: Response,
  ): Promise<void> {
    const { toolKey } = params;

    try {
      this.logger.log(`Processing OAuth callback for tool ${toolKey}`);

      // Check if OAuth provider returned an error
      if (query.error) {
        this.logger.warn(
          `OAuth provider returned error for ${toolKey}: ${query.error} - ${query.error_description}`,
        );

        // Note: We don't have orgId here for error cases, so we'll record error metrics
        // without orgId or skip error metrics for simplicity

        const response: OAuthErrorResponseDto = {
          success: false,
          message: query.error_description || `OAuth authorization failed: ${query.error}`,
          code: query.error.toUpperCase(),
        };

        // Return HTML page for user-friendly error display
        const errorHtml = this.generateErrorPage(response.message, toolKey);
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

      this.logger.log(`Successfully completed OAuth callback for ${toolKey}`);

      // Record success metrics
      this.metricsService.incrementOAuthCallback({
        orgId: result.orgId,
        toolKey: result.toolKey,
        success: 'true',
      });

      // Return user-friendly success page
      const successHtml = this.generateSuccessPage(toolKey);
      res.status(HttpStatus.OK).send(successHtml);
    } catch (error) {
      this.logger.error(`OAuth callback failed for ${toolKey}: ${error.message}`, error.stack);

      // Record failure metrics (without orgId since we couldn't parse the state)
      // For now, we'll use 'unknown' as orgId for error cases
      this.metricsService.incrementOAuthCallback({
        orgId: 'unknown',
        toolKey,
        success: 'false',
      });

      const errorResponse: OAuthErrorResponseDto = {
        success: false,
        message: error.message || 'Failed to process OAuth callback',
        code: 'CALLBACK_ERROR',
      };

      // Return HTML error page
      const errorHtml = this.generateErrorPage(errorResponse.message, toolKey);
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
}
