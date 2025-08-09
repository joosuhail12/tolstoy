#!/bin/bash

# Quick server diagnostic script
echo "=== SERVER DIAGNOSTIC ==="
echo "Date: $(date)"
echo ""

echo "1. Checking PM2 status:"
pm2 status 2>/dev/null || echo "PM2 not found or no processes"
echo ""

echo "2. Checking if app is running on port 3000:"
netstat -tlnp | grep 3000 || ss -tlnp | grep 3000 || echo "Port 3000 not in use"
echo ""

echo "3. Testing local connection:"
curl -s http://localhost:3000/health || echo "Local health check failed"
echo ""

echo "4. Checking AWS access:"
aws sts get-caller-identity 2>/dev/null || echo "AWS CLI not configured"
echo ""

echo "5. Testing AWS secret access:"
aws secretsmanager describe-secret --secret-id tolstoy/env --region us-east-1 2>/dev/null >/dev/null && echo "AWS secret accessible" || echo "Cannot access AWS secret"
echo ""

echo "6. Checking application directory:"
ls -la /home/ubuntu/tolstoy/ 2>/dev/null | head -5 || echo "App directory not found"
echo ""

echo "7. Recent PM2 logs:"
pm2 logs --lines 10 2>/dev/null || echo "No PM2 logs"
echo ""