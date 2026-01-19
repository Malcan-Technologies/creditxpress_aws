# GitHub Self-Hosted Runner Setup

This guide explains how to set up a GitHub Actions self-hosted runner on your on-premises server for automated deployments.

## Overview

A self-hosted runner allows GitHub Actions to execute directly on your on-prem server without requiring:
- Inbound ports (runner initiates outbound connection)
- VPN or Tailscale for CI/CD (only needed for initial setup)
- Exposed SSH ports

## Prerequisites

- Linux server (Ubuntu 20.04+ recommended)
- Docker and Docker Compose installed
- Outbound HTTPS access (port 443)
- GitHub repository access with admin permissions
- `jq` installed for JSON processing

## Installation Steps

### 1. Prepare the Server

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install required packages
sudo apt install -y curl jq git

# Install Docker (if not already installed)
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# Log out and back in for Docker group to take effect
```

### 2. Create Runner in GitHub

1. Go to your repository on GitHub
2. Navigate to **Settings** → **Actions** → **Runners**
3. Click **New self-hosted runner**
4. Select **Linux** and **x64**
5. Copy the configuration commands shown

### 3. Install the Runner on Server

```bash
# Create runner directory
mkdir -p ~/actions-runner && cd ~/actions-runner

# Download the latest runner package (check GitHub for current version)
RUNNER_VERSION="2.311.0"  # Update to latest version from GitHub
curl -o actions-runner-linux-x64-${RUNNER_VERSION}.tar.gz -L \
  https://github.com/actions/runner/releases/download/v${RUNNER_VERSION}/actions-runner-linux-x64-${RUNNER_VERSION}.tar.gz

# Extract the package
tar xzf actions-runner-linux-x64-${RUNNER_VERSION}.tar.gz

# Configure the runner (use token from GitHub)
./config.sh --url https://github.com/YOUR_ORG/YOUR_REPO --token YOUR_TOKEN

# During configuration, you'll be asked:
# - Runner name: Use descriptive name like "onprem-signing-server"
# - Runner group: Press Enter for default
# - Labels: Add "self-hosted,linux,x64,onprem"
# - Work folder: Press Enter for default (_work)
```

### 4. Install as System Service

```bash
# Install the runner as a service
sudo ./svc.sh install

# Start the service
sudo ./svc.sh start

# Check status
sudo ./svc.sh status
```

### 5. Verify Runner is Online

1. Go back to **Settings** → **Actions** → **Runners** in GitHub
2. Your runner should show as **Idle** with a green dot
3. The labels should match what you configured

## Runner Labels

Configure these labels for proper workflow targeting:

| Label | Purpose |
|-------|---------|
| `self-hosted` | Required - identifies as self-hosted runner |
| `linux` | Operating system |
| `x64` | Architecture |
| `onprem` | Custom label for on-prem workflows |

## Service Management

```bash
# Check runner status
sudo ./svc.sh status

# Stop the runner
sudo ./svc.sh stop

# Start the runner
sudo ./svc.sh start

# Restart the runner
sudo ./svc.sh stop && sudo ./svc.sh start

# Uninstall the service
sudo ./svc.sh uninstall

# View runner logs
journalctl -u actions.runner.YOUR_ORG-YOUR_REPO.YOUR_RUNNER_NAME.service -f
```

## Environment Variables

The runner needs access to certain environment variables for deployments. These are passed via GitHub Secrets:

| Secret | Description |
|--------|-------------|
| `DOCUSEAL_API_TOKEN` | DocuSeal API authentication token |
| `SIGNING_ORCHESTRATOR_API_KEY` | API key for signing orchestrator |
| `MTSA_SOAP_USERNAME` | MTSA/Trustgate SOAP username |
| `MTSA_SOAP_PASSWORD` | MTSA/Trustgate SOAP password |
| `DOCUSEAL_POSTGRES_PASSWORD` | DocuSeal database password |
| `AGREEMENTS_DB_PASSWORD` | Signing orchestrator DB password |

### Setting Secrets in GitHub

1. Go to **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret** for each secret above
3. The workflow will automatically pass these to the runner

## Triggering Deployments

### Via GitHub UI

1. Go to **Actions** tab in GitHub
2. Select **Deploy On-Prem Services** workflow
3. Click **Run workflow**
4. Select options:
   - Deploy DocuSeal: true/false
   - Deploy Signing Orchestrator: true/false
   - Deploy MTSA: true/false
   - Setup DocuSeal template: true/false (first-time only)
   - Regenerate environment files: true/false
5. Click **Run workflow**

### Via GitHub CLI

```bash
# Install GitHub CLI if needed
# https://cli.github.com/

# Trigger workflow
gh workflow run deploy-onprem.yml \
  -f deploy_docuseal=true \
  -f deploy_orchestrator=true \
  -f deploy_mtsa=true

# Check workflow status
gh run list --workflow=deploy-onprem.yml
```

## Troubleshooting

### Runner Not Connecting

```bash
# Check network connectivity
curl -I https://github.com

# Check runner logs
journalctl -u actions.runner.* -f

# Verify runner configuration
cat ~/actions-runner/.runner
```

### Runner Shows Offline

1. Check if service is running: `sudo ./svc.sh status`
2. Check system logs: `journalctl -u actions.runner.* --since "1 hour ago"`
3. Verify outbound HTTPS is not blocked
4. Try restarting: `sudo ./svc.sh stop && sudo ./svc.sh start`

### Workflow Fails to Start

1. Verify runner labels match workflow `runs-on` directive
2. Check if runner is busy with another job
3. Ensure `onprem.enabled: true` in `client.json`

### Docker Permission Issues

```bash
# Ensure runner user is in docker group
sudo usermod -aG docker $USER

# Restart runner after group change
sudo ./svc.sh stop
sudo ./svc.sh start
```

## Security Considerations

1. **Network Security**
   - Runner only makes outbound connections
   - No inbound ports required
   - Uses HTTPS for all communication

2. **Access Control**
   - Only repository admins can add/remove runners
   - Secrets are encrypted at rest and in transit
   - Workflow files require review for external contributors

3. **Best Practices**
   - Use dedicated user account for runner
   - Keep runner software updated
   - Monitor runner logs for anomalies
   - Use minimal required permissions

## Updating the Runner

GitHub will notify when updates are available. To update:

```bash
cd ~/actions-runner

# Stop the service
sudo ./svc.sh stop

# Download new version
RUNNER_VERSION="X.XXX.X"  # New version
curl -o actions-runner-linux-x64-${RUNNER_VERSION}.tar.gz -L \
  https://github.com/actions/runner/releases/download/v${RUNNER_VERSION}/actions-runner-linux-x64-${RUNNER_VERSION}.tar.gz

# Extract (overwrites existing)
tar xzf actions-runner-linux-x64-${RUNNER_VERSION}.tar.gz

# Start the service
sudo ./svc.sh start
```

## Multiple Runners

For high availability or parallel jobs, you can install multiple runners:

```bash
# Create additional runner directory
mkdir -p ~/actions-runner-2 && cd ~/actions-runner-2

# Follow same installation steps with unique name
./config.sh --url https://github.com/YOUR_ORG/YOUR_REPO \
  --token YOUR_TOKEN \
  --name "onprem-signing-server-2" \
  --labels "self-hosted,linux,x64,onprem"
```

## Integration with On-Prem Setup

Once the runner is configured, deployments work as follows:

1. Developer pushes code or triggers workflow manually
2. GitHub Actions detects `runs-on: self-hosted` directive
3. Job is queued for your on-prem runner
4. Runner pulls latest code from repository
5. Deployment scripts execute on-prem server directly
6. Results are reported back to GitHub

This eliminates the need for SSH access or VPN during normal deployments.

## Related Documentation

- [On-Prem Deployment Guide](./STEP_BY_STEP_DEPLOYMENT_GUIDE.md)
- [MTSA Container Integration](./MTSA_CONTAINER_INTEGRATION.md)
- [Cloudflare Tunnel Setup](./CLOUDFLARE_TUNNEL_SETUP.md)
