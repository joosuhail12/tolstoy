import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ToolSecretsController, ToolSecretsListController } from './tool-secrets.controller';
import { ToolSecretsService } from './tool-secrets.service';

describe('ToolSecretsController', () => {
  let controller: ToolSecretsController;
  let listController: ToolSecretsListController;
  let service: any;

  const mockStoredCredentials = {
    toolId: 'tool-123',
    toolName: 'Test API Tool',
    credentials: {
      api_key: 'sk-test-key-123456789',
      client_secret: 'cs-secret-987654321',
    },
    maskedCredentials: {
      api_key: 'sk-t***********6789',
      client_secret: 'cs-s***********4321',
    },
    createdAt: new Date('2023-01-01'),
    updatedAt: new Date('2023-01-02'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ToolSecretsController, ToolSecretsListController],
      providers: [
        {
          provide: ToolSecretsService,
          useValue: {
            storeCredentials: jest.fn(),
            getCredentials: jest.fn(),
            deleteCredentials: jest.fn(),
            listToolsWithCredentials: jest.fn(),
          },
        },
        {
          provide: `PinoLogger:${ToolSecretsController.name}`,
          useValue: {
            info: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn(),
          },
        },
        {
          provide: `PinoLogger:${ToolSecretsListController.name}`,
          useValue: {
            info: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(ToolSecretsController);
    listController = module.get(ToolSecretsListController);
    service = module.get(ToolSecretsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
    expect(listController).toBeDefined();
  });

  describe('storeCredentials', () => {
    it('should store credentials and return masked response', async () => {
      service.storeCredentials.mockResolvedValue(mockStoredCredentials);

      const dto = {
        credentials: {
          api_key: 'sk-test-key-123456789',
          client_secret: 'cs-secret-987654321',
        },
      };

      const result = await controller.storeCredentials('tool-123', dto, 'org-123');

      expect(service.storeCredentials).toHaveBeenCalledWith('org-123', 'tool-123', dto.credentials);
      expect(result).toEqual({
        toolId: 'tool-123',
        toolName: 'Test API Tool',
        maskedCredentials: mockStoredCredentials.maskedCredentials,
        createdAt: mockStoredCredentials.createdAt,
        updatedAt: mockStoredCredentials.updatedAt,
      });
      expect(result).not.toHaveProperty('credentials');
    });

    it('should handle service validation errors', async () => {
      service.storeCredentials.mockRejectedValue(
        new BadRequestException('Credentials cannot be empty'),
      );

      const dto = { credentials: {} };

      await expect(controller.storeCredentials('tool-123', dto, 'org-123')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should handle tool not found errors', async () => {
      service.storeCredentials.mockRejectedValue(
        new NotFoundException('Tool tool-123 not found in organization org-123'),
      );

      const dto = {
        credentials: { api_key: 'test-key' },
      };

      await expect(controller.storeCredentials('tool-123', dto, 'org-123')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getCredentials', () => {
    it('should return masked credentials by default', async () => {
      service.getCredentials.mockResolvedValue(mockStoredCredentials);

      const result = await controller.getCredentials('tool-123', 'org-123', undefined);

      expect(service.getCredentials).toHaveBeenCalledWith('org-123', 'tool-123', true);
      expect(result).toEqual({
        toolId: 'tool-123',
        toolName: 'Test API Tool',
        maskedCredentials: mockStoredCredentials.maskedCredentials,
        createdAt: mockStoredCredentials.createdAt,
        updatedAt: mockStoredCredentials.updatedAt,
      });
    });

    it('should return full credentials when unmask=true', async () => {
      service.getCredentials.mockResolvedValue(mockStoredCredentials);

      const result = await controller.getCredentials('tool-123', 'org-123', 'true');

      expect(service.getCredentials).toHaveBeenCalledWith('org-123', 'tool-123', false);
      expect(result).toEqual(mockStoredCredentials);
    });

    it('should return masked credentials when unmask=false', async () => {
      service.getCredentials.mockResolvedValue(mockStoredCredentials);

      const result = await controller.getCredentials('tool-123', 'org-123', 'false');

      expect(service.getCredentials).toHaveBeenCalledWith('org-123', 'tool-123', true);
      expect(result).toEqual({
        toolId: 'tool-123',
        toolName: 'Test API Tool',
        maskedCredentials: mockStoredCredentials.maskedCredentials,
        createdAt: mockStoredCredentials.createdAt,
        updatedAt: mockStoredCredentials.updatedAt,
      });
    });

    it('should handle tool not found errors', async () => {
      service.getCredentials.mockRejectedValue(
        new NotFoundException('Tool tool-123 not found in organization org-123'),
      );

      await expect(controller.getCredentials('tool-123', 'org-123', undefined)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should handle no credentials stored errors', async () => {
      service.getCredentials.mockRejectedValue(
        new NotFoundException('No credentials stored for tool tool-123'),
      );

      await expect(controller.getCredentials('tool-123', 'org-123', undefined)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('deleteCredentials', () => {
    it('should delete credentials successfully', async () => {
      service.deleteCredentials.mockResolvedValue();

      await controller.deleteCredentials('tool-123', 'org-123');

      expect(service.deleteCredentials).toHaveBeenCalledWith('org-123', 'tool-123');
    });

    it('should handle tool not found errors', async () => {
      service.deleteCredentials.mockRejectedValue(
        new NotFoundException('Tool tool-123 not found in organization org-123'),
      );

      await expect(controller.deleteCredentials('tool-123', 'org-123')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should handle no credentials stored errors', async () => {
      service.deleteCredentials.mockRejectedValue(
        new NotFoundException('No credentials stored for tool tool-123'),
      );

      await expect(controller.deleteCredentials('tool-123', 'org-123')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});

describe('ToolSecretsListController', () => {
  let controller: ToolSecretsListController;
  let service: any;

  const mockToolsList = [
    {
      toolId: 'tool-123',
      toolName: 'API Tool',
      baseUrl: 'https://api.example.com',
      authType: 'bearer',
      hasCredentials: true,
      credentialKeys: ['api_key', 'client_secret'],
    },
    {
      toolId: 'tool-456',
      toolName: 'Another Tool',
      baseUrl: 'https://api2.example.com',
      authType: 'oauth',
      hasCredentials: false,
    },
  ];

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ToolSecretsListController],
      providers: [
        {
          provide: ToolSecretsService,
          useValue: {
            listToolsWithCredentials: jest.fn(),
          },
        },
        {
          provide: `PinoLogger:${ToolSecretsListController.name}`,
          useValue: {
            info: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(ToolSecretsListController);
    service = module.get(ToolSecretsService);
  });

  describe('listToolsWithCredentials', () => {
    it('should return list of tools with credential status', async () => {
      service.listToolsWithCredentials.mockResolvedValue(mockToolsList);

      const result = await controller.listToolsWithCredentials('org-123');

      expect(service.listToolsWithCredentials).toHaveBeenCalledWith('org-123');
      expect(result).toEqual(mockToolsList);
      expect(result).toHaveLength(2);
      expect(result[0].hasCredentials).toBe(true);
      expect(result[1].hasCredentials).toBe(false);
    });

    it('should handle empty tools list', async () => {
      service.listToolsWithCredentials.mockResolvedValue([]);

      const result = await controller.listToolsWithCredentials('org-123');

      expect(result).toEqual([]);
    });

    it('should handle service errors', async () => {
      service.listToolsWithCredentials.mockRejectedValue(new Error('Database connection failed'));

      await expect(controller.listToolsWithCredentials('org-123')).rejects.toThrow(
        'Database connection failed',
      );
    });
  });
});
