# Simplified HCP Resources for Tolstoy API Gateway Infrastructure
# This file manages basic HCP resources that will be visible in HashiCorp Cloud

# Data source for current HCP organization
data "hcp_organization" "main" {}

# HCP Project for organizing resources (conditional)
resource "hcp_project" "tolstoy" {
  count       = var.create_hcp_project ? 1 : 0
  name        = var.hcp_project_name
  description = "Tolstoy workflow automation platform infrastructure and services"
}

# HCP Vault Cluster (optional - for secrets management)
resource "hcp_vault_cluster" "tolstoy" {
  count              = var.create_hcp_vault ? 1 : 0
  cluster_id         = "tolstoy-vault-${var.environment}"
  hvn_id            = hcp_hvn.main[0].hvn_id
  tier              = var.hcp_vault_tier
  public_endpoint   = true
}

# HCP HashiCorp Virtual Network (HVN) for private connectivity
resource "hcp_hvn" "main" {
  count          = var.create_hcp_hvn ? 1 : 0
  hvn_id         = "tolstoy-hvn-${var.environment}"
  cloud_provider = "aws"
  region         = var.aws_region
  cidr_block     = var.hcp_hvn_cidr
}

# HCP Boundary Cluster (optional - for secure access)
resource "hcp_boundary_cluster" "tolstoy" {
  count              = var.create_hcp_boundary ? 1 : 0
  cluster_id         = "tolstoy-boundary-${var.environment}"
  username           = var.hcp_boundary_username
  password           = var.hcp_boundary_password
  tier               = var.hcp_boundary_tier
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