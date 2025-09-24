#!/bin/bash

# =============================================================================
# Automated Signing Orchestrator Deployment to On-Premises Production
# =============================================================================

set -e

# Configuration
REMOTE_HOST="admin-kapital@100.76.8.62"
REMOTE_DIR="~/signing-orchestrator"
LOCAL_DIR="."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Starting Automated Signing Orchestrator Deployment...${NC}"

# Check if we're in the right directory
if [ ! -f "package.json" ] || [ ! -f "docker-compose.yml" ]; then
    echo -e "${RED}❌ Please run this script from the signing-orchestrator directory${NC}"
    exit 1
fi

# Check if remote host is reachable
echo -e "${YELLOW}🔍 Checking remote host connectivity...${NC}"
if ! ssh -o ConnectTimeout=10 "$REMOTE_HOST" "echo 'Connected successfully'" >/dev/null 2>&1; then
    echo -e "${RED}❌ Cannot connect to remote host: $REMOTE_HOST${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Remote host is reachable${NC}"

# Step 1: Stop services on remote
echo -e "${YELLOW}🛑 Stopping services on remote server...${NC}"
ssh "$REMOTE_HOST" "cd $REMOTE_DIR && docker-compose down" || true

# Step 2: Create backup
echo -e "${YELLOW}💾 Creating backup on remote server...${NC}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
ssh "$REMOTE_HOST" "
    mkdir -p ~/kapital-backups/$TIMESTAMP
    if [ -d ~/kapital/agreements/signed ]; then
        cp -r ~/kapital/agreements/signed ~/kapital-backups/$TIMESTAMP/ 2>/dev/null || true
    fi
    echo 'Backup created at ~/kapital-backups/$TIMESTAMP'
"

# Step 3: Copy source files
echo -e "${YELLOW}📋 Copying source files to remote server...${NC}"

# Copy core application files
rsync -av --exclude='node_modules' \
          --exclude='dist' \
          --exclude='data' \
          --exclude='.git' \
          --exclude='logs' \
          --exclude='*.log' \
          --exclude='.env' \
          "$LOCAL_DIR/" "$REMOTE_HOST:$REMOTE_DIR/"

echo -e "${GREEN}✅ Files copied successfully${NC}"

# Step 4: Ensure environment file exists
echo -e "${YELLOW}⚙️  Checking environment configuration...${NC}"
ssh "$REMOTE_HOST" "
    cd $REMOTE_DIR
    if [ ! -f env.production ]; then
        echo '❌ env.production file missing!'
        exit 1
    fi
    
    # Remove old Docker volume paths and add new ones
    sed -i '/^SIGNED_FILES_HOST_DIR=/d' env.production
    sed -i '/^ORIGINAL_FILES_HOST_DIR=/d' env.production
    sed -i '/^STAMPED_FILES_HOST_DIR=/d' env.production
    sed -i '/^LOGS_HOST_DIR=/d' env.production
    sed -i '/^AGREEMENTS_DB_HOST_DIR=/d' env.production
    sed -i '/^AGREEMENTS_LOGS_HOST_DIR=/d' env.production
    
    # Add Docker volume paths
    cat >> env.production << 'EOF'

# Docker Volume Host Paths (Auto-generated)
SIGNED_FILES_HOST_DIR=/home/admin-kapital/kapital/agreements/signed
ORIGINAL_FILES_HOST_DIR=/home/admin-kapital/kapital/agreements/original
STAMPED_FILES_HOST_DIR=/home/admin-kapital/kapital/agreements/stamped
LOGS_HOST_DIR=/home/admin-kapital/kapital/logs/signing-orchestrator
AGREEMENTS_DB_HOST_DIR=/home/admin-kapital/kapital/agreements/postgres
AGREEMENTS_LOGS_HOST_DIR=/home/admin-kapital/kapital/logs/postgres
EOF
    
    echo '✅ Environment configured with correct paths'
"

# Step 5: Create required directories
echo -e "${YELLOW}📁 Creating required directories...${NC}"
ssh "$REMOTE_HOST" "
    mkdir -p ~/kapital/agreements/{signed,original,stamped,postgres}
    mkdir -p ~/kapital/logs/{signing-orchestrator,postgres}
    mkdir -p ~/kapital-backups
    echo '✅ Directories created'
"

# Step 6: Deploy with timeout
echo -e "${YELLOW}🏗️  Building and starting services...${NC}"
ssh "$REMOTE_HOST" "
    cd $REMOTE_DIR
    
    # Fix .dockerignore to exclude problematic directories
    echo 'data/' >> .dockerignore
    echo 'logs/' >> .dockerignore
    echo 'node_modules/' >> .dockerignore
    echo '.git/' >> .dockerignore
    
    # Remove old volumes to avoid conflicts
    docker volume ls -q | grep signing-orchestrator | xargs -r docker volume rm 2>/dev/null || true
    
    # Start services with timeout
    timeout 300 docker-compose --env-file env.production up -d --build
" &

# Monitor the deployment
DEPLOY_PID=$!
echo -e "${BLUE}⏳ Waiting for deployment to complete (max 5 minutes)...${NC}"

# Wait for deployment with progress indicator
for i in {1..30}; do
    if ! kill -0 $DEPLOY_PID 2>/dev/null; then
        break
    fi
    echo -ne "${YELLOW}⏳ Deploying... ${i}/30${NC}\r"
    sleep 10
done

# Check if deployment completed
if kill -0 $DEPLOY_PID 2>/dev/null; then
    echo -e "\n${RED}⚠️  Deployment is taking longer than expected...${NC}"
    echo -e "${YELLOW}Checking current status...${NC}"
fi

wait $DEPLOY_PID
DEPLOY_EXIT_CODE=$?

if [ $DEPLOY_EXIT_CODE -ne 0 ]; then
    echo -e "${RED}❌ Deployment failed with exit code $DEPLOY_EXIT_CODE${NC}"
    echo -e "${YELLOW}Checking service status...${NC}"
    ssh "$REMOTE_HOST" "cd $REMOTE_DIR && docker-compose ps"
    exit 1
fi

# Step 7: Verify deployment
echo -e "${YELLOW}🧪 Verifying deployment...${NC}"
sleep 10

# Check service status
SERVICE_STATUS=$(ssh "$REMOTE_HOST" "cd $REMOTE_DIR && docker-compose ps --format json" 2>/dev/null || echo "[]")

if echo "$SERVICE_STATUS" | grep -q '"State":"running"'; then
    echo -e "${GREEN}✅ Services are running${NC}"
else
    echo -e "${RED}❌ Some services may not be running properly${NC}"
    ssh "$REMOTE_HOST" "cd $REMOTE_DIR && docker-compose ps"
fi

# Test health endpoint
echo -e "${YELLOW}🧪 Testing health endpoint...${NC}"
if ssh "$REMOTE_HOST" "curl -f -s http://localhost:4010/health" >/dev/null 2>&1; then
    echo -e "${GREEN}✅ Signing Orchestrator is healthy${NC}"
else
    echo -e "${RED}❌ Health check failed${NC}"
    echo -e "${YELLOW}Checking logs...${NC}"
    ssh "$REMOTE_HOST" "cd $REMOTE_DIR && docker-compose logs --tail 20 signing-orchestrator"
fi

# Test revoke endpoint
echo -e "${YELLOW}🧪 Testing revoke endpoint...${NC}"
if ssh "$REMOTE_HOST" "curl -f -s -X POST http://localhost:4010/api/revoke -H 'Content-Type: application/json' -H 'X-API-Key: test' -d '{}'" 2>/dev/null | grep -q "Unauthorized"; then
    echo -e "${GREEN}✅ Revoke endpoint is accessible and secured${NC}"
else
    echo -e "${RED}❌ Revoke endpoint test failed${NC}"
fi

# Final status
echo -e "\n${GREEN}🎉 Deployment Complete!${NC}"
echo -e "${BLUE}📋 Summary:${NC}"
echo -e "   🏠 Remote Host: $REMOTE_HOST"
echo -e "   📁 Remote Directory: $REMOTE_DIR"
echo -e "   💾 Backup: ~/kapital-backups/$TIMESTAMP"
echo -e "   🌐 Health Check: http://localhost:4010/health"
echo -e "   🔐 Revoke Endpoint: http://localhost:4010/api/revoke"

echo -e "\n${YELLOW}🔍 Useful Commands:${NC}"
echo -e "   View logs: ssh $REMOTE_HOST 'cd $REMOTE_DIR && docker-compose logs -f'"
echo -e "   Check status: ssh $REMOTE_HOST 'cd $REMOTE_DIR && docker-compose ps'"
echo -e "   Restart: ssh $REMOTE_HOST 'cd $REMOTE_DIR && docker-compose restart'"
echo -e "   Stop: ssh $REMOTE_HOST 'cd $REMOTE_DIR && docker-compose down'"

echo -e "\n${GREEN}✅ Ready for testing!${NC}"
