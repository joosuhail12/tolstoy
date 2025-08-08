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
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
  ApiQuery,
  ApiSecurity,
} from '@nestjs/swagger';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';
import { WebhooksService } from './webhooks.service';
import { CreateWebhookDto } from './dto/create-webhook.dto';
import { UpdateWebhookDto } from './dto/update-webhook.dto';
import { Tenant } from '../common/decorators/tenant.decorator';
import { TenantContext } from '../common/interfaces/tenant-context.interface';

@ApiTags('Webhooks')
@ApiSecurity('x-org-id')
@ApiSecurity('x-user-id')
@Controller('webhooks')
export class WebhooksController {
  constructor(
    private readonly webhooksService: WebhooksService,
    @InjectPinoLogger(WebhooksController.name)
    private readonly logger: PinoLogger,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create Webhook',
    description: 'Create a new webhook to receive event notifications',
  })
  @ApiBody({
    description: 'Webhook configuration',
    schema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          format: 'uri',
          description: 'Webhook endpoint URL',
          example: 'https://api.example.com/webhook',
        },
        eventTypes: {
          type: 'array',
          items: { type: 'string' },
          description: 'Event types to subscribe to',
          example: ['flow.execution.completed', 'flow.execution.failed'],
        },
        enabled: {
          type: 'boolean',
          description: 'Whether the webhook is active',
          default: true,
        },
        secret: {
          type: 'string',
          description: 'Optional secret for webhook signature verification',
          example: 'webhook_secret_123',
        },
      },
      required: ['url', 'eventTypes'],
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Webhook created successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', example: 'webhook_abc123' },
        url: { type: 'string', example: 'https://api.example.com/webhook' },
        eventTypes: { type: 'array', items: { type: 'string' }, example: ['flow.execution.completed'] },
        enabled: { type: 'boolean', example: true },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid webhook configuration',
  })
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
  @ApiOperation({
    summary: 'List Webhooks',
    description: 'Get all webhooks for the organization, optionally filtered by event type',
  })
  @ApiQuery({
    name: 'eventType',
    required: false,
    description: 'Filter webhooks by event type',
    example: 'flow.execution.completed',
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved webhooks',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'webhook_abc123' },
          url: { type: 'string', example: 'https://api.example.com/webhook' },
          eventTypes: { type: 'array', items: { type: 'string' }, example: ['flow.execution.completed'] },
          enabled: { type: 'boolean', example: true },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
    },
  })
  findAll(@Query('eventType') eventType: string, @Tenant() tenant: TenantContext) {
    if (eventType) {
      return this.webhooksService.findByEventType(eventType, tenant);
    }
    return this.webhooksService.findAll(tenant);
  }

  @Get('event-types')
  @ApiOperation({
    summary: 'Get Valid Event Types',
    description: 'Get list of all valid event types that can be subscribed to via webhooks',
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved event types',
    schema: {
      type: 'object',
      properties: {
        eventTypes: {
          type: 'array',
          items: { type: 'string' },
          example: [
            'flow.execution.started',
            'flow.execution.completed',
            'flow.execution.failed',
            'user.created',
            'organization.updated',
          ],
        },
      },
    },
  })
  getValidEventTypes() {
    return {
      eventTypes: this.webhooksService.getValidEventTypes(),
    };
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get Webhook',
    description: 'Get a specific webhook by ID',
  })
  @ApiParam({
    name: 'id',
    description: 'Webhook ID',
    example: 'webhook_abc123',
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved webhook',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', example: 'webhook_abc123' },
        url: { type: 'string', example: 'https://api.example.com/webhook' },
        eventTypes: { type: 'array', items: { type: 'string' }, example: ['flow.execution.completed'] },
        enabled: { type: 'boolean', example: true },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Webhook not found',
  })
  findOne(@Param('id') id: string, @Tenant() tenant: TenantContext) {
    return this.webhooksService.findOne(id, tenant);
  }

  @Put(':id')
  @ApiOperation({
    summary: 'Update Webhook',
    description: 'Update webhook configuration',
  })
  @ApiParam({
    name: 'id',
    description: 'Webhook ID',
    example: 'webhook_abc123',
  })
  @ApiBody({
    description: 'Updated webhook configuration',
    schema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          format: 'uri',
          description: 'Webhook endpoint URL',
          example: 'https://api.example.com/webhook',
        },
        eventTypes: {
          type: 'array',
          items: { type: 'string' },
          description: 'Event types to subscribe to',
          example: ['flow.execution.completed', 'flow.execution.failed'],
        },
        enabled: {
          type: 'boolean',
          description: 'Whether the webhook is active',
        },
        secret: {
          type: 'string',
          description: 'Optional secret for webhook signature verification',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Webhook updated successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Webhook not found',
  })
  update(
    @Param('id') id: string,
    @Body(ValidationPipe) updateWebhookDto: UpdateWebhookDto,
    @Tenant() tenant: TenantContext,
  ) {
    return this.webhooksService.update(id, updateWebhookDto, tenant);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete Webhook',
    description: 'Delete a webhook permanently',
  })
  @ApiParam({
    name: 'id',
    description: 'Webhook ID',
    example: 'webhook_abc123',
  })
  @ApiResponse({
    status: 204,
    description: 'Webhook deleted successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Webhook not found',
  })
  async remove(@Param('id') id: string, @Tenant() tenant: TenantContext) {
    this.logger.warn({ webhookId: id, orgId: tenant.orgId }, 'Deleting webhook');

    await this.webhooksService.remove(id, tenant);

    this.logger.info({ webhookId: id, orgId: tenant.orgId }, 'Webhook deleted successfully');
  }

  @Patch(':id/toggle')
  @ApiOperation({
    summary: 'Toggle Webhook',
    description: 'Enable or disable a webhook',
  })
  @ApiParam({
    name: 'id',
    description: 'Webhook ID',
    example: 'webhook_abc123',
  })
  @ApiResponse({
    status: 200,
    description: 'Webhook status toggled successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', example: 'webhook_abc123' },
        enabled: { type: 'boolean', example: false },
        updatedAt: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Webhook not found',
  })
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
  @ApiOperation({
    summary: 'Test Webhook',
    description: 'Send a test payload to verify webhook endpoint is working',
  })
  @ApiParam({
    name: 'id',
    description: 'Webhook ID',
    example: 'webhook_abc123',
  })
  @ApiResponse({
    status: 202,
    description: 'Test webhook request sent',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        statusCode: { type: 'number', example: 200 },
        message: { type: 'string', example: 'Webhook test successful' },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Webhook not found',
  })
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
