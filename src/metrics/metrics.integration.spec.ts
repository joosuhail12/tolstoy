import { Test, TestingModule } from '@nestjs/testing';
import { MetricsService } from './metrics.service';
import { register } from 'prom-client';

describe('MetricsService - Integration', () => {
  let service: MetricsService;

  beforeEach(async () => {
    // Clear all metrics before each test
    register.clear();
    
    const module: TestingModule = await Test.createTestingModule({
      providers: [MetricsService],
    }).compile();

    service = module.get<MetricsService>(MetricsService);
  });

  afterEach(() => {
    // Clean up metrics after each test
    register.clear();
  });

  it('should increment tool auth config metrics', async () => {
    const labels = {
      orgId: 'org-123',
      toolKey: 'github',
      action: 'upsert',
    };

    service.incrementToolAuthConfig(labels);

    // Get metrics output
    const metrics = await register.metrics();
    
    expect(metrics).toContain('tool_auth_config_requests_total');
    expect(metrics).toContain('orgId="org-123"');
    expect(metrics).toContain('toolKey="github"');
    expect(metrics).toContain('action="upsert"');
  });

  it('should increment OAuth redirect metrics', async () => {
    const labels = {
      orgId: 'org-456',
      toolKey: 'google',
    };

    service.incrementOAuthRedirect(labels);

    const metrics = await register.metrics();
    
    expect(metrics).toContain('oauth_redirects_total');
    expect(metrics).toContain('orgId="org-456"');
    expect(metrics).toContain('toolKey="google"');
  });

  it('should increment OAuth callback metrics', async () => {
    const labels = {
      orgId: 'org-789',
      toolKey: 'slack',
      success: 'true',
    };

    service.incrementOAuthCallback(labels);

    const metrics = await register.metrics();
    
    expect(metrics).toContain('oauth_callbacks_total');
    expect(metrics).toContain('orgId="org-789"');
    expect(metrics).toContain('toolKey="slack"');
    expect(metrics).toContain('success="true"');
  });

  it('should record validation error metrics', async () => {
    const labels = {
      orgId: 'org-111',
      actionKey: 'send-email',
      context: 'action-execution',
      errorType: 'type-validation',
    };

    service.incrementValidationErrors(labels);

    const metrics = await register.metrics();
    
    expect(metrics).toContain('validation_errors_total');
    expect(metrics).toContain('orgId="org-111"');
    expect(metrics).toContain('actionKey="send-email"');
    expect(metrics).toContain('context="action-execution"');
    expect(metrics).toContain('errorType="type-validation"');
  });

  it('should increment auth injection metrics', async () => {
    const labels = {
      orgId: 'org-222',
      stepId: 'step-333',
      stepType: 'http',
      toolName: 'github',
      authType: 'oauth2',
    };

    service.incrementAuthInjection(labels);

    const metrics = await register.metrics();
    
    expect(metrics).toContain('auth_injection_total');
    expect(metrics).toContain('orgId="org-222"');
    expect(metrics).toContain('stepId="step-333"');
    expect(metrics).toContain('stepType="http"');
    expect(metrics).toContain('toolName="github"');
    expect(metrics).toContain('authType="oauth2"');
  });

  it('should have all expected metric names in output', async () => {
    // Increment one of each metric type
    service.incrementToolAuthConfig({ orgId: 'test', toolKey: 'test', action: 'get' });
    service.incrementOAuthRedirect({ orgId: 'test', toolKey: 'test' });
    service.incrementOAuthCallback({ orgId: 'test', toolKey: 'test', success: 'true' });
    service.incrementValidationErrors({ orgId: 'test', context: 'test', errorType: 'test' });
    service.incrementAuthInjection({ 
      orgId: 'test', 
      stepId: 'test', 
      stepType: 'test', 
      toolName: 'test', 
      authType: 'test' 
    });

    const metrics = await register.metrics();
    
    // Verify all new metrics are present
    const expectedMetrics = [
      'tool_auth_config_requests_total',
      'oauth_redirects_total',
      'oauth_callbacks_total',
      'validation_errors_total',
      'auth_injection_total',
    ];

    expectedMetrics.forEach(metricName => {
      expect(metrics).toContain(metricName);
    });
  });
});