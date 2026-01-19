# MTSA Container Integration Guide

This guide explains how to integrate the MyTrustSigner Agent (MTSA) container provided by Trustgate for digital signature capabilities.

## Overview

MTSA (MyTrustSigner Agent) is a Java-based SOAP service that interfaces with Malaysia's PKI (Public Key Infrastructure) for digital signatures. The service is provided by Trustgate as a pre-built Docker container.

## Architecture

```
┌─────────────────┐      ┌──────────────────┐      ┌─────────────┐
│  Backend API    │─────▶│ Signing          │─────▶│   MTSA      │
│  (Express)      │      │ Orchestrator     │      │  (Tomcat)   │
└─────────────────┘      └──────────────────┘      └─────────────┘
                                │                        │
                                │                        │
                                ▼                        ▼
                         ┌──────────────┐         ┌─────────────┐
                         │  DocuSeal    │         │  Trustgate  │
                         │  (Ruby)      │         │  PKI Server │
                         └──────────────┘         └─────────────┘
```

## MTSA Container Variants

Trustgate provides two container variants:

| Variant | Container Image | WSDL Endpoint | Purpose |
|---------|-----------------|---------------|---------|
| Pilot | `mtsa-pilot:X.XX` | `/MTSAPilot/MyTrustSignerAgentWSAPv2?wsdl` | Testing and development |
| Production | `mtsa:X.XX` | `/MTSA/MyTrustSignerAgentWSAPv2?wsdl` | Live environment |

## Prerequisites

1. **Docker installed** on the on-prem server
2. **MTSA container tarball** from Trustgate (e.g., `mtsa-pilot-container.tar`)
3. **SOAP credentials** from Trustgate:
   - Username
   - Password
4. **Network access** to Trustgate PKI servers

## Importing the Container

### Using the Import Script

```bash
cd on-prem/scripts

# Basic import
./import-mtsa-container.sh /path/to/mtsa-pilot-container.tar

# With custom tag
./import-mtsa-container.sh /path/to/mtsa-container.tar --tag mtsa-prod:1.0

# With verification (starts container temporarily to test)
./import-mtsa-container.sh /path/to/mtsa-container.tar --verify
```

### Manual Import

```bash
# Load the Docker image
docker load -i /path/to/mtsa-pilot-container.tar

# Check loaded image
docker images | grep mtsa

# Tag for consistency (optional)
docker tag <loaded-image-name> mtsa-pilot:latest
```

## Configuration

### 1. Update client.json

```json
{
  "onprem": {
    "enabled": true,
    "mtsa": {
      "env": "pilot",
      "container_image": "mtsa-pilot:1.01"
    }
  }
}
```

### 2. Environment Variables

The following environment variables are required:

| Variable | Description | Example |
|----------|-------------|---------|
| `MTSA_ENV` | Environment: `pilot` or `prod` | `pilot` |
| `MTSA_CONTAINER_IMAGE` | Docker image tag | `mtsa-pilot:1.01` |
| `MTSA_SOAP_USERNAME` | SOAP authentication username | `client_username` |
| `MTSA_SOAP_PASSWORD` | SOAP authentication password | `secret_password` |

Set these in your `.env` file or as GitHub Secrets for CI/CD.

### 3. Generate Environment Files

```bash
# Set credentials
export MTSA_SOAP_USERNAME="your_username"
export MTSA_SOAP_PASSWORD="your_password"

# Generate .env files
./scripts/generate-env.sh
```

## Starting MTSA

### With Unified Docker Compose

```bash
cd on-prem
docker compose -f docker-compose.unified.yml up -d mtsa
```

### Standalone

```bash
docker run -d \
  --name mtsa \
  -p 8080:8080 \
  -e TZ=Asia/Kuala_Lumpur \
  mtsa-pilot:1.01
```

## Verifying the Installation

### Check Container Status

```bash
docker ps | grep mtsa
```

### Test WSDL Endpoint

```bash
# For Pilot
curl -f http://localhost:8080/MTSAPilot/MyTrustSignerAgentWSAPv2?wsdl

# For Production
curl -f http://localhost:8080/MTSA/MyTrustSignerAgentWSAPv2?wsdl
```

### Check Logs

```bash
docker logs mtsa --tail 100 -f
```

## Network Configuration

MTSA needs to communicate with:

1. **Signing Orchestrator** - Internal Docker network
2. **Trustgate PKI Servers** - External HTTPS

### Docker Network

The unified docker-compose creates a shared `signing-network`:

```yaml
networks:
  signing-network:
    driver: bridge
```

All services (DocuSeal, Signing Orchestrator, MTSA) connect to this network.

### Firewall Requirements

Outbound access required:

| Destination | Port | Protocol | Purpose |
|-------------|------|----------|---------|
| Trustgate PKI (pilot) | 443 | HTTPS | Certificate operations |
| Trustgate PKI (prod) | 443 | HTTPS | Production signing |

## SOAP Operations

MTSA provides these SOAP operations:

### 1. Certificate Enrollment

Enrolls a user for digital certificate.

```xml
<enrollCertificate>
  <userId>USER_IC_NUMBER</userId>
  <userName>USER_FULL_NAME</userName>
  <userEmail>user@email.com</userEmail>
  <userPhone>+60123456789</userPhone>
</enrollCertificate>
```

### 2. Request OTP

Sends OTP to user's registered phone.

```xml
<requestOTP>
  <userId>USER_IC_NUMBER</userId>
  <transactionId>TXN_ID</transactionId>
</requestOTP>
```

### 3. Verify OTP

Verifies user-entered OTP.

```xml
<verifyOTP>
  <userId>USER_IC_NUMBER</userId>
  <transactionId>TXN_ID</transactionId>
  <otp>123456</otp>
</verifyOTP>
```

### 4. Sign Document

Signs a PDF document with digital certificate.

```xml
<signDocument>
  <userId>USER_IC_NUMBER</userId>
  <documentHash>BASE64_PDF_HASH</documentHash>
  <transactionId>TXN_ID</transactionId>
</signDocument>
```

### 5. Get Certificate Info

Retrieves user's certificate details.

```xml
<getCertificateInfo>
  <userId>USER_IC_NUMBER</userId>
</getCertificateInfo>
```

### 6. Revoke Certificate

Revokes a user's certificate (admin operation).

```xml
<revokeCertificate>
  <userId>USER_IC_NUMBER</userId>
  <reason>REASON_CODE</reason>
</revokeCertificate>
```

## Signing Orchestrator Integration

The Signing Orchestrator (`on-prem/signing-orchestrator`) acts as a bridge between DocuSeal and MTSA.

### Configuration

In `signing-orchestrator/.env`:

```env
# MTSA Configuration
MTSA_ENV=pilot
MTSA_WSDL_PILOT=http://mtsa:8080/MTSAPilot/MyTrustSignerAgentWSAPv2?wsdl
MTSA_WSDL_PROD=http://mtsa:8080/MTSA/MyTrustSignerAgentWSAPv2?wsdl
MTSA_SOAP_USERNAME=your_username
MTSA_SOAP_PASSWORD=your_password
```

### Workflow

1. User completes DocuSeal form signing
2. DocuSeal webhook triggers Signing Orchestrator
3. Orchestrator downloads unsigned PDF
4. Orchestrator calls MTSA for digital signature
5. MTSA performs PKI operation with Trustgate
6. Signed PDF stored and returned

## Troubleshooting

### Container Won't Start

```bash
# Check for port conflicts
netstat -tulpn | grep 8080

# Check Docker logs
docker logs mtsa

# Check image exists
docker images | grep mtsa
```

### WSDL Not Accessible

```bash
# Check container is running
docker ps | grep mtsa

# Check container logs for startup errors
docker logs mtsa --tail 50

# Test from inside container
docker exec mtsa curl http://localhost:8080/MTSAPilot/MyTrustSignerAgentWSAPv2?wsdl
```

### SOAP Authentication Failures

1. Verify credentials with Trustgate
2. Check environment variables are set correctly
3. Test credentials in SOAP client tool (SoapUI)

### Network Connectivity Issues

```bash
# Test from signing-orchestrator to MTSA
docker exec signing-orchestrator ping mtsa

# Check network connections
docker network inspect signing-network
```

### Certificate Operations Fail

1. Check MTSA logs for specific error codes
2. Verify user data (IC number format, phone format)
3. Contact Trustgate support with transaction ID

## Maintenance

### Updating MTSA Container

When Trustgate provides a new version:

```bash
# Stop current container
docker compose -f docker-compose.unified.yml stop mtsa

# Import new image
./scripts/import-mtsa-container.sh /path/to/new-mtsa.tar --tag mtsa-pilot:1.02

# Update client.json
jq '.onprem.mtsa.container_image = "mtsa-pilot:1.02"' client.json > tmp.json && mv tmp.json client.json

# Regenerate env files
./scripts/generate-env.sh

# Start with new image
docker compose -f docker-compose.unified.yml up -d mtsa
```

### Backup Considerations

MTSA itself is stateless. Backup focus should be on:

- Signing Orchestrator database (agreements, audit logs)
- DocuSeal database (templates, submissions)
- Signed PDF files (mounted volumes)

### Monitoring

Check these metrics:

1. Container health: `docker ps`
2. WSDL availability: Periodic curl checks
3. SOAP response times: Orchestrator logs
4. Error rates: MTSA Tomcat logs

## Security Considerations

1. **Credentials Storage**: Use GitHub Secrets or HashiCorp Vault
2. **Network Isolation**: MTSA should only be accessible internally
3. **Log Management**: Rotate and secure MTSA logs (contain transaction data)
4. **Certificate Handling**: Never log or expose private keys

## Support

For MTSA-specific issues:

- Contact Trustgate technical support
- Provide transaction ID and error codes
- Include MTSA container version

For integration issues:

- Check Signing Orchestrator logs
- Review this documentation
- Open issue in platform repository
