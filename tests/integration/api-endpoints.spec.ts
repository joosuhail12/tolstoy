import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma.service';
import { AwsSecretsService } from '../../src/aws-secrets.service';
import { RedisCacheService } from '../../src/cache/redis-cache.service';

describe('API Endpoints (Integration)', () => {
  let app: INestApplication;
  let prismaService: PrismaService;

  const testOrgId = 'test-org-integration';
  const testUserId = 'test-user-integration';

  beforeAll(async () => {
    // Mock external services for integration tests
    const mockAwsSecretsService = {
      secretExists: jest.fn().mockResolvedValue(false),
      createSecret: jest.fn().mockResolvedValue(undefined),
      updateSecret: jest.fn().mockResolvedValue(undefined),
      deleteSecret: jest.fn().mockResolvedValue(undefined),
      getSecret: jest.fn().mockResolvedValue('{"apiKey": "test-key"}'),
    };

    const mockCacheService = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(AwsSecretsService)
      .useValue(mockAwsSecretsService)
      .overrideProvider(RedisCacheService)
      .useValue(mockCacheService)
      .compile();

    app = moduleFixture.createNestApplication();
    
    // Configure validation pipe like in production
    app.useGlobalPipes(new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }));
    
    await app.init();

    prismaService = moduleFixture.get<PrismaService>(PrismaService);

    // Set up test data
    await setupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
    await app.close();
  });

  describe('Tools API', () => {
    describe('POST /tools', () => {
      it('should create a tool with valid data', async () => {
        const createToolDto = {
          name: 'Integration Test Tool',
          baseUrl: 'https://api.integration.test',
          authType: 'apiKey',
        };

        const response = await request(app.getHttpServer())
          .post('/tools')
          .set('X-Org-ID', testOrgId)
          .send(createToolDto)
          .expect(201);

        expect(response.body).toHaveProperty('id');
        expect(response.body.name).toBe(createToolDto.name);
        expect(response.body.baseUrl).toBe(createToolDto.baseUrl);
        expect(response.body.authType).toBe(createToolDto.authType);
        expect(response.body.orgId).toBe(testOrgId);
      });

      it('should return 400 with invalid data', async () => {
        const invalidToolDto = {
          name: '', // Invalid: empty name
          baseUrl: 'not-a-url', // Invalid: not a valid URL
          authType: '', // Invalid: empty auth type
        };

        const response = await request(app.getHttpServer())
          .post('/tools')
          .set('X-Org-ID', testOrgId)
          .send(invalidToolDto)
          .expect(400);

        expect(response.body).toHaveProperty('message');
        expect(Array.isArray(response.body.message)).toBe(true);
      });

      it('should return 401 without organization ID', async () => {
        const createToolDto = {
          name: 'Test Tool',
          baseUrl: 'https://api.test.com',
          authType: 'apiKey',
        };

        await request(app.getHttpServer())
          .post('/tools')
          .send(createToolDto)
          .expect(401);
      });
    });

    describe('GET /tools', () => {
      let testToolId: string;

      beforeAll(async () => {
        // Create a test tool
        const tool = await prismaService.tool.create({
          data: {
            name: 'Get Test Tool',
            baseUrl: 'https://api.gettest.com',
            authType: 'oauth',
            orgId: testOrgId,
          },
        });
        testToolId = tool.id;
      });

      it('should return list of tools', async () => {
        const response = await request(app.getHttpServer())
          .get('/tools')
          .set('X-Org-ID', testOrgId)
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body.length).toBeGreaterThan(0);
        
        const testTool = response.body.find((tool: any) => tool.id === testToolId);
        expect(testTool).toBeDefined();
        expect(testTool.name).toBe('Get Test Tool');
      });

      it('should return 401 without organization ID', async () => {
        await request(app.getHttpServer())
          .get('/tools')
          .expect(401);
      });
    });

    describe('GET /tools/:id', () => {
      let testToolId: string;

      beforeAll(async () => {
        const tool = await prismaService.tool.create({
          data: {
            name: 'Get One Test Tool',
            baseUrl: 'https://api.getonetest.com',
            authType: 'none',
            orgId: testOrgId,
          },
        });
        testToolId = tool.id;
      });

      it('should return specific tool by ID', async () => {
        const response = await request(app.getHttpServer())
          .get(`/tools/${testToolId}`)
          .set('X-Org-ID', testOrgId)
          .expect(200);

        expect(response.body.id).toBe(testToolId);
        expect(response.body.name).toBe('Get One Test Tool');
        expect(response.body.baseUrl).toBe('https://api.getonetest.com');
      });

      it('should return 404 for non-existent tool', async () => {
        await request(app.getHttpServer())
          .get('/tools/non-existent-tool-id')
          .set('X-Org-ID', testOrgId)
          .expect(404);
      });
    });
  });

  describe('Actions API', () => {
    let testToolId: string;

    beforeAll(async () => {
      const tool = await prismaService.tool.create({
        data: {
          name: 'Action Test Tool',
          baseUrl: 'https://api.actiontest.com',
          authType: 'apiKey',
          orgId: testOrgId,
        },
      });
      testToolId = tool.id;
    });

    describe('POST /actions', () => {
      it('should create an action with valid data', async () => {
        const createActionDto = {
          name: 'Integration Test Action',
          key: 'integration_test_action',
          method: 'POST',
          endpoint: '/api/test',
          toolId: testToolId,
          inputSchema: [
            {
              name: 'message',
              type: 'string',
              required: true,
              description: 'Test message',
            },
          ],
          headers: {
            'Content-Type': 'application/json',
          },
        };

        const response = await request(app.getHttpServer())
          .post('/actions')
          .set('X-Org-ID', testOrgId)
          .send(createActionDto)
          .expect(201);

        expect(response.body).toHaveProperty('id');
        expect(response.body.name).toBe(createActionDto.name);
        expect(response.body.key).toBe(createActionDto.key);
        expect(response.body.method).toBe(createActionDto.method);
        expect(response.body.endpoint).toBe(createActionDto.endpoint);
        expect(response.body.toolId).toBe(testToolId);
      });

      it('should return 400 with invalid data', async () => {
        const invalidActionDto = {
          name: '', // Invalid: empty name
          key: '', // Invalid: empty key
          method: 'INVALID_METHOD', // Any method is allowed in our current implementation
          endpoint: '', // Invalid: empty endpoint
          toolId: '', // Invalid: empty toolId
          inputSchema: 'not-an-array', // Invalid: not an array
          headers: 'not-an-object', // Invalid: not an object
        };

        const response = await request(app.getHttpServer())
          .post('/actions')
          .set('X-Org-ID', testOrgId)
          .send(invalidActionDto)
          .expect(400);

        expect(response.body).toHaveProperty('message');
        expect(Array.isArray(response.body.message)).toBe(true);
      });
    });

    describe('GET /actions', () => {
      it('should return list of actions', async () => {
        const response = await request(app.getHttpServer())
          .get('/actions')
          .set('X-Org-ID', testOrgId)
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
      });

      it('should return 401 without organization ID', async () => {
        await request(app.getHttpServer())
          .get('/actions')
          .expect(401);
      });
    });
  });

  describe('Webhooks API', () => {
    describe('POST /webhooks', () => {
      it('should create a webhook with valid data', async () => {
        const createWebhookDto = {
          name: 'Integration Test Webhook',
          url: 'https://webhook.integration.test/endpoint',
          eventTypes: ['flow.execution.completed'],
          enabled: true,
        };

        const response = await request(app.getHttpServer())
          .post('/webhooks')
          .set('X-Org-ID', testOrgId)
          .send(createWebhookDto)
          .expect(201);

        expect(response.body).toHaveProperty('id');
        expect(response.body.name).toBe(createWebhookDto.name);
        expect(response.body.url).toBe(createWebhookDto.url);
        expect(response.body.eventTypes).toEqual(createWebhookDto.eventTypes);
        expect(response.body.enabled).toBe(createWebhookDto.enabled);
      });

      it('should return 400 with invalid data', async () => {
        const invalidWebhookDto = {
          name: '', // Invalid: empty name
          url: 'not-a-url', // Invalid: not a valid URL
          eventTypes: [], // Invalid: empty array
        };

        const response = await request(app.getHttpServer())
          .post('/webhooks')
          .set('X-Org-ID', testOrgId)
          .send(invalidWebhookDto)
          .expect(400);

        expect(response.body).toHaveProperty('message');
        expect(Array.isArray(response.body.message)).toBe(true);
      });
    });

    describe('GET /webhooks', () => {
      it('should return list of webhooks', async () => {
        const response = await request(app.getHttpServer())
          .get('/webhooks')
          .set('X-Org-ID', testOrgId)
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
      });
    });

    describe('GET /webhooks/event-types', () => {
      it('should return list of valid event types', async () => {
        const response = await request(app.getHttpServer())
          .get('/webhooks/event-types')
          .set('X-Org-ID', testOrgId)
          .expect(200);

        expect(response.body).toHaveProperty('eventTypes');
        expect(Array.isArray(response.body.eventTypes)).toBe(true);
      });
    });
  });

  describe('Health Check', () => {
    it('should return health status', async () => {
      const response = await request(app.getHttpServer())
        .get('/health')
        .expect(200);

      expect(response.body).toHaveProperty('status');
    });
  });

  describe('API Documentation', () => {
    it('should serve OpenAPI specification', async () => {
      const response = await request(app.getHttpServer())
        .get('/docs/openapi.json')
        .expect(200);

      expect(response.body).toHaveProperty('openapi');
      expect(response.body).toHaveProperty('paths');
      expect(response.body).toHaveProperty('components');
    });
  });

  // Helper functions
  async function setupTestData() {
    // Create test organization
    try {
      await prismaService.organization.upsert({
        where: { id: testOrgId },
        update: {},
        create: {
          id: testOrgId,
          name: 'Integration Test Organization',
          description: 'Organization for integration tests',
          settings: {},
        },
      });
    } catch (error) {
      // Organization might already exist, which is fine
    }

    // Create test user
    try {
      await prismaService.user.upsert({
        where: { id: testUserId },
        update: {},
        create: {
          id: testUserId,
          email: 'integration@test.com',
          name: 'Integration Test User',
          role: 'user',
          profile: {},
        },
      });
    } catch (error) {
      // User might already exist, which is fine
    }
  }

  async function cleanupTestData() {
    // Clean up test data in reverse dependency order
    try {
      await prismaService.webhook.deleteMany({
        where: { orgId: testOrgId },
      });

      await prismaService.action.deleteMany({
        where: { orgId: testOrgId },
      });

      await prismaService.tool.deleteMany({
        where: { orgId: testOrgId },
      });

      await prismaService.user.deleteMany({
        where: { id: testUserId },
      });

      await prismaService.organization.deleteMany({
        where: { id: testOrgId },
      });
    } catch (error) {
      // Cleanup errors are not critical
      console.warn('Integration test cleanup error:', error);
    }
  }
});