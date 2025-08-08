# Contributing to Tolstoy

Thank you for your interest in contributing to Tolstoy! This guide will help you get started with contributing to our workflow automation platform.

## 📋 Table of Contents

- [Getting Started](#getting-started)
- [Development Environment](#development-environment)
- [Repository Structure](#repository-structure)
- [Branching Strategy](#branching-strategy)
- [Commit Guidelines](#commit-guidelines)
- [Pull Request Process](#pull-request-process)
- [Code Quality](#code-quality)
- [Testing](#testing)
- [Documentation](#documentation)
- [Infrastructure Changes](#infrastructure-changes)
- [Release Process](#release-process)

## 🚀 Getting Started

### Prerequisites

- **Node.js** 18+ and **npm** or **yarn**
- **Docker** and **Docker Compose** for local development
- **Git** for version control
- **AWS CLI** configured (for infrastructure changes)
- **Terraform** 1.5+ (for infrastructure changes)

### Quick Setup

1. **Fork and clone the repository**
   ```bash
   git clone git@github.com:your-username/tolstoy.git
   cd tolstoy
   ```

2. **Install dependencies**
   ```bash
   npm install
   # or
   yarn install
   ```

3. **Set up environment**
   ```bash
   cp .env.example .env
   # Edit .env with your local configuration
   ```

4. **Start local development**
   ```bash
   npm run start:dev
   # or
   yarn dev
   ```

5. **Verify setup**
   ```bash
   curl http://localhost:3000/health
   # Should return: {"status":"ok"}
   ```

## 🛠 Development Environment

### Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/tolstoy"

# AWS (for Secrets Manager integration)
AWS_REGION="us-east-1"
AWS_ACCESS_KEY_ID="your-access-key"
AWS_SECRET_ACCESS_KEY="your-secret-key"

# Application
APP_VERSION="1.0.0"
GIT_COMMIT="local-dev"
NODE_ENV="development"

# Redis (for caching)
REDIS_URL="redis://localhost:6379"

# Metrics (optional)
PROMETHEUS_PORT="9090"
```

### Docker Development

For a complete local environment with all services:

```bash
docker-compose up -d
npm run start:dev
```

This starts:
- PostgreSQL database
- Redis cache
- Prometheus metrics
- Local application server

### Database Setup

```bash
# Generate Prisma client
npm run db:generate

# Run migrations
npm run db:migrate:dev

# (Optional) Open Prisma Studio
npm run db:studio
```

## 📁 Repository Structure

```
├── src/                    # Main application source
│   ├── actions/           # Action definitions and handlers
│   ├── auth/             # Authentication and authorization
│   ├── common/           # Shared utilities and services
│   ├── execution/        # Workflow execution engine
│   ├── flows/            # Flow management and orchestration
│   ├── metrics/          # Prometheus metrics and monitoring
│   ├── organizations/    # Multi-tenancy and organization management
│   ├── prisma/          # Database client and utilities
│   ├── sandbox/         # Code execution sandbox
│   ├── secrets/         # Secrets management (AWS Secrets Manager)
│   ├── tools/           # External tool integrations
│   ├── users/           # User management
│   └── webhooks/        # Webhook handling and dispatch
├── prisma/              # Database schema and migrations
├── terraform/           # Infrastructure as Code
├── docs/               # MDX documentation
├── sdk/                # TypeScript SDK
├── cli/                # Command-line interface
├── scripts/            # Deployment and utility scripts
└── test/               # Test utilities and fixtures
```

### Key Directories Explained

- **`src/`**: Core application logic with modular NestJS architecture
- **`prisma/`**: Database schema definitions and migration files
- **`terraform/`**: Complete infrastructure definitions for AWS deployment
- **`docs/`**: Mintlify-powered documentation site with MDX content
- **`sdk/`**: Generated TypeScript SDK for external integrations
- **`cli/`**: Command-line tool for template management and automation

## 🌿 Branching Strategy

We use **Git Flow** with the following branch types:

### Branch Types

- **`main`**: Production-ready code, protected branch
- **`develop`**: Integration branch for features (if using Git Flow)
- **`feature/xxx`**: New features and enhancements
- **`fix/xxx`**: Bug fixes
- **`docs/xxx`**: Documentation updates
- **`chore/xxx`**: Maintenance tasks, dependency updates
- **`refactor/xxx`**: Code refactoring without functional changes

### Branch Naming Convention

```bash
feature/user-authentication
fix/webhook-signature-validation
docs/api-reference-update
chore/dependency-update-nestjs
refactor/extract-metrics-service
```

### Workflow

1. **Create feature branch from `main`**
   ```bash
   git checkout main
   git pull origin main
   git checkout -b feature/awesome-new-feature
   ```

2. **Make your changes**
   ```bash
   # Make changes, commit regularly
   git add .
   git commit -m "feat: add awesome new feature"
   ```

3. **Push and create PR**
   ```bash
   git push origin feature/awesome-new-feature
   # Create PR on GitHub
   ```

4. **Address review feedback**
   ```bash
   # Make changes based on feedback
   git commit -m "fix: address review feedback"
   git push origin feature/awesome-new-feature
   ```

## 📝 Commit Guidelines

We follow [Conventional Commits](https://www.conventionalcommits.org/) for consistent commit messages:

### Commit Types

- **`feat:`** New features
- **`fix:`** Bug fixes
- **`docs:`** Documentation changes
- **`style:`** Code style changes (formatting, missing semicolons)
- **`refactor:`** Code refactoring
- **`test:`** Adding or updating tests
- **`chore:`** Build process, dependency updates
- **`perf:`** Performance improvements
- **`ci:`** CI/CD pipeline changes

### Examples

```bash
feat: add webhook signature verification
fix: resolve database connection timeout issues
docs: update API reference for flow execution
style: format code with prettier
refactor: extract common utilities into shared module
test: add integration tests for webhook processing
chore: update dependencies to latest versions
perf: optimize database queries with connection pooling
ci: add automated security scanning to pipeline
```

### Breaking Changes

For breaking changes, add `BREAKING CHANGE:` in the commit body:

```bash
feat: redesign API response format

BREAKING CHANGE: API responses now include metadata wrapper
```

## 🔄 Pull Request Process

### Before Creating a PR

1. **Ensure code quality**
   ```bash
   npm run lint        # Check linting
   npm run format      # Format code
   npm run test        # Run all tests
   npm run build       # Verify build
   ```

2. **Update documentation**
   ```bash
   npm run build:docs  # Regenerate API docs
   ```

3. **Test locally**
   ```bash
   npm run start:dev   # Test application
   curl http://localhost:3000/health  # Verify health
   ```

### PR Template

When creating a PR, please include:

```markdown
## Description
Brief description of changes and motivation.

## Type of Change
- [ ] Bug fix (non-breaking change fixing an issue)
- [ ] New feature (non-breaking change adding functionality)
- [ ] Breaking change (fix or feature causing existing functionality to change)
- [ ] Documentation update
- [ ] Performance improvement
- [ ] Code refactoring

## How Has This Been Tested?
- [ ] Unit tests
- [ ] Integration tests
- [ ] Manual testing
- [ ] End-to-end tests

## Checklist
- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Code is commented where necessary
- [ ] Documentation updated
- [ ] Tests added/updated
- [ ] CI/CD pipeline passes
```

### Review Process

1. **Automated Checks**: CI/CD pipeline runs tests, linting, and security scans
2. **Code Review**: At least one maintainer reviews the PR
3. **Testing**: Reviewer tests changes if necessary
4. **Approval**: PR gets approved and merged to main
5. **Deployment**: Changes are automatically deployed via CI/CD

### Review Guidelines

**For Authors:**
- Keep PRs focused and reasonably sized
- Provide clear description and context
- Respond promptly to feedback
- Keep PR up-to-date with main branch

**For Reviewers:**
- Provide constructive feedback
- Test changes when appropriate
- Check for security implications
- Verify documentation updates

## ✅ Code Quality

### Linting and Formatting

We use **ESLint** and **Prettier** for consistent code style:

```bash
# Check linting issues
npm run lint

# Auto-fix linting issues
npm run lint:fix

# Format code with Prettier
npm run format

# Check formatting
npm run format:check
```

### Code Style Guidelines

- **TypeScript**: Use strict type definitions, avoid `any`
- **Naming**: Use camelCase for variables/functions, PascalCase for classes
- **Functions**: Prefer async/await over Promises
- **Comments**: Document complex logic and public APIs
- **Imports**: Use absolute imports from `src/`

### Pre-commit Hooks

We use **Husky** for pre-commit hooks:

```bash
# Automatically runs before commits:
# - Lint staged files
# - Run affected tests
# - Check commit message format
```

## 🧪 Testing

### Test Structure

```bash
src/
├── module/
│   ├── module.service.ts
│   ├── module.service.spec.ts          # Unit tests
│   ├── module.integration.spec.ts      # Integration tests
│   └── module.e2e.spec.ts             # End-to-end tests
```

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test -- module.service.spec.ts

# Run tests matching pattern
npm test -- --testNamePattern="should create user"
```

### Writing Tests

**Unit Tests**: Test individual functions/methods in isolation
```typescript
describe('FlowService', () => {
  it('should create a new flow', async () => {
    const flowData = { name: 'Test Flow', steps: [] };
    const result = await flowService.create(flowData);
    expect(result.name).toBe('Test Flow');
  });
});
```

**Integration Tests**: Test module interactions
```typescript
describe('FlowController (Integration)', () => {
  it('should create flow via API', async () => {
    const response = await request(app.getHttpServer())
      .post('/flows')
      .send({ name: 'Test Flow', steps: [] })
      .expect(201);
    
    expect(response.body.name).toBe('Test Flow');
  });
});
```

## 📚 Documentation

### API Documentation

API documentation is automatically generated from OpenAPI specifications:

```bash
# Regenerate OpenAPI spec
npm run build

# The generated spec is at docs/openapi.json
# Mintlify automatically updates the API reference
```

### Writing Documentation

1. **MDX Files**: Use MDX format in `docs/` directory
2. **Code Examples**: Include working code examples
3. **Screenshots**: Add screenshots for UI-related documentation
4. **Links**: Use relative links for internal documentation

### Documentation Structure

```bash
docs/
├── quickstart.mdx         # Getting started guide
├── api-reference/         # Auto-generated API docs
├── sdk/                   # SDK documentation
├── guides/               # How-to guides
├── integrations/         # Third-party integrations
└── deployment/           # Deployment guides
```

## 🏗 Infrastructure Changes

### Terraform Workflow

For infrastructure changes in `terraform/`:

1. **Plan Changes**
   ```bash
   cd terraform
   terraform plan
   ```

2. **Test Locally**
   ```bash
   terraform validate
   terraform fmt -check
   ```

3. **Apply Changes** (only in CI/CD or by maintainers)
   ```bash
   terraform apply
   ```

### Infrastructure Guidelines

- **Modules**: Use Terraform modules for reusable components
- **Variables**: Define variables in `variables.tf` with descriptions
- **Outputs**: Export important resources in `outputs.tf`
- **State**: Use remote state storage (HCP Terraform Cloud)
- **Security**: Follow AWS security best practices

## 🚀 Release Process

### Version Numbering

We follow [Semantic Versioning](https://semver.org/):

- **MAJOR** (1.0.0): Breaking changes
- **MINOR** (1.1.0): New features (backward compatible)
- **PATCH** (1.0.1): Bug fixes (backward compatible)

### Release Steps

1. **Update CHANGELOG.md**
   ```bash
   # Add new version section with changes
   ```

2. **Version Bump**
   ```bash
   npm version major|minor|patch
   ```

3. **Create Release Tag**
   ```bash
   git tag -a v1.0.0 -m "Release v1.0.0"
   git push origin main --tags
   ```

4. **Create GitHub Release**
   - Go to GitHub Releases
   - Create new release from tag
   - Include changelog content
   - Attach any release assets

## 🤝 Community Guidelines

### Code of Conduct

- Be respectful and inclusive
- Welcome newcomers and help them get started
- Focus on constructive feedback
- Celebrate contributions from all community members

### Getting Help

- **Documentation**: Check [docs.tolstoy.dev](https://docs.tolstoy.dev)
- **GitHub Issues**: Search existing issues before creating new ones
- **GitHub Discussions**: Ask questions and share ideas
- **Discord**: Join our community Discord server
- **Email**: Reach out to [developers@tolstoy.dev](mailto:developers@tolstoy.dev)

### Reporting Issues

When reporting bugs:

1. **Search existing issues** first
2. **Use the issue template**
3. **Provide reproduction steps**
4. **Include environment details**
5. **Add relevant logs/screenshots**

### Security Issues

For security vulnerabilities:

- **Do NOT** create public issues
- Email [security@tolstoy.dev](mailto:security@tolstoy.dev)
- Include detailed reproduction steps
- Allow time for investigation before public disclosure

## 📊 Performance Considerations

### Database Performance

- Use indexes appropriately
- Avoid N+1 queries
- Use connection pooling
- Monitor query performance

### API Performance

- Implement caching where appropriate
- Use pagination for large datasets
- Optimize JSON serialization
- Monitor response times

### Memory Usage

- Clean up resources properly
- Use streaming for large data processing
- Monitor memory leaks
- Optimize Docker image sizes

## 🔧 Troubleshooting

### Common Issues

**Port Already in Use**
```bash
# Kill process using port 3000
npx kill-port 3000
```

**Database Connection Issues**
```bash
# Check database status
docker-compose ps
# Restart database
docker-compose restart postgres
```

**Build Failures**
```bash
# Clear node_modules and rebuild
rm -rf node_modules package-lock.json
npm install
```

**Test Failures**
```bash
# Clear Jest cache
npx jest --clearCache
```

## 🎯 Next Steps

After setting up your development environment:

1. **Explore the codebase**: Start with `src/main.ts` and `src/app.module.ts`
2. **Run the test suite**: Get familiar with the testing patterns
3. **Check open issues**: Find a good first issue to work on
4. **Read the docs**: Understand the architecture and APIs
5. **Join the community**: Introduce yourself in GitHub Discussions

Thank you for contributing to Tolstoy! 🚀