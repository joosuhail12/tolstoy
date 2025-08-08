# Terraform configuration for Tolstoy Backup Scheduling & Monitoring
# Sprint 5 Task 5.5: EventBridge scheduling and CloudWatch monitoring

# Create Lambda deployment package
data "archive_file" "backup_lambda_zip" {
  type        = "zip"
  source_dir  = "${path.module}/lambda"
  output_path = "${path.module}/lambda/backup.zip"
  excludes    = ["backup.zip"]
}

# Lambda Function for Database Backup
resource "aws_lambda_function" "backup" {
  filename         = data.archive_file.backup_lambda_zip.output_path
  function_name    = "tolstoy-backup-${var.environment}"
  role            = aws_iam_role.backup_lambda_role.arn
  handler         = "backup.handler"
  runtime         = "nodejs18.x"
  timeout         = 900 # 15 minutes
  memory_size     = 512
  
  source_code_hash = data.archive_file.backup_lambda_zip.output_base64sha256
  
  environment {
    variables = {
      BACKUP_BUCKET = aws_s3_bucket.tolstoy_backups.bucket
      ENVIRONMENT   = var.environment
    }
  }

  # VPC configuration if needed for private subnets
  dynamic "vpc_config" {
    for_each = var.lambda_subnet_ids != null ? [1] : []
    content {
      subnet_ids         = var.lambda_subnet_ids
      security_group_ids = var.lambda_security_group_ids
    }
  }

  depends_on = [
    aws_iam_role_policy.backup_lambda_policy,
    aws_cloudwatch_log_group.backup_lambda_logs,
  ]

  tags = {
    Name        = "tolstoy-backup-${var.environment}"
    Environment = var.environment
    Purpose     = "Database Backup"
  }
}

# EventBridge Rule for Daily Backup Schedule
resource "aws_cloudwatch_event_rule" "daily_backup" {
  name                = "tolstoy-daily-backup-${var.environment}"
  description         = "Trigger daily database backup for Tolstoy"
  schedule_expression = var.backup_schedule
  
  tags = {
    Name        = "tolstoy-daily-backup-${var.environment}"
    Environment = var.environment
    Purpose     = "Database Backup Schedule"
  }
}

# EventBridge Target - Lambda Function
resource "aws_cloudwatch_event_target" "backup_target" {
  rule      = aws_cloudwatch_event_rule.daily_backup.name
  target_id = "TolstoyBackupTarget"
  arn       = aws_lambda_function.backup.arn

  input = jsonencode({
    source      = "eventbridge-schedule"
    environment = var.environment
    timestamp   = timestamp()
  })
}

# Lambda Permission for EventBridge
resource "aws_lambda_permission" "allow_eventbridge" {
  statement_id  = "AllowExecutionFromCloudWatch"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.backup.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.daily_backup.arn
}

# SNS Topic for Backup Notifications
resource "aws_sns_topic" "backup_notifications" {
  name = "tolstoy-backup-notifications-${var.environment}"
  
  tags = {
    Name        = "tolstoy-backup-notifications-${var.environment}"
    Environment = var.environment
    Purpose     = "Backup Status Notifications"
  }
}

# SNS Topic Policy
resource "aws_sns_topic_policy" "backup_notifications_policy" {
  arn = aws_sns_topic.backup_notifications.arn

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = [
            "lambda.amazonaws.com",
            "cloudwatch.amazonaws.com"
          ]
        }
        Action = [
          "sns:Publish"
        ]
        Resource = aws_sns_topic.backup_notifications.arn
      }
    ]
  })
}

# CloudWatch Metric Filter for Backup Success
resource "aws_cloudwatch_log_metric_filter" "backup_success" {
  name           = "tolstoy-backup-success-${var.environment}"
  log_group_name = aws_cloudwatch_log_group.backup_lambda_logs.name
  pattern        = "[timestamp, requestId, level=\"INFO\", message=\"Backup completed successfully\"]"

  metric_transformation {
    name      = "BackupSuccess"
    namespace = "Tolstoy/Backup"
    value     = "1"
    default_value = "0"
  }
}

# CloudWatch Metric Filter for Backup Failures
resource "aws_cloudwatch_log_metric_filter" "backup_failure" {
  name           = "tolstoy-backup-failure-${var.environment}"
  log_group_name = aws_cloudwatch_log_group.backup_lambda_logs.name
  pattern        = "[timestamp, requestId, level=\"ERROR\", message=\"Backup failed\"]"

  metric_transformation {
    name      = "BackupFailure"
    namespace = "Tolstoy/Backup"
    value     = "1"
    default_value = "0"
  }
}

# CloudWatch Alarm for Backup Failures
resource "aws_cloudwatch_metric_alarm" "backup_failure_alarm" {
  alarm_name          = "tolstoy-backup-failure-${var.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "BackupFailure"
  namespace           = "Tolstoy/Backup"
  period              = "300"
  statistic           = "Sum"
  threshold           = "0"
  alarm_description   = "This metric monitors backup failures"
  alarm_actions       = [aws_sns_topic.backup_notifications.arn]
  treat_missing_data  = "notBreaching"

  tags = {
    Name        = "tolstoy-backup-failure-alarm-${var.environment}"
    Environment = var.environment
    Purpose     = "Backup Failure Monitoring"
  }
}

# CloudWatch Alarm for Missing Backup (no success in 25 hours)
resource "aws_cloudwatch_metric_alarm" "backup_missing_alarm" {
  alarm_name          = "tolstoy-backup-missing-${var.environment}"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "BackupSuccess"
  namespace           = "Tolstoy/Backup"
  period              = "90000" # 25 hours in seconds
  statistic           = "Sum"
  threshold           = "1"
  alarm_description   = "This metric monitors for missing daily backups"
  alarm_actions       = [aws_sns_topic.backup_notifications.arn]
  treat_missing_data  = "breaching"

  tags = {
    Name        = "tolstoy-backup-missing-alarm-${var.environment}"
    Environment = var.environment
    Purpose     = "Backup Missing Monitoring"
  }
}

# CloudWatch Alarm for Lambda Function Errors
resource "aws_cloudwatch_metric_alarm" "backup_lambda_errors" {
  alarm_name          = "tolstoy-backup-lambda-errors-${var.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = "300"
  statistic           = "Sum"
  threshold           = "0"
  alarm_description   = "This metric monitors Lambda function errors for backup"
  alarm_actions       = [aws_sns_topic.backup_notifications.arn]
  treat_missing_data  = "notBreaching"

  dimensions = {
    FunctionName = aws_lambda_function.backup.function_name
  }

  tags = {
    Name        = "tolstoy-backup-lambda-errors-${var.environment}"
    Environment = var.environment
    Purpose     = "Lambda Error Monitoring"
  }
}

# CloudWatch Alarm for Lambda Function Duration (15 min timeout warning)
resource "aws_cloudwatch_metric_alarm" "backup_lambda_duration" {
  alarm_name          = "tolstoy-backup-lambda-duration-${var.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "Duration"
  namespace           = "AWS/Lambda"
  period              = "300"
  statistic           = "Average"
  threshold           = "840000" # 14 minutes in milliseconds (warning before 15min timeout)
  alarm_description   = "This metric monitors Lambda function duration for backup"
  alarm_actions       = [aws_sns_topic.backup_notifications.arn]
  treat_missing_data  = "notBreaching"

  dimensions = {
    FunctionName = aws_lambda_function.backup.function_name
  }

  tags = {
    Name        = "tolstoy-backup-lambda-duration-${var.environment}"
    Environment = var.environment
    Purpose     = "Lambda Duration Monitoring"
  }
}

# CloudWatch Dashboard for Backup Monitoring
resource "aws_cloudwatch_dashboard" "backup_dashboard" {
  dashboard_name = "Tolstoy-Backup-${var.environment}"

  dashboard_body = jsonencode({
    widgets = [
      {
        type   = "metric"
        x      = 0
        y      = 0
        width  = 12
        height = 6

        properties = {
          metrics = [
            ["Tolstoy/Backup", "BackupSuccess"],
            [".", "BackupFailure"]
          ]
          period = 86400 # 1 day
          stat   = "Sum"
          region = var.aws_region
          title  = "Daily Backup Success/Failure"
          yAxis = {
            left = {
              min = 0
            }
          }
        }
      },
      {
        type   = "metric"
        x      = 0
        y      = 6
        width  = 12
        height = 6

        properties = {
          metrics = [
            ["AWS/Lambda", "Duration", "FunctionName", aws_lambda_function.backup.function_name],
            [".", "Errors", ".", "."],
            [".", "Invocations", ".", "."]
          ]
          period = 300
          stat   = "Average"
          region = var.aws_region
          title  = "Lambda Function Metrics"
        }
      },
      {
        type   = "log"
        x      = 0
        y      = 12
        width  = 24
        height = 6

        properties = {
          query   = "SOURCE '/aws/lambda/tolstoy-backup-${var.environment}' | fields @timestamp, @message | filter @message like /Backup completed successfully/ or @message like /Backup failed/ | sort @timestamp desc | limit 20"
          region  = var.aws_region
          title   = "Recent Backup Logs"
        }
      }
    ]
  })
}

# Optional: Manual backup Lambda function for on-demand backups
resource "aws_lambda_function" "manual_backup" {
  count = var.enable_manual_backup ? 1 : 0
  
  filename         = data.archive_file.backup_lambda_zip.output_path
  function_name    = "tolstoy-manual-backup-${var.environment}"
  role            = aws_iam_role.backup_lambda_role.arn
  handler         = "backup.handler"
  runtime         = "nodejs18.x"
  timeout         = 900 # 15 minutes
  memory_size     = 512
  
  source_code_hash = data.archive_file.backup_lambda_zip.output_base64sha256
  
  environment {
    variables = {
      BACKUP_BUCKET = aws_s3_bucket.tolstoy_backups.bucket
      ENVIRONMENT   = var.environment
    }
  }

  depends_on = [
    aws_iam_role_policy.backup_lambda_policy,
    aws_cloudwatch_log_group.backup_lambda_logs,
  ]

  tags = {
    Name        = "tolstoy-manual-backup-${var.environment}"
    Environment = var.environment
    Purpose     = "Manual Database Backup"
  }
}