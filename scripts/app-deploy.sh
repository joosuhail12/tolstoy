#!/bin/bash

# Application Deployment Script for EC2
# Run this script on the EC2 instance after server setup

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
REPO_URL="https://github.com/joosuhail12/tolstoy.git"
APP_DIR="/home/ubuntu/tolstoy"
APP_NAME="tolstoy-api"

echo -e "${YELLOW}Starting Tolstoy application deployment...${NC}"

# Step 1: Clone repository
echo -e "${GREEN}Cloning Tolstoy repository...${NC}"
if [ -d "$APP_DIR" ]; then
  echo -e "${YELLOW}Directory exists, pulling latest changes...${NC}"
  cd $APP_DIR
  git pull origin main
else
  git clone $REPO_URL $APP_DIR
  cd $APP_DIR
fi

# Step 2: Install dependencies
echo -e "${GREEN}Installing dependencies...${NC}"
yarn install

# Step 3: Generate Prisma client
echo -e "${GREEN}Generating Prisma client...${NC}"
yarn db:generate

# Step 4: Build application
echo -e "${GREEN}Building application...${NC}"
yarn build

# Step 5: Set up environment variables
echo -e "${GREEN}Setting up environment variables...${NC}"
cat > .env.production << 'EOF'
NODE_ENV=production
PORT=3000
AWS_REGION=us-east-1
AWS_SECRET_NAME=tolstoy-db-secret
USE_AWS_SECRETS=true
EOF

# Step 6: Create PM2 ecosystem file
echo -e "${GREEN}Creating PM2 configuration...${NC}"
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'tolstoy-api',
    script: 'dist/main.js',
    cwd: '/home/ubuntu/tolstoy',
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
      AWS_REGION: 'us-east-1',
      AWS_SECRET_NAME: 'tolstoy-db-secret',
      USE_AWS_SECRETS: 'true'
    },
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    error_file: '/home/ubuntu/logs/tolstoy-error.log',
    out_file: '/home/ubuntu/logs/tolstoy-out.log',
    log_file: '/home/ubuntu/logs/tolstoy-combined.log',
    time: true
  }]
};
EOF

# Step 7: Create logs directory
echo -e "${GREEN}Creating logs directory...${NC}"
mkdir -p /home/ubuntu/logs

# Step 8: Start application with PM2
echo -e "${GREEN}Starting application with PM2...${NC}"
pm2 delete $APP_NAME 2>/dev/null || true
pm2 start ecosystem.config.js
pm2 save
pm2 startup

echo -e "${GREEN}✅ Application deployed successfully with PM2!${NC}"
pm2 status

# Step 9: Configure Nginx
echo -e "${GREEN}Configuring Nginx reverse proxy...${NC}"
sudo tee /etc/nginx/sites-available/tolstoy << 'EOF'
server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
    }

    location /health {
        proxy_pass http://localhost:3000/health;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /status {
        proxy_pass http://localhost:3000/status;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

# Enable Nginx site
sudo ln -sf /etc/nginx/sites-available/tolstoy /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Test and restart Nginx
echo -e "${GREEN}Testing Nginx configuration...${NC}"
sudo nginx -t

if [ $? -eq 0 ]; then
  echo -e "${GREEN}Restarting Nginx...${NC}"
  sudo systemctl restart nginx
  sudo systemctl enable nginx
  echo -e "${GREEN}✅ Nginx configured successfully!${NC}"
else
  echo -e "${RED}❌ Nginx configuration test failed!${NC}"
  exit 1
fi

# Step 10: Display deployment summary
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}🚀 TOLSTOY DEPLOYMENT COMPLETE!${NC}"
echo -e "${GREEN}========================================${NC}"
echo -e "Application: $APP_NAME"
echo -e "Directory: $APP_DIR"
echo -e "PM2 Status:"
pm2 status
echo -e "${GREEN}========================================${NC}"
echo -e "Access your application at:"
PUBLIC_IP=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4)
echo -e "${GREEN}http://$PUBLIC_IP${NC}"
echo -e "${GREEN}Health Check: http://$PUBLIC_IP/health${NC}"
echo -e "${GREEN}Status Check: http://$PUBLIC_IP/status${NC}"
echo -e "${GREEN}========================================${NC}"

# Show useful commands
echo -e "${YELLOW}Useful PM2 Commands:${NC}"
echo -e "pm2 status              # Check application status"
echo -e "pm2 logs $APP_NAME      # View application logs"
echo -e "pm2 restart $APP_NAME   # Restart application"
echo -e "pm2 stop $APP_NAME      # Stop application"
echo -e "pm2 start $APP_NAME     # Start application"
echo -e "pm2 delete $APP_NAME    # Delete application"