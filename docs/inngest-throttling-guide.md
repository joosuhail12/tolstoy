# Inngest Queuing & Throttling Guide

Complete guide for implementing queuing, throttling, and retry policies in the Tolstoy workflow automation platform using Inngest.

## 🎯 Overview

The Inngest integration provides durable workflow orchestration with sophisticated throttling and queuing capabilities:

- **Global Rate Limiting**: System-wide execution limits to prevent resource exhaustion
- **Step-Specific Throttling**: Different concurrency and rate limits based on step type and criticality  
- **Intelligent Retry Policies**: Exponential backoff and fixed delay strategies tailored per operation type
- **Real-Time Monitoring**: Comprehensive metrics and logging for queue depth and throttling overhead
- **Multi-Tenant Isolation**: Organization-scoped execution contexts with independent throttling

## 📊 Throttling Architecture

### Global Defaults

System-wide defaults applied to all Inngest functions:

```typescript
// src/flows/inngest/inngest.module.ts
defaults: {
  // Global concurrency: max 10 concurrent step executions across all functions
  concurrency: 10,
  
  // Global rate limiting: max 100 steps per minute
  rateLimit: {
    maxExecutions: 100,
    perMilliseconds: 60_000,
  },
  
  // Global retry policy: exponential backoff for resilient error handling
  retry: {
    maxAttempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000, // Start with 2s, then 4s, 8s
    },
  },
}
```

### Step-Specific Overrides

Different step types have tailored throttling configurations:

#### 1. External API Calls (`http_request`, `oauth_api_call`)

**Use Case**: Third-party API integrations that require strict rate limiting

```typescript
{
  concurrency: 5,        // Conservative concurrency for API limits
  rateLimit: {
    maxExecutions: 10,
    perMilliseconds: 10_000, // 10 requests per 10 seconds
  },
  retry: {
    maxAttempts: 3,      // Standard retry count  
    backoff: {
      type: 'exponential',
      delay: 3000,       // Start with 3s for API calls
    },
  },
}

// Critical API calls get even stricter settings:
{
  concurrency: 2,        // Lower concurrency for critical operations
  retry: {
    maxAttempts: 5,      // More retries for critical steps
    // ... same backoff strategy
  },
}
```

#### 2. Compute Operations (`sandbox_sync`, `sandbox_async`, `code_execution`)

**Use Case**: CPU/memory intensive operations that need resource management

```typescript
{
  concurrency: 3,        // Limited concurrency for compute operations
  rateLimit: {
    maxExecutions: 20,
    perMilliseconds: 30_000, // 20 executions per 30 seconds
  },
  retry: {
    maxAttempts: 2,      // Fewer retries - code failures often need investigation
    backoff: {
      type: 'fixed',     // Fixed delay for predictable resource usage
      delay: 5000,       // 5s delay for compute operations
    },
  },
}
```

#### 3. Lightweight Operations (`data_transform`, `conditional`)

**Use Case**: Fast, low-resource operations that can run with high concurrency

```typescript
{
  concurrency: 15,       // High concurrency for lightweight ops
  rateLimit: {
    maxExecutions: 50,
    perMilliseconds: 30_000, // 50 transforms per 30 seconds
  },
  retry: {
    maxAttempts: 2,
    backoff: {
      type: 'fixed',
      delay: 1000,       // Quick 1s retry for lightweight ops
    },
  },
}
```

#### 4. Event Publishing

**Use Case**: Real-time event streaming that shouldn't block execution

```typescript
{
  concurrency: 20,       // Higher concurrency for event publishing
  rateLimit: {
    maxExecutions: 200,
    perMilliseconds: 60_000, // 200 events per minute
  },
  retry: {
    maxAttempts: 2,      // Quick retry for event publishing failures  
    backoff: {
      type: 'fixed',
      delay: 500,        // Fast retry - 500ms
    },
  },
}
```

## 🔧 Implementation Details

### Core Components

```typescript
src/flows/inngest/
├── inngest.module.ts                    # Global defaults configuration
├── execute-flow.handler.ts              # Step-specific throttling logic
├── execute-flow-throttling.handler.spec.ts # Comprehensive test suite
└── inngest-execution.service.ts         # Execution orchestration
```

### Throttling Configuration Method

The `getStepConfiguration()` method in `ExecuteFlowHandler` determines throttling settings:

```typescript
private getStepConfiguration(step: any): any {
  const stepType = step.type;
  const isCritical = this.isStepCritical(step);
  
  // Log configuration selection for monitoring
  this.logger.debug({
    stepId: step.id,
    stepType,
    isCritical,
  }, 'Determining step configuration for throttling');

  switch (stepType) {
    case 'http_request':
    case 'oauth_api_call':
      return {
        concurrency: isCritical ? 2 : 5,
        rateLimit: {
          maxExecutions: 10,
          perMilliseconds: 10_000,
        },
        retry: {
          maxAttempts: isCritical ? 5 : 3,
          backoff: {
            type: 'exponential',
            delay: 3000,
          },
        },
      };
      
    // ... other step types
  }
}
```

### Critical Step Handling

Steps are considered critical by default unless explicitly marked otherwise:

```typescript
private isStepCritical(step: any): boolean {
  return step.config?.critical !== false;
}

// Usage in flow definition:
{
  id: 'optional-notification',
  type: 'http_request',
  config: {
    critical: false,  // This step can fail without stopping the flow
    url: 'https://api.notifications.com/send',
    // ...
  }
}
```

## 📈 Monitoring & Analytics

### Real-Time Metrics

The system logs comprehensive throttling metrics for each step:

```typescript
// Successful step completion logs:
{
  stepId: 'create-github-issue',
  stepType: 'http_request',
  executionId: 'exec_123',
  duration: 1250,                    // Actual execution time
  totalStepTime: 3500,              // Total time including throttling delays
  throttlingOverhead: 2250,         // Time spent waiting due to throttling
  retryCount: 1,                    // Number of retries attempted
  throttlingConfig: {
    concurrency: 5,
    rateLimit: '10/10000ms',
    maxRetries: 3,
  },
}
```

### Flow-Level Analytics

Each flow execution includes throttling insights:

```typescript
{
  executionId: 'exec_123',
  status: 'completed',
  totalSteps: 5,
  completedSteps: 4,
  failedSteps: 1,
  throttlingInsights: {
    globalDefaults: {
      concurrency: 10,
      rateLimit: '100/60000ms',
      retry: 'exponential-3x',
    },
    stepTypeDistribution: {
      http_request: 2,
      data_transform: 2,
      sandbox_sync: 1,
    },
    averageThrottlingOverhead: 'calculated-per-step',
    totalRetries: 'summed-across-steps',
  },
}
```

### Queue Depth Monitoring

Monitor queue depth and execution patterns:

```bash
# View throttling metrics in logs
docker logs tolstoy-app | grep "throttling metrics"

# Monitor retry patterns
docker logs tolstoy-app | grep "retry attempt"

# Track throttling overhead
docker logs tolstoy-app | grep "throttlingOverhead"
```

## 🚀 Usage Examples

### Flow Definition with Mixed Step Types

```typescript
const flow = {
  id: 'ecommerce-order-processing',
  name: 'E-commerce Order Processing',
  steps: [
    // Fast validation (high concurrency)
    {
      id: 'validate-order',
      type: 'data_transform',
      config: {
        script: 'return validateOrder(input);'
      }
    },
    
    // Critical payment processing (strict throttling)
    {
      id: 'process-payment',
      type: 'http_request',
      config: {
        critical: true,
        url: 'https://payments.stripe.com/v1/charges',
        method: 'POST',
        // Will use: concurrency=2, maxAttempts=5
      }
    },
    
    // Compute-intensive inventory update (moderate throttling)
    {
      id: 'update-inventory',
      type: 'sandbox_sync',
      config: {
        code: `
          const inventory = await updateProductQuantities(orderItems);
          return { inventory, updated: new Date() };
        `
      }
      // Will use: concurrency=3, fixed retry delay
    },
    
    // Non-critical notification (relaxed throttling)
    {
      id: 'send-notification',
      type: 'http_request',
      config: {
        critical: false,
        url: 'https://api.sendgrid.com/v3/mail/send',
        // Will use: concurrency=5, maxAttempts=3
      }
    }
  ]
};
```

### Executing Flows with Throttling

```typescript
// Start flow execution - throttling applied automatically
const execution = await flowExecutorService.executeFlow(
  'ecommerce-order-processing',
  {
    orgId: 'org-abc123',
    userId: 'user-xyz789',
  },
  {
    orderId: 'order-12345',
    items: [{ sku: 'WIDGET-001', quantity: 2 }],
    paymentMethod: 'stripe-payment-method-id'
  }
);

// Monitor execution with real-time events
const channel = ably.channels.get(`flows.${orgId}.${execution.id}`);
channel.subscribe('step-status', (message) => {
  const event = message.data;
  console.log(`Step ${event.stepId}: ${event.status}`);
  
  // Check throttling metrics
  if (event.throttlingOverhead > 5000) {
    console.warn(`High throttling overhead: ${event.throttlingOverhead}ms`);
  }
});
```

### Custom Throttling Configurations

For special cases, you can modify step configurations:

```typescript
// Override default throttling for specific scenarios
const customStep = {
  id: 'bulk-import',
  type: 'sandbox_sync',
  config: {
    critical: true,           // Make this step critical
    throttlingOverride: {     // Custom throttling (if implemented)
      concurrency: 1,         // Single threaded for data consistency
      rateLimit: {
        maxExecutions: 5,
        perMilliseconds: 60_000, // Very conservative: 5 per minute
      }
    }
  }
};
```

## ⚙️ Configuration

### Environment Variables

```env
# Inngest Configuration
INNGEST_API_KEY=your-inngest-api-key
INNGEST_EVENT_KEY=your-event-key  
INNGEST_WEBHOOK_KEY=your-webhook-signing-key

# Global Throttling Tuning (optional - uses defaults if not set)
INNGEST_GLOBAL_CONCURRENCY=10
INNGEST_GLOBAL_RATE_LIMIT_EXECUTIONS=100  
INNGEST_GLOBAL_RATE_LIMIT_PERIOD_MS=60000
INNGEST_GLOBAL_RETRY_ATTEMPTS=3
INNGEST_GLOBAL_RETRY_DELAY_MS=2000
```

### AWS Secrets Manager

Store Inngest credentials securely:

```bash
# Update the tolstoy/env secret with Inngest credentials
aws secretsmanager update-secret \
  --secret-id "tolstoy/env" \
  --secret-string '{
    "INNGEST_API_KEY": "your-actual-inngest-api-key",
    "INNGEST_EVENT_KEY": "your-actual-event-key", 
    "INNGEST_WEBHOOK_KEY": "your-actual-webhook-key"
  }' \
  --region us-east-1
```

## 🔒 Best Practices

### Throttling Strategy

1. **Start Conservative**: Begin with stricter limits and relax based on monitoring
2. **Monitor Overhead**: Track `throttlingOverhead` to identify bottlenecks  
3. **Critical Step Planning**: Mark only truly critical steps as `critical: true`
4. **Step Type Optimization**: Group similar operations into appropriate step types

### Error Handling

```typescript
// Proper error handling with throttling awareness
try {
  const result = await flowExecutor.executeFlow(flowId, context, variables);
  
  if (result.status === 'failed') {
    // Check if failure was due to throttling limits being hit
    const throttlingErrors = result.error?.code?.includes('RATE_LIMIT');
    
    if (throttlingErrors) {
      // Consider backing off or queuing for later execution
      await scheduleRetryExecution(flowId, context, variables, '+5 minutes');
    }
  }
} catch (error) {
  console.error('Flow execution failed:', error);
}
```

### Monitoring Alerts

Set up alerts for throttling issues:

```typescript
// Example monitoring integration
if (event.throttlingOverhead > 10_000) { // More than 10s overhead
  await alertingService.sendAlert({
    severity: 'warning',
    message: `High throttling overhead detected: ${event.throttlingOverhead}ms`,
    execution: event.executionId,
    step: event.stepId,
  });
}

if (event.retryCount >= 2) { // Multiple retries
  await alertingService.sendAlert({
    severity: 'info', 
    message: `Step required ${event.retryCount} retries`,
    execution: event.executionId,
    step: event.stepId,
  });
}
```

## 🧪 Testing

### Unit Tests

Test throttling configurations:

```typescript
describe('Throttling Configuration', () => {
  it('should apply strict limits to API calls', () => {
    const httpStep = { type: 'http_request', config: {} };
    const config = handler.getStepConfiguration(httpStep);
    
    expect(config.concurrency).toBe(5);
    expect(config.rateLimit.maxExecutions).toBe(10);
  });
  
  it('should apply generous limits to transforms', () => {
    const transformStep = { type: 'data_transform', config: {} };
    const config = handler.getStepConfiguration(transformStep);
    
    expect(config.concurrency).toBe(15);
    expect(config.rateLimit.maxExecutions).toBe(50);
  });
});
```

### Load Testing

Test throttling under load:

```typescript
describe('Throttling Under Load', () => {
  it('should handle concurrent executions within limits', async () => {
    const concurrentExecutions = 20;
    const promises = Array.from({ length: concurrentExecutions }, () =>
      flowExecutor.executeFlow('test-flow', context, {})
    );
    
    const results = await Promise.allSettled(promises);
    const successful = results.filter(r => r.status === 'fulfilled').length;
    
    // Should respect global concurrency limit of 10
    expect(successful).toBeLessThanOrEqual(10);
  });
});
```

### Integration Testing

Test real throttling behavior:

```bash
# Run integration tests with actual Inngest instance
npm run test:integration -- --testPathPattern=throttling

# Load test with multiple concurrent flows
npm run test:load -- --concurrent=50 --flow=test-throttling-flow
```

## 📋 API Reference

### Configuration Types

```typescript
interface ThrottlingConfig {
  concurrency?: number;
  rateLimit?: {
    maxExecutions: number;
    perMilliseconds: number;
  };
  retry?: {
    maxAttempts: number;
    backoff: {
      type: 'exponential' | 'fixed';
      delay: number;
    };
  };
}

interface StepConfig {
  critical?: boolean;
  throttlingOverride?: ThrottlingConfig;
  // ... other step config
}
```

### Monitoring Events

```typescript
interface ThrottlingMetrics {
  stepId: string;
  stepType: string;
  duration: number;
  totalStepTime: number;
  throttlingOverhead: number;
  retryCount: number;
  throttlingConfig: {
    concurrency: number;
    rateLimit: string;
    maxRetries: number;
  };
}

interface FlowThrottlingInsights {
  globalDefaults: {
    concurrency: number;
    rateLimit: string;
    retry: string;
  };
  stepTypeDistribution: Record<string, number>;
  averageThrottlingOverhead: string;
  totalRetries: string;
}
```

## 🎯 Performance Tuning

### Optimization Guidelines

1. **Profile Step Types**: Monitor which step types cause the most throttling overhead
2. **Adjust Concurrency**: Increase concurrency for well-behaved operations
3. **Optimize Retry Delays**: Tune backoff strategies based on failure patterns
4. **Critical Step Review**: Regularly audit which steps truly need critical status

### Scaling Considerations

- **Global Limits**: Increase global concurrency as your infrastructure scales
- **Rate Limit Tuning**: Adjust rate limits based on external API quotas
- **Multi-Region**: Consider region-specific throttling for global deployments
- **Resource Monitoring**: Track CPU/memory usage alongside throttling metrics

This comprehensive throttling system ensures reliable, scalable workflow execution while protecting external services and system resources.