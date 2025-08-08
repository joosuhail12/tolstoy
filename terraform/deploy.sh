#!/bin/bash

# Terraform Deployment Script for Tolstoy API Gateway Infrastructure
# Sprint 5 Task 5.4: Enterprise-grade API Gateway with WAF, ACM, and caching

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
TERRAFORM_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_NAME="tolstoy"
ENVIRONMENT="${ENVIRONMENT:-prod}"

echo -e "${BLUE}🚀 Deploying Tolstoy API Gateway Infrastructure${NC}"
echo -e "${BLUE}=================================================${NC}"
echo "Environment: ${ENVIRONMENT}"
echo "Terraform Directory: ${TERRAFORM_DIR}"
echo ""

# Function to print section headers
print_section() {
    echo -e "${YELLOW}$1${NC}"
    echo -e "${YELLOW}$(printf '%.0s=' {1..${#1}})${NC}"
}

# Function to check prerequisites
check_prerequisites() {
    print_section "Checking Prerequisites"
    
    # Check if terraform is installed
    if ! command -v terraform &> /dev/null; then
        echo -e "${RED}❌ Terraform is not installed. Please install Terraform first.${NC}"
        exit 1
    fi
    echo -e "${GREEN}✅ Terraform found: $(terraform version | head -n1)${NC}"
    
    # Check if using HCP backend
    if grep -q "cloud {" "${TERRAFORM_DIR}/main.tf"; then
        echo -e "${BLUE}ℹ️ Using HCP Terraform Cloud backend${NC}"
        
        # Check Terraform Cloud login
        if ! terraform auth -check &> /dev/null; then
            echo -e "${YELLOW}⚠️ Not logged in to Terraform Cloud. Attempting login...${NC}"
            terraform login
        fi
        echo -e "${GREEN}✅ Terraform Cloud authentication verified${NC}"
        
        echo -e "${YELLOW}⚠️ AWS credentials should be configured in your HCP workspace${NC}"
        echo -e "${YELLOW}   Visit: https://app.terraform.io to configure environment variables${NC}"
    else
        # Check if AWS CLI is installed for local backend
        if ! command -v aws &> /dev/null; then
            echo -e "${RED}❌ AWS CLI is not installed. Please install AWS CLI first.${NC}"
            exit 1
        fi
        echo -e "${GREEN}✅ AWS CLI found: $(aws --version)${NC}"
        
        # Check AWS credentials
        if ! aws sts get-caller-identity &> /dev/null; then
            echo -e "${RED}❌ AWS credentials not configured. Please run 'aws configure' first.${NC}"
            exit 1
        fi
        echo -e "${GREEN}✅ AWS credentials configured${NC}"
    fi
    
    # Check if terraform.tfvars exists
    if [[ ! -f "${TERRAFORM_DIR}/terraform.tfvars" ]]; then
        echo -e "${YELLOW}⚠️  terraform.tfvars not found. Creating from example...${NC}"
        if [[ -f "${TERRAFORM_DIR}/terraform.tfvars.example" ]]; then
            cp "${TERRAFORM_DIR}/terraform.tfvars.example" "${TERRAFORM_DIR}/terraform.tfvars"
            echo -e "${YELLOW}📝 Please edit terraform.tfvars with your configuration before continuing.${NC}"
            echo -e "${YELLOW}Press Enter to continue after editing terraform.tfvars...${NC}"
            read
        else
            echo -e "${RED}❌ terraform.tfvars.example not found. Cannot create terraform.tfvars.${NC}"
            exit 1
        fi
    fi
    echo -e "${GREEN}✅ terraform.tfvars found${NC}"
    
    echo ""
}

# Function to initialize Terraform
init_terraform() {
    print_section "Initializing Terraform"
    
    cd "${TERRAFORM_DIR}"
    
    echo "Initializing Terraform..."
    terraform init -upgrade
    
    echo -e "${GREEN}✅ Terraform initialized successfully${NC}"
    echo ""
}

# Function to validate Terraform configuration
validate_terraform() {
    print_section "Validating Terraform Configuration"
    
    cd "${TERRAFORM_DIR}"
    
    echo "Validating Terraform configuration..."
    terraform validate
    
    echo "Formatting Terraform files..."
    terraform fmt -recursive
    
    echo -e "${GREEN}✅ Terraform configuration is valid${NC}"
    echo ""
}

# Function to plan Terraform deployment
plan_terraform() {
    print_section "Planning Terraform Deployment"
    
    cd "${TERRAFORM_DIR}"
    
    echo "Creating Terraform execution plan..."
    terraform plan -out=tfplan -var="environment=${ENVIRONMENT}"
    
    echo ""
    echo -e "${YELLOW}📋 Terraform Plan Summary:${NC}"
    echo "The plan above shows what resources will be created, modified, or destroyed."
    echo ""
    echo -e "${YELLOW}⚠️  Please review the plan carefully before applying.${NC}"
    echo -e "${YELLOW}Press Enter to continue with deployment, or Ctrl+C to cancel...${NC}"
    read
    echo ""
}

# Function to apply Terraform deployment
apply_terraform() {
    print_section "Applying Terraform Deployment"
    
    cd "${TERRAFORM_DIR}"
    
    echo "Applying Terraform configuration..."
    terraform apply tfplan
    
    echo -e "${GREEN}✅ Terraform deployment completed successfully${NC}"
    echo ""
}

# Function to show deployment outputs
show_outputs() {
    print_section "Deployment Outputs"
    
    cd "${TERRAFORM_DIR}"
    
    echo "Retrieving Terraform outputs..."
    terraform output
    
    echo ""
    echo -e "${GREEN}🎉 Deployment Summary:${NC}"
    echo "• API Gateway has been deployed successfully"
    echo "• WAF protection is enabled with rate limiting"
    echo "• CloudWatch logging and X-Ray tracing are configured"
    
    if terraform output api_gateway_domain_name &> /dev/null; then
        echo "• Custom domain with TLS certificate is configured"
    fi
    
    if terraform output api_key_value &> /dev/null; then
        echo "• API key authentication is enabled"
    fi
    
    echo ""
    echo -e "${BLUE}🧪 Test your API:${NC}"
    CURL_COMMAND=$(terraform output -raw curl_test_command 2>/dev/null || echo "")
    if [[ -n "$CURL_COMMAND" ]]; then
        echo "$CURL_COMMAND"
    fi
    
    echo ""
    echo -e "${BLUE}📊 Monitoring:${NC}"
    echo "• CloudWatch Metrics: Available in AWS Console"
    echo "• API Gateway Logs: $(terraform output -raw api_gateway_log_group_name 2>/dev/null || echo "Configured")"
    echo "• WAF Logs: Enabled with 7-day retention"
    
    echo ""
}

# Function to clean up temporary files
cleanup() {
    print_section "Cleaning Up"
    
    cd "${TERRAFORM_DIR}"
    
    if [[ -f "tfplan" ]]; then
        rm tfplan
        echo "Removed Terraform plan file"
    fi
    
    echo -e "${GREEN}✅ Cleanup completed${NC}"
}

# Function to handle errors
handle_error() {
    echo -e "${RED}❌ Deployment failed with error code $1${NC}"
    echo -e "${RED}Please check the error messages above and fix any issues.${NC}"
    cleanup
    exit $1
}

# Main deployment flow
main() {
    trap 'handle_error $?' ERR
    
    check_prerequisites
    init_terraform
    validate_terraform
    plan_terraform
    apply_terraform
    show_outputs
    cleanup
    
    echo -e "${GREEN}🎉 Tolstoy API Gateway infrastructure deployed successfully!${NC}"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --environment|-e)
            ENVIRONMENT="$2"
            shift 2
            ;;
        --help|-h)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  -e, --environment ENV    Set deployment environment (default: prod)"
            echo "  -h, --help              Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0                      # Deploy to prod environment"
            echo "  $0 -e dev              # Deploy to dev environment"
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            echo "Use --help for usage information."
            exit 1
            ;;
    esac
done

# Run main deployment
main