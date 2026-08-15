# 💾 DATA RETENTION & BACKUP POLICIES

**Production Data Management**

---

## 🔄 BACKUP STRATEGY

### RDS Backup

```
Automated Backups:
├── Frequency: Daily at 02:00 UTC
├── Retention: 30 days
├── Point-in-time: Last 7 days (continuous)
├── Backup window: 5 minutes
└── RPO: 24 hours

Manual Backups:
├── Before major changes
├── Pre-launch (Day 5)
├── Quarterly archive
└── Retention: 3 years (compliance)

Verification:
├── Test restore monthly
├── Verify data integrity
└── Monitor backup size
```

### S3 Backup

```
Versioning:
├── All versions kept
├── Retention: 7 years (compliance)
├── Cross-region replication
└── Transfer cost: ~$50/month

Point-in-time:
├── Snapshots: Weekly
├── Archive: After 90 days
└── Retrieval time: 5 min (standard) → 12 hours (glacier)
```

---

## 📋 DATA RETENTION

### User Data

```
Active Users: Kept indefinitely
├── Login credentials
├── Profile info
├── Preferences
└── Subscription status

Deleted Users: 90-day hold
├── Soft delete (marked deleted_at)
├── Reversible if customer requests
├── Hard delete after 90 days
└── GDPR compliant
```

### Case Data

```
Open Cases: Kept indefinitely
Closed Cases: Kept 3 years (legal hold)
├── Documents: 3 years
├── Conversations: 3 years
├── Audit logs: 7 years
└── Billing records: 7 years

Anonymization:
├── After retention period: Anonymize
├── Remove PII
└── Keep for analytics only
```

### Transaction Data

```
Payment Records: 7 years (tax/legal)
├── Invoices: Complete history
├── Transaction logs: Complete history
└── Audit trail: Complete history

Retention End: Delete per compliance
```

---

## 🔐 DISASTER RECOVERY

### RTO/RPO Targets

```
RTO (Recovery Time Objective): 15 minutes
RPO (Recovery Point Objective): 1 hour

Backup Locations:
├── Primary: AWS us-east-1
├── Secondary: AWS us-west-2 (replication)
└── Tertiary: Tape archive (offsite)
```

### Recovery Procedures

```
Minor Data Loss (< 1 hour):
1. Restore from point-in-time backup
2. Verify data
3. Notify affected users
Time: 15 minutes

Major Data Loss (corruption):
1. Restore from daily backup
2. Verify integrity
3. Rebuild from logs if needed
4. Notify users
Time: 2 hours

Complete Failure:
1. Failover to read replica
2. Or restore from cross-region backup
3. Verify all systems
Time: < 30 minutes
```

---

**Data Retention & Backup: READY ✅**
