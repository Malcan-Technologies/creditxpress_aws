# Secrets Module - AWS Secrets Manager

variable "secrets_prefix" {
  description = "Prefix for secrets (e.g., client_slug/env)"
  type        = string
}

variable "client_slug" {
  description = "Client identifier"
  type        = string
}

# Placeholder secrets - these will be manually populated
# The actual secret values should NEVER be in Terraform state

# JWT Secret
resource "aws_secretsmanager_secret" "jwt_secret" {
  name = "${var.secrets_prefix}/jwt-secret"

  tags = {
    Client = var.client_slug
  }
}

# JWT Refresh Secret (for refresh tokens)
resource "aws_secretsmanager_secret" "jwt_refresh_secret" {
  name = "${var.secrets_prefix}/jwt-refresh-secret"

  tags = {
    Client = var.client_slug
  }
}

# Signing Orchestrator API Key
resource "aws_secretsmanager_secret" "signing_api_key" {
  name = "${var.secrets_prefix}/signing-orchestrator-api-key"

  tags = {
    Client = var.client_slug
  }
}

# DocuSeal API Token
resource "aws_secretsmanager_secret" "docuseal_token" {
  name = "${var.secrets_prefix}/docuseal-api-token"

  tags = {
    Client = var.client_slug
  }
}

# WhatsApp API Token
resource "aws_secretsmanager_secret" "whatsapp_token" {
  name = "${var.secrets_prefix}/whatsapp-api-token"

  tags = {
    Client = var.client_slug
  }
}

# Resend API Key
resource "aws_secretsmanager_secret" "resend_api_key" {
  name = "${var.secrets_prefix}/resend-api-key"

  tags = {
    Client = var.client_slug
  }
}

# CTOS API credentials
resource "aws_secretsmanager_secret" "ctos_credentials" {
  name = "${var.secrets_prefix}/ctos-credentials"

  tags = {
    Client = var.client_slug
  }
}

# Cloudflare Tunnel Token
resource "aws_secretsmanager_secret" "cloudflare_tunnel_token" {
  name = "${var.secrets_prefix}/cloudflare-tunnel-token"

  tags = {
    Client = var.client_slug
  }
}

# Outputs
output "secret_arns" {
  value = {
    jwt_secret               = aws_secretsmanager_secret.jwt_secret.arn
    jwt_refresh_secret       = aws_secretsmanager_secret.jwt_refresh_secret.arn
    signing_api_key          = aws_secretsmanager_secret.signing_api_key.arn
    docuseal_token           = aws_secretsmanager_secret.docuseal_token.arn
    whatsapp_token           = aws_secretsmanager_secret.whatsapp_token.arn
    resend_api_key           = aws_secretsmanager_secret.resend_api_key.arn
    ctos_credentials         = aws_secretsmanager_secret.ctos_credentials.arn
    cloudflare_tunnel_token  = aws_secretsmanager_secret.cloudflare_tunnel_token.arn
  }
}

output "secrets_prefix" {
  value = var.secrets_prefix
}
