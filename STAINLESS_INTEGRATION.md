# 🚀 Stainless SDK Integration Guide

This document explains how Tolstoy's API documentation is enhanced with Stainless SDK code generation for production-ready code samples.

## 🎯 Overview

Stainless automatically generates SDK code samples for every API endpoint in our documentation, providing developers with copy-paste ready code in multiple programming languages.

## 📁 Configuration Files

### `stainless.yml`
Main configuration file that defines:
- Project name: `tolstoy`
- Code sample format: `mintlify` compatible
- Supported languages: TypeScript, Python, Go, cURL
- Multi-tenant authentication headers

### `docs.json` Integration
- Points to Stainless-hosted OpenAPI spec: `https://stainless.app/projects/tolstoy/releases/latest/openapi.json`
- Includes fallback to local spec: `docs/openapi.json`
- Configures code samples display in Mintlify

## 🔄 Automation Pipeline

### GitHub Actions Workflow
`.github/workflows/update-docs.yml` automatically:

1. **Triggers on changes to**:
   - `docs/openapi.json` (OpenAPI specification)
   - `src/**/*.controller.ts` (NestJS controllers)
   - `stainless.yml` (Stainless configuration)

2. **Publishes to Stainless**:
   - Validates OpenAPI spec format
   - Uploads to Stainless SDK Studio
   - Generates decorated spec with `x-code-samples`

3. **Deployment verification**:
   - Confirms Stainless URL is accessible
   - Validates generated code samples
   - Creates deployment summary

## 🎨 Generated Code Samples

### TypeScript Example
```typescript
import { TolstoyClient } from '@tolstoy/sdk';

const client = new TolstoyClient({
  baseUrl: 'https://tolstoy.getpullse.com',
  headers: {
    'x-org-id': 'your-org-id',
    'x-user-id': 'your-user-id'
  }
});

const execution = await client.flows.execute('flow_123', {
  variables: { userId: 'user_456' },
  useDurable: true
});
```

### Python Example
```python
from tolstoy import TolstoyClient

client = TolstoyClient(
    base_url="https://tolstoy.getpullse.com",
    headers={
        "x-org-id": "your-org-id",
        "x-user-id": "your-user-id"
    }
)

execution = client.flows.execute(
    flow_id="flow_123",
    variables={"userId": "user_456"},
    use_durable=True
)
```

### Go Example
```go
client := tolstoy.NewClient(&tolstoy.Config{
    BaseURL: "https://tolstoy.getpullse.com",
    Headers: map[string]string{
        "x-org-id":  "your-org-id",
        "x-user-id": "your-user-id",
    },
})

execution, err := client.Flows.Execute(ctx, &tolstoy.ExecuteFlowRequest{
    FlowID: "flow_123",
    Variables: map[string]interface{}{
        "userId": "user_456",
    },
    UseDurable: true,
})
```

## 🔗 URLs and Resources

### Stainless URLs
- **Project**: https://stainless.app/projects/tolstoy
- **Latest Spec**: https://stainless.app/projects/tolstoy/releases/latest/openapi.json
- **Studio Dashboard**: Access via Stainless SDK Studio

### GitHub Repository
- **Source Spec**: https://raw.githubusercontent.com/joosuhail12/tolstoy/main/docs/openapi.json
- **Documentation**: View at your Mintlify docs site
- **Workflow Runs**: Check `.github/workflows/update-docs.yml`

## 🛠️ Manual Operations

### Trigger Documentation Update
```bash
# Via GitHub UI: Go to Actions → "Update API Documentation with Stainless" → Run workflow

# Or commit with special message:
git commit -m "Update API docs [sync-spec]"
```

### Validate Integration
```bash
# Check if Stainless spec is available
curl -f https://stainless.app/projects/tolstoy/releases/latest/openapi.json | jq .

# Verify code samples are included
curl -s https://stainless.app/projects/tolstoy/releases/latest/openapi.json | \
  jq '.paths[].get."x-code-samples" // .paths[].post."x-code-samples"' | head -5
```

## 🔍 Troubleshooting

### Common Issues

1. **Stainless URL not accessible**
   - Check GitHub Actions logs
   - Verify `STAINLESS_TOKEN` secret is set
   - Ensure OpenAPI spec is valid JSON

2. **Code samples not appearing**
   - Verify Mintlify `docs.json` points to Stainless URL
   - Check `showCodeSamples: true` is set
   - Clear browser cache and reload docs

3. **Invalid OpenAPI spec**
   - Run local validation: `npx swagger-codegen-cli validate docs/openapi.json`
   - Check controller Swagger decorators are complete
   - Regenerate spec: `npm run build:docs`

### Debug Commands
```bash
# Validate local OpenAPI spec
jq empty docs/openapi.json && echo "✅ Valid JSON" || echo "❌ Invalid JSON"

# Check spec size and endpoints
echo "Lines: $(wc -l < docs/openapi.json)"
echo "Endpoints: $(jq -r '.paths | keys | length' docs/openapi.json)"

# Test Stainless URL
curl -I https://stainless.app/projects/tolstoy/releases/latest/openapi.json
```

## 📈 Benefits

### For Developers
- **Copy-paste ready code** in preferred language
- **Production-ready patterns** with error handling
- **Type-safe SDKs** for TypeScript/Python/Go
- **Multi-tenant authentication** pre-configured

### For API Maintainers
- **Automated code generation** on spec changes
- **Always up-to-date samples** in documentation
- **Reduced support overhead** with working examples
- **Enterprise-grade developer experience**

## 🔄 Maintenance

The integration is designed to be zero-maintenance:

1. **Automatic Updates**: GitHub Actions handles publishing
2. **Spec Validation**: Built-in JSON and OpenAPI validation
3. **Fallback Support**: Local spec as backup
4. **Error Handling**: Graceful degradation if Stainless unavailable

For any issues, check the GitHub Actions workflow logs or contact the development team.

---

*This integration enhances our comprehensive OpenAPI documentation (52 endpoints, 4000+ lines) with production-ready SDK code samples, making Tolstoy the most developer-friendly workflow automation platform.*