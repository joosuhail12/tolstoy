# HCP Terraform Cloud Configuration for Tolstoy API Gateway
# This file configures the HCP Terraform Cloud workspace and variables

# Note: This file is optional and used for initial workspace setup
# The actual backend configuration is in main.tf

# You can use this as a reference for workspace configuration
# or delete it after setting up your workspace manually

/*
HCP Terraform Cloud Workspace Configuration:

1. Organization: tolstoy-org (or your organization name)
2. Workspace: tolstoy-api-gateway-prod
3. Execution Mode: Remote
4. Working Directory: terraform/
5. VCS Connection: GitHub (joosuhail12/tolstoy)

Required Environment Variables in HCP Workspace:
- AWS_ACCESS_KEY_ID (sensitive)
- AWS_SECRET_ACCESS_KEY (sensitive)
- AWS_DEFAULT_REGION = us-east-1

Optional Terraform Variables in HCP Workspace:
- project_name = "tolstoy"
- environment = "prod"
- aws_region = "us-east-1"
- ec2_instance_id = "i-0ea0ff0e9a8db29d4"
- enable_caching = true
- cache_cluster_size = "0.5"
- throttle_rate_limit = 200
- throttle_burst_limit = 400
- waf_rate_limit = 5000
- api_gateway_log_level = "ERROR"
- log_retention_days = 30

Domain Configuration (if using custom domain):
- domain_name = "api.tolstoy.dev"
- route53_zone_id = "Z1234567890123"

Auto Apply Settings:
- Auto-apply successful plans: Recommended for production after testing
- Speculative plans: Enabled for pull requests

Notifications:
- Configure Slack/email notifications for plan/apply status
- Set up run triggers for connected repositories

Run Triggers:
- Trigger runs on changes to terraform/ directory
- Optionally trigger on tags for versioned deployments
*/