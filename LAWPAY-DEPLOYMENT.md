# 💳 LawPay Payment Integration - Complete Deployment Guide

## 🎯 What's Integrated

TRANSCEND LAW now has **fully integrated LawPay payment processing** for both inbound and outbound payments:

### ✅ Inbound Payments (Clients → Platform)
- Clients pay for case referrals
- LawPay payment links
- Multiple payment methods supported
- Real-time verification
- 15% platform commission
- Webhook-based status updates

### ✅ Outbound Payments (Platform → Professionals)
- Direct bank transfer disbursements
- Real-time processing via LawPay
- Secure payment routing
- Compliance tracking
- Payment status monitoring
- Webhook notifications

---

## 📋 Backend Setup

### 1. Environment Variables
Add to `.env` file:

```bash
LAWPAY_API_KEY=your_lawpay_api_key_here
LAWPAY_MERCHANT_ID=your_merchant_id_here
LAWPAY_WEBHOOK_SECRET=your_webhook_secret_here
```

### 2. Backend Files Created
- `services/lawpay-service.js` - LawPay API integration
- `api-lawpay-payments.js` - Payment API routes

### 3. Database Tables (Already Exist)
- `transactions` - Payment records
- `payment_schedules` - Scheduled disbursements
- `professionals` - Professional bank details

### 4. API Endpoints

#### Create Payment Link (Inbound)
```bash
POST /api/payments/create-payment-link
Headers: Authorization: Bearer {JWT_TOKEN}
Body: {
  "caseId": "CASE-001",
  "amount": 500,
  "clientName": "John Smith",
  "clientEmail": "john@example.com",
  "description": "Case referral payment"
}
Response: {
  "paymentLink": "https://payment.lawpay.com/...",
  "paymentId": "pay_123456",
  "amount": 500,
  "commission": 75,
  "status": "pending"
}
```

#### Create Disbursement (Outbound)
```bash
POST /api/payments/disbursement
Headers: Authorization: Bearer {JWT_TOKEN}
Body: {
  "professionalId": "PROF-12345",
  "amount": 425,
  "caseId": "CASE-001",
  "description": "Payment for completed work"
}
Response: {
  "disbursementId": "disb_123456",
  "professional": "Jane Lawyer",
  "amount": 425,
  "status": "pending"
}
```

#### Check Payment Status
```bash
GET /api/payments/{paymentId}/status
Response: {
  "paymentId": "pay_123456",
  "status": "completed",
  "amount": 500,
  "timestamp": "2026-08-14T00:00:00Z"
}
```

#### Check Disbursement Status
```bash
GET /api/payments/disbursement/{disbursementId}/status
Response: {
  "disbursementId": "disb_123456",
  "status": "completed",
  "amount": 425,
  "timestamp": "2026-08-14T00:00:00Z"
}
```

#### Webhook Handler
```bash
POST /api/webhooks/lawpay
Headers: X-LawPay-Signature: {signature}
Events Handled:
- payment.completed
- payment.failed
- disbursement.completed
- disbursement.failed
```

---

## 🎨 Frontend Setup

### 1. React Components Created
- `src/pages/Payments.tsx` - Payment management interface
- `src/pages/Payments.css` - Styling

### 2. Frontend Features
- **Inbound Payments Tab**
  - Create payment links for clients
  - Specify case ID, amount, client details
  - Auto-calculate commission (15%)
  - Copy payment link to clipboard
  - Real-time status tracking

- **Outbound Payments Tab**
  - Create disbursements to professionals
  - Specify professional, amount, case
  - Real-time bank transfer processing
  - Payment history and status

- **Integrated in Dashboard**
  - New "💰 Payments" navigation tab
  - Full payment management interface
  - LawPay security information

### 3. Build Command
```bash
cd transcend-frontend
npm run build
```

Built files are in `dist/` directory.

---

## 🚀 Deploy Frontend to Vercel

### Option 1: CLI Deployment (Recommended)
```bash
cd transcend-frontend
npm install -g vercel
vercel --prod
```

### Option 2: Git Push Deployment
1. Connect GitHub repo to Vercel dashboard
2. Set environment variables in Vercel settings
3. Vercel auto-deploys on push

### Option 3: Vercel Dashboard
1. Go to https://vercel.com/dashboard
2. New Project → Import GitHub repository
3. Select `transcend-law` repo
4. Set root directory to `transcend-frontend`
5. Deploy

---

## 🔧 Production Configuration

### Backend Server
Update `.env` on production server:

```bash
# Existing
NODE_ENV=production
PORT=3000
DOMAIN=transcend-law.com

# Add
LAWPAY_API_KEY=sk_live_xxxxx
LAWPAY_MERCHANT_ID=acct_xxxxx
LAWPAY_WEBHOOK_SECRET=whsec_xxxxx

# Optional
STRIPE_BACKUP_KEY=sk_test_xxxxx  # For fallback payments
PAYMENT_RETRY_ATTEMPTS=3
PAYMENT_WEBHOOK_TIMEOUT=30
```

### Frontend Environment (Vercel)
Add environment variables in Vercel dashboard:

```
VITE_API_URL=https://transcend-law.com
```

### LawPay Webhook Configuration
In LawPay dashboard:

```
Webhook URL: https://transcend-law.com/api/webhooks/lawpay
Events:
  ✅ payment.completed
  ✅ payment.failed
  ✅ disbursement.completed
  ✅ disbursement.failed
```

---

## 🔐 Security Checklist

- ✅ All API keys stored in environment variables (not in code)
- ✅ Webhook signatures verified
- ✅ JWT authentication on all payment endpoints
- ✅ Rate limiting on payment endpoints
- ✅ HTTPS enforced (Vercel + Let's Encrypt)
- ✅ CORS configured for frontend domain
- ✅ Audit logging of all payment activities
- ✅ PCI DSS compliance via LawPay
- ✅ Bank account verification
- ✅ Encrypted data storage

---

## 📊 Payment Flow Diagrams

### Inbound Payment Flow
```
Client
  ↓
Create Payment Link (admin)
  ↓
LawPay Payment Link
  ↓
Client Pays
  ↓
LawPay Webhook
  ↓
Update Transaction Status
  ↓
Funds in TRANSCEND Account
  ↓
Admin Initiates Disbursement
```

### Outbound Payment Flow
```
Admin
  ↓
Create Disbursement
  ↓
LawPay API
  ↓
Verify Bank Account
  ↓
Process Transfer
  ↓
LawPay Webhook
  ↓
Update Payment Schedule
  ↓
Funds in Professional Account
```

---

## 💰 Fee Structure

| Type | Fee | Notes |
|------|-----|-------|
| Inbound | 2.9% + $0.30 | Per payment |
| Outbound | 1.0% | Per disbursement |
| Refund | Waived | Via LawPay |
| Webhook | No charge | Real-time |

**Platform Commission**: 15% of inbound payments (additional)

---

## 🧪 Testing

### Test Credentials
Get from LawPay sandbox:

```bash
# Inbound Payment Test
curl -X POST https://transcend-law.com/api/payments/create-payment-link \
  -H "Authorization: Bearer {TOKEN}" \
  -d '{
    "caseId": "TEST-001",
    "amount": 100,
    "clientName": "Test Client",
    "clientEmail": "test@example.com"
  }'

# Outbound Payment Test
curl -X POST https://transcend-law.com/api/payments/disbursement \
  -H "Authorization: Bearer {TOKEN}" \
  -d '{
    "professionalId": "PROF-TEST-001",
    "amount": 75,
    "caseId": "TEST-001"
  }'
```

### Test Payment Methods
- Visa: 4242 4242 4242 4242
- MasterCard: 5555 5555 5555 4444
- Amex: 3782 822463 10005

---

## 📞 Support & Monitoring

### Dashboard Links
- LawPay Dashboard: https://dashboard.lawpay.com
- TRANSCEND Admin: https://transcend-law.com (Admin only)
- Vercel Dashboard: https://vercel.com/dashboard

### Monitoring
- PM2 Logs: `pm2 logs transcend-law | grep PAYMENT`
- Database: `SELECT * FROM transactions WHERE status = 'failed'`
- Webhooks: Check LawPay webhook delivery logs

---

## ✅ Deployment Checklist

- [ ] LawPay API keys obtained
- [ ] Environment variables configured (.env)
- [ ] Backend deployed and running
- [ ] Webhook URL registered in LawPay
- [ ] Frontend built and ready
- [ ] Vercel deployment configured
- [ ] Environment variables in Vercel
- [ ] Domain CNAME records updated
- [ ] SSL certificate active
- [ ] Test payment completed
- [ ] Test disbursement completed
- [ ] Audit logs verified
- [ ] Documentation sent to team

---

## 🎉 Success Indicators

✅ Payment link generated successfully
✅ Client payment received in LawPay
✅ Webhook notification processed
✅ Database transaction updated
✅ Professional payment disbursed
✅ Payment status tracked correctly
✅ All audit logs recorded
✅ Zero failed transactions

---

**Deployment Status: READY FOR PRODUCTION** 🚀

Version: 1.0.0  
Date: 2026-08-14  
Contact: cejsburlew@gmail.com
