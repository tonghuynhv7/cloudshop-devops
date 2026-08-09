resource "aws_elasticache_subnet_group" "redis" {
  name = "${local.name_prefix}-redis-subnet-group"

  subnet_ids = aws_subnet.private_data[*].id

  tags = {
    Name = "${local.name_prefix}-redis-subnet-group"
  }
}
resource "aws_elasticache_replication_group" "redis" {
  replication_group_id = "${local.name_prefix}-redis"
  description          = "Redis for CloudShop"

  engine = "redis"

  node_type = "cache.t4g.micro"
  port      = 6379

  num_cache_clusters = 1

  subnet_group_name = aws_elasticache_subnet_group.redis.name

  security_group_ids = [
    aws_security_group.redis.id
  ]

  automatic_failover_enabled = false
  multi_az_enabled           = false

  at_rest_encryption_enabled = true
  transit_encryption_enabled = false

  tags = {
    Name = "${local.name_prefix}-redis"
  }
}