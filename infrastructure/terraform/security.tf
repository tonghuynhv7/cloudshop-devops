resource "aws_security_group" "alb" {
  name        = "${local.name_prefix}-alb-sg"
  description = "Security group for CloudShop ALB"
  vpc_id      = aws_vpc.main.id

  tags = {
    Name = "${local.name_prefix}-alb-sg"
  }
}
resource "aws_vpc_security_group_ingress_rule" "alb_http" {
  security_group_id = aws_security_group.alb.id

  cidr_ipv4   = "0.0.0.0/0"
  from_port   = 80
  to_port     = 80
  ip_protocol = "tcp"


  description = "Allow HTTP from Internet"
}
resource "aws_vpc_security_group_egress_rule" "alb_to_ecs" {
  security_group_id = aws_security_group.alb.id

  referenced_security_group_id = aws_security_group.ecs.id
  from_port                    = 3000
  to_port                      = 3000
  ip_protocol                  = "tcp"

  description = "Allow ALB to reach ECS API"
}
resource "aws_security_group" "ecs" {
  name        = "${local.name_prefix}-ecs-sg"
  description = "Security group for CloudShop ECS tasks"
  vpc_id      = aws_vpc.main.id

  tags = {
    Name = "${local.name_prefix}-ecs-sg"
  }
}
resource "aws_vpc_security_group_ingress_rule" "ecs_from_alb" {
  security_group_id = aws_security_group.ecs.id

  referenced_security_group_id = aws_security_group.alb.id

  from_port   = 3000
  to_port     = 3000
  ip_protocol = "tcp"

  description = "Allow API traffic only from ALB"
}
resource "aws_security_group" "rds" {
  name        = "${local.name_prefix}-rds-sg"
  description = "Security group for CloudShop PostgreSQL"
  vpc_id      = aws_vpc.main.id

  tags = {
    Name = "${local.name_prefix}-rds-sg"
  }
}
resource "aws_vpc_security_group_ingress_rule" "rds_from_ecs" {
  security_group_id = aws_security_group.rds.id

  referenced_security_group_id = aws_security_group.ecs.id

  from_port   = 5432
  to_port     = 5432
  ip_protocol = "tcp"

  description = "Allow PostgreSQL from ECS only"
}
resource "aws_security_group" "redis" {
  name        = "${local.name_prefix}-redis-sg"
  description = "Security group for CloudShop Redis"
  vpc_id      = aws_vpc.main.id

  tags = {
    Name = "${local.name_prefix}-redis-sg"
  }
}
resource "aws_vpc_security_group_ingress_rule" "redis_from_ecs" {
  security_group_id = aws_security_group.redis.id

  referenced_security_group_id = aws_security_group.ecs.id

  from_port   = 6379
  to_port     = 6379
  ip_protocol = "tcp"

  description = "Allow Redis from ECS only"
}
resource "aws_vpc_security_group_egress_rule" "ecs_all" {
  security_group_id = aws_security_group.ecs.id

  cidr_ipv4   = "0.0.0.0/0"
  ip_protocol = "-1"

  description = "Allow ECS outbound traffic"
}