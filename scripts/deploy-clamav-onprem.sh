#!/bin/bash

# Deploy ClamAV to On-Prem Server
# This script handles the interactive deployment to the on-prem server

echo "=========================================="
echo "ClamAV Deployment to On-Prem Server"
echo "=========================================="
echo ""
echo "Server: 100.76.8.62 (admin-kapital@on-prem)"
echo ""
echo "This will:"
echo "1. Copy the setup script to the on-prem server"
echo "2. Run the installation (will require sudo password)"
echo ""

# Copy the script
echo "Copying setup script..."
scp /Users/ivan/Documents/creditxpress/scripts/setup-clamav.sh admin-kapital@100.76.8.62:/tmp/

echo ""
echo "Now connecting to server to run installation..."
echo "You will be prompted for the sudo password."
echo ""

# SSH and run the script (interactive)
ssh -t admin-kapital@100.76.8.62 "chmod +x /tmp/setup-clamav.sh && sudo /tmp/setup-clamav.sh"

echo ""
echo "=========================================="
echo "Deployment complete!"
echo "=========================================="

