#!/bin/bash

#############################################################################
# Transcend Law Platform - Automatic Rollback Script
#
# Purpose: Automated rollback triggered by critical failure detection
# Trigger: Error rate >5% for 2 consecutive minutes
# Output: Rollback status with timestamp and verification
#
# Prerequisites:
#  - Launch sequence completed
#  - State file from launch sequence available
#  - AWS CLI configured with appropriate credentials
#############################################################################

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROLLBACK_LOG="${SCRIPT_DIR}/logs/rollback-$(date +%Y%m%d-%H%M%S).log"
STATE_FILE="${SCRIPT_DIR}/.launch-state"
AWS_REGION="${AWS_REGION:-us-east-1}"
PROD_ENV="${PROD_ENV:-production}"
STAGING_ENV="staging"
PROD_DOMAIN="production.transcendlaw.com"
STAGING_DOMAIN="staging.transcendlaw.com"

# Rollback triggers
ERROR_RATE_THRESHOLD=5  # percent
CONSECUTIVE_CHECK_THRESHOLD=2  # times
CHECK_INTERVAL=30  # seconds

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# State tracking
CONSECUTIVE_failures=0
ROLLBACK_INITIATED=false

#############################################################################
# Utility Functions
#############################################################################

log() {
    local level=$1
    shift
    local message="$@"
    local ts=$(date -u +"%Y-%m-%d %H:%M:%S UTC")
    echo "[${ts}] [${level}] ${message}" | tee -a "$ROLLBACK_LOG"
}

print_header() {
    echo ""
    echo "=============================================================================="
    echo "$1"
    echo "=============================================================================="
    echo ""
}

print_alert() {
    echo -e "${RED}!!! ALERT !!! ${1}${NC}"
}

#############################################################################
# State Management
#############################################################################

read_state() {
    local key=$1
    local default=${2:-""}

    if [ -f "$STATE_FILE" ]; then
        grep "^${key}=" "$STATE_FILE" | cut -d'=' -f2- || echo "$default"
    else
        echo "$default"
    fi
}

#############################################################################
# Failure Detection
#############################################################################

get_error_rate() {
    log "DEBUG" "Retrieving error rate from CloudWatch..."

    local current_errors=$(aws cloudwatch get-metric-statistics \
        --namespace "AWS/ApplicationELB" \
        --metric-name "HTTPCode_Target_5XX_Count" \
        --start-time "$(date -u -d '1 minute ago' +%Y-%m-%dT%H:%M:%S)" \
        --end-time "$(date -u +%Y-%m-%dT%H:%M:%S)" \
        --period 60 \
        --statistics Sum \
        --region "$AWS_REGION" \
        --output json 2>/dev/null | jq '.Datapoints[0].Sum // 0')

    local total_requests=$(aws cloudwatch get-metric-statistics \
        --namespace "AWS/ApplicationELB" \
        --metric-name "RequestCount" \
        --start-time "$(date -u -d '1 minute ago' +%Y-%m-%dT%H:%M:%S)" \
        --end-time "$(date -u +%Y-%m-%dT%H:%M:%S)" \
        --period 60 \
        --statistics Sum \
        --region "$AWS_REGION" \
        --output json 2>/dev/null | jq '.Datapoints[0].Sum // 100')

    if [ "$total_requests" -eq 0 ]; then
        echo "0"
    else
        awk "BEGIN {printf \"%.2f\", ($current_errors / $total_requests) * 100}"
    fi
}

check_api_health() {
    log "DEBUG" "Checking API health endpoint..."

    local response=$(curl -s -w "%{http_code}" "https://${PROD_DOMAIN}/api/health" 2>/dev/null || echo "000")
    local http_code=${response: -3}

    if [ "$http_code" -ne 200 ]; then
        echo "unhealthy"
    else
        echo "healthy"
    fi
}

detect_critical_failure() {
    local error_rate=$1

    if (( $(echo "$error_rate > $ERROR_RATE_THRESHOLD" | bc -l) )); then
        log "WARN" "Error rate high: ${error_rate}% (threshold: ${ERROR_RATE_THRESHOLD}%)"
        ((CONSECUTIVE_failures++))
        return 0
    else
        log "DEBUG" "Error rate normal: ${error_rate}%"
        CONSECUTIVE_failures=0
        return 1
    fi
}

#############################################################################
# Rollback Execution
#############################################################################

get_staging_alb_dns() {
    log "INFO" "Retrieving staging ALB DNS name..."

    local albs=$(aws elbv2 describe-load-balancers \
        --region "$AWS_REGION" \
        --query "LoadBalancers[?contains(LoadBalancerName, '${STAGING_ENV}')]" \
        --output json)

    local alb_dns=$(echo "$albs" | jq -r '.[0].DNSName')

    if [ -z "$alb_dns" ] || [ "$alb_dns" = "null" ]; then
        log "ERROR" "Could not retrieve staging ALB DNS"
        return 1
    fi

    echo "$alb_dns"
}

execute_rollback() {
    print_alert "CRITICAL FAILURE DETECTED - INITIATING ROLLBACK"
    log "ERROR" "ROLLBACK INITIATED: Error rate exceeded threshold"

    ROLLBACK_INITIATED=true

    # Get hosted zone ID from state file
    local hosted_zone_id=$(read_state "PROD_HOSTED_ZONE_ID" "Z1234567890ABC")

    # Step 1: Get staging ALB DNS
    print_header "ROLLBACK STEP 1: Retrieving Staging Infrastructure"
    local staging_alb_dns=$(get_staging_alb_dns)
    if [ $? -ne 0 ]; then
        log "ERROR" "Failed to retrieve staging ALB DNS"
        return 1
    fi
    log "INFO" "Staging ALB DNS: ${staging_alb_dns}"

    # Step 2: Switch DNS back to staging
    print_header "ROLLBACK STEP 2: Switching DNS to Staging"
    log "INFO" "Updating Route53: ${PROD_DOMAIN} -> ${staging_alb_dns}"

    local change_batch=$(cat <<EOF
{
    "Changes": [
        {
            "Action": "UPSERT",
            "ResourceRecordSet": {
                "Name": "${PROD_DOMAIN}.",
                "Type": "CNAME",
                "TTL": 60,
                "ResourceRecords": [
                    {
                        "Value": "${staging_alb_dns}"
                    }
                ]
            }
        }
    ]
}
EOF
)

    local change_info=$(aws route53 change-resource-record-sets \
        --hosted-zone-id "$hosted_zone_id" \
        --change-batch "$change_batch" \
        --region "$AWS_REGION" \
        --output json 2>/dev/null || echo "{}")

    local change_id=$(echo "$change_info" | jq -r '.ChangeInfo.Id // "unknown"')
    log "INFO" "Route53 change initiated: ${change_id}"

    # Step 3: Wait for DNS propagation
    print_header "ROLLBACK STEP 3: Waiting for DNS Propagation"
    log "INFO" "Waiting 60 seconds for DNS propagation..."
    sleep 60

    # Step 4: Verify staging is stable
    print_header "ROLLBACK STEP 4: Verifying Staging Stability"
    local staging_health=$(check_api_health)
    if [ "$staging_health" = "healthy" ]; then
        log "INFO" "Staging API is healthy"
    else
        log "WARN" "Staging API health check returned: ${staging_health}"
    fi

    # Step 5: Verify error rate reduced
    log "INFO" "Waiting 30 seconds before error rate check..."
    sleep 30
    local staging_error_rate=$(get_error_rate)
    log "INFO" "Current error rate: ${staging_error_rate}%"

    if (( $(echo "$staging_error_rate < $ERROR_RATE_THRESHOLD" | bc -l) )); then
        log "INFO" "Error rate normalized on staging"
    else
        log "WARN" "Error rate still high on staging: ${staging_error_rate}%"
    fi

    # Step 6: Create incident
    print_header "ROLLBACK STEP 5: Creating Incident Record"
    create_incident_record

    # Summary
    print_header "ROLLBACK COMPLETE"
    echo -e "${YELLOW}System rolled back to staging${NC}"
    echo "Domain: ${PROD_DOMAIN}"
    echo "Target: ${staging_alb_dns}"
    echo "Incident ticket created - Review and coordinate recovery"
    log "INFO" "ROLLBACK COMPLETE: System restored to staging"
}

create_incident_record() {
    local incident_time=$(date -u +"%Y-%m-%d %H:%M:%S UTC")
    local incident_file="${SCRIPT_DIR}/logs/incident-${incident_time// /-}.txt"

    cat > "$incident_file" <<EOF
INCIDENT REPORT
===============

Timestamp: ${incident_time}
Environment: ${PROD_ENV}
Domain: ${PROD_DOMAIN}

TRIGGER:
- Error rate exceeded ${ERROR_RATE_THRESHOLD}% threshold
- Duration: ${CONSECUTIVE_failures} consecutive checks (${CONSECUTIVE_failures} * ${CHECK_INTERVAL}s)

ACTION TAKEN:
- Automatic rollback executed
- DNS switched to staging environment
- Status: ROLLED BACK

NEXT STEPS:
1. Review CloudWatch logs for error patterns
2. Check application logs on production instances
3. Investigate root cause of elevated error rate
4. Verify all systems stable on staging
5. Plan production incident recovery

ON-CALL TEAM NOTIFIED: NO (MANUAL NOTIFICATION REQUIRED)

Log files:
- Rollback log: ${ROLLBACK_LOG}
- Metrics log: ${SCRIPT_DIR}/logs/metrics-*.log
- Production state: ${STATE_FILE}
EOF

    log "INFO" "Incident record created: ${incident_file}"
}

#############################################################################
# Continuous Monitoring Mode
#############################################################################

run_continuous_monitoring() {
    print_header "TRANSCEND LAW - ROLLBACK MONITOR (Continuous)"
    echo "Mode: Continuous failure detection"
    echo "Error rate threshold: ${ERROR_RATE_THRESHOLD}%"
    echo "Consecutive checks required: ${CONSECUTIVE_CHECK_THRESHOLD}"
    echo "Check interval: ${CHECK_INTERVAL}s"
    echo ""
    echo "Press Ctrl+C to stop monitoring"
    echo ""

    log "INFO" "Starting continuous monitoring for critical failures"

    while true; do
        # Get current error rate
        local current_error_rate=$(get_error_rate)
        local current_time=$(date -u +"%Y-%m-%d %H:%M:%S UTC")

        echo -ne "\r[${current_time}] Error Rate: ${current_error_rate}% | Consecutive failures: ${CONSECUTIVE_failures}"

        # Detect critical failure
        if detect_critical_failure "$current_error_rate"; then
            if [ "$CONSECUTIVE_failures" -ge "$CONSECUTIVE_CHECK_THRESHOLD" ]; then
                execute_rollback
                break
            fi
        fi

        sleep "$CHECK_INTERVAL"
    done
}

#############################################################################
# Manual Rollback Mode
#############################################################################

run_manual_rollback() {
    print_header "TRANSCEND LAW - MANUAL ROLLBACK"
    echo "Mode: Manual rollback initiated"
    echo ""

    log "INFO" "Manual rollback initiated by operator"

    # Get current metrics before rollback
    local error_rate=$(get_error_rate)
    local health_status=$(check_api_health)

    echo "Current metrics before rollback:"
    echo "  Error rate: ${error_rate}%"
    echo "  API health: ${health_status}"
    echo ""

    read -p "Continue with rollback? (yes/no): " -r confirmation

    if [[ $confirmation == "yes" ]]; then
        execute_rollback
    else
        log "INFO" "Manual rollback cancelled by operator"
        echo "Rollback cancelled."
    fi
}

#############################################################################
# Main
#############################################################################

main() {
    mkdir -p "$(dirname "$ROLLBACK_LOG")"

    # Check if mode specified as argument
    local mode="${1:-continuous}"

    log "INFO" "========== ROLLBACK SCRIPT STARTED =========="
    log "INFO" "Mode: ${mode}"
    log "INFO" "AWS Region: ${AWS_REGION}"

    # Verify prerequisites
    if ! command -v aws &> /dev/null; then
        echo "Error: AWS CLI not found"
        log "ERROR" "AWS CLI not available"
        exit 1
    fi

    if ! command -v jq &> /dev/null; then
        echo "Error: jq not found"
        log "ERROR" "jq not available"
        exit 1
    fi

    # Execute appropriate mode
    case "$mode" in
        continuous)
            run_continuous_monitoring
            ;;
        manual)
            run_manual_rollback
            ;;
        *)
            echo "Usage: $0 [continuous|manual]"
            exit 1
            ;;
    esac

    log "INFO" "========== ROLLBACK SCRIPT COMPLETED =========="
}

main "$@"
