import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { ActionsService } from './actions.service';
import { PrismaService } from '../prisma.service';
import { InputValidatorService } from '../common/services/input-validator.service';
import { AuthConfigService } from '../auth/auth-config.service';
import { MetricsService } from '../metrics/metrics.service';
import { DaytonaService } from '../daytona/daytona.service';

// ActionsService now uses DaytonaService for HTTP requests

describe('ActionsService', () => {
  let service: ActionsService;
  let prismaService: any;
  let inputValidator: any;
  let authConfig: any;
  let metricsService: any;
  let daytonaService: any;

  const mockAction = {
    id: 'action-123',
    key: 'send-email',
    name: 'Send Email',
    orgId: 'org-456',
    toolId: 'tool-789',
    method: 'POST',
    endpoint: '/api/send',
    headers: { 'X-Custom': 'header' },
    inputSchema: [
      {
        name: 'to',
        label: 'To Email',
        type: 'string',
        required: true,
        control: 'text',
      },
      {
        name: 'subject',
        label: 'Subject',
        type: 'string',
        required: true,
        control: 'text',
      },
    ],
    tool: {
      id: 'tool-789',
      name: 'email-service',
      baseUrl: 'https://api.email.com',
      orgId: 'org-456',
    },
  };

  const mockTenant = {
    orgId: 'org-456',
    userId: 'user-123',
  };

  beforeEach(async () => {
    const mockPrismaService = {
      action: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      tool: {
        findUnique: jest.fn(),
      },
      actionExecutionLog: {
        create: jest.fn().mockResolvedValue({ id: 'exec-log-123' }),
        update: jest.fn(),
      },
    };

    const mockInputValidator = {
      validateEnhanced: jest.fn(),
    };

    const mockAuthConfig = {
      getOrgAuthConfig: jest.fn(),
      getUserCredentials: jest.fn(),
      refreshUserToken: jest.fn(),
    };

    const mockMetricsService = {
      actionExecutionCounter: {
        inc: jest.fn(),
      },
      actionExecutionDuration: {
        observe: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ActionsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: InputValidatorService, useValue: mockInputValidator },
        { provide: AuthConfigService, useValue: mockAuthConfig },
        { provide: MetricsService, useValue: mockMetricsService },
        {
          provide: DaytonaService,
          useValue: {
            executeHttpRequest: jest.fn().mockResolvedValue({
              success: true,
              statusCode: 200,
              data: { result: 'success' },
              duration: 100,
            }),
          },
        },
      ],
    }).compile();

    service = module.get<ActionsService>(ActionsService);
    prismaService = module.get(PrismaService);
    inputValidator = module.get(InputValidatorService);
    authConfig = module.get(AuthConfigService);
    metricsService = module.get(MetricsService);
    daytonaService = module.get(DaytonaService);

    // Reset mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('executeAction', () => {
    const validInputs = {
      to: 'test@example.com',
      subject: 'Test Email',
    };

    beforeEach(() => {
      // Default mocks for successful execution
      prismaService.action.findFirst.mockResolvedValue(mockAction);
      inputValidator.validateEnhanced.mockResolvedValue(validInputs);
      daytonaService.executeHttpRequest.mockResolvedValue({
        success: true,
        statusCode: 200,
        data: { success: true },
        duration: 100,
      });
    });

    it('should execute action successfully with API key authentication', async () => {
      const apiKeyConfig = {
        type: 'apiKey',
        config: {
          apiKey: 'secret-key-123',
          headerName: 'Authorization',
          headerValue: 'Bearer secret-key-123',
        },
      };

      daytonaService.executeHttpRequest.mockResolvedValue({
        success: true,
        statusCode: 200,
        data: { success: true },
        duration: 100,
      });

      authConfig.getOrgAuthConfig.mockResolvedValue(apiKeyConfig);

      const result = await service.executeAction('org-456', 'user-123', 'send-email', validInputs);

      expect(result).toMatchObject({
        success: true,
        data: { success: true },
        outputs: expect.objectContaining({
          orgId: 'org-456',
        }),
      });

      // Verify action was loaded correctly
      expect(prismaService.action.findFirst).toHaveBeenCalledWith({
        where: { orgId: 'org-456', key: 'send-email' },
        include: { tool: true },
      });

      // Verify input validation
      expect(inputValidator.validateEnhanced).toHaveBeenCalledWith(
        mockAction.inputSchema,
        validInputs,
        {
          orgId: 'org-456',
          actionKey: 'send-email',
          contextType: 'action-execution',
        },
      );

      // Verify API key auth was applied
      expect(authConfig.getOrgAuthConfig).toHaveBeenCalledWith('org-456', 'email-service');

      // Verify HTTP request through Daytona
      expect(daytonaService.executeHttpRequest).toHaveBeenCalledWith({
        url: 'https://api.email.com/api/send',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Custom': 'header',
          Authorization: 'Bearer secret-key-123',
        },
        body: JSON.stringify(validInputs),
        timeout: 30000,
      });

      // Verify metrics
      expect(metricsService.actionExecutionCounter.inc).toHaveBeenCalledWith({
        orgId: 'org-456',
        toolKey: 'email-service',
        actionKey: 'send-email',
        status: 'started',
      });

      expect(metricsService.actionExecutionCounter.inc).toHaveBeenCalledWith({
        orgId: 'org-456',
        toolKey: 'email-service',
        actionKey: 'send-email',
        status: 'success',
      });

      expect(metricsService.actionExecutionDuration.observe).toHaveBeenCalled();
    });

    it('should execute action with OAuth2 authentication', async () => {
      const oauth2Config = {
        type: 'oauth2',
        config: {
          clientId: 'client-123',
          clientSecret: 'secret-456',
        },
      };

      const userCredential = {
        id: 'cred-123',
        accessToken: 'oauth-token-123',
        refreshToken: 'refresh-token-123',
        expiresAt: new Date(Date.now() + 3600000),
      };

      authConfig.getOrgAuthConfig.mockResolvedValue(oauth2Config);
      authConfig.getUserCredentials.mockResolvedValue(userCredential);
      authConfig.refreshUserToken.mockResolvedValue('oauth-token-123');

      const result = await service.executeAction('org-456', 'user-123', 'send-email', validInputs);

      expect(result.success).toBe(true);

      // Verify OAuth flow
      expect(authConfig.getUserCredentials).toHaveBeenCalledWith(
        'org-456',
        'user-123',
        'email-service',
      );
      expect(authConfig.refreshUserToken).toHaveBeenCalledWith(userCredential);

      // Verify OAuth token was used
      expect(daytonaService.executeHttpRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer oauth-token-123',
          }),
        }),
      );
    });

    it('should execute action without authentication when no auth config', async () => {
      authConfig.getOrgAuthConfig.mockRejectedValue(new NotFoundException('No auth config'));

      const result = await service.executeAction('org-456', 'user-123', 'send-email', validInputs);

      expect(result.success).toBe(true);

      // Verify no auth headers were added (except Content-Type and custom headers)
      expect(daytonaService.executeHttpRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: {
            'Content-Type': 'application/json',
            'X-Custom': 'header',
          },
        }),
      );
    });

    it('should execute OAuth2 action without userId (no user auth)', async () => {
      const oauth2Config = {
        type: 'oauth2',
        config: {
          clientId: 'client-123',
          clientSecret: 'secret-456',
        },
      };

      authConfig.getOrgAuthConfig.mockResolvedValue(oauth2Config);

      const result = await service.executeAction('org-456', undefined, 'send-email', validInputs);

      expect(result.success).toBe(true);

      // Verify no user credentials were fetched
      expect(authConfig.getUserCredentials).not.toHaveBeenCalled();
      expect(authConfig.refreshUserToken).not.toHaveBeenCalled();

      // Verify no OAuth token in headers
      expect(daytonaService.executeHttpRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: {
            'Content-Type': 'application/json',
            'X-Custom': 'header',
          },
        }),
      );
    });

    it('should throw NotFoundException when action not found', async () => {
      prismaService.action.findFirst.mockResolvedValue(null);

      await expect(
        service.executeAction('org-456', 'user-123', 'nonexistent-action', validInputs),
      ).rejects.toThrow(new NotFoundException('Action "nonexistent-action" not found'));

      // Expect error metrics to be recorded
      expect(metricsService.actionExecutionCounter.inc).toHaveBeenCalledWith({
        orgId: 'org-456',
        toolKey: 'nonexistent-action',
        actionKey: 'nonexistent-action',
        status: 'error',
      });
    });

    it('should throw BadRequestException when input validation fails', async () => {
      const validationError = new BadRequestException('Required field "to" is missing');
      inputValidator.validateEnhanced.mockRejectedValue(validationError);

      await expect(
        service.executeAction('org-456', 'user-123', 'send-email', { subject: 'Test' }),
      ).rejects.toThrow(validationError);

      // Verify metrics for started but not success
      expect(metricsService.actionExecutionCounter.inc).toHaveBeenCalledWith({
        orgId: 'org-456',
        toolKey: 'email-service',
        actionKey: 'send-email',
        status: 'started',
      });

      expect(metricsService.actionExecutionCounter.inc).not.toHaveBeenCalledWith(
        expect.objectContaining({ status: 'success' }),
      );
    });

    it('should handle HTTP request failure and record error metrics', async () => {
      daytonaService.executeHttpRequest.mockResolvedValue({
        success: false,
        statusCode: 400,
        data: { error: 'Bad Request' },
        error: { message: 'Bad Request', type: 'http' },
        duration: 200,
      });

      await expect(
        service.executeAction('org-456', 'user-123', 'send-email', validInputs),
      ).rejects.toThrow('Bad Request');

      // Verify error metrics
      expect(metricsService.actionExecutionCounter.inc).toHaveBeenCalledWith({
        orgId: 'org-456',
        toolKey: 'send-email',
        actionKey: 'send-email',
        status: 'error',
      });

      // Duration should still be recorded
      expect(metricsService.actionExecutionDuration.observe).toHaveBeenCalled();
    });

    it('should handle non-JSON response gracefully', async () => {
      daytonaService.executeHttpRequest.mockResolvedValue({
        success: true,
        statusCode: 200,
        data: 'Plain text response',
        duration: 150,
      });

      const result = await service.executeAction('org-456', 'user-123', 'send-email', validInputs);

      expect(result).toMatchObject({
        success: true,
        data: 'Plain text response',
      });
    });

    it('should handle absolute URLs in action endpoint', async () => {
      const actionWithAbsoluteUrl = {
        ...mockAction,
        endpoint: 'https://external-api.com/webhook',
      };

      prismaService.action.findFirst.mockResolvedValue(actionWithAbsoluteUrl);

      await service.executeAction('org-456', 'user-123', 'send-email', validInputs);

      // Verify absolute URL was used as-is
      expect(daytonaService.executeHttpRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          url: 'https://external-api.com/webhook',
        }),
      );
    });

    it('should handle GET requests without body', async () => {
      const getAction = {
        ...mockAction,
        method: 'GET',
        endpoint: '/api/status',
      };

      prismaService.action.findFirst.mockResolvedValue(getAction);

      await service.executeAction('org-456', 'user-123', 'send-email', validInputs);

      // Verify GET request has no body
      expect(daytonaService.executeHttpRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'GET',
          url: 'https://api.email.com/api/status',
          headers: expect.any(Object),
          body: undefined,
        }),
      );
    });

    it('should replace template variables in URL', async () => {
      const templateAction = {
        ...mockAction,
        endpoint: '/api/users/{{userId}}/send',
      };

      const inputsWithUserId = {
        ...validInputs,
        userId: 'user-456',
      };

      prismaService.action.findFirst.mockResolvedValue(templateAction);
      inputValidator.validateEnhanced.mockResolvedValue(inputsWithUserId);

      await service.executeAction('org-456', 'user-123', 'send-email', inputsWithUserId);

      // Verify template replacement
      expect(daytonaService.executeHttpRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          url: 'https://api.email.com/api/users/user-456/send',
        }),
      );
    });

    it('should handle network errors from Daytona service', async () => {
      daytonaService.executeHttpRequest.mockRejectedValue(new Error('Network error'));

      await expect(
        service.executeAction('org-456', 'user-123', 'send-email', validInputs),
      ).rejects.toThrow('Network error');

      // Verify error metrics
      expect(metricsService.actionExecutionCounter.inc).toHaveBeenCalledWith({
        orgId: 'org-456',
        toolKey: 'send-email',
        actionKey: 'send-email',
        status: 'error',
      });
    });
  });

  describe('create', () => {
    const createActionDto = {
      name: 'Test Action',
      key: 'test-action',
      toolId: 'tool-123',
      method: 'POST' as const,
      endpoint: '/test',
      headers: { 'X-Test': 'header' },
      inputSchema: [],
      executeIf: undefined,
      version: 1,
    };

    it('should create action successfully', async () => {
      const mockTool = { id: 'tool-123', orgId: 'org-456' };
      prismaService.tool.findUnique.mockResolvedValue(mockTool);
      prismaService.action.create.mockResolvedValue({ id: 'action-123', ...createActionDto });

      const result = await service.create(createActionDto, mockTenant);

      expect(result).toMatchObject({ id: 'action-123', name: 'Test Action' });
      expect(prismaService.tool.findUnique).toHaveBeenCalledWith({ where: { id: 'tool-123' } });
      expect(prismaService.action.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: 'Test Action',
          key: 'test-action',
          toolId: 'tool-123',
          orgId: 'org-456',
        }),
      });
    });

    it('should throw ForbiddenException when tool not found', async () => {
      prismaService.tool.findUnique.mockResolvedValue(null);

      await expect(service.create(createActionDto, mockTenant)).rejects.toThrow(
        new ForbiddenException('Tool not found or access denied'),
      );
    });

    it('should throw ForbiddenException when tool belongs to different org', async () => {
      const wrongOrgTool = { id: 'tool-123', orgId: 'different-org' };
      prismaService.tool.findUnique.mockResolvedValue(wrongOrgTool);

      await expect(service.create(createActionDto, mockTenant)).rejects.toThrow(
        new ForbiddenException('Tool not found or access denied'),
      );
    });
  });

  describe('findOne', () => {
    it('should return action when found and belongs to org', async () => {
      const mockActionWithOrgId = {
        ...mockAction,
        orgId: 'org-456',
        tool: {
          id: 'tool-789',
          name: 'email-service',
          orgId: 'org-456',
        },
      };
      prismaService.action.findUnique.mockResolvedValue(mockActionWithOrgId);

      const result = await service.findOne('action-123', mockTenant);

      expect(result).toEqual(mockActionWithOrgId);
      expect(prismaService.action.findUnique).toHaveBeenCalledWith({
        where: { id: 'action-123' },
        include: {
          tool: {
            select: { id: true, name: true, orgId: true },
          },
        },
      });
    });

    it('should throw NotFoundException when action not found', async () => {
      prismaService.action.findUnique.mockResolvedValue(null);

      await expect(service.findOne('nonexistent-action', mockTenant)).rejects.toThrow(
        new NotFoundException('Action with ID nonexistent-action not found'),
      );
    });

    it('should throw ForbiddenException when action belongs to different org', async () => {
      const wrongOrgAction = {
        ...mockAction,
        orgId: 'different-org',
        tool: {
          id: 'tool-789',
          name: 'email-service',
          orgId: 'different-org',
        },
      };
      prismaService.action.findUnique.mockResolvedValue(wrongOrgAction);

      await expect(service.findOne('action-123', mockTenant)).rejects.toThrow(
        new ForbiddenException('Access denied: Action belongs to different organization'),
      );
    });
  });
});
