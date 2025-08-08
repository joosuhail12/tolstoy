import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma.service';
import { MetricsService } from '../../src/metrics/metrics.service';

describe('Actions Execute Integration (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let metrics: MetricsService;
  let orgId: string;
  let toolId: string;
  let actionId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = moduleFixture.get<PrismaService>(PrismaService);
    metrics = moduleFixture.get<MetricsService>(MetricsService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // Create test organization
    const org = await prisma.organization.create({
      data: {
        name: 'Test Execute Org',
        adminUserId: 'test-admin-user',
      },
    });
    orgId = org.id;

    // Create test tool
    const tool = await prisma.tool.create({
      data: {
        name: 'Test API',
        baseUrl: 'https://httpbin.org',
        authType: 'apiKey',
        orgId,
      },
    });
    toolId = tool.id;

    // Create test action
    const action = await prisma.action.create({
      data: {
        name: 'Test GET Request',
        key: 'test-get-request',
        method: 'GET',
        endpoint: '/json',
        headers: {
          'Accept': 'application/json'
        },
        inputSchema: [
          {
            name: 'param1',
            type: 'string',
            required: false,
            description: 'Optional parameter'
          }
        ],
        orgId,
        toolId,
      },
    });
    actionId = action.id;

    // Create tool auth config
    await prisma.toolAuthConfig.create({
      data: {
        orgId,
        toolId,
        type: 'apiKey',
        config: {
          headerName: 'X-API-Key',
          headerValue: 'test-api-key',
          apiKey: 'test-api-key'
        }
      }
    });
  });

  afterEach(async () => {
    // Clean up test data
    await prisma.action.deleteMany({ where: { orgId } });
    await prisma.toolAuthConfig.deleteMany({ where: { orgId } });
    await prisma.tool.deleteMany({ where: { orgId } });
    await prisma.organization.deleteMany({ where: { id: orgId } });
  });

  describe('POST /actions/:key/execute', () => {
    it('should execute action successfully with valid inputs', async () => {
      const response = await request(app.getHttpServer())
        .post('/actions/test-get-request/execute')
        .set('X-Org-ID', orgId)
        .send({
          inputs: {
            param1: 'test-value'
          }
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('executionId');
      expect(response.body).toHaveProperty('duration');
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('outputs');
      expect(response.body.outputs).toHaveProperty('orgId', orgId);
      expect(response.body.outputs).toHaveProperty('actionKey', 'test-get-request');
      expect(response.body.outputs).toHaveProperty('toolKey', 'Test API');
      expect(response.body.outputs).toHaveProperty('statusCode', 200);
    });

    it('should execute POST action with request body', async () => {
      // Create a POST action
      await prisma.action.create({
        data: {
          name: 'Test POST Request',
          key: 'test-post-request',
          method: 'POST',
          endpoint: '/post',
          headers: {
            'Content-Type': 'application/json'
          },
          inputSchema: [
            {
              name: 'message',
              type: 'string',
              required: true,
              description: 'Message to send'
            },
            {
              name: 'count',
              type: 'number',
              required: false,
              description: 'Count value'
            }
          ],
          orgId,
          toolId,
        },
      });

      const response = await request(app.getHttpServer())
        .post('/actions/test-post-request/execute')
        .set('X-Org-ID', orgId)
        .send({
          inputs: {
            message: 'Hello World',
            count: 42
          }
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('json'); // httpbin.org returns sent data in 'json' field
      expect(response.body.data.json).toHaveProperty('message', 'Hello World');
      expect(response.body.data.json).toHaveProperty('count', 42);
    });

    it('should handle template variables in endpoint URL', async () => {
      // Create action with template variables
      await prisma.action.create({
        data: {
          name: 'Template URL Action',
          key: 'test-template-url',
          method: 'GET',
          endpoint: '/status/{{statusCode}}',
          headers: {
            'Accept': 'application/json'
          },
          inputSchema: [
            {
              name: 'statusCode',
              type: 'number',
              required: true,
              description: 'HTTP status code'
            }
          ],
          orgId,
          toolId,
        },
      });

      const response = await request(app.getHttpServer())
        .post('/actions/test-template-url/execute')
        .set('X-Org-ID', orgId)
        .send({
          inputs: {
            statusCode: 201
          }
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.outputs).toHaveProperty('statusCode', 201);
      expect(response.body.outputs.url).toContain('/status/201');
    });

    it('should return 404 for non-existent action', async () => {
      const response = await request(app.getHttpServer())
        .post('/actions/non-existent-action/execute')
        .set('X-Org-ID', orgId)
        .send({
          inputs: {}
        })
        .expect(404);

      expect(response.body).toHaveProperty('message', 'Action "non-existent-action" not found');
    });

    it('should return 400 when X-Org-ID header is missing', async () => {
      const response = await request(app.getHttpServer())
        .post('/actions/test-get-request/execute')
        .send({
          inputs: {}
        })
        .expect(400);

      expect(response.body).toHaveProperty('message', 'X-Org-ID header required');
    });

    it('should handle input validation errors', async () => {
      // Create action with required field
      await prisma.action.create({
        data: {
          name: 'Required Field Action',
          key: 'test-required-field',
          method: 'POST',
          endpoint: '/post',
          headers: {},
          inputSchema: [
            {
              name: 'requiredField',
              type: 'string',
              required: true,
              description: 'This field is required'
            }
          ],
          orgId,
          toolId,
        },
      });

      const response = await request(app.getHttpServer())
        .post('/actions/test-required-field/execute')
        .set('X-Org-ID', orgId)
        .send({
          inputs: {} // Missing required field
        })
        .expect(400);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('validation');
    });

    it('should handle user-scoped authentication', async () => {
      // Create user credentials
      const userId = 'test-user-123';
      await prisma.userCredential.create({
        data: {
          orgId,
          userId,
          toolName: 'Test API',
          credentials: {
            access_token: 'user-access-token',
            token_type: 'Bearer',
            expires_at: Date.now() + 3600000 // 1 hour from now
          }
        }
      });

      const response = await request(app.getHttpServer())
        .post('/actions/test-get-request/execute')
        .set('X-Org-ID', orgId)
        .set('X-User-ID', userId)
        .send({
          inputs: {}
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.outputs).toHaveProperty('orgId', orgId);
    });

    it('should handle external API errors gracefully', async () => {
      // Create action that will return an error status
      await prisma.action.create({
        data: {
          name: 'Error Status Action',
          key: 'test-error-status',
          method: 'GET',
          endpoint: '/status/500', // httpbin returns 500 status
          headers: {},
          inputSchema: [],
          orgId,
          toolId,
        },
      });

      const response = await request(app.getHttpServer())
        .post('/actions/test-error-status/execute')
        .set('X-Org-ID', orgId)
        .send({
          inputs: {}
        })
        .expect(500);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('HTTP 500');
    });

    it('should record metrics for successful executions', async () => {
      const initialCounter = metrics.actionExecutionCounter.get();
      const initialHistogram = metrics.actionExecutionDuration.get();

      await request(app.getHttpServer())
        .post('/actions/test-get-request/execute')
        .set('X-Org-ID', orgId)
        .send({
          inputs: {}
        })
        .expect(200);

      const finalCounter = metrics.actionExecutionCounter.get();
      const finalHistogram = metrics.actionExecutionDuration.get();

      // Check that metrics were incremented
      expect(finalCounter.values.length).toBeGreaterThan(initialCounter.values.length);
      expect(finalHistogram.values.length).toBeGreaterThan(initialHistogram.values.length);
    });

    it('should record metrics for failed executions', async () => {
      const initialCounter = metrics.actionExecutionCounter.get();

      await request(app.getHttpServer())
        .post('/actions/non-existent-action/execute')
        .set('X-Org-ID', orgId)
        .send({
          inputs: {}
        })
        .expect(404);

      const finalCounter = metrics.actionExecutionCounter.get();

      // Check that error metrics were recorded
      expect(finalCounter.values.length).toBeGreaterThan(initialCounter.values.length);
      const errorMetric = finalCounter.values.find(v => 
        v.labels.status === 'error' && v.labels.actionKey === 'non-existent-action'
      );
      expect(errorMetric).toBeDefined();
    });
  });
});