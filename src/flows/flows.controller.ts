import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Optional,
  Param,
  Post,
  Put,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { FlowsService } from './flows.service';
import { FlowExecutorService } from './flow-executor.service';
import { InngestExecutionService } from './inngest/inngest-execution.service';
import { CreateFlowDto } from './dto/create-flow.dto';
import { UpdateFlowDto } from './dto/update-flow.dto';
import { Tenant } from '../common/decorators/tenant.decorator';
import { TenantContext } from '../common/interfaces/tenant-context.interface';

@ApiTags('Flows')
@ApiSecurity('x-org-id')
@ApiSecurity('x-user-id')
@Controller('flows')
export class FlowsController {
  constructor(
    private readonly flowsService: FlowsService,
    private readonly flowExecutorService: FlowExecutorService,
    @Optional() private readonly inngestExecutionService: InngestExecutionService,
    @InjectPinoLogger(FlowsController.name)
    private readonly logger: PinoLogger,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create Flow',
    description: 'Create a new workflow with steps and configuration',
  })
  @ApiBody({
    type: CreateFlowDto,
    description: 'Flow definition',
  })
  @ApiResponse({
    status: 201,
    description: 'Flow created successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', example: 'flow_abc123' },
        name: { type: 'string', example: 'User Onboarding Flow' },
        description: { type: 'string', example: 'Automated user onboarding process' },
        version: { type: 'number', example: 1 },
        steps: { type: 'array', example: [] },
        settings: { type: 'object', example: { timeout: 300000 } },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid flow definition',
  })
  async create(
    @Body(ValidationPipe) createFlowDto: CreateFlowDto,
    @Tenant() tenant: TenantContext,
  ) {
    this.logger.info({ orgId: tenant.orgId, version: createFlowDto.version }, 'Creating flow');

    const result = await this.flowsService.create(createFlowDto, tenant);

    this.logger.info(
      { orgId: tenant.orgId, flowId: result.id, version: result.version },
      'Flow created successfully',
    );

    return result;
  }

  @Get()
  @ApiOperation({
    summary: 'List Flows',
    description: 'Get all workflows for the organization',
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved flows',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'flow_abc123' },
          name: { type: 'string', example: 'User Onboarding Flow' },
          version: { type: 'number', example: 1 },
          steps: { type: 'array', example: [] },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
    },
  })
  findAll(@Tenant() tenant: TenantContext) {
    return this.flowsService.findAll(tenant);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get Flow',
    description: 'Get a specific workflow by ID',
  })
  @ApiParam({
    name: 'id',
    description: 'Flow ID',
    example: 'flow_abc123',
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved flow',
  })
  @ApiResponse({
    status: 404,
    description: 'Flow not found',
  })
  findOne(@Param('id') id: string, @Tenant() tenant: TenantContext) {
    return this.flowsService.findOne(id, tenant);
  }

  @Put(':id')
  @ApiOperation({
    summary: 'Update Flow',
    description: 'Update workflow definition and configuration',
  })
  @ApiParam({
    name: 'id',
    description: 'Flow ID',
    example: 'flow_abc123',
  })
  @ApiBody({
    type: UpdateFlowDto,
    description: 'Updated flow definition',
  })
  @ApiResponse({
    status: 200,
    description: 'Flow updated successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Flow not found',
  })
  update(
    @Param('id') id: string,
    @Body(ValidationPipe) updateFlowDto: UpdateFlowDto,
    @Tenant() tenant: TenantContext,
  ) {
    return this.flowsService.update(id, updateFlowDto, tenant);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete Flow',
    description: 'Delete a workflow permanently',
  })
  @ApiParam({
    name: 'id',
    description: 'Flow ID',
    example: 'flow_abc123',
  })
  @ApiResponse({
    status: 204,
    description: 'Flow deleted successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Flow not found',
  })
  @ApiResponse({
    status: 409,
    description: 'Flow has active executions and cannot be deleted',
  })
  async remove(@Param('id') id: string, @Tenant() tenant: TenantContext) {
    this.logger.warn({ flowId: id, orgId: tenant.orgId }, 'Deleting flow');

    await this.flowsService.remove(id, tenant);

    this.logger.info({ flowId: id, orgId: tenant.orgId }, 'Flow deleted successfully');
  }

  @Post(':id/execute')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Execute Flow',
    description:
      'Execute a workflow either synchronously or asynchronously with optional input variables',
  })
  @ApiParam({
    name: 'id',
    description: 'Flow ID to execute',
    example: 'flow_abc123',
  })
  @ApiBody({
    description: 'Execution configuration',
    schema: {
      type: 'object',
      properties: {
        variables: {
          type: 'object',
          description: 'Input variables for the flow execution',
          example: { userId: 'user_123', email: 'user@example.com' },
        },
        useDurable: {
          type: 'boolean',
          description: 'Whether to use durable (async) execution',
          default: true,
        },
      },
    },
  })
  @ApiResponse({
    status: 202,
    description: 'Flow execution started successfully',
    schema: {
      type: 'object',
      properties: {
        executionId: {
          type: 'string',
          example: 'exec_abc123',
        },
        status: {
          type: 'string',
          example: 'running',
        },
        mode: {
          type: 'string',
          example: 'durable',
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Flow not found',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid execution parameters',
  })
  async executeFlow(
    @Param('id') id: string,
    @Body() executionInput: { variables?: Record<string, unknown>; useDurable?: boolean },
    @Tenant() tenant: TenantContext,
  ) {
    const { variables = {}, useDurable = true } = executionInput;

    this.logger.info(
      {
        flowId: id,
        orgId: tenant.orgId,
        variableCount: Object.keys(variables).length,
        useDurable,
      },
      'Starting flow execution',
    );

    if (useDurable) {
      // Use Inngest for durable execution
      if (!this.inngestExecutionService) {
        throw new Error(
          'Durable execution is not available - InngestExecutionService is not configured',
        );
      }

      const result = await this.inngestExecutionService.executeFlow(id, tenant, variables);

      this.logger.info(
        {
          flowId: id,
          orgId: tenant.orgId,
          executionId: result.executionId,
          status: result.status,
        },
        'Durable flow execution enqueued',
      );

      return result;
    } else {
      // Use direct execution (legacy mode)
      const result = await this.flowExecutorService.executeFlow(id, tenant, variables);

      this.logger.info(
        {
          flowId: id,
          orgId: tenant.orgId,
          executionLogId: result.id,
          status: result.status,
        },
        'Direct flow execution started',
      );

      return result;
    }
  }

  @Get(':id/executions')
  @ApiOperation({
    summary: 'Get Flow Executions',
    description: 'Get execution history for a specific flow',
  })
  @ApiParam({
    name: 'id',
    description: 'Flow ID',
    example: 'flow_abc123',
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved flow executions',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          executionId: { type: 'string', example: 'exec_abc123' },
          status: { type: 'string', example: 'completed' },
          startedAt: { type: 'string', format: 'date-time' },
          completedAt: { type: 'string', format: 'date-time' },
          variables: { type: 'object', example: { userId: 'user_123' } },
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Flow not found',
  })
  async getFlowExecutions(@Param('id') id: string, @Tenant() tenant: TenantContext) {
    if (!this.inngestExecutionService) {
      throw new Error(
        'Durable execution monitoring is not available - InngestExecutionService is not configured',
      );
    }
    return this.inngestExecutionService.getFlowExecutions(id, tenant);
  }

  @Get(':id/executions/:executionId')
  @ApiOperation({
    summary: 'Get Execution Status',
    description: 'Get detailed status of a specific flow execution',
  })
  @ApiParam({
    name: 'id',
    description: 'Flow ID',
    example: 'flow_abc123',
  })
  @ApiParam({
    name: 'executionId',
    description: 'Execution ID',
    example: 'exec_abc123',
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved execution status',
    schema: {
      type: 'object',
      properties: {
        executionId: { type: 'string', example: 'exec_abc123' },
        status: { type: 'string', example: 'running' },
        currentStep: { type: 'string', example: 'step_2' },
        progress: { type: 'number', example: 0.6 },
        startedAt: { type: 'string', format: 'date-time' },
        variables: { type: 'object', example: { userId: 'user_123' } },
        output: { type: 'object', example: { result: 'success' } },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Execution not found',
  })
  async getExecutionStatus(
    @Param('id') _flowId: string, // Reserved for future flow-scoped execution filtering
    @Param('executionId') executionId: string,
    @Tenant() tenant: TenantContext,
  ) {
    if (!this.inngestExecutionService) {
      throw new Error(
        'Durable execution monitoring is not available - InngestExecutionService is not configured',
      );
    }
    return this.inngestExecutionService.getExecutionStatus(executionId, tenant);
  }

  @Post(':id/executions/:executionId/cancel')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Cancel Execution',
    description: 'Cancel a running flow execution',
  })
  @ApiParam({
    name: 'id',
    description: 'Flow ID',
    example: 'flow_abc123',
  })
  @ApiParam({
    name: 'executionId',
    description: 'Execution ID',
    example: 'exec_abc123',
  })
  @ApiResponse({
    status: 204,
    description: 'Execution cancelled successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Execution not found or already completed',
  })
  async cancelExecution(
    @Param('id') flowId: string,
    @Param('executionId') executionId: string,
    @Tenant() tenant: TenantContext,
  ) {
    this.logger.warn(
      {
        flowId,
        executionId,
        orgId: tenant.orgId,
      },
      'Cancelling flow execution',
    );

    if (!this.inngestExecutionService) {
      throw new Error(
        'Durable execution cancellation is not available - InngestExecutionService is not configured',
      );
    }
    await this.inngestExecutionService.cancelExecution(executionId, tenant);

    this.logger.info(
      {
        flowId,
        executionId,
        orgId: tenant.orgId,
      },
      'Flow execution cancelled',
    );
  }

  @Post(':id/executions/:executionId/retry')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Retry Execution',
    description: 'Retry a failed flow execution',
  })
  @ApiParam({
    name: 'id',
    description: 'Flow ID',
    example: 'flow_abc123',
  })
  @ApiParam({
    name: 'executionId',
    description: 'Execution ID to retry',
    example: 'exec_abc123',
  })
  @ApiResponse({
    status: 202,
    description: 'Execution retry initiated',
    schema: {
      type: 'object',
      properties: {
        newExecutionId: { type: 'string', example: 'exec_def456' },
        status: { type: 'string', example: 'running' },
        retryAttempt: { type: 'number', example: 2 },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Execution not found',
  })
  @ApiResponse({
    status: 400,
    description: 'Execution is not in a retryable state',
  })
  async retryExecution(
    @Param('id') flowId: string,
    @Param('executionId') executionId: string,
    @Tenant() tenant: TenantContext,
  ) {
    this.logger.info(
      {
        flowId,
        executionId,
        orgId: tenant.orgId,
      },
      'Retrying failed flow execution',
    );

    if (!this.inngestExecutionService) {
      throw new Error(
        'Durable execution retry is not available - InngestExecutionService is not configured',
      );
    }
    const result = await this.inngestExecutionService.retryExecution(executionId, tenant);

    return result;

    // this.logger.info(
    //   {
    //     flowId,
    //     originalExecutionId: executionId,
    //     newExecutionId: result.executionId,
    //     orgId: tenant.orgId,
    //   },
    //   'Flow execution retry initiated',
    // );

    // return result;
  }

  @Get(':id/metrics')
  @ApiOperation({
    summary: 'Get Execution Metrics',
    description: 'Get execution metrics and statistics for a flow',
  })
  @ApiParam({
    name: 'id',
    description: 'Flow ID',
    example: 'flow_abc123',
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved execution metrics',
    schema: {
      type: 'object',
      properties: {
        totalExecutions: { type: 'number', example: 152 },
        successfulExecutions: { type: 'number', example: 140 },
        failedExecutions: { type: 'number', example: 12 },
        averageExecutionTime: { type: 'number', example: 4250.5 },
        lastExecutionAt: { type: 'string', format: 'date-time' },
        successRate: { type: 'number', example: 0.921 },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Flow not found',
  })
  async getExecutionMetrics(@Param('id') id: string, @Tenant() tenant: TenantContext) {
    if (!this.inngestExecutionService) {
      throw new Error(
        'Execution metrics are not available - InngestExecutionService is not configured',
      );
    }
    return this.inngestExecutionService.getExecutionMetrics(id, tenant);
  }
}
