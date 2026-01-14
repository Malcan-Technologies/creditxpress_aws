# Root Terraform Configuration
# This file ties together all modules using client.json configuration
# Uses Cloudflare Tunnel for ingress instead of ALB

terraform {
  required_version = ">= 1.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.0"
    }
  }

  # Uncomment and configure for remote state
  # backend "s3" {
  #   bucket         = "terraform-state-bucket"
  #   key            = "client-slug/terraform.tfstate"
  #   region         = "ap-southeast-1"
  #   encrypt        = true
  #   dynamodb_table = "terraform-locks"
  # }
}

# Load client configuration from client.json
locals {
  config = jsondecode(file("${path.root}/../../client.json"))
}

# AWS Provider
provider "aws" {
  region = local.config.aws.region

  default_tags {
    tags = {
      Client      = local.config.client_slug
      Environment = local.config.environment
      ManagedBy   = "terraform"
    }
  }
}

# ==============================================
# Networking Module
# ==============================================
module "networking" {
  source = "./modules/networking"

  client_slug = local.config.client_slug
  region      = local.config.aws.region
}

# ==============================================
# ECR Module
# ==============================================
module "ecr" {
  source = "./modules/ecr"

  client_slug = local.config.client_slug
  repos       = ["backend", "frontend", "admin"]
}

# ==============================================
# S3 Module
# ==============================================
module "s3" {
  source = "./modules/s3"

  client_slug = local.config.client_slug
  bucket_name = local.config.s3.bucket
}

# ==============================================
# RDS Module
# ==============================================
module "rds" {
  source = "./modules/rds"

  client_slug        = local.config.client_slug
  identifier         = local.config.rds.identifier
  database_name      = local.config.rds.database
  vpc_id             = module.networking.vpc_id
  private_subnet_ids = module.networking.private_subnet_ids
  security_group_id  = module.networking.rds_security_group_id
}

# ==============================================
# Secrets Module
# ==============================================
module "secrets" {
  source = "./modules/secrets"

  client_slug    = local.config.client_slug
  secrets_prefix = local.config.secrets_prefix
}

# ==============================================
# ECS Module (with Cloudflare Tunnel)
# Cost-optimized: All services in public subnet (no NAT Gateway)
# ==============================================
module "ecs" {
  source = "./modules/ecs"

  client_slug       = local.config.client_slug
  cluster_name      = local.config.ecs.cluster
  vpc_id            = module.networking.vpc_id
  public_subnet_id  = module.networking.public_subnet_id
  security_group_id = module.networking.ecs_security_group_id

  # Cloudflare Tunnel configuration
  cloudflare_tunnel_token_arn = module.secrets.secret_arns.cloudflare_tunnel_token
  domains = {
    app   = local.config.domains.app
    admin = local.config.domains.admin
    api   = local.config.domains.api
  }

  # Minimum Fargate specs: 256 CPU (.25 vCPU) with 512MB memory
  # Cost-optimized for small deployments
  services = {
    backend = {
      name           = local.config.ecs.backend_service
      port           = 4001
      health         = "/api/health"
      ecr_repo       = module.ecr.repository_urls["backend"]
      cpu            = 256   # .25 vCPU (minimum)
      memory         = 512   # 512MB (minimum for 256 CPU)
      secrets_prefix = local.config.secrets_prefix
    }
    frontend = {
      name     = local.config.ecs.frontend_service
      port     = 3000
      health   = "/"
      ecr_repo = module.ecr.repository_urls["frontend"]
      cpu      = 256   # .25 vCPU (minimum)
      memory   = 512   # 512MB (minimum for 256 CPU)
    }
    admin = {
      name     = local.config.ecs.admin_service
      port     = 3000
      health   = "/login"
      ecr_repo = module.ecr.repository_urls["admin"]
      cpu      = 256   # .25 vCPU (minimum)
      memory   = 512   # 512MB (minimum for 256 CPU)
    }
  }

  # All secrets for backend container
  secrets_arns = {
    database_url        = module.rds.database_url_secret_arn
    jwt_secret          = module.secrets.secret_arns.jwt_secret
    jwt_refresh_secret  = module.secrets.secret_arns.jwt_refresh_secret
    signing_api_key     = module.secrets.secret_arns.signing_api_key
    docuseal_token      = module.secrets.secret_arns.docuseal_token
    whatsapp_token      = module.secrets.secret_arns.whatsapp_token
    resend_api_key      = module.secrets.secret_arns.resend_api_key
    ctos_credentials    = module.secrets.secret_arns.ctos_credentials
  }

  # RDS endpoint for backend DATABASE_URL construction
  rds_endpoint = module.rds.endpoint
  rds_database = local.config.rds.database
}

# ==============================================
# Outputs
# ==============================================
output "vpc_id" {
  description = "VPC ID"
  value       = module.networking.vpc_id
}

output "ecr_repositories" {
  description = "ECR repository URLs"
  value       = module.ecr.repository_urls
}

output "rds_endpoint" {
  description = "RDS endpoint"
  value       = module.rds.endpoint
  sensitive   = true
}

output "s3_bucket" {
  description = "S3 bucket name"
  value       = module.s3.bucket_name
}

output "ecs_cluster" {
  description = "ECS cluster name"
  value       = local.config.ecs.cluster
}

output "ecs_services" {
  description = "ECS service names"
  value       = module.ecs.service_names
}

output "secrets_prefix" {
  description = "Secrets Manager prefix"
  value       = local.config.secrets_prefix
}

output "service_discovery_namespace" {
  description = "Internal DNS namespace for services"
  value       = module.ecs.service_discovery_namespace
}

output "service_endpoints" {
  description = "Internal DNS endpoints for services (used in Cloudflare Tunnel config)"
  value       = module.ecs.service_endpoints
}
