# AWS Secrets Manager Integration Guide

Complete guide for using AWS Secrets Manager as the primary secrets management solution in the Tolstoy workflow automation platform.

## 🎯 Overview

This implementation replaces Vault with AWS Secrets Manager for all secret storage needs, including:
- Database connection strings
- OAuth tokens (GitHub, Google, Slack, etc.)
- API keys for third-party services
- Webhook secrets
- Client credentials

## 📁 Architecture

### Core Components

```typescript
src/
├── aws-secrets.service.ts           # Core AWS Secrets Manager service
├── secrets/
│   └── secrets-resolver.service.ts  # Tool-specific secret resolution
└── oauth/
    └── oauth-token.service.ts       # OAuth token management & refresh
```

### Service Hierarchy

```
AwsSecretsService (Low-level AWS SDK wrapper)
    ↓
SecretsResolver (Tool-specific secret management)
    ↓
OAuthTokenService (OAuth token lifecycle management)
```

## 🔧 Core Services

### 1. AwsSecretsService

Core service providing direct AWS Secrets Manager integration.

**Key Features:**
- 5-minute caching with stale fallback
- Exponential backoff retry logic
- JSON parsing for structured secrets
- Cache invalidation on updates

**Usage:**
```typescript
// Get entire secret
const secret = await awsSecretsService.getSecret('conductor-db-secret');

// Get specific key from JSON secret
const dbUrl = await awsSecretsService.getSecret('conductor-db-secret', 'DATABASE_URL');

// Update secret
await awsSecretsService.updateSecret('my-secret', { key: 'value' });

// Create new secret
await awsSecretsService.createSecret('new-secret', 'secret-value', 'Description');
```

### 2. SecretsResolver

High-level service for tool-specific credential management.

**Key Features:**
- Standardized tool credential format
- Organization-based secret isolation
- Automatic secret creation/updates
- Tool credential validation

**Usage:**
```typescript
// Get tool credentials
const creds = await secretsResolver.getToolCredentials('github', 'org123');

// Store OAuth tokens
await secretsResolver.setToolCredentials('slack', 'org456', {
  accessToken: 'xoxb-...',
  refreshToken: 'xoxr-...',
  expiresAt: Date.now() + 3600000
});

// Get API key only
const apiKey = await secretsResolver.getApiKey('openai', 'org789');
```

### 3. OAuthTokenService

Advanced OAuth token lifecycle management.

**Key Features:**
- Automatic token refresh before expiration
- Token validation and health checks
- Multi-provider OAuth support
- Secure token revocation

**Usage:**
```typescript
// Get valid access token (auto-refresh if needed)
const token = await oauthService.getValidAccessToken('github', 'org123');

// Store initial OAuth tokens
await oauthService.storeInitialTokens('slack', 'org456', {
  accessToken: 'xoxb-...',
  refreshToken: 'xoxr-...',
  expiresAt: Date.now() + 3600000
}, {
  clientId: 'your-client-id',
  clientSecret: 'your-client-secret',
  tokenEndpoint: 'https://slack.com/api/oauth.v2.access'
});

// Check token health
const isHealthy = await oauthService.validateTokenHealth('google', 'org789');
```

## 🗂️ Secret Organization

### Naming Convention

```
conductor-db-secret              # Database credentials (existing)
tolstoy/{tool}/{orgId}          # Tool-specific credentials
```

### Examples

```
tolstoy/github/org-abc123       # GitHub OAuth for organization abc123
tolstoy/slack/org-def456        # Slack credentials for organization def456  
tolstoy/openai/org-ghi789       # OpenAI API key for organization ghi789
```

### Secret Structure

**Database Secret (conductor-db-secret):**
```json
{
  "DATABASE_URL": "postgresql://user:pass@host:5432/db?connection_limit=5",
  "DIRECT_URL": "postgresql://user:pass@host:5432/db"
}
```

**Tool OAuth Secret:**
```json
{
  "accessToken": "ghp_xxxxxxxxxxxx",
  "refreshToken": "ghr_xxxxxxxxxxxx",
  "expiresAt": 1723123456789,
  "scope": "repo,user",
  "tokenType": "Bearer",
  "clientId": "Iv1.xxxxxxxxxx",
  "clientSecret": "xxxxxxxxxxxxxxxxxxxxx",
  "tokenEndpoint": "https://github.com/login/oauth/access_token",
  "lastUpdated": "2024-08-07T12:00:00.000Z"
}
```

**API Key Secret:**
```json
{
  "apiKey": "sk-xxxxxxxxxxxxxxxxxx",
  "createdAt": "2024-08-07T12:00:00.000Z"
}
```

## 🔄 Integration with Application

### Module Registration

```typescript
// app.module.ts
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true })
  ],
  providers: [
    AwsSecretsService,
    SecretsResolver,
    OAuthTokenService
  ],
  exports: [
    AwsSecretsService,
    SecretsResolver,
    OAuthTokenService
  ]
})
export class AppModule {}
```

### Usage in Controllers/Services

```typescript
@Injectable()
export class GitHubService {
  constructor(
    private readonly oauthService: OAuthTokenService,
    private readonly secretsResolver: SecretsResolver
  ) {}

  async getUserRepos(orgId: string): Promise<any[]> {
    // Automatically handles token refresh if needed
    const token = await this.oauthService.getValidAccessToken('github', orgId);
    
    const response = await fetch('https://api.github.com/user/repos', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    return response.json();
  }

  async setupWebhook(orgId: string, repoName: string): Promise<void> {
    const webhookSecret = await this.secretsResolver.getWebhookSecret('github', orgId);
    
    // Use webhook secret for signature verification
    // ...
  }
}
```

### Error Handling

```typescript
try {
  const token = await this.oauthService.getValidAccessToken('github', orgId);
} catch (error) {
  if (error.message.includes('No refresh token available')) {
    // Redirect user to re-authenticate
    throw new UnauthorizedException('GitHub authentication required');
  }
  throw new InternalServerErrorException('GitHub service unavailable');
}
```

## ⚙️ Environment Configuration

```env
# Required for AWS Secrets Manager
AWS_REGION=us-east-1
AWS_SECRET_NAME=conductor-db-secret
USE_AWS_SECRETS=true

# Optional: Override default caching
SECRETS_CACHE_DURATION_MS=300000
```

## 🔒 Security Features

### 1. Cache Security
- Secrets cached for 5 minutes maximum
- Automatic cache invalidation on updates
- Stale cache fallback during AWS outages

### 2. Access Control
- Organization-based secret isolation
- IAM permissions limit access to specific ARN patterns
- Regional restrictions (us-east-1 only)

### 3. Token Security
- Automatic token refresh before expiration (5-minute buffer)
- Secure token revocation on logout
- Token health validation

### 4. Audit & Monitoring
- Comprehensive logging of all secret operations
- AWS CloudTrail integration for audit logs
- Error tracking and alerting

## 🧪 Testing

### Unit Testing

```typescript
// Example test for SecretsResolver
describe('SecretsResolver', () => {
  let service: SecretsResolver;
  let awsSecretsService: jest.Mocked<AwsSecretsService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        SecretsResolver,
        {
          provide: AwsSecretsService,
          useValue: {
            getSecretAsJson: jest.fn(),
            updateSecret: jest.fn(),
            createSecret: jest.fn(),
            secretExists: jest.fn()
          }
        }
      ]
    }).compile();

    service = module.get<SecretsResolver>(SecretsResolver);
    awsSecretsService = module.get(AwsSecretsService);
  });

  it('should retrieve tool credentials', async () => {
    const mockCredentials = {
      accessToken: 'mock-token',
      refreshToken: 'mock-refresh'
    };

    awsSecretsService.getSecretAsJson.mockResolvedValue(mockCredentials);

    const result = await service.getToolCredentials('github', 'org123');
    
    expect(result).toEqual(mockCredentials);
    expect(awsSecretsService.getSecretAsJson).toHaveBeenCalledWith('tolstoy/github/org123');
  });
});
```

### Integration Testing

```bash
# Test AWS Secrets Manager connectivity
yarn test:integration src/**/*.integration.spec.ts

# Test OAuth token refresh
yarn test:e2e src/oauth/*.e2e.spec.ts
```

## 🚀 Deployment

The AWS Secrets Manager integration is automatically deployed with the CI/CD pipeline. The deployment:

1. ✅ Installs required AWS SDK dependencies
2. ✅ Configures environment variables
3. ✅ Tests secret connectivity during health checks
4. ✅ Validates database connection using secrets

## 📊 Monitoring & Troubleshooting

### Health Checks

The application includes health checks for secrets connectivity:

```bash
# Check application health (includes secrets check)
curl http://3.81.233.52/health

# Detailed status including secrets
curl http://3.81.233.52/status/detailed
```

### Common Issues

**1. AccessDeniedException**
- Check IAM permissions for the EC2 instance role
- Verify secret ARN patterns match the policy

**2. ResourceNotFoundException**
- Secret doesn't exist or was deleted
- Check secret naming convention

**3. Token Refresh Failures**
- Verify client credentials are valid
- Check OAuth provider endpoints are accessible

**4. Cache Issues**
- Clear cache: Call `awsSecretsService.clearCache()`
- Check memory usage if cache is growing too large

### Debugging

```typescript
// Enable debug logging
process.env.LOG_LEVEL = 'debug';

// Manual cache clear
await awsSecretsService.clearCache();

// Test specific secret
await awsSecretsService.validateSecretAccess('tolstoy/github/org123');
```

## 🔄 Migration from Vault (If Applicable)

Since no existing Vault implementation was found, no migration steps are required. The system is ready for immediate use with AWS Secrets Manager.

## 🎯 Next Steps

1. **Enhanced Security**: Implement secret rotation policies
2. **Multi-Region**: Support for secrets in multiple AWS regions  
3. **Analytics**: Secret usage analytics and cost optimization
4. **Backup**: Cross-region secret replication for disaster recovery