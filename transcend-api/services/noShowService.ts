// No-Show Tracking & Consequences Service
// Manages appointment no-shows, escalating fees, account consequences, and appeal process

import { query } from '../database/connection';
import { sendEmailNotification } from './emailService';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  // Cast: the installed SDK's types pin this literal to its own release.
  // Keep the pinned version - upgrading Stripe's API is a deliberate decision,
  // not a side effect of satisfying the compiler.
  apiVersion: '2023-10-16' as any,
});

// ============================================
// TYPES & INTERFACES
// ============================================

export interface NoShowRecord {
  id: string;
  clientId: string;
  providerId: string;
  appointmentId: string;
  appointmentDate: Date;
  noShowDate: Date;
  noShowReason?: string;
  detectionMethod: 'auto_timeout' | 'provider_reported' | 'system_check';
  fee: number;
  feeStatus: 'pending' | 'charged' | 'waived' | 'appealed';
  chargeId?: string;
  status: 'pending_review' | 'confirmed' | 'disputed' | 'waived';
  createdAt: Date;
  updatedAt: Date;
}

export interface ClientNoShowMetrics {
  clientId: string;
  totalNoShows: number;
  currentMonth: number;
  last30Days: number;
  last90Days: number;
  totalFeesCharged: number;
  totalFeesPending: number;
  accountStatus: 'active' | 'warned' | 'suspended' | 'terminated';
  lastNoShowDate?: Date;
}

export interface NoShowFee {
  id: string;
  noShowId: string;
  clientId: string;
  amount: number;
  feeLevel: 1 | 2 | 3;
  currency: string;
  chargeId?: string;
  status: 'pending' | 'charged' | 'waived' | 'refunded';
  chargedDate?: Date;
  createdAt: Date;
}

export interface AccountAction {
  id: string;
  clientId: string;
  actionType: 'warning' | 'suspension' | 'termination';
  triggerThreshold: number;
  reason: string;
  status: 'active' | 'lifted' | 'appealed';
  effectiveDate: Date;
  expiryDate?: Date;
  appealWindowExpiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface NoShowAppeal {
  id: string;
  noShowId: string;
  accountActionId?: string;
  clientId: string;
  reason: string;
  supportingDocuments: string[];
  status: 'submitted' | 'under_review' | 'approved' | 'denied';
  reviewedBy?: string;
  resolutionNotes?: string;
  submittedAt: Date;
  reviewedAt?: Date;
  createdAt: Date;
}

export interface NoShowNotification {
  id: string;
  clientId: string;
  noShowId?: string;
  accountActionId?: string;
  notificationType:
    | 'no_show_detected'
    | 'fee_charged'
    | 'account_warning'
    | 'account_suspended'
    | 'account_terminated'
    | 'appeal_approved'
    | 'appeal_denied';
  title: string;
  message: string;
  isRead: boolean;
  createdAt: Date;
}

export interface NoShowRefundPolicy {
  id: string;
  noShowId: string;
  clientId: string;
  originalFee: number;
  refundAmount: number;
  refundReason: string;
  refundStatus: 'pending' | 'processed' | 'failed';
  processedDate?: Date;
  refundTransactionId?: string;
  createdAt: Date;
}

// ============================================
// FEE CALCULATIONS
// ============================================

export function calculateNoShowFee(noShowCount: number): number {
  switch (noShowCount) {
    case 1:
      return 0; // First no-show is free
    case 2:
      return 25; // Second no-show: $25
    default:
      return 50; // Third and subsequent: $50
  }
}

export function determineAccountAction(noShowCount: number): 'warning' | 'suspension' | 'termination' | null {
  if (noShowCount === 3) return 'warning';
  if (noShowCount === 5) return 'suspension';
  if (noShowCount === 10) return 'termination';
  return null;
}

// ============================================
// NO-SHOW DETECTION & RECORDING
// ============================================

export async function recordNoShow(
  clientId: string,
  providerId: string,
  appointmentId: string,
  appointmentDate: Date,
  detectionMethod: 'auto_timeout' | 'provider_reported' | 'system_check' = 'system_check',
  noShowReason?: string
): Promise<NoShowRecord> {
  try {
    // Get client's current no-show count
    const metricsResult = await query(
      `SELECT total_no_shows FROM client_no_show_metrics WHERE client_id = $1`,
      [clientId]
    );

    let currentCount = 0;
    if (metricsResult.rows.length > 0) {
      currentCount = metricsResult.rows[0].total_no_shows || 0;
    }

    // Calculate fee based on count
    const noShowCountForFee = currentCount + 1;
    const fee = calculateNoShowFee(noShowCountForFee);

    // Insert no-show record
    const result = await query(
      `INSERT INTO no_shows
       (client_id, provider_id, appointment_id, appointment_date, no_show_date,
        no_show_reason, detection_method, fee, fee_status, status)
       VALUES ($1, $2, $3, $4, NOW(), $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        clientId,
        providerId,
        appointmentId,
        appointmentDate,
        noShowReason || null,
        detectionMethod,
        fee,
        'pending',
        'pending_review',
      ]
    );

    const noShowRecord = result.rows[0];

    // Update or create client metrics
    await updateClientNoShowMetrics(clientId);

    // Log activity
    await logNoShowActivity(
      noShowRecord.id,
      'no_show_recorded',
      clientId,
      `No-show recorded for appointment on ${appointmentDate.toISOString()}`
    );

    // Send notification to client
    await sendNoShowNotification(
      clientId,
      noShowRecord.id,
      'no_show_detected',
      'Appointment Not Attended',
      `We noticed you didn't attend your scheduled appointment on ${appointmentDate.toLocaleDateString()}. ${
        fee > 0 ? `A fee of $${fee} will be charged to your account.` : 'This is your first no-show and no fee applies.'
      }`
    );

    // Send notification to provider
    await sendProviderNotification(
      providerId,
      clientId,
      'Client No-Show',
      `Your client did not attend the scheduled appointment on ${appointmentDate.toLocaleDateString()}`
    );

    return {
      id: noShowRecord.id,
      clientId,
      providerId,
      appointmentId,
      appointmentDate,
      noShowDate: new Date(noShowRecord.no_show_date),
      noShowReason,
      detectionMethod,
      fee,
      feeStatus: 'pending',
      status: 'pending_review',
      createdAt: new Date(noShowRecord.created_at),
      updatedAt: new Date(noShowRecord.updated_at),
    };
  } catch (error) {
    console.error('Failed to record no-show:', error);
    throw error;
  }
}

export async function autoDetectNoShows(): Promise<number> {
  try {
    // Find appointments where the scheduled time has passed without completion
    const appointmentsResult = await query(
      `SELECT a.id, a.client_id, a.provider_id, a.scheduled_at, a.status
       FROM appointments a
       WHERE a.status = 'scheduled'
       AND a.scheduled_at < NOW()
       AND a.scheduled_at > NOW() - INTERVAL '1 day'
       AND NOT EXISTS (
         SELECT 1 FROM no_shows ns
         WHERE ns.appointment_id = a.id
       )`,
      []
    );

    let detectedCount = 0;

    for (const appointment of appointmentsResult.rows) {
      try {
        await recordNoShow(
          appointment.client_id,
          appointment.provider_id,
          appointment.id,
          new Date(appointment.scheduled_at),
          'auto_timeout',
          'System auto-detected missed appointment'
        );
        detectedCount++;
      } catch (err) {
        console.error(`Failed to auto-detect no-show for appointment ${appointment.id}:`, err);
      }
    }

    console.log(`Auto-detected ${detectedCount} no-shows`);
    return detectedCount;
  } catch (error) {
    console.error('Failed to auto-detect no-shows:', error);
    throw error;
  }
}

// ============================================
// CLIENT NO-SHOW METRICS
// ============================================

export async function updateClientNoShowMetrics(clientId: string): Promise<ClientNoShowMetrics> {
  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Get total no-shows
    const totalResult = await query(
      `SELECT COUNT(*) as count FROM no_shows WHERE client_id = $1 AND status = 'confirmed'`,
      [clientId]
    );

    // Get current month no-shows
    const monthResult = await query(
      `SELECT COUNT(*) as count FROM no_shows
       WHERE client_id = $1 AND status = 'confirmed'
       AND no_show_date >= $2`,
      [clientId, monthStart]
    );

    // Get last 30 days
    const thirtyDaysResult = await query(
      `SELECT COUNT(*) as count FROM no_shows
       WHERE client_id = $1 AND status = 'confirmed'
       AND no_show_date >= $2`,
      [clientId, thirtyDaysAgo]
    );

    // Get last 90 days
    const ninetyDaysResult = await query(
      `SELECT COUNT(*) as count FROM no_shows
       WHERE client_id = $1 AND status = 'confirmed'
       AND no_show_date >= $2`,
      [clientId, ninetyDaysAgo]
    );

    // Get total fees charged
    const feesResult = await query(
      `SELECT COALESCE(SUM(amount), 0) as total FROM no_show_fees
       WHERE client_id = $1 AND status IN ('charged', 'waived')`,
      [clientId]
    );

    // Get pending fees
    const pendingFeesResult = await query(
      `SELECT COALESCE(SUM(amount), 0) as total FROM no_show_fees
       WHERE client_id = $1 AND status = 'pending'`,
      [clientId]
    );

    // Get account status
    const actionResult = await query(
      `SELECT action_type FROM account_actions
       WHERE client_id = $1 AND status = 'active'
       ORDER BY created_at DESC LIMIT 1`,
      [clientId]
    );

    const totalNoShows = parseInt(totalResult.rows[0].count || 0);
    const currentMonth = parseInt(monthResult.rows[0].count || 0);
    const last30Days = parseInt(thirtyDaysResult.rows[0].count || 0);
    const last90Days = parseInt(ninetyDaysResult.rows[0].count || 0);
    const totalFeesCharged = parseFloat(feesResult.rows[0].total || 0);
    const totalFeesPending = parseFloat(pendingFeesResult.rows[0].total || 0);

    let accountStatus: 'active' | 'warned' | 'suspended' | 'terminated' = 'active';
    if (actionResult.rows.length > 0) {
      accountStatus = actionResult.rows[0].action_type;
    }

    // Get last no-show date
    const lastNoShowResult = await query(
      `SELECT no_show_date FROM no_shows WHERE client_id = $1
       ORDER BY no_show_date DESC LIMIT 1`,
      [clientId]
    );

    const lastNoShowDate = lastNoShowResult.rows.length > 0
      ? new Date(lastNoShowResult.rows[0].no_show_date)
      : undefined;

    // Upsert metrics
    const metricsResult = await query(
      `INSERT INTO client_no_show_metrics
       (client_id, total_no_shows, current_month, last_30_days, last_90_days,
        total_fees_charged, total_fees_pending, account_status, last_no_show_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (client_id) DO UPDATE SET
       total_no_shows = $2, current_month = $3, last_30_days = $4, last_90_days = $5,
       total_fees_charged = $6, total_fees_pending = $7, account_status = $8, last_no_show_date = $9
       RETURNING *`,
      [
        clientId,
        totalNoShows,
        currentMonth,
        last30Days,
        last90Days,
        totalFeesCharged,
        totalFeesPending,
        accountStatus,
        lastNoShowDate || null,
      ]
    );

    return {
      clientId,
      totalNoShows,
      currentMonth,
      last30Days,
      last90Days,
      totalFeesCharged,
      totalFeesPending,
      accountStatus,
      lastNoShowDate,
    };
  } catch (error) {
    console.error('Failed to update client no-show metrics:', error);
    throw error;
  }
}

export async function getClientNoShowMetrics(clientId: string): Promise<ClientNoShowMetrics | null> {
  try {
    const result = await query(
      `SELECT * FROM client_no_show_metrics WHERE client_id = $1`,
      [clientId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      clientId,
      totalNoShows: row.total_no_shows,
      currentMonth: row.current_month,
      last30Days: row.last_30_days,
      last90Days: row.last_90_days,
      totalFeesCharged: parseFloat(row.total_fees_charged),
      totalFeesPending: parseFloat(row.total_fees_pending),
      accountStatus: row.account_status,
      lastNoShowDate: row.last_no_show_date ? new Date(row.last_no_show_date) : undefined,
    };
  } catch (error) {
    console.error('Failed to get client no-show metrics:', error);
    throw error;
  }
}

// ============================================
// NO-SHOW FEE MANAGEMENT
// ============================================

export async function chargeNoShowFee(noShowId: string): Promise<NoShowFee> {
  try {
    // Get no-show record
    const noShowResult = await query(
      `SELECT * FROM no_shows WHERE id = $1`,
      [noShowId]
    );

    if (noShowResult.rows.length === 0) {
      throw new Error('No-show record not found');
    }

    const noShow = noShowResult.rows[0];

    if (noShow.fee <= 0) {
      // Free no-show, mark as waived
      await query(
        `UPDATE no_show_fees SET status = $1 WHERE no_show_id = $2`,
        ['waived', noShowId]
      );

      const feeResult = await query(
        `SELECT * FROM no_show_fees WHERE no_show_id = $1`,
        [noShowId]
      );

      return {
        id: feeResult.rows[0].id,
        noShowId,
        clientId: noShow.client_id,
        amount: 0,
        feeLevel: 1,
        currency: 'usd',
        status: 'waived',
        createdAt: new Date(),
      };
    }

    // Get client's Stripe customer
    const clientResult = await query(
      `SELECT stripe_customer_id FROM users WHERE id = $1`,
      [noShow.client_id]
    );

    if (clientResult.rows.length === 0) {
      throw new Error('Client not found');
    }

    const customerId = clientResult.rows[0].stripe_customer_id;

    // Create payment intent for no-show fee
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(noShow.fee * 100),
      currency: 'usd',
      customer: customerId,
      description: `No-show fee for missed appointment`,
      metadata: {
        noShowId,
        clientId: noShow.client_id,
        feeType: 'no_show_fee',
      },
      automatic_payment_methods: {
        enabled: true,
      },
    });

    // Record fee
    const feeResult = await query(
      `INSERT INTO no_show_fees
       (no_show_id, client_id, amount, fee_level, currency, charge_id, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        noShowId,
        noShow.client_id,
        noShow.fee,
        Math.min(Math.floor((noShow.total_no_shows || 0) / 1) + 1, 3),
        'usd',
        paymentIntent.id,
        'pending',
      ]
    );

    // Update no-show record
    await query(
      `UPDATE no_shows SET fee_status = $1, status = $2 WHERE id = $3`,
      ['pending', 'confirmed', noShowId]
    );

    // Log activity
    await logNoShowActivity(
      noShowId,
      'fee_charged',
      noShow.client_id,
      `No-show fee of $${noShow.fee} charged`
    );

    // Send notification
    await sendNoShowNotification(
      noShow.client_id,
      noShowId,
      'fee_charged',
      'No-Show Fee Charged',
      `A no-show fee of $${noShow.fee} has been charged to your account for the missed appointment.`
    );

    return {
      id: feeResult.rows[0].id,
      noShowId,
      clientId: noShow.client_id,
      amount: noShow.fee,
      feeLevel: Math.min(Math.floor((noShow.total_no_shows || 0) / 1) + 1, 3) as 1 | 2 | 3,
      currency: 'usd',
      chargeId: paymentIntent.id,
      status: 'pending',
      createdAt: new Date(),
    };
  } catch (error) {
    console.error('Failed to charge no-show fee:', error);
    throw error;
  }
}

export async function getNoShowFees(clientId: string, status?: string): Promise<NoShowFee[]> {
  try {
    let sql = `SELECT * FROM no_show_fees WHERE client_id = $1`;
    const params: any[] = [clientId];

    if (status) {
      sql += ` AND status = $2`;
      params.push(status);
    }

    sql += ` ORDER BY created_at DESC`;

    const result = await query(sql, params);

    return result.rows.map(row => ({
      id: row.id,
      noShowId: row.no_show_id,
      clientId,
      amount: parseFloat(row.amount),
      feeLevel: row.fee_level,
      currency: row.currency,
      chargeId: row.charge_id,
      status: row.status,
      chargedDate: row.charged_date ? new Date(row.charged_date) : undefined,
      createdAt: new Date(row.created_at),
    }));
  } catch (error) {
    console.error('Failed to get no-show fees:', error);
    throw error;
  }
}

// ============================================
// ACCOUNT ACTIONS (WARNING, SUSPENSION, TERMINATION)
// ============================================

export async function triggerAccountAction(clientId: string): Promise<AccountAction | null> {
  try {
    const metrics = await updateClientNoShowMetrics(clientId);

    if (!metrics) {
      return null;
    }

    const actionType = determineAccountAction(metrics.totalNoShows);

    if (!actionType) {
      return null;
    }

    // Check if action already exists
    const existingResult = await query(
      `SELECT * FROM account_actions
       WHERE client_id = $1 AND action_type = $2 AND status = 'active'`,
      [clientId, actionType]
    );

    if (existingResult.rows.length > 0) {
      return null; // Action already exists
    }

    const now = new Date();
    const appealWindowExpiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30-day appeal window
    let expiryDate: Date | null = null;

    if (actionType === 'suspension') {
      expiryDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30-day suspension
    }

    const actionResult = await query(
      `INSERT INTO account_actions
       (client_id, action_type, trigger_threshold, reason, status,
        effective_date, expiry_date, appeal_window_expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        clientId,
        actionType,
        metrics.totalNoShows,
        `${actionType === 'warning' ? 'Account warning' : actionType === 'suspension' ? 'Account suspension' : 'Account termination'} triggered: ${metrics.totalNoShows} no-shows`,
        'active',
        now,
        expiryDate,
        appealWindowExpiresAt,
      ]
    );

    const action = actionResult.rows[0];

    // Update metrics
    await query(
      `UPDATE client_no_show_metrics SET account_status = $1 WHERE client_id = $2`,
      [actionType, clientId]
    );

    // Log activity
    await logNoShowActivity(
      action.id,
      `account_${actionType}`,
      clientId,
      `Account ${actionType} triggered after ${metrics.totalNoShows} no-shows`
    );

    // Send notifications
    const titleMap = {
      warning: 'Account Warning',
      suspension: 'Account Suspended',
      termination: 'Account Terminated',
    };

    const messageMap = {
      warning:
        'Your account has received a warning due to multiple no-shows. Please ensure you attend your scheduled appointments in the future.',
      suspension:
        'Your account has been temporarily suspended due to excessive no-shows. You will not be able to schedule new appointments for 30 days.',
      termination:
        'Your account has been terminated due to continued no-show violations. Please contact support if you believe this action was taken in error.',
    };

    await sendNoShowNotification(
      clientId,
      undefined,
      `account_${actionType}` as any,
      titleMap[actionType],
      messageMap[actionType]
    );

    // Notify admin
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@transcend-law.com';
    await sendEmailNotification(
      adminEmail,
      `Account ${actionType} - Client ID: ${clientId}`,
      `Client account has been ${actionType}. Total no-shows: ${metrics.totalNoShows}`
    );

    return {
      id: action.id,
      clientId,
      actionType,
      triggerThreshold: metrics.totalNoShows,
      reason: action.reason,
      status: 'active',
      effectiveDate: new Date(action.effective_date),
      expiryDate: action.expiry_date ? new Date(action.expiry_date) : undefined,
      appealWindowExpiresAt: new Date(action.appeal_window_expires_at),
      createdAt: new Date(action.created_at),
      updatedAt: new Date(action.updated_at),
    };
  } catch (error) {
    console.error('Failed to trigger account action:', error);
    throw error;
  }
}

export async function getAccountActions(clientId: string): Promise<AccountAction[]> {
  try {
    const result = await query(
      `SELECT * FROM account_actions WHERE client_id = $1
       ORDER BY created_at DESC`,
      [clientId]
    );

    return result.rows.map(row => ({
      id: row.id,
      clientId,
      actionType: row.action_type,
      triggerThreshold: row.trigger_threshold,
      reason: row.reason,
      status: row.status,
      effectiveDate: new Date(row.effective_date),
      expiryDate: row.expiry_date ? new Date(row.expiry_date) : undefined,
      appealWindowExpiresAt: new Date(row.appeal_window_expires_at),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    }));
  } catch (error) {
    console.error('Failed to get account actions:', error);
    throw error;
  }
}

// ============================================
// APPEAL PROCESS
// ============================================

export async function submitNoShowAppeal(
  noShowId: string,
  clientId: string,
  reason: string,
  supportingDocuments: string[] = []
): Promise<NoShowAppeal> {
  try {
    const result = await query(
      `INSERT INTO no_show_appeals
       (no_show_id, client_id, reason, supporting_documents, status, submitted_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       RETURNING *`,
      [noShowId, clientId, reason, JSON.stringify(supportingDocuments), 'submitted']
    );

    const appeal = result.rows[0];

    // Log activity
    await logNoShowActivity(
      noShowId,
      'appeal_submitted',
      clientId,
      `No-show appeal submitted: ${reason}`
    );

    // Notify admin
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@transcend-law.com';
    await sendEmailNotification(
      adminEmail,
      'No-Show Appeal Submitted',
      `Client ${clientId} has submitted an appeal for no-show ${noShowId}. Reason: ${reason}`
    );

    // Send confirmation to client
    await sendNoShowNotification(
      clientId,
      noShowId,
      'appeal_submitted' as any,
      'Appeal Submitted',
      'We have received your appeal for the no-show. Our team will review it within 5 business days.'
    );

    return {
      id: appeal.id,
      noShowId,
      clientId,
      reason,
      supportingDocuments,
      status: 'submitted',
      submittedAt: new Date(),
      createdAt: new Date(appeal.created_at),
    };
  } catch (error) {
    console.error('Failed to submit no-show appeal:', error);
    throw error;
  }
}

export async function reviewNoShowAppeal(
  appealId: string,
  approved: boolean,
  reviewedBy: string,
  resolutionNotes: string
): Promise<NoShowAppeal> {
  try {
    // Get appeal
    const appealResult = await query(
      `SELECT * FROM no_show_appeals WHERE id = $1`,
      [appealId]
    );

    if (appealResult.rows.length === 0) {
      throw new Error('Appeal not found');
    }

    const appeal = appealResult.rows[0];

    const status = approved ? 'approved' : 'denied';

    // Update appeal
    const result = await query(
      `UPDATE no_show_appeals
       SET status = $1, reviewed_by = $2, resolution_notes = $3, reviewed_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [status, reviewedBy, resolutionNotes, appealId]
    );

    const updatedAppeal = result.rows[0];

    if (approved) {
      // Mark no-show as disputed/waived
      await query(
        `UPDATE no_shows SET status = $1, fee_status = $2 WHERE id = $3`,
        ['disputed', 'waived', appeal.no_show_id]
      );

      // Process refund if fee was charged
      const feeResult = await query(
        `SELECT * FROM no_show_fees WHERE no_show_id = $1 AND status = 'charged'`,
        [appeal.no_show_id]
      );

      if (feeResult.rows.length > 0) {
        await issueRefund(appeal.no_show_id, appeal.client_id, 'Appeal approved', feeResult.rows[0].amount);
      }

      // Log activity
      await logNoShowActivity(
        appeal.no_show_id,
        'appeal_approved',
        reviewedBy,
        `Appeal approved: ${resolutionNotes}`
      );

      // Send notification to client
      await sendNoShowNotification(
        appeal.client_id,
        appeal.no_show_id,
        'appeal_approved',
        'Appeal Approved',
        'Your appeal has been approved. Any fees have been waived and removed from your account.'
      );
    } else {
      // Log activity
      await logNoShowActivity(
        appeal.no_show_id,
        'appeal_denied',
        reviewedBy,
        `Appeal denied: ${resolutionNotes}`
      );

      // Send notification to client
      await sendNoShowNotification(
        appeal.client_id,
        appeal.no_show_id,
        'appeal_denied',
        'Appeal Denied',
        `Your appeal has been reviewed and denied. Reason: ${resolutionNotes}`
      );
    }

    return {
      id: updatedAppeal.id,
      noShowId: appeal.no_show_id,
      clientId: appeal.client_id,
      reason: appeal.reason,
      supportingDocuments: JSON.parse(appeal.supporting_documents || '[]'),
      status,
      reviewedBy,
      resolutionNotes,
      submittedAt: new Date(appeal.submitted_at),
      reviewedAt: new Date(),
      createdAt: new Date(appeal.created_at),
    };
  } catch (error) {
    console.error('Failed to review no-show appeal:', error);
    throw error;
  }
}

export async function getNoShowAppeals(clientId: string, status?: string): Promise<NoShowAppeal[]> {
  try {
    let sql = `SELECT * FROM no_show_appeals WHERE client_id = $1`;
    const params: any[] = [clientId];

    if (status) {
      sql += ` AND status = $2`;
      params.push(status);
    }

    sql += ` ORDER BY submitted_at DESC`;

    const result = await query(sql, params);

    return result.rows.map(row => ({
      id: row.id,
      noShowId: row.no_show_id,
      clientId,
      reason: row.reason,
      supportingDocuments: JSON.parse(row.supporting_documents || '[]'),
      status: row.status,
      reviewedBy: row.reviewed_by,
      resolutionNotes: row.resolution_notes,
      submittedAt: new Date(row.submitted_at),
      reviewedAt: row.reviewed_at ? new Date(row.reviewed_at) : undefined,
      createdAt: new Date(row.created_at),
    }));
  } catch (error) {
    console.error('Failed to get no-show appeals:', error);
    throw error;
  }
}

// ============================================
// REFUND MANAGEMENT
// ============================================

export async function issueRefund(
  noShowId: string,
  clientId: string,
  refundReason: string,
  refundAmount: number
): Promise<NoShowRefundPolicy> {
  try {
    // Get no-show and fee info
    const noShowResult = await query(
      `SELECT * FROM no_shows WHERE id = $1`,
      [noShowId]
    );

    if (noShowResult.rows.length === 0) {
      throw new Error('No-show not found');
    }

    const noShow = noShowResult.rows[0];

    // Create refund record
    const refundResult = await query(
      `INSERT INTO no_show_refund_policies
       (no_show_id, client_id, original_fee, refund_amount, refund_reason, refund_status)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [noShowId, clientId, noShow.fee, refundAmount, refundReason, 'pending']
    );

    const refund = refundResult.rows[0];

    // Update fee status
    await query(
      `UPDATE no_show_fees SET status = $1 WHERE no_show_id = $2`,
      ['refunded', noShowId]
    );

    // Get client's Stripe customer
    const clientResult = await query(
      `SELECT stripe_customer_id FROM users WHERE id = $1`,
      [clientId]
    );

    let transactionId: string | null = null;

    if (clientResult.rows.length > 0) {
      try {
        // Try to refund via Stripe if there's a charge
        const feeResult = await query(
          `SELECT charge_id FROM no_show_fees WHERE no_show_id = $1`,
          [noShowId]
        );

        if (feeResult.rows.length > 0 && feeResult.rows[0].charge_id) {
          const stripeRefund = await stripe.refunds.create({
            amount: Math.round(refundAmount * 100),
            payment_intent: feeResult.rows[0].charge_id,
            metadata: {
              noShowId,
              reason: refundReason,
            },
          });
          transactionId = stripeRefund.id;
        }
      } catch (err) {
        console.error('Failed to process Stripe refund:', err);
      }
    }

    // Update refund record
    await query(
      `UPDATE no_show_refund_policies
       SET refund_status = $1, processed_date = NOW(), refund_transaction_id = $2
       WHERE id = $3`,
      ['processed', transactionId, refund.id]
    );

    // Log activity
    await logNoShowActivity(
      noShowId,
      'refund_issued',
      clientId,
      `Refund of $${refundAmount} issued. Reason: ${refundReason}`
    );

    // Send notification
    await sendNoShowNotification(
      clientId,
      noShowId,
      'refund_issued' as any,
      'Refund Issued',
      `A refund of $${refundAmount} has been processed and will appear in your account within 3-5 business days.`
    );

    return {
      id: refund.id,
      noShowId,
      clientId,
      originalFee: parseFloat(noShow.fee),
      refundAmount,
      refundReason,
      refundStatus: 'processed',
      processedDate: new Date(),
      refundTransactionId: transactionId || undefined,
      createdAt: new Date(refund.created_at),
    };
  } catch (error) {
    console.error('Failed to issue refund:', error);
    throw error;
  }
}

export async function getRefundPolicies(clientId: string): Promise<NoShowRefundPolicy[]> {
  try {
    const result = await query(
      `SELECT * FROM no_show_refund_policies WHERE client_id = $1
       ORDER BY created_at DESC`,
      [clientId]
    );

    return result.rows.map(row => ({
      id: row.id,
      noShowId: row.no_show_id,
      clientId,
      originalFee: parseFloat(row.original_fee),
      refundAmount: parseFloat(row.refund_amount),
      refundReason: row.refund_reason,
      refundStatus: row.refund_status,
      processedDate: row.processed_date ? new Date(row.processed_date) : undefined,
      refundTransactionId: row.refund_transaction_id,
      createdAt: new Date(row.created_at),
    }));
  } catch (error) {
    console.error('Failed to get refund policies:', error);
    throw error;
  }
}

// ============================================
// NOTIFICATIONS
// ============================================

export async function sendNoShowNotification(
  clientId: string,
  noShowId: string | undefined,
  notificationType: string,
  title: string,
  message: string
): Promise<void> {
  try {
    // Save notification to database
    await query(
      `INSERT INTO no_show_notifications
       (client_id, no_show_id, notification_type, title, message, is_read)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [clientId, noShowId || null, notificationType, title, message, false]
    );

    // Send email
    const clientResult = await query(`SELECT email FROM users WHERE id = $1`, [clientId]);

    if (clientResult.rows.length > 0) {
      await sendEmailNotification(clientResult.rows[0].email, title, message);
    }
  } catch (error) {
    console.error('Failed to send no-show notification:', error);
  }
}

export async function sendProviderNotification(
  providerId: string,
  clientId: string,
  subject: string,
  message: string
): Promise<void> {
  try {
    const providerResult = await query(`SELECT email FROM users WHERE id = $1`, [providerId]);

    if (providerResult.rows.length > 0) {
      await sendEmailNotification(providerResult.rows[0].email, subject, message);
    }
  } catch (error) {
    console.error('Failed to send provider notification:', error);
  }
}

export async function getClientNotifications(clientId: string, unreadOnly: boolean = false): Promise<NoShowNotification[]> {
  try {
    let sql = `SELECT * FROM no_show_notifications WHERE client_id = $1`;
    const params: any[] = [clientId];

    if (unreadOnly) {
      sql += ` AND is_read = FALSE`;
    }

    sql += ` ORDER BY created_at DESC LIMIT 50`;

    const result = await query(sql, params);

    return result.rows.map(row => ({
      id: row.id,
      clientId,
      noShowId: row.no_show_id,
      accountActionId: row.account_action_id,
      notificationType: row.notification_type,
      title: row.title,
      message: row.message,
      isRead: row.is_read,
      createdAt: new Date(row.created_at),
    }));
  } catch (error) {
    console.error('Failed to get client notifications:', error);
    throw error;
  }
}

export async function markNotificationAsRead(notificationId: string): Promise<void> {
  try {
    await query(
      `UPDATE no_show_notifications SET is_read = TRUE WHERE id = $1`,
      [notificationId]
    );
  } catch (error) {
    console.error('Failed to mark notification as read:', error);
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

async function logNoShowActivity(
  noShowId: string,
  action: string,
  userId: string,
  description: string
): Promise<void> {
  try {
    await query(
      `INSERT INTO no_show_audit_log (no_show_id, action, user_id, description)
       VALUES ($1, $2, $3, $4)`,
      [noShowId, action, userId, description]
    );
  } catch (error) {
    console.error('Failed to log no-show activity:', error);
  }
}

// ============================================
// BATCH OPERATIONS
// ============================================

export async function processMonthlyNoShowBatch(): Promise<{ noShowsProcessed: number; feesCharged: number; actionsTriggered: number }> {
  try {
    let noShowsProcessed = 0;
    let feesCharged = 0;
    let actionsTriggered = 0;

    // Get all pending no-shows
    const result = await query(
      `SELECT DISTINCT client_id FROM no_shows WHERE status = 'pending_review'`,
      []
    );

    for (const row of result.rows) {
      try {
        // Update metrics for this client
        await updateClientNoShowMetrics(row.client_id);

        // Get pending no-shows for this client
        const clientNoShowsResult = await query(
          `SELECT id FROM no_shows WHERE client_id = $1 AND status = 'pending_review'`,
          [row.client_id]
        );

        for (const noShowRow of clientNoShowsResult.rows) {
          try {
            // Charge fee
            await chargeNoShowFee(noShowRow.id);
            feesCharged++;
            noShowsProcessed++;
          } catch (err) {
            console.error(`Failed to charge fee for no-show ${noShowRow.id}:`, err);
          }
        }

        // Check if account action should be triggered
        const action = await triggerAccountAction(row.client_id);
        if (action) {
          actionsTriggered++;
        }
      } catch (err) {
        console.error(`Failed to process no-shows for client ${row.client_id}:`, err);
      }
    }

    return { noShowsProcessed, feesCharged, actionsTriggered };
  } catch (error) {
    console.error('Failed to process monthly no-show batch:', error);
    throw error;
  }
}

export default {
  recordNoShow,
  autoDetectNoShows,
  updateClientNoShowMetrics,
  getClientNoShowMetrics,
  chargeNoShowFee,
  getNoShowFees,
  triggerAccountAction,
  getAccountActions,
  submitNoShowAppeal,
  reviewNoShowAppeal,
  getNoShowAppeals,
  issueRefund,
  getRefundPolicies,
  sendNoShowNotification,
  getClientNotifications,
  markNotificationAsRead,
  processMonthlyNoShowBatch,
  calculateNoShowFee,
  determineAccountAction,
};
