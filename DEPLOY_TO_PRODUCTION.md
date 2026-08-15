# Deploy Transcend Law to Production
## Live at transcend-law.com with AWS

### Prerequisites
- AWS Account (you have this ✅)
- GitHub repo (you have this ✅)
- Domain: transcend-law.com on Squarespace (you have this ✅)
- Local: AWS CLI installed + Terraform installed

### Quick Deploy (30 minutes)

#### Step 1: Install Terraform & AWS CLI
```bash
# macOS
brew install terraform awscli

# Verify
terraform version
aws --version
```

#### Step 2: Configure AWS Credentials
```bash
# Get credentials from AWS Console → IAM → Users → Security credentials
aws configure

# Enter:
# AWS Access Key ID: [from AWS Console]
# AWS Secret Access Key: [from AWS Console]
# Default region: us-east-1
# Default output format: json
```

#### Step 3: Deploy Infrastructure
```bash
cd transcend-ssp/terraform

# Initialize Terraform
terraform init

# Review what will be created
terraform plan -out=tfplan

# Deploy (this takes ~10 minutes)
terraform apply tfplan

# Save outputs
terraform output > ../terraform_outputs.txt
```

#### Step 4: Update Environment Variables
```bash
# Copy example
cp .env.production.example .env.production

# Edit with your values:
# - DATABASE_URL: Copy from terraform outputs
# - REDIS_URL: Copy from terraform outputs
# - JWT_SECRET: Generate a random string
# - PAYMENT_PROCESSOR_KEY: Your Stripe key
# - SMTP credentials: Your email

nano .env.production
```

#### Step 5: Push to GitHub
```bash
git add .
git commit -m "🚀 Production deployment setup - Terraform + Docker"
git push origin main
```

#### Step 6: Update Squarespace DNS
```
Go to: https://squarespace.com → transcend-law.com → DNS

Replace nameservers with AWS Route 53 nameservers:
(Get from AWS Console → Route 53 → Hosted Zones → transcend-law.com)

Then add records:
- @ (root): A record → ALB DNS name (from terraform outputs)
- www: CNAME → ALB DNS name
- api: A record → ALB DNS name
```

#### Step 7: Access Your App
```
https://transcend-law.com  ✅ LIVE
https://api.transcend-law.com  ✅ LIVE
```

### What Gets Created
✅ VPC with public/private subnets
✅ Application Load Balancer (with SSL)
✅ RDS PostgreSQL database
✅ ElastiCache Redis
✅ Auto Scaling Group
✅ Security groups
✅ Route 53 DNS

### Monthly Cost
~$95/month (first 12 months free tier covered)

### Monitor Your App
```bash
# SSH into EC2 instance
ssh -i transcend-app.pem ec2-user@INSTANCE_IP

# View logs
pm2 logs transcend-app

# Check status
pm2 status

# Restart if needed
pm2 restart transcend-app
```

### Need Help?
1. Check terraform_outputs.txt for endpoints
2. Review AWS Console → CloudWatch Logs
3. Check Application Load Balancer health checks
4. Verify RDS is available in AWS Console

### Done! 🎉
Your app is now live at transcend-law.com

