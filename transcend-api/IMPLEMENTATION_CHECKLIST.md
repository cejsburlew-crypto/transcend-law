# Key Rotation Implementation Checklist

Complete integration of encryption key rotation system with your Transcend Law Platform.

## Phase 1: Setup and Configuration

- [ ] **Generate Master Key**
  ```bash
  openssl rand -hex 32
  # OR
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```
  - Store in AWS Secrets Manager / HashiCorp Vault
  - Add to `.env` file (dev only)

- [ ] **Create `.env` File**
  ```bash
  cp transcend-api/.env.example transcend-api/.env
  # Edit .env with your configuration
  ```

- [ ] **Install Dependencies** (if needed)
  ```bash
  # Verify crypto module (built-in, no installation needed)
  node -e "console.log(require('crypto').version)"
  ```

- [ ] **Database Configuration**
  - Verify PostgreSQL connection details
  - Ensure database user has permissions to create tables

## Phase 2: Database Setup

- [ ] **Initialize Key Rotation Tables**
  ```typescript
  // src/index.ts or startup script
  import { initializeKeyRotationSystem } from './services/keyRotationService';
  
  // During app initialization
  await initializeKeyRotationSystem();
  ```

- [ ] **Verify Tables Created**
  ```sql
  \dt encryption_keys
  \dt encryption_key_archive
  \dt key_rotation_jobs
  ```

- [ ] **Create Backup of Initial Setup**
  ```bash
  pg_dump transcend_law > backup-initial.sql
  ```

## Phase 3: Service Integration

- [ ] **Register Key Rotation Routes**
  ```typescript
  // src/index.ts
  import keyRotationRoutes from './routes/keyRotation';
  
  app.use('/api/key-rotation', keyRotationRoutes);
  ```

- [ ] **Initialize Scheduler on Startup**
  ```typescript
  // src/index.ts
  import { initializeScheduler } from './services/keyRotationScheduler';
  
  // After app initialization
  await initializeScheduler({
    rotationCron: '0 2 1 * *',     // 2 AM on 1st
    testCron: '0 3 * * 0',         // 3 AM on Sunday
    enableAutoRotation: true,
    enableAutoTesting: true,
  });
  ```

- [ ] **Add Graceful Shutdown**
  ```typescript
  import { stopScheduler } from './services/keyRotationScheduler';
  
  process.on('SIGTERM', async () => {
    stopScheduler();
    // ... other cleanup
  });
  ```

## Phase 4: Data Model Integration

### For Each Sensitive Data Field:

- [ ] **Add Encryption on Create**
  ```typescript
  import { encryptData } from '../services/keyRotationService';
  
  // When storing sensitive data
  const encrypted = await encryptData(sensitiveData);
  await db.query(
    `INSERT INTO table (encrypted_field, key_version) 
     VALUES ($1, $2)`,
    [JSON.stringify(encrypted), encrypted.keyVersion]
  );
  ```

- [ ] **Add Decryption on Read**
  ```typescript
  import { decryptData } from '../services/keyRotationService';
  
  // When retrieving sensitive data
  const row = await db.query('SELECT encrypted_field FROM table WHERE id = $1', [id]);
  const decrypted = await decryptData(JSON.parse(row.rows[0].encrypted_field));
  ```

### Example: User PII

```typescript
// src/models/User.ts
import { encryptData, decryptData } from '../services/keyRotationService';

export class User {
  async create(userData: UserData) {
    const encrypted = await encryptData(JSON.stringify({
      ssn: userData.ssn,
      phone: userData.phone,
      address: userData.address,
    }));

    return db.query(
      `INSERT INTO users (encrypted_pii, key_version)
       VALUES ($1, $2)
       RETURNING *`,
      [JSON.stringify(encrypted), encrypted.keyVersion]
    );
  }

  async getById(id: string) {
    const row = await db.query(
      'SELECT encrypted_pii FROM users WHERE id = $1',
      [id]
    );

    if (!row.rows[0]) return null;

    const pii = await decryptData(JSON.parse(row.rows[0].encrypted_pii));
    return JSON.parse(pii);
  }
}
```

## Phase 5: Testing

- [ ] **Run Test Suite**
  ```bash
  npm test -- src/services/__tests__/keyRotation.test.ts
  ```

- [ ] **Manual Rotation Test**
  ```bash
  curl -X POST http://localhost:3000/api/key-rotation/test \
    -H "Authorization: Bearer <admin-token>" \
    -H "Content-Type: application/json"
  ```

- [ ] **Check Scheduler Status**
  ```bash
  curl http://localhost:3000/api/key-rotation/scheduler/status \
    -H "Authorization: Bearer <admin-token>"
  ```

- [ ] **Verify Initial Encryption Key**
  ```bash
  curl http://localhost:3000/api/key-rotation/keys \
    -H "Authorization: Bearer <admin-token>"
  ```

## Phase 6: Monitoring Setup

- [ ] **Add Health Check Endpoint**
  ```typescript
  app.get('/health/key-rotation', async (req, res) => {
    const health = await getSchedulerHealth();
    const statusCode = health.recentErrors > 5 ? 503 : 200;
    res.status(statusCode).json(health);
  });
  ```

- [ ] **Configure Alerts**
  - Email on rotation failure
  - Alert on high error rate (>5 errors in 24h)
  - Alert on rotation delays

- [ ] **Setup Logging**
  ```typescript
  // Log all key rotation operations
  import logger from './logger';
  
  // Already integrated in services
  // Review logs in /var/log/transcend/key-rotation/
  ```

- [ ] **Add Metrics**
  - Track rotation duration
  - Monitor re-encryption batch performance
  - Watch key version distribution

## Phase 7: Documentation

- [ ] **Create Runbook**
  ```markdown
  ## Key Rotation Runbook
  
  ### Manual Rotation
  POST /api/key-rotation/rotate
  
  ### Check Status
  GET /api/key-rotation/history
  
  ### Rollback
  POST /api/key-rotation/rollback/{jobId}
  ```

- [ ] **Document Encryption Fields**
  - List all tables with encrypted fields
  - Document encryption key storage format
  - Document decryption procedure

- [ ] **Create Troubleshooting Guide**
  - Common errors and solutions
  - Recovery procedures
  - Support contacts

## Phase 8: Deployment

- [ ] **Development Environment**
  - [ ] Test full cycle locally
  - [ ] Verify scheduler works
  - [ ] Test rollback procedure

- [ ] **Staging Environment**
  - [ ] Deploy with real data (anonymized)
  - [ ] Run rotation cycle
  - [ ] Monitor performance
  - [ ] Verify audit logs

- [ ] **Production Deployment**
  - [ ] Plan deployment window
  - [ ] Backup all databases
  - [ ] Deploy changes gradually
  - [ ] Verify scheduler running
  - [ ] Monitor first rotation (manual trigger)

### Deployment Steps

```bash
# 1. Merge PR to main
git merge feature/key-rotation

# 2. Deploy to production
npm run build
npm run deploy

# 3. Verify deployment
curl https://api.transcend-law.com/api/key-rotation/scheduler/status \
  -H "Authorization: Bearer <admin-token>"

# 4. Trigger first rotation (if needed)
curl -X POST https://api.transcend-law.com/api/key-rotation/rotate \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{"force": true}'

# 5. Monitor rotation progress
curl https://api.transcend-law.com/api/key-rotation/scheduler/health \
  -H "Authorization: Bearer <admin-token>"
```

## Phase 9: Post-Deployment

- [ ] **Verify Scheduler Running**
  ```bash
  curl https://api.transcend-law.com/api/key-rotation/scheduler/status
  ```

- [ ] **Check Key Status**
  ```bash
  curl https://api.transcend-law.com/api/key-rotation/keys
  ```

- [ ] **Monitor First Week**
  - [ ] Review daily logs
  - [ ] Check execution history
  - [ ] Verify weekly test completed
  - [ ] Verify no errors in scheduler

- [ ] **Verify Monthly Rotation**
  - [ ] Confirm next rotation scheduled
  - [ ] Verify rotation notification email received
  - [ ] Monitor rotation execution
  - [ ] Verify data re-encryption completed

## Phase 10: Maintenance

### Weekly
- [ ] Review rotation test results
- [ ] Check scheduler health status
- [ ] Review audit logs for anomalies

### Monthly
- [ ] After rotation: verify successful completion
- [ ] Check key version advancement
- [ ] Review re-encryption performance
- [ ] Verify archive integrity

### Quarterly
- [ ] Test disaster recovery procedure
- [ ] Audit all encrypted data readable
- [ ] Test rollback procedure (non-prod)
- [ ] Update documentation

### Annually
- [ ] Rotate master key
- [ ] Review retention policies
- [ ] Security audit of key management
- [ ] Performance optimization review

## Troubleshooting Checklist

If rotation fails:

- [ ] Check master key configured
  ```bash
  echo $ENCRYPTION_MASTER_KEY
  ```

- [ ] Verify database connection
  ```bash
  psql -U $DB_USER -h $DB_HOST $DB_NAME -c "SELECT COUNT(*) FROM encryption_keys"
  ```

- [ ] Check scheduler status
  ```bash
  curl http://localhost:3000/api/key-rotation/scheduler/status
  ```

- [ ] Review error logs
  ```bash
  curl http://localhost:3000/api/key-rotation/scheduler/execution-history
  ```

- [ ] If needed, trigger rollback
  ```bash
  curl -X POST http://localhost:3000/api/key-rotation/rollback/{jobId} \
    -H "Content-Type: application/json" \
    -d '{"reason": "Manual rollback for troubleshooting"}'
  ```

## Security Checklist

Before production:

- [ ] Master key stored in KMS (not in code/git)
- [ ] Database credentials use strong passwords
- [ ] Admin API endpoints require authentication
- [ ] All operations logged with audit trail
- [ ] Scheduled backups of encryption keys
- [ ] Access logs reviewed regularly
- [ ] Incident response plan documented

## Performance Checklist

Before production:

- [ ] Batch size optimized for your data volume
- [ ] Re-encryption scheduled during off-peak hours
- [ ] Database indexes on encrypted fields
- [ ] Connection pool properly sized
- [ ] Memory usage monitored during rotation
- [ ] CPU usage acceptable during rotation

## Compliance Checklist

- [ ] Key rotation meets regulatory requirements
- [ ] Audit trail meets compliance standards
- [ ] Encryption algorithm meets security standards
- [ ] Data retention policies documented
- [ ] Disaster recovery procedures documented
- [ ] Security policy updated

## Sign-off

- [ ] **Development Lead**: _________________ Date: _______
- [ ] **DevOps Lead**: _________________ Date: _______
- [ ] **Security Lead**: _________________ Date: _______
- [ ] **Product Manager**: _________________ Date: _______

---

**Implementation Date**: _______________
**Go-Live Date**: _______________
**Notes**: _______________________________________________

---

For support or questions, contact: security@transcend-law.com
