module.exports = {
  apps: [{
    name: 'tolstoy-api',
    script: 'dist/main.js',
    cwd: '/home/ubuntu/tolstoy',
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
      AWS_REGION: 'us-east-1',
      AWS_SECRET_NAME: 'tolstoy/env',
      USE_AWS_SECRETS: 'true',
      PRODUCTION_URL: 'tolstoy.getpullse.com',
      // Inherit from process environment
      DATABASE_URL: process.env.DATABASE_URL,
      DIRECT_URL: process.env.DIRECT_URL,
      INNGEST_EVENT_KEY: process.env.INNGEST_EVENT_KEY,
      DAYTONA_API_KEY: process.env.DAYTONA_API_KEY,
      DAYTONA_BASE_URL: process.env.DAYTONA_BASE_URL,
      UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
      UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
      SENTRY_DSN: process.env.SENTRY_DSN
    },
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    error_file: '/home/ubuntu/logs/tolstoy-error.log',
    out_file: '/home/ubuntu/logs/tolstoy-out.log',
    log_file: '/home/ubuntu/logs/tolstoy-combined.log',
    time: true,
    
    // Additional production settings
    max_restarts: 10,
    min_uptime: '5s',
    
    // Environment-specific settings
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000,
      AWS_REGION: 'us-east-1',
      AWS_SECRET_NAME: 'tolstoy/env',
      USE_AWS_SECRETS: 'true',
      PRODUCTION_URL: 'tolstoy.getpullse.com',
      // Inherit from process environment
      DATABASE_URL: process.env.DATABASE_URL,
      DIRECT_URL: process.env.DIRECT_URL,
      INNGEST_EVENT_KEY: process.env.INNGEST_EVENT_KEY,
      DAYTONA_API_KEY: process.env.DAYTONA_API_KEY,
      DAYTONA_BASE_URL: process.env.DAYTONA_BASE_URL,
      UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
      UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
      SENTRY_DSN: process.env.SENTRY_DSN
    }
  }]
};