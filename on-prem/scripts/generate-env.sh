#!/bin/bash

# =============================================================================
# Environment File Generator
# =============================================================================
# Generates .env files from client.json and environment templates.
# Used for both local development and GitHub Actions deployments.
#
# Usage:
#   ./generate-env.sh [OPTIONS]
#
# Options:
#   --output DIR     Output directory (default: on-prem root)
#   --env ENV        Environment: development|production (default: production)
#   --help           Show this help message
#
# Environment Variables (from GitHub Secrets or local):
#   DOCUSEAL_API_TOKEN           - DocuSeal API authentication token
#   SIGNING_ORCHESTRATOR_API_KEY - API key for backend communication
#   MTSA_SOAP_USERNAME           - MTSA/Trustgate SOAP username
#   MTSA_SOAP_PASSWORD           - MTSA/Trustgate SOAP password
#   DOCUSEAL_POSTGRES_PASSWORD   - DocuSeal database password (auto-generated if not set)
#   AGREEMENTS_DB_PASSWORD       - Signing orchestrator DB password (auto-generated if not set)
#
# =============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ONPREM_DIR="$SCRIPT_DIR/.."
CLIENT_JSON="$SCRIPT_DIR/../../client.json"

# Default values
OUTPUT_DIR="$ONPREM_DIR"
ENVIRONMENT="production"

# Logging functions
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

show_help() {
    head -25 "$0" | tail -20
    exit 0
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --output)
            OUTPUT_DIR="$2"
            shift 2
            ;;
        --env)
            ENVIRONMENT="$2"
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

# Check dependencies
if ! command -v jq &> /dev/null; then
    log_error "jq is required. Install with: apt-get install jq"
    exit 1
fi

# Load client configuration
if [ ! -f "$CLIENT_JSON" ]; then
    log_error "client.json not found at: $CLIENT_JSON"
    exit 1
fi

log_info "Loading configuration from client.json..."

# Extract values from client.json
CLIENT_SLUG=$(jq -r '.client_slug' "$CLIENT_JSON")
CLIENT_NAME=$(jq -r '.client_name' "$CLIENT_JSON")
SIGN_DOMAIN=$(jq -r '.domains.sign' "$CLIENT_JSON")
API_DOMAIN=$(jq -r '.domains.api' "$CLIENT_JSON")
APP_DOMAIN=$(jq -r '.domains.app' "$CLIENT_JSON")
ADMIN_DOMAIN=$(jq -r '.domains.admin' "$CLIENT_JSON")
TEMPLATE_ID=$(jq -r '.docuseal.template_id' "$CLIENT_JSON")
COMPANY_EMAIL=$(jq -r '.docuseal.company_signing_email' "$CLIENT_JSON")
WITNESS_EMAIL=$(jq -r '.docuseal.witness_email' "$CLIENT_JSON")
WITNESS_NAME=$(jq -r '.docuseal.witness_name' "$CLIENT_JSON")
MTSA_ENV=$(jq -r '.onprem.mtsa.env // "pilot"' "$CLIENT_JSON")
MTSA_IMAGE=$(jq -r '.onprem.mtsa.container_image // "mtsa-pilot:1.01"' "$CLIENT_JSON")
TUNNEL_NAME=$(jq -r '.onprem.cloudflare.tunnel_name // ""' "$CLIENT_JSON")

# Generate secure passwords if not provided
generate_password() {
    openssl rand -hex 32
}

DOCUSEAL_POSTGRES_PASSWORD="${DOCUSEAL_POSTGRES_PASSWORD:-$(generate_password)}"
AGREEMENTS_DB_PASSWORD="${AGREEMENTS_DB_PASSWORD:-$(generate_password)}"
DOCUSEAL_SECRET_KEY_BASE="${DOCUSEAL_SECRET_KEY_BASE:-$(openssl rand -hex 64)}"
DOCUSEAL_WEBHOOK_HMAC_SECRET="${DOCUSEAL_WEBHOOK_HMAC_SECRET:-$(generate_password)}"

# Validate required secrets
MISSING_SECRETS=()

if [ -z "$DOCUSEAL_API_TOKEN" ]; then
    MISSING_SECRETS+=("DOCUSEAL_API_TOKEN")
fi

if [ -z "$SIGNING_ORCHESTRATOR_API_KEY" ]; then
    MISSING_SECRETS+=("SIGNING_ORCHESTRATOR_API_KEY")
fi

if [ -z "$MTSA_SOAP_USERNAME" ]; then
    MISSING_SECRETS+=("MTSA_SOAP_USERNAME")
fi

if [ -z "$MTSA_SOAP_PASSWORD" ]; then
    MISSING_SECRETS+=("MTSA_SOAP_PASSWORD")
fi

if [ ${#MISSING_SECRETS[@]} -gt 0 ]; then
    log_warn "Missing secrets (will use placeholders): ${MISSING_SECRETS[*]}"
    log_info "Set these as environment variables or GitHub Secrets"
fi

echo ""
echo "=============================================="
echo "  Generating Environment Files"
echo "=============================================="
echo ""
echo "  Client:       $CLIENT_NAME ($CLIENT_SLUG)"
echo "  Environment:  $ENVIRONMENT"
echo "  Sign Domain:  $SIGN_DOMAIN"
echo "  Output:       $OUTPUT_DIR"
echo ""
echo "=============================================="
echo ""

# Generate unified .env file
log_info "Generating $OUTPUT_DIR/.env..."

cat > "$OUTPUT_DIR/.env" << EOF
# =============================================================================
# On-Prem Signing Services Environment
# Generated: $(date -u +"%Y-%m-%dT%H:%M:%SZ")
# Client: $CLIENT_NAME ($CLIENT_SLUG)
# Environment: $ENVIRONMENT
# =============================================================================

# =============================================================================
# Client Identity
# =============================================================================
CLIENT_SLUG=$CLIENT_SLUG
CLIENT_NAME=$CLIENT_NAME
CLIENT_DOMAIN=$(echo $SIGN_DOMAIN | cut -d. -f2-)
SIGN_DOMAIN=$SIGN_DOMAIN

# =============================================================================
# DocuSeal Configuration
# =============================================================================
DOCUSEAL_POSTGRES_PASSWORD=$DOCUSEAL_POSTGRES_PASSWORD
DOCUSEAL_SECRET_KEY_BASE=$DOCUSEAL_SECRET_KEY_BASE
DOCUSEAL_API_TOKEN=${DOCUSEAL_API_TOKEN:-REPLACE_WITH_DOCUSEAL_API_TOKEN}
DOCUSEAL_WEBHOOK_HMAC_SECRET=$DOCUSEAL_WEBHOOK_HMAC_SECRET

# =============================================================================
# Signing Orchestrator Configuration
# =============================================================================
AGREEMENTS_DB_PASSWORD=$AGREEMENTS_DB_PASSWORD
SIGNING_ORCHESTRATOR_API_KEY=${SIGNING_ORCHESTRATOR_API_KEY:-REPLACE_WITH_API_KEY}

# =============================================================================
# MTSA (MyTrustSigner Agent) Configuration
# =============================================================================
MTSA_ENV=$MTSA_ENV
MTSA_CONTAINER_IMAGE=$MTSA_IMAGE
MTSA_SOAP_USERNAME=${MTSA_SOAP_USERNAME:-REPLACE_WITH_MTSA_USERNAME}
MTSA_SOAP_PASSWORD=${MTSA_SOAP_PASSWORD:-REPLACE_WITH_MTSA_PASSWORD}

# =============================================================================
# Cloudflare Tunnel (if configured via dashboard, leave empty)
# =============================================================================
TUNNEL_TOKEN=${TUNNEL_TOKEN:-}

# =============================================================================
# SMTP Configuration (Optional - for DocuSeal email notifications)
# =============================================================================
SMTP_ADDRESS=${SMTP_ADDRESS:-}
SMTP_PORT=${SMTP_PORT:-587}
SMTP_USERNAME=${SMTP_USERNAME:-}
SMTP_PASSWORD=${SMTP_PASSWORD:-}
SMTP_DOMAIN=$(echo $SIGN_DOMAIN | cut -d. -f2-)
SMTP_FROM=noreply@$(echo $SIGN_DOMAIN | cut -d. -f2-)
EOF

log_success "Generated: $OUTPUT_DIR/.env"

# Generate signing orchestrator environment
log_info "Generating $OUTPUT_DIR/signing-orchestrator/.env..."

mkdir -p "$OUTPUT_DIR/signing-orchestrator"

cat > "$OUTPUT_DIR/signing-orchestrator/.env" << EOF
# =============================================================================
# Signing Orchestrator Environment
# Generated: $(date -u +"%Y-%m-%dT%H:%M:%SZ")
# Client: $CLIENT_NAME
# =============================================================================

# Application Settings
APP_PORT=4010
APP_BASE_URL=https://$SIGN_DOMAIN
NODE_ENV=$ENVIRONMENT

# DocuSeal Integration
DOCUSEAL_BASE_URL=http://docuseal-app:3000
DOCUSEAL_WEBHOOK_HMAC_SECRET=$DOCUSEAL_WEBHOOK_HMAC_SECRET
DOCUSEAL_API_TOKEN=${DOCUSEAL_API_TOKEN:-REPLACE_WITH_DOCUSEAL_API_TOKEN}

# PKI Integration Settings
PKI_ENABLED=true
PKI_SESSION_EXPIRY_MINUTES=10
PKI_OTP_MAX_ATTEMPTS=3

# File Storage
SIGNED_FILES_DIR=/data/signed
ORIGINAL_FILES_DIR=/data/original
STAMPED_FILES_DIR=/data/stamped
MAX_UPLOAD_MB=50

# Database Configuration
DATABASE_URL=postgresql://agreements_user:$AGREEMENTS_DB_PASSWORD@agreements-postgres:5432/agreements_db

# MyTrustSigner Agent Configuration
MTSA_ENV=$MTSA_ENV
MTSA_WSDL_PILOT=http://mtsa:8080/MTSAPilot/MyTrustSignerAgentWSAPv2?wsdl
MTSA_WSDL_PROD=http://mtsa:8080/MTSA/MyTrustSignerAgentWSAPv2?wsdl
MTSA_SOAP_USERNAME=${MTSA_SOAP_USERNAME:-REPLACE_WITH_MTSA_USERNAME}
MTSA_SOAP_PASSWORD=${MTSA_SOAP_PASSWORD:-REPLACE_WITH_MTSA_PASSWORD}

# API Authentication
SIGNING_ORCHESTRATOR_API_KEY=${SIGNING_ORCHESTRATOR_API_KEY:-REPLACE_WITH_API_KEY}

# Security
CORS_ORIGINS=https://$SIGN_DOMAIN,https://$API_DOMAIN,https://$APP_DOMAIN,https://$ADMIN_DOMAIN
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Logging
LOG_LEVEL=info
LOG_FORMAT=json

# Timezone
TZ=Asia/Kuala_Lumpur
KUALA_LUMPUR_TZ=Asia/Kuala_Lumpur

# Health Check
HEALTH_CHECK_INTERVAL_MS=30000

# Notification Settings
NOTIFICATION_WEBHOOK_URL=https://$API_DOMAIN/api/signing/notifications
EOF

log_success "Generated: $OUTPUT_DIR/signing-orchestrator/.env"

# Summary
echo ""
echo "=============================================="
echo "  Environment Generation Complete"
echo "=============================================="
echo ""
echo "  Generated files:"
echo "    - $OUTPUT_DIR/.env"
echo "    - $OUTPUT_DIR/signing-orchestrator/.env"
echo ""

if [ ${#MISSING_SECRETS[@]} -gt 0 ]; then
    echo "  Missing secrets (replace placeholders):"
    for secret in "${MISSING_SECRETS[@]}"; do
        echo "    - $secret"
    done
    echo ""
fi

echo "  Next steps:"
echo "    1. Review generated .env files"
echo "    2. Replace any REPLACE_WITH_* placeholders"
echo "    3. Run: docker compose -f docker-compose.unified.yml up -d"
echo ""
echo "=============================================="
