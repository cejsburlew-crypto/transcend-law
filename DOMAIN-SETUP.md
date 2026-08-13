# TRANSCEND LAW - Domain Setup (transcendlaw.com)

## Domain Configuration

**Primary Domain:** `transcendlaw.com`  
**API Subdomain:** `api.transcendlaw.com`  
**Environment:** Production

---

## 🔧 DNS Configuration Required

Add these DNS records to your domain registrar:

```
Type    | Name              | Value
--------|-------------------|------------------------------------------
A       | @                 | Your server IP address
A       | api               | Your server IP address
A       | www               | Your server IP address
CNAME   | www               | transcendlaw.com
TXT     | @                 | v=spf1 include:_spf.google.com ~all
```

### Example (GoDaddy, Namecheap, etc.)
```
A Record:     transcendlaw.com     → YOUR_SERVER_IP
A Record:     api.transcendlaw.com → YOUR_SERVER_IP
CNAME Record: www.transcendlaw.com → transcendlaw.com
```

---

## 🔒 SSL/TLS Certificate Setup

### Option 1: Let's Encrypt (Recommended - Free)

Install Certbot:
```bash
sudo apt-get install certbot python3-certbot-nginx  # Ubuntu/Debian
# or
brew install certbot  # macOS
```

Generate certificates:
```bash
sudo certbot certonly --standalone -d transcendlaw.com -d api.transcendlaw.com -d www.transcendlaw.com
```

Certificates will be saved to:
```
/etc/letsencrypt/live/transcendlaw.com/
├── cert.pem
├── chain.pem
├── fullchain.pem
└── privkey.pem
```

### Option 2: Commercial Certificate

Purchase from:
- GoDaddy
- Namecheap
- DigiCert
- etc.

Place certificates in:
```
/etc/ssl/certs/transcendlaw.com.crt
/etc/ssl/private/transcendlaw.com.key
```

---

## 📝 Environment Configuration

Update `.env`:

```bash
# Domain Configuration
DOMAIN=transcendlaw.com
APP_URL=https://transcendlaw.com
API_URL=https://api.transcendlaw.com

# SSL Paths (if using custom locations)
SSL_CERT_PATH=/etc/letsencrypt/live/transcendlaw.com/fullchain.pem
SSL_KEY_PATH=/etc/letsencrypt/live/transcendlaw.com/privkey.pem

# Server
NODE_ENV=production
PORT=3000
```

---

## 🚀 Deployment Steps

### 1. Point Domain to Server
- Update DNS A records to your server IP
- Wait 24 hours for DNS propagation (or up to 48 hours)
- Verify: `nslookup transcendlaw.com`

### 2. Install SSL Certificate
```bash
sudo certbot certonly --standalone -d transcendlaw.com -d api.transcendlaw.com
```

### 3. Update Configuration
```bash
# Edit .env with SSL paths
SSL_CERT_PATH=/etc/letsencrypt/live/transcendlaw.com/fullchain.pem
SSL_KEY_PATH=/etc/letsencrypt/live/transcendlaw.com/privkey.pem
```

### 4. Start Production Server
```bash
chmod +x deploy-secure.sh
NODE_ENV=production node server-production.js
```

### 5. Verify HTTPS
```bash
curl -v https://transcendlaw.com/api/health
# Should return 401 (no token) - verifies SSL is working
```

---

## 📊 Production Server Features

### HTTPS with HSTS
- ✅ SSL/TLS encryption
- ✅ HSTS header (1 year preload)
- ✅ Automatic HTTP → HTTPS redirect
- ✅ Security headers for domain

### CORS Configuration
Allowed origins:
- `https://transcendlaw.com`
- `https://api.transcendlaw.com`
- `https://www.transcendlaw.com`

### Security
- ✅ Only `cejsburlew@gmail.com` can login
- ✅ Password: `$Colombia`
- ✅ All requests logged
- ✅ Rate limiting (100/15min)
- ✅ Security headers enabled
- ✅ Source code protected

---

## 🔄 Certificate Renewal

Let's Encrypt certificates expire after 90 days. Set up automatic renewal:

```bash
sudo certbot renew --dry-run  # Test renewal
sudo systemctl enable certbot.timer  # Auto-renew
sudo systemctl start certbot.timer
```

Or manually renew:
```bash
sudo certbot renew
sudo systemctl restart transcend-law  # Restart your service
```

---

## 🧪 Testing

### 1. SSL/TLS Check
```bash
curl -I https://transcendlaw.com
```

Expected:
```
HTTP/2 403
strict-transport-security: max-age=31536000; includeSubDomains; preload
```

### 2. Authentication Test
```bash
curl -X POST https://transcendlaw.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "cejsburlew@gmail.com",
    "password": "$Colombia"
  }'
```

Expected:
```json
{
  "success": true,
  "token": "eyJ...",
  "user": {"email": "cejsburlew@gmail.com", "role": "SUPER_ADMIN"}
}
```

### 3. Protected Endpoint Test (no token)
```bash
curl -I https://transcendlaw.com/api/health
```

Expected:
```
HTTP/2 401
```

---

## 🛡️ Production Checklist

- [ ] DNS A records point to server IP
- [ ] SSL certificate installed at correct path
- [ ] `.env` configured with domain and SSL paths
- [ ] Environment: `NODE_ENV=production`
- [ ] ALLOW_PUBLIC_REGISTRATION: `false`
- [ ] ALLOW_USER_LOGIN: `false`
- [ ] MAINTENANCE_MODE: Check if should be enabled/disabled
- [ ] Test HTTPS connection works
- [ ] Test login with correct credentials
- [ ] Test that wrong credentials are blocked
- [ ] Verify security headers present
- [ ] Check rate limiting works
- [ ] Monitor audit logs for unauthorized attempts
- [ ] Set up certificate auto-renewal

---

## 📋 Running Commands

### Start Production Server
```bash
NODE_ENV=production node server-production.js
```

### With Process Manager (Recommended)
```bash
# Using PM2
npm install -g pm2
pm2 start server-production.js --name "transcend-law" \
  --env NODE_ENV=production
pm2 save
pm2 startup

# Check logs
pm2 logs transcend-law
```

### With Systemd Service (Advanced)
Create `/etc/systemd/system/transcend-law.service`:
```ini
[Unit]
Description=TRANSCEND LAW
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/home/app/transcend-law
ExecStart=/usr/bin/node server-production.js
Restart=on-failure
RestartSec=10
Environment="NODE_ENV=production"

[Install]
WantedBy=multi-user.target
```

Enable:
```bash
sudo systemctl enable transcend-law
sudo systemctl start transcend-law
sudo systemctl status transcend-law
```

---

## 🔐 Security Notes

1. **Only one user:** `cejsburlew@gmail.com` / `$Colombia`
2. **All requests logged:** Check logs for unauthorized attempts
3. **Rate limited:** 100 requests per 15 minutes per IP
4. **HTTPS required:** HTTP redirects to HTTPS
5. **HSTS enabled:** Browser enforces HTTPS for 1 year
6. **CSP configured:** Restricts resources to your domain
7. **Source protected:** No access to `.env`, `.git`, config files

---

## 📞 Troubleshooting

### SSL Certificate Not Found
```
Error: SSL certificates not found at /etc/letsencrypt/live/transcendlaw.com/
Solution: Run `sudo certbot certonly -d transcendlaw.com -d api.transcendlaw.com`
```

### DNS Not Resolving
```
Error: Name or service not known
Solution: 
  1. Check DNS records propagated: nslookup transcendlaw.com
  2. Wait 24-48 hours for full propagation
  3. Flush DNS cache: sudo systemctl restart systemd-resolved
```

### Connection Refused
```
Error: Connection refused
Solution:
  1. Check server is running: ps aux | grep node
  2. Check port 443 is open: sudo lsof -i :443
  3. Check firewall: sudo ufw status
```

### Certificate Expired
```
Error: ERR_CERT_DATE_INVALID
Solution: Renew certificate
  sudo certbot renew --force-renewal
  systemctl restart transcend-law
```

---

**TRANSCEND LAW is now production-ready at transcendlaw.com** 🚀
