# AWS IAM Permissions for Secrets Manager

This document outlines the required IAM permissions for the Tolstoy application to fully utilize AWS Secrets Manager for secrets management.

## 🔐 Required IAM Policy

Create the following IAM policy and attach it to your EC2 instance role or user:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue",
        "secretsmanager:DescribeSecret"
      ],
      "Resource": [
        "arn:aws:secretsmanager:us-east-1:*:secret:conductor-db-secret-*",
        "arn:aws:secretsmanager:us-east-1:*:secret:tolstoy/*"
      ],
      "Condition": {
        "StringEquals": {
          "aws:RequestedRegion": "us-east-1"
        }
      }
    },
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:PutSecretValue",
        "secretsmanager:CreateSecret",
        "secretsmanager:UpdateSecret",
        "secretsmanager:TagResource"
      ],
      "Resource": [
        "arn:aws:secretsmanager:us-east-1:*:secret:tolstoy/*"
      ],
      "Condition": {
        "StringEquals": {
          "aws:RequestedRegion": "us-east-1"
        }
      }
    },
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:ListSecrets"
      ],
      "Resource": "*",
      "Condition": {
        "StringEquals": {
          "aws:RequestedRegion": "us-east-1"
        }
      }
    }
  ]
}
```

## 🏷️ Permission Breakdown

### Read Permissions (Required for app to start)
- `secretsmanager:GetSecretValue` - Retrieve secret values
- `secretsmanager:DescribeSecret` - Check if secrets exist

**Resources:**
- `conductor-db-secret` - Database connection credentials
- `tolstoy/*` - All tool-specific secrets

### Write Permissions (Required for OAuth token refresh)
- `secretsmanager:PutSecretValue` - Update existing secret values
- `secretsmanager:CreateSecret` - Create new secrets for tools
- `secretsmanager:UpdateSecret` - Modify secret metadata
- `secretsmanager:TagResource` - Add tags for organization

**Resources:**
- `tolstoy/*` - Tool-specific secrets only (not database secrets)

### List Permissions (Optional)
- `secretsmanager:ListSecrets` - List available secrets for debugging

## 🔧 Current Setup (Root User)

Since you're using the root user, all permissions are already available. No additional IAM configuration is needed.

## 🏗️ For Production (Recommended Setup)

### 1. Create IAM Role for EC2

```bash
# Create IAM role
aws iam create-role \
  --role-name TolstoySecretsManagerRole \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [
      {
        "Effect": "Allow",
        "Principal": {"Service": "ec2.amazonaws.com"},
        "Action": "sts:AssumeRole"
      }
    ]
  }'

# Create and attach policy
aws iam create-policy \
  --policy-name TolstoySecretsManagerPolicy \
  --policy-document file://tolstoy-secrets-policy.json

aws iam attach-role-policy \
  --role-name TolstoySecretsManagerRole \
  --policy-arn arn:aws:iam::YOUR_ACCOUNT_ID:policy/TolstoySecretsManagerPolicy

# Create instance profile
aws iam create-instance-profile \
  --instance-profile-name TolstoySecretsManagerProfile

aws iam add-role-to-instance-profile \
  --instance-profile-name TolstoySecretsManagerProfile \
  --role-name TolstoySecretsManagerRole
```

### 2. Attach to EC2 Instance

```bash
aws ec2 associate-iam-instance-profile \
  --instance-id i-0ea0ff0e9a8db29d4 \
  --iam-instance-profile Name=TolstoySecretsManagerProfile
```

## 🔍 Testing Permissions

Test the permissions with these commands on your EC2 instance:

```bash
# Test read access (should work)
aws secretsmanager get-secret-value \
  --secret-id conductor-db-secret \
  --region us-east-1

# Test write access (should work for root user)
aws secretsmanager put-secret-value \
  --secret-id tolstoy/test/org123 \
  --secret-string '{"test": "value"}' \
  --region us-east-1

# Test list access
aws secretsmanager list-secrets \
  --region us-east-1 \
  --filters Key=name,Values=tolstoy/
```

## 🚨 Security Best Practices

1. **Least Privilege**: Only grant permissions needed for the application
2. **Resource Restrictions**: Limit access to specific secret ARNs
3. **Regional Restrictions**: Use condition to limit to us-east-1
4. **Audit Logging**: Enable CloudTrail for secrets access monitoring
5. **Rotation**: Implement automatic secret rotation for sensitive credentials

## 🔄 Secret Naming Convention

The application uses this naming pattern:
```
tolstoy/{tool-name}/{org-id}
```

Examples:
- `tolstoy/github/org-abc123` - GitHub OAuth tokens for organization abc123
- `tolstoy/slack/org-def456` - Slack API credentials for organization def456
- `tolstoy/google/org-ghi789` - Google OAuth tokens for organization ghi789

This allows for granular permissions per organization if needed.