# AWS App Runner & API Gateway Deployment Guide

## Prerequisites
- AWS CLI configured with appropriate credentials
- Docker installed on your local machine
- AWS account with permissions for ECR, App Runner, and API Gateway

## Step 1: Build and Push Docker Image to ECR

### 1.1 Update the deployment script
Edit `scripts/deploy-to-ecr.sh` and replace `YOUR_AWS_ACCOUNT_ID` with your actual AWS account ID.

### 1.2 Build and push the Docker image
```bash
# Make the script executable (if not already)
chmod +x scripts/deploy-to-ecr.sh

# Run the deployment script
./scripts/deploy-to-ecr.sh
```

### 1.3 Manual ECR push (alternative method)
```bash
# Set your AWS account ID
export AWS_ACCOUNT_ID=<your-account-id>
export AWS_REGION=us-east-1

# Build the Docker image
docker build -t tolstoy-api .

# Login to ECR
aws ecr get-login-password --region $AWS_REGION | \
  docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com

# Create ECR repository (if not exists)
aws ecr create-repository --repository-name tolstoy-api --region $AWS_REGION

# Tag the image
docker tag tolstoy-api:latest $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/tolstoy-api:latest

# Push to ECR
docker push $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/tolstoy-api:latest
```

## Step 2: Create AWS App Runner Service

### 2.1 Via AWS Console
1. Navigate to [AWS App Runner Console](https://console.aws.amazon.com/apprunner)
2. Click **Create service**
3. Configure source:
   - **Source**: Container registry
   - **Provider**: Amazon ECR
   - **Repository**: Select `tolstoy-api`
   - **Image tag**: `latest`
   - **Deployment trigger**: Automatic or Manual

4. Configure service:
   - **Service name**: `tolstoy-api-service`
   - **CPU**: 1 vCPU
   - **Memory**: 2 GB
   - **Environment variables**:
     ```
     NODE_ENV=production
     PORT=3000
     AWS_REGION=us-east-1
     AWS_SECRET_NAME=tolstoy/env
     USE_AWS_SECRETS=true
     ```

5. Configure auto-scaling:
   - **Min size**: 1
   - **Max size**: 3
   - **Target CPU utilization**: 70%

6. Configure health check:
   - **Protocol**: HTTP
   - **Path**: `/health`
   - **Interval**: 10 seconds
   - **Timeout**: 5 seconds
   - **Healthy threshold**: 1
   - **Unhealthy threshold**: 3

7. Review and create the service

### 2.2 Via AWS CLI
```bash
# Create App Runner service configuration
cat > apprunner-config.json << EOF
{
  "ServiceName": "tolstoy-api-service",
  "SourceConfiguration": {
    "ImageRepository": {
      "ImageIdentifier": "$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/tolstoy-api:latest",
      "ImageConfiguration": {
        "Port": "3000",
        "RuntimeEnvironmentVariables": {
          "NODE_ENV": "production",
          "AWS_REGION": "us-east-1",
          "AWS_SECRET_NAME": "tolstoy/env",
          "USE_AWS_SECRETS": "true"
        }
      },
      "ImageRepositoryType": "ECR"
    },
    "AutoDeploymentsEnabled": true
  },
  "InstanceConfiguration": {
    "Cpu": "1 vCPU",
    "Memory": "2 GB"
  },
  "HealthCheckConfiguration": {
    "Protocol": "HTTP",
    "Path": "/health",
    "Interval": 10,
    "Timeout": 5,
    "HealthyThreshold": 1,
    "UnhealthyThreshold": 3
  }
}
EOF

# Create the App Runner service
aws apprunner create-service --cli-input-json file://apprunner-config.json
```

### 2.3 Note the App Runner URL
After creation, note down your App Runner service URL:
```
https://<service-id>.us-east-1.awsapprunner.com
```

## Step 3: Set Up AWS API Gateway

### 3.1 Via AWS Console
1. Navigate to [API Gateway Console](https://console.aws.amazon.com/apigateway)
2. Click **Create API**
3. Choose **HTTP API** and click **Build**
4. Configure integrations:
   - **Integration type**: HTTP
   - **Integration URL**: Your App Runner URL from Step 2.3
   - **API name**: `tolstoy-api-gateway`

5. Configure routes:
   - **Resource path**: `$default`
   - **Method**: ANY
   - **Integration target**: Select your integration

6. Configure stages:
   - **Stage name**: `prod`
   - **Auto-deploy**: Enabled

7. Review and create

### 3.2 Via AWS CLI
```bash
# Create HTTP API
aws apigatewayv2 create-api \
  --name tolstoy-api-gateway \
  --protocol-type HTTP \
  --target https://<your-app-runner-url>.us-east-1.awsapprunner.com

# Note the API ID from the response
export API_ID=<api-id-from-response>

# Get the API endpoint
aws apigatewayv2 get-api --api-id $API_ID --query ApiEndpoint --output text
```

## Step 4: Configure IAM Roles and Permissions

### 4.1 App Runner Service Role
Ensure your App Runner service has the necessary permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ecr:GetAuthorizationToken",
        "ecr:BatchCheckLayerAvailability",
        "ecr:GetDownloadUrlForLayer",
        "ecr:BatchGetImage"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue"
      ],
      "Resource": "arn:aws:secretsmanager:us-east-1:*:secret:tolstoy/env*"
    }
  ]
}
```

## Step 5: Verification

### 5.1 Test App Runner directly
```bash
# Test health endpoint
curl https://<your-app-runner-url>.us-east-1.awsapprunner.com/health

# Test organizations endpoint
curl https://<your-app-runner-url>.us-east-1.awsapprunner.com/organizations
```

### 5.2 Test via API Gateway
```bash
# Test health endpoint through API Gateway
curl https://<api-gateway-id>.execute-api.us-east-1.amazonaws.com/health

# Test organizations endpoint
curl https://<api-gateway-id>.execute-api.us-east-1.amazonaws.com/organizations
```

## Step 6: Monitoring and Logs

### 6.1 View App Runner logs
```bash
# Get service ARN
aws apprunner list-services --query "ServiceSummaryList[?ServiceName=='tolstoy-api-service'].ServiceArn" --output text

# View logs in CloudWatch
# Logs are available in CloudWatch under:
# /aws/apprunner/<service-name>/<service-id>/application
```

### 6.2 View API Gateway logs
Enable logging in API Gateway:
```bash
aws apigatewayv2 update-stage \
  --api-id $API_ID \
  --stage-name prod \
  --access-log-settings '{"DestinationArn":"arn:aws:logs:us-east-1:<account-id>:log-group:/aws/apigateway/tolstoy-api","Format":"$context.requestId"}'
```

## Troubleshooting

### Common Issues and Solutions

1. **App Runner fails to pull image from ECR**
   - Ensure App Runner has ECR permissions
   - Verify the image exists in ECR
   - Check the image URI is correct

2. **Health check failures**
   - Verify the `/health` endpoint returns 200 status
   - Check application logs for startup errors
   - Ensure database connection via Secrets Manager works

3. **API Gateway 502 errors**
   - Verify App Runner service is running
   - Check the integration URL is correct
   - Ensure security groups allow traffic

4. **Database connection issues**
   - Verify Secrets Manager permissions
   - Check the secret contains correct database URLs
   - Ensure App Runner can access Secrets Manager

## Security Best Practices

1. **Use IAM roles** instead of access keys
2. **Enable VPC connector** for App Runner to access private resources
3. **Configure WAF** on API Gateway for protection
4. **Enable CloudTrail** for audit logging
5. **Use custom domains** with SSL certificates
6. **Implement rate limiting** on API Gateway

## Cost Optimization

1. **App Runner pricing**:
   - $0.007 per vCPU-hour
   - $0.0014 per GB-hour
   - Configure auto-scaling appropriately

2. **API Gateway pricing**:
   - $1.00 per million requests (first 333 million)
   - Consider caching for frequently accessed data

3. **ECR pricing**:
   - $0.10 per GB-month for storage
   - Implement lifecycle policies to remove old images

## Next Steps

After completing this deployment:

1. Set up custom domain names
2. Configure monitoring and alerting
3. Implement CI/CD with GitHub Actions (Task 7)
4. Automate infrastructure with AWS CDK (Task 7)
5. Add comprehensive logging and tracing

---

**Note**: Replace placeholder values (AWS account ID, URLs, etc.) with your actual values.