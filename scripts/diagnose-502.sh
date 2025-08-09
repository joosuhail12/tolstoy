#!/bin/bash

# 🔧 Tolstoy 502 Error Diagnostic Script
# Run this script on your server to diagnose the 502 error

echo "=== 🔧 TOLSTOY 502 ERROR DIAGNOSTICS ==="
echo "Timestamp: $(date)"
echo ""

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== 1. PM2 STATUS ===${NC}"
pm2 status || echo -e "${RED}PM2 not found or not running${NC}"
echo ""

echo -e "${BLUE}=== 2. APPLICATION LOGS (Last 20 lines) ===${NC}"
pm2 logs tolstoy-api --lines 20 || echo -e "${RED}No PM2 logs available${NC}"
echo ""

echo -e "${BLUE}=== 3. PORT 3000 CHECK ===${NC}"
echo "Checking if port 3000 is in use:"
netstat -tlnp | grep 3000 || ss -tlnp | grep 3000 || echo -e "${RED}Port 3000 not in use${NC}"
echo ""

echo -e "${BLUE}=== 4. LOCAL HEALTH CHECK ===${NC}"
echo "Testing localhost:3000/health:"
curl -s -w "HTTP Status: %{http_code}\n" http://localhost:3000/health || echo -e "${RED}Local health check failed${NC}"
echo ""

echo -e "${BLUE}=== 5. NODE PROCESSES ===${NC}"
echo "Node.js processes running:"
ps aux | grep -E "(node|npm)" | grep -v grep || echo -e "${RED}No Node processes found${NC}"
echo ""

echo -e "${BLUE}=== 6. AWS CLI ACCESS ===${NC}"
echo "AWS identity check:"
aws sts get-caller-identity 2>/dev/null || echo -e "${RED}AWS CLI not configured or no access${NC}"
echo ""

echo -e "${BLUE}=== 7. AWS SECRETS ACCESS ===${NC}"
echo "Testing tolstoy/env secret access:"
aws secretsmanager describe-secret --secret-id tolstoy/env --region us-east-1 2>/dev/null && echo -e "${GREEN}Secret exists${NC}" || echo -e "${RED}Cannot access tolstoy/env secret${NC}"
echo ""

echo -e "${BLUE}=== 8. DISK SPACE ===${NC}"
df -h | head -5
echo ""

echo -e "${BLUE}=== 9. MEMORY USAGE ===${NC}"
free -h
echo ""

echo -e "${BLUE}=== 10. SYSTEM LOAD ===${NC}"
uptime
echo ""

echo -e "${BLUE}=== 11. FIREWALL STATUS ===${NC}"
sudo ufw status 2>/dev/null || echo "UFW not available"
echo ""

echo -e "${BLUE}=== 12. APPLICATION DIRECTORY ===${NC}"
if [ -d "/home/ubuntu/tolstoy" ]; then
    echo "Application directory exists:"
    ls -la /home/ubuntu/tolstoy/ | head -10
    echo ""
    echo "Built application check:"
    ls -la /home/ubuntu/tolstoy/dist/ | head -5 2>/dev/null || echo -e "${RED}No dist/ directory found${NC}"
else
    echo -e "${RED}Application directory /home/ubuntu/tolstoy not found${NC}"
fi
echo ""

echo -e "${BLUE}=== 13. ECOSYSTEM CONFIG ===${NC}"
if [ -f "/home/ubuntu/tolstoy/ecosystem.config.js" ]; then
    echo "PM2 ecosystem config exists:"
    head -20 /home/ubuntu/tolstoy/ecosystem.config.js
else
    echo -e "${RED}No ecosystem.config.js found${NC}"
fi
echo ""

echo -e "${BLUE}=== 14. EXTERNAL CONNECTIVITY TEST ===${NC}"
echo "Testing external connectivity:"
curl -s -I http://$(curl -s ifconfig.me):3000/health 2>/dev/null && echo -e "${GREEN}External port 3000 accessible${NC}" || echo -e "${RED}Port 3000 not externally accessible${NC}"
echo ""

echo -e "${BLUE}=== 15. RECENT SYSTEM LOGS ===${NC}"
echo "Recent system errors (last 10 lines):"
sudo journalctl -n 10 --no-pager || echo "Cannot access system logs"
echo ""

echo -e "${YELLOW}=== DIAGNOSTICS COMPLETE ===${NC}"
echo "Please share this output for further troubleshooting."