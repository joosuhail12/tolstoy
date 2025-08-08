# @joosuhail/tolstoy-sdk

The official TypeScript SDK for the Tolstoy workflow automation platform.

## Installation

```bash
npm install @joosuhail/tolstoy-sdk
```

## Quick Start

```typescript
import { TolstoyClient } from '@joosuhail/tolstoy-sdk';

const client = new TolstoyClient(
  'https://tolstoy.getpullse.com',
  'your-org-id',
  'your-user-id',
  'optional-bearer-token'
);

// Execute a workflow
const execution = await client.runFlow('flow_123', {
  userId: 'user_456',
  email: 'user@example.com'
});

console.log(`Execution started: ${execution.data.executionId}`);
```

## Features

- 🔒 **Multi-tenant Authentication** - Built-in support for org-id and user-id headers
- 📝 **Full TypeScript Support** - Complete type safety with IntelliSense
- 🎯 **Helper Methods** - Simplified API for common operations
- 🔧 **Raw API Access** - Direct access to all generated API endpoints
- ✅ **Production Ready** - Comprehensive error handling and testing

## Documentation

Visit our comprehensive documentation at: [https://docs.tolstoy.dev/sdk](https://docs.tolstoy.dev/sdk)

## API Coverage

This SDK provides access to all Tolstoy API endpoints:
- ✅ **52 API endpoints** fully covered
- ✅ **Workflows** - Execute, monitor, and manage
- ✅ **Tools** - Create and manage integrations  
- ✅ **Webhooks** - Event-driven automation
- ✅ **Organizations & Users** - Multi-tenant support

## Support

- 📖 [Documentation](https://docs.tolstoy.dev)
- 🐛 [Issues](https://github.com/tolstoy-dev/sdk-typescript/issues)
- 💬 [Community](https://tolstoy.dev/community)

## License

MIT License - see [LICENSE](LICENSE) file for details.

---

Generated from OpenAPI specification with full type safety and modern JavaScript patterns.