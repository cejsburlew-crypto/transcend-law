# 🗄️ Database & Authentication Setup Guide

**Status:** PostgreSQL + JWT implementation ready for deployment

---

## 📋 What's Included

### Database Layer
- PostgreSQL schema with 12 tables
- Proper indexing for performance
- JSONB for translations
- Audit logging
- Views for common queries
- Automatic timestamp management

### Authentication System
- JWT access tokens (15 min expiry)
- Refresh tokens (7 day expiry)
- Bcrypt password hashing
- Token refresh mechanism
- Logout/revocation support

### API Endpoints
- `POST /api/v2/auth/signup` - Register new user
- `POST /api/v2/auth/login` - Login user
- `POST /api/v2/auth/refresh` - Get new access token
- `POST /api/v2/auth/logout` - Revoke refresh token
- `GET /api/v2/auth/me` - Get current user info

---

## 🚀 Quick Start (Local Development)

### Step 1: Install PostgreSQL

**macOS (using Homebrew):**
```bash
brew install postgresql@15
brew services start postgresql@15
```

**Ubuntu/Debian:**
```bash
sudo apt-get update
sudo apt-get install postgresql postgresql-contrib
sudo service postgresql start
```

**Windows:**
- Download from https://www.postgresql.org/download/windows/
- Run installer, accept defaults
- PostgreSQL service starts automatically

### Step 2: Create Database & User

```bash
# Connect to PostgreSQL
psql postgres

# Create admin user
CREATE USER transcend_admin WITH PASSWORD 'your-secure-password';

# Create database
CREATE DATABASE transcend_law OWNER transcend_admin;

# Grant permissions
ALTER USER transcend_admin CREATEDB;
GRANT ALL PRIVILEGES ON DATABASE transcend_law TO transcend_admin;

# Exit
\q
```

### Step 3: Setup Environment Variables

```bash
# Copy example to actual .env
cp .env.example .env

# Edit .env with your values
nano .env
```

**Critical values to change:**
```env
DB_PASSWORD=your-secure-password
JWT_SECRET=generate-random-string-32+ chars
JWT_REFRESH_SECRET=generate-random-string-32+ chars
```

Generate secure secrets:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Step 4: Install Dependencies

```bash
cd transcend-api
npm install pg bcrypt jsonwebtoken cors helmet express dotenv
```

### Step 5: Start API Server

```bash
npm run dev
# or
npm start
```

**Expected output:**
```
✅ Server running on http://localhost:3001
📊 Health check: GET http://localhost:3001/health
🔐 Authentication: POST http://localhost:3001/api/v2/auth/signup
```

---

## 🧪 Testing Authentication

### 1. Check Database Connection

```bash
curl http://localhost:3001/health
# Returns: {"status":"ok","timestamp":"...","database":"connected"}
```

### 2. Sign Up New User

```bash
curl -X POST http://localhost:3001/api/v2/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "client@example.com",
    "password": "SecurePassword123!",
    "userType": "client",
    "firstName": "John",
    "lastName": "Doe"
  }'
```

**Response:**
```json
{
  "success": true,
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "accessToken": "eyJhbGc...",
  "refreshToken": "a1b2c3d4e5f6..."
}
```

### 3. Login Existing User

```bash
curl -X POST http://localhost:3001/api/v2/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "client@example.com",
    "password": "SecurePassword123!"
  }'
```

### 4. Use Access Token

```bash
curl http://localhost:3001/api/v2/auth/me \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### 5. Refresh Token

```bash
curl -X POST http://localhost:3001/api/v2/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "550e8400-e29b-41d4-a716-446655440000",
    "refreshToken": "a1b2c3d4e5f6..."
  }'
```

---

## 📊 Database Schema Overview

### Users Table
```sql
id (UUID)
email (unique)
password_hash
user_type (client|attorney|firm)
first_name, last_name
phone, profile_picture_url
preferred_language (default: en)
created_at, updated_at, deleted_at
```

### Attorneys Table
```sql
id (UUID)
user_id (foreign key to users)
bar_number, bar_state
license_verified, license_verified_at
years_experience
specialties (array)
rating, total_cases, success_rate
hourly_rate
```

### Cases Table
```sql
id (UUID)
client_id (foreign key to users)
service_type
title, description
original_language (for translation)
translated_content (JSONB)
budget_min, budget_max
urgency (low|medium|high|urgent)
status (open|matched|accepted|completed|closed)
```

### Case Offers Table
```sql
id (UUID)
case_id, attorney_id (foreign keys)
status (pending|quoted|rejected|accepted|retained)
quote_amount
quote_message
timeline
response_time (minutes)
```

### Messages Table
```sql
id (UUID)
conversation_id
sender_id
content
sender_language
translated_content (JSONB for all languages)
attachments
read_at
created_at
```

### Refresh Tokens Table
```sql
id (UUID)
user_id
token_hash (SHA256)
expires_at
revoked_at
created_at
```

---

## 🔒 Security Features

### Password Security
- Bcrypt with 10 salt rounds
- Never stored in plain text
- Compared securely before login

### Token Security
- JWT access tokens: 15 minute expiry
- Refresh tokens: 7 day expiry
- Refresh token hash stored (not full token)
- Tokens can be revoked immediately

### Database Security
- All credentials in environment variables
- Connection pooling (max 20)
- Prepared statements prevent SQL injection
- Deleted_at (soft deletes) preserve audit trail

### API Security
- CORS validation
- Helmet headers (security headers)
- Authorization middleware
- User type restrictions

---

## 📈 Performance Optimization

### Indexing Strategy
```sql
-- Frequently queried columns indexed
idx_users_email
idx_users_user_type
idx_cases_client_id
idx_cases_status
idx_messages_conversation_id
idx_refresh_tokens_expires_at
```

### Query Optimization
- Connection pooling: 20 concurrent connections
- Idle timeout: 30 seconds
- Connection timeout: 2 seconds
- Slow query logging (>1s)

### Caching (Future)
- User session cache in Redis
- Token validation cache
- Query result cache for read-heavy operations

---

## 🚢 Production Deployment

### Step 1: Use Production Database

**AWS RDS:**
```bash
# Create RDS instance
aws rds create-db-instance \
  --db-instance-identifier transcend-law-prod \
  --db-instance-class db.t3.small \
  --engine postgres \
  --allocated-storage 100 \
  --storage-type gp2
```

**Environment variables:**
```env
DB_HOST=transcend-law-prod.cxxxxxxxxx.us-east-1.rds.amazonaws.com
DB_PORT=5432
DB_USER=transcend_admin
DB_PASSWORD=your-very-secure-password
DB_NAME=transcend_law
```

### Step 2: Generate Strong Secrets

```bash
# Don't use the same secrets locally!
JWT_SECRET=$(openssl rand -base64 32)
JWT_REFRESH_SECRET=$(openssl rand -base64 32)
echo "JWT_SECRET=$JWT_SECRET"
echo "JWT_REFRESH_SECRET=$JWT_REFRESH_SECRET"
```

### Step 3: Enable SSL/TLS

```env
# Add to database connection
DB_SSL=true
DB_SSL_MODE=require
```

### Step 4: Setup Backups

```bash
# Daily automated backups
aws rds modify-db-instance \
  --db-instance-identifier transcend-law-prod \
  --backup-retention-period 30 \
  --preferred-backup-window "03:00-04:00"
```

### Step 5: Monitor & Log

```env
# Application logging
LOG_LEVEL=info
LOG_FILE=/var/log/transcend-api/api.log

# Database monitoring
DB_LOG_STATEMENT=all
DB_LOG_DURATION_STATEMENT=1000
```

---

## ⚙️ Configuration Reference

### Database Connection Pool
```typescript
const pool = new Pool({
  max: 20,                      // Max connections
  idleTimeoutMillis: 30000,     // 30 seconds
  connectionTimeoutMillis: 2000, // 2 seconds
});
```

### JWT Configuration
```typescript
const JWT_EXPIRY = '15m';        // Access token
const REFRESH_EXPIRY = '7d';     // Refresh token
const BCRYPT_ROUNDS = 10;        // Password hashing
```

### Rate Limiting (Add for production)
```bash
npm install express-rate-limit
```

```typescript
import rateLimit from 'express-rate-limit';

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,                    // 5 attempts
  message: 'Too many login attempts, please try again later.'
});

app.use('/api/v2/auth/login', authLimiter);
```

---

## 🐛 Troubleshooting

### "Connection refused" error
```bash
# Check PostgreSQL is running
brew services list | grep postgres
# or
sudo service postgresql status
```

### "Invalid user or password"
```bash
# Reconnect to database
psql -U transcend_admin -h localhost -d transcend_law
```

### "Database doesn't exist"
```bash
# List databases
psql -l
# Create if missing
createdb -U transcend_admin transcend_law
```

### "Table doesn't exist"
```bash
# Schema wasn't initialized
# Delete database and restart API
dropdb -U transcend_admin transcend_law
npm start  # API will auto-initialize schema
```

---

## 📋 Deployment Checklist

- [ ] PostgreSQL installed and running
- [ ] Database created with proper permissions
- [ ] `.env` file configured with production values
- [ ] JWT secrets generated (32+ chars)
- [ ] All npm dependencies installed
- [ ] API server starts without errors
- [ ] Health check endpoint working
- [ ] Auth endpoints tested (signup/login)
- [ ] Database backups configured
- [ ] SSL/TLS enabled for connections
- [ ] Rate limiting configured
- [ ] Monitoring and logging setup
- [ ] Error handling tested
- [ ] Passwords stored as bcrypt hashes

---

## 🎯 What's Next

**Week 1 Complete:**
- ✅ PostgreSQL database schema
- ✅ JWT authentication
- ✅ User management (signup/login)
- ✅ Database connection pooling

**Week 2: Critical Integrations**
- Stripe payment processing
- SendGrid email notifications
- AWS S3 file upload

**Week 3: Real-Time Features**
- Socket.io messaging
- Redis caching
- Bidirectional translation

---

**Status:** Database + Authentication fully implemented and ready for testing
