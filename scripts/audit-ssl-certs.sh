#!/bin/bash

# SSL Certificate Audit Script
# Retrieves and analyzes SSL certificates from Kredit infrastructure

set -e

echo "=== SSL Certificate Audit Tool ==="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

# Server configurations
VPS_IP="100.85.61.82"
VPS_USER="root"
ONPREM_IP="100.76.8.62"
ONPREM_USER="admin-kapital"

# Domains and services (Production: creditxpress.com.my)
DOMAINS=(
    "creditxpress.com.my:443"
    "www.creditxpress.com.my:443"
    "admin.creditxpress.com.my:443"
    "api.creditxpress.com.my:443"
    "sign.creditxpress.com.my:443"
)

# Output directory
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
REPORT_FILE="ssl_cert_audit_${TIMESTAMP}.txt"
CERT_DIR="ssl_certs_${TIMESTAMP}"
mkdir -p "$CERT_DIR"

echo "Generating SSL certificate audit..."
echo ""

# Function to check SSL certificate for a domain
check_domain_cert() {
    local DOMAIN=$1
    
    echo "" | tee -a "$REPORT_FILE"
    echo "========================================" | tee -a "$REPORT_FILE"
    echo -e "${BLUE}Domain: ${DOMAIN}${NC}" | tee -a "$REPORT_FILE"
    echo "========================================" | tee -a "$REPORT_FILE"
    echo "" | tee -a "$REPORT_FILE"
    
    # Extract host and port
    local HOST=$(echo "$DOMAIN" | cut -d: -f1)
    local PORT=$(echo "$DOMAIN" | cut -d: -f2)
    
    # Check if domain resolves
    if ! host "$HOST" > /dev/null 2>&1; then
        echo -e "${RED}✗ Domain does not resolve${NC}" | tee -a "$REPORT_FILE"
        return 1
    fi
    
    echo -e "${GREEN}✓ Domain resolves${NC}" | tee -a "$REPORT_FILE"
    echo "" | tee -a "$REPORT_FILE"
    
    # Get certificate information
    echo -e "${CYAN}Certificate Information:${NC}" | tee -a "$REPORT_FILE"
    echo "-------------------------" | tee -a "$REPORT_FILE"
    
    # Retrieve certificate
    local CERT_FILE="${CERT_DIR}/${HOST}.crt"
    echo | openssl s_client -servername "$HOST" -connect "${HOST}:${PORT}" 2>/dev/null | \
        openssl x509 -out "$CERT_FILE" 2>/dev/null || {
        echo -e "${RED}✗ Could not retrieve certificate${NC}" | tee -a "$REPORT_FILE"
        return 1
    }
    
    echo -e "${GREEN}✓ Certificate retrieved and saved to ${CERT_FILE}${NC}" | tee -a "$REPORT_FILE"
    echo "" | tee -a "$REPORT_FILE"
    
    # Parse certificate details
    local SUBJECT=$(openssl x509 -in "$CERT_FILE" -noout -subject 2>/dev/null | sed 's/subject=//')
    local ISSUER=$(openssl x509 -in "$CERT_FILE" -noout -issuer 2>/dev/null | sed 's/issuer=//')
    local START_DATE=$(openssl x509 -in "$CERT_FILE" -noout -startdate 2>/dev/null | sed 's/notBefore=//')
    local END_DATE=$(openssl x509 -in "$CERT_FILE" -noout -enddate 2>/dev/null | sed 's/notAfter=//')
    local FINGERPRINT=$(openssl x509 -in "$CERT_FILE" -noout -fingerprint -sha256 2>/dev/null | sed 's/SHA256 Fingerprint=//')
    local SERIAL=$(openssl x509 -in "$CERT_FILE" -noout -serial 2>/dev/null | sed 's/serial=//')
    
    # Get SAN (Subject Alternative Names)
    local SAN=$(openssl x509 -in "$CERT_FILE" -noout -text 2>/dev/null | grep -A1 "Subject Alternative Name" | tail -1 | sed 's/^ *//')
    
    echo "Subject: ${SUBJECT}" | tee -a "$REPORT_FILE"
    echo "Issuer: ${ISSUER}" | tee -a "$REPORT_FILE"
    echo "Serial: ${SERIAL}" | tee -a "$REPORT_FILE"
    echo "" | tee -a "$REPORT_FILE"
    echo "Valid From: ${START_DATE}" | tee -a "$REPORT_FILE"
    echo "Valid To: ${END_DATE}" | tee -a "$REPORT_FILE"
    echo "" | tee -a "$REPORT_FILE"
    
    if [ -n "$SAN" ]; then
        echo "Subject Alternative Names:" | tee -a "$REPORT_FILE"
        echo "  ${SAN}" | tee -a "$REPORT_FILE"
        echo "" | tee -a "$REPORT_FILE"
    fi
    
    echo "Fingerprint (SHA256):" | tee -a "$REPORT_FILE"
    echo "  ${FINGERPRINT}" | tee -a "$REPORT_FILE"
    echo "" | tee -a "$REPORT_FILE"
    
    # Check expiry
    local END_EPOCH=$(date -j -f "%b %d %T %Y %Z" "$END_DATE" "+%s" 2>/dev/null || date -d "$END_DATE" +%s 2>/dev/null)
    local NOW_EPOCH=$(date +%s)
    local DAYS_LEFT=$(( ($END_EPOCH - $NOW_EPOCH) / 86400 ))
    
    echo -e "${CYAN}Expiry Status:${NC}" | tee -a "$REPORT_FILE"
    if [ $DAYS_LEFT -lt 0 ]; then
        echo -e "${RED}✗ EXPIRED (${DAYS_LEFT#-} days ago)${NC}" | tee -a "$REPORT_FILE"
    elif [ $DAYS_LEFT -lt 30 ]; then
        echo -e "${RED}⚠ EXPIRES SOON (${DAYS_LEFT} days remaining)${NC}" | tee -a "$REPORT_FILE"
    elif [ $DAYS_LEFT -lt 60 ]; then
        echo -e "${YELLOW}⚠ Expiring in ${DAYS_LEFT} days${NC}" | tee -a "$REPORT_FILE"
    else
        echo -e "${GREEN}✓ Valid for ${DAYS_LEFT} days${NC}" | tee -a "$REPORT_FILE"
    fi
    echo "" | tee -a "$REPORT_FILE"
    
    # Check SSL/TLS protocols and ciphers
    echo -e "${CYAN}SSL/TLS Configuration:${NC}" | tee -a "$REPORT_FILE"
    echo "----------------------" | tee -a "$REPORT_FILE"
    
    # Test TLS versions
    for VERSION in tls1 tls1_1 tls1_2 tls1_3; do
        if echo | openssl s_client -"${VERSION}" -connect "${HOST}:${PORT}" 2>/dev/null | grep -q "Cipher"; then
            echo "  ✓ ${VERSION^^} supported" | tee -a "$REPORT_FILE"
        fi
    done
    echo "" | tee -a "$REPORT_FILE"
    
    # Get cipher suite
    local CIPHER=$(echo | openssl s_client -connect "${HOST}:${PORT}" 2>/dev/null | grep "Cipher" | head -1 | awk '{print $3}')
    echo "Current Cipher: ${CIPHER}" | tee -a "$REPORT_FILE"
    echo "" | tee -a "$REPORT_FILE"
}

# Function to check certificates on VPS
check_vps_certs() {
    echo "" | tee -a "$REPORT_FILE"
    echo "========================================" | tee -a "$REPORT_FILE"
    echo -e "${BLUE}VPS Server Certificates${NC}" | tee -a "$REPORT_FILE"
    echo "========================================" | tee -a "$REPORT_FILE"
    echo "" | tee -a "$REPORT_FILE"
    
    # Common nginx cert locations
    local CERT_PATHS=(
        "/etc/letsencrypt/live/*/fullchain.pem"
        "/etc/nginx/ssl/*.crt"
        "/etc/ssl/certs/*.crt"
    )
    
    ssh ${VPS_USER}@${VPS_IP} << 'ENDSSH' | tee -a "$REPORT_FILE"
echo "Searching for SSL certificates..."
echo ""

# Find Let's Encrypt certificates
if [ -d "/etc/letsencrypt/live" ]; then
    echo "Let's Encrypt Certificates:"
    for domain_dir in /etc/letsencrypt/live/*; do
        if [ -d "$domain_dir" ] && [ -f "$domain_dir/fullchain.pem" ]; then
            domain=$(basename "$domain_dir")
            echo ""
            echo "Domain: $domain"
            openssl x509 -in "$domain_dir/fullchain.pem" -noout -subject -issuer -dates 2>/dev/null || echo "Could not read certificate"
        fi
    done
    echo ""
fi

# Find nginx certificates
if [ -d "/etc/nginx/ssl" ]; then
    echo "Nginx SSL Certificates:"
    find /etc/nginx/ssl -name "*.crt" -o -name "*.pem" 2>/dev/null | while read cert; do
        echo ""
        echo "Certificate: $cert"
        openssl x509 -in "$cert" -noout -subject -issuer -dates 2>/dev/null || echo "Could not read certificate"
    done
    echo ""
fi

# Check nginx configuration for SSL
echo "Nginx SSL Configuration:"
grep -r "ssl_certificate" /etc/nginx/ 2>/dev/null | grep -v "#" | head -10 || echo "No SSL configuration found"
echo ""
ENDSSH
}

# Function to check certificates on On-Prem
check_onprem_certs() {
    echo "" | tee -a "$REPORT_FILE"
    echo "========================================" | tee -a "$REPORT_FILE"
    echo -e "${BLUE}On-Premise Server Certificates${NC}" | tee -a "$REPORT_FILE"
    echo "========================================" | tee -a "$REPORT_FILE"
    echo "" | tee -a "$REPORT_FILE"
    
    ssh ${ONPREM_USER}@${ONPREM_IP} << 'ENDSSH' | tee -a "$REPORT_FILE"
echo "Searching for SSL certificates..."
echo ""

# Find Let's Encrypt certificates
if [ -d "/etc/letsencrypt/live" ]; then
    echo "Let's Encrypt Certificates:"
    for domain_dir in /etc/letsencrypt/live/*; do
        if [ -d "$domain_dir" ] && [ -f "$domain_dir/fullchain.pem" ]; then
            domain=$(basename "$domain_dir")
            echo ""
            echo "Domain: $domain"
            openssl x509 -in "$domain_dir/fullchain.pem" -noout -subject -issuer -dates 2>/dev/null || echo "Could not read certificate"
        fi
    done
    echo ""
fi

# Find DocuSeal/nginx certificates
if [ -d "/etc/nginx/ssl" ]; then
    echo "Nginx SSL Certificates:"
    find /etc/nginx/ssl -name "*.crt" -o -name "*.pem" 2>/dev/null | while read cert; do
        echo ""
        echo "Certificate: $cert"
        openssl x509 -in "$cert" -noout -subject -issuer -dates 2>/dev/null || echo "Could not read certificate"
    done
    echo ""
fi

# Check for DocuSeal specific certs
if [ -d "/opt/docuseal" ]; then
    echo "DocuSeal Certificates:"
    find /opt/docuseal -name "*.crt" -o -name "*.pem" 2>/dev/null | while read cert; do
        echo ""
        echo "Certificate: $cert"
        openssl x509 -in "$cert" -noout -subject -issuer -dates 2>/dev/null || echo "Could not read certificate"
    done
    echo ""
fi

echo "Nginx SSL Configuration:"
grep -r "ssl_certificate" /etc/nginx/ 2>/dev/null | grep -v "#" | head -10 || echo "No SSL configuration found"
echo ""
ENDSSH
}

# Function to download certificate from server
download_server_cert() {
    local SERVER_USER=$1
    local SERVER_IP=$2
    local SERVER_NAME=$3
    local CERT_PATH=$4
    
    echo -e "${CYAN}Downloading certificate from ${SERVER_NAME}...${NC}"
    
    local OUTPUT_FILE="${CERT_DIR}/${SERVER_NAME}_$(basename $CERT_PATH)"
    scp "${SERVER_USER}@${SERVER_IP}:${CERT_PATH}" "$OUTPUT_FILE" 2>/dev/null || {
        echo -e "${RED}Could not download certificate${NC}"
        return 1
    }
    
    echo -e "${GREEN}✓ Certificate saved to ${OUTPUT_FILE}${NC}"
    
    # Display certificate info
    openssl x509 -in "$OUTPUT_FILE" -noout -text | head -30
    echo ""
}

# Generate report header
{
    echo "========================================"
    echo "     SSL CERTIFICATE AUDIT REPORT"
    echo "========================================"
    echo "Generated: $(date)"
    echo "Auditor: $(whoami)"
    echo "========================================"
} > "$REPORT_FILE"

# Main menu
echo -e "${YELLOW}Select audit scope:${NC}"
echo "1) Check all public domains (creditxpress.com.my, api.creditxpress.com.my, etc.)"
echo "2) Audit VPS server certificates"
echo "3) Audit On-Prem server certificates"
echo "4) Download specific certificate from server"
echo "5) All of the above"
echo ""
read -p "Enter your choice (1-5): " AUDIT_CHOICE

case $AUDIT_CHOICE in
    1)
        echo ""
        for DOMAIN in "${DOMAINS[@]}"; do
            check_domain_cert "$DOMAIN"
        done
        ;;
        
    2)
        check_vps_certs
        ;;
        
    3)
        check_onprem_certs
        ;;
        
    4)
        echo ""
        echo "Select server:"
        echo "1) VPS"
        echo "2) On-Prem"
        read -p "Choice: " SERVER_CHOICE
        
        echo ""
        read -p "Enter certificate path on server: " CERT_PATH
        
        if [ "$SERVER_CHOICE" = "1" ]; then
            download_server_cert "$VPS_USER" "$VPS_IP" "VPS" "$CERT_PATH"
        elif [ "$SERVER_CHOICE" = "2" ]; then
            download_server_cert "$ONPREM_USER" "$ONPREM_IP" "OnPrem" "$CERT_PATH"
        fi
        ;;
        
    5)
        echo ""
        for DOMAIN in "${DOMAINS[@]}"; do
            check_domain_cert "$DOMAIN"
        done
        check_vps_certs
        check_onprem_certs
        ;;
        
    *)
        echo -e "${RED}Invalid choice${NC}"
        exit 1
        ;;
esac

# Summary
echo "" | tee -a "$REPORT_FILE"
echo "========================================" | tee -a "$REPORT_FILE"
echo -e "${MAGENTA}AUDIT SUMMARY${NC}" | tee -a "$REPORT_FILE"
echo "========================================" | tee -a "$REPORT_FILE"
echo "" | tee -a "$REPORT_FILE"
echo "Certificates saved to: ${CERT_DIR}/" | tee -a "$REPORT_FILE"
echo "Full report: ${REPORT_FILE}" | tee -a "$REPORT_FILE"
echo "" | tee -a "$REPORT_FILE"

echo -e "${YELLOW}RECOMMENDATIONS:${NC}" | tee -a "$REPORT_FILE"
echo "1. Renew certificates expiring within 30 days" | tee -a "$REPORT_FILE"
echo "2. Ensure TLS 1.2 or higher is enforced" | tee -a "$REPORT_FILE"
echo "3. Keep certificates backed up securely" | tee -a "$REPORT_FILE"
echo "4. Set up automatic renewal for Let's Encrypt certificates" | tee -a "$REPORT_FILE"
echo "5. Monitor certificate expiry dates" | tee -a "$REPORT_FILE"
echo "" | tee -a "$REPORT_FILE"

echo "========================================" | tee -a "$REPORT_FILE"
echo "End of SSL Certificate Audit" | tee -a "$REPORT_FILE"
echo "========================================" | tee -a "$REPORT_FILE"

echo ""
echo -e "${GREEN}✓ SSL certificate audit complete!${NC}"
echo ""
echo -e "Certificates saved to: ${CYAN}${CERT_DIR}/${NC}"
echo -e "Full report: ${CYAN}${REPORT_FILE}${NC}"
echo ""
echo "To view certificates:"
echo "  ls -la ${CERT_DIR}/"
echo "  openssl x509 -in ${CERT_DIR}/[certificate].crt -text -noout"
echo ""

