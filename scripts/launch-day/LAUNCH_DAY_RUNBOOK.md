# Transcend Law Platform - Launch Day Runbook

**Launch Date**: August 25, 2026  
**Launch Time**: 17:00 UTC  
**Environment**: Production (US-East-1)  
**Domain**: production.transcendlaw.com

## Table of Contents

1. [Pre-Launch (T-24 hours)](#pre-launch-t-24-hours)
2. [Pre-Launch Final Checks (T-4 hours)](#pre-launch-final-checks-t-4-hours)
3. [Launch Sequence (T=0)](#launch-sequence-t0)
4. [Real-Time Monitoring (T+0 to T+1 hour)](#real-time-monitoring-t0-to-t1-hour)
5. [Post-Launch Verification (T+4 hours)](#post-launch-verification-t4-hours)
6. [Emergency Procedures](#emergency-procedures)
7. [Rollback Procedures](#rollback-procedures)
8. [Post-Launch Checklist](#post-launch-checklist)

---

## Pre-Launch (T-24 hours)

### Objectives
- Verify all infrastructure deployed and configured
- Ensure team availability and communication channels
- Test rollback procedures
- Prepare monitoring dashboards

### Activities

#### 1. Infrastructure Validation
```bash
# Check production environment readiness
aws ec2 describe-instances \
  --filters "Name=tag:Environment,Values=production" \
  --region us-east-1 \
  --query "Reservations[].Instances[?State.Name=='running']" \
  | jq 'length'  # Should be 3

# Verify RDS availability
aws rds describe-db-instances \
  --region us-east-1 \
  --query "DBInstances[?DBInstanceIdentifier=='production-db']"

# Verify ALB health
aws elbv2 describe-load-balancers \
  --region us-east-1 \
  --query "LoadBalancers[?contains(LoadBalancerName, 'production')]"
```

#### 2. DNS Configuration
- [ ] Verify Route53 hosted zone ID: `Z1234567890ABC`
- [ ] Confirm staging DNS: `staging.transcendlaw.com`
- [ ] Confirm production DNS: `production.transcendlaw.com`
- [ ] Test DNS propagation time: ~30-60 seconds

#### 3. Team Communication
- [ ] Schedule launch day standup at T-2 hours
- [ ] Confirm on-call engineers availability
- [ ] Establish war room communication channel (Slack: #transcend-launch)
- [ ] Set up pagerduty escalation policy
- [ ] Brief team on rollback procedures

#### 4. Monitoring Setup
- [ ] Create CloudWatch dashboard for launch day
- [ ] Configure Sentry alerts (error rate >5%)
- [ ] Set up DataDog monitors (latency, error rate, requests)
- [ ] Test alert notifications
- [ ] Prepare incident response playbook

#### 5. Documentation
- [ ] Print runbook for reference
- [ ] Prepare status communication template
- [ ] Create incident tracking spreadsheet
- [ ] Document all contact numbers and escalation paths

---

## Pre-Launch Final Checks (T-4 hours)

### Execute Pre-Launch Verification Script

This is the final infrastructure health check. Run from launch command center:

```bash
cd /Users/jbconsultingassociatesinc./code/transcend-ssp/scripts/launch-day

# Make scripts executable
chmod +x *.sh

# Run pre-launch verification
./01-pre-launch-verification.sh
```

### Expected Output

**GO FOR LAUNCH** - All checks pass
```
✓ PASS: RDS Instance Status
✓ PASS: RDS Automated Backups
✓ PASS: RDS Encryption
✓ PASS: EC2 Instances Running
✓ PASS: EC2 Security Groups
✓ PASS: ALB State
✓ PASS: ALB Target Health
✓ PASS: S3 Bucket Accessible
✓ PASS: S3 Encryption
✓ PASS: CloudFront Status
✓ PASS: Route53 DNS Resolution
✓ PASS: SSL Certificate Valid
✓ PASS: Sentry Monitoring
✓ PASS: DataDog Monitoring
✓ PASS: CloudWatch Monitoring
✓ PASS: On-Call Team Confirmed

Checks Passed: 16
Checks Failed: 0
Critical Issues: 0

✓ GO FOR LAUNCH
```

### If Pre-Launch Verification Fails

**NO-GO FOR LAUNCH** - Address all critical issues

1. Identify failed checks
2. Document issue in incident tracker
3. Notify engineering team lead
4. Resolve infrastructure issues
5. Re-run verification script
6. Do not proceed to launch until all critical items pass
7. Update launch time if necessary

### Team Meeting (T-2 hours)

- [ ] Discuss pre-launch results
- [ ] Review rollback procedures
- [ ] Confirm communication plan
- [ ] Briefing on expected metrics
- [ ] Last-minute questions and concerns

---

## Launch Sequence (T=0)

### POINT OF NO RETURN - DNS Switch

**Time**: 17:00 UTC August 25, 2026

### Pre-Launch Checklist (T-15 minutes)

- [ ] All team members in launch war room
- [ ] Monitoring dashboards open and visible
- [ ] Mobile devices at hand for emergency contact
- [ ] Pre-launch verification passed
- [ ] Staging environment stable and running
- [ ] Production infrastructure verified
- [ ] Incident tracker open and ready
- [ ] Communication channels active

### Execute Launch Sequence Script

```bash
cd /Users/jbconsultingassociatesinc./code/transcend-ssp/scripts/launch-day

# Execute launch sequence (POINT OF NO RETURN)
./02-launch-sequence.sh
```

### Expected Timeline

| Time Offset | Action | Expected Result |
|-----------|--------|-----------------|
| T+0s | Launch script started | Script begins execution |
| T+5s | ALB DNS retrieved | Production ALB DNS captured |
| T+10s | Route53 updated | DNS change submitted to AWS |
| T+20s | DNS propagation begins | Global DNS servers updating |
| T+60s | DNS propagation complete | All nameservers updated |
| T+65s | API connectivity test | First requests routing to prod |
| T+90s | System status verified | Full production handoff confirmed |

### Expected Output - LAUNCH COMPLETE

```
==============================================================================
TRANSCEND LAW PLATFORM LAUNCH SEQUENCE
==============================================================================
Launch Time: 2026-08-25 17:00:00 UTC
Domain: production.transcendlaw.com
Region: us-east-1

>>> Step 1: Retrieving infrastructure endpoints...
✓ Production ALB: transcend-prod-alb-12345.us-east-1.elb.amazonaws.com
✓ Staging ALB: transcend-staging-alb-67890.us-east-1.elb.amazonaws.com

>>> Step 2: Updating Route53 DNS (POINT OF NO RETURN)...
✓ Route53 updated: production.transcendlaw.com -> transcend-prod-alb-12345.us-east-1.elb.amazonaws.com

>>> Step 3: Waiting for DNS propagation...
✓ DNS propagation complete

>>> Step 4: Verifying API connectivity...
✓ API responding: HTTP 200

>>> Step 5: Verifying live status...
✓ System status: LIVE

==============================================================================
LAUNCH COMPLETE - PRODUCTION LIVE
==============================================================================
✓ Launch Time: 2026-08-25 17:00:00 UTC
✓ Domain: production.transcendlaw.com
✓ Status: LIVE
✓ Next: Execute 03-realtime-monitoring.sh
```

### Post-Launch Actions (T+5 minutes)

1. **Verify Live Status**
   ```bash
   curl -s https://production.transcendlaw.com/api/health | jq '.'
   ```

2. **Announce Go-Live**
   - Send Slack notification: "🚀 Transcend Law Platform LIVE in production"
   - Update status page if applicable
   - Notify stakeholders

3. **Begin Real-Time Monitoring**
   - Launch monitoring script immediately
   - Watch for any anomalies
   - Have rollback procedure ready

---

## Real-Time Monitoring (T+0 to T+1 hour)

### Execute Real-Time Monitoring Script

```bash
cd /Users/jbconsultingassociatesinc./code/transcend-ssp/scripts/launch-day

# Begin continuous monitoring
./03-realtime-monitoring.sh
```

### Dashboard Monitoring

Monitor these golden signals every 30 seconds:

```
Golden Signals:
  - Latency (P95): Target <500ms
  - Error Rate: Target <5%
  - Requests: Monitor for expected volume
  - Saturation: All systems <80%

System Health:
  - API endpoints responding
  - Database connections normal
  - Cache hit rate >80%
  - No security alerts
```

### What to Watch For

#### Normal Indicators ✓
- Latency: 150-300ms
- Error rate: <1%
- Traffic: Gradual increase
- Database: <50% CPU
- Cache hit rate: 80-90%

#### Warning Indicators ⚠
- Latency: 300-500ms
- Error rate: 1-5%
- Traffic spike >50% above baseline
- Database: 50-80% CPU
- Cache hit rate: 70-80%

#### Critical Indicators ✗
- Latency: >500ms consistently
- Error rate: >5%
- Massive traffic spike (>100% above baseline)
- Database: >80% CPU or connections near limit
- Cache hit rate: <70%

### Rollback Triggers

**IMMEDIATE ROLLBACK if:**
- Error rate >5% for 2 consecutive minutes
- API health check fails for 2+ minutes
- Database becomes unavailable
- Any critical security alert

### During Monitoring

- [ ] Check logs every 5 minutes
- [ ] Monitor Sentry for error patterns
- [ ] Review CloudWatch metrics
- [ ] Watch DataDog dashboard
- [ ] Be ready to execute rollback
- [ ] Communicate status every 15 minutes

---

## Post-Launch Verification (T+4 hours)

### Execute Post-Launch Verification Script

```bash
cd /Users/jbconsultingassociatesinc./code/transcend-ssp/scripts/launch-day

# Run comprehensive post-launch verification
./05-post-launch-verification.sh
```

### Expected Results - SUCCESS

```
==============================================================================
POST-LAUNCH VERIFICATION SUMMARY
==============================================================================

✓ PASS: Error Rate (2h average) (0.08%)
✓ PASS: Latency P95 (2h average) (245ms)
✓ PASS: Database Connection Errors (0)
✓ PASS: Database CPU Utilization (35%)
✓ PASS: Database Replication Lag (145ms)
✓ PASS: Cache Hit Rate (87%)
✓ PASS: Cache Memory Usage (45% of 50GB)
✓ PASS: Security Alerts (0 critical alerts)
✓ PASS: SSL Certificate Valid
✓ PASS: Security Headers (HSTS configured)
✓ PASS: Target Health (3 targets healthy)
✓ PASS: New Signups (42 in last 4 hours)
✓ PASS: Transactions (127 completed)

✓ SUCCESS: POST-LAUNCH VERIFICATION PASSED

Checks Passed: 13
Warnings: 0
Checks Failed: 0

All systems stable. Production launch successful.
```

### Post-Verification Checklist

- [ ] Review generated report: `/logs/post-launch-report-*.md`
- [ ] Document baseline metrics for future comparison
- [ ] Archive all logs for post-mortem analysis
- [ ] Send success notification to stakeholders
- [ ] Schedule post-launch review meeting
- [ ] Begin establishment of normal on-call procedures

---

## Emergency Procedures

### Situation: Elevated Error Rate During Launch

**Symptoms**: Error rate climbing above 5%

**Immediate Actions** (First 2 minutes)
1. Check CloudWatch logs for patterns
2. Look at Sentry for error types
3. Verify database connection pool
4. Check API server logs for exceptions
5. Assess current traffic volume

**Decision Point** (2 minutes in)
- If error spike is transient → Continue monitoring
- If error rate persists >5% for 2 minutes → Execute rollback

### Situation: API Connectivity Loss

**Symptoms**: Health checks failing, no responses from API

**Immediate Actions** (First 1 minute)
1. Check if production ALB is still running
2. Verify target instances in ALB target group
3. Check security group rules
4. Verify network ACLs
5. Check Route53 DNS resolution

**Decision Point** (1 minute in)
- If ALB/targets healthy but API not responding → Debug API servers
- If infrastructure unhealthy → Execute rollback immediately

### Situation: Database Connection Errors

**Symptoms**: 5xx errors, connection pool exhausted messages

**Immediate Actions** (First 2 minutes)
1. Check RDS connection count metric
2. Review database logs for locked queries
3. Check for long-running queries
4. Verify network connectivity from EC2 to RDS
5. Check RDS security group rules

**Decision Point** (2 minutes in)
- If temporary connection spike → Optimize query patterns
- If persistent connection issues → Consider rollback

### Situation: CloudFront/CDN Issues

**Symptoms**: Static assets slow or unavailable

**Immediate Actions**
1. Check CloudFront cache hit rate
2. Verify S3 bucket accessibility
3. Check CloudFront distribution status
4. Review error logs for specific asset types
5. Verify CORS settings

**Resolution**
- If cache issue: Invalidate specific paths
- If S3 issue: Check bucket permissions
- If distribution issue: Contact AWS support

---

## Rollback Procedures

### When to Rollback

**Automatic Rollback Triggers:**
- Error rate >5% for 2 consecutive minutes
- API health check failing for 2+ minutes
- Database unavailable (0 connections)
- Critical security incident

**Manual Rollback Approved By:**
- Engineering Director (if automated trigger happens)
- On-Call Lead (with approval from Eng Director)

### Execute Automatic Rollback Script

```bash
cd /Users/jbconsultingassociatesinc./code/transcend-ssp/scripts/launch-day

# Automatic detection mode (continuous monitoring)
./04-automatic-rollback.sh continuous

# OR manual rollback mode
./04-automatic-rollback.sh manual
```

### Rollback Sequence

The automatic rollback script performs:

1. **T+0**: Detects critical failure (error rate >5% x 2 checks)
2. **T+5**: Initiates rollback (retrieves staging ALB DNS)
3. **T+10**: Updates Route53 DNS to point to staging
4. **T+15**: Waits for DNS propagation (60 seconds)
5. **T+75**: Verifies staging is stable
6. **T+80**: Creates incident record with details
7. **T+85**: Rollback complete, notifies team

### Post-Rollback Actions

```bash
# 1. Verify staging is accepting traffic
curl -s https://staging.transcendlaw.com/api/health | jq '.'

# 2. Check error rate normalized
aws cloudwatch get-metric-statistics \
  --namespace "AWS/ApplicationELB" \
  --metric-name "HTTPCode_Target_5XX_Count" \
  --start-time "$(date -u -d '5 minutes ago' +%Y-%m-%dT%H:%M:%S)" \
  --end-time "$(date -u +%Y-%m-%dT%H:%M:%S)" \
  --period 60 --statistics Sum --region us-east-1

# 3. Review incident ticket created in logs
ls -la logs/incident-*.txt

# 4. Collect all logs for post-mortem
tar czf launch-day-logs-$(date +%Y%m%d-%H%M%S).tar.gz logs/
```

### Post-Rollback Investigation

**Within 15 minutes:**
1. Gather all error logs
2. Review Sentry/DataDog for error patterns
3. Check for database issues
4. Review application logs
5. Assess infrastructure metrics

**Within 1 hour:**
1. Identify root cause
2. Document findings
3. Assess whether to:
   - Fix and retry production launch
   - Extend timeline for fixes
   - Run more testing first

---

## Post-Launch Checklist

### Immediate (T+5 minutes)

- [ ] Production system live and accepting traffic
- [ ] All team members notified
- [ ] Monitoring active and collecting data
- [ ] No immediate alerts triggered
- [ ] Communication sent to stakeholders

### Short-term (T+30 minutes)

- [ ] Error rate stable and low
- [ ] API latency within expectations
- [ ] Database performing normally
- [ ] Cache hit rate >80%
- [ ] User signups flowing through system

### 1 Hour Post-Launch

- [ ] All golden signals in green
- [ ] No escalations or incidents
- [ ] Real-time monitoring script completed
- [ ] Traffic volume normalized
- [ ] All systems performing as expected

### 4 Hours Post-Launch

- [ ] Execute post-launch verification script
- [ ] Review comprehensive report
- [ ] Confirm all stability criteria met
- [ ] Document baseline metrics
- [ ] Plan post-launch review meeting

### 24 Hours Post-Launch

- [ ] Review all 24h metrics and logs
- [ ] Conduct post-launch review meeting
- [ ] Archive all launch day logs
- [ ] Document lessons learned
- [ ] Update runbook based on experience
- [ ] Plan next phase deployments

---

## Contact and Escalation

### War Room Team

| Role | Name | Phone | Slack |
|------|------|-------|-------|
| Launch Lead | [Engineering Director] | [Number] | [@eng-director] |
| API Lead | [API Team Lead] | [Number] | [@api-lead] |
| Database Lead | [DBA] | [Number] | [@dba] |
| Infrastructure Lead | [DevOps Lead] | [Number] | [@devops-lead] |
| On-Call Engineer | [Current On-Call] | [Number] | [@oncall] |

### Escalation Path

1. **Alert/Anomaly Detected** → On-Call Engineer
2. **Issue Cannot Be Resolved** → Engineering Director
3. **Critical System Failure** → VP Engineering
4. **Multi-system Impact** → CTO/Executive

### Communication Channels

- **Primary**: Slack #transcend-launch
- **Secondary**: Phone war room bridge
- **Tertiary**: SMS for critical escalations
- **External**: Status page update if needed

---

## Important Notes

### Monitoring Dashboards

Keep these dashboards open during launch:

1. **CloudWatch Dashboard**: `transcend-production-launch`
   - Error rate, latency, requests
   - Target health, connection counts
   - CPU and memory utilization

2. **Sentry Dashboard**: https://sentry.io/organizations/transcend/issues/
   - Error patterns and frequency
   - Stack traces and affected users

3. **DataDog**: Transcend Production Monitor
   - Golden signals
   - Service metrics
   - Infrastructure metrics

### DNS TTL Considerations

- Route53 uses 60-second TTL during launch
- DNS propagation: ~30-60 seconds globally
- Some caches may have longer TTL
- Client retries important during transition period

### Rollback DNS Timing

- Production DNS → Staging: ~60 seconds total
- Includes: AWS propagation + client refresh time
- Some browsers/clients may take 2-5 minutes longer
- Can manually clear DNS cache if needed

### Post-Launch Responsibilities

1. **Engineering**: Monitor systems and respond to incidents
2. **DevOps**: Infrastructure health and scaling
3. **Database Team**: Database performance and optimization
4. **Product**: Monitor user experience and metrics
5. **Management**: Stakeholder communications and updates

---

## Appendix: Quick Commands Reference

### Health Checks
```bash
# API health
curl -s https://production.transcendlaw.com/api/health | jq '.'

# Database status
aws rds describe-db-instances --region us-east-1 \
  --query 'DBInstances[?DBInstanceIdentifier==`production-db`]' | jq '.'

# ALB targets
aws elbv2 describe-target-health \
  --target-group-arn "arn:aws:elasticloadbalancing:us-east-1:ACCOUNT:targetgroup/..." \
  --region us-east-1 | jq '.TargetHealthDescriptions[]'

# Route53 DNS
dig production.transcendlaw.com @8.8.8.8
```

### Metrics Queries
```bash
# Last hour error rate
aws cloudwatch get-metric-statistics \
  --namespace AWS/ApplicationELB \
  --metric-name HTTPCode_Target_5XX_Count \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 --statistics Sum --region us-east-1

# Current latency
aws cloudwatch get-metric-statistics \
  --namespace AWS/ApplicationELB \
  --metric-name TargetResponseTime \
  --start-time $(date -u -d '5 minutes ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 60 --statistics Average --region us-east-1
```

---

**Last Updated**: 2026-08-15  
**Document Version**: 1.0  
**For questions or updates, contact**: platform-engineering@transcendlaw.com
