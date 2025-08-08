#!/bin/bash

# Terraform Destroy Script for Tolstoy API Gateway Infrastructure
# Sprint 5 Task 5.4: Safe teardown of API Gateway infrastructure

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

echo -e "${RED}🗑️  Destroying Tolstoy API Gateway Infrastructure${NC}"
echo -e "${RED}================================================${NC}"
echo -e "${YELLOW}⚠️  WARNING: This will destroy all API Gateway infrastructure!${NC}"
echo -e "${YELLOW}⚠️  Your EC2 instance and application will NOT be affected.${NC}"
echo ""

# Function to print section headers
print_section() {
    echo -e "${YELLOW}$1${NC}"
    echo -e "${YELLOW}$(printf '%.0s=' {1..${#1}})${NC}"
}

# Function to show what will be destroyed
show_destroy_plan() {
    print_section "Resources to be Destroyed"
    
    cd "${TERRAFORM_DIR}"
    
    # Check if Terraform state exists
    if [[ ! -f "terraform.tfstate" ]] && [[ ! -f ".terraform/terraform.tfstate" ]]; then
        echo -e "${YELLOW}⚠️  No Terraform state found. Nothing to destroy.${NC}"
        exit 0
    fi
    
    echo "The following resources will be DESTROYED:"
    echo ""
    echo "• API Gateway REST API and all endpoints"
    echo "• WAF Web ACL and all security rules"
    echo "• ACM Certificate (if created by Terraform)"
    echo "• Custom Domain Name configuration"
    echo "• Route53 DNS records (if managed by Terraform)"
    echo "• CloudWatch Log Groups and all logs"
    echo "• Usage Plans and API Keys"
    echo "• All associated CloudWatch metrics and alarms"
    echo ""
    
    # Show current outputs
    echo -e "${BLUE}Current Infrastructure:${NC}"
    terraform output 2>/dev/null | head -20 || echo "No outputs available"
    echo ""
    
    echo -e "${RED}⚠️  IMPORTANT NOTES:${NC}"
    echo "• Your EC2 instance will NOT be destroyed"
    echo "• Your application will continue running on EC2"
    echo "• All API Gateway logs will be permanently deleted"
    echo "• Custom domain DNS changes may take time to propagate"
    echo "• WAF metrics and logs will be lost"
    echo ""
}

# Function to confirm destruction
confirm_destruction() {
    print_section "Confirmation Required"
    
    echo -e "${RED}This action is IRREVERSIBLE!${NC}"
    echo ""
    echo "Type 'destroy' to confirm destruction of all API Gateway infrastructure:"
    read -r confirmation
    
    if [[ "$confirmation" != "destroy" ]]; then
        echo -e "${GREEN}✅ Destruction cancelled. Infrastructure preserved.${NC}"
        exit 0
    fi
    
    echo ""
    echo -e "${YELLOW}Final confirmation: Type 'yes' to proceed with destruction:${NC}"
    read -r final_confirmation
    
    if [[ "$final_confirmation" != "yes" ]]; then
        echo -e "${GREEN}✅ Destruction cancelled. Infrastructure preserved.${NC}"
        exit 0
    fi
    
    echo ""
}

# Function to create backup of current state
backup_state() {
    print_section "Creating State Backup"
    
    cd "${TERRAFORM_DIR}"
    
    local backup_dir="backups"
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_file="terraform-state-backup-${timestamp}.tar.gz"
    
    mkdir -p "$backup_dir"
    
    echo "Creating backup of Terraform state and outputs..."
    
    # Export current outputs
    terraform output -json > "${backup_dir}/outputs-${timestamp}.json" 2>/dev/null || echo "{}" > "${backup_dir}/outputs-${timestamp}.json"
    
    # Backup state files
    if [[ -f "terraform.tfstate" ]]; then
        cp "terraform.tfstate" "${backup_dir}/terraform.tfstate.${timestamp}"
    fi
    
    if [[ -f "terraform.tfstate.backup" ]]; then
        cp "terraform.tfstate.backup" "${backup_dir}/terraform.tfstate.backup.${timestamp}"
    fi
    
    # Create compressed backup
    tar -czf "${backup_dir}/${backup_file}" -C "${backup_dir}" \
        "outputs-${timestamp}.json" \
        "terraform.tfstate.${timestamp}" \
        "terraform.tfstate.backup.${timestamp}" 2>/dev/null || true
    
    echo -e "${GREEN}✅ State backup created: ${backup_dir}/${backup_file}${NC}"
    echo ""
}

# Function to plan destruction
plan_destruction() {
    print_section "Planning Destruction"
    
    cd "${TERRAFORM_DIR}"
    
    echo "Creating Terraform destruction plan..."
    terraform plan -destroy -out=destroy.tfplan -var="environment=${ENVIRONMENT}"
    
    echo ""
    echo -e "${YELLOW}📋 Destruction Plan Summary:${NC}"
    echo "The plan above shows all resources that will be destroyed."
    echo ""
    echo -e "${YELLOW}Press Enter to continue with destruction, or Ctrl+C to cancel...${NC}"
    read
    echo ""
}

# Function to execute destruction
execute_destruction() {
    print_section "Executing Destruction"
    
    cd "${TERRAFORM_DIR}"
    
    echo -e "${RED}🔥 Destroying infrastructure...${NC}"
    echo "This may take several minutes..."
    echo ""
    
    # Apply the destruction plan
    terraform apply destroy.tfplan
    
    # Clean up plan file
    if [[ -f "destroy.tfplan" ]]; then
        rm destroy.tfplan
    fi
    
    echo ""
    echo -e "${GREEN}✅ Infrastructure destruction completed${NC}"
}

# Function to verify destruction
verify_destruction() {
    print_section "Verifying Destruction"
    
    cd "${TERRAFORM_DIR}"
    
    echo "Verifying that resources have been destroyed..."
    
    # Check if any resources remain
    local remaining_resources=$(terraform state list 2>/dev/null | wc -l)
    
    if [[ "$remaining_resources" -eq 0 ]]; then
        echo -e "${GREEN}✅ All resources successfully destroyed${NC}"
    else
        echo -e "${YELLOW}⚠️  Some resources may still exist:${NC}"
        terraform state list
        echo ""
        echo "You may need to manually clean up these resources."
    fi
    
    # Test if API is still accessible (should fail)
    if command -v curl &> /dev/null; then
        echo ""
        echo "Testing API accessibility (should fail)..."
        local api_url=$(grep -o 'https://[^"]*' backups/outputs-*.json 2>/dev/null | head -1 | cut -d'"' -f1 || echo "")
        
        if [[ -n "$api_url" ]]; then
            if curl -s -f -m 5 "$api_url/status" &> /dev/null; then
                echo -e "${YELLOW}⚠️  API still accessible at $api_url${NC}"
                echo "DNS propagation may take time for custom domains."
            else
                echo -e "${GREEN}✅ API Gateway is no longer accessible${NC}"
            fi
        fi
    fi
    
    echo ""
}

# Function to show post-destruction info
show_post_destruction_info() {
    print_section "Post-Destruction Information"
    
    echo -e "${GREEN}🎉 Tolstoy API Gateway infrastructure has been successfully destroyed${NC}"
    echo ""
    echo -e "${BLUE}What was removed:${NC}"
    echo "• API Gateway REST API and all endpoints"
    echo "• WAF Web ACL and security rules"
    echo "• ACM Certificate and TLS configuration"
    echo "• Custom domain and Route53 records"
    echo "• CloudWatch logs and metrics"
    echo "• Usage plans and API keys"
    echo ""
    echo -e "${GREEN}What remains:${NC}"
    echo "• Your EC2 instance and application (unchanged)"
    echo "• Application data and database"
    echo "• EC2 security groups and networking"
    echo "• Any manually created AWS resources"
    echo ""
    echo -e "${BLUE}Next steps:${NC}"
    echo "• Your application is still accessible directly via EC2 public IP"
    echo "• You can redeploy the API Gateway anytime with ./deploy.sh"
    echo "• State backups are available in the backups/ directory"
    echo "• Consider cleaning up any unused CloudWatch log groups manually"
    echo ""
    echo -e "${BLUE}Direct EC2 Access:${NC}"
    echo "Your application is still running at:"
    if [[ -f "backups/outputs-"*".json" ]]; then
        local backend_ip=$(grep -o '"backend_public_ip":\s*"[^"]*"' backups/outputs-*.json 2>/dev/null | head -1 | cut -d'"' -f4)
        if [[ -n "$backend_ip" ]]; then
            echo "http://$backend_ip"
        fi
    fi
    echo ""
}

# Function to handle errors
handle_error() {
    echo -e "${RED}❌ Destruction failed with error code $1${NC}"
    echo -e "${RED}Some resources may not have been destroyed.${NC}"
    echo ""
    echo -e "${YELLOW}To troubleshoot:${NC}"
    echo "1. Check the error messages above"
    echo "2. Run 'terraform state list' to see remaining resources"
    echo "3. Try destroying individual resources manually"
    echo "4. Check AWS Console for any remaining resources"
    echo ""
    exit $1
}

# Main destruction flow
main() {
    trap 'handle_error $?' ERR
    
    # Check prerequisites
    if ! command -v terraform &> /dev/null; then
        echo -e "${RED}❌ Terraform is not installed${NC}"
        exit 1
    fi
    
    if ! command -v aws &> /dev/null; then
        echo -e "${RED}❌ AWS CLI is not installed${NC}"
        exit 1
    fi
    
    show_destroy_plan
    confirm_destruction
    backup_state
    plan_destruction
    execute_destruction
    verify_destruction
    show_post_destruction_info
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --environment|-e)
            ENVIRONMENT="$2"
            shift 2
            ;;
        --force)
            # Skip confirmations for automated destruction
            FORCE_DESTROY=true
            shift
            ;;
        --help|-h)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Safely destroy Tolstoy API Gateway infrastructure"
            echo ""
            echo "Options:"
            echo "  -e, --environment ENV    Set environment (default: prod)"
            echo "      --force             Skip confirmation prompts (dangerous!)"
            echo "  -h, --help              Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0                      # Destroy prod environment (with confirmations)"
            echo "  $0 -e dev               # Destroy dev environment"
            echo "  $0 --force              # Destroy without prompts (use with caution)"
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            echo "Use --help for usage information."
            exit 1
            ;;
    esac
done

# Override confirmation function for force mode
if [[ "$FORCE_DESTROY" == "true" ]]; then
    confirm_destruction() {
        print_section "Force Mode - Skipping Confirmations"
        echo -e "${RED}⚠️  Force mode enabled - destroying without confirmation!${NC}"
        echo ""
    }
fi

# Run main destruction flow
main