#!/bin/bash

echo "🔧 Fixing Admin Panel Deployment Issue..."
echo "========================================"

# Function to print colored output
print_status() {
    echo -e "\033[0;34m[INFO]\033[0m $1"
}

print_success() {
    echo -e "\033[0;32m[SUCCESS]\033[0m $1"
}

print_error() {
    echo -e "\033[0;31m[ERROR]\033[0m $1"
}

print_warning() {
    echo -e "\033[0;33m[WARNING]\033[0m $1"
}

# Check if we're in the right directory
if [ ! -d "/var/www/growkapital" ]; then
    print_error "This script must be run on the production server"
    print_error "Expected directory /var/www/growkapital not found"
    exit 1
fi

# Navigate to admin directory
cd /var/www/growkapital/admin || {
    print_error "Admin directory not found at /var/www/growkapital/admin"
    exit 1
}

print_status "Current directory: $(pwd)"

# Stop existing admin process if running
print_status "Stopping existing admin process..."
pm2 stop growkapital-admin 2>/dev/null || true
pm2 delete growkapital-admin 2>/dev/null || true

# Check if admin files exist
if [ ! -f "package.json" ]; then
    print_error "package.json not found in admin directory"
    print_error "Admin files may not be properly deployed"
    exit 1
fi

print_success "Admin files found"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    print_status "Installing dependencies..."
    npm install
fi

# Build the application
print_status "Building admin application..."
if ! npm run build:prod; then
    print_error "Admin build failed"
    exit 1
fi

print_success "Admin build completed"

# Determine the best startup method
print_status "Determining startup method..."

if [ -f "ecosystem.config.js" ]; then
    print_status "Using ecosystem config (recommended)..."
    pm2 start ecosystem.config.js
    START_METHOD="ecosystem"
elif [ -f ".next/standalone/server.js" ]; then
    print_status "Using standalone server..."
    PORT=3003 pm2 start .next/standalone/server.js --name "growkapital-admin"
    START_METHOD="standalone"
else
    print_status "Using npm start..."
    pm2 start npm --name "growkapital-admin" -- start
    START_METHOD="npm"
fi

# Save PM2 configuration
pm2 save

print_success "Admin started using $START_METHOD method"

# Wait for the service to start
print_status "Waiting for admin service to start..."
sleep 10

# Verify the service is running
print_status "Verifying admin service..."

# Check PM2 status
if pm2 list | grep -q "growkapital-admin.*online"; then
    print_success "✅ Admin process is running in PM2"
else
    print_error "❌ Admin process is not running in PM2"
    pm2 show growkapital-admin
    exit 1
fi

# Check HTTP response
if curl -s -o /dev/null -w "%{http_code}" http://localhost:3003/login | grep -q "200"; then
    print_success "✅ Admin is accessible at http://localhost:3003"
else
    print_warning "⚠️ Admin HTTP check failed, but process is running"
    print_status "Checking logs..."
    pm2 logs growkapital-admin --lines 10 --nostream
fi

# Final status
echo ""
echo "=== FINAL STATUS ==="
pm2 status
echo ""
echo "🎉 Admin panel fix completed!"
echo ""
echo "Next steps:"
echo "1. Test admin access: https://admin.kredit.my"
echo "2. Check logs if needed: pm2 logs growkapital-admin"
echo "3. Monitor with: pm2 monit" 