# GitHub Actions CI/CD Pipeline

This repository uses a streamlined CI/CD pipeline with automatic deployment to production.

## Workflows

### 1. `main.yml` - Primary CI/CD Pipeline
**Triggers:** Push to `main` branch, Pull Requests
**Features:**
- ✅ Code quality checks (linting, formatting, type checking)
- ✅ Security audit
- ✅ Automated testing with PostgreSQL and Redis
- ✅ Build verification
- 🚀 **Automatic deployment to production** (main branch only)

**Flow:**
1. **Pull Request:** Runs tests and quality checks only
2. **Main Branch Push:** Runs full pipeline + automatic deployment to EC2

### 2. `deploy-manual.yml` - Manual Deployment
**Triggers:** Manual trigger via GitHub Actions UI
**Options:**
- Skip tests (for emergency deployments)
- Restart only (no code pull)
- Choose environment (production/staging)

### 3. `stainless.yml` - SDK Generation
**Triggers:** Changes to `docs/openapi.json` or `stainless.yml`
**Purpose:** Automatically generates and updates TypeScript/Python SDKs

## Required Secrets

For deployment to work, ensure these secrets are set in repository settings:

```
EC2_USER          # SSH username (usually 'ubuntu')
EC2_HOST          # Server IP address or hostname
EC2_KEY           # Base64 encoded SSH private key
AWS_ACCESS_KEY_ID # AWS credentials for migrations
AWS_SECRET_ACCESS_KEY # AWS credentials
```

## Deployment Process

### Automatic Deployment (Main Branch)
1. Code is pushed to `main` branch
2. Pipeline runs quality checks and tests
3. If all tests pass → automatic deployment to production
4. Application is built, migrated, and restarted on EC2
5. Health checks verify deployment success

### Manual Deployment Options
1. Go to Actions → "Manual Deployment"
2. Click "Run workflow"
3. Choose options:
   - **Skip tests:** For urgent fixes
   - **Restart only:** Just restart PM2, no code changes
   - **Environment:** Target server (production/staging)

## Server Setup Requirements

Your EC2 server should have:
- Node.js and npm installed
- PM2 process manager
- Git repository cloned at `/home/ubuntu/tolstoy`
- AWS CLI configured for database migrations
- SSH key access from GitHub Actions

## Pipeline Benefits

1. **🚀 Zero-downtime deployments** - PM2 gracefully restarts
2. **🔒 Quality assurance** - No broken code reaches production  
3. **⚡ Fast feedback** - Know immediately if something is wrong
4. **🛠️ Emergency options** - Manual deployment when needed
5. **📊 Comprehensive health checks** - Verify deployment success

## Monitoring

After deployment, the pipeline automatically:
- ✅ Checks that the application starts
- ✅ Validates health endpoints (`/health`, `/status`)
- ✅ Tests core API endpoints
- ✅ Verifies database connectivity
- 📊 Reports deployment status

## Troubleshooting

**Pipeline fails on tests:**
- Check the specific test failure in Actions logs
- Run `npm test` locally to debug

**Deployment fails:**
- Verify EC2_* secrets are correctly set
- Check server has disk space and memory
- SSH into server and check PM2 status: `pm2 status`
- View logs: `pm2 logs tolstoy-api`

**Health checks fail after deployment:**
- Application may still be starting (PM2 takes ~10-15 seconds)
- Check server logs for errors
- Verify database connectivity and AWS secrets

---

*This pipeline automatically deploys every push to main after passing all quality checks. For safer deployments, consider creating a `develop` branch for staging.*