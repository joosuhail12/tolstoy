import { Test, TestingModule } from '@nestjs/testing';
import { Flow } from '@prisma/client';
import { FlowsService } from './flows.service';
import { PrismaService } from '../prisma.service';
import { RedisCacheService } from '../cache/redis-cache.service';
import { TenantContext } from '../common/interfaces/tenant-context.interface';
import { CreateFlowDto } from './dto/create-flow.dto';
import { UpdateFlowDto } from './dto/update-flow.dto';
import CacheKeys from '../cache/cache-keys';

describe('FlowsService - Cache Integration', () => {
  let service: FlowsService;
  let mockPrismaService: any;
  let mockFlowMethods: any;
  let mockCacheService: any;
  let mockLogger: any;

  const mockTenant: TenantContext = {
    orgId: 'org-123',
    userId: 'user-123',
  };

  const mockFlow: Flow = {
    id: 'flow-456',
    orgId: 'org-123',
    version: 1,
    steps: [{ id: 'step1', type: 'http_request' }],
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  } as any;

  const mockFlowWithRelations = {
    ...mockFlow,
    organization: { id: 'org-123', name: 'Test Org' },
    executionLogs: [
      {
        id: 'log-1',
        stepId: 'step1',
        status: 'completed',
        createdAt: new Date(),
        user: { id: 'user-1', email: 'test@example.com' },
      },
    ],
    _count: { executionLogs: 1 },
  };

  beforeEach(async () => {
    mockFlowMethods = {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    mockPrismaService = {
      flow: mockFlowMethods,
    } as any;

    // Set default return values
    mockFlowMethods.create.mockResolvedValue(mockFlow);
    mockFlowMethods.findMany.mockResolvedValue([mockFlowWithRelations]);
    mockFlowMethods.findUnique.mockResolvedValue(mockFlowWithRelations);
    mockFlowMethods.findFirst.mockResolvedValue(mockFlowWithRelations);
    mockFlowMethods.update.mockResolvedValue(mockFlow);
    mockFlowMethods.delete.mockResolvedValue(mockFlow);

    mockCacheService = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      delPattern: jest.fn(),
    } as any;

    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      error: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FlowsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: RedisCacheService,
          useValue: mockCacheService,
        },
        {
          provide: `PinoLogger:${FlowsService.name}`,
          useValue: mockLogger,
        },
      ],
    }).compile();

    service = module.get(FlowsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const createFlowDto: CreateFlowDto = {
      version: 1,
      steps: { step1: { type: 'http_request' } },
    };

    it('should create flow and invalidate flows list cache', async () => {
      mockFlowMethods.create.mockResolvedValue(mockFlow);
      mockCacheService.del.mockResolvedValue();

      const result = await service.create(createFlowDto, mockTenant);

      expect(mockFlowMethods.create).toHaveBeenCalledWith({
        data: {
          ...createFlowDto,
          orgId: mockTenant.orgId,
        },
      });
      expect(mockCacheService.del).toHaveBeenCalledWith(CacheKeys.flowList(mockTenant.orgId));
      expect(result).toEqual(mockFlow);
      expect(mockLogger.info).toHaveBeenCalledWith(
        {
          flowId: mockFlow.id,
          orgId: mockTenant.orgId,
          version: mockFlow.version,
        },
        'Created new flow and invalidated flows list cache',
      );
    });
  });

  describe('findAll', () => {
    it('should return cached flows list if available', async () => {
      const cachedFlows = [mockFlowWithRelations];
      mockCacheService.get.mockResolvedValue(cachedFlows);

      const result = await service.findAll(mockTenant);

      expect(mockCacheService.get).toHaveBeenCalledWith(CacheKeys.flowList(mockTenant.orgId));
      expect(mockFlowMethods.findMany).not.toHaveBeenCalled();
      expect(result).toEqual(cachedFlows);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        { orgId: mockTenant.orgId, cached: true },
        'Retrieved flows list from cache',
      );
    });

    it('should fetch from database and cache if not in cache', async () => {
      const flows = [mockFlowWithRelations];
      mockCacheService.get.mockResolvedValue(null);
      mockFlowMethods.findMany.mockResolvedValue(flows);
      mockCacheService.set.mockResolvedValue();

      const result = await service.findAll(mockTenant);

      expect(mockCacheService.get).toHaveBeenCalledWith(CacheKeys.flowList(mockTenant.orgId));
      expect(mockFlowMethods.findMany).toHaveBeenCalledWith({
        where: { orgId: mockTenant.orgId },
        include: {
          organization: { select: { id: true, name: true } },
          _count: { select: { executionLogs: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
      expect(mockCacheService.set).toHaveBeenCalledWith(
        CacheKeys.flowList(mockTenant.orgId),
        flows,
        { ttl: CacheKeys.TTL.FLOWS },
      );
      expect(result).toEqual(flows);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        { orgId: mockTenant.orgId, flowCount: 1, cached: false },
        'Retrieved and cached flows list',
      );
    });
  });

  describe('findOne', () => {
    const flowId = 'flow-456';

    it('should return cached flow if available', async () => {
      mockCacheService.get.mockResolvedValue(mockFlowWithRelations);

      const result = await service.findOne(flowId, mockTenant);

      expect(mockCacheService.get).toHaveBeenCalledWith(CacheKeys.flow(mockTenant.orgId, flowId));
      expect(mockFlowMethods.findUnique).not.toHaveBeenCalled();
      expect(result).toEqual(mockFlowWithRelations);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        { flowId, orgId: mockTenant.orgId, cached: true },
        'Retrieved flow from cache',
      );
    });

    it('should fetch from database and cache if not in cache', async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockFlowMethods.findUnique.mockResolvedValue(mockFlowWithRelations);
      mockCacheService.set.mockResolvedValue();

      const result = await service.findOne(flowId, mockTenant);

      expect(mockCacheService.get).toHaveBeenCalledWith(CacheKeys.flow(mockTenant.orgId, flowId));
      expect(mockFlowMethods.findUnique).toHaveBeenCalledWith({
        where: { id: flowId },
        include: {
          organization: { select: { id: true, name: true } },
          executionLogs: {
            select: {
              id: true,
              stepId: true,
              status: true,
              createdAt: true,
              user: { select: { id: true, email: true } },
            },
            orderBy: { createdAt: 'desc' },
            take: 10,
          },
        },
      });
      expect(mockCacheService.set).toHaveBeenCalledWith(
        CacheKeys.flow(mockTenant.orgId, flowId),
        mockFlowWithRelations,
        { ttl: CacheKeys.TTL.FLOWS },
      );
      expect(result).toEqual(mockFlowWithRelations);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        {
          flowId,
          orgId: mockTenant.orgId,
          version: mockFlowWithRelations.version,
          cached: false,
        },
        'Retrieved and cached flow',
      );
    });

    it('should throw error for non-existent flow', async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockFlowMethods.findUnique.mockResolvedValue(null);

      await expect(service.findOne(flowId, mockTenant)).rejects.toThrow(
        `Flow with ID ${flowId} not found`,
      );

      expect(mockCacheService.set).not.toHaveBeenCalled();
    });

    it('should throw error for flows from different organization', async () => {
      const wrongOrgFlow = { ...mockFlowWithRelations, orgId: 'wrong-org' };
      mockCacheService.get.mockResolvedValue(wrongOrgFlow);

      await expect(service.findOne(flowId, mockTenant)).rejects.toThrow(
        'Access denied: Flow belongs to different organization',
      );
    });

    it('should verify organization access for cached flows', async () => {
      const wrongOrgFlow = { ...mockFlowWithRelations, orgId: 'wrong-org' };
      mockCacheService.get.mockResolvedValue(wrongOrgFlow);

      await expect(service.findOne(flowId, mockTenant)).rejects.toThrow(
        'Access denied: Flow belongs to different organization',
      );

      expect(mockFlowMethods.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    const flowId = 'flow-456';
    const updateFlowDto: UpdateFlowDto = {
      version: 2,
      steps: { step1: { type: 'updated_request' } },
    };

    it('should update flow and invalidate caches', async () => {
      mockCacheService.get.mockResolvedValue(mockFlowWithRelations);
      const updatedFlow = { ...mockFlowWithRelations, ...updateFlowDto };
      mockFlowMethods.update.mockResolvedValue(updatedFlow);
      mockCacheService.del.mockResolvedValue();

      const result = await service.update(flowId, updateFlowDto, mockTenant);

      expect(mockFlowMethods.update).toHaveBeenCalledWith({
        where: { id: flowId },
        data: updateFlowDto,
      });
      expect(mockCacheService.del).toHaveBeenCalledTimes(2);
      expect(mockCacheService.del).toHaveBeenCalledWith(CacheKeys.flow(mockTenant.orgId, flowId));
      expect(mockCacheService.del).toHaveBeenCalledWith(CacheKeys.flowList(mockTenant.orgId));
      expect(result).toEqual(updatedFlow);
      expect(mockLogger.info).toHaveBeenCalledWith(
        {
          flowId,
          orgId: mockTenant.orgId,
          version: updatedFlow.version,
        },
        'Updated flow and invalidated caches',
      );
    });
  });

  describe('remove', () => {
    const flowId = 'flow-456';

    it('should delete flow and invalidate caches', async () => {
      mockCacheService.get.mockResolvedValue(mockFlowWithRelations);
      mockFlowMethods.delete.mockResolvedValue(mockFlow);
      mockCacheService.del.mockResolvedValue();

      const result = await service.remove(flowId, mockTenant);

      expect(mockFlowMethods.delete).toHaveBeenCalledWith({
        where: { id: flowId },
      });
      expect(mockCacheService.del).toHaveBeenCalledTimes(2);
      expect(mockCacheService.del).toHaveBeenCalledWith(CacheKeys.flow(mockTenant.orgId, flowId));
      expect(mockCacheService.del).toHaveBeenCalledWith(CacheKeys.flowList(mockTenant.orgId));
      expect(result).toEqual(mockFlow);
      expect(mockLogger.info).toHaveBeenCalledWith(
        {
          flowId,
          orgId: mockTenant.orgId,
          version: mockFlow.version,
        },
        'Deleted flow and invalidated caches',
      );
    });
  });

  describe('getFlowForExecution', () => {
    const flowId = 'flow-456';
    const orgId = 'org-123';

    it('should return cached flow for execution', async () => {
      const executionFlow = {
        ...mockFlow,
        organization: { id: orgId, name: 'Test Org' },
      };
      mockCacheService.get.mockResolvedValue(executionFlow);

      const result = await service.getFlowForExecution(flowId, orgId);

      expect(mockCacheService.get).toHaveBeenCalledWith(CacheKeys.flow(orgId, flowId));
      expect(mockFlowMethods.findFirst).not.toHaveBeenCalled();
      expect(result).toEqual(executionFlow);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        { flowId, orgId, cached: true },
        'Retrieved flow for execution from cache',
      );
    });

    it('should fetch and cache flow for execution', async () => {
      const executionFlow = {
        ...mockFlow,
        organization: { id: orgId, name: 'Test Org' },
      };
      mockCacheService.get.mockResolvedValue(null);
      mockFlowMethods.findFirst.mockResolvedValue(executionFlow);
      mockCacheService.set.mockResolvedValue();

      const result = await service.getFlowForExecution(flowId, orgId);

      expect(mockFlowMethods.findFirst).toHaveBeenCalledWith({
        where: { id: flowId, orgId },
        include: {
          organization: { select: { id: true, name: true } },
        },
      });
      expect(mockCacheService.set).toHaveBeenCalledWith(
        CacheKeys.flow(orgId, flowId),
        executionFlow,
        { ttl: CacheKeys.TTL.FLOWS },
      );
      expect(result).toEqual(executionFlow);
    });

    it('should return null for non-existent flow', async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockFlowMethods.findFirst.mockResolvedValue(null);

      const result = await service.getFlowForExecution(flowId, orgId);

      expect(result).toBeNull();
      expect(mockCacheService.set).not.toHaveBeenCalled();
    });
  });

  describe('bulk operations', () => {
    const orgId = 'org-123';

    describe('invalidateOrgFlowCaches', () => {
      it('should invalidate all flow caches for organization', async () => {
        const pattern = CacheKeys.flowsPattern(orgId);
        mockCacheService.delPattern.mockResolvedValue(10);

        await service.invalidateOrgFlowCaches(orgId);

        expect(mockCacheService.delPattern).toHaveBeenCalledWith(pattern);
        expect(mockLogger.info).toHaveBeenCalledWith(
          { orgId, deletedKeys: 10 },
          'Invalidated all flow caches for organization',
        );
      });

      it('should handle invalidation errors', async () => {
        mockCacheService.delPattern.mockRejectedValue(new Error('Bulk delete failed'));

        await service.invalidateOrgFlowCaches(orgId);

        expect(mockLogger.error).toHaveBeenCalledWith(
          { orgId, error: 'Bulk delete failed' },
          'Failed to invalidate organization flow caches',
        );
      });
    });

    describe('warmupFlowsCache', () => {
      it('should warm up flows cache', async () => {
        const flows = [mockFlowWithRelations];
        mockCacheService.get.mockResolvedValue(null);
        mockFlowMethods.findMany.mockResolvedValue(flows);
        mockCacheService.set.mockResolvedValue();

        await service.warmupFlowsCache(orgId);

        expect(mockFlowMethods.findMany).toHaveBeenCalled();
        expect(mockCacheService.set).toHaveBeenCalledWith(CacheKeys.flowList(orgId), flows, {
          ttl: CacheKeys.TTL.FLOWS,
        });
        expect(mockLogger.info).toHaveBeenCalledWith({ orgId }, 'Flows cache warmup completed');
      });

      it('should handle warmup errors', async () => {
        mockCacheService.get.mockRejectedValue(new Error('Cache error'));

        await service.warmupFlowsCache(orgId);

        expect(mockLogger.error).toHaveBeenCalledWith(
          { orgId, error: 'Cache error' },
          'Failed to warm up flows cache',
        );
      });
    });
  });
});
