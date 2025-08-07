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
import { CreateFlowDto } from './dto/create-flow.dto';
import { UpdateFlowDto } from './dto/update-flow.dto';
import { Tenant } from '../common/decorators/tenant.decorator';
import { TenantContext } from '../common/interfaces/tenant-context.interface';

@Controller('flows')
export class FlowsController {
  constructor(
    private readonly flowsService: FlowsService,
    private readonly flowExecutorService: FlowExecutorService,
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
    @Body() executionInput: { variables?: Record<string, any> },
    @Tenant() tenant: TenantContext,
  ) {
    this.logger.info({ flowId: id, orgId: tenant.orgId, variableCount: Object.keys(executionInput.variables || {}).length }, 'Starting flow execution');
    
    const result = await this.flowExecutorService.executeFlow(
      id,
      tenant,
      executionInput.variables || {}
    );
    
    this.logger.info({ flowId: id, orgId: tenant.orgId, executionLogId: result.id, status: result.status }, 'Flow execution started');
    
    return result;
  }
}