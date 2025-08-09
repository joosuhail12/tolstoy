import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Webhook } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { CreateWebhookDto } from './dto/create-webhook.dto';
import { UpdateWebhookDto } from './dto/update-webhook.dto';
import { TenantContext } from '../common/interfaces/tenant-context.interface';

@Injectable()
export class WebhooksService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly VALID_EVENT_TYPES = [
    'flow.started',
    'flow.completed',
    'flow.failed',
    'step.started',
    'step.completed',
    'step.failed',
    'step.skipped',
    'action.executed',
    'action.failed',
    'webhook.test',
  ];

  private validateEventTypes(eventTypes: string[]): void {
    const invalidTypes = eventTypes.filter(type => !this.VALID_EVENT_TYPES.includes(type));
    if (invalidTypes.length > 0) {
      throw new BadRequestException(
        `Invalid event types: ${invalidTypes.join(', ')}. Valid types are: ${this.VALID_EVENT_TYPES.join(', ')}`,
      );
    }
  }

  async create(createWebhookDto: CreateWebhookDto, tenant: TenantContext): Promise<Webhook> {
    this.validateEventTypes(createWebhookDto.eventTypes);

    const existingWebhook = await this.prisma.webhook.findFirst({
      where: {
        orgId: tenant.orgId,
        url: createWebhookDto.url,
      },
    });

    if (existingWebhook) {
      throw new BadRequestException('A webhook with this URL already exists for your organization');
    }

    return this.prisma.webhook.create({
      data: {
        ...createWebhookDto,
        orgId: tenant.orgId,
        enabled: createWebhookDto.enabled ?? true,
      },
    });
  }

  async findAll(tenant: TenantContext): Promise<Webhook[]> {
    return this.prisma.webhook.findMany({
      where: { orgId: tenant.orgId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByEventType(eventType: string, tenant: TenantContext): Promise<Webhook[]> {
    return this.prisma.webhook.findMany({
      where: {
        orgId: tenant.orgId,
        eventTypes: { has: eventType },
        enabled: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, tenant: TenantContext): Promise<Webhook> {
    const webhook = await this.prisma.webhook.findUnique({
      where: { id },
    });

    if (!webhook) {
      throw new NotFoundException(`Webhook with ID ${id} not found`);
    }

    if (webhook.orgId !== tenant.orgId) {
      throw new ForbiddenException('Access denied: Webhook belongs to different organization');
    }

    return webhook;
  }

  async update(
    id: string,
    updateWebhookDto: UpdateWebhookDto,
    tenant: TenantContext,
  ): Promise<Webhook> {
    const webhook = await this.findOne(id, tenant);

    if (updateWebhookDto.eventTypes) {
      this.validateEventTypes(updateWebhookDto.eventTypes);
    }

    if (updateWebhookDto.url && updateWebhookDto.url !== webhook.url) {
      const existingWebhook = await this.prisma.webhook.findFirst({
        where: {
          orgId: tenant.orgId,
          url: updateWebhookDto.url,
          NOT: { id },
        },
      });

      if (existingWebhook) {
        throw new BadRequestException(
          'A webhook with this URL already exists for your organization',
        );
      }
    }

    return this.prisma.webhook.update({
      where: { id },
      data: updateWebhookDto,
    });
  }

  async remove(id: string, tenant: TenantContext): Promise<Webhook> {
    await this.findOne(id, tenant);

    return this.prisma.webhook.delete({
      where: { id },
    });
  }

  async toggle(id: string, tenant: TenantContext): Promise<Webhook> {
    const webhook = await this.findOne(id, tenant);

    return this.prisma.webhook.update({
      where: { id },
      data: { enabled: !webhook.enabled },
    });
  }

  async findEnabledWebhooksForEvent(eventType: string, orgId: string): Promise<Webhook[]> {
    return this.prisma.webhook.findMany({
      where: {
        orgId,
        eventTypes: { has: eventType },
        enabled: true,
      },
    });
  }

  async getWebhooksForEvent(orgId: string, eventType: string): Promise<Webhook[]> {
    return this.prisma.webhook.findMany({
      where: { orgId, enabled: true, eventTypes: { has: eventType } },
    });
  }

  async testWebhook(
    id: string,
    tenant: TenantContext,
  ): Promise<{ success: boolean; message: string }> {
    const webhook = await this.findOne(id, tenant);

    if (!webhook.enabled) {
      throw new BadRequestException('Cannot test a disabled webhook');
    }

    return {
      success: true,
      message: `Test webhook event will be sent to ${webhook.url}`,
    };
  }

  getValidEventTypes(): string[] {
    return this.VALID_EVENT_TYPES;
  }
}
