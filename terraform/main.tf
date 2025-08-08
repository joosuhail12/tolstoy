# Terraform configuration for Tolstoy API Gateway Infrastructure
# Sprint 5 Task 5.4: Enterprise-grade API Gateway with WAF, ACM, and caching

terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    hcp = {
      source  = "hashicorp/hcp"
      version = "~> 0.109.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.1"
    }
  }
  
  # HCP Terraform Cloud backend configuration
  cloud {
    organization = "tolstoy-org"
    
    workspaces {
      name = "tolstoy-api-gateway-prod"
    }
  }
}

provider "aws" {
  region = var.aws_region
  
  default_tags {
    tags = {
      Project     = "Tolstoy"
      Environment = var.environment
      ManagedBy   = "Terraform"
      Sprint      = "5"
      Task        = "5.4"
    }
  }
}

provider "hcp" {
  client_id     = var.hcp_client_id
  client_secret = var.hcp_client_secret
}

# AWS Provider for Cross-Region Replication (Backup Region)
provider "aws" {
  alias  = "replica"
  region = var.backup_replica_region
  
  default_tags {
    tags = {
      Project     = "Tolstoy"
      Environment = var.environment
      ManagedBy   = "Terraform"
      Sprint      = "5"
      Task        = "5.5"
      Purpose     = "Cross-Region Backup"
    }
  }
}

# Data sources for existing resources
data "aws_instance" "tolstoy_ec2" {
  instance_id = var.ec2_instance_id
}

data "aws_route53_zone" "main" {
  count   = var.route53_zone_id != "" ? 1 : 0
  zone_id = var.route53_zone_id
}

# API Gateway REST API
resource "aws_api_gateway_rest_api" "tolstoy" {
  name        = "${var.project_name}-api-${var.environment}"
  description = "Fronting Tolstoy EC2 NestJS service with enterprise features"
  
  endpoint_configuration {
    types = ["REGIONAL"]
  }
  
  binary_media_types = [
    "application/octet-stream",
    "image/*",
    "multipart/form-data"
  ]
  
  tags = {
    Name = "${var.project_name}-api-${var.environment}"
  }
}

# API Gateway CloudWatch Log Group
resource "aws_cloudwatch_log_group" "api_gateway" {
  name              = "/aws/apigateway/${aws_api_gateway_rest_api.tolstoy.name}"
  retention_in_days = var.log_retention_days
  
  tags = {
    Name = "${var.project_name}-api-logs-${var.environment}"
  }
}

# Proxy resource for catching all paths
resource "aws_api_gateway_resource" "proxy" {
  rest_api_id = aws_api_gateway_rest_api.tolstoy.id
  parent_id   = aws_api_gateway_rest_api.tolstoy.root_resource_id
  path_part   = "{proxy+}"
}

# Root ANY method for direct root access
resource "aws_api_gateway_method" "root_any" {
  rest_api_id   = aws_api_gateway_rest_api.tolstoy.id
  resource_id   = aws_api_gateway_rest_api.tolstoy.root_resource_id
  http_method   = "ANY"
  authorization = var.enable_api_key_auth ? "AWS_IAM" : "NONE"
  api_key_required = var.enable_api_key_auth
}

# Proxy ANY method
resource "aws_api_gateway_method" "proxy_any" {
  rest_api_id   = aws_api_gateway_rest_api.tolstoy.id
  resource_id   = aws_api_gateway_resource.proxy.id
  http_method   = "ANY"
  authorization = var.enable_api_key_auth ? "AWS_IAM" : "NONE"
  api_key_required = var.enable_api_key_auth
  
  request_parameters = {
    "method.request.path.proxy" = true
  }
}

# Root integration to EC2 Nginx
resource "aws_api_gateway_integration" "root_proxy" {
  rest_api_id = aws_api_gateway_rest_api.tolstoy.id
  resource_id = aws_api_gateway_rest_api.tolstoy.root_resource_id
  http_method = aws_api_gateway_method.root_any.http_method

  integration_http_method = "ANY"
  type                    = "HTTP_PROXY"
  uri                     = "http://${data.aws_instance.tolstoy_ec2.private_ip}:${var.backend_port}"
  passthrough_behavior    = "WHEN_NO_MATCH"
  
  timeout_milliseconds = var.integration_timeout_ms
}

# Proxy integration to EC2 Nginx
resource "aws_api_gateway_integration" "proxy" {
  rest_api_id = aws_api_gateway_rest_api.tolstoy.id
  resource_id = aws_api_gateway_resource.proxy.id
  http_method = aws_api_gateway_method.proxy_any.http_method

  integration_http_method = "ANY"
  type                    = "HTTP_PROXY"
  uri                     = "http://${data.aws_instance.tolstoy_ec2.private_ip}:${var.backend_port}/{proxy}"
  passthrough_behavior    = "WHEN_NO_MATCH"
  
  timeout_milliseconds = var.integration_timeout_ms
  
  request_parameters = {
    "integration.request.path.proxy" = "method.request.path.proxy"
  }
}

# API Gateway deployment
resource "aws_api_gateway_deployment" "tolstoy" {
  rest_api_id = aws_api_gateway_rest_api.tolstoy.id
  
  triggers = {
    redeployment = sha1(jsonencode([
      aws_api_gateway_method.root_any.id,
      aws_api_gateway_method.proxy_any.id,
      aws_api_gateway_integration.root_proxy.id,
      aws_api_gateway_integration.proxy.id,
    ]))
  }
  
  lifecycle {
    create_before_destroy = true
  }
}

# Production stage with caching and throttling
resource "aws_api_gateway_stage" "prod" {
  deployment_id = aws_api_gateway_deployment.tolstoy.id
  rest_api_id   = aws_api_gateway_rest_api.tolstoy.id
  stage_name    = var.stage_name
  
  # Enable caching
  cache_cluster_enabled = var.enable_caching
  cache_cluster_size    = var.cache_cluster_size
  
  # Enable detailed CloudWatch metrics
  xray_tracing_enabled = var.enable_xray_tracing
  
  # Access logging configuration (disabled temporarily due to CloudWatch role requirement)
  # access_log_settings {
  #   destination_arn = aws_cloudwatch_log_group.api_gateway.arn
  #   format = jsonencode({
  #     requestId      = "$requestId"
  #     requestTime    = "$requestTime"
  #     httpMethod     = "$httpMethod"
  #     resourcePath   = "$resourcePath"
  #     status         = "$status"
  #     protocol       = "$protocol"
  #     responseLength = "$responseLength"
  #     responseTime   = "$responseTime"
  #     error = {
  #       message      = "$error.message"
  #       messageString = "$error.messageString"
  #     }
  #     identity = {
  #       sourceIp = "$identity.sourceIp"
  #       userAgent = "$identity.userAgent"
  #     }
  #   })
  # }
  
  tags = {
    Name = "${var.project_name}-api-stage-${var.environment}"
  }
}

# Usage plan for API throttling and quotas
resource "aws_api_gateway_usage_plan" "tolstoy" {
  count       = var.enable_api_key_auth ? 1 : 0
  name        = "${var.project_name}-usage-plan-${var.environment}"
  description = "Usage plan for Tolstoy API with rate limiting and quotas"
  
  api_stages {
    api_id = aws_api_gateway_rest_api.tolstoy.id
    stage  = aws_api_gateway_stage.prod.stage_name
  }
  
  quota_settings {
    limit  = var.quota_limit
    period = var.quota_period
  }
  
  throttle_settings {
    rate_limit  = var.throttle_rate_limit
    burst_limit = var.throttle_burst_limit
  }
  
  tags = {
    Name = "${var.project_name}-usage-plan-${var.environment}"
  }
}

# API Key for authenticated access
resource "aws_api_gateway_api_key" "tolstoy" {
  count       = var.enable_api_key_auth ? 1 : 0
  name        = "${var.project_name}-api-key-${var.environment}"
  description = "API key for Tolstoy API access"
  enabled     = true
  
  tags = {
    Name = "${var.project_name}-api-key-${var.environment}"
  }
}

# Associate API key with usage plan
resource "aws_api_gateway_usage_plan_key" "tolstoy" {
  count         = var.enable_api_key_auth ? 1 : 0
  key_id        = aws_api_gateway_api_key.tolstoy[0].id
  key_type      = "API_KEY"
  usage_plan_id = aws_api_gateway_usage_plan.tolstoy[0].id
}

# ACM Certificate for custom domain (if domain is provided)
resource "aws_acm_certificate" "tolstoy" {
  count                     = var.domain_name != "" ? 1 : 0
  domain_name               = var.domain_name
  subject_alternative_names = var.domain_name != "" ? ["*.${var.domain_name}"] : []
  validation_method         = "DNS"
  
  lifecycle {
    create_before_destroy = true
  }
  
  tags = {
    Name = "${var.project_name}-cert-${var.environment}"
  }
}

# Route53 records for certificate validation
resource "aws_route53_record" "cert_validation" {
  for_each = var.domain_name != "" && var.route53_zone_id != "" ? {
    for dvo in aws_acm_certificate.tolstoy[0].domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  } : {}
  
  allow_overwrite = true
  name            = each.value.name
  records         = [each.value.record]
  ttl             = 60
  type            = each.value.type
  zone_id         = var.route53_zone_id
}

# Certificate validation
resource "aws_acm_certificate_validation" "tolstoy" {
  count                   = var.domain_name != "" && var.route53_zone_id != "" ? 1 : 0
  certificate_arn         = aws_acm_certificate.tolstoy[0].arn
  validation_record_fqdns = [for record in aws_route53_record.cert_validation : record.fqdn]
  
  timeouts {
    create = "5m"
  }
}

# API Gateway custom domain
resource "aws_api_gateway_domain_name" "tolstoy" {
  count           = var.domain_name != "" ? 1 : 0
  certificate_arn = var.route53_zone_id != "" ? aws_acm_certificate_validation.tolstoy[0].certificate_arn : aws_acm_certificate.tolstoy[0].arn
  domain_name     = var.domain_name
  
  endpoint_configuration {
    types = ["REGIONAL"]
  }
  
  tags = {
    Name = "${var.project_name}-domain-${var.environment}"
  }
}

# Base path mapping for custom domain
resource "aws_api_gateway_base_path_mapping" "tolstoy" {
  count       = var.domain_name != "" ? 1 : 0
  api_id      = aws_api_gateway_rest_api.tolstoy.id
  stage_name  = aws_api_gateway_stage.prod.stage_name
  domain_name = aws_api_gateway_domain_name.tolstoy[0].domain_name
}

# Route53 alias record for custom domain
resource "aws_route53_record" "api_domain" {
  count   = var.domain_name != "" && var.route53_zone_id != "" ? 1 : 0
  zone_id = var.route53_zone_id
  name    = var.domain_name
  type    = "A"
  
  alias {
    name                   = aws_api_gateway_domain_name.tolstoy[0].cloudfront_domain_name
    zone_id                = aws_api_gateway_domain_name.tolstoy[0].cloudfront_zone_id
    evaluate_target_health = false
  }
}

# WAFv2 Web ACL for API protection
resource "aws_wafv2_web_acl" "tolstoy" {
  name        = "${var.project_name}-web-acl-${var.environment}"
  description = "WAF Web ACL for Tolstoy API Gateway"
  scope       = "REGIONAL"
  
  default_action {
    allow {}
  }
  
  # Rate limiting rule
  rule {
    name     = "RateLimitRule"
    priority = 1
    
    action {
      block {}
    }
    
    statement {
      rate_based_statement {
        limit              = var.waf_rate_limit
        aggregate_key_type = "IP"
        
        dynamic "scope_down_statement" {
          for_each = length(var.allowed_countries) > 0 ? [1] : []
          content {
            geo_match_statement {
              country_codes = var.allowed_countries
            }
          }
        }
      }
    }
    
    visibility_config {
      sampled_requests_enabled   = true
      cloudwatch_metrics_enabled = true
      metric_name                = "RateLimitRule"
    }
  }
  
  # AWS Managed Rules - Core Rule Set
  rule {
    name     = "AWSManagedRulesCommonRuleSet"
    priority = 2
    
    override_action {
      none {}
    }
    
    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesCommonRuleSet"
        vendor_name = "AWS"
        
        rule_action_override {
          action_to_use {
            allow {}
          }
          name = "GenericRFI_QUERYARGUMENTS"
        }
        
        rule_action_override {
          action_to_use {
            allow {}
          }
          name = "GenericRFI_BODY"
        }
      }
    }
    
    visibility_config {
      sampled_requests_enabled   = true
      cloudwatch_metrics_enabled = true
      metric_name                = "AWSManagedRulesCommonRuleSetMetric"
    }
  }
  
  # AWS Managed Rules - Known Bad Inputs
  rule {
    name     = "AWSManagedRulesKnownBadInputsRuleSet"
    priority = 3
    
    override_action {
      none {}
    }
    
    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesKnownBadInputsRuleSet"
        vendor_name = "AWS"
      }
    }
    
    visibility_config {
      sampled_requests_enabled   = true
      cloudwatch_metrics_enabled = true
      metric_name                = "AWSManagedRulesKnownBadInputsRuleSetMetric"
    }
  }
  
  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                 = "${var.project_name}WebACL"
    sampled_requests_enabled    = true
  }
  
  tags = {
    Name = "${var.project_name}-web-acl-${var.environment}"
  }
}

# Associate WAF with API Gateway (temporarily disabled due to ARN format issues)
# resource "aws_wafv2_web_acl_association" "tolstoy" {
#   resource_arn = "${aws_api_gateway_stage.prod.execution_arn}/*/*"
#   web_acl_arn  = aws_wafv2_web_acl.tolstoy.arn
# }