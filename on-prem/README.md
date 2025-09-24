# On-Premises Deployment Files

This directory contains all files and scripts related to on-premises deployments, keeping them separate from cloud deployments.

## Directory Structure

```
on-prem/
├── docuseal/                    # DocuSeal on-prem deployment
│   ├── docker-compose.yml       # Docker compose configuration
│   ├── env.production           # Production environment variables
│   ├── env.development          # Development environment variables
│   ├── nginx/                   # Nginx configuration and SSL certificates
│   ├── logs/                    # Application logs
│   └── *.md, *.env, *.tar.gz   # Deployment guides and packages
│
├── signing-orchestrator/        # Signing Orchestrator service
│   ├── src/                     # Source code
│   ├── docker-compose.yml       # Docker compose configuration
│   ├── Dockerfile               # Docker build configuration
│   ├── package.json             # Node.js dependencies
│   └── *.md                     # Documentation
│
├── scripts/                     # Deployment and management scripts
│   ├── deploy-all.sh            # Main deployment script
│   ├── create-safety-backup.sh  # Safety backup utility
│   ├── configure-firewall.sh    # Firewall configuration
│   └── *.md                     # Deployment guides
│
└── ssl-setup/                   # SSL certificate management
    ├── copy-ssl-certificates.sh # Certificate copy utility
    ├── setup-ssl-*.sh           # Various SSL setup scripts
    └── fix-ssl-connectivity.sh  # SSL troubleshooting
```

## Quick Start

### Deploy Everything
```bash
cd on-prem/scripts
./deploy-all.sh
```

### Create Safety Backup
```bash
cd on-prem/scripts
./create-safety-backup.sh "Before major changes"
```

### SSL Certificate Setup
```bash
cd on-prem/ssl-setup
sudo ./copy-ssl-certificates.sh
```

## Key Features

- **Clean Separation**: On-prem files are isolated from cloud deployments
- **Comprehensive Backups**: Automatic data protection before deployments
- **Organized Structure**: Logical grouping of related files
- **Easy Deployment**: Single command deploys both DocuSeal and Orchestrator
- **SSL Management**: Dedicated tools for certificate handling

## Important Notes

- All scripts maintain the existing functionality
- Paths have been updated to work with the new structure
- SSH key authentication is configured for passwordless deployment
- Backup system prevents data loss during deployments
- **Tailscale Connection**: On-prem server connects to Digital Ocean VPS via Tailscale VPN (IP: 100.76.8.62)
- VPS nginx reverse proxy routes sign.kredit.my requests to on-prem DocuSeal through Tailscale network
- No external port forwarding required - secure access via Tailscale tunnel

## Troubleshooting

If you encounter issues:

1. Check the deployment logs in the respective service directories
2. Verify SSH key authentication is working: `ssh opg-srv`
3. Ensure port forwarding is configured correctly on your router
4. Use the safety backup system before making changes
