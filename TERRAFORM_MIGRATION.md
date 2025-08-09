# Terraform Migration Notice

## 🚀 Migration Complete: GitHub Actions CI/CD

As of January 2025, this project has migrated from Terraform-based infrastructure management to a streamlined GitHub Actions CI/CD approach.

### What Changed

✅ **Removed:**
- Entire `terraform/` directory
- HCP Terraform Cloud dependency
- Terraform state management complexity
- Infrastructure-as-Code overhead

✅ **Simplified to:**
- Direct GitHub Actions deployment
- EC2-based hosting with PM2 process management
- AWS Secrets Manager for configuration (`tolstoy/env`)
- Streamlined CI/CD pipeline

### AWS Secrets Manager Configuration

All environment variables are now stored in a single AWS Secrets Manager secret:

**Secret Name:** `tolstoy/env`

**Required Configuration:**
```json
{
  "NODE_ENV": "production",
  "PORT": "3000",
  "APP_NAME": "Tolstoy",
  "DOMAIN": "tolstoy.getpullse.com",
  "BASE_URL": "https://tolstoy.getpullse.com",
  "DATABASE_URL": "postgresql://...",
  "DIRECT_URL": "postgresql://...",
  "JWT_SECRET": "your-jwt-secret",
  "DAYTONA_API_KEY": "your-daytona-key",
  "INNGEST_EVENT_KEY_PROD": "your-inngest-key",
  "INNGEST_SIGNING_KEY_PROD": "your-signing-key"
}
```

### Current Deployment Process

1. **Code Changes** → Push to `main` branch
2. **GitHub Actions** → Automatic CI/CD pipeline
3. **EC2 Deployment** → Direct deployment with PM2
4. **Health Checks** → Automated verification

### Benefits of Migration

- ✅ Simplified deployment process
- ✅ Reduced infrastructure complexity  
- ✅ Faster CI/CD pipeline
- ✅ Lower operational overhead
- ✅ GitHub-native workflow integration

### Historical References

Some documentation and changelog entries may still reference Terraform - these are historical and represent the previous architecture that was successfully migrated away from.

For current deployment procedures, refer to:
- `.github/workflows/ci.yml` - Main CI/CD pipeline
- `.github/workflows/deploy.yml` - Production deployment
- `PRODUCTION_DOMAIN_SETUP.md` - Production configuration guide