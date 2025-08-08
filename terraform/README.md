# Tolstoy API Gateway Infrastructure

**Sprint 5 Task 5.4**: Enterprise-grade AWS API Gateway infrastructure with WAF protection, caching, custom domain, and rate limiting for the Tolstoy workflow automation platform.

## 🏗️ Architecture Overview

This Terraform configuration creates a production-ready API Gateway that fronts your existing Tolstoy EC2 + Nginx deployment with enterprise features:

```
Internet → WAF → API Gateway → EC2 (Nginx) → NestJS App
                     ↓
              CloudWatch Logs
```

### Key Components

- **AWS API Gateway REST API** - Regional deployment with proxy integration
- **WAFv2 Web ACL** - DDoS protection, rate limiting, and common attack prevention
- **ACM Certificate** - Automated TLS certificate management with DNS validation
- **CloudWatch Monitoring** - Comprehensive logging, metrics, and X-Ray tracing
- **Stage-level Caching** - Configurable response caching (0.5GB - 237GB)
- **Rate Limiting** - API-level and WAF-level traffic throttling
- **Custom Domain** - Optional branded domain with Route53 integration

## 🚀 Quick Start

### Prerequisites

- **Terraform** >= 1.0
- **HCP CLI** installed and logged in (`hcp auth login`)
- **AWS CLI** configured with appropriate permissions (or AWS credentials in HCP workspace)
- **Existing EC2 instance** running Tolstoy with Nginx
- **Route53 hosted zone** (optional, for custom domain)
- **HCP Terraform Cloud account** with organization access

### 1. HCP Setup (Recommended)

```bash
cd tolstoy/terraform

# Set up HCP Terraform Cloud integration
./setup-hcp.sh

# This will:
# - Configure Terraform Cloud backend
# - Login to Terraform Cloud
# - Initialize remote state
# - Create workspace setup guide
```

### 2. Manual Configuration (Alternative)

```bash
cd tolstoy/terraform
cp terraform.tfvars.example terraform.tfvars
```

### 2. Edit Configuration

Edit `terraform.tfvars` with your settings:

```hcl
# HCP Configuration
hcp_organization = "your-hcp-org"
hcp_workspace_name = "tolstoy-api-gateway-prod"

# Required: Your existing EC2 instance
ec2_instance_id = "i-0ea0ff0e9a8db29d4"

# Optional: Custom domain
domain_name = "api.tolstoy.dev"
route53_zone_id = "Z1234567890123"

# Caching and performance
enable_caching = true
cache_cluster_size = "0.5"
throttle_rate_limit = 100
```

### 3. Deploy Infrastructure

```bash
./deploy.sh
```

### 4. Test Deployment

```bash
./test-api.sh
```

## 📋 Configuration Options

### Core Settings

| Variable | Description | Default |
|----------|-------------|---------|
| `project_name` | Project identifier | `"tolstoy"` |
| `environment` | Environment name | `"prod"` |
| `ec2_instance_id` | Your existing EC2 instance | `"i-0ea0ff0e9a8db29d4"` |
| `backend_port` | Nginx port on EC2 | `80` |

### Custom Domain & TLS

| Variable | Description | Default |
|----------|-------------|---------|
| `domain_name` | Custom API domain | `""` (disabled) |
| `route53_zone_id` | Route53 zone for domain | `""` |

### Performance & Caching

| Variable | Description | Default | Options |
|----------|-------------|---------|---------|
| `enable_caching` | Enable response caching | `true` | `true`, `false` |
| `cache_cluster_size` | Cache cluster size (GB) | `"0.5"` | `0.5`, `1.6`, `6.1`, `13.5`, `28.4`, `58.2`, `118`, `237` |
| `cache_ttl_seconds` | Cache TTL | `60` | `0-3600` |

### Rate Limiting & Security

| Variable | Description | Default |
|----------|-------------|---------|
| `throttle_rate_limit` | API Gateway RPS limit | `100` |
| `throttle_burst_limit` | API Gateway burst limit | `200` |
| `waf_rate_limit` | WAF requests per 5min/IP | `2000` |
| `allowed_countries` | WAF geo-blocking | `[]` (all allowed) |

### Authentication

| Variable | Description | Default |
|----------|-------------|---------|
| `enable_api_key_auth` | Require API keys | `false` |
| `quota_limit` | Daily request quota | `10000` |
| `quota_period` | Quota period | `"DAY"` |

### Monitoring & Logging

| Variable | Description | Default |
|----------|-------------|---------|
| `api_gateway_log_level` | CloudWatch log level | `"ERROR"` |
| `enable_xray_tracing` | X-Ray distributed tracing | `true` |
| `log_retention_days` | Log retention period | `14` |

## 🏃 Deployment Commands

### Standard Deployment

```bash
# Deploy to production
./deploy.sh

# Deploy to specific environment
./deploy.sh --environment dev
```

### Manual Deployment

```bash
# Initialize Terraform
terraform init

# Plan deployment
terraform plan -var="environment=prod"

# Apply changes
terraform apply

# Show outputs
terraform output
```

### Testing

```bash
# Run comprehensive API tests
./test-api.sh

# Manual health check
curl $(terraform output -raw api_gateway_url)/status
```

## 📊 Monitoring & Observability

### CloudWatch Metrics

The deployment automatically configures:

- **API Gateway Metrics**: Request count, latency, errors, cache hits
- **WAF Metrics**: Blocked requests, rate limiting triggers
- **Custom Dashboards**: Available via Terraform outputs

### Log Groups

- **API Gateway Logs**: `/aws/apigateway/tolstoy-api-prod`
- **WAF Logs**: Configured with 7-day retention
- **X-Ray Traces**: Distributed request tracing

### Accessing Logs

```bash
# View recent API Gateway logs
aws logs tail $(terraform output -raw api_gateway_log_group_name) --follow

# Get monitoring URLs
terraform output monitoring_urls
```

## 🔒 Security Features

### WAF Protection

- **Rate Limiting**: 2000 requests per 5 minutes per IP address
- **AWS Managed Rules**: 
  - Core Rule Set (OWASP Top 10)
  - Known Bad Inputs protection
- **Geo-blocking**: Optional country-based filtering
- **Real-time Monitoring**: CloudWatch metrics and alerts

### API Gateway Security

- **Regional Endpoints**: No global CloudFront distribution
- **Request Validation**: Schema-based validation
- **CORS Configuration**: Proper cross-origin handling
- **IP Whitelisting**: Optional source IP restrictions

### TLS Configuration

- **ACM Certificates**: Automated certificate lifecycle
- **TLS 1.2+**: Modern encryption protocols
- **HSTS Headers**: HTTP Strict Transport Security
- **DNS Validation**: Automated certificate validation

## 🧪 Testing Strategy

### Automated Tests

The `test-api.sh` script validates:

- ✅ **Basic Connectivity**: API Gateway → EC2 proxy
- ✅ **Endpoint Testing**: Health checks, API routes
- ✅ **Rate Limiting**: WAF and API Gateway throttling
- ✅ **Caching Behavior**: Cache headers and TTL
- ✅ **TLS Certificates**: Certificate validity and chain
- ✅ **DNS Resolution**: Custom domain configuration
- ✅ **Monitoring Setup**: CloudWatch logs and metrics

### Manual Testing

```bash
# Test API endpoints
API_URL=$(terraform output -raw api_gateway_url)

# Health check
curl "$API_URL/status"

# With API key (if enabled)
API_KEY=$(terraform output -raw api_key_value)
curl -H "X-API-Key: $API_KEY" "$API_URL/health"

# Load testing (rate limiting)
for i in {1..200}; do
  curl -s "$API_URL/status" &
done
```

## 💰 Cost Optimization

### Cost Factors

- **API Gateway**: $1.00 per million REST API calls
- **WAF**: $5.00/month + $0.60 per million requests
- **CloudWatch Logs**: $0.50/GB ingested + $0.03/GB stored
- **ACM Certificates**: Free for AWS resources
- **Caching**: $0.038/hour for 0.5GB cluster

### Optimization Tips

1. **Right-size Cache**: Start with 0.5GB, monitor hit rates
2. **Log Retention**: Use appropriate retention periods
3. **Request Filtering**: Use WAF to block unwanted traffic
4. **Monitoring**: Set up billing alerts

### Cost Example (Monthly)

```
API Gateway (1M requests): ~$1.00
WAF (1M requests): ~$5.60
CloudWatch Logs (1GB): ~$0.53
Caching (0.5GB, 24/7): ~$27.36
Total: ~$34.49/month
```

## 🔧 Troubleshooting

### Common Issues

#### 1. Certificate Validation Fails

```bash
# Check DNS records
dig TXT _acme-challenge.yourdomain.com

# Manual certificate validation
aws acm describe-certificate --certificate-arn $(terraform output -raw acm_certificate_arn)
```

#### 2. API Gateway Returns 502/503

```bash
# Check backend health
curl http://$(terraform output -raw backend_public_ip)/status

# Check security groups
aws ec2 describe-security-groups --group-ids $(terraform output backend_security_group_id)
```

#### 3. WAF Blocking Legitimate Traffic

```bash
# Check WAF logs
aws wafv2 get-sampled-requests \
  --web-acl-arn $(terraform output -raw waf_web_acl_arn) \
  --rule-metric-name RateLimitRule \
  --scope REGIONAL \
  --time-window StartTime=$(date -d '1 hour ago' -u +%s),EndTime=$(date -u +%s) \
  --max-items 100
```

#### 4. High Latency

```bash
# Check cache hit rates
aws cloudwatch get-metric-statistics \
  --namespace AWS/ApiGateway \
  --metric-name CacheHitCount \
  --dimensions Name=ApiName,Value=tolstoy-api-prod \
  --start-time $(date -d '1 hour ago' -u +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Sum
```

### Debug Commands

```bash
# View all Terraform outputs
terraform output

# Check API Gateway configuration
aws apigateway get-rest-api --rest-api-id $(terraform output -raw api_gateway_rest_api_id)

# Test backend connectivity
curl -v http://$(terraform output -raw backend_private_ip)/status
```

## 🏗️ HCP Terraform Cloud Integration

This infrastructure is configured to use **HCP Terraform Cloud** for state management, collaboration, and CI/CD integration.

### Benefits of HCP Integration

- **Remote State Management**: Secure, versioned state storage
- **Team Collaboration**: Shared workspaces with access controls  
- **CI/CD Integration**: Automated deployments from GitHub
- **Policy as Code**: Sentinel policies for compliance
- **Cost Estimation**: Automatic cost analysis for changes
- **Audit Logging**: Complete audit trail of infrastructure changes

### HCP Workspace Configuration

After running `./setup-hcp.sh`, configure your workspace at:
`https://app.terraform.io/app/your-org/workspaces/tolstoy-api-gateway-prod`

#### Required Environment Variables

Set these **sensitive** environment variables in your HCP workspace:

```bash
AWS_ACCESS_KEY_ID         = your-aws-access-key     [Sensitive]
AWS_SECRET_ACCESS_KEY     = your-aws-secret-key     [Sensitive]  
AWS_DEFAULT_REGION        = us-east-1
```

#### VCS Integration

1. Connect your GitHub repository: `joosuhail12/tolstoy`
2. Set working directory: `terraform/`
3. Enable automatic triggering on changes
4. Configure path filtering: `terraform/**/*`

#### Workspace Settings

- **Execution Mode**: Remote
- **Terraform Version**: Latest or >= 1.0
- **Auto Apply**: Enable after testing (optional)
- **Speculative Plans**: Enable for PR reviews

### HCP Deployment Workflow

```bash
# 1. Make changes to terraform files
git add terraform/
git commit -m "Update API Gateway configuration"
git push

# 2. HCP automatically triggers plan
# View plan at: https://app.terraform.io

# 3. Review and apply via HCP UI or CLI
terraform apply

# 4. Monitor deployment in HCP workspace
```

### HCP Commands

```bash
# Retrieve HCP credentials from AWS (one-time setup)
./get-hcp-credentials.sh

# View workspace status
terraform workspace show

# Run plan in HCP
terraform plan

# Apply via HCP (runs remotely)
terraform apply

# View run history
# Visit: https://app.terraform.io/app/your-org/workspaces/workspace-name
```

## 🏗️ HCP Resource Management

This configuration creates and manages HCP resources directly, making them visible in your HashiCorp Cloud dashboard.

### HCP Resources Created

#### **Core Resources (Always Created)**
- **HCP Project**: Organizes all your Tolstoy infrastructure
- **HCP Service Principal**: Authentication for Terraform and CI/CD
- **HCP IAM Workload Identity Provider**: GitHub Actions integration

#### **Optional Services (Configurable)**
- **HCP Vault**: Secrets management and encryption
- **HCP Consul**: Service mesh and service discovery  
- **HCP Boundary**: Secure remote access
- **HCP Packer Registry**: Container and VM image management
- **HCP Waypoint**: Application deployment automation
- **HCP Virtual Network**: Private cloud networking

### Enabling HCP Services

Set these variables in your `terraform.tfvars` to enable services:

```hcl
# Enable HCP services (start with these for basic setup)
create_hcp_vault           = true    # Recommended for secrets
create_hcp_hvn            = true    # Recommended for networking
create_hcp_consul         = false   # Enable for microservices
create_hcp_packer_registry = false   # Enable for image management
create_hcp_boundary       = false   # Enable for secure access
create_hcp_waypoint       = false   # Enable for deployment automation

# Service configuration
hcp_vault_tier     = "dev"          # or "starter_small" for production
hcp_consul_tier    = "development"  # or "standard" for production
hcp_hvn_cidr      = "172.25.16.0/20"
```

### HCP Service Principal Setup

Your service principal credentials are stored in AWS Secrets Manager. Use the provided script to retrieve them:

```bash
# Retrieve HCP credentials from AWS Secrets Manager
./get-hcp-credentials.sh

# This will:
# - Get credentials from tolstoy/env secret
# - Update terraform.tfvars automatically  
# - Set environment variables for current session
# - Create .hcp-env for future sessions
```

### Viewing HCP Resources

After deployment, your resources will be visible at:

- **HCP Console**: https://portal.cloud.hashicorp.com
- **Project Dashboard**: `https://portal.cloud.hashicorp.com/project/{project-id}`
- **Service Dashboards**: Available via Terraform outputs

```bash
# Get HCP console URLs
terraform output hcp_console_urls
```

## 🚀 Advanced Configuration

### Multi-Environment Setup

```bash
# Create environment-specific tfvars
cp terraform.tfvars terraform-dev.tfvars
cp terraform.tfvars terraform-staging.tfvars

# Deploy to different environments
terraform apply -var-file="terraform-dev.tfvars" -var="environment=dev"
```

### Custom WAF Rules

Add custom rules to `main.tf`:

```hcl
# Block specific user agents
rule {
  name     = "BlockBadUserAgents"
  priority = 4
  
  action {
    block {}
  }
  
  statement {
    byte_match_statement {
      search_string = "BadBot"
      field_to_match {
        single_header {
          name = "user-agent"
        }
      }
      text_transformation {
        priority = 0
        type     = "LOWERCASE"
      }
      positional_constraint = "CONTAINS"
    }
  }
  
  visibility_config {
    sampled_requests_enabled   = true
    cloudwatch_metrics_enabled = true
    metric_name                = "BlockBadUserAgentsRule"
  }
}
```

### Remote State Backend

Configure S3 backend in `main.tf`:

```hcl
terraform {
  backend "s3" {
    bucket = "your-terraform-state-bucket"
    key    = "tolstoy/api-gateway/terraform.tfstate"
    region = "us-east-1"
    
    dynamodb_table = "terraform-state-lock"
    encrypt        = true
  }
}
```

## 📚 Additional Resources

- [AWS API Gateway Documentation](https://docs.aws.amazon.com/apigateway/)
- [AWS WAF Developer Guide](https://docs.aws.amazon.com/waf/)
- [Terraform AWS Provider](https://registry.terraform.io/providers/hashicorp/aws/)
- [API Gateway Best Practices](https://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-basic-concept.html)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Test your changes with `./test-api.sh`
4. Submit a pull request with detailed description

## 📄 License

This infrastructure code is part of the Tolstoy project. See the main project README for license information.

---

**Need help?** Check the [troubleshooting section](#troubleshooting) or create an issue with:
- Terraform version: `terraform version`
- AWS CLI version: `aws --version` 
- Error messages and logs
- Your `terraform.tfvars` configuration (sanitized)