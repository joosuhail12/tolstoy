import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { Flow, Prisma } from '@prisma/client';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';
import { PrismaService } from '../prisma.service';
import { CreateFlowDto } from './dto/create-flow.dto';
import { UpdateFlowDto } from './dto/update-flow.dto';
import { TenantContext } from '../common/interfaces/tenant-context.interface';
import { RedisCacheService } from '../cache/redis-cache.service';
import CacheKeys from '../cache/cache-keys';

@Injectable()
export class FlowsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: RedisCacheService,
    @InjectPinoLogger(FlowsService.name)
    private readonly logger: PinoLogger,
  ) {}

  async create(createFlowDto: CreateFlowDto, tenant: TenantContext): Promise<Flow> {
    const flow = await this.prisma.flow.create({
      data: {
        version: createFlowDto.version,
        steps: createFlowDto.steps as unknown as Prisma.InputJsonValue,
        orgId: tenant.orgId,
      },
    });

    // Invalidate flow list cache since a new flow was added
    await this.cacheService.del(CacheKeys.flowList(tenant.orgId));

    this.logger.info(
      {
        flowId: flow.id,
        orgId: tenant.orgId,
        version: flow.version,
      },
      'Created new flow and invalidated flows list cache',
    );

    return flow;
  }

  async findAll(tenant: TenantContext): Promise<Flow[]> {
    const cacheKey = CacheKeys.flowList(tenant.orgId);

    // Try cache first
    const cached = await this.cacheService.get(cacheKey);
    if (cached && Array.isArray(cached)) {
      this.logger.debug({ orgId: tenant.orgId, cached: true }, 'Retrieved flows list from cache');
      return cached as any;
    }

    const flows = await this.prisma.flow.findMany({
      where: { orgId: tenant.orgId },
      include: {
        organization: {
          select: { id: true, name: true },
        },
        _count: {
          select: { executionLogs: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Cache the flows list
    await this.cacheService.set(cacheKey, flows, { ttl: CacheKeys.TTL.FLOWS });

    this.logger.debug(
      {
        orgId: tenant.orgId,
        flowCount: flows.length,
        cached: false,
      },
      'Retrieved and cached flows list',
    );

    return flows;
  }

  async findOne(id: string, tenant: TenantContext): Promise<Flow> {
    const cacheKey = CacheKeys.flow(tenant.orgId, id);

    // Try cache first
    const cached = await this.cacheService.get(cacheKey);
    if (cached && typeof cached === 'object' && cached !== null) {
      // Verify tenant access (security check even for cached data)
      if ((cached as any).orgId !== tenant.orgId) {
        throw new ForbiddenException('Access denied: Flow belongs to different organization');
      }

      this.logger.debug(
        { flowId: id, orgId: tenant.orgId, cached: true },
        'Retrieved flow from cache',
      );
      return cached as any;
    }

    const flow = await this.prisma.flow.findUnique({
      where: { id },
      include: {
        organization: {
          select: { id: true, name: true },
        },
        executionLogs: {
          select: {
            id: true,
            stepKey: true,
            status: true,
            createdAt: true,
            user: {
              select: { id: true, email: true },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 10, // Latest 10 execution logs
        },
      },
    });

    if (!flow) {
      throw new NotFoundException(`Flow with ID ${id} not found`);
    }

    if (flow.orgId !== tenant.orgId) {
      throw new ForbiddenException('Access denied: Flow belongs to different organization');
    }

    // Cache the flow
    await this.cacheService.set(cacheKey, flow, { ttl: CacheKeys.TTL.FLOWS });

    this.logger.debug(
      {
        flowId: id,
        orgId: tenant.orgId,
        version: flow.version,
        cached: false,
      },
      'Retrieved and cached flow',
    );

    return flow;
  }

  async update(id: string, updateFlowDto: UpdateFlowDto, tenant: TenantContext): Promise<Flow> {
    await this.findOne(id, tenant);

    try {
      const updatedFlow = await this.prisma.flow.update({
        where: { id },
        data: {
          version: updateFlowDto.version,
          steps: updateFlowDto.steps as unknown as Prisma.InputJsonValue,
        },
      });

      // Invalidate caches for this flow
      await this.invalidateFlowCaches(tenant.orgId, id);

      this.logger.info(
        {
          flowId: id,
          orgId: tenant.orgId,
          version: updatedFlow.version,
        },
        'Updated flow and invalidated caches',
      );

      return updatedFlow;
    } catch (error) {
      if (error instanceof Error && (error as any).code === 'P2025') {
        throw new NotFoundException(`Flow with ID ${id} not found`);
      }
      throw error;
    }
  }

  async remove(id: string, tenant: TenantContext): Promise<Flow> {
    await this.findOne(id, tenant);

    try {
      const deletedFlow = await this.prisma.flow.delete({
        where: { id },
      });

      // Invalidate caches for this flow
      await this.invalidateFlowCaches(tenant.orgId, id);

      this.logger.info(
        {
          flowId: id,
          orgId: tenant.orgId,
          version: deletedFlow.version,
        },
        'Deleted flow and invalidated caches',
      );

      return deletedFlow;
    } catch (error) {
      if (error instanceof Error && (error as any).code === 'P2025') {
        throw new NotFoundException(`Flow with ID ${id} not found`);
      }
      throw error;
    }
  }

  /**
   * Get flow definition optimized for execution (lighter payload)
   * Used by execution engine to avoid loading execution logs
   */
  async getFlowForExecution(id: string, orgId: string): Promise<Flow | null> {
    const cacheKey = CacheKeys.flow(orgId, id);

    // Try cache first
    const cached = await this.cacheService.get(cacheKey);
    if (cached && typeof cached === 'object' && cached !== null) {
      this.logger.debug(
        { flowId: id, orgId, cached: true },
        'Retrieved flow for execution from cache',
      );
      return cached as any;
    }

    const flow = await this.prisma.flow.findFirst({
      where: { id, orgId },
      include: {
        organization: {
          select: { id: true, name: true },
        },
      },
    });

    if (!flow) {
      return null;
    }

    // Cache the flow definition
    await this.cacheService.set(cacheKey, flow, { ttl: CacheKeys.TTL.FLOWS });

    this.logger.debug(
      {
        flowId: id,
        orgId,
        version: flow.version,
        cached: false,
      },
      'Retrieved and cached flow for execution',
    );

    return flow;
  }

  /**
   * Invalidate all caches related to a specific flow
   * @param orgId Organization ID
   * @param flowId Flow ID
   */
  private async invalidateFlowCaches(orgId: string, flowId: string): Promise<void> {
    try {
      // Invalidate individual flow and flows list caches
      await Promise.all([
        this.cacheService.del(CacheKeys.flow(orgId, flowId)),
        this.cacheService.del(CacheKeys.flowList(orgId)),
      ]);

      this.logger.debug({ orgId, flowId }, 'Invalidated flow caches');
    } catch (error) {
      this.logger.error(
        {
          orgId,
          flowId,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        'Failed to invalidate flow caches',
      );
    }
  }

  /**
   * Invalidate all flow-related caches for an organization
   * @param orgId Organization ID
   */
  async invalidateOrgFlowCaches(orgId: string): Promise<void> {
    try {
      const pattern = CacheKeys.flowsPattern(orgId);
      const deletedCount = await this.cacheService.delPattern(pattern);

      this.logger.info(
        {
          orgId,
          deletedKeys: deletedCount,
        },
        'Invalidated all flow caches for organization',
      );
    } catch (error) {
      this.logger.error(
        {
          orgId,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        'Failed to invalidate organization flow caches',
      );
    }
  }

  /**
   * Warm up cache for organization flows
   * @param orgId Organization ID
   */
  async warmupFlowsCache(orgId: string): Promise<void> {
    try {
      this.logger.info({ orgId }, 'Warming up flows cache');

      // This will populate the flows list cache
      const tenant = { orgId, userId: 'system' } as TenantContext;
      await this.findAll(tenant);

      this.logger.info({ orgId }, 'Flows cache warmup completed');
    } catch (error) {
      this.logger.error(
        {
          orgId,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        'Failed to warm up flows cache',
      );
    }
  }
}
