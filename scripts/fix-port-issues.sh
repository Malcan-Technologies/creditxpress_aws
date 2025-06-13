#!/bin/bash

echo "🔧 Fixing Port Configuration Issues"
echo "==================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Step 1: Fix backend port configuration
print_status "Step 1: Fixing backend port configuration..."

cd /var/www/growkapital/backend

# Check current backend environment
print_status "Current backend environment:"
docker compose -f docker-compose.prod.yml exec backend printenv | grep PORT || true

# Stop backend
print_status "Stopping backend..."
docker compose -f docker-compose.prod.yml down

# Update the environment to use port 4001 consistently
print_status "Updating backend environment..."

# Create or update .env file to ensure PORT=4001
if [ -f .env ]; then
    # Remove any existing PORT line and add the correct one
    sed -i '/^PORT=/d' .env
    echo "PORT=4001" >> .env
else
    echo "PORT=4001" > .env
fi

print_success "Backend environment updated to use port 4001"

# Rebuild and start backend
print_status "Rebuilding and starting backend..."
docker compose -f docker-compose.prod.yml up -d --build

# Wait for backend to be ready
print_status "Waiting for backend to be ready..."
sleep 30

# Check backend health
backend_healthy=false
for i in {1..10}; do
    if curl -s -f http://localhost:4001/api/health > /dev/null; then
        print_success "✅ Backend is healthy on port 4001"
        backend_healthy=true
        break
    else
        print_status "Attempt $i/10 - waiting for backend..."
        sleep 10
    fi
done

if [ "$backend_healthy" = false ]; then
    print_error "❌ Backend failed to become healthy"
    print_status "Backend logs:"
    docker compose -f docker-compose.prod.yml logs backend --tail 20
    exit 1
fi

# Step 2: Fix frontend port configuration
print_status "Step 2: Fixing frontend port configuration..."

cd /var/www/growkapital/frontend

# Stop existing PM2 process
pm2 stop growkapital-frontend 2>/dev/null || true
pm2 delete growkapital-frontend 2>/dev/null || true

# Check if package.json has the right start script
print_status "Checking frontend package.json..."
if ! grep -q '"start".*"next start -p 3002"' package.json; then
    print_status "Updating frontend start script to use port 3002..."
    # Update package.json to use port 3002
    sed -i 's/"start": "next start"/"start": "next start -p 3002"/' package.json
    print_success "Frontend start script updated"
fi

# Start frontend on correct port
print_status "Starting frontend on port 3002..."
PORT=3002 pm2 start npm --name "growkapital-frontend" -- start

# Step 3: Fix admin port configuration  
print_status "Step 3: Fixing admin port configuration..."

cd /var/www/growkapital/admin

# Stop existing PM2 process
pm2 stop growkapital-admin 2>/dev/null || true
pm2 delete growkapital-admin 2>/dev/null || true

# Check if package.json has the right start script
print_status "Checking admin package.json..."
if ! grep -q '"start".*"next start -p 3003"' package.json; then
    print_status "Updating admin start script to use port 3003..."
    # Update package.json to use port 3003
    sed -i 's/"start": "next start"/"start": "next start -p 3003"/' package.json
    print_success "Admin start script updated"
fi

# Start admin on correct port
print_status "Starting admin on port 3003..."
PORT=3003 pm2 start npm --name "growkapital-admin" -- start

# Save PM2 configuration
pm2 save

# Step 4: Run database migrations
print_status "Step 4: Running database migrations..."
cd /var/www/growkapital/backend
docker compose -f docker-compose.prod.yml exec -T backend npx prisma migrate deploy

if [ $? -eq 0 ]; then
    print_success "Database migrations completed"
else
    print_warning "Database migrations may have failed, but continuing..."
fi

# Step 5: Wait and verify all services
print_status "Step 5: Verifying all services..."
sleep 15

# Check all services
frontend_ok=false
admin_ok=false
backend_ok=false

print_status "Checking frontend on port 3002..."
if curl -s -f http://localhost:3002 > /dev/null; then
    print_success "✅ Frontend is accessible on port 3002"
    frontend_ok=true
else
    print_error "❌ Frontend is not accessible on port 3002"
    print_status "Frontend PM2 status:"
    pm2 show growkapital-frontend
fi

print_status "Checking admin on port 3003..."
if curl -s -f http://localhost:3003 > /dev/null; then
    print_success "✅ Admin is accessible on port 3003"
    admin_ok=true
else
    print_error "❌ Admin is not accessible on port 3003"
    print_status "Admin PM2 status:"
    pm2 show growkapital-admin
fi

print_status "Checking backend on port 4001..."
if curl -s -f http://localhost:4001/api/health > /dev/null; then
    print_success "✅ Backend is accessible on port 4001"
    backend_ok=true
else
    print_error "❌ Backend is not accessible on port 4001"
    print_status "Backend container status:"
    docker compose -f docker-compose.prod.yml ps
fi

# Step 6: Test Nginx proxy
print_status "Step 6: Testing Nginx proxy..."

# Test main site API
if curl -s -f http://localhost/api/health > /dev/null; then
    print_success "✅ Main site API proxy is working"
else
    print_error "❌ Main site API proxy is not working"
fi

# Test admin site API
if curl -s -f -H "Host: admin.growkapital.com" http://localhost/api/health > /dev/null; then
    print_success "✅ Admin site API proxy is working"
else
    print_error "❌ Admin site API proxy is not working"
fi

# Final status report
echo ""
echo "=== FINAL STATUS REPORT ==="
echo ""

if [ "$backend_ok" = true ] && [ "$frontend_ok" = true ] && [ "$admin_ok" = true ]; then
    print_success "🎉 All services are now running on correct ports!"
    echo ""
    echo "Service Status:"
    echo "  ✅ Backend: http://localhost:4001 (Docker)"
    echo "  ✅ Frontend: http://localhost:3002 (PM2)"
    echo "  ✅ Admin: http://localhost:3003 (PM2)"
    echo ""
    echo "External Access:"
    echo "  🌐 Main Site: https://growkapital.com"
    echo "  🌐 Admin Site: https://admin.growkapital.com"
    echo ""
    print_success "The 502 gateway errors should now be resolved!"
else
    print_error "❌ Some services are still not working properly"
    echo ""
    echo "Service Status:"
    echo "  Backend (port 4001): $([ "$backend_ok" = true ] && echo "✅ OK" || echo "❌ FAILED")"
    echo "  Frontend (port 3002): $([ "$frontend_ok" = true ] && echo "✅ OK" || echo "❌ FAILED")"
    echo "  Admin (port 3003): $([ "$admin_ok" = true ] && echo "✅ OK" || echo "❌ FAILED")"
    echo ""
    echo "Troubleshooting commands:"
    echo "  - Check PM2 processes: pm2 list"
    echo "  - Check PM2 logs: pm2 logs"
    echo "  - Check backend logs: cd /var/www/growkapital/backend && docker compose -f docker-compose.prod.yml logs"
    echo "  - Check container status: docker ps"
    echo "  - Test Nginx: nginx -t"
    echo "  - Reload Nginx: systemctl reload nginx"
fi

echo ""
print_status "Port fix script completed!" 