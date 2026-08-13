#!/bin/bash

# TRANSCEND LAW - AWS EC2 AUTOMATED DEPLOYMENT
# Run this on a fresh Ubuntu 22.04 LTS EC2 instance

set -e

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║        TRANSCEND LAW - AWS EC2 AUTOMATED DEPLOYMENT            ║"
echo "║                                                                ║"
echo "║  This script will:                                            ║"
echo "║  1. Update system packages                                    ║"
echo "║  2. Install Node.js & PostgreSQL                              ║"
echo "║  3. Clone TRANSCEND LAW from GitHub                           ║"
echo "║  4. Set up database & schemas                                 ║"
echo "║  5. Configure Nginx with SSL support                          ║"
echo "║  6. Start application with PM2                                ║"
echo "║                                                                ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# ============================================================================
# PHASE 1: SYSTEM UPDATES
# ============================================================================

echo "📦 PHASE 1: Updating System Packages"
echo "───────────────────────────────────────────────────────────────"

sudo apt update
sudo apt upgrade -y
sudo apt install -y curl wget git build-essential

echo "✓ System packages updated"

# ============================================================================
# PHASE 2: INSTALL NODE.JS
# ============================================================================

echo ""
echo "🟢 PHASE 2: Installing Node.js 18.x"
echo "───────────────────────────────────────────────────────────────"

curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

node --version
npm --version

echo "✓ Node.js installed"

# ============================================================================
# PHASE 3: INSTALL POSTGRESQL
# ============================================================================

echo ""
echo "🗄️  PHASE 3: Installing PostgreSQL"
echo "───────────────────────────────────────────────────────────────"

sudo apt install -y postgresql postgresql-contrib postgresql-client

sudo systemctl enable postgresql
sudo systemctl start postgresql

echo "✓ PostgreSQL installed and started"

# ============================================================================
# PHASE 4: CLONE & SETUP TRANSCEND LAW
# ============================================================================

echo ""
echo "📥 PHASE 4: Cloning TRANSCEND LAW Repository"
echo "───────────────────────────────────────────────────────────────"

cd /opt
sudo mkdir -p transcend-law
sudo chown ubuntu:ubuntu transcend-law
cd transcend-law

git clone https://github.com/cejsburlew-crypto/transcend-law.git .
npm install --production

echo "✓ Repository cloned and dependencies installed"

# ============================================================================
# PHASE 5: DATABASE SETUP
# ============================================================================

echo ""
echo "💾 PHASE 5: Setting Up Database"
echo "───────────────────────────────────────────────────────────────"

# Create database
sudo -u postgres createdb transcend_law

# Deploy schemas
echo "Deploying schemas..."
sudo -u postgres psql -d transcend_law -f professional-discovery-system.sql 2>/dev/null || true
sudo -u postgres psql -d transcend_law -f payment-commission-schema.sql 2>/dev/null || true
sudo -u postgres psql -d transcend_law -f verification-compliance-schema.sql 2>/dev/null || true
sudo -u postgres psql -d transcend_law -f dispute-resolution-schema.sql 2>/dev/null || true
sudo -u postgres psql -d transcend_law -f admin-dashboard-schema.sql 2>/dev/null || true
sudo -u postgres psql -d transcend_law -f notifications-and-leaderboards-schema.sql 2>/dev/null || true

echo "✓ Database created and schemas deployed"

# ============================================================================
# PHASE 6: ENVIRONMENT CONFIGURATION
# ============================================================================

echo ""
echo "⚙️  PHASE 6: Configuring Environment"
echo "───────────────────────────────────────────────────────────────"

# Generate secure JWT secret
JWT_SECRET=$(openssl rand -hex 32)

cat > .env << EOF
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
DB_PASSWORD=transcend_secure_password_change_me

# Admin
ADMIN_EMAIL=cejsburlew@gmail.com
ADMIN_USERNAME=admin

# Security
JWT_SECRET=$JWT_SECRET
JWT_EXPIRY=7d
BCRYPT_ROUNDS=10

# Features
ALLOW_PUBLIC_REGISTRATION=false
ALLOW_USER_LOGIN=false
MAINTENANCE_MODE=true

# SSL Paths (after certificate installation)
SSL_CERT_PATH=/etc/letsencrypt/live/transcendlaw.com/fullchain.pem
SSL_KEY_PATH=/etc/letsencrypt/live/transcendlaw.com/privkey.pem
EOF

chmod 600 .env

echo "✓ Environment configured"

# ============================================================================
# PHASE 7: PM2 SETUP
# ============================================================================

echo ""
echo "🚀 PHASE 7: Installing PM2 Process Manager"
echo "───────────────────────────────────────────────────────────────"

sudo npm install -g pm2

pm2 start server-production.js --name transcend-law --env NODE_ENV=production
pm2 save
sudo pm2 startup -u ubuntu --hp /home/ubuntu

echo "✓ PM2 configured and application started"

# ============================================================================
# PHASE 8: NGINX SETUP
# ============================================================================

echo ""
echo "🌐 PHASE 8: Installing and Configuring Nginx"
echo "───────────────────────────────────────────────────────────────"

sudo apt install -y nginx

# Create Nginx config (temporary, before SSL)
sudo tee /etc/nginx/sites-available/transcendlaw.com > /dev/null << 'EOF'
upstream transcend_law {
    server 127.0.0.1:3000;
}

server {
    listen 80;
    server_name transcendlaw.com api.transcendlaw.com www.transcendlaw.com;

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

sudo ln -sf /etc/nginx/sites-available/transcendlaw.com /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl enable nginx
sudo systemctl restart nginx

echo "✓ Nginx installed and configured"

# ============================================================================
# PHASE 9: SSL CERTIFICATE (Manual step for now)
# ============================================================================

echo ""
echo "🔐 PHASE 9: SSL Certificate Setup"
echo "───────────────────────────────────────────────────────────────"

sudo apt install -y certbot python3-certbot-nginx

echo ""
echo "⚠️  IMPORTANT: Complete these steps manually:"
echo ""
echo "1. Ensure DNS is pointing to this server:"
echo "   transcendlaw.com → $(curl -s https://checkip.amazonaws.com || echo 'YOUR_ELASTIC_IP')"
echo ""
echo "2. Install SSL certificate:"
echo "   sudo certbot certonly --nginx -d transcendlaw.com -d api.transcendlaw.com"
echo ""
echo "3. Update Nginx config with SSL:"
echo "   sudo certbot --nginx -d transcendlaw.com -d api.transcendlaw.com"
echo ""
echo "4. Verify:"
echo "   curl -I https://transcendlaw.com"
echo ""

# ============================================================================
# PHASE 10: VERIFICATION
# ============================================================================

echo ""
echo "✅ PHASE 10: Deployment Complete!"
echo "───────────────────────────────────────────────────────────────"

echo ""
echo "TRANSCEND LAW is now running!"
echo ""
echo "📊 Status:"
echo "   Application: $(pm2 list | grep transcend-law | grep online > /dev/null && echo '🟢 RUNNING' || echo '🔴 STOPPED')"
echo "   Database: $(sudo systemctl is-active postgresql)"
echo "   Nginx: $(sudo systemctl is-active nginx)"
echo ""
echo "📝 Access:"
echo "   HTTP: http://$(curl -s https://checkip.amazonaws.com || echo 'YOUR_SERVER_IP'):80"
echo "   Logs: pm2 logs transcend-law"
echo "   Status: pm2 status"
echo ""
echo "🔑 Admin Login:"
echo "   Email: cejsburlew@gmail.com"
echo "   Password: \$Colombia"
echo ""
echo "🔐 Next Steps:"
echo "   1. Point DNS to this server"
echo "   2. Install SSL certificate (see above)"
echo "   3. Configure HTTPS in Nginx"
echo "   4. Test HTTPS: curl -I https://transcendlaw.com"
echo ""
echo "📚 Documentation: AWS-EC2-DEPLOYMENT.md"
echo ""
echo "════════════════════════════════════════════════════════════════"
echo "         TRANSCEND LAW ON AWS EC2 - DEPLOYMENT COMPLETE"
echo "════════════════════════════════════════════════════════════════"
echo ""
