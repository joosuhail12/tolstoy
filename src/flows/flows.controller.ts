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
    private readonly flowExecutorService: FlowExecutorService
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body(ValidationPipe) createFlowDto: CreateFlowDto,
    @Tenant() tenant: TenantContext,
  ) {
    return this.flowsService.create(createFlowDto, tenant);
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
  remove(@Param('id') id: string, @Tenant() tenant: TenantContext) {
    return this.flowsService.remove(id, tenant);
  }

  @Post(':id/execute')
  @HttpCode(HttpStatus.ACCEPTED)
  async executeFlow(
    @Param('id') id: string,
    @Body() executionInput: { variables?: Record<string, any> },
    @Tenant() tenant: TenantContext,
  ) {
    return this.flowExecutorService.executeFlow(
      id,
      tenant,
      executionInput.variables || {}
    );
  }
}