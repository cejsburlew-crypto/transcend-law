# SLA Monitoring & Auto-Credits System Implementation Guide

## Overview

The SLA Monitoring & Auto-Credits system provides comprehensive uptime tracking, automatic credit issuance, incident management, and compliance reporting for Transcend Legal's service guarantees.

**Service Level Guarantee:** 99.9% uptime per month

**Credit Structure:**
- 99.0% - 99.89% uptime: 10% monthly credit
- 98.0% - 98.99% uptime: 25% monthly credit
- 97.0% - 97.99% uptime: 50% monthly credit
- Below 97.0% uptime: 100% monthly credit

---

## Architecture

### Backend Service: `slaMonitoring.ts`

**Location:** `/transcend-api/services/slaMonitoring.ts`

**Core Responsibilities:**
1. Health check recording and analysis
2. Incident creation and resolution
3. Monthly compliance calculation
4. Automatic credit issuance
5. Email notifications
6. SLA status queries

**Database Tables:**

```sql
-- Health check records (5-minute granularity)
sla_health_checks
├── id (UUID)
├── timestamp
├── status (up/down/degraded)
├── response_time (ms)
├── endpoint
├── status_code
├── error_message
└── metadata

-- Incident tracking
sla_incidents
├── id (UUID)
├── start_time
├── end_time
├── duration (seconds)
├── severity (low/medium/high/critical)
├── status (ongoing/resolved/investigating)
├── affected_services (array)
├── root_cause
├── impact (downtime, users, loss)
└── resolution (action, measures)

-- Monthly compliance
sla_compliance_months
├── id (UUID)
├── month (DATE)
├── uptime (percentage)
├── target_uptime (99.9)
├── breached (boolean)
├── total_downtime
├── credit_percentage
└── compliance_status

-- Credits issued
sla_credits
├── id (UUID)
├── user_id
├── account_id
├── amount (dollars)
├── percentage
├── reason
├── month
├── status (pending/applied/expired)
├── expiry_date (+12 months)
└── email_sent

-- Event history
sla_history
├── id (UUID)
├── event_type
├── incident_id
├── credit_id
└── details (JSON)
```

### Frontend Component: `SLAStatus.tsx`

**Location:** `/transcend-frontend/src/components/SLAStatus.tsx`

**Displays:**
- Real-time uptime percentage
- System health status
- Current incidents (with expand details)
- Service status grid
- Credit history (private mode)
- Compliance history (private mode)

**Modes:**
- **Public Mode** (`publicMode={true}`): Public status page
- **Private Mode**: User-specific credits and history

**Tabs:**
1. **Overview**: Key metrics and SLA compliance details
2. **Incidents**: Current month incidents with resolution info
3. **Credits**: Issued credits and their status
4. **History**: Historical compliance data (12-month table)

---

## Integration Guide

### 1. Database Setup

Initialize tables before running the service:

```typescript
import { initializeSLATables } from './services/slaMonitoring';

// On app startup
await initializeSLATables();
```

### 2. Health Check Recording

Record health checks every 5 minutes from your monitoring system:

```typescript
import {
  recordHealthCheck,
  sendIncidentNotificationEmail,
} from './services/slaMonitoring';

// Example: HTTP health check
async function healthCheckWorker() {
  const endpoints = [
    'https://api.transcendlegal.com/health',
    'https://app.transcendlegal.com/health',
    'https://auth.transcendlegal.com/health',
  ];

  for (const endpoint of endpoints) {
    try {
      const start = Date.now();
      const response = await fetch(endpoint, { timeout: 5000 });
      const responseTime = Date.now() - start;

      await recordHealthCheck(
        endpoint,
        response.ok ? 'up' : 'down',
        responseTime,
        response.status,
        response.ok ? undefined : 'HTTP ' + response.status
      );
    } catch (error) {
      await recordHealthCheck(
        endpoint,
        'down',
        Date.now() - start,
        undefined,
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }
}

// Run every 5 minutes
setInterval(healthCheckWorker, 5 * 60 * 1000);
```

### 3. Incident Management

Create incidents manually or automatically:

```typescript
import { createIncident, resolveIncident } from './services/slaMonitoring';

// Create incident (usually automatic via health checks)
const incident = await createIncident(
  ['api.transcendlegal.com', 'database'],
  'critical',
  'Database connection pool exhausted'
);

// Later, resolve it
await resolveIncident(
  incident.id,
  'Increased connection pool size to 200',
  'Implement connection monitoring and auto-scaling'
);
```

### 4. Monthly Compliance Processing

Run at the start of each month (1st day at 00:01):

```typescript
import { processMonthlyCompliance } from './services/slaMonitoring';

// In your scheduler/cron job
const lastMonth = new Date();
lastMonth.setMonth(lastMonth.getMonth() - 1);
lastMonth.setDate(1);

const result = await processMonthlyCompliance(lastMonth);
console.log(`Credits issued: ${result.creditsIssued}`);
console.log(`Total amount: $${result.totalCreditAmount.toFixed(2)}`);
```

### 5. Credit Expiration Cleanup

Run daily to expire old credits:

```typescript
import { cleanupExpiredCredits } from './services/slaMonitoring';

// In your daily maintenance job
const expiredCount = await cleanupExpiredCredits();
console.log(`${expiredCount} credits marked as expired`);
```

### 6. API Endpoints (Express/Node)

```typescript
import express, { Request, Response } from 'express';
import {
  getCurrentSLAStatus,
  getSLAHealthCheckSummary,
  getComplianceHistory,
  getIncidents,
  getPendingCredits,
  applySLACredit,
} from '../services/slaMonitoring';

const router = express.Router();

// Public SLA status page
router.get('/api/v2/sla/public/status', async (req: Request, res: Response) => {
  try {
    const status = await getCurrentSLAStatus();
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch SLA status' });
  }
});

router.get('/api/v2/sla/public/health', async (req: Request, res: Response) => {
  try {
    const health = await getSLAHealthCheckSummary();
    res.json(health);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch health status' });
  }
});

// User-specific SLA status
router.get('/api/v2/sla/status', requireAuth, async (req: Request, res: Response) => {
  try {
    const status = await getCurrentSLAStatus();
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch SLA status' });
  }
});

router.get('/api/v2/sla/health', requireAuth, async (req: Request, res: Response) => {
  try {
    const health = await getSLAHealthCheckSummary();
    res.json(health);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch health status' });
  }
});

// Compliance history
router.get('/api/v2/sla/compliance/history', requireAuth, async (req: Request, res: Response) => {
  try {
    const months = parseInt(req.query.months as string) || 12;
    const history = await getComplianceHistory(months);
    res.json(history);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch compliance history' });
  }
});

// Pending credits
router.get('/api/v2/sla/credits', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;
    const credits = await getPendingCredits(userId);
    res.json(credits);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch credits' });
  }
});

// Apply credit to account
router.post('/api/v2/sla/credits/:creditId/apply', requireAuth, async (req: Request, res: Response) => {
  try {
    const credit = await applySLACredit(req.params.creditId);
    res.json(credit);
  } catch (error) {
    res.status(500).json({ error: 'Failed to apply credit' });
  }
});

// Recent incidents
router.get('/api/v2/sla/incidents', requireAuth, async (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const incidents = await getIncidents(startDate, new Date());
    res.json(incidents);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch incidents' });
  }
});

export default router;
```

### 7. Frontend Integration

Display the SLA Status component in your dashboard:

```typescript
import { SLAStatus } from '../components/SLAStatus';

// User dashboard
function Dashboard() {
  const userId = getCurrentUserId();

  return (
    <div className="dashboard">
      <SLAStatus
        userId={userId}
        publicMode={false}
        onIncidentClick={(incident) => {
          console.log('Incident clicked:', incident);
        }}
      />
    </div>
  );
}

// Public status page
function StatusPage() {
  return (
    <div className="status-page">
      <SLAStatus publicMode={true} />
    </div>
  );
}
```

---

## Email Configuration

The service uses nodemailer for email notifications. Configure environment variables:

```bash
# .env
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=apikey
SMTP_PASSWORD=SG.xxxxxxxxxxxxx
SMTP_FROM=noreply@transcendlegal.com
```

**Email Types:**

1. **Credit Notification** (automatic when credit issued)
   - Sent to user email
   - Includes: amount, percentage, valid until date
   - Template: Professional HTML email

2. **Incident Alert** (automatic when critical incident)
   - Sent to all active users
   - Includes: severity, affected services, duration
   - Link to status page

---

## Monitoring & Alerts

### Key Metrics to Track

1. **Uptime %**: Current month uptime against 99.9% target
2. **MTTF** (Mean Time To Failure): Average time between incidents
3. **MTTR** (Mean Time To Recovery): Average incident duration
4. **Credits Issued**: Monthly total credits issued
5. **Health Score**: Composite health metric (0-100)

### Alert Thresholds

```typescript
// Alert if uptime drops below 99.5% (heading to breach)
if (currentUptime < 99.5 && uptime >= 99.5) {
  alertOps('SLA at risk: Uptime ' + currentUptime);
}

// Alert if critical incident
if (incident.severity === 'critical') {
  alertOps('CRITICAL INCIDENT: ' + incident.affectedServices.join(', '));
  sendIncidentNotificationEmail(incident);
}

// Alert if multiple incidents in one day
if (incidentsToday > 3) {
  alertOps('Multiple incidents detected today (' + incidentsToday + ')');
}
```

---

## Reporting & Compliance

### Monthly Report Generation

```typescript
import { generateAuditReport } from '../services/auditLogger';

async function generateMonthlyReport() {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  // Get compliance data
  const compliance = await calculateMonthlyCompliance(monthStart);

  // Generate report
  const report = {
    month: monthStart.toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric'
    }),
    uptime: compliance.uptime + '%',
    target: compliance.targetUptime + '%',
    status: compliance.complianceStatus,
    breached: compliance.breached,
    totalDowntime: formatDuration(compliance.totalDowntime),
    incidents: compliance.incidents.length,
    creditsIssued: compliance.creditEarned + '%',
    generatedAt: new Date().toISOString(),
  };

  return report;
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${hours}h ${minutes}m ${secs}s`;
}
```

---

## Best Practices

### 1. Health Check Configuration

- **Frequency**: 5-minute intervals
- **Timeout**: 5 seconds per check
- **Redundancy**: Check from multiple regions
- **Endpoints**: Include critical user-facing APIs

### 2. Incident Management

- **Severity Levels**: Use consistently
  - LOW: Minimal user impact, resolves quickly
  - MEDIUM: Some users affected, <15 min
  - HIGH: Most users affected, >15 min
  - CRITICAL: All users affected, API down

- **Root Cause Analysis**: Document thoroughly
- **Resolution**: Test before marking resolved
- **Preventive**: Always include preventive measures

### 3. Credit Issuance

- **Accuracy**: Double-check calculations
- **Timeliness**: Issue within 2 days of month-end
- **Notification**: Always email users
- **Tracking**: Keep audit trail of all credits

### 4. Transparency

- **Public Status Page**: Always accessible
- **Historical Data**: Keep 24 months
- **Incident Details**: Share resolution info
- **Credits**: Show clearly in invoicing

---

## Testing

### Unit Tests

```typescript
describe('SLA Monitoring', () => {
  describe('Health Check Recording', () => {
    it('should record up status', async () => {
      const check = await recordHealthCheck(
        'https://api.test.com',
        'up',
        45,
        200
      );

      expect(check.status).toBe('up');
      expect(check.responseTime).toBe(45);
    });

    it('should trigger incident on multiple failures', async () => {
      // Record 3 failures in 5 minutes
      for (let i = 0; i < 3; i++) {
        await recordHealthCheck(
          'https://api.test.com',
          'down',
          5000,
          503,
          'Service Unavailable'
        );
      }

      const incidents = await getIncidents(
        new Date(Date.now() - 10 * 60 * 1000),
        new Date()
      );

      expect(incidents.length).toBeGreaterThan(0);
    });
  });

  describe('Compliance Calculation', () => {
    it('should calculate 99.5% uptime correctly', async () => {
      const month = new Date(2024, 0, 1); // January 2024
      const compliance = await calculateMonthlyCompliance(month);

      expect(compliance.uptime).toBeCloseTo(99.5, 1);
      expect(compliance.breached).toBe(true);
    });

    it('should calculate correct credit for 98% uptime', async () => {
      // Create incident for 7.2 hours (25% credit)
      // January has 744 hours total
      // 744 - 7.2 = 736.8 hours up = 98.96% uptime

      // Expected: 25% credit
    });
  });

  describe('Credit Issuance', () => {
    it('should expire credits after 12 months', async () => {
      const credit = await issueSLACredits(
        'user-123',
        'account-456',
        1000,
        10,
        new Date(2024, 0, 1),
        'Test credit'
      );

      expect(credit.expiryDate).toEqual(new Date(2025, 0, 1));
    });

    it('should send email when credit issued', async () => {
      // Mock email service
      const sendEmailSpy = jest.spyOn(emailService, 'send');

      await issueSLACredits(
        'user-123',
        'account-456',
        1000,
        10,
        new Date(),
        'Test'
      );

      expect(sendEmailSpy).toHaveBeenCalled();
    });
  });
});
```

---

## Troubleshooting

### Health checks not recording

**Check:**
1. Database connectivity
2. Table exists: `SELECT * FROM sla_health_checks LIMIT 1`
3. Cron job running: Check logs
4. Endpoint accessibility from checker location

### Credits not issuing

**Check:**
1. Month compliance calculated: `SELECT * FROM sla_compliance_months ORDER BY month DESC`
2. Breached flag set correctly
3. Monthly job triggered: Check logs for "Monthly compliance processed"
4. User records exist: `SELECT COUNT(*) FROM users WHERE account_status = 'active'`

### Emails not sending

**Check:**
1. SMTP credentials correct in environment
2. Email service accessible: `telnet smtp.sendgrid.net 587`
3. Email templates valid HTML
4. User email addresses valid format
5. Check transporter logs: `console.log('Email sent')`

### Frontend not loading

**Check:**
1. API endpoints return correct format
2. Auth token valid: `Authorization: Bearer {token}`
3. Component props passed correctly
4. CSS file imported in component
5. Network requests in DevTools

---

## Support & Escalation

**Issues?** Contact:
- **Ops Team**: Critical incidents (Slack: #ops-critical)
- **Engineering**: SLA logic issues (GitHub Issues)
- **Billing**: Credit application questions (Email: billing@transcendlegal.com)

**SLA Status Page:** https://status.transcendlegal.com

---

## Version History

- **v1.0** (2024-08): Initial release
  - Health check recording
  - Incident tracking
  - Monthly compliance calculation
  - Auto-credit issuance
  - Email notifications
  - Status dashboard
