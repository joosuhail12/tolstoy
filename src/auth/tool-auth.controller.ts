import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  NotFoundException,
  Param,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthConfigService } from './auth-config.service';
import { CreateAuthConfigDto } from './dto/create-auth-config.dto';
import { AuthConfigResponseDto, DeleteAuthConfigResponseDto } from './dto/auth-config-response.dto';
import { MetricsService } from '../metrics/metrics.service';
import { PrismaService } from '../prisma.service';

@ApiTags('Tool Authentication')
@Controller('tools/:toolId/auth')
@ApiBearerAuth()
export class ToolAuthController {
  private readonly logger = new Logger(ToolAuthController.name);

  constructor(
    private readonly authConfig: AuthConfigService,
    private readonly metricsService: MetricsService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Validate tool access - ensure toolId exists and belongs to orgId
   */
  private async validateToolAccess(
    toolId: string,
    orgId: string,
  ): Promise<{ id: string; name: string; orgId: string }> {
    try {
      const tool = await this.prisma.tool.findUnique({
        where: { id: toolId },
        select: { id: true, name: true, orgId: true },
      });

      if (!tool) {
        throw new NotFoundException(`Tool with ID ${toolId} not found`);
      }

      if (tool.orgId !== orgId) {
        this.logger.warn(
          `Unauthorized access attempt: tool ${toolId} does not belong to org ${orgId}`,
        );
        throw new UnauthorizedException(`Tool ${toolId} does not belong to organization ${orgId}`);
      }

      this.logger.debug(`Validated tool access: ${tool.name} (${toolId}) for org ${orgId}`);
      return tool;
    } catch (error) {
      this.logger.error(`Tool validation failed for ${toolId} in org ${orgId}: ${error.message}`);
      throw error;
    }
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Create or update organization-level auth configuration for a tool',
    description:
      'Configures authentication settings (API Key or OAuth2) for a specific tool within an organization. API Key auth requires headerName and headerValue. OAuth2 auth requires clientId, clientSecret, and accessToken. A default callback URL is automatically added for OAuth2 configurations.',
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

    // Validate tool ownership first
    const tool = await this.validateToolAccess(toolId, orgId);

    this.logger.log(`Creating/updating auth config for tool ${toolId} in org ${orgId}`);

    // Record metrics using tool name
    this.metricsService.incrementToolAuthConfig({
      orgId,
      toolKey: tool.name,
      action: 'upsert',
    });

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
  async get(
    @Headers('X-Org-ID') orgId: string,
    @Param('toolId') toolId: string,
  ): Promise<AuthConfigResponseDto> {
    if (!orgId) {
      throw new BadRequestException('X-Org-ID header is required');
    }

    // Validate tool ownership first
    const tool = await this.validateToolAccess(toolId, orgId);

    this.logger.log(`Fetching auth config for tool ${toolId} in org ${orgId}`);

    // Record metrics using tool name
    this.metricsService.incrementToolAuthConfig({
      orgId,
      toolKey: tool.name,
      action: 'get',
    });

    // Get auth config using toolId
    const config = await this.authConfig.getOrgAuthConfig(orgId, toolId);

    this.logger.log(`Successfully retrieved auth config for tool ${toolId}`);

    // Mask sensitive values in the response
    const maskedConfig = this.maskSensitiveValues(config.config);

    return {
      id: config.id,
      orgId: config.orgId,
      toolId: config.toolId,
      type: config.type,
      config: maskedConfig,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    };
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

    // Validate tool ownership first
    const tool = await this.validateToolAccess(toolId, orgId);

    this.logger.log(`Deleting auth config for tool ${toolId} in org ${orgId}`);

    // Record metrics using tool name
    this.metricsService.incrementToolAuthConfig({
      orgId,
      toolKey: tool.name,
      action: 'delete',
    });

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
  private maskSensitiveValues(config: Record<string, unknown>): Record<string, unknown> {
    if (!config || typeof config !== 'object') {
      return {};
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

    const masked = { ...config } as Record<string, unknown>;

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
        masked[key] = this.maskSensitiveValues(value as Record<string, unknown>);
      }
    }

    return masked;
  }
}
