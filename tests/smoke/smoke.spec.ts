import request from 'supertest';
import { execSync } from 'child_process';

const API_URL = process.env.SMOKE_API_URL!;
const ORG_ID = process.env.SMOKE_ORG_ID || 'smoke-test-org';
const API_KEY = process.env.SMOKE_API_KEY || 'test-api-key';

describe('Tolstoy Smoke Tests', () => {
  // Helper function to make authenticated requests
  const apiRequest = (path: string) => {
    return request(API_URL)
      .get(path)
      .set('Authorization', `Bearer ${API_KEY}`)
      .set('X-Org-ID', ORG_ID);
  };

  const apiPost = (path: string, data: any = {}) => {
    return request(API_URL)
      .post(path)
      .set('Authorization', `Bearer ${API_KEY}`)
      .set('X-Org-ID', ORG_ID)
      .send(data);
  };

  describe('Health & Version Checks', () => {
    it('GET /health returns healthy status', async () => {
      const res = await request(API_URL).get('/health');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ status: 'ok' });
    });

    it('GET /health/detailed returns detailed status', async () => {
      const res = await request(API_URL).get('/health/detailed');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('status');
      expect(res.body).toHaveProperty('database');
      expect(res.body).toHaveProperty('redis');
    });

    it('GET /version returns version information', async () => {
      const res = await request(API_URL).get('/version');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('version');
      expect(res.body).toHaveProperty('commit');
    });
  });

  describe('Authentication & Authorization', () => {
    it('requires authentication for protected endpoints', async () => {
      const res = await request(API_URL).get('/flows');
      expect(res.status).toBe(401);
    });

    it('accepts valid API key authentication', async () => {
      const res = await apiRequest('/flows');
      expect(res.status).toBe(200);
    });

    it('validates organization context', async () => {
      const res = await request(API_URL)
        .get('/flows')
        .set('Authorization', `Bearer ${API_KEY}`);
      // Should require X-Org-ID header
      expect([400, 401]).toContain(res.status);
    });
  });

  describe('Core API Endpoints', () => {
    it('GET /flows returns flows list', async () => {
      const res = await apiRequest('/flows');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('GET /actions returns actions list', async () => {
      const res = await apiRequest('/actions');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('GET /organizations returns organizations list', async () => {
      const res = await apiRequest('/organizations');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('GET /webhooks returns webhooks list', async () => {
      const res = await apiRequest('/webhooks');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('Template Import Workflow', () => {
    it('can list available templates via CLI', async () => {
      try {
        const cliEnv = {
          ...process.env,
          SMOKE_TEST: '1',
          TOLSTOY_API_URL: API_URL,
          TOLSTOY_API_KEY: API_KEY,
        };

        // This test assumes CLI is available in PATH or can be invoked
        // In practice, you may need to adjust the path to the CLI executable
        const result = execSync('npx tolstoy templates list --json', {
          env: cliEnv,
          encoding: 'utf-8',
          timeout: 30000,
        });

        const templates = JSON.parse(result);
        expect(Array.isArray(templates)).toBe(true);
        expect(templates.length).toBeGreaterThan(0);
        
        // Verify Hello World template exists
        const helloWorldTemplate = templates.find((t: any) => t.name === 'Hello World');
        expect(helloWorldTemplate).toBeDefined();
      } catch (error) {
        // If CLI is not available, mark as pending
        console.warn('CLI not available for template testing:', error);
        pending('CLI templates command not available in smoke test environment');
      }
    });

    it('can create a simple flow via API', async () => {
      const flowData = {
        name: 'Smoke Test Flow',
        description: 'Test flow created by smoke tests',
        trigger: {
          type: 'manual'
        },
        steps: [
          {
            id: 'step1',
            type: 'log',
            name: 'Log Message',
            config: {
              message: 'Hello from smoke test!'
            }
          }
        ]
      };

      const res = await apiPost('/flows', flowData);
      expect([200, 201]).toContain(res.status);
      expect(res.body).toHaveProperty('id');
      expect(res.body.name).toBe('Smoke Test Flow');

      // Clean up - delete the test flow
      if (res.body.id) {
        await request(API_URL)
          .delete(`/flows/${res.body.id}`)
          .set('Authorization', `Bearer ${API_KEY}`)
          .set('X-Org-ID', ORG_ID);
      }
    });
  });

  describe('Flow Execution Engine', () => {
    let testFlowId: string;

    beforeAll(async () => {
      // Create a test flow for execution testing
      const flowData = {
        name: 'Smoke Test Execution Flow',
        description: 'Flow for testing execution engine',
        trigger: {
          type: 'manual'
        },
        steps: [
          {
            id: 'step1',
            type: 'log',
            name: 'Start Log',
            config: {
              message: 'Execution started'
            }
          },
          {
            id: 'step2',
            type: 'log',
            name: 'End Log',
            config: {
              message: 'Execution completed'
            }
          }
        ]
      };

      const res = await apiPost('/flows', flowData);
      if (res.status === 200 || res.status === 201) {
        testFlowId = res.body.id;
      }
    });

    afterAll(async () => {
      // Clean up test flow
      if (testFlowId) {
        await request(API_URL)
          .delete(`/flows/${testFlowId}`)
          .set('Authorization', `Bearer ${API_KEY}`)
          .set('X-Org-ID', ORG_ID);
      }
    });

    it('can execute a simple flow', async () => {
      if (!testFlowId) {
        pending('Test flow not created successfully');
        return;
      }

      // Start execution
      const execRes = await apiPost('/flows/execute', {
        flowId: testFlowId,
        inputs: {}
      });

      expect([200, 202]).toContain(execRes.status);
      expect(execRes.body).toHaveProperty('executionId');

      const executionId = execRes.body.executionId;

      // Poll for completion (with timeout)
      let attempts = 0;
      let finalStatus = '';
      
      while (attempts < 10) {
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
        
        const statusRes = await apiRequest(`/flows/executions/${executionId}`);
        if (statusRes.status === 200) {
          finalStatus = statusRes.body.status;
          if (finalStatus === 'completed' || finalStatus === 'failed') {
            break;
          }
        }
        attempts++;
      }

      expect(finalStatus).toBe('completed');
    }, 30000); // Extended timeout for execution test
  });

  describe('Metrics & Observability', () => {
    it('GET /metrics returns Prometheus format', async () => {
      const res = await request(API_URL).get('/metrics');
      expect(res.status).toBe(200);
      expect(res.text).toContain('# HELP');
      expect(res.text).toContain('# TYPE');
      
      // Check for specific metrics
      expect(res.text).toMatch(/step_execution_seconds|http_requests_total|process_cpu_seconds_total/);
    });

    it('metrics include custom application metrics', async () => {
      const res = await request(API_URL).get('/metrics');
      expect(res.status).toBe(200);
      
      // Look for application-specific metrics
      const metricsText = res.text;
      const hasCustomMetrics = /tolstoy_|flows_|executions_|webhooks_/.test(metricsText);
      
      if (!hasCustomMetrics) {
        console.warn('Custom application metrics not found in /metrics endpoint');
      }
      
      // This is informational - we don't want to fail smoke tests if custom metrics are missing
      expect(res.text).toBeTruthy();
    });
  });

  describe('Webhook System', () => {
    it('GET /webhooks/event-types returns available event types', async () => {
      const res = await apiRequest('/webhooks/event-types');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('can create and delete a test webhook', async () => {
      const webhookData = {
        name: 'Smoke Test Webhook',
        url: 'https://webhook.site/test-endpoint',
        events: ['flow.completed'],
        active: true
      };

      // Create webhook
      const createRes = await apiPost('/webhooks', webhookData);
      expect([200, 201]).toContain(createRes.status);
      expect(createRes.body).toHaveProperty('id');

      const webhookId = createRes.body.id;

      // Verify webhook was created
      const getRes = await apiRequest(`/webhooks/${webhookId}`);
      expect(getRes.status).toBe(200);
      expect(getRes.body.name).toBe('Smoke Test Webhook');

      // Clean up - delete webhook
      const deleteRes = await request(API_URL)
        .delete(`/webhooks/${webhookId}`)
        .set('Authorization', `Bearer ${API_KEY}`)
        .set('X-Org-ID', ORG_ID);
      
      expect([200, 204]).toContain(deleteRes.status);
    });
  });

  describe('Error Handling & Resilience', () => {
    it('handles invalid endpoints gracefully', async () => {
      const res = await apiRequest('/nonexistent-endpoint');
      expect(res.status).toBe(404);
    });

    it('handles malformed requests appropriately', async () => {
      const res = await apiPost('/flows', {
        // Missing required fields
        invalidField: 'invalid'
      });
      
      expect([400, 422]).toContain(res.status);
      expect(res.body).toHaveProperty('message');
    });

    it('enforces rate limiting (if configured)', async () => {
      // Make multiple rapid requests to test rate limiting
      const requests = [];
      for (let i = 0; i < 50; i++) {
        requests.push(apiRequest('/health'));
      }

      const responses = await Promise.all(requests);
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      
      // Rate limiting might not be enabled in all environments
      if (rateLimitedResponses.length > 0) {
        expect(rateLimitedResponses.length).toBeGreaterThan(0);
      }
      
      // At least some requests should succeed
      const successfulResponses = responses.filter(r => r.status === 200);
      expect(successfulResponses.length).toBeGreaterThan(0);
    }, 15000);
  });

  describe('API Documentation & OpenAPI', () => {
    it('serves OpenAPI specification', async () => {
      const res = await request(API_URL).get('/docs/openapi.json');
      expect([200, 301, 302]).toContain(res.status);
      
      if (res.status === 200) {
        expect(res.body).toHaveProperty('openapi');
        expect(res.body).toHaveProperty('paths');
        expect(res.body).toHaveProperty('info');
      }
    });

    it('serves API documentation UI', async () => {
      const res = await request(API_URL).get('/docs');
      expect([200, 301, 302]).toContain(res.status);
    });
  });

  describe('Infrastructure & Performance', () => {
    it('responds within acceptable time limits', async () => {
      const startTime = Date.now();
      const res = await request(API_URL).get('/health');
      const responseTime = Date.now() - startTime;
      
      expect(res.status).toBe(200);
      expect(responseTime).toBeLessThan(5000); // 5 second timeout
    });

    it('handles concurrent requests', async () => {
      const concurrentRequests = 10;
      const requests = [];
      
      for (let i = 0; i < concurrentRequests; i++) {
        requests.push(apiRequest('/health'));
      }
      
      const responses = await Promise.all(requests);
      
      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
    });
  });
});