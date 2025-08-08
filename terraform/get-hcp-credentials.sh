#!/bin/bash

# Script to retrieve HCP service principal credentials from AWS Secrets Manager
# and set them as environment variables for Terraform

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SECRET_NAME="tolstoy/env"
AWS_REGION="us-east-1"

echo -e "${BLUE}🔐 Retrieving HCP credentials from AWS Secrets Manager${NC}"
echo -e "${BLUE}====================================================${NC}"
echo ""

# Function to check prerequisites
check_prerequisites() {
    echo -e "${YELLOW}Checking prerequisites...${NC}"
    
    # Check if AWS CLI is installed
    if ! command -v aws &> /dev/null; then
        echo -e "${RED}❌ AWS CLI is not installed${NC}"
        exit 1
    fi
    echo -e "${GREEN}✅ AWS CLI found${NC}"
    
    # Check if jq is installed
    if ! command -v jq &> /dev/null; then
        echo -e "${RED}❌ jq is not installed. Please install jq for JSON parsing${NC}"
        echo "   On macOS: brew install jq"
        echo "   On Ubuntu: sudo apt-get install jq"
        exit 1
    fi
    echo -e "${GREEN}✅ jq found${NC}"
    
    # Check AWS credentials
    if ! aws sts get-caller-identity &> /dev/null; then
        echo -e "${RED}❌ AWS credentials not configured${NC}"
        exit 1
    fi
    echo -e "${GREEN}✅ AWS credentials configured${NC}"
    
    echo ""
}

# Function to retrieve secret from AWS
retrieve_secret() {
    echo -e "${YELLOW}Retrieving secret from AWS Secrets Manager...${NC}"
    echo "Secret Name: $SECRET_NAME"
    echo "Region: $AWS_REGION"
    echo ""
    
    # Get the secret value
    SECRET_VALUE=$(aws secretsmanager get-secret-value \
        --secret-id "$SECRET_NAME" \
        --region "$AWS_REGION" \
        --query 'SecretString' \
        --output text 2>/dev/null)
    
    if [[ $? -ne 0 ]] || [[ -z "$SECRET_VALUE" ]]; then
        echo -e "${RED}❌ Failed to retrieve secret '$SECRET_NAME'${NC}"
        echo "Please ensure:"
        echo "1. The secret exists in AWS Secrets Manager"
        echo "2. You have the correct permissions to read the secret"
        echo "3. The secret is in the correct region ($AWS_REGION)"
        exit 1
    fi
    
    echo -e "${GREEN}✅ Secret retrieved successfully${NC}"
}

# Function to parse and export HCP credentials
export_hcp_credentials() {
    echo -e "${YELLOW}Parsing HCP credentials...${NC}"
    
    # Parse JSON and extract HCP credentials
    HCP_CLIENT_ID=$(echo "$SECRET_VALUE" | jq -r '.HCP_CLIENT_ID // empty')
    HCP_CLIENT_SECRET=$(echo "$SECRET_VALUE" | jq -r '.HCP_CLIENT_SECRET // empty')
    HCP_PROJECT_ID=$(echo "$SECRET_VALUE" | jq -r '.HCP_PROJECT_ID // empty')
    
    # Check if credentials exist
    if [[ -z "$HCP_CLIENT_ID" ]]; then
        echo -e "${RED}❌ HCP_CLIENT_ID not found in secret${NC}"
        echo "Available keys in secret:"
        echo "$SECRET_VALUE" | jq -r 'keys[]' | sed 's/^/  - /'
        exit 1
    fi
    
    if [[ -z "$HCP_CLIENT_SECRET" ]]; then
        echo -e "${RED}❌ HCP_CLIENT_SECRET not found in secret${NC}"
        echo "Available keys in secret:"
        echo "$SECRET_VALUE" | jq -r 'keys[]' | sed 's/^/  - /'
        exit 1
    fi
    
    echo -e "${GREEN}✅ HCP credentials found${NC}"
    echo "Client ID: ${HCP_CLIENT_ID:0:8}..."
    echo "Client Secret: ${HCP_CLIENT_SECRET:0:8}..."
    if [[ -n "$HCP_PROJECT_ID" ]]; then
        echo "Project ID: $HCP_PROJECT_ID"
    fi
    echo ""
}

# Function to create or update terraform.tfvars
update_terraform_vars() {
    echo -e "${YELLOW}Updating terraform.tfvars with HCP credentials...${NC}"
    
    # Create backup of existing terraform.tfvars
    if [[ -f "terraform.tfvars" ]]; then
        cp terraform.tfvars terraform.tfvars.backup
        echo "Created backup: terraform.tfvars.backup"
    fi
    
    # Update or add HCP variables
    {
        # Copy existing content, excluding any existing HCP credentials
        if [[ -f "terraform.tfvars" ]]; then
            grep -v "^hcp_client_id\|^hcp_client_secret" terraform.tfvars || true
        fi
        
        # Add HCP credentials
        echo ""
        echo "# HCP Service Principal Credentials (from AWS Secrets Manager)"
        echo "hcp_client_id     = \"$HCP_CLIENT_ID\""
        echo "hcp_client_secret = \"$HCP_CLIENT_SECRET\""
    } > terraform.tfvars.tmp
    
    mv terraform.tfvars.tmp terraform.tfvars
    echo -e "${GREEN}✅ Updated terraform.tfvars with HCP credentials${NC}"
    echo ""
}

# Function to set environment variables
set_environment_variables() {
    echo -e "${YELLOW}Setting environment variables for current session...${NC}"
    
    export TF_VAR_hcp_client_id="$HCP_CLIENT_ID"
    export TF_VAR_hcp_client_secret="$HCP_CLIENT_SECRET"
    
    # Create env file for other scripts
    cat > .hcp-env << EOF
# HCP Environment Variables
# Source this file: source .hcp-env
export TF_VAR_hcp_client_id="$HCP_CLIENT_ID"
export TF_VAR_hcp_client_secret="$HCP_CLIENT_SECRET"
export HCP_CLIENT_ID="$HCP_CLIENT_ID"
export HCP_CLIENT_SECRET="$HCP_CLIENT_SECRET"
EOF
    
    echo -e "${GREEN}✅ Environment variables set${NC}"
    echo "Created .hcp-env file for future sessions"
    echo ""
    echo -e "${BLUE}To use in future sessions, run:${NC}"
    echo "source .hcp-env"
}

# Function to show next steps
show_next_steps() {
    echo -e "${GREEN}🎉 HCP credentials configured successfully!${NC}"
    echo ""
    echo -e "${BLUE}What was done:${NC}"
    echo "• Retrieved HCP service principal credentials from AWS Secrets Manager"
    echo "• Updated terraform.tfvars with HCP authentication"
    echo "• Set environment variables for current session"
    echo "• Created .hcp-env file for future sessions"
    echo ""
    echo -e "${BLUE}Next steps:${NC}"
    echo "1. Initialize Terraform with HCP provider:"
    echo "   terraform init"
    echo ""
    echo "2. Create HCP resources (start with just the project):"
    echo "   terraform plan"
    echo "   terraform apply"
    echo ""
    echo "3. View resources in HCP Console:"
    echo "   https://portal.cloud.hashicorp.com"
    echo ""
    echo -e "${BLUE}Optional HCP services (set to true in terraform.tfvars):${NC}"
    echo "• create_hcp_vault = true      # For secrets management"
    echo "• create_hcp_hvn = true        # For private networking"
    echo "• create_hcp_consul = true     # For service mesh"
    echo "• create_hcp_packer_registry = true  # For image management"
    echo ""
}

# Function to handle errors
handle_error() {
    echo -e "${RED}❌ Failed to retrieve HCP credentials${NC}"
    echo -e "${RED}Error occurred at line $1${NC}"
    exit 1
}

# Main execution
main() {
    trap 'handle_error $LINENO' ERR
    
    check_prerequisites
    retrieve_secret
    export_hcp_credentials
    update_terraform_vars
    set_environment_variables
    show_next_steps
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --secret-name|-s)
            SECRET_NAME="$2"
            shift 2
            ;;
        --region|-r)
            AWS_REGION="$2"
            shift 2
            ;;
        --help|-h)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Retrieve HCP service principal credentials from AWS Secrets Manager"
            echo ""
            echo "Options:"
            echo "  -s, --secret-name NAME    Secret name in AWS Secrets Manager (default: tolstoy/env)"
            echo "  -r, --region REGION       AWS region (default: us-east-1)"
            echo "  -h, --help               Show this help message"
            echo ""
            echo "The secret should contain JSON with the following keys:"
            echo "  {\"HCP_CLIENT_ID\": \"...\", \"HCP_CLIENT_SECRET\": \"...\"}"
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            echo "Use --help for usage information."
            exit 1
            ;;
    esac
done

# Run main function
main