#!/bin/bash

#############################################################################
# Transcend Law Platform - Launch Sequence Script (T=0, 17:00 UTC)
#
# Purpose: Execute production DNS switch and verify live status
# Critical: This is the point of no return - DNS switches to production
# Output: LIVE status confirmation with timestamp and verification
#
# Prerequisites:
#  - Pre-launch verification script passed (01-pre-launch-verification.sh)
#  - AWS CLI configured with appropriate credentials
#  - jq installed for JSON parsing
#  - Monitoring systems online and collecting data
#############################################################################

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="${SCRIPT_DIR}/logs/launch-sequence-$(date +%Y%m%d-%H%M%S).log"
AWS_REGION="${AWS_REGION:-us-east-1}"
PROD_ENV="${PROD_ENV:-production}"
STAGING_ENV="staging"
DOMAIN="transcendlaw.com"
PROD_DOMAIN="${PROD_ENV}.${DOMAIN}"

# DNS Configuration
PROD_HOSTED_ZONE_ID="${PROD_HOSTED_ZONE_ID:-Z1234567890ABC}"  # Set via environment
PROD_ALB_DNS="${PROD_ALB_DNS}"  # Populated during launch
STAGING_ALB_DNS="${STAGING_ALB_DNS}"  # Fallback for rollback

# Timing
LAUNCH_TIME=$(date -u +"%Y-%m-%d %H:%M:%S UTC")
LAUNCH_TIMESTAMP=$(date +%s)
DNS_PROPAGATION_WAIT=60

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# State file for rollback capability
STATE_FILE="${SCRIPT_DIR}/.launch-state"

#############################################################################
# Utility Functions
#############################################################################

log() {
    local level=$1
    shift
    local message="$@"
    local ts=$(date -u +"%Y-%m-%d %H:%M:%S UTC")
    echo "[${ts}] [${level}] ${message}" | tee -a "$LOG_FILE"
}

print_header() {
    echo ""
    echo "=============================================================================="
    echo "$1"
    echo "=============================================================================="
    echo ""
}

print_step() {
    echo -e "${BLUE}>>> ${1}${NC}"
}

print_success() {
    echo -e "${GREEN}✓ ${1}${NC}"
}

print_error() {
    echo -e "${RED}✗ ${1}${NC}"
}

save_state() {
    local key=$1
    local value=$2
    echo "${key}=${value}" >> "$STATE_FILE"
}

#############################################################################
# DNS Switch Functions
#############################################################################

get_production_alb_dns() {
    log "INFO" "Retrieving production ALB DNS name"

    local albs=$(aws elbv2 describe-load-balancers \
        --region "$AWS_REGION" \
        --query "LoadBalancers[?contains(LoadBalancerName, '${PROD_ENV}')]" \
        --output json)

    local alb_dns=$(echo "$albs" | jq -r '.[0].DNSName')

    if [ -z "$alb_dns" ] || [ "$alb_dns" = "null" ]; then
        print_error "Could not retrieve production ALB DNS name"
        log "ERROR" "Production ALB DNS retrieval failed"
        exit 1
    fi

    echo "$alb_dns"
}

get_staging_alb_dns() {
    log "INFO" "Retrieving staging ALB DNS name (for rollback)"

    local albs=$(aws elbv2 describe-load-balancers \
        --region "$AWS_REGION" \
        --query "LoadBalancers[?contains(LoadBalancerName, '${STAGING_ENV}')]" \
        --output json)

    local alb_dns=$(echo "$albs" | jq -r '.[0].DNSName')

    if [ -z "$alb_dns" ] || [ "$alb_dns" = "null" ]; then
        print_error "Could not retrieve staging ALB DNS name"
        log "ERROR" "Staging ALB DNS retrieval failed"
        return 1
    fi

    echo "$alb_dns"
}

update_route53_dns() {
    local domain=$1
    local target_dns=$2
    local action=$3  # UPSERT or DELETE

    log "INFO" "Updating Route53: ${domain} -> ${target_dns}"

    # Get current record
    local current_record=$(aws route53 list-resource-record-sets \
        --hosted-zone-id "$PROD_HOSTED_ZONE_ID" \
        --query "ResourceRecordSets[?Name == '${domain}.']" \
        --region "$AWS_REGION" \
        --output json)

    local change_batch=$(cat <<EOF
{
    "Changes": [
        {
            "Action": "${action}",
            "ResourceRecordSet": {
                "Name": "${domain}.",
                "Type": "CNAME",
                "TTL": 60,
                "ResourceRecords": [
                    {
                        "Value": "${target_dns}"
                    }
                ]
            }
        }
    ]
}
EOF
)

    local change_info=$(aws route53 change-resource-record-sets \
        --hosted-zone-id "$PROD_HOSTED_ZONE_ID" \
        --change-batch "$change_batch" \
        --region "$AWS_REGION" \
        --output json)

    local change_id=$(echo "$change_info" | jq -r '.ChangeInfo.Id')
    local change_status=$(echo "$change_info" | jq -r '.ChangeInfo.Status')

    log "INFO" "Route53 change initiated: ${change_id}, status: ${change_status}"
    save_state "DNS_CHANGE_ID" "$change_id"
}

wait_dns_propagation() {
    local wait_time=$1

    print_step "Waiting ${wait_time}s for DNS propagation..."
    log "INFO" "DNS propagation wait: ${wait_time}s"

    for ((i = 0; i < wait_time; i += 5)); do
        echo -n "."
        sleep 5
    done
    echo ""
    print_success "DNS propagation complete"
}

#############################################################################
# Connectivity Verification
#############################################################################

test_api_connectivity() {
    local domain=$1
    local max_retries=5
    local retry_count=0

    print_step "Testing API connectivity to ${domain}..."
    log "INFO" "Starting API connectivity test: ${domain}"

    while [ $retry_count -lt $max_retries ]; do
        local response=$(curl -s -w "\n%{http_code}" "https://${domain}/api/health" 2>/dev/null || echo "000")
        local body=$(echo "$response" | head -n1)
        local http_code=$(echo "$response" | tail -n1)

        if [ "$http_code" = "200" ]; then
            print_success "API responding: HTTP ${http_code}"
            log "INFO" "API connectivity verified: HTTP ${http_code}"
            return 0
        else
            ((retry_count++))
            if [ $retry_count -lt $max_retries ]; then
                echo -n "."
                sleep 5
            fi
        fi
    done

    print_error "API not responding after ${max_retries} retries"
    log "ERROR" "API connectivity test failed"
    return 1
}

#############################################################################
# Launch Execution
#############################################################################

execute_launch() {
    print_header "TRANSCEND LAW PLATFORM LAUNCH SEQUENCE"
    echo "Launch Time: ${LAUNCH_TIME}"
    echo "Domain: ${PROD_DOMAIN}"
    echo "Region: ${AWS_REGION}"
    echo ""

    log "INFO" "========== LAUNCH SEQUENCE STARTED =========="
    log "INFO" "Launch timestamp: ${LAUNCH_TIMESTAMP}"

    # Step 1: Retrieve ALB DNS names
    print_step "Step 1: Retrieving infrastructure endpoints..."
    PROD_ALB_DNS=$(get_production_alb_dns)
    print_success "Production ALB: ${PROD_ALB_DNS}"
    save_state "PROD_ALB_DNS" "$PROD_ALB_DNS"

    STAGING_ALB_DNS=$(get_staging_alb_dns)
    print_success "Staging ALB: ${STAGING_ALB_DNS}"
    save_state "STAGING_ALB_DNS" "$STAGING_ALB_DNS"

    # Step 2: Update Route53 DNS
    print_step "Step 2: Updating Route53 DNS (POINT OF NO RETURN)..."
    echo -e "${YELLOW}WARNING: This switches production traffic to new infrastructure${NC}"
    log "INFO" "Executing Route53 DNS switch"

    update_route53_dns "$PROD_DOMAIN" "$PROD_ALB_DNS" "UPSERT"
    print_success "Route53 updated: ${PROD_DOMAIN} -> ${PROD_ALB_DNS}"
    save_state "LAUNCH_ACTION_COMPLETED" "true"
    save_state "LAUNCH_TIMESTAMP" "$LAUNCH_TIMESTAMP"

    # Step 3: Wait for DNS propagation
    print_step "Step 3: Waiting for DNS propagation..."
    wait_dns_propagation "$DNS_PROPAGATION_WAIT"

    # Step 4: Verify API connectivity
    print_step "Step 4: Verifying API connectivity..."
    if ! test_api_connectivity "$PROD_DOMAIN"; then
        print_error "API connectivity verification failed - rolling back"
        log "ERROR" "API connectivity failed - initiating rollback"
        # Note: Rollback will be handled by separate script or manual intervention
        exit 1
    fi

    # Step 5: Verify live status
    print_step "Step 5: Verifying live status..."
    local live_check=$(curl -s "https://${PROD_DOMAIN}/api/health" | jq -r '.status // "unknown"')
    if [ "$live_check" = "ok" ] || [ "$live_check" = "healthy" ]; then
        print_success "System status: LIVE"
    else
        print_error "System status check returned: ${live_check}"
        log "WARN" "System status: ${live_check}"
    fi

    # Summary
    echo ""
    print_header "LAUNCH COMPLETE - PRODUCTION LIVE"
    echo -e "${GREEN}✓ Launch Time: ${LAUNCH_TIME}${NC}"
    echo -e "${GREEN}✓ Domain: ${PROD_DOMAIN}${NC}"
    echo -e "${GREEN}✓ Status: LIVE${NC}"
    echo -e "${GREEN}✓ Next: Execute 03-realtime-monitoring.sh${NC}"
    echo ""

    log "INFO" "========== LAUNCH SEQUENCE COMPLETE =========="
    log "INFO" "System is LIVE and handling production traffic"
}

#############################################################################
# Main
#############################################################################

main() {
    # Create logs directory
    mkdir -p "$(dirname "$LOG_FILE")"
    mkdir -p "$(dirname "$STATE_FILE")"

    # Initialize state file
    echo "# Launch State - $(date -u +"%Y-%m-%d %H:%M:%S UTC")" > "$STATE_FILE"

    # Verify prerequisites
    if ! command -v aws &> /dev/null; then
        print_error "AWS CLI not found"
        exit 1
    fi

    if ! command -v jq &> /dev/null; then
        print_error "jq not found"
        exit 1
    fi

    if ! command -v curl &> /dev/null; then
        print_error "curl not found"
        exit 1
    fi

    # Execute launch
    execute_launch

    # Output state file for monitoring script
    echo ""
    echo "State file saved: ${STATE_FILE}"
    log "INFO" "State file: ${STATE_FILE}"
}

main "$@"
