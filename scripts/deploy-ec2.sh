#!/bin/bash

# AWS EC2 Deployment Script for Tolstoy NestJS Application
# Ubuntu 22.04 LTS, Node.js v20, PM2, Nginx

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
INSTANCE_TYPE="t3.medium"
AMI_ID="ami-021589336d307b577"  # Ubuntu 22.04 LTS in us-east-1
KEY_PAIR_NAME="tolstoy-key-pair"
SECURITY_GROUP_NAME="tolstoy-sg"
INSTANCE_NAME="tolstoy-ec2"
REGION="us-east-1"

echo -e "${YELLOW}Starting AWS EC2 deployment for Tolstoy...${NC}"

# Step 1: Create Security Group
echo -e "${GREEN}Creating security group...${NC}"
SECURITY_GROUP_ID=$(aws ec2 create-security-group \
  --group-name $SECURITY_GROUP_NAME \
  --description "Security group for Tolstoy NestJS application" \
  --region $REGION \
  --query 'GroupId' \
  --output text 2>/dev/null)

if [ $? -ne 0 ]; then
  echo -e "${RED}Security group might already exist, trying to get existing one...${NC}"
  SECURITY_GROUP_ID=$(aws ec2 describe-security-groups \
    --group-names $SECURITY_GROUP_NAME \
    --region $REGION \
    --query 'SecurityGroups[0].GroupId' \
    --output text 2>/dev/null)
fi

echo -e "${GREEN}Security Group ID: $SECURITY_GROUP_ID${NC}"

# Step 2: Configure Security Group Rules
echo -e "${GREEN}Configuring security group rules...${NC}"
aws ec2 authorize-security-group-ingress \
  --group-id $SECURITY_GROUP_ID \
  --protocol tcp \
  --port 22 \
  --cidr 0.0.0.0/0 \
  --region $REGION 2>/dev/null

aws ec2 authorize-security-group-ingress \
  --group-id $SECURITY_GROUP_ID \
  --protocol tcp \
  --port 80 \
  --cidr 0.0.0.0/0 \
  --region $REGION 2>/dev/null

aws ec2 authorize-security-group-ingress \
  --group-id $SECURITY_GROUP_ID \
  --protocol tcp \
  --port 443 \
  --cidr 0.0.0.0/0 \
  --region $REGION 2>/dev/null

# Step 3: Create Key Pair (if not exists)
echo -e "${GREEN}Creating key pair...${NC}"
if ! aws ec2 describe-key-pairs --key-names $KEY_PAIR_NAME --region $REGION >/dev/null 2>&1; then
  aws ec2 create-key-pair \
    --key-name $KEY_PAIR_NAME \
    --region $REGION \
    --query 'KeyMaterial' \
    --output text > ${KEY_PAIR_NAME}.pem
  chmod 400 ${KEY_PAIR_NAME}.pem
  echo -e "${GREEN}Key pair created: ${KEY_PAIR_NAME}.pem${NC}"
else
  echo -e "${YELLOW}Key pair already exists: $KEY_PAIR_NAME${NC}"
fi

# Step 4: Launch EC2 Instance
echo -e "${GREEN}Launching EC2 instance...${NC}"
INSTANCE_ID=$(aws ec2 run-instances \
  --image-id $AMI_ID \
  --count 1 \
  --instance-type $INSTANCE_TYPE \
  --key-name $KEY_PAIR_NAME \
  --security-group-ids $SECURITY_GROUP_ID \
  --region $REGION \
  --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=$INSTANCE_NAME}]" \
  --query 'Instances[0].InstanceId' \
  --output text)

echo -e "${GREEN}Instance ID: $INSTANCE_ID${NC}"

# Step 5: Wait for instance to be running
echo -e "${GREEN}Waiting for instance to be running...${NC}"
aws ec2 wait instance-running --instance-ids $INSTANCE_ID --region $REGION

# Step 6: Get public IP
PUBLIC_IP=$(aws ec2 describe-instances \
  --instance-ids $INSTANCE_ID \
  --region $REGION \
  --query 'Reservations[0].Instances[0].PublicIpAddress' \
  --output text)

echo -e "${GREEN}✅ EC2 instance created successfully!${NC}"
echo -e "${GREEN}Instance ID: $INSTANCE_ID${NC}"
echo -e "${GREEN}Public IP: $PUBLIC_IP${NC}"
echo -e "${GREEN}Key Pair: ${KEY_PAIR_NAME}.pem${NC}"

# Create server setup script
cat > server-setup.sh << 'EOF'
#!/bin/bash

# Server Setup Script for Tolstoy on Ubuntu 22.04
set -e

echo "🔧 Starting server setup..."

# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js v20
echo "📦 Installing Node.js v20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install additional dependencies
echo "📦 Installing additional dependencies..."
sudo apt-get install -y git build-essential nginx

# Install PM2 globally
echo "🚦 Installing PM2..."
sudo npm install -g pm2

# Install yarn globally
echo "📦 Installing Yarn..."
sudo npm install -g yarn

echo "✅ Server dependencies installed successfully!"
node --version
npm --version
yarn --version
pm2 --version

echo "🔧 Server setup completed!"
EOF

echo -e "${YELLOW}Server setup script created: server-setup.sh${NC}"
echo -e "${YELLOW}Next steps:${NC}"
echo -e "1. Copy server-setup.sh to EC2: scp -i ${KEY_PAIR_NAME}.pem server-setup.sh ubuntu@${PUBLIC_IP}:~/"
echo -e "2. SSH to EC2: ssh -i ${KEY_PAIR_NAME}.pem ubuntu@${PUBLIC_IP}"
echo -e "3. Run setup: chmod +x server-setup.sh && ./server-setup.sh"

# Save deployment info
cat > ec2-deployment-info.txt << EOF
EC2 Deployment Information
==========================
Instance ID: $INSTANCE_ID
Instance Type: $INSTANCE_TYPE
Public IP: $PUBLIC_IP
Key Pair: ${KEY_PAIR_NAME}.pem
Security Group: $SECURITY_GROUP_NAME ($SECURITY_GROUP_ID)
Region: $REGION

SSH Command:
ssh -i ${KEY_PAIR_NAME}.pem ubuntu@${PUBLIC_IP}

SCP Command Example:
scp -i ${KEY_PAIR_NAME}.pem file.txt ubuntu@${PUBLIC_IP}:~/
EOF

echo -e "${GREEN}Deployment info saved to: ec2-deployment-info.txt${NC}"