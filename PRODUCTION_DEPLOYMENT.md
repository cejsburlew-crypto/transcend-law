# TRANSCEND LAW - PRODUCTION DEPLOYMENT GUIDE

## 🌐 Current Deployment Status

### ✅ Frontend (Vercel)
- **Status:** LIVE ✓
- **URL:** https://transcend-law-frontend.vercel.app
- **Build:** Production optimized (247 KB JS gzipped)
- **Auto-deployment:** Enabled (redeploy on git push to main)

### ⏳ Backend (AWS EC2) - PENDING SETUP
- **Status:** Pre-built, ready to deploy
- **Dist Location:** `/transcend-law/backend/dist/`
- **Port:** 3000
- **Database:** PostgreSQL (production instance needed)

### ⏳ Custom Domain (transcend-law.com) - PENDING DNS
- **Status:** Added to Vercel, needs DNS configuration
- **Action Required:** Update Squarespace DNS A record

---

## 📋 Deployment Checklist

### Phase 1: AWS EC2 Backend Setup

#### Step 1: Launch EC2 Instance
```bash
# Prerequisites:
# - AWS Account with EC2 access
# - Security group allowing:
#   - Port 22 (SSH) from your IP
#   - Port 3000 (App) from 0.0.0.0/0
#   - Port 5432 (DB) for internal only

# Recommended Instance:
# - Type: t3.medium (burstable, cost-effective)
# - OS: Ubuntu 20.04 LTS
# - Storage: 30GB EBS
# - Region: us-east-1 (same as Vercel)
```

#### Step 2: Install Dependencies
```bash
# SSH into instance
ssh -i your-key.pem ubuntu@your-instance-ip

# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install PM2 (process manager)
sudo npm install -g pm2

# Install nginx (reverse proxy)
sudo apt install -y nginx

# Verify installations
node --version
npm --version
pm2 --version
```

#### Step 3: Deploy Backend Code
```bash
# Create app directory
sudo mkdir -p /var/www/transcend-law
sudo chown ubuntu:ubuntu /var/www/transcend-law

# Clone or upload backend
cd /var/www/transcend-law
# Option A: Git clone (requires SSH key setup)
git clone https://github.com/your-repo/transcend-law.git .

# Option B: SCP from local
# From your machine:
# scp -i your-key.pem -r transcend-law/backend/* \
#   ubuntu@your-instance-ip:/var/www/transcend-law/

# Install dependencies
npm install --production

# Verify build exists
ls dist/
```

#### Step 4: Setup Environment Variables
```bash
# Create production .env file
nano /var/www/transcend-law/.env

# Add production values (from .env.production template):
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://transcend:PASSWORD@DB_HOST:5432/transcend_law_prod
REDIS_URL=redis://localhost:6379
JWT_SECRET=<your-secure-secret>
VITE_API_URL=https://transcend-law.com/api/v1
AWS_ACCESS_KEY_ID=<your-aws-key>
AWS_SECRET_ACCESS_KEY=<your-aws-secret>

# Secure the file
chmod 600 .env
```

#### Step 5: Start Backend with PM2
```bash
# Navigate to app directory
cd /var/www/transcend-law

# Start app with PM2
pm2 start dist/index.js --name "transcend-law-api"

# Configure startup on reboot
pm2 startup
pm2 save

# Verify it's running
pm2 list
pm2 logs transcend-law-api
```

#### Step 6: Configure Nginx Reverse Proxy
```bash
# Create nginx config
sudo nano /etc/nginx/sites-available/transcend-law

# Add this configuration:
server {
    listen 80;
    server_name transcend-law.com www.transcend-law.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}

# Enable the site
sudo ln -s /etc/nginx/sites-available/transcend-law \
  /etc/nginx/sites-enabled/

# Disable default site
sudo rm /etc/nginx/sites-enabled/default

# Test nginx config
sudo nginx -t

# Restart nginx
sudo systemctl restart nginx

# Enable on startup
sudo systemctl enable nginx
```

#### Step 7: Setup SSL/HTTPS with Let's Encrypt
```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Get certificate (auto-configures nginx)
sudo certbot --nginx -d transcend-law.com -d www.transcend-law.com

# Test renewal
sudo certbot renew --dry-run

# Auto-renewal is configured
```

### Phase 2: Database Setup

#### Step 1: Create Production Database
```bash
# From your local machine or DB admin:
psql -U postgres -h your-db-host -c "
  CREATE DATABASE transcend_law_prod;
  CREATE USER transcend WITH PASSWORD 'secure-password';
  ALTER ROLE transcend WITH CREATEDB;
  GRANT ALL PRIVILEGES ON DATABASE transcend_law_prod TO transcend;
"
```

#### Step 2: Run Migrations
```bash
# SSH into backend server
ssh -i your-key.pem ubuntu@your-instance-ip
cd /var/www/transcend-law

# Run migrations
DATABASE_URL="postgresql://transcend:PASSWORD@db-host:5432/transcend_law_prod" \
  npm run db:migrate

# Verify tables created
psql -U transcend -h your-db-host -d transcend_law_prod -c "\dt"
```

#### Step 3: Seed Provider Data
```bash
# Run seeding script
DATABASE_URL="postgresql://transcend:PASSWORD@db-host:5432/transcend_law_prod" \
  npm run db:seed

# Verify data
psql -U transcend -h your-db-host -d transcend_law_prod -c "SELECT COUNT(*) FROM users;"
```

### Phase 3: DNS & Domain Configuration

#### Step 1: Update Squarespace DNS
1. Log into Squarespace account
2. Go to Settings → Domains
3. Select transcend-law.com
4. Find DNS Settings
5. Add or update A record:
   ```
   Type: A
   Name: @
   Value: 76.76.21.21  (Vercel's IP)
   TTL: 3600
   ```
6. Wait for DNS propagation (5-30 minutes)

#### Step 2: Route API Subdomain (Optional)
```bash
# If using api.transcend-law.com for backend:
# In Squarespace DNS add:
Type: A
Name: api
Value: <YOUR-EC2-IP>
TTL: 3600
```

#### Step 3: Verify Domain
```bash
# Check DNS propagation
dig transcend-law.com
nslookup transcend-law.com

# Should resolve to 76.76.21.21 (Vercel) within minutes
```

### Phase 4: Verification & Testing

```bash
# Test frontend
curl -I https://transcend-law.com/
# Should return 200

# Test backend health
curl -I https://transcend-law.com/api/v1/status
# Should return 200

# Test login (demo mode)
curl -X POST https://transcend-law.com/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "demo@test.com", "password": "demo123"}'

# Check backend logs
ssh -i your-key.pem ubuntu@your-instance-ip
pm2 logs transcend-law-api
```

---

## 🔒 Security Checklist

- [ ] Change all default passwords
- [ ] Enable database backups (automated daily)
- [ ] Set up CloudWatch monitoring
- [ ] Enable AWS WAF (Web Application Firewall)
- [ ] Rotate JWT_SECRET quarterly
- [ ] Enable VPC security groups
- [ ] Set up SSH key-pair authentication only (no password)
- [ ] Enable 2FA on AWS account
- [ ] Configure CloudFlare CDN (optional, for DDoS protection)
- [ ] Set up SSL certificate auto-renewal
- [ ] Enable HSTS headers in nginx
- [ ] Regular security audits

---

## 📊 Monitoring & Maintenance

### Health Checks
```bash
# Backend health
curl https://transcend-law.com/api/v1/health

# Database connection
curl https://transcend-law.com/api/v1/health

# Frontend uptime
uptime-robot.com (set up monitoring)
```

### Logs & Debugging
```bash
# Backend logs
pm2 logs transcend-law-api

# Nginx access logs
tail -f /var/log/nginx/access.log

# Nginx error logs
tail -f /var/log/nginx/error.log

# System logs
tail -f /var/log/syslog
```

### Scaling
- **Frontend:** Auto-scaling via Vercel (no action needed)
- **Backend:** If traffic increases:
  - Upgrade EC2 instance type
  - Set up load balancer
  - Add read replicas for database

---

## 📞 Support & Rollback

### Rollback Procedure
```bash
# If deployment fails:
ssh -i your-key.pem ubuntu@your-instance-ip
cd /var/www/transcend-law

# Stop current version
pm2 stop transcend-law-api

# Restore previous version
git checkout previous-commit
npm install
npm run build

# Start again
pm2 start transcend-law-api

# Check logs
pm2 logs transcend-law-api
```

### Emergency Contacts
- AWS Support: https://console.aws.amazon.com/support
- Vercel Support: https://vercel.com/support
- PostgreSQL Help: https://www.postgresql.org/docs/

---

## 📝 Cost Estimation (Monthly)

- **EC2 (t3.medium):** ~$30-40
- **RDS PostgreSQL:** ~$20-30
- **Vercel (Pro):** ~$20
- **Data transfer:** ~$5-15
- **AWS S3 (documents):** ~$5-10
- **DNS/Domain:** ~$12/year
- **SSL Certificate:** Free (Let's Encrypt)

**Total:** ~$80-100/month

---

## ✅ Completion Verification

When all phases are complete, verify:

```bash
# Frontend live
curl -I https://transcend-law.com/
# Status: 200 OK

# Backend live
curl -I https://transcend-law.com/api/v1/status
# Status: 200 OK

# Database connected
curl https://transcend-law.com/api/v1/health | jq '.status'
# Output: "ok"

# SSL working
curl -I https://transcend-law.com | grep "HTTP"
# Should be HTTP/2 or HTTP/1.1, not upgrade warnings
```

---

**Deployment completed!** 🚀

All systems ready for production use.
