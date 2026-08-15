# 📋 Deployment & Operations Guide

**Week 4 Execution Handbook**  
**Production Deployment Procedures**  
**Operational Runbooks**  

---

## 🚀 QUICK START

### 1. Local Development (Docker)

```bash
# Start complete stack locally
docker-compose up -d

# Verify services
docker-compose ps

# Check API health
curl http://localhost:3001/health

# View logs
docker-compose logs -f api

# Stop stack
docker-compose down
```

### 2. Run Full Test Suite

```bash
cd transcend-frontend

# Run all E2E tests
npm run cy:run

# Run load test
k6 run ../transcend-frontend/k6-performance.js

# Generate test report
npm run cy:report
```

### 3. Deploy to AWS Staging

```bash
# Set environment variables
export DB_PASSWORD="your-secure-password"
export JWT_SECRET="your-jwt-secret"
export KEY_PAIR_NAME="your-aws-key"
export SENTRY_DSN="your-sentry-dsn"

# Run deployment script
bash scripts/deploy-aws-staging.sh

# Monitor deployment
aws cloudformation describe-stacks --stack-name transcend-law-staging
```

---

## 📦 DOCKER DEPLOYMENT

### Build Docker Image

```bash
# Build production image
docker build -t transcend-law:latest .

# Build for specific environment
docker build -t transcend-law:staging \
  --build-arg NODE_ENV=staging .

# Tag for ECR
docker tag transcend-law:latest \
  123456789.dkr.ecr.us-east-1.amazonaws.com/transcend-law:latest

# Push to ECR
docker push 123456789.dkr.ecr.us-east-1.amazonaws.com/transcend-law:latest
```

### Run Docker Container

```bash
# Run with environment file
docker run -d \
  --name transcend-api \
  --env-file .env.production \
  -p 3001:3001 \
  transcend-law:latest

# Run with health check
docker run -d \
  --name transcend-api \
  --health-cmd='curl -f http://localhost:3001/health || exit 1' \
  --health-interval=30s \
  --health-timeout=3s \
  --health-retries=3 \
  -p 3001:3001 \
  transcend-law:latest

# Check health status
docker ps | grep transcend-api
```

---

## 🔧 AWS INFRASTRUCTURE

### Prerequisites

```bash
# Install AWS CLI
brew install awscli

# Configure AWS credentials
aws configure

# Verify credentials
aws sts get-caller-identity
```

### RDS PostgreSQL

```bash
# Connect to RDS
psql -h transcend-law-staging.c6srnxulmmvp.us-east-1.rds.amazonaws.com \
     -U admin \
     -d transcend_law

# Run database migrations
psql -h $DB_HOST -U $DB_USER -d $DB_NAME \
  -f transcend-api/src/database/schema.sql

# Create backup
aws rds create-db-snapshot \
  --db-instance-identifier transcend-law-staging \
  --db-snapshot-identifier transcend-law-backup-$(date +%Y%m%d)

# Restore from backup
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier transcend-law-restored \
  --db-snapshot-identifier transcend-law-backup-20260820
```

### EC2 Deployment

```bash
# SSH into EC2 instance
ssh -i transcend-law.pem ec2-user@ec2-instance-ip

# Clone repository
git clone https://github.com/cejsburlew-crypto/transcend-law.git
cd transcend-law

# Install dependencies
npm ci --only=production

# Build Docker image
docker build -t transcend-api:latest .

# Run container
docker run -d \
  --name transcend-api \
  -p 3001:3001 \
  -e NODE_ENV=staging \
  -e DATABASE_URL=$DATABASE_URL \
  transcend-api:latest

# Verify deployment
curl http://localhost:3001/health
```

### S3 Document Storage

```bash
# Upload test document
aws s3 cp test-document.pdf s3://transcend-law-staging-docs/

# List bucket contents
aws s3 ls s3://transcend-law-staging-docs/

# Enable versioning
aws s3api put-bucket-versioning \
  --bucket transcend-law-staging-docs \
  --versioning-configuration Status=Enabled

# Enable encryption
aws s3api put-bucket-encryption \
  --bucket transcend-law-staging-docs \
  --server-side-encryption-configuration file://encryption.json
```

---

## 📊 MONITORING & LOGGING

### Sentry Error Tracking

```bash
# Initialize Sentry (in code)
import * as Sentry from "@sentry/node";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: 'staging',
  tracesSampleRate: 0.1,
});

# View errors in Sentry dashboard
# https://sentry.io/organizations/transcend-law/issues/
```

### CloudWatch Logs

```bash
# View RDS logs
aws logs tail /aws/rds/instance/transcend-law-staging/postgresql --follow

# View EC2 logs
aws logs tail /aws/ec2/transcend-law-staging --follow

# Search logs
aws logs filter-log-events \
  --log-group-name /aws/rds/instance/transcend-law-staging/postgresql \
  --filter-pattern "ERROR"
```

### DataDog Integration

```bash
# Install DataDog agent on EC2
DD_AGENT_MAJOR_VERSION=7 \
  DD_API_KEY=$DATADOG_API_KEY \
  DD_SITE=datadoghq.com \
  bash -c "$(curl -L https://s3.amazonaws.com/dd-agent/scripts/install_agent.sh)"

# Verify agent running
sudo systemctl status datadog-agent

# View metrics in DataDog dashboard
# https://app.datadoghq.com/dashboards/
```

---

## 🔍 HEALTH CHECKS & DIAGNOSTICS

### API Health Checks

```bash
# Full health check
curl -v http://localhost:3001/health

# Expected response:
# {
#   "status": "healthy",
#   "uptime": 1234,
#   "database": "connected",
#   "cache": "connected",
#   "timestamp": "2026-08-20T12:00:00Z"
# }
```

### Database Health

```bash
# Check connection
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "SELECT now();"

# Check tables
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "\dt"

# Check indexes
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "\di"

# Check active connections
psql -h $DB_HOST -U $DB_USER -d $DB_NAME \
  -c "SELECT count(*) FROM pg_stat_activity;"
```

### API Performance

```bash
# Load test
k6 run k6-performance.js

# Monitor specific endpoint
watch -n 1 'curl -w "@curl-format.txt" http://localhost:3001/api/v2/cases'
```

---

## 🚨 TROUBLESHOOTING

### Issue: API Not Responding

```bash
# Check if container is running
docker ps | grep transcend-api

# View logs
docker logs transcend-api

# Restart container
docker restart transcend-api

# Check port availability
lsof -i :3001

# Restart from scratch
docker stop transcend-api
docker rm transcend-api
docker run ... transcend-api
```

### Issue: Database Connection Error

```bash
# Test connection
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "\l"

# Check security groups
aws ec2 describe-security-groups --group-ids sg-xxxxx

# View RDS logs
aws logs tail /aws/rds/instance/transcend-law-staging/postgresql --follow

# Restart RDS
aws rds reboot-db-instance --db-instance-identifier transcend-law-staging
```

### Issue: High Memory Usage

```bash
# Check memory
docker stats transcend-api

# Check Node processes
ps aux | grep node

# Increase memory limit
docker update --memory=2g transcend-api

# Restart with new memory
docker restart transcend-api
```

---

## 📈 PERFORMANCE OPTIMIZATION

### Database Query Performance

```bash
# Enable query logging
ALTER SYSTEM SET log_min_duration_statement = 100;
SELECT pg_reload_conf();

# View slow queries
tail -f /var/log/postgresql/postgresql.log | grep "duration:"

# Analyze query plan
EXPLAIN ANALYZE SELECT * FROM cases WHERE status = 'open';

# Add missing index
CREATE INDEX idx_cases_status ON cases(status);
```

### Cache Optimization

```bash
# Monitor Redis
redis-cli monitor

# Check memory usage
redis-cli INFO memory

# Flush cache (careful!)
redis-cli FLUSHDB

# Set cache expiry
redis-cli EXPIRE key 300
```

---

## 🔐 SECURITY OPERATIONS

### Rotate Secrets

```bash
# Generate new secrets
openssl rand -base64 32  # For JWT_SECRET
openssl rand -base64 32  # For API_KEY

# Update secrets in AWS Secrets Manager
aws secretsmanager put-secret-value \
  --secret-id transcend-law-staging/jwt-secret \
  --secret-string "new-secret-value"

# Restart application
docker restart transcend-api
```

### Security Audit

```bash
# Run security scan
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
  aquasec/trivy image transcend-law:latest

# Check dependencies
npm audit

# Review security groups
aws ec2 describe-security-groups --group-ids sg-xxxxx
```

---

## 📋 RUNBOOK CHECKLIST

### Daily Operations
- [ ] Check API health: `curl /health`
- [ ] Monitor error rates: Check Sentry
- [ ] Review database logs: Check CloudWatch
- [ ] Verify backups running: AWS RDS backups
- [ ] Monitor disk usage: EC2 storage

### Weekly Operations
- [ ] Review performance metrics: DataDog
- [ ] Analyze slow queries: PostgreSQL logs
- [ ] Update dependencies: `npm audit fix`
- [ ] Security update review
- [ ] Capacity planning review

### Monthly Operations
- [ ] Database optimization: ANALYZE/VACUUM
- [ ] Index review and optimization
- [ ] Access review (AWS IAM)
- [ ] Cost analysis (AWS Cost Explorer)
- [ ] Disaster recovery drill

---

## 🚨 INCIDENT RESPONSE

### On-Call Escalation

```
Tier 1: Application error → Fix in code → Deploy
Tier 2: Database error → DB admin intervention
Tier 3: Infrastructure error → AWS support
```

### Rollback Procedure

```bash
# Identify last working version
git log --oneline | head -10

# Rollback to previous commit
git revert HEAD

# Rebuild and deploy
docker build -t transcend-law:rollback .
docker run ... transcend-law:rollback

# Verify rollback
curl http://localhost:3001/health
```

---

## 📊 DEPLOYMENT CHECKLIST

**Pre-Deployment**
- [ ] All tests passing
- [ ] Code reviewed
- [ ] Security scan clean
- [ ] Performance baseline recorded
- [ ] Backup created

**Deployment**
- [ ] DNS switch (if applicable)
- [ ] Health checks passing
- [ ] Monitoring alerts active
- [ ] On-call team ready
- [ ] Communication channels open

**Post-Deployment**
- [ ] Monitor error rates (1 hour)
- [ ] Check performance metrics
- [ ] Verify user signups
- [ ] Monitor payment processing
- [ ] Team standup (2-4 hours)

---

**Ready for Week 4 Deployment!** 🚀

All infrastructure, automation, and procedures in place.

Execute deployment with confidence.
