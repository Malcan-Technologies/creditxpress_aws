#!/bin/bash

# =============================================================================
# New Client Setup - Master Orchestration Script
# =============================================================================
# This script orchestrates the complete setup of a new client's on-premises
# signing infrastructure. It guides you through all steps in the correct order.
#
# Usage:
#   ./setup-new-client.sh [OPTIONS]
#
# Options:
#   --client-json PATH   Path to client.json (default: ../../client.json)
#   --non-interactive    Run without prompts (requires all env vars set)
#   --dry-run            Show what would be done without executing
#   --help               Show this help message
#
# Required Environment Variables (for non-interactive mode):
#   DOCUSEAL_API_TOKEN           - DocuSeal API token
#   SIGNING_ORCHESTRATOR_API_KEY - API key for orchestrator
#   MTSA_SOAP_USERNAME           - MTSA SOAP username
#   MTSA_SOAP_PASSWORD           - MTSA SOAP password
#
# =============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLIENT_JSON="$SCRIPT_DIR/../../client.json"
ONPREM_DIR="$SCRIPT_DIR/.."

# Defaults
NON_INTERACTIVE=false
DRY_RUN=false

# Logging functions
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_section() { echo -e "\n${PURPLE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"; echo -e "${PURPLE}  $1${NC}"; echo -e "${PURPLE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"; }
log_step() { echo -e "${CYAN}→${NC} $1"; }

show_help() {
    head -25 "$0" | tail -20
    exit 0
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --client-json)
            CLIENT_JSON="$2"
            shift 2
            ;;
        --non-interactive)
            NON_INTERACTIVE=true
            shift
            ;;
        --dry-run)
            DRY_RUN=true
            shift
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

# Dry run wrapper
run_cmd() {
    if [ "$DRY_RUN" = true ]; then
        echo -e "${YELLOW}[DRY-RUN]${NC} Would execute: $*"
    else
        "$@"
    fi
}

# Check dependencies
check_dependencies() {
    log_section "Checking Dependencies"
    
    local missing=()
    
    if ! command -v jq &> /dev/null; then
        missing+=("jq")
    fi
    
    if ! command -v docker &> /dev/null; then
        missing+=("docker")
    fi
    
    if ! command -v curl &> /dev/null; then
        missing+=("curl")
    fi
    
    if ! command -v openssl &> /dev/null; then
        missing+=("openssl")
    fi
    
    if [ ${#missing[@]} -gt 0 ]; then
        log_error "Missing required tools: ${missing[*]}"
        log_info "Install with: sudo apt install ${missing[*]}"
        exit 1
    fi
    
    log_success "All dependencies available"
}

# Load and validate client configuration
load_client_config() {
    log_section "Loading Client Configuration"
    
    if [ ! -f "$CLIENT_JSON" ]; then
        log_error "client.json not found at: $CLIENT_JSON"
        exit 1
    fi
    
    # Load configuration
    CLIENT_SLUG=$(jq -r '.client_slug' "$CLIENT_JSON")
    CLIENT_NAME=$(jq -r '.client_name' "$CLIENT_JSON")
    SIGN_DOMAIN=$(jq -r '.domains.sign' "$CLIENT_JSON")
    API_DOMAIN=$(jq -r '.domains.api' "$CLIENT_JSON")
    ONPREM_ENABLED=$(jq -r '.onprem.enabled // false' "$CLIENT_JSON")
    BASE_DIR=$(jq -r '.onprem.base_dir // "/home/admin"' "$CLIENT_JSON")
    MTSA_ENV=$(jq -r '.onprem.mtsa.env // "pilot"' "$CLIENT_JSON")
    MTSA_IMAGE=$(jq -r '.onprem.mtsa.container_image // "mtsa-pilot:latest"' "$CLIENT_JSON")
    
    echo "  Client:         $CLIENT_NAME"
    echo "  Slug:           $CLIENT_SLUG"
    echo "  Sign Domain:    $SIGN_DOMAIN"
    echo "  API Domain:     $API_DOMAIN"
    echo "  On-Prem:        $ONPREM_ENABLED"
    echo "  Base Directory: $BASE_DIR"
    echo "  MTSA Env:       $MTSA_ENV"
    echo ""
    
    if [ "$ONPREM_ENABLED" != "true" ]; then
        log_error "On-prem is not enabled in client.json"
        log_info "Set 'onprem.enabled: true' in client.json first"
        exit 1
    fi
    
    log_success "Configuration loaded"
}

# Collect secrets
collect_secrets() {
    log_section "Collecting Secrets"
    
    if [ "$NON_INTERACTIVE" = true ]; then
        # Validate required secrets are set
        local missing=()
        
        [ -z "$DOCUSEAL_API_TOKEN" ] && missing+=("DOCUSEAL_API_TOKEN")
        [ -z "$SIGNING_ORCHESTRATOR_API_KEY" ] && missing+=("SIGNING_ORCHESTRATOR_API_KEY")
        [ -z "$MTSA_SOAP_USERNAME" ] && missing+=("MTSA_SOAP_USERNAME")
        [ -z "$MTSA_SOAP_PASSWORD" ] && missing+=("MTSA_SOAP_PASSWORD")
        
        if [ ${#missing[@]} -gt 0 ]; then
            log_error "Missing required environment variables: ${missing[*]}"
            exit 1
        fi
        
        log_success "All secrets provided via environment"
    else
        # Interactive secret collection
        echo "We need to collect some secrets for the deployment."
        echo "These will be used to generate environment files."
        echo ""
        
        # Signing Orchestrator API Key
        if [ -z "$SIGNING_ORCHESTRATOR_API_KEY" ]; then
            read -p "Generate random Signing Orchestrator API key? (Y/n): " -n 1 -r
            echo
            if [[ ! $REPLY =~ ^[Nn]$ ]]; then
                export SIGNING_ORCHESTRATOR_API_KEY=$(openssl rand -hex 32)
                log_info "Generated API key: ${SIGNING_ORCHESTRATOR_API_KEY:0:16}..."
            else
                read -p "Enter Signing Orchestrator API key: " SIGNING_ORCHESTRATOR_API_KEY
                export SIGNING_ORCHESTRATOR_API_KEY
            fi
        fi
        
        # MTSA credentials
        if [ -z "$MTSA_SOAP_USERNAME" ]; then
            read -p "Enter MTSA SOAP username (from Trustgate): " MTSA_SOAP_USERNAME
            export MTSA_SOAP_USERNAME
        fi
        
        if [ -z "$MTSA_SOAP_PASSWORD" ]; then
            read -s -p "Enter MTSA SOAP password: " MTSA_SOAP_PASSWORD
            echo
            export MTSA_SOAP_PASSWORD
        fi
        
        # DocuSeal API token
        if [ -z "$DOCUSEAL_API_TOKEN" ]; then
            log_warn "DocuSeal API token not provided"
            log_info "This will be collected after DocuSeal is running"
            log_info "Get it from: https://$SIGN_DOMAIN/settings/api"
        fi
        
        log_success "Secrets collected"
    fi
}

# Generate environment files
generate_environment() {
    log_section "Generating Environment Files"
    
    if [ -f "$SCRIPT_DIR/generate-env.sh" ]; then
        run_cmd chmod +x "$SCRIPT_DIR/generate-env.sh"
        run_cmd "$SCRIPT_DIR/generate-env.sh"
    else
        log_error "generate-env.sh not found"
        exit 1
    fi
}

# Start services
start_services() {
    log_section "Starting Services"
    
    cd "$ONPREM_DIR"
    
    if [ -f "docker-compose.unified.yml" ]; then
        log_step "Using unified docker-compose..."
        run_cmd docker compose -f docker-compose.unified.yml up -d
    elif [ -f "signing-orchestrator/docker-compose.yml" ]; then
        log_step "Starting signing orchestrator..."
        cd signing-orchestrator
        run_cmd docker compose up -d
        cd ..
    else
        log_error "No docker-compose file found"
        exit 1
    fi
    
    log_info "Waiting for services to initialize..."
    [ "$DRY_RUN" = false ] && sleep 20
    
    log_success "Services started"
}

# Verify services
verify_services() {
    log_section "Verifying Services"
    
    local all_healthy=true
    
    # DocuSeal
    log_step "Checking DocuSeal..."
    if curl -sf http://localhost:3000/health > /dev/null 2>&1; then
        echo -e "  DocuSeal: ${GREEN}Healthy${NC}"
    else
        echo -e "  DocuSeal: ${YELLOW}Not running${NC}"
        all_healthy=false
    fi
    
    # Signing Orchestrator
    log_step "Checking Signing Orchestrator..."
    if curl -sf http://localhost:4010/health > /dev/null 2>&1; then
        echo -e "  Signing Orchestrator: ${GREEN}Healthy${NC}"
    else
        echo -e "  Signing Orchestrator: ${YELLOW}Not running${NC}"
        all_healthy=false
    fi
    
    # MTSA
    log_step "Checking MTSA..."
    if curl -sf http://localhost:8080/MTSAPilot/MyTrustSignerAgentWSAPv2?wsdl > /dev/null 2>&1; then
        echo -e "  MTSA: ${GREEN}Healthy${NC}"
    else
        echo -e "  MTSA: ${YELLOW}Not running${NC}"
        # MTSA is optional until container is imported
    fi
    
    echo ""
    
    if [ "$all_healthy" = true ]; then
        log_success "All services healthy"
    else
        log_warn "Some services not running - check docker logs"
    fi
}

# Setup DocuSeal template
setup_template() {
    log_section "DocuSeal Template Setup"
    
    # Check if DocuSeal is running
    if ! curl -sf http://localhost:3000/health > /dev/null 2>&1; then
        log_warn "DocuSeal not running - skipping template setup"
        log_info "Run later: ./setup-docuseal-template.sh"
        return
    fi
    
    # Check if we have API token
    if [ -z "$DOCUSEAL_API_TOKEN" ]; then
        if [ "$NON_INTERACTIVE" = true ]; then
            log_warn "DOCUSEAL_API_TOKEN not set - skipping template setup"
            return
        fi
        
        log_info "DocuSeal API token needed for template setup"
        log_info "Get it from: https://$SIGN_DOMAIN/settings/api"
        echo ""
        read -p "Enter DocuSeal API token (or press Enter to skip): " DOCUSEAL_API_TOKEN
        
        if [ -z "$DOCUSEAL_API_TOKEN" ]; then
            log_warn "Skipping template setup"
            log_info "Run later: DOCUSEAL_API_TOKEN=xxx ./setup-docuseal-template.sh"
            return
        fi
        
        export DOCUSEAL_API_TOKEN
    fi
    
    if [ -f "$SCRIPT_DIR/setup-docuseal-template.sh" ]; then
        run_cmd chmod +x "$SCRIPT_DIR/setup-docuseal-template.sh"
        run_cmd "$SCRIPT_DIR/setup-docuseal-template.sh" --update-config
    else
        log_error "setup-docuseal-template.sh not found"
    fi
}

# Generate backend configuration snippet
generate_backend_config() {
    log_section "Backend Configuration"
    
    echo "Add these to your backend .env file:"
    echo ""
    echo "────────────────────────────────────────────────"
    echo "# Signing Orchestrator Configuration"
    echo "SIGNING_ORCHESTRATOR_URL=https://$SIGN_DOMAIN/orchestrator"
    echo "SIGNING_ORCHESTRATOR_API_KEY=$SIGNING_ORCHESTRATOR_API_KEY"
    echo ""
    echo "# DocuSeal Configuration"
    echo "DOCUSEAL_BASE_URL=https://$SIGN_DOMAIN"
    echo "DOCUSEAL_API_TOKEN=${DOCUSEAL_API_TOKEN:-<get from DocuSeal settings>}"
    echo "DOCUSEAL_TEMPLATE_ID=$(jq -r '.docuseal.template_id // "2"' "$CLIENT_JSON")"
    echo "────────────────────────────────────────────────"
    echo ""
    
    # Optionally save to file
    if [ "$NON_INTERACTIVE" = false ]; then
        read -p "Save configuration snippet to file? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            cat > "$ONPREM_DIR/backend-config-snippet.env" << EOF
# Signing Orchestrator Configuration
# Add these to your backend .env file
SIGNING_ORCHESTRATOR_URL=https://$SIGN_DOMAIN/orchestrator
SIGNING_ORCHESTRATOR_API_KEY=$SIGNING_ORCHESTRATOR_API_KEY

# DocuSeal Configuration
DOCUSEAL_BASE_URL=https://$SIGN_DOMAIN
DOCUSEAL_API_TOKEN=${DOCUSEAL_API_TOKEN:-REPLACE_WITH_TOKEN}
DOCUSEAL_TEMPLATE_ID=$(jq -r '.docuseal.template_id // "2"' "$CLIENT_JSON")
EOF
            log_success "Saved to: $ONPREM_DIR/backend-config-snippet.env"
        fi
    fi
}

# Summary
show_summary() {
    log_section "Setup Summary"
    
    echo "┌─────────────────────────────────────────────────────────┐"
    echo "│  $CLIENT_NAME On-Prem Setup Complete                    "
    echo "├─────────────────────────────────────────────────────────┤"
    echo "│                                                         │"
    echo "│  Services:                                              │"
    echo "│    DocuSeal:     https://$SIGN_DOMAIN"
    echo "│    Orchestrator: https://$SIGN_DOMAIN/orchestrator"
    echo "│    MTSA:         http://localhost:8080 (internal)       │"
    echo "│                                                         │"
    echo "│  Next Steps:                                            │"
    echo "│    1. Configure backend with snippet above              │"
    echo "│    2. Test signing workflow from admin panel            │"
    echo "│    3. Setup GitHub runner for CI/CD (optional)          │"
    echo "│                                                         │"
    echo "│  Useful Commands:                                       │"
    echo "│    ./deploy-all.sh status   - Check services            │"
    echo "│    ./deploy-all.sh logs     - View logs                 │"
    echo "│    ./deploy-all.sh restart  - Restart services          │"
    echo "│                                                         │"
    echo "└─────────────────────────────────────────────────────────┘"
    echo ""
}

# Main execution
main() {
    echo ""
    echo "╔═══════════════════════════════════════════════════════════╗"
    echo "║       New Client On-Prem Setup - Master Script            ║"
    echo "╚═══════════════════════════════════════════════════════════╝"
    echo ""
    
    if [ "$DRY_RUN" = true ]; then
        log_warn "DRY RUN MODE - No changes will be made"
        echo ""
    fi
    
    # Step 1: Check dependencies
    check_dependencies
    
    # Step 2: Load configuration
    load_client_config
    
    # Step 3: Collect secrets
    collect_secrets
    
    # Step 4: Generate environment files
    generate_environment
    
    # Step 5: Start services
    start_services
    
    # Step 6: Verify services
    verify_services
    
    # Step 7: Setup template
    setup_template
    
    # Step 8: Generate backend config
    generate_backend_config
    
    # Step 9: Summary
    show_summary
}

# Run main
main
