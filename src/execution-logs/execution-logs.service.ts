import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { ExecutionLog, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { CreateExecutionLogDto } from './dto/create-execution-log.dto';
import { UpdateExecutionLogDto } from './dto/update-execution-log.dto';
import { TenantContext } from '../common/interfaces/tenant-context.interface';

export interface StepInputData {
  stepName: string;
  stepType: string;
  config: Record<string, unknown>;
  executeIf?: string;
  variables: Record<string, unknown>;
  stepOutputs: Record<string, unknown>;
}

export interface StepOutputData {
  [key: string]: unknown;
}

export interface StepErrorData {
  message: string;
  code: string;
  stack?: string;
  [key: string]: unknown;
}

export interface CreateStepLogData {
  orgId: string;
  userId: string;
  flowId: string;
  executionId: string;
  stepKey: string;
  inputs: StepInputData;
  status?: string;
}

export interface StepLogUpdate {
  outputs?: StepOutputData;
  error?: StepErrorData;
  status?: string;
}

export interface TimeRange {
  from: Date;
  to: Date;
}

export interface ExecutionStats {
  totalExecutions: number;
  completedSteps: number;
  failedSteps: number;
  skippedSteps: number;
  avgExecutionTime: number;
}

export interface ExecutionStatsWhereClause {
  orgId: string;
  createdAt?: {
    gte: Date;
    lte: Date;
  };
}

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

  // Step-level logging methods for flow execution

  /**
   * Create a step execution log entry
   */
  async createStepLog(data: CreateStepLogData): Promise<ExecutionLog> {
    return this.prisma.executionLog.create({
      data: {
        orgId: data.orgId,
        userId: data.userId,
        flowId: data.flowId,
        executionId: data.executionId,
        stepKey: data.stepKey,
        inputs: data.inputs as unknown as Prisma.InputJsonValue,
        status: data.status || 'started',
        outputs: null,
        error: null,
      },
    });
  }

  /**
   * Update step log status and additional data
   */
  async updateStepStatus(
    logId: string,
    status: string,
    updates: StepLogUpdate = {},
  ): Promise<ExecutionLog> {
    return this.prisma.executionLog.update({
      where: { id: logId },
      data: {
        status,
        outputs: updates.outputs as Prisma.InputJsonValue,
        error: updates.error as Prisma.InputJsonValue,
      },
    });
  }

  /**
   * Mark step as started
   */
  async markStepStarted(
    orgId: string,
    userId: string,
    flowId: string,
    executionId: string,
    stepKey: string,
    inputs: StepInputData,
  ): Promise<ExecutionLog> {
    return this.createStepLog({
      orgId,
      userId,
      flowId,
      executionId,
      stepKey,
      inputs,
      status: 'started',
    });
  }

  /**
   * Mark step as completed
   */
  async markStepCompleted(logId: string, outputs: StepOutputData): Promise<ExecutionLog> {
    return this.updateStepStatus(logId, 'completed', { outputs });
  }

  /**
   * Mark step as failed
   */
  async markStepFailed(
    logId: string,
    error: Error | StepErrorData | unknown,
  ): Promise<ExecutionLog> {
    return this.updateStepStatus(logId, 'failed', {
      error: {
        message: (error as Error)?.message || 'Unknown error',
        code: (error as { code?: string })?.code,
        stack: (error as Error)?.stack,
        ...(typeof error === 'object' && error !== null ? error : {}),
      },
    });
  }

  /**
   * Mark step as skipped
   */
  async markStepSkipped(logId: string, reason?: string): Promise<ExecutionLog> {
    return this.updateStepStatus(logId, 'skipped', {
      outputs: reason ? { skipReason: reason } : undefined,
    });
  }

  /**
   * Get execution logs for a specific execution
   */
  async getExecutionLogs(executionId: string, tenant: TenantContext): Promise<ExecutionLog[]> {
    return this.prisma.executionLog.findMany({
      where: {
        executionId,
        orgId: tenant.orgId,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Get step logs by flow and execution
   */
  async getStepLogs(
    flowId: string,
    executionId: string,
    tenant: TenantContext,
  ): Promise<ExecutionLog[]> {
    return this.prisma.executionLog.findMany({
      where: {
        flowId,
        executionId,
        orgId: tenant.orgId,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Get aggregated execution statistics for metrics
   */
  async getExecutionStats(orgId: string, timeRange?: TimeRange): Promise<ExecutionStats> {
    const whereClause: ExecutionStatsWhereClause = { orgId };

    if (timeRange) {
      whereClause.createdAt = {
        gte: timeRange.from,
        lte: timeRange.to,
      };
    }

    const stats = await this.prisma.executionLog.groupBy({
      by: ['status'],
      where: whereClause,
      _count: {
        status: true,
      },
    });

    const totalExecutions = await this.prisma.executionLog.count({
      where: whereClause,
    });

    const result = {
      totalExecutions,
      completedSteps: 0,
      failedSteps: 0,
      skippedSteps: 0,
      avgExecutionTime: 0, // TODO: Calculate when duration is tracked
    };

    stats.forEach(stat => {
      switch (stat.status) {
        case 'completed':
          result.completedSteps = stat._count.status;
          break;
        case 'failed':
          result.failedSteps = stat._count.status;
          break;
        case 'skipped':
          result.skippedSteps = stat._count.status;
          break;
      }
    });

    return result;
  }
}
