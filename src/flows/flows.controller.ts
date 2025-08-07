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
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';
import { FlowsService } from './flows.service';
import { FlowExecutorService } from './flow-executor.service';
import { InngestExecutionService } from './inngest/inngest-execution.service';
import { CreateFlowDto } from './dto/create-flow.dto';
import { UpdateFlowDto } from './dto/update-flow.dto';
import { Tenant } from '../common/decorators/tenant.decorator';
import { TenantContext } from '../common/interfaces/tenant-context.interface';

@Controller('flows')
export class FlowsController {
  constructor(
    private readonly flowsService: FlowsService,
    private readonly flowExecutorService: FlowExecutorService,
    private readonly inngestExecutionService: InngestExecutionService,
    @InjectPinoLogger(FlowsController.name)
    private readonly logger: PinoLogger,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body(ValidationPipe) createFlowDto: CreateFlowDto,
    @Tenant() tenant: TenantContext,
  ) {
    this.logger.info({ orgId: tenant.orgId, version: createFlowDto.version }, 'Creating flow');
    
    const result = await this.flowsService.create(createFlowDto, tenant);
    
    this.logger.info({ orgId: tenant.orgId, flowId: result.id, version: result.version }, 'Flow created successfully');
    
    return result;
  }

  @Get()
  findAll(@Tenant() tenant: TenantContext) {
    return this.flowsService.findAll(tenant);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Tenant() tenant: TenantContext) {
    return this.flowsService.findOne(id, tenant);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body(ValidationPipe) updateFlowDto: UpdateFlowDto,
    @Tenant() tenant: TenantContext,
  ) {
    return this.flowsService.update(id, updateFlowDto, tenant);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string, @Tenant() tenant: TenantContext) {
    this.logger.warn({ flowId: id, orgId: tenant.orgId }, 'Deleting flow');
    
    await this.flowsService.remove(id, tenant);
    
    this.logger.info({ flowId: id, orgId: tenant.orgId }, 'Flow deleted successfully');
  }

  @Post(':id/execute')
  @HttpCode(HttpStatus.ACCEPTED)
  async executeFlow(
    @Param('id') id: string,
    @Body() executionInput: { variables?: Record<string, any>; useDurable?: boolean },
    @Tenant() tenant: TenantContext,
  ) {
    const { variables = {}, useDurable = true } = executionInput;
    
    this.logger.info({ 
      flowId: id, 
      orgId: tenant.orgId, 
      variableCount: Object.keys(variables).length,
      useDurable,
    }, 'Starting flow execution');
    
    if (useDurable) {
      // Use Inngest for durable execution
      const result = await this.inngestExecutionService.executeFlow(
        id,
        tenant,
        variables
      );
      
      this.logger.info({ 
        flowId: id, 
        orgId: tenant.orgId, 
        executionId: result.executionId, 
        status: result.status 
      }, 'Durable flow execution enqueued');
      
      return result;
    } else {
      // Use direct execution (legacy mode)
      const result = await this.flowExecutorService.executeFlow(
        id,
        tenant,
        variables
      );
      
      this.logger.info({ 
        flowId: id, 
        orgId: tenant.orgId, 
        executionLogId: result.id, 
        status: result.status 
      }, 'Direct flow execution started');
      
      return result;
    }
  }

  @Get(':id/executions')
  async getFlowExecutions(
    @Param('id') id: string,
    @Tenant() tenant: TenantContext,
  ) {
    return this.inngestExecutionService.getFlowExecutions(id, tenant);
  }

  @Get(':id/executions/:executionId')
  async getExecutionStatus(
    @Param('id') flowId: string,
    @Param('executionId') executionId: string,
    @Tenant() tenant: TenantContext,
  ) {
    return this.inngestExecutionService.getExecutionStatus(executionId, tenant);
  }

  @Post(':id/executions/:executionId/cancel')
  @HttpCode(HttpStatus.NO_CONTENT)
  async cancelExecution(
    @Param('id') flowId: string,
    @Param('executionId') executionId: string,
    @Tenant() tenant: TenantContext,
  ) {
    this.logger.warn({ 
      flowId, 
      executionId, 
      orgId: tenant.orgId 
    }, 'Cancelling flow execution');
    
    await this.inngestExecutionService.cancelExecution(executionId, tenant);
    
    this.logger.info({ 
      flowId, 
      executionId, 
      orgId: tenant.orgId 
    }, 'Flow execution cancelled');
  }

  @Post(':id/executions/:executionId/retry')
  @HttpCode(HttpStatus.ACCEPTED)
  async retryExecution(
    @Param('id') flowId: string,
    @Param('executionId') executionId: string,
    @Tenant() tenant: TenantContext,
  ) {
    this.logger.info({ 
      flowId, 
      executionId, 
      orgId: tenant.orgId 
    }, 'Retrying failed flow execution');
    
    const result = await this.inngestExecutionService.retryExecution(executionId, tenant);
    
    this.logger.info({ 
      flowId, 
      originalExecutionId: executionId,
      newExecutionId: result.executionId,
      orgId: tenant.orgId 
    }, 'Flow execution retry initiated');
    
    return result;
  }

  @Get(':id/metrics')
  async getExecutionMetrics(
    @Param('id') id: string,
    @Tenant() tenant: TenantContext,
  ) {
    return this.inngestExecutionService.getExecutionMetrics(id, tenant);
  }
}