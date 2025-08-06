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
```

### Connection Types
- **DATABASE_URL**: Pooled connection for application queries
- **DIRECT_URL**: Direct connection for Prisma migrations

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
│   ├── main.ts             # Application bootstrap
│   ├── app.module.ts       # Root module
│   ├── app.controller.ts   # Basic controller
│   ├── app.service.ts      # Application service
│   └── prisma.service.ts   # Prisma service integration
├── .env                    # Environment variables
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