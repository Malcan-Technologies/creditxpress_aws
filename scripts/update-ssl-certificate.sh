#!/bin/bash

# SSL Certificate Update Script for CreditXpress.com.my Domains
# Ensures all domains are included in the SSL certificate
# This script should be run on the Digital Ocean VPS

set -e

DOMAINS="creditxpress.com.my www.creditxpress.com.my admin.creditxpress.com.my api.creditxpress.com.my sign.creditxpress.com.my"
EMAIL="admin@creditxpress.com.my"
CERT_NAME="creditxpress.com.my"

echo "🔐 Updating SSL certificate for CreditXpress.com.my domains"
echo "============================================================"
echo "Domains: $DOMAINS"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "❌ This script must be run as root"
    echo "Please run: sudo $0"
    exit 1
fi

# Check if certbot is installed
if ! command -v certbot &> /dev/null; then
    echo "📦 Installing certbot..."
    apt update
    apt install -y certbot python3-certbot-nginx
else
    echo "✅ Certbot is already installed"
fi

# Check current certificate
echo "🔍 Checking current certificate..."
if [ -f "/etc/letsencrypt/live/${CERT_NAME}/fullchain.pem" ]; then
    echo "📋 Current certificate domains:"
    openssl x509 -in /etc/letsencrypt/live/${CERT_NAME}/fullchain.pem -text -noout | grep -A1 "Subject Alternative Name" | tail -1 | sed 's/DNS://g' | tr ',' '\n' | sed 's/^ */  - /'
    echo ""
    
    echo "📅 Current certificate expiry:"
    openssl x509 -in /etc/letsencrypt/live/${CERT_NAME}/fullchain.pem -noout -enddate
    echo ""
fi

# Stop nginx temporarily
echo "🛑 Stopping nginx temporarily..."
systemctl stop nginx

# Request/renew certificate with all domains
echo "🔑 Requesting SSL certificate for all domains..."
certbot certonly \
    --standalone \
    --email "$EMAIL" \
    --agree-tos \
    --no-eff-email \
    --expand \
    --cert-name "$CERT_NAME" \
    -d $(echo $DOMAINS | tr ' ' ',')

if [ $? -eq 0 ]; then
    echo "✅ SSL certificate updated successfully!"
    
    # Update renewal config to use nginx authenticator for future renewals
    echo ""
    echo "🔧 Updating renewal configuration for auto-renewal..."
    RENEWAL_CONF="/etc/letsencrypt/renewal/${CERT_NAME}.conf"
    if [ -f "$RENEWAL_CONF" ]; then
        sed -i 's/authenticator = standalone/authenticator = nginx/' "$RENEWAL_CONF"
        grep -q 'installer' "$RENEWAL_CONF" || sed -i '/authenticator = nginx/a installer = nginx' "$RENEWAL_CONF"
        echo "✅ Renewal config updated to use nginx authenticator"
    fi
    
    # Verify the new certificate includes all domains
    echo ""
    echo "📋 New certificate domains:"
    openssl x509 -in /etc/letsencrypt/live/${CERT_NAME}/fullchain.pem -text -noout | grep -A1 "Subject Alternative Name" | tail -1 | sed 's/DNS://g' | tr ',' '\n' | sed 's/^ */  - /'
    
    echo ""
    echo "📅 New certificate expiry:"
    openssl x509 -in /etc/letsencrypt/live/${CERT_NAME}/fullchain.pem -noout -enddate
    
    # Test nginx configuration
    echo ""
    echo "🧪 Testing nginx configuration..."
    nginx -t
    
    if [ $? -eq 0 ]; then
        echo "✅ Nginx configuration is valid"
        
        # Start nginx
        echo "🚀 Starting nginx..."
        systemctl start nginx
        systemctl status nginx --no-pager -l
        
        echo ""
        echo "🎉 SSL certificate update completed successfully!"
        echo ""
        echo "📋 Next steps:"
        echo "  1. Test HTTPS access: https://creditxpress.com.my"
        echo "  2. Test admin panel: https://admin.creditxpress.com.my"
        echo "  3. Test API: https://api.creditxpress.com.my/health"
        echo "  4. Test signing: https://sign.creditxpress.com.my"
        echo "  5. Verify certificate: https://www.ssllabs.com/ssltest/"
        echo "  6. Check auto-renewal: certbot renew --dry-run"
        
    else
        echo "❌ Nginx configuration test failed"
        echo "Please check the nginx configuration and try again"
        systemctl start nginx  # Start nginx anyway to prevent downtime
        exit 1
    fi
else
    echo "❌ Failed to obtain SSL certificate"
    echo "Starting nginx anyway..."
    systemctl start nginx
    exit 1
fi

# Ensure post-renewal hook exists
HOOK_DIR="/etc/letsencrypt/renewal-hooks/deploy"
HOOK_FILE="$HOOK_DIR/reload-nginx.sh"
if [ ! -f "$HOOK_FILE" ]; then
    echo ""
    echo "🔧 Setting up post-renewal hook..."
    mkdir -p "$HOOK_DIR"
    cat > "$HOOK_FILE" << 'EOF'
#!/bin/bash
# Reload nginx after certificate renewal
systemctl reload nginx
EOF
    chmod +x "$HOOK_FILE"
    echo "✅ Post-renewal hook created: $HOOK_FILE"
else
    echo "✅ Post-renewal hook already exists"
fi

# Verify certbot timer is active
echo ""
echo "⏰ Checking auto-renewal timer..."
if systemctl is-active --quiet certbot.timer; then
    echo "✅ Certbot timer is active"
    systemctl status certbot.timer --no-pager | head -5
else
    echo "⚠️ Certbot timer is not active, enabling..."
    systemctl enable certbot.timer
    systemctl start certbot.timer
    echo "✅ Certbot timer enabled and started"
fi

# Test renewal
echo ""
echo "🧪 Testing auto-renewal (dry-run)..."
certbot renew --dry-run

echo ""
echo "🔐 SSL Certificate Management Complete!"
echo "All CreditXpress.com.my domains are now secured with HTTPS"
echo ""
echo "Certificate will auto-renew before expiry via certbot timer."
