#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// CLI Documentation Generator
// This script generates comprehensive documentation for the Tolstoy CLI
// to complement the Stainless SDK examples in Mintlify

const OUTPUT_DIR = path.join(__dirname, '..', '..', 'docs', 'cli');
const CLI_PATH = path.join(__dirname, '..', 'dist', 'cli.js');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

console.log('📚 Generating Tolstoy CLI Documentation...');

// Generate help output for all commands
function generateHelpDocs() {
  const commands = [
    { name: 'main', cmd: 'node dist/cli.js --help' },
    { name: 'config', cmd: 'node dist/cli.js config --help' },
    { name: 'flows', cmd: 'node dist/cli.js flows --help' },
    { name: 'tools', cmd: 'node dist/cli.js tools --help' },
    { name: 'users', cmd: 'node dist/cli.js users --help' },
    { name: 'webhooks', cmd: 'node dist/cli.js webhooks --help' },
    { name: 'logs', cmd: 'node dist/cli.js logs --help' },
    { name: 'templates', cmd: 'node dist/cli.js templates --help' },
    { name: 'init', cmd: 'node dist/cli.js init --help' },
    { name: 'status', cmd: 'node dist/cli.js status --help' },
  ];

  commands.forEach(({ name, cmd }) => {
    try {
      console.log(`🔍 Generating help for: ${name}`);
      const helpOutput = execSync(cmd, { 
        cwd: path.join(__dirname, '..'),
        encoding: 'utf8',
        timeout: 10000 
      });
      
      const docContent = generateCommandDoc(name, helpOutput);
      fs.writeFileSync(
        path.join(OUTPUT_DIR, `${name}-reference.md`),
        docContent
      );
      console.log(`✅ Generated: ${name}-reference.md`);
    } catch (error) {
      console.warn(`⚠️  Could not generate help for ${name}: ${error.message}`);
    }
  });
}

function generateCommandDoc(commandName, helpOutput) {
  const isMainCommand = commandName === 'main';
  const title = isMainCommand ? 'Tolstoy CLI' : `tolstoy ${commandName}`;
  
  return `---
title: "${title}"
description: "Command reference for ${title}"
---

# ${title}

\`\`\`bash
${helpOutput.trim()}
\`\`\`

## Examples

${generateExamples(commandName)}

## Related Commands

${generateRelatedCommands(commandName)}

---

*This documentation is automatically generated from the CLI help output.*
`;
}

function generateExamples(commandName) {
  const examples = {
    main: [
      '# Get CLI version',
      'tolstoy --version',
      '',
      '# Show all available commands',
      'tolstoy --help',
      '',
      '# Configure API credentials',
      'tolstoy config add'
    ],
    config: [
      '# Add a new configuration profile',
      'tolstoy config add production --api-url https://api.tolstoy.dev',
      '',
      '# List all profiles',
      'tolstoy config list',
      '',
      '# Switch to a different profile',
      'tolstoy config use production',
      '',
      '# Test connection',
      'tolstoy config test'
    ],
    flows: [
      '# List all flows',
      'tolstoy flows list',
      '',
      '# Get detailed flow information',
      'tolstoy flows get flow_123',
      '',
      '# Execute a flow',
      'tolstoy flows execute flow_123 \'{"input": "value"}\'',
      '',
      '# View flow execution logs',
      'tolstoy flows logs flow_123'
    ],
    tools: [
      '# List all tools',
      'tolstoy tools list',
      '',
      '# Create a new tool',
      'tolstoy tools create "My API Tool" --type api',
      '',
      '# Test tool connectivity',
      'tolstoy tools test tool_123'
    ],
    users: [
      '# List users',
      'tolstoy users list',
      '',
      '# Create a new user',
      'tolstoy users create --email user@example.com --name "John Doe"',
      '',
      '# Get current user info',
      'tolstoy users me'
    ],
    webhooks: [
      '# List webhooks',
      'tolstoy webhooks list',
      '',
      '# Create a webhook',
      'tolstoy webhooks create "My Webhook" https://example.com/webhook',
      '',
      '# Test webhook delivery',
      'tolstoy webhooks test webhook_123'
    ],
    logs: [
      '# View recent execution logs',
      'tolstoy logs list',
      '',
      '# Filter logs by status',
      'tolstoy logs list --status failed',
      '',
      '# Get detailed log information',
      'tolstoy logs get log_123'
    ],
    templates: [
      '# List available templates',
      'tolstoy templates list',
      '',
      '# Show template details',
      'tolstoy templates show "Hello World"',
      '',
      '# Import a template',
      'tolstoy templates import "Hello World" --org org_123'
    ],
    init: [
      '# Initialize a new project',
      'tolstoy init my-project',
      '',
      '# Initialize with specific template',
      'tolstoy init my-project --template api',
      '',
      '# Initialize in current directory',
      'tolstoy init'
    ],
    status: [
      '# Check system status',
      'tolstoy status',
      '',
      '# Get detailed system information',
      'tolstoy status --detailed'
    ]
  };

  const commandExamples = examples[commandName] || ['# No examples available'];
  return commandExamples.join('\n');
}

function generateRelatedCommands(commandName) {
  const related = {
    main: ['config', 'init', 'status'],
    config: ['main', 'init'],
    flows: ['logs', 'templates', 'tools'],
    tools: ['flows', 'users'],
    users: ['tools', 'flows'],
    webhooks: ['flows', 'logs'],
    logs: ['flows', 'status'],
    templates: ['flows', 'init'],
    init: ['config', 'templates'],
    status: ['logs', 'config']
  };

  const relatedCommands = related[commandName] || [];
  return relatedCommands.map(cmd => {
    const isMain = cmd === 'main';
    const linkText = isMain ? 'Tolstoy CLI Overview' : `tolstoy ${cmd}`;
    const linkPath = isMain ? 'main-reference' : `${cmd}-reference`;
    return `- [${linkText}](${linkPath})`;
  }).join('\n') || 'None';
}

// Generate comprehensive CLI overview
function generateOverview() {
  const overview = `---
title: "Tolstoy CLI Overview"
description: "Complete guide to the Tolstoy command-line interface"
---

# Tolstoy CLI

The official command-line interface for the Tolstoy workflow automation platform.

## Installation

### npm
\`\`\`bash
npm install -g @tolstoy/cli
\`\`\`

### Homebrew (macOS/Linux)
\`\`\`bash
brew tap tolstoy-dev/tap
brew install tolstoy
\`\`\`

### Direct Download
\`\`\`bash
curl -fsSL https://get.tolstoy.dev | bash
\`\`\`

## Quick Start

1. **Configure your API credentials:**
   \`\`\`bash
   tolstoy config add
   \`\`\`

2. **Initialize a new project:**
   \`\`\`bash
   tolstoy init my-workflow-project
   \`\`\`

3. **List available templates:**
   \`\`\`bash
   tolstoy templates list
   \`\`\`

4. **Import and run a workflow:**
   \`\`\`bash
   tolstoy templates import "Hello World" --org your-org-id
   tolstoy flows list
   tolstoy flows execute flow_id '{"message": "Hello from CLI!"}'
   \`\`\`

## Commands Overview

| Command | Description |
|---------|-------------|
| [\`tolstoy config\`](config-reference) | Manage API credentials and profiles |
| [\`tolstoy init\`](init-reference) | Initialize new Tolstoy projects |
| [\`tolstoy flows\`](flows-reference) | Manage and execute workflows |
| [\`tolstoy tools\`](tools-reference) | Manage external tool integrations |
| [\`tolstoy users\`](users-reference) | Manage user accounts |
| [\`tolstoy webhooks\`](webhooks-reference) | Manage webhook subscriptions |
| [\`tolstoy templates\`](templates-reference) | Browse and import workflow templates |
| [\`tolstoy logs\`](logs-reference) | View execution logs and monitoring |
| [\`tolstoy status\`](status-reference) | Check system health |

## Configuration

The CLI stores configuration in \`~/.tolstoy/config.json\` with support for multiple profiles:

\`\`\`json
{
  "profiles": {
    "default": {
      "name": "default",
      "apiUrl": "https://api.tolstoy.dev",
      "apiKey": "your-api-key",
      "orgId": "your-org-id"
    }
  },
  "currentProfile": "default"
}
\`\`\`

## Environment Variables

| Variable | Description |
|----------|-------------|
| \`TOLSTOY_API_KEY\` | Your API key |
| \`TOLSTOY_API_URL\` | API base URL |
| \`TOLSTOY_ORG_ID\` | Default organization ID |
| \`TOLSTOY_USER_ID\` | Default user ID |

## Global Options

All commands support these global options:

- \`--api-url <url>\` - Override API base URL
- \`--api-key <key>\` - Override API key  
- \`--json\` - Output results in JSON format
- \`--help\` - Show command help
- \`--version\` - Show CLI version

## SDK Integration

The CLI works alongside the Tolstoy SDK for programmatic access:

### TypeScript/Node.js
\`\`\`bash
npm install @joosuhail/tolstoy-sdk
\`\`\`

### Python
\`\`\`bash
pip install tolstoy-api
\`\`\`

See the [SDK Documentation](/sdk) for detailed usage examples.

---

*For more detailed information about each command, see the individual command reference pages.*
`;

  fs.writeFileSync(path.join(OUTPUT_DIR, 'overview.md'), overview);
  console.log('✅ Generated: overview.md');
}

// Generate integration examples with SDK
function generateSDKIntegration() {
  const integration = `---
title: "CLI and SDK Integration"
description: "Using the Tolstoy CLI together with the SDK for powerful automation"
---

# CLI and SDK Integration

Combine the power of the Tolstoy CLI with the SDK for maximum flexibility in your automation workflows.

## Common Patterns

### 1. Development Workflow

Use the CLI for setup and development, SDK for production:

\`\`\`bash
# Setup with CLI
tolstoy init my-project --template api
cd my-project
tolstoy config add development

# Test with CLI
tolstoy flows execute flow_123 '{"test": true}'

# Deploy with SDK
npm install @joosuhail/tolstoy-sdk
\`\`\`

\`\`\`typescript
// production.ts
import { TolstoyClient } from '@joosuhail/tolstoy-sdk';

const client = new TolstoyClient({
  apiUrl: process.env.TOLSTOY_API_URL,
  orgId: process.env.TOLSTOY_ORG_ID,
  token: process.env.TOLSTOY_API_KEY
});

// Execute the same flow programmatically
await client.runFlow('flow_123', { test: false });
\`\`\`

### 2. CI/CD Integration

\`\`\`yaml
# .github/workflows/deploy.yml
- name: Deploy Workflows
  run: |
    # Use CLI for deployment
    tolstoy config use production
    tolstoy templates import "My Template" --org \${{ secrets.ORG_ID }}
    
    # Verify with SDK
    npm run test:integration
\`\`\`

### 3. Monitoring and Debugging

\`\`\`bash
# CLI for quick debugging
tolstoy status --detailed
tolstoy logs list --status failed --limit 10
tolstoy flows logs flow_123

# SDK for automated monitoring
\`\`\`

\`\`\`typescript
// monitor.ts - Automated monitoring
import { TolstoyClient } from '@joosuhail/tolstoy-sdk';

const client = new TolstoyClient(config);

async function checkSystemHealth() {
  const status = await client.raw.health.check();
  const recentLogs = await client.raw.executionLogs.list({ 
    limit: 100,
    status: 'failed' 
  });
  
  if (recentLogs.length > 10) {
    // Alert via webhook or notification service
    console.error('High failure rate detected');
  }
}
\`\`\`

## Best Practices

1. **Use CLI for:**
   - Interactive development
   - One-off operations
   - Debugging and troubleshooting
   - Project initialization

2. **Use SDK for:**
   - Production applications  
   - Automated scripts
   - Integration with other services
   - Complex workflows

3. **Combine both for:**
   - Development workflows
   - CI/CD pipelines
   - Testing and validation
   - Monitoring and alerting

---

*See the [CLI Overview](overview) and [SDK Documentation](/sdk) for more details.*
`;

  fs.writeFileSync(path.join(OUTPUT_DIR, 'integration.md'), integration);
  console.log('✅ Generated: integration.md');
}

// Main execution
function main() {
  try {
    // Check if CLI is built
    if (!fs.existsSync(CLI_PATH)) {
      console.error('❌ CLI not found. Please run "npm run build" first.');
      process.exit(1);
    }

    generateOverview();
    generateHelpDocs();
    generateSDKIntegration();
    
    console.log('\n🎉 CLI documentation generation complete!');
    console.log(`📁 Documentation created in: ${OUTPUT_DIR}`);
    console.log('\n📋 Generated files:');
    
    const files = fs.readdirSync(OUTPUT_DIR);
    files.forEach(file => {
      console.log(`   • ${file}`);
    });
    
  } catch (error) {
    console.error('❌ Error generating documentation:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { generateHelpDocs, generateOverview, generateSDKIntegration };