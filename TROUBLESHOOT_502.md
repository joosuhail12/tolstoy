# 🔧 502 Error Troubleshooting Guide

## Current Status: 502 Bad Gateway through Cloudflare

The 502 error indicates Cloudflare can reach your domain but can't connect to your origin server.

## Step 1: Check Server Status

SSH into your server and run:

```bash
# Check if the application is running
pm2 status

# Check application logs
pm2 logs tolstoy-api --lines 50

# Check if the application is listening on port 3000
netstat -tlnp | grep 3000
# or
ss -tlnp | grep 3000

# Check if the process is running
ps aux | grep node

# Test local connectivity
curl http://localhost:3000/health
```

## Step 2: Check AWS Secrets Manager Access

The app might be failing to start due to secrets access issues:

```bash
# Test AWS CLI access
aws sts get-caller-identity

# Try to fetch the secret
aws secretsmanager get-secret-value --secret-id tolstoy/env --region us-east-1

# Check if the secret exists and has the right content
aws secretsmanager describe-secret --secret-id tolstoy/env --region us-east-1
```

## Step 3: Manual Application Start Test

If PM2 shows the app as stopped or crashed:

```bash
# Go to application directory
cd /home/ubuntu/tolstoy

# Try starting manually to see error messages
npm start

# Or check if build exists
ls -la dist/
```

## Step 4: Check Server Network Configuration

```bash
# Check if port 3000 is accessible externally
sudo ufw status

# Check if any firewall is blocking port 3000
sudo iptables -L -n

# Test if the server can bind to port 3000
sudo netstat -tlnp | grep :3000
```

## Step 5: Cloudflare Configuration Check

1. **SSL/TLS Settings**: 
   - Go to Cloudflare Dashboard → SSL/TLS
   - Should be set to "Full" or "Full (strict)"
   - NOT "Flexible"

2. **DNS Settings**:
   - Verify A record points to correct server IP
   - Orange cloud should be enabled (proxied)

3. **Origin Rules**:
   - Check if any origin rules are interfering
   - Verify port mapping if using custom ports

## Common Causes & Solutions

### 1. Application Not Running
**Symptoms**: PM2 shows app as stopped/errored
**Solution**: 
```bash
pm2 restart tolstoy-api
pm2 logs tolstoy-api
```

### 2. AWS Secrets Access Issues
**Symptoms**: App starts but crashes immediately
**Solution**: Verify IAM permissions and secret content

### 3. Port Not Accessible
**Symptoms**: App running but not reachable
**Solution**: Check firewall and security group settings

### 4. SSL Certificate Issues
**Symptoms**: Intermittent 502 errors
**Solution**: Verify Cloudflare SSL settings

### 5. Environment Variables Missing
**Symptoms**: App crashes on startup
**Solution**: Verify all required vars in `tolstoy/env` secret

## Quick Fix Commands

```bash
# Restart everything
pm2 restart all
pm2 save

# Reload with fresh environment
pm2 reload ecosystem.config.js

# Check detailed PM2 info
pm2 info tolstoy-api

# Monitor in real-time
pm2 monit
```

## Next Steps

1. Run the server diagnostics above
2. Share the output of `pm2 status` and `pm2 logs tolstoy-api`
3. Verify the AWS secrets are accessible
4. Check Cloudflare SSL/TLS settings

The most likely causes are:
- Application crashed and PM2 hasn't restarted it
- AWS Secrets Manager access issues preventing startup
- Firewall blocking port 3000
- Cloudflare SSL configuration mismatch