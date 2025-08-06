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
import { ToolsService } from './tools.service';
import { CreateToolDto } from './dto/create-tool.dto';
import { UpdateToolDto } from './dto/update-tool.dto';
import { Tenant } from '../common/decorators/tenant.decorator';
import { TenantContext } from '../common/interfaces/tenant-context.interface';

@Controller('tools')
export class ToolsController {
  constructor(private readonly toolsService: ToolsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body(ValidationPipe) createToolDto: CreateToolDto,
    @Tenant() tenant: TenantContext,
  ) {
    return this.toolsService.create(createToolDto, tenant);
  }

  @Get()
  findAll(@Tenant() tenant: TenantContext) {
    return this.toolsService.findAll(tenant);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Tenant() tenant: TenantContext) {
    return this.toolsService.findOne(id, tenant);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body(ValidationPipe) updateToolDto: UpdateToolDto,
    @Tenant() tenant: TenantContext,
  ) {
    return this.toolsService.update(id, updateToolDto, tenant);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @Tenant() tenant: TenantContext) {
    return this.toolsService.remove(id, tenant);
  }
}