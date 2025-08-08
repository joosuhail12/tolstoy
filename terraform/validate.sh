#!/bin/bash

# Terraform Validation Script for Tolstoy API Gateway Infrastructure
# Sprint 5 Task 5.4: Validate Terraform configuration before deployment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
TERRAFORM_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo -e "${BLUE}🔍 Validating Tolstoy API Gateway Infrastructure${NC}"
echo -e "${BLUE}===============================================${NC}"
echo ""

# Function to print section headers
print_section() {
    echo -e "${YELLOW}$1${NC}"
    echo -e "${YELLOW}$(printf '%.0s=' {1..${#1}})${NC}"
}

# Function to check prerequisites
check_prerequisites() {
    print_section "Checking Prerequisites"
    
    local all_good=true
    
    # Check if terraform is installed
    if ! command -v terraform &> /dev/null; then
        echo -e "${RED}❌ Terraform is not installed${NC}"
        echo "   Install from: https://www.terraform.io/downloads"
        all_good=false
    else
        echo -e "${GREEN}✅ Terraform found: $(terraform version | head -n1)${NC}"
    fi
    
    # Check if AWS CLI is installed
    if ! command -v aws &> /dev/null; then
        echo -e "${RED}❌ AWS CLI is not installed${NC}"
        echo "   Install from: https://aws.amazon.com/cli/"
        all_good=false
    else
        echo -e "${GREEN}✅ AWS CLI found: $(aws --version)${NC}"
    fi
    
    # Check AWS credentials
    if command -v aws &> /dev/null && ! aws sts get-caller-identity &> /dev/null; then
        echo -e "${RED}❌ AWS credentials not configured${NC}"
        echo "   Run: aws configure"
        all_good=false
    elif command -v aws &> /dev/null; then
        echo -e "${GREEN}✅ AWS credentials configured${NC}"
    fi
    
    # Check if terraform.tfvars exists
    if [[ ! -f "${TERRAFORM_DIR}/terraform.tfvars" ]]; then
        echo -e "${YELLOW}⚠️  terraform.tfvars not found${NC}"
        echo "   Copy terraform.tfvars.example to terraform.tfvars and configure"
    else
        echo -e "${GREEN}✅ terraform.tfvars found${NC}"
    fi
    
    if [[ "$all_good" != true ]]; then
        echo ""
        echo -e "${RED}❌ Prerequisites not met. Please install missing tools.${NC}"
        exit 1
    fi
    
    echo ""
}

# Function to validate file syntax
validate_syntax() {
    print_section "Validating File Syntax"
    
    cd "${TERRAFORM_DIR}"
    
    # Check HCL syntax
    echo "Checking HCL syntax..."
    local tf_files=(*.tf)
    local syntax_errors=false
    
    for file in "${tf_files[@]}"; do
        if [[ -f "$file" ]]; then
            echo "  Checking $file..."
            if ! terraform fmt -check=true "$file" &> /dev/null; then
                echo -e "${YELLOW}    ⚠️  $file needs formatting${NC}"
            else
                echo -e "${GREEN}    ✅ $file syntax OK${NC}"
            fi
        fi
    done
    
    echo ""
}

# Function to initialize Terraform
init_terraform() {
    print_section "Initializing Terraform"
    
    cd "${TERRAFORM_DIR}"
    
    echo "Initializing Terraform..."
    if terraform init -backend=false; then
        echo -e "${GREEN}✅ Terraform initialization successful${NC}"
    else
        echo -e "${RED}❌ Terraform initialization failed${NC}"
        exit 1
    fi
    
    echo ""
}

# Function to validate Terraform configuration
validate_terraform() {
    print_section "Validating Terraform Configuration"
    
    cd "${TERRAFORM_DIR}"
    
    echo "Validating Terraform configuration..."
    if terraform validate; then
        echo -e "${GREEN}✅ Terraform configuration is valid${NC}"
    else
        echo -e "${RED}❌ Terraform configuration validation failed${NC}"
        exit 1
    fi
    
    echo ""
}

# Function to format Terraform files
format_terraform() {
    print_section "Formatting Terraform Files"
    
    cd "${TERRAFORM_DIR}"
    
    echo "Formatting Terraform files..."
    if terraform fmt -recursive; then
        echo -e "${GREEN}✅ Terraform files formatted${NC}"
    else
        echo -e "${YELLOW}⚠️  Some files could not be formatted${NC}"
    fi
    
    echo ""
}

# Function to check variable definitions
check_variables() {
    print_section "Checking Variable Definitions"
    
    cd "${TERRAFORM_DIR}"
    
    echo "Checking required variables..."
    
    # List of required variables
    local required_vars=(
        "ec2_instance_id"
        "aws_region"
        "project_name"
        "environment"
    )
    
    local missing_vars=()
    
    for var in "${required_vars[@]}"; do
        if ! grep -q "variable \"$var\"" variables.tf 2>/dev/null; then
            missing_vars+=("$var")
        fi
    done
    
    if [[ ${#missing_vars[@]} -eq 0 ]]; then
        echo -e "${GREEN}✅ All required variables defined${NC}"
    else
        echo -e "${RED}❌ Missing variable definitions:${NC}"
        for var in "${missing_vars[@]}"; do
            echo "   - $var"
        done
        exit 1
    fi
    
    # Check terraform.tfvars for required values
    if [[ -f "terraform.tfvars" ]]; then
        echo ""
        echo "Checking terraform.tfvars values..."
        
        # Check for placeholder values
        if grep -q "your-" terraform.tfvars; then
            echo -e "${YELLOW}⚠️  Found placeholder values in terraform.tfvars:${NC}"
            grep -n "your-" terraform.tfvars || true
        else
            echo -e "${GREEN}✅ No placeholder values found${NC}"
        fi
        
        # Check for required EC2 instance ID format
        if grep -q "ec2_instance_id.*i-[0-9a-f]" terraform.tfvars; then
            echo -e "${GREEN}✅ Valid EC2 instance ID format${NC}"
        else
            echo -e "${YELLOW}⚠️  Please verify EC2 instance ID format${NC}"
        fi
    fi
    
    echo ""
}

# Function to check AWS permissions
check_aws_permissions() {
    print_section "Checking AWS Permissions"
    
    if ! command -v aws &> /dev/null; then
        echo -e "${YELLOW}⚠️  AWS CLI not available, skipping permission check${NC}"
        return 0
    fi
    
    echo "Checking AWS permissions for required services..."
    
    # Test basic AWS access
    if aws sts get-caller-identity &> /dev/null; then
        local account_id=$(aws sts get-caller-identity --query Account --output text)
        local user_arn=$(aws sts get-caller-identity --query Arn --output text)
        echo -e "${GREEN}✅ AWS access confirmed${NC}"
        echo "   Account ID: $account_id"
        echo "   User/Role: $user_arn"
    else
        echo -e "${RED}❌ Cannot access AWS${NC}"
        return 1
    fi
    
    # Check specific permissions (non-blocking)
    local services=(
        "apigateway:GET"
        "wafv2:ListWebACLs"
        "acm:ListCertificates"
        "route53:ListHostedZones"
        "ec2:DescribeInstances"
        "logs:DescribeLogGroups"
    )
    
    echo ""
    echo "Testing key service permissions..."
    for service_action in "${services[@]}"; do
        local service=$(echo "$service_action" | cut -d: -f1)
        echo -n "  $service: "
        
        case $service in
            "apigateway")
                if aws apigateway get-rest-apis --limit 1 &> /dev/null; then
                    echo -e "${GREEN}✅${NC}"
                else
                    echo -e "${RED}❌${NC}"
                fi
                ;;
            "ec2")
                if aws ec2 describe-instances --max-items 1 &> /dev/null; then
                    echo -e "${GREEN}✅${NC}"
                else
                    echo -e "${RED}❌${NC}"
                fi
                ;;
            "wafv2")
                if aws wafv2 list-web-acls --scope REGIONAL &> /dev/null; then
                    echo -e "${GREEN}✅${NC}"
                else
                    echo -e "${RED}❌${NC}"
                fi
                ;;
            "acm")
                if aws acm list-certificates &> /dev/null; then
                    echo -e "${GREEN}✅${NC}"
                else
                    echo -e "${RED}❌${NC}"
                fi
                ;;
            "route53")
                if aws route53 list-hosted-zones &> /dev/null; then
                    echo -e "${GREEN}✅${NC}"
                else
                    echo -e "${RED}❌${NC}"
                fi
                ;;
            "logs")
                if aws logs describe-log-groups --limit 1 &> /dev/null; then
                    echo -e "${GREEN}✅${NC}"
                else
                    echo -e "${RED}❌${NC}"
                fi
                ;;
            *)
                echo -e "${YELLOW}?${NC}"
                ;;
        esac
    done
    
    echo ""
}

# Function to check existing EC2 instance
check_ec2_instance() {
    print_section "Checking Existing EC2 Instance"
    
    if ! command -v aws &> /dev/null; then
        echo -e "${YELLOW}⚠️  AWS CLI not available, skipping EC2 check${NC}"
        return 0
    fi
    
    local instance_id=$(grep -o 'ec2_instance_id.*=.*"i-[^"]*"' terraform.tfvars 2>/dev/null | cut -d'"' -f2)
    
    if [[ -z "$instance_id" ]]; then
        echo -e "${YELLOW}⚠️  No EC2 instance ID found in terraform.tfvars${NC}"
        return 0
    fi
    
    echo "Checking EC2 instance: $instance_id"
    
    # Check if instance exists and get details
    if aws ec2 describe-instances --instance-ids "$instance_id" &> /dev/null; then
        echo -e "${GREEN}✅ EC2 instance exists${NC}"
        
        local instance_state=$(aws ec2 describe-instances --instance-ids "$instance_id" --query 'Reservations[0].Instances[0].State.Name' --output text)
        local public_ip=$(aws ec2 describe-instances --instance-ids "$instance_id" --query 'Reservations[0].Instances[0].PublicIpAddress' --output text)
        local private_ip=$(aws ec2 describe-instances --instance-ids "$instance_id" --query 'Reservations[0].Instances[0].PrivateIpAddress' --output text)
        
        echo "   State: $instance_state"
        echo "   Public IP: $public_ip"
        echo "   Private IP: $private_ip"
        
        if [[ "$instance_state" == "running" ]]; then
            echo -e "${GREEN}   ✅ Instance is running${NC}"
            
            # Test connectivity
            echo -n "   Testing HTTP connectivity: "
            if curl -s -f -m 10 "http://$public_ip/status" &> /dev/null; then
                echo -e "${GREEN}✅${NC}"
            else
                echo -e "${YELLOW}⚠️ (may be expected if security groups restrict access)${NC}"
            fi
        else
            echo -e "${YELLOW}   ⚠️ Instance is not running${NC}"
        fi
    else
        echo -e "${RED}❌ EC2 instance not found or not accessible${NC}"
    fi
    
    echo ""
}

# Function to run security validation
validate_security() {
    print_section "Security Configuration Validation"
    
    echo "Checking security configuration..."
    
    # Check for hardcoded secrets
    echo "Scanning for potential secrets..."
    local secret_patterns=(
        "password.*=.*['\"][^'\"]{8,}"
        "secret.*=.*['\"][^'\"]{16,}"
        "key.*=.*['\"][A-Za-z0-9+/]{20,}"
        "token.*=.*['\"][A-Za-z0-9]{20,}"
        "AKIA[0-9A-Z]{16}"  # AWS Access Key
    )
    
    local secrets_found=false
    for pattern in "${secret_patterns[@]}"; do
        if grep -r -E "$pattern" *.tf *.tfvars 2>/dev/null; then
            secrets_found=true
        fi
    done
    
    if [[ "$secrets_found" == true ]]; then
        echo -e "${RED}❌ Potential secrets found in configuration files${NC}"
        echo -e "${RED}   Please use AWS Secrets Manager or environment variables${NC}"
    else
        echo -e "${GREEN}✅ No hardcoded secrets detected${NC}"
    fi
    
    # Check security best practices
    echo ""
    echo "Checking security best practices..."
    
    # Check if WAF is enabled
    if grep -q "aws_wafv2_web_acl" main.tf; then
        echo -e "${GREEN}✅ WAF protection configured${NC}"
    else
        echo -e "${YELLOW}⚠️  No WAF protection found${NC}"
    fi
    
    # Check if HTTPS/TLS is configured
    if grep -q "aws_acm_certificate" main.tf; then
        echo -e "${GREEN}✅ TLS certificate configuration found${NC}"
    else
        echo -e "${YELLOW}⚠️  No TLS certificate configuration${NC}"
    fi
    
    # Check if logging is enabled
    if grep -q "aws_cloudwatch_log_group" main.tf; then
        echo -e "${GREEN}✅ CloudWatch logging configured${NC}"
    else
        echo -e "${YELLOW}⚠️  No CloudWatch logging found${NC}"
    fi
    
    echo ""
}

# Function to generate validation report
generate_report() {
    print_section "Validation Report"
    
    echo -e "${GREEN}🎉 Terraform configuration validation completed${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Review any warnings or issues above"
    echo "2. Run './deploy.sh' to deploy the infrastructure"
    echo "3. Run './test-api.sh' after deployment to test functionality"
    echo ""
    echo "For deployment:"
    echo "   ./deploy.sh"
    echo ""
    echo "For testing:"
    echo "   ./test-api.sh"
    echo ""
    echo "For destruction (if needed):"
    echo "   ./destroy.sh"
}

# Function to handle errors
handle_error() {
    echo -e "${RED}❌ Validation failed with error code $1${NC}"
    echo -e "${RED}Please fix the issues above before deploying.${NC}"
    exit $1
}

# Main validation flow
main() {
    trap 'handle_error $?' ERR
    
    check_prerequisites
    validate_syntax
    init_terraform
    validate_terraform
    format_terraform
    check_variables
    check_aws_permissions
    check_ec2_instance
    validate_security
    generate_report
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --help|-h)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Validate Tolstoy API Gateway Terraform configuration"
            echo ""
            echo "Options:"
            echo "  -h, --help              Show this help message"
            echo ""
            echo "This script validates:"
            echo "• Prerequisites (Terraform, AWS CLI)"
            echo "• Terraform syntax and configuration"
            echo "• AWS permissions and access"
            echo "• Existing EC2 instance"
            echo "• Security best practices"
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            echo "Use --help for usage information."
            exit 1
            ;;
    esac
done

# Run main validation
main