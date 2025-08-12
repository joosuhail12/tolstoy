---
title: "Tolstoy Documentation"
description: "Comprehensive documentation for the Tolstoy workflow automation platform"
---

# Tolstoy Documentation

Comprehensive documentation for the Tolstoy workflow automation platform, built with [Mintlify](https://mintlify.com).

## 📚 Documentation Structure

This documentation is organized into distinct sections for different audiences and access levels:

```
docs-mintlify/
├── public/product/     # User-facing product documentation
├── api/endpoints/      # Complete API reference  
├── cli/               # Command-line interface documentation
├── sdk/               # Software development kits (JS, Python, Go)
└── internal/          # Internal team documentation
```

## 🚀 Quick Start

### Prerequisites

- Node.js 16+ 
- npm 7+
- Git

### Local Development

1. **Clone and navigate to docs directory**
   ```bash
   git clone https://github.com/joosuhail12/tolstoy.git
   cd tolstoy/docs-mintlify
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start development server**
   ```bash
   npm run dev
   ```

4. **Open documentation**
   - Navigate to `http://localhost:3000`
   - Documentation auto-reloads on changes

## 📖 Documentation Sections

### Public Documentation
- **Product Guides**: Feature overviews, getting started, use cases
- **API Reference**: Complete REST API documentation with examples
- **CLI Reference**: Command-line tool usage and examples  
- **SDK Documentation**: JavaScript, Python, and Go SDK guides

### Internal Documentation
- **Architecture**: System design and technical architecture
- **Development**: Setup guides and coding standards
- **Operations**: Deployment, monitoring, and maintenance
- **Third-party**: Integration guides and vendor documentation

## 🛠 Available Scripts

```bash
# Development
npm run dev              # Start development server
npm run build            # Build for production

# Content Generation  
npm run generate:api     # Generate API docs from OpenAPI spec
npm run generate:all     # Generate all auto-generated content

# Quality Assurance
npm run validate         # Validate documentation structure
npm run check:links      # Check for broken internal links
npm run check:structure  # Validate directory structure
npm run precommit        # Run all validation checks

# Deployment
npm run deploy           # Deploy using automated script
```

## 🔧 Auto-Generation

Several documentation sections are auto-generated from source code and specifications:

### API Documentation
- Generated from OpenAPI specification
- Includes request/response schemas, examples, and error codes
- Updates automatically when API changes

```bash
npm run generate:api
```

### CLI Documentation
- Generated from CLI tool definitions
- Includes command syntax, options, and examples

### Navigation
- Auto-updated based on file structure
- Maintains consistent organization

## ✅ Quality Assurance

### Validation

The documentation includes comprehensive validation:

```bash
# Full validation suite
npm run validate

# Specific checks
npm run check:links      # Internal link validation
npm run check:structure  # Directory structure validation
```

### Validation Checks
- **Frontmatter**: Required fields (title, description)
- **Content**: MDX syntax, Mintlify components, comprehensive content
- **Links**: Internal link validation, broken link detection
- **Structure**: Required directories, navigation consistency
- **Standards**: Title/description length, duplicate detection

### Pre-commit Hooks

Validation runs automatically before commits:
- Structure validation
- Link checking
- Content linting
- Navigation verification

## 🚀 Deployment

### Automated Deployment

Documentation deploys automatically via GitHub Actions:

- **Production**: `main` branch → https://docs.tolstoy.getpullse.com
- **Staging**: `staging` branch → https://docs-staging.tolstoy.getpullse.com  
- **Preview**: Pull requests → https://docs-preview-{sha}.tolstoy.getpullse.com

### Manual Deployment

```bash
# Deploy to production (main branch)
npm run deploy

# Or use the deployment script directly
./scripts/deploy-docs.sh deploy
```

### Environment Configuration

Set these environment variables for deployment:

```bash
# Required
MINTLIFY_API_KEY=your-mintlify-api-key

# Optional (for notifications)
SLACK_WEBHOOK_URL=your-slack-webhook
DISCORD_WEBHOOK_URL=your-discord-webhook
GITHUB_TOKEN=your-github-token
```

## 📁 File Organization

### Naming Conventions
- Files: `kebab-case.mdx`
- Directories: `kebab-case`
- Images: `kebab-case.png/jpg/svg`

### Frontmatter Requirements
```yaml
---
title: "Page Title (required)"
description: "Page description (required)"
icon: "icon-name (optional)"
---
```

### Component Usage
The documentation uses Mintlify's MDX components:

```mdx
<ParamField name="parameter" type="string" required>
  Parameter description
</ParamField>

<ResponseField name="field" type="object">
  Response field description
</ResponseField>
```

<CodeGroup>
```bash cURL
curl -X GET https://api.tolstoy.com/v1/health
```

```javascript JavaScript
const response = await fetch('https://api.tolstoy.com/v1/health');
```
</CodeGroup>

<CardGroup cols={2}>
  <Card title="Getting Started" icon="rocket" href="/public/product/getting-started/installation">
    Get started with Tolstoy platform
  </Card>
</CardGroup>

## 🔐 Access Control

Documentation is organized for future access control implementation:

- **Public**: Open documentation (product, API, CLI, SDK)
- **Internal**: Team-only documentation (architecture, operations)
- **Admin**: Administrative documentation (deployment, security)

## 📊 Analytics & Monitoring

### Built-in Analytics
- Page views and user engagement
- Search analytics and popular content
- Geographic and referrer data

### Performance Monitoring
- Page load times
- Build performance
- Link health monitoring

## 🤝 Contributing

### Content Guidelines
1. **Accuracy**: Keep documentation in sync with actual implementation
2. **Clarity**: Write for your target audience (users vs developers vs internal team)
3. **Completeness**: Include examples, error cases, and edge cases
4. **Consistency**: Follow established patterns and conventions

### Writing Style
- Use active voice and present tense
- Include practical examples and code snippets
- Explain the "why" behind features and decisions
- Keep paragraphs and sentences concise

### Review Process
1. Create feature branch from `main`
2. Make documentation changes
3. Run validation: `npm run validate`
4. Submit pull request
5. Preview deployment automatically created
6. Review and merge to `main`
7. Automatic production deployment

### Adding New Sections
1. Create directory structure
2. Add navigation entries to `docs.json`
3. Include index page with overview
4. Follow established patterns for consistency
5. Update this README if needed

## 🆘 Troubleshooting

### Common Issues

**Build Failures**
```bash
# Clear cache and rebuild
rm -rf node_modules .mintlify
npm install
npm run build
```

**Broken Links**
```bash
# Check for broken links
npm run check:links

# Fix links and re-validate
npm run validate
```

**Validation Errors**
- Check frontmatter format (YAML syntax)
- Ensure required fields are present
- Verify MDX component syntax
- Review file naming conventions

### Getting Help

- Check validation report: `validation-report.json`
- Review build logs in GitHub Actions
- Check Mintlify documentation: https://mintlify.com/docs
- Contact the development team

## 📄 License

This documentation is part of the Tolstoy project and is subject to the same license terms.

---

For questions or support, please contact the Tolstoy development team or create an issue in the main repository.