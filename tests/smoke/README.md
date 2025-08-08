# Smoke Tests

This directory contains automated smoke tests that verify core Tolstoy functionality end-to-end.

## Overview

Smoke tests are lightweight, fast-running tests that verify the most critical functionality of the application is working correctly after deployment. They run automatically after each production deployment and can also be triggered manually.

## Test Coverage

### Core Functionality
- **Health Checks**: `/health` and `/health/detailed` endpoints
- **Version Info**: Application version and commit information
- **Authentication**: API key validation and organization context
- **Core APIs**: Flows, Actions, Organizations, Webhooks CRUD operations

### Workflow Engine
- **Template Import**: CLI template listing and import functionality
- **Flow Creation**: Creating flows via API
- **Flow Execution**: End-to-end flow execution with status polling
- **Step Processing**: Individual step execution and logging

### Observability
- **Metrics**: Prometheus metrics endpoint validation
- **Custom Metrics**: Application-specific business metrics
- **Error Tracking**: Error response handling

### Infrastructure
- **Performance**: Response time validation
- **Concurrency**: Multiple simultaneous request handling
- **Rate Limiting**: Traffic throttling verification (if configured)

## Configuration

### Environment Variables

The following environment variables are required for smoke tests:

```bash
# Required
SMOKE_API_URL=https://api.tolstoy.io          # API endpoint to test against
SMOKE_API_KEY=your-api-key                    # Valid API key for authentication
SMOKE_ORG_ID=smoke-test-org                   # Organization ID for testing

# Optional (for CLI testing)
TOLSTOY_API_URL=https://api.tolstoy.io        # CLI configuration
TOLSTOY_API_KEY=your-api-key                  # CLI authentication
```

### Local Testing

To run smoke tests locally:

```bash
# Set environment variables
export SMOKE_API_URL=http://localhost:3000
export SMOKE_API_KEY=your-test-api-key
export SMOKE_ORG_ID=test-org

# Run smoke tests
yarn test:smoke
```

### CI/CD Integration

Smoke tests run automatically:
- **After Production Deployments**: Triggered by successful deployment workflow
- **Daily Schedule**: Every day at 6 AM UTC
- **Manual Trigger**: Via GitHub Actions workflow dispatch

## Test Structure

```
tests/smoke/
├── README.md              # This file
├── setup.ts              # Global test configuration and utilities
├── smoke.spec.ts         # Main smoke test suite
└── helpers/              # Test helper functions (if needed)
```

### Test Organization

Tests are organized into logical groups:

1. **Health & Version Checks** - Basic application health
2. **Authentication & Authorization** - Security verification
3. **Core API Endpoints** - CRUD operations
4. **Template Import Workflow** - CLI and template functionality
5. **Flow Execution Engine** - Workflow processing
6. **Metrics & Observability** - Monitoring endpoints
7. **Webhook System** - Event delivery system
8. **Error Handling & Resilience** - Failure scenarios
9. **API Documentation** - OpenAPI specification
10. **Infrastructure & Performance** - Non-functional requirements

## Writing New Smoke Tests

When adding new smoke tests:

1. **Keep tests focused**: Test critical happy path scenarios only
2. **Make tests independent**: Each test should clean up after itself
3. **Use appropriate timeouts**: Default is 60 seconds per test
4. **Handle failures gracefully**: Use `pending()` for unavailable features
5. **Add descriptive test names**: Clear indication of what's being tested

### Example Test Pattern

```typescript
describe('Feature Category', () => {
  it('tests specific functionality', async () => {
    // Arrange
    const testData = { /* test setup */ };
    
    // Act
    const response = await apiRequest('/endpoint').send(testData);
    
    // Assert
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('expectedField');
    
    // Cleanup (if needed)
    if (response.body.id) {
      await cleanupResource(response.body.id);
    }
  });
});
```

## Failure Response

When smoke tests fail:

1. **Automatic Issue Creation**: GitHub issue created with failure details
2. **Notification**: Slack notification sent to engineering team
3. **Artifact Upload**: Test results and logs saved for analysis
4. **Deployment Blocking**: Failed smoke tests prevent traffic routing

## Monitoring and Alerts

Smoke test results are monitored for:
- **Test Success Rate**: Overall pass/fail percentage
- **Response Times**: API performance degradation
- **Error Patterns**: Recurring failure types
- **Deployment Impact**: Post-deployment health correlation

## Maintenance

### Regular Tasks
- Review and update test scenarios quarterly
- Verify environment variables are current
- Update test data and cleanup procedures
- Monitor test execution times and optimize slow tests

### When to Update
- New critical features added to the application
- API changes that affect core functionality
- Infrastructure changes that impact service availability
- Security or authentication model updates

## Troubleshooting

### Common Issues

**Tests timing out:**
- Check network connectivity to API endpoint
- Verify API is responding to health checks
- Increase test timeout if deployment is slow

**Authentication failures:**
- Verify SMOKE_API_KEY is valid and not expired
- Check SMOKE_ORG_ID exists and is accessible
- Ensure API key has required permissions

**CLI tests failing:**
- Verify Tolstoy CLI is built and linked
- Check CLI environment variables are set
- Ensure template directory is accessible

**Resource cleanup issues:**
- Review test cleanup logic
- Check for resource leaks between test runs
- Verify delete permissions for test resources

### Debug Mode

Run smoke tests with detailed output:

```bash
# Verbose Jest output
yarn test:smoke --verbose

# Debug mode with detailed logging
DEBUG=* yarn test:smoke
```

## Security Considerations

- **API Keys**: Use dedicated test API keys with minimal required permissions
- **Test Data**: Avoid using production data in smoke tests
- **Cleanup**: Always clean up test resources to prevent data accumulation
- **Secrets**: Store sensitive configuration in GitHub Secrets, not in code