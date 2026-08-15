# 🌐 Lawyer Profile Website Hosting System

**$25/month subscription service**  
**Public lawyer websites at transcend-law.com/{company-name}**

---

## Overview

This feature allows attorneys to use Transcend Law as their professional website instead of building their own. For $25/month, they get:

- ✅ Professional website at transcend-law.com/[company-name]
- ✅ Display all practice areas (minus competition they select)
- ✅ Client testimonials & reviews
- ✅ Contact form for client inquiries
- ✅ Mobile-responsive design
- ✅ Basic analytics dashboard
- ✅ Integration with Transcend Law platform
- ✅ Cancel anytime with 30-day notice

---

## Architecture

### Backend Components

**1. Lawyer Website Service** (`transcend-api/services/lawyerWebsiteService.ts`)
- Generate unique subdomains (transcend-law.com/smith-associates, transcend-law.com/smith-associates-2 if duplicate)
- Track page views and analytics
- Manage testimonials
- Handle subscription renewals

**2. API Routes** (`transcend-api/routes/lawyerWebsites.ts`)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/lawyer-websites` | Create new website + start subscription |
| GET | `/api/lawyer-websites/:id` | Get website details |
| PUT | `/api/lawyer-websites/:id` | Update website content |
| POST | `/api/lawyer-websites/:id/testimonials` | Add testimonial |
| POST | `/api/lawyer-websites/:id/renew` | Renew subscription |
| POST | `/api/lawyer-websites/:id/cancel` | Cancel subscription |
| GET | `/:subdomain` | **PUBLIC** - View lawyer website |
| POST | `/:subdomain/contact` | **PUBLIC** - Submit contact form |
| POST | `/:subdomain/track/service-click` | **PUBLIC** - Track analytics |

**3. Database Schema** (`transcend-api/database/lawyer-websites-schema.sql`)

```sql
-- Main website storage
lawyer_websites (
  id, lawyer_id, company_name, subdomain, bio, email, phone,
  included_services, excluded_services,
  subscription_status, subscription_start_date, subscription_end_date,
  stripe_subscription_id, analytics...
)

-- Testimonials
lawyer_website_testimonials (
  id, website_id, client_name, rating, review, created_at
)

-- Analytics
lawyer_website_analytics (
  id, website_id, visit_date, page_views, unique_visitors, referral_source
)

-- Service clicks
lawyer_website_service_clicks (
  id, website_id, service_name, click_date, click_count
)

-- Contact submissions
lawyer_website_contact_submissions (
  id, website_id, client_name, email, phone, message, status
)

-- Billing history
lawyer_website_billing (
  id, website_id, amount, status, stripe_invoice_id, paid_at
)
```

### Frontend Components

**1. Setup Page** (`transcend-frontend/src/pages/LawyerWebsiteSetup.tsx`)

User flow:
1. Checkbox: "I don't have a website, use Transcend Law"
2. Enter company name (generates unique subdomain)
3. Enter bio and contact info
4. Select specializations
5. Select services to EXCLUDE (competition)
6. Review pricing ($25/month)
7. Create Stripe subscription
8. Redirect to website dashboard

**2. Public Website** (`transcend-frontend/src/pages/PublicLawyerWebsite.tsx`)

Sections:
- Hero with lawyer name, firm, specializations
- About section with bio, license, experience
- Practice areas (services shown: all available MINUS excluded)
- Client testimonials & ratings
- Contact form (name, email, phone, message, service interest)
- Footer with Transcend Law attribution

---

## Setup Instructions

### 1. Database Setup

```bash
# Run migration
psql -U postgres -d transcend_prod < transcend-api/database/lawyer-websites-schema.sql

# Verify tables created
psql -U postgres -d transcend_prod -c "\dt lawyer_website*"
```

### 2. Stripe Configuration

```typescript
// In Stripe Dashboard:
// 1. Create product: "Lawyer Website Hosting"
// 2. Create price: "price_lawyer_website_monthly" - $25 USD, recurring monthly
// 3. Add to STRIPE_PRODUCTS_CONFIG

const STRIPE_PRODUCTS = {
  LAWYER_WEBSITE_MONTHLY: 'price_lawyer_website_monthly', // $25/month
};
```

### 3. Environment Variables

```env
# Backend
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
LAWYER_WEBSITE_DOMAIN=transcend-law.com

# Frontend
REACT_APP_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

### 4. Routes Integration

```typescript
// In App.tsx or main routing file:
import LawyerWebsiteSetup from './pages/LawyerWebsiteSetup';
import PublicLawyerWebsite from './pages/PublicLawyerWebsite';

// Protected routes (authenticated attorneys)
<Route path="/my-website/setup" element={<LawyerWebsiteSetup />} />

// Public routes (anyone can access)
<Route path="/:subdomain" element={<PublicLawyerWebsite />} />
```

---

## User Flow

### For Attorneys

**Step 1: Enable Website Hosting**
- In profile settings, check: "I don't have a company website..."
- Enter company name
- System generates unique subdomain
- Fill in bio, phone, license, experience

**Step 2: Configure Services**
- Select 2-5 specializations (what they focus on)
- Select services to EXCLUDE (competition they don't want listed)
- Website will show ALL available services MINUS excluded ones
- This shows "depth" - we have many services!

**Step 3: Payment**
- $25/month subscription via Stripe
- Charges automatically each month
- Can cancel anytime with 30-day notice

**Step 4: Share Website**
- Website goes live at transcend-law.com/company-name
- Attorney can share URL with clients
- Shows in their Transcend Law profile
- Branded as "Powered by Transcend Law"

### For Clients

1. Visit transcend-law.com/smith-associates
2. See lawyer info, specializations, services
3. Read testimonials from other clients
4. Click "Get In Touch" → fill contact form
5. Message sent to attorney
6. Attorney can reach out directly

---

## Billing Model

### $25/month per lawyer website

**What's Included:**
- Website hosting
- 100 page views/month (auto-refresh)
- Analytics dashboard
- Testimonial management
- Contact form

**Pro tier (future):** $50/month
- 1000 page views/month
- Advanced analytics
- Email notifications
- Custom domain support

### Stripe Integration

```typescript
// Create subscription
const subscription = await stripe.subscriptions.create({
  customer: lawyer.stripeCustomerId,
  items: [{ price: 'price_lawyer_website_monthly' }],
  metadata: { websiteId: website.id, lawyerId: lawyer.id },
});

// Handle renewal
webhook('customer.subscription.updated') → update subscription_end_date

// Handle cancellation
webhook('customer.subscription.deleted') → set status to 'cancelled'
```

---

## Analytics Tracking

### What We Track

```typescript
interface Analytics {
  pageViews: number;                    // Total page loads
  uniqueVisitors: number;               // Unique IPs
  referralSource: string;               // direct, google, transcend-law
  serviceClicks: { [service]: count };  // Which services interest visitors
  contactFormSubmissions: number;       // Leads generated
}
```

### Dashboard Metrics

Lawyers can see:
- Total page views this month
- Unique visitors
- Which services get most clicks
- Contact form submissions
- Visitor trends (7-day, 30-day)

---

## Key Features

### Unique Subdomain Generation

```typescript
// If "Smith & Associates" exists in San Francisco:
- First: transcend-law.com/smith-and-associates
- Duplicate: transcend-law.com/smith-and-associates-2
- Third: transcend-law.com/smith-and-associates-3
```

### Service Display Logic

```typescript
// User selects:
availableServices = [all 20 services]
excludedServices = ['Personal Injury', 'DUI']

// Website shows:
includedServices = availableServices - excludedServices
// = [Criminal Defense, Family Law, Real Estate, etc]
```

### Testimonial Management

- Attorneys can add testimonials from clients
- Star rating (1-5 stars)
- Review text
- Client name
- Auto-calculates average rating

---

## Security & Compliance

### Private Information
- Email and phone are NOT shown on public website (only in admin dashboard)
- Contact form emails go directly to attorney
- Form submissions stored securely in database

### Legal Disclaimers
- Footer shows: "Powered by Transcend Law"
- Legal disclaimer: "This website does not create attorney-client relationship"
- "Prior results do not guarantee similar outcomes"

### Subscription Confirmation
- Email confirmation when subscription starts
- Monthly billing email
- 30-day cancellation notice required
- Can't delete website immediately (30-day grace period)

---

## Integration Points

### With Transcend Law Platform

1. **Lead Generation**
   - Contact form submissions create leads
   - Leads assigned to attorney
   - Can convert to paid clients through Transcend Law

2. **Attorney Profiles**
   - Website URL shown on attorney profile
   - Badge: "Has professional website"
   - Links from profile to public website

3. **Service Management**
   - Services list syncs from main Transcend Law platform
   - Attorney selects which to exclude
   - Keeps everything up-to-date

---

## Files Created

```
/transcend-api/
  ├── services/lawyerWebsiteService.ts (330 lines)
  ├── routes/lawyerWebsites.ts (250 lines)
  └── database/lawyer-websites-schema.sql (340 lines)

/transcend-frontend/src/pages/
  ├── LawyerWebsiteSetup.tsx (300 lines)
  ├── LawyerWebsiteSetup.css (450 lines)
  ├── PublicLawyerWebsite.tsx (280 lines)
  └── PublicLawyerWebsite.css (450 lines)

/
  └── LAWYER_WEBSITE_HOSTING.md (this file)
```

---

## Revenue Model

**Tier 1 (Current):** $25/month
- Basic website hosting
- 100 page views/month
- Essential features

**Tier 2 (Future):** $50/month
- Advanced website
- 1000 page views/month
- Premium analytics
- Custom branding

**Tier 3 (Future):** $100/month
- Enterprise website
- Unlimited page views
- Custom domain
- API access
- Email support

---

## Success Metrics

**Monthly Targets:**
- 500+ attorneys adopt website hosting
- 50,000+ monthly page views across all websites
- 1,000+ contact form submissions
- 10% conversion rate (contacts → paid clients)

**Revenue:**
- 500 websites × $25/month = $12,500/month
- $150,000/year from website hosting alone
- 10x growth opportunity with upsells

---

## Deployment Checklist

- [ ] Database schema created
- [ ] Stripe products configured ($25/month price)
- [ ] API routes implemented and tested
- [ ] Frontend pages built and styled
- [ ] Subdomain generation tested
- [ ] Contact form working
- [ ] Analytics tracking functional
- [ ] Email notifications setup
- [ ] Stripe webhook handling
- [ ] Public URL routing working (/:subdomain)
- [ ] Mobile responsive tested
- [ ] Documentation complete

---

**Status:** Ready for implementation  
**Priority:** High (revenue feature)  
**Estimated Implementation:** 3 days
