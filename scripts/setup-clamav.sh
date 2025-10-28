#!/bin/bash

# ClamAV Setup Script for CreditXpress Platform
# This script installs and configures ClamAV antivirus with daily scanning
# Safe deployment with minimal risk of breaking existing functionality

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Log function
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING:${NC} $1"
}

# Detect OS
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$ID
else
    error "Cannot detect OS"
    exit 1
fi

log "Detected OS: $OS"

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    error "Please run as root (use sudo)"
    exit 1
fi

# Function to check if ClamAV is already installed
check_existing_installation() {
    if command -v clamscan &> /dev/null; then
        warn "ClamAV is already installed"
        clamscan --version
        read -p "Do you want to continue with reconfiguration? (y/n) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log "Installation cancelled"
            exit 0
        fi
    fi
}

# Install ClamAV based on OS
install_clamav() {
    log "Installing ClamAV..."
    
    case $OS in
        ubuntu|debian)
            apt-get update
            apt-get install -y clamav clamav-daemon clamav-freshclam
            ;;
        centos|rhel|rocky|almalinux)
            yum install -y epel-release
            yum install -y clamav clamav-update clamd
            ;;
        *)
            error "Unsupported OS: $OS"
            exit 1
            ;;
    esac
    
    log "ClamAV installed successfully"
}

# Configure ClamAV
configure_clamav() {
    log "Configuring ClamAV..."
    
    # Create directories for ClamAV
    mkdir -p /var/log/clamav
    mkdir -p /var/lib/clamav
    mkdir -p /var/run/clamav
    
    # Set permissions
    chown -R clamav:clamav /var/log/clamav
    chown -R clamav:clamav /var/lib/clamav
    chown -R clamav:clamav /var/run/clamav
    
    # Update virus definitions
    log "Updating virus definitions (this may take a few minutes)..."
    
    # Stop freshclam if running
    systemctl stop clamav-freshclam 2>/dev/null || true
    
    # Update database
    freshclam
    
    log "Virus definitions updated successfully"
}

# Create scan script
create_scan_script() {
    log "Creating daily scan script..."
    
    cat > /usr/local/bin/clamav-daily-scan.sh << 'SCANSCRIPT'
#!/bin/bash

# ClamAV Daily Scan Script
# Scans critical directories and logs results

LOGFILE="/var/log/clamav/daily-scan-$(date +%Y%m%d).log"
SCAN_DIRS="/home /root /opt /var/www"
EXCLUDE_DIRS="--exclude-dir=/home/*/node_modules --exclude-dir=/opt/*/node_modules"

# Start scan
echo "========================================" >> "$LOGFILE"
echo "ClamAV Daily Scan - $(date)" >> "$LOGFILE"
echo "========================================" >> "$LOGFILE"

# Scan with options:
# -r: recursive
# -i: only print infected files
# --remove=no: don't remove infected files (log only for safety)
# --bell: sound system bell on detection
clamscan -r -i --remove=no --bell $EXCLUDE_DIRS $SCAN_DIRS >> "$LOGFILE" 2>&1

# Check exit code
SCAN_STATUS=$?

echo "" >> "$LOGFILE"
echo "Scan completed at $(date)" >> "$LOGFILE"
echo "Exit status: $SCAN_STATUS" >> "$LOGFILE"

# Exit codes:
# 0: No virus found
# 1: Virus found
# 2: Error during scan

if [ $SCAN_STATUS -eq 1 ]; then
    echo "WARNING: Infected files detected!" >> "$LOGFILE"
    # Send alert (you can add email notification here if needed)
    logger -t clamav "WARNING: ClamAV detected infected files. Check $LOGFILE"
elif [ $SCAN_STATUS -eq 0 ]; then
    echo "No threats detected" >> "$LOGFILE"
else
    echo "Error during scan" >> "$LOGFILE"
    logger -t clamav "ERROR: ClamAV scan encountered errors. Check $LOGFILE"
fi

# Rotate logs older than 30 days
find /var/log/clamav/daily-scan-*.log -mtime +30 -delete 2>/dev/null || true

exit $SCAN_STATUS
SCANSCRIPT

    chmod +x /usr/local/bin/clamav-daily-scan.sh
    log "Scan script created at /usr/local/bin/clamav-daily-scan.sh"
}

# Setup systemd service for freshclam (auto-update)
setup_freshclam_service() {
    log "Configuring freshclam service for automatic updates..."
    
    # Enable and start freshclam service
    systemctl enable clamav-freshclam 2>/dev/null || systemctl enable freshclam 2>/dev/null || true
    systemctl start clamav-freshclam 2>/dev/null || systemctl start freshclam 2>/dev/null || true
    
    log "Freshclam service configured for automatic virus definition updates"
}

# Setup cron job for daily scanning
setup_cron() {
    log "Setting up cron job for daily scans at 3:00 AM MYT (GMT+8)..."
    
    # Calculate UTC time for 3 AM MYT (3 AM GMT+8 = 7 PM previous day UTC)
    # MYT is UTC+8, so 3:00 AM MYT = 19:00 (7 PM) UTC previous day
    
    CRON_ENTRY="0 19 * * * /usr/local/bin/clamav-daily-scan.sh"
    
    # Check if cron entry already exists
    if crontab -l 2>/dev/null | grep -q "clamav-daily-scan.sh"; then
        warn "ClamAV cron job already exists, updating..."
        crontab -l 2>/dev/null | grep -v "clamav-daily-scan.sh" | crontab -
    fi
    
    # Add new cron entry
    (crontab -l 2>/dev/null; echo "# ClamAV daily scan at 3:00 AM MYT (19:00 UTC)") | crontab -
    (crontab -l 2>/dev/null; echo "$CRON_ENTRY") | crontab -
    
    log "Cron job configured: Daily scan at 3:00 AM MYT (19:00 UTC)"
    
    # Display existing cron jobs
    log "Current crontab:"
    crontab -l
}

# Verify installation
verify_installation() {
    log "Verifying installation..."
    
    # Check ClamAV version
    log "ClamAV version:"
    clamscan --version
    
    # Check freshclam status
    log "Freshclam service status:"
    systemctl status clamav-freshclam 2>/dev/null || systemctl status freshclam 2>/dev/null || log "Freshclam service not using systemd"
    
    # Check virus database
    log "Virus database info:"
    ls -lh /var/lib/clamav/
    
    # Run a quick test scan
    log "Running quick test scan on /tmp..."
    clamscan -r -i /tmp || true
    
    log "Installation verification complete"
}

# Create uninstall script
create_uninstall_script() {
    log "Creating uninstall script..."
    
    cat > /usr/local/bin/uninstall-clamav.sh << 'UNINSTALL'
#!/bin/bash

# ClamAV Uninstall Script

echo "Stopping ClamAV services..."
systemctl stop clamav-freshclam 2>/dev/null || systemctl stop freshclam 2>/dev/null || true

echo "Removing cron job..."
crontab -l 2>/dev/null | grep -v "clamav-daily-scan.sh" | crontab -

echo "Removing scripts..."
rm -f /usr/local/bin/clamav-daily-scan.sh
rm -f /usr/local/bin/uninstall-clamav.sh

echo "Removing ClamAV packages..."
if command -v apt-get &> /dev/null; then
    apt-get remove -y clamav clamav-daemon clamav-freshclam
    apt-get autoremove -y
elif command -v yum &> /dev/null; then
    yum remove -y clamav clamav-update clamd
fi

echo "Removing logs and data..."
rm -rf /var/log/clamav
rm -rf /var/lib/clamav

echo "ClamAV uninstalled successfully"
UNINSTALL

    chmod +x /usr/local/bin/uninstall-clamav.sh
    log "Uninstall script created at /usr/local/bin/uninstall-clamav.sh"
}

# Main execution
main() {
    log "Starting ClamAV installation and configuration..."
    log "=========================================="
    
    check_existing_installation
    install_clamav
    configure_clamav
    create_scan_script
    setup_freshclam_service
    setup_cron
    create_uninstall_script
    verify_installation
    
    log "=========================================="
    log "ClamAV installation and configuration complete!"
    log ""
    log "Summary:"
    log "- ClamAV antivirus installed and configured"
    log "- Virus definitions will auto-update via freshclam service"
    log "- Daily scans scheduled at 3:00 AM MYT (19:00 UTC)"
    log "- Scan logs available at: /var/log/clamav/"
    log "- Manual scan script: /usr/local/bin/clamav-daily-scan.sh"
    log "- Uninstall script: /usr/local/bin/uninstall-clamav.sh"
    log ""
    log "To manually run a scan: /usr/local/bin/clamav-daily-scan.sh"
    log "To check scan logs: ls -lh /var/log/clamav/"
    log ""
    warn "Note: The first scan may take longer as it builds the file database"
    warn "Existing cron jobs remain unaffected"
}

# Run main function
main

