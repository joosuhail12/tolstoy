import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Put,
  Delete,
  ValidationPipe,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
  ApiSecurity,
} from '@nestjs/swagger';
import { ActionsService } from './actions.service';
import { CreateActionDto } from './dto/create-action.dto';
import { UpdateActionDto } from './dto/update-action.dto';
import { Tenant } from '../common/decorators/tenant.decorator';
import { TenantContext } from '../common/interfaces/tenant-context.interface';

@ApiTags('Actions')
@ApiSecurity('x-org-id')
@ApiSecurity('x-user-id')
@Controller('actions')
export class ActionsController {
  constructor(private readonly actionsService: ActionsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create Action',
    description: 'Create a reusable action template for workflows. Actions define API calls that can be executed within workflow steps.',
  })
  @ApiBody({
    description: 'Action template configuration',
    schema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Human-readable action name',
          example: 'Send Slack Message',
        },
        key: {
          type: 'string',
          description: 'Unique identifier for the action',
          example: 'slack_send_message',
        },
        toolId: {
          type: 'string',
          description: 'ID of the associated tool',
          example: 'tool_slack_123',
        },
        method: {
          type: 'string',
          description: 'HTTP method for the action',
          enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
          example: 'POST',
        },
        endpoint: {
          type: 'string',
          description: 'API endpoint URL or path',
          example: '/api/chat.postMessage',
        },
        headers: {
          type: 'object',
          description: 'HTTP headers required for the action',
          example: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer {token}',
          },
        },
        inputSchema: {
          type: 'array',
          description: 'Schema defining input parameters for the action',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string', example: 'channel' },
              type: { type: 'string', example: 'string' },
              required: { type: 'boolean', example: true },
              description: { type: 'string', example: 'Slack channel ID' },
            },
          },
          example: [
            {
              name: 'channel',
              type: 'string',
              required: true,
              description: 'Slack channel ID',
            },
            {
              name: 'text',
              type: 'string',
              required: true,
              description: 'Message content',
            },
          ],
        },
        executeIf: {
          type: 'object',
          description: 'Conditional execution rules (optional)',
          example: { 'user.role': 'admin' },
        },
        version: {
          type: 'number',
          description: 'Action version number',
          example: 1,
        },
      },
      required: ['name', 'key', 'toolId', 'method', 'endpoint', 'headers', 'inputSchema'],
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Action created successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', example: 'action_abc123' },
        name: { type: 'string', example: 'Send Slack Message' },
        key: { type: 'string', example: 'slack_send_message' },
        toolId: { type: 'string', example: 'tool_slack_123' },
        method: { type: 'string', example: 'POST' },
        endpoint: { type: 'string', example: '/api/chat.postMessage' },
        headers: { type: 'object', example: { 'Content-Type': 'application/json' } },
        inputSchema: { type: 'array', example: [] },
        executeIf: { type: 'object', example: {} },
        version: { type: 'number', example: 1 },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid action configuration',
  })
  create(@Body(ValidationPipe) createActionDto: CreateActionDto, @Tenant() tenant: TenantContext) {
    return this.actionsService.create(createActionDto, tenant);
  }

  @Get()
  @ApiOperation({
    summary: 'List Actions',
    description: 'Get all reusable action templates for the organization',
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved actions',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'action_abc123' },
          name: { type: 'string', example: 'Send Slack Message' },
          key: { type: 'string', example: 'slack_send_message' },
          toolId: { type: 'string', example: 'tool_slack_123' },
          method: { type: 'string', example: 'POST' },
          endpoint: { type: 'string', example: '/api/chat.postMessage' },
          headers: { type: 'object', example: { 'Content-Type': 'application/json' } },
          inputSchema: {
            type: 'array',
            example: [
              {
                name: 'channel',
                type: 'string',
                required: true,
                description: 'Slack channel ID',
              },
            ],
          },
          executeIf: { type: 'object', example: {} },
          version: { type: 'number', example: 1 },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
    },
  })
  findAll(@Tenant() tenant: TenantContext) {
    return this.actionsService.findAll(tenant);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get Action',
    description: 'Get a specific action template by ID',
  })
  @ApiParam({
    name: 'id',
    description: 'Action ID',
    example: 'action_abc123',
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved action',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', example: 'action_abc123' },
        name: { type: 'string', example: 'Send Slack Message' },
        key: { type: 'string', example: 'slack_send_message' },
        toolId: { type: 'string', example: 'tool_slack_123' },
        method: { type: 'string', example: 'POST' },
        endpoint: { type: 'string', example: '/api/chat.postMessage' },
        headers: { type: 'object', example: { 'Content-Type': 'application/json', 'Authorization': 'Bearer {token}' } },
        inputSchema: {
          type: 'array',
          example: [
            {
              name: 'channel',
              type: 'string',
              required: true,
              description: 'Slack channel ID',
            },
            {
              name: 'text',
              type: 'string',
              required: true,
              description: 'Message content',
            },
          ],
        },
        executeIf: { type: 'object', example: { 'user.role': 'admin' } },
        version: { type: 'number', example: 1 },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Action not found',
  })
  findOne(@Param('id') id: string, @Tenant() tenant: TenantContext) {
    return this.actionsService.findOne(id, tenant);
  }

  @Put(':id')
  @ApiOperation({
    summary: 'Update Action',
    description: 'Update an action template configuration',
  })
  @ApiParam({
    name: 'id',
    description: 'Action ID',
    example: 'action_abc123',
  })
  @ApiBody({
    description: 'Updated action configuration',
    schema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Human-readable action name',
          example: 'Send Enhanced Slack Message',
        },
        key: {
          type: 'string',
          description: 'Unique identifier for the action',
          example: 'slack_send_enhanced_message',
        },
        toolId: {
          type: 'string',
          description: 'ID of the associated tool',
          example: 'tool_slack_123',
        },
        method: {
          type: 'string',
          description: 'HTTP method for the action',
          enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
          example: 'POST',
        },
        endpoint: {
          type: 'string',
          description: 'API endpoint URL or path',
          example: '/api/chat.postMessage',
        },
        headers: {
          type: 'object',
          description: 'HTTP headers required for the action',
          example: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer {token}',
          },
        },
        inputSchema: {
          type: 'array',
          description: 'Schema defining input parameters for the action',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              type: { type: 'string' },
              required: { type: 'boolean' },
              description: { type: 'string' },
            },
          },
          example: [
            {
              name: 'channel',
              type: 'string',
              required: true,
              description: 'Slack channel ID',
            },
            {
              name: 'text',
              type: 'string',
              required: true,
              description: 'Message content',
            },
            {
              name: 'attachments',
              type: 'array',
              required: false,
              description: 'Message attachments',
            },
          ],
        },
        executeIf: {
          type: 'object',
          description: 'Conditional execution rules (optional)',
          example: { 'user.role': 'admin' },
        },
        version: {
          type: 'number',
          description: 'Action version number',
          example: 2,
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Action updated successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Action not found',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid action configuration',
  })
  update(
    @Param('id') id: string,
    @Body(ValidationPipe) updateActionDto: UpdateActionDto,
    @Tenant() tenant: TenantContext,
  ) {
    return this.actionsService.update(id, updateActionDto, tenant);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete Action',
    description: 'Delete an action template permanently. This will affect any workflows that use this action.',
  })
  @ApiParam({
    name: 'id',
    description: 'Action ID',
    example: 'action_abc123',
  })
  @ApiResponse({
    status: 204,
    description: 'Action deleted successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Action not found',
  })
  @ApiResponse({
    status: 409,
    description: 'Action is being used by active workflows and cannot be deleted',
  })
  remove(@Param('id') id: string, @Tenant() tenant: TenantContext) {
    return this.actionsService.remove(id, tenant);
  }
}
