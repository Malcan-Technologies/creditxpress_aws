#!/bin/bash

# Unified Deployment Script for DocuSeal + Signing Orchestrator
# Deploys both systems to on-premises server with proper environment management
#
# Configuration is loaded from client.json for easy multi-client support.
# Can be run locally (with SSH access) or via GitHub Actions (self-hosted runner).

set -e

# Script directories
LOCAL_BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CLIENT_JSON="$LOCAL_BASE_DIR/../client.json"

# =============================================================================
# Load configuration from client.json
# =============================================================================
load_client_config() {
    if [ -f "$CLIENT_JSON" ]; then
        # Check if jq is available
        if command -v jq &> /dev/null; then
            CLIENT_SLUG=$(jq -r '.client_slug' "$CLIENT_JSON")
            CLIENT_NAME=$(jq -r '.client_name' "$CLIENT_JSON")
            SIGN_DOMAIN=$(jq -r '.domains.sign' "$CLIENT_JSON")
            
            # On-prem specific config
            ONPREM_ENABLED=$(jq -r '.onprem.enabled // false' "$CLIENT_JSON")
            SERVER_IP=$(jq -r '.onprem.server_ip // ""' "$CLIENT_JSON")
            SSH_USER=$(jq -r '.onprem.ssh_user // ""' "$CLIENT_JSON")
            SSH_HOST=$(jq -r '.onprem.ssh_host // ""' "$CLIENT_JSON")
            REMOTE_BASE_DIR=$(jq -r '.onprem.base_dir // "/home/admin"' "$CLIENT_JSON")
            
            # Use ssh_host if available, otherwise construct from user@ip
            if [ -n "$SSH_HOST" ] && [ "$SSH_HOST" != "null" ]; then
                REMOTE_HOST="$SSH_HOST"
            elif [ -n "$SSH_USER" ] && [ -n "$SERVER_IP" ]; then
                REMOTE_HOST="${SSH_USER}@${SERVER_IP}"
            fi
            
            echo -e "${BLUE}[INFO]${NC} Loaded config for: $CLIENT_NAME ($CLIENT_SLUG)"
            echo -e "${BLUE}[INFO]${NC} Remote host: $REMOTE_HOST"
        else
            echo -e "${YELLOW}[WARN]${NC} jq not found, using fallback configuration"
            use_fallback_config
        fi
    else
        echo -e "${YELLOW}[WARN]${NC} client.json not found at $CLIENT_JSON, using fallback"
        use_fallback_config
    fi
}

# Fallback configuration for backward compatibility
use_fallback_config() {
    REMOTE_HOST="${REMOTE_HOST:-admin-kapital@100.76.8.62}"
    REMOTE_BASE_DIR="${REMOTE_BASE_DIR:-/home/admin-kapital}"
    CLIENT_SLUG="creditxpress"
    CLIENT_NAME="Credit Xpress"
    SIGN_DOMAIN="sign.creditxpress.com.my"
}

# Load configuration
load_client_config

# Legacy variables for backward compatibility
REMOTE_PORT=""         # Port handled by SSH config
REMOTE_USER=""         # User handled by SSH config

# Remote directories (matching your actual on-prem structure)
REMOTE_DOCUSEAL_DIR="$REMOTE_BASE_DIR/docuseal-onprem"
REMOTE_ORCHESTRATOR_DIR="$REMOTE_BASE_DIR/signing-orchestrator" 
REMOTE_MTSA_DIR="$REMOTE_BASE_DIR/mtsa-pilot-docker"

# Local directories
LOCAL_DOCUSEAL_DIR="$LOCAL_BASE_DIR/../docuseal-onprem"
LOCAL_ORCHESTRATOR_DIR="$LOCAL_BASE_DIR/signing-orchestrator"
LOCAL_MTSA_DIR="$LOCAL_BASE_DIR/mtsa"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
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

print_section() {
    echo -e "${PURPLE}[SECTION]${NC} $1"
}

# Function to check if remote server is accessible
check_remote_connection() {
    print_status "Checking connection to remote server..."
    if ssh -o ConnectTimeout=10 $REMOTE_HOST "echo 'Connection successful'" >/dev/null 2>&1; then
        print_success "Remote server is accessible"
        return 0
    else
        print_error "Cannot connect to remote server"
        return 1
    fi
}

# Function to create comprehensive backup including Docker volumes and database
backup_deployments() {
    print_section "Creating comprehensive data backup (NEVER LOSE DATA AGAIN!)"
    
    ssh $REMOTE_HOST << 'EOF'
        cd /home/admin-kapital
        
        # Create backup directories
        mkdir -p backups/data backups/volumes
        
        # Create timestamped backup
        BACKUP_NAME="full-backup-$(date +%Y%m%d_%H%M%S)"
        echo "📦 Creating comprehensive backup: $BACKUP_NAME"
        echo "🛡️  This backup will preserve ALL your data and configurations!"
        
        # 1. Backup application files
        if [ -d "docuseal-onprem" ] || [ -d "signing-orchestrator" ]; then
            echo "📁 Backing up application files..."
            tar -czf "backups/${BACKUP_NAME}-files.tar.gz" \
                $([ -d docuseal-onprem ] && echo "docuseal-onprem/") \
                $([ -d signing-orchestrator ] && echo "signing-orchestrator/") \
                2>/dev/null || true
            echo "   ✅ Application files backed up"
        fi
        
        # 2. Backup DocuSeal database (if running) - CRITICAL FOR USER DATA
        if docker ps --format "table {{.Names}}" | grep -q "docuseal-postgres"; then
            echo "🗄️  Backing up DocuSeal database (users, documents, configurations)..."
            docker exec docuseal-postgres pg_dump -U docuseal -d docuseal > "backups/${BACKUP_NAME}-docuseal-db.sql" 2>/dev/null && echo "   ✅ Database backed up" || echo "   ⚠️  Database backup failed"
        else
            echo "   ℹ️  DocuSeal database not running - skipping DB backup"
        fi
        
        # 2.5. Backup Signing Orchestrator database (if running) - CRITICAL FOR AGREEMENTS DATA
        if docker ps --format "table {{.Names}}" | grep -q "agreements-postgres"; then
            echo "🗄️  Backing up Signing Orchestrator database (agreements, certificates)..."
            docker exec agreements-postgres-prod pg_dump -U agreements_user -d agreements_db > "backups/${BACKUP_NAME}-agreements-db.sql" 2>/dev/null && echo "   ✅ Agreements database backed up" || echo "   ⚠️  Agreements database backup failed"
        else
            echo "   ℹ️  Signing Orchestrator database not running - skipping agreements DB backup"
        fi
        
        # 3. Backup Docker volumes (if they exist) - PRESERVES ALL PERSISTENT DATA
        echo "💾 Backing up Docker volumes (documents, uploads, storage)..."
        volume_count=0
        for volume in $(docker volume ls --format "{{.Name}}" | grep -E "(docuseal|signing-orchestrator)" 2>/dev/null || true); do
            echo "  📦 Backing up volume: $volume"
            docker run --rm -v "$volume":/source -v "$(pwd)/backups/volumes":/backup alpine tar czf "/backup/${BACKUP_NAME}-${volume}.tar.gz" -C /source . 2>/dev/null && echo "     ✅ Volume $volume backed up" || echo "     ⚠️  Volume $volume backup failed"
            volume_count=$((volume_count + 1))
        done
        
        if [ $volume_count -eq 0 ]; then
            echo "   ℹ️  No Docker volumes found to backup"
        fi
        
        # 4. Create backup manifest with restore instructions
        cat > "backups/${BACKUP_NAME}-manifest.txt" << MANIFEST
🛡️  COMPREHENSIVE BACKUP MANIFEST
================================
Backup Created: $(date)
Backup Name: $BACKUP_NAME

📦 Contents:
- Application files: ${BACKUP_NAME}-files.tar.gz
- DocuSeal database: ${BACKUP_NAME}-docuseal-db.sql
- Docker volumes: ${BACKUP_NAME}-*.tar.gz (in volumes/ directory)

🔧 Restore Instructions:
========================
1. Stop services: cd docuseal-onprem && docker-compose down
2. Extract files: tar -xzf ${BACKUP_NAME}-files.tar.gz
3. Start database: docker-compose up -d docuseal-postgres
4. Restore database: docker exec -i docuseal-postgres psql -U docuseal -d docuseal < ${BACKUP_NAME}-docuseal-db.sql
5. Restore volumes: 
   For each volume backup file:
   docker run --rm -v VOLUME_NAME:/target -v \$(pwd)/backups/volumes:/backup alpine tar xzf /backup/${BACKUP_NAME}-VOLUME_NAME.tar.gz -C /target
6. Start all services: docker-compose up -d

⚠️  IMPORTANT: This backup preserves ALL user data, configurations, documents, and settings!
MANIFEST
        
        echo ""
        echo "🎉 Comprehensive backup completed: $BACKUP_NAME"
        echo "📄 Backup manifest: backups/${BACKUP_NAME}-manifest.txt"
        echo ""
        echo "📋 Recent backups:"
        ls -la backups/full-backup-*-manifest.txt 2>/dev/null | head -5 || echo "No previous backups found"
        
        # Clean up old backups (keep last 10 to prevent disk space issues)
        echo ""
        echo "🧹 Cleaning up old backups (keeping last 10)..."
        ls -t backups/full-backup-*-files.tar.gz 2>/dev/null | tail -n +11 | while read backup; do
            backup_base=$(basename "$backup" "-files.tar.gz")
            echo "   🗑️  Removing old backup: $backup_base"
            rm -f "backups/${backup_base}"* "backups/volumes/${backup_base}"* 2>/dev/null || true
        done
EOF
    
    print_success "🛡️  COMPREHENSIVE BACKUP COMPLETED - Your data is safe!"
}

# Function to restore from backup
restore_from_backup() {
    if [ -z "$1" ]; then
        print_error "Usage: $0 restore <backup-name>"
        print_status "Available backups:"
        ssh $REMOTE_HOST "cd /home/admin-kapital && ls -la backups/full-backup-*-manifest.txt 2>/dev/null | head -10" || echo "No backups found"
        return 1
    fi
    
    local backup_name="$1"
    print_section "🔄 Restoring from backup: $backup_name"
    print_warning "⚠️  This will STOP all services and restore data!"
    
    ssh $REMOTE_HOST << EOF
        cd /home/admin-kapital
        
        # Check if backup exists
        if [ ! -f "backups/${backup_name}-manifest.txt" ]; then
            echo "❌ Backup not found: ${backup_name}"
            echo "Available backups:"
            ls -la backups/full-backup-*-manifest.txt 2>/dev/null | head -10
            exit 1
        fi
        
        echo "📋 Backup manifest:"
        cat "backups/${backup_name}-manifest.txt"
        echo ""
        
        # Stop services
        echo "🛑 Stopping services..."
        cd docuseal-onprem && docker-compose down 2>/dev/null || true
        cd ../signing-orchestrator && docker-compose down 2>/dev/null || true
        cd ..
        
        # Restore application files
        if [ -f "backups/${backup_name}-files.tar.gz" ]; then
            echo "📁 Restoring application files..."
            tar -xzf "backups/${backup_name}-files.tar.gz"
            echo "   ✅ Application files restored"
        fi
        
        # Start database for restoration
        echo "🗄️  Starting database for restoration..."
        cd docuseal-onprem && docker-compose up -d docuseal-postgres
        sleep 10
        
        # Restore database
        if [ -f "../backups/${backup_name}-docuseal-db.sql" ]; then
            echo "🗄️  Restoring DocuSeal database..."
            docker exec -i docuseal-postgres psql -U docuseal -d docuseal < "../backups/${backup_name}-docuseal-db.sql" 2>/dev/null && echo "   ✅ Database restored" || echo "   ⚠️  Database restore failed"
        fi
        
        # Restore volumes
        echo "💾 Restoring Docker volumes..."
        for volume_backup in ../backups/volumes/${backup_name}-*.tar.gz; do
            if [ -f "\$volume_backup" ]; then
                volume_name=\$(basename "\$volume_backup" .tar.gz | sed "s/${backup_name}-//")
                echo "  📦 Restoring volume: \$volume_name"
                docker run --rm -v "\$volume_name":/target -v "\$(pwd)/../backups/volumes":/backup alpine tar xzf "/backup/\$(basename "\$volume_backup")" -C /target 2>/dev/null && echo "     ✅ Volume \$volume_name restored" || echo "     ⚠️  Volume \$volume_name restore failed"
            fi
        done
        
        # Start all services
        echo "🚀 Starting all services..."
        docker-compose up -d
        cd ../signing-orchestrator && docker-compose up -d 2>/dev/null || true
        
        echo ""
        echo "🎉 Restore completed from backup: ${backup_name}"
        echo "📋 Check service status with: ./deploy-all.sh status"
EOF
    
    print_success "🔄 Restore completed!"
}

# Function to sync DocuSeal files
sync_docuseal() {
    print_section "Syncing DocuSeal files"
    
    if [ ! -d "$LOCAL_DOCUSEAL_DIR" ]; then
        print_warning "Local DocuSeal directory not found: $LOCAL_DOCUSEAL_DIR"
        return 0
    fi
    
    print_status "Syncing DocuSeal files to remote server..."
    
    # Create remote directory
    ssh $REMOTE_HOST "mkdir -p $REMOTE_DOCUSEAL_DIR"
    
    # Sync DocuSeal files
    rsync -avz --delete \
        --exclude 'storage/' \
        --exclude 'postgres/data/' \
        --exclude 'logs/' \
        --exclude '.env' \
        --exclude '*.log' \
        --exclude '.DS_Store' \
        --exclude 'node_modules/' \
        -e "ssh" \
        "$LOCAL_DOCUSEAL_DIR/" "$REMOTE_HOST:$REMOTE_DOCUSEAL_DIR/"
    
    print_success "DocuSeal files synced successfully"
}

# Function to sync Signing Orchestrator files
sync_orchestrator() {
    print_section "Syncing Signing Orchestrator files"
    
    if [ ! -d "$LOCAL_ORCHESTRATOR_DIR" ]; then
        print_warning "Local Signing Orchestrator directory not found: $LOCAL_ORCHESTRATOR_DIR"
        return 0
    fi
    
    print_status "Syncing Signing Orchestrator files to remote server..."
    
    # Create remote directory
    ssh $REMOTE_HOST "mkdir -p $REMOTE_ORCHESTRATOR_DIR"
    
    # Sync Orchestrator files
    rsync -avz --delete \
        --exclude 'node_modules/' \
        --exclude 'dist/' \
        --exclude 'logs/' \
        --exclude 'data/' \
        --exclude '.git/' \
        --exclude '.env' \
        --exclude '*.log' \
        --exclude '.DS_Store' \
        -e "ssh" \
        "$LOCAL_ORCHESTRATOR_DIR/" "$REMOTE_HOST:$REMOTE_ORCHESTRATOR_DIR/"
    
    print_success "Signing Orchestrator files synced successfully"
}

# Function to sync MTSA files (careful not to overwrite sensitive configs)
sync_mtsa() {
    print_section "Syncing MTSA files"
    
    if [ ! -d "$LOCAL_MTSA_DIR" ]; then
        print_warning "Local MTSA directory not found: $LOCAL_MTSA_DIR - skipping MTSA sync"
        return 0
    fi
    
    print_status "Syncing MTSA files to remote server (preserving existing configs)..."
    
    # Create remote directory if it doesn't exist
    ssh $REMOTE_HOST "mkdir -p $REMOTE_MTSA_DIR"
    
    # Sync MTSA files (but preserve existing configurations)
    rsync -avz \
        --exclude '*.properties' \
        --exclude '*.log' \
        --exclude 'logs/' \
        --exclude '.DS_Store' \
        --exclude 'data/' \
        -e "ssh" \
        "$LOCAL_MTSA_DIR/" "$REMOTE_HOST:$REMOTE_MTSA_DIR/"
    
    print_success "MTSA files synced successfully (configs preserved)"
}

# Function to setup environments
setup_environments() {
    print_section "Setting up environments"
    
    ssh $REMOTE_HOST << 'EOF'
        # Setup DocuSeal environment
        if [ -d docuseal-onprem ]; then
            cd docuseal-onprem
            echo "🔧 Setting up DocuSeal environment..."
            
            # Use production environment if available, otherwise development
            if [ -f env.production ]; then
                echo "Using production environment for DocuSeal"
                cp env.production .env
            elif [ -f env.development ]; then
                echo "Using development environment for DocuSeal"
                cp env.development .env
            elif [ ! -f .env ]; then
                echo "⚠️  No .env file found for DocuSeal - please configure manually"
            fi
            
            # Create necessary directories
            mkdir -p storage postgres/data logs public
            
            echo "✅ DocuSeal environment setup completed"
            cd ..
        fi
        
        # Setup Signing Orchestrator environment
        if [ -d signing-orchestrator ]; then
            cd signing-orchestrator
            echo "🔧 Setting up Signing Orchestrator environment..."
            
            # Always use production environment for production deployment
            if [ -f .env.production ]; then
                echo "🔧 Using production environment for Signing Orchestrator"
                cp .env.production .env
                echo "✅ Production environment applied"
            elif [ -f env.production ]; then
                echo "🔧 Using legacy production environment for Signing Orchestrator"
                cp env.production .env
                echo "✅ Legacy production environment applied"
            elif [ -f env.development ]; then
                echo "⚠️  Using development environment for Signing Orchestrator (production not found)"
                cp env.development .env
            elif [ -f env.example ]; then
                echo "⚠️  Using example environment for Signing Orchestrator"
                cp env.example .env
            else
                echo "❌ No environment file found for Signing Orchestrator - deployment may fail"
            fi
            
            # Create necessary directories (preserve existing data)
            mkdir -p ~/kapital/agreements/{signed,original,stamped,postgres}
            mkdir -p ~/kapital/logs/{signing-orchestrator,postgres}
            mkdir -p data/signed logs
            
            # Set proper permissions
            chmod +x deploy*.sh scripts/*.sh 2>/dev/null || true
            
            echo "✅ Signing Orchestrator environment setup completed"
            cd ..
        fi
        
        # Setup MTSA environment (preserve existing configs)
        if [ -d mtsa-pilot-docker ]; then
            cd mtsa-pilot-docker
            echo "🔧 Checking MTSA environment..."
            
            # Just ensure directories exist, don't modify configs
            mkdir -p logs
            
            # Set proper permissions
            chmod +x *.sh 2>/dev/null || true
            
            echo "✅ MTSA environment checked (existing configs preserved)"
            cd ..
        fi
EOF
    
    print_success "Environment setup completed"
}

# Function to deploy DocuSeal
deploy_docuseal() {
    print_section "Deploying DocuSeal"
    
    ssh $REMOTE_HOST << 'EOF'
        if [ -d docuseal-onprem ]; then
            cd docuseal-onprem
            
            echo "🛑 Stopping existing DocuSeal containers..."
            docker-compose down 2>/dev/null || true
            
            echo "🏗️  Building DocuSeal images..."
            docker-compose build --no-cache 2>/dev/null || echo "No build required for DocuSeal"
            
            echo "🚀 Starting DocuSeal containers..."
            docker-compose up -d
            
            echo "⏳ Waiting for DocuSeal to start..."
            sleep 15
            
            echo "📊 DocuSeal container status:"
            docker-compose ps
            
            echo "🧪 Testing DocuSeal health..."
            if curl -f http://localhost/health >/dev/null 2>&1; then
                echo "✅ DocuSeal health check passed"
            else
                echo "❌ DocuSeal health check failed"
                echo "📋 DocuSeal logs:"
                docker-compose logs --tail=10
            fi
            
            cd ..
        else
            echo "⚠️  DocuSeal directory not found, skipping deployment"
        fi
EOF
    
    print_success "DocuSeal deployment completed"
}

# Function to deploy Signing Orchestrator
deploy_orchestrator() {
    print_section "Deploying Signing Orchestrator"
    
    ssh $REMOTE_HOST << 'EOF'
        if [ -d signing-orchestrator ]; then
            cd signing-orchestrator
            
            echo "🛑 Stopping existing Signing Orchestrator containers..."
            docker-compose down 2>/dev/null || true
            
            echo "💾 Creating safety backup of PostgreSQL data before rebuild..."
            # Backup the database before any changes in case something goes wrong
            if docker volume inspect signing-orchestrator_agreements-postgres-data >/dev/null 2>&1; then
                timestamp=$(date +%Y%m%d_%H%M%S)
                docker run --rm -v signing-orchestrator_agreements-postgres-data:/source -v "$(pwd)/backups":/backup alpine tar czf "/backup/pre-rebuild-postgres-${timestamp}.tar.gz" -C /source . 2>/dev/null || echo "⚠️  Backup failed - proceeding with deployment"
                echo "✅ Pre-rebuild backup created: pre-rebuild-postgres-${timestamp}.tar.gz"
            else
                echo "ℹ️  No existing PostgreSQL volume found - first deployment"
            fi
            
            # Check if MTSA development compose file exists (includes MTSA + Orchestrator)
            if [ -f docker-compose.mtsa-prod.yml ]; then
                echo "🚀 Using production MTSA + Orchestrator deployment..."
                echo "🏗️  Building and starting Signing Orchestrator with MTSA..."
                # Use production compose file that includes both orchestrator and MTSA on same network
                docker-compose -f docker-compose.mtsa-prod.yml up -d --build --force-recreate
                
                echo "⏳ Waiting for all services to start..."
                sleep 20
                
                echo "🔗 Ensuring MTSA network connectivity..."
                # Verify MTSA container is accessible from orchestrator
                if docker exec signing-orchestrator ping -c 2 mtsa-pilot >/dev/null 2>&1; then
                    echo "✅ MTSA network connectivity verified"
                else
                    echo "⚠️  MTSA network connectivity issue detected - attempting fix..."
                    # Connect MTSA container to orchestrator network if needed
                    docker network connect signing-orchestrator_mtsa-network mtsa-pilot-prod 2>/dev/null || true
                fi
                
            elif [ -f deploy-auto.sh ]; then
                echo "🚀 Using automated deployment script..."
                chmod +x deploy-auto.sh
                # Run a simplified version that doesn't do file copying
                echo "🏗️  Building and starting Signing Orchestrator..."
                # Use --force-recreate to handle volume configuration changes safely
                # Named volumes will persist data even during recreation
                if [ -f .env.production ]; then
                    echo "🔧 Using .env.production for deployment"
                    docker-compose --env-file .env.production up -d --build --force-recreate
                elif [ -f env.production ]; then
                    echo "🔧 Using legacy env.production for deployment"
                    docker-compose --env-file env.production up -d --build --force-recreate
                else
                    echo "🔧 Using default .env for deployment"
                    docker-compose up -d --build --force-recreate
                fi
            else
                echo "🏗️  Building Signing Orchestrator images..."
                docker-compose build --no-cache
                
                echo "🚀 Starting Signing Orchestrator containers..."
                docker-compose up -d
            fi
            
            echo "⏳ Waiting for Signing Orchestrator to start..."
            sleep 15
            
            echo "📊 Signing Orchestrator container status:"
            docker-compose ps
            
            echo "🧪 Testing Signing Orchestrator health..."
            if curl -f http://localhost:4010/health >/dev/null 2>&1; then
                echo "✅ Signing Orchestrator health check passed"
            else
                echo "❌ Signing Orchestrator health check failed"
                echo "📋 Signing Orchestrator logs:"
                docker-compose logs --tail=10 signing-orchestrator
            fi
            
            cd ..
        else
            echo "⚠️  Signing Orchestrator directory not found, skipping deployment"
        fi
EOF
    
    print_success "Signing Orchestrator deployment completed"
}

# Function to deploy MTSA (check if running, restart if needed)
deploy_mtsa() {
    print_section "Checking MTSA Deployment"
    
    ssh $REMOTE_HOST << 'EOF'
        # First check if MTSA was deployed with Signing Orchestrator
        if docker ps | grep -q "mtsa-pilot"; then
            echo "✅ MTSA container is running (deployed with Signing Orchestrator)"
            echo "📊 MTSA container details:"
            docker ps | grep mtsa
            
            # Test MTSA health
            echo "🧪 Testing MTSA WSDL endpoint..."
            if curl -f http://localhost:8080/MTSAPilot/MyTrustSignerAgentWSAPv2?wsdl >/dev/null 2>&1; then
                echo "✅ MTSA WSDL endpoint is accessible"
                
                # Verify network connectivity from orchestrator
                echo "🔗 Testing MTSA network connectivity from Signing Orchestrator..."
                if docker exec signing-orchestrator ping -c 2 mtsa-pilot >/dev/null 2>&1; then
                    echo "✅ MTSA network connectivity verified"
                else
                    echo "⚠️  MTSA network connectivity issue - attempting to fix..."
                    # Try to connect MTSA to orchestrator network
                    mtsa_container=$(docker ps --format "{{.Names}}" | grep mtsa | head -1)
                    if [ ! -z "$mtsa_container" ]; then
                        docker network connect signing-orchestrator_mtsa-network "$mtsa_container" 2>/dev/null || echo "Network connection failed or already exists"
                        # Test again
                        if docker exec signing-orchestrator ping -c 2 mtsa-pilot >/dev/null 2>&1; then
                            echo "✅ MTSA network connectivity fixed"
                        else
                            echo "❌ MTSA network connectivity still failing"
                        fi
                    fi
                fi
            else
                echo "❌ MTSA WSDL endpoint not accessible"
                # Try to restart MTSA container
                mtsa_container=$(docker ps --format "{{.Names}}" | grep mtsa | head -1)
                if [ ! -z "$mtsa_container" ]; then
                    echo "🔄 Restarting MTSA container: $mtsa_container"
                    docker restart "$mtsa_container" 2>/dev/null || echo "⚠️  Failed to restart MTSA container"
                    sleep 10
                    # Test again after restart
                    if curl -f http://localhost:8080/MTSAPilot/MyTrustSignerAgentWSAPv2?wsdl >/dev/null 2>&1; then
                        echo "✅ MTSA WSDL endpoint accessible after restart"
                    else
                        echo "❌ MTSA WSDL endpoint still not accessible after restart"
                    fi
                fi
            fi
            
        elif [ -d mtsa-pilot-docker ]; then
            # Fallback to standalone MTSA deployment
            cd mtsa-pilot-docker
            
            echo "🔍 Checking standalone MTSA container status..."
            if docker ps | grep -q "mtsapilot-container"; then
                echo "✅ Standalone MTSA container is running"
                echo "📊 MTSA container details:"
                docker ps | grep mtsa
                
                # Test MTSA health
                echo "🧪 Testing MTSA WSDL endpoint..."
                if curl -f http://localhost:8080/MTSAPilot/MyTrustSignerAgentWSAPv2?wsdl >/dev/null 2>&1; then
                    echo "✅ MTSA WSDL endpoint is accessible"
                    
                    # Ensure network connectivity to orchestrator
                    echo "🔗 Ensuring MTSA network connectivity to Signing Orchestrator..."
                    docker network connect signing-orchestrator_mtsa-network mtsapilot-container 2>/dev/null || echo "Network connection already exists or failed"
                else
                    echo "❌ MTSA WSDL endpoint not accessible, restarting..."
                    docker restart mtsapilot-container 2>/dev/null || echo "⚠️  Failed to restart MTSA container"
                fi
            else
                echo "⚠️  MTSA container not running"
                echo "🔍 Looking for available MTSA images..."
                docker images | grep mtsa
                
                # Try to start MTSA if image exists
                if docker images | grep -q "mtsa-pilot"; then
                    echo "🚀 Starting MTSA container..."
                    # Use existing startup command or docker-compose if available
                    if [ -f docker-compose.yml ]; then
                        docker-compose up -d
                        sleep 10
                        # Connect to orchestrator network after startup
                        echo "🔗 Connecting MTSA to Signing Orchestrator network..."
                        mtsa_container=$(docker ps --format "{{.Names}}" | grep mtsa | head -1)
                        if [ ! -z "$mtsa_container" ]; then
                            docker network connect signing-orchestrator_mtsa-network "$mtsa_container" 2>/dev/null || echo "Network connection failed or already exists"
                        fi
                    else
                        echo "ℹ️  Manual MTSA container start may be required"
                    fi
                else
                    echo "⚠️  MTSA image not found - manual setup may be required"
                fi
            fi
            
            cd ..
        else
            echo "⚠️  MTSA directory not found and no MTSA container running"
            echo "ℹ️  MTSA should be deployed with Signing Orchestrator using docker-compose.mtsa-prod.yml"
        fi
EOF
    
    print_success "MTSA deployment check completed"
}

# Function to show overall status
show_deployment_status() {
    print_section "Deployment Status Overview"
    
    # Pass sign domain to remote script
    ssh $REMOTE_HOST "SIGN_DOMAIN=$SIGN_DOMAIN" bash << 'EOF'
        echo "🌐 Overall System Status"
        echo "======================="
        
        echo ""
        echo "📊 All Running Containers:"
        docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}"
        
        echo ""
        echo "🔍 Service Health Checks:"
        
        # DocuSeal health
        echo -n "DocuSeal (HTTP): "
        if curl -f -s http://localhost/health >/dev/null 2>&1; then
            echo "✅ Healthy"
        else
            echo "❌ Unhealthy"
        fi
        
        # Signing Orchestrator health
        echo -n "Signing Orchestrator: "
        if curl -f -s http://localhost:4010/health >/dev/null 2>&1; then
            echo "✅ Healthy"
        else
            echo "❌ Unhealthy"
        fi
        
        # MTSA health
        echo -n "MTSA Pilot: "
        if curl -f -s http://localhost:8080/MTSAPilot/MyTrustSignerAgentWSAPv2?wsdl >/dev/null 2>&1; then
            echo "✅ Healthy"
        else
            echo "❌ Unhealthy"
        fi
        
        # Network connectivity check
        echo ""
        echo "🔗 Network Connectivity Checks:"
        
        # Check if orchestrator can reach MTSA
        echo -n "Orchestrator → MTSA: "
        if docker exec signing-orchestrator ping -c 2 mtsa-pilot >/dev/null 2>&1; then
            echo "✅ Connected"
        else
            echo "❌ Disconnected"
            echo "   ⚠️  MTSA network connectivity issue detected!"
            echo "   🔧 Run: ./deploy-all.sh restart to fix network issues"
        fi
        
        # Check Docker networks
        echo -n "Docker Networks: "
        network_count=$(docker network ls | grep -E "(docuseal|mtsa|signing)" | wc -l)
        if [ "$network_count" -gt 0 ]; then
            echo "✅ $network_count networks active"
        else
            echo "❌ No service networks found"
        fi
        
        echo ""
        echo "📈 Resource Usage:"
        docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}" 2>/dev/null || echo "Resource stats unavailable"
        
        echo ""
        echo "🌐 Service URLs:"
        echo "   DocuSeal Web UI: https://${SIGN_DOMAIN:-sign.kredit.my}"
        echo "   DocuSeal Direct: https://${SIGN_DOMAIN:-sign.kredit.my}:3001"
        echo "   Orchestrator API: https://${SIGN_DOMAIN:-sign.kredit.my}/orchestrator"
        echo "   Orchestrator Health: https://${SIGN_DOMAIN:-sign.kredit.my}/orchestrator/health"
        echo "   MTSA Pilot WSDL: http://localhost:8080/MTSAPilot/MyTrustSignerAgentWSAPv2?wsdl"
EOF
    
    print_success "Status overview completed"
}

# Function to show logs from both systems
show_logs() {
    local service="${1:-all}"
    
    print_section "Showing logs for: $service"
    
    case "$service" in
        "docuseal")
            ssh -p $REMOTE_PORT $REMOTE_USER@$REMOTE_HOST "cd docuseal-onprem && docker-compose logs -f"
            ;;
        "orchestrator")
            ssh -p $REMOTE_PORT $REMOTE_USER@$REMOTE_HOST "cd signing-orchestrator && docker-compose logs -f signing-orchestrator"
            ;;
        "all"|*)
            ssh $REMOTE_HOST << 'EOF'
                echo "📋 Recent logs from all services:"
                echo "================================="
                
                if [ -d docuseal-onprem ]; then
                    echo ""
                    echo "🔍 DocuSeal logs (last 10 lines):"
                    cd docuseal-onprem && docker-compose logs --tail=10
                    cd ..
                fi
                
                if [ -d signing-orchestrator ]; then
                    echo ""
                    echo "🔍 Signing Orchestrator logs (last 10 lines):"
                    cd signing-orchestrator && docker-compose logs --tail=10 signing-orchestrator
                    cd ..
                fi
EOF
            ;;
    esac
}

# Function to restart services
restart_services() {
    local service="${1:-all}"
    
    print_section "Restarting services: $service"
    
    ssh -p $REMOTE_PORT $REMOTE_USER@$REMOTE_HOST << EOF
        case "$service" in
            "docuseal")
                if [ -d docuseal-onprem ]; then
                    cd docuseal-onprem && docker-compose restart
                    echo "✅ DocuSeal restarted"
                fi
                ;;
            "orchestrator")
                if [ -d signing-orchestrator ]; then
                    cd signing-orchestrator && docker-compose restart
                    echo "✅ Signing Orchestrator restarted"
                fi
                ;;
            "all"|*)
                if [ -d docuseal-onprem ]; then
                    cd docuseal-onprem && docker-compose restart
                    echo "✅ DocuSeal restarted"
                    cd ..
                fi
                
                if [ -d signing-orchestrator ]; then
                    cd signing-orchestrator && docker-compose restart
                    echo "✅ Signing Orchestrator restarted"
                    cd ..
                fi
                
                # Fix MTSA network connectivity after restart
                echo "🔗 Ensuring MTSA network connectivity..."
                sleep 5
                mtsa_container=\$(docker ps --format "{{.Names}}" | grep mtsa | head -1)
                if [ ! -z "\$mtsa_container" ]; then
                    docker network connect signing-orchestrator_mtsa-network "\$mtsa_container" 2>/dev/null || echo "Network already connected or connection failed"
                    # Verify connectivity
                    if docker exec signing-orchestrator ping -c 2 mtsa-pilot >/dev/null 2>&1; then
                        echo "✅ MTSA network connectivity verified after restart"
                    else
                        echo "⚠️  MTSA network connectivity still has issues"
                    fi
                else
                    echo "ℹ️  No MTSA container found to connect"
                fi
                ;;
        esac
        
        sleep 5
        echo "📊 Container status after restart:"
        docker ps --format "table {{.Names}}\t{{.Status}}"
EOF
    
    print_success "Service restart completed"
}

# Function to cleanup Docker resources
cleanup_docker() {
    print_section "Cleaning up Docker resources"
    
    ssh $REMOTE_HOST << 'EOF'
        echo "🧹 Removing unused Docker images..."
        docker image prune -f
        
        echo "🧹 Removing unused Docker volumes..."
        docker volume prune -f
        
        echo "🧹 Removing unused Docker networks..."
        docker network prune -f
        
        echo "📊 Docker disk usage after cleanup:"
        docker system df
EOF
    
    print_success "Docker cleanup completed"
}

# Main deployment function
deploy_all() {
    echo "🚀 Starting Full Deployment: DocuSeal + Signing Orchestrator"
    echo "============================================================"
    echo "📍 Local base directory: $LOCAL_BASE_DIR"
    echo "🌐 Remote server: $REMOTE_USER@$REMOTE_HOST:$REMOTE_PORT"
    echo "📁 Remote base directory: $REMOTE_BASE_DIR"
    echo ""
    
    # Check connection
    if ! check_remote_connection; then
        print_error "Deployment aborted due to connection failure"
        exit 1
    fi
    
    # Create backup
    backup_deployments
    
    # Sync files
    sync_docuseal
    sync_orchestrator
    sync_mtsa
    
    # Setup environments
    setup_environments
    
    # Deploy services
    deploy_docuseal
    deploy_orchestrator
    deploy_mtsa
    
    # Show status
    show_deployment_status
    
    echo ""
    print_success "🎉 Full deployment completed successfully!"
    echo ""
    echo "📋 Next steps:"
    echo "   1. Configure .env files if needed"
    echo "   2. Set up DocuSeal webhook URL: https://${SIGN_DOMAIN}/orchestrator/webhooks/docuseal"
    echo "   3. Test certificate enrollment and revocation in admin panel"
    echo "   4. Test the complete signing workflow"
    echo ""
    echo "🔧 Useful commands:"
    echo "   $0 status                    - Check deployment status"
    echo "   $0 logs [docuseal|orchestrator] - View logs"
    echo "   $0 restart [docuseal|orchestrator] - Restart services"
    echo "   $0 cleanup                   - Clean up Docker resources"
    echo "   $0 backup                    - Create comprehensive backup"
}

# Function to fix network connectivity issues
fix_network() {
    print_section "Fixing Network Connectivity Issues"
    
    ssh $REMOTE_HOST << 'EOF'
        echo "🔗 Diagnosing and fixing network connectivity issues..."
        
        # List all containers
        echo "📊 Current containers:"
        docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Status}}"
        
        # List networks
        echo ""
        echo "🌐 Current networks:"
        docker network ls | grep -E "(docuseal|mtsa|signing)"
        
        # Find MTSA container
        mtsa_container=$(docker ps --format "{{.Names}}" | grep mtsa | head -1)
        orchestrator_container=$(docker ps --format "{{.Names}}" | grep orchestrator | head -1)
        
        if [ -z "$mtsa_container" ]; then
            echo "❌ No MTSA container found running"
            exit 1
        fi
        
        if [ -z "$orchestrator_container" ]; then
            echo "❌ No Signing Orchestrator container found running"
            exit 1
        fi
        
        echo ""
        echo "🔍 Found containers:"
        echo "   MTSA: $mtsa_container"
        echo "   Orchestrator: $orchestrator_container"
        
        # Check current network connectivity
        echo ""
        echo "🧪 Testing current connectivity..."
        if docker exec "$orchestrator_container" ping -c 2 mtsa-pilot >/dev/null 2>&1; then
            echo "✅ Network connectivity is already working"
        else
            echo "❌ Network connectivity broken - attempting fix..."
            
            # Try to connect MTSA to orchestrator network
            echo "🔧 Connecting MTSA to Signing Orchestrator network..."
            docker network connect signing-orchestrator_mtsa-network "$mtsa_container" 2>/dev/null || echo "Network connection failed or already exists"
            
            # Wait a moment for network to settle
            sleep 3
            
            # Test again
            echo "🧪 Testing connectivity after fix..."
            if docker exec "$orchestrator_container" ping -c 2 mtsa-pilot >/dev/null 2>&1; then
                echo "✅ Network connectivity fixed successfully!"
            else
                echo "❌ Network connectivity still broken"
                echo ""
                echo "🔍 Network diagnostics:"
                echo "Networks for $mtsa_container:"
                docker inspect "$mtsa_container" --format '{{range $k, $v := .NetworkSettings.Networks}}{{$k}} {{end}}'
                echo "Networks for $orchestrator_container:"
                docker inspect "$orchestrator_container" --format '{{range $k, $v := .NetworkSettings.Networks}}{{$k}} {{end}}'
            fi
        fi
        
        echo ""
        echo "🧪 Final connectivity test:"
        if docker exec "$orchestrator_container" ping -c 2 mtsa-pilot >/dev/null 2>&1; then
            echo "✅ MTSA network connectivity: WORKING"
        else
            echo "❌ MTSA network connectivity: FAILED"
        fi
        
        if curl -f -s http://localhost:8080/MTSAPilot/MyTrustSignerAgentWSAPv2?wsdl >/dev/null 2>&1; then
            echo "✅ MTSA WSDL endpoint: ACCESSIBLE"
        else
            echo "❌ MTSA WSDL endpoint: NOT ACCESSIBLE"
        fi
EOF
    
    print_success "Network connectivity fix completed"
}

# Parse command line arguments
case "${1:-deploy}" in
    "deploy")
        deploy_all
        ;;
    "status")
        check_remote_connection && show_deployment_status
        ;;
    "logs")
        check_remote_connection && show_logs "${2:-all}"
        ;;
    "restart")
        check_remote_connection && restart_services "${2:-all}"
        ;;
    "cleanup")
        check_remote_connection && cleanup_docker
        ;;
    "backup")
        check_remote_connection && backup_deployments
        ;;
    "restore")
        check_remote_connection && restore_from_backup "$2"
        ;;
    "sync")
        check_remote_connection && sync_docuseal && sync_orchestrator && sync_mtsa
        ;;
    "fix-network")
        check_remote_connection && fix_network
        ;;
    *)
        echo "Usage: $0 [deploy|status|logs|restart|cleanup|backup|restore|sync|fix-network]"
        echo ""
        echo "Commands:"
        echo "  deploy              - Full deployment (default)"
        echo "  status              - Check deployment status"
        echo "  logs [service]      - View logs (docuseal|orchestrator|all)"
        echo "  restart [service]   - Restart services (docuseal|orchestrator|all)"
        echo "  cleanup             - Clean up old Docker resources"
        echo "  backup              - Create comprehensive backup (database + volumes + files)"
        echo "  restore <name>      - Restore from backup (lists available if no name given)"
        echo "  sync                - Sync files only (no Docker rebuild)"
        echo "  fix-network         - Fix MTSA network connectivity issues"
        echo ""
        echo "Examples:"
        echo "  $0 deploy           - Deploy both systems"
        echo "  $0 backup           - Create comprehensive backup"
        echo "  $0 restore full-backup-20250830_120000 - Restore from specific backup"
        echo "  $0 logs docuseal    - Show DocuSeal logs"
        echo "  $0 restart orchestrator - Restart only Signing Orchestrator"
        echo "  $0 fix-network      - Fix MTSA connectivity issues"
        exit 1
        ;;
esac
