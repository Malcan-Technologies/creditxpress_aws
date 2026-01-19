#!/bin/bash

# =============================================================================
# DocuSeal Template Export Script
# =============================================================================
# Exports an existing DocuSeal template configuration for reuse with new clients.
# The exported JSON contains field definitions, positions, and submitter roles.
#
# Usage:
#   ./export-docuseal-template.sh [OPTIONS]
#
# Options:
#   --template-id ID     Template ID to export (default: from client.json)
#   --api-token TOKEN    DocuSeal API token (or set DOCUSEAL_API_TOKEN env var)
#   --output FILE        Output file (default: ../templates/exported-template.json)
#   --download-pdf       Also download the source PDF
#   --help               Show this help message
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
TEMPLATES_DIR="$SCRIPT_DIR/../templates"
CLIENT_JSON="$SCRIPT_DIR/../../client.json"

# Default values
TEMPLATE_ID=""
API_TOKEN=""
OUTPUT_FILE="$TEMPLATES_DIR/exported-template.json"
DOWNLOAD_PDF=false

# Logging functions
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

show_help() {
    head -20 "$0" | tail -15
    exit 0
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --template-id)
            TEMPLATE_ID="$2"
            shift 2
            ;;
        --api-token)
            API_TOKEN="$2"
            shift 2
            ;;
        --output)
            OUTPUT_FILE="$2"
            shift 2
            ;;
        --download-pdf)
            DOWNLOAD_PDF=true
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
    log_error "jq is required. Install with: apt-get install jq"
    exit 1
fi

# Load from client.json
if [ -f "$CLIENT_JSON" ]; then
    SIGN_DOMAIN=$(jq -r '.domains.sign' "$CLIENT_JSON")
    if [ -z "$TEMPLATE_ID" ]; then
        TEMPLATE_ID=$(jq -r '.docuseal.template_id' "$CLIENT_JSON")
    fi
else
    log_error "client.json not found"
    exit 1
fi

# Get API token
if [ -z "$API_TOKEN" ]; then
    API_TOKEN="${DOCUSEAL_API_TOKEN:-}"
fi

if [ -z "$API_TOKEN" ]; then
    log_error "API token required. Set DOCUSEAL_API_TOKEN or use --api-token"
    exit 1
fi

if [ -z "$TEMPLATE_ID" ] || [ "$TEMPLATE_ID" = "null" ]; then
    log_error "Template ID required. Set in client.json or use --template-id"
    exit 1
fi

echo ""
log_info "Exporting template ID: $TEMPLATE_ID from $SIGN_DOMAIN"

# Create templates directory if needed
mkdir -p "$TEMPLATES_DIR"

# Fetch template
RESPONSE=$(curl -s -X GET "https://$SIGN_DOMAIN/api/templates/$TEMPLATE_ID" \
    -H "X-Auth-Token: $API_TOKEN")

# Check for errors
if echo "$RESPONSE" | jq -e '.error' > /dev/null 2>&1; then
    ERROR_MSG=$(echo "$RESPONSE" | jq -r '.error')
    log_error "Failed to fetch template: $ERROR_MSG"
    exit 1
fi

# Save template JSON
echo "$RESPONSE" | jq '.' > "$OUTPUT_FILE"
log_success "Template exported to: $OUTPUT_FILE"

# Download PDF if requested
if [ "$DOWNLOAD_PDF" = true ]; then
    PDF_URL=$(echo "$RESPONSE" | jq -r '.documents[0].url')
    PDF_NAME=$(echo "$RESPONSE" | jq -r '.documents[0].filename' | sed 's/ /-/g')
    
    if [ -n "$PDF_URL" ] && [ "$PDF_URL" != "null" ]; then
        log_info "Downloading PDF: $PDF_NAME"
        curl -s -L "$PDF_URL" -o "$TEMPLATES_DIR/$PDF_NAME"
        log_success "PDF saved to: $TEMPLATES_DIR/$PDF_NAME"
    else
        log_warn "No PDF URL found in template"
    fi
fi

# Display summary
TEMPLATE_NAME=$(echo "$RESPONSE" | jq -r '.name')
FIELD_COUNT=$(echo "$RESPONSE" | jq '.fields | length')
SUBMITTER_COUNT=$(echo "$RESPONSE" | jq '.submitters | length')

echo ""
echo "=============================================="
echo "  Export Complete"
echo "=============================================="
echo ""
echo "  Template:    $TEMPLATE_NAME"
echo "  Fields:      $FIELD_COUNT"
echo "  Submitters:  $SUBMITTER_COUNT"
echo "  Output:      $OUTPUT_FILE"
echo ""
echo "=============================================="
