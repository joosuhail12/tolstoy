#!/bin/bash

# Script to create IAM role and instance profile for EC2 Tolstoy deployment

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
ROLE_NAME="TolstoyEC2Role"
POLICY_NAME="TolstoySecretsManagerPolicy"
INSTANCE_PROFILE_NAME="TolstoyEC2InstanceProfile"
REGION="us-east-1"

echo -e "${YELLOW}Setting up IAM role for Tolstoy EC2 deployment...${NC}"

# Step 1: Create trust policy for EC2
echo -e "${GREEN}Creating EC2 trust policy...${NC}"
cat > ec2-trust-policy.json << 'EOF'
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
EOF

# Step 2: Create IAM role
echo -e "${GREEN}Creating IAM role: $ROLE_NAME${NC}"
aws iam create-role \
  --role-name "$ROLE_NAME" \
  --assume-role-policy-document file://ec2-trust-policy.json \
  --description "IAM role for Tolstoy EC2 instance to access AWS Secrets Manager"

# Step 3: Create custom policy for Secrets Manager
echo -e "${GREEN}Creating Secrets Manager policy...${NC}"
cat > tolstoy-secrets-policy.json << 'EOF'
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
        "arn:aws:secretsmanager:*:*:secret:tolstoy/env*"
      ]
    }
  ]
}
EOF

# Step 4: Create the policy
echo -e "${GREEN}Creating IAM policy: $POLICY_NAME${NC}"
POLICY_ARN=$(aws iam create-policy \
  --policy-name "$POLICY_NAME" \
  --policy-document file://tolstoy-secrets-policy.json \
  --description "Policy to allow access to Tolstoy database secrets" \
  --query 'Policy.Arn' \
  --output text)

echo -e "${GREEN}Policy ARN: $POLICY_ARN${NC}"

# Step 5: Attach policy to role
echo -e "${GREEN}Attaching policy to role...${NC}"
aws iam attach-role-policy \
  --role-name "$ROLE_NAME" \
  --policy-arn "$POLICY_ARN"

# Step 6: Create instance profile
echo -e "${GREEN}Creating instance profile: $INSTANCE_PROFILE_NAME${NC}"
aws iam create-instance-profile \
  --instance-profile-name "$INSTANCE_PROFILE_NAME"

# Step 7: Add role to instance profile
echo -e "${GREEN}Adding role to instance profile...${NC}"
aws iam add-role-to-instance-profile \
  --instance-profile-name "$INSTANCE_PROFILE_NAME" \
  --role-name "$ROLE_NAME"

# Wait for instance profile to be ready
echo -e "${YELLOW}Waiting for instance profile to be ready...${NC}"
sleep 10

echo -e "${GREEN}✅ IAM setup completed successfully!${NC}"
echo -e "${GREEN}========================================${NC}"
echo -e "IAM Role: $ROLE_NAME"
echo -e "Policy: $POLICY_NAME"
echo -e "Policy ARN: $POLICY_ARN"
echo -e "Instance Profile: $INSTANCE_PROFILE_NAME"
echo -e "${GREEN}========================================${NC}"

# Create attach-role script
cat > attach-role-to-ec2.sh << EOF
#!/bin/bash

# Script to attach IAM role to existing EC2 instance
# Usage: ./attach-role-to-ec2.sh INSTANCE_ID

INSTANCE_ID=\$1

if [ -z "\$INSTANCE_ID" ]; then
  echo "Usage: \$0 INSTANCE_ID"
  echo "Example: \$0 i-1234567890abcdef0"
  exit 1
fi

echo "Attaching IAM role to EC2 instance: \$INSTANCE_ID"

# Stop the instance first (required to change instance profile)
echo "Stopping instance..."
aws ec2 stop-instances --instance-ids \$INSTANCE_ID --region $REGION
aws ec2 wait instance-stopped --instance-ids \$INSTANCE_ID --region $REGION

# Associate instance profile
echo "Associating instance profile..."
aws ec2 associate-iam-instance-profile \\
  --instance-id \$INSTANCE_ID \\
  --iam-instance-profile Name=$INSTANCE_PROFILE_NAME \\
  --region $REGION

# Start the instance
echo "Starting instance..."
aws ec2 start-instances --instance-ids \$INSTANCE_ID --region $REGION
aws ec2 wait instance-running --instance-ids \$INSTANCE_ID --region $REGION

echo "✅ IAM role attached successfully!"
EOF

chmod +x attach-role-to-ec2.sh

echo -e "${YELLOW}Additional script created: attach-role-to-ec2.sh${NC}"
echo -e "${YELLOW}Use this to attach the role to an existing EC2 instance${NC}"

# Clean up temporary files
rm -f ec2-trust-policy.json tolstoy-secrets-policy.json