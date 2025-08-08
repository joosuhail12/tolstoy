import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma.service';
import { AwsSecretsService } from '../../src/aws-secrets.service';
import { RedisCacheService } from '../../src/cache/redis-cache.service';

describe('Authentication Endpoints (Integration)', () => {
  let app: INestApplication;
  let prismaService: PrismaService;
  let awsSecretsService: any;
  let cacheService: any;

  const testOrgId = 'test-org-123';
  const testUserId = 'test-user-456';
  const testToolId = 'test-tool-789';

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
    await app.init();

    prismaService = moduleFixture.get<PrismaService>(PrismaService);
    awsSecretsService = moduleFixture.get(AwsSecretsService);
    cacheService = moduleFixture.get(RedisCacheService);

    // Set up test data
    await setupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Tool Auth Endpoints', () => {
    describe('POST /tools/:toolId/auth', () => {
      it('should create API key auth configuration', async () => {
        const authConfig = {
          type: 'apiKey',
          config: {
            apiKey: 'test-api-key-123',
            headerName: 'Authorization',
            headerValue: 'Bearer test-api-key-123',
          },
        };

        const response = await request(app.getHttpServer())
          .post(`/tools/${testToolId}/auth`)
          .set('X-Org-ID', testOrgId)
          .send(authConfig)
          .expect(201);

        expect(response.body).toMatchObject({
          type: 'apiKey',
          orgId: testOrgId,
          toolId: testToolId,
        });

        // Verify database record was created
        const dbRecord = await prismaService.toolAuthConfig.findFirst({
          where: { orgId: testOrgId, toolId: testToolId },
        });
        expect(dbRecord).toBeDefined();
        expect(dbRecord.type).toBe('apiKey');

        // Verify AWS Secrets Manager was called
        expect(awsSecretsService.createSecret).toHaveBeenCalled();

        // Verify cache was updated
        expect(cacheService.del).toHaveBeenCalled();
      });

      it('should create OAuth2 auth configuration', async () => {
        const authConfig = {
          type: 'oauth2',
          config: {
            clientId: 'oauth-client-123',
            clientSecret: 'oauth-secret-456',
            scopes: ['read', 'write'],
            authUrl: 'https://provider.com/oauth/authorize',
            tokenUrl: 'https://provider.com/oauth/token',
          },
        };

        const response = await request(app.getHttpServer())
          .post(`/tools/${testToolId}/auth`)
          .set('X-Org-ID', testOrgId)
          .send(authConfig)
          .expect(201);

        expect(response.body).toMatchObject({
          type: 'oauth2',
          orgId: testOrgId,
          toolId: testToolId,
        });

        // Verify OAuth2 specific config is stored
        const dbRecord = await prismaService.toolAuthConfig.findFirst({
          where: { orgId: testOrgId, toolId: testToolId },
        });
        expect(dbRecord.config).toMatchObject({
          clientId: 'oauth-client-123',
          scopes: ['read', 'write'],
        });
      });

      it('should return 400 for invalid auth type', async () => {
        const invalidConfig = {
          type: 'invalid-type',
          config: {},
        };

        await request(app.getHttpServer())
          .post(`/tools/${testToolId}/auth`)
          .set('X-Org-ID', testOrgId)
          .send(invalidConfig)
          .expect(400);
      });

      it('should return 401 without organization ID', async () => {
        const authConfig = {
          type: 'apiKey',
          config: { apiKey: 'test' },
        };

        await request(app.getHttpServer())
          .post(`/tools/${testToolId}/auth`)
          .send(authConfig)
          .expect(401);
      });
    });

    describe('GET /tools/:toolId/auth', () => {
      beforeEach(async () => {
        // Create test auth config
        await prismaService.toolAuthConfig.create({
          data: {
            orgId: testOrgId,
            toolId: testToolId,
            type: 'apiKey',
            config: { apiKey: 'test-key' },
          },
        });
      });

      it('should retrieve existing auth configuration', async () => {
        const response = await request(app.getHttpServer())
          .get(`/tools/${testToolId}/auth`)
          .set('X-Org-ID', testOrgId)
          .expect(200);

        expect(response.body).toMatchObject({
          type: 'apiKey',
          orgId: testOrgId,
          toolId: testToolId,
        });

        // Sensitive values should be masked
        expect(response.body.config.apiKey).toMatch(/^\*+/);
      });

      it('should return 404 for non-existent auth config', async () => {
        await request(app.getHttpServer())
          .get('/tools/non-existent-tool/auth')
          .set('X-Org-ID', testOrgId)
          .expect(404);
      });
    });

    describe('DELETE /tools/:toolId/auth', () => {
      beforeEach(async () => {
        await prismaService.toolAuthConfig.create({
          data: {
            orgId: testOrgId,
            toolId: testToolId,
            type: 'apiKey',
            config: { apiKey: 'test-key' },
          },
        });
      });

      it('should delete auth configuration', async () => {
        await request(app.getHttpServer())
          .delete(`/tools/${testToolId}/auth`)
          .set('X-Org-ID', testOrgId)
          .expect(200);

        // Verify database record was deleted
        const dbRecord = await prismaService.toolAuthConfig.findFirst({
          where: { orgId: testOrgId, toolId: testToolId },
        });
        expect(dbRecord).toBeNull();

        // Verify AWS secret was deleted
        expect(awsSecretsService.deleteSecret).toHaveBeenCalled();

        // Verify cache was cleared
        expect(cacheService.del).toHaveBeenCalled();
      });

      it('should return 404 when deleting non-existent config', async () => {
        await request(app.getHttpServer())
          .delete('/tools/non-existent-tool/auth')
          .set('X-Org-ID', testOrgId)
          .expect(404);
      });
    });
  });

  describe('OAuth Flow Endpoints', () => {
    const testToolName = 'test-oauth-tool';

    beforeEach(async () => {
      // Create test tool and OAuth config
      await prismaService.tool.create({
        data: {
          id: testToolId,
          name: testToolName,
          baseUrl: 'https://api.test.com',
          orgId: testOrgId,
        },
      });

      await prismaService.toolAuthConfig.create({
        data: {
          orgId: testOrgId,
          toolId: testToolId,
          type: 'oauth2',
          config: {
            clientId: 'oauth-client-123',
            clientSecret: 'oauth-secret-456',
            authUrl: 'https://provider.com/oauth/authorize',
            tokenUrl: 'https://provider.com/oauth/token',
            scopes: ['read', 'write'],
          },
        },
      });
    });

    describe('GET /auth/:toolKey/login', () => {
      it('should redirect to OAuth provider', async () => {
        const response = await request(app.getHttpServer())
          .get(`/auth/${testToolName}/login`)
          .query({
            orgId: testOrgId,
            userId: testUserId,
            redirectUri: 'https://app.example.com/callback',
          })
          .expect(302);

        expect(response.headers.location).toMatch(/https:\/\/provider\.com\/oauth\/authorize/);
        expect(response.headers.location).toMatch(/client_id=oauth-client-123/);
        expect(response.headers.location).toMatch(/scope=read\+write/);
        expect(response.headers.location).toMatch(/state=/);

        // Verify state was stored in Redis
        expect(cacheService.set).toHaveBeenCalled();
      });

      it('should return 404 for unknown tool', async () => {
        await request(app.getHttpServer())
          .get('/auth/unknown-tool/login')
          .query({ orgId: testOrgId, userId: testUserId })
          .expect(404);
      });

      it('should return 400 without required parameters', async () => {
        await request(app.getHttpServer())
          .get(`/auth/${testToolName}/login`)
          .expect(400);
      });
    });

    describe('GET /auth/:toolKey/callback', () => {
      const mockState = 'test-state-123';
      const mockCode = 'oauth-code-456';

      beforeEach(() => {
        // Mock stored OAuth state
        cacheService.get.mockImplementation((key) => {
          if (key.includes('oauth-state')) {
            return Promise.resolve({
              orgId: testOrgId,
              userId: testUserId,
              toolKey: testToolName,
              redirectUri: 'https://app.example.com/callback',
              createdAt: Date.now(),
            });
          }
          return Promise.resolve(null);
        });

        // Mock token exchange response
        global.fetch = jest.fn().mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({
            access_token: 'oauth-access-token-123',
            refresh_token: 'oauth-refresh-token-456',
            expires_in: 3600,
          }),
        });
      });

      it('should handle successful OAuth callback', async () => {
        const response = await request(app.getHttpServer())
          .get(`/auth/${testToolName}/callback`)
          .query({ code: mockCode, state: mockState })
          .expect(302);

        expect(response.headers.location).toBe('https://app.example.com/callback?success=true');

        // Verify user credentials were stored
        const userCred = await prismaService.userCredential.findFirst({
          where: { orgId: testOrgId, userId: testUserId, toolId: testToolId },
        });
        expect(userCred).toBeDefined();
        expect(userCred.accessToken).toBe('oauth-access-token-123');

        // Verify state was cleaned up
        expect(cacheService.del).toHaveBeenCalledWith(`oauth-state:${mockState}`);
      });

      it('should return 400 for invalid state', async () => {
        cacheService.get.mockResolvedValue(null);

        await request(app.getHttpServer())
          .get(`/auth/${testToolName}/callback`)
          .query({ code: mockCode, state: 'invalid-state' })
          .expect(400);
      });

      it('should handle token exchange failure', async () => {
        (global.fetch as jest.Mock).mockResolvedValue({
          ok: false,
          status: 400,
          json: () => Promise.resolve({ error: 'invalid_grant' }),
        });

        const response = await request(app.getHttpServer())
          .get(`/auth/${testToolName}/callback`)
          .query({ code: mockCode, state: mockState })
          .expect(302);

        expect(response.headers.location).toMatch(/error=oauth_failed/);
      });
    });
  });

  describe('Single Action Execution', () => {
    const testActionKey = 'test-action';

    beforeEach(async () => {
      // Create test action
      await prismaService.action.create({
        data: {
          id: 'action-123',
          key: testActionKey,
          name: 'Test Action',
          orgId: testOrgId,
          toolId: testToolId,
          method: 'POST',
          endpoint: '/api/test',
          headers: { 'Content-Type': 'application/json' },
          inputSchema: [
            {
              name: 'message',
              type: 'string',
              required: true,
              label: 'Message',
              control: 'text',
            },
          ],
        },
      });

      // Mock HTTP response from external API
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('{"result": "success"}'),
      });
    });

    describe('POST /actions/:key/execute', () => {
      it('should execute action successfully with API key auth', async () => {
        // Set up API key auth
        await prismaService.toolAuthConfig.create({
          data: {
            orgId: testOrgId,
            toolId: testToolId,
            type: 'apiKey',
            config: {
              apiKey: 'test-api-key',
              headerName: 'Authorization',
              headerValue: 'Bearer test-api-key',
            },
          },
        });

        const response = await request(app.getHttpServer())
          .post(`/actions/${testActionKey}/execute`)
          .set('X-Org-ID', testOrgId)
          .set('X-User-ID', testUserId)
          .send({ message: 'Hello, World!' })
          .expect(200);

        expect(response.body).toMatchObject({
          success: true,
          data: { result: 'success' },
        });

        expect(response.body.executionId).toBeDefined();
        expect(response.body.duration).toBeGreaterThan(0);

        // Verify external API was called with auth headers
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/test'),
          expect.objectContaining({
            headers: expect.objectContaining({
              Authorization: 'Bearer test-api-key',
            }),
          }),
        );
      });

      it('should execute action with OAuth2 auth', async () => {
        // Set up OAuth2 auth and user credentials
        await prismaService.toolAuthConfig.create({
          data: {
            orgId: testOrgId,
            toolId: testToolId,
            type: 'oauth2',
            config: {
              clientId: 'oauth-client',
              clientSecret: 'oauth-secret',
            },
          },
        });

        await prismaService.userCredential.create({
          data: {
            orgId: testOrgId,
            userId: testUserId,
            toolId: testToolId,
            accessToken: 'user-oauth-token',
            refreshToken: 'user-refresh-token',
            expiresAt: new Date(Date.now() + 3600000),
          },
        });

        const response = await request(app.getHttpServer())
          .post(`/actions/${testActionKey}/execute`)
          .set('X-Org-ID', testOrgId)
          .set('X-User-ID', testUserId)
          .send({ message: 'Hello with OAuth!' })
          .expect(200);

        expect(response.body.success).toBe(true);

        // Verify OAuth token was used
        expect(global.fetch).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            headers: expect.objectContaining({
              Authorization: 'Bearer user-oauth-token',
            }),
          }),
        );
      });

      it('should execute action without auth when no config exists', async () => {
        const response = await request(app.getHttpServer())
          .post(`/actions/${testActionKey}/execute`)
          .set('X-Org-ID', testOrgId)
          .send({ message: 'No auth needed' })
          .expect(200);

        expect(response.body.success).toBe(true);

        // Verify no auth headers were added
        expect(global.fetch).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            headers: expect.not.objectContaining({
              Authorization: expect.any(String),
            }),
          }),
        );
      });

      it('should return 404 for non-existent action', async () => {
        await request(app.getHttpServer())
          .post('/actions/non-existent-action/execute')
          .set('X-Org-ID', testOrgId)
          .send({ message: 'test' })
          .expect(404);
      });

      it('should return 400 for validation errors', async () => {
        const response = await request(app.getHttpServer())
          .post(`/actions/${testActionKey}/execute`)
          .set('X-Org-ID', testOrgId)
          .send({}) // Missing required 'message' field
          .expect(400);

        expect(response.body.error).toMatch(/validation/i);
      });

      it('should handle external API errors gracefully', async () => {
        (global.fetch as jest.Mock).mockResolvedValue({
          ok: false,
          status: 500,
          text: () => Promise.resolve('{"error": "Internal Server Error"}'),
        });

        const response = await request(app.getHttpServer())
          .post(`/actions/${testActionKey}/execute`)
          .set('X-Org-ID', testOrgId)
          .send({ message: 'This will fail' })
          .expect(200);

        expect(response.body).toMatchObject({
          success: false,
          data: { error: 'Internal Server Error' },
        });
      });
    });
  });

  // Helper functions
  async function setupTestData() {
    // Create test organization
    await prismaService.organization.upsert({
      where: { id: testOrgId },
      update: {},
      create: {
        id: testOrgId,
        name: 'Test Organization',
      },
    });

    // Create test user
    await prismaService.user.upsert({
      where: { id: testUserId },
      update: {},
      create: {
        id: testUserId,
        email: 'test@example.com',
        name: 'Test User',
      },
    });

    // Create test tool
    await prismaService.tool.upsert({
      where: { id: testToolId },
      update: {},
      create: {
        id: testToolId,
        name: 'test-tool',
        baseUrl: 'https://api.test.com',
        orgId: testOrgId,
      },
    });
  }

  async function cleanupTestData() {
    // Clean up test data in reverse dependency order
    await prismaService.userCredential.deleteMany({
      where: { orgId: testOrgId },
    });
    
    await prismaService.toolAuthConfig.deleteMany({
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
  }
});