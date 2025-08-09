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
      USE_AWS_SECRETS: 'true'
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
      USE_AWS_SECRETS: 'true'
    }
  }]
};