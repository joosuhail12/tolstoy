import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiHeader,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiSecurity,
  ApiTags,
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
    type: CreateActionDto,
    description: 'Action template configuration',
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
    type: UpdateActionDto,
    description: 'Updated action configuration',
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

  @Post(':id/execute')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Execute a single Action by ID',
    description:
      'Execute a standalone action with provided inputs. This endpoint allows you to run individual actions outside of workflow contexts.',
  })
  @ApiParam({
    name: 'id',
    description: 'Action ID',
    example: 'action_abc123',
  })
  @ApiHeader({
    name: 'X-Org-ID',
    description: 'Organization ID',
    required: true,
    example: 'org_123456',
  })
  @ApiHeader({
    name: 'X-User-ID',
    description: 'User ID for user-scoped authentication (optional)',
    required: false,
    example: 'user_789',
  })
  @ApiBody({
    type: ExecuteActionDto,
    description: 'Action execution inputs',
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
          example: { messageId: 'msg_456', status: 'sent' },
        },
        outputs: {
          type: 'object',
          description: 'Additional output data from action',
          example: { channel: '#general', timestamp: '2024-01-15T10:30:00Z' },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - missing headers or invalid inputs',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 400 },
        message: { type: 'string', example: 'X-Org-ID header required' },
        error: { type: 'string', example: 'Bad Request' },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Action not found',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 404 },
        message: { type: 'string', example: 'Action "invalid_id" not found' },
        error: { type: 'string', example: 'Not Found' },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - invalid or missing authentication',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error during action execution',
  })
  async execute(
    @Headers('X-Org-ID') orgId: string,
    @Headers('X-User-ID') userId: string,
    @Param('id') actionId: string,
    @Body(ValidationPipe) dto: ExecuteActionDto,
  ) {
    if (!orgId) {
      throw new BadRequestException('X-Org-ID header required');
    }
    return this.actionsService.executeActionById(orgId, userId, actionId, dto.inputs);
  }

  @Get('executions')
  @ApiOperation({
    summary: 'List Action Executions',
    description: 'Get a list of all action executions for the organization',
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved action executions',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'clm123...' },
          executionId: { type: 'string', example: 'exec_1234567890_abc123' },
          actionKey: { type: 'string', example: 'slack_send_message' },
          status: {
            type: 'string',
            enum: ['pending', 'running', 'completed', 'failed', 'cancelled'],
            example: 'completed',
          },
          inputs: { type: 'object', example: { channel: '#general', text: 'Hello' } },
          outputs: { type: 'object', example: { messageId: 'msg_123' } },
          error: { type: 'object', nullable: true },
          duration: { type: 'number', example: 1250 },
          retryCount: { type: 'number', example: 0 },
          parentId: { type: 'string', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
          action: {
            type: 'object',
            properties: {
              name: { type: 'string', example: 'Send Slack Message' },
              key: { type: 'string', example: 'slack_send_message' },
              tool: {
                type: 'object',
                properties: {
                  name: { type: 'string', example: 'Slack' },
                },
              },
            },
          },
          user: {
            type: 'object',
            nullable: true,
            properties: {
              email: { type: 'string', example: 'user@example.com' },
            },
          },
        },
      },
    },
  })
  async listExecutions(
    @Tenant() tenant: TenantContext,
    @Headers('X-Action-Key') actionKey?: string,
    @Headers('X-Status') status?: string,
  ) {
    return this.actionsService.getActionExecutions(tenant.orgId, actionKey, status);
  }

  @Get(':key/executions')
  @ApiOperation({
    summary: 'List Executions for Specific Action',
    description: 'Get execution history for a specific action',
  })
  @ApiParam({
    name: 'key',
    description: 'Action key',
    example: 'slack_send_message',
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved action executions',
  })
  async listActionExecutions(
    @Param('key') actionKey: string,
    @Tenant() tenant: TenantContext,
    @Headers('X-Status') status?: string,
  ) {
    return this.actionsService.getActionExecutions(tenant.orgId, actionKey, status);
  }

  @Get('executions/:executionId')
  @ApiOperation({
    summary: 'Get Execution Status',
    description: 'Get detailed status of a specific action execution',
  })
  @ApiParam({
    name: 'executionId',
    description: 'Execution ID',
    example: 'exec_1234567890_abc123',
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved execution status',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', example: 'clm123...' },
        executionId: { type: 'string', example: 'exec_1234567890_abc123' },
        actionKey: { type: 'string', example: 'slack_send_message' },
        status: {
          type: 'string',
          enum: ['pending', 'running', 'completed', 'failed', 'cancelled'],
          example: 'completed',
        },
        inputs: { type: 'object' },
        outputs: { type: 'object', nullable: true },
        error: { type: 'object', nullable: true },
        duration: { type: 'number', example: 1250 },
        retryCount: { type: 'number', example: 0 },
        parentId: { type: 'string', nullable: true },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' },
        action: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            key: { type: 'string' },
            tool: {
              type: 'object',
              properties: {
                name: { type: 'string' },
              },
            },
          },
        },
        user: {
          type: 'object',
          nullable: true,
          properties: {
            email: { type: 'string' },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Execution not found',
  })
  async getExecutionStatus(
    @Param('executionId') executionId: string,
    @Tenant() tenant: TenantContext,
  ) {
    return this.actionsService.getActionExecutionStatus(executionId, tenant);
  }

  @Post('executions/:executionId/cancel')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Cancel Execution',
    description: 'Cancel a pending or running action execution',
  })
  @ApiParam({
    name: 'executionId',
    description: 'Execution ID',
    example: 'exec_1234567890_abc123',
  })
  @ApiResponse({
    status: 204,
    description: 'Execution cancelled successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Cannot cancel execution in current status',
  })
  @ApiResponse({
    status: 404,
    description: 'Execution not found',
  })
  async cancelExecution(
    @Param('executionId') executionId: string,
    @Tenant() tenant: TenantContext,
  ) {
    await this.actionsService.cancelActionExecution(executionId, tenant);
  }

  @Post('executions/:executionId/retry')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Retry Execution',
    description: 'Retry a failed or cancelled action execution',
  })
  @ApiParam({
    name: 'executionId',
    description: 'Execution ID',
    example: 'exec_1234567890_abc123',
  })
  @ApiResponse({
    status: 202,
    description: 'Retry initiated successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        executionId: { type: 'string', example: 'exec_9876543210_xyz789' },
        duration: { type: 'number', example: 1250 },
        data: { type: 'object' },
        outputs: { type: 'object' },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Can only retry failed or cancelled executions',
  })
  @ApiResponse({
    status: 404,
    description: 'Execution not found',
  })
  async retryExecution(@Param('executionId') executionId: string, @Tenant() tenant: TenantContext) {
    return this.actionsService.retryActionExecution(executionId, tenant);
  }
}
