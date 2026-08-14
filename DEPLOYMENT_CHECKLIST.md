# 🚀 TRANSCEND LAW - PRODUCTION DEPLOYMENT CHECKLIST

## Current Status: 85% Complete

### ✅ COMPLETED
- [x] Frontend built and deployed to Vercel
- [x] Frontend auto-deployment configured
- [x] Backend pre-built and ready (dist/ folder ready)
- [x] Production environment templates created
- [x] Database seeding scripts prepared
- [x] Custom domain added to Vercel
- [x] Comprehensive deployment guide written

### ⏳ REMAINING STEPS (15% - Manual AWS Setup)

---

## 📋 QUICK START (What You Need To Do)

### Step 1: AWS Account Setup (15 mins)
- [ ] Log into AWS Console
- [ ] Create EC2 security group allowing:
  - Port 22 (SSH) from your IP
  - Port 3000 (App) from 0.0.0.0/0
  - Port 80/443 (Web) from 0.0.0.0/0

### Step 2: Launch EC2 Instance (10 mins)
- [ ] Instance type: **t3.medium** (burstable, cost-effective)
- [ ] OS: **Ubuntu 20.04 LTS**
- [ ] Storage: **30GB EBS**
- [ ] Region: **us-east-1**
- [ ] Security group: ↑ (created above)
- [ ] Save SSH key pair to: `~/.ssh/transcend-law-key.pem`

### Step 3: Setup Production Database (15 mins)
- [ ] Create PostgreSQL database:
  ```bash
  psql -U postgres -h your-db-host -c "
    CREATE DATABASE transcend_law_prod;
    CREATE USER transcend WITH PASSWORD 'your-secure-password';
    GRANT ALL PRIVILEGES ON DATABASE transcend_law_prod TO transcend;
  "
  ```
- [ ] Record DB credentials:
  - Host: `_______________`
  - User: `transcend`
  - Password: `_______________`
  - Database: `transcend_law_prod`

### Step 4: Deploy Backend to EC2 (20 mins)
```bash
# SSH into EC2 instance
ssh -i ~/.ssh/transcend-law-key.pem ubuntu@your-ec2-ip

# Run these commands on EC2:
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt update && sudo apt install -y nodejs nginx certbot python3-certbot-nginx pm2

# Deploy code
sudo mkdir -p /var/www/transcend-law
sudo chown ubuntu:ubuntu /var/www/transcend-law
cd /var/www/transcend-law

# Copy backend files here (from local machine):
# scp -i ~/.ssh/transcend-law-key.pem -r path/to/transcend-law/backend/* \
#   ubuntu@your-ec2-ip:/var/www/transcend-law/

npm install --production
```

### Step 5: Configure Environment Variables (5 mins)
```bash
# On EC2 instance:
nano /var/www/transcend-law/.env

# Paste and update:
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://transcend:PASSWORD@your-db-host:5432/transcend_law_prod
JWT_SECRET=generate-a-random-secret-here
VITE_API_URL=https://transcend-law.com/api/v1
FRONTEND_URL=https://transcend-law.com
AWS_ACCESS_KEY_ID=your-aws-key
AWS_SECRET_ACCESS_KEY=your-aws-secret

# Save: Ctrl+O, Enter, Ctrl+X
chmod 600 .env
```

### Step 6: Start Backend with PM2 (5 mins)
```bash
# On EC2 instance:
cd /var/www/transcend-law
pm2 start dist/index.js --name "transcend-law-api"
pm2 startup
pm2 save
pm2 logs
```

### Step 7: Setup Nginx & SSL (10 mins)
```bash
# On EC2 instance:
sudo nano /etc/nginx/sites-available/transcend-law

# Paste this configuration:
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

# Enable and restart:
sudo ln -s /etc/nginx/sites-available/transcend-law /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx
sudo certbot --nginx -d transcend-law.com -d www.transcend-law.com
```

### Step 8: Update DNS on Squarespace (5 mins)
1. Log into Squarespace
2. Go to Settings → Domains → transcend-law.com
3. Go to DNS Settings
4. Update A record:
   - Name: `@`
   - Type: `A`
   - Value: `76.76.21.21`
   - TTL: `3600`
5. Add API record (if using api subdomain):
   - Name: `api`
   - Type: `A`
   - Value: `YOUR-EC2-IP`
   - TTL: `3600`
6. Wait 5-30 mins for DNS propagation

### Step 9: Run Database Migrations (5 mins)
```bash
# On EC2 instance:
cd /var/www/transcend-law
DATABASE_URL="postgresql://transcend:PASSWORD@your-db-host:5432/transcend_law_prod" \
  npm run db:migrate

# Verify tables were created
psql -U transcend -h your-db-host -d transcend_law_prod -c "\dt"
```

### Step 10: Seed Provider Data (2 mins)
```bash
# On EC2 instance:
DATABASE_URL="postgresql://transcend:PASSWORD@your-db-host:5432/transcend_law_prod" \
  node dist/db/seed-providers.js

# Should see:
# ✅ Seeding complete! Added 20 providers.
```

---

## ✅ Verification

After completing all steps, verify everything is working:

```bash
# Test frontend (should return 200)
curl -I https://transcend-law.com/

# Test backend health (should return 200)
curl -I https://transcend-law.com/api/v1/health

# Test API endpoint
curl https://transcend-law.com/api/v1/status

# Check backend logs
ssh -i ~/.ssh/transcend-law-key.pem ubuntu@your-ec2-ip
pm2 logs transcend-law-api
```

---

## 📞 Support Resources

If you get stuck, check the comprehensive guide:
→ **See:** `PRODUCTION_DEPLOYMENT.md` for detailed instructions

Key sections:
- AWS EC2 Backend Setup (full step-by-step)
- Database Setup & Migrations
- DNS & Domain Configuration
- SSL/HTTPS with Let's Encrypt
- Monitoring & Maintenance
- Rollback Procedures

---

## 💰 Estimated Monthly Costs

- EC2 (t3.medium): $30-40
- RDS PostgreSQL: $20-30
- Vercel Pro: $20
- AWS S3 + Data: $10-25
- **Total: ~$80-115/month**

---

## 🎯 Final Checklist

Before going live:

- [ ] All 10 steps above completed
- [ ] Backend logs show "listening on port 3000"
- [ ] Frontend responds to HTTPS requests
- [ ] API health endpoint returns 200
- [ ] Database contains seeded provider data (20 providers)
- [ ] SSL certificate installed and auto-renewing
- [ ] Backups configured for database
- [ ] Security groups properly configured
- [ ] JWT secret is strong (30+ characters)
- [ ] .env file has secure permissions (chmod 600)

---

**TIME ESTIMATE:** 90 minutes total for manual setup

**YOU ARE HERE:** 85% complete. Just need to run AWS steps manually.

---

## 🚀 After Deployment

Your platform will be live at:
- **Frontend:** https://transcend-law.com
- **API:** https://transcend-law.com/api/v1
- **Dashboard:** https://transcend-law.com (login with demo mode)

All 20 service providers seeded and ready for discovery!

---

For any issues, refer to `PRODUCTION_DEPLOYMENT.md` section for troubleshooting.
