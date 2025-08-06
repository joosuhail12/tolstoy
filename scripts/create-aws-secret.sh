#!/bin/bash

# Script to create AWS Secrets Manager secret for Tolstoy database

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
SECRET_NAME="tolstoy-db-secret"
REGION="us-east-1"

echo -e "${YELLOW}Creating AWS Secrets Manager secret for Tolstoy...${NC}"

# Read DATABASE_URL from .env file
if [ -f ".env" ]; then
  DATABASE_URL=$(grep -E '^DATABASE_URL=' .env | cut -d'=' -f2- | tr -d '"')
  DIRECT_URL=$(grep -E '^DIRECT_URL=' .env | cut -d'=' -f2- | tr -d '"')
else
  echo -e "${RED}Error: .env file not found!${NC}"
  echo -e "${YELLOW}Please provide DATABASE_URL manually:${NC}"
  read -p "DATABASE_URL: " DATABASE_URL
  read -p "DIRECT_URL: " DIRECT_URL
fi

if [ -z "$DATABASE_URL" ]; then
  echo -e "${RED}Error: DATABASE_URL is required!${NC}"
  exit 1
fi

# Create secret JSON
SECRET_VALUE=$(cat <<EOF
{
  "DATABASE_URL": "$DATABASE_URL",
  "DIRECT_URL": "$DIRECT_URL"
}
EOF
)

echo -e "${GREEN}Creating secret: $SECRET_NAME${NC}"

# Check if secret already exists
if aws secretsmanager describe-secret --secret-id "$SECRET_NAME" --region "$REGION" >/dev/null 2>&1; then
  echo -e "${YELLOW}Secret already exists. Updating...${NC}"
  aws secretsmanager update-secret \
    --secret-id "$SECRET_NAME" \
    --secret-string "$SECRET_VALUE" \
    --region "$REGION"
else
  echo -e "${GREEN}Creating new secret...${NC}"
  aws secretsmanager create-secret \
    --name "$SECRET_NAME" \
    --description "Database credentials for Tolstoy NestJS application" \
    --secret-string "$SECRET_VALUE" \
    --region "$REGION"
fi

if [ $? -eq 0 ]; then
  echo -e "${GREEN}✅ Secret created/updated successfully!${NC}"
  echo -e "${GREEN}Secret Name: $SECRET_NAME${NC}"
  echo -e "${GREEN}Region: $REGION${NC}"
  
  # Create IAM policy for EC2 to access this secret
  echo -e "${GREEN}Creating IAM policy document...${NC}"
  cat > tolstoy-secrets-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue"
      ],
      "Resource": "arn:aws:secretsmanager:$REGION:*:secret:$SECRET_NAME*"
    }
  ]
}
EOF

  echo -e "${GREEN}IAM Policy saved to: tolstoy-secrets-policy.json${NC}"
  echo -e "${YELLOW}Next steps:${NC}"
  echo -e "1. Create IAM role for EC2 with this policy"
  echo -e "2. Attach the role to your EC2 instance"
  echo -e "3. The application will automatically use AWS Secrets Manager"
  
else
  echo -e "${RED}❌ Failed to create secret!${NC}"
  exit 1
fi