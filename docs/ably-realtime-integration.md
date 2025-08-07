# Ably Real-Time Flow Execution Monitoring

Complete guide for real-time flow execution monitoring using Ably in the Tolstoy workflow automation platform.

## 🎯 Overview

The Ably integration provides real-time event streaming for flow executions, enabling:

- **Live Logs**: Real-time visibility into flow execution progress
- **Developer Insights**: Step-by-step execution monitoring during long-running workflows
- **Debugging & Observability**: Detailed error tracking and performance metrics
- **Alerting**: Real-time notifications for execution failures or completion

## 📊 Event Architecture

### Channel Structure

Each flow execution publishes events to a dedicated channel:

```
flows.{orgId}.{executionId}
```

**Examples:**
- `flows.org-abc123.exec_1691420723456_xy8z9a` - Execution events for organization abc123
- `flows.org-def456.exec_1691420750123_pq7r8s` - Execution events for organization def456

### Event Types

The system publishes two main event types:

#### 1. Step Status Events (`step-status`)

Published for each individual step in a flow:

```json
{
  "stepId": "create-github-issue",
  "status": "started | completed | failed | skipped",
  "timestamp": "2025-08-07T14:05:23.456Z",
  "executionId": "exec_1691420723456_xy8z9a",
  "orgId": "org-abc123",
  "flowId": "flow-github-automation",
  "stepName": "Create GitHub Issue",
  "output": {
    "ticketId": "ABC-123",
    "url": "https://github.com/owner/repo/issues/123"
  },
  "duration": 1250,
  "error": {
    "message": "API rate limit exceeded",
    "code": "RATE_LIMIT_ERROR"
  }
}
```

#### 2. Execution Status Events (`execution-status`)

Published for overall flow execution lifecycle:

```json
{
  "executionId": "exec_1691420723456_xy8z9a",
  "status": "started | completed | failed | cancelled",
  "timestamp": "2025-08-07T14:08:45.123Z",
  "orgId": "org-abc123",
  "flowId": "flow-github-automation",
  "totalSteps": 5,
  "completedSteps": 4,
  "failedSteps": 1,
  "duration": 12450,
  "output": {
    "summary": "Created 3 issues, failed to update 1 PR"
  },
  "error": {
    "message": "Final step failed due to insufficient permissions",
    "code": "PERMISSION_ERROR"
  }
}
```

## 🔧 Service Architecture

### Core Components

```typescript
src/
├── ably/
│   └── ably.service.ts              # Core Ably integration service
├── flows/
│   ├── flow-executor.service.ts     # Flow execution engine with real-time events
│   ├── flows.controller.ts          # REST API with execute endpoint
│   └── flows.module.ts              # Module configuration
```

### AblyService Features

- **Auto-initialization**: Lazy loading with API key from AWS Secrets Manager
- **Retry Logic**: Exponential backoff for failed publishes
- **Connection Management**: Automatic reconnection and error handling
- **Event Helpers**: Structured event creation methods
- **Resource Cleanup**: Proper connection disposal

### FlowExecutorService Features

- **Real-time Events**: Publishes events at each step lifecycle
- **Step Types**: Supports HTTP requests, OAuth API calls, webhooks, data transforms
- **Error Handling**: Comprehensive error capture and reporting
- **Context Management**: Maintains execution state across steps

## 🚀 Usage Guide

### Server-Side Integration

The Ably service is automatically integrated into the flow execution pipeline:

```typescript
// Flow execution with real-time events
@Controller('flows')
export class FlowsController {
  @Post(':id/execute')
  async executeFlow(
    @Param('id') id: string,
    @Body() executionInput: { variables?: Record<string, any> },
    @Tenant() tenant: TenantContext,
  ) {
    // This automatically publishes real-time events
    return this.flowExecutorService.executeFlow(
      id,
      tenant,
      executionInput.variables || {}
    );
  }
}
```

### Frontend Integration

#### JavaScript/TypeScript Client

```javascript
import { Realtime } from 'ably';

// Initialize Ably client
const ably = new Realtime({
  key: 'your-ably-api-key', // Or use token authentication
  clientId: 'dashboard-user-123'
});

// Subscribe to flow execution events
const orgId = 'org-abc123';
const executionId = 'exec_1691420723456_xy8z9a';
const channel = ably.channels.get(`flows.${orgId}.${executionId}`);

// Listen for step updates
channel.subscribe('step-status', (message) => {
  const stepEvent = message.data;
  console.log(`Step ${stepEvent.stepId}: ${stepEvent.status}`);
  
  // Update UI based on step status
  updateStepUI(stepEvent.stepId, stepEvent.status, stepEvent.output);
});

// Listen for execution updates
channel.subscribe('execution-status', (message) => {
  const execEvent = message.data;
  console.log(`Execution ${execEvent.executionId}: ${execEvent.status}`);
  
  if (execEvent.status === 'completed') {
    showSuccessNotification(`Flow completed in ${execEvent.duration}ms`);
  } else if (execEvent.status === 'failed') {
    showErrorNotification(`Flow failed: ${execEvent.error.message}`);
  }
});

// Start flow execution
async function executeFlow(flowId, variables = {}) {
  const response = await fetch(`/api/flows/${flowId}/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ variables })
  });
  
  const execution = await response.json();
  
  // Subscribe to real-time events for this execution
  const channel = ably.channels.get(`flows.${orgId}.${execution.id}`);
  
  return { execution, channel };
}
```

#### React Hook Example

```typescript
import { useEffect, useState } from 'react';
import { Realtime } from 'ably';

interface FlowExecutionState {
  status: 'idle' | 'running' | 'completed' | 'failed';
  steps: Array<{
    id: string;
    name: string;
    status: 'pending' | 'started' | 'completed' | 'failed';
    output?: any;
    error?: any;
    duration?: number;
  }>;
  totalSteps: number;
  completedSteps: number;
  failedSteps: number;
}

export function useFlowExecution(orgId: string, executionId: string) {
  const [state, setState] = useState<FlowExecutionState>({
    status: 'idle',
    steps: [],
    totalSteps: 0,
    completedSteps: 0,
    failedSteps: 0
  });

  useEffect(() => {
    const ably = new Realtime({ key: process.env.REACT_APP_ABLY_KEY });
    const channel = ably.channels.get(`flows.${orgId}.${executionId}`);

    // Handle step events
    channel.subscribe('step-status', (message) => {
      const stepEvent = message.data;
      
      setState(prev => ({
        ...prev,
        steps: prev.steps.map(step =>
          step.id === stepEvent.stepId
            ? {
                ...step,
                status: stepEvent.status,
                output: stepEvent.output,
                error: stepEvent.error,
                duration: stepEvent.duration
              }
            : step
        )
      }));
    });

    // Handle execution events
    channel.subscribe('execution-status', (message) => {
      const execEvent = message.data;
      
      setState(prev => ({
        ...prev,
        status: execEvent.status,
        totalSteps: execEvent.totalSteps || prev.totalSteps,
        completedSteps: execEvent.completedSteps || prev.completedSteps,
        failedSteps: execEvent.failedSteps || prev.failedSteps
      }));
    });

    return () => {
      channel.unsubscribe();
      ably.close();
    };
  }, [orgId, executionId]);

  return state;
}
```

## ⚙️ Configuration

### Environment Variables

```env
# Ably Configuration
ABLY_API_KEY=your-api-key-here
ABLY_ENVIRONMENT=production

# AWS Secrets Manager (alternative to env var)
AWS_REGION=us-east-1
```

### AWS Secrets Manager Setup

Store your Ably API key securely:

```bash
# Create Ably API key secret
aws secretsmanager create-secret \
  --name "tolstoy/ably/api-key" \
  --description "Ably API key for real-time flow execution monitoring" \
  --secret-string "your-actual-ably-api-key" \
  --region us-east-1
```

### Ably Dashboard Configuration

1. **Create Ably App**: Sign up at [ably.com](https://ably.com) and create a new app
2. **Get API Key**: Navigate to API Keys tab and copy your key
3. **Configure Capabilities**: Ensure your key has `publish` and `subscribe` capabilities
4. **Set Up Webhooks** (Optional): Configure webhooks for additional integrations

## 📈 Monitoring & Debugging

### Connection Health

Check Ably connection status:

```typescript
// In your service or component
const connectionState = await ablyService.getConnectionState();
const isConnected = await ablyService.isConnected();

console.log('Ably connection:', connectionState, isConnected);
```

### Event Debugging

Enable debug logging by setting environment variables:

```env
NODE_ENV=development
LOG_LEVEL=debug
```

### Performance Monitoring

Monitor real-time event performance:

```typescript
// Track event publish latency
const startTime = Date.now();
await ablyService.publishStepEvent(event);
const latency = Date.now() - startTime;

console.log(`Event published in ${latency}ms`);
```

### Error Handling

The service includes comprehensive error handling:

```typescript
// Retry logic is built-in
await ablyService.publishStepEvent(event); // Automatically retries on failure

// Manual error handling
try {
  await ablyService.publishCustomEvent(orgId, executionId, 'custom-event', data);
} catch (error) {
  console.error('Failed to publish custom event:', error);
  // Event publishing failure doesn't stop flow execution
}
```

## 🔒 Security & Best Practices

### API Key Security

- ✅ Store API keys in AWS Secrets Manager
- ✅ Use environment-specific keys (dev/staging/prod)
- ✅ Rotate keys regularly
- ❌ Never commit API keys to version control

### Channel Security

- ✅ Organization-based channel isolation (`flows.{orgId}.*`)
- ✅ Execution-specific channels prevent cross-contamination
- ✅ Client-side token authentication for frontend access
- ❌ Avoid using root API keys on frontend

### Performance Optimization

- ✅ Use connection pooling (built into Ably service)
- ✅ Implement retry logic with exponential backoff
- ✅ Cache connection state to avoid repeated initialization
- ✅ Graceful cleanup on service shutdown

### Rate Limiting

Ably provides built-in rate limiting. Monitor usage in the Ably dashboard and implement application-level throttling if needed:

```typescript
// Optional: Implement application-level rate limiting
class RateLimitedAblyService {
  private lastPublish = 0;
  private readonly minInterval = 100; // 100ms between events

  async publishWithRateLimit(event: any) {
    const now = Date.now();
    const timeSinceLastPublish = now - this.lastPublish;
    
    if (timeSinceLastPublish < this.minInterval) {
      await new Promise(resolve => 
        setTimeout(resolve, this.minInterval - timeSinceLastPublish)
      );
    }
    
    await this.ablyService.publishStepEvent(event);
    this.lastPublish = Date.now();
  }
}
```

## 🧪 Testing

### Unit Testing

Test the Ably service with mocks:

```typescript
describe('AblyService', () => {
  let service: AblyService;
  let mockAblyClient: jest.Mocked<Realtime>;

  beforeEach(async () => {
    mockAblyClient = {
      channels: {
        get: jest.fn().mockReturnValue({
          publish: jest.fn().mockResolvedValue(true)
        })
      },
      connection: {
        state: 'connected'
      }
    } as any;

    service = new AblyService(configService, awsSecretsService);
    // Inject mock client
  });

  it('should publish step events', async () => {
    const event = await service.createStepEvent(
      'test-step',
      'completed',
      'exec-123',
      'org-456',
      'flow-789'
    );

    await service.publishStepEvent(event);

    expect(mockAblyClient.channels.get).toHaveBeenCalledWith('flows.org-456.exec-123');
  });
});
```

### Integration Testing

Test real-time events with actual Ably connection:

```typescript
describe('Flow Execution with Real-time Events (Integration)', () => {
  it('should publish events during flow execution', async () => {
    const executionPromise = flowExecutorService.executeFlow(
      'test-flow-id',
      { orgId: 'test-org', userId: 'test-user' }
    );

    // Subscribe to events and collect them
    const events = [];
    const channel = ably.channels.get(`flows.test-org.${executionId}`);
    
    channel.subscribe('step-status', (msg) => events.push(msg.data));
    channel.subscribe('execution-status', (msg) => events.push(msg.data));

    await executionPromise;

    // Assert events were published
    expect(events).toContainEqual(expect.objectContaining({
      status: 'started'
    }));
    expect(events).toContainEqual(expect.objectContaining({
      status: 'completed'
    }));
  }, 30000);
});
```

## 📋 API Reference

### AblyService Methods

```typescript
class AblyService {
  // Event publishing
  async publishStepEvent(event: FlowStepEvent): Promise<void>
  async publishExecutionEvent(event: FlowExecutionEvent): Promise<void>
  async publishCustomEvent(orgId: string, executionId: string, eventName: string, data: any): Promise<void>

  // Event creation helpers
  async createStepEvent(stepId: string, status: string, executionId: string, orgId: string, flowId: string, options?: any): Promise<FlowStepEvent>
  async createExecutionEvent(executionId: string, status: string, orgId: string, flowId: string, options?: any): Promise<FlowExecutionEvent>

  // Connection management
  async getConnectionState(): Promise<Types.ConnectionState | null>
  async isConnected(): Promise<boolean>
  async disconnect(): Promise<void>

  // Channel helpers
  getFlowOrgChannel(orgId: string): string
}
```

### REST API Endpoints

```typescript
// Execute flow with real-time monitoring
POST /flows/:id/execute
{
  "variables": {
    "repoName": "my-repo",
    "issueTitle": "Bug report"
  }
}

Response: {
  "id": "exec_1691420723456_xy8z9a",
  "flowId": "flow-github-automation",
  "status": "running",
  "createdAt": "2025-08-07T14:05:23.456Z"
}
```

## 🎯 Next Steps

1. **Advanced Analytics**: Implement flow execution analytics dashboard
2. **Custom Webhooks**: Add webhook notifications for external systems
3. **Mobile Support**: Create React Native components for mobile monitoring
4. **Scaling**: Implement horizontal scaling for high-volume executions
5. **Enhanced Security**: Add JWT-based token authentication for clients