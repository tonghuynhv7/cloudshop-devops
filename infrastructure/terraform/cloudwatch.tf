resource "aws_cloudwatch_log_group" "ecs" {
  name              = "/ecs/${local.name_prefix}-api"
  retention_in_days = 14

  tags = {
    Name = "${local.name_prefix}-ecs-logs"
  }
}