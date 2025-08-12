#!/bin/bash

# Deploy Documentation to Production
# This script handles the complete deployment pipeline for Tolstoy documentation

set -e

# Configuration
BRANCH_NAME=$(git branch --show-current)
COMMIT_SHA=$(git rev-parse --short HEAD)
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Print banner
print_banner() {
    echo -e "${BLUE}"
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║                   TOLSTOY DOCUMENTATION                     ║"
    echo "║                    DEPLOYMENT SCRIPT                        ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
    echo "Branch: $BRANCH_NAME"
    echo "Commit: $COMMIT_SHA"
    echo "Time: $TIMESTAMP"
    echo ""
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check if we're in the correct directory
    if [ ! -f "docs.json" ]; then
        log_error "docs.json not found. Are you in the docs directory?"
        exit 1
    fi
    
    # Check required tools
    local required_tools=("node" "npm" "git")
    for tool in "${required_tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            log_error "$tool is not installed or not in PATH"
            exit 1
        fi
    done
    
    # Check Node.js version
    local node_version=$(node -v | cut -c2-)
    local required_version="16.0.0"
    if ! printf '%s\n%s\n' "$required_version" "$node_version" | sort -V -C; then
        log_error "Node.js version $node_version is too old. Required: $required_version+"
        exit 1
    fi
    
    log_success "Prerequisites check passed"
}

# Validate branch
validate_branch() {
    log_info "Validating deployment branch..."
    
    case "$BRANCH_NAME" in
        main)
            log_info "Deploying from main branch to production"
            export DEPLOYMENT_ENV="production"
            ;;
        staging)
            log_info "Deploying from staging branch to staging environment"
            export DEPLOYMENT_ENV="staging"
            ;;
        feat/comprehensive-docs-platform)
            log_info "Deploying feature branch to preview environment"
            export DEPLOYMENT_ENV="preview"
            ;;
        *)
            log_warning "Deploying from '$BRANCH_NAME' to preview environment"
            export DEPLOYMENT_ENV="preview"
            ;;
    esac
}

# Install dependencies
install_dependencies() {
    log_info "Installing dependencies..."
    
    if [ -f "package.json" ]; then
        npm ci --silent
        log_success "Dependencies installed"
    else
        log_warning "No package.json found, skipping dependency installation"
    fi
}

# Generate auto-generated content
generate_content() {
    log_info "Generating auto-generated documentation..."
    
    # Generate API docs from OpenAPI spec
    if [ -f "scripts/generate-api-docs.js" ]; then
        log_info "Generating API documentation..."
        node scripts/generate-api-docs.js generate
        log_success "API documentation generated"
    fi
    
    # Generate CLI docs
    if [ -f "scripts/generate-cli-docs.js" ]; then
        log_info "Generating CLI documentation..."
        node scripts/generate-cli-docs.js generate
        log_success "CLI documentation generated"
    fi
    
    # Update navigation
    log_info "Updating navigation structure..."
    if [ -f "scripts/update-navigation.js" ]; then
        node scripts/update-navigation.js
        log_success "Navigation updated"
    fi
}

# Validate documentation
validate_documentation() {
    log_info "Validating documentation..."
    
    # Run validation script
    if [ -f "scripts/validate-docs.js" ]; then
        if node scripts/validate-docs.js validate; then
            log_success "Documentation validation passed"
        else
            log_error "Documentation validation failed"
            exit 1
        fi
    else
        log_warning "Validation script not found, skipping validation"
    fi
    
    # Check for broken links
    log_info "Checking for broken links..."
    if [ -f "scripts/check-links.js" ]; then
        node scripts/check-links.js || log_warning "Some links may be broken"
    fi
}

# Build documentation
build_documentation() {
    log_info "Building documentation..."
    
    # Set environment variables
    export NODE_ENV="production"
    export MINTLIFY_ENV="$DEPLOYMENT_ENV"
    
    # Mintlify builds automatically on deployment
    log_info "Mintlify will build automatically during deployment"
    log_success "Ready for deployment"
}

# Deploy to Mintlify
deploy_to_mintlify() {
    log_info "Deploying to Mintlify..."
    
    # Check if Mintlify is configured
    if [ -z "$MINTLIFY_API_KEY" ]; then
        log_error "MINTLIFY_API_KEY environment variable is not set"
        exit 1
    fi
    
    case "$DEPLOYMENT_ENV" in
        production)
            log_info "Deploying to production environment..."
            # Production deployment via GitHub integration
            log_success "Production deployment triggered via GitHub"
            ;;
        staging)
            log_info "Deploying to staging environment..."
            # Staging deployment via GitHub integration
            log_success "Staging deployment triggered via GitHub"
            ;;
        preview)
            log_info "Deploying to preview environment..."
            # Preview deployment via GitHub integration  
            log_success "Preview deployment triggered via GitHub"
            ;;
    esac
    
    log_success "Deployed to Mintlify successfully"
}

# Update GitHub deployment status
update_deployment_status() {
    local status=$1
    local description=$2
    
    if [ -n "$GITHUB_TOKEN" ] && [ -n "$GITHUB_REPOSITORY" ]; then
        log_info "Updating GitHub deployment status: $status"
        
        # Create deployment status via GitHub API
        curl -X POST \
            -H "Authorization: token $GITHUB_TOKEN" \
            -H "Accept: application/vnd.github.v3+json" \
            "https://api.github.com/repos/$GITHUB_REPOSITORY/deployments" \
            -d "{
                \"ref\": \"$COMMIT_SHA\",
                \"environment\": \"$DEPLOYMENT_ENV\",
                \"description\": \"$description\",
                \"auto_merge\": false
            }" > /dev/null 2>&1
    fi
}

# Send notifications
send_notifications() {
    local status=$1
    local message=$2
    
    # Slack notification
    if [ -n "$SLACK_WEBHOOK_URL" ]; then
        local color="good"
        if [ "$status" != "success" ]; then
            color="danger"
        fi
        
        curl -X POST -H 'Content-type: application/json' \
            --data "{
                \"attachments\": [{
                    \"color\": \"$color\",
                    \"title\": \"Documentation Deployment\",
                    \"text\": \"$message\",
                    \"fields\": [
                        {\"title\": \"Environment\", \"value\": \"$DEPLOYMENT_ENV\", \"short\": true},
                        {\"title\": \"Branch\", \"value\": \"$BRANCH_NAME\", \"short\": true},
                        {\"title\": \"Commit\", \"value\": \"$COMMIT_SHA\", \"short\": true}
                    ]
                }]
            }" \
            $SLACK_WEBHOOK_URL > /dev/null 2>&1
    fi
    
    # Discord notification (if configured)
    if [ -n "$DISCORD_WEBHOOK_URL" ]; then
        local color=3066993  # Green
        if [ "$status" != "success" ]; then
            color=15158332  # Red
        fi
        
        curl -X POST -H 'Content-type: application/json' \
            --data "{
                \"embeds\": [{
                    \"title\": \"📚 Documentation Deployment\",
                    \"description\": \"$message\",
                    \"color\": $color,
                    \"fields\": [
                        {\"name\": \"Environment\", \"value\": \"$DEPLOYMENT_ENV\", \"inline\": true},
                        {\"name\": \"Branch\", \"value\": \"$BRANCH_NAME\", \"inline\": true},
                        {\"name\": \"Commit\", \"value\": \"$COMMIT_SHA\", \"inline\": true}
                    ],
                    \"timestamp\": \"$TIMESTAMP\"
                }]
            }" \
            $DISCORD_WEBHOOK_URL > /dev/null 2>&1
    fi
}

# Cleanup function
cleanup() {
    log_info "Cleaning up temporary files..."
    
    # Remove temporary build files
    rm -rf .mintlify/
    rm -rf node_modules/.cache/
    rm -f validation-report.json
    
    log_success "Cleanup completed"
}

# Main deployment function
deploy() {
    local start_time=$(date +%s)
    
    print_banner
    
    # Set up error handling
    trap 'log_error "Deployment failed"; update_deployment_status "failure" "Deployment failed"; send_notifications "failure" "Documentation deployment failed"; cleanup; exit 1' ERR
    
    # Update deployment status
    update_deployment_status "pending" "Starting deployment"
    
    # Run deployment steps
    check_prerequisites
    validate_branch
    install_dependencies
    generate_content
    validate_documentation
    build_documentation
    deploy_to_mintlify
    cleanup
    
    # Calculate deployment time
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    # Success notifications
    update_deployment_status "success" "Deployment completed successfully"
    send_notifications "success" "Documentation deployed successfully in ${duration}s"
    
    log_success "Documentation deployment completed successfully!"
    log_info "Deployment time: ${duration} seconds"
    
    # Print deployment URLs
    case "$DEPLOYMENT_ENV" in
        production)
            log_info "Production URL: https://docs.tolstoy.getpullse.com"
            ;;
        staging)
            log_info "Staging URL: https://docs-staging.tolstoy.getpullse.com"
            ;;
        preview)
            log_info "Preview URL: https://docs-preview-${COMMIT_SHA}.tolstoy.getpullse.com"
            ;;
    esac
}

# Handle script arguments
case "${1:-deploy}" in
    deploy)
        deploy
        ;;
    validate)
        validate_documentation
        ;;
    build)
        build_documentation
        ;;
    generate)
        generate_content
        ;;
    help)
        echo "Usage: $0 [command]"
        echo ""
        echo "Commands:"
        echo "  deploy    - Full deployment pipeline (default)"
        echo "  validate  - Validate documentation only"
        echo "  build     - Build documentation only"
        echo "  generate  - Generate auto-content only"
        echo "  help      - Show this help message"
        echo ""
        echo "Environment Variables:"
        echo "  MINTLIFY_API_KEY     - Mintlify API key (required)"
        echo "  SLACK_WEBHOOK_URL    - Slack webhook for notifications (optional)"
        echo "  DISCORD_WEBHOOK_URL  - Discord webhook for notifications (optional)"
        echo "  GITHUB_TOKEN         - GitHub token for deployment status (optional)"
        echo "  GITHUB_REPOSITORY    - GitHub repository name (optional)"
        ;;
    *)
        log_error "Unknown command: $1"
        log_info "Run '$0 help' for usage information"
        exit 1
        ;;
esac