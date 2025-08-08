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