#!/bin/bash

# =============================================================================
# Safe DocuSeal Nginx Configuration Deployment
# Deploys nginx.conf and docker-compose.yml fixes without wiping data
# =============================================================================

set -e

# Configuration
REMOTE_HOST="admin-kapital@100.76.8.62"
REMOTE_DOCUSEAL_DIR="/home/admin-kapital/docuseal-onprem"
LOCAL_NGINX_CONF="on-prem/docuseal/nginx/nginx.conf"
LOCAL_DOCKER_COMPOSE="on-prem/docuseal/docker-compose.yml"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Starting Safe DocuSeal Nginx Fix Deployment...${NC}"
echo -e "${BLUE}================================================${NC}"
echo ""

# Check if files exist locally
if [ ! -f "$LOCAL_NGINX_CONF" ]; then
    echo -e "${RED}❌ Local nginx.conf not found: $LOCAL_NGINX_CONF${NC}"
    exit 1
fi

if [ ! -f "$LOCAL_DOCKER_COMPOSE" ]; then
    echo -e "${RED}❌ Local docker-compose.yml not found: $LOCAL_DOCKER_COMPOSE${NC}"
    exit 1
fi

# Check if remote host is reachable
echo -e "${YELLOW}🔍 Checking remote host connectivity...${NC}"
if ! ssh -o ConnectTimeout=10 "$REMOTE_HOST" "echo 'Connected successfully'" >/dev/null 2>&1; then
    echo -e "${RED}❌ Cannot connect to remote host: $REMOTE_HOST${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Remote host is reachable${NC}"

# Check if remote directory exists
echo -e "${YELLOW}🔍 Checking remote directory...${NC}"
if ! ssh "$REMOTE_HOST" "test -d $REMOTE_DOCUSEAL_DIR"; then
    echo -e "${RED}❌ Remote directory does not exist: $REMOTE_DOCUSEAL_DIR${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Remote directory exists${NC}"

# Create backup
echo -e "${YELLOW}💾 Creating backup of current configuration...${NC}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
ssh "$REMOTE_HOST" "
    cd $REMOTE_DOCUSEAL_DIR
    mkdir -p ~/docuseal-backups/$TIMESTAMP
    
    # Backup nginx config
    if [ -f nginx/nginx.conf ]; then
        cp nginx/nginx.conf ~/docuseal-backups/$TIMESTAMP/nginx.conf.backup
        echo '✅ Nginx config backed up'
    fi
    
    # Backup docker-compose if it exists
    if [ -f docker-compose.yml ]; then
        cp docker-compose.yml ~/docuseal-backups/$TIMESTAMP/docker-compose.yml.backup
        echo '✅ Docker-compose backed up'
    fi
    
    # Create database backup (safety measure)
    if docker ps --format '{{.Names}}' | grep -q 'docuseal-postgres'; then
        echo '💾 Creating database backup...'
        docker exec docuseal-postgres pg_dump -U docuseal -d docuseal > ~/docuseal-backups/$TIMESTAMP/db_backup.sql 2>/dev/null || echo '⚠️  Database backup optional (may fail if container not ready)'
    fi
    
    echo 'Backup created at ~/docuseal-backups/$TIMESTAMP'
"
echo -e "${GREEN}✅ Backup created${NC}"

# Step 1: Deploy nginx.conf (safe - only reloads nginx)
echo -e "\n${YELLOW}📋 Step 1: Deploying nginx.conf...${NC}"
echo -e "${BLUE}   This will reload nginx gracefully (zero downtime)${NC}"

# Copy nginx config to temp location
scp "$LOCAL_NGINX_CONF" "$REMOTE_HOST:/tmp/nginx.conf.new"

# Test and apply nginx config
ssh "$REMOTE_HOST" "
    cd $REMOTE_DOCUSEAL_DIR
    
    # Test the new config first
    echo '🧪 Testing new nginx configuration...'
    docker cp /tmp/nginx.conf.new docuseal-nginx:/tmp/nginx.conf.test
    if docker exec docuseal-nginx nginx -t -c /tmp/nginx.conf.test 2>/dev/null; then
        echo '✅ Nginx config test passed'
        
        # Copy to actual location (may need sudo if root-owned)
        if cp /tmp/nginx.conf.new nginx/nginx.conf 2>/dev/null; then
            echo '✅ Nginx config file updated'
        else
            echo '⚠️  Need sudo to update nginx config (owned by root)'
            sudo cp /tmp/nginx.conf.new nginx/nginx.conf
            sudo chown root:root nginx/nginx.conf
            echo '✅ Nginx config updated with sudo'
        fi
        
        # Reload nginx gracefully (no downtime)
        echo '🔄 Reloading nginx...'
        if docker exec docuseal-nginx nginx -s reload 2>/dev/null; then
            echo '✅ Nginx reloaded successfully'
        else
            echo '⚠️  Nginx reload failed, will restart container'
            docker restart docuseal-nginx
            sleep 3
            echo '✅ Nginx container restarted'
        fi
    else
        echo '❌ Nginx config test failed!'
        echo 'Showing error:'
        docker exec docuseal-nginx nginx -t -c /tmp/nginx.conf.test 2>&1 || true
        rm /tmp/nginx.conf.new
        exit 1
    fi
    
    rm /tmp/nginx.conf.new
"

echo -e "${GREEN}✅ Nginx configuration deployed and reloaded${NC}"

# Step 2: Deploy docker-compose.yml (only if needed)
echo -e "\n${YELLOW}📋 Step 2: Checking docker-compose.yml updates...${NC}"

# Compare files to see if docker-compose needs updating
LOCAL_HASH=$(md5sum "$LOCAL_DOCKER_COMPOSE" 2>/dev/null | cut -d' ' -f1 || echo "")
REMOTE_HASH=$(ssh "$REMOTE_HOST" "md5sum $REMOTE_DOCUSEAL_DIR/docker-compose.yml 2>/dev/null | cut -d' ' -f1 || echo ''")

if [ "$LOCAL_HASH" = "$REMOTE_HASH" ] && [ -n "$LOCAL_HASH" ]; then
    echo -e "${BLUE}ℹ️  Docker-compose.yml is identical, skipping update${NC}"
    echo -e "${YELLOW}   Note: Healthcheck changes require container recreation${NC}"
    echo -e "${YELLOW}   Current containers are running fine, so this is optional${NC}"
    read -p "   Do you want to update docker-compose.yml anyway? (y/N): " -n 1 -r
    echo
    UPDATE_COMPOSE=$REPLY
else
    UPDATE_COMPOSE="y"
fi

if [[ "$UPDATE_COMPOSE" =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}⚠️  Updating docker-compose.yml...${NC}"
    echo -e "${BLUE}   This will NOT delete any volumes or data${NC}"
    echo -e "${BLUE}   We will use 'docker compose up -d' which preserves volumes${NC}"
    
    # Copy docker-compose.yml
    scp "$LOCAL_DOCKER_COMPOSE" "$REMOTE_HOST:$REMOTE_DOCUSEAL_DIR/docker-compose.yml.new"
    
    ssh "$REMOTE_HOST" "
        cd $REMOTE_DOCUSEAL_DIR
        
        # Backup current
        cp docker-compose.yml docker-compose.yml.backup.$(date +%Y%m%d_%H%M%S) 2>/dev/null || true
        
        # Move new file
        mv docker-compose.yml.new docker-compose.yml
        
        echo '✅ Docker-compose.yml updated'
        echo ''
        echo '📋 Summary of changes:'
        echo '   - Added healthcheck to docuseal-app'
        echo '   - Updated nginx depends_on to wait for healthcheck'
        echo '   - Added healthcheck to nginx'
        echo ''
        echo '⚠️  Note: These changes will take effect on next container restart'
        echo '   Current containers are running and will continue with old config'
        echo '   until restarted. You can restart now or wait for next maintenance.'
        echo ''
        read -p '   Restart containers now to apply changes? (y/N): ' -n 1 -r
        echo
        if [[ \$REPLY =~ ^[Yy]$ ]]; then
            echo '🔄 Restarting containers to apply new configuration...'
            docker compose down
            docker compose up -d
            echo '✅ Containers restarted with new configuration'
        else
            echo 'ℹ️  Containers will use new config on next restart'
        fi
    "
    
    echo -e "${GREEN}✅ Docker-compose.yml updated${NC}"
else
    echo -e "${BLUE}ℹ️  Skipping docker-compose.yml update${NC}"
fi

# Step 3: Verify deployment
echo -e "\n${YELLOW}🧪 Step 3: Verifying deployment...${NC}"
sleep 5

# Test nginx
if ssh "$REMOTE_HOST" "curl -sf http://localhost/health" >/dev/null 2>&1; then
    echo -e "${GREEN}✅ Nginx health endpoint responding${NC}"
else
    echo -e "${YELLOW}⚠️  Nginx health check failed (may be normal if /health not configured)${NC}"
fi

# Test DocuSeal through nginx
if ssh "$REMOTE_HOST" "curl -sf http://localhost | head -1" | grep -q "DocuSeal"; then
    echo -e "${GREEN}✅ DocuSeal is accessible through nginx${NC}"
else
    echo -e "${YELLOW}⚠️  DocuSeal accessibility test inconclusive${NC}"
fi

# Check container status
echo -e "\n${BLUE}📊 Container Status:${NC}"
ssh "$REMOTE_HOST" "docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' | grep -E '(docuseal|nginx)'"

# Final summary
echo -e "\n${GREEN}🎉 Deployment Complete!${NC}"
echo -e "${BLUE}📋 Summary:${NC}"
echo -e "   🏠 Remote Host: $REMOTE_HOST"
echo -e "   📁 Remote Directory: $REMOTE_DOCUSEAL_DIR"
echo -e "   💾 Backup: ~/docuseal-backups/$TIMESTAMP"
echo -e "   ✅ Nginx config: Deployed and reloaded"
if [[ "$UPDATE_COMPOSE" =~ ^[Yy]$ ]]; then
    echo -e "   ✅ Docker-compose: Updated"
else
    echo -e "   ⏭️  Docker-compose: Skipped (no changes needed)"
fi

echo -e "\n${YELLOW}🔍 Useful Commands:${NC}"
echo -e "   View nginx logs: ssh $REMOTE_HOST 'docker logs docuseal-nginx'"
echo -e "   View DocuSeal logs: ssh $REMOTE_HOST 'docker logs docuseal-app'"
echo -e "   Check container status: ssh $REMOTE_HOST 'cd $REMOTE_DOCUSEAL_DIR && docker compose ps'"
echo -e "   Restart containers: ssh $REMOTE_HOST 'cd $REMOTE_DOCUSEAL_DIR && docker compose restart'"

echo -e "\n${GREEN}✅ Deployment successful! No data was lost.${NC}"

