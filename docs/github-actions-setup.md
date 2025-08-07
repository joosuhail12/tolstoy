# GitHub Actions CI/CD Setup Guide

This document explains how to set up and use the GitHub Actions CI/CD pipeline for the Tolstoy NestJS application.

## 🎯 Overview

The CI/CD pipeline automatically deploys the Tolstoy application to the EC2 instance whenever code is pushed to the `main` branch. The workflow:

1. Connects to EC2 via SSH
2. Pulls the latest code from GitHub  
3. Installs dependencies with Yarn
4. Generates Prisma client and runs build
5. Restarts the application with PM2
6. Runs database migrations (optional)
7. Verifies deployment health

## 🔐 Required GitHub Secrets

You must configure the following secrets in your GitHub repository:

### Setting up GitHub Secrets

1. Go to your GitHub repository
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add each of the following secrets:

| Secret Name | Value | Description |
|-------------|-------|-------------|
| `EC2_HOST` | `3.81.233.52` | EC2 instance public IP address |
| `EC2_USER` | `ubuntu` | SSH username for EC2 instance |
| `EC2_KEY` | `<base64-encoded-key>` | Base64-encoded SSH private key |
| `EC2_PATH` | `/home/ubuntu/tolstoy` | Application directory on EC2 |

### 🔑 Generating the Base64 SSH Key

To encode your SSH private key for the `EC2_KEY` secret:

```bash
# On macOS:
base64 -i tolstoy-key-pair.pem

# On Linux:
base64 -w 0 tolstoy-key-pair.pem

# On Windows (PowerShell):
[System.Convert]::ToBase64String([System.IO.File]::ReadAllBytes("tolstoy-key-pair.pem"))
```

Copy the entire base64 output (it will be one long line) and use it as the `EC2_KEY` secret value.

## 🚀 Workflow Features

### Automatic Triggers
- **Push to main**: Deploys automatically when code is pushed to the main branch
- **Manual trigger**: Can be triggered manually from the Actions tab

### Deployment Steps
1. **📥 Checkout repository**: Gets the latest code
2. **🔑 Setup SSH key**: Decodes and prepares SSH authentication
3. **✅ Test SSH connection**: Verifies connection to EC2 instance
4. **🚀 Deploy application**: Runs the full deployment process
5. **🗃️ Run database migrations**: Applies any pending Prisma migrations
6. **🔍 Verify deployment**: Tests health and status endpoints
7. **🧹 Cleanup**: Removes SSH key securely

### Health Verification
The workflow automatically tests these endpoints after deployment:
- `http://3.81.233.52/health` - Basic health check
- `http://3.81.233.52/status` - Application status

If either endpoint fails, the deployment is marked as failed.

## 📁 Current File Structure

```
.github/
└── workflows/
    └── deploy.yml        # Main CI/CD workflow
```

## 🧪 Testing the Pipeline

### First Deployment Test

1. **Configure secrets** as described above
2. **Make a small change** to your code (e.g., update a comment)
3. **Commit and push** to the main branch:
   ```bash
   git add .
   git commit -m "test: trigger CI/CD pipeline"
   git push origin main
   ```

### Monitor the Workflow

1. Go to your GitHub repository
2. Click the **Actions** tab
3. You should see a new workflow run titled "Tolstoy CI/CD Pipeline"
4. Click on the workflow to see detailed logs

### Expected Output

The workflow should show green checkmarks for all steps:
- ✅ Checkout repository
- ✅ Setup SSH key  
- ✅ Test SSH connection
- ✅ Deploy application to EC2
- ✅ Run database migrations
- ✅ Verify deployment
- ✅ Cleanup SSH key
- ✅ Deployment summary

## 🔧 Troubleshooting

### Common Issues

**SSH Connection Failed**
- Verify `EC2_HOST` and `EC2_USER` secrets are correct
- Ensure `EC2_KEY` is properly base64 encoded
- Check that the EC2 instance is running and accessible

**Deployment Failed**
- Check the EC2 instance has enough disk space
- Verify the application directory exists: `/home/ubuntu/tolstoy`
- Ensure PM2 is installed and the `tolstoy-api` process exists

**Health Check Failed**
- The application may need more time to start (workflow waits 10 seconds)
- Check if the application is listening on port 3000
- Verify Nginx is properly configured and running

### Debugging Steps

1. **Check workflow logs** in the GitHub Actions tab
2. **SSH into EC2** manually to debug issues:
   ```bash
   ssh -i tolstoy-key-pair.pem ubuntu@3.81.233.52
   ```
3. **Check application logs**:
   ```bash
   pm2 logs tolstoy-api
   ```
4. **Check PM2 status**:
   ```bash
   pm2 status
   ```

## 🔐 Security Considerations

- SSH keys are handled securely and cleaned up after each run
- Secrets are never exposed in logs
- StrictHostKeyChecking is disabled only for the known EC2 host
- The workflow uses the principle of least privilege

## 📈 Monitoring

After each successful deployment, you can:

1. **Check application health**: http://3.81.233.52/health
2. **View detailed status**: http://3.81.233.52/status/detailed  
3. **Monitor PM2 processes**: SSH to EC2 and run `pm2 monit`

## ⚡ Next Steps

The CI/CD pipeline is now ready for use. Consider these future enhancements:

- Add automated testing before deployment
- Implement rollback on deployment failure  
- Add Slack/Discord notifications
- Create staging environment workflows
- Add performance monitoring after deployment