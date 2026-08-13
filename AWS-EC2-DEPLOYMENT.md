# TRANSCEND LAW - AWS EC2 DEPLOYMENT GUIDE

## Quick Setup (5 Steps)

### Step 1: Launch EC2 Instance

In AWS Console:
1. Go to EC2 > Instances > Launch Instance
2. Choose: **Ubuntu 22.04 LTS** (t3.medium recommended)
3. Create/select key pair: `transcend-law-key.pem`
4. Security Group: Allow ports 22, 80, 443
5. Storage: 100GB (gp3)
6. Launch

### Step 2: Connect to Instance

```bash
chmod 400 transcend-law-key.pem
ssh -i transcend-law-key.pem ubuntu@YOUR_EC2_PUBLIC_IP
```

### Step 3: Run Deployment Script

Copy this and run on EC2:

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Clone repository
cd /home/ubuntu
git clone https://github.com/cejsburlew-crypto/transcend-law.git
cd transcend-law

# Install dependencies
npm install --production

# Set up .env for production
cat > .env << 'EOF'
NODE_ENV=production
PORT=3000
DOMAIN=transcendlaw.com
APP_URL=https://transcendlaw.com
API_URL=https://api.transcendlaw.com

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=transcend_law
DB_USER=postgres
DB_PASSWORD=your_secure_password_here

# Admin
ADMIN_EMAIL=cejsburlew@gmail.com
ADMIN_USERNAME=admin

# Security
JWT_SECRET=your_jwt_secret_generate_with_openssl_rand_hex
JWT_EXPIRY=7d

# Features
ALLOW_PUBLIC_REGISTRATION=false
ALLOW_USER_LOGIN=false
MAINTENANCE_MODE=true
EOF

# Set up database
sudo -u postgres createdb transcend_law
sudo -u postgres psql -d transcend_law -f professional-discovery-system.sql
sudo -u postgres psql -d transcend_law -f payment-commission-schema.sql
sudo -u postgres psql -d transcend_law -f verification-compliance-schema.sql
sudo -u postgres psql -d transcend_law -f dispute-resolution-schema.sql
sudo -u postgres psql -d transcend_law -f admin-dashboard-schema.sql
sudo -u postgres psql -d transcend_law -f notifications-and-leaderboards-schema.sql

# Install PM2
sudo npm install -g pm2

# Start application
pm2 start server-production.js --name transcend-law --env NODE_ENV=production
pm2 save
pm2 startup

# Install Nginx
sudo apt install -y nginx

# Install Certbot for SSL
sudo apt install -y certbot python3-certbot-nginx
```

### Step 4: Configure Domain & SSL

1. **Point DNS to EC2:**
   - Get EC2 Elastic IP
   - Add A record: `transcendlaw.com` → Your Elastic IP
   - Add A record: `api.transcendlaw.com` → Your Elastic IP
   - Wait 5-30 minutes for DNS propagation

2. **Install SSL Certificate:**
```bash
sudo certbot certonly --standalone \
  -d transcendlaw.com \
  -d api.transcendlaw.com \
  -d www.transcendlaw.com
```

3. **Configure Nginx:**
```bash
sudo tee /etc/nginx/sites-available/transcendlaw.com > /dev/null << 'EOF'
upstream transcend_law {
    server 127.0.0.1:3000;
}

server {
    listen 80;
    server_name transcendlaw.com api.transcendlaw.com www.transcendlaw.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name transcendlaw.com api.transcendlaw.com www.transcendlaw.com;

    ssl_certificate /etc/letsencrypt/live/transcendlaw.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/transcendlaw.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload";
    add_header X-Frame-Options "DENY";
    add_header X-Content-Type-Options "nosniff";
    add_header X-XSS-Protection "1; mode=block";

    location / {
        proxy_pass http://transcend_law;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

sudo ln -s /etc/nginx/sites-available/transcendlaw.com /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### Step 5: Verify & Monitor

```bash
# Check if application is running
pm2 status

# View logs
pm2 logs transcend-law

# Test HTTPS
curl -I https://transcendlaw.com

# Test login
curl -X POST https://transcendlaw.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"cejsburlew@gmail.com","password":"$Colombia"}'
```

---

## AWS Architecture

```
┌─────────────────────────────────────────┐
│          Route 53 (DNS)                 │
│    transcendlaw.com pointing to         │
│        Elastic IP                       │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│    AWS Security Group                   │
│  - Port 22 (SSH) - Your IP only         │
│  - Port 80 (HTTP) - 0.0.0.0/0           │
│  - Port 443 (HTTPS) - 0.0.0.0/0         │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│   EC2 Instance (t3.medium)              │
│   - Ubuntu 22.04 LTS                    │
│   - Elastic IP (static)                 │
│                                         │
│  ┌─────────────────────────────────┐  │
│  │  Nginx (Port 80/443)            │  │
│  │  - SSL/TLS termination          │  │
│  │  - Reverse proxy                │  │
│  │  - HSTS headers                 │  │
│  └────────────┬────────────────────┘  │
│               │                        │
│  ┌────────────▼────────────────────┐  │
│  │  Node.js App (Port 3000)        │  │
│  │  - TRANSCEND LAW                │  │
│  │  - 7 systems operational        │  │
│  │  - Admin-only access            │  │
│  │  - PM2 managed                  │  │
│  └────────────┬────────────────────┘  │
│               │                        │
│  ┌────────────▼────────────────────┐  │
│  │  PostgreSQL Database            │  │
│  │  - 2.6M+ professionals          │  │
│  │  - All schemas deployed         │  │
│  └─────────────────────────────────┘  │
│                                         │
└─────────────────────────────────────────┘
```

---

## Instance Specifications

**Recommended:**
- Instance Type: `t3.medium` (2 vCPU, 4GB RAM)
- Storage: 100GB gp3
- Region: us-east-1 (or your preferred)
- OS: Ubuntu 22.04 LTS

**Costs (Estimated):**
- t3.medium: ~$30/month
- 100GB storage: ~$10/month
- Data transfer: ~$5-20/month
- **Total: ~$45-60/month**

---

## Post-Deployment

### 1. Set Up Auto-Renewal for SSL
```bash
sudo systemctl enable certbot.timer
sudo systemctl start certbot.timer
```

### 2. Monitor Application
```bash
# Real-time logs
pm2 logs transcend-law

# Show dashboard
pm2 plus  # (requires account)

# Restart if needed
pm2 restart transcend-law
```

### 3. Backup Database
```bash
# Daily backup
0 2 * * * pg_dump transcend_law | gzip > /backups/transcend_law_$(date +\%Y\%m\%d).sql.gz
```

### 4. Monitor Disk Space
```bash
df -h
du -sh /home/ubuntu/transcend-law
```

---

## Troubleshooting

### SSL Certificate Issues
```bash
# Check certificate status
sudo certbot certificates

# Renew manually
sudo certbot renew --force-renewal
```

### Application Not Running
```bash
# Check PM2 status
pm2 status

# View errors
pm2 logs transcend-law --err

# Restart
pm2 restart transcend-law
```

### Database Connection Failed
```bash
# Check PostgreSQL
sudo systemctl status postgresql

# Test connection
psql -U postgres -d transcend_law -h localhost
```

### High CPU/Memory
```bash
# Check process usage
pm2 monit

# Restart and check logs
pm2 restart transcend-law
pm2 logs transcend-law
```

---

## Security Best Practices

1. **SSH Key Only** (no password login)
   ```bash
   sudo sed -i 's/#PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config
   sudo systemctl restart ssh
   ```

2. **Firewall (UFW)**
   ```bash
   sudo ufw enable
   sudo ufw allow 22/tcp
   sudo ufw allow 80/tcp
   sudo ufw allow 443/tcp
   ```

3. **Fail2Ban** (DDoS protection)
   ```bash
   sudo apt install -y fail2ban
   sudo systemctl enable fail2ban
   ```

4. **Regular Updates**
   ```bash
   sudo apt update && sudo apt upgrade -y
   sudo apt autoremove -y
   ```

---

## Going to Production

Before announcing publicly:
- [ ] Test HTTPS connection works
- [ ] Verify admin login works
- [ ] Test that public access is blocked
- [ ] Check performance under load
- [ ] Set up monitoring/alerts
- [ ] Configure backups
- [ ] Document disaster recovery
- [ ] Enable WAF (AWS WAF optional)

---

## Support

**SSH into server:**
```bash
ssh -i transcend-law-key.pem ubuntu@YOUR_ELASTIC_IP
```

**View logs:**
```bash
pm2 logs transcend-law
```

**Check status:**
```bash
pm2 status
```

**TRANSCEND LAW is now deployed on AWS EC2 at https://transcendlaw.com**
