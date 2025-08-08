# Tolstoy QA Checklist

This comprehensive checklist ensures all critical functionality is verified before the v1.0.0 release. Each item should be tested in a production-like environment with proper logging and monitoring enabled.

## 🏥 Health & Version

- [ ] `GET /health` → 200 + `{ "status": "ok" }`
- [ ] `GET /health/detailed` → 200 + detailed status including database and Redis connectivity
- [ ] `GET /version` → returns correct `version` and `commit` hash
- [ ] Application starts without errors and all dependencies are available
- [ ] Health check endpoint responds within 500ms under normal load

## 🔄 Core Flows

### Basic Flow Execution
- [ ] Hello-world echo flow runs to completion with correct output
- [ ] Simple conditional flow executes with proper branching logic
- [ ] Multi-step sequential flow completes all steps in order
- [ ] Parallel step execution works correctly for concurrent operations

### Template-Based Flows
- [ ] Jira→Slack template imported and runs successfully
- [ ] GitHub-webhook notify flow triggers on a dummy event
- [ ] Email→CRM sync template processes test data correctly
- [ ] Data pipeline ETL template transforms sample dataset

### Flow Management
- [ ] Create flow via API with valid definition
- [ ] Update existing flow definition and verify changes
- [ ] Delete flow and confirm cleanup of related resources
- [ ] List flows with proper pagination and filtering

## 🔐 Secrets & Auth

### AWS Secrets Manager Integration
- [ ] Create a secret via CLI → verify in AWS Secrets Manager
- [ ] Execute a step that uses that secret and confirm the header is set correctly
- [ ] Update secret value → verify flow uses new value on next execution
- [ ] Delete secret → verify flow fails gracefully with proper error

### Authentication & Authorization
- [ ] API key authentication works for all protected endpoints
- [ ] Invalid API key returns 401 Unauthorized
- [ ] Missing API key returns 401 Unauthorized
- [ ] Organization-scoped access controls work correctly

## ⚙️ Execution Engine

### Step Execution
- [ ] Steps are logged as `started` → `running` → `completed`
- [ ] Failed steps are logged as `failed` with error details
- [ ] Conditional step (`executeIf=false`) is skipped correctly
- [ ] Retry logic works for transient failures (up to 3 attempts)

### Flow State Management
- [ ] Flow execution state persists across application restarts
- [ ] Long-running flows can be paused and resumed
- [ ] Flow cancellation works immediately and cleans up resources
- [ ] Concurrent flow executions don't interfere with each other

### Error Handling
- [ ] Invalid step configurations cause flow validation failure
- [ ] Runtime errors are caught and logged with stack traces
- [ ] Timeout errors are handled gracefully
- [ ] Resource exhaustion scenarios fail safely

## 📊 Observability & Metrics

### Prometheus Metrics
- [ ] `/metrics` returns Prometheus format with 200 status
- [ ] Metrics for step latency, errors, retries, and webhooks increment correctly
- [ ] Custom business metrics are exposed (flows created, executions, etc.)
- [ ] Memory and CPU usage metrics are available
- [ ] Database connection pool metrics are tracked

### Monitoring & Alerting
- [ ] Application logs are structured and contain correlation IDs
- [ ] Error rates trigger appropriate alerts
- [ ] Performance degradation is detectable through metrics
- [ ] SLA metrics (availability, response time) are tracked

### Sentry Integration
- [ ] Errors are automatically reported to Sentry with context
- [ ] Performance monitoring captures slow transactions
- [ ] User feedback integration works for error reports
- [ ] Release tracking shows deployment correlation

## 🔗 Webhooks

### Webhook Registration
- [ ] Register a test webhook endpoint successfully
- [ ] Update webhook configuration and verify changes
- [ ] Delete webhook and confirm no further events sent
- [ ] List webhooks with proper filtering and pagination

### Event Delivery
- [ ] Run a flow → verify POST to the webhook URL with correct payload
- [ ] Webhook signature verification works with valid signatures
- [ ] Invalid webhook signatures are rejected
- [ ] Event payload contains all required metadata

### Reliability & Retries
- [ ] Simulate a 500 on the webhook endpoint → confirm retry per policy
- [ ] Exponential backoff works correctly for failed deliveries
- [ ] Dead letter queue captures permanently failed webhooks
- [ ] Maximum retry limit prevents infinite retry loops

## 🛠 SDK & CLI

### TypeScript SDK
- [ ] `@tolstoy/sdk` can list flows with proper pagination
- [ ] SDK can create flows with validation
- [ ] SDK can start executions and track progress
- [ ] Error handling works correctly with proper error types
- [ ] Authentication configuration works with API keys

### CLI Tool
- [ ] CLI commands `run`, `templates:list`, `templates:import` function as documented
- [ ] `tolstoy auth` command validates API credentials
- [ ] `tolstoy flows list` shows flows with proper formatting
- [ ] `tolstoy templates import` successfully imports and creates flows
- [ ] CLI error messages are helpful and actionable

### Integration Examples
- [ ] Node.js example application works end-to-end
- [ ] Python SDK generates and functions correctly
- [ ] REST API examples in documentation are valid
- [ ] Authentication examples work with real credentials

## 📚 Docs

### Documentation Site
- [ ] Mintlify site builds without errors
- [ ] MDX pages render correctly with proper styling
- [ ] `<APIPlayground>` shows code samples and allows testing
- [ ] Search functionality works across all documentation
- [ ] Navigation menu is complete and logical

### Content Accuracy
- [ ] API reference matches actual API behavior
- [ ] Code examples execute successfully
- [ ] Environment setup instructions are complete
- [ ] Troubleshooting guides address common issues
- [ ] Migration guides are accurate and complete

## 🌐 API Gateway & Infrastructure

### API Gateway
- [ ] Hitting custom domain over HTTPS succeeds with valid SSL certificate
- [ ] Rate-limit rules block excessive traffic appropriately
- [ ] WAF rules protect against common attacks (SQL injection, XSS)
- [ ] Caching returns correct headers on repeat requests
- [ ] CORS headers allow proper cross-origin requests

### Performance & Scalability
- [ ] API responds within SLA limits under normal load
- [ ] Load testing shows graceful degradation under stress
- [ ] Auto-scaling triggers work correctly
- [ ] Database connection pooling handles concurrent requests

### Security
- [ ] SSL/TLS configuration uses strong ciphers
- [ ] Security headers are properly set
- [ ] IP whitelisting works when configured
- [ ] Request logging captures security-relevant events

## 💾 Backups & Disaster Recovery

### Backup Operations
- [ ] S3 bucket contains a recent backup file with proper naming
- [ ] Automated daily backup completes successfully
- [ ] Manual backup can be triggered via Lambda function
- [ ] Backup files are encrypted with KMS keys
- [ ] Lifecycle policies move old backups to appropriate storage classes

### Disaster Recovery
- [ ] Restore that backup to a fresh Postgres instance succeeds
- [ ] Point-in-time recovery works within the retention window
- [ ] Cross-region backup replication functions correctly
- [ ] DR runbook procedures are tested and validated
- [ ] RTO and RPO targets are met during testing

### Monitoring & Alerts
- [ ] Backup failures trigger immediate alerts
- [ ] Backup size and duration are monitored
- [ ] Storage usage alerts work correctly
- [ ] Recovery time metrics are tracked

## 🔄 CI/CD Pipeline

### Automated Testing
- [ ] All unit tests pass with >95% coverage
- [ ] Integration tests pass against real services
- [ ] End-to-end tests validate complete workflows
- [ ] Security scanning passes without critical issues
- [ ] Performance tests meet baseline requirements

### Deployment Process
- [ ] Terraform plan validation passes
- [ ] Infrastructure changes deploy successfully
- [ ] Application deployment completes without errors
- [ ] Database migrations run successfully
- [ ] Rollback procedures work when needed

## 🏗 HashiCorp Cloud Platform (HCP)

### HCP Terraform
- [ ] Workspace configuration is correct and accessible
- [ ] Remote state management works properly
- [ ] Plan and apply operations complete successfully
- [ ] Variable sets are configured correctly
- [ ] Run triggers work for automated deployments

### HCP Vault (if enabled)
- [ ] Vault integration provides secrets correctly
- [ ] Secret rotation works automatically
- [ ] Access policies are properly configured
- [ ] Audit logs capture all operations

## 🐳 Containerization & Deployment

### Docker Containers
- [ ] Application builds correctly with multi-stage Dockerfile
- [ ] Container starts successfully with proper health checks
- [ ] Environment variables are injected correctly
- [ ] Log output is properly formatted and accessible
- [ ] Container security scanning passes

### Kubernetes Deployment (if applicable)
- [ ] Pods start successfully with proper resource limits
- [ ] Service discovery works between components
- [ ] Ingress routes traffic correctly
- [ ] Horizontal pod autoscaling functions properly

## 📈 Performance Testing

### Load Testing
- [ ] API handles expected concurrent users
- [ ] Database queries perform within acceptable limits
- [ ] Memory usage remains stable under load
- [ ] Response times meet SLA requirements
- [ ] Error rates remain below thresholds

### Stress Testing
- [ ] Application degrades gracefully under extreme load
- [ ] Circuit breakers activate appropriately
- [ ] Resource exhaustion doesn't cause crashes
- [ ] Recovery after stress test is complete

## 🔄 End-to-End Integration Scenarios

### Complete Workflow Tests
- [ ] New user onboarding through complete flow creation and execution
- [ ] Multi-tenant scenario with organization isolation
- [ ] External API integration (GitHub, Slack, Jira) works end-to-end
- [ ] Webhook-triggered workflows execute correctly
- [ ] Scheduled workflows run at specified times

### Business Process Validation
- [ ] Customer use case scenarios execute successfully
- [ ] Data consistency maintained across all operations
- [ ] Audit trails capture all significant events
- [ ] Error recovery procedures work in practice

## 📋 Pre-Release Checklist

### Final Validations
- [ ] All critical bugs resolved and verified
- [ ] Performance benchmarks meet requirements
- [ ] Security review completed and approved
- [ ] Documentation reviewed and updated
- [ ] Release notes finalized and accurate

### Production Readiness
- [ ] Production environment configured correctly
- [ ] Monitoring and alerting systems active
- [ ] Support procedures documented and tested
- [ ] Rollback procedures validated
- [ ] Team training completed on new features

---

## 🎯 QA Sign-off

**QA Lead:** _________________ **Date:** _________

**Engineering Lead:** _________________ **Date:** _________

**Product Owner:** _________________ **Date:** _________

---

## 📝 Notes

Use this section to document any issues found during testing, their resolution, and any deviations from the standard test procedures.

**Testing Environment:**
- Database: _________________ 
- Redis: _________________
- AWS Region: _________________
- Application Version: _________________
- Git Commit: _________________

**Test Results Summary:**
- Total Tests: ___ / ___
- Pass Rate: ___%
- Critical Issues: ___
- Non-Critical Issues: ___
- Testing Duration: ___ hours
- Testing Completion Date: _________