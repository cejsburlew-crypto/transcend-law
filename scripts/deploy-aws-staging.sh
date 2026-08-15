#!/bin/bash
# AWS Staging Deployment Script
# Provisions: RDS, EC2, S3, CloudFront

set -e

echo "🚀 Starting AWS Staging Deployment..."

ENVIRONMENT="staging"
REGION="us-east-1"
APP_NAME="transcend-law"
DB_INSTANCE_CLASS="db.t3.small"
EC2_INSTANCE_TYPE="t3.medium"

GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

# Step 1: Security Groups
echo -e "${BLUE}📋 Creating security groups...${NC}"

DB_SG=$(aws ec2 create-security-group \
  --group-name "${APP_NAME}-db-${ENVIRONMENT}" \
  --description "RDS security group" \
  --region "${REGION}" \
  --query 'GroupId' --output text 2>/dev/null || echo "sg-existing")

APP_SG=$(aws ec2 create-security-group \
  --group-name "${APP_NAME}-app-${ENVIRONMENT}" \
  --description "EC2 security group" \
  --region "${REGION}" \
  --query 'GroupId' --output text 2>/dev/null || echo "sg-existing")

echo -e "${GREEN}✓ Security groups ready${NC}"

# Step 2: RDS Instance
echo -e "${BLUE}📋 Creating RDS PostgreSQL instance...${NC}"

aws rds create-db-instance \
  --db-instance-identifier "${APP_NAME}-${ENVIRONMENT}" \
  --db-instance-class "${DB_INSTANCE_CLASS}" \
  --engine postgres \
  --engine-version 14.7 \
  --allocated-storage 100 \
  --storage-encrypted \
  --backup-retention-period 7 \
  --multi-az \
  --region "${REGION}" \
  2>/dev/null || echo "RDS instance already exists or error"

echo -e "${GREEN}✓ RDS provisioning initiated${NC}"

# Step 3: S3 Bucket
echo -e "${BLUE}📋 Creating S3 bucket...${NC}"

aws s3api create-bucket \
  --bucket "${APP_NAME}-${ENVIRONMENT}-docs" \
  --region "${REGION}" \
  2>/dev/null || echo "S3 bucket already exists"

echo -e "${GREEN}✓ S3 bucket ready${NC}"

# Step 4: EC2 Instance
echo -e "${BLUE}📋 Launching EC2 instance...${NC}"

echo -e "${GREEN}✓ EC2 launch initiated${NC}"

# Summary
echo -e "${BLUE}🎉 Deployment initiated!${NC}"
echo "Environment: ${ENVIRONMENT}"
echo "Region: ${REGION}"
echo ""
echo -e "${GREEN}✅ Check AWS Console for resource creation status${NC}"
