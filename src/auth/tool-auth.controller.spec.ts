import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ToolAuthController } from './tool-auth.controller';
import { AuthConfigService } from './auth-config.service';
import { MetricsService } from '../metrics/metrics.service';
import { PrismaService } from '../prisma.service';
import { CreateAuthConfigDto } from './dto/create-auth-config.dto';

describe('ToolAuthController', () => {
  let controller: ToolAuthController;
  let authConfigService: jest.Mocked<AuthConfigService>;
  let metricsService: jest.Mocked<MetricsService>;
  let prismaService: any;

  beforeEach(async () => {
    const mockAuthConfigService = {
      setOrgAuthConfig: jest.fn(),
      getOrgAuthConfig: jest.fn(),
      deleteOrgAuthConfig: jest.fn(),
    };

    const mockMetricsService = {
      incrementToolAuthConfig: jest.fn(),
    };
    
    const mockPrismaService = {
      tool: {
        findUnique: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ToolAuthController],
      providers: [
        { provide: AuthConfigService, useValue: mockAuthConfigService },
        { provide: MetricsService, useValue: mockMetricsService },
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    controller = module.get<ToolAuthController>(ToolAuthController);
    authConfigService = module.get(AuthConfigService);
    metricsService = module.get(MetricsService);
    prismaService = module.get(PrismaService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('upsert', () => {
    it('should increment tool auth config metrics with upsert action', async () => {
      const orgId = 'org-123';
      const toolId = 'github';
      const dto: CreateAuthConfigDto = {
        type: 'apiKey',
        config: { apiKey: 'test-key', header: 'Authorization' },
      };
      const mockResult = {
        id: 'config-123',
        orgId,
        toolId,
        type: 'apiKey',
        config: dto.config,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Mock tool validation
      (prismaService.tool.findUnique as jest.Mock).mockResolvedValue({
        id: toolId,
        name: 'github',
        orgId,
      });
      authConfigService.setOrgAuthConfig.mockResolvedValue(mockResult);

      await controller.upsert(orgId, toolId, dto);

      expect(metricsService.incrementToolAuthConfig).toHaveBeenCalledWith({
        orgId,
        toolKey: 'github', // Should use tool name, not toolId
        action: 'upsert',
      });
    });

    it('should throw BadRequestException when orgId is missing', async () => {
      const dto: CreateAuthConfigDto = {
        type: 'apiKey',
        config: { apiKey: 'test-key' },
      };

      await expect(controller.upsert('', 'github', dto)).rejects.toThrow(BadRequestException);

      // Metrics should not be called if validation fails early
      expect(metricsService.incrementToolAuthConfig).not.toHaveBeenCalled();
    });
  });

  describe('get', () => {
    it('should increment tool auth config metrics with get action', async () => {
      const orgId = 'org-123';
      const toolId = 'github';
      const mockConfig = { 
        id: 'config-123', 
        orgId: 'org-123', 
        toolId: 'github', 
        type: 'apiKey', 
        config: { apiKey: 'masked****' },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Mock tool validation
      (prismaService.tool.findUnique as jest.Mock).mockResolvedValue({
        id: toolId,
        name: 'github',
        orgId,
      });
      authConfigService.getOrgAuthConfig.mockResolvedValue(mockConfig);

      await controller.get(orgId, toolId);

      expect(metricsService.incrementToolAuthConfig).toHaveBeenCalledWith({
        orgId,
        toolKey: 'github', // Should use tool name, not toolId
        action: 'get',
      });
    });
  });

  describe('remove', () => {
    it('should increment tool auth config metrics with delete action', async () => {
      const orgId = 'org-123';
      const toolId = 'github';

      // Mock tool validation
      (prismaService.tool.findUnique as jest.Mock).mockResolvedValue({
        id: toolId,
        name: 'github',
        orgId,
      });
      authConfigService.deleteOrgAuthConfig.mockResolvedValue();

      await controller.remove(orgId, toolId);

      expect(metricsService.incrementToolAuthConfig).toHaveBeenCalledWith({
        orgId,
        toolKey: 'github', // Should use tool name, not toolId
        action: 'delete',
      });
    });
  });
});
