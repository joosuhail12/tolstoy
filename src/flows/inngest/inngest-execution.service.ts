import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { InngestService } from 'nestjs-inngest';
import { PrismaService } from '../../prisma.service';
import { TenantContext } from '../../common/interfaces/tenant-context.interface';
import { FlowStep } from '../flow-executor.service';

export interface InngestFlowExecution {
  executionId: string;
  flowId: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
}

/**
 * Inngest Execution Service
 *
 * Handles enqueueing flows for durable execution via Inngest.
 * Provides methods to start, monitor, and manage workflow executions.
 */
@Injectable()
export class InngestExecutionService {
  constructor(
    private readonly inngest: InngestService,
    private readonly prisma: PrismaService,
    @InjectPinoLogger(InngestExecutionService.name)
    private readonly logger: PinoLogger,
  ) {}

  /**
   * Start a flow execution using Inngest durable workflows
   */
  async executeFlow(
    flowId: string,
    tenant: TenantContext,
    inputVariables: any = {},
  ): Promise<InngestFlowExecution> {
    const executionId = this.generateExecutionId();

    this.logger.info(
      {
        flowId,
        executionId,
        orgId: tenant.orgId,
        userId: tenant.userId,
        variableCount: Object.keys(inputVariables).length,
      },
      'Enqueueing flow for durable execution',
    );

    // Fetch flow definition
    const flow = await this.prisma.flow.findUnique({
      where: { id: flowId, orgId: tenant.orgId },
    });

    if (!flow) {
      throw new Error(`Flow ${flowId} not found or access denied`);
    }

    // Parse flow steps
    const steps = this.parseFlowSteps(flow.steps);

    // Create execution log
    await this.prisma.executionLog.create({
      data: {
        id: executionId,
        flowId,
        orgId: tenant.orgId,
        userId: tenant.userId,
        executionId: executionId,
        stepKey: 'flow_start',
        status: 'queued',
        inputs: inputVariables,
        outputs: undefined,
      },
    });

    try {
      // Send event to Inngest for durable execution
      await this.inngest.send({
        name: 'flow.execute',
        data: {
          orgId: tenant.orgId,
          userId: tenant.userId,
          flowId,
          executionId,
          steps,
          variables: inputVariables,
        },
      });

      this.logger.info(
        {
          flowId,
          executionId,
          orgId: tenant.orgId,
          stepCount: steps.length,
        },
        'Flow enqueued successfully for durable execution',
      );

      return {
        executionId,
        flowId,
        status: 'queued',
      };
    } catch (error) {
      // Update execution log to failed if enqueueing fails
      await this.prisma.executionLog.update({
        where: { id: executionId },
        data: { status: 'failed' },
      });

      this.logger.error(
        {
          flowId,
          executionId,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        'Failed to enqueue flow for execution',
      );

      throw new Error(
        `Failed to start flow execution: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Get execution status and details
   */
  async getExecutionStatus(executionId: string, tenant: TenantContext): Promise<any> {
    const executionLog = await this.prisma.executionLog.findUnique({
      where: {
        id: executionId,
        orgId: tenant.orgId,
      },
    });

    if (!executionLog) {
      throw new Error(`Execution ${executionId} not found or access denied`);
    }

    return {
      executionId: executionLog.id,
      flowId: executionLog.flowId,
      status: executionLog.status,
      inputs: executionLog.inputs,
      outputs: executionLog.outputs,
      createdAt: executionLog.createdAt,
    };
  }

  /**
   * List executions for a specific flow
   */
  async getFlowExecutions(
    flowId: string,
    tenant: TenantContext,
    options: {
      limit?: number;
      offset?: number;
      status?: string;
    } = {},
  ): Promise<any[]> {
    const { limit = 50, offset = 0, status } = options;

    const whereClause: any = {
      flowId,
      orgId: tenant.orgId,
    };

    if (status) {
      whereClause.status = status;
    }

    const executions = await this.prisma.executionLog.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      include: {
        user: {
          select: { id: true, email: true },
        },
      },
    });

    return executions.map(execution => ({
      executionId: execution.id,
      flowId: execution.flowId,
      status: execution.status,
      userId: execution.userId,
      userEmail: execution.user?.email,
      inputs: execution.inputs,
      outputs: execution.outputs,
      createdAt: execution.createdAt,
    }));
  }

  /**
   * Cancel a running execution (if supported by Inngest)
   */
  async cancelExecution(executionId: string, tenant: TenantContext): Promise<void> {
    this.logger.warn(
      {
        executionId,
        orgId: tenant.orgId,
      },
      'Attempting to cancel execution',
    );

    // Update execution log to cancelled
    const updated = await this.prisma.executionLog.updateMany({
      where: {
        id: executionId,
        orgId: tenant.orgId,
        status: { in: ['queued', 'running'] },
      },
      data: { status: 'cancelled' },
    });

    if (updated.count === 0) {
      throw new Error(`Execution ${executionId} not found or cannot be cancelled`);
    }

    // Note: Actual Inngest function cancellation would require additional implementation
    // depending on the specific Inngest SDK features available

    this.logger.info(
      {
        executionId,
        orgId: tenant.orgId,
      },
      'Execution marked as cancelled',
    );
  }

  /**
   * Retry a failed execution
   */
  async retryExecution(executionId: string, tenant: TenantContext): Promise<InngestFlowExecution> {
    const originalExecution = await this.prisma.executionLog.findUnique({
      where: {
        id: executionId,
        orgId: tenant.orgId,
      },
    });

    if (!originalExecution) {
      throw new Error(`Execution ${executionId} not found or access denied`);
    }

    if (originalExecution.status !== 'failed') {
      throw new Error(`Execution ${executionId} is not in failed state`);
    }

    this.logger.info(
      {
        originalExecutionId: executionId,
        flowId: originalExecution.flowId,
        orgId: tenant.orgId,
      },
      'Retrying failed execution',
    );

    // Start a new execution with the same inputs
    return this.executeFlow(
      originalExecution.flowId,
      tenant,
      (originalExecution.inputs as any) || {},
    );
  }

  /**
   * Get execution metrics and statistics
   */
  async getExecutionMetrics(
    flowId: string,
    tenant: TenantContext,
    timeRange: {
      startDate?: Date;
      endDate?: Date;
    } = {},
  ): Promise<any> {
    const { startDate, endDate } = timeRange;

    const whereClause: any = {
      flowId,
      orgId: tenant.orgId,
    };

    if (startDate || endDate) {
      whereClause.createdAt = {};
      if (startDate) {
        whereClause.createdAt.gte = startDate;
      }
      if (endDate) {
        whereClause.createdAt.lte = endDate;
      }
    }

    const executions = await this.prisma.executionLog.groupBy({
      by: ['status'],
      where: whereClause,
      _count: {
        status: true,
      },
    });

    const totalCount = await this.prisma.executionLog.count({
      where: whereClause,
    });

    const statusCounts = executions.reduce((acc, item) => {
      acc[item.status] = item._count.status;
      return acc;
    }, {} as any);

    return {
      totalExecutions: totalCount,
      statusBreakdown: statusCounts,
      successRate: statusCounts.completed ? (statusCounts.completed / totalCount) * 100 : 0,
    };
  }

  private parseFlowSteps(stepsData: any): FlowStep[] {
    if (Array.isArray(stepsData)) {
      return stepsData;
    }

    if (typeof stepsData === 'string') {
      return JSON.parse(stepsData);
    }

    return [];
  }

  private generateExecutionId(): string {
    return `exec_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  }
}
