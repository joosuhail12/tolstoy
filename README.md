# Tolstoy - Enterprise Workflow Automation Platform

A production-ready workflow automation platform built with NestJS, Fastify, Prisma ORM, and Neon PostgreSQL. Features comprehensive OAuth2 authentication, Prometheus metrics, real-time monitoring, and enterprise-grade security.

## ✨ Key Features

- **🔐 OAuth2 Authentication**: Full OAuth2 support for GitHub, Google, Microsoft, Slack, Discord, LinkedIn, and Facebook
- **📊 Prometheus Metrics**: Production-ready metrics collection and monitoring with custom dashboards
- **🏥 Health Monitoring**: Multi-level health checks with detailed system status reporting
- **⚡ Action Execution**: Standalone action execution with automatic credential injection
- **🔧 Auth Injection**: Seamless credential management for workflow steps
- **✅ Test Coverage**: 437 automated tests with 100% pass rate across 29 test suites
- **🛡️ Enterprise Security**: Multi-tenant isolation, audit trails, and comprehensive security model
- **📈 Real-time Monitoring**: WebSocket integration with structured logging and error tracking

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Neon PostgreSQL database
- AWS Account (for Secrets Manager)
- Redis instance (for caching)

### Installation

```bash
# Install dependencies
npm install

# Generate Prisma client
npm run db:generate

# Apply database migrations
npm run db:migrate:deploy

# Start development server
npm run start:dev

# Run the comprehensive test suite (437 tests)
npm test
```

### Health Check Endpoints
```bash
# Basic health check (for load balancers)
curl http://localhost:3000/health

# Comprehensive system status
curl http://localhost:3000/status

# Detailed health with database, Redis, and system metrics
curl http://localhost:3000/status/detailed

# Prometheus metrics endpoint
curl http://localhost:3000/metrics
```

## 🔄 Database Migration Workflow

### Overview
This project uses Prisma migrations for schema evolution across environments. All schema changes should be managed through migrations to ensure consistency.

### Creating a Migration
To create and apply a new migration during development:

```bash
# Create and apply migration with descriptive name
npx prisma migrate dev --name add_user_roles

# Alternative: Use npm script
npm run db:migrate:dev -- --name add_user_roles
```

**What happens:**
- Prisma compares your schema with the database
- Generates SQL migration file in `prisma/migrations/`
- Applies the migration to your development database
- Regenerates Prisma Client

### Applying Migrations (Production/Staging)
Deploy migrations to non-development databases:

```bash
# Deploy all pending migrations
npx prisma migrate deploy

# Alternative: Use npm script  
npm run db:migrate:deploy
```

**Use this for:**
- Production deployments
- Staging environments
- CI/CD pipelines

### Migration Status & History
Check current database migration status:

```bash
# View migration status
npx prisma migrate status

# View migration history
npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma
```

### Resetting Local Database (⚠️ Data Loss!)
To reset and reapply all migrations locally:

```bash
# Reset database (DESTROYS ALL DATA)
npx prisma migrate reset --force

# Interactive reset
npx prisma migrate reset
```

### Schema Changes Without Migrations (Development Only)
For rapid prototyping in development:

```bash
# Push schema changes directly (bypasses migrations)
npm run db:push
```

⚠️ **Warning:** Only use `db:push` for prototyping. Always create proper migrations for production changes.

## 📊 Database Schema

### Core Models
- **Organization** - Multi-tenant organization structure
- **User** - Users belonging to organizations  
- **Tool** - External tools/APIs that can be integrated
- **Action** - Specific actions/endpoints for tools with input validation
- **Flow** - Workflow definitions with versioning
- **ExecutionLog** - Audit trail of workflow executions

### Relationships
- Organization → Users (1:many)
- Organization → Tools (1:many) 
- Organization → Actions (1:many)
- Organization → Flows (1:many)
- Tool → Actions (1:many)
- Flow → ExecutionLogs (1:many)
- User → ExecutionLogs (1:many)

## 📥 Action Input Schema

Each Action defines its expected input parameters via a metadata-based schema stored in the `inputSchema` field. This enables dynamic validation using Zod without storing executable code in the database.

### Schema Format

Actions store input parameters as an array of metadata objects:

```json
[
  {
    "name": "title",
    "label": "Ticket Title",
    "type": "string",
    "required": true,
    "description": "Short summary of the issue",
    "control": "text",
    "validation": {
      "min": 3,
      "max": 100
    }
  },
  {
    "name": "priority",
    "label": "Priority Level",
    "type": "enum",
    "options": ["low", "medium", "high"],
    "required": true,
    "control": "select",
    "default": "medium"
  },
  {
    "name": "assignee_email",
    "label": "Assignee Email",
    "type": "string",
    "required": false,
    "validation": {
      "email": true
    }
  },
  {
    "name": "due_date",
    "label": "Due Date",
    "type": "string",
    "required": false,
    "validation": {
      "pattern": "^\\d{4}-\\d{2}-\\d{2}$"
    }
  }
]
```

### Supported Parameter Types

| Type | Description | Validation Options | Example |
|------|-------------|-------------------|---------|
| `string` | Text input | `min`, `max`, `pattern`, `email`, `url` | User names, descriptions |
| `number` | Numeric input | `min`, `max` | Counts, IDs, amounts |
| `boolean` | True/false | None | Feature toggles |
| `enum` | Selection from options | `options` array required | Priority levels, statuses |
| `array` | List of values | None | Tags, categories |
| `object` | Complex nested data | None | Metadata objects |

### Parameter Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `name` | string | Yes | Parameter identifier (used as object key) |
| `type` | string | Yes | Data type (string, number, boolean, enum, array, object) |
| `required` | boolean | Yes | Whether parameter is mandatory |
| `label` | string | No | Human-readable display name |
| `description` | string | No | Help text explaining the parameter |
| `control` | string | No | UI control hint (text, textarea, select, checkbox, number) |
| `default` | any | No | Default value if not provided |
| `options` | string[] | No | Valid choices for enum type |
| `validation` | object | No | Type-specific validation rules |

### Validation Rules

#### String Validation
```json
{
  "validation": {
    "min": 3,           // Minimum length
    "max": 100,         // Maximum length
    "pattern": "^[A-Z]+$", // Regex pattern
    "email": true,      // Email format validation
    "url": true         // URL format validation
  }
}
```

#### Number Validation
```json
{
  "validation": {
    "min": 0,          // Minimum value
    "max": 999         // Maximum value
  }
}
```

### Input Validation Process

1. **Schema Loading**: Action's `inputSchema` is loaded from database
2. **Zod Schema Building**: Metadata is converted to Zod validation schema
3. **Input Validation**: Provided inputs are validated against schema
4. **Error Handling**: Validation errors return detailed field-level messages
5. **Execution**: Valid inputs are passed to action execution

### Example Action Creation

```bash
curl -X POST http://localhost:3000/actions \
  -H "Content-Type: application/json" \
  -H "X-Org-ID: your-org-id" \
  -H "X-User-ID: your-user-id" \
  -d '{
    "name": "Create Jira Ticket",
    "key": "create-jira-ticket", 
    "toolId": "tool-id",
    "method": "POST",
    "endpoint": "/rest/api/2/issue",
    "headers": {
      "Authorization": "Bearer {{secrets.jira_token}}"
    },
    "inputSchema": [
      {
        "name": "summary",
        "type": "string", 
        "required": true,
        "label": "Issue Summary",
        "validation": {"min": 5, "max": 255}
      },
      {
        "name": "priority",
        "type": "enum",
        "required": true,
        "options": ["Low", "Medium", "High", "Urgent"],
        "default": "Medium"
      }
    ]
  }'
```

### Validation Error Response

When validation fails, detailed error information is returned:

```json
{
  "statusCode": 400,
  "message": "Input validation failed",
  "error": "Bad Request",
  "errors": [
    {
      "field": "title",
      "message": "String must contain at least 3 character(s)",
      "code": "too_small"
    },
    {
      "field": "priority", 
      "message": "Invalid enum value. Expected 'low' | 'medium' | 'high', received 'urgent'",
      "code": "invalid_enum_value"
    }
  ]
}

## 🔐 OAuth2 Authentication

### Supported Providers
Tolstoy supports comprehensive OAuth2 integration with 7 major providers:

- **GitHub**: Full repository and user access with enterprise support
- **Google**: Google Workspace integration with proper scope management
- **Microsoft**: Microsoft 365 and Azure AD integration
- **Slack**: Complete Slack workspace integration with bot capabilities
- **Discord**: Discord server management and bot integration
- **LinkedIn**: Professional network integration and content publishing
- **Facebook**: Social media integration with Graph API access

### OAuth2 Configuration

#### Organization-Level Setup
```bash
# Configure OAuth2 for an organization
curl -X POST http://localhost:3000/auth/config \
  -H "Content-Type: application/json" \
  -H "X-Org-ID: your-org-id" \
  -H "X-User-ID: your-user-id" \
  -d '{
    "toolId": "github-tool-id",
    "type": "oauth2",
    "config": {
      "clientId": "your-github-client-id",
      "clientSecret": "your-github-client-secret",
      "redirectUri": "https://your-app.com/auth/callback",
      "scope": "repo user"
    }
  }'
```

#### OAuth2 Flow Initiation
```bash
# Get authorization URL for OAuth2 flow
curl -X GET http://localhost:3000/auth/oauth/github/authorize \
  -H "X-Org-ID: your-org-id" \
  -H "X-User-ID: your-user-id"

# Response:
# {
#   "url": "https://github.com/login/oauth/authorize?client_id=...",
#   "state": "unique-state-parameter"
# }
```

#### OAuth2 Callback Handling
```bash
# Handle OAuth2 callback (typically done by redirect)
curl -X POST http://localhost:3000/auth/oauth/callback \
  -H "Content-Type: application/json" \
  -d '{
    "code": "authorization-code-from-provider",
    "state": "state-parameter-from-authorization"
  }'

# Response:
# {
#   "credentialId": "cred-123",
#   "toolKey": "github",
#   "orgId": "org-123"
# }
```

### Authentication Features

- **Automatic Token Refresh**: OAuth2 tokens are automatically refreshed before expiration
- **Secure State Management**: Anti-replay protection with timestamp validation
- **Multi-tenant Isolation**: Credentials are scoped per organization
- **AWS Secrets Integration**: All tokens stored securely in AWS Secrets Manager
- **Audit Trails**: Complete logging of all authentication operations

### Auth Injection for Actions

Actions automatically receive appropriate credentials based on tool configuration:

```json
{
  "id": "github-create-issue",
  "name": "Create GitHub Issue",
  "toolId": "github-tool-id",
  "endpoint": "/repos/owner/repo/issues",
  "method": "POST",
  "headers": {
    "Authorization": "Bearer {{auth.access_token}}",
    "Accept": "application/vnd.github.v3+json"
  }
}
```

### Standalone Action Execution

Execute actions directly with automatic auth injection:

```bash
# Execute action with automatic credential injection
curl -X POST http://localhost:3000/actions/github-action-id/execute \
  -H "Content-Type: application/json" \
  -H "X-Org-ID: your-org-id" \
  -H "X-User-ID: your-user-id" \
  -d '{
    "inputs": {
      "title": "Bug Report",
      "body": "Found an issue with the login flow",
      "labels": ["bug", "priority-high"]
    }
  }'
```

## 📊 Monitoring & Metrics

### Prometheus Metrics

Comprehensive metrics collection for production monitoring:

#### Action Execution Metrics
- `action_executions_total{orgId,toolKey,actionKey,status}` - Action execution counter
- `action_execution_duration_seconds{orgId,toolKey,actionKey}` - Execution duration histogram
- `action_auth_injection_total{orgId,toolKey,authType,status}` - Auth injection counter

#### Authentication Metrics
- `auth_oauth_flows_total{orgId,provider,status}` - OAuth flow completion counter
- `auth_token_refresh_total{orgId,provider,status}` - Token refresh counter
- `auth_credential_injection_total{orgId,stepId,authType}` - Credential injection counter

#### HTTP Request Metrics
- `http_requests_total{method,route,status}` - HTTP request counter
- `http_request_duration_seconds{method,route}` - Request duration histogram

#### Example Prometheus Queries
```promql
# Action success rate by organization
rate(action_executions_total{status="success"}[5m]) / rate(action_executions_total[5m])

# OAuth flow error rate
rate(auth_oauth_flows_total{status="error"}[5m])

# 95th percentile action execution time
histogram_quantile(0.95, rate(action_execution_duration_seconds_bucket[5m]))
```

### Health Monitoring

Multiple levels of health check endpoints:

#### Basic Health (`/health`)
```json
{
  "status": "ok",
  "timestamp": "2025-01-09T10:00:00.000Z",
  "uptime": 3600,
  "version": "1.1.0"
}
```

#### Detailed Health (`/status/detailed`)
```json
{
  "status": "ok",
  "database": {
    "status": "healthy",
    "connectionTime": 15,
    "recordCounts": {
      "organizations": 150,
      "users": 1200,
      "tools": 45,
      "flows": 300
    }
  },
  "redis": {
    "status": "healthy",
    "connectionTime": 5
  },
  "environment": {
    "nodeVersion": "v20.10.0",
    "platform": "darwin",
    "uptime": 3600
  }
}
```

## 🔗 API Endpoints

### Multi-Tenant CRUD API
All endpoints (except Organizations) require multi-tenant headers:
- `X-Org-ID`: Organization identifier
- `X-User-ID`: User identifier

#### Organizations (No tenant headers required)
```bash
GET    /organizations       # List all organizations
POST   /organizations       # Create organization
GET    /organizations/:id   # Get organization by ID
PUT    /organizations/:id   # Update organization
DELETE /organizations/:id   # Delete organization
```

#### Users (Requires tenant headers)
```bash
GET    /users              # List users in organization
POST   /users              # Create user in organization
GET    /users/:id          # Get user by ID
PUT    /users/:id          # Update user
DELETE /users/:id          # Delete user
```

#### Tools (Requires tenant headers)
```bash
GET    /tools              # List tools in organization
POST   /tools              # Create tool in organization
GET    /tools/:id          # Get tool by ID
PUT    /tools/:id          # Update tool
DELETE /tools/:id          # Delete tool
```

#### Actions (Requires tenant headers)
```bash
GET    /actions            # List actions in organization
POST   /actions            # Create action
GET    /actions/:id        # Get action by ID
PUT    /actions/:id        # Update action
DELETE /actions/:id        # Delete action
POST   /actions/:id/execute # Execute action with auth injection
```

#### Flows (Requires tenant headers)
```bash
GET    /flows              # List flows in organization
POST   /flows              # Create flow
GET    /flows/:id          # Get flow by ID
PUT    /flows/:id          # Update flow
DELETE /flows/:id          # Delete flow
```

#### Execution Logs (Requires tenant headers)
```bash
GET    /execution-logs     # List execution logs in organization
POST   /execution-logs     # Create execution log
GET    /execution-logs/:id # Get execution log by ID
PUT    /execution-logs/:id # Update execution log
DELETE /execution-logs/:id # Delete execution log
```

#### Webhooks (Requires tenant headers)
```bash
GET    /webhooks             # List webhooks in organization
GET    /webhooks/event-types # Get valid event types (no headers required)
POST   /webhooks             # Register new webhook
GET    /webhooks/:id         # Get webhook by ID
PUT    /webhooks/:id         # Update webhook
DELETE /webhooks/:id         # Delete webhook
PATCH  /webhooks/:id/toggle  # Enable/disable webhook
POST   /webhooks/:id/test    # Send test event to webhook
```

#### Tool Credentials (Requires tenant headers)
```bash
GET    /tools/secrets                    # List all tools with credential status
POST   /tools/:toolId/secrets           # Store credentials for a tool
GET    /tools/:toolId/secrets           # Get credentials for a tool (masked by default)
GET    /tools/:toolId/secrets?unmask=true # Get unmasked credentials (use with caution)
DELETE /tools/:toolId/secrets           # Delete stored credentials for a tool
```

#### OAuth2 Authentication (Requires tenant headers)
```bash
GET    /auth/oauth/:provider/authorize  # Get OAuth2 authorization URL
POST   /auth/oauth/callback             # Handle OAuth2 callback
POST   /auth/config                     # Configure OAuth2 for organization
GET    /auth/config/:toolId             # Get OAuth2 configuration
DELETE /auth/config/:toolId             # Delete OAuth2 configuration
```

#### Health & Monitoring (No headers required)
```bash
GET    /health          # Basic health check for load balancers
GET    /status          # Comprehensive system status
GET    /status/detailed # Detailed health with database and Redis status
GET    /metrics         # Prometheus metrics endpoint
```

### API Testing Examples

#### Create an Organization
```bash
curl -X POST http://localhost:3000/organizations \
  -H "Content-Type: application/json" \
  -d '{"name":"My Organization"}'
```

#### Create a User (with tenant headers)
```bash
curl -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -H "X-Org-ID: your-org-id" \
  -H "X-User-ID: your-user-id" \
  -d '{"email":"user@example.com"}'
```

#### Create a Tool (with tenant headers)
```bash
curl -X POST http://localhost:3000/tools \
  -H "Content-Type: application/json" \
  -H "X-Org-ID: your-org-id" \
  -H "X-User-ID: your-user-id" \
  -d '{"name":"Slack API","baseUrl":"https://api.slack.com","authType":"bearer"}'
```

#### Store Tool Credentials (with tenant headers)
```bash
curl -X POST http://localhost:3000/tools/tool-123/secrets \
  -H "Content-Type: application/json" \
  -H "X-Org-ID: your-org-id" \
  -H "X-User-ID: your-user-id" \
  -d '{
    "credentials": {
      "api_key": "sk-1234567890abcdef",
      "client_secret": "cs-abcdef1234567890"
    }
  }'
```

#### List Tools with Credential Status
```bash
curl -X GET http://localhost:3000/tools/secrets \
  -H "X-Org-ID: your-org-id" \
  -H "X-User-ID: your-user-id"
```

#### Get Tool Credentials (masked)
```bash
curl -X GET http://localhost:3000/tools/tool-123/secrets \
  -H "X-Org-ID: your-org-id" \
  -H "X-User-ID: your-user-id"
```

### API Features
- **Type-safe validation** using DTOs and class-validator
- **Multi-tenant isolation** with automatic data filtering
- **Relationship handling** with proper foreign key validation
- **Error handling** with meaningful HTTP status codes
- **Auto-generated timestamps** for all entities

## 🔔 Webhook Registration

### Overview
Tolstoy supports webhook registration to enable real-time event notifications to external systems. Organizations can register webhooks to receive notifications when specific events occur within their workflows.

### Supported Event Types
- `flow.started` - Flow execution has started
- `flow.completed` - Flow execution completed successfully
- `flow.failed` - Flow execution failed
- `step.started` - Individual step execution started
- `step.completed` - Step completed successfully
- `step.failed` - Step execution failed
- `step.skipped` - Step was skipped
- `action.executed` - Action was executed
- `action.failed` - Action execution failed
- `webhook.test` - Test webhook event

### Webhook Registration

#### Register a New Webhook
```bash
curl -X POST http://localhost:3000/webhooks \
  -H "Content-Type: application/json" \
  -H "X-Org-ID: your-org-id" \
  -H "X-User-ID: your-user-id" \
  -d '{
    "name": "Production Notifications",
    "url": "https://example.com/webhook",
    "eventTypes": ["flow.completed", "flow.failed"],
    "secret": "your-webhook-secret",
    "enabled": true,
    "headers": {
      "X-Custom-Header": "custom-value"
    }
  }'
```

#### List Webhooks
```bash
# List all webhooks
curl -X GET http://localhost:3000/webhooks \
  -H "X-Org-ID: your-org-id" \
  -H "X-User-ID: your-user-id"

# Filter by event type
curl -X GET "http://localhost:3000/webhooks?eventType=flow.completed" \
  -H "X-Org-ID: your-org-id" \
  -H "X-User-ID: your-user-id"
```

#### Toggle Webhook Status
```bash
curl -X PATCH http://localhost:3000/webhooks/webhook-id/toggle \
  -H "X-Org-ID: your-org-id" \
  -H "X-User-ID: your-user-id"
```

#### Test Webhook
```bash
curl -X POST http://localhost:3000/webhooks/webhook-id/test \
  -H "X-Org-ID: your-org-id" \
  -H "X-User-ID: your-user-id"
```

### Webhook Security

#### Signature Verification
All webhook requests include an HMAC signature for verification:

1. **Headers Included**:
   - `x-webhook-signature`: HMAC-SHA256 signature
   - `x-webhook-timestamp`: Request timestamp
   - `x-webhook-event`: Event type
   - `x-webhook-delivery`: Unique delivery ID

2. **Signature Verification Process**:
```javascript
const crypto = require('crypto');

function verifyWebhookSignature(payload, signature, secret, timestamp) {
  // Check timestamp to prevent replay attacks (5 min tolerance)
  const currentTime = Date.now();
  if (Math.abs(currentTime - timestamp) > 5 * 60 * 1000) {
    return false;
  }

  // Verify signature
  const payloadWithTimestamp = { timestamp, ...payload };
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payloadWithTimestamp))
    .digest('hex');

  return `sha256=${expectedSignature}` === signature;
}
```

#### Security Best Practices
- Always use HTTPS URLs for production webhooks
- Store webhook secrets securely (minimum 16 characters)
- Implement timestamp validation to prevent replay attacks
- Verify signatures before processing webhook payloads
- Use unique secrets for each webhook registration

### Webhook Payload Format
```json
{
  "eventType": "flow.completed",
  "timestamp": 1234567890000,
  "data": {
    "flowId": "flow-123",
    "executionId": "exec-456",
    "status": "completed",
    "duration": 1500,
    "outputs": { ... }
  },
  "metadata": {
    "orgId": "org-123",
    "webhookId": "webhook-789",
    "deliveryId": "whd_1234567890_abc123"
  }
}
```

## 🔔 Webhook Dispatch via Inngest

### Overview
Tolstoy automatically dispatches HTTP POST requests to registered webhooks when flow and step events occur. Webhook dispatch uses Inngest for durability, retry logic, and reliable delivery.

### Supported Event Types
- **Flow Events**
  - `flow.started` - When a flow execution begins
  - `flow.completed` - When a flow execution completes successfully
  - `flow.failed` - When a flow execution fails
- **Step Events**
  - `step.started` - When a step begins execution
  - `step.completed` - When a step completes successfully
  - `step.failed` - When a step fails
  - `step.skipped` - When a step is skipped due to conditions
- **Action Events**
  - `action.executed` - When an action is executed
  - `action.failed` - When an action execution fails
- **Test Events**
  - `webhook.test` - For webhook endpoint testing

### Webhook Dispatch Workflow

```mermaid
graph LR
    A[Flow Step Completes] --> B[Publish Ably Event]
    B --> C[Queue Webhook Dispatch]
    C --> D[Inngest Processing]
    D --> E[Fetch Registered Webhooks]
    E --> F[For Each Webhook]
    F --> G[Create Signed Payload]
    G --> H[HTTP POST with Retry]
    H --> I[Success/Failure Logging]
```

### Dispatch Configuration
- **Workflow**: `dispatch-webhook`
- **Retries**: 5 attempts with exponential backoff
- **Backoff Strategy**: 1s → 2s → 4s → 8s → 16s
- **Timeout**: 30 seconds per request
- **Signing**: HMAC-SHA256 via webhook `secret` field

### Payload Structure
Webhooks receive standardized payloads for all event types:

```json
{
  "eventType": "step.completed",
  "timestamp": 1234567890000,
  "data": {
    "orgId": "org-123",
    "flowId": "flow-456",
    "executionId": "exec-789",
    "stepKey": "step-1",
    "status": "completed",
    "output": { "result": "success" },
    "stepName": "API Call",
    "duration": 1500
  },
  "metadata": {
    "orgId": "org-123",
    "webhookId": "webhook-123",
    "deliveryId": "whd_1234567890_abc123"
  }
}
```

### Flow Completion Payload
Flow events include additional execution metrics:

```json
{
  "eventType": "flow.completed",
  "timestamp": 1234567890000,
  "data": {
    "orgId": "org-123",
    "flowId": "flow-456",
    "executionId": "exec-789",
    "status": "completed",
    "totalSteps": 5,
    "completedSteps": 5,
    "failedSteps": 0,
    "skippedSteps": 0,
    "duration": 15000,
    "output": { "finalResult": "success" }
  },
  "metadata": {
    "orgId": "org-123",
    "webhookId": "webhook-123",
    "deliveryId": "whd_1234567890_abc123"
  }
}
```

### HTTP Headers
All webhook requests include standardized headers:

```http
Content-Type: application/json
x-webhook-event: step.completed
x-webhook-timestamp: 1234567890000
x-webhook-delivery: whd_1234567890_abc123
x-webhook-signature: sha256=a1b2c3d4e5f6... (if secret configured)
```

### Signature Verification
If a webhook has a `secret` configured, payloads are signed with HMAC-SHA256:

```javascript
// Example verification (Node.js)
const crypto = require('crypto');

function verifyWebhook(payload, signature, secret, timestamp) {
  const payloadWithTimestamp = {
    timestamp: parseInt(timestamp),
    ...payload,
  };
  
  const expectedSignature = 'sha256=' + 
    crypto.createHmac('sha256', secret)
      .update(JSON.stringify(payloadWithTimestamp))
      .digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}
```

### Error Handling
- **Network failures**: Automatic retry with exponential backoff
- **4xx responses**: Logged as webhook endpoint errors, no retry
- **5xx responses**: Retried up to 5 times
- **Timeout failures**: Retried with exponential backoff
- **Dispatch failures**: Logged but don't fail the original flow execution

### Monitoring
Webhook dispatch events are logged with structured data:

```json
{
  "level": "info",
  "msg": "Webhook delivered successfully",
  "webhookId": "webhook-123",
  "url": "https://api.example.com/webhook",
  "statusCode": 200,
  "deliveryId": "whd_1234567890_abc123",
  "orgId": "org-123",
  "eventType": "step.completed"
}
```

## 📊 Execution Logs & Observability

### Overview
Tolstoy provides comprehensive execution logging for every flow step to create an auditable trail and enable Prometheus metrics. Each step execution is tracked with detailed information including inputs, outputs, status, timing, and error details.

### Execution Log Model
```typescript
model ExecutionLog {
  id          String   @id @default(cuid())
  orgId       String
  userId      String
  flowId      String
  executionId String
  stepKey     String
  status      String   // 'started', 'completed', 'skipped', 'failed'
  inputs      Json
  outputs     Json?
  error       Json?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  @@index([orgId, flowId, executionId])
  @@index([executionId, stepKey])
}
```

### Step Logging Lifecycle
For each step execution, the system creates exactly one execution log with the following lifecycle:

1. **Step Started**: Log created with `status: 'started'`
   - Captures step configuration, context variables, and inputs
   - Records execution start timestamp

2. **Step Completed**: Log updated with `status: 'completed'`
   - Captures step outputs and execution results
   - Records completion timestamp and duration

3. **Step Failed**: Log updated with `status: 'failed'`
   - Captures error details including message, code, and stack trace
   - Records failure timestamp

4. **Step Skipped**: Log updated with `status: 'skipped'`
   - Records skip reason (e.g., executeIf condition failed)
   - Captures context that led to step being skipped

### API Endpoints

#### Retrieve Execution Logs
```bash
# Get logs for a specific flow execution
curl -X GET http://localhost:3000/execution-logs/exec-123 \
  -H "X-Org-ID: your-org-id" \
  -H "X-User-ID: your-user-id"
```

#### Get Step-Level Logs
```bash
# Get logs for a specific flow and execution
curl -X GET http://localhost:3000/execution-logs/flow-456/execution/exec-123 \
  -H "X-Org-ID: your-org-id" \
  -H "X-User-ID: your-user-id"
```

#### Get Execution Statistics
```bash
# Get aggregated execution statistics
curl -X GET http://localhost:3000/execution-logs/stats \
  -H "X-Org-ID: your-org-id" \
  -H "X-User-ID: your-user-id"
```

With optional time range filtering:
```bash
curl -X GET "http://localhost:3000/execution-logs/stats?from=2024-01-01&to=2024-12-31" \
  -H "X-Org-ID: your-org-id" \
  -H "X-User-ID: your-user-id"
```

### Sample Execution Log Entry
```json
{
  "id": "log-abc123",
  "orgId": "org-456",
  "userId": "user-789",
  "flowId": "flow-123",
  "executionId": "exec-456",
  "stepKey": "transform-data",
  "status": "completed",
  "inputs": {
    "stepName": "Transform Customer Data",
    "stepType": "data_transform",
    "config": {
      "script": "return input.name.toUpperCase()",
      "useSandbox": false
    },
    "executeIf": "variables.shouldTransform === true",
    "variables": {
      "shouldTransform": true,
      "customerData": { "name": "john doe" }
    },
    "stepOutputs": {
      "previous-step": { "result": "success" }
    }
  },
  "outputs": {
    "transformedName": "JOHN DOE",
    "duration": 120,
    "metadata": {
      "executionMode": "direct"
    }
  },
  "error": null,
  "createdAt": "2024-01-15T10:30:00.000Z",
  "updatedAt": "2024-01-15T10:30:00.120Z"
}
```

### Prometheus Metrics Integration
Execution logs are designed to support Prometheus metrics collection:

- **Step execution duration**: Time from started to completed/failed
- **Success/failure rates**: Aggregated by flow, step type, organization
- **Error classification**: Grouped by error codes and types
- **Throughput metrics**: Steps executed per time period
- **Flow completion rates**: End-to-end flow success metrics

### Statistics Response Format
```json
{
  "totalExecutions": 1543,
  "completedSteps": 1420,
  "failedSteps": 89,
  "skippedSteps": 34,
  "avgExecutionTime": 0,
  "successRate": 92.0,
  "timeRange": {
    "from": "2024-01-01T00:00:00.000Z",
    "to": "2024-01-31T23:59:59.999Z"
  }
}
```

### Observability Features
- **Multi-tenant isolation**: All logs are scoped to organization
- **Performance tracking**: Execution duration and timing metrics
- **Error correlation**: Link related errors across step executions
- **Audit trail**: Complete history of all step executions
- **Context preservation**: Full execution context saved with each log
- **Index optimization**: Efficient querying by execution ID and step key
- **Prometheus metrics**: Real-time step execution, retry, and error metrics

## 📊 Metrics Collection with Prometheus

### Overview
Tolstoy integrates with Prometheus to provide comprehensive metrics for monitoring workflow execution performance, retry behavior, and error patterns. All metrics are automatically instrumented and include multi-tenant labeling for proper organization isolation.

### Available Metrics

#### Step Execution Metrics
- **`step_execution_seconds`** - Histogram tracking step execution duration
  - **Labels**: `orgId`, `flowId`, `stepKey`
  - **Buckets**: [0.1, 0.5, 1, 5, 10] seconds
  - **Description**: Measures time from step start to completion/failure

- **`step_retries_total`** - Counter tracking step retry attempts
  - **Labels**: `orgId`, `flowId`, `stepKey`
  - **Description**: Incremented each time a step is retried (both manual retries and Inngest automatic retries)

- **`step_errors_total`** - Counter tracking step failures
  - **Labels**: `orgId`, `flowId`, `stepKey`
  - **Description**: Incremented for each step that fails or throws an exception

#### HTTP Request Metrics (Auto-instrumented)
- **`http_requests_total`** - Counter for all HTTP requests
  - **Labels**: `method`, `route`, `status`
  - **Description**: Total count of HTTP requests by method, route, and response status

- **`http_request_duration_seconds`** - Histogram for HTTP request duration
  - **Labels**: `method`, `route`, `status`
  - **Buckets**: [0.1, 0.5, 1, 2, 5] seconds
  - **Description**: Response time distribution for all HTTP endpoints

### Metrics Endpoint

#### Accessing Metrics
```bash
# Get all metrics in Prometheus format
curl http://localhost:3000/metrics

# Example output snippet:
# step_execution_seconds_bucket{orgId="org-123",flowId="flow-456",stepKey="data-transform",le="0.5"} 15
# step_execution_seconds_sum{orgId="org-123",flowId="flow-456",stepKey="data-transform"} 12.5
# step_retries_total{orgId="org-123",flowId="flow-456",stepKey="api-call"} 3
# step_errors_total{orgId="org-123",flowId="flow-456",stepKey="validation"} 1
```

#### Endpoint Security
- **Path**: `/metrics`
- **Authentication**: None (intended for Prometheus scraping)
- **Tenant Middleware**: Excluded from tenant validation
- **Rate Limiting**: None applied

### Integration Examples

#### Prometheus Configuration
```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'tolstoy'
    static_configs:
      - targets: ['localhost:3000']
    metrics_path: '/metrics'
    scrape_interval: 15s
```

#### Example Queries

##### Step Performance Monitoring
```promql
# Average step execution time by organization
rate(step_execution_seconds_sum[5m]) / rate(step_execution_seconds_count[5m])

# 95th percentile step execution time
histogram_quantile(0.95, rate(step_execution_seconds_bucket[5m]))

# Steps taking longer than 5 seconds
step_execution_seconds_bucket{le="5"} - step_execution_seconds_bucket{le="10"}
```

##### Error Rate Analysis
```promql
# Step error rate by flow
rate(step_errors_total[5m]) / rate(step_execution_seconds_count[5m])

# Most frequently failing steps
topk(10, increase(step_errors_total[1h]))

# Error rate by organization
sum(rate(step_errors_total[5m])) by (orgId)
```

##### Retry Pattern Analysis
```promql
# Retry rate by step type
rate(step_retries_total[5m])

# Steps with highest retry counts
topk(10, increase(step_retries_total[1h]))

# Retry success rate (retries vs final errors)
rate(step_retries_total[5m]) / rate(step_errors_total[5m])
```

##### HTTP Performance Monitoring
```promql
# API response time 99th percentile
histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m]))

# Error rate by endpoint
sum(rate(http_requests_total{status=~"4..|5.."}[5m])) by (route)

# Request throughput by method
sum(rate(http_requests_total[5m])) by (method)
```

### Alerting Rules

#### Critical Alerts
```yaml
# High error rate alert
- alert: HighStepErrorRate
  expr: rate(step_errors_total[5m]) / rate(step_execution_seconds_count[5m]) > 0.1
  for: 5m
  labels:
    severity: critical
  annotations:
    summary: "High step error rate detected"
    description: "Step error rate is {{ $value }} for {{ $labels.orgId }}/{{ $labels.flowId }}"

# Long-running steps
- alert: SlowStepExecution
  expr: histogram_quantile(0.95, rate(step_execution_seconds_bucket[5m])) > 30
  for: 10m
  labels:
    severity: warning
  annotations:
    summary: "Steps taking longer than expected"
```

### Dashboard Examples

#### Grafana Dashboard Panels

##### Step Execution Performance
- **Panel Type**: Time Series
- **Query**: `rate(step_execution_seconds_sum[5m]) / rate(step_execution_seconds_count[5m])`
- **Legend**: `{{orgId}} - {{flowId}} - {{stepKey}}`

##### Error Rate Tracking
- **Panel Type**: Stat
- **Query**: `sum(rate(step_errors_total[5m]))`
- **Thresholds**: Green (0-0.01), Yellow (0.01-0.05), Red (>0.05)

##### Retry Analysis
- **Panel Type**: Bar Chart
- **Query**: `topk(10, increase(step_retries_total[1h]))`

### Multi-tenant Metrics

#### Organization-level Monitoring
```promql
# Metrics by organization
sum(rate(step_execution_seconds_count[5m])) by (orgId)
sum(rate(step_errors_total[5m])) by (orgId)
sum(rate(step_retries_total[5m])) by (orgId)
```

#### Flow-level Analysis
```promql
# Performance by flow
avg(rate(step_execution_seconds_sum[5m]) / rate(step_execution_seconds_count[5m])) by (flowId)

# Most active flows
topk(10, sum(rate(step_execution_seconds_count[5m])) by (flowId))
```

### Performance Considerations

#### Metrics Storage
- **Cardinality**: Each unique combination of labels creates a new time series
- **Retention**: Configure appropriate retention based on metrics volume
- **Sampling**: Consider recording rules for long-term storage

#### Resource Usage
- **Memory**: Metrics are stored in memory until scraped
- **CPU**: Minimal impact from metrics collection
- **Network**: Metrics endpoint generates ~1-10KB per scrape depending on activity

### Troubleshooting

#### Common Issues
1. **No metrics appearing**: Verify `/metrics` endpoint is accessible and not blocked
2. **Missing labels**: Ensure step execution includes all required context (orgId, flowId, stepKey)
3. **High cardinality**: Monitor unique label combinations to prevent memory issues
4. **Scrape failures**: Check Prometheus configuration and network connectivity

#### Debugging Commands
```bash
# Check metrics endpoint
curl -v http://localhost:3000/metrics

# Verify specific metrics
curl http://localhost:3000/metrics | grep step_execution_seconds

# Check HTTP metrics
curl http://localhost:3000/metrics | grep http_requests_total
```

## 🛠️ Development Scripts

```bash
# Development
npm run start:dev          # Start with hot reload
npm run build             # Build TypeScript
npm start                 # Start production build

# Database Operations
npm run db:generate       # Generate Prisma client
npm run db:migrate:dev    # Create & apply migration (dev)
npm run db:migrate:deploy # Deploy migrations (prod)
npm run db:push          # Push schema directly (dev only)
npm run db:studio        # Open Prisma Studio

# Database Utilities
npx prisma migrate status    # Check migration status
npx prisma migrate reset     # Reset database
npx prisma db seed          # Run database seeds (if configured)
```

## 🔐 Environment Configuration

### Required Environment Variables
```bash
# Database - Neon PostgreSQL
DATABASE_URL="postgresql://user:password@host-pooler.neon.tech/db?sslmode=require&channel_binding=require"
DIRECT_URL="postgresql://user:password@host.neon.tech/db?sslmode=require&channel_binding=require"

# Application
NODE_ENV=development
PORT=3000
APP_NAME=Tolstoy

# AWS Secrets Manager (Optional)
AWS_REGION=us-east-1
AWS_SECRET_NAME=tolstoy-db-secret
USE_AWS_SECRETS=false
# AWS_ACCESS_KEY_ID=your-access-key-id       # For local development only
# AWS_SECRET_ACCESS_KEY=your-secret-access-key # For local development only
```

### Connection Types
- **DATABASE_URL**: Pooled connection for application queries
- **DIRECT_URL**: Direct connection for Prisma migrations

## 🔒 AWS Secrets Manager Integration

### Overview
Complete secrets management solution using AWS Secrets Manager for database credentials, OAuth tokens, API keys, and webhook secrets with multi-tenant organization isolation.

### Key Features
- Database credentials stored in `conductor-db-secret`
- Tool-specific OAuth tokens and API keys (`tolstoy/{tool}/{orgId}`)
- Automatic token refresh for OAuth providers
- Organization-based secret isolation
- 5-minute caching with stale fallback

**Core Services:**
- `AwsSecretsService` - Core AWS integration with caching and retry logic
- `SecretsResolver` - Tool-specific credential management  
- `OAuthTokenService` - OAuth lifecycle management with automatic refresh

### Configuration Modes
1. **Local Development** (`USE_AWS_SECRETS=false`): Uses local `.env` variables
2. **Production** (`NODE_ENV=production` or `USE_AWS_SECRETS=true`): Uses AWS Secrets Manager

### 🔄 Real-Time Flow Execution with Ably

Live monitoring and debugging of workflow executions using Ably WebSocket integration:

**Key Features:**
- **Real-time Events**: Step-by-step execution progress via WebSockets
- **Live Debugging**: Instant visibility into failures and performance metrics
- **Channel Structure**: `flows.{orgId}.{executionId}` for organization isolation
- **Event Types**: Step status (`started`, `completed`, `failed`, `skipped`) and execution lifecycle
- **Frontend Integration**: React hooks and JavaScript SDK support

**Technical Implementation:**
- Automatic retry logic with exponential backoff
- AWS Secrets Manager integration (Ably API key stored in `conductor-db-secret`)
- Comprehensive error handling and connection management
- Built-in rate limiting and performance optimization

### Tool Credentials Management

Tolstoy provides secure credential storage for external tools using AWS Secrets Manager. This enables organizations to store API keys, OAuth tokens, and other sensitive credentials with proper multi-tenant isolation.

#### Key Features
- **Secure Storage**: All credentials stored in AWS Secrets Manager with encryption at rest
- **Multi-tenant Isolation**: Credentials scoped per organization using naming convention `tolstoy/{orgId}/{toolId}`
- **Automatic Masking**: Sensitive values are masked in API responses by default
- **Credential Validation**: Input validation ensures secure credential formats
- **Audit Trail**: Full logging of credential operations for security compliance

#### Credential Storage Process
1. **Tool Registration**: Create a tool in the system
2. **Credential Storage**: Store credentials using the tool secrets API
3. **Secret Creation**: AWS Secrets Manager secret created with organization scoping
4. **Database Update**: Tool record updated with secret reference

#### Security Best Practices
- Credentials are never logged in plain text
- API responses mask credential values by default
- Short credentials (< 8 characters) rejected for sensitive fields
- AWS Secrets Manager provides encryption at rest and in transit
- Organization-based access control prevents cross-tenant access

#### Example Credential Storage Response
```json
{
  "toolId": "tool-123",
  "toolName": "Slack API",
  "maskedCredentials": {
    "api_key": "sk-12***********cdef",
    "client_secret": "cs-ab***********7890"
  },
  "createdAt": "2023-01-01T00:00:00.000Z",
  "updatedAt": "2023-01-02T00:00:00.000Z"
}
```

#### Tools with Credentials List Response
```json
[
  {
    "toolId": "tool-123",
    "toolName": "Slack API",
    "baseUrl": "https://api.slack.com",
    "authType": "bearer",
    "hasCredentials": true,
    "credentialKeys": ["api_key", "client_secret"]
  },
  {
    "toolId": "tool-456", 
    "toolName": "GitHub API",
    "baseUrl": "https://api.github.com",
    "authType": "token",
    "hasCredentials": false
  }
]
```

## ⚡ Inngest Durable Workflow Orchestration

### Overview
Tolstoy integrates with Inngest to provide durable, reliable workflow orchestration with automatic retries, step-level checkpointing, and comprehensive observability. This ensures that complex workflows can recover from failures, scale efficiently, and provide real-time execution visibility.

### Key Features
- **Durable Execution**: Automatic recovery from failures with step-level checkpointing
- **Reliable Queuing**: Flow executions are queued and processed reliably via Inngest events
- **Step-level Retries**: Individual step failures don't restart the entire workflow
- **Real-time Updates**: Live execution progress via Ably WebSocket integration
- **Execution Management**: Cancel, retry, and monitor workflow executions
- **Multi-tenant Isolation**: Organization-scoped execution with proper data isolation
- **Comprehensive Metrics**: Success rates, execution statistics, and performance analytics

### Configuration

#### Environment Variables
```bash
# Inngest Configuration
INNGEST_API_KEY=your_inngest_api_key_here
INNGEST_WEBHOOK_SECRET=your_inngest_webhook_secret_here
INNGEST_BASE_URL=https://api.inngest.com  # Optional, defaults to Inngest Cloud
```

#### AWS Secrets Manager Integration
When `USE_AWS_SECRETS=true` is set, Inngest configuration will be automatically loaded from AWS Secrets Manager instead of environment variables. The secrets are stored in the main environment secret (`tolstoy/env`) with the following keys:
- `INNGEST_API_KEY`
- `INNGEST_WEBHOOK_SECRET`

This provides enhanced security for production deployments by keeping sensitive configuration in AWS Secrets Manager.

### Workflow Execution Modes

#### 1. Legacy Direct Execution
For immediate execution without durability:
```bash
curl -X POST http://localhost:3000/flows/flow-123/execute \
  -H "Content-Type: application/json" \
  -H "X-Org-ID: your-org-id" \
  -H "X-User-ID: your-user-id" \
  -d '{
    "variables": { "userId": "user-456" },
    "useDurable": false
  }'
```

#### 2. Durable Execution with Inngest (Default)
For reliable, durable workflow execution:
```bash
curl -X POST http://localhost:3000/flows/flow-123/execute \
  -H "Content-Type: application/json" \
  -H "X-Org-ID: your-org-id" \
  -H "X-User-ID: your-user-id" \
  -d '{
    "variables": { "userId": "user-456" },
    "useDurable": true
  }'
```

### Execution Management API

#### List Flow Executions
```bash
curl -X GET http://localhost:3000/flows/flow-123/executions \
  -H "X-Org-ID: your-org-id" \
  -H "X-User-ID: your-user-id"
```

**Response:**
```json
[
  {
    "executionId": "exec_1704067200_abc123",
    "flowId": "flow-123",
    "status": "completed",
    "userId": "user-456",
    "userEmail": "user@example.com",
    "inputs": { "userId": "user-456" },
    "outputs": { "step1": "result", "step2": "data" },
    "createdAt": "2025-01-01T00:00:00.000Z"
  }
]
```

#### Get Execution Status
```bash
curl -X GET http://localhost:3000/flows/flow-123/executions/exec_1704067200_abc123 \
  -H "X-Org-ID: your-org-id" \
  -H "X-User-ID: your-user-id"
```

**Response:**
```json
{
  "executionId": "exec_1704067200_abc123",
  "flowId": "flow-123",
  "status": "running",
  "inputs": { "userId": "user-456" },
  "outputs": null,
  "createdAt": "2025-01-01T00:00:00.000Z"
}
```

#### Cancel Execution
```bash
curl -X POST http://localhost:3000/flows/flow-123/executions/exec_1704067200_abc123/cancel \
  -H "X-Org-ID: your-org-id" \
  -H "X-User-ID: your-user-id"
```

#### Retry Failed Execution
```bash
curl -X POST http://localhost:3000/flows/flow-123/executions/exec_1704067200_abc123/retry \
  -H "X-Org-ID: your-org-id" \
  -H "X-User-ID: your-user-id"
```

**Response:**
```json
{
  "executionId": "exec_1704067300_def456",
  "flowId": "flow-123",
  "status": "queued"
}
```

#### Get Execution Metrics
```bash
curl -X GET http://localhost:3000/flows/flow-123/metrics \
  -H "X-Org-ID: your-org-id" \
  -H "X-User-ID: your-user-id"
```

**Response:**
```json
{
  "totalExecutions": 150,
  "statusBreakdown": {
    "completed": 120,
    "failed": 20,
    "running": 5,
    "queued": 3,
    "cancelled": 2
  },
  "successRate": 80.0
}
```

### Durable Flow Step Execution

All step types from the original flow executor are supported with enhanced durability:

#### Supported Step Types
- **`sandbox_sync`**: Synchronous code execution in Daytona sandboxes
- **`sandbox_async`**: Asynchronous code execution with polling
- **`code_execution`**: Generic code execution (sync/async)
- **`data_transform`**: Data transformation with sandbox isolation
- **`conditional`**: Conditional logic with complex expressions
- **`http_request`**: HTTP API calls with retry logic
- **`delay`**: Controlled delays in workflow execution

#### Step Execution Flow
1. **Event Reception**: Inngest receives `flow.execute` event
2. **Step Processing**: Each step is wrapped in `step.run()` for durability
3. **Progress Updates**: Real-time updates published via Ably
4. **Error Handling**: Failed steps are retried with exponential backoff
5. **State Management**: Step outputs are preserved across failures
6. **Final Status**: Execution marked as completed/failed based on step results

### Real-time Execution Monitoring

#### Ably Integration
Inngest workflows publish real-time events via Ably WebSocket channels:

**Channel Structure:**
- **Execution Events**: `executions.{orgId}.{executionId}`
- **Step Events**: `steps.{orgId}.{executionId}.{stepId}`

**Event Types:**
```json
{
  "executionId": "exec_1704067200_abc123",
  "status": "started",
  "timestamp": "2025-01-01T00:00:00.000Z",
  "orgId": "org-123",
  "flowId": "flow-456",
  "totalSteps": 3
}
```

```json
{
  "stepId": "data-transform",
  "status": "completed",
  "timestamp": "2025-01-01T00:01:30.000Z",
  "executionId": "exec_1704067200_abc123",
  "stepName": "Transform User Data",
  "output": { "processedRecords": 150 },
  "duration": 1500
}
```

### Error Handling & Recovery

#### Automatic Retry Logic
- **Function-level Retries**: 3 automatic retries for entire function failures
- **Step-level Retries**: Individual step failures don't restart workflow
- **Exponential Backoff**: Increasing delays between retry attempts
- **Critical Step Handling**: Optional step criticality configuration

#### Failure Scenarios
1. **Network Errors**: Automatic retry with exponential backoff
2. **Service Timeouts**: Configurable timeout handling
3. **Step Failures**: Continue execution or halt based on step criticality
4. **Sandbox Errors**: Proper error propagation and logging
5. **Database Issues**: Resilient execution log management

#### Recovery Process
```typescript
// Example critical step configuration
{
  "id": "critical-data-sync",
  "type": "http_request",
  "name": "Sync Critical Data",
  "config": {
    "critical": true,  // Stops execution on failure
    "url": "https://api.example.com/sync",
    "method": "POST"
  }
}
```

### Performance & Scalability

#### Execution Concurrency
- **Default Concurrency**: 10 concurrent workflow executions
- **Organization Isolation**: Separate execution contexts per tenant
- **Step Parallelization**: Independent steps can run concurrently
- **Resource Management**: Automatic cleanup and resource optimization

#### Execution ID Format
```typescript
// Format: exec_{timestamp}_{random_hash}
"exec_1704067200_abc123"

// Benefits:
// - Chronological ordering
// - Collision resistance  
// - Easy debugging and tracking
```

#### Performance Monitoring
```json
{
  "level": "info",
  "time": "2025-01-01T00:02:15.000Z",
  "msg": "Flow execution completed successfully",
  "orgId": "org-123",
  "flowId": "flow-456", 
  "executionId": "exec_1704067200_abc123",
  "status": "completed",
  "completedSteps": 3,
  "failedSteps": 0,
  "totalSteps": 3,
  "totalDuration": 3250
}
```

### Security & Data Isolation

#### Multi-tenant Security
- **Organization Scoping**: All executions scoped to organization context
- **User Attribution**: Executions attributed to specific users
- **Data Isolation**: No cross-tenant data access in execution context
- **Audit Trail**: Complete execution history with user tracking

#### Secure Context Injection
```typescript
interface FlowExecutionContext {
  orgId: string;        // Organization identifier
  userId: string;       // User who initiated execution
  flowId: string;       // Flow being executed
  executionId: string;  // Unique execution identifier
  variables: Record<string, any>;  // Initial flow variables
  stepOutputs: Record<string, any>; // Previous step results
}
```

### Development & Testing

#### Local Development Setup
```bash
# Install Inngest dependencies
npm install inngest nestjs-inngest

# Configure environment
export INNGEST_API_KEY=your_development_key
export INNGEST_WEBHOOK_SECRET=your_webhook_secret

# Start development server
npm run start:dev
```

#### Testing Inngest Integration
```bash
# Run Inngest-specific tests
npm test src/flows/inngest/

# Run integration tests
npm test src/flows/inngest/inngest-execution.service.spec.ts
npm test src/flows/inngest/execute-flow.handler.spec.ts
```

#### Mock Development
When Inngest is unavailable, the implementation includes:
- Simulated event publishing
- Mock execution tracking
- Error scenario testing
- Performance simulation

### Troubleshooting

#### Common Issues
1. **Event Not Processed**: Verify Inngest API key and webhook secret
2. **Execution Stuck**: Check Inngest dashboard for function status
3. **Step Failures**: Review execution logs and step-specific errors
4. **Real-time Updates Missing**: Verify Ably service configuration
5. **Database Errors**: Check PostgreSQL connection and permissions

#### Debugging Commands
```bash
# Check execution logs
curl http://localhost:3000/flows/flow-123/executions/exec_123_abc/logs

# Monitor Inngest function health
# (via Inngest dashboard or monitoring tools)

# Verify Ably connection
curl http://localhost:3000/health
```

#### Health Monitoring
```json
{
  "inngestService": {
    "configured": true,
    "apiKeyPresent": true,
    "webhookSecretPresent": true,
    "functionsRegistered": 1,
    "lastEventSent": "2025-01-01T00:00:00.000Z"
  }
}
```

### Advanced Configuration

#### Custom Execution Policies
```typescript
// Flow-specific execution configuration
{
  "id": "high-priority-flow",
  "name": "Critical Data Pipeline", 
  "config": {
    "execution": {
      "concurrency": 5,        // Max concurrent executions
      "timeout": 300000,       // 5 minute timeout
      "retryPolicy": {
        "maxRetries": 5,
        "backoffStrategy": "exponential",
        "baseDelayMs": 1000
      }
    }
  }
}
```

#### Event Filtering
```bash
# Filter executions by status
curl -X GET "http://localhost:3000/flows/flow-123/executions?status=failed" \
  -H "X-Org-ID: your-org-id" \
  -H "X-User-ID: your-user-id"

# Pagination support
curl -X GET "http://localhost:3000/flows/flow-123/executions?limit=10&offset=20" \
  -H "X-Org-ID: your-org-id" \
  -H "X-User-ID: your-user-id"
```

## 🏝️ Daytona Sandbox Integration

### Overview
Tolstoy integrates with Daytona for secure, isolated code execution within workflow steps. This enables running user-provided scripts, data transformations, and conditional logic in a secure sandbox environment, protecting your infrastructure from potentially malicious code.

### Key Features
- **Secure Execution**: All code runs in isolated Daytona sandboxes
- **Multi-Language Support**: JavaScript, Python, Go, Rust automatic language detection
- **Sync & Async Modes**: Blocking execution or session-based background processing
- **Context Injection**: Access to flow variables, step outputs, and utility functions
- **Enhanced Security**: Replaces dangerous `eval()` calls with sandboxed execution
- **Comprehensive Logging**: Structured logging with execution metrics and error details

### Configuration

#### Environment Variables
```bash
# Daytona API Configuration
DAYTONA_API_KEY=your_daytona_api_key_here
DAYTONA_BASE_URL=https://api.daytona.dev
DAYTONA_SYNC_TIMEOUT=30000     # 30 seconds for sync execution
DAYTONA_ASYNC_TIMEOUT=300000   # 5 minutes for async execution
```

#### AWS Secrets Manager Integration
When `USE_AWS_SECRETS=true` is set, Daytona configuration will be automatically loaded from AWS Secrets Manager instead of environment variables. The secrets are stored in the main application secret (`conductor-db-secret`) with the following keys:
- `DAYTONA_API_KEY`
- `DAYTONA_BASE_URL` 
- `DAYTONA_SYNC_TIMEOUT`
- `DAYTONA_ASYNC_TIMEOUT`

This provides enhanced security for production deployments by keeping sensitive configuration in AWS Secrets Manager rather than environment variables.

#### Service Integration
The `SandboxService` is automatically available throughout the application:
```typescript
// Sync execution - blocks until completion
const result = await sandboxService.runSync(code, context);

// Async execution - returns session ID immediately  
const sessionId = await sandboxService.runAsync(code, context);

// Retrieve async result
const asyncResult = await sandboxService.getAsyncResult(sessionId, context);
```

### Flow Step Types

#### 1. Synchronous Execution (`sandbox_sync`)
Executes code and waits for completion. Best for quick scripts and transformations.

```json
{
  "id": "data-process",
  "type": "sandbox_sync",
  "name": "Process User Data",
  "config": {
    "code": "return context.variables.users.filter(u => u.active).map(u => ({ id: u.id, name: u.name }));",
    "language": "javascript"
  }
}
```

#### 2. Asynchronous Execution (`sandbox_async`)
Starts execution in background. Useful for long-running processes or when immediate response is needed.

```json
{
  "id": "heavy-computation",
  "type": "sandbox_async", 
  "name": "Complex Data Analysis",
  "config": {
    "code": "// Long running analysis code here\nreturn processLargeDataset(context.stepOutputs.dataFetch);",
    "waitForCompletion": false,
    "pollInterval": 1000,
    "maxPollAttempts": 300
  }
}
```

#### 3. Generic Code Execution (`code_execution`)
Flexible step type that chooses sync or async based on configuration:

```json
{
  "id": "flexible-code",
  "type": "code_execution",
  "name": "Flexible Execution",
  "config": {
    "code": "return { result: 'processed', timestamp: new Date() };",
    "mode": "sync"
  }
}
```

### Language Support

#### Automatic Language Detection
The sandbox service automatically detects programming languages:

```javascript
// JavaScript - detected by 'function', 'const', 'console.log'
function processData(input) {
  console.log('Processing:', input);
  return { processed: true };
}

# Python - detected by 'def', 'import', 'print('
def process_data(input_data):
    print(f"Processing: {input_data}")
    return {"processed": True}

// Go - detected by 'func', 'package', 'fmt.Print'
func processData(input interface{}) map[string]bool {
    fmt.Printf("Processing: %v\n", input)
    return map[string]bool{"processed": true}
}

// Rust - detected by 'fn', 'let mut', 'println!'
fn process_data(input: &str) -> std::collections::HashMap<String, bool> {
    println!("Processing: {}", input);
    let mut result = std::collections::HashMap::new();
    result.insert("processed".to_string(), true);
    result
}
```

### Execution Context

#### Available Variables
Every sandbox execution has access to:
```javascript
{
  // Flow variables from initial execution input
  variables: {
    userId: "user-123",
    environmentType: "production"
  },
  
  // Outputs from previous steps
  stepOutputs: {
    "fetch-data": { users: [{ id: 1, name: "John" }] },
    "validate-input": { isValid: true }
  },
  
  // Execution metadata
  meta: {
    orgId: "org-123",
    userId: "user-456", 
    flowId: "flow-789",
    stepId: "current-step",
    executionId: "exec-abc",
    timestamp: "2025-01-01T00:00:00Z"
  },
  
  // Utility functions
  utils: {
    log: (message, data) => ({ type: 'log', message, data, timestamp: '...' }),
    error: (message, data) => ({ type: 'error', message, data, timestamp: '...' }),
    warn: (message, data) => ({ type: 'warn', message, data, timestamp: '...' })
  }
}
```

#### Example Usage in Code
```javascript
// Access flow variables
const environmentType = context.variables.environmentType;

// Use previous step outputs
const users = context.stepOutputs['fetch-users'].data;

// Log execution info
context.utils.log('Starting data processing', { userCount: users.length });

// Process data
const activeUsers = users.filter(user => {
  if (user.active) {
    context.utils.log('Processing active user', { userId: user.id });
    return true;
  }
  return false;
});

// Return result
return {
  processedUsers: activeUsers,
  summary: {
    total: users.length,
    active: activeUsers.length,
    processedAt: context.meta.timestamp
  }
};
```

### Enhanced Step Types

#### Secure Data Transformation
The `data_transform` step type now uses sandbox execution by default:

```json
{
  "id": "transform-user-data",
  "type": "data_transform", 
  "name": "Transform User Data",
  "config": {
    "script": "return input.users.map(user => ({ ...user, displayName: `${user.firstName} ${user.lastName}` }));",
    "useSandbox": true
  }
}
```

#### Secure Conditional Logic
The `conditional` step type supports sandbox execution for complex conditions:

```json
{
  "id": "check-business-rules",
  "type": "conditional",
  "name": "Check Business Rules", 
  "config": {
    "condition": "context.variables.userRole === 'admin' && context.stepOutputs.validation.score > 0.8",
    "useSandbox": true
  }
}
```

### Error Handling & Monitoring

#### Execution Results
All sandbox executions return detailed results:
```typescript
interface SandboxExecutionResult {
  success: boolean;
  output?: any;
  error?: {
    message: string;
    code?: string;
    stack?: string;
  };
  executionTime: number;
  sessionId?: string; // For async executions
}
```

#### Structured Logging
Comprehensive logging with execution context:
```json
{
  "level": "info",
  "time": "2025-01-01T00:00:00.000Z",
  "msg": "Synchronous sandbox execution completed successfully",
  "orgId": "org-123",
  "userId": "user-456",
  "flowId": "flow-789", 
  "stepId": "data-transform",
  "executionId": "exec-abc",
  "executionTime": 1250,
  "mode": "sync"
}
```

#### Error Scenarios
- **Syntax Errors**: Invalid code syntax
- **Runtime Errors**: Exceptions during execution  
- **Timeout Errors**: Execution exceeds time limits
- **Network Errors**: Daytona API connectivity issues
- **Resource Errors**: Insufficient sandbox resources

## 🐞 Error Reporting with Sentry

Tolstoy integrates with Sentry for centralized error monitoring, alerting, and traceability of issues in production. All critical errors, validation failures, and runtime exceptions are automatically captured and reported.

### Configuration

#### DSN Setup
The Sentry DSN is stored securely in AWS Secrets Manager under the `tolstoy/env` secret:
```bash
# Add SENTRY_DSN to your AWS secret
aws secretsmanager update-secret \
  --secret-id tolstoy/env \
  --secret-string '{"SENTRY_DSN":"your-sentry-dsn-here"}'
```

#### Environment Variables
For local development, set the environment variable:
```bash
export SENTRY_DSN="https://your-sentry-dsn@sentry.io/project-id"
```

### Initialization

Sentry is automatically initialized in `main.ts` with:
- Environment-based configuration (development/production)
- HTTP request tracing integration
- Prisma ORM integration
- Custom error filtering and sanitization

```typescript
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: nodeEnv === 'production' ? 0.25 : 1.0,
  integrations: [
    new Integrations.Http({ tracing: true }),
    new Integrations.Prisma(),
  ],
});
```

### Error Capture & Context

#### Global Exception Filter
All unhandled exceptions are captured via `SentryExceptionFilter`:
- **Server errors (5xx)**: Automatically captured in Sentry
- **Client errors (4xx)**: Logged locally, not reported to Sentry
- **Request context**: URL, method, headers, tenant information
- **Sensitive data**: Automatically sanitized before reporting

#### Instrumented Services

**Input Validation Errors**
```typescript
// Validation failures include detailed context
Sentry.addBreadcrumb({
  message: 'Input validation failed',
  category: 'validation',
  data: {
    errorCount: issues.length,
    fields: ['email', 'name'],
    parameterCount: 5,
  },
});
```

**Step Execution Errors**
```typescript
// Step failures include execution context
Sentry.withScope((scope) => {
  scope.setTag('orgId', 'org-123');
  scope.setTag('flowId', 'flow-456');
  scope.setTag('stepKey', 'data-transform');
  scope.setContext('stepExecution', {
    stepType: 'sandbox',
    duration: 1500,
    executionId: 'exec-789',
  });
  Sentry.captureException(error);
});
```

**Sandbox Execution Errors**
```typescript
// Sandbox failures include code context
scope.setContext('sandboxExecution', {
  mode: 'sync',
  codeLength: 245,
  codeSnippet: 'const result = process(data)...',
  language: 'javascript',
  timeout: 30000,
});
```

### Performance Tracing

Critical operations include performance spans:

#### Step Execution Tracing
```typescript
const span = Sentry.startSpan({
  op: 'step.execute',
  name: 'http_request:API Call',
  attributes: {
    'step.id': 'api-call-1',
    'step.type': 'http_request',
    'org.id': 'org-123',
    'flow.id': 'flow-456',
  },
});
```

#### Sandbox Execution Tracing
```typescript
const span = Sentry.startSpan({
  op: 'sandbox.execute.sync',
  name: 'Sandbox Sync Execution',
  attributes: {
    'sandbox.mode': 'sync',
    'sandbox.language': 'javascript',
    'sandbox.code_length': 245,
  },
});
```

### Error Categories & Tags

Errors are automatically tagged for easy filtering:

| Tag | Values | Description |
|-----|--------|-------------|
| `errorType` | `validation`, `step-execution`, `sandbox-sync-execution` | Error category |
| `orgId` | Organization ID | Tenant isolation |
| `flowId` | Flow ID | Workflow identification |
| `stepKey` | Step identifier | Specific step that failed |
| `stepType` | `http_request`, `sandbox`, `webhook`, etc. | Step type |

### Security & Privacy

#### Sensitive Data Sanitization
- **Headers**: Authorization, cookies, API keys automatically redacted
- **Step Config**: Passwords, secrets, tokens removed before reporting
- **Code Snippets**: Sensitive patterns replaced with `[REDACTED]`
- **Request Bodies**: Filtered out to prevent data leakage

#### Example Sanitization
```typescript
// Original
{
  "authorization": "Bearer secret-token",
  "apiKey": "sk-1234567890abcdef",
  "password": "user-password"
}

// Sanitized for Sentry
{
  "authorization": "[REDACTED]",
  "apiKey": "[REDACTED]",
  "password": "[REDACTED]"
}
```

### Monitoring Dashboard

Use Sentry's dashboard to monitor:
- **Error rates** by organization, flow, and step type
- **Performance metrics** for critical operations
- **User impact** analysis with tenant-level filtering
- **Alert notifications** for production incidents

### Troubleshooting

#### Common Issues
1. **DSN not found**: Check AWS Secrets Manager configuration
2. **No errors in Sentry**: Verify DSN and network connectivity  
3. **Missing context**: Ensure tenant headers are provided
4. **Performance impact**: Adjust `tracesSampleRate` if needed

#### Debug Mode
Enable debug logging for development:
```typescript
Sentry.init({
  debug: process.env.NODE_ENV === 'development',
  // ... other config
});
```

### Performance & Scaling

#### Execution Modes
- **Sync Mode**: Best for quick transformations (< 30 seconds)
- **Async Mode**: Ideal for long-running processes (up to 5 minutes)
- **Polling Strategy**: Configurable poll intervals for async completion

#### Timeout Configuration
```typescript
// Sync execution timeout
DAYTONA_SYNC_TIMEOUT=30000 // 30 seconds

// Async execution timeout  
DAYTONA_ASYNC_TIMEOUT=300000 // 5 minutes

// Custom timeouts in step config
{
  "config": {
    "code": "...",
    "pollInterval": 2000,      // Poll every 2 seconds
    "maxPollAttempts": 150     // Max 5 minutes (150 * 2s)
  }
}
```

### Security Considerations

#### Sandbox Isolation
- Code runs in isolated Daytona containers
- No access to host system or network
- Limited execution time and resources
- Automatic cleanup after execution

#### Data Security
- Sensitive data masked in logs
- Organization-based execution context isolation
- Secure credential handling through context injection
- No persistent data storage in sandboxes

#### Best Practices
- Use sandbox execution for all user-provided code
- Set appropriate timeout limits
- Monitor execution resources and performance
- Implement proper error handling and logging
- Validate input data before sandbox execution

### Development & Testing

#### Local Development
```bash
# Enable Daytona integration (requires API key)
DAYTONA_API_KEY=your_test_key_here
DAYTONA_BASE_URL=https://api.daytona.dev

# Run with sandbox execution
npm run start:dev
```

#### Testing Sandbox Integration
```bash
# Run sandbox service tests
npm test src/sandbox/sandbox.service.spec.ts

# Run flow executor integration tests
npm test src/flows/flow-executor-sandbox.integration.spec.ts
```

#### Mock Development
When Daytona API is unavailable, the implementation includes comprehensive mocks:
- Simulated API responses with realistic delays
- Error scenario testing
- Language detection validation
- Async execution simulation

### Troubleshooting

#### Common Issues
1. **API Key Invalid**: Verify `DAYTONA_API_KEY` is correct
2. **Network Timeout**: Check `DAYTONA_BASE_URL` and connectivity
3. **Execution Timeout**: Increase timeout values or optimize code
4. **Memory Errors**: Reduce data size or use async mode
5. **Language Detection**: Manually specify language in step config

#### Health Check
```bash
# Check sandbox service status
curl http://localhost:3000/health

# Sandbox health info (if health endpoint includes it)
{
  "sandboxService": {
    "configured": true,
    "apiKeyPresent": true,
    "baseUrl": "https://api.daytona.dev",
    "syncTimeout": 30000,
    "asyncTimeout": 300000
  }
}
```

### Setting Up AWS Secrets Manager

#### 1. Create Secret in AWS
```bash
# Using AWS CLI
aws secretsmanager create-secret \
  --name tolstoy-db-secret \
  --description "Database credentials for Tolstoy application" \
  --secret-string '{"DATABASE_URL":"postgresql://user:password@host-pooler.neon.tech/db?sslmode=require","DIRECT_URL":"postgresql://user:password@host.neon.tech/db?sslmode=require"}'
```

#### 2. Environment Configuration
```bash
# Production environment variables
AWS_REGION=us-east-1
AWS_SECRET_NAME=tolstoy-db-secret
USE_AWS_SECRETS=true
# No DATABASE_URL needed - retrieved from Secrets Manager
```

#### 3. IAM Permissions
Your application needs the following IAM policy:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue"
      ],
      "Resource": "arn:aws:secretsmanager:us-east-1:ACCOUNT-ID:secret:tolstoy-db-secret*"
    }
  ]
}
```

#### 4. Authentication Methods
- **Production**: Use IAM roles (recommended)
- **Local Development**: Use AWS credentials in environment variables (not recommended for production)

### Testing AWS Integration
```bash
# Enable AWS Secrets Manager locally (requires AWS credentials)
export USE_AWS_SECRETS=true
export AWS_ACCESS_KEY_ID=your-access-key
export AWS_SECRET_ACCESS_KEY=your-secret-key
export AWS_REGION=us-east-1

npm start
```

### Troubleshooting AWS Integration
- **CredentialsProviderError**: Check AWS credentials configuration
- **AccessDenied**: Verify IAM permissions for Secrets Manager
- **SecretNotFound**: Ensure secret exists in the correct AWS region
- **NetworkError**: Check AWS region and network connectivity

## 🚀 AWS EC2 Deployment

### Overview
The Tolstoy application is deployed on AWS EC2 with a production-ready setup using Ubuntu 22.04 LTS, Node.js v20, PM2, and Nginx.

### Deployment Specifications
- **Instance Type**: t3.medium (2 vCPUs, 4 GB RAM)
- **Operating System**: Ubuntu 22.04 LTS
- **Runtime**: Node.js v20 LTS
- **Process Manager**: PM2
- **Reverse Proxy**: Nginx
- **Secrets Management**: AWS Secrets Manager
- **Database**: Neon PostgreSQL

### Quick Deployment Guide

#### 1. Prerequisites
- AWS CLI configured with appropriate permissions
- SSH key pair for EC2 access

#### 2. Deploy Infrastructure
```bash
# Create AWS Secrets Manager secret
./scripts/create-aws-secret.sh

# Set up IAM role for EC2
./scripts/setup-iam-role.sh

# Deploy EC2 instance
./scripts/deploy-ec2.sh
```

#### 3. Deploy Application
```bash
# SSH to EC2 instance
ssh -i tolstoy-key-pair.pem ubuntu@<PUBLIC_IP>

# Copy and run server setup
scp -i tolstoy-key-pair.pem scripts/app-deploy.sh ubuntu@<PUBLIC_IP>:~/
./app-deploy.sh
```

### AWS Secrets Manager Configuration

#### Secret Details
- **Secret Name**: `tolstoy-db-secret`
- **Region**: `us-east-1`
- **Keys**: `DATABASE_URL`, `DIRECT_URL`

#### Environment Variables
```bash
NODE_ENV=production
AWS_REGION=us-east-1
AWS_SECRET_NAME=tolstoy-db-secret
USE_AWS_SECRETS=true
```

### PM2 Process Management

#### Useful Commands
```bash
# Check application status
pm2 status

# View logs
pm2 logs tolstoy-api

# Restart application
pm2 restart tolstoy-api

# Stop application
pm2 stop tolstoy-api

# Start application
pm2 start tolstoy-api
```

#### PM2 Configuration
The application uses an ecosystem configuration file:
```javascript
module.exports = {
  apps: [{
    name: 'tolstoy-api',
    script: 'dist/main.js',
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
      AWS_REGION: 'us-east-1',
      AWS_SECRET_NAME: 'tolstoy-db-secret',
      USE_AWS_SECRETS: 'true'
    },
    instances: 1,
    autorestart: true,
    max_memory_restart: '1G'
  }]
};
```

### Nginx Reverse Proxy

#### Configuration
Nginx is configured to proxy requests to the Node.js application running on port 3000:
```nginx
server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Health Monitoring

#### Health Check Endpoints
- **Basic Health**: `http://<PUBLIC_IP>/health`
- **Comprehensive Status**: `http://<PUBLIC_IP>/status`  
- **Detailed Status**: `http://<PUBLIC_IP>/status/detailed`

### Security & IAM

#### IAM Role Permissions
The EC2 instance requires an IAM role with the following policy:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue",
        "secretsmanager:DescribeSecret"
      ],
      "Resource": [
        "arn:aws:secretsmanager:*:*:secret:tolstoy-db-secret*"
      ]
    }
  ]
}
```

#### Security Group Rules
- **SSH (22)**: For server management
- **HTTP (80)**: For web traffic
- **HTTPS (443)**: For secure web traffic

### Deployment Scripts

#### Available Scripts
- `scripts/deploy-ec2.sh` - Deploy EC2 infrastructure
- `scripts/create-aws-secret.sh` - Create AWS Secrets Manager secret
- `scripts/setup-iam-role.sh` - Set up IAM role and policies
- `scripts/app-deploy.sh` - Deploy application on EC2 instance

### Troubleshooting

#### Common Issues
1. **Database Connection**: Verify AWS Secrets Manager setup
2. **PM2 Issues**: Check logs with `pm2 logs tolstoy-api`
3. **Nginx Issues**: Test config with `sudo nginx -t`
4. **IAM Permissions**: Ensure EC2 has proper IAM role attached

#### Log Locations
- **Application Logs**: `/home/ubuntu/logs/`
- **Nginx Logs**: `/var/log/nginx/`
- **PM2 Logs**: `~/.pm2/logs/`

## 📁 Project Structure

```
tolstoy/
├── prisma/
│   ├── migrations/           # Database migrations
│   │   ├── 20250806_init/   
│   │   │   └── migration.sql
│   │   └── migration_lock.toml
│   └── schema.prisma        # Database schema definition
├── src/
│   ├── common/              # Shared utilities
│   │   ├── decorators/      # Custom decorators (e.g., @Tenant)
│   │   ├── interfaces/      # TypeScript interfaces
│   │   └── middleware/      # Middleware (tenant validation)
│   ├── organizations/       # Organization CRUD module
│   │   ├── dto/            # Data transfer objects
│   │   ├── organizations.controller.ts
│   │   ├── organizations.service.ts
│   │   └── organizations.module.ts
│   ├── users/              # User CRUD module
│   │   ├── dto/
│   │   ├── users.controller.ts
│   │   ├── users.service.ts
│   │   └── users.module.ts
│   ├── tools/              # Tool CRUD module
│   │   ├── dto/
│   │   ├── tools.controller.ts
│   │   ├── tools.service.ts
│   │   └── tools.module.ts
│   ├── actions/            # Action CRUD module
│   │   ├── dto/
│   │   ├── actions.controller.ts
│   │   ├── actions.service.ts
│   │   └── actions.module.ts
│   ├── flows/              # Flow CRUD module
│   │   ├── dto/
│   │   ├── flows.controller.ts
│   │   ├── flows.service.ts
│   │   └── flows.module.ts
│   ├── execution-logs/     # ExecutionLog CRUD module
│   │   ├── dto/
│   │   ├── execution-logs.controller.ts
│   │   ├── execution-logs.service.ts
│   │   └── execution-logs.module.ts
│   ├── main.ts             # Application bootstrap
│   ├── app.module.ts       # Root module
│   ├── app.controller.ts   # Basic controller
│   ├── app.service.ts      # Application service
│   ├── prisma.service.ts   # Prisma service integration
│   └── aws-secrets.service.ts # AWS Secrets Manager service
├── scripts/
│   ├── deploy-ec2.sh       # EC2 instance deployment
│   ├── create-aws-secret.sh # AWS Secrets Manager setup
│   ├── setup-iam-role.sh   # IAM role configuration
│   └── app-deploy.sh       # Application deployment on EC2
├── docs/
│   ├── aws-deployment-guide.md # AWS deployment documentation
│   └── aws-iam-policy.md   # IAM policy documentation
├── .env                    # Environment variables
├── .gitignore             # Git ignore rules
├── tsconfig.json          # TypeScript configuration
└── package.json           # Dependencies and scripts
```

## 🚨 Migration Best Practices

### Development Workflow
1. **Make schema changes** in `prisma/schema.prisma`
2. **Create migration**: `npx prisma migrate dev --name descriptive_name`
3. **Review generated SQL** in `prisma/migrations/`
4. **Test migration** thoroughly in development
5. **Commit migration files** to version control

### Production Deployment
1. **Deploy code** with new migration files
2. **Run migrations**: `npx prisma migrate deploy`
3. **Verify deployment** with `npx prisma migrate status`

### Rollback Strategy
- Prisma doesn't support automatic rollbacks
- Create new migration to revert changes
- Keep database backups for emergency recovery

### Migration Naming
Use descriptive names that clearly indicate the change:
```bash
# Good examples
npx prisma migrate dev --name add_user_profile_fields
npx prisma migrate dev --name create_audit_log_table
npx prisma migrate dev --name update_flow_schema_structure

# Avoid generic names
npx prisma migrate dev --name update
npx prisma migrate dev --name fix
```

## 🔍 Troubleshooting

### Migration Drift
If you see "drift detected" errors:
```bash
# Reset and recreate migrations (development only)
npx prisma migrate reset
npx prisma migrate dev --name init
```

### Connection Issues
- Verify Neon database credentials
- Check network connectivity
- Ensure SSL mode is correctly configured
- Verify connection pooling settings

### Schema Validation Errors
- Check Prisma schema syntax
- Verify environment variables are set
- Ensure model relationships are properly defined

## 📚 Additional Resources

- [Prisma Migrations Guide](https://www.prisma.io/docs/concepts/components/prisma-migrate)
- [NestJS Documentation](https://docs.nestjs.com/)
- [Neon PostgreSQL Docs](https://neon.tech/docs)
- [Fastify Documentation](https://www.fastify.io/)

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Make changes and create migrations if needed
4. Test thoroughly in development
5. Commit changes (`git commit -m 'Add amazing feature'`)
6. Push to branch (`git push origin feature/amazing-feature`)
7. Create Pull Request

---

**Built with ❤️ using NestJS, Fastify, Prisma, and Neon PostgreSQL**