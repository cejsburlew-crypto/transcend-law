# AWS Production Deployment Setup
**Transcend Law - Deploy to Production on transcend-law.com**

**Status:** Complete setup guide ready for execution  
**Timeline:** 2-3 hours to deploy  
**Cost:** ~$100-200/month AWS

---

## QUICK START (30 minutes to live)

### Step 1: Create AWS Account (if needed)
```
1. Go to aws.amazon.com
2. Click "Create an AWS Account"
3. Enter email, password
4. Verify email
5. Add payment method
6. Verify phone
```

### Step 2: Set Up AWS CLI Locally
```bash
# Install AWS CLI
brew install awscli  # macOS
# or visit: https://aws.amazon.com/cli/

# Configure credentials
aws configure
# Enter: AWS Access Key ID
# Enter: AWS Secret Access Key
# Default region: us-east-1
# Default output format: json
```

### Step 3: Create Production Environment File
```bash
# Create .env.production in transcend-ssp/
cat > .env.production << 'EOF'
NODE_ENV=production
DATABASE_URL=postgresql://user:password@transcend-db.xxxxx.rds.amazonaws.com:5432/transcend_prod
REDIS_URL=redis://transcend-cache.xxxxx.ng.0001.use1.cache.amazonaws.com:6379
API_PORT=3000
FRONTEND_URL=https://transcend-law.com
BACKEND_URL=https://api.transcend-law.com
PAYMENT_PROCESSOR_KEY=your_key_here
JWT_SECRET=your_secret_here
EOF
```

---

## FULL AWS DEPLOYMENT SETUP

### Infrastructure Architecture

```
transcend-law.com
    ↓
Route 53 (DNS)
    ↓
CloudFront (CDN + SSL)
    ↓
Application Load Balancer
    ↓
EC2 (Node.js app) × 3
    ↓
RDS (PostgreSQL)
    ↓
ElastiCache (Redis)
```

---

## STEP-BY-STEP DEPLOYMENT

### Phase 1: Create VPC & Network (15 min)

#### 1.1: Create VPC
```bash
# AWS Console → VPC → Create VPC
VPC Name: transcend-vpc
CIDR: 10.0.0.0/16
DNS hostnames: Enable
```

#### 1.2: Create Subnets
```bash
# Public Subnet 1
Availability Zone: us-east-1a
CIDR: 10.0.1.0/24

# Public Subnet 2
Availability Zone: us-east-1b
CIDR: 10.0.2.0/24

# Private Subnet 1 (for database)
Availability Zone: us-east-1a
CIDR: 10.0.10.0/24

# Private Subnet 2 (for database)
Availability Zone: us-east-1b
CIDR: 10.0.11.0/24
```

#### 1.3: Create Internet Gateway
```bash
# VPC → Internet Gateways → Create
Name: transcend-igw
Attach to: transcend-vpc
```

#### 1.4: Create Route Tables
```bash
# Public Route Table
Routes:
  - 0.0.0.0/0 → Internet Gateway (transcend-igw)

# Associate with: Public Subnet 1, Public Subnet 2

# Private Route Table (for RDS)
Routes: Local only
```

---

### Phase 2: Create Database (20 min)

#### 2.1: Create RDS PostgreSQL
```bash
# AWS Console → RDS → Create Database

Engine: PostgreSQL
Version: 14.x

Instance class: db.t3.micro (free tier eligible)
Storage: 20 GB
Multi-AZ: Yes (for production)

DB Instance Identifier: transcend-db
Master username: postgres
Master password: [GENERATE STRONG PASSWORD]

VPC: transcend-vpc
DB Subnet Group: [Create new]
Publicly accessible: No
Security group: Create new
  - Inbound: PostgreSQL 5432 from EC2 security group only

Backup retention: 7 days
Encryption: Enable
```

#### 2.2: Get Database Endpoint
```bash
# AWS Console → RDS → Databases → transcend-db
# Copy the endpoint (looks like: transcend-db.xxxxx.rds.amazonaws.com)
# Update in .env.production
DATABASE_URL=postgresql://postgres:PASSWORD@ENDPOINT:5432/transcend_prod
```

#### 2.3: Create Database & Tables
```bash
# SSH into EC2 instance (we'll create this next)
# Then run:
psql postgresql://postgres:PASSWORD@transcend-db.xxxxx.rds.amazonaws.com:5432

# In psql console:
CREATE DATABASE transcend_prod;
\c transcend_prod

# Run migrations (if you have them)
# If not, we'll use this schema:
CREATE TABLE users (
  id VARCHAR(36) PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE cases (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) REFERENCES users(id),
  status VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE attorneys (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(255),
  rating DECIMAL(2,1),
  created_at TIMESTAMP DEFAULT NOW()
);

# Add more tables as needed for your schema
```

---

### Phase 3: Create Cache Layer (10 min)

#### 3.1: Create ElastiCache Redis
```bash
# AWS Console → ElastiCache → Create Cache

Engine: Redis
Version: 7.x

Node type: cache.t3.micro (free tier)
Number of nodes: 1

Cluster name: transcend-cache
VPC: transcend-vpc
Security group: Create new
  - Inbound: TCP 6379 from EC2 security group

Automatic failover: Enable
Backup & restore: Enable
```

#### 3.2: Get Cache Endpoint
```bash
# AWS Console → ElastiCache → Clusters → transcend-cache
# Copy the endpoint
# Update in .env.production
REDIS_URL=redis://transcend-cache.xxxxx.ng.0001.use1.cache.amazonaws.com:6379
```

---

### Phase 4: Create EC2 Application Servers (30 min)

#### 4.1: Create Security Group for EC2
```bash
# AWS Console → EC2 → Security Groups → Create

Name: transcend-app-sg
VPC: transcend-vpc

Inbound Rules:
  - HTTP 80: from Anywhere (0.0.0.0/0)
  - HTTPS 443: from Anywhere (0.0.0.0/0)
  - SSH 22: from Your IP only (for management)

Outbound Rules:
  - All: to Anywhere
```

#### 4.2: Create Application Load Balancer
```bash
# AWS Console → EC2 → Load Balancers → Create Load Balancer

Type: Application Load Balancer
Name: transcend-alb

Scheme: Internet-facing
IP address type: IPv4

Network mapping:
  - Subnets: Public Subnet 1, Public Subnet 2
  - Availability Zones: us-east-1a, us-east-1b

Security groups: transcend-app-sg

Target group:
  - Name: transcend-app-targets
  - Protocol: HTTP
  - Port: 3000
  - Health check: /health
  - Healthy threshold: 2
  - Unhealthy threshold: 2
  - Timeout: 5 seconds
  - Interval: 30 seconds
```

#### 4.3: Create Launch Template for EC2
```bash
# AWS Console → EC2 → Launch Templates → Create

Name: transcend-app-template
Description: Transcend Law application server

AMI: Ubuntu Server 22.04 LTS (ami-0c55b159cbfafe1f0)
Instance type: t3.micro

Key pair: [Create or select existing]
  # If creating: Download .pem file, save securely

Security group: transcend-app-sg

User data (paste this script):
```

#### 4.4: User Data Script (Runs on EC2 startup)
```bash
#!/bin/bash
set -e

# Update system
sudo apt-get update
sudo apt-get upgrade -y

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2 (process manager)
sudo npm install -g pm2

# Install PostgreSQL client (for migrations)
sudo apt-get install -y postgresql-client

# Clone repo
cd /opt
sudo git clone https://github.com/YOUR_GITHUB/transcend-ssp.git
cd transcend-ssp

# Install dependencies
npm install

# Create .env.production (you'll update this manually)
sudo cp .env.example .env.production

# Build frontend
cd transcend-frontend
npm install
npm run build
cd ..

# Start application with PM2
pm2 start npm --name "transcend-app" -- start
pm2 startup
pm2 save

# Setup CloudWatch logs
sudo apt-get install -y awslogs
sudo systemctl enable awslogs
sudo systemctl start awslogs
```

#### 4.5: Create Auto Scaling Group
```bash
# AWS Console → EC2 → Auto Scaling Groups → Create

Name: transcend-asg
Launch template: transcend-app-template

Subnets: Public Subnet 1, Public Subnet 2
Availability Zones: us-east-1a, us-east-1b

Target group: transcend-app-targets

Min capacity: 2
Desired capacity: 2
Max capacity: 6

Scaling policy: Target tracking
  - Target: 70% CPU utilization
  - Scale-out threshold: 70%
  - Scale-in threshold: 30%
```

---

### Phase 5: Set Up HTTPS & DNS (20 min)

#### 5.1: Request SSL Certificate
```bash
# AWS Console → Certificate Manager → Request Certificate

Domain names:
  - transcend-law.com
  - *.transcend-law.com
  - api.transcend-law.com

Validation method: DNS

# AWS will provide DNS validation records
# Add these to your domain's DNS settings
```

#### 5.2: Configure Route 53 (or your DNS provider)
```bash
# AWS Console → Route 53 → Create Hosted Zone

Zone name: transcend-law.com
Type: Public

# Create records:

# Record 1: Main domain
Name: transcend-law.com
Type: A (IPv4 address)
Alias: Yes
Alias target: transcend-alb (your load balancer)

# Record 2: WWW subdomain
Name: www.transcend-law.com
Type: A
Alias: Yes
Alias target: transcend-alb

# Record 3: API subdomain
Name: api.transcend-law.com
Type: A
Alias: Yes
Alias target: transcend-alb

# Get the nameservers from Route 53
# Update your domain registrar to use these nameservers
```

#### 5.3: Configure Load Balancer with SSL
```bash
# AWS Console → EC2 → Load Balancers → transcend-alb

Listeners:
  - HTTP 80 → Redirect to HTTPS 443
  - HTTPS 443 → Forward to transcend-app-targets
    - Certificate: [Select your ACM certificate]
```

---

### Phase 6: Deploy Application (15 min)

#### 6.1: SSH into EC2 Instance
```bash
# Get instance IP from AWS Console
# EC2 → Instances → Find running instance

ssh -i "transcend-app.pem" ubuntu@EC2_IP

# Update environment variables
sudo nano /opt/transcend-ssp/.env.production

# Add all values:
NODE_ENV=production
DATABASE_URL=postgresql://postgres:PASSWORD@transcend-db.xxxxx.rds.amazonaws.com:5432/transcend_prod
REDIS_URL=redis://transcend-cache.xxxxx.ng.0001.use1.cache.amazonaws.com:6379
API_PORT=3000
FRONTEND_URL=https://transcend-law.com
BACKEND_URL=https://api.transcend-law.com
JWT_SECRET=your_secret
PAYMENT_PROCESSOR_KEY=your_key
```

#### 6.2: Restart Application
```bash
cd /opt/transcend-ssp

# Pull latest code
git pull origin main

# Install dependencies
npm install

# Build frontend
cd transcend-frontend
npm install
npm run build
cd ..

# Restart with PM2
pm2 restart transcend-app
pm2 save

# Check logs
pm2 logs transcend-app
```

#### 6.3: Verify Application
```bash
# Check if running
pm2 status

# Test API endpoint
curl -I https://api.transcend-law.com/health

# Should return 200 OK
```

---

### Phase 7: Set Up Monitoring & Logging (15 min)

#### 7.1: CloudWatch Logs
```bash
# AWS Console → CloudWatch → Log Groups

Create log groups:
  - /transcend-law/app
  - /transcend-law/database
  - /transcend-law/cache
```

#### 7.2: Create Alarms
```bash
# AWS Console → CloudWatch → Alarms

Alarm 1: High CPU Usage
  - Threshold: >80%
  - Action: Send SNS notification

Alarm 2: Database Connection Failures
  - Threshold: >5 failures
  - Action: Send SNS notification

Alarm 3: Application Down
  - Health check: /health
  - Threshold: >2 failed checks
  - Action: Send SNS notification + Auto-restart
```

#### 7.3: Set Up SNS Notifications
```bash
# AWS Console → SNS → Create Topic

Name: transcend-alerts
Subscription: Email
Email: your-email@company.com

# Confirm subscription in email
```

---

## COST ESTIMATE (Monthly)

```
EC2 (t3.micro × 2):         $20
RDS PostgreSQL (db.t3.micro): $25
ElastiCache Redis (cache.t3.micro): $15
Load Balancer:              $15
Data transfer (100GB):      $15
Route 53:                   $5
SSL Certificate:            Free (AWS Certificate Manager)
─────────────────────────
TOTAL:                     ~$95/month

Free tier coverage:
- First 12 months: EC2, RDS, ElastiCache included
- After year 1: Above costs apply
```

---

## DEPLOYMENT SCRIPTS

### Script 1: Deploy.sh (Run this to deploy)
```bash
#!/bin/bash
set -e

echo "🚀 Deploying Transcend Law to AWS..."

# Get EC2 instances
INSTANCES=$(aws ec2 describe-instances \
  --filters "Name=tag:Name,Values=transcend-app" \
  --query 'Reservations[].Instances[].PublicIpAddress' \
  --output text)

for INSTANCE_IP in $INSTANCES; do
  echo "Deploying to $INSTANCE_IP..."
  
  ssh -i transcend-app.pem ubuntu@$INSTANCE_IP << 'EOF'
    cd /opt/transcend-ssp
    git pull origin main
    npm install
    cd transcend-frontend
    npm install
    npm run build
    cd ..
    pm2 restart transcend-app
    echo "✅ Deployment complete on $INSTANCE_IP"
EOF
done

echo "✅ Deployment complete on all instances"
echo "🌐 Access at: https://transcend-law.com"
```

### Script 2: Health Check
```bash
#!/bin/bash

echo "Checking application health..."

# Check API
API_STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://api.transcend-law.com/health)
if [ "$API_STATUS" = "200" ]; then
  echo "✅ API: HEALTHY"
else
  echo "❌ API: UNHEALTHY (Status: $API_STATUS)"
fi

# Check database
DB_STATUS=$(aws rds describe-db-instances \
  --db-instance-identifier transcend-db \
  --query 'DBInstances[0].DBInstanceStatus' \
  --output text)
if [ "$DB_STATUS" = "available" ]; then
  echo "✅ Database: HEALTHY"
else
  echo "❌ Database: UNHEALTHY (Status: $DB_STATUS)"
fi

# Check cache
CACHE_STATUS=$(aws elasticache describe-cache-clusters \
  --cache-cluster-id transcend-cache \
  --query 'CacheClusters[0].CacheClusterStatus' \
  --output text)
if [ "$CACHE_STATUS" = "available" ]; then
  echo "✅ Cache: HEALTHY"
else
  echo "❌ Cache: UNHEALTHY (Status: $CACHE_STATUS)"
fi
```

---

## NEXT STEPS

1. **Create AWS Account** (if needed)
2. **Follow phases 1-7 above**
3. **Update environment variables** on EC2
4. **Run deployment script**
5. **Verify at https://transcend-law.com**

Once deployed:
- ✅ App live at transcend-law.com
- ✅ API at api.transcend-law.com
- ✅ SSL/HTTPS enabled
- ✅ Auto-scaling configured
- ✅ Monitoring & alerts active
- ✅ Database backed up automatically

---

**Estimated Time:** 2-3 hours for first-time setup  
**Support:** AWS documentation at docs.aws.amazon.com

