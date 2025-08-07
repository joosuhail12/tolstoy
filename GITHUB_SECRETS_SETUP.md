# 🔐 GitHub Secrets Quick Setup

## Required Secrets for CI/CD Pipeline

Configure these secrets in your GitHub repository (**Settings** → **Secrets and variables** → **Actions**):

| Secret Name | Value |
|-------------|-------|
| `EC2_HOST` | `3.81.233.52` |
| `EC2_USER` | `ubuntu` |
| `EC2_KEY` | *Base64-encoded SSH key (see below)* |
| `EC2_PATH` | `/home/ubuntu/tolstoy` |

## 🔑 Generate EC2_KEY Value

Run this command to encode your SSH private key:

```bash
base64 -w 0 tolstoy-key-pair.pem
```

Copy the entire output (one long line) and use it as the `EC2_KEY` secret value.

## 🧪 Test the Pipeline

1. Add the secrets above
2. Make a small code change
3. Push to main branch:
   ```bash
   git add .
   git commit -m "test: trigger CI/CD"
   git push origin main
   ```
4. Check the **Actions** tab in GitHub

## ✅ Verification

After deployment, these endpoints should work:
- http://3.81.233.52/health
- http://3.81.233.52/status

---

*For detailed setup instructions, see [docs/github-actions-setup.md](docs/github-actions-setup.md)*