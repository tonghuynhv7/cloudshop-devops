resource "aws_db_subnet_group" "main" {
  name = "${local.name_prefix}-db-subnet-group"

  subnet_ids = aws_subnet.private_data[*].id

  tags = {
    Name = "${local.name_prefix}-db-subnet-group"
  }
}
resource "aws_db_instance" "postgres" {
  identifier = "${local.name_prefix}-postgres"

  engine         = "postgres"
  engine_version = "16"

  instance_class        = "db.t4g.micro"
  allocated_storage     = 20
  max_allocated_storage = 100

  db_name  = "cloudshop"
  username = var.db_username
  password = var.db_password

  port = 5432

  db_subnet_group_name = aws_db_subnet_group.main.name

  vpc_security_group_ids = [
    aws_security_group.rds.id
  ]

  publicly_accessible = false
  multi_az            = false

  storage_encrypted = true

  skip_final_snapshot = true
  deletion_protection = false

  backup_retention_period = 1

  tags = {
    Name = "${local.name_prefix}-postgres"
  }
}