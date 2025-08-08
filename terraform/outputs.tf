# Terraform Outputs for Tolstoy API Gateway Infrastructure
# Sprint 5 Task 5.4: Enterprise-grade API Gateway with WAF, ACM, and caching

# API Gateway Outputs
output "api_gateway_rest_api_id" {
  description = "ID of the API Gateway REST API"
  value       = aws_api_gateway_rest_api.tolstoy.id
}

output "api_gateway_rest_api_name" {
  description = "Name of the API Gateway REST API"
  value       = aws_api_gateway_rest_api.tolstoy.name
}

output "api_gateway_execution_arn" {
  description = "Execution ARN of the API Gateway"
  value       = aws_api_gateway_rest_api.tolstoy.execution_arn
}

output "api_gateway_invoke_url" {
  description = "Default invoke URL for the API Gateway"
  value       = aws_api_gateway_stage.prod.invoke_url
}

output "api_gateway_stage_name" {
  description = "Name of the API Gateway stage"
  value       = aws_api_gateway_stage.prod.stage_name
}

# Custom Domain Outputs
output "api_gateway_domain_name" {
  description = "Custom domain name for the API Gateway (if configured)"
  value       = var.domain_name != "" ? aws_api_gateway_domain_name.tolstoy[0].domain_name : null
}

output "api_gateway_domain_cloudfront_domain" {
  description = "CloudFront domain name for the API Gateway custom domain"
  value       = var.domain_name != "" ? aws_api_gateway_domain_name.tolstoy[0].cloudfront_domain_name : null
}

output "api_gateway_url" {
  description = "Primary API URL (custom domain if available, otherwise default invoke URL)"
  value       = var.domain_name != "" ? "https://${aws_api_gateway_domain_name.tolstoy[0].domain_name}" : aws_api_gateway_stage.prod.invoke_url
}

# Certificate Outputs
output "acm_certificate_arn" {
  description = "ARN of the ACM certificate"
  value       = var.domain_name != "" ? aws_acm_certificate.tolstoy[0].arn : null
  sensitive   = false
}

output "acm_certificate_status" {
  description = "Status of the ACM certificate"
  value       = var.domain_name != "" ? aws_acm_certificate.tolstoy[0].status : null
}

# API Key Outputs (when enabled)
output "api_key_id" {
  description = "ID of the API Gateway API Key"
  value       = var.enable_api_key_auth ? aws_api_gateway_api_key.tolstoy[0].id : null
}

output "api_key_value" {
  description = "Value of the API Gateway API Key"
  value       = var.enable_api_key_auth ? aws_api_gateway_api_key.tolstoy[0].value : null
  sensitive   = true
}

output "usage_plan_id" {
  description = "ID of the API Gateway Usage Plan"
  value       = var.enable_api_key_auth ? aws_api_gateway_usage_plan.tolstoy[0].id : null
}

# WAF Outputs
output "waf_web_acl_arn" {
  description = "ARN of the WAFv2 Web ACL"
  value       = aws_wafv2_web_acl.tolstoy.arn
}

output "waf_web_acl_id" {
  description = "ID of the WAFv2 Web ACL"
  value       = aws_wafv2_web_acl.tolstoy.id
}

output "waf_web_acl_name" {
  description = "Name of the WAFv2 Web ACL"
  value       = aws_wafv2_web_acl.tolstoy.name
}

# CloudWatch Outputs
output "api_gateway_log_group_name" {
  description = "Name of the API Gateway CloudWatch log group"
  value       = aws_cloudwatch_log_group.api_gateway.name
}

output "api_gateway_log_group_arn" {
  description = "ARN of the API Gateway CloudWatch log group"
  value       = aws_cloudwatch_log_group.api_gateway.arn
}

# Backend Configuration Outputs
output "backend_ec2_instance_id" {
  description = "ID of the backend EC2 instance"
  value       = var.ec2_instance_id
}

output "backend_private_ip" {
  description = "Private IP of the backend EC2 instance"
  value       = data.aws_instance.tolstoy_ec2.private_ip
}

output "backend_public_ip" {
  description = "Public IP of the backend EC2 instance"
  value       = data.aws_instance.tolstoy_ec2.public_ip
}

# Configuration Summary
output "configuration_summary" {
  description = "Summary of the API Gateway configuration"
  value = {
    project_name     = var.project_name
    environment      = var.environment
    stage_name       = var.stage_name
    caching_enabled  = var.enable_caching
    cache_size_gb    = var.cache_cluster_size
    rate_limit_rps   = var.throttle_rate_limit
    burst_limit      = var.throttle_burst_limit
    waf_rate_limit   = var.waf_rate_limit
    domain_configured = var.domain_name != ""
    api_key_auth     = var.enable_api_key_auth
    xray_tracing     = var.enable_xray_tracing
  }
}

# Testing and Validation Outputs
output "curl_test_command" {
  description = "cURL command to test the API"
  value = var.domain_name != "" ? (
    var.enable_api_key_auth ? 
    "curl -H 'X-API-Key: <API_KEY>' https://${aws_api_gateway_domain_name.tolstoy[0].domain_name}/health" :
    "curl https://${aws_api_gateway_domain_name.tolstoy[0].domain_name}/health"
  ) : (
    var.enable_api_key_auth ?
    "curl -H 'X-API-Key: <API_KEY>' ${aws_api_gateway_stage.prod.invoke_url}/health" :
    "curl ${aws_api_gateway_stage.prod.invoke_url}/health"
  )
}

output "health_check_urls" {
  description = "URLs for health checking the API"
  value = {
    api_gateway_url = var.domain_name != "" ? "https://${aws_api_gateway_domain_name.tolstoy[0].domain_name}/status" : "${aws_api_gateway_stage.prod.invoke_url}/status"
    backend_url     = "http://${data.aws_instance.tolstoy_ec2.public_ip}/status"
  }
}

# Monitoring URLs
output "monitoring_urls" {
  description = "CloudWatch monitoring URLs"
  value = {
    api_gateway_metrics = "https://${var.aws_region}.console.aws.amazon.com/cloudwatch/home?region=${var.aws_region}#metricsV2:graph=~();query=AWS%2FApiGateway;sort=~"
    waf_metrics        = "https://${var.aws_region}.console.aws.amazon.com/cloudwatch/home?region=${var.aws_region}#metricsV2:graph=~();query=AWS%2FWAFV2;sort=~"
    api_gateway_logs   = "https://${var.aws_region}.console.aws.amazon.com/cloudwatch/home?region=${var.aws_region}#logsV2:log-groups/log-group/${replace(aws_cloudwatch_log_group.api_gateway.name, "/", "$252F")}"
  }
}

# Route53 Configuration (if applicable)
output "route53_record_name" {
  description = "Route53 record name for the custom domain"
  value       = var.domain_name != "" && var.route53_zone_id != "" ? aws_route53_record.api_domain[0].name : null
}

output "route53_zone_name" {
  description = "Route53 hosted zone name"
  value       = var.route53_zone_id != "" ? data.aws_route53_zone.main[0].name : null
}

# HCP Resource Outputs
output "hcp_project_id" {
  description = "HCP Project ID"
  value       = hcp_project.tolstoy.resource_id
}

output "hcp_project_name" {
  description = "HCP Project name"
  value       = hcp_project.tolstoy.name
}

output "hcp_organization_id" {
  description = "HCP Organization ID"
  value       = data.hcp_organization.main.resource_id
}

output "hcp_vault_cluster_id" {
  description = "HCP Vault Cluster ID (if created)"
  value       = var.create_hcp_vault ? hcp_vault_cluster.tolstoy[0].cluster_id : null
}

output "hcp_vault_public_endpoint" {
  description = "HCP Vault public endpoint URL (if created)"
  value       = var.create_hcp_vault ? hcp_vault_cluster.tolstoy[0].vault_public_endpoint_url : null
}

# output "hcp_consul_cluster_id" {
#   description = "HCP Consul Cluster ID (if created)"
#   value       = var.create_hcp_consul ? hcp_consul_cluster.tolstoy[0].cluster_id : null
# }

# output "hcp_consul_public_endpoint" {
#   description = "HCP Consul public endpoint URL (if created)"
#   value       = var.create_hcp_consul ? hcp_consul_cluster.tolstoy[0].consul_public_endpoint_url : null
# }

output "hcp_hvn_id" {
  description = "HCP HVN ID (if created)"
  value       = var.create_hcp_hvn ? hcp_hvn.main[0].hvn_id : null
}

output "hcp_boundary_cluster_id" {
  description = "HCP Boundary Cluster ID (if created)"
  value       = var.create_hcp_boundary ? hcp_boundary_cluster.tolstoy[0].cluster_id : null
}

# output "hcp_packer_registry_name" {
#   description = "HCP Packer Registry name (if created)"
#   value       = var.create_hcp_packer_registry ? hcp_packer_registry.tolstoy[0].name : null
# }

# output "hcp_waypoint_application_name" {
#   description = "HCP Waypoint Application name (if created)"
#   value       = var.create_hcp_waypoint ? hcp_waypoint_application.tolstoy_api[0].name : null
# }

# output "hcp_service_principal" {
#   description = "HCP Service Principal resource name"
#   value       = data.hcp_service_principal.tolstoy.resource_name
# }

# HCP Console URLs
output "hcp_console_urls" {
  description = "HCP Console URLs for monitoring"
  value = {
    project     = "https://portal.cloud.hashicorp.com/project/${hcp_project.tolstoy.resource_id}"
    vault       = var.create_hcp_vault ? "https://portal.cloud.hashicorp.com/vault/clusters/${hcp_vault_cluster.tolstoy[0].cluster_id}" : null
    boundary    = var.create_hcp_boundary ? "https://portal.cloud.hashicorp.com/boundary/clusters/${hcp_boundary_cluster.tolstoy[0].cluster_id}" : null
    hvn         = var.create_hcp_hvn ? "https://portal.cloud.hashicorp.com/network/${hcp_hvn.main[0].hvn_id}" : null
  }
}

# Backup Infrastructure Outputs
output "backup_bucket_name" {
  description = "Name of the S3 bucket used for database backups"
  value       = aws_s3_bucket.tolstoy_backups.bucket
}

output "backup_bucket_arn" {
  description = "ARN of the S3 bucket used for database backups"
  value       = aws_s3_bucket.tolstoy_backups.arn
}

output "backup_kms_key_id" {
  description = "KMS Key ID used for backup encryption"
  value       = aws_kms_key.backup_key.key_id
}

output "backup_kms_key_arn" {
  description = "KMS Key ARN used for backup encryption"
  value       = aws_kms_key.backup_key.arn
}

output "backup_lambda_function_name" {
  description = "Name of the backup Lambda function"
  value       = aws_lambda_function.backup.function_name
}

output "backup_lambda_function_arn" {
  description = "ARN of the backup Lambda function"
  value       = aws_lambda_function.backup.arn
}

output "manual_backup_lambda_function_name" {
  description = "Name of the manual backup Lambda function"
  value       = var.enable_manual_backup ? aws_lambda_function.manual_backup[0].function_name : null
}

output "backup_schedule_expression" {
  description = "EventBridge schedule expression for automated backups"
  value       = aws_cloudwatch_event_rule.daily_backup.schedule_expression
}

output "backup_notification_topic_arn" {
  description = "SNS topic ARN for backup notifications"
  value       = aws_sns_topic.backup_notifications.arn
}

output "backup_cloudwatch_log_group" {
  description = "CloudWatch log group name for backup Lambda"
  value       = aws_cloudwatch_log_group.backup_lambda_logs.name
}

output "backup_dashboard_url" {
  description = "CloudWatch dashboard URL for backup monitoring"
  value       = "https://${var.aws_region}.console.aws.amazon.com/cloudwatch/home?region=${var.aws_region}#dashboards:name=${aws_cloudwatch_dashboard.backup_dashboard.dashboard_name}"
}

# Cross-Region Backup Outputs
output "backup_replica_bucket_name" {
  description = "Name of the cross-region backup replica bucket"
  value       = var.enable_cross_region_backup ? aws_s3_bucket.tolstoy_backups_replica[0].bucket : null
}

output "backup_replica_bucket_arn" {
  description = "ARN of the cross-region backup replica bucket"
  value       = var.enable_cross_region_backup ? aws_s3_bucket.tolstoy_backups_replica[0].arn : null
}

# State Management Outputs
output "state_backup_bucket_name" {
  description = "Name of the Terraform state backup S3 bucket"
  value       = var.enable_state_backup ? aws_s3_bucket.tfstate_backup[0].bucket : null
}

output "state_backup_bucket_arn" {
  description = "ARN of the Terraform state backup S3 bucket"
  value       = var.enable_state_backup ? aws_s3_bucket.tfstate_backup[0].arn : null
}

output "state_lock_table_name" {
  description = "Name of the DynamoDB table for Terraform state locking"
  value       = var.enable_state_backup ? aws_dynamodb_table.terraform_lock[0].name : null
}

output "state_lock_table_arn" {
  description = "ARN of the DynamoDB table for Terraform state locking"
  value       = var.enable_state_backup ? aws_dynamodb_table.terraform_lock[0].arn : null
}

# Disaster Recovery URLs and Commands
output "dr_quick_reference" {
  description = "Quick reference for disaster recovery operations"
  value = {
    backup_list_command = "aws s3 ls s3://${aws_s3_bucket.tolstoy_backups.bucket}/backups/ --human-readable"
    manual_backup_command = var.enable_manual_backup ? "aws lambda invoke --function-name ${aws_lambda_function.manual_backup[0].function_name} response.json" : "Manual backup not enabled"
    dashboard_url = "https://${var.aws_region}.console.aws.amazon.com/cloudwatch/home?region=${var.aws_region}#dashboards:name=${aws_cloudwatch_dashboard.backup_dashboard.dashboard_name}"
    runbook_location = "docs/dr/runbook.mdx"
    secrets_locations = ["tolstoy/env", "conductor-db-secret"]
    rto_target = "4 hours"
    rpo_target = "24 hours"
  }
}

# Backup Configuration Summary
output "backup_configuration_summary" {
  description = "Summary of backup configuration and settings"
  value = {
    schedule = var.backup_schedule
    retention_days = var.backup_retention_days
    cross_region_enabled = var.enable_cross_region_backup
    replica_region = var.backup_replica_region
    manual_backup_enabled = var.enable_manual_backup
    notifications_enabled = var.enable_backup_notifications
    state_backup_enabled = var.enable_state_backup
    encryption_key_arn = aws_kms_key.backup_key.arn
    lambda_timeout_seconds = aws_lambda_function.backup.timeout
    lambda_memory_mb = aws_lambda_function.backup.memory_size
  }
}