# Transcend Law - Complete Deployment Guide

**Status:** Production-ready (24/24 phases complete)  
**Repository:** https://github.com/cejsburlew-crypto/transcend-law  
**Date:** August 21, 2026

---

## Quick Start (5 minutes)

```bash
# 1. Clone repository
git clone https://github.com/cejsburlew-crypto/transcend-law.git
cd transcend-law

# 2. Install dependencies
npm install

# 3. Start services
docker-compose up -d
npm run migrate:indexes

# 4. Start API (Terminal 1)
cd transcend-law/backend
npm start

# 5. Start frontend (Terminal 2)
cd transcend-law/web
npm run dev

# 6. Verify
curl http://localhost:3000/metrics/health
```

**Available at:**
- Frontend: http://localhost:5173
- API: http://localhost:3000
- Metrics: http://localhost:3000/metrics/stats

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                  Client Layer                           │
├──────────────────────────────┬──────────────────────────┤
│  Web (React 18 + TS)         │  Mobile (React Native)   │
│  7 pages, 10 tabs            │  8 screens, offline      │
│  Real-time WebSocket         │  Native camera, push     │
└──────────────────────────────┴──────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│              API Layer (Express.js)                     │
├──────────────────────────────────────────────────────────┤
│  25+ REST endpoints                                      │
│  WebSocket (Socket.IO)                                  │
│  JWT authentication + RBAC                              │
│  Performance tracking middleware                        │
└──────────────────────────────────────────────────────────┘
                        ↓
┌──────────────────────────────┬──────────────────────────┐
│  PostgreSQL Database         │  Redis Cache (optional)  │
│  8 tables, 24 indexes        │  TTL-based caching      │
│  Full audit trails           │  Memory-efficient        │
└──────────────────────────────┴──────────────────────────┘
```

---

## Environment Setup

### Development
```bash
# .env.local
NODE_ENV=development
DATABASE_URL=postgresql://user:password@localhost:5432/transcend_db
JWT_SECRET=dev-secret-do-not-use-in-production
CORS_ORIGIN=http://localhost:5173
LOG_LEVEL=debug
```

### Production
```bash
# .env.production
NODE_ENV=production
DATABASE_URL=postgresql://user:secure-password@prod-db:5432/transcend_db
JWT_SECRET=$(openssl rand -hex 32)
CORS_ORIGIN=https://transcendlaw.com,https://app.transcendlaw.com
SENTRY_DSN=https://key@sentry.io/project
LOG_LEVEL=info
AWS_S3_BUCKET=transcend-law-documents
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your-token
EMAIL_HOST=smtp.sendgrid.net
EMAIL_USER=apikey
EMAIL_PASSWORD=your-sendgrid-key
```

---

## Database Setup

### Initial Migration
```bash
cd transcend-law/backend

# Create database
psql -U postgres -c "CREATE DATABASE transcend_db;"

# Run schema
psql -U postgres -d transcend_db -f src/db/schema.sql

# Apply performance indexes
psql -U postgres -d transcend_db -f src/db/migrations/010_performance_indexes.sql

# Verify tables
psql -U postgres -d transcend_db -c "\dt"
```

### Backup Strategy
```bash
# Daily backup
0 2 * * * pg_dump $DATABASE_URL | gzip > /backups/db-$(date +%Y%m%d).sql.gz

# Weekly archive
0 3 * * 0 mv /backups/db-*.sql.gz /archive/

# Monthly retention
find /archive -mtime +90 -delete
```

---

## Deployment Strategies

### Option 1: Docker Compose (Staging)
```yaml
# docker-compose.prod.yml
version: '3.8'
services:
  api:
    image: transcend-law-api:latest
    environment:
      NODE_ENV: production
    ports:
      - "3000:3000"
    depends_on:
      - postgres
      - redis

  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: transcend_db
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

volumes:
  postgres_data:
```

**Deploy:**
```bash
docker-compose -f docker-compose.prod.yml up -d
docker-compose -f docker-compose.prod.yml logs -f api
```

### Option 2: Kubernetes (Production)
```yaml
# k8s/api-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: transcend-api
  namespace: production
spec:
  replicas: 3
  selector:
    matchLabels:
      app: transcend-api
  template:
    metadata:
      labels:
        app: transcend-api
    spec:
      containers:
      - name: api
        image: transcend-law-api:latest
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: db-secrets
              key: connection-string
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /metrics/health
            port: 3000
          initialDelaySeconds: 10
          periodSeconds: 10
```

**Deploy:**
```bash
kubectl apply -f k8s/
kubectl rollout status deployment/transcend-api
```

### Option 3: Heroku (Simple)
```bash
# Create app
heroku create transcend-law-prod

# Set environment
heroku config:set NODE_ENV=production
heroku config:set JWT_SECRET=$(openssl rand -hex 32)

# Add PostgreSQL
heroku addons:create heroku-postgresql:standard-0

# Deploy
git push heroku main

# View logs
heroku logs --tail
```

---

## Performance Verification

### Health Check
```bash
curl -s http://localhost:3000/metrics/health | jq .
```

Expected response:
```json
{
  "status": "healthy",
  "reason": "All systems operational",
  "metrics": {
    "totalRequests": 1250,
    "avgResponseTime": 245,
    "errorRate": 0.8
  }
}
```

### Load Testing
```bash
# Install k6
brew install k6

# Run test
k6 run transcend-law/backend/k6-loadtest.js

# Expected: 5000+ successful requests, <2s p95 latency
```

### Metrics Export (Prometheus)
```bash
# Scrape endpoint
curl http://localhost:3000/metrics/prometheus

# Add to prometheus.yml
scrape_configs:
  - job_name: 'transcend-law'
    static_configs:
      - targets: ['localhost:3000']
    metrics_path: '/metrics/prometheus'
```

---

## Monitoring Setup

### Sentry (Error Tracking)
```bash
# Install SDK
npm install @sentry/node

# Initialize (in index.ts)
import * as Sentry from "@sentry/node";
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
});
```

### Prometheus (Metrics)
```yaml
# docker-compose.yml addition
prometheus:
  image: prom/prometheus:latest
  volumes:
    - ./prometheus.yml:/etc/prometheus/prometheus.yml
  ports:
    - "9090:9090"
  command:
    - '--config.file=/etc/prometheus/prometheus.yml'
```

### Grafana (Dashboards)
```bash
docker run -d -p 3001:3000 grafana/grafana:latest

# Login: admin/admin
# Add Prometheus data source: http://prometheus:9090
# Import dashboard from grafana.com or create custom
```

---

## Scaling Strategy

### Horizontal Scaling (Multiple Instances)
```bash
# Start 3 API instances
for i in {1..3}; do
  PORT=$((3000 + i)) node transcend-law/backend/src/index.js &
done

# Use nginx for load balancing
upstream transcend_api {
  server localhost:3001;
  server localhost:3002;
  server localhost:3003;
}

server {
  listen 80;
  location / {
    proxy_pass http://transcend_api;
  }
}
```

### Database Connection Pooling
```typescript
// Use pgBouncer for connection pooling
const pool = new Pool({
  max: 30,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});
```

### Caching Strategy
```typescript
// Use Redis for distributed caching
const redis = new Redis({
  host: process.env.REDIS_HOST,
  port: 6379,
  maxRetriesPerRequest: 3,
});

// Cache case list for 5 minutes
const casesCacheKey = `cases:org:${orgId}`;
const cached = await redis.get(casesCacheKey);
if (!cached) {
  const cases = await caseService.listByOrg(orgId);
  await redis.setex(casesCacheKey, 300, JSON.stringify(cases));
}
```

---

## Mobile App Deployment

### iOS (TestFlight)
```bash
cd transcend-law/mobile

# Build for iOS
eas build --platform ios

# Upload to TestFlight
eas submit --platform ios

# Status
eas build:list
```

### Android (Google Play)
```bash
# Build for Android
eas build --platform android

# Upload to Play Console
eas submit --platform android

# Configure in app.json:
# "extra": {
#   "eas": {
#     "projectId": "your-eas-project-id"
#   }
# }
```

---

## Security Checklist

- [ ] Change JWT_SECRET to random 32-byte value
- [ ] Enable HTTPS (use Let's Encrypt)
- [ ] Configure CORS to specific domains only
- [ ] Enable database encryption at rest
- [ ] Set up database backups (daily, tested)
- [ ] Enable audit logging for sensitive operations
- [ ] Configure WAF (Web Application Firewall)
- [ ] Set up DDoS protection (Cloudflare)
- [ ] Enable security headers (HSTS, CSP, X-Frame-Options)
- [ ] Rotate API keys and secrets every 90 days
- [ ] Set up intrusion detection/prevention
- [ ] Enable 2FA for admin accounts
- [ ] Document incident response plan
- [ ] Conduct security audit
- [ ] Obtain compliance certifications (SOC 2, HIPAA)

---

## Troubleshooting

### High Memory Usage
```bash
# Check Node process
ps aux | grep node

# Increase heap size
NODE_OPTIONS="--max-old-space-size=4096" npm start

# Check for memory leaks
node --inspect src/index.js
# Visit chrome://inspect in Chrome DevTools
```

### Database Connection Errors
```bash
# Check connections
psql -c "SELECT * FROM pg_stat_activity;"

# Increase max_connections
# In postgresql.conf: max_connections = 200

# Restart PostgreSQL
sudo service postgresql restart
```

### Slow Queries
```bash
# Enable query logging
psql -d transcend_db -c "
  ALTER SYSTEM SET log_min_duration_statement = 1000;
  SELECT pg_reload_conf();
"

# Check logs
tail -f /var/log/postgresql/postgresql.log | grep duration
```

---

## Rollback Plan

If deployment fails:

```bash
# 1. Stop current deployment
docker-compose stop
# OR
kubectl delete deployment/transcend-api

# 2. Verify previous version is still running
curl http://localhost:3000/health

# 3. If needed, restore from backup
psql -d transcend_db -f /backups/db-previous-day.sql

# 4. Investigate logs
docker-compose logs api
# OR
kubectl logs -f deployment/transcend-api

# 5. Create issue with:
- Error message
- Deployment timestamp
- Affected endpoints
- Database state
```

---

## Cost Estimation (AWS)

| Service | Monthly Cost | Details |
|---------|-------------|---------|
| EC2 (t3.medium × 2) | $60 | API servers |
| RDS PostgreSQL | $100 | db.t3.small with backups |
| ElastiCache Redis | $25 | cache.t3.micro |
| S3 Storage | $10-50 | Documents (1-10 GB) |
| CloudFront CDN | $20 | Content delivery |
| Load Balancer | $20 | ALB |
| Monitoring/Logs | $50 | CloudWatch + Sentry |
| **Total** | **~$275-315** | Scales to 10M+ requests/month |

---

## Support & Maintenance

### Daily
- Monitor error rates (< 1% target)
- Check average response time (< 500ms target)
- Verify backups completed

### Weekly
- Review security logs
- Update dependencies (npm audit)
- Check disk usage

### Monthly
- Run full load test
- Review and optimize slow queries
- Audit access logs
- Backup verification test

### Quarterly
- Security audit
- Disaster recovery drill
- Capacity planning review
- Cost analysis

---

## Getting Help

**Documentation:**
- Architecture: See `/backend/src/` comments
- API: See `/backend/PERFORMANCE.md`
- Mobile: See `/mobile/README.md`

**Debugging:**
1. Check logs: `docker-compose logs -f`
2. Check health: `curl http://localhost:3000/metrics/health`
3. Check database: `psql -d transcend_db -c "\dt"`
4. Monitor memory: `top` or `htop`

**Emergency Contact:**
- On-call: Set via PagerDuty
- Escalation: See incident response plan
- Vendor support: AWS, PostgreSQL, Twilio

---

**Deployment Status:** ✅ Ready for production  
**Last Updated:** August 21, 2026  
**Next Review:** September 21, 2026
