import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { ExecutionLog } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { CreateExecutionLogDto } from './dto/create-execution-log.dto';
import { UpdateExecutionLogDto } from './dto/update-execution-log.dto';
import { TenantContext } from '../common/interfaces/tenant-context.interface';

@Injectable()
export class ExecutionLogsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    createExecutionLogDto: CreateExecutionLogDto,
    tenant: TenantContext,
  ): Promise<ExecutionLog> {
    // Verify the flow belongs to the organization
    const flow = await this.prisma.flow.findUnique({
      where: { id: createExecutionLogDto.flowId },
    });

    if (!flow || flow.orgId !== tenant.orgId) {
      throw new ForbiddenException('Flow not found or access denied');
    }

    return this.prisma.executionLog.create({
      data: {
        ...createExecutionLogDto,
        orgId: tenant.orgId,
        userId: tenant.userId,
      },
    });
  }

  async findAll(tenant: TenantContext): Promise<ExecutionLog[]> {
    return this.prisma.executionLog.findMany({
      where: { orgId: tenant.orgId },
      include: {
        organization: {
          select: { id: true, name: true },
        },
        user: {
          select: { id: true, email: true },
        },
        flow: {
          select: { id: true, version: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, tenant: TenantContext): Promise<ExecutionLog> {
    const executionLog = await this.prisma.executionLog.findUnique({
      where: { id },
      include: {
        organization: {
          select: { id: true, name: true },
        },
        user: {
          select: { id: true, email: true },
        },
        flow: {
          select: { id: true, version: true, steps: true },
        },
      },
    });

    if (!executionLog) {
      throw new NotFoundException(`Execution log with ID ${id} not found`);
    }

    if (executionLog.orgId !== tenant.orgId) {
      throw new ForbiddenException(
        'Access denied: Execution log belongs to different organization',
      );
    }

    return executionLog;
  }

  async update(
    id: string,
    updateExecutionLogDto: UpdateExecutionLogDto,
    tenant: TenantContext,
  ): Promise<ExecutionLog> {
    await this.findOne(id, tenant);

    // If flowId is being updated, verify the new flow belongs to the organization
    if (updateExecutionLogDto.flowId) {
      const flow = await this.prisma.flow.findUnique({
        where: { id: updateExecutionLogDto.flowId },
      });

      if (!flow || flow.orgId !== tenant.orgId) {
        throw new ForbiddenException('Flow not found or access denied');
      }
    }

    try {
      return await this.prisma.executionLog.update({
        where: { id },
        data: updateExecutionLogDto,
      });
    } catch (error) {
      if (error instanceof Error && (error as any).code === 'P2025') {
        throw new NotFoundException(`Execution log with ID ${id} not found`);
      }
      throw error;
    }
  }

  async remove(id: string, tenant: TenantContext): Promise<ExecutionLog> {
    await this.findOne(id, tenant);

    try {
      return await this.prisma.executionLog.delete({
        where: { id },
      });
    } catch (error) {
      if (error instanceof Error && (error as any).code === 'P2025') {
        throw new NotFoundException(`Execution log with ID ${id} not found`);
      }
      throw error;
    }
  }
}
