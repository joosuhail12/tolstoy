# Terraform Variables for Tolstoy API Gateway Infrastructure
# Sprint 5 Task 5.4: Enterprise-grade API Gateway with WAF, ACM, and caching

# HCP Terraform Cloud Configuration
variable "hcp_organization" {
  description = "HCP Terraform Cloud organization name"
  type        = string
  default     = "tolstoy-org"
}

variable "hcp_workspace_name" {
  description = "HCP Terraform Cloud workspace name"
  type        = string
  default     = "tolstoy-api-gateway-prod"
}

variable "hcp_project_name" {
  description = "HCP project name"
  type        = string
  default     = "tolstoy"
}

variable "hcp_client_id" {
  description = "HCP service principal client ID"
  type        = string
  sensitive   = true
}

variable "hcp_client_secret" {
  description = "HCP service principal client secret"
  type        = string
  sensitive   = true
}

# HCP Service Configuration
variable "create_hcp_project" {
  description = "Create HCP project (requires organization admin permissions)"
  type        = bool
  default     = false
}

variable "create_hcp_vault" {
  description = "Create HCP Vault cluster"
  type        = bool
  default     = false
}

variable "create_hcp_hvn" {
  description = "Create HCP HashiCorp Virtual Network"
  type        = bool
  default     = false
}

variable "create_hcp_consul" {
  description = "Create HCP Consul cluster"
  type        = bool
  default     = false
}

variable "create_hcp_packer_registry" {
  description = "Create HCP Packer registry"
  type        = bool
  default     = false
}

variable "create_hcp_boundary" {
  description = "Create HCP Boundary cluster"
  type        = bool
  default     = false
}

variable "create_hcp_waypoint" {
  description = "Create HCP Waypoint application"
  type        = bool
  default     = false
}

variable "hcp_hvn_cidr" {
  description = "CIDR block for HCP HVN"
  type        = string
  default     = "172.25.16.0/20"
}

variable "hcp_vault_tier" {
  description = "HCP Vault cluster tier"
  type        = string
  default     = "dev"
}

variable "hcp_consul_tier" {
  description = "HCP Consul cluster tier"
  type        = string
  default     = "development"
}

variable "hcp_consul_size" {
  description = "HCP Consul cluster size"
  type        = string
  default     = "x_small"
}

variable "hcp_boundary_tier" {
  description = "HCP Boundary cluster tier"
  type        = string
  default     = "Standard"
}

variable "hcp_boundary_username" {
  description = "HCP Boundary admin username"
  type        = string
  default     = "admin"
}

variable "hcp_boundary_password" {
  description = "HCP Boundary admin password"
  type        = string
  sensitive   = true
  default     = ""
}

# Monitoring Integration Variables (optional)
variable "grafana_endpoint" {
  description = "Grafana endpoint for audit logs"
  type        = string
  default     = ""
}

variable "grafana_user" {
  description = "Grafana user for audit logs"
  type        = string
  default     = ""
}

variable "grafana_password" {
  description = "Grafana password for audit logs"
  type        = string
  sensitive   = true
  default     = ""
}

variable "datadog_api_key" {
  description = "Datadog API key for audit logs"
  type        = string
  sensitive   = true
  default     = ""
}

variable "datadog_region" {
  description = "Datadog region for audit logs"
  type        = string
  default     = "US"
}

variable "splunk_hecendpoint" {
  description = "Splunk HEC endpoint for audit logs"
  type        = string
  default     = ""
}

variable "splunk_token" {
  description = "Splunk HEC token for audit logs"
  type        = string
  sensitive   = true
  default     = ""
}

# Project Configuration
variable "project_name" {
  description = "Name of the project"
  type        = string
  default     = "tolstoy"
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  default     = "prod"
  
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod."
  }
}

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

# EC2 Configuration
variable "ec2_instance_id" {
  description = "ID of the existing EC2 instance running Tolstoy"
  type        = string
  default     = "i-0ea0ff0e9a8db29d4"
}

variable "backend_port" {
  description = "Port number of the backend service on EC2"
  type        = number
  default     = 80
}

# Domain and SSL Configuration
variable "domain_name" {
  description = "Custom domain name for the API (leave empty to use API Gateway URL)"
  type        = string
  default     = ""
  
  validation {
    condition = var.domain_name == "" || can(regex("^[a-z0-9.-]+\\.[a-z]{2,}$", var.domain_name))
    error_message = "Domain name must be a valid domain format or empty string."
  }
}

variable "route53_zone_id" {
  description = "Route53 hosted zone ID for the domain (required if domain_name is provided)"
  type        = string
  default     = ""
}

# API Gateway Configuration
variable "stage_name" {
  description = "API Gateway stage name"
  type        = string
  default     = "prod"
}

variable "integration_timeout_ms" {
  description = "Integration timeout in milliseconds (50-29000)"
  type        = number
  default     = 29000
  
  validation {
    condition     = var.integration_timeout_ms >= 50 && var.integration_timeout_ms <= 29000
    error_message = "Integration timeout must be between 50 and 29000 milliseconds."
  }
}

# Caching Configuration
variable "enable_caching" {
  description = "Enable API Gateway caching"
  type        = bool
  default     = true
}

variable "cache_cluster_size" {
  description = "Size of the cache cluster in GB (0.5, 1.6, 6.1, 13.5, 28.4, 58.2, 118, 237)"
  type        = string
  default     = "0.5"
  
  validation {
    condition = contains([
      "0.5", "1.6", "6.1", "13.5", "28.4", "58.2", "118", "237"
    ], var.cache_cluster_size)
    error_message = "Cache cluster size must be one of the valid values: 0.5, 1.6, 6.1, 13.5, 28.4, 58.2, 118, 237."
  }
}

variable "cache_ttl_seconds" {
  description = "Default cache TTL in seconds"
  type        = number
  default     = 60
  
  validation {
    condition     = var.cache_ttl_seconds >= 0 && var.cache_ttl_seconds <= 3600
    error_message = "Cache TTL must be between 0 and 3600 seconds."
  }
}

# Throttling Configuration
variable "throttle_rate_limit" {
  description = "API Gateway throttling rate limit (requests per second)"
  type        = number
  default     = 100
  
  validation {
    condition     = var.throttle_rate_limit > 0
    error_message = "Throttle rate limit must be greater than 0."
  }
}

variable "throttle_burst_limit" {
  description = "API Gateway throttling burst limit"
  type        = number
  default     = 200
  
  validation {
    condition     = var.throttle_burst_limit > 0
    error_message = "Throttle burst limit must be greater than 0."
  }
}

# Usage Plan Configuration
variable "enable_api_key_auth" {
  description = "Enable API key authentication and usage plans"
  type        = bool
  default     = false
}

variable "quota_limit" {
  description = "API usage quota limit per period"
  type        = number
  default     = 10000
}

variable "quota_period" {
  description = "API usage quota period (DAY, WEEK, MONTH)"
  type        = string
  default     = "DAY"
  
  validation {
    condition     = contains(["DAY", "WEEK", "MONTH"], var.quota_period)
    error_message = "Quota period must be one of: DAY, WEEK, MONTH."
  }
}

# Logging Configuration
variable "api_gateway_log_level" {
  description = "API Gateway CloudWatch log level (OFF, ERROR, INFO)"
  type        = string
  default     = "ERROR"
  
  validation {
    condition     = contains(["OFF", "ERROR", "INFO"], var.api_gateway_log_level)
    error_message = "Log level must be one of: OFF, ERROR, INFO."
  }
}

variable "log_retention_days" {
  description = "CloudWatch logs retention period in days"
  type        = number
  default     = 14
  
  validation {
    condition = contains([
      1, 3, 5, 7, 14, 30, 60, 90, 120, 150, 180, 365, 400, 545, 731, 1827, 3653
    ], var.log_retention_days)
    error_message = "Log retention days must be one of the valid CloudWatch log retention values."
  }
}

variable "enable_data_trace" {
  description = "Enable detailed data tracing for API Gateway"
  type        = bool
  default     = false
}

variable "enable_xray_tracing" {
  description = "Enable X-Ray tracing for API Gateway"
  type        = bool
  default     = true
}

# WAF Configuration
variable "waf_rate_limit" {
  description = "WAF rate limit per 5-minute period per IP"
  type        = number
  default     = 2000
  
  validation {
    condition     = var.waf_rate_limit >= 100 && var.waf_rate_limit <= 20000000
    error_message = "WAF rate limit must be between 100 and 20,000,000."
  }
}

variable "allowed_countries" {
  description = "List of allowed country codes for WAF geo-blocking (empty list allows all)"
  type        = list(string)
  default     = []
  
  validation {
    condition = alltrue([
      for country in var.allowed_countries : length(country) == 2
    ])
    error_message = "Country codes must be valid 2-letter ISO codes."
  }
}

# Security Configuration
variable "enable_waf_logging" {
  description = "Enable WAF logging to CloudWatch"
  type        = bool
  default     = true
}

variable "waf_log_retention_days" {
  description = "WAF logs retention period in days"
  type        = number
  default     = 7
}

# Backup Configuration Variables
variable "backup_schedule" {
  description = "EventBridge schedule expression for database backups"
  type        = string
  default     = "cron(0 2 * * ? *)" # Daily at 2 AM UTC
  
  validation {
    condition = can(regex("^(rate\\(|cron\\()", var.backup_schedule))
    error_message = "Backup schedule must be a valid EventBridge schedule expression."
  }
}

variable "backup_retention_days" {
  description = "Number of days to retain database backups in S3"
  type        = number
  default     = 90
  
  validation {
    condition     = var.backup_retention_days >= 7 && var.backup_retention_days <= 365
    error_message = "Backup retention must be between 7 and 365 days."
  }
}

variable "enable_cross_region_backup" {
  description = "Enable cross-region replication for database backups"
  type        = bool
  default     = false
}

variable "backup_replica_region" {
  description = "AWS region for backup replication (if enabled)"
  type        = string
  default     = "us-west-2"
}

variable "enable_manual_backup" {
  description = "Create a manual backup Lambda function for on-demand backups"
  type        = bool
  default     = true
}

variable "lambda_subnet_ids" {
  description = "Subnet IDs for Lambda VPC configuration (optional)"
  type        = list(string)
  default     = null
}

variable "lambda_security_group_ids" {
  description = "Security Group IDs for Lambda VPC configuration (optional)"
  type        = list(string)
  default     = null
}

# State Management Configuration Variables
variable "enable_state_backup" {
  description = "Enable S3 + DynamoDB fallback state management"
  type        = bool
  default     = false
}

variable "enable_cross_region_state_backup" {
  description = "Enable cross-region replication for Terraform state backup"
  type        = bool
  default     = false
}

variable "tfc_token" {
  description = "Terraform Cloud API token for state backup (optional)"
  type        = string
  sensitive   = true
  default     = ""
}

# Notification Configuration
variable "backup_notification_email" {
  description = "Email address for backup failure notifications"
  type        = string
  default     = ""
  
  validation {
    condition = var.backup_notification_email == "" || can(regex("^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$", var.backup_notification_email))
    error_message = "Must be a valid email address or empty string."
  }
}

variable "enable_backup_notifications" {
  description = "Enable SNS notifications for backup status"
  type        = bool
  default     = true
}