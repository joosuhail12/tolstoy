import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ToolsController } from './tools.controller';
import { ToolsService } from './tools.service';
import { CreateToolDto } from './dto/create-tool.dto';
import { UpdateToolDto } from './dto/update-tool.dto';
import { TenantContext } from '../common/interfaces/tenant-context.interface';

describe('ToolsController', () => {
  let controller: ToolsController;
  let toolsService: jest.Mocked<ToolsService>;

  const mockTenantContext: TenantContext = {
    orgId: 'test-org-123',
    userId: 'test-user-456',
  };

  const mockTool = {
    id: 'tool-123',
    name: 'Test Tool',
    baseUrl: 'https://api.test.com',
    authType: 'apiKey',
    secretName: 'tool-secret-name',
    orgId: mockTenantContext.orgId,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const mockToolsService = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ToolsController],
      providers: [
        { provide: ToolsService, useValue: mockToolsService },
      ],
    }).compile();

    controller = module.get<ToolsController>(ToolsController);
    toolsService = module.get(ToolsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create a new tool successfully', async () => {
      const createToolDto: CreateToolDto = {
        name: 'Test Tool',
        baseUrl: 'https://api.test.com',
        authType: 'apiKey',
      };

      toolsService.create.mockResolvedValue(mockTool);

      const result = await controller.create(createToolDto, mockTenantContext);

      expect(result).toEqual(mockTool);
      expect(toolsService.create).toHaveBeenCalledWith(createToolDto, mockTenantContext);
    });

    it('should handle service errors during creation', async () => {
      const createToolDto: CreateToolDto = {
        name: 'Test Tool',
        baseUrl: 'https://api.test.com',
        authType: 'oauth',
      };

      toolsService.create.mockRejectedValue(new BadRequestException('Tool name already exists'));

      await expect(controller.create(createToolDto, mockTenantContext))
        .rejects.toThrow(BadRequestException);

      expect(toolsService.create).toHaveBeenCalledWith(createToolDto, mockTenantContext);
    });
  });

  describe('findAll', () => {
    it('should return array of tools for organization', async () => {
      const mockTools = [mockTool, { ...mockTool, id: 'tool-456', name: 'Another Tool' }];
      toolsService.findAll.mockResolvedValue(mockTools);

      const result = await controller.findAll(mockTenantContext);

      expect(result).toEqual(mockTools);
      expect(toolsService.findAll).toHaveBeenCalledWith(mockTenantContext);
    });

    it('should return empty array when no tools exist', async () => {
      toolsService.findAll.mockResolvedValue([]);

      const result = await controller.findAll(mockTenantContext);

      expect(result).toEqual([]);
      expect(toolsService.findAll).toHaveBeenCalledWith(mockTenantContext);
    });
  });

  describe('findOne', () => {
    it('should return a specific tool by ID', async () => {
      toolsService.findOne.mockResolvedValue(mockTool);

      const result = await controller.findOne('tool-123', mockTenantContext);

      expect(result).toEqual(mockTool);
      expect(toolsService.findOne).toHaveBeenCalledWith('tool-123', mockTenantContext);
    });

    it('should throw NotFoundException when tool does not exist', async () => {
      toolsService.findOne.mockRejectedValue(new NotFoundException('Tool not found'));

      await expect(controller.findOne('non-existent-tool', mockTenantContext))
        .rejects.toThrow(NotFoundException);

      expect(toolsService.findOne).toHaveBeenCalledWith('non-existent-tool', mockTenantContext);
    });
  });

  describe('update', () => {
    it('should update a tool successfully', async () => {
      const updateToolDto: UpdateToolDto = {
        name: 'Updated Tool Name',
        baseUrl: 'https://api.updated.com',
      };

      const updatedTool = { ...mockTool, ...updateToolDto };
      toolsService.update.mockResolvedValue(updatedTool);

      const result = await controller.update('tool-123', updateToolDto, mockTenantContext);

      expect(result).toEqual(updatedTool);
      expect(toolsService.update).toHaveBeenCalledWith('tool-123', updateToolDto, mockTenantContext);
    });

    it('should handle partial updates', async () => {
      const partialUpdateDto: UpdateToolDto = {
        name: 'Only Name Updated',
      };

      const updatedTool = { ...mockTool, name: partialUpdateDto.name };
      toolsService.update.mockResolvedValue(updatedTool);

      const result = await controller.update('tool-123', partialUpdateDto, mockTenantContext);

      expect(result).toEqual(updatedTool);
      expect(toolsService.update).toHaveBeenCalledWith('tool-123', partialUpdateDto, mockTenantContext);
    });

    it('should throw NotFoundException when updating non-existent tool', async () => {
      const updateDto: UpdateToolDto = { name: 'Updated Name' };
      toolsService.update.mockRejectedValue(new NotFoundException('Tool not found'));

      await expect(controller.update('non-existent-tool', updateDto, mockTenantContext))
        .rejects.toThrow(NotFoundException);

      expect(toolsService.update).toHaveBeenCalledWith('non-existent-tool', updateDto, mockTenantContext);
    });
  });

  describe('remove', () => {
    it('should remove a tool successfully', async () => {
      toolsService.remove.mockResolvedValue(undefined);

      await controller.remove('tool-123', mockTenantContext);

      expect(toolsService.remove).toHaveBeenCalledWith('tool-123', mockTenantContext);
    });

    it('should throw NotFoundException when removing non-existent tool', async () => {
      toolsService.remove.mockRejectedValue(new NotFoundException('Tool not found'));

      await expect(controller.remove('non-existent-tool', mockTenantContext))
        .rejects.toThrow(NotFoundException);

      expect(toolsService.remove).toHaveBeenCalledWith('non-existent-tool', mockTenantContext);
    });
  });

  describe('error handling', () => {
    it('should propagate service errors correctly', async () => {
      const serviceError = new BadRequestException('Service-level validation error');
      toolsService.create.mockRejectedValue(serviceError);

      const createDto: CreateToolDto = {
        name: 'Test Tool',
        baseUrl: 'https://api.test.com',
        authType: 'apiKey',
      };

      await expect(controller.create(createDto, mockTenantContext))
        .rejects.toThrow(BadRequestException);
    });

    it('should handle unexpected errors gracefully', async () => {
      const unexpectedError = new Error('Unexpected database error');
      toolsService.findAll.mockRejectedValue(unexpectedError);

      await expect(controller.findAll(mockTenantContext))
        .rejects.toThrow('Unexpected database error');
    });
  });

  describe('tenant context validation', () => {
    it('should work with valid tenant context', async () => {
      toolsService.findAll.mockResolvedValue([mockTool]);

      const result = await controller.findAll(mockTenantContext);

      expect(result).toEqual([mockTool]);
      expect(toolsService.findAll).toHaveBeenCalledWith(mockTenantContext);
    });

    it('should handle missing tenant context appropriately', async () => {
      const emptyTenantContext = {} as TenantContext;
      toolsService.findAll.mockResolvedValue([]);

      await controller.findAll(emptyTenantContext);

      expect(toolsService.findAll).toHaveBeenCalledWith(emptyTenantContext);
    });
  });
});