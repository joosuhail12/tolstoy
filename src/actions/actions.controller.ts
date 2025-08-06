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
import { ActionsService } from './actions.service';
import { CreateActionDto } from './dto/create-action.dto';
import { UpdateActionDto } from './dto/update-action.dto';
import { Tenant } from '../common/decorators/tenant.decorator';
import { TenantContext } from '../common/interfaces/tenant-context.interface';

@Controller('actions')
export class ActionsController {
  constructor(private readonly actionsService: ActionsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body(ValidationPipe) createActionDto: CreateActionDto,
    @Tenant() tenant: TenantContext,
  ) {
    return this.actionsService.create(createActionDto, tenant);
  }

  @Get()
  findAll(@Tenant() tenant: TenantContext) {
    return this.actionsService.findAll(tenant);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Tenant() tenant: TenantContext) {
    return this.actionsService.findOne(id, tenant);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body(ValidationPipe) updateActionDto: UpdateActionDto,
    @Tenant() tenant: TenantContext,
  ) {
    return this.actionsService.update(id, updateActionDto, tenant);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @Tenant() tenant: TenantContext) {
    return this.actionsService.remove(id, tenant);
  }
}