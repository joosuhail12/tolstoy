# Deployment Troubleshooting Guide

## Quick Server Health Check

If deployment fails, you can manually check your server status:

### 1. SSH into your server and check PM2 status:
```bash
ssh -i ~/.ssh/your-key.pem ubuntu@your-server-ip
pm2 status
pm2 logs tolstoy-api --lines 50
```

### 2. Check if the application is running on the correct port:
```bash
ss -tlnp | grep :3000
curl -I http://localhost:3000/health
```

### 3. Check server resources:
```bash
df -h          # Disk space
free -h        # Memory usage  
ps aux | head  # Top processes
```

### 4. Manual deployment steps (if automated fails):
```bash
cd /home/ubuntu/tolstoy
git pull origin main
npm ci
npm run db:generate
npm run build
pm2 restart tolstoy-api
pm2 logs tolstoy-api --lines 30
```

### 5. Test the application locally:
```bash
# From your local machine
curl -v http://your-server-ip/health
curl -v http://your-server-ip/status
```

## Common Issues and Solutions

### 🔴 **502 Bad Gateway Error**
**Cause:** Application not running or not responding on port 3000  
**Solution:**
```bash
# Check if PM2 process is running
pm2 status

# Restart the application
pm2 restart tolstoy-api

# Check logs for errors
pm2 logs tolstoy-api --lines 50
```

### 🔴 **Port Already in Use**
**Cause:** Another process using port 3000  
**Solution:**
```bash
# Find process using port 3000
lsof -i :3000

# Kill the process if needed
sudo kill -9 <PID>

# Restart application
pm2 restart tolstoy-api
```

### 🔴 **Database Connection Issues**
**Cause:** AWS Secrets Manager or database connectivity problems  
**Solution:**
```bash
# Test AWS secrets access
aws secretsmanager get-secret-value --secret-id tolstoy/env --region us-east-1

# Check if DATABASE_URL is accessible
echo $DATABASE_URL  # Should not be empty

# Test database connection manually
npm run db:generate
```

### 🔴 **Build Failures**
**Cause:** TypeScript compilation errors or missing dependencies  
**Solution:**
```bash
# Clean build
rm -rf dist node_modules
npm ci
npm run build

# Check for TypeScript errors
npx tsc --noEmit
```

### 🔴 **Memory Issues**
**Cause:** Server running out of memory  
**Solution:**
```bash
# Check memory usage
free -h

# Restart PM2 to clear memory
pm2 restart all

# Consider upgrading server instance size
```

## Manual Deployment Command

If you need to deploy manually from your local machine:

```bash
# Use the manual deployment workflow
gh workflow run deploy-manual.yml

# Or run deployment steps directly via SSH
ssh -i ~/.ssh/your-key.pem ubuntu@your-server-ip << 'EOF'
  cd /home/ubuntu/tolstoy
  git pull origin main
  npm ci --production=false
  npm run db:generate
  npm run build
  pm2 restart tolstoy-api
  pm2 save
  sleep 10
  curl -f http://localhost:3000/health && echo "✅ Deployment successful!"
EOF
```

## Health Check URLs

Test these endpoints after deployment:
- `http://your-server-ip/health` - Basic health check
- `http://your-server-ip/status` - Detailed status with database info
- `http://your-server-ip/` - Root endpoint (may redirect or show API info)

## Getting Help

If issues persist:
1. Copy the PM2 logs: `pm2 logs tolstoy-api --lines 100`
2. Copy the deployment workflow logs from GitHub Actions
3. Check server resources and available disk space
4. Verify all environment variables and secrets are configured correctly