#!/bin/bash

# =============================================================================
# Update On-Prem Configuration Files (DocuSeal + Signing Orchestrator)
# Safe deployment that only updates configs without wiping data
# =============================================================================

set -e

# Configuration
REMOTE_HOST="admin-kapital@100.76.8.62"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔧 Updating On-Prem Configuration Files${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check if remote host is reachable
echo -e "${YELLOW}🔍 Checking remote host connectivity...${NC}"
if ! ssh -o ConnectTimeout=10 "$REMOTE_HOST" "echo 'Connected successfully'" >/dev/null 2>&1; then
    echo -e "${RED}❌ Cannot connect to remote host: $REMOTE_HOST${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Remote host is reachable${NC}"
echo ""

# Create timestamped backup
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
echo -e "${YELLOW}💾 Creating configuration backup...${NC}"
ssh "$REMOTE_HOST" "
    mkdir -p ~/config-backups
    
    # Backup DocuSeal configs
    if [ -f ~/docuseal-onprem/.env ]; then
        cp ~/docuseal-onprem/.env ~/config-backups/docuseal-env-${TIMESTAMP}.backup
        echo '✅ Backed up DocuSeal .env'
    fi
    
    if [ -f ~/docuseal-onprem/nginx/nginx.conf ]; then
        cp ~/docuseal-onprem/nginx/nginx.conf ~/config-backups/nginx-conf-${TIMESTAMP}.backup
        echo '✅ Backed up nginx.conf'
    fi
    
    # Backup Signing Orchestrator configs
    if [ -f ~/signing-orchestrator/.env ]; then
        cp ~/signing-orchestrator/.env ~/config-backups/orchestrator-env-${TIMESTAMP}.backup
        echo '✅ Backed up Signing Orchestrator .env'
    fi
    
    if [ -f ~/signing-orchestrator/.env.production ]; then
        cp ~/signing-orchestrator/.env.production ~/config-backups/orchestrator-env-production-${TIMESTAMP}.backup
        echo '✅ Backed up Signing Orchestrator .env.production'
    fi
    
    echo ''
    echo '📁 Backups saved to ~/config-backups/'
"

echo -e "${GREEN}✅ Configuration backup completed${NC}"
echo ""

# ============================================================================
# Update DocuSeal nginx.conf
# ============================================================================
echo -e "${YELLOW}📝 Updating DocuSeal nginx configuration...${NC}"

if [ -f "$PROJECT_ROOT/on-prem/docuseal/nginx/nginx.conf" ]; then
    # Copy to temp location first
    scp "$PROJECT_ROOT/on-prem/docuseal/nginx/nginx.conf" "$REMOTE_HOST:/tmp/nginx.conf.new"
    
    # Move to proper location (requires sudo, so we'll copy and ask user to move it)
    ssh "$REMOTE_HOST" "
        # Check if the file is different
        if ! diff -q /tmp/nginx.conf.new ~/docuseal-onprem/nginx/nginx.conf >/dev/null 2>&1; then
            echo '📝 Nginx config has changes'
            
            # Try to copy (may need sudo)
            if cp /tmp/nginx.conf.new ~/docuseal-onprem/nginx/nginx.conf 2>/dev/null; then
                echo '✅ Nginx config updated successfully'
            else
                echo '⚠️  Need sudo to update nginx config'
                sudo cp /tmp/nginx.conf.new ~/docuseal-onprem/nginx/nginx.conf
                echo '✅ Nginx config updated with sudo'
            fi
        else
            echo 'ℹ️  Nginx config unchanged'
        fi
        
        rm /tmp/nginx.conf.new
    "
    echo -e "${GREEN}✅ DocuSeal nginx.conf updated${NC}"
else
    echo -e "${YELLOW}⚠️  Local nginx.conf not found, skipping${NC}"
fi

echo ""

# ============================================================================
# Update DocuSeal .env (only if exists locally)
# ============================================================================
echo -e "${YELLOW}📝 Updating DocuSeal environment...${NC}"

ssh "$REMOTE_HOST" "
    cd ~/docuseal-onprem
    
    # Update domain references from kredit.my to creditxpress.com.my
    if [ -f .env ]; then
        echo '🔧 Updating domain references...'
        sed -i.bak-${TIMESTAMP} \\
            -e 's/sign\.kredit\.my/sign.creditxpress.com.my/g' \\
            -e 's/api\.kredit\.my/api.creditxpress.com.my/g' \\
            -e 's/FORCE_SSL=false/FORCE_SSL=true/' \\
            .env
        
        echo '✅ DocuSeal .env updated with new domains'
        echo ''
        echo '📋 Changes made:'
        echo '   - sign.kredit.my → sign.creditxpress.com.my'
        echo '   - api.kredit.my → api.creditxpress.com.my'
        echo '   - FORCE_SSL enabled'
    else
        echo '⚠️  DocuSeal .env not found'
    fi
"

echo -e "${GREEN}✅ DocuSeal environment updated${NC}"
echo ""

# ============================================================================
# Update Signing Orchestrator .env.production
# ============================================================================
echo -e "${YELLOW}📝 Updating Signing Orchestrator environment...${NC}"

if [ -f "$PROJECT_ROOT/on-prem/signing-orchestrator/.env.production" ]; then
    # Copy the updated .env.production
    scp "$PROJECT_ROOT/on-prem/signing-orchestrator/.env.production" "$REMOTE_HOST:~/signing-orchestrator/.env.production"
    
    ssh "$REMOTE_HOST" "
        cd ~/signing-orchestrator
        
        # Copy to active .env
        cp .env.production .env
        
        echo '✅ Signing Orchestrator .env.production updated'
        echo '✅ Active .env updated from .env.production'
    "
    echo -e "${GREEN}✅ Signing Orchestrator environment updated${NC}"
else
    echo -e "${YELLOW}⚠️  Local .env.production not found, skipping${NC}"
fi

echo ""

# ============================================================================
# Restart Services
# ============================================================================
echo -e "${YELLOW}🔄 Restarting services to apply changes...${NC}"
echo ""

read -p "Do you want to restart DocuSeal now? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}🔄 Restarting DocuSeal...${NC}"
    ssh "$REMOTE_HOST" "
        cd ~/docuseal-onprem
        docker-compose restart
        
        echo '⏳ Waiting for services to start...'
        sleep 10
        
        echo '📊 Container status:'
        docker-compose ps
    "
    echo -e "${GREEN}✅ DocuSeal restarted${NC}"
else
    echo -e "${YELLOW}⚠️  Skipped DocuSeal restart${NC}"
    echo -e "${YELLOW}   Run manually: ssh $REMOTE_HOST 'cd ~/docuseal-onprem && docker-compose restart'${NC}"
fi

echo ""

read -p "Do you want to restart Signing Orchestrator now? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}🔄 Restarting Signing Orchestrator...${NC}"
    ssh "$REMOTE_HOST" "
        cd ~/signing-orchestrator
        docker-compose restart
        
        echo '⏳ Waiting for services to start...'
        sleep 10
        
        echo '📊 Container status:'
        docker-compose ps
    "
    echo -e "${GREEN}✅ Signing Orchestrator restarted${NC}"
else
    echo -e "${YELLOW}⚠️  Skipped Signing Orchestrator restart${NC}"
    echo -e "${YELLOW}   Run manually: ssh $REMOTE_HOST 'cd ~/signing-orchestrator && docker-compose restart'${NC}"
fi

echo ""

# ============================================================================
# Summary
# ============================================================================
echo -e "${GREEN}🎉 Configuration Update Complete!${NC}"
echo ""
echo -e "${BLUE}📋 Summary:${NC}"
echo -e "   💾 Backups: ~/config-backups/*-${TIMESTAMP}.backup"
echo -e "   ✅ DocuSeal nginx.conf updated"
echo -e "   ✅ DocuSeal .env updated (domains + SSL)"
echo -e "   ✅ Signing Orchestrator .env updated"
echo ""
echo -e "${BLUE}🔍 What was changed:${NC}"
echo -e "   1. Nginx upstream: docuseal:3000 → docuseal-app:3000"
echo -e "   2. DocuSeal domains: kredit.my → creditxpress.com.my"
echo -e "   3. DocuSeal SSL: FORCE_SSL=true"
echo -e "   4. Signing Orchestrator: Updated with your local .env.production"
echo ""
echo -e "${BLUE}🧪 Test Your Changes:${NC}"
echo -e "   DocuSeal: https://sign.creditxpress.com.my"
echo -e "   Orchestrator Health: http://100.76.8.62:4010/health"
echo ""
echo -e "${YELLOW}📝 If you need to rollback:${NC}"
echo -e "   ssh $REMOTE_HOST"
echo -e "   cp ~/config-backups/docuseal-env-${TIMESTAMP}.backup ~/docuseal-onprem/.env"
echo -e "   cp ~/config-backups/nginx-conf-${TIMESTAMP}.backup ~/docuseal-onprem/nginx/nginx.conf"
echo -e "   cp ~/config-backups/orchestrator-env-${TIMESTAMP}.backup ~/signing-orchestrator/.env"
echo -e "   cd ~/docuseal-onprem && docker-compose restart"
echo -e "   cd ~/signing-orchestrator && docker-compose restart"
echo ""
echo -e "${GREEN}✅ All done! No data was wiped.${NC}"



















