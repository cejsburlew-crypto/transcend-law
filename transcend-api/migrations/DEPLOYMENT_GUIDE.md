# Database Migration Deployment Guide

Complete guide for deploying database migrations to production, staging, and development environments.

## Quick Start

### Run All Migrations
```bash
cd /Users/jbconsultingassociatesinc./code/transcend-ssp/transcend-api/migrations

psql -U postgres -h localhost -d transcend_dev -f 001_create_deployment_tables.sql
psql -U postgres -h localhost -d transcend_dev -f 002_create_activity_logs.sql
psql -U postgres -h localhost -d transcend_dev -f 003_create_immutable_documents.sql
```

## Pre-Deployment Checklist

- [ ] Database backups created
- [ ] PostgreSQL version >= 12.0
- [ ] Extensions available (uuid-ossp, pgcrypto, pg_trgm)
- [ ] Database user has CREATE TABLE, INDEX, FUNCTION permissions
- [ ] Staging environment tested
- [ ] Rollback procedure ready

## Verification

```sql
-- Check tables
SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public' 
  AND tablename IN ('deployments', 'activity_logs', 'immutable_documents');

-- Check indexes
SELECT COUNT(*) FROM pg_indexes WHERE schemaname = 'public';

-- Test inserts
INSERT INTO deployments (type, status, branch, commit, version, environment, deployed_by, deployment_strategy)
VALUES ('frontend', 'pending', 'test', 'abc123', 'v1.0.0', 'development', 'test', 'rolling');
```

## Rollback

```bash
pg_restore -U postgres -h localhost -d transcend_dev \
  --format=custom --no-owner --no-privileges \
  transcend_db_backup.dump
```

