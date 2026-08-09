output "project_prefix" {
  value = local.name_prefix
}
output "ecs_log_group_name" {
  description = "CloudWatch Log Group used by the ECS application"
  value       = aws_cloudwatch_log_group.ecs.name
}
output "vpc_id" {
  description = "CloudShop VPC ID"
  value       = aws_vpc.main.id
}

output "public_subnet_ids" {
  description = "Public subnet IDs"
  value       = aws_subnet.public[*].id
}

output "private_app_subnet_ids" {
  description = "Private application subnet IDs"
  value       = aws_subnet.private_app[*].id
}

output "private_data_subnet_ids" {
  description = "Private data subnet IDs"
  value       = aws_subnet.private_data[*].id
}
output "ecs_execution_role_arn" {
  value = aws_iam_role.ecs_execution.arn
}

output "ecs_task_role_arn" {
  value = aws_iam_role.ecs_task.arn
}
output "alb_dns_name" {
  description = "DNS name of CloudShop ALB"
  value       = aws_lb.main.dns_name
}

output "blue_target_group_arn" {
  value = aws_lb_target_group.blue.arn
}

output "green_target_group_arn" {
  value = aws_lb_target_group.green.arn
}
output "ecr_repository_url" {
  description = "CloudShop API ECR repository"
  value       = aws_ecr_repository.api.repository_url
}
output "redis_endpoint" {
  description = "Redis primary endpoint"
  value       = aws_elasticache_replication_group.redis.primary_endpoint_address
}
output "rds_endpoint" {
  description = "RDS PostgreSQL endpoint"
  value       = aws_db_instance.postgres.address
}