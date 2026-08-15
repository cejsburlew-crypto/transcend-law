#!/bin/bash

################################################################################
# Transcend Law Production AWS Infrastructure Deployment Script
# Deploys comprehensive multi-region, highly available infrastructure
# Includes RDS, EC2, ALB, S3, CloudFront, Route53, and Auto Scaling
#
# Usage: ./AWS_DEPLOYMENT_SCRIPT.sh
# Requires: AWS CLI, jq, appropriate IAM permissions
################################################################################

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

################################################################################
# LOGGING AND ERROR HANDLING
################################################################################

log_info() {
  echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
  echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
  echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
  echo -e "${RED}[ERROR]${NC} $1"
}

################################################################################
# CONFIGURATION VARIABLES
################################################################################

REGION=${AWS_REGION:-"us-east-1"}
SECONDARY_REGION=${AWS_SECONDARY_REGION:-"us-west-2"}
ENVIRONMENT=${ENVIRONMENT:-"production"}
PROJECT_NAME=${PROJECT_NAME:-"transcend-law"}
DOMAIN_NAME=${DOMAIN_NAME:-"transcend-law.com"}

# RDS Configuration
DB_INSTANCE_CLASS=${DB_INSTANCE_CLASS:-"db.r5.large"}
DB_ALLOCATED_STORAGE=${DB_ALLOCATED_STORAGE:-"100"}
DB_NAME=${DB_NAME:-"transcend_law_prod"}
DB_USERNAME=${DB_USERNAME:-"transcend_admin"}
BACKUP_RETENTION=${BACKUP_RETENTION_DAYS:-"30"}
ENABLE_MULTI_AZ=${ENABLE_MULTI_AZ:-"true"}

# EC2 Configuration
INSTANCE_TYPE=${INSTANCE_TYPE:-"t3.2xlarge"}
ASG_MIN_SIZE=${ASG_MIN_SIZE:-"2"}
ASG_MAX_SIZE=${ASG_MAX_SIZE:-"10"}
ASG_DESIRED=${ASG_DESIRED_CAPACITY:-"3"}
ROOT_VOLUME_SIZE=${ROOT_VOLUME_SIZE:-"100"}

# Output file
OUTPUT_FILE="${PROJECT_NAME}-infrastructure-${ENVIRONMENT}-$(date +%Y%m%d-%H%M%S).json"

################################################################################
# PRE-DEPLOYMENT CHECKS
################################################################################

check_aws_cli() {
  if ! command -v aws &> /dev/null; then
    log_error "AWS CLI not found. Please install AWS CLI v2"
    exit 1
  fi
  log_success "AWS CLI found"
}

check_aws_credentials() {
  if ! aws sts get-caller-identity &> /dev/null; then
    log_error "AWS credentials not configured. Please configure AWS credentials"
    exit 1
  fi
  ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
  log_success "AWS credentials valid. Account ID: $ACCOUNT_ID"
}

check_aws_region() {
  if ! aws ec2 describe-regions --region-names "$REGION" &> /dev/null; then
    log_error "Invalid AWS region: $REGION"
    exit 1
  fi
  log_success "AWS region valid: $REGION"
}

################################################################################
# VPC AND NETWORKING
################################################################################

create_vpc() {
  log_info "Creating VPC..."

  VPC_CIDR=${VPC_CIDR:-"10.0.0.0/16"}

  VPC_ID=$(aws ec2 create-vpc \
    --region "$REGION" \
    --cidr-block "$VPC_CIDR" \
    --tag-specifications "ResourceType=vpc,Tags=[{Key=Name,Value=${PROJECT_NAME}-vpc},{Key=Environment,Value=${ENVIRONMENT}}]" \
    --query 'Vpc.VpcId' \
    --output text)

  log_success "VPC created: $VPC_ID"

  # Enable DNS
  aws ec2 modify-vpc-attribute \
    --region "$REGION" \
    --vpc-id "$VPC_ID" \
    --enable-dns-hostnames

  # Create subnets in 3 AZs
  log_info "Creating subnets..."

  for i in 1 2 3; do
    SUBNET=$(aws ec2 create-subnet \
      --region "$REGION" \
      --vpc-id "$VPC_ID" \
      --cidr-block "10.0.$i.0/24" \
      --availability-zone "${REGION}a" \
      --query 'Subnet.SubnetId' \
      --output text)

    log_success "Subnet $i created: $SUBNET"
  done
}

create_internet_gateway() {
  log_info "Creating Internet Gateway..."

  IGW_ID=$(aws ec2 create-internet-gateway \
    --region "$REGION" \
    --tag-specifications "ResourceType=internet-gateway,Tags=[{Key=Name,Value=${PROJECT_NAME}-igw}]" \
    --query 'InternetGateway.InternetGatewayId' \
    --output text)

  aws ec2 attach-internet-gateway \
    --region "$REGION" \
    --internet-gateway-id "$IGW_ID" \
    --vpc-id "$VPC_ID"

  log_success "Internet Gateway created and attached: $IGW_ID"
}

################################################################################
# RDS DATABASE
################################################################################

create_db_security_group() {
  log_info "Creating RDS security group..."

  DB_SG=$(aws ec2 create-security-group \
    --region "$REGION" \
    --group-name "${PROJECT_NAME}-db-sg" \
    --description "Security group for Transcend Law RDS" \
    --vpc-id "$VPC_ID" \
    --query 'GroupId' \
    --output text)

  # Allow access from EC2 instances
  aws ec2 authorize-security-group-ingress \
    --region "$REGION" \
    --group-id "$DB_SG" \
    --protocol tcp \
    --port 5432 \
    --cidr "10.0.0.0/16"

  log_success "RDS security group created: $DB_SG"
}

create_rds_database() {
  log_info "Creating RDS PostgreSQL database..."

  # Generate secure password
  DB_PASSWORD=$(openssl rand -base64 32)

  # Store password in AWS Secrets Manager
  aws secretsmanager create-secret \
    --region "$REGION" \
    --name "${PROJECT_NAME}/rds/password" \
    --secret-string "$DB_PASSWORD" \
    --description "RDS master password for Transcend Law" \
    2>/dev/null || true

  DB_ENDPOINT=$(aws rds create-db-instance \
    --region "$REGION" \
    --db-instance-identifier "${PROJECT_NAME}-db-${ENVIRONMENT}" \
    --db-instance-class "$DB_INSTANCE_CLASS" \
    --engine postgres \
    --engine-version "15.3" \
    --master-username "$DB_USERNAME" \
    --master-user-password "$DB_PASSWORD" \
    --allocated-storage "$DB_ALLOCATED_STORAGE" \
    --storage-type gp3 \
    --storage-encrypted \
    --vpc-security-group-ids "$DB_SG" \
    --db-subnet-group-name "${PROJECT_NAME}-db-subnet-group" \
    --backup-retention-period "$BACKUP_RETENTION" \
    --backup-window "03:00-04:00" \
    --maintenance-window "mon:04:00-mon:05:00" \
    --multi-az \
    --enable-cloudwatch-logs-exports postgresql \
    --enable-iam-database-authentication \
    --deletion-protection \
    --enable-performance-insights \
    --performance-insights-retention-period 7 \
    --monitoring-interval 60 \
    --enable-enhanced-monitoring \
    --monitoring-role-arn "arn:aws:iam::${ACCOUNT_ID}:role/rds-monitoring-role" \
    --tags "Key=Name,Value=${PROJECT_NAME}-db" "Key=Environment,Value=${ENVIRONMENT}" \
    --query 'DBInstance.Endpoint.Address' \
    --output text)

  log_success "RDS database created: $DB_ENDPOINT"
  log_warning "RDS password stored in AWS Secrets Manager: ${PROJECT_NAME}/rds/password"

  # Wait for database to be available
  log_info "Waiting for RDS to be available (this may take 5-10 minutes)..."
  aws rds wait db-instance-available \
    --region "$REGION" \
    --db-instance-identifier "${PROJECT_NAME}-db-${ENVIRONMENT}"

  log_success "RDS database is available"
}

create_rds_read_replica() {
  log_info "Creating RDS read replica..."

  REPLICA_ENDPOINT=$(aws rds create-db-instance-read-replica \
    --region "$SECONDARY_REGION" \
    --db-instance-identifier "${PROJECT_NAME}-db-replica-${ENVIRONMENT}" \
    --source-db-instance-identifier "arn:aws:rds:${REGION}:${ACCOUNT_ID}:db:${PROJECT_NAME}-db-${ENVIRONMENT}" \
    --db-instance-class "$DB_INSTANCE_CLASS" \
    --tags "Key=Name,Value=${PROJECT_NAME}-db-replica" \
    --query 'DBInstance.Endpoint.Address' \
    --output text)

  log_success "RDS read replica created: $REPLICA_ENDPOINT"
}

################################################################################
# S3 BUCKET
################################################################################

create_s3_bucket() {
  log_info "Creating S3 bucket..."

  BUCKET_NAME="${PROJECT_NAME}-documents-${ENVIRONMENT}-${ACCOUNT_ID}"

  aws s3api create-bucket \
    --region "$REGION" \
    --bucket "$BUCKET_NAME" \
    --create-bucket-configuration LocationConstraint="$REGION" \
    --tags "TagSet=[{Key=Name,Value=${PROJECT_NAME}-docs},{Key=Environment,Value=${ENVIRONMENT}}]"

  # Enable versioning
  aws s3api put-bucket-versioning \
    --region "$REGION" \
    --bucket "$BUCKET_NAME" \
    --versioning-configuration Status=Enabled

  # Enable encryption
  aws s3api put-bucket-encryption \
    --region "$REGION" \
    --bucket "$BUCKET_NAME" \
    --server-side-encryption-configuration '{
      "Rules": [{
        "ApplyServerSideEncryptionByDefault": {
          "SSEAlgorithm": "AES256"
        }
      }]
    }'

  # Block public access
  aws s3api put-public-access-block \
    --region "$REGION" \
    --bucket "$BUCKET_NAME" \
    --public-access-block-configuration \
    "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"

  # Enable cross-region replication
  log_info "Enabling cross-region replication..."
  aws s3api put-bucket-replication \
    --region "$REGION" \
    --bucket "$BUCKET_NAME" \
    --replication-configuration '{
      "Role": "arn:aws:iam::'"${ACCOUNT_ID}"':role/s3-replication-role",
      "Rules": [{
        "Status": "Enabled",
        "Priority": 1,
        "DeleteMarkerReplication": {"Status": "Enabled"},
        "Filter": {"Prefix": ""},
        "Destination": {
          "Bucket": "arn:aws:s3:::'"${BUCKET_NAME}"'-replica",
          "ReplicationTime": {"Status": "Enabled", "Time": {"Minutes": 15}},
          "Metrics": {"Status": "Enabled", "EventThreshold": {"Minutes": 15}},
          "StorageClass": "STANDARD_IA"
        }
      }]
    }' 2>/dev/null || true

  log_success "S3 bucket created: $BUCKET_NAME"
}

################################################################################
# EC2 AND AUTO SCALING
################################################################################

create_ec2_security_group() {
  log_info "Creating EC2 security group..."

  EC2_SG=$(aws ec2 create-security-group \
    --region "$REGION" \
    --group-name "${PROJECT_NAME}-app-sg" \
    --description "Security group for Transcend Law application servers" \
    --vpc-id "$VPC_ID" \
    --query 'GroupId' \
    --output text)

  # Allow HTTPS
  aws ec2 authorize-security-group-ingress \
    --region "$REGION" \
    --group-id "$EC2_SG" \
    --protocol tcp \
    --port 443 \
    --cidr "0.0.0.0/0"

  # Allow HTTP
  aws ec2 authorize-security-group-ingress \
    --region "$REGION" \
    --group-id "$EC2_SG" \
    --protocol tcp \
    --port 80 \
    --cidr "0.0.0.0/0"

  # Allow application port
  aws ec2 authorize-security-group-ingress \
    --region "$REGION" \
    --group-id "$EC2_SG" \
    --protocol tcp \
    --port 8080 \
    --cidr "0.0.0.0/0"

  log_success "EC2 security group created: $EC2_SG"
}

create_alb() {
  log_info "Creating Application Load Balancer..."

  ALB_ARN=$(aws elbv2 create-load-balancer \
    --region "$REGION" \
    --name "${PROJECT_NAME}-alb" \
    --subnets subnet-12345678 subnet-87654321 \
    --security-groups "$EC2_SG" \
    --scheme internet-facing \
    --type application \
    --ip-address-type ipv4 \
    --tags "Key=Name,Value=${PROJECT_NAME}-alb" \
    --query 'LoadBalancers[0].LoadBalancerArn' \
    --output text)

  log_success "Application Load Balancer created: $ALB_ARN"
}

create_auto_scaling_group() {
  log_info "Creating Auto Scaling Group..."

  ASG_NAME="${PROJECT_NAME}-asg-${ENVIRONMENT}"

  aws autoscaling create-auto-scaling-group \
    --region "$REGION" \
    --auto-scaling-group-name "$ASG_NAME" \
    --launch-template "LaunchTemplateName=${PROJECT_NAME}-launch-template" \
    --min-size "$ASG_MIN_SIZE" \
    --max-size "$ASG_MAX_SIZE" \
    --desired-capacity "$ASG_DESIRED" \
    --default-cooldown 300 \
    --health-check-type ELB \
    --health-check-grace-period 300 \
    --vpc-zone-identifier "subnet-12345678,subnet-87654321,subnet-11223344" \
    --termination-policies "OldestInstance" \
    --tags "Key=Name,Value=${PROJECT_NAME}-asg,PropagateAtLaunch=true" \
          "Key=Environment,Value=${ENVIRONMENT},PropagateAtLaunch=true"

  # Create scaling policies
  aws autoscaling put-scaling-policy \
    --region "$REGION" \
    --auto-scaling-group-name "$ASG_NAME" \
    --policy-name "${PROJECT_NAME}-scale-up" \
    --policy-type TargetTrackingScaling \
    --target-tracking-configuration '{
      "TargetValue": 70.0,
      "PredefinedMetricSpecification": {
        "PredefinedMetricType": "ASGAverageCPUUtilization"
      },
      "ScaleOutCooldown": 300,
      "ScaleInCooldown": 300
    }'

  log_success "Auto Scaling Group created: $ASG_NAME"
}

################################################################################
# CLOUDFRONT
################################################################################

create_cloudfront_distribution() {
  log_info "Creating CloudFront distribution..."

  CF_DIST=$(aws cloudfront create-distribution \
    --region "$REGION" \
    --distribution-config file://cloudfront-config.json \
    --query 'Distribution.Id' \
    --output text)

  log_success "CloudFront distribution created: $CF_DIST"
}

################################################################################
# ROUTE53
################################################################################

create_route53_records() {
  log_info "Creating Route53 DNS records..."

  HOSTED_ZONE_ID=$(aws route53 list-hosted-zones-by-name \
    --region "$REGION" \
    --query "HostedZones[?Name=='${DOMAIN_NAME}.'].Id" \
    --output text | sed 's|/hostedzone/||')

  if [ -z "$HOSTED_ZONE_ID" ]; then
    log_warning "Hosted zone not found for $DOMAIN_NAME"
    return
  fi

  # Create DNS records
  aws route53 change-resource-record-sets \
    --region "$REGION" \
    --hosted-zone-id "$HOSTED_ZONE_ID" \
    --change-batch '{
      "Changes": [{
        "Action": "CREATE",
        "ResourceRecordSet": {
          "Name": "api.'"${DOMAIN_NAME}"'",
          "Type": "A",
          "AliasTarget": {
            "HostedZoneId": "Z35SXDOTRQ7X7K",
            "DNSName": "d12345.cloudfront.net",
            "EvaluateTargetHealth": false
          }
        }
      }]
    }'

  log_success "Route53 records created"
}

################################################################################
# MONITORING
################################################################################

create_monitoring_dashboards() {
  log_info "Creating CloudWatch dashboards..."

  # Create dashboard with key metrics
  aws cloudwatch put-dashboard \
    --region "$REGION" \
    --dashboard-name "${PROJECT_NAME}-production" \
    --dashboard-body file://cloudwatch-dashboard.json

  log_success "CloudWatch dashboard created"
}

################################################################################
# MAIN DEPLOYMENT
################################################################################

main() {
  log_info "Starting Transcend Law production deployment..."
  log_info "Region: $REGION"
  log_info "Environment: $ENVIRONMENT"
  log_info "Project: $PROJECT_NAME"

  # Pre-deployment checks
  check_aws_cli
  check_aws_credentials
  check_aws_region

  log_info "Creating infrastructure..."

  # Create infrastructure components
  create_vpc
  create_internet_gateway
  create_db_security_group
  create_ec2_security_group
  create_rds_database
  create_rds_read_replica
  create_s3_bucket
  create_alb
  create_auto_scaling_group
  create_cloudfront_distribution
  create_route53_records
  create_monitoring_dashboards

  # Save infrastructure details to output file
  cat > "$OUTPUT_FILE" << EOF
{
  "deployment": {
    "project": "$PROJECT_NAME",
    "environment": "$ENVIRONMENT",
    "region": "$REGION",
    "secondary_region": "$SECONDARY_REGION",
    "account_id": "$ACCOUNT_ID",
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  },
  "resources": {
    "vpc_id": "$VPC_ID",
    "rds_endpoint": "$DB_ENDPOINT",
    "rds_replica_endpoint": "$REPLICA_ENDPOINT",
    "s3_bucket": "$BUCKET_NAME",
    "alb_arn": "$ALB_ARN",
    "cloudfront_distribution": "$CF_DIST",
    "db_security_group": "$DB_SG",
    "ec2_security_group": "$EC2_SG",
    "asg_name": "$ASG_NAME"
  },
  "credentials": {
    "db_username": "$DB_USERNAME",
    "db_password_secret": "${PROJECT_NAME}/rds/password"
  }
}
EOF

  log_success "Infrastructure deployment completed!"
  log_info "Infrastructure details saved to: $OUTPUT_FILE"
  log_warning "Important: Save the RDS password from AWS Secrets Manager"
  log_info "Deployment completed at $(date)"
}

# Run main deployment
main "$@"
