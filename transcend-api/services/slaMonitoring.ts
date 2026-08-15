// SLA Monitoring & Auto-Credits Service
// Features: Uptime tracking (99.9% SLA), automatic credit calculation, incident tracking,
// compliance reporting, and auto-email notifications

import { query } from '../database/connection';
import { v4 as uuidv4 } from 'uuid';
import * as nodemailer from 'nodemailer';

// ============================================
// TYPES & INTERFACES
// ============================================

export interface HealthCheckRecord {
  id: string;
  timestamp: Date;
  status: 'up' | 'down' | 'degraded';
  responseTime: number; // milliseconds
  endpoint: string;
  statusCode: number;
  errorMessage?: string;
  metadata?: Record<string, any>;
}

export interface SLAIncident {
  id: string;
  startTime: Date;
  endTime?: Date;
  duration?: number; // seconds
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'ongoing' | 'resolved' | 'investigating';
  affectedServices: string[];
  rootCause?: string;
  impact: {
    downtime: number; // seconds
    affectedUsers: number;
    estimatedLoss: number; // dollars
  };
  resolution?: {
    resolvedAt: Date;
    actionTaken: string;
    preventiveMeasures: string;
  };
  createdAt: Date;
}

export interface SLAComplianceMonth {
  id: string;
  month: Date;
  uptime: number; // percentage (0-100)
  targetUptime: number; // 99.9
  breached: boolean;
  totalDowntime: number; // seconds
  incidents: SLAIncident[];
  creditEarned: number; // dollars or percentage
  creditCalculation: {
    monthlyFee: number;
    creditPercentage: number;
    creditAmount: number;
  };
  complianceStatus: 'compliant' | 'breached' | 'critical';
}

export interface SLACredit {
  id: string;
  userId: string;
  accountId: string;
  amount: number;
  percentage: number; // credit as % of month fee
  reason: string; // which month/incidents
  month: Date;
  status: 'pending' | 'applied' | 'expired';
  appliedDate?: Date;
  expiryDate: Date;
  createdAt: Date;
  emailSent: boolean;
  emailSentAt?: Date;
}

export interface SLAStatus {
  currentUptime: number;
  targetUptime: number;
  status: 'compliant' | 'at-risk' | 'breached';
  daysIntoMonth: number;
  requiredUptimeRemaining: number;
  currentMonthIncidents: SLAIncident[];
  projectedMonthlyCredit?: number;
  creditHistory: SLACredit[];
  lastIncident?: SLAIncident;
  healthStatus: 'healthy' | 'degraded' | 'critical';
}

export interface SLAHealthCheck {
  id: string;
  timestamp: Date;
  allServicesUp: boolean;
  serviceStatuses: {
    [key: string]: {
      status: 'up' | 'down' | 'degraded';
      responseTime: number;
      lastCheck: Date;
    };
  };
  uptime24h: number;
  uptime7d: number;
  uptime30d: number;
}

// ============================================
// DATABASE INITIALIZATION
// ============================================

export async function initializeSLATables(): Promise<void> {
  try {
    // Health check records table
    await query(`
      CREATE TABLE IF NOT EXISTS sla_health_checks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        status VARCHAR(20) NOT NULL CHECK (status IN ('up', 'down', 'degraded')),
        response_time INTEGER NOT NULL,
        endpoint VARCHAR(500) NOT NULL,
        status_code INTEGER,
        error_message TEXT,
        metadata JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_sla_health_checks_timestamp ON sla_health_checks(timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_sla_health_checks_status ON sla_health_checks(status);
      CREATE INDEX IF NOT EXISTS idx_sla_health_checks_endpoint ON sla_health_checks(endpoint);
    `);

    // Incidents table
    await query(`
      CREATE TABLE IF NOT EXISTS sla_incidents (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        start_time TIMESTAMP NOT NULL,
        end_time TIMESTAMP,
        duration INTEGER,
        severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
        status VARCHAR(50) NOT NULL CHECK (status IN ('ongoing', 'resolved', 'investigating')),
        affected_services TEXT[] NOT NULL DEFAULT '{}',
        root_cause TEXT,
        impact_downtime INTEGER,
        impact_affected_users INTEGER,
        impact_estimated_loss NUMERIC(15,2),
        resolution_action TEXT,
        resolution_preventive_measures TEXT,
        resolved_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_sla_incidents_start_time ON sla_incidents(start_time DESC);
      CREATE INDEX IF NOT EXISTS idx_sla_incidents_status ON sla_incidents(status);
      CREATE INDEX IF NOT EXISTS idx_sla_incidents_severity ON sla_incidents(severity);
      CREATE INDEX IF NOT EXISTS idx_sla_incidents_created_at ON sla_incidents(created_at DESC);
    `);

    // Compliance tracking table
    await query(`
      CREATE TABLE IF NOT EXISTS sla_compliance_months (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        month DATE NOT NULL UNIQUE,
        uptime NUMERIC(5,2) NOT NULL,
        target_uptime NUMERIC(5,2) DEFAULT 99.9,
        breached BOOLEAN DEFAULT FALSE,
        total_downtime INTEGER DEFAULT 0,
        credit_earned NUMERIC(15,2) DEFAULT 0,
        credit_percentage NUMERIC(5,2) DEFAULT 0,
        monthly_fee NUMERIC(15,2),
        credit_amount NUMERIC(15,2),
        compliance_status VARCHAR(20) NOT NULL CHECK (compliance_status IN ('compliant', 'breached', 'critical')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_sla_compliance_month ON sla_compliance_months(month DESC);
      CREATE INDEX IF NOT EXISTS idx_sla_compliance_breached ON sla_compliance_months(breached);
    `);

    // Credits table
    await query(`
      CREATE TABLE IF NOT EXISTS sla_credits (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        account_id UUID NOT NULL,
        amount NUMERIC(15,2) NOT NULL,
        percentage NUMERIC(5,2) NOT NULL,
        reason VARCHAR(500) NOT NULL,
        month DATE NOT NULL,
        status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'applied', 'expired')),
        applied_date TIMESTAMP,
        expiry_date TIMESTAMP NOT NULL,
        email_sent BOOLEAN DEFAULT FALSE,
        email_sent_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id)
      );

      CREATE INDEX IF NOT EXISTS idx_sla_credits_user_id ON sla_credits(user_id);
      CREATE INDEX IF NOT EXISTS idx_sla_credits_account_id ON sla_credits(account_id);
      CREATE INDEX IF NOT EXISTS idx_sla_credits_status ON sla_credits(status);
      CREATE INDEX IF NOT EXISTS idx_sla_credits_month ON sla_credits(month);
      CREATE INDEX IF NOT EXISTS idx_sla_credits_expiry_date ON sla_credits(expiry_date);
    `);

    // SLA history/logs table
    await query(`
      CREATE TABLE IF NOT EXISTS sla_history (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        event_type VARCHAR(100) NOT NULL,
        incident_id UUID,
        credit_id UUID,
        details JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        FOREIGN KEY (incident_id) REFERENCES sla_incidents(id),
        FOREIGN KEY (credit_id) REFERENCES sla_credits(id)
      );

      CREATE INDEX IF NOT EXISTS idx_sla_history_event_type ON sla_history(event_type);
      CREATE INDEX IF NOT EXISTS idx_sla_history_created_at ON sla_history(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_sla_history_incident_id ON sla_history(incident_id);
    `);

    console.log('SLA monitoring tables initialized successfully');
  } catch (error) {
    console.error('Error initializing SLA tables:', error);
    throw error;
  }
}

// ============================================
// HEALTH CHECK FUNCTIONS
// ============================================

/**
 * Record a health check
 */
export async function recordHealthCheck(
  endpoint: string,
  status: 'up' | 'down' | 'degraded',
  responseTime: number,
  statusCode?: number,
  errorMessage?: string,
  metadata?: Record<string, any>
): Promise<HealthCheckRecord> {
  try {
    const result = await query(
      `INSERT INTO sla_health_checks (
        endpoint, status, response_time, status_code, error_message, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *`,
      [
        endpoint,
        status,
        responseTime,
        statusCode || null,
        errorMessage || null,
        metadata ? JSON.stringify(metadata) : null,
      ]
    );

    // Check if this should trigger incident creation
    if (status === 'down') {
      await checkAndCreateIncident(endpoint);
    }

    return parseHealthCheckRow(result.rows[0]);
  } catch (error) {
    console.error('Error recording health check:', error);
    throw error;
  }
}

/**
 * Get health check records for time period
 */
export async function getHealthCheckRecords(
  startTime: Date,
  endTime: Date,
  endpoint?: string
): Promise<HealthCheckRecord[]> {
  try {
    let whereClause = 'WHERE timestamp BETWEEN $1 AND $2';
    const params: any[] = [startTime, endTime];

    if (endpoint) {
      whereClause += ` AND endpoint = $3`;
      params.push(endpoint);
    }

    const result = await query(
      `SELECT * FROM sla_health_checks ${whereClause} ORDER BY timestamp DESC`,
      params
    );

    return result.rows.map(row => parseHealthCheckRow(row));
  } catch (error) {
    console.error('Error retrieving health check records:', error);
    throw error;
  }
}

// ============================================
// INCIDENT MANAGEMENT
// ============================================

/**
 * Check if we should create an incident (multiple failures)
 */
async function checkAndCreateIncident(endpoint: string): Promise<void> {
  try {
    // Check for multiple failures in the last 5 minutes
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    const failures = await query(
      `SELECT COUNT(*) as count FROM sla_health_checks
       WHERE endpoint = $1 AND status = 'down' AND timestamp > $2`,
      [endpoint, fiveMinutesAgo]
    );

    if (failures.rows[0].count >= 3) {
      // Check if there's already an ongoing incident
      const existingIncident = await query(
        `SELECT * FROM sla_incidents
         WHERE status = 'ongoing' AND $1 = ANY(affected_services)`,
        [endpoint]
      );

      if (existingIncident.rows.length === 0) {
        await createIncident(
          [endpoint],
          'critical',
          'Automated incident: Multiple consecutive failures detected'
        );
      }
    }
  } catch (error) {
    console.error('Error checking for incidents:', error);
  }
}

/**
 * Create an incident
 */
export async function createIncident(
  affectedServices: string[],
  severity: 'low' | 'medium' | 'high' | 'critical',
  description: string,
  metadata?: Record<string, any>
): Promise<SLAIncident> {
  try {
    const result = await query(
      `INSERT INTO sla_incidents (
        start_time, severity, status, affected_services
      ) VALUES ($1, $2, $3, $4)
      RETURNING *`,
      [
        new Date(),
        severity,
        'ongoing',
        affectedServices,
      ]
    );

    const incident = parseIncidentRow(result.rows[0]);

    // Log the incident creation
    await query(
      `INSERT INTO sla_history (event_type, incident_id, details)
       VALUES ($1, $2, $3)`,
      ['incident_created', incident.id, JSON.stringify({ description, metadata })]
    );

    return incident;
  } catch (error) {
    console.error('Error creating incident:', error);
    throw error;
  }
}

/**
 * Resolve an incident
 */
export async function resolveIncident(
  incidentId: string,
  actionTaken: string,
  preventiveMeasures: string
): Promise<SLAIncident> {
  try {
    const now = new Date();

    // Get the incident to calculate duration
    const incident = await query(
      `SELECT * FROM sla_incidents WHERE id = $1`,
      [incidentId]
    );

    if (incident.rows.length === 0) {
      throw new Error('Incident not found');
    }

    const startTime = new Date(incident.rows[0].start_time);
    const durationSeconds = Math.floor((now.getTime() - startTime.getTime()) / 1000);

    const result = await query(
      `UPDATE sla_incidents
       SET end_time = $1, duration = $2, status = 'resolved',
           resolved_at = $1, resolution_action = $3, resolution_preventive_measures = $4,
           updated_at = $1
       WHERE id = $5
       RETURNING *`,
      [now, durationSeconds, actionTaken, preventiveMeasures, incidentId]
    );

    const resolvedIncident = parseIncidentRow(result.rows[0]);

    // Log resolution
    await query(
      `INSERT INTO sla_history (event_type, incident_id, details)
       VALUES ($1, $2, $3)`,
      ['incident_resolved', incidentId, JSON.stringify({ actionTaken, preventiveMeasures })]
    );

    return resolvedIncident;
  } catch (error) {
    console.error('Error resolving incident:', error);
    throw error;
  }
}

/**
 * Get incidents for a date range
 */
export async function getIncidents(
  startDate: Date,
  endDate: Date,
  status?: string
): Promise<SLAIncident[]> {
  try {
    let whereClause = 'WHERE start_time BETWEEN $1 AND $2';
    const params: any[] = [startDate, endDate];

    if (status) {
      whereClause += ` AND status = $3`;
      params.push(status);
    }

    const result = await query(
      `SELECT * FROM sla_incidents ${whereClause} ORDER BY start_time DESC`,
      params
    );

    return result.rows.map(row => parseIncidentRow(row));
  } catch (error) {
    console.error('Error getting incidents:', error);
    throw error;
  }
}

// ============================================
// COMPLIANCE TRACKING
// ============================================

/**
 * Calculate monthly uptime and compliance
 */
export async function calculateMonthlyCompliance(month: Date): Promise<SLAComplianceMonth> {
  try {
    const monthStart = new Date(month.getFullYear(), month.getMonth(), 1);
    const monthEnd = new Date(month.getFullYear(), month.getMonth() + 1, 1);

    // Get total seconds in month
    const totalSeconds = (monthEnd.getTime() - monthStart.getTime()) / 1000;

    // Get all incidents for the month
    const incidents = await getIncidents(monthStart, monthEnd);

    // Calculate total downtime
    let totalDowntimeSeconds = 0;
    incidents.forEach(incident => {
      if (incident.duration) {
        totalDowntimeSeconds += incident.duration;
      }
    });

    // Calculate uptime percentage
    const uptimePercentage = ((totalSeconds - totalDowntimeSeconds) / totalSeconds) * 100;
    const targetUptime = 99.9;
    const breached = uptimePercentage < targetUptime;

    // Calculate credit if breached
    let creditPercentage = 0;
    if (breached) {
      // Credit calculation: difference from target * 10%
      const uptimeDifference = targetUptime - uptimePercentage;
      creditPercentage = Math.min(uptimeDifference * 10, 100); // Max 100% credit
    }

    const complianceMonth: SLAComplianceMonth = {
      id: uuidv4(),
      month: monthStart,
      uptime: Math.round(uptimePercentage * 100) / 100,
      targetUptime,
      breached,
      totalDowntime: totalDowntimeSeconds,
      incidents,
      creditEarned: creditPercentage,
      creditCalculation: {
        monthlyFee: 0, // Will be populated per customer
        creditPercentage,
        creditAmount: 0, // Will be calculated
      },
      complianceStatus: breached ? (uptimePercentage < 99) ? 'critical' : 'breached' : 'compliant',
    };

    // Save to database
    await query(
      `INSERT INTO sla_compliance_months (
        month, uptime, breached, total_downtime, credit_percentage, compliance_status
      ) VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (month) DO UPDATE SET
        uptime = EXCLUDED.uptime,
        breached = EXCLUDED.breached,
        total_downtime = EXCLUDED.total_downtime,
        credit_percentage = EXCLUDED.credit_percentage,
        compliance_status = EXCLUDED.compliance_status,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *`,
      [
        monthStart,
        complianceMonth.uptime,
        breached,
        totalDowntimeSeconds,
        creditPercentage,
        complianceMonth.complianceStatus,
      ]
    );

    return complianceMonth;
  } catch (error) {
    console.error('Error calculating monthly compliance:', error);
    throw error;
  }
}

/**
 * Get compliance history
 */
export async function getComplianceHistory(
  months: number = 12
): Promise<SLAComplianceMonth[]> {
  try {
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    const result = await query(
      `SELECT * FROM sla_compliance_months WHERE month >= $1 ORDER BY month DESC`,
      [startDate]
    );

    return result.rows.map(row => ({
      id: row.id,
      month: new Date(row.month),
      uptime: parseFloat(row.uptime),
      targetUptime: parseFloat(row.target_uptime),
      breached: row.breached,
      totalDowntime: row.total_downtime,
      incidents: [],
      creditEarned: parseFloat(row.credit_earned || 0),
      creditCalculation: {
        monthlyFee: parseFloat(row.monthly_fee || 0),
        creditPercentage: parseFloat(row.credit_percentage),
        creditAmount: parseFloat(row.credit_amount || 0),
      },
      complianceStatus: row.compliance_status,
    }));
  } catch (error) {
    console.error('Error getting compliance history:', error);
    throw error;
  }
}

// ============================================
// CREDIT MANAGEMENT
// ============================================

/**
 * Create and issue SLA credits
 */
export async function issueSLACredits(
  userId: string,
  accountId: string,
  monthlyFee: number,
  creditPercentage: number,
  month: Date,
  reason: string
): Promise<SLACredit> {
  try {
    const creditAmount = (monthlyFee * creditPercentage) / 100;
    const expiryDate = new Date(month);
    expiryDate.setMonth(expiryDate.getMonth() + 12); // Expire after 1 year

    const result = await query(
      `INSERT INTO sla_credits (
        user_id, account_id, amount, percentage, reason, month,
        status, expiry_date
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [
        userId,
        accountId,
        creditAmount,
        creditPercentage,
        reason,
        month,
        'pending',
        expiryDate,
      ]
    );

    const credit = parseCreditRow(result.rows[0]);

    // Log credit creation
    await query(
      `INSERT INTO sla_history (event_type, credit_id, details)
       VALUES ($1, $2, $3)`,
      ['credit_issued', credit.id, JSON.stringify({
        user_id: userId,
        amount: creditAmount,
        percentage: creditPercentage,
        reason
      })]
    );

    // Attempt to send email
    await sendCreditNotificationEmail(userId, credit);

    return credit;
  } catch (error) {
    console.error('Error issuing SLA credits:', error);
    throw error;
  }
}

/**
 * Apply SLA credit to account
 */
export async function applySLACredit(creditId: string): Promise<SLACredit> {
  try {
    const now = new Date();

    const result = await query(
      `UPDATE sla_credits
       SET status = 'applied', applied_date = $1, updated_at = $1
       WHERE id = $2
       RETURNING *`,
      [now, creditId]
    );

    const credit = parseCreditRow(result.rows[0]);

    // Log credit application
    await query(
      `INSERT INTO sla_history (event_type, credit_id, details)
       VALUES ($1, $2, $3)`,
      ['credit_applied', creditId, JSON.stringify({ applied_date: now })]
    );

    return credit;
  } catch (error) {
    console.error('Error applying SLA credit:', error);
    throw error;
  }
}

/**
 * Get pending credits for user
 */
export async function getPendingCredits(userId: string): Promise<SLACredit[]> {
  try {
    const result = await query(
      `SELECT * FROM sla_credits
       WHERE user_id = $1 AND status = 'pending' AND expiry_date > NOW()
       ORDER BY created_at DESC`,
      [userId]
    );

    return result.rows.map(row => parseCreditRow(row));
  } catch (error) {
    console.error('Error getting pending credits:', error);
    throw error;
  }
}

/**
 * Get credit history for user
 */
export async function getCreditHistory(userId: string, months: number = 12): Promise<SLACredit[]> {
  try {
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    const result = await query(
      `SELECT * FROM sla_credits
       WHERE user_id = $1 AND created_at >= $2
       ORDER BY created_at DESC`,
      [userId, startDate]
    );

    return result.rows.map(row => parseCreditRow(row));
  } catch (error) {
    console.error('Error getting credit history:', error);
    throw error;
  }
}

// ============================================
// AUTO-EMAIL NOTIFICATIONS
// ============================================

/**
 * Send credit notification email
 */
async function sendCreditNotificationEmail(userId: string, credit: SLACredit): Promise<void> {
  try {
    // In production, fetch user email from database
    const userResult = await query(
      `SELECT email, first_name FROM users WHERE id = $1`,
      [userId]
    );

    if (userResult.rows.length === 0) {
      console.warn(`User not found: ${userId}`);
      return;
    }

    const { email, first_name } = userResult.rows[0];

    // Configure nodemailer (use environment variables in production)
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'localhost',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: process.env.SMTP_USER ? {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      } : undefined,
    });

    const monthName = credit.month.toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric'
    });

    const emailContent = `
      <h2>SLA Credit Issued</h2>
      <p>Hi ${first_name},</p>
      <p>We've issued an SLA credit to your account for ${monthName} due to service downtime that fell below our 99.9% uptime guarantee.</p>

      <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <p><strong>Credit Details:</strong></p>
        <ul>
          <li>Amount: $${credit.amount.toFixed(2)}</li>
          <li>Credit Percentage: ${credit.percentage}% of monthly service fee</li>
          <li>Reason: ${credit.reason}</li>
          <li>Valid Until: ${credit.expiryDate.toLocaleDateString()}</li>
        </ul>
      </div>

      <p>This credit can be applied to your next invoice or used to extend your service. Credits expire 12 months from the service month.</p>

      <p>Thank you for your patience.</p>
      <p>Best regards,<br>Transcend Legal Team</p>
    `;

    await transporter.sendMail({
      from: process.env.SMTP_FROM || 'noreply@transcendlegal.com',
      to: email,
      subject: `SLA Credit Issued - ${monthName}`,
      html: emailContent,
    });

    // Mark email as sent
    await query(
      `UPDATE sla_credits
       SET email_sent = true, email_sent_at = NOW()
       WHERE id = $1`,
      [credit.id]
    );

    console.log(`Credit email sent to ${email}`);
  } catch (error) {
    console.error('Error sending credit notification email:', error);
    // Don't throw - email failure shouldn't break the credit process
  }
}

/**
 * Send incident notification email
 */
export async function sendIncidentNotificationEmail(
  incident: SLAIncident
): Promise<void> {
  try {
    // Get all active users
    const users = await query(
      `SELECT DISTINCT email, first_name FROM users WHERE account_status = 'active'`
    );

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'localhost',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: process.env.SMTP_USER ? {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      } : undefined,
    });

    const startTime = incident.startTime.toLocaleString();
    const duration = incident.duration ?
      `${Math.floor(incident.duration / 60)} minutes ${incident.duration % 60} seconds` :
      'Ongoing';

    for (const user of users.rows) {
      const emailContent = `
        <h2>Service Incident Alert</h2>
        <p>Hi ${user.first_name},</p>
        <p>We're experiencing a service incident that may affect your access to Transcend Legal.</p>

        <div style="background: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p><strong>Incident Details:</strong></p>
          <ul>
            <li>Severity: ${incident.severity.toUpperCase()}</li>
            <li>Affected Services: ${incident.affectedServices.join(', ')}</li>
            <li>Start Time: ${startTime}</li>
            <li>Duration: ${duration}</li>
            <li>Status: ${incident.status}</li>
          </ul>
        </div>

        <p>Our engineering team is working to resolve this issue. We'll send an update once the incident is resolved.</p>
        <p>For status updates, visit: <a href="https://status.transcendlegal.com">status.transcendlegal.com</a></p>

        <p>We apologize for any inconvenience.</p>
        <p>Best regards,<br>Transcend Legal Team</p>
      `;

      await transporter.sendMail({
        from: process.env.SMTP_FROM || 'noreply@transcendlegal.com',
        to: user.email,
        subject: `ALERT: ${incident.severity.toUpperCase()} Service Incident`,
        html: emailContent,
      });
    }

    console.log(`Incident notification sent to ${users.rows.length} users`);
  } catch (error) {
    console.error('Error sending incident notification:', error);
  }
}

// ============================================
// STATUS & DASHBOARD FUNCTIONS
// ============================================

/**
 * Get current SLA status
 */
export async function getCurrentSLAStatus(): Promise<SLAStatus> {
  try {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    // Get current compliance
    const compliance = await calculateMonthlyCompliance(monthStart);

    // Get current incidents
    const incidents = await getIncidents(monthStart, monthEnd, 'ongoing');

    // Get last incident
    const allIncidents = await getIncidents(monthStart, monthEnd);
    const lastIncident = allIncidents[0] || undefined;

    // Get recent health checks (last 24 hours)
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const recentChecks = await getHealthCheckRecords(twentyFourHoursAgo, now);

    // Calculate uptime in last 24 hours
    let upChecks = 0;
    recentChecks.forEach(check => {
      if (check.status === 'up') upChecks++;
    });
    const uptime24h = recentChecks.length > 0 ?
      Math.round((upChecks / recentChecks.length) * 100) : 100;

    // Determine health status
    let healthStatus: 'healthy' | 'degraded' | 'critical' = 'healthy';
    if (incidents.length > 0) {
      healthStatus = 'critical';
    } else if (uptime24h < 95) {
      healthStatus = 'degraded';
    }

    // Get days into month
    const daysInMonth = monthEnd.getDate();
    const daysIntoMonth = now.getDate();
    const requiredUptimeRemaining = ((monthEnd.getTime() - now.getTime()) /
      (monthEnd.getTime() - monthStart.getTime())) * 99.9;

    // Get credit history
    const allCredits = await query(
      `SELECT * FROM sla_credits
       WHERE created_at >= $1
       ORDER BY created_at DESC
       LIMIT 24`,
      [new Date(now.getFullYear(), now.getMonth() - 12, 1)]
    );

    const creditHistory = allCredits.rows.map(row => parseCreditRow(row));

    return {
      currentUptime: compliance.uptime,
      targetUptime: compliance.targetUptime,
      status: compliance.complianceStatus === 'compliant' ? 'compliant' :
              compliance.complianceStatus === 'critical' ? 'breached' : 'at-risk',
      daysIntoMonth,
      requiredUptimeRemaining: Math.round(requiredUptimeRemaining * 100) / 100,
      currentMonthIncidents: incidents,
      projectedMonthlyCredit: compliance.creditPercentage > 0 ? compliance.creditPercentage : undefined,
      creditHistory,
      lastIncident,
      healthStatus,
    };
  } catch (error) {
    console.error('Error getting current SLA status:', error);
    throw error;
  }
}

/**
 * Get SLA health check summary
 */
export async function getSLAHealthCheckSummary(): Promise<SLAHealthCheck> {
  try {
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Get unique endpoints
    const endpoints = await query(
      `SELECT DISTINCT endpoint FROM sla_health_checks WHERE timestamp > $1`,
      [thirtyDaysAgo]
    );

    const serviceStatuses: Record<string, any> = {};
    let allUp = true;

    for (const { endpoint } of endpoints.rows) {
      // Get latest status
      const latest = await query(
        `SELECT * FROM sla_health_checks WHERE endpoint = $1 ORDER BY timestamp DESC LIMIT 1`,
        [endpoint]
      );

      if (latest.rows.length > 0) {
        const latestCheck = latest.rows[0];
        serviceStatuses[endpoint] = {
          status: latestCheck.status,
          responseTime: latestCheck.response_time,
          lastCheck: new Date(latestCheck.timestamp),
        };
        if (latestCheck.status !== 'up') {
          allUp = false;
        }
      }
    }

    // Calculate uptime percentages
    const calculateUptime = async (startDate: Date): Promise<number> => {
      const checks = await query(
        `SELECT COUNT(*) as total,
                SUM(CASE WHEN status = 'up' THEN 1 ELSE 0 END) as up
         FROM sla_health_checks
         WHERE timestamp BETWEEN $1 AND $2`,
        [startDate, now]
      );

      const total = checks.rows[0].total || 0;
      const up = checks.rows[0].up || 0;
      return total > 0 ? Math.round((up / total) * 100) : 100;
    };

    return {
      id: uuidv4(),
      timestamp: now,
      allServicesUp: allUp,
      serviceStatuses,
      uptime24h: await calculateUptime(twentyFourHoursAgo),
      uptime7d: await calculateUptime(sevenDaysAgo),
      uptime30d: await calculateUptime(thirtyDaysAgo),
    };
  } catch (error) {
    console.error('Error getting SLA health check summary:', error);
    throw error;
  }
}

// ============================================
// MONTHLY MAINTENANCE JOBS
// ============================================

/**
 * Process end-of-month compliance and issue credits
 */
export async function processMonthlyCompliance(month: Date): Promise<{
  creditsIssued: number;
  totalCreditAmount: number;
}> {
  try {
    // Calculate compliance for the month
    const compliance = await calculateMonthlyCompliance(month);

    let creditsIssued = 0;
    let totalCreditAmount = 0;

    // If month is breached, issue credits to all users
    if (compliance.breached) {
      const users = await query(
        `SELECT DISTINCT u.id, u.first_name, a.monthly_fee
         FROM users u
         JOIN accounts a ON u.account_id = a.id
         WHERE u.account_status = 'active'`
      );

      for (const user of users.rows) {
        const credit = await issueSLACredits(
          user.id,
          user.account_id,
          user.monthly_fee || 0,
          compliance.creditPercentage,
          month,
          `SLA Breach - Uptime ${compliance.uptime}% (Target: ${compliance.targetUptime}%)`
        );

        creditsIssued++;
        totalCreditAmount += credit.amount;
      }

      console.log(`Monthly compliance processed: ${creditsIssued} credits issued for ${compliance.uptime}% uptime`);
    }

    return {
      creditsIssued,
      totalCreditAmount,
    };
  } catch (error) {
    console.error('Error processing monthly compliance:', error);
    throw error;
  }
}

/**
 * Clean up expired credits
 */
export async function cleanupExpiredCredits(): Promise<number> {
  try {
    const result = await query(
      `UPDATE sla_credits
       SET status = 'expired'
       WHERE status = 'pending' AND expiry_date < NOW()
       RETURNING id`
    );

    const count = result.rowCount || 0;
    console.log(`Expired ${count} SLA credits`);

    return count;
  } catch (error) {
    console.error('Error cleaning up expired credits:', error);
    throw error;
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function parseHealthCheckRow(row: any): HealthCheckRecord {
  return {
    id: row.id,
    timestamp: new Date(row.timestamp),
    status: row.status,
    responseTime: row.response_time,
    endpoint: row.endpoint,
    statusCode: row.status_code,
    errorMessage: row.error_message,
    metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
  };
}

function parseIncidentRow(row: any): SLAIncident {
  return {
    id: row.id,
    startTime: new Date(row.start_time),
    endTime: row.end_time ? new Date(row.end_time) : undefined,
    duration: row.duration,
    severity: row.severity,
    status: row.status,
    affectedServices: row.affected_services || [],
    rootCause: row.root_cause,
    impact: {
      downtime: row.impact_downtime || 0,
      affectedUsers: row.impact_affected_users || 0,
      estimatedLoss: parseFloat(row.impact_estimated_loss || 0),
    },
    resolution: row.resolved_at ? {
      resolvedAt: new Date(row.resolved_at),
      actionTaken: row.resolution_action,
      preventiveMeasures: row.resolution_preventive_measures,
    } : undefined,
    createdAt: new Date(row.created_at),
  };
}

function parseCreditRow(row: any): SLACredit {
  return {
    id: row.id,
    userId: row.user_id,
    accountId: row.account_id,
    amount: parseFloat(row.amount),
    percentage: parseFloat(row.percentage),
    reason: row.reason,
    month: new Date(row.month),
    status: row.status,
    appliedDate: row.applied_date ? new Date(row.applied_date) : undefined,
    expiryDate: new Date(row.expiry_date),
    createdAt: new Date(row.created_at),
    emailSent: row.email_sent,
    emailSentAt: row.email_sent_at ? new Date(row.email_sent_at) : undefined,
  };
}

export default {
  initializeSLATables,
  recordHealthCheck,
  getHealthCheckRecords,
  createIncident,
  resolveIncident,
  getIncidents,
  calculateMonthlyCompliance,
  getComplianceHistory,
  issueSLACredits,
  applySLACredit,
  getPendingCredits,
  getCreditHistory,
  sendIncidentNotificationEmail,
  getCurrentSLAStatus,
  getSLAHealthCheckSummary,
  processMonthlyCompliance,
  cleanupExpiredCredits,
};
