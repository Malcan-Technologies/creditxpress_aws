#!/bin/bash

echo "🔧 Production Deployment Fix Script"
echo "=================================="

# Function to check disk space
check_disk_space() {
    echo "📊 Checking disk space..."
    df -h
    echo ""
    
    # Check if any partition is over 90% full
    if df -h | awk 'NR>1 {gsub(/%/,"",$5); if($5 > 90) print $0}' | grep -q .; then
        echo "⚠️  WARNING: Some partitions are over 90% full!"
        return 1
    else
        echo "✅ Disk space looks good"
        return 0
    fi
}

# Function to clean up disk space
cleanup_disk_space() {
    echo "🧹 Cleaning up disk space..."
    
    # Clean Docker
    echo "Cleaning Docker..."
    docker system prune -f
    docker image prune -f
    docker volume prune -f
    
    # Clean npm cache
    echo "Cleaning npm cache..."
    npm cache clean --force
    
    # Clean pnpm cache if it exists
    if command -v pnpm &> /dev/null; then
        echo "Cleaning pnpm cache..."
        pnpm store prune
    fi
    
    # Clean system logs (keep last 7 days)
    echo "Cleaning system logs..."
    sudo journalctl --vacuum-time=7d
    
    # Clean apt cache
    echo "Cleaning apt cache..."
    sudo apt-get clean
    sudo apt-get autoremove -y
    
    # Clean temporary files
    echo "Cleaning temporary files..."
    sudo rm -rf /tmp/*
    sudo rm -rf /var/tmp/*
    
    # Clean old log files
    echo "Cleaning old log files..."
    sudo find /var/log -name "*.log" -type f -mtime +30 -delete
    sudo find /var/log -name "*.gz" -type f -mtime +30 -delete
    
    echo "✅ Cleanup completed"
}

# Function to fix file permissions
fix_file_permissions() {
    echo "🔐 Fixing file permissions..."
    
    # Get the current user
    CURRENT_USER=$(whoami)
    
    # Fix ownership of the entire growkapital directory
    sudo chown -R $CURRENT_USER:$CURRENT_USER /var/www/growkapital/
    
    # Fix permissions
    find /var/www/growkapital/ -type d -exec chmod 755 {} \;
    find /var/www/growkapital/ -type f -exec chmod 644 {} \;
    
    # Make scripts executable
    find /var/www/growkapital/ -name "*.sh" -exec chmod +x {} \;
    
    echo "✅ File permissions fixed"
}

# Function to force clean problematic directories
force_clean_directories() {
    echo "🗑️  Force cleaning problematic directories..."
    
    # Stop PM2 processes
    pm2 stop all || true
    
    # Force remove .next directories
    sudo rm -rf /var/www/growkapital/frontend/.next
    sudo rm -rf /var/www/growkapital/admin/.next
    
    # Force remove node_modules if they exist
    sudo rm -rf /var/www/growkapital/frontend/node_modules
    sudo rm -rf /var/www/growkapital/admin/node_modules
    
    # Remove any lock files
    rm -f /var/www/growkapital/frontend/package-lock.json
    rm -f /var/www/growkapital/frontend/pnpm-lock.yaml
    rm -f /var/www/growkapital/admin/package-lock.json
    rm -f /var/www/growkapital/admin/pnpm-lock.yaml
    
    echo "✅ Directories cleaned"
}

# Function to restart services
restart_services() {
    echo "🔄 Restarting services..."
    
    # Restart Docker
    sudo systemctl restart docker
    
    # Start PM2 processes
    pm2 start all || true
    
    echo "✅ Services restarted"
}

# Main execution
main() {
    echo "Starting production deployment fix..."
    echo ""
    
    # Check current disk space
    if ! check_disk_space; then
        echo "💾 Disk space issue detected. Cleaning up..."
        cleanup_disk_space
        echo ""
        echo "📊 Disk space after cleanup:"
        df -h
        echo ""
    fi
    
    # Fix file permissions
    fix_file_permissions
    echo ""
    
    # Force clean problematic directories
    force_clean_directories
    echo ""
    
    # Restart services
    restart_services
    echo ""
    
    echo "🎉 Production deployment fix completed!"
    echo ""
    echo "📋 Next steps:"
    echo "1. Try running the deployment again"
    echo "2. If issues persist, check the logs with:"
    echo "   - pm2 logs"
    echo "   - docker logs <container_name>"
    echo "   - sudo journalctl -u nginx"
}

# Run the main function
main 