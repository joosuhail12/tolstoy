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
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';
import { WebhooksService } from './webhooks.service';
import { CreateWebhookDto } from './dto/create-webhook.dto';
import { UpdateWebhookDto } from './dto/update-webhook.dto';
import { Tenant } from '../common/decorators/tenant.decorator';
import { TenantContext } from '../common/interfaces/tenant-context.interface';

@Controller('webhooks')
export class WebhooksController {
  constructor(
    private readonly webhooksService: WebhooksService,
    @InjectPinoLogger(WebhooksController.name)
    private readonly logger: PinoLogger,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body(ValidationPipe) createWebhookDto: CreateWebhookDto,
    @Tenant() tenant: TenantContext,
  ) {
    this.logger.info(
      { orgId: tenant.orgId, url: createWebhookDto.url, eventTypes: createWebhookDto.eventTypes },
      'Creating webhook',
    );

    const result = await this.webhooksService.create(createWebhookDto, tenant);

    this.logger.info({ orgId: tenant.orgId, webhookId: result.id }, 'Webhook created successfully');

    return result;
  }

  @Get()
  findAll(@Query('eventType') eventType: string, @Tenant() tenant: TenantContext) {
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
    this.logger.warn({ webhookId: id, orgId: tenant.orgId }, 'Deleting webhook');

    await this.webhooksService.remove(id, tenant);

    this.logger.info({ webhookId: id, orgId: tenant.orgId }, 'Webhook deleted successfully');
  }

  @Patch(':id/toggle')
  async toggle(@Param('id') id: string, @Tenant() tenant: TenantContext) {
    this.logger.info({ webhookId: id, orgId: tenant.orgId }, 'Toggling webhook enabled status');

    const result = await this.webhooksService.toggle(id, tenant);

    this.logger.info(
      { webhookId: id, orgId: tenant.orgId, enabled: result.enabled },
      'Webhook status toggled',
    );

    return result;
  }

  @Post(':id/test')
  @HttpCode(HttpStatus.ACCEPTED)
  async testWebhook(@Param('id') id: string, @Tenant() tenant: TenantContext) {
    this.logger.info({ webhookId: id, orgId: tenant.orgId }, 'Testing webhook');

    const result = await this.webhooksService.testWebhook(id, tenant);

    this.logger.info(
      { webhookId: id, orgId: tenant.orgId, success: result.success },
      'Webhook test completed',
    );

    return result;
  }
}
