# Enhanced Prometheus Metrics

This document describes the comprehensive Prometheus metrics available in Tolstoy for monitoring authentication, action execution, validation, and system performance.

## Authentication Metrics

### tool_auth_config_requests_total

**Description:** Tracks how often organizations configure authentication for their tools.

**Type:** Counter

**Labels:**
- `orgId` - Organization identifier
- `toolKey` - Tool identifier (e.g., "github", "slack", "notion")
- `action` - Type of configuration action: `upsert`, `get`, `delete`

**Example Queries:**
```promql
# Total auth configurations by organization
sum by (orgId) (tool_auth_config_requests_total)

# Most configured tools
sum by (toolKey) (tool_auth_config_requests_total)

# Configuration activity rate (per minute)
rate(tool_auth_config_requests_total[5m])
```

### oauth_redirects_total

**Description:** Counts OAuth2 login initiation attempts for user authentication flows.

**Type:** Counter

**Labels:**
- `orgId` - Organization identifier
- `toolKey` - Tool identifier for the OAuth provider

**Example Queries:**
```promql
# OAuth usage by tool
sum by (toolKey) (oauth_redirects_total)

# OAuth activity by organization
sum by (orgId) (oauth_redirects_total)

# OAuth redirect rate
rate(oauth_redirects_total[5m])
```

### oauth_callbacks_total

**Description:** Monitors OAuth2 callback processing, tracking both successful token exchanges and failures.

**Type:** Counter

**Labels:**
- `orgId` - Organization identifier  
- `toolKey` - Tool identifier for the OAuth provider
- `success` - Callback outcome: `true` or `false`

**Example Queries:**
```promql
# OAuth success rate by tool
sum by (toolKey) (oauth_callbacks_total{success="true"}) / 
sum by (toolKey) (oauth_callbacks_total) * 100

# Failed OAuth callbacks
oauth_callbacks_total{success="false"}

# OAuth conversion rate (callbacks/redirects)
sum by (toolKey) (oauth_callbacks_total{success="true"}) / 
sum by (toolKey) (oauth_redirects_total) * 100
```

## Action Execution Metrics

### action_execution_total

**Description:** Tracks standalone action executions outside of workflow contexts.

**Type:** Counter

**Labels:**
- `orgId` - Organization identifier
- `toolKey` - Tool identifier
- `actionKey` - Specific action identifier
- `status` - Execution outcome: `started`, `success`, `error`

**Example Queries:**
```promql
# Action success rate
sum by (actionKey) (action_execution_total{status="success"}) / 
sum by (actionKey) (action_execution_total{status!="started"}) * 100

# Most used actions
topk(10, sum by (actionKey) (action_execution_total))

# Action execution rate by organization
rate(action_execution_total[5m]) by (orgId)
```

### action_execution_seconds

**Description:** Measures the duration of standalone action executions.

**Type:** Histogram

**Labels:**
- `orgId` - Organization identifier
- `toolKey` - Tool identifier  
- `actionKey` - Specific action identifier

**Buckets:** [0.1, 0.5, 1, 5, 10, 30]

**Example Queries:**
```promql
# Average action execution time
histogram_quantile(0.5, action_execution_seconds_bucket)

# 95th percentile execution time by action
histogram_quantile(0.95, 
  sum by (actionKey, le) (action_execution_seconds_bucket)
)

# Actions taking longer than 5 seconds
increase(action_execution_seconds_bucket{le="5"}[5m]) - 
increase(action_execution_seconds_bucket{le="1"}[5m])
```

## Flow Step Metrics

### auth_injection_total

**Description:** Counts authentication header injections for flow steps, tracking auth usage across workflows.

**Type:** Counter

**Labels:**
- `orgId` - Organization identifier
- `stepId` - Individual step identifier
- `stepType` - Type of flow step (e.g., "http", "webhook") 
- `toolName` - Tool name being authenticated
- `authType` - Authentication method: `apiKey`, `oauth2`, `none`

**Example Queries:**
```promql
# Auth usage by tool
sum by (toolName) (auth_injection_total)

# Auth method distribution
sum by (authType) (auth_injection_total)

# Steps requiring authentication
count by (stepType) (auth_injection_total{authType!="none"})
```

## Validation Metrics

### validation_errors_total

**Description:** Tracks input validation failures across different contexts with detailed error categorization.

**Type:** Counter

**Labels:**
- `orgId` - Organization identifier
- `actionKey` - Action where validation failed (optional)
- `context` - Validation context: `action-execution`, `flow-execution`, `api-endpoint`
- `errorType` - Error category: `type-validation`, `range-validation`, `format-validation`, `enum-validation`, `pattern-validation`, `custom-validation`, `system-error`

**Example Queries:**
```promql
# Validation error rate by type
sum by (errorType) (validation_errors_total)

# Actions with most validation issues
topk(10, sum by (actionKey) (validation_errors_total))

# Validation errors by context
sum by (context) (validation_errors_total)

# Organizations with validation issues
sum by (orgId) (validation_errors_total)
```

## Monitoring Dashboards

### Authentication Dashboard

```promql
# Auth Configuration Activity
sum(rate(tool_auth_config_requests_total[5m])) by (action)

# OAuth Flow Health
sum(rate(oauth_redirects_total[5m])) - 
sum(rate(oauth_callbacks_total{success="true"}[5m]))

# Top Tools by Auth Usage
topk(5, sum(auth_injection_total) by (toolName))
```

### Performance Dashboard

```promql
# Action Execution Latency
histogram_quantile(0.99, 
  sum(rate(action_execution_seconds_bucket[5m])) by (le)
)

# System Load
sum(rate(action_execution_total[1m]))

# Error Rate
sum(rate(action_execution_total{status="error"}[5m])) / 
sum(rate(action_execution_total[5m])) * 100
```

### Quality Dashboard

```promql
# Validation Error Rate
sum(rate(validation_errors_total[5m]))

# Input Quality by Action
sum(validation_errors_total) by (actionKey) / 
sum(action_execution_total) by (actionKey) * 100

# Common Validation Issues
topk(5, sum(validation_errors_total) by (errorType))
```

## Alerting Rules

### Critical Alerts

```yaml
# High OAuth Failure Rate
- alert: OAuthFailureRateHigh
  expr: |
    (
      sum(rate(oauth_callbacks_total{success="false"}[5m])) /
      sum(rate(oauth_callbacks_total[5m]))
    ) * 100 > 25
  for: 2m
  labels:
    severity: critical
  annotations:
    summary: "OAuth failure rate is above 25%"

# Action Execution Errors
- alert: ActionExecutionErrors
  expr: |
    sum(rate(action_execution_total{status="error"}[5m])) > 10
  for: 1m  
  labels:
    severity: warning
  annotations:
    summary: "High rate of action execution errors"
```

### Performance Alerts

```yaml
# Slow Action Execution
- alert: SlowActionExecution
  expr: |
    histogram_quantile(0.95, 
      sum(rate(action_execution_seconds_bucket[5m])) by (le)
    ) > 10
  for: 3m
  labels:
    severity: warning
  annotations:
    summary: "95% of actions taking longer than 10 seconds"

# High Validation Error Rate
- alert: HighValidationErrors  
  expr: |
    sum(rate(validation_errors_total[5m])) > 50
  for: 2m
  labels:
    severity: warning
  annotations:
    summary: "High rate of input validation errors"
```

## Metrics Endpoint

All metrics are exposed at the `/metrics` endpoint in Prometheus format for scraping:

```bash
curl http://localhost:3000/metrics
```

The endpoint includes:
- All custom application metrics described above
- Default Node.js metrics (memory, CPU, event loop)
- HTTP request metrics
- Database connection metrics

## Retention and Storage

- **High-frequency metrics** (1s-1m): Retain for 24 hours
- **Medium-frequency metrics** (5m-1h): Retain for 7 days  
- **Low-frequency metrics** (1h+): Retain for 30 days
- **Long-term trends**: Downsample and retain for 1 year

This comprehensive metrics suite enables deep observability into Tolstoy's authentication flows, action executions, validation processes, and overall system health.