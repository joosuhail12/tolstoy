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
import { ExecutionLogsService } from './execution-logs.service';
import { CreateExecutionLogDto } from './dto/create-execution-log.dto';
import { UpdateExecutionLogDto } from './dto/update-execution-log.dto';
import { Tenant } from '../common/decorators/tenant.decorator';
import { TenantContext } from '../common/interfaces/tenant-context.interface';

@Controller('execution-logs')
export class ExecutionLogsController {
  constructor(private readonly executionLogsService: ExecutionLogsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body(ValidationPipe) createExecutionLogDto: CreateExecutionLogDto,
    @Tenant() tenant: TenantContext,
  ) {
    return this.executionLogsService.create(createExecutionLogDto, tenant);
  }

  @Get()
  findAll(@Tenant() tenant: TenantContext) {
    return this.executionLogsService.findAll(tenant);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Tenant() tenant: TenantContext) {
    return this.executionLogsService.findOne(id, tenant);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body(ValidationPipe) updateExecutionLogDto: UpdateExecutionLogDto,
    @Tenant() tenant: TenantContext,
  ) {
    return this.executionLogsService.update(id, updateExecutionLogDto, tenant);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @Tenant() tenant: TenantContext) {
    return this.executionLogsService.remove(id, tenant);
  }
}