import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ToolAuthController } from './tool-auth.controller';
import { AuthConfigService } from './auth-config.service';
import { MetricsService } from '../metrics/metrics.service';
import { CreateAuthConfigDto } from './dto/create-auth-config.dto';

describe('ToolAuthController', () => {
  let controller: ToolAuthController;
  let authConfigService: jest.Mocked<AuthConfigService>;
  let metricsService: jest.Mocked<MetricsService>;

  beforeEach(async () => {
    const mockAuthConfigService = {
      setOrgAuthConfig: jest.fn(),
      getOrgAuthConfig: jest.fn(),
      deleteOrgAuthConfig: jest.fn(),
    };

    const mockMetricsService = {
      incrementToolAuthConfig: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ToolAuthController],
      providers: [
        { provide: AuthConfigService, useValue: mockAuthConfigService },
        { provide: MetricsService, useValue: mockMetricsService },
      ],
    }).compile();

    controller = module.get<ToolAuthController>(ToolAuthController);
    authConfigService = module.get(AuthConfigService);
    metricsService = module.get(MetricsService);
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

      authConfigService.setOrgAuthConfig.mockResolvedValue(mockResult);

      await controller.upsert(orgId, toolId, dto);

      expect(metricsService.incrementToolAuthConfig).toHaveBeenCalledWith({
        orgId,
        toolKey: toolId,
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
      const mockConfig = { id: 'config-123', type: 'apiKey', config: { apiKey: 'masked****' } };

      authConfigService.getOrgAuthConfig.mockResolvedValue(mockConfig);

      await controller.get(orgId, toolId);

      expect(metricsService.incrementToolAuthConfig).toHaveBeenCalledWith({
        orgId,
        toolKey: toolId,
        action: 'get',
      });
    });
  });

  describe('remove', () => {
    it('should increment tool auth config metrics with delete action', async () => {
      const orgId = 'org-123';
      const toolId = 'github';

      authConfigService.deleteOrgAuthConfig.mockResolvedValue();

      await controller.remove(orgId, toolId);

      expect(metricsService.incrementToolAuthConfig).toHaveBeenCalledWith({
        orgId,
        toolKey: toolId,
        action: 'delete',
      });
    });
  });
});