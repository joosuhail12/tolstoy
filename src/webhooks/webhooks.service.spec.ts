import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { WebhooksService } from './webhooks.service';
import { PrismaService } from '../prisma.service';
import { CreateWebhookDto } from './dto/create-webhook.dto';

describe('WebhooksService', () => {
  let service: WebhooksService;
  let prisma: PrismaService;

  const mockPrisma = {
    webhook: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  const mockTenant = {
    orgId: 'org-123',
    userId: 'user-123',
  };

  const mockWebhook = {
    id: 'webhook-123',
    orgId: 'org-123',
    name: 'Test Webhook',
    url: 'https://example.com/webhook',
    eventTypes: ['flow.completed', 'step.failed'],
    enabled: true,
    secret: 'test-secret',
    headers: { 'X-Custom': 'value' },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhooksService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    service = module.get(WebhooksService);
    prisma = module.get(PrismaService);

    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const createDto: CreateWebhookDto = {
      name: 'Test Webhook',
      url: 'https://example.com/webhook',
      eventTypes: ['flow.completed'],
      enabled: true,
      secret: 'test-secret',
    };

    it('should create a webhook successfully', async () => {
      mockPrisma.webhook.findFirst.mockResolvedValue(null);
      mockPrisma.webhook.create.mockResolvedValue(mockWebhook);

      const result = await service.create(createDto, mockTenant);

      expect(result).toEqual(mockWebhook);
      expect(mockPrisma.webhook.findFirst).toHaveBeenCalledWith({
        where: {
          orgId: mockTenant.orgId,
          url: createDto.url,
        },
      });
      expect(mockPrisma.webhook.create).toHaveBeenCalledWith({
        data: {
          ...createDto,
          orgId: mockTenant.orgId,
          enabled: true,
        },
      });
    });

    it('should throw error for invalid event types', async () => {
      const invalidDto = {
        ...createDto,
        eventTypes: ['invalid.event'],
      };

      await expect(service.create(invalidDto, mockTenant)).rejects.toThrow(BadRequestException);
    });

    it('should throw error if webhook URL already exists', async () => {
      mockPrisma.webhook.findFirst.mockResolvedValue(mockWebhook);

      await expect(service.create(createDto, mockTenant)).rejects.toThrow(BadRequestException);
    });

    it('should use default enabled value if not provided', async () => {
      const dtoWithoutEnabled = {
        ...createDto,
        enabled: undefined,
      };
      mockPrisma.webhook.findFirst.mockResolvedValue(null);
      mockPrisma.webhook.create.mockResolvedValue(mockWebhook);

      await service.create(dtoWithoutEnabled, mockTenant);

      expect(mockPrisma.webhook.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          enabled: true,
        }),
      });
    });
  });

  describe('findAll', () => {
    it('should return all webhooks for organization', async () => {
      const webhooks = [mockWebhook];
      mockPrisma.webhook.findMany.mockResolvedValue(webhooks);

      const result = await service.findAll(mockTenant);

      expect(result).toEqual(webhooks);
      expect(mockPrisma.webhook.findMany).toHaveBeenCalledWith({
        where: { orgId: mockTenant.orgId },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('findByEventType', () => {
    it('should return webhooks filtered by event type', async () => {
      const webhooks = [mockWebhook];
      mockPrisma.webhook.findMany.mockResolvedValue(webhooks);

      const result = await service.findByEventType('flow.completed', mockTenant);

      expect(result).toEqual(webhooks);
      expect(mockPrisma.webhook.findMany).toHaveBeenCalledWith({
        where: {
          orgId: mockTenant.orgId,
          eventTypes: { has: 'flow.completed' },
          enabled: true,
        },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('findOne', () => {
    it('should return a webhook by id', async () => {
      mockPrisma.webhook.findUnique.mockResolvedValue(mockWebhook);

      const result = await service.findOne('webhook-123', mockTenant);

      expect(result).toEqual(mockWebhook);
      expect(mockPrisma.webhook.findUnique).toHaveBeenCalledWith({
        where: { id: 'webhook-123' },
      });
    });

    it('should throw NotFoundException if webhook not found', async () => {
      mockPrisma.webhook.findUnique.mockResolvedValue(null);

      await expect(service.findOne('webhook-123', mockTenant)).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if webhook belongs to different org', async () => {
      const differentOrgWebhook = { ...mockWebhook, orgId: 'org-456' };
      mockPrisma.webhook.findUnique.mockResolvedValue(differentOrgWebhook);

      await expect(service.findOne('webhook-123', mockTenant)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('update', () => {
    const updateDto = {
      name: 'Updated Webhook',
      eventTypes: ['flow.started'],
    };

    it('should update a webhook successfully', async () => {
      mockPrisma.webhook.findUnique.mockResolvedValue(mockWebhook);
      mockPrisma.webhook.update.mockResolvedValue({
        ...mockWebhook,
        ...updateDto,
      });

      const result = await service.update('webhook-123', updateDto, mockTenant);

      expect(result.name).toBe(updateDto.name);
      expect(mockPrisma.webhook.update).toHaveBeenCalledWith({
        where: { id: 'webhook-123' },
        data: updateDto,
      });
    });

    it('should validate event types on update', async () => {
      const invalidUpdateDto = {
        eventTypes: ['invalid.event'],
      };
      mockPrisma.webhook.findUnique.mockResolvedValue(mockWebhook);

      await expect(service.update('webhook-123', invalidUpdateDto, mockTenant)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should check for duplicate URL on update', async () => {
      const updateWithUrl = {
        url: 'https://new-url.com/webhook',
      };
      mockPrisma.webhook.findUnique.mockResolvedValue(mockWebhook);
      mockPrisma.webhook.findFirst.mockResolvedValue({ id: 'another-webhook' });

      await expect(service.update('webhook-123', updateWithUrl, mockTenant)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('remove', () => {
    it('should delete a webhook successfully', async () => {
      mockPrisma.webhook.findUnique.mockResolvedValue(mockWebhook);
      mockPrisma.webhook.delete.mockResolvedValue(mockWebhook);

      const result = await service.remove('webhook-123', mockTenant);

      expect(result).toEqual(mockWebhook);
      expect(mockPrisma.webhook.delete).toHaveBeenCalledWith({
        where: { id: 'webhook-123' },
      });
    });
  });

  describe('toggle', () => {
    it('should toggle webhook enabled status', async () => {
      mockPrisma.webhook.findUnique.mockResolvedValue(mockWebhook);
      mockPrisma.webhook.update.mockResolvedValue({
        ...mockWebhook,
        enabled: false,
      });

      const result = await service.toggle('webhook-123', mockTenant);

      expect(result.enabled).toBe(false);
      expect(mockPrisma.webhook.update).toHaveBeenCalledWith({
        where: { id: 'webhook-123' },
        data: { enabled: false },
      });
    });
  });

  describe('testWebhook', () => {
    it('should return success for enabled webhook', async () => {
      mockPrisma.webhook.findUnique.mockResolvedValue(mockWebhook);

      const result = await service.testWebhook('webhook-123', mockTenant);

      expect(result.success).toBe(true);
      expect(result.message).toContain(mockWebhook.url);
    });

    it('should throw error for disabled webhook', async () => {
      const disabledWebhook = { ...mockWebhook, enabled: false };
      mockPrisma.webhook.findUnique.mockResolvedValue(disabledWebhook);

      await expect(service.testWebhook('webhook-123', mockTenant)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('getValidEventTypes', () => {
    it('should return list of valid event types', () => {
      const eventTypes = service.getValidEventTypes();

      expect(Array.isArray(eventTypes)).toBe(true);
      expect(eventTypes).toContain('flow.completed');
      expect(eventTypes).toContain('step.failed');
    });
  });
});
