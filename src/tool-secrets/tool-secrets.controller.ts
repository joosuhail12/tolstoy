import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Body,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
  ApiQuery,
  ApiSecurity,
} from '@nestjs/swagger';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';
import { ToolSecretsService, StoredCredentials, ToolCredentials } from './tool-secrets.service';
import { StoreCredentialsDto, CredentialResponseDto } from './dto/store-credentials.dto';
import { Tenant } from '../common/decorators/tenant.decorator';

@ApiTags('Tool Secrets')
@ApiSecurity('x-org-id')
@Controller('tools/:toolId/secrets')
export class ToolSecretsController {
  constructor(
    private readonly toolSecretsService: ToolSecretsService,
    @InjectPinoLogger(ToolSecretsController.name)
    private readonly logger: PinoLogger,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Store Tool Credentials',
    description: 'Securely store encrypted credentials for an external tool. These credentials will be used when the tool is executed in workflows.',
  })
  @ApiParam({
    name: 'toolId',
    description: 'Tool ID to store credentials for',
    example: 'tool_slack_123',
  })
  @ApiBody({
    description: 'Tool credentials to store securely',
    schema: {
      type: 'object',
      properties: {
        credentials: {
          type: 'object',
          description: 'Key-value pairs of credentials (will be encrypted)',
          example: {
            apiKey: 'your-api-key-here',
            webhookUrl: 'https://hooks.slack.com/services/YOUR/WEBHOOK/URL',
            botToken: 'your-bot-token-here',
          },
        },
      },
      required: ['credentials'],
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Credentials stored successfully',
    schema: {
      type: 'object',
      properties: {
        toolId: { type: 'string', example: 'tool_slack_123' },
        toolName: { type: 'string', example: 'Slack Integration' },
        maskedCredentials: {
          type: 'object',
          example: {
            apiKey: 'your-***...***key',
            webhookUrl: 'https://***...***XX',
            botToken: 'your-***...***token',
          },
        },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid credentials data',
  })
  @ApiResponse({
    status: 404,
    description: 'Tool not found',
  })
  async storeCredentials(
    @Param('toolId') toolId: string,
    @Body() storeCredentialsDto: StoreCredentialsDto,
    @Tenant('orgId') orgId: string,
  ): Promise<CredentialResponseDto> {
    this.logger.info(
      { toolId, orgId, credentialKeys: Object.keys(storeCredentialsDto.credentials) },
      'Storing tool credentials',
    );

    const result = await this.toolSecretsService.storeCredentials(
      orgId,
      toolId,
      storeCredentialsDto.credentials as ToolCredentials,
    );

    this.logger.info(
      { toolId, orgId, toolName: result.toolName },
      'Tool credentials stored successfully',
    );

    return {
      toolId: result.toolId,
      toolName: result.toolName,
      maskedCredentials: result.maskedCredentials,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
    };
  }

  @Get()
  @ApiOperation({
    summary: 'Get Tool Credentials',
    description: 'Retrieve stored credentials for a tool. By default returns masked values for security. Use unmask=true to get actual values (use carefully).',
  })
  @ApiParam({
    name: 'toolId',
    description: 'Tool ID to retrieve credentials for',
    example: 'tool_slack_123',
  })
  @ApiQuery({
    name: 'unmask',
    description: 'Whether to return unmasked credential values (use with extreme caution)',
    required: false,
    example: 'false',
    enum: ['true', 'false'],
  })
  @ApiResponse({
    status: 200,
    description: 'Credentials retrieved successfully (masked by default)',
    schema: {
      oneOf: [
        {
          title: 'Masked Credentials Response',
          type: 'object',
          properties: {
            toolId: { type: 'string', example: 'tool_slack_123' },
            toolName: { type: 'string', example: 'Slack Integration' },
            maskedCredentials: {
              type: 'object',
              example: {
                apiKey: 'your-***...***key',
                webhookUrl: 'https://***...***XX',
                botToken: 'your-***...***token',
              },
            },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        {
          title: 'Unmasked Credentials Response (unmask=true)',
          type: 'object',
          properties: {
            toolId: { type: 'string', example: 'tool_slack_123' },
            toolName: { type: 'string', example: 'Slack Integration' },
            credentials: {
              type: 'object',
              example: {
                apiKey: 'your-api-key-here',
                webhookUrl: 'https://hooks.slack.com/services/YOUR/WEBHOOK/URL',
                botToken: 'your-bot-token-here',
              },
            },
            maskedCredentials: {
              type: 'object',
              example: {
                apiKey: 'your-***...***key',
                webhookUrl: 'https://***...***XX',
                botToken: 'your-***...***token',
              },
            },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
      ],
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Tool credentials not found',
  })
  async getCredentials(
    @Param('toolId') toolId: string,
    @Tenant('orgId') orgId: string,
    @Query('unmask') unmask?: string,
  ): Promise<CredentialResponseDto | StoredCredentials> {
    const shouldUnmask = unmask === 'true';
    this.logger.debug({ toolId, orgId, shouldUnmask }, 'Retrieving tool credentials');

    const result = await this.toolSecretsService.getCredentials(
      orgId,
      toolId,
      !shouldUnmask, // maskValues = !shouldUnmask
    );

    this.logger.debug(
      { toolId, orgId, toolName: result.toolName, masked: !shouldUnmask },
      'Tool credentials retrieved',
    );

    if (shouldUnmask) {
      // Return full credentials (be careful with this in production)
      return result;
    }

    return {
      toolId: result.toolId,
      toolName: result.toolName,
      maskedCredentials: result.maskedCredentials,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
    };
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete Tool Credentials',
    description: 'Permanently delete stored credentials for a tool. This will affect any workflows that use this tool.',
  })
  @ApiParam({
    name: 'toolId',
    description: 'Tool ID to delete credentials for',
    example: 'tool_slack_123',
  })
  @ApiResponse({
    status: 204,
    description: 'Credentials deleted successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Tool credentials not found',
  })
  @ApiResponse({
    status: 409,
    description: 'Cannot delete credentials that are being used by active workflows',
  })
  async deleteCredentials(
    @Param('toolId') toolId: string,
    @Tenant('orgId') orgId: string,
  ): Promise<void> {
    this.logger.warn({ toolId, orgId }, 'Deleting tool credentials');

    await this.toolSecretsService.deleteCredentials(orgId, toolId);

    this.logger.info({ toolId, orgId }, 'Tool credentials deleted successfully');
  }
}

@ApiTags('Tool Secrets List')
@ApiSecurity('x-org-id')
@Controller('tools/secrets')
export class ToolSecretsListController {
  constructor(
    private readonly toolSecretsService: ToolSecretsService,
    @InjectPinoLogger(ToolSecretsListController.name)
    private readonly logger: PinoLogger,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'List Tools with Credentials',
    description: 'Get all tools in the organization with their credential status. Shows which tools have credentials stored and which ones need setup.',
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved tools with credential status',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          toolId: { type: 'string', example: 'tool_slack_123' },
          toolName: { type: 'string', example: 'Slack Integration' },
          toolType: { type: 'string', example: 'notification' },
          hasCredentials: {
            type: 'boolean',
            example: true,
            description: 'Whether credentials are stored for this tool',
          },
          credentialKeys: {
            type: 'array',
            items: { type: 'string' },
            example: ['apiKey', 'webhookUrl', 'botToken'],
            description: 'List of credential keys (if credentials exist)',
          },
          lastUpdated: {
            type: 'string',
            format: 'date-time',
            description: 'When credentials were last updated (if they exist)',
          },
        },
      },
    },
  })
  async listToolsWithCredentials(@Tenant('orgId') orgId: string) {
    this.logger.debug({ orgId }, 'Listing tools with credential status');

    const tools = await this.toolSecretsService.listToolsWithCredentials(orgId);

    this.logger.debug(
      {
        orgId,
        toolCount: tools.length,
        toolsWithCredentials: tools.filter(t => t.hasCredentials).length,
      },
      'Tools with credential status retrieved',
    );

    return tools;
  }
}
