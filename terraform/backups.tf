# Terraform configuration for Tolstoy Database Backup Infrastructure
# Sprint 5 Task 5.5: Backups & DR Automation

# S3 Bucket for Database Backups
resource "aws_s3_bucket" "tolstoy_backups" {
  bucket = "tolstoy-backups-${var.environment}-${random_id.bucket_suffix.hex}"
  
  tags = {
    Name        = "tolstoy-backups-${var.environment}"
    Purpose     = "Database Backups"
    Environment = var.environment
  }
}

# Random suffix to ensure bucket name uniqueness
resource "random_id" "bucket_suffix" {
  byte_length = 4
}

# S3 Bucket Versioning
resource "aws_s3_bucket_versioning" "backups_versioning" {
  bucket = aws_s3_bucket.tolstoy_backups.id
  versioning_configuration {
    status = "Enabled"
  }
}

# S3 Bucket Server-Side Encryption
resource "aws_s3_bucket_server_side_encryption_configuration" "backups_encryption" {
  bucket = aws_s3_bucket.tolstoy_backups.id

  rule {
    apply_server_side_encryption_by_default {
      kms_master_key_id = aws_kms_key.backup_key.arn
      sse_algorithm     = "aws:kms"
    }
    bucket_key_enabled = true
  }
}

# S3 Bucket Public Access Block
resource "aws_s3_bucket_public_access_block" "backups_pab" {
  bucket = aws_s3_bucket.tolstoy_backups.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# S3 Lifecycle Configuration for Backup Retention
resource "aws_s3_bucket_lifecycle_configuration" "backups_lifecycle" {
  depends_on = [aws_s3_bucket_versioning.backups_versioning]
  bucket     = aws_s3_bucket.tolstoy_backups.id

  rule {
    id     = "backup_retention"
    status = "Enabled"

    # Delete current version after 30 days
    expiration {
      days = var.backup_retention_days
    }

    # Delete non-current versions after 7 days
    noncurrent_version_expiration {
      noncurrent_days = 7
    }

    # Transition to IA after 30 days for cost optimization
    transition {
      days          = 30
      storage_class = "STANDARD_IA"
    }

    # Transition to Glacier after 90 days
    transition {
      days          = 90
      storage_class = "GLACIER"
    }
  }
}

# KMS Key for Backup Encryption
resource "aws_kms_key" "backup_key" {
  description             = "KMS key for Tolstoy database backup encryption"
  deletion_window_in_days = 7

  tags = {
    Name        = "tolstoy-backup-key-${var.environment}"
    Environment = var.environment
    Purpose     = "Database Backup Encryption"
  }
}

# KMS Key Alias
resource "aws_kms_alias" "backup_key_alias" {
  name          = "alias/tolstoy-backup-${var.environment}"
  target_key_id = aws_kms_key.backup_key.key_id
}

# Cross-Region Replication Bucket (DR)
resource "aws_s3_bucket" "tolstoy_backups_replica" {
  count    = var.enable_cross_region_backup ? 1 : 0
  provider = aws.replica
  bucket   = "tolstoy-backups-replica-${var.environment}-${random_id.bucket_suffix.hex}"
  
  tags = {
    Name        = "tolstoy-backups-replica-${var.environment}"
    Purpose     = "Database Backups Replica"
    Environment = var.environment
  }
}

# Cross-Region Replication Configuration
resource "aws_s3_bucket_replication_configuration" "backups_replication" {
  count      = var.enable_cross_region_backup ? 1 : 0
  depends_on = [aws_s3_bucket_versioning.backups_versioning]
  
  role   = aws_iam_role.replication_role[0].arn
  bucket = aws_s3_bucket.tolstoy_backups.id

  rule {
    id     = "backup_replication"
    status = "Enabled"

    destination {
      bucket        = aws_s3_bucket.tolstoy_backups_replica[0].arn
      storage_class = "STANDARD_IA"
    }
  }
}

# IAM Role for S3 Replication
resource "aws_iam_role" "replication_role" {
  count = var.enable_cross_region_backup ? 1 : 0
  name  = "tolstoy-s3-replication-role-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "s3.amazonaws.com"
        }
      }
    ]
  })
}

# IAM Policy for S3 Replication
resource "aws_iam_role_policy" "replication_policy" {
  count = var.enable_cross_region_backup ? 1 : 0
  name  = "tolstoy-s3-replication-policy"
  role  = aws_iam_role.replication_role[0].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObjectVersionForReplication",
          "s3:GetObjectVersionAcl"
        ]
        Resource = "${aws_s3_bucket.tolstoy_backups.arn}/*"
      },
      {
        Effect = "Allow"
        Action = [
          "s3:ListBucket"
        ]
        Resource = aws_s3_bucket.tolstoy_backups.arn
      },
      {
        Effect = "Allow"
        Action = [
          "s3:ReplicateObject",
          "s3:ReplicateDelete"
        ]
        Resource = "${aws_s3_bucket.tolstoy_backups_replica[0].arn}/*"
      }
    ]
  })
}

# IAM Role for Backup Lambda Function
resource "aws_iam_role" "backup_lambda_role" {
  name = "tolstoy-backup-lambda-role-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name        = "tolstoy-backup-lambda-role-${var.environment}"
    Environment = var.environment
    Purpose     = "Database Backup Lambda Execution"
  }
}

# IAM Policy for Backup Lambda Function
resource "aws_iam_role_policy" "backup_lambda_policy" {
  name = "tolstoy-backup-lambda-policy"
  role = aws_iam_role.backup_lambda_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:*"
      },
      {
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:PutObjectAcl",
          "s3:GetObject",
          "s3:ListBucket"
        ]
        Resource = [
          aws_s3_bucket.tolstoy_backups.arn,
          "${aws_s3_bucket.tolstoy_backups.arn}/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Resource = [
          "arn:aws:secretsmanager:${var.aws_region}:*:secret:tolstoy/env*",
          "arn:aws:secretsmanager:${var.aws_region}:*:secret:conductor-db-secret*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "kms:Decrypt",
          "kms:GenerateDataKey"
        ]
        Resource = aws_kms_key.backup_key.arn
      }
    ]
  })
}

# CloudWatch Log Group for Backup Lambda
resource "aws_cloudwatch_log_group" "backup_lambda_logs" {
  name              = "/aws/lambda/tolstoy-backup-${var.environment}"
  retention_in_days = var.log_retention_days

  tags = {
    Name        = "tolstoy-backup-logs-${var.environment}"
    Environment = var.environment
    Purpose     = "Backup Lambda Logs"
  }
}