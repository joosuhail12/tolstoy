import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Put,
  Delete,
  Patch,
  ValidationPipe,
  HttpStatus,
  HttpCode,
  Query,
} from '@nestjs/common';
import { WebhooksService } from './webhooks.service';
import { CreateWebhookDto } from './dto/create-webhook.dto';
import { UpdateWebhookDto } from './dto/update-webhook.dto';
import { Tenant } from '../common/decorators/tenant.decorator';
import { TenantContext } from '../common/interfaces/tenant-context.interface';

@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body(ValidationPipe) createWebhookDto: CreateWebhookDto,
    @Tenant() tenant: TenantContext,
  ) {
    return this.webhooksService.create(createWebhookDto, tenant);
  }

  @Get()
  findAll(
    @Query('eventType') eventType: string,
    @Tenant() tenant: TenantContext,
  ) {
    if (eventType) {
      return this.webhooksService.findByEventType(eventType, tenant);
    }
    return this.webhooksService.findAll(tenant);
  }

  @Get('event-types')
  getValidEventTypes() {
    return {
      eventTypes: this.webhooksService.getValidEventTypes(),
    };
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Tenant() tenant: TenantContext) {
    return this.webhooksService.findOne(id, tenant);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body(ValidationPipe) updateWebhookDto: UpdateWebhookDto,
    @Tenant() tenant: TenantContext,
  ) {
    return this.webhooksService.update(id, updateWebhookDto, tenant);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string, @Tenant() tenant: TenantContext) {
    await this.webhooksService.remove(id, tenant);
  }

  @Patch(':id/toggle')
  toggle(@Param('id') id: string, @Tenant() tenant: TenantContext) {
    return this.webhooksService.toggle(id, tenant);
  }

  @Post(':id/test')
  @HttpCode(HttpStatus.ACCEPTED)
  testWebhook(@Param('id') id: string, @Tenant() tenant: TenantContext) {
    return this.webhooksService.testWebhook(id, tenant);
  }
}