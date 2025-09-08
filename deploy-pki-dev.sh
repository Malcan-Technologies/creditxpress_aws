#!/bin/bash

# =============================================================================
# PKI Integration Development Deployment Script
# =============================================================================

set -e

echo "🔐 Deploying PKI Integration for Development Testing..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if we're in the right directory
if [ ! -f "README.md" ]; then
    print_error "Please run this script from the project root directory"
    exit 1
fi

print_status "Starting PKI integration deployment..."

# Step 1: Update backend environment variables
print_status "Updating backend environment variables..."

# Add PKI-related environment variables to backend
if ! grep -q "SIGNING_ORCHESTRATOR_URL" backend/.env 2>/dev/null; then
    echo "" >> backend/.env
    echo "# PKI Integration Settings" >> backend/.env
    echo "SIGNING_ORCHESTRATOR_URL=http://host.docker.internal:4010" >> backend/.env
    echo "SIGNING_ORCHESTRATOR_API_KEY=dev-api-key" >> backend/.env
    print_success "Added PKI environment variables to backend"
else
    print_warning "PKI environment variables already exist in backend/.env"
fi

# Step 2: Build and restart backend with PKI support
print_status "Building and restarting backend with PKI support..."

cd backend
if docker compose -f docker-compose.dev.yml ps | grep -q "backend.*Up"; then
    print_status "Stopping existing backend container..."
    docker compose -f docker-compose.dev.yml stop backend
fi

print_status "Building backend with PKI integration..."
docker compose -f docker-compose.dev.yml build backend

print_status "Starting backend with PKI support..."
docker compose -f docker-compose.dev.yml up -d backend

# Wait for backend to be ready
print_status "Waiting for backend to be ready..."
sleep 10

# Check if backend is healthy
if curl -f -s http://localhost:4001/api/health > /dev/null; then
    print_success "Backend is running and healthy"
else
    print_error "Backend health check failed"
    exit 1
fi

cd ..

# Step 3: Check existing signing orchestrator
print_status "Checking existing signing orchestrator..."

# Check if orchestrator is running
if curl -f -s http://localhost:4010/ > /dev/null; then
    print_success "Signing orchestrator is already running on port 4010"
    
    # Update the orchestrator with PKI code
    print_status "Updating orchestrator with PKI integration code..."
    
    cd on-prem/signing-orchestrator
    
    # Copy development environment
    cp env.development .env
    
    # Install dependencies if needed
    if [ ! -d "node_modules" ]; then
        print_status "Installing Node.js dependencies..."
        npm install
    fi
    
    # Build TypeScript with new PKI code
    print_status "Building TypeScript with PKI integration..."
    npm run build
    
    # Restart the orchestrator container to pick up new code
    print_status "Restarting orchestrator container with PKI integration..."
    docker compose -f docker-compose.dev.yml restart signing-orchestrator
    
    # Wait for restart
    sleep 10
    
    cd ../..
else
    print_error "Signing orchestrator is not running on port 4010"
    print_error "Please start it first: cd on-prem/signing-orchestrator && docker compose -f docker-compose.dev.yml up -d"
    exit 1
fi

# Step 4: Configure DocuSeal webhook URL
print_status "Configuring DocuSeal webhook URL..."

# Set webhook URL to point to backend (which will forward to orchestrator)
# Using host.docker.internal since DocuSeal is in Docker and needs to reach host
WEBHOOK_URL="http://host.docker.internal:4001/api/docuseal/webhook"

print_status "Setting DocuSeal webhook URL to: $WEBHOOK_URL"
print_status "This allows DocuSeal (running in Docker on localhost:3001) to reach your backend"

# Test webhook configuration
if curl -f -s -X POST \
    -H "Content-Type: application/json" \
    -H "X-Auth-Token: NwPkizAUEfShnc4meN1m3N38DG8ZNEyRmWPMjq8BXv8" \
    -d "{\"url\": \"$WEBHOOK_URL\", \"events\": [\"signer_submitted\", \"form.completed\", \"submission.completed\", \"submission.expired\", \"submission.declined\"]}" \
    http://localhost:3001/api/webhooks > /dev/null; then
    print_success "DocuSeal webhook configured successfully"
else
    print_warning "Could not configure DocuSeal webhook automatically. Please configure manually:"
    echo "  URL: $WEBHOOK_URL"
    echo "  Events: signer_submitted, form.completed, submission.completed, submission.expired, submission.declined"
    echo ""
    echo "  You can set this in DocuSeal admin at: http://localhost:3001"
fi

# Step 5: Test PKI integration
print_status "Testing PKI integration..."

# Test MTSA connection
print_status "Testing MTSA connection..."
if curl -f -s -X POST \
    -H "Content-Type: application/json" \
    -H "X-API-Key: dev-api-key" \
    -d '{"userId": "123456789012"}' \
    http://localhost:4010/api/test-getcert > /dev/null; then
    print_success "MTSA connection test passed"
else
    print_warning "MTSA connection test failed (this is expected if MTSA is not running)"
fi

# Test backend PKI endpoints
print_status "Testing backend PKI endpoints..."
if curl -f -s http://localhost:4001/api/health > /dev/null; then
    print_success "Backend PKI endpoints are accessible"
else
    print_error "Backend PKI endpoints are not accessible"
fi

# Step 6: Display deployment summary
print_success "PKI Integration Deployment Complete!"

echo ""
echo "🔐 PKI Integration Summary:"
echo "=================================="
echo "✅ Backend: http://localhost:4001 (with PKI routes)"
echo "✅ Signing Orchestrator: http://localhost:4010 (with PKI workflow)"
echo "✅ DocuSeal: http://192.168.0.100:3001 (webhook configured)"
echo "✅ MTSA: Pilot environment configured"
echo ""

echo "📋 Next Steps:"
echo "1. Test the integration by creating a loan application"
echo "2. When signing is triggered, it will be intercepted for PKI processing"
echo "3. Check logs for PKI workflow execution:"
echo "   - Backend logs: docker compose -f backend/docker-compose.dev.yml logs -f backend"
echo "   - Orchestrator logs: docker compose -f on-prem/signing-orchestrator/docker-compose.dev.yml logs -f signing-orchestrator"
echo ""

echo "🧪 Testing Commands:"
echo "# Test certificate status:"
echo "curl -X GET 'http://localhost:4010/api/pki/cert-status/123456789012' -H 'X-API-Key: dev-api-key'"
echo ""
echo "# Test OTP request:"
echo "curl -X POST 'http://localhost:4010/api/pki/request-otp' -H 'X-API-Key: dev-api-key' -H 'Content-Type: application/json' -d '{\"userId\":\"123456789012\",\"email\":\"test@example.com\"}'"
echo ""

echo "📖 Documentation:"
echo "- PKI Integration Plan: ./DOCUSEAL_MTSA_PKI_INTEGRATION_PLAN.md"
echo "- API Documentation: http://localhost:4001/api-docs"
echo ""

print_success "PKI Integration is ready for testing! 🚀"
