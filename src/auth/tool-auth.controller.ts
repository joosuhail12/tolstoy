import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Headers,
  HttpCode,
  HttpStatus,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiHeader,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
} from '@nestjs/swagger';
import { AuthConfigService } from './auth-config.service';
import { CreateAuthConfigDto } from './dto/create-auth-config.dto';
import { AuthConfigResponseDto, DeleteAuthConfigResponseDto } from './dto/auth-config-response.dto';

@ApiTags('Tool Authentication')
@Controller('tools/:toolId/auth')
@ApiBearerAuth()
export class ToolAuthController {
  private readonly logger = new Logger(ToolAuthController.name);

  constructor(private readonly authConfig: AuthConfigService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Create or update organization-level auth configuration for a tool',
    description:
      'Configures authentication settings (API Key or OAuth2) for a specific tool within an organization. This endpoint supports both creating new configurations and updating existing ones.',
  })
  @ApiParam({
    name: 'toolId',
    description: 'Unique identifier of the tool to configure',
    example: 'tool-123',
  })
  @ApiHeader({
    name: 'X-Org-ID',
    description: 'Organization identifier',
    required: true,
    example: 'org-456',
  })
  @ApiResponse({
    status: 200,
    description: 'Auth configuration created or updated successfully',
    type: AuthConfigResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid request data or validation errors',
  })
  @ApiNotFoundResponse({
    description: 'Tool not found or organization does not have access',
  })
  async upsert(
    @Headers('X-Org-ID') orgId: string,
    @Param('toolId') toolId: string,
    @Body() dto: CreateAuthConfigDto,
  ): Promise<AuthConfigResponseDto> {
    if (!orgId) {
      throw new BadRequestException('X-Org-ID header is required');
    }

    this.logger.log(`Creating/updating auth config for tool ${toolId} in org ${orgId}`);

    const result = await this.authConfig.setOrgAuthConfig(orgId, toolId, dto.type, dto.config);

    this.logger.log(`Successfully upserted auth config ${result.id} for tool ${toolId}`);

    return result;
  }

  @Get()
  @ApiOperation({
    summary: 'Fetch current auth configuration for a tool',
    description:
      'Retrieves the authentication configuration for a specific tool within an organization. Sensitive values may be masked in the response.',
  })
  @ApiParam({
    name: 'toolId',
    description: 'Unique identifier of the tool',
    example: 'tool-123',
  })
  @ApiHeader({
    name: 'X-Org-ID',
    description: 'Organization identifier',
    required: true,
    example: 'org-456',
  })
  @ApiResponse({
    status: 200,
    description: 'Auth configuration retrieved successfully',
    type: AuthConfigResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Auth configuration not found for this tool and organization',
  })
  async get(@Headers('X-Org-ID') orgId: string, @Param('toolId') toolId: string): Promise<any> {
    if (!orgId) {
      throw new BadRequestException('X-Org-ID header is required');
    }

    this.logger.log(`Fetching auth config for tool ${toolId} in org ${orgId}`);

    // For the GET endpoint, we need to find by tool name/key since getOrgAuthConfig expects toolKey
    // We'll need to modify this to work with toolId - for now, treating toolId as toolKey
    const config = await this.authConfig.getOrgAuthConfig(orgId, toolId);

    this.logger.log(`Successfully retrieved auth config for tool ${toolId}`);

    // Mask sensitive values in the response
    return this.maskSensitiveValues(config);
  }

  @Delete()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete auth configuration for a tool',
    description:
      'Removes the authentication configuration for a specific tool within an organization. This action also cleans up associated secrets and cache entries.',
  })
  @ApiParam({
    name: 'toolId',
    description: 'Unique identifier of the tool',
    example: 'tool-123',
  })
  @ApiHeader({
    name: 'X-Org-ID',
    description: 'Organization identifier',
    required: true,
    example: 'org-456',
  })
  @ApiResponse({
    status: 200,
    description: 'Auth configuration deleted successfully',
    type: DeleteAuthConfigResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Auth configuration not found for this tool and organization',
  })
  async remove(
    @Headers('X-Org-ID') orgId: string,
    @Param('toolId') toolId: string,
  ): Promise<DeleteAuthConfigResponseDto> {
    if (!orgId) {
      throw new BadRequestException('X-Org-ID header is required');
    }

    this.logger.log(`Deleting auth config for tool ${toolId} in org ${orgId}`);

    await this.authConfig.deleteOrgAuthConfig(orgId, toolId);

    this.logger.log(`Successfully deleted auth config for tool ${toolId}`);

    return {
      success: true,
      message: 'Auth configuration deleted successfully',
    };
  }

  /**
   * Mask sensitive values in auth configuration for security
   */
  private maskSensitiveValues(config: any): any {
    if (!config || typeof config !== 'object') {
      return config;
    }

    const sensitiveFields = [
      'apiKey',
      'clientSecret',
      'privateKey',
      'token',
      'password',
      'secret',
      'key',
      'accessToken',
      'refreshToken',
    ];

    const masked = { ...config };

    for (const [key, value] of Object.entries(masked)) {
      if (
        typeof value === 'string' &&
        sensitiveFields.some(field => key.toLowerCase().includes(field.toLowerCase()))
      ) {
        // Mask all but last 4 characters
        masked[key] =
          value.length > 4
            ? '*'.repeat(value.length - 4) + value.slice(-4)
            : '*'.repeat(value.length);
      } else if (typeof value === 'object' && value !== null) {
        masked[key] = this.maskSensitiveValues(value);
      }
    }

    return masked;
  }
}
