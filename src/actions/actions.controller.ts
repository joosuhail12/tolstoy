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
  Headers,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
  ApiSecurity,
  ApiBearerAuth,
  ApiHeader,
} from '@nestjs/swagger';
import { ActionsService } from './actions.service';
import { CreateActionDto } from './dto/create-action.dto';
import { UpdateActionDto } from './dto/update-action.dto';
import { ExecuteActionDto } from './dto/execute-action.dto';
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
    description:
      'Create a reusable action template for workflows. Actions define API calls that can be executed within workflow steps.',
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
            Authorization: 'Bearer {token}',
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
        headers: {
          type: 'object',
          example: { 'Content-Type': 'application/json', Authorization: 'Bearer {token}' },
        },
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
            Authorization: 'Bearer {token}',
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
    description:
      'Delete an action template permanently. This will affect any workflows that use this action.',
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

  @Post(':key/execute')
  @ApiBearerAuth()
  @ApiOperation({ 
    summary: 'Execute a single Action by key',
    description: 'Execute a standalone action with provided inputs. This endpoint allows you to run individual actions outside of workflow contexts.'
  })
  @ApiParam({
    name: 'key',
    description: 'Unique action key identifier',
    example: 'slack_send_message'
  })
  @ApiHeader({
    name: 'X-Org-ID',
    description: 'Organization ID',
    required: true,
    example: 'org_123456'
  })
  @ApiHeader({
    name: 'X-User-ID',
    description: 'User ID for user-scoped authentication (optional)',
    required: false,
    example: 'user_789'
  })
  @ApiBody({
    description: 'Action execution inputs',
    type: ExecuteActionDto,
    schema: {
      type: 'object',
      properties: {
        inputs: {
          type: 'object',
          description: 'Input parameters matching the action\'s inputSchema',
          example: {
            channel: '#general',
            text: 'Hello from Tolstoy!',
            user_id: 'U123456'
          }
        }
      },
      required: ['inputs']
    }
  })
  @ApiResponse({
    status: 200,
    description: 'Action executed successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        executionId: { type: 'string', example: 'exec_abc123' },
        duration: { type: 'number', example: 1250 },
        data: { 
          type: 'object', 
          description: 'Action execution result',
          example: { messageId: 'msg_456', status: 'sent' }
        },
        outputs: {
          type: 'object',
          description: 'Additional output data from action',
          example: { channel: '#general', timestamp: '2024-01-15T10:30:00Z' }
        }
      }
    }
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - missing headers or invalid inputs',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 400 },
        message: { type: 'string', example: 'X-Org-ID header required' },
        error: { type: 'string', example: 'Bad Request' }
      }
    }
  })
  @ApiResponse({
    status: 404,
    description: 'Action not found',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 404 },
        message: { type: 'string', example: 'Action "invalid_key" not found' },
        error: { type: 'string', example: 'Not Found' }
      }
    }
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - invalid or missing authentication'
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error during action execution'
  })
  async execute(
    @Headers('X-Org-ID') orgId: string,
    @Headers('X-User-ID') userId: string,
    @Param('key') actionKey: string,
    @Body(ValidationPipe) dto: ExecuteActionDto,
  ) {
    if (!orgId) throw new BadRequestException('X-Org-ID header required');
    return this.actionsService.executeAction(orgId, userId, actionKey, dto.inputs);
  }
}
