# Create AWS Account & Deploy TRANSCEND LAW - 10 Minutes

## Step 1: Create AWS Account (3 minutes)

1. Go to https://aws.amazon.com
2. Click **"Create an AWS Account"** (top right)

3. Fill in information:
   - Email: **cejsburlew@gmail.com**
   - Password: Create a strong password
   - AWS Account Name: **transcend-law**
   - Click **"Verify email address"**

4. Check your Gmail inbox for verification email
   - Click verification link
   - Confirm email address

5. Complete Account Information:
   - Full Name: Your name
   - Address: Your address
   - Phone: Your phone number
   - Country: United States
   - Accept terms ✓

6. Payment Method:
   - Enter credit/debit card details
   - (Will not charge - free tier)
   - Click **"Verify and Add"**

7. Confirm Identity:
   - Phone verification (SMS or call)
   - Enter code received
   - Click **"Verify"**

8. Select Support Plan:
   - Choose **"Basic Plan (Free)"**
   - Click **"Complete sign up"**

9. Success! Your AWS account is ready
   - Click **"Go to AWS Console"**

---

## Step 2: Launch EC2 Instance (3 minutes)

1. In AWS Console, search for **"EC2"**
2. Click **"EC2"** under Services

3. In left sidebar, click **"Instances"**
4. Click **"Launch Instances"** (orange button)

5. **Choose AMI:**
   - Search for **"Ubuntu 22.04"**
   - Select **"Ubuntu Server 22.04 LTS"** (Free tier eligible)
   - Click **"Select"**

6. **Choose Instance Type:**
   - Select **"t3.micro"** (Free tier)
   - OR **"t3.medium"** (recommended for better performance)
   - Click **"Next"**

7. **Configure Instance:**
   - Leave defaults
   - Click **"Next"** → **"Next"** → **"Next"**

8. **Add Storage:**
   - Size: **100 GB** (Free tier: 30GB, but 100GB is safer)
   - Click **"Next"**

9. **Security Group:**
   - Create new security group
   - Name: **transcend-law-sg**
   - Add these rules:
     ```
     Type: SSH
     Port: 22
     Source: My IP (or 0.0.0.0/0 for anywhere)
     
     Type: HTTP
     Port: 80
     Source: 0.0.0.0/0
     
     Type: HTTPS
     Port: 443
     Source: 0.0.0.0/0
     ```
   - Click **"Review and Launch"**

10. **Review:**
    - Check everything looks correct
    - Click **"Launch"**

11. **Key Pair:**
    - Select **"Create a new key pair"**
    - Name: **transcend-law-key**
    - Download: **transcend-law-key.pem**
    - Save to your Downloads folder
    - Click **"Launch Instances"**

12. Success! Your instance is launching
    - Click on Instance ID
    - Wait for "running" status (2-3 minutes)
    - Note your **Public IPv4 address**

---

## Step 3: Deploy TRANSCEND LAW (2 minutes)

### On Your Computer:

1. Open Terminal/Command Prompt

2. Navigate to where you downloaded the key:
   ```bash
   cd ~/Downloads
   ```

3. Fix key permissions:
   ```bash
   chmod 400 transcend-law-key.pem
   ```

4. SSH into EC2 instance:
   ```bash
   ssh -i transcend-law-key.pem ubuntu@YOUR_PUBLIC_IP
   ```
   (Replace YOUR_PUBLIC_IP with the IP from step 12)

5. Once connected, run ONE command:
   ```bash
   curl https://raw.githubusercontent.com/cejsburlew-crypto/transcend-law/main/aws-deploy.sh | bash
   ```

6. Wait 5-10 minutes for deployment to complete
   - Watch the progress
   - Should end with "DEPLOYMENT COMPLETE"

7. Your server is live! ✅

---

## Step 4: Configure Domain (Optional but Recommended)

### Get Elastic IP (so IP doesn't change):

1. In EC2 Console, left sidebar → **"Elastic IPs"**
2. Click **"Allocate Elastic IP address"**
3. Leave defaults, click **"Allocate"**
4. Select the IP → **"Associate Elastic IP address"**
5. Select your instance and network interface
6. Click **"Associate"**
7. Copy the Elastic IP address

### Point Domain to AWS:

If you own transcendlaw.com:

1. Go to your domain registrar (GoDaddy, Namecheap, etc.)
2. Find DNS settings
3. Create/Edit A records:
   ```
   Name: @
   Type: A
   Value: YOUR_ELASTIC_IP
   
   Name: api
   Type: A
   Value: YOUR_ELASTIC_IP
   
   Name: www
   Type: CNAME
   Value: transcendlaw.com
   ```
4. Save changes
5. Wait 5-30 minutes for DNS to propagate

### Install SSL Certificate:

```bash
# SSH back into instance
ssh -i transcend-law-key.pem ubuntu@YOUR_ELASTIC_IP

# Install certificate
sudo certbot certonly --nginx -d transcendlaw.com -d api.transcendlaw.com

# Restart Nginx
sudo systemctl restart nginx
```

---

## Step 5: Test Your Deployment

### Test Server is Running:

```bash
# From your computer, test the IP:
curl -I http://YOUR_PUBLIC_IP
# Should return something (might be error, that's OK)
```

### Test HTTPS (if domain configured):

```bash
curl -I https://transcendlaw.com
# Should return 403 Forbidden (requires login) ✅
```

### Test Admin Login:

```bash
curl -X POST http://YOUR_PUBLIC_IP:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "cejsburlew@gmail.com",
    "password": "$Colombia"
  }'

# Should return JWT token ✅
```

---

## Step 6: Verify Everything Works

SSH into your instance and check:

```bash
ssh -i transcend-law-key.pem ubuntu@YOUR_PUBLIC_IP

# Check application status
pm2 status

# View logs
pm2 logs transcend-law

# Check database
sudo systemctl status postgresql

# Check Nginx
sudo systemctl status nginx
```

All should show **active/running** ✅

---

## 🎉 You're Live!

Your TRANSCEND LAW deployment is now live at:

**HTTP:** http://YOUR_PUBLIC_IP:3000  
**HTTPS:** https://transcendlaw.com (if domain configured)

### Access:
- Email: cejsburlew@gmail.com
- Password: $Colombia
- Role: SUPER_ADMIN

### Systems Running:
- ✅ Payment & Commissions (10 endpoints)
- ✅ Professional Directory (8 endpoints)
- ✅ Verification & Compliance
- ✅ Dispute Resolution (10 endpoints)
- ✅ Admin Dashboard (10 endpoints)
- ✅ Notifications (5 endpoints)
- ✅ Leaderboards (8 endpoints)

---

## 💰 Costs

**First 12 months (AWS Free Tier):**
- t3.micro: FREE
- 30GB storage: FREE
- Data transfer: FREE (within limits)
- **Total: $0/month**

**After free tier (ongoing):**
- t3.medium: ~$30/month
- 100GB storage: ~$10/month
- Data transfer: ~$5-20/month
- **Total: ~$45-60/month**

---

## ❓ Troubleshooting

### Can't SSH into instance:
```bash
# Check key permissions
ls -la transcend-law-key.pem
# Should show: -rw------- (600)

# If not:
chmod 400 transcend-law-key.pem

# Try again:
ssh -i transcend-law-key.pem ubuntu@YOUR_PUBLIC_IP
```

### Deployment script failed:
```bash
# Check logs
cat ~/deploy.log

# Run manually:
cd /opt/transcend-law
npm start
```

### Port already in use:
```bash
# Kill process using port 3000
sudo lsof -i :3000
sudo kill -9 <PID>

# Restart
pm2 restart transcend-law
```

### Can't connect to database:
```bash
# Check PostgreSQL
sudo systemctl status postgresql
sudo systemctl start postgresql

# Check connection
psql -U postgres -d transcend_law
```

---

## ✅ Final Checklist

- [ ] AWS account created with cejsburlew@gmail.com
- [ ] EC2 instance launched (Ubuntu 22.04)
- [ ] Key pair downloaded and saved
- [ ] SSH connection working
- [ ] Deployment script executed successfully
- [ ] Application running (pm2 status shows "online")
- [ ] Database deployed
- [ ] Nginx running
- [ ] Admin login works (JWT token received)
- [ ] Public access blocked (returns 403 without token)
- [ ] Domain configured (if using domain)
- [ ] SSL certificate installed (if using domain)
- [ ] All 7 systems operational
- [ ] Monitoring/alerts configured

---

**TRANSCEND LAW is now live on AWS!** 🚀

Next: Monitor logs, watch for errors, and start processing referrals.
