import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import type { InputJsonValue } from '@prisma/client/runtime/library';
import { PrismaService } from '../prisma.service';

export interface WebhookDispatchLogData {
  webhookId: string;
  orgId: string;
  eventType: string;
  url: string;
  status: 'success' | 'failure';
  statusCode?: number | undefined;
  duration: number; // in milliseconds
  error?: Record<string, unknown> | undefined;
  deliveryId: string;
}

@Injectable()
export class WebhookDispatchLogService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectPinoLogger(WebhookDispatchLogService.name)
    private readonly logger: PinoLogger,
  ) {}

  async logDispatchAttempt(data: WebhookDispatchLogData): Promise<void> {
    try {
      const createData: {
        webhookId: string;
        orgId: string;
        eventType: string;
        url: string;
        status: 'success' | 'failure';
        statusCode?: number;
        duration: number;
        error?: InputJsonValue;
        deliveryId: string;
      } = {
        webhookId: data.webhookId,
        orgId: data.orgId,
        eventType: data.eventType,
        url: data.url,
        status: data.status,
        duration: data.duration,
        deliveryId: data.deliveryId,
      };

      if (data.statusCode !== undefined) {
        createData.statusCode = data.statusCode;
      }

      if (data.error !== undefined) {
        createData.error = data.error as InputJsonValue;
      }

      await this.prisma.webhookDispatchLog.create({
        data: createData,
      });

      this.logger.debug(
        {
          webhookId: data.webhookId,
          orgId: data.orgId,
          eventType: data.eventType,
          status: data.status,
          deliveryId: data.deliveryId,
        },
        'Webhook dispatch log created',
      );
    } catch (error) {
      this.logger.error(
        {
          webhookId: data.webhookId,
          orgId: data.orgId,
          eventType: data.eventType,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        'Failed to create webhook dispatch log',
      );
    }
  }

  async getDispatchLogs(
    orgId: string,
    filters?: {
      webhookId?: string;
      eventType?: string;
      status?: 'success' | 'failure';
      limit?: number;
      offset?: number;
    },
  ) {
    const where: Record<string, unknown> = { orgId };

    if (filters?.webhookId) {
      where.webhookId = filters.webhookId;
    }

    if (filters?.eventType) {
      where.eventType = filters.eventType;
    }

    if (filters?.status) {
      where.status = filters.status;
    }

    return this.prisma.webhookDispatchLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: filters?.limit || 100,
      skip: filters?.offset || 0,
      include: {
        webhook: {
          select: {
            id: true,
            name: true,
            url: true,
          },
        },
      },
    });
  }

  async getDispatchStats(
    orgId: string,
    filters?: {
      webhookId?: string;
      eventType?: string;
      since?: Date;
    },
  ) {
    const where: Record<string, unknown> = { orgId };

    if (filters?.webhookId) {
      where.webhookId = filters.webhookId;
    }

    if (filters?.eventType) {
      where.eventType = filters.eventType;
    }

    if (filters?.since) {
      where.createdAt = {
        gte: filters.since,
      };
    }

    const [total, successful, failed] = await Promise.all([
      this.prisma.webhookDispatchLog.count({ where }),
      this.prisma.webhookDispatchLog.count({
        where: { ...where, status: 'success' },
      }),
      this.prisma.webhookDispatchLog.count({
        where: { ...where, status: 'failure' },
      }),
    ]);

    const avgDuration = await this.prisma.webhookDispatchLog.aggregate({
      where,
      _avg: {
        duration: true,
      },
    });

    return {
      totalDispatches: total,
      successfulDispatches: successful,
      failedDispatches: failed,
      successRate: total > 0 ? (successful / total) * 100 : 0,
      avgDurationMs: avgDuration._avg.duration || 0,
    };
  }
}
