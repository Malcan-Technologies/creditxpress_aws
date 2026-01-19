#!/bin/bash

# =============================================================================
# MTSA Container Import Script
# =============================================================================
# Imports the MyTrustSigner Agent (MTSA) Docker container provided by Trustgate.
# The container is provided as a Docker image tarball that needs to be loaded
# and tagged for use with our docker-compose setup.
#
# Usage:
#   ./import-mtsa-container.sh <path-to-image.tar> [OPTIONS]
#
# Options:
#   --tag TAG        Custom tag for the image (default: from client.json)
#   --verify         Verify the container after import by starting it
#   --help           Show this help message
#
# Example:
#   ./import-mtsa-container.sh /tmp/mtsa-pilot-container.tar
#   ./import-mtsa-container.sh /tmp/mtsa-prod.tar --tag mtsa-prod:1.0
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
CLIENT_JSON="$SCRIPT_DIR/../../client.json"

# Default values
IMAGE_FILE=""
CUSTOM_TAG=""
VERIFY=false

# Logging functions
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

show_help() {
    head -22 "$0" | tail -17
    exit 0
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --tag)
            CUSTOM_TAG="$2"
            shift 2
            ;;
        --verify)
            VERIFY=true
            shift
            ;;
        --help)
            show_help
            ;;
        -*)
            log_error "Unknown option: $1"
            show_help
            ;;
        *)
            if [ -z "$IMAGE_FILE" ]; then
                IMAGE_FILE="$1"
            fi
            shift
            ;;
    esac
done

# Validate input
if [ -z "$IMAGE_FILE" ]; then
    log_error "Image file is required"
    echo ""
    echo "Usage: $0 <path-to-image.tar> [OPTIONS]"
    exit 1
fi

if [ ! -f "$IMAGE_FILE" ]; then
    log_error "Image file not found: $IMAGE_FILE"
    exit 1
fi

# Check Docker is available
if ! command -v docker &> /dev/null; then
    log_error "Docker is required but not installed"
    exit 1
fi

# Load client configuration
if [ -f "$CLIENT_JSON" ] && command -v jq &> /dev/null; then
    CLIENT_SLUG=$(jq -r '.client_slug' "$CLIENT_JSON")
    MTSA_ENV=$(jq -r '.onprem.mtsa.env // "pilot"' "$CLIENT_JSON")
    MTSA_IMAGE=$(jq -r '.onprem.mtsa.container_image // ""' "$CLIENT_JSON")
    log_info "Loaded config for: $CLIENT_SLUG"
else
    CLIENT_SLUG="client"
    MTSA_ENV="pilot"
    MTSA_IMAGE=""
    log_warn "client.json not found, using defaults"
fi

# Determine target tag
if [ -n "$CUSTOM_TAG" ]; then
    TARGET_TAG="$CUSTOM_TAG"
elif [ -n "$MTSA_IMAGE" ] && [ "$MTSA_IMAGE" != "null" ]; then
    TARGET_TAG="$MTSA_IMAGE"
else
    TARGET_TAG="mtsa-${MTSA_ENV}:latest"
fi

echo ""
echo "=============================================="
echo "  MTSA Container Import"
echo "=============================================="
echo ""
echo "  Image File:   $IMAGE_FILE"
echo "  Target Tag:   $TARGET_TAG"
echo "  Environment:  $MTSA_ENV"
echo ""
echo "=============================================="
echo ""

# Load the Docker image
log_info "Loading Docker image from: $IMAGE_FILE"
log_info "This may take a few minutes..."

LOAD_OUTPUT=$(docker load -i "$IMAGE_FILE" 2>&1)
echo "$LOAD_OUTPUT"

# Extract the loaded image name from output
# Docker load outputs: "Loaded image: repository:tag" or "Loaded image ID: sha256:..."
LOADED_IMAGE=$(echo "$LOAD_OUTPUT" | grep -oP 'Loaded image: \K[^\s]+' | head -1)

if [ -z "$LOADED_IMAGE" ]; then
    # Try to extract image ID if named image wasn't found
    LOADED_ID=$(echo "$LOAD_OUTPUT" | grep -oP 'Loaded image ID: sha256:\K[a-f0-9]+' | head -1)
    if [ -n "$LOADED_ID" ]; then
        LOADED_IMAGE="sha256:$LOADED_ID"
        log_info "Loaded image with ID: $LOADED_IMAGE"
    else
        log_error "Could not determine loaded image"
        log_info "Please check docker images and tag manually"
        exit 1
    fi
fi

log_success "Image loaded: $LOADED_IMAGE"

# Tag the image for our use
if [ "$LOADED_IMAGE" != "$TARGET_TAG" ]; then
    log_info "Tagging image as: $TARGET_TAG"
    docker tag "$LOADED_IMAGE" "$TARGET_TAG"
    log_success "Image tagged: $TARGET_TAG"
fi

# Also tag with client-specific name for clarity
CLIENT_TAG="${CLIENT_SLUG}-mtsa:latest"
if [ "$TARGET_TAG" != "$CLIENT_TAG" ]; then
    log_info "Tagging image as: $CLIENT_TAG"
    docker tag "$LOADED_IMAGE" "$CLIENT_TAG"
    log_success "Image tagged: $CLIENT_TAG"
fi

# Verify the image
log_info "Verifying imported image..."
docker images | grep -E "(mtsa|$CLIENT_SLUG)" | head -5

# Optionally start the container to verify it works
if [ "$VERIFY" = true ]; then
    log_info "Starting container for verification..."
    
    CONTAINER_NAME="mtsa-verify-$$"
    
    docker run -d --name "$CONTAINER_NAME" -p 8081:8080 "$TARGET_TAG"
    
    log_info "Waiting for container to start..."
    sleep 10
    
    # Check if WSDL endpoint is accessible
    if curl -s -f "http://localhost:8081/MTSA${MTSA_ENV^}/MyTrustSignerAgentWSAPv2?wsdl" > /dev/null 2>&1 || \
       curl -s -f "http://localhost:8081/MTSAPilot/MyTrustSignerAgentWSAPv2?wsdl" > /dev/null 2>&1; then
        log_success "MTSA WSDL endpoint is accessible"
    else
        log_warn "WSDL endpoint not accessible (container may still be starting)"
    fi
    
    # Show container logs
    log_info "Container logs:"
    docker logs "$CONTAINER_NAME" 2>&1 | tail -20
    
    # Clean up
    log_info "Stopping verification container..."
    docker stop "$CONTAINER_NAME" > /dev/null
    docker rm "$CONTAINER_NAME" > /dev/null
    log_success "Verification container cleaned up"
fi

echo ""
echo "=============================================="
echo "  Import Complete"
echo "=============================================="
echo ""
echo "  Image Tags:"
echo "    - $TARGET_TAG"
echo "    - $CLIENT_TAG"
echo ""
echo "  Next Steps:"
echo "    1. Update .env with: MTSA_CONTAINER_IMAGE=$TARGET_TAG"
echo "    2. Run: docker compose -f docker-compose.unified.yml up -d"
echo "    3. Verify: curl http://localhost:8080/MTSAPilot/MyTrustSignerAgentWSAPv2?wsdl"
echo ""
echo "=============================================="
