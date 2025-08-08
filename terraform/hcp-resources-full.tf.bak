# HCP Resources for Tolstoy API Gateway Infrastructure
# This file manages HCP-specific resources that will be visible in HashiCorp Cloud

# Data source for current HCP organization
data "hcp_organization" "main" {}

# HCP Project for organizing resources
resource "hcp_project" "tolstoy" {
  name        = var.hcp_project_name
  description = "Tolstoy workflow automation platform infrastructure and services"
}

# HCP Terraform Cloud Organization (if you want to manage it via Terraform)
# Note: This is optional - you might already have the organization created manually
# resource "hcp_organization" "tolstoy" {
#   name = var.hcp_organization
# }

# HCP Service Principal (reference to your existing one)
# This data source references your existing service principal
data "hcp_service_principal" "tolstoy" {
  resource_name = "iam/project/${hcp_project.tolstoy.resource_id}/service-principal/tolstoy-terraform"
}

# HCP IAM Policy for the service principal
resource "hcp_iam_workload_identity_provider" "tolstoy_github" {
  name               = "tolstoy-github-actions"
  service_principal  = data.hcp_service_principal.tolstoy.resource_name
  description        = "Workload identity provider for GitHub Actions CI/CD"
  
  conditional_access = "assertion.repository == 'joosuhail12/tolstoy'"
  
  oidc {
    issuer_uri        = "https://token.actions.githubusercontent.com"
    allowed_audiences = ["https://github.com/joosuhail12"]
  }
}

# HCP Vault Cluster (optional - for secrets management)
resource "hcp_vault_cluster" "tolstoy" {
  count              = var.create_hcp_vault ? 1 : 0
  cluster_id         = "tolstoy-vault-${var.environment}"
  hvn_id            = hcp_hvn.main[0].hvn_id
  tier              = var.hcp_vault_tier
  public_endpoint   = true
  
  audit_log_config {
    grafana_endpoint     = var.grafana_endpoint
    grafana_user         = var.grafana_user
    grafana_password     = var.grafana_password
    datadog_api_key     = var.datadog_api_key
    datadog_region      = var.datadog_region
    splunk_hecendpoint  = var.splunk_hecendpoint
    splunk_token        = var.splunk_token
  }
}

# HCP HashiCorp Virtual Network (HVN) for private connectivity
resource "hcp_hvn" "main" {
  count          = var.create_hcp_hvn ? 1 : 0
  hvn_id         = "tolstoy-hvn-${var.environment}"
  cloud_provider = "aws"
  region         = var.aws_region
  cidr_block     = var.hcp_hvn_cidr
}

# HCP Consul Cluster (optional - for service mesh)
resource "hcp_consul_cluster" "tolstoy" {
  count              = var.create_hcp_consul ? 1 : 0
  cluster_id         = "tolstoy-consul-${var.environment}"
  hvn_id            = hcp_hvn.main[0].hvn_id
  tier              = var.hcp_consul_tier
  size              = var.hcp_consul_size
  public_endpoint   = true
  
  ip_allowlist {
    address     = "0.0.0.0/0"
    description = "Allow all traffic for development - restrict in production"
  }
}

# HCP Packer Registry (for managing AMI builds)
resource "hcp_packer_registry" "tolstoy" {
  count       = var.create_hcp_packer_registry ? 1 : 0
  name        = "tolstoy-images"
  description = "Packer registry for Tolstoy application images"
}

# HCP Boundary Cluster (optional - for secure access)
resource "hcp_boundary_cluster" "tolstoy" {
  count              = var.create_hcp_boundary ? 1 : 0
  cluster_id         = "tolstoy-boundary-${var.environment}"
  username           = var.hcp_boundary_username
  password           = var.hcp_boundary_password
  tier               = var.hcp_boundary_tier
}

# HCP Waypoint Application (for application deployment)
resource "hcp_waypoint_application" "tolstoy_api" {
  count                      = var.create_hcp_waypoint ? 1 : 0
  name                       = "tolstoy-api"
  template_name             = "nodejs-aws"
  
  application_input_variables = [
    {
      name           = "region"
      value          = var.aws_region
      variable_type  = "string"
    },
    {
      name           = "instance_type"
      value          = "t3.medium"
      variable_type  = "string"
    }
  ]
}

# Tags for all HCP resources
locals {
  hcp_tags = {
    Project     = "Tolstoy"
    Environment = var.environment
    ManagedBy   = "Terraform"
    Owner       = "DevOps"
    Purpose     = "API Gateway Infrastructure"
  }
}

# Apply tags to HCP project
resource "hcp_project_iam_policy" "tolstoy_project_policy" {
  project_id = hcp_project.tolstoy.resource_id
  
  policy_data = jsonencode({
    version = "2012-10-17"
    statement = [
      {
        sid       = "AdminAccess"
        effect    = "Allow"
        actions   = ["*"]
        resources = ["*"]
        principals = {
          service_principals = [data.hcp_service_principal.tolstoy.resource_name]
        }
      }
    ]
  })
}