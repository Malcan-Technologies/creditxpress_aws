#!/bin/bash

# Deploy DNS Configuration Fix to On-Prem MTSA Server
# This script:
# 1. Tests DNS resolution BEFORE changes (baseline)
# 2. Backs up current docker-compose files
# 3. Applies DNS configuration to MTSA and Signing Orchestrator
# 4. Restarts containers with new configuration
# 5. Tests DNS resolution AFTER changes (validation)

set -e

# Configuration
REMOTE_HOST="ivan@192.168.0.100"  # Update with your on-prem server
REMOTE_MTSA_DIR="/home/ivan/mtsa"
REMOTE_ORCHESTRATOR_DIR="/home/ivan/signing-orchestrator"
LOCAL_SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOCAL_REPO_ROOT="$(dirname "$LOCAL_SCRIPT_DIR")"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo "=========================================="
echo -e "${CYAN}🔧 MTSA DNS Configuration Fix Deployment${NC}"
echo "=========================================="
echo ""
echo "This script will:"
echo "  1. Test DNS resolution (BEFORE)"
echo "  2. Backup current configurations"
echo "  3. Apply DNS fixes"
echo "  4. Restart containers"
echo "  5. Test DNS resolution (AFTER)"
echo ""
read -p "Press Enter to continue or Ctrl+C to cancel..."
echo ""

# Function to print section headers
print_section() {
    echo ""
    echo "=========================================="
    echo -e "${BLUE}$1${NC}"
    echo "=========================================="
    echo ""
}

# Step 1: Copy DNS test script to remote server
print_section "Step 1: Uploading DNS Test Script"

echo "Copying test script to remote server..."
scp "$LOCAL_REPO_ROOT/on-prem/scripts/test-mtsa-dns.sh" "$REMOTE_HOST:/tmp/test-mtsa-dns.sh"
ssh "$REMOTE_HOST" "chmod +x /tmp/test-mtsa-dns.sh"
echo -e "${GREEN}✓ Test script uploaded${NC}"

# Step 2: Run BEFORE test
print_section "Step 2: DNS Resolution Test (BEFORE Changes)"

echo -e "${YELLOW}Running baseline DNS test...${NC}"
ssh "$REMOTE_HOST" "/tmp/test-mtsa-dns.sh" | tee "/tmp/dns-test-before.log"

echo ""
echo -e "${CYAN}📋 Baseline test complete. Results saved to /tmp/dns-test-before.log${NC}"
echo ""
read -p "Review the results above. Press Enter to continue with DNS fix deployment..."

# Step 3: Backup existing configurations
print_section "Step 3: Backing Up Current Configurations"

BACKUP_TIMESTAMP=$(date +%Y%m%d_%H%M%S)

ssh "$REMOTE_HOST" << EOF
    echo "Creating backup directory..."
    mkdir -p ~/backups/dns-fix-$BACKUP_TIMESTAMP
    
    # Backup MTSA docker-compose if it exists
    if [ -f "$REMOTE_MTSA_DIR/docker-compose.yml" ]; then
        cp "$REMOTE_MTSA_DIR/docker-compose.yml" ~/backups/dns-fix-$BACKUP_TIMESTAMP/mtsa-docker-compose.yml
        echo "✓ Backed up MTSA docker-compose.yml"
    else
        echo "⚠️  No existing MTSA docker-compose.yml found (will create new)"
    fi
    
    # Backup Signing Orchestrator docker-compose
    if [ -f "$REMOTE_ORCHESTRATOR_DIR/docker-compose.yml" ]; then
        cp "$REMOTE_ORCHESTRATOR_DIR/docker-compose.yml" ~/backups/dns-fix-$BACKUP_TIMESTAMP/orchestrator-docker-compose.yml
        echo "✓ Backed up Signing Orchestrator docker-compose.yml"
    fi
    
    echo ""
    echo "Backup location: ~/backups/dns-fix-$BACKUP_TIMESTAMP/"
EOF

echo -e "${GREEN}✓ Backups created${NC}"

# Step 4: Create MTSA docker-compose with DNS configuration
print_section "Step 4: Creating MTSA Docker Compose with DNS Configuration"

# Create temporary docker-compose file
cat > /tmp/mtsa-docker-compose.yml << 'MTSA_EOF'
version: '3.8'

services:
  # MTSA Pilot Environment (Development/Testing)
  mtsa-pilot:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: mtsa-pilot-dev
    restart: unless-stopped
    ports:
      - "8080:8080"
    
    # DNS Configuration - CRITICAL for MTSA to reach digitalid.msctrustgate.com
    dns:
      - 8.8.8.8          # Google Public DNS (Primary)
      - 8.8.4.4          # Google Public DNS (Secondary)
      - 1.1.1.1          # Cloudflare DNS (Fallback)
    dns_search:
      - msctrustgate.com # Helps resolve MTSA-related domains
    dns_opt:
      - ndots:1          # Reduce DNS queries
      - timeout:5        # DNS query timeout in seconds
      - attempts:3       # Number of DNS query attempts
    
    environment:
      - CATALINA_OPTS=-Djava.net.preferIPv4Stack=true -Djava.security.egd=file:/dev/./urandom
      - TZ=Asia/Kuala_Lumpur
      # Java DNS caching settings (prevent stale DNS entries)
      - JAVA_OPTS=-Dsun.net.inetaddr.ttl=60 -Dsun.net.inetaddr.negative.ttl=10
    
    volumes:
      - ./mtsa:/usr/local/tomcat/mtsa:ro
      - mtsa-pilot-logs:/usr/local/tomcat/logs
      - mtsa-pilot-work:/usr/local/tomcat/work
      - mtsa-pilot-temp:/usr/local/tomcat/temp
    
    networks:
      - mtsa-network
    
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/MTSAPilot/MyTrustSignerAgentWSAPv2?wsdl"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 60s
    
    labels:
      - "com.creditxpress.service=mtsa-pilot"
      - "com.creditxpress.environment=development"

  # MTSA Production Environment (optional, disabled by default)
  mtsa-prod:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: mtsa-prod
    restart: unless-stopped
    ports:
      - "8081:8080"
    
    # DNS Configuration - same as pilot
    dns:
      - 8.8.8.8
      - 8.8.4.4
      - 1.1.1.1
    dns_search:
      - msctrustgate.com
    dns_opt:
      - ndots:1
      - timeout:5
      - attempts:3
    
    environment:
      - CATALINA_OPTS=-Djava.net.preferIPv4Stack=true -Djava.security.egd=file:/dev/./urandom
      - TZ=Asia/Kuala_Lumpur
      - JAVA_OPTS=-Dsun.net.inetaddr.ttl=60 -Dsun.net.inetaddr.negative.ttl=10
    
    volumes:
      - ./mtsa:/usr/local/tomcat/mtsa:ro
      - mtsa-prod-logs:/usr/local/tomcat/logs
      - mtsa-prod-work:/usr/local/tomcat/work
      - mtsa-prod-temp:/usr/local/tomcat/temp
    
    networks:
      - mtsa-network
    
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/MTSA/MyTrustSignerAgentWSAPv2?wsdl"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 60s
    
    labels:
      - "com.creditxpress.service=mtsa-prod"
      - "com.creditxpress.environment=production"
    
    profiles:
      - production

volumes:
  mtsa-pilot-logs:
    driver: local
  mtsa-pilot-work:
    driver: local
  mtsa-pilot-temp:
    driver: local
  mtsa-prod-logs:
    driver: local
  mtsa-prod-work:
    driver: local
  mtsa-prod-temp:
    driver: local

networks:
  mtsa-network:
    driver: bridge
    internal: false  # Allow outbound internet access
    ipam:
      driver: default
      config:
        - subnet: 172.20.0.0/16
          gateway: 172.20.0.1
    driver_opts:
      com.docker.network.enable_ipv6: "false"
      com.docker.network.driver.mtu: "1500"
MTSA_EOF

echo "✓ Created MTSA docker-compose.yml with DNS configuration"
echo ""
echo "Key changes:"
echo "  - Added Google DNS (8.8.8.8, 8.8.4.4) as primary/secondary"
echo "  - Added Cloudflare DNS (1.1.1.1) as fallback"
echo "  - Configured DNS timeout (5s) and retry attempts (3)"
echo "  - Added Java DNS caching settings (60s TTL)"
echo ""

# Step 5: Update Signing Orchestrator docker-compose
print_section "Step 5: Updating Signing Orchestrator DNS Configuration"

# Copy current orchestrator docker-compose, download and patch it
ssh "$REMOTE_HOST" "cat $REMOTE_ORCHESTRATOR_DIR/docker-compose.yml" > /tmp/orchestrator-docker-compose.yml

# Check if DNS configuration already exists
if grep -q "dns:" /tmp/orchestrator-docker-compose.yml; then
    echo -e "${YELLOW}⚠️  DNS configuration already exists in orchestrator docker-compose.yml${NC}"
    echo "Skipping orchestrator update to avoid conflicts."
else
    echo "Adding DNS configuration to Signing Orchestrator..."
    
    # Create patched version (insert DNS config after environment section)
    awk '
    /^    environment:/ { in_env=1 }
    in_env && /^    [^ ]/ && !/^    environment:/ && !/^      -/ {
        print "    "
        print "    # DNS Configuration - ensure orchestrator can resolve MTSA services and external DNS"
        print "    dns:"
        print "      - 8.8.8.8          # Google Public DNS (Primary)"
        print "      - 8.8.4.4          # Google Public DNS (Secondary)"
        print "      - 1.1.1.1          # Cloudflare DNS (Fallback)"
        print "    dns_opt:"
        print "      - ndots:1"
        print "      - timeout:5"
        print "      - attempts:3"
        in_env=0
    }
    { print }
    ' /tmp/orchestrator-docker-compose.yml > /tmp/orchestrator-docker-compose-patched.yml
    
    mv /tmp/orchestrator-docker-compose-patched.yml /tmp/orchestrator-docker-compose.yml
    echo "✓ DNS configuration added to Signing Orchestrator"
fi
echo ""

# Step 6: Upload configurations to remote server
print_section "Step 6: Uploading New Configurations"

echo "Uploading MTSA docker-compose.yml..."
scp /tmp/mtsa-docker-compose.yml "$REMOTE_HOST:$REMOTE_MTSA_DIR/docker-compose.yml"
echo "✓ MTSA configuration uploaded"

echo ""
echo "Uploading Signing Orchestrator docker-compose.yml..."
scp /tmp/orchestrator-docker-compose.yml "$REMOTE_HOST:$REMOTE_ORCHESTRATOR_DIR/docker-compose.yml"
echo "✓ Signing Orchestrator configuration uploaded"
echo ""

# Step 7: Restart containers with new configuration
print_section "Step 7: Restarting Containers with New Configuration"

echo -e "${YELLOW}This will restart MTSA and Signing Orchestrator containers...${NC}"
read -p "Press Enter to continue or Ctrl+C to cancel..."
echo ""

ssh "$REMOTE_HOST" << 'EOF'
    set -e
    
    echo "🔄 Restarting MTSA container..."
    cd ~/mtsa
    docker-compose down
    docker-compose up -d
    
    echo ""
    echo "⏳ Waiting for MTSA to start (30 seconds)..."
    sleep 30
    
    echo ""
    echo "🔄 Restarting Signing Orchestrator..."
    cd ~/signing-orchestrator
    docker-compose down
    docker-compose up -d
    
    echo ""
    echo "⏳ Waiting for Signing Orchestrator to start (20 seconds)..."
    sleep 20
    
    echo ""
    echo "📊 Container Status:"
    docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep -E "(mtsa|orchestrator)"
EOF

echo -e "${GREEN}✓ Containers restarted successfully${NC}"

# Step 8: Run AFTER test
print_section "Step 8: DNS Resolution Test (AFTER Changes)"

echo "⏳ Waiting an additional 10 seconds for containers to fully initialize..."
sleep 10
echo ""

echo -e "${YELLOW}Running post-deployment DNS test...${NC}"
ssh "$REMOTE_HOST" "/tmp/test-mtsa-dns.sh" | tee "/tmp/dns-test-after.log"

echo ""
echo -e "${CYAN}📋 Post-deployment test complete. Results saved to /tmp/dns-test-after.log${NC}"

# Step 9: Summary and comparison
print_section "Step 9: Deployment Summary"

echo -e "${GREEN}✅ DNS Configuration Fix Deployment Complete!${NC}"
echo ""
echo "📊 Test Results:"
echo "  - BEFORE test: /tmp/dns-test-before.log"
echo "  - AFTER test:  /tmp/dns-test-after.log"
echo ""
echo "🔍 Compare results:"
echo "  diff /tmp/dns-test-before.log /tmp/dns-test-after.log"
echo ""
echo "📋 Backup location on remote server:"
echo "  ~/backups/dns-fix-$BACKUP_TIMESTAMP/"
echo ""
echo "💡 Next Steps:"
echo ""
echo "  1. Review test results above"
echo "  2. Check if DNS resolution improved"
echo "  3. Monitor /api/mtsa/cert-info endpoint in production"
echo "  4. Check logs: docker logs mtsa-pilot-dev"
echo ""
echo "⚠️  If issues persist:"
echo "  - DNS may not be the only issue"
echo "  - Consider implementing application-level caching"
echo "  - Check mobile app request patterns"
echo ""
echo "🔄 To rollback if needed:"
echo "  scp ~/backups/dns-fix-$BACKUP_TIMESTAMP/*.yml [original locations]"
echo "  docker-compose down && docker-compose up -d"
echo ""

# Clean up local temp files
rm -f /tmp/mtsa-docker-compose.yml /tmp/orchestrator-docker-compose.yml

echo "=========================================="
echo -e "${CYAN}✅ Deployment Script Complete${NC}"
echo "=========================================="

