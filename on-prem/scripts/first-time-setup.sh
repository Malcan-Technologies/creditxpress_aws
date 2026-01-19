#!/bin/bash

# =============================================================================
# First-Time On-Prem Server Setup
# =============================================================================
# This script performs initial setup of a new on-premises server for the
# Kredit signing services. Run this manually via SSH on first access.
#
# Usage:
#   ./first-time-setup.sh [OPTIONS]
#
# Options:
#   --skip-docker       Skip Docker installation (already installed)
#   --skip-runner       Skip GitHub Actions runner installation
#   --skip-mtsa         Skip MTSA container import
#   --skip-tunnel       Skip Cloudflare tunnel setup
#   --mtsa-image PATH   Path to MTSA container tarball
#   --help              Show this help message
#
# Prerequisites:
#   - SSH access to the server
#   - sudo privileges
#   - Internet connectivity
#
# =============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLIENT_JSON="$SCRIPT_DIR/../../client.json"

# Defaults
SKIP_DOCKER=false
SKIP_RUNNER=false
SKIP_MTSA=false
SKIP_TUNNEL=false
MTSA_IMAGE_PATH=""

# Logging functions
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_section() { echo -e "\n${PURPLE}=== $1 ===${NC}\n"; }

show_help() {
    head -25 "$0" | tail -20
    exit 0
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --skip-docker)
            SKIP_DOCKER=true
            shift
            ;;
        --skip-runner)
            SKIP_RUNNER=true
            shift
            ;;
        --skip-mtsa)
            SKIP_MTSA=true
            shift
            ;;
        --skip-tunnel)
            SKIP_TUNNEL=true
            shift
            ;;
        --mtsa-image)
            MTSA_IMAGE_PATH="$2"
            shift 2
            ;;
        --help)
            show_help
            ;;
        *)
            log_error "Unknown option: $1"
            show_help
            ;;
    esac
done

# Load client configuration
load_config() {
    if [ -f "$CLIENT_JSON" ] && command -v jq &> /dev/null; then
        CLIENT_SLUG=$(jq -r '.client_slug' "$CLIENT_JSON")
        CLIENT_NAME=$(jq -r '.client_name' "$CLIENT_JSON")
        SIGN_DOMAIN=$(jq -r '.domains.sign' "$CLIENT_JSON")
        BASE_DIR=$(jq -r '.onprem.base_dir // "/home/admin"' "$CLIENT_JSON")
        log_info "Loaded config for: $CLIENT_NAME ($CLIENT_SLUG)"
    else
        CLIENT_SLUG="kredit"
        CLIENT_NAME="Kredit Platform"
        SIGN_DOMAIN="sign.kredit.my"
        BASE_DIR="/home/admin"
        log_warn "Using default configuration (jq or client.json not found)"
    fi
}

echo ""
echo "=============================================="
echo "  First-Time On-Prem Server Setup"
echo "=============================================="
echo ""
echo "  This script will configure your server for:"
echo "  - DocuSeal (document signing)"
echo "  - Signing Orchestrator (PKI integration)"
echo "  - MTSA (MyTrustSigner Agent)"
echo "  - GitHub Actions Runner (CI/CD)"
echo ""
echo "=============================================="
echo ""

read -p "Continue with setup? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    log_info "Setup cancelled"
    exit 0
fi

# =============================================================================
# Step 1: Install System Dependencies
# =============================================================================
log_section "Step 1: Installing System Dependencies"

log_info "Updating package lists..."
sudo apt update

log_info "Installing required packages..."
sudo apt install -y \
    curl \
    wget \
    git \
    jq \
    openssl \
    ca-certificates \
    gnupg \
    lsb-release

log_success "System dependencies installed"

# =============================================================================
# Step 2: Install Docker
# =============================================================================
log_section "Step 2: Docker Installation"

if [ "$SKIP_DOCKER" = true ]; then
    log_info "Skipping Docker installation (--skip-docker)"
elif command -v docker &> /dev/null; then
    log_info "Docker already installed: $(docker --version)"
else
    log_info "Installing Docker..."
    
    # Remove old versions
    sudo apt remove -y docker docker-engine docker.io containerd runc 2>/dev/null || true
    
    # Install Docker using official script
    curl -fsSL https://get.docker.com | sh
    
    # Add current user to docker group
    sudo usermod -aG docker $USER
    
    log_success "Docker installed successfully"
    log_warn "You may need to log out and back in for Docker group changes"
fi

# Install Docker Compose plugin if not present
if ! docker compose version &> /dev/null; then
    log_info "Installing Docker Compose plugin..."
    sudo apt install -y docker-compose-plugin
    log_success "Docker Compose plugin installed"
fi

# =============================================================================
# Step 3: Create Directory Structure
# =============================================================================
log_section "Step 3: Creating Directory Structure"

load_config

log_info "Creating directories in $BASE_DIR..."

mkdir -p "$BASE_DIR"/{docuseal,signing-orchestrator,mtsa,backups}
mkdir -p "$BASE_DIR"/kapital/agreements/{signed,original,stamped,postgres}
mkdir -p "$BASE_DIR"/kapital/logs/{signing-orchestrator,postgres}

log_success "Directory structure created"

# =============================================================================
# Step 4: Clone Repository
# =============================================================================
log_section "Step 4: Setting Up Repository"

REPO_DIR="$BASE_DIR/platform"

if [ -d "$REPO_DIR" ]; then
    log_info "Repository already exists at $REPO_DIR"
    cd "$REPO_DIR"
    git pull origin main || log_warn "Could not pull latest changes"
else
    log_info "Cloning repository..."
    log_warn "You'll need to configure SSH keys or use HTTPS with credentials"
    
    read -p "Enter repository URL (or press Enter to skip): " REPO_URL
    
    if [ -n "$REPO_URL" ]; then
        git clone "$REPO_URL" "$REPO_DIR"
        cd "$REPO_DIR"
        log_success "Repository cloned"
    else
        log_warn "Repository clone skipped - copy files manually"
    fi
fi

# =============================================================================
# Step 5: Generate Environment Files
# =============================================================================
log_section "Step 5: Generating Environment Files"

if [ -f "$SCRIPT_DIR/generate-env.sh" ]; then
    log_info "Running environment file generator..."
    chmod +x "$SCRIPT_DIR/generate-env.sh"
    
    # Prompt for secrets if not set
    if [ -z "$DOCUSEAL_API_TOKEN" ]; then
        log_warn "DOCUSEAL_API_TOKEN not set"
        log_info "You'll need to set this after DocuSeal is running"
    fi
    
    if [ -z "$SIGNING_ORCHESTRATOR_API_KEY" ]; then
        log_warn "SIGNING_ORCHESTRATOR_API_KEY not set"
        read -p "Generate random API key? (Y/n): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Nn]$ ]]; then
            export SIGNING_ORCHESTRATOR_API_KEY=$(openssl rand -hex 32)
            log_info "Generated API key: $SIGNING_ORCHESTRATOR_API_KEY"
            log_warn "Save this key! You'll need it for backend configuration"
        fi
    fi
    
    "$SCRIPT_DIR/generate-env.sh"
    log_success "Environment files generated"
else
    log_warn "generate-env.sh not found - environment files must be created manually"
fi

# =============================================================================
# Step 6: Import MTSA Container
# =============================================================================
log_section "Step 6: MTSA Container Import"

if [ "$SKIP_MTSA" = true ]; then
    log_info "Skipping MTSA import (--skip-mtsa)"
elif [ -n "$MTSA_IMAGE_PATH" ] && [ -f "$MTSA_IMAGE_PATH" ]; then
    log_info "Importing MTSA container from: $MTSA_IMAGE_PATH"
    
    if [ -f "$SCRIPT_DIR/import-mtsa-container.sh" ]; then
        chmod +x "$SCRIPT_DIR/import-mtsa-container.sh"
        "$SCRIPT_DIR/import-mtsa-container.sh" "$MTSA_IMAGE_PATH"
        log_success "MTSA container imported"
    else
        log_warn "import-mtsa-container.sh not found"
        docker load -i "$MTSA_IMAGE_PATH"
    fi
else
    log_warn "MTSA container not provided"
    log_info "Import later with: ./import-mtsa-container.sh /path/to/mtsa-image.tar"
fi

# =============================================================================
# Step 7: Setup Cloudflare Tunnel
# =============================================================================
log_section "Step 7: Cloudflare Tunnel Setup"

if [ "$SKIP_TUNNEL" = true ]; then
    log_info "Skipping Cloudflare tunnel setup (--skip-tunnel)"
elif [ -f "$SCRIPT_DIR/setup-cloudflare-tunnel.sh" ]; then
    log_info "Cloudflare tunnel can expose services to the internet"
    read -p "Setup Cloudflare tunnel now? (y/N): " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        chmod +x "$SCRIPT_DIR/setup-cloudflare-tunnel.sh"
        "$SCRIPT_DIR/setup-cloudflare-tunnel.sh"
    else
        log_info "Skipping tunnel setup"
        log_info "Run later: ./setup-cloudflare-tunnel.sh"
    fi
else
    log_warn "setup-cloudflare-tunnel.sh not found"
fi

# =============================================================================
# Step 8: Start Services
# =============================================================================
log_section "Step 8: Starting Services"

ONPREM_DIR="$SCRIPT_DIR/.."

if [ -f "$ONPREM_DIR/docker-compose.unified.yml" ]; then
    log_info "Starting services with unified compose file..."
    cd "$ONPREM_DIR"
    docker compose -f docker-compose.unified.yml up -d
    log_success "Services started"
elif [ -f "$ONPREM_DIR/signing-orchestrator/docker-compose.yml" ]; then
    log_info "Starting signing orchestrator..."
    cd "$ONPREM_DIR/signing-orchestrator"
    docker compose up -d
    log_success "Signing orchestrator started"
else
    log_warn "No docker-compose file found"
    log_info "Start services manually after copying compose files"
fi

# Wait for services to start
log_info "Waiting for services to initialize..."
sleep 15

# =============================================================================
# Step 9: Setup DocuSeal Template
# =============================================================================
log_section "Step 9: DocuSeal Template Setup"

if [ -f "$SCRIPT_DIR/setup-docuseal-template.sh" ]; then
    log_info "DocuSeal template can be configured after DocuSeal is running"
    
    # Check if DocuSeal is running
    if curl -sf http://localhost:3000/health > /dev/null 2>&1; then
        read -p "Setup DocuSeal template now? (y/N): " -n 1 -r
        echo
        
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            chmod +x "$SCRIPT_DIR/setup-docuseal-template.sh"
            
            if [ -z "$DOCUSEAL_API_TOKEN" ]; then
                log_info "Get DocuSeal API token from: https://$SIGN_DOMAIN/settings/api"
                read -p "Enter DocuSeal API token: " DOCUSEAL_API_TOKEN
                export DOCUSEAL_API_TOKEN
            fi
            
            "$SCRIPT_DIR/setup-docuseal-template.sh" --update-config
        fi
    else
        log_warn "DocuSeal not accessible yet"
        log_info "Run later: ./setup-docuseal-template.sh"
    fi
else
    log_warn "setup-docuseal-template.sh not found"
fi

# =============================================================================
# Step 10: GitHub Actions Runner
# =============================================================================
log_section "Step 10: GitHub Actions Runner"

if [ "$SKIP_RUNNER" = true ]; then
    log_info "Skipping GitHub runner installation (--skip-runner)"
else
    log_info "A self-hosted GitHub runner enables automated deployments"
    read -p "Install GitHub Actions runner? (y/N): " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        RUNNER_DIR="$BASE_DIR/actions-runner"
        mkdir -p "$RUNNER_DIR"
        cd "$RUNNER_DIR"
        
        log_info "Downloading GitHub Actions runner..."
        RUNNER_VERSION="2.311.0"
        curl -o actions-runner-linux-x64-${RUNNER_VERSION}.tar.gz -L \
            https://github.com/actions/runner/releases/download/v${RUNNER_VERSION}/actions-runner-linux-x64-${RUNNER_VERSION}.tar.gz
        
        tar xzf actions-runner-linux-x64-${RUNNER_VERSION}.tar.gz
        
        log_info "Configure the runner with your repository token"
        log_info "Get token from: GitHub → Settings → Actions → Runners → New self-hosted runner"
        echo ""
        read -p "Enter repository URL (e.g., https://github.com/org/repo): " REPO_URL
        read -p "Enter runner token: " RUNNER_TOKEN
        
        if [ -n "$REPO_URL" ] && [ -n "$RUNNER_TOKEN" ]; then
            ./config.sh --url "$REPO_URL" --token "$RUNNER_TOKEN" --labels "self-hosted,linux,x64,onprem"
            
            log_info "Installing runner as service..."
            sudo ./svc.sh install
            sudo ./svc.sh start
            
            log_success "GitHub Actions runner installed and started"
        else
            log_warn "Runner configuration skipped"
            log_info "Configure manually later - see GITHUB_RUNNER_SETUP.md"
        fi
    else
        log_info "GitHub runner installation skipped"
        log_info "Install later following: on-prem/docs/GITHUB_RUNNER_SETUP.md"
    fi
fi

# =============================================================================
# Step 11: Verify Setup
# =============================================================================
log_section "Step 11: Verifying Setup"

echo "Checking service status..."
echo ""

# Docker
echo -n "Docker: "
if command -v docker &> /dev/null && docker ps &> /dev/null; then
    echo -e "${GREEN}OK${NC}"
else
    echo -e "${RED}FAILED${NC}"
fi

# DocuSeal
echo -n "DocuSeal: "
if curl -sf http://localhost:3000/health > /dev/null 2>&1; then
    echo -e "${GREEN}OK${NC}"
else
    echo -e "${YELLOW}Not running${NC}"
fi

# Signing Orchestrator
echo -n "Signing Orchestrator: "
if curl -sf http://localhost:4010/health > /dev/null 2>&1; then
    echo -e "${GREEN}OK${NC}"
else
    echo -e "${YELLOW}Not running${NC}"
fi

# MTSA
echo -n "MTSA: "
if curl -sf http://localhost:8080/MTSAPilot/MyTrustSignerAgentWSAPv2?wsdl > /dev/null 2>&1; then
    echo -e "${GREEN}OK${NC}"
else
    echo -e "${YELLOW}Not running${NC}"
fi

# GitHub Runner
echo -n "GitHub Runner: "
if systemctl is-active --quiet actions.runner.* 2>/dev/null; then
    echo -e "${GREEN}OK${NC}"
else
    echo -e "${YELLOW}Not installed${NC}"
fi

# =============================================================================
# Summary
# =============================================================================
echo ""
echo "=============================================="
echo "  First-Time Setup Complete"
echo "=============================================="
echo ""
echo "  What was configured:"
echo "  - System dependencies installed"
echo "  - Docker and Docker Compose"
echo "  - Directory structure created"
echo "  - Environment files generated"
echo ""
echo "  Next Steps:"
echo "  1. Verify all services are running: ./deploy-all.sh status"
echo "  2. Configure DocuSeal admin: https://$SIGN_DOMAIN"
echo "  3. Get API token and run: ./setup-docuseal-template.sh"
echo "  4. Update backend .env with SIGNING_ORCHESTRATOR_URL"
echo "  5. Test the signing workflow from admin panel"
echo ""
echo "  Useful Commands:"
echo "  - ./deploy-all.sh status     - Check all services"
echo "  - ./deploy-all.sh logs       - View service logs"
echo "  - ./deploy-all.sh restart    - Restart services"
echo ""
echo "  Documentation:"
echo "  - on-prem/docs/STEP_BY_STEP_DEPLOYMENT_GUIDE.md"
echo "  - on-prem/docs/GITHUB_RUNNER_SETUP.md"
echo "  - on-prem/docs/MTSA_CONTAINER_INTEGRATION.md"
echo ""
echo "=============================================="
