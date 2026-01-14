# ECS Module - Fargate Cluster and Services
# Cost-optimized: All services in public subnet with public IPs (no NAT Gateway)
# Still secure: No inbound ports open, all traffic via Cloudflare Tunnel

variable "client_slug" {
  description = "Client identifier"
  type        = string
}

variable "cluster_name" {
  description = "ECS cluster name"
  type        = string
}

variable "vpc_id" {
  description = "VPC ID"
  type        = string
}

variable "public_subnet_id" {
  description = "Public subnet ID for all ECS services"
  type        = string
}

variable "security_group_id" {
  description = "Security group ID for ECS tasks"
  type        = string
}

variable "services" {
  description = "Map of service configurations"
  type = map(object({
    name           = string
    port           = number
    health         = string
    ecr_repo       = string
    cpu            = optional(number, 256)
    memory         = optional(number, 512)
    desired_count  = optional(number, 1)
    secrets_prefix = optional(string, "")
  }))
}

variable "secrets_arns" {
  description = "Map of secret ARNs to inject"
  type        = map(string)
  default     = {}
}

variable "cloudflare_tunnel_token_arn" {
  description = "ARN of the Cloudflare Tunnel token secret"
  type        = string
}

variable "domains" {
  description = "Domain configuration for tunnel routing"
  type = object({
    app   = string
    admin = string
    api   = string
  })
}

variable "rds_endpoint" {
  description = "RDS endpoint for backend"
  type        = string
  default     = ""
}

variable "rds_database" {
  description = "RDS database name"
  type        = string
  default     = ""
}

# Data source for current AWS region
data "aws_region" "current" {}

# ECS Cluster
resource "aws_ecs_cluster" "main" {
  name = var.cluster_name

  setting {
    name  = "containerInsights"
    value = "disabled"
  }

  tags = {
    Name   = var.cluster_name
    Client = var.client_slug
  }
}

# CloudWatch Log Groups
resource "aws_cloudwatch_log_group" "services" {
  for_each = var.services

  name              = "/ecs/${var.client_slug}/${each.key}"
  retention_in_days = 14

  tags = {
    Client = var.client_slug
  }
}

resource "aws_cloudwatch_log_group" "cloudflared" {
  name              = "/ecs/${var.client_slug}/cloudflared"
  retention_in_days = 14

  tags = {
    Client = var.client_slug
  }
}

# IAM Role for ECS Task Execution
resource "aws_iam_role" "ecs_execution" {
  name = "${var.client_slug}-ecs-execution-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Client = var.client_slug
  }
}

resource "aws_iam_role_policy_attachment" "ecs_execution" {
  role       = aws_iam_role.ecs_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# Policy for Secrets Manager access
resource "aws_iam_role_policy" "ecs_secrets" {
  name = "${var.client_slug}-ecs-secrets-policy"
  role = aws_iam_role.ecs_execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Resource = [
          "arn:aws:secretsmanager:${data.aws_region.current.name}:*:secret:${var.client_slug}/*"
        ]
      }
    ]
  })
}

# IAM Role for ECS Tasks
resource "aws_iam_role" "ecs_task" {
  name = "${var.client_slug}-ecs-task-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Client = var.client_slug
  }
}

# S3 access policy for task role
resource "aws_iam_role_policy" "ecs_s3" {
  name = "${var.client_slug}-ecs-s3-policy"
  role = aws_iam_role.ecs_task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject",
          "s3:ListBucket"
        ]
        Resource = [
          "arn:aws:s3:::${var.client_slug}-*",
          "arn:aws:s3:::${var.client_slug}-*/*"
        ]
      }
    ]
  })
}

# SSM permissions for ECS Exec (required for migrations and debugging)
resource "aws_iam_role_policy" "ecs_exec" {
  name = "${var.client_slug}-ecs-exec-policy"
  role = aws_iam_role.ecs_task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ssmmessages:CreateControlChannel",
          "ssmmessages:CreateDataChannel",
          "ssmmessages:OpenControlChannel",
          "ssmmessages:OpenDataChannel"
        ]
        Resource = "*"
      }
    ]
  })
}

# ==============================================
# Backend Task Definition (with secrets)
# ==============================================
resource "aws_ecs_task_definition" "backend" {
  family                   = "${var.client_slug}-backend"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.services["backend"].cpu
  memory                   = var.services["backend"].memory
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([
    {
      name  = "backend"
      image = "${var.services["backend"].ecr_repo}:latest"
      
      portMappings = [
        {
          containerPort = var.services["backend"].port
          hostPort      = var.services["backend"].port
          protocol      = "tcp"
        }
      ]

      environment = [
        { name = "NODE_ENV", value = "production" },
        { name = "PORT", value = tostring(var.services["backend"].port) },
        { name = "TZ", value = "Asia/Kuala_Lumpur" },
        { name = "DOCUSEAL_URL", value = "https://${var.domains.api}/docuseal" },
        { name = "SIGNING_ORCHESTRATOR_URL", value = "https://${var.domains.api}/signing" },
        { name = "FRONTEND_URL", value = "https://${var.domains.app}" },
        { name = "ADMIN_URL", value = "https://${var.domains.admin}" },
      ]

      secrets = [
        { name = "DATABASE_URL", valueFrom = var.secrets_arns["database_url"] },
        { name = "JWT_SECRET", valueFrom = var.secrets_arns["jwt_secret"] },
        { name = "JWT_REFRESH_SECRET", valueFrom = var.secrets_arns["jwt_refresh_secret"] },
        { name = "SIGNING_ORCHESTRATOR_API_KEY", valueFrom = var.secrets_arns["signing_api_key"] },
        { name = "DOCUSEAL_API_TOKEN", valueFrom = var.secrets_arns["docuseal_token"] },
        { name = "WHATSAPP_CREDENTIALS", valueFrom = var.secrets_arns["whatsapp_token"] },
        { name = "RESEND_CREDENTIALS", valueFrom = var.secrets_arns["resend_api_key"] },
        { name = "CTOS_CREDENTIALS", valueFrom = var.secrets_arns["ctos_credentials"] },
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.services["backend"].name
          "awslogs-region"        = data.aws_region.current.name
          "awslogs-stream-prefix" = "backend"
        }
      }

      healthCheck = {
        command     = ["CMD-SHELL", "wget -qO- http://localhost:${var.services["backend"].port}${var.services["backend"].health} > /dev/null 2>&1 || exit 1"]
        interval    = 30
        timeout     = 10
        retries     = 3
        startPeriod = 120
      }

      essential = true
    }
  ])

  tags = {
    Name   = "${var.client_slug}-backend"
    Client = var.client_slug
  }
}

# ==============================================
# Frontend/Admin Task Definitions (no secrets needed)
# ==============================================
resource "aws_ecs_task_definition" "frontend_admin" {
  for_each = { for k, v in var.services : k => v if k != "backend" }

  family                   = "${var.client_slug}-${each.key}"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = each.value.cpu
  memory                   = each.value.memory
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([
    {
      name  = each.key
      image = "${each.value.ecr_repo}:latest"
      
      portMappings = [
        {
          containerPort = each.value.port
          hostPort      = each.value.port
          protocol      = "tcp"
        }
      ]

      environment = [
        { name = "NODE_ENV", value = "production" },
        { name = "NEXT_PUBLIC_API_URL", value = "https://${var.domains.api}" },
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.services[each.key].name
          "awslogs-region"        = data.aws_region.current.name
          "awslogs-stream-prefix" = each.key
        }
      }

      healthCheck = {
        command     = ["CMD-SHELL", "wget -qO- http://localhost:${each.value.port}${each.value.health} > /dev/null 2>&1 || exit 1"]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 60
      }

      essential = true
    }
  ])

  tags = {
    Name   = "${var.client_slug}-${each.key}"
    Client = var.client_slug
  }
}

# ==============================================
# Cloudflared Task Definition
# ==============================================
resource "aws_ecs_task_definition" "cloudflared" {
  family                   = "${var.client_slug}-cloudflared"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = 256
  memory                   = 512
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([
    {
      name  = "cloudflared"
      image = "cloudflare/cloudflared:latest"
      
      command = ["tunnel", "--no-autoupdate", "run"]

      secrets = [
        {
          name      = "TUNNEL_TOKEN"
          valueFrom = var.cloudflare_tunnel_token_arn
        }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.cloudflared.name
          "awslogs-region"        = data.aws_region.current.name
          "awslogs-stream-prefix" = "cloudflared"
        }
      }

      essential = true
    }
  ])

  tags = {
    Name   = "${var.client_slug}-cloudflared"
    Client = var.client_slug
  }
}

# ==============================================
# Backend ECS Service
# ==============================================
resource "aws_ecs_service" "backend" {
  name            = var.services["backend"].name
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.backend.arn
  desired_count   = var.services["backend"].desired_count
  launch_type     = "FARGATE"

  enable_execute_command = true

  network_configuration {
    subnets          = [var.public_subnet_id]
    security_groups  = [var.security_group_id]
    assign_public_ip = true
  }

  service_registries {
    registry_arn = aws_service_discovery_service.services["backend"].arn
  }

  wait_for_steady_state = false

  lifecycle {
    ignore_changes = [desired_count, task_definition]
  }

  tags = {
    Name   = var.services["backend"].name
    Client = var.client_slug
  }
}

# ==============================================
# Frontend/Admin ECS Services
# ==============================================
resource "aws_ecs_service" "frontend_admin" {
  for_each = { for k, v in var.services : k => v if k != "backend" }

  name            = each.value.name
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.frontend_admin[each.key].arn
  desired_count   = each.value.desired_count
  launch_type     = "FARGATE"

  enable_execute_command = true

  network_configuration {
    subnets          = [var.public_subnet_id]
    security_groups  = [var.security_group_id]
    assign_public_ip = true  # Public IP for direct internet access (no NAT needed)
  }

  # Service discovery for cloudflared to find services
  service_registries {
    registry_arn = aws_service_discovery_service.services[each.key].arn
  }

  wait_for_steady_state = false

  lifecycle {
    ignore_changes = [desired_count, task_definition]
  }

  tags = {
    Name   = each.value.name
    Client = var.client_slug
  }
}

# ==============================================
# Cloudflared Service
# ==============================================
resource "aws_ecs_service" "cloudflared" {
  name            = "${var.client_slug}-cloudflared"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.cloudflared.arn
  desired_count   = 1
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = [var.public_subnet_id]
    security_groups  = [var.security_group_id]
    assign_public_ip = true
  }

  wait_for_steady_state = false

  lifecycle {
    ignore_changes = [desired_count, task_definition]
  }

  tags = {
    Name   = "${var.client_slug}-cloudflared"
    Client = var.client_slug
  }
}

# ==============================================
# Service Discovery (for cloudflared to find services)
# ==============================================
resource "aws_service_discovery_private_dns_namespace" "main" {
  name        = "${var.client_slug}.local"
  description = "Private DNS namespace for ${var.client_slug} services"
  vpc         = var.vpc_id

  tags = {
    Client = var.client_slug
  }
}

resource "aws_service_discovery_service" "services" {
  for_each = var.services

  name = each.key

  dns_config {
    namespace_id = aws_service_discovery_private_dns_namespace.main.id

    dns_records {
      ttl  = 10
      type = "A"
    }

    routing_policy = "MULTIVALUE"
  }

  health_check_custom_config {
    failure_threshold = 1
  }

  tags = {
    Client = var.client_slug
  }
}

# ==============================================
# Outputs
# ==============================================
output "cluster_id" {
  value = aws_ecs_cluster.main.id
}

output "cluster_arn" {
  value = aws_ecs_cluster.main.arn
}

output "service_names" {
  value = merge(
    { backend = aws_ecs_service.backend.name },
    { for k, v in aws_ecs_service.frontend_admin : k => v.name }
  )
}

output "service_discovery_namespace" {
  description = "Service discovery namespace for internal routing"
  value       = aws_service_discovery_private_dns_namespace.main.name
}

output "service_endpoints" {
  description = "Internal DNS names for services"
  value = {
    for k, v in aws_service_discovery_service.services : k => "${v.name}.${aws_service_discovery_private_dns_namespace.main.name}"
  }
}

output "task_role_arn" {
  value = aws_iam_role.ecs_task.arn
}

output "execution_role_arn" {
  value = aws_iam_role.ecs_execution.arn
}
