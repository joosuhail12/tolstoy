# Terraform configuration for Fallback State Management
# Sprint 5 Task 5.5: S3 + DynamoDB fallback for HCP Terraform Cloud

# Note: This provides a fallback option to HCP Terraform Cloud
# The current setup uses HCP Terraform Cloud as configured in main.tf
# This creates infrastructure for potential migration or DR scenarios

# S3 Bucket for Terraform State (Fallback)
resource "aws_s3_bucket" "tfstate_backup" {
  count  = var.enable_state_backup ? 1 : 0
  bucket = "tolstoy-tfstate-backup-${var.environment}-${random_id.state_bucket_suffix.hex}"
  
  tags = {
    Name        = "tolstoy-tfstate-backup-${var.environment}"
    Purpose     = "Terraform State Backup"
    Environment = var.environment
  }
}

# Random suffix for state backup bucket
resource "random_id" "state_bucket_suffix" {
  byte_length = 4
}

# S3 Bucket Versioning for State
resource "aws_s3_bucket_versioning" "tfstate_backup_versioning" {
  count  = var.enable_state_backup ? 1 : 0
  bucket = aws_s3_bucket.tfstate_backup[0].id
  
  versioning_configuration {
    status = "Enabled"
  }
}

# S3 Bucket Server-Side Encryption for State
resource "aws_s3_bucket_server_side_encryption_configuration" "tfstate_backup_encryption" {
  count  = var.enable_state_backup ? 1 : 0
  bucket = aws_s3_bucket.tfstate_backup[0].id

  rule {
    apply_server_side_encryption_by_default {
      kms_master_key_id = aws_kms_key.state_backup_key[0].arn
      sse_algorithm     = "aws:kms"
    }
    bucket_key_enabled = true
  }
}

# S3 Bucket Public Access Block for State
resource "aws_s3_bucket_public_access_block" "tfstate_backup_pab" {
  count  = var.enable_state_backup ? 1 : 0
  bucket = aws_s3_bucket.tfstate_backup[0].id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# KMS Key for State Encryption
resource "aws_kms_key" "state_backup_key" {
  count                   = var.enable_state_backup ? 1 : 0
  description             = "KMS key for Tolstoy Terraform state backup encryption"
  deletion_window_in_days = 7

  tags = {
    Name        = "tolstoy-tfstate-backup-key-${var.environment}"
    Environment = var.environment
    Purpose     = "Terraform State Backup Encryption"
  }
}

# KMS Key Alias for State
resource "aws_kms_alias" "state_backup_key_alias" {
  count         = var.enable_state_backup ? 1 : 0
  name          = "alias/tolstoy-tfstate-backup-${var.environment}"
  target_key_id = aws_kms_key.state_backup_key[0].key_id
}

# DynamoDB Table for Terraform State Locking
resource "aws_dynamodb_table" "terraform_lock" {
  count          = var.enable_state_backup ? 1 : 0
  name           = "tolstoy-terraform-lock-${var.environment}"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "LockID"

  attribute {
    name = "LockID"
    type = "S"
  }

  server_side_encryption {
    enabled     = true
    kms_key_arn = aws_kms_key.state_backup_key[0].arn
  }

  point_in_time_recovery {
    enabled = true
  }

  tags = {
    Name        = "tolstoy-terraform-lock-${var.environment}"
    Environment = var.environment
    Purpose     = "Terraform State Locking"
  }
}

# Cross-region replication for state backup
resource "aws_s3_bucket" "tfstate_backup_replica" {
  count    = var.enable_state_backup && var.enable_cross_region_state_backup ? 1 : 0
  provider = aws.replica
  bucket   = "tolstoy-tfstate-replica-${var.environment}-${random_id.state_bucket_suffix.hex}"
  
  tags = {
    Name        = "tolstoy-tfstate-replica-${var.environment}"
    Purpose     = "Terraform State Replica"
    Environment = var.environment
  }
}

# Cross-region replication configuration for state
resource "aws_s3_bucket_replication_configuration" "tfstate_replication" {
  count      = var.enable_state_backup && var.enable_cross_region_state_backup ? 1 : 0
  depends_on = [aws_s3_bucket_versioning.tfstate_backup_versioning]
  
  role   = aws_iam_role.state_replication_role[0].arn
  bucket = aws_s3_bucket.tfstate_backup[0].id

  rule {
    id     = "tfstate_replication"
    status = "Enabled"

    destination {
      bucket        = aws_s3_bucket.tfstate_backup_replica[0].arn
      storage_class = "STANDARD_IA"
    }
  }
}

# IAM Role for State Replication
resource "aws_iam_role" "state_replication_role" {
  count = var.enable_state_backup && var.enable_cross_region_state_backup ? 1 : 0
  name  = "tolstoy-tfstate-replication-role-${var.environment}"

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

  tags = {
    Name        = "tolstoy-tfstate-replication-role-${var.environment}"
    Environment = var.environment
    Purpose     = "Terraform State Replication"
  }
}

# IAM Policy for State Replication
resource "aws_iam_role_policy" "state_replication_policy" {
  count = var.enable_state_backup && var.enable_cross_region_state_backup ? 1 : 0
  name  = "tolstoy-tfstate-replication-policy"
  role  = aws_iam_role.state_replication_role[0].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObjectVersionForReplication",
          "s3:GetObjectVersionAcl"
        ]
        Resource = "${aws_s3_bucket.tfstate_backup[0].arn}/*"
      },
      {
        Effect = "Allow"
        Action = [
          "s3:ListBucket"
        ]
        Resource = aws_s3_bucket.tfstate_backup[0].arn
      },
      {
        Effect = "Allow"
        Action = [
          "s3:ReplicateObject",
          "s3:ReplicateDelete"
        ]
        Resource = "${aws_s3_bucket.tfstate_backup_replica[0].arn}/*"
      }
    ]
  })
}

# Lambda function to backup HCP Terraform Cloud state to S3
resource "aws_lambda_function" "state_backup" {
  count = var.enable_state_backup ? 1 : 0
  
  filename         = "${path.module}/lambda/state-backup.zip"
  function_name    = "tolstoy-state-backup-${var.environment}"
  role            = aws_iam_role.state_backup_lambda_role[0].arn
  handler         = "state-backup.handler"
  runtime         = "nodejs18.x"
  timeout         = 300 # 5 minutes
  memory_size     = 256
  
  environment {
    variables = {
      STATE_BUCKET    = aws_s3_bucket.tfstate_backup[0].bucket
      AWS_REGION      = var.aws_region
      ENVIRONMENT     = var.environment
      TFC_TOKEN       = var.tfc_token
      TFC_ORGANIZATION = var.hcp_organization
      TFC_WORKSPACE   = var.hcp_workspace_name
    }
  }

  depends_on = [
    aws_iam_role_policy.state_backup_lambda_policy,
  ]

  tags = {
    Name        = "tolstoy-state-backup-${var.environment}"
    Environment = var.environment
    Purpose     = "Terraform State Backup"
  }
}

# IAM Role for State Backup Lambda
resource "aws_iam_role" "state_backup_lambda_role" {
  count = var.enable_state_backup ? 1 : 0
  name  = "tolstoy-state-backup-lambda-role-${var.environment}"

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
    Name        = "tolstoy-state-backup-lambda-role-${var.environment}"
    Environment = var.environment
    Purpose     = "State Backup Lambda Execution"
  }
}

# IAM Policy for State Backup Lambda
resource "aws_iam_role_policy" "state_backup_lambda_policy" {
  count = var.enable_state_backup ? 1 : 0
  name  = "tolstoy-state-backup-lambda-policy"
  role  = aws_iam_role.state_backup_lambda_role[0].id

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
          "s3:GetObject",
          "s3:ListBucket"
        ]
        Resource = [
          aws_s3_bucket.tfstate_backup[0].arn,
          "${aws_s3_bucket.tfstate_backup[0].arn}/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "kms:Decrypt",
          "kms:GenerateDataKey"
        ]
        Resource = aws_kms_key.state_backup_key[0].arn
      }
    ]
  })
}

# EventBridge Rule for Weekly State Backup
resource "aws_cloudwatch_event_rule" "weekly_state_backup" {
  count               = var.enable_state_backup ? 1 : 0
  name                = "tolstoy-weekly-state-backup-${var.environment}"
  description         = "Trigger weekly Terraform state backup"
  schedule_expression = "rate(7 days)" # Every Sunday
  
  tags = {
    Name        = "tolstoy-weekly-state-backup-${var.environment}"
    Environment = var.environment
    Purpose     = "Terraform State Backup Schedule"
  }
}

# EventBridge Target for State Backup
resource "aws_cloudwatch_event_target" "state_backup_target" {
  count     = var.enable_state_backup ? 1 : 0
  rule      = aws_cloudwatch_event_rule.weekly_state_backup[0].name
  target_id = "TolstoyStateBackupTarget"
  arn       = aws_lambda_function.state_backup[0].arn
}

# Lambda Permission for State Backup EventBridge
resource "aws_lambda_permission" "allow_eventbridge_state_backup" {
  count         = var.enable_state_backup ? 1 : 0
  statement_id  = "AllowExecutionFromCloudWatchStateBackup"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.state_backup[0].function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.weekly_state_backup[0].arn
}

# Output instructions for manual S3 backend configuration
locals {
  s3_backend_config = var.enable_state_backup ? templatefile("${path.module}/templates/s3_backend.tftpl", {
    bucket         = aws_s3_bucket.tfstate_backup[0].bucket
    key            = "tolstoy/${var.environment}/terraform.tfstate"
    region         = var.aws_region
    dynamodb_table = aws_dynamodb_table.terraform_lock[0].name
    kms_key_id     = aws_kms_key.state_backup_key[0].arn
  }) : ""
}

# Write S3 backend configuration template
resource "local_file" "s3_backend_template" {
  count    = var.enable_state_backup ? 1 : 0
  content  = local.s3_backend_config
  filename = "${path.module}/s3_backend_config.tf.example"
}