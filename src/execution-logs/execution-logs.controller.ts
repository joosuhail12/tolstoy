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
import { ExecutionLogsService } from './execution-logs.service';
import { CreateExecutionLogDto } from './dto/create-execution-log.dto';
import { UpdateExecutionLogDto } from './dto/update-execution-log.dto';
import { Tenant } from '../common/decorators/tenant.decorator';
import { TenantContext } from '../common/interfaces/tenant-context.interface';

@ApiTags('Execution Logs')
@ApiSecurity('x-org-id')
@ApiSecurity('x-user-id')
@Controller('execution-logs')
export class ExecutionLogsController {
  constructor(private readonly executionLogsService: ExecutionLogsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create Execution Log',
    description:
      'Create a log entry for workflow step execution. This tracks the execution history, inputs, outputs, and any errors.',
  })
  @ApiBody({
    description: 'Execution log entry data',
    schema: {
      type: 'object',
      properties: {
        flowId: {
          type: 'string',
          description: 'ID of the workflow being executed',
          example: 'flow_abc123',
        },
        executionId: {
          type: 'string',
          description: 'Unique execution instance ID',
          example: 'exec_xyz789',
        },
        stepKey: {
          type: 'string',
          description: 'Unique identifier for the step within the workflow',
          example: 'send_notification',
        },
        inputs: {
          type: 'object',
          description: 'Input data provided to the step',
          example: {
            stepName: 'Send Slack Notification',
            stepType: 'action',
            config: {
              actionKey: 'slack_send_message',
              parameters: {
                channel: '#general',
                message: 'Workflow completed successfully',
              },
            },
            variables: {
              userId: 'user_123',
              timestamp: '2024-01-15T10:30:00Z',
            },
            stepOutputs: {},
          },
        },
        outputs: {
          type: 'object',
          description: 'Output data produced by the step (optional)',
          example: {
            messageId: 'msg_456',
            timestamp: '2024-01-15T10:30:05Z',
            success: true,
          },
        },
        error: {
          type: 'object',
          description: 'Error information if step failed (optional)',
          example: {
            message: 'Channel not found',
            code: 'CHANNEL_NOT_FOUND',
            stack: 'Error stack trace...',
          },
        },
        status: {
          type: 'string',
          description: 'Execution status of the step',
          enum: ['pending', 'running', 'completed', 'failed', 'skipped'],
          example: 'completed',
        },
      },
      required: ['flowId', 'executionId', 'stepKey', 'inputs', 'status'],
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Execution log created successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', example: 'log_def456' },
        flowId: { type: 'string', example: 'flow_abc123' },
        executionId: { type: 'string', example: 'exec_xyz789' },
        stepKey: { type: 'string', example: 'send_notification' },
        inputs: { type: 'object', example: {} },
        outputs: { type: 'object', example: {} },
        error: { type: 'object', example: null },
        status: { type: 'string', example: 'completed' },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid execution log data',
  })
  create(
    @Body(ValidationPipe) createExecutionLogDto: CreateExecutionLogDto,
    @Tenant() tenant: TenantContext,
  ) {
    return this.executionLogsService.create(createExecutionLogDto, tenant);
  }

  @Get()
  @ApiOperation({
    summary: 'List Execution Logs',
    description:
      'Get all execution logs for the organization. This provides a complete history of workflow step executions.',
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved execution logs',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'log_def456' },
          flowId: { type: 'string', example: 'flow_abc123' },
          executionId: { type: 'string', example: 'exec_xyz789' },
          stepKey: { type: 'string', example: 'send_notification' },
          inputs: {
            type: 'object',
            example: {
              stepName: 'Send Slack Notification',
              stepType: 'action',
              config: {},
              variables: {},
              stepOutputs: {},
            },
          },
          outputs: {
            type: 'object',
            example: {
              messageId: 'msg_456',
              success: true,
            },
          },
          error: { type: 'object', example: null },
          status: { type: 'string', example: 'completed' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
    },
  })
  findAll(@Tenant() tenant: TenantContext) {
    return this.executionLogsService.findAll(tenant);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get Execution Log',
    description: 'Get a specific execution log entry by ID',
  })
  @ApiParam({
    name: 'id',
    description: 'Execution log ID',
    example: 'log_def456',
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved execution log',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', example: 'log_def456' },
        flowId: { type: 'string', example: 'flow_abc123' },
        executionId: { type: 'string', example: 'exec_xyz789' },
        stepKey: { type: 'string', example: 'send_notification' },
        inputs: {
          type: 'object',
          example: {
            stepName: 'Send Slack Notification',
            stepType: 'action',
            config: {
              actionKey: 'slack_send_message',
              parameters: {
                channel: '#general',
                message: 'Workflow completed successfully',
              },
            },
            executeIf: 'user.role == "admin"',
            variables: {
              userId: 'user_123',
              timestamp: '2024-01-15T10:30:00Z',
            },
            stepOutputs: {
              previousStepResult: 'success',
            },
          },
        },
        outputs: {
          type: 'object',
          example: {
            messageId: 'msg_456',
            timestamp: '2024-01-15T10:30:05Z',
            success: true,
            responseCode: 200,
          },
        },
        error: {
          type: 'object',
          example: null,
        },
        status: { type: 'string', example: 'completed' },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Execution log not found',
  })
  findOne(@Param('id') id: string, @Tenant() tenant: TenantContext) {
    return this.executionLogsService.findOne(id, tenant);
  }

  @Put(':id')
  @ApiOperation({
    summary: 'Update Execution Log',
    description:
      'Update execution log entry. Typically used to add outputs or update status after step completion.',
  })
  @ApiParam({
    name: 'id',
    description: 'Execution log ID',
    example: 'log_def456',
  })
  @ApiBody({
    description: 'Updated execution log data',
    schema: {
      type: 'object',
      properties: {
        outputs: {
          type: 'object',
          description: 'Output data produced by the step',
          example: {
            messageId: 'msg_456',
            timestamp: '2024-01-15T10:30:05Z',
            success: true,
            responseCode: 200,
          },
        },
        error: {
          type: 'object',
          description: 'Error information if step failed',
          example: {
            message: 'Channel not found',
            code: 'CHANNEL_NOT_FOUND',
            stack: 'Error stack trace...',
          },
        },
        status: {
          type: 'string',
          description: 'Updated execution status',
          enum: ['pending', 'running', 'completed', 'failed', 'skipped'],
          example: 'completed',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Execution log updated successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Execution log not found',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid execution log data',
  })
  update(
    @Param('id') id: string,
    @Body(ValidationPipe) updateExecutionLogDto: UpdateExecutionLogDto,
    @Tenant() tenant: TenantContext,
  ) {
    return this.executionLogsService.update(id, updateExecutionLogDto, tenant);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete Execution Log',
    description:
      'Delete an execution log entry. Use with caution as this removes audit trail information.',
  })
  @ApiParam({
    name: 'id',
    description: 'Execution log ID',
    example: 'log_def456',
  })
  @ApiResponse({
    status: 204,
    description: 'Execution log deleted successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Execution log not found',
  })
  @ApiResponse({
    status: 409,
    description: 'Cannot delete log entry that is part of active execution',
  })
  remove(@Param('id') id: string, @Tenant() tenant: TenantContext) {
    return this.executionLogsService.remove(id, tenant);
  }
}
