#!/bin/bash

# AWS Account configuration
AWS_REGION="us-east-1"
AWS_ACCOUNT_ID="YOUR_AWS_ACCOUNT_ID"  # Replace with your AWS account ID
ECR_REPOSITORY="tolstoy-api"
IMAGE_TAG="latest"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Starting Docker build and ECR push process...${NC}"

# Check if AWS Account ID is set
if [ "$AWS_ACCOUNT_ID" == "YOUR_AWS_ACCOUNT_ID" ]; then
    echo -e "${RED}Error: Please update AWS_ACCOUNT_ID in this script with your actual AWS account ID${NC}"
    exit 1
fi

# Build Docker image
echo -e "${GREEN}Building Docker image...${NC}"
docker build -t $ECR_REPOSITORY:$IMAGE_TAG .

if [ $? -ne 0 ]; then
    echo -e "${RED}Docker build failed${NC}"
    exit 1
fi

# Get ECR login token and login to Docker
echo -e "${GREEN}Logging into ECR...${NC}"
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com

if [ $? -ne 0 ]; then
    echo -e "${RED}ECR login failed${NC}"
    exit 1
fi

# Create ECR repository if it doesn't exist
echo -e "${GREEN}Creating ECR repository if it doesn't exist...${NC}"
aws ecr describe-repositories --repository-names $ECR_REPOSITORY --region $AWS_REGION 2>/dev/null

if [ $? -ne 0 ]; then
    echo -e "${YELLOW}Repository doesn't exist. Creating...${NC}"
    aws ecr create-repository --repository-name $ECR_REPOSITORY --region $AWS_REGION
fi

# Tag the image for ECR
echo -e "${GREEN}Tagging image for ECR...${NC}"
docker tag $ECR_REPOSITORY:$IMAGE_TAG $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPOSITORY:$IMAGE_TAG

# Push image to ECR
echo -e "${GREEN}Pushing image to ECR...${NC}"
docker push $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPOSITORY:$IMAGE_TAG

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Successfully pushed image to ECR!${NC}"
    echo -e "${GREEN}Image URI: $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPOSITORY:$IMAGE_TAG${NC}"
else
    echo -e "${RED}Failed to push image to ECR${NC}"
    exit 1
fi