# Networking Module - VPC, Subnets, Security Groups
# Cost-optimized: No NAT Gateway, ECS services use public subnets with public IPs
# Still secure: No inbound ports open, all traffic via Cloudflare Tunnel

variable "client_slug" {
  description = "Client identifier"
  type        = string
}

variable "vpc_cidr" {
  description = "CIDR block for VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "region" {
  description = "AWS region"
  type        = string
  default     = "ap-southeast-5"
}

# VPC
resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name   = "${var.client_slug}-vpc"
    Client = var.client_slug
  }
}

# Internet Gateway
resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id

  tags = {
    Name   = "${var.client_slug}-igw"
    Client = var.client_slug
  }
}

# Public Subnet (single AZ for ECS services - cost optimized)
resource "aws_subnet" "public" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = cidrsubnet(var.vpc_cidr, 8, 0)
  availability_zone       = "${var.region}a"
  map_public_ip_on_launch = true

  tags = {
    Name   = "${var.client_slug}-public"
    Client = var.client_slug
    Type   = "public"
  }
}

# Private Subnets (for RDS only - needs 2 AZs for subnet group requirement)
resource "aws_subnet" "private" {
  count             = 2
  vpc_id            = aws_vpc.main.id
  cidr_block        = cidrsubnet(var.vpc_cidr, 8, count.index + 100)
  availability_zone = count.index == 0 ? "${var.region}a" : "${var.region}b"

  tags = {
    Name   = "${var.client_slug}-private-${count.index + 1}"
    Client = var.client_slug
    Type   = "private"
  }
}

# Route Table for Public Subnet
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = {
    Name   = "${var.client_slug}-public-rt"
    Client = var.client_slug
  }
}

# Associate Public Subnet with Route Table
resource "aws_route_table_association" "public" {
  subnet_id      = aws_subnet.public.id
  route_table_id = aws_route_table.public.id
}

# Security Group for ECS Tasks (no inbound from internet, egress allowed)
resource "aws_security_group" "ecs" {
  name        = "${var.client_slug}-ecs-sg"
  description = "Security group for ECS tasks"
  vpc_id      = aws_vpc.main.id

  # Outbound: Allow all (for Cloudflare Tunnel, ECR pulls, external APIs)
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name   = "${var.client_slug}-ecs-sg"
    Client = var.client_slug
  }

  lifecycle {
    create_before_destroy = true
  }
}

# Separate ingress rule to avoid circular dependency issues
resource "aws_security_group_rule" "ecs_internal" {
  type                     = "ingress"
  from_port                = 0
  to_port                  = 65535
  protocol                 = "tcp"
  security_group_id        = aws_security_group.ecs.id
  source_security_group_id = aws_security_group.ecs.id
  description              = "Internal traffic between ECS tasks"
}

# Security Group for RDS
resource "aws_security_group" "rds" {
  name        = "${var.client_slug}-rds-sg"
  description = "Security group for RDS"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "PostgreSQL from ECS"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs.id]
  }

  tags = {
    Name   = "${var.client_slug}-rds-sg"
    Client = var.client_slug
  }
}

# Outputs
output "vpc_id" {
  value = aws_vpc.main.id
}

output "public_subnet_id" {
  description = "Public subnet ID for ECS services"
  value       = aws_subnet.public.id
}

output "private_subnet_ids" {
  description = "Private subnet IDs (for RDS)"
  value       = aws_subnet.private[*].id
}

output "ecs_security_group_id" {
  value = aws_security_group.ecs.id
}

output "rds_security_group_id" {
  value = aws_security_group.rds.id
}
