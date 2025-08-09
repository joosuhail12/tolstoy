# Production Domain Setup for tolstoy.getpullse.com

This document outlines the configuration needed to properly serve the Tolstoy application through the production domain `tolstoy.getpullse.com` with Cloudflare as a proxy.

## AWS Secrets Manager Configuration

The following environment variables should be added to your AWS Secrets Manager secret `tolstoy/env`:

### Required Production Configuration

```json
{
  "DATABASE_URL": "postgresql://user:password@host-pooler.neon.tech/db?sslmode=require&channel_binding=require",
  "DIRECT_URL": "postgresql://user:password@host.neon.tech/db?sslmode=require&channel_binding=require",
  "NODE_ENV": "production",
  "PORT": "3000",
  "APP_NAME": "Tolstoy",
  "DOMAIN": "tolstoy.getpullse.com",
  "BASE_URL": "https://tolstoy.getpullse.com",
  "API_BASE_URL": "https://tolstoy.getpullse.com",
  "JWT_SECRET": "your-secure-jwt-secret-here",
  "ENCRYPTION_KEY": "your-32-byte-encryption-key-here",
  "DAYTONA_API_KEY": "your-daytona-api-key",
  "DAYTONA_BASE_URL": "https://api.daytona.dev",
  "INNGEST_EVENT_KEY_PROD": "your-inngest-event-key",
  "INNGEST_SIGNING_KEY_PROD": "your-inngest-signing-key",
  "INNGEST_BASE_URL": "https://api.inngest.com",
  "SENTRY_DSN": "your-sentry-dsn-if-using",
  "SENTRY_ENVIRONMENT": "production"
}
```

### Optional Configuration

```json
{
  "REDIS_URL": "redis://your-redis-instance:6379",
  "CORS_ORIGIN": "https://tolstoy.getpullse.com,https://*.getpullse.com",
  "CORS_CREDENTIALS": "true",
  "TRUSTED_PROXIES": "cloudflare",
  "FORCE_HTTPS": "true",
  "RATE_LIMIT_WINDOW_MS": "900000",
  "RATE_LIMIT_MAX_REQUESTS": "1000",
  "LOG_LEVEL": "info",
  "LOG_FORMAT": "json",
  "ENABLE_METRICS": "true",
  "METRICS_PORT": "9090"
}
```

## Application Features Configured

### 1. Security Headers & CORS
- Helmet security headers configured for production
- CORS policy set to allow requests from `tolstoy.getpullse.com` and `*.getpullse.com`
- Content Security Policy configured for API usage
- Rate limiting enabled (1000 requests per 15 minutes by default)

### 2. OAuth2 Redirect URIs
- Dynamic redirect URI generation based on domain configuration
- Automatic fallback to production domain if no redirect URI is configured
- Supports all OAuth providers: GitHub, Google, Microsoft, Slack, Discord, LinkedIn, Facebook

### 3. Health Check Endpoints
- `/health` - Simple endpoint for load balancers
- `/status` - Basic health information
- `/status/detailed` - Comprehensive health check with database and system info

### 4. Trusted Proxy Configuration
- Configured to trust Cloudflare proxy headers
- Proper IP forwarding for rate limiting and logging
- HTTPS enforcement in production

## Cloudflare Configuration Recommendations

### SSL/TLS Settings
- Set SSL/TLS encryption mode to **Full (strict)**
- Enable **Always Use HTTPS**
- Enable **HTTP Strict Transport Security (HSTS)**

### Caching Rules
- Cache static assets: `*.js`, `*.css`, `*.png`, `*.jpg`, `*.gif`, `*.ico`
- Bypass cache for API endpoints: `/api/*`, `/auth/*`, `/health`, `/status/*`

### Security Rules
- Enable **Bot Fight Mode**
- Configure **Rate Limiting** at edge (complementary to application-level limiting)
- Set up **WAF rules** for common attacks

### Page Rules
- `tolstoy.getpullse.com/api-docs*` - Cache Level: Bypass
- `tolstoy.getpullse.com/openapi.json` - Cache Level: Standard, Edge TTL: 1 hour

## Deployment Checklist

### 1. AWS Secrets Manager
- [ ] Update secrets with production domain configuration
- [ ] Verify all required environment variables are present
- [ ] Test secret retrieval from application

### 2. OAuth Provider Configuration
Update redirect URIs in OAuth provider settings:
- [ ] GitHub: `https://tolstoy.getpullse.com/auth/oauth/github/callback`
- [ ] Google: `https://tolstoy.getpullse.com/auth/oauth/google/callback`
- [ ] Microsoft: `https://tolstoy.getpullse.com/auth/oauth/microsoft/callback`
- [ ] Slack: `https://tolstoy.getpullse.com/auth/oauth/slack/callback`
- [ ] Discord: `https://tolstoy.getpullse.com/auth/oauth/discord/callback`
- [ ] LinkedIn: `https://tolstoy.getpullse.com/auth/oauth/linkedin/callback`
- [ ] Facebook: `https://tolstoy.getpullse.com/auth/oauth/facebook/callback`

### 3. DNS & Cloudflare
- [x] DNS A record pointing to server IP
- [x] Cloudflare proxy enabled (orange cloud)
- [ ] SSL/TLS configured as Full (strict)
- [ ] Security rules configured
- [ ] Caching rules configured

### 4. Application Deployment
- [ ] Deploy application with updated configuration
- [ ] Verify health endpoints respond correctly
- [ ] Test CORS policy with browser requests
- [ ] Verify OAuth flows work with production domain
- [ ] Check security headers in browser dev tools

### 5. Monitoring & Verification
- [ ] Test load balancer health checks
- [ ] Verify SSL certificate is valid
- [ ] Test API endpoints through domain
- [ ] Verify webhook endpoints work with HTTPS
- [ ] Check application logs for any domain-related issues

## Testing Commands

```bash
# Test health endpoints
curl https://tolstoy.getpullse.com/health
curl https://tolstoy.getpullse.com/status
curl https://tolstoy.getpullse.com/status/detailed

# Test CORS headers
curl -H "Origin: https://tolstoy.getpullse.com" \
     -H "Access-Control-Request-Method: POST" \
     -H "Access-Control-Request-Headers: Content-Type" \
     -X OPTIONS https://tolstoy.getpullse.com/api/flows

# Test security headers
curl -I https://tolstoy.getpullse.com/

# Test OAuth redirect (example with GitHub)
curl "https://tolstoy.getpullse.com/auth/oauth/github/initiate" \
     -H "X-Org-ID: your-org-id" \
     -H "X-User-ID: your-user-id"
```

## Troubleshooting

### Common Issues

1. **502 Bad Gateway**
   - Verify application is running on correct port
   - Check server firewall settings
   - Verify Cloudflare can reach your server

2. **SSL Certificate Issues**
   - Ensure Cloudflare SSL is set to Full (strict)
   - Verify your server has valid SSL certificate
   - Check certificate chain

3. **CORS Errors**
   - Verify CORS_ORIGIN includes your domain
   - Check that preflight OPTIONS requests are handled
   - Ensure credentials are properly configured

4. **OAuth Callback Failures**
   - Verify redirect URIs match in OAuth provider settings
   - Check that callbacks reach the correct endpoint
   - Verify state parameter handling

5. **Rate Limiting Issues**
   - Check application rate limits vs Cloudflare limits
   - Verify trusted proxy configuration
   - Review rate limiting logs