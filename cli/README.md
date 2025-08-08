# @tolstoy/cli

Official command-line interface for the Tolstoy workflow automation platform.

## Features

- 📋 **Template Management**: Browse and import ready-made flow templates
- 🚀 **Quick Setup**: Get started with automation in minutes
- 🔧 **Organization Management**: List and manage your organizations
- ✅ **Connection Testing**: Verify API connectivity and authentication

## Installation

```bash
npm install -g @tolstoy/cli
```

## Quick Start

1. Set your API credentials:
```bash
export TOLSTOY_API_KEY="your-api-key"
export TOLSTOY_API_URL="https://api.tolstoy.dev"  # Optional
```

2. Test your connection:
```bash
tolstoy auth
```

3. List available templates:
```bash
tolstoy templates list
```

4. Import a template:
```bash
tolstoy templates import "Hello World" --org your-org-id
```

## Commands

### Templates

#### `tolstoy templates list`
List all available flow templates.

```bash
# List all templates
tolstoy templates list

# Filter by category
tolstoy templates list --category "Getting Started"

# Filter by tag
tolstoy templates list --tag "slack"

# Show detailed information
tolstoy templates list --verbose
```

#### `tolstoy templates show <name>`
Show detailed information about a template.

```bash
tolstoy templates show "Hello World"
```

#### `tolstoy templates import <name>`
Import a template into your organization.

```bash
# Basic import
tolstoy templates import "Hello World" --org org-123

# Import with custom name
tolstoy templates import "Hello World" --org org-123 --flow-name "My Flow"

# Preview what would be imported
tolstoy templates import "Hello World" --org org-123 --dry-run
```

### Organizations

#### `tolstoy orgs`
List your organizations.

```bash
tolstoy orgs
```

### Authentication

#### `tolstoy auth`
Test connection to the Tolstoy API.

```bash
tolstoy auth
```

## Available Templates

- **Hello World**: Simple introduction to Tolstoy workflows
- **Jira to Slack**: Notify Slack when Jira issues are created
- **GitHub Webhook Notifier**: Send notifications for GitHub push events
- **Data Pipeline ETL**: Extract, transform, and load data from APIs
- **Email to CRM Sync**: Parse emails and create CRM contacts

## Configuration

### Environment Variables

- `TOLSTOY_API_KEY` - Your Tolstoy API key (required)
- `TOLSTOY_API_URL` - Tolstoy API base URL (default: http://localhost:3000)
- `TOLSTOY_ORG_ID` - Default organization ID (optional)
- `TOLSTOY_USER_ID` - Default user ID (optional)

### Command Line Options

All commands support these global options:

- `--api-url <url>` - Override API base URL
- `--api-key <key>` - Override API key
- `--json` - Output results in JSON format

## Development

### Building from Source

```bash
git clone https://github.com/tolstoy-dev/cli
cd cli
npm install
npm run build
```

### Running Tests

```bash
npm test
```

### Running in Development

```bash
npm run dev templates list
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for your changes
5. Run the test suite
6. Submit a pull request

## License

MIT

## Support

- 📚 [Documentation](https://docs.tolstoy.dev)
- 🐛 [Issues](https://github.com/tolstoy-dev/cli/issues)
- 💬 [Community](https://discord.gg/tolstoy)