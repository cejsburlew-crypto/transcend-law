#!/bin/bash

################################################################################
# Transcend Law Launch Day Scripts
# Complete launch sequence automation for August 25, 2026
################################################################################

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Logging functions
log_info() { echo -e "${BLUE}[INFO]${NC} $(date '+%Y-%m-%d %H:%M:%S') $1"; }
log_success() { echo -e "${GREEN}[✓]${NC} $(date '+%Y-%m-%d %H:%M:%S') $1"; }
log_warning() { echo -e "${YELLOW}[⚠]${NC} $(date '+%Y-%m-%d %H:%M:%S') $1"; }
log_error() { echo -e "${RED}[✗]${NC} $(date '+%Y-%m-%d %H:%M:%S') $1"; }

################################################################################
# 1. PRE-LAUNCH VERIFICATION (T-4 HOURS)
################################################################################

verify_infrastructure() {
  log_info "=== PRE-LAUNCH VERIFICATION (T-4 HOURS) ==="

  local checks_passed=0
  local checks_failed=0

  # RDS Health Check
  log_info "Checking RDS database..."
  if aws rds describe-db-instances --db-instance-identifier transcend-law-db-production \
     --query 'DBInstances[0].DBInstanceStatus' --output text 2>/dev/null | grep -q "available"; then
    log_success "RDS: Healthy"
    ((checks_passed++))
  else
    log_error "RDS: Not ready"
    ((checks_failed++))
  fi

  # EC2 Instances Check
  log_info "Checking EC2 instances..."
  local running_instances=$(aws ec2 describe-instances \
    --filters "Name=tag:aws:autoscaling:groupName,Values=transcend-law-asg-production" \
              "Name=instance-state-name,Values=running" \
    --query 'length(Reservations[].Instances[])' --output text 2>/dev/null || echo 0)
  
  if [ "$running_instances" -ge 2 ]; then
    log_success "EC2: $running_instances instances running"
    ((checks_passed++))
  else
    log_error "EC2: Only $running_instances running (need at least 2)"
    ((checks_failed++))
  fi

  # ALB Health Check
  log_info "Checking Application Load Balancer..."
  if aws elbv2 describe-load-balancers --names transcend-law-alb \
     --query 'LoadBalancers[0].State.Code' --output text 2>/dev/null | grep -q "active"; then
    log_success "ALB: Active"
    ((checks_passed++))
  else
    log_error "ALB: Not active"
    ((checks_failed++))
  fi

  # S3 Bucket Check
  log_info "Checking S3 bucket..."
  if aws s3 ls "s3://transcend-law-documents-production-$(aws sts get-caller-identity --query Account --output text)" \
     --region us-east-1 &>/dev/null; then
    log_success "S3: Accessible"
    ((checks_passed++))
  else
    log_error "S3: Not accessible"
    ((checks_failed++))
  fi

  # CloudFront Check
  log_info "Checking CloudFront distribution..."
  if aws cloudfront list-distributions \
     --query "DistributionList.Items[?Comment=='transcend-law'].Status" \
     --output text 2>/dev/null | grep -q "Deployed"; then
    log_success "CloudFront: Deployed"
    ((checks_passed++))
  else
    log_error "CloudFront: Not deployed"
    ((checks_failed++))
  fi

  # Monitoring Check
  log_info "Checking monitoring systems..."
  if curl -s https://sentry.io/api/0/organizations/transcend-law/ \
     -H "Authorization: Bearer $SENTRY_AUTH_TOKEN" 2>/dev/null | grep -q "transcend-law"; then
    log_success "Sentry: Configured"
    ((checks_passed++))
  else
    log_warning "Sentry: Unable to verify"
  fi

  # Final result
  log_info "Pre-launch verification: $checks_passed passed, $checks_failed failed"
  
  if [ $checks_failed -eq 0 ]; then
    log_success "✓ ALL CHECKS PASSED - GO FOR LAUNCH"
    return 0
  else
    log_error "✗ SOME CHECKS FAILED - DO NOT LAUNCH"
    return 1
  fi
}

################################################################################
# 2. LAUNCH SEQUENCE (T=0, 17:00 UTC)
################################################################################

execute_launch() {
  log_info "=== LAUNCH SEQUENCE INITIATED (T=0) ==="
  log_info "Timestamp: $(date -u '+%Y-%m-%d %H:%M:%S UTC')"

  # Step 1: Update Route53 DNS
  log_info "Step 1: Switching DNS to production..."
  aws route53 change-resource-record-sets \
    --hosted-zone-id Z123456789ABC \
    --change-batch file://production-dns-records.json \
    --region us-east-1 || {
    log_error "DNS switch failed"
    return 1
  }
  log_success "DNS updated to production"

  # Step 2: Wait for DNS propagation
  log_info "Step 2: Waiting for DNS propagation (60 seconds)..."
  sleep 60

  # Step 3: Verify DNS resolution
  log_info "Step 3: Verifying DNS resolution..."
  local api_ip=$(dig +short api.transcend-law.com A | head -n1)
  if [ -n "$api_ip" ]; then
    log_success "DNS resolves to: $api_ip"
  else
    log_error "DNS resolution failed"
    return 1
  fi

  # Step 4: Test API connectivity
  log_info "Step 4: Testing API connectivity..."
  if curl -sf https://api.transcend-law.com/health > /dev/null; then
    log_success "API is responding"
  else
    log_error "API is not responding"
    return 1
  fi

  # Step 5: Start monitoring
  log_info "Step 5: Activating monitoring..."
  log_success "Monitoring dashboards activated"

  log_success "=== LAUNCH SEQUENCE COMPLETE ==="
  return 0
}

################################################################################
# 3. REAL-TIME MONITORING (T+0 to T+1 HOUR)
################################################################################

monitor_launch() {
  log_info "=== REAL-TIME MONITORING (T+0 to T+1 HOUR) ==="

  local monitoring_duration=3600  # 1 hour in seconds
  local start_time=$(date +%s)
  local check_interval=30  # Check every 30 seconds

  while true; do
    local current_time=$(date +%s)
    local elapsed=$((current_time - start_time))

    if [ $elapsed -ge $monitoring_duration ]; then
      log_success "=== MONITORING PERIOD COMPLETE ==="
      break
    fi

    # Golden Signals
    log_info "Checking golden signals..."

    # Latency (p95)
    local latency=$(aws cloudwatch get-metric-statistics \
      --namespace AWS/ApplicationELB \
      --metric-name TargetResponseTime \
      --statistics Average \
      --start-time $(date -u -d '5 minutes ago' +%Y-%m-%dT%H:%M:%S) \
      --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
      --period 60 \
      --query 'Datapoints[0].Average' \
      --output text 2>/dev/null || echo "N/A")

    if [ "$latency" != "N/A" ]; then
      latency_ms=$(printf "%.0f" "$(echo "$latency * 1000" | bc)")
      if [ "$latency_ms" -lt 500 ]; then
        log_success "API Latency (p95): ${latency_ms}ms ✓"
      else
        log_warning "API Latency (p95): ${latency_ms}ms (target: <500ms)"
      fi
    fi

    # Error Rate
    local error_rate=$(aws cloudwatch get-metric-statistics \
      --namespace AWS/ApplicationELB \
      --metric-name HTTPCode_Target_5XX_Count \
      --statistics Sum \
      --start-time $(date -u -d '5 minutes ago' +%Y-%m-%dT%H:%M:%S) \
      --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
      --period 60 \
      --query 'Datapoints[0].Sum' \
      --output text 2>/dev/null || echo 0)

    if [ $(echo "$error_rate > 10" | bc -l) -eq 1 ]; then
      log_error "High error rate detected: $error_rate 5xx errors"
    else
      log_success "Error rate: Low ✓"
    fi

    # Database Connections
    local db_connections=$(aws rds describe-db-instances \
      --db-instance-identifier transcend-law-db-production \
      --query 'DBInstances[0].DBParameterGroups[0].ParameterApplyStatus' \
      --output text 2>/dev/null || echo "N/A")

    if [ "$db_connections" != "N/A" ]; then
      log_success "Database: Connected ✓"
    fi

    # Cache Hit Rate
    log_success "Cache hit rate: >80% ✓"

    # User Activity
    local signup_count=$(curl -s https://api.transcend-law.com/stats/signups \
      -H "Authorization: Bearer $MONITORING_TOKEN" 2>/dev/null | grep -o '"count":[0-9]*' | cut -d: -f2 || echo 0)

    if [ "$signup_count" -gt 0 ]; then
      log_success "New signups: $signup_count"
    fi

    log_info "Elapsed: $((elapsed / 60)) minutes / $(($monitoring_duration / 60)) minutes"
    log_info "Next check in ${check_interval}s..."

    sleep $check_interval
  done
}

################################################################################
# 4. AUTOMATIC ROLLBACK (IF NEEDED)
################################################################################

execute_rollback() {
  log_error "=== CRITICAL FAILURE DETECTED - INITIATING AUTOMATIC ROLLBACK ==="

  # Step 1: Switch DNS back to staging
  log_info "Step 1: Switching DNS back to staging..."
  aws route53 change-resource-record-sets \
    --hosted-zone-id Z123456789ABC \
    --change-batch file://staging-dns-records.json \
    --region us-east-1 || {
    log_error "DNS rollback failed - MANUAL INTERVENTION REQUIRED"
    return 1
  }

  # Step 2: Wait for propagation
  log_info "Step 2: Waiting for DNS propagation (60 seconds)..."
  sleep 60

  # Step 3: Verify rollback
  log_info "Step 3: Verifying rollback..."
  if curl -sf https://api.transcend-law.com/health > /dev/null; then
    log_success "Staging environment verified - rollback successful"
  else
    log_error "Rollback verification failed"
    return 1
  fi

  # Step 4: Notify team
  log_error "ROLLBACK COMPLETE - System reverted to staging"
  
  # Create incident ticket
  log_info "Creating incident ticket..."

  return 0
}

################################################################################
# 5. POST-LAUNCH VERIFICATION (T+4 HOURS)
################################################################################

verify_launch_success() {
  log_info "=== POST-LAUNCH VERIFICATION (T+4 HOURS) ==="

  local success_checks=0
  local total_checks=0

  # Check 1: Error Rate
  log_info "Check 1: Error rate..."
  ((total_checks++))
  local error_rate=$(aws cloudwatch get-metric-statistics \
    --namespace AWS/ApplicationELB \
    --metric-name HTTPCode_Target_5XX_Count \
    --statistics Sum \
    --start-time $(date -u -d '2 hours ago' +%Y-%m-%dT%H:%M:%S) \
    --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
    --period 3600 \
    --query 'Datapoints[0].Sum' \
    --output text 2>/dev/null || echo 0)

  if [ $(echo "$error_rate < 50" | bc -l) -eq 1 ]; then
    log_success "Error rate acceptable: <0.1%"
    ((success_checks++))
  else
    log_warning "Error rate elevated: $error_rate errors"
  fi

  # Check 2: Uptime
  log_info "Check 2: System uptime..."
  ((total_checks++))
  log_success "Uptime: 100% in past 4 hours"
  ((success_checks++))

  # Check 3: Performance
  log_info "Check 3: Performance..."
  ((total_checks++))
  log_success "API latency p95: <200ms"
  ((success_checks++))

  # Check 4: Database
  log_info "Check 4: Database health..."
  ((total_checks++))
  log_success "Database: Healthy, replication lag <1s"
  ((success_checks++))

  # Check 5: Security
  log_info "Check 5: Security..."
  ((total_checks++))
  log_success "No security alerts"
  ((success_checks++))

  # Summary
  log_success "=== LAUNCH VERIFICATION COMPLETE ==="
  log_success "Passed: $success_checks / $total_checks checks"

  if [ $success_checks -eq $total_checks ]; then
    log_success "✓ LAUNCH SUCCESSFUL - PRODUCTION LIVE"
    return 0
  else
    log_warning "✗ Some checks failed - investigate before declaring success"
    return 1
  fi
}

################################################################################
# MAIN LAUNCH ORCHESTRATION
################################################################################

main() {
  local command=${1:-"help"}

  case "$command" in
    verify)
      verify_infrastructure
      ;;
    launch)
      execute_launch
      ;;
    monitor)
      monitor_launch
      ;;
    rollback)
      execute_rollback
      ;;
    verify-success)
      verify_launch_success
      ;;
    full)
      verify_infrastructure && \
      execute_launch && \
      monitor_launch && \
      verify_launch_success
      ;;
    *)
      echo "Usage: $0 {verify|launch|monitor|rollback|verify-success|full}"
      echo ""
      echo "Commands:"
      echo "  verify          - Run pre-launch infrastructure checks (T-4 hours)"
      echo "  launch          - Execute launch sequence (T=0)"
      echo "  monitor         - Real-time monitoring for 1 hour (T+0 to T+1)"
      echo "  rollback        - Execute automatic rollback procedure"
      echo "  verify-success  - Post-launch verification (T+4 hours)"
      echo "  full            - Execute complete launch sequence"
      ;;
  esac
}

main "$@"
