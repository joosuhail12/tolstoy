import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';
import { CreateWebhookDto } from './dto/create-webhook.dto';
import { UpdateWebhookDto } from './dto/update-webhook.dto';
import { TenantContext } from '../common/interfaces/tenant-context.interface';

describe('WebhooksController', () => {
  let controller: WebhooksController;
  let webhooksService: jest.Mocked<WebhooksService>;
  let logger: any;

  const mockTenantContext: TenantContext = {
    orgId: 'test-org-123',
    userId: 'test-user-456',
  };

  const mockWebhook = {
    id: 'webhook-123',
    name: 'Test Webhook',
    url: 'https://api.test.com/webhook',
    eventTypes: ['flow.execution.completed', 'flow.execution.failed'],
    enabled: true,
    secret: 'webhook_secret_123',
    headers: {
      'X-API-Key': 'test-key',
    },
    orgId: mockTenantContext.orgId,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const mockWebhooksService = {
      create: jest.fn(),
      findAll: jest.fn(),
      findByEventType: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      toggle: jest.fn(),
      testWebhook: jest.fn(),
      getValidEventTypes: jest.fn(),
    };

    const mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [WebhooksController],
      providers: [
        { provide: WebhooksService, useValue: mockWebhooksService },
        { provide: `PinoLogger:WebhooksController`, useValue: mockLogger },
      ],
    }).compile();

    controller = module.get<WebhooksController>(WebhooksController);
    webhooksService = module.get(WebhooksService);
    logger = module.get('PinoLogger:WebhooksController');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create a new webhook successfully', async () => {
      const createWebhookDto: CreateWebhookDto = {
        name: 'Test Webhook',
        url: 'https://api.test.com/webhook',
        eventTypes: ['flow.execution.completed', 'flow.execution.failed'],
        enabled: true,
        secret: 'webhook_secret_123',
        headers: {
          'X-API-Key': 'test-key',
        },
      };

      webhooksService.create.mockResolvedValue(mockWebhook);

      const result = await controller.create(createWebhookDto, mockTenantContext);

      expect(result).toEqual(mockWebhook);
      expect(webhooksService.create).toHaveBeenCalledWith(createWebhookDto, mockTenantContext);
      expect(logger.info).toHaveBeenCalledWith(
        {
          orgId: mockTenantContext.orgId,
          url: createWebhookDto.url,
          eventTypes: createWebhookDto.eventTypes,
        },
        'Creating webhook',
      );
      expect(logger.info).toHaveBeenCalledWith(
        { orgId: mockTenantContext.orgId, webhookId: mockWebhook.id },
        'Webhook created successfully',
      );
    });

    it('should handle duplicate webhook URL error', async () => {
      const createWebhookDto: CreateWebhookDto = {
        name: 'Duplicate Webhook',
        url: 'https://api.existing.com/webhook',
        eventTypes: ['flow.execution.completed'],
      };

      webhooksService.create.mockRejectedValue(
        new BadRequestException(
          'Webhook with URL "https://api.existing.com/webhook" already exists',
        ),
      );

      await expect(controller.create(createWebhookDto, mockTenantContext)).rejects.toThrow(
        BadRequestException,
      );

      expect(webhooksService.create).toHaveBeenCalledWith(createWebhookDto, mockTenantContext);
      expect(logger.info).toHaveBeenCalledWith(
        {
          orgId: mockTenantContext.orgId,
          url: createWebhookDto.url,
          eventTypes: createWebhookDto.eventTypes,
        },
        'Creating webhook',
      );
    });

    it('should create webhook with minimal required fields', async () => {
      const minimalDto: CreateWebhookDto = {
        name: 'Minimal Webhook',
        url: 'https://api.minimal.com/webhook',
        eventTypes: ['user.created'],
      };

      const minimalWebhook = {
        ...mockWebhook,
        ...minimalDto,
        enabled: true, // default value
        secret: undefined,
        headers: undefined,
      };

      webhooksService.create.mockResolvedValue(minimalWebhook);

      const result = await controller.create(minimalDto, mockTenantContext);

      expect(result).toEqual(minimalWebhook);
      expect(webhooksService.create).toHaveBeenCalledWith(minimalDto, mockTenantContext);
    });
  });

  describe('findAll', () => {
    it('should return all webhooks for organization', async () => {
      const mockWebhooks = [
        mockWebhook,
        { ...mockWebhook, id: 'webhook-456', name: 'Another Webhook' },
      ];
      webhooksService.findAll.mockResolvedValue(mockWebhooks);

      const result = await controller.findAll(undefined, mockTenantContext);

      expect(result).toEqual(mockWebhooks);
      expect(webhooksService.findAll).toHaveBeenCalledWith(mockTenantContext);
    });

    it('should filter webhooks by event type', async () => {
      const eventType = 'flow.execution.completed';
      const filteredWebhooks = [mockWebhook];
      webhooksService.findByEventType.mockResolvedValue(filteredWebhooks);

      const result = await controller.findAll(eventType, mockTenantContext);

      expect(result).toEqual(filteredWebhooks);
      expect(webhooksService.findByEventType).toHaveBeenCalledWith(eventType, mockTenantContext);
      expect(webhooksService.findAll).not.toHaveBeenCalled();
    });

    it('should return empty array when no webhooks exist', async () => {
      webhooksService.findAll.mockResolvedValue([]);

      const result = await controller.findAll(undefined, mockTenantContext);

      expect(result).toEqual([]);
      expect(webhooksService.findAll).toHaveBeenCalledWith(mockTenantContext);
    });
  });

  describe('getValidEventTypes', () => {
    it('should return list of valid event types', async () => {
      const mockEventTypes = [
        'flow.execution.started',
        'flow.execution.completed',
        'flow.execution.failed',
        'user.created',
        'organization.updated',
      ];

      webhooksService.getValidEventTypes.mockReturnValue(mockEventTypes);

      const result = await controller.getValidEventTypes();

      expect(result).toEqual({
        eventTypes: mockEventTypes,
      });
      expect(webhooksService.getValidEventTypes).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return a specific webhook by ID', async () => {
      webhooksService.findOne.mockResolvedValue(mockWebhook);

      const result = await controller.findOne('webhook-123', mockTenantContext);

      expect(result).toEqual(mockWebhook);
      expect(webhooksService.findOne).toHaveBeenCalledWith('webhook-123', mockTenantContext);
    });

    it('should throw NotFoundException when webhook does not exist', async () => {
      webhooksService.findOne.mockRejectedValue(new NotFoundException('Webhook not found'));

      await expect(controller.findOne('non-existent-webhook', mockTenantContext)).rejects.toThrow(
        NotFoundException,
      );

      expect(webhooksService.findOne).toHaveBeenCalledWith(
        'non-existent-webhook',
        mockTenantContext,
      );
    });
  });

  describe('update', () => {
    it('should update a webhook successfully', async () => {
      const updateWebhookDto: UpdateWebhookDto = {
        name: 'Updated Webhook Name',
        url: 'https://api.updated.com/webhook',
        eventTypes: ['flow.execution.completed'],
      };

      const updatedWebhook = { ...mockWebhook, ...updateWebhookDto };
      webhooksService.update.mockResolvedValue(updatedWebhook);

      const result = await controller.update('webhook-123', updateWebhookDto, mockTenantContext);

      expect(result).toEqual(updatedWebhook);
      expect(webhooksService.update).toHaveBeenCalledWith(
        'webhook-123',
        updateWebhookDto,
        mockTenantContext,
      );
    });

    it('should handle partial updates', async () => {
      const partialUpdateDto: UpdateWebhookDto = {
        enabled: false,
      };

      const updatedWebhook = { ...mockWebhook, enabled: false };
      webhooksService.update.mockResolvedValue(updatedWebhook);

      const result = await controller.update('webhook-123', partialUpdateDto, mockTenantContext);

      expect(result).toEqual(updatedWebhook);
      expect(webhooksService.update).toHaveBeenCalledWith(
        'webhook-123',
        partialUpdateDto,
        mockTenantContext,
      );
    });

    it('should throw NotFoundException when updating non-existent webhook', async () => {
      const updateDto: UpdateWebhookDto = { name: 'Updated Name' };
      webhooksService.update.mockRejectedValue(new NotFoundException('Webhook not found'));

      await expect(
        controller.update('non-existent-webhook', updateDto, mockTenantContext),
      ).rejects.toThrow(NotFoundException);

      expect(webhooksService.update).toHaveBeenCalledWith(
        'non-existent-webhook',
        updateDto,
        mockTenantContext,
      );
    });
  });

  describe('remove', () => {
    it('should remove a webhook successfully', async () => {
      webhooksService.remove.mockResolvedValue(undefined);

      await controller.remove('webhook-123', mockTenantContext);

      expect(webhooksService.remove).toHaveBeenCalledWith('webhook-123', mockTenantContext);
      expect(logger.warn).toHaveBeenCalledWith(
        { webhookId: 'webhook-123', orgId: mockTenantContext.orgId },
        'Deleting webhook',
      );
      expect(logger.info).toHaveBeenCalledWith(
        { webhookId: 'webhook-123', orgId: mockTenantContext.orgId },
        'Webhook deleted successfully',
      );
    });

    it('should throw NotFoundException when removing non-existent webhook', async () => {
      webhooksService.remove.mockRejectedValue(new NotFoundException('Webhook not found'));

      await expect(controller.remove('non-existent-webhook', mockTenantContext)).rejects.toThrow(
        NotFoundException,
      );

      expect(webhooksService.remove).toHaveBeenCalledWith(
        'non-existent-webhook',
        mockTenantContext,
      );
      expect(logger.warn).toHaveBeenCalledWith(
        { webhookId: 'non-existent-webhook', orgId: mockTenantContext.orgId },
        'Deleting webhook',
      );
    });
  });

  describe('toggle', () => {
    it('should toggle webhook enabled status successfully', async () => {
      const toggleResult = {
        ...mockWebhook,
        enabled: false,
        updatedAt: new Date(),
      };

      webhooksService.toggle.mockResolvedValue(toggleResult);

      const result = await controller.toggle('webhook-123', mockTenantContext);

      expect(result).toEqual(toggleResult);
      expect(webhooksService.toggle).toHaveBeenCalledWith('webhook-123', mockTenantContext);
      expect(logger.info).toHaveBeenCalledWith(
        { webhookId: 'webhook-123', orgId: mockTenantContext.orgId },
        'Toggling webhook enabled status',
      );
      expect(logger.info).toHaveBeenCalledWith(
        { webhookId: 'webhook-123', orgId: mockTenantContext.orgId, enabled: false },
        'Webhook status toggled',
      );
    });

    it('should throw NotFoundException when toggling non-existent webhook', async () => {
      webhooksService.toggle.mockRejectedValue(new NotFoundException('Webhook not found'));

      await expect(controller.toggle('non-existent-webhook', mockTenantContext)).rejects.toThrow(
        NotFoundException,
      );

      expect(webhooksService.toggle).toHaveBeenCalledWith(
        'non-existent-webhook',
        mockTenantContext,
      );
    });
  });

  describe('testWebhook', () => {
    it('should test webhook successfully', async () => {
      const testResult = {
        success: true,
        statusCode: 200,
        message: 'Webhook test successful',
      };

      webhooksService.testWebhook.mockResolvedValue(testResult);

      const result = await controller.testWebhook('webhook-123', mockTenantContext);

      expect(result).toEqual(testResult);
      expect(webhooksService.testWebhook).toHaveBeenCalledWith('webhook-123', mockTenantContext);
      expect(logger.info).toHaveBeenCalledWith(
        { webhookId: 'webhook-123', orgId: mockTenantContext.orgId },
        'Testing webhook',
      );
      expect(logger.info).toHaveBeenCalledWith(
        { webhookId: 'webhook-123', orgId: mockTenantContext.orgId, success: true },
        'Webhook test completed',
      );
    });

    it('should handle webhook test failure', async () => {
      const testResult = {
        success: false,
        statusCode: 404,
        message: 'Webhook endpoint not found',
      };

      webhooksService.testWebhook.mockResolvedValue(testResult);

      const result = await controller.testWebhook('webhook-123', mockTenantContext);

      expect(result).toEqual(testResult);
      expect(webhooksService.testWebhook).toHaveBeenCalledWith('webhook-123', mockTenantContext);
      expect(logger.info).toHaveBeenCalledWith(
        { webhookId: 'webhook-123', orgId: mockTenantContext.orgId, success: false },
        'Webhook test completed',
      );
    });

    it('should throw NotFoundException when testing non-existent webhook', async () => {
      webhooksService.testWebhook.mockRejectedValue(new NotFoundException('Webhook not found'));

      await expect(
        controller.testWebhook('non-existent-webhook', mockTenantContext),
      ).rejects.toThrow(NotFoundException);

      expect(webhooksService.testWebhook).toHaveBeenCalledWith(
        'non-existent-webhook',
        mockTenantContext,
      );
    });
  });

  describe('error handling', () => {
    it('should propagate service errors correctly', async () => {
      const serviceError = new BadRequestException('Service-level validation error');
      webhooksService.create.mockRejectedValue(serviceError);

      const createDto: CreateWebhookDto = {
        name: 'Test Webhook',
        url: 'https://api.test.com/webhook',
        eventTypes: ['flow.execution.completed'],
      };

      await expect(controller.create(createDto, mockTenantContext)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should handle unexpected errors gracefully', async () => {
      const unexpectedError = new Error('Unexpected database error');
      webhooksService.findAll.mockRejectedValue(unexpectedError);

      await expect(controller.findAll(undefined, mockTenantContext)).rejects.toThrow(
        'Unexpected database error',
      );
    });
  });

  describe('logging', () => {
    it('should log webhook operations correctly', async () => {
      const createDto: CreateWebhookDto = {
        name: 'Test Webhook',
        url: 'https://api.test.com/webhook',
        eventTypes: ['flow.execution.completed'],
      };

      webhooksService.create.mockResolvedValue(mockWebhook);

      await controller.create(createDto, mockTenantContext);

      expect(logger.info).toHaveBeenCalledTimes(2);
      expect(logger.info).toHaveBeenNthCalledWith(
        1,
        {
          orgId: mockTenantContext.orgId,
          url: createDto.url,
          eventTypes: createDto.eventTypes,
        },
        'Creating webhook',
      );
      expect(logger.info).toHaveBeenNthCalledWith(
        2,
        { orgId: mockTenantContext.orgId, webhookId: mockWebhook.id },
        'Webhook created successfully',
      );
    });
  });
});
