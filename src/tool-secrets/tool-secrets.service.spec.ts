import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ToolSecretsService, ToolCredentials } from './tool-secrets.service';
import { PrismaService } from '../prisma.service';
import { AwsSecretsService } from '../aws-secrets.service';
import { PinoLogger } from 'nestjs-pino';

describe('ToolSecretsService', () => {
  let service: ToolSecretsService;
  let prismaService: any;
  let awsSecretsService: any;

  const mockTool = {
    id: 'tool-123',
    orgId: 'org-123',
    name: 'Test API Tool',
    baseUrl: 'https://api.example.com',
    authType: 'bearer',
    secretName: 'tolstoy/org-123/tool-123',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockCredentials: ToolCredentials = {
    api_key: 'sk-test-key-123456789',
    client_secret: 'cs-secret-987654321',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ToolSecretsService,
        {
          provide: PrismaService,
          useValue: {
            tool: {
              findFirst: jest.fn(),
              update: jest.fn(),
              findMany: jest.fn(),
            },
          },
        },
        {
          provide: AwsSecretsService,
          useValue: {
            secretExists: jest.fn(),
            createSecret: jest.fn(),
            updateSecret: jest.fn(),
            getSecretAsJson: jest.fn(),
            deleteSecret: jest.fn(),
          },
        },
        {
          provide: `PinoLogger:${ToolSecretsService.name}`,
          useValue: {
            info: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(ToolSecretsService);
    prismaService = module.get(PrismaService);
    awsSecretsService = module.get(AwsSecretsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('storeCredentials', () => {
    it('should store new credentials successfully', async () => {
      prismaService.tool.findFirst.mockResolvedValue(mockTool);
      awsSecretsService.secretExists.mockResolvedValue(false);
      awsSecretsService.createSecret.mockResolvedValue();
      prismaService.tool.update.mockResolvedValue({
        ...mockTool,
        secretName: 'tolstoy/org-123/tool-123',
      });

      const result = await service.storeCredentials('org-123', 'tool-123', mockCredentials);

      expect(result.toolId).toBe('tool-123');
      expect(result.toolName).toBe('Test API Tool');
      expect(result.maskedCredentials.api_key).toBe('sk-t*************6789');
      expect(result.maskedCredentials.client_secret).toBe('cs-s***********4321');
      expect(awsSecretsService.createSecret).toHaveBeenCalledWith(
        'tolstoy/org-123/tool-123',
        mockCredentials,
        'Tool credentials for Test API Tool in organization org-123',
      );
    });

    it('should update existing credentials', async () => {
      prismaService.tool.findFirst.mockResolvedValue(mockTool);
      awsSecretsService.secretExists.mockResolvedValue(true);
      awsSecretsService.updateSecret.mockResolvedValue();
      prismaService.tool.update.mockResolvedValue(mockTool);

      const result = await service.storeCredentials('org-123', 'tool-123', mockCredentials);

      expect(result.toolId).toBe('tool-123');
      expect(awsSecretsService.updateSecret).toHaveBeenCalledWith(
        'tolstoy/org-123/tool-123',
        mockCredentials,
      );
    });

    it('should throw NotFoundException for non-existent tool', async () => {
      prismaService.tool.findFirst.mockResolvedValue(null);

      await expect(
        service.storeCredentials('org-123', 'tool-123', mockCredentials),
      ).rejects.toThrow(NotFoundException);
    });

    it('should validate credentials format', async () => {
      const invalidCredentials = {};

      await expect(
        service.storeCredentials('org-123', 'tool-123', invalidCredentials),
      ).rejects.toThrow(BadRequestException);
    });

    it('should validate credential key length for sensitive fields', async () => {
      const shortCredentials = { api_key: '123' };

      await expect(
        service.storeCredentials('org-123', 'tool-123', shortCredentials),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getCredentials', () => {
    it('should retrieve and mask credentials by default', async () => {
      prismaService.tool.findFirst.mockResolvedValue(mockTool);
      awsSecretsService.getSecretAsJson.mockResolvedValue(mockCredentials);

      const result = await service.getCredentials('org-123', 'tool-123');

      expect(result.toolId).toBe('tool-123');
      expect(result.credentials).toEqual({});
      expect(result.maskedCredentials.api_key).toBe('sk-t*************6789');
    });

    it('should retrieve unmasked credentials when requested', async () => {
      prismaService.tool.findFirst.mockResolvedValue(mockTool);
      awsSecretsService.getSecretAsJson.mockResolvedValue(mockCredentials);

      const result = await service.getCredentials('org-123', 'tool-123', false);

      expect(result.credentials).toEqual(mockCredentials);
    });

    it('should throw NotFoundException for tool without credentials', async () => {
      const toolWithoutSecret = { ...mockTool, secretName: null };
      prismaService.tool.findFirst.mockResolvedValue(toolWithoutSecret);

      await expect(service.getCredentials('org-123', 'tool-123')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('deleteCredentials', () => {
    it('should delete credentials successfully', async () => {
      prismaService.tool.findFirst.mockResolvedValue(mockTool);
      awsSecretsService.deleteSecret.mockResolvedValue();
      prismaService.tool.update.mockResolvedValue({ ...mockTool, secretName: null });

      await service.deleteCredentials('org-123', 'tool-123');

      expect(awsSecretsService.deleteSecret).toHaveBeenCalledWith(
        'tolstoy/org-123/tool-123',
        false,
      );
      expect(prismaService.tool.update).toHaveBeenCalledWith({
        where: { id: 'tool-123' },
        data: { secretName: null },
      });
    });

    it('should throw NotFoundException for non-existent tool', async () => {
      prismaService.tool.findFirst.mockResolvedValue(null);

      await expect(service.deleteCredentials('org-123', 'tool-123')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('listToolsWithCredentials', () => {
    it('should list tools with credential status', async () => {
      const tools = [
        { ...mockTool, secretName: 'tolstoy/org-123/tool-123' },
        {
          id: 'tool-456',
          name: 'Tool Without Credentials',
          baseUrl: 'https://api2.example.com',
          authType: 'oauth',
          secretName: null,
        },
      ];

      prismaService.tool.findMany.mockResolvedValue(tools);
      awsSecretsService.getSecretAsJson.mockResolvedValue(mockCredentials);

      const result = await service.listToolsWithCredentials('org-123');

      expect(result).toHaveLength(2);
      expect(result[0].hasCredentials).toBe(true);
      expect(result[0].credentialKeys).toEqual(['api_key', 'client_secret']);
      expect(result[1].hasCredentials).toBe(false);
      expect(result[1].credentialKeys).toBeUndefined();
    });
  });

  describe('credential masking', () => {
    it('should mask short credentials', () => {
      const shortValue = '123';
      const masked = service['maskCredential'](shortValue);
      expect(masked).toBe('***');
    });

    it('should mask long credentials properly', () => {
      const longValue = 'sk-1234567890abcdef';
      const masked = service['maskCredential'](longValue);
      expect(masked).toBe('sk-1***********cdef');
    });

    it('should mask empty or null values', () => {
      expect(service['maskCredential']('')).toBe('***');
      expect(service['maskCredential'](null as any)).toBe('***');
      expect(service['maskCredential'](undefined as any)).toBe('***');
    });
  });

  describe('secret name generation', () => {
    it('should generate correct secret name format', () => {
      const secretName = service['generateSecretName']('org-456', 'tool-789');
      expect(secretName).toBe('tolstoy/org-456/tool-789');
    });
  });

  describe('validation', () => {
    it('should reject non-object credentials', () => {
      expect(() => service['validateCredentials']('string' as any)).toThrow(BadRequestException);
      expect(() => service['validateCredentials'](null as any)).toThrow(BadRequestException);
      expect(() => service['validateCredentials'](123 as any)).toThrow(BadRequestException);
    });

    it('should reject empty credentials object', () => {
      expect(() => service['validateCredentials']({})).toThrow(BadRequestException);
    });

    it('should reject invalid credential keys', () => {
      expect(() => service['validateCredentials']({ '': 'value' })).toThrow(BadRequestException);
      expect(() => service['validateCredentials']({ '  ': 'value' })).toThrow(BadRequestException);
    });

    it('should reject invalid credential values', () => {
      expect(() => service['validateCredentials']({ key: '' })).toThrow(BadRequestException);
      expect(() => service['validateCredentials']({ key: '  ' })).toThrow(BadRequestException);
      expect(() => service['validateCredentials']({ key: null as any })).toThrow(
        BadRequestException,
      );
    });
  });
});
