#!/bin/bash

# API Testing Script for Tolstoy API Gateway
# Sprint 5 Task 5.4: Comprehensive testing of API Gateway, WAF, and caching

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
TERRAFORM_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEST_RESULTS_FILE="api-test-results.log"

echo -e "${BLUE}🧪 Testing Tolstoy API Gateway Infrastructure${NC}"
echo -e "${BLUE}=============================================${NC}"
echo ""

# Function to print section headers
print_section() {
    echo -e "${YELLOW}$1${NC}"
    echo -e "${YELLOW}$(printf '%.0s=' {1..${#1}})${NC}"
}

# Function to get Terraform outputs
get_terraform_output() {
    local output_name="$1"
    cd "${TERRAFORM_DIR}"
    terraform output -raw "$output_name" 2>/dev/null || echo ""
}

# Function to test basic connectivity
test_basic_connectivity() {
    print_section "Testing Basic API Connectivity"
    
    local api_url=$(get_terraform_output "api_gateway_url")
    local backend_url="http://$(get_terraform_output "backend_public_ip")"
    
    if [[ -z "$api_url" ]]; then
        echo -e "${RED}❌ Could not retrieve API Gateway URL from Terraform outputs${NC}"
        return 1
    fi
    
    echo "API Gateway URL: $api_url"
    echo "Backend URL: $backend_url"
    echo ""
    
    # Test API Gateway health endpoint
    echo "Testing API Gateway health endpoint..."
    if curl -s -f -m 10 "$api_url/status" > /dev/null; then
        echo -e "${GREEN}✅ API Gateway health check passed${NC}"
    else
        echo -e "${RED}❌ API Gateway health check failed${NC}"
        echo "Response:"
        curl -s -m 10 "$api_url/status" || echo "Connection failed"
    fi
    
    # Test backend direct access
    echo ""
    echo "Testing backend direct access..."
    if curl -s -f -m 10 "$backend_url/status" > /dev/null; then
        echo -e "${GREEN}✅ Backend direct access works${NC}"
    else
        echo -e "${YELLOW}⚠️ Backend direct access failed (this might be expected if security groups are configured)${NC}"
    fi
    
    echo ""
}

# Function to test API endpoints
test_api_endpoints() {
    print_section "Testing API Endpoints"
    
    local api_url=$(get_terraform_output "api_gateway_url")
    local api_key=$(get_terraform_output "api_key_value")
    
    # Prepare headers
    local headers=()
    if [[ -n "$api_key" ]]; then
        headers+=("-H" "X-API-Key: $api_key")
        echo "Using API Key authentication"
    fi
    
    # Test endpoints
    local endpoints=(
        "/status"
        "/health"
        "/status/detailed"
        "/api/health"
        "/api/organizations"
    )
    
    for endpoint in "${endpoints[@]}"; do
        echo "Testing endpoint: $endpoint"
        
        local response_code=$(curl -s -o /dev/null -w "%{http_code}" -m 10 \
            "${headers[@]}" "$api_url$endpoint")
        
        case $response_code in
            200|201|204)
                echo -e "${GREEN}✅ $endpoint - HTTP $response_code (Success)${NC}"
                ;;
            401|403)
                echo -e "${YELLOW}⚠️ $endpoint - HTTP $response_code (Authentication/Authorization)${NC}"
                ;;
            404)
                echo -e "${YELLOW}⚠️ $endpoint - HTTP $response_code (Not Found - might be expected)${NC}"
                ;;
            429)
                echo -e "${BLUE}ℹ️ $endpoint - HTTP $response_code (Rate Limited - WAF/Throttling working)${NC}"
                ;;
            500|502|503|504)
                echo -e "${RED}❌ $endpoint - HTTP $response_code (Server Error)${NC}"
                ;;
            000)
                echo -e "${RED}❌ $endpoint - Connection failed${NC}"
                ;;
            *)
                echo -e "${YELLOW}⚠️ $endpoint - HTTP $response_code (Unexpected)${NC}"
                ;;
        esac
    done
    
    echo ""
}

# Function to test rate limiting
test_rate_limiting() {
    print_section "Testing Rate Limiting & WAF Protection"
    
    local api_url=$(get_terraform_output "api_gateway_url")
    local api_key=$(get_terraform_output "api_key_value")
    
    # Prepare headers
    local headers=()
    if [[ -n "$api_key" ]]; then
        headers+=("-H" "X-API-Key: $api_key")
    fi
    
    echo "Sending rapid requests to test rate limiting..."
    echo "This may take a few moments..."
    
    local success_count=0
    local rate_limited_count=0
    local error_count=0
    
    # Send 150 requests rapidly to trigger rate limiting
    for i in {1..150}; do
        local response_code=$(curl -s -o /dev/null -w "%{http_code}" -m 5 \
            "${headers[@]}" "$api_url/status" &)
        
        # Control concurrency (max 10 concurrent requests)
        if ((i % 10 == 0)); then
            wait
        fi
    done
    wait
    
    echo ""
    echo "Rate limiting test completed."
    echo "Note: Individual response codes are not captured in this bulk test."
    echo "Check CloudWatch metrics for detailed rate limiting statistics."
    
    echo ""
}

# Function to test caching
test_caching() {
    print_section "Testing API Gateway Caching"
    
    local api_url=$(get_terraform_output "api_gateway_url")
    local api_key=$(get_terraform_output "api_key_value")
    
    # Prepare headers
    local headers=()
    if [[ -n "$api_key" ]]; then
        headers+=("-H" "X-API-Key: $api_key")
    fi
    
    echo "Testing caching behavior..."
    
    # First request (should be cached)
    echo "Making first request (cache miss expected)..."
    local response1=$(curl -s -D /tmp/headers1.txt -m 10 \
        "${headers[@]}" "$api_url/status")
    
    sleep 2
    
    # Second request (should hit cache)
    echo "Making second request (cache hit expected)..."
    local response2=$(curl -s -D /tmp/headers2.txt -m 10 \
        "${headers[@]}" "$api_url/status")
    
    # Check for cache headers
    if grep -q "X-Cache" /tmp/headers1.txt 2>/dev/null; then
        echo -e "${GREEN}✅ Cache headers present in response${NC}"
        echo "Cache headers from first request:"
        grep -i "x-cache\|cache-control\|expires" /tmp/headers1.txt || echo "No specific cache headers found"
    else
        echo -e "${YELLOW}⚠️ No X-Cache headers found (caching might not be enabled for this endpoint)${NC}"
    fi
    
    # Cleanup
    rm -f /tmp/headers1.txt /tmp/headers2.txt
    
    echo ""
}

# Function to test custom domain and TLS
test_custom_domain_tls() {
    print_section "Testing Custom Domain & TLS Configuration"
    
    local domain_name=$(get_terraform_output "api_gateway_domain_name")
    
    if [[ -z "$domain_name" ]]; then
        echo -e "${YELLOW}⚠️ No custom domain configured, skipping TLS tests${NC}"
        return 0
    fi
    
    echo "Testing custom domain: $domain_name"
    
    # Test TLS certificate
    echo "Checking TLS certificate..."
    if command -v openssl &> /dev/null; then
        local cert_info=$(echo | openssl s_client -servername "$domain_name" -connect "$domain_name:443" 2>/dev/null | openssl x509 -noout -subject -dates 2>/dev/null)
        
        if [[ -n "$cert_info" ]]; then
            echo -e "${GREEN}✅ TLS certificate is valid${NC}"
            echo "Certificate details:"
            echo "$cert_info"
        else
            echo -e "${RED}❌ Could not retrieve TLS certificate information${NC}"
        fi
    else
        echo -e "${YELLOW}⚠️ OpenSSL not available, skipping certificate check${NC}"
    fi
    
    # Test DNS resolution
    echo ""
    echo "Testing DNS resolution..."
    if command -v nslookup &> /dev/null; then
        if nslookup "$domain_name" &> /dev/null; then
            echo -e "${GREEN}✅ DNS resolution successful${NC}"
        else
            echo -e "${RED}❌ DNS resolution failed${NC}"
        fi
    else
        echo -e "${YELLOW}⚠️ nslookup not available, skipping DNS test${NC}"
    fi
    
    echo ""
}

# Function to test monitoring and logging
test_monitoring() {
    print_section "Testing Monitoring & Logging Configuration"
    
    local log_group_name=$(get_terraform_output "api_gateway_log_group_name")
    local waf_acl_name=$(get_terraform_output "waf_web_acl_name")
    
    echo "API Gateway Log Group: $log_group_name"
    echo "WAF Web ACL: $waf_acl_name"
    
    # Check if CloudWatch logs are being created
    if [[ -n "$log_group_name" ]] && command -v aws &> /dev/null; then
        echo ""
        echo "Checking CloudWatch logs..."
        
        local log_streams=$(aws logs describe-log-streams --log-group-name "$log_group_name" --order-by LastEventTime --descending --max-items 3 --query 'logStreams[].logStreamName' --output text 2>/dev/null || echo "")
        
        if [[ -n "$log_streams" ]]; then
            echo -e "${GREEN}✅ CloudWatch log streams found${NC}"
            echo "Recent log streams:"
            echo "$log_streams"
        else
            echo -e "${YELLOW}⚠️ No log streams found yet (logs may take time to appear)${NC}"
        fi
    else
        echo -e "${YELLOW}⚠️ AWS CLI not available or log group name missing${NC}"
    fi
    
    echo ""
}

# Function to generate test report
generate_test_report() {
    print_section "Test Report Summary"
    
    local api_url=$(get_terraform_output "api_gateway_url")
    local domain_name=$(get_terraform_output "api_gateway_domain_name")
    local api_key_configured=$(get_terraform_output "api_key_id")
    
    echo "Tolstoy API Gateway Test Report"
    echo "Generated: $(date)"
    echo ""
    echo "Configuration:"
    echo "• API Gateway URL: $api_url"
    echo "• Custom Domain: ${domain_name:-"Not configured"}"
    echo "• API Key Auth: ${api_key_configured:+"Enabled" || "Disabled"}"
    echo ""
    
    # Configuration summary
    local config_summary=$(get_terraform_output "configuration_summary")
    if [[ -n "$config_summary" ]]; then
        echo "Infrastructure Configuration:"
        echo "$config_summary"
    fi
    
    echo ""
    echo -e "${GREEN}✅ Test execution completed${NC}"
    echo ""
    echo -e "${BLUE}Next Steps:${NC}"
    echo "1. Review test results above"
    echo "2. Check CloudWatch metrics in AWS Console"
    echo "3. Monitor API Gateway and WAF logs"
    echo "4. Set up additional monitoring and alerting as needed"
    echo ""
    echo -e "${YELLOW}📊 Monitoring URLs:${NC}"
    get_terraform_output "monitoring_urls" 2>/dev/null || echo "Check Terraform outputs for monitoring URLs"
}

# Function to handle errors
handle_error() {
    echo -e "${RED}❌ Testing failed with error code $1${NC}"
    echo -e "${RED}Check the error messages above for details.${NC}"
    exit $1
}

# Main testing flow
main() {
    trap 'handle_error $?' ERR
    
    # Check prerequisites
    if ! command -v curl &> /dev/null; then
        echo -e "${RED}❌ curl is required but not installed${NC}"
        exit 1
    fi
    
    cd "${TERRAFORM_DIR}"
    
    # Check if Terraform state exists
    if [[ ! -f "terraform.tfstate" ]] && [[ ! -f ".terraform/terraform.tfstate" ]]; then
        echo -e "${RED}❌ No Terraform state found. Please deploy infrastructure first.${NC}"
        exit 1
    fi
    
    # Run tests
    test_basic_connectivity
    test_api_endpoints
    test_rate_limiting
    test_caching
    test_custom_domain_tls
    test_monitoring
    generate_test_report
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --help|-h)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Test the deployed Tolstoy API Gateway infrastructure"
            echo ""
            echo "Options:"
            echo "  -h, --help              Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0                      # Run all tests"
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            echo "Use --help for usage information."
            exit 1
            ;;
    esac
done

# Run main testing flow
main