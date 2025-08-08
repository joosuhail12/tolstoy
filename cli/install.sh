#!/bin/bash
set -e

# Tolstoy CLI Installation Script
# Usage: curl -fsSL https://get.tolstoy.dev | bash

CLI_VERSION=${TOLSTOY_CLI_VERSION:-"latest"}
INSTALL_DIR=${TOLSTOY_INSTALL_DIR:-"/usr/local/bin"}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Platform detection
detect_platform() {
    local os=$(uname -s | tr '[:upper:]' '[:lower:]')
    local arch=$(uname -m)
    
    case "$os" in
        linux)
            OS="linux"
            ;;
        darwin)
            OS="macos"
            ;;
        *)
            echo -e "${RED}Error: Unsupported operating system: $os${NC}"
            exit 1
            ;;
    esac
    
    case "$arch" in
        x86_64|amd64)
            ARCH="x64"
            ;;
        arm64|aarch64)
            ARCH="arm64"
            ;;
        *)
            echo -e "${RED}Error: Unsupported architecture: $arch${NC}"
            exit 1
            ;;
    esac
    
    PLATFORM="${OS}-${ARCH}"
}

# Get latest version from GitHub API
get_latest_version() {
    if [ "$CLI_VERSION" = "latest" ]; then
        echo -e "${BLUE}Fetching latest version...${NC}"
        CLI_VERSION=$(curl -s https://api.github.com/repos/tolstoy-dev/cli/releases/latest | grep '"tag_name":' | cut -d'"' -f4 | sed 's/v//')
        if [ -z "$CLI_VERSION" ]; then
            echo -e "${RED}Error: Could not fetch latest version${NC}"
            exit 1
        fi
    fi
}

# Download and install
install_cli() {
    local download_url="https://github.com/tolstoy-dev/cli/releases/download/v${CLI_VERSION}/tolstoy-cli-${PLATFORM}.tar.gz"
    local temp_dir=$(mktemp -d)
    local archive_path="${temp_dir}/tolstoy-cli.tar.gz"
    
    echo -e "${BLUE}Downloading Tolstoy CLI v${CLI_VERSION} for ${PLATFORM}...${NC}"
    
    if ! curl -fsSL "$download_url" -o "$archive_path"; then
        echo -e "${RED}Error: Failed to download CLI from $download_url${NC}"
        echo -e "${YELLOW}Please check if version $CLI_VERSION exists for platform $PLATFORM${NC}"
        exit 1
    fi
    
    echo -e "${BLUE}Extracting archive...${NC}"
    cd "$temp_dir"
    tar -xzf "$archive_path"
    
    # Find the binary (it should be in a platform-specific directory)
    local binary_path=$(find . -name "tolstoy" -type f | head -1)
    if [ -z "$binary_path" ]; then
        echo -e "${RED}Error: Could not find tolstoy binary in archive${NC}"
        exit 1
    fi
    
    echo -e "${BLUE}Installing to ${INSTALL_DIR}...${NC}"
    
    # Check if we have write permissions
    if [ ! -w "$INSTALL_DIR" ]; then
        echo -e "${YELLOW}Requesting sudo permissions to install to ${INSTALL_DIR}${NC}"
        sudo install -m 755 "$binary_path" "${INSTALL_DIR}/tolstoy"
    else
        install -m 755 "$binary_path" "${INSTALL_DIR}/tolstoy"
    fi
    
    # Cleanup
    rm -rf "$temp_dir"
    
    echo -e "${GREEN}✅ Tolstoy CLI v${CLI_VERSION} installed successfully!${NC}"
}

# Verify installation
verify_installation() {
    if command -v tolstoy >/dev/null 2>&1; then
        echo -e "${GREEN}✅ Installation verified${NC}"
        echo ""
        tolstoy --version
        echo ""
        echo -e "${BLUE}🚀 Get started:${NC}"
        echo "   tolstoy config add          # Configure API credentials"
        echo "   tolstoy templates list      # Browse available templates"
        echo "   tolstoy flows list          # List your workflows"
        echo "   tolstoy --help              # Show all available commands"
        echo ""
        echo -e "${BLUE}📚 Documentation: https://docs.tolstoy.dev${NC}"
    else
        echo -e "${RED}❌ Installation verification failed${NC}"
        echo -e "${YELLOW}The binary was installed to ${INSTALL_DIR}/tolstoy but is not in your PATH${NC}"
        echo -e "${YELLOW}You may need to add ${INSTALL_DIR} to your PATH or restart your terminal${NC}"
        exit 1
    fi
}

# Main installation flow
main() {
    echo -e "${BLUE}🚀 Tolstoy CLI Installer${NC}"
    echo ""
    
    # Check requirements
    if ! command -v curl >/dev/null 2>&1; then
        echo -e "${RED}Error: curl is required but not installed${NC}"
        exit 1
    fi
    
    if ! command -v tar >/dev/null 2>&1; then
        echo -e "${RED}Error: tar is required but not installed${NC}"
        exit 1
    fi
    
    detect_platform
    echo -e "${BLUE}Detected platform: ${PLATFORM}${NC}"
    
    get_latest_version
    echo -e "${BLUE}Installing version: ${CLI_VERSION}${NC}"
    echo ""
    
    install_cli
    verify_installation
}

# Run main function
main "$@"