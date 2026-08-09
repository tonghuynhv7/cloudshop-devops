variable "aws_region" {
  description = "AWS Region"
  type        = string
}

variable "project_name" {
  description = "Project name"
  type        = string
}

variable "environment" {
  description = "Environment"
  type        = string
}
variable "vpc_cidr" {
  description = "CIDR block for CloudShop VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "public_subnet_cidrs" {
  description = "CIDRs for public subnets"
  type        = list(string)

  default = [
    "10.0.1.0/24",
    "10.0.2.0/24"
  ]
}

variable "private_app_subnet_cidrs" {
  description = "CIDRs for private application subnets"
  type        = list(string)

  default = [
    "10.0.11.0/24",
    "10.0.12.0/24"
  ]
}

variable "private_data_subnet_cidrs" {
  description = "CIDRs for private data subnets"
  type        = list(string)

  default = [
    "10.0.21.0/24",
    "10.0.22.0/24"
  ]
}
variable "container_port" {
  description = "Port exposed by CloudShop API"
  type        = number
  default     = 3000
}

variable "task_cpu" {
  description = "Fargate task CPU units"
  type        = number
  default     = 256
}

variable "task_memory" {
  description = "Fargate task memory in MiB"
  type        = number
  default     = 512
}

variable "ecs_desired_count" {
  description = "Desired number of ECS tasks"
  type        = number
  default     = 2
}

variable "image_tag" {
  description = "Docker image tag deployed to ECS"
  type        = string
  default     = "latest"
}
variable "db_username" {
  description = "PostgreSQL master username"
  type        = string
}

variable "db_password" {
  description = "PostgreSQL master password"
  type        = string
  sensitive   = true
}