#!/bin/bash

# =============================================================================
# Deploy MTSA Integration for Production On-Premises (Kapital.my)
# =============================================================================

set -e

echo "🚀 Starting MTSA Integration Production Deployment..."

COMPOSE_FILE="docker-compose.mtsa-prod.yml"
ENV_FILE="env.production"

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

# Define production directories in user home
KAPITAL_HOME="$HOME/kapital"
BACKUP_DIR="$HOME/kapital-backups"

# Create production directories
echo "📁 Creating production directories..."
mkdir -p "$KAPITAL_HOME/agreements/signed"
mkdir -p "$KAPITAL_HOME/agreements/original"  
mkdir -p "$KAPITAL_HOME/agreements/stamped"
mkdir -p "$KAPITAL_HOME/agreements/postgres"
mkdir -p "$KAPITAL_HOME/logs/signing-orchestrator"
mkdir -p "$KAPITAL_HOME/logs/postgres"
mkdir -p "$BACKUP_DIR"

echo "✅ Created directories:"
echo "   - $KAPITAL_HOME/agreements/"
echo "   - $KAPITAL_HOME/logs/"
echo "   - $BACKUP_DIR/"

# Check if environment file exists
if [ ! -f "$ENV_FILE" ]; then
    echo "❌ env.production file not found!"
    echo "Please ensure env.production exists with proper configuration."
    exit 1
fi

# Check if production credentials are configured
if grep -Eq "your_production_mtsa_username|your_production_mtsa_password" "$ENV_FILE"; then
    echo "⚠️  Please configure your production credentials in env.production file:"
    echo "   - MTSA_SOAP_USERNAME"
    echo "   - MTSA_SOAP_PASSWORD"
    echo "   - DOCUSEAL_WEBHOOK_HMAC_SECRET"
    echo "   - DOCUSEAL_API_TOKEN"
    exit 1
fi

if ! grep -q "^MTSA_ENV=prod$" "$ENV_FILE"; then
    echo "❌ MTSA_ENV must be set to 'prod' in $ENV_FILE"
    exit 1
fi

# Backup existing deployment
if docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" ps | grep -q "Up"; then
    echo "💾 Creating backup of current deployment..."
    timestamp=$(date +%Y%m%d_%H%M%S)
    mkdir -p "$BACKUP_DIR/$timestamp"
    if [ -d "$KAPITAL_HOME/agreements/signed" ]; then
        cp -r "$KAPITAL_HOME/agreements/signed" "$BACKUP_DIR/$timestamp/"
    fi
    echo "Backup created at $BACKUP_DIR/$timestamp/"
fi

# Stop existing containers
echo "🛑 Stopping existing containers..."
docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" down

# Pull latest images and build
echo "🏗️  Building and starting production services..."
docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --build

# Wait for services to be healthy
echo "⏳ Waiting for services to become healthy..."
timeout 180 bash -c '
    while true; do
        if docker-compose -f "'"$COMPOSE_FILE"'" --env-file "'"$ENV_FILE"'" ps | grep -q "Up (healthy)"; then
            echo "Services are healthy!"
            break
        fi
        echo "Waiting for services to start..."
        sleep 10
    done
'

# Check service status
echo "📊 Service Status:"
docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" ps

# Test Signing Orchestrator health endpoint
echo "🧪 Testing Signing Orchestrator health endpoint..."
if curl -f -s "http://localhost:4010/health" > /dev/null; then
    echo "✅ Signing Orchestrator is healthy"
else
    echo "❌ Signing Orchestrator is not healthy"
    echo "Please check the logs: docker-compose -f $COMPOSE_FILE --env-file $ENV_FILE logs signing-orchestrator"
fi

# Test revoke endpoint (with invalid API key - should return auth error)
echo "🧪 Testing certificate revocation endpoint..."
if curl -f -s -X POST "http://localhost:4010/api/revoke" \
    -H "Content-Type: application/json" \
    -H "X-API-Key: test" \
    -d '{}' 2>/dev/null | grep -q "Unauthorized"; then
    echo "✅ Revoke endpoint is accessible and secured"
else
    echo "❌ Revoke endpoint test failed"
    echo "Please check the logs: docker-compose -f $COMPOSE_FILE --env-file $ENV_FILE logs signing-orchestrator"
fi

echo ""
echo "🎉 MTSA Integration Production Deployment Complete!"
echo ""
echo "📋 Production Setup Summary:"
echo "✅ Services running on:"
echo "   - Signing Orchestrator: http://localhost:4010"
echo "   - PostgreSQL Database: localhost:5434"
echo "   - MTSA Production WSDL: http://localhost:8082/MTSA/MyTrustSignerAgentWSAPv2?wsdl"
echo ""
echo "✅ Data directories:"
echo "   - Agreements: $KAPITAL_HOME/agreements/"
echo "   - Logs: $KAPITAL_HOME/logs/"
echo "   - Backups: $BACKUP_DIR/"
echo ""
echo "✅ Available endpoints:"
echo "   - Health check: /health"
echo "   - Certificate request: /api/request"
echo "   - Certificate revocation: /api/revoke"
echo "   - PDF signing: /api/sign"
echo ""
echo "📋 Next Steps:"
echo "1. Test certificate enrollment from admin panel"
echo "2. Test certificate revocation functionality"
echo "3. Verify backend API integration"
echo ""
echo "🔍 Useful Commands:"
echo "   View logs: docker-compose -f $COMPOSE_FILE --env-file $ENV_FILE logs -f"
echo "   Restart services: docker-compose -f $COMPOSE_FILE --env-file $ENV_FILE restart"
echo "   Stop services: docker-compose -f $COMPOSE_FILE --env-file $ENV_FILE down"
echo "   Health check: curl http://localhost:4010/health"
echo "   MTSA prod WSDL: curl http://localhost:8082/MTSA/MyTrustSignerAgentWSAPv2?wsdl"
echo "   Test revoke endpoint: curl -X POST http://localhost:4010/api/revoke -H 'X-API-Key: test'"
echo ""
