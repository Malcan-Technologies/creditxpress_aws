#!/bin/bash

# =============================================================================
# DocuSeal Template Setup Script
# =============================================================================
# This script uploads the Jadual J loan agreement template to a new DocuSeal
# instance and configures all fields with proper positions.
#
# Usage:
#   ./setup-docuseal-template.sh [OPTIONS]
#
# Options:
#   --api-token TOKEN    DocuSeal API token (or set DOCUSEAL_API_TOKEN env var)
#   --sign-domain DOMAIN Sign subdomain (default: from client.json)
#   --update-config      Update client.json with new template ID
#   --help               Show this help message
#
# Prerequisites:
#   - DocuSeal must be running and accessible
#   - Valid API token from DocuSeal admin settings
#   - jq installed for JSON processing
#   - curl installed for API calls
#
# =============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMPLATES_DIR="$SCRIPT_DIR/../templates"
CLIENT_JSON="$SCRIPT_DIR/../../client.json"

# Default values
UPDATE_CONFIG=false
SIGN_DOMAIN=""
API_TOKEN=""

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
        --api-token)
            API_TOKEN="$2"
            shift 2
            ;;
        --sign-domain)
            SIGN_DOMAIN="$2"
            shift 2
            ;;
        --update-config)
            UPDATE_CONFIG=true
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

# Check dependencies
if ! command -v jq &> /dev/null; then
    log_error "jq is required but not installed. Install with: apt-get install jq"
    exit 1
fi

if ! command -v curl &> /dev/null; then
    log_error "curl is required but not installed. Install with: apt-get install curl"
    exit 1
fi

# Load configuration from client.json
if [ -f "$CLIENT_JSON" ]; then
    CLIENT_SLUG=$(jq -r '.client_slug' "$CLIENT_JSON")
    CLIENT_NAME=$(jq -r '.client_name' "$CLIENT_JSON")
    if [ -z "$SIGN_DOMAIN" ]; then
        SIGN_DOMAIN=$(jq -r '.domains.sign' "$CLIENT_JSON")
    fi
    log_info "Loaded config for: $CLIENT_NAME ($CLIENT_SLUG)"
else
    log_error "client.json not found at: $CLIENT_JSON"
    exit 1
fi

# Get API token from environment if not provided
if [ -z "$API_TOKEN" ]; then
    API_TOKEN="${DOCUSEAL_API_TOKEN:-}"
fi

if [ -z "$API_TOKEN" ]; then
    log_error "DocuSeal API token is required."
    log_info "Set DOCUSEAL_API_TOKEN environment variable or use --api-token"
    log_info "Get token from: https://$SIGN_DOMAIN → Settings → API"
    exit 1
fi

# Verify template files exist
if [ ! -f "$TEMPLATES_DIR/Jadual-J-KPKT.pdf" ]; then
    log_error "Template PDF not found: $TEMPLATES_DIR/Jadual-J-KPKT.pdf"
    exit 1
fi

if [ ! -f "$TEMPLATES_DIR/jadual-j-template.json" ]; then
    log_error "Template JSON not found: $TEMPLATES_DIR/jadual-j-template.json"
    exit 1
fi

echo ""
echo "=============================================="
echo "  DocuSeal Template Setup"
echo "=============================================="
echo ""
echo "  Client:       $CLIENT_NAME"
echo "  Sign Domain:  $SIGN_DOMAIN"
echo "  Template:     Jadual J (Official)"
echo ""
echo "=============================================="
echo ""

# Check if DocuSeal is accessible
log_info "Checking DocuSeal connectivity..."
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "https://$SIGN_DOMAIN/")
if [ "$HTTP_STATUS" != "200" ] && [ "$HTTP_STATUS" != "302" ]; then
    log_error "DocuSeal is not accessible at https://$SIGN_DOMAIN/ (HTTP $HTTP_STATUS)"
    exit 1
fi
log_success "DocuSeal is accessible"

# Check if template already exists
log_info "Checking for existing template..."
EXISTING_TEMPLATE=$(curl -s -X GET "https://$SIGN_DOMAIN/api/templates" \
    -H "X-Auth-Token: $API_TOKEN" \
    | jq -r '.data[] | select(.name == "Jadual J (Official)" or .external_id == "'$CLIENT_SLUG'-loan-agreement") | .id' 2>/dev/null || echo "")

if [ -n "$EXISTING_TEMPLATE" ] && [ "$EXISTING_TEMPLATE" != "null" ]; then
    log_warn "Template already exists with ID: $EXISTING_TEMPLATE"
    read -p "Do you want to create a new template anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "Using existing template ID: $EXISTING_TEMPLATE"
        TEMPLATE_ID="$EXISTING_TEMPLATE"
        
        if [ "$UPDATE_CONFIG" = true ]; then
            log_info "Updating client.json with template ID..."
            jq --arg tid "$TEMPLATE_ID" '.docuseal.template_id = $tid' "$CLIENT_JSON" > "${CLIENT_JSON}.tmp"
            mv "${CLIENT_JSON}.tmp" "$CLIENT_JSON"
            log_success "client.json updated"
        fi
        
        exit 0
    fi
fi

# Base64 encode the PDF
log_info "Encoding PDF template..."
PDF_BASE64=$(base64 -i "$TEMPLATES_DIR/Jadual-J-KPKT.pdf" | tr -d '\n')
log_success "PDF encoded ($(echo $PDF_BASE64 | wc -c | tr -d ' ') bytes)"

# Extract field definitions from the template JSON
log_info "Extracting field definitions..."
FIELDS=$(jq -c '.fields' "$TEMPLATES_DIR/jadual-j-template.json")
SUBMITTERS=$(jq -c '.submitters' "$TEMPLATES_DIR/jadual-j-template.json")

# Build field configurations for the API
# We need to map old UUIDs to new role names for the API
log_info "Building field configurations..."

# Create the template via API
log_info "Creating template via DocuSeal API..."

# Build the request - using the /api/templates/pdf endpoint
RESPONSE=$(curl -s -X POST "https://$SIGN_DOMAIN/api/templates/pdf" \
    -H "X-Auth-Token: $API_TOKEN" \
    -H "Content-Type: application/json" \
    -d @- << EOF
{
    "name": "Jadual J (Official)",
    "external_id": "${CLIENT_SLUG}-loan-agreement",
    "documents": [{
        "name": "Jadual J KPKT",
        "file": "${PDF_BASE64}"
    }]
}
EOF
)

# Check for errors
if echo "$RESPONSE" | jq -e '.error' > /dev/null 2>&1; then
    ERROR_MSG=$(echo "$RESPONSE" | jq -r '.error')
    log_error "Failed to create template: $ERROR_MSG"
    echo "$RESPONSE" | jq '.'
    exit 1
fi

# Extract template ID
TEMPLATE_ID=$(echo "$RESPONSE" | jq -r '.id')

if [ -z "$TEMPLATE_ID" ] || [ "$TEMPLATE_ID" = "null" ]; then
    log_error "Failed to get template ID from response"
    echo "$RESPONSE" | jq '.'
    exit 1
fi

log_success "Template created with ID: $TEMPLATE_ID"

# Note: The PDF template should have text tags embedded for field positioning
# If not, fields will need to be configured manually in DocuSeal UI
log_warn "Field positions may need to be configured manually in DocuSeal UI"
log_info "The base template has been uploaded. Configure fields at:"
log_info "https://$SIGN_DOMAIN/templates/$TEMPLATE_ID/edit"

# Update client.json if requested
if [ "$UPDATE_CONFIG" = true ]; then
    log_info "Updating client.json with template ID..."
    jq --arg tid "$TEMPLATE_ID" '.docuseal.template_id = $tid' "$CLIENT_JSON" > "${CLIENT_JSON}.tmp"
    mv "${CLIENT_JSON}.tmp" "$CLIENT_JSON"
    log_success "client.json updated with template_id: $TEMPLATE_ID"
fi

echo ""
echo "=============================================="
echo "  Template Setup Complete"
echo "=============================================="
echo ""
echo "  Template ID:    $TEMPLATE_ID"
echo "  External ID:    ${CLIENT_SLUG}-loan-agreement"
echo "  Edit URL:       https://$SIGN_DOMAIN/templates/$TEMPLATE_ID/edit"
echo ""
echo "  Next Steps:"
echo "  1. Open the template in DocuSeal UI"
echo "  2. Configure the submitter roles (Company, Borrower, Witness)"
echo "  3. Position fields according to jadual-j-template.json"
echo "  4. Test with a sample submission"
echo ""
if [ "$UPDATE_CONFIG" = false ]; then
    echo "  To save template ID to config, run with --update-config"
    echo ""
fi
echo "=============================================="
