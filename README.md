# Tolstoy - NestJS + Fastify + Prisma + Neon PostgreSQL

A robust workflow automation platform built with NestJS, Fastify, Prisma ORM, and Neon PostgreSQL.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Neon PostgreSQL database

### Installation

```bash
# Install dependencies
npm install

# Generate Prisma client
npm run db:generate

# Apply database migrations
npm run db:migrate:deploy

# Start development server
npm run start:dev
```

## 🔄 Database Migration Workflow

### Overview
This project uses Prisma migrations for schema evolution across environments. All schema changes should be managed through migrations to ensure consistency.

### Creating a Migration
To create and apply a new migration during development:

```bash
# Create and apply migration with descriptive name
npx prisma migrate dev --name add_user_roles

# Alternative: Use npm script
npm run db:migrate:dev -- --name add_user_roles
```

**What happens:**
- Prisma compares your schema with the database
- Generates SQL migration file in `prisma/migrations/`
- Applies the migration to your development database
- Regenerates Prisma Client

### Applying Migrations (Production/Staging)
Deploy migrations to non-development databases:

```bash
# Deploy all pending migrations
npx prisma migrate deploy

# Alternative: Use npm script  
npm run db:migrate:deploy
```

**Use this for:**
- Production deployments
- Staging environments
- CI/CD pipelines

### Migration Status & History
Check current database migration status:

```bash
# View migration status
npx prisma migrate status

# View migration history
npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma
```

### Resetting Local Database (⚠️ Data Loss!)
To reset and reapply all migrations locally:

```bash
# Reset database (DESTROYS ALL DATA)
npx prisma migrate reset --force

# Interactive reset
npx prisma migrate reset
```

### Schema Changes Without Migrations (Development Only)
For rapid prototyping in development:

```bash
# Push schema changes directly (bypasses migrations)
npm run db:push
```

⚠️ **Warning:** Only use `db:push` for prototyping. Always create proper migrations for production changes.

## 📊 Database Schema

### Core Models
- **Organization** - Multi-tenant organization structure
- **User** - Users belonging to organizations  
- **Tool** - External tools/APIs that can be integrated
- **Action** - Specific actions/endpoints for tools
- **Flow** - Workflow definitions with versioning
- **ExecutionLog** - Audit trail of workflow executions

### Relationships
- Organization → Users (1:many)
- Organization → Tools (1:many) 
- Organization → Flows (1:many)
- Tool → Actions (1:many)
- Flow → ExecutionLogs (1:many)
- User → ExecutionLogs (1:many)

## 🔗 API Endpoints

### Multi-Tenant CRUD API
All endpoints (except Organizations) require multi-tenant headers:
- `X-Org-ID`: Organization identifier
- `X-User-ID`: User identifier

#### Organizations (No tenant headers required)
```bash
GET    /organizations       # List all organizations
POST   /organizations       # Create organization
GET    /organizations/:id   # Get organization by ID
PUT    /organizations/:id   # Update organization
DELETE /organizations/:id   # Delete organization
```

#### Users (Requires tenant headers)
```bash
GET    /users              # List users in organization
POST   /users              # Create user in organization
GET    /users/:id          # Get user by ID
PUT    /users/:id          # Update user
DELETE /users/:id          # Delete user
```

#### Tools (Requires tenant headers)
```bash
GET    /tools              # List tools in organization
POST   /tools              # Create tool in organization
GET    /tools/:id          # Get tool by ID
PUT    /tools/:id          # Update tool
DELETE /tools/:id          # Delete tool
```

#### Actions (Requires tenant headers)
```bash
GET    /actions            # List actions in organization
POST   /actions            # Create action
GET    /actions/:id        # Get action by ID
PUT    /actions/:id        # Update action
DELETE /actions/:id        # Delete action
```

#### Flows (Requires tenant headers)
```bash
GET    /flows              # List flows in organization
POST   /flows              # Create flow
GET    /flows/:id          # Get flow by ID
PUT    /flows/:id          # Update flow
DELETE /flows/:id          # Delete flow
```

#### Execution Logs (Requires tenant headers)
```bash
GET    /execution-logs     # List execution logs in organization
POST   /execution-logs     # Create execution log
GET    /execution-logs/:id # Get execution log by ID
PUT    /execution-logs/:id # Update execution log
DELETE /execution-logs/:id # Delete execution log
```

### API Testing Examples

#### Create an Organization
```bash
curl -X POST http://localhost:3000/organizations \
  -H "Content-Type: application/json" \
  -d '{"name":"My Organization"}'
```

#### Create a User (with tenant headers)
```bash
curl -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -H "X-Org-ID: your-org-id" \
  -H "X-User-ID: your-user-id" \
  -d '{"email":"user@example.com"}'
```

#### Create a Tool (with tenant headers)
```bash
curl -X POST http://localhost:3000/tools \
  -H "Content-Type: application/json" \
  -H "X-Org-ID: your-org-id" \
  -H "X-User-ID: your-user-id" \
  -d '{"name":"Slack API","baseUrl":"https://api.slack.com","authType":"bearer"}'
```

### API Features
- **Type-safe validation** using DTOs and class-validator
- **Multi-tenant isolation** with automatic data filtering
- **Relationship handling** with proper foreign key validation
- **Error handling** with meaningful HTTP status codes
- **Auto-generated timestamps** for all entities

## 🛠️ Development Scripts

```bash
# Development
npm run start:dev          # Start with hot reload
npm run build             # Build TypeScript
npm start                 # Start production build

# Database Operations
npm run db:generate       # Generate Prisma client
npm run db:migrate:dev    # Create & apply migration (dev)
npm run db:migrate:deploy # Deploy migrations (prod)
npm run db:push          # Push schema directly (dev only)
npm run db:studio        # Open Prisma Studio

# Database Utilities
npx prisma migrate status    # Check migration status
npx prisma migrate reset     # Reset database
npx prisma db seed          # Run database seeds (if configured)
```

## 🔐 Environment Configuration

### Required Environment Variables
```bash
# Database - Neon PostgreSQL
DATABASE_URL="postgresql://user:password@host-pooler.neon.tech/db?sslmode=require&channel_binding=require"
DIRECT_URL="postgresql://user:password@host.neon.tech/db?sslmode=require&channel_binding=require"

# Application
NODE_ENV=development
PORT=3000
APP_NAME=Tolstoy

# AWS Secrets Manager (Optional)
AWS_REGION=us-east-1
AWS_SECRET_NAME=tolstoy-db-secret
USE_AWS_SECRETS=false
# AWS_ACCESS_KEY_ID=your-access-key-id       # For local development only
# AWS_SECRET_ACCESS_KEY=your-secret-access-key # For local development only
```

### Connection Types
- **DATABASE_URL**: Pooled connection for application queries
- **DIRECT_URL**: Direct connection for Prisma migrations

## 🔒 AWS Secrets Manager Integration

### Overview
The application supports optional AWS Secrets Manager integration for secure database credential management in production environments.

### Configuration Modes
1. **Local Development** (`USE_AWS_SECRETS=false`): Uses local `.env` variables
2. **Production** (`NODE_ENV=production` or `USE_AWS_SECRETS=true`): Uses AWS Secrets Manager

### Setting Up AWS Secrets Manager

#### 1. Create Secret in AWS
```bash
# Using AWS CLI
aws secretsmanager create-secret \
  --name tolstoy-db-secret \
  --description "Database credentials for Tolstoy application" \
  --secret-string '{"DATABASE_URL":"postgresql://user:password@host-pooler.neon.tech/db?sslmode=require","DIRECT_URL":"postgresql://user:password@host.neon.tech/db?sslmode=require"}'
```

#### 2. Environment Configuration
```bash
# Production environment variables
AWS_REGION=us-east-1
AWS_SECRET_NAME=tolstoy-db-secret
USE_AWS_SECRETS=true
# No DATABASE_URL needed - retrieved from Secrets Manager
```

#### 3. IAM Permissions
Your application needs the following IAM policy:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue"
      ],
      "Resource": "arn:aws:secretsmanager:us-east-1:ACCOUNT-ID:secret:tolstoy-db-secret*"
    }
  ]
}
```

#### 4. Authentication Methods
- **Production**: Use IAM roles (recommended)
- **Local Development**: Use AWS credentials in environment variables (not recommended for production)

### Testing AWS Integration
```bash
# Enable AWS Secrets Manager locally (requires AWS credentials)
export USE_AWS_SECRETS=true
export AWS_ACCESS_KEY_ID=your-access-key
export AWS_SECRET_ACCESS_KEY=your-secret-key
export AWS_REGION=us-east-1

npm start
```

### Troubleshooting AWS Integration
- **CredentialsProviderError**: Check AWS credentials configuration
- **AccessDenied**: Verify IAM permissions for Secrets Manager
- **SecretNotFound**: Ensure secret exists in the correct AWS region
- **NetworkError**: Check AWS region and network connectivity

## 🚀 AWS EC2 Deployment

### Overview
The Tolstoy application is deployed on AWS EC2 with a production-ready setup using Ubuntu 22.04 LTS, Node.js v20, PM2, and Nginx.

### Deployment Specifications
- **Instance Type**: t3.medium (2 vCPUs, 4 GB RAM)
- **Operating System**: Ubuntu 22.04 LTS
- **Runtime**: Node.js v20 LTS
- **Process Manager**: PM2
- **Reverse Proxy**: Nginx
- **Secrets Management**: AWS Secrets Manager
- **Database**: Neon PostgreSQL

### Quick Deployment Guide

#### 1. Prerequisites
- AWS CLI configured with appropriate permissions
- SSH key pair for EC2 access

#### 2. Deploy Infrastructure
```bash
# Create AWS Secrets Manager secret
./scripts/create-aws-secret.sh

# Set up IAM role for EC2
./scripts/setup-iam-role.sh

# Deploy EC2 instance
./scripts/deploy-ec2.sh
```

#### 3. Deploy Application
```bash
# SSH to EC2 instance
ssh -i tolstoy-key-pair.pem ubuntu@<PUBLIC_IP>

# Copy and run server setup
scp -i tolstoy-key-pair.pem scripts/app-deploy.sh ubuntu@<PUBLIC_IP>:~/
./app-deploy.sh
```

### AWS Secrets Manager Configuration

#### Secret Details
- **Secret Name**: `tolstoy-db-secret`
- **Region**: `us-east-1`
- **Keys**: `DATABASE_URL`, `DIRECT_URL`

#### Environment Variables
```bash
NODE_ENV=production
AWS_REGION=us-east-1
AWS_SECRET_NAME=tolstoy-db-secret
USE_AWS_SECRETS=true
```

### PM2 Process Management

#### Useful Commands
```bash
# Check application status
pm2 status

# View logs
pm2 logs tolstoy-api

# Restart application
pm2 restart tolstoy-api

# Stop application
pm2 stop tolstoy-api

# Start application
pm2 start tolstoy-api
```

#### PM2 Configuration
The application uses an ecosystem configuration file:
```javascript
module.exports = {
  apps: [{
    name: 'tolstoy-api',
    script: 'dist/main.js',
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
      AWS_REGION: 'us-east-1',
      AWS_SECRET_NAME: 'tolstoy-db-secret',
      USE_AWS_SECRETS: 'true'
    },
    instances: 1,
    autorestart: true,
    max_memory_restart: '1G'
  }]
};
```

### Nginx Reverse Proxy

#### Configuration
Nginx is configured to proxy requests to the Node.js application running on port 3000:
```nginx
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
    }
}
```

### Health Monitoring

#### Health Check Endpoints
- **Basic Health**: `http://<PUBLIC_IP>/health`
- **Comprehensive Status**: `http://<PUBLIC_IP>/status`  
- **Detailed Status**: `http://<PUBLIC_IP>/status/detailed`

### Security & IAM

#### IAM Role Permissions
The EC2 instance requires an IAM role with the following policy:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue",
        "secretsmanager:DescribeSecret"
      ],
      "Resource": [
        "arn:aws:secretsmanager:*:*:secret:tolstoy-db-secret*"
      ]
    }
  ]
}
```

#### Security Group Rules
- **SSH (22)**: For server management
- **HTTP (80)**: For web traffic
- **HTTPS (443)**: For secure web traffic

### Deployment Scripts

#### Available Scripts
- `scripts/deploy-ec2.sh` - Deploy EC2 infrastructure
- `scripts/create-aws-secret.sh` - Create AWS Secrets Manager secret
- `scripts/setup-iam-role.sh` - Set up IAM role and policies
- `scripts/app-deploy.sh` - Deploy application on EC2 instance

### Troubleshooting

#### Common Issues
1. **Database Connection**: Verify AWS Secrets Manager setup
2. **PM2 Issues**: Check logs with `pm2 logs tolstoy-api`
3. **Nginx Issues**: Test config with `sudo nginx -t`
4. **IAM Permissions**: Ensure EC2 has proper IAM role attached

#### Log Locations
- **Application Logs**: `/home/ubuntu/logs/`
- **Nginx Logs**: `/var/log/nginx/`
- **PM2 Logs**: `~/.pm2/logs/`

## 📁 Project Structure

```
tolstoy/
├── prisma/
│   ├── migrations/           # Database migrations
│   │   ├── 20250806_init/   
│   │   │   └── migration.sql
│   │   └── migration_lock.toml
│   └── schema.prisma        # Database schema definition
├── src/
│   ├── common/              # Shared utilities
│   │   ├── decorators/      # Custom decorators (e.g., @Tenant)
│   │   ├── interfaces/      # TypeScript interfaces
│   │   └── middleware/      # Middleware (tenant validation)
│   ├── organizations/       # Organization CRUD module
│   │   ├── dto/            # Data transfer objects
│   │   ├── organizations.controller.ts
│   │   ├── organizations.service.ts
│   │   └── organizations.module.ts
│   ├── users/              # User CRUD module
│   │   ├── dto/
│   │   ├── users.controller.ts
│   │   ├── users.service.ts
│   │   └── users.module.ts
│   ├── tools/              # Tool CRUD module
│   │   ├── dto/
│   │   ├── tools.controller.ts
│   │   ├── tools.service.ts
│   │   └── tools.module.ts
│   ├── actions/            # Action CRUD module
│   │   ├── dto/
│   │   ├── actions.controller.ts
│   │   ├── actions.service.ts
│   │   └── actions.module.ts
│   ├── flows/              # Flow CRUD module
│   │   ├── dto/
│   │   ├── flows.controller.ts
│   │   ├── flows.service.ts
│   │   └── flows.module.ts
│   ├── execution-logs/     # ExecutionLog CRUD module
│   │   ├── dto/
│   │   ├── execution-logs.controller.ts
│   │   ├── execution-logs.service.ts
│   │   └── execution-logs.module.ts
│   ├── main.ts             # Application bootstrap
│   ├── app.module.ts       # Root module
│   ├── app.controller.ts   # Basic controller
│   ├── app.service.ts      # Application service
│   ├── prisma.service.ts   # Prisma service integration
│   └── aws-secrets.service.ts # AWS Secrets Manager service
├── scripts/
│   ├── deploy-ec2.sh       # EC2 instance deployment
│   ├── create-aws-secret.sh # AWS Secrets Manager setup
│   ├── setup-iam-role.sh   # IAM role configuration
│   └── app-deploy.sh       # Application deployment on EC2
├── docs/
│   ├── aws-deployment-guide.md # AWS deployment documentation
│   └── aws-iam-policy.md   # IAM policy documentation
├── .env                    # Environment variables
├── .gitignore             # Git ignore rules
├── tsconfig.json          # TypeScript configuration
└── package.json           # Dependencies and scripts
```

## 🚨 Migration Best Practices

### Development Workflow
1. **Make schema changes** in `prisma/schema.prisma`
2. **Create migration**: `npx prisma migrate dev --name descriptive_name`
3. **Review generated SQL** in `prisma/migrations/`
4. **Test migration** thoroughly in development
5. **Commit migration files** to version control

### Production Deployment
1. **Deploy code** with new migration files
2. **Run migrations**: `npx prisma migrate deploy`
3. **Verify deployment** with `npx prisma migrate status`

### Rollback Strategy
- Prisma doesn't support automatic rollbacks
- Create new migration to revert changes
- Keep database backups for emergency recovery

### Migration Naming
Use descriptive names that clearly indicate the change:
```bash
# Good examples
npx prisma migrate dev --name add_user_profile_fields
npx prisma migrate dev --name create_audit_log_table
npx prisma migrate dev --name update_flow_schema_structure

# Avoid generic names
npx prisma migrate dev --name update
npx prisma migrate dev --name fix
```

## 🔍 Troubleshooting

### Migration Drift
If you see "drift detected" errors:
```bash
# Reset and recreate migrations (development only)
npx prisma migrate reset
npx prisma migrate dev --name init
```

### Connection Issues
- Verify Neon database credentials
- Check network connectivity
- Ensure SSL mode is correctly configured
- Verify connection pooling settings

### Schema Validation Errors
- Check Prisma schema syntax
- Verify environment variables are set
- Ensure model relationships are properly defined

## 📚 Additional Resources

- [Prisma Migrations Guide](https://www.prisma.io/docs/concepts/components/prisma-migrate)
- [NestJS Documentation](https://docs.nestjs.com/)
- [Neon PostgreSQL Docs](https://neon.tech/docs)
- [Fastify Documentation](https://www.fastify.io/)

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Make changes and create migrations if needed
4. Test thoroughly in development
5. Commit changes (`git commit -m 'Add amazing feature'`)
6. Push to branch (`git push origin feature/amazing-feature`)
7. Create Pull Request

---

**Built with ❤️ using NestJS, Fastify, Prisma, and Neon PostgreSQL**