# 🚀 TRANSCEND LAW - GO LIVE EXECUTION GUIDE

**Status:** PRODUCTION DEPLOYMENT IN PROGRESS  
**Start Time:** August 13, 2026  
**Target:** https://transcend-law.com (Live)  
**Estimated Time:** 60-90 minutes

---

## ⚡ QUICK START (Copy-Paste Commands)

### PHASE 1: AWS EC2 INSTANCE SETUP (15 minutes)

**1. Create Security Group:**
```bash
# Go to AWS Console → EC2 → Security Groups → Create Security Group
# Name: transcend-law-sg
# Rules:
#   Port 22 (SSH): Your IP only
#   Port 80 (HTTP): 0.0.0.0/0
#   Port 443 (HTTPS): 0.0.0.0/0
#   Port 3000 (App): 0.0.0.0/0
```

**2. Launch EC2 Instance:**
```bash
# AWS Console → EC2 → Instances → Launch Instance
# - Name: transcend-law-api
# - OS: Ubuntu Server 20.04 LTS
# - Instance Type: t3.medium
# - Security Group: transcend-law-sg
# - Storage: 30GB EBS
# - Download key pair: transcend-law-key.pem
# - Save to: ~/.ssh/transcend-law-key.pem
```

**3. Set Permissions:**
```bash
chmod 400 ~/.ssh/transcend-law-key.pem
```

**4. Get EC2 IP:**
```bash
# From AWS Console, copy the public IPv4 address of your instance
# Example: 3.145.67.123
# Save it as $EC2_IP
export EC2_IP="YOUR_EC2_IP_HERE"
```

---

### PHASE 2: DEPLOY BACKEND TO EC2 (20 minutes)

**1. SSH into EC2:**
```bash
ssh -i ~/.ssh/transcend-law-key.pem ubuntu@$EC2_IP
```

**2. Update System & Install Dependencies:**
```bash
sudo apt update && sudo apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs nginx certbot python3-certbot-nginx
sudo npm install -g pm2
```

**3. Verify Installations:**
```bash
node --version  # Should be v20.x.x
npm --version   # Should be 10.x.x
pm2 --version   # Should be 5.x.x
nginx -v        # Should show nginx version
```

**4. Create App Directory:**
```bash
sudo mkdir -p /var/www/transcend-law
sudo chown ubuntu:ubuntu /var/www/transcend-law
cd /var/www/transcend-law
```

**5. Copy Backend Files (FROM YOUR LOCAL MACHINE):**
```bash
# On your local machine, run:
scp -i ~/.ssh/transcend-law-key.pem -r /path/to/transcend-law/backend/* \
  ubuntu@$EC2_IP:/var/www/transcend-law/

# Or use rsync (faster):
rsync -avz -e "ssh -i ~/.ssh/transcend-law-key.pem" \
  /path/to/transcend-law/backend/ \
  ubuntu@$EC2_IP:/var/www/transcend-law/
```

**6. Install Dependencies (ON EC2):**
```bash
cd /var/www/transcend-law
npm install --production
```

---

### PHASE 3: CONFIGURE ENVIRONMENT (5 minutes)

**1. Create .env File (ON EC2):**
```bash
sudo nano /var/www/transcend-law/.env
```

**2. Paste This Configuration:**
```
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://transcend:YOUR_DB_PASSWORD@YOUR_DB_HOST:5432/transcend_law_prod
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-super-secret-random-string-at-least-30-chars-long-here
JWT_EXPIRY=7d
VITE_API_URL=https://transcend-law.com/api/v1
FRONTEND_URL=https://transcend-law.com
ALLOWED_ORIGINS=https://transcend-law.com,https://www.transcend-law.com
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-aws-key-here
AWS_SECRET_ACCESS_KEY=your-aws-secret-here
S3_BUCKET_NAME=transcend-law-documents-prod
```

**3. Save File:**
```
Press: Ctrl+O, Enter, Ctrl+X
```

**4. Set Permissions:**
```bash
chmod 600 /var/www/transcend-law/.env
```

---

### PHASE 4: SETUP DATABASE (15 minutes)

**1. Create PostgreSQL Database (IF NOT ALREADY DONE):**
```bash
# If using RDS, skip this and use your RDS endpoint
# If self-hosted PostgreSQL on EC2:

sudo apt install -y postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Create database and user:
sudo -u postgres psql -c "
  CREATE DATABASE transcend_law_prod;
  CREATE USER transcend WITH PASSWORD 'YOUR_SECURE_PASSWORD_HERE';
  ALTER ROLE transcend WITH CREATEDB;
  GRANT ALL PRIVILEGES ON DATABASE transcend_law_prod TO transcend;
"
```

**2. Run Migrations (ON EC2):**
```bash
cd /var/www/transcend-law
DATABASE_URL="postgresql://transcend:YOUR_DB_PASSWORD@localhost:5432/transcend_law_prod" \
  npm run db:migrate
```

**3. Seed Provider Data (ON EC2):**
```bash
DATABASE_URL="postgresql://transcend:YOUR_DB_PASSWORD@localhost:5432/transcend_law_prod" \
  node dist/db/seed-providers.js
```

**4. Verify Database (ON EC2):**
```bash
psql -U transcend -h localhost -d transcend_law_prod -c "\dt"
# Should show tables: users, providers, cases, documents, etc.
```

---

### PHASE 5: START BACKEND WITH PM2 (5 minutes)

**1. Start Backend (ON EC2):**
```bash
cd /var/www/transcend-law
pm2 start dist/index.js --name "transcend-law-api"
pm2 startup
pm2 save
```

**2. Verify Backend Running:**
```bash
pm2 list
pm2 logs transcend-law-api
```

**3. Test Backend Locally:**
```bash
curl http://localhost:3000/health
# Should return 200 OK
```

---

### PHASE 6: SETUP NGINX & SSL (10 minutes)

**1. Create Nginx Config (ON EC2):**
```bash
sudo nano /etc/nginx/sites-available/transcend-law
```

**2. Paste This Configuration:**
```nginx
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
```

**3. Save File (Ctrl+O, Enter, Ctrl+X):**

**4. Enable Site & Verify Config (ON EC2):**
```bash
sudo ln -s /etc/nginx/sites-available/transcend-law /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default
sudo nginx -t
# Should show: nginx: configuration file test is successful
```

**5. Restart Nginx (ON EC2):**
```bash
sudo systemctl restart nginx
sudo systemctl enable nginx
```

**6. Install SSL Certificate (ON EC2):**
```bash
sudo certbot --nginx -d transcend-law.com -d www.transcend-law.com
# Follow prompts:
#   - Enter email: your-email@example.com
#   - Agree to terms: y
#   - Share email: n (optional)
#   - Redirect HTTP to HTTPS: y
```

**7. Verify SSL (ON EC2):**
```bash
sudo certbot certificates
# Should show your certificate
```

---

### PHASE 7: UPDATE DNS (5 minutes)

**1. Get Your EC2 Public IP:**
```bash
# In AWS Console or via:
curl http://169.254.169.254/latest/meta-data/public-ipv4
```

**2. Update Squarespace DNS:**
```
Go to: Squarespace → Settings → Domains → transcend-law.com → DNS Settings

Add/Update A records:
   Name: @
   Type: A
   Value: YOUR_EC2_PUBLIC_IP
   TTL: 3600

   Name: www
   Type: CNAME
   Value: transcend-law.com
   TTL: 3600
```

**3. Wait for DNS Propagation (5-30 minutes):**
```bash
# Check DNS status:
dig transcend-law.com
nslookup transcend-law.com

# Should eventually resolve to your EC2 IP
```

---

### PHASE 8: VERIFICATION & TESTING (10 minutes)

**1. Test Frontend (from your local machine):**
```bash
# Should load the app:
curl -I https://transcend-law.com/

# Should return 200 OK and show Vercel origin
```

**2. Test Backend Health (from your local machine):**
```bash
curl https://transcend-law.com/api/v1/health

# Should return 200 OK with health status
```

**3. Test API Connectivity:**
```bash
curl https://transcend-law.com/api/v1/status

# Should return API status
```

**4. Verify in Browser:**
```
Open: https://transcend-law.com
Should see:
   ✓ Login page loads
   ✓ HTTPS is active
   ✓ Certificate is valid
   ✓ All resources load
```

**5. Check Backend Logs:**
```bash
# SSH back into EC2:
ssh -i ~/.ssh/transcend-law-key.pem ubuntu@$EC2_IP

# View logs:
pm2 logs transcend-law-api

# Should show: "listening on port 3000"
```

---

## ✅ FINAL CHECKLIST

### Pre-Deployment
- [ ] AWS account ready with EC2 access
- [ ] PostgreSQL database ready (RDS or self-hosted)
- [ ] Squarespace domain access
- [ ] GitHub code pulled locally
- [ ] Backend built and ready
- [ ] Environment variables prepared

### Deployment
- [ ] Security group created with correct rules
- [ ] EC2 instance launched (t3.medium, Ubuntu 20.04)
- [ ] SSH key downloaded and permissions set (chmod 400)
- [ ] Dependencies installed on EC2
- [ ] Backend code copied to EC2
- [ ] .env file created with all variables
- [ ] Database created and migrations run
- [ ] Provider data seeded (20 providers)
- [ ] Backend started with PM2
- [ ] Nginx configured
- [ ] SSL certificate installed
- [ ] DNS records updated in Squarespace

### Post-Deployment
- [ ] Frontend loads at https://transcend-law.com
- [ ] HTTPS is active and certificate is valid
- [ ] Backend API responding
- [ ] Database connected and data visible
- [ ] Notary Job Board loads
- [ ] Contract Negotiation loads
- [ ] All 20 services visible
- [ ] Dark mode working
- [ ] Responsive on mobile
- [ ] PM2 process running
- [ ] Logs show no errors
- [ ] Monitoring activated

---

## 🎯 YOU ARE NOW LIVE!

When all verification steps pass:

**🎉 TRANSCEND LAW v2.0 is LIVE at https://transcend-law.com**

---

## 📞 TROUBLESHOOTING

### Backend Won't Start
```bash
# Check logs:
pm2 logs transcend-law-api

# Check port 3000 is not in use:
sudo lsof -i :3000

# Restart:
pm2 restart transcend-law-api
```

### Database Connection Error
```bash
# Test connection:
psql -U transcend -h $DB_HOST -d transcend_law_prod -c "SELECT 1"

# Check .env DATABASE_URL is correct:
grep DATABASE_URL /var/www/transcend-law/.env
```

### SSL Certificate Error
```bash
# Check certificate:
sudo certbot certificates

# Renew if needed:
sudo certbot renew --dry-run
```

### DNS Not Resolving
```bash
# Check DNS:
dig transcend-law.com
nslookup transcend-law.com

# Wait up to 30 minutes for propagation
# Or check Squarespace DNS settings are correct
```

### Nginx Won't Start
```bash
# Check config:
sudo nginx -t

# Check logs:
sudo tail -f /var/log/nginx/error.log

# Restart:
sudo systemctl restart nginx
```

---

## 📊 PRODUCTION MONITORING

### Daily Checks
```bash
# SSH to EC2
ssh -i ~/.ssh/transcend-law-key.pem ubuntu@$EC2_IP

# Check backend status:
pm2 list

# Check logs:
pm2 logs transcend-law-api --lines 50

# Check disk space:
df -h

# Check memory:
free -h
```

### Weekly Checks
```bash
# Check SSL certificate expiry:
sudo certbot certificates

# Check nginx logs for errors:
sudo tail -100 /var/log/nginx/error.log

# Check application logs:
pm2 logs transcend-law-api --lines 500
```

### Monthly Maintenance
```bash
# Backup database:
pg_dump transcend_law_prod > backup_$(date +%Y%m%d).sql

# Renew SSL (automatic but verify):
sudo certbot renew --dry-run

# Update system:
sudo apt update && sudo apt upgrade -y

# Check PM2 is still running:
pm2 list
```

---

## 🎉 DEPLOYMENT COMPLETE!

**When you see this message at the end of Phase 8:**

```
✓ Frontend loads at https://transcend-law.com
✓ Backend API responding
✓ Database connected
✓ All services working
✓ SSL active

🚀 TRANSCEND LAW v2.0 IS LIVE!
```

**CONGRATULATIONS! 🎉 You've successfully deployed TRANSCEND LAW to production!**

---

**Built with ❤️ for TRANSCEND LAW**  
**Deployment Date: August 13, 2026**  
**Status: PRODUCTION LIVE ✅**
