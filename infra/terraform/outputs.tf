# Consolidated Outputs
# These outputs are useful for CI/CD and debugging

output "client_slug" {
  description = "Client identifier"
  value       = local.config.client_slug
}

output "environment" {
  description = "Environment name"
  value       = local.config.environment
}

output "domains" {
  description = "Domain configuration"
  value       = local.config.domains
}

output "database_url_secret_arn" {
  description = "ARN of the database URL secret"
  value       = module.rds.database_url_secret_arn
  sensitive   = true
}

output "cloudflare_tunnel_token_arn" {
  description = "ARN of the Cloudflare Tunnel token secret (populate this in AWS Secrets Manager)"
  value       = module.secrets.secret_arns.cloudflare_tunnel_token
}

output "deployment_info" {
  description = "Summary of deployment resources"
  value = {
    region             = local.config.aws.region
    cluster            = local.config.ecs.cluster
    s3_bucket          = module.s3.bucket_name
    ecr_repos          = module.ecr.repository_urls
    service_namespace  = module.ecs.service_discovery_namespace
    service_endpoints  = module.ecs.service_endpoints
  }
}

output "cloudflare_tunnel_ingress" {
  description = "Ingress configuration for Cloudflare Tunnel (copy to tunnel config)"
  value = <<-EOT
    # Cloudflare Tunnel Ingress Configuration
    # Add this to your tunnel configuration in Cloudflare Dashboard or config.yml
    
    ingress:
      - hostname: ${local.config.domains.api}
        service: http://backend.${module.ecs.service_discovery_namespace}:4001
      - hostname: ${local.config.domains.app}
        service: http://frontend.${module.ecs.service_discovery_namespace}:3000
      - hostname: ${local.config.domains.admin}
        service: http://admin.${module.ecs.service_discovery_namespace}:3000
      - service: http_status:404
  EOT
}
