# Transcend Law Platform - Launch Day System

Production-ready automated scripts and runbook for August 25, 2026 production launch.

## Overview

This directory contains five orchestrated bash scripts that automate the entire launch day process from pre-launch verification through post-launch stability verification, with automated rollback capability.

## System Architecture

```
Launch Day Timeline
==================

T-4 hours    01-pre-launch-verification.sh    → GO/NO-GO Decision
     ↓
T=0 (17:00)  02-launch-sequence.sh            → DNS Switch (Point of No Return)
     ↓
T+0 to T+1h  03-realtime-monitoring.sh        → Continuous Metrics Collection
     ↓
T+0 to T+∞   04-automatic-rollback.sh         → Emergency Rollback (if needed)
     ↓
T+4 hours    05-post-launch-verification.sh   → SUCCESS/ESCALATE Decision
```

## Scripts Overview

### 1. Pre-Launch Verification (T-4 hours)

**File**: `01-pre-launch-verification.sh`

**Purpose**: Comprehensive health check of all production infrastructure

**Checks**:
- RDS instance status, backups, encryption
- EC2 instances running and healthy (3 required)
- ALB health and target groups
- S3 bucket accessibility and encryption
- CloudFront distribution status
- Route53 DNS resolution
- SSL/TLS certificate validity
- Monitoring system configuration
- Team availability confirmation

**Output**: GO/NO-GO decision with detailed status report

**Execution**:
```bash
./01-pre-launch-verification.sh
```

**Exit Codes**:
- `0` = GO FOR LAUNCH (all checks passed)
- `1` = NO-GO FOR LAUNCH (critical issues detected)

### 2. Launch Sequence (T=0, 17:00 UTC)

**File**: `02-launch-sequence.sh`

**Purpose**: Execute production DNS switch and verify live status

**CRITICAL**: This is the point of no return - DNS switches production traffic

**Steps**:
1. Retrieve production ALB DNS name
2. Update Route53 to point production domain to production ALB
3. Wait 60 seconds for DNS propagation
4. Test API connectivity
5. Verify system status is LIVE

**Output**: LIVE status confirmation with timestamp and verification results

**Execution**:
```bash
./02-launch-sequence.sh
```

**Key Configuration**:
- Domain: `production.transcendlaw.com`
- ALB DNS: Retrieved dynamically from AWS
- Hosted Zone ID: `Z1234567890ABC` (set via environment)
- TTL: 60 seconds
- DNS Propagation Wait: 60 seconds

### 3. Real-Time Monitoring (T+0 to T+1 hour)

**File**: `03-realtime-monitoring.sh`

**Purpose**: Collect and display golden signals continuously during critical period

**Metrics Collected** (every 30 seconds):
- **Latency**: P50, P95, P99 percentiles
- **Error Rate**: HTTP 5xx errors as percentage
- **Saturation**: Database connections, CPU utilization
- **Traffic**: Requests per second (RPS)
- **API Endpoints**: Health check on 5 critical endpoints
- **Database**: Query latency, replication lag
- **Cache**: Hit rate, memory usage
- **User Activity**: Signups, transactions, active users

**Display**: Real-time metrics dashboard updated every 30 seconds

**Execution**:
```bash
./03-realtime-monitoring.sh
```

**Alerts**: Automatically triggers warnings if:
- P95 latency > 500ms
- Error rate > 5%
- Database connection saturation > 80%
- Cache hit rate < 80%

### 4. Automatic Rollback (Triggered by Failure)

**File**: `04-automatic-rollback.sh`

**Purpose**: Automated rollback to staging if critical failure detected

**Rollback Trigger**:
- Error rate > 5% for 2 consecutive minutes

**Rollback Actions**:
1. Retrieve staging ALB DNS
2. Update Route53 to point production domain to staging ALB
3. Wait 60 seconds for DNS propagation
4. Verify staging API is healthy
5. Create incident record

**Modes**:
```bash
# Continuous monitoring (auto-rollback if triggered)
./04-automatic-rollback.sh continuous

# Manual rollback (with operator confirmation)
./04-automatic-rollback.sh manual
```

**Output**: Rollback status, incident record, notification to team

### 5. Post-Launch Verification (T+4 hours)

**File**: `05-post-launch-verification.sh`

**Purpose**: Verify system stability for past 2+ hours and establish baseline metrics

**Verifications** (over 2-4 hour period):
- Error rate < 0.1%
- Latency P95 < 500ms
- Cache hit rate > 80%
- Database healthy (no connection errors, CPU <80%, replication lag <1s)
- Security: SSL valid, headers configured, no alerts
- Uptime > 99.9%
- User activity metrics

**Output**: Comprehensive report + SUCCESS or ESCALATE decision

**Execution**:
```bash
./05-post-launch-verification.sh
```

**Report**: Generated markdown report saved to `logs/post-launch-report-*.md`

## Usage

### Prerequisites

```bash
# Required tools
- bash 4.0+
- AWS CLI v2 with configured credentials
- jq (JSON query tool)
- curl
- openssl
- dig (for DNS testing)
```

### Environment Variables

```bash
# Set these before running scripts
export AWS_REGION="us-east-1"
export PROD_ENV="production"
export PROD_HOSTED_ZONE_ID="Z1234567890ABC"

# Optional
export SENTRY_DSN="https://..."
export DATADOG_API_KEY="..."
```

### Setup

```bash
# Make scripts executable
chmod +x /path/to/scripts/launch-day/*.sh

# Create logs directory
mkdir -p /path/to/scripts/launch-day/logs

# Navigate to script directory
cd /path/to/scripts/launch-day
```

### Launch Day Execution

**T-4 hours**: Run pre-launch verification
```bash
./01-pre-launch-verification.sh
# Output: GO FOR LAUNCH or NO-GO FOR LAUNCH
```

**T=0 (17:00 UTC)**: Execute launch sequence
```bash
./02-launch-sequence.sh
# Output: LIVE status confirmation
```

**T+0 to T+1h**: Monitor in real-time
```bash
./03-realtime-monitoring.sh
# Output: Dashboard updates every 30 seconds
# Press Ctrl+C to stop
```

**If critical failure occurs**: Automatic or manual rollback
```bash
# Already running in background
./04-automatic-rollback.sh continuous

# Or manual
./04-automatic-rollback.sh manual
```

**T+4 hours**: Verify post-launch stability
```bash
./05-post-launch-verification.sh
# Output: SUCCESS or ESCALATE decision + detailed report
```

## Logging and Artifacts

### Log Files

All scripts create detailed logs in `logs/` directory:

```
logs/
├── pre-launch-20260825-133000.log      # Pre-launch checks
├── launch-sequence-20260825-170000.log # Launch execution
├── metrics-20260825-170500.log         # Real-time metrics
├── anomalies-20260825-170500.log       # Detected anomalies
├── rollback-20260825-180000.log        # Rollback execution (if triggered)
├── incident-2026-08-25-18-00-00.txt    # Incident record
└── post-launch-report-20260825-210000.md # Post-launch report
```

### State Files

Scripts maintain state for rollback capability:

```
.launch-state                # Current launch state and configuration
.metrics                     # Collected metrics data
```

## Golden Signals Monitoring

The system monitors four key signals for production health:

### 1. Latency (Response Time)
- **Healthy**: P95 < 300ms
- **Warning**: P95 300-500ms
- **Critical**: P95 > 500ms

### 2. Error Rate
- **Healthy**: < 0.5%
- **Warning**: 0.5-5%
- **Critical**: > 5%

### 3. Saturation (System Utilization)
- **Healthy**: < 60%
- **Warning**: 60-80%
- **Critical**: > 80%

### 4. Traffic (Request Volume)
- **Baseline**: ~100 RPS (adjust per expected load)
- **Monitor**: For spikes or anomalies

## Rollback Decision Tree

```
Is system experiencing critical issues?
│
├─ Error rate > 5% for 2 minutes
│  └─ YES → Trigger rollback
├─ API health check failing
│  └─ YES → Trigger rollback
├─ Database unavailable
│  └─ YES → Trigger rollback
├─ Critical security incident
│  └─ YES → Trigger rollback (manual)
└─ All systems normal
   └─ Continue monitoring
```

## Emergency Contacts

Establish before launch day:

| Role | Name | Phone | Slack |
|------|------|-------|-------|
| Launch Lead | [Engineering Director] | [Phone] | [@handle] |
| Engineering | [Lead] | [Phone] | [@handle] |
| DevOps | [Lead] | [Phone] | [@handle] |
| Database | [Lead] | [Phone] | [@handle] |
| On-Call | [Current] | [Phone] | [@handle] |

## Configuration

### AWS Integration

Scripts require AWS CLI with permissions for:
- EC2 describe instances
- RDS describe instances
- ElasticLoadBalancing describe/configure
- Route53 change records
- S3 list/get
- CloudFront describe
- CloudWatch get metrics

### DNS Configuration

```bash
# Verify hosted zone
aws route53 list-hosted-zones-by-name \
  --query "HostedZones[?Name=='transcendlaw.com.']"

# Get hosted zone ID
aws route53 list-hosted-zones-by-name \
  --query "HostedZones[?Name=='transcendlaw.com.'].Id" \
  --output text | cut -d'/' -f3
```

### Thresholds (Customizable)

Edit script files to adjust:
- RDS replication lag: `RDS_REPLICATION_LAG_THRESHOLD=1000`
- Error rate: `ERROR_RATE_THRESHOLD=5`
- Latency: `P95_LATENCY_THRESHOLD=500`
- Cache hit rate: `CACHE_HIT_RATE_MIN=80`

## Troubleshooting

### Script fails with "AWS CLI not found"
```bash
# Install AWS CLI v2
curl "https://awscli.amazonaws.com/awscli-exe-macos-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install
```

### Route53 update fails
```bash
# Verify hosted zone ID
echo $PROD_HOSTED_ZONE_ID

# Test Route53 access
aws route53 list-resource-record-sets \
  --hosted-zone-id $PROD_HOSTED_ZONE_ID \
  --region us-east-1
```

### DNS not resolving
```bash
# Check DNS resolution
dig production.transcendlaw.com @8.8.8.8

# Clear DNS cache
sudo dscacheutil -flushcache  # macOS
# or
sudo systemctl restart systemd-resolved  # Linux
```

### API not responding
```bash
# Test API directly
curl -v https://production.transcendlaw.com/api/health

# Check ALB target health
aws elbv2 describe-target-health \
  --target-group-arn "arn:..." \
  --region us-east-1
```

## Post-Launch Procedures

### Immediate (T+5 min)
- [ ] Confirm production live
- [ ] Notify stakeholders
- [ ] Begin monitoring

### Short-term (T+30 min)
- [ ] Verify metrics normal
- [ ] Check error logs
- [ ] Monitor user signups

### Extended (T+4 hours)
- [ ] Run post-launch verification
- [ ] Generate report
- [ ] Archive all logs

### Follow-up (T+24 hours)
- [ ] Conduct post-launch review
- [ ] Update runbook
- [ ] Document lessons learned

## Best Practices

1. **Dry Run First**: Always run through all scripts in staging environment
2. **Team Alignment**: Ensure all team members understand procedures
3. **Communication**: Keep stakeholders updated every 15 minutes during launch
4. **Monitoring**: Watch dashboards continuously for first 2 hours
5. **Rollback Ready**: Have rollback procedure verified and ready
6. **Documentation**: Keep logs and metrics for analysis
7. **Post-Mortem**: Conduct thorough review within 48 hours

## Performance Baselines

Expected metrics for healthy production system:

| Metric | Target | Warning | Critical |
|--------|--------|---------|----------|
| Error Rate | <0.5% | 0.5-5% | >5% |
| P95 Latency | <300ms | 300-500ms | >500ms |
| Cache Hit Rate | >85% | 80-85% | <80% |
| DB CPU | <50% | 50-80% | >80% |
| Replication Lag | <500ms | 500-1000ms | >1000ms |
| Uptime | >99.99% | 99.5-99.99% | <99.5% |

## Maintenance

### Weekly Checks
- [ ] Verify all scripts are executable
- [ ] Test AWS CLI credentials
- [ ] Review and update thresholds
- [ ] Check log retention policies

### Monthly Reviews
- [ ] Review launch runbook for accuracy
- [ ] Update contact information
- [ ] Test rollback procedures
- [ ] Audit security and permissions

### Pre-Launch (T-7 days)
- [ ] Run full dry run in staging
- [ ] Update all configurations
- [ ] Brief all team members
- [ ] Prepare communication templates

## References

- **Runbook**: See `LAUNCH_DAY_RUNBOOK.md` for detailed procedures
- **AWS CLI Documentation**: https://docs.aws.amazon.com/cli/
- **CloudWatch Metrics**: https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/
- **Route53 DNS**: https://docs.aws.amazon.com/Route53/

## Support and Updates

For questions or improvements to this launch day system:

```
Contact: platform-engineering@transcendlaw.com
Slack: #transcend-launch
Repository: /Users/jbconsultingassociatesinc./code/transcend-ssp/scripts/launch-day/
```

---

**Version**: 1.0  
**Last Updated**: 2026-08-15  
**Launch Date**: 2026-08-25  
**Status**: Production Ready
