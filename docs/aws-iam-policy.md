# AWS IAM Policy for Tolstoy Application

## Overview
This document provides the necessary IAM policies and roles for the Tolstoy application to access AWS Secrets Manager for secure database credential management.

## Required IAM Policy

### Secrets Manager Access Policy
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowSecretsManagerAccess",
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue"
      ],
      "Resource": [
        "arn:aws:secretsmanager:us-east-1:*:secret:tolstoy-db-secret*"
      ]
    }
  ]
}
```

### Policy Details
- **Action**: `secretsmanager:GetSecretValue` - Allows retrieving secret values
- **Resource**: Specific to the `tolstoy-db-secret` in the `us-east-1` region
- **Wildcard**: The `*` at the end allows for automatic version suffixes

## Deployment Scenarios

### 1. EC2 Instance Role (Recommended)
For applications running on EC2:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "ec2.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
```

### 2. ECS Task Role
For containerized applications using ECS:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "ecs-tasks.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
```

### 3. Lambda Execution Role
For serverless deployment:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "lambda.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
```

## Setup Instructions

### Step 1: Create IAM Policy
```bash
# Create policy from JSON file
aws iam create-policy \
  --policy-name TolstoySecretsManagerPolicy \
  --policy-document file://tolstoy-secrets-policy.json \
  --description "Policy for Tolstoy app to access Secrets Manager"
```

### Step 2: Create IAM Role
```bash
# Create role for EC2 (adjust trust policy as needed)
aws iam create-role \
  --role-name TolstoyAppRole \
  --assume-role-policy-document file://trust-policy.json \
  --description "Role for Tolstoy application"
```

### Step 3: Attach Policy to Role
```bash
# Attach the policy to the role
aws iam attach-role-policy \
  --role-name TolstoyAppRole \
  --policy-arn arn:aws:iam::ACCOUNT-ID:policy/TolstoySecretsManagerPolicy
```

### Step 4: Create Instance Profile (For EC2)
```bash
# Create instance profile
aws iam create-instance-profile \
  --instance-profile-name TolstoyInstanceProfile

# Add role to instance profile
aws iam add-role-to-instance-profile \
  --instance-profile-name TolstoyInstanceProfile \
  --role-name TolstoyAppRole
```

## Environment-Specific Configurations

### Development Environment
For local development, use temporary AWS credentials:

```bash
# Option 1: AWS CLI credentials
aws configure

# Option 2: Environment variables
export AWS_ACCESS_KEY_ID=your-access-key-id
export AWS_SECRET_ACCESS_KEY=your-secret-access-key
export AWS_REGION=us-east-1
```

### Production Environment
Use IAM roles instead of hardcoded credentials:

```bash
# Environment variables (no AWS credentials needed)
export AWS_REGION=us-east-1
export USE_AWS_SECRETS=true
# Instance role will automatically provide credentials
```

### Staging/Testing Environment
Consider using cross-account roles for better security:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::STAGING-ACCOUNT:root"
      },
      "Action": "sts:AssumeRole",
      "Condition": {
        "StringEquals": {
          "sts:ExternalId": "unique-external-id"
        }
      }
    }
  ]
}
```

## Security Best Practices

### 1. Least Privilege Principle
- Grant only the minimum permissions required
- Use specific resource ARNs instead of wildcards
- Regularly review and audit IAM policies

### 2. Credential Rotation
```bash
# Rotate secret values regularly
aws secretsmanager rotate-secret \
  --secret-id tolstoy-db-secret \
  --rotation-lambda-arn arn:aws:lambda:region:account:function:SecretsManagerRotation
```

### 3. Monitoring and Logging
- Enable CloudTrail for API call logging
- Monitor Secrets Manager access patterns
- Set up CloudWatch alarms for unusual access

### 4. Network Security
- Use VPC endpoints for Secrets Manager access
- Implement security groups and NACLs
- Consider using AWS PrivateLink

## Troubleshooting Common Issues

### AccessDenied Error
```bash
# Check if role has correct policy attached
aws iam list-attached-role-policies --role-name TolstoyAppRole

# Verify policy permissions
aws iam get-policy-version \
  --policy-arn arn:aws:iam::ACCOUNT-ID:policy/TolstoySecretsManagerPolicy \
  --version-id v1
```

### Credential Provider Error
```bash
# For EC2, check if instance has correct role
aws sts get-caller-identity

# For local development, verify AWS credentials
aws configure list
```

### Secret Not Found
```bash
# Verify secret exists in correct region
aws secretsmanager describe-secret --secret-id tolstoy-db-secret

# List all secrets in region
aws secretsmanager list-secrets
```

## Multi-Region Setup

### Primary Region (us-east-1)
```json
{
  "Resource": "arn:aws:secretsmanager:us-east-1:*:secret:tolstoy-db-secret*"
}
```

### Cross-Region Replication
```bash
# Replicate secret to secondary region
aws secretsmanager replicate-secret-to-regions \
  --secret-id tolstoy-db-secret \
  --add-replica-regions Region=us-west-2,EncryptionKeyId=alias/aws/secretsmanager
```

### Multi-Region Policy
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue"
      ],
      "Resource": [
        "arn:aws:secretsmanager:us-east-1:*:secret:tolstoy-db-secret*",
        "arn:aws:secretsmanager:us-west-2:*:secret:tolstoy-db-secret*"
      ]
    }
  ]
}
```

## Cost Optimization

### Secrets Manager Pricing
- $0.40 per secret per month
- $0.05 per 10,000 API calls
- Consider secret sharing for multiple environments

### Best Practices for Cost
- Minimize API calls by caching credentials
- Use single secret for multiple database URLs
- Implement proper error handling to avoid retry storms

---

**Note**: Replace `ACCOUNT-ID` with your actual AWS account ID and adjust regions as needed for your deployment.