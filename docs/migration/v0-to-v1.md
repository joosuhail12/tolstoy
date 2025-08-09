# Migration Guide: v0 to v1

## Overview

This guide helps you migrate from Tolstoy v0.x to v1.x. Version 1.x introduces breaking changes that improve performance, security, and developer experience.

## Breaking Changes

### API Endpoints

**v0.x:**
```
POST /api/v0/workflows/{id}/execute
GET /api/v0/workflows
```

**v1.x:**
```  
POST /api/v1/flows/{id}/execute
GET /api/v1/flows
```

### Authentication

**v0.x:**
```bash
curl -H "X-API-Key: your-key" \
     https://api.tolstoy.dev/api/v0/workflows
```

**v1.x:**
```bash
curl -H "Authorization: Bearer your-key" \
     https://api.tolstoy.dev/api/v1/flows
```

### SDK Changes

**v0.x:**
```javascript
const client = new TolstoyClient('your-key');
const result = await client.executeWorkflow(id, inputs);
```

**v1.x:**
```javascript
const client = new Client({ apiKey: 'your-key' });
const execution = await client.flows.execute(id, { inputs });
const result = await client.executions.waitForCompletion(execution.id);
```

## Migration Steps

1. Update API endpoints from `/workflows` to `/flows`
2. Change authentication from `X-API-Key` to `Authorization: Bearer`
3. Update SDK to v1.x
4. Modify workflow definitions to new format
5. Test thoroughly in staging environment
6. Deploy to production

## New Features in v1.x

- Improved error handling
- Better performance and reliability
- Enhanced security features
- More comprehensive SDK
- Better monitoring and observability

## Support

For migration assistance, contact support@tolstoy.dev or see the [troubleshooting guide](/troubleshooting).