#!/bin/bash

# MTSA DNS Resolution Testing Script
# Tests DNS resolution capabilities from MTSA container before/after DNS configuration changes

set -e

echo "=========================================="
echo "🔍 MTSA DNS Resolution Diagnostic Test"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Find MTSA container
echo "📦 Finding MTSA containers..."
MTSA_PILOT=$(docker ps --format "{{.Names}}" | grep -i "mtsa.*pilot" | head -1 || echo "")
MTSA_PROD=$(docker ps --format "{{.Names}}" | grep -i "mtsa.*prod" | head -1 || echo "")

if [ -z "$MTSA_PILOT" ] && [ -z "$MTSA_PROD" ]; then
    echo -e "${RED}❌ No MTSA container found running${NC}"
    echo "Available containers:"
    docker ps --format "table {{.Names}}\t{{.Status}}"
    exit 1
fi

# Test both containers if available
CONTAINERS=()
if [ -n "$MTSA_PILOT" ]; then
    CONTAINERS+=("$MTSA_PILOT")
    echo -e "${GREEN}✓ Found MTSA Pilot:${NC} $MTSA_PILOT"
fi
if [ -n "$MTSA_PROD" ]; then
    CONTAINERS+=("$MTSA_PROD")
    echo -e "${GREEN}✓ Found MTSA Production:${NC} $MTSA_PROD"
fi

echo ""

# Critical domains that MTSA needs to resolve
CRITICAL_DOMAINS=(
    "digitalid.msctrustgate.com"
    "ocsp.msctrustgate.com"
    "crl.msctrustgate.com"
)

# Public DNS servers for comparison
PUBLIC_DNS_SERVERS=(
    "8.8.8.8"
    "1.1.1.1"
)

# Function to test DNS resolution with timing
test_dns_resolution() {
    local container=$1
    local domain=$2
    local max_attempts=5
    
    echo -e "${BLUE}Testing: $domain${NC}"
    
    # Check if nslookup/dig is available
    local has_nslookup=$(docker exec "$container" sh -c "command -v nslookup" 2>/dev/null || echo "")
    local has_dig=$(docker exec "$container" sh -c "command -v dig" 2>/dev/null || echo "")
    
    if [ -z "$has_nslookup" ] && [ -z "$has_dig" ]; then
        echo -e "${YELLOW}  ⚠️  Neither nslookup nor dig available, testing with ping/curl${NC}"
        
        # Try ping
        if docker exec "$container" sh -c "ping -c 1 -W 3 $domain >/dev/null 2>&1"; then
            echo -e "${GREEN}  ✓ DNS Resolution: SUCCESS (via ping)${NC}"
            return 0
        else
            echo -e "${RED}  ✗ DNS Resolution: FAILED (via ping)${NC}"
            return 1
        fi
    fi
    
    # Attempt resolution multiple times to check for intermittency
    local success_count=0
    local fail_count=0
    local total_time=0
    
    echo "  Running $max_attempts resolution attempts..."
    
    for attempt in $(seq 1 $max_attempts); do
        if [ -n "$has_nslookup" ]; then
            # Use nslookup with timing
            start_time=$(date +%s%N)
            if docker exec "$container" sh -c "nslookup $domain >/dev/null 2>&1"; then
                end_time=$(date +%s%N)
                duration=$(( (end_time - start_time) / 1000000 )) # Convert to milliseconds
                total_time=$((total_time + duration))
                success_count=$((success_count + 1))
                echo -e "    Attempt $attempt: ${GREEN}✓${NC} (${duration}ms)"
            else
                fail_count=$((fail_count + 1))
                echo -e "    Attempt $attempt: ${RED}✗${NC}"
            fi
        elif [ -n "$has_dig" ]; then
            # Use dig with timing
            start_time=$(date +%s%N)
            if docker exec "$container" sh -c "dig +short $domain >/dev/null 2>&1"; then
                end_time=$(date +%s%N)
                duration=$(( (end_time - start_time) / 1000000 ))
                total_time=$((total_time + duration))
                success_count=$((success_count + 1))
                echo -e "    Attempt $attempt: ${GREEN}✓${NC} (${duration}ms)"
            else
                fail_count=$((fail_count + 1))
                echo -e "    Attempt $attempt: ${RED}✗${NC}"
            fi
        fi
        
        # Small delay between attempts
        sleep 0.5
    done
    
    # Calculate statistics
    if [ $success_count -gt 0 ]; then
        avg_time=$((total_time / success_count))
        echo -e "  ${BLUE}Results:${NC} $success_count/$max_attempts successful (avg ${avg_time}ms)"
        
        if [ $success_count -eq $max_attempts ]; then
            echo -e "  ${GREEN}✓ DNS Resolution: RELIABLE${NC}"
            return 0
        else
            echo -e "  ${YELLOW}⚠️  DNS Resolution: INTERMITTENT (${success_count}/${max_attempts})${NC}"
            return 1
        fi
    else
        echo -e "  ${RED}✗ DNS Resolution: FAILED (0/$max_attempts)${NC}"
        return 1
    fi
}

# Function to check DNS configuration
check_dns_config() {
    local container=$1
    
    echo -e "${BLUE}📋 Checking DNS Configuration${NC}"
    echo ""
    
    # Check /etc/resolv.conf
    echo "  /etc/resolv.conf contents:"
    docker exec "$container" sh -c "cat /etc/resolv.conf 2>/dev/null" | while read line; do
        if [[ $line == nameserver* ]]; then
            nameserver=$(echo "$line" | awk '{print $2}')
            if [[ $nameserver == 127.0.0.11 ]]; then
                echo -e "    ${YELLOW}$line${NC} (Docker internal DNS - may be unreliable)"
            else
                echo -e "    ${GREEN}$line${NC}"
            fi
        else
            echo "    $line"
        fi
    done
    echo ""
    
    # Check if custom DNS options are set
    echo "  DNS Options:"
    if docker exec "$container" sh -c "cat /etc/resolv.conf 2>/dev/null" | grep -q "options"; then
        docker exec "$container" sh -c "cat /etc/resolv.conf 2>/dev/null" | grep "options"
    else
        echo -e "    ${YELLOW}No custom DNS options configured${NC}"
    fi
    echo ""
}

# Function to test network connectivity
test_network_connectivity() {
    local container=$1
    
    echo -e "${BLUE}🌐 Testing Network Connectivity${NC}"
    echo ""
    
    # Test basic internet connectivity
    echo "  Testing internet connectivity (google.com):"
    if docker exec "$container" sh -c "ping -c 2 -W 3 8.8.8.8 >/dev/null 2>&1"; then
        echo -e "    ${GREEN}✓ Internet connectivity: OK${NC}"
    else
        echo -e "    ${RED}✗ Internet connectivity: FAILED${NC}"
        return 1
    fi
    
    # Test public DNS servers
    echo ""
    echo "  Testing connectivity to public DNS servers:"
    for dns_server in "${PUBLIC_DNS_SERVERS[@]}"; do
        if docker exec "$container" sh -c "ping -c 2 -W 3 $dns_server >/dev/null 2>&1"; then
            echo -e "    ${GREEN}✓ $dns_server (reachable)${NC}"
        else
            echo -e "    ${RED}✗ $dns_server (unreachable)${NC}"
        fi
    done
    echo ""
}

# Main test execution
for container in "${CONTAINERS[@]}"; do
    echo "=========================================="
    echo -e "${GREEN}Testing Container: $container${NC}"
    echo "=========================================="
    echo ""
    
    # Check if container is running
    if ! docker ps | grep -q "$container"; then
        echo -e "${RED}❌ Container $container is not running${NC}"
        continue
    fi
    
    # Check DNS configuration
    check_dns_config "$container"
    
    # Test network connectivity
    test_network_connectivity "$container"
    
    # Test critical domain resolution
    echo -e "${BLUE}🔍 Testing Critical MSC TrustGate Domains${NC}"
    echo ""
    
    total_domains=${#CRITICAL_DOMAINS[@]}
    successful_domains=0
    
    for domain in "${CRITICAL_DOMAINS[@]}"; do
        if test_dns_resolution "$container" "$domain"; then
            successful_domains=$((successful_domains + 1))
        fi
        echo ""
    done
    
    # Summary
    echo "=========================================="
    echo -e "${BLUE}📊 Summary for $container${NC}"
    echo "=========================================="
    echo ""
    echo "  Domains tested: $total_domains"
    echo "  Successful: $successful_domains"
    echo "  Failed: $((total_domains - successful_domains))"
    echo ""
    
    if [ $successful_domains -eq $total_domains ]; then
        echo -e "${GREEN}✅ All critical domains resolved successfully${NC}"
        echo -e "${GREEN}   DNS configuration appears to be working well${NC}"
    elif [ $successful_domains -gt 0 ]; then
        echo -e "${YELLOW}⚠️  Partial DNS resolution success${NC}"
        echo -e "${YELLOW}   DNS configuration may need improvement${NC}"
    else
        echo -e "${RED}❌ All DNS resolutions failed${NC}"
        echo -e "${RED}   DNS configuration requires immediate attention${NC}"
    fi
    
    echo ""
    echo "=========================================="
    echo ""
done

# Docker network inspection
echo "=========================================="
echo -e "${BLUE}🔍 Docker Network Inspection${NC}"
echo "=========================================="
echo ""

for container in "${CONTAINERS[@]}"; do
    echo "Container: $container"
    echo "Networks:"
    docker inspect "$container" --format='{{range $net, $conf := .NetworkSettings.Networks}}  - {{$net}} ({{$conf.IPAddress}}){{println}}{{end}}'
    echo ""
done

# Check if signing orchestrator can reach MTSA
ORCHESTRATOR=$(docker ps --format "{{.Names}}" | grep -i "orchestrator" | head -1 || echo "")
if [ -n "$ORCHESTRATOR" ] && [ -n "$MTSA_PILOT" ]; then
    echo "Testing: Signing Orchestrator → MTSA connectivity"
    if docker exec "$ORCHESTRATOR" sh -c "ping -c 2 mtsa-pilot >/dev/null 2>&1" 2>/dev/null; then
        echo -e "${GREEN}✓ Orchestrator can reach MTSA${NC}"
    else
        echo -e "${YELLOW}⚠️  Orchestrator cannot reach MTSA by hostname${NC}"
    fi
    echo ""
fi

echo "=========================================="
echo -e "${GREEN}✅ DNS Diagnostic Test Complete${NC}"
echo "=========================================="
echo ""
echo "💡 Next Steps:"
echo ""
echo "  If DNS resolution is failing or intermittent:"
echo "    1. Apply DNS configuration fix (add explicit DNS servers)"
echo "    2. Re-run this test to compare before/after"
echo ""
echo "  If DNS resolution is working:"
echo "    - The issue may be load-related or external CA service issues"
echo "    - Consider implementing caching or retry logic"
echo ""

