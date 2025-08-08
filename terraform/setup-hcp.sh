#!/bin/bash

# HCP Terraform Cloud Setup Script for Tolstoy API Gateway
# This script helps set up HCP Terraform Cloud integration

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
TERRAFORM_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEFAULT_ORG="tolstoy-org"
DEFAULT_WORKSPACE="tolstoy-api-gateway-prod"

echo -e "${BLUE}🚀 Setting up HCP Terraform Cloud for Tolstoy API Gateway${NC}"
echo -e "${BLUE}=======================================================${NC}"
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
    
    # Check if hcp CLI is installed
    if ! command -v hcp &> /dev/null; then
        echo -e "${RED}❌ HCP CLI is not installed. Please install HCP CLI first.${NC}"
        echo "   Visit: https://developer.hashicorp.com/hcp/docs/cli/install"
        exit 1
    fi
    echo -e "${GREEN}✅ HCP CLI found: $(hcp version | head -n1)${NC}"
    
    # Check HCP authentication
    if ! hcp auth whoami &> /dev/null; then
        echo -e "${RED}❌ Not logged in to HCP. Please run 'hcp auth login' first.${NC}"
        exit 1
    fi
    echo -e "${GREEN}✅ HCP authentication confirmed${NC}"
    
    echo ""
}

# Function to gather configuration
gather_configuration() {
    print_section "Configuration Setup"
    
    echo "Let's configure your HCP Terraform Cloud integration:"
    echo ""
    
    # Get organization name
    echo -n "Enter your HCP organization name [$DEFAULT_ORG]: "
    read HCP_ORG
    HCP_ORG=${HCP_ORG:-$DEFAULT_ORG}
    
    # Get workspace name
    echo -n "Enter workspace name [$DEFAULT_WORKSPACE]: "
    read HCP_WORKSPACE
    HCP_WORKSPACE=${HCP_WORKSPACE:-$DEFAULT_WORKSPACE}
    
    # Get GitHub repository (optional)
    echo -n "Enter GitHub repository (format: owner/repo) [joosuhail12/tolstoy]: "
    read GITHUB_REPO
    GITHUB_REPO=${GITHUB_REPO:-"joosuhail12/tolstoy"}
    
    echo ""
    echo -e "${GREEN}Configuration Summary:${NC}"
    echo "• HCP Organization: $HCP_ORG"
    echo "• Workspace: $HCP_WORKSPACE"
    echo "• GitHub Repository: $GITHUB_REPO"
    echo ""
}

# Function to update terraform configuration
update_terraform_config() {
    print_section "Updating Terraform Configuration"
    
    cd "$TERRAFORM_DIR"
    
    echo "Updating terraform.tfvars with HCP configuration..."
    
    # Update terraform.tfvars
    if [[ -f "terraform.tfvars" ]]; then
        # Update existing values
        sed -i.backup "s/hcp_organization.*/hcp_organization     = \"$HCP_ORG\"/" terraform.tfvars
        sed -i.backup "s/hcp_workspace_name.*/hcp_workspace_name   = \"$HCP_WORKSPACE\"/" terraform.tfvars
        rm -f terraform.tfvars.backup
        echo -e "${GREEN}✅ Updated terraform.tfvars${NC}"
    else
        echo -e "${YELLOW}⚠️ terraform.tfvars not found. Please copy from terraform.tfvars.example${NC}"
    fi
    
    echo ""
}

# Function to login to Terraform Cloud
login_terraform_cloud() {
    print_section "Terraform Cloud Login"
    
    echo "Logging in to Terraform Cloud..."
    echo "This will open a browser to generate an API token."
    echo ""
    
    # Login to Terraform Cloud
    if terraform login; then
        echo -e "${GREEN}✅ Successfully logged in to Terraform Cloud${NC}"
    else
        echo -e "${RED}❌ Failed to login to Terraform Cloud${NC}"
        exit 1
    fi
    
    echo ""
}

# Function to initialize terraform with HCP backend
initialize_terraform() {
    print_section "Initializing Terraform with HCP Backend"
    
    cd "$TERRAFORM_DIR"
    
    echo "Initializing Terraform with HCP Terraform Cloud backend..."
    
    # Remove any existing .terraform directory
    if [[ -d ".terraform" ]]; then
        echo "Removing existing .terraform directory..."
        rm -rf .terraform
    fi
    
    # Initialize with HCP backend
    if terraform init; then
        echo -e "${GREEN}✅ Terraform initialized with HCP backend${NC}"
    else
        echo -e "${RED}❌ Failed to initialize Terraform with HCP backend${NC}"
        echo ""
        echo -e "${YELLOW}Troubleshooting tips:${NC}"
        echo "1. Make sure your HCP organization exists"
        echo "2. Verify workspace permissions"
        echo "3. Check that terraform.tfvars has correct HCP configuration"
        exit 1
    fi
    
    echo ""
}

# Function to create workspace configuration guide
create_workspace_guide() {
    print_section "HCP Workspace Configuration Guide"
    
    cat << EOF > hcp-workspace-setup.md
# HCP Terraform Cloud Workspace Setup Guide

## Workspace Configuration

Your workspace \`$HCP_WORKSPACE\` in organization \`$HCP_ORG\` needs the following configuration:

### 1. General Settings
- **Execution Mode**: Remote
- **Working Directory**: \`terraform/\`
- **Terraform Version**: Latest or >= 1.0

### 2. Environment Variables (Required)
Add these sensitive environment variables in the HCP workspace:

\`\`\`
AWS_ACCESS_KEY_ID         = <your-aws-access-key>        [Sensitive]
AWS_SECRET_ACCESS_KEY     = <your-aws-secret-key>        [Sensitive]
AWS_DEFAULT_REGION        = us-east-1
\`\`\`

### 3. Terraform Variables (Optional)
These can be set in the workspace or use defaults from terraform.tfvars:

\`\`\`
project_name              = "tolstoy"
environment               = "prod"
ec2_instance_id          = "i-0ea0ff0e9a8db29d4"
enable_caching           = true
cache_cluster_size       = "0.5"
throttle_rate_limit      = 200
throttle_burst_limit     = 400
waf_rate_limit           = 5000
\`\`\`

### 4. VCS Integration (Recommended)
- **Repository**: $GITHUB_REPO
- **Branch**: main
- **Working Directory**: terraform/
- **Automatic Triggering**: Enabled
- **Path Filtering**: terraform/**

### 5. Run Configuration
- **Auto Apply**: Consider enabling for production after testing
- **Speculative Plans**: Enable for PR reviews
- **Run Triggers**: Configure for dependent workspaces if needed

### 6. Notifications
Configure notifications for:
- Successful applies
- Failed runs
- Run confirmations needed

### 7. Access Control
Grant appropriate permissions to team members:
- **Admin**: Full workspace control
- **Plan**: Can create and view plans
- **Read**: View-only access

## Next Steps

1. Visit [HCP Terraform Cloud](https://app.terraform.io)
2. Navigate to your workspace: $HCP_ORG/$HCP_WORKSPACE
3. Configure the environment variables listed above
4. Set up VCS integration with your GitHub repository
5. Run a plan to verify configuration
6. Apply to deploy your infrastructure

## Testing the Setup

After workspace configuration:

\`\`\`bash
# Initialize and validate
terraform init
terraform validate

# Create a plan
terraform plan

# Apply (will run in HCP Terraform Cloud)
terraform apply
\`\`\`

## Monitoring

Your workspace will be available at:
https://app.terraform.io/app/$HCP_ORG/workspaces/$HCP_WORKSPACE
EOF

    echo -e "${GREEN}✅ Created workspace setup guide: hcp-workspace-setup.md${NC}"
    echo ""
    echo -e "${BLUE}📖 Please review the setup guide for detailed workspace configuration steps.${NC}"
    echo ""
}

# Function to show next steps
show_next_steps() {
    print_section "Next Steps"
    
    echo -e "${GREEN}🎉 HCP Terraform Cloud integration setup completed!${NC}"
    echo ""
    echo -e "${BLUE}What was configured:${NC}"
    echo "• Updated Terraform configuration for HCP backend"
    echo "• Configured terraform.tfvars with your HCP settings"
    echo "• Logged in to Terraform Cloud"
    echo "• Initialized Terraform with HCP backend"
    echo "• Created workspace setup guide"
    echo ""
    echo -e "${YELLOW}Manual steps required in HCP Terraform Cloud:${NC}"
    echo "1. Visit https://app.terraform.io/app/$HCP_ORG/workspaces/$HCP_WORKSPACE"
    echo "2. Add AWS credentials as environment variables (see hcp-workspace-setup.md)"
    echo "3. Configure VCS integration with GitHub repository"
    echo "4. Review and apply your first plan"
    echo ""
    echo -e "${BLUE}Ready to deploy:${NC}"
    echo "• Run 'terraform plan' to create a plan in HCP"
    echo "• Run 'terraform apply' to deploy via HCP"
    echo "• Use './test-api.sh' after deployment to validate"
    echo ""
    echo -e "${BLUE}Monitoring:${NC}"
    echo "• HCP Workspace: https://app.terraform.io/app/$HCP_ORG/workspaces/$HCP_WORKSPACE"
    echo "• Run History: Available in the workspace UI"
    echo "• State Management: Handled automatically by HCP"
    echo ""
}

# Function to handle errors
handle_error() {
    echo -e "${RED}❌ HCP setup failed with error code $1${NC}"
    echo -e "${RED}Please check the error messages above and resolve any issues.${NC}"
    exit $1
}

# Main setup flow
main() {
    trap 'handle_error $?' ERR
    
    check_prerequisites
    gather_configuration
    update_terraform_config
    login_terraform_cloud
    initialize_terraform
    create_workspace_guide
    show_next_steps
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --help|-h)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Set up HCP Terraform Cloud integration for Tolstoy API Gateway"
            echo ""
            echo "Prerequisites:"
            echo "• Terraform CLI installed"
            echo "• HCP CLI installed and logged in (hcp auth login)"
            echo "• HCP organization and workspace access"
            echo ""
            echo "This script will:"
            echo "• Configure Terraform backend for HCP"
            echo "• Login to Terraform Cloud"
            echo "• Initialize Terraform with remote state"
            echo "• Create workspace setup guide"
            echo ""
            echo "Options:"
            echo "  -h, --help              Show this help message"
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            echo "Use --help for usage information."
            exit 1
            ;;
    esac
done

# Run main setup
main