// Retainer Agreement Lifecycle Service
// Manages retainer deposits, billable hours, refunds, client statements, and tax reporting

import Stripe from 'stripe';
import { query } from '../database/connection';
import { sendEmailNotification } from './emailService';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16',
});

// ============================================
// TYPES & INTERFACES
// ============================================

export interface RetainerAgreement {
  id: string;
  clientId: string;
  providerId: string;
  amount: number;
  hourlyRate: number;
  currency: string;
  startDate: Date;
  endDate?: Date;
  status: 'active' | 'partially_used' | 'depleted' | 'closed' | 'cancelled';
  termsAndConditions: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface RetainerDeposit {
  id: string;
  retainerId: string;
  clientId: string;
  amount: number;
  currency: string;
  paymentIntentId: string;
  depositDate: Date;
  description: string;
  createdAt: Date;
}

export interface BillableEntry {
  id: string;
  retainerId: string;
  clientId: string;
  providerId: string;
  hours: number;
  hourlyRate: number;
  amount: number;
  description: string;
  entryDate: Date;
  billableStatus: 'pending' | 'approved' | 'billed' | 'disputed';
  createdAt: Date;
  approvedAt?: Date;
}

export interface RetainerBalance {
  retainerId: string;
  totalDeposited: number;
  totalEarned: number;
  totalBilled: number;
  availableBalance: number;
  totalRefunded: number;
  pendingHours: number;
  approvedHours: number;
}

export interface ClientStatement {
  id: string;
  retainerId: string;
  clientId: string;
  providerId: string;
  startDate: Date;
  endDate: Date;
  totalDeposits: number;
  totalEarned: number;
  totalBilled: number;
  totalRefunded: number;
  balanceRemaining: number;
  billableEntries: BillableEntry[];
  generatedAt: Date;
  status: 'draft' | 'sent' | 'acknowledged';
}

export interface RefundRequest {
  id: string;
  retainerId: string;
  clientId: string;
  amount: number;
  reason: string;
  status: 'requested' | 'approved' | 'denied' | 'processed';
  requestDate: Date;
  processedDate?: Date;
  refundTransactionId?: string;
}

export interface Dispute {
  id: string;
  retainerId: string;
  clientId: string;
  providerId: string;
  amount: number;
  description: string;
  status: 'open' | 'investigating' | 'resolved' | 'closed';
  resolution?: string;
  createdAt: Date;
  resolvedAt?: Date;
}

export interface TaxReportingEntry {
  id: string;
  retainerId: string;
  providerId: string;
  taxYear: number;
  totalEarned: number;
  totalBilled: number;
  totalRefunded: number;
  discountedAmount: number;
  netRevenue: number;
  generatedAt: Date;
}

// ============================================
// RETAINER CREATION & MANAGEMENT
// ============================================

export async function createRetainerAgreement(
  clientId: string,
  providerId: string,
  amount: number,
  hourlyRate: number,
  termsAndConditions: string,
  endDate?: Date
): Promise<RetainerAgreement> {
  try {
    // Validate inputs
    if (amount <= 0 || hourlyRate <= 0) {
      throw new Error('Amount and hourly rate must be greater than 0');
    }

    // Insert retainer agreement
    const result = await query(
      `INSERT INTO retainer_agreements
       (client_id, provider_id, amount, hourly_rate, currency, status, terms_and_conditions, end_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [clientId, providerId, amount, hourlyRate, 'usd', 'active', termsAndConditions, endDate || null]
    );

    // Log activity
    await logRetainerActivity(
      result.rows[0].id,
      'retainer_created',
      clientId,
      `Retainer agreement created: $${amount} at $${hourlyRate}/hour`
    );

    // Send notifications
    await sendRetainerNotification(
      clientId,
      providerId,
      'Retainer Agreement Created',
      `A new retainer agreement has been established for $${amount}`
    );

    return {
      id: result.rows[0].id,
      clientId,
      providerId,
      amount,
      hourlyRate,
      currency: 'usd',
      startDate: new Date(result.rows[0].created_at),
      endDate: endDate,
      status: 'active',
      termsAndConditions,
      createdAt: new Date(result.rows[0].created_at),
      updatedAt: new Date(result.rows[0].updated_at),
    };
  } catch (error) {
    console.error('Failed to create retainer agreement:', error);
    throw error;
  }
}

export async function getRetainerAgreement(retainerId: string): Promise<RetainerAgreement | null> {
  try {
    const result = await query(
      `SELECT * FROM retainer_agreements WHERE id = $1`,
      [retainerId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      clientId: row.client_id,
      providerId: row.provider_id,
      amount: parseFloat(row.amount),
      hourlyRate: parseFloat(row.hourly_rate),
      currency: row.currency,
      startDate: new Date(row.created_at),
      endDate: row.end_date ? new Date(row.end_date) : undefined,
      status: row.status,
      termsAndConditions: row.terms_and_conditions,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  } catch (error) {
    console.error('Failed to get retainer agreement:', error);
    throw error;
  }
}

export async function getRetainersByClient(clientId: string): Promise<RetainerAgreement[]> {
  try {
    const result = await query(
      `SELECT * FROM retainer_agreements WHERE client_id = $1 ORDER BY created_at DESC`,
      [clientId]
    );

    return result.rows.map(row => ({
      id: row.id,
      clientId: row.client_id,
      providerId: row.provider_id,
      amount: parseFloat(row.amount),
      hourlyRate: parseFloat(row.hourly_rate),
      currency: row.currency,
      startDate: new Date(row.created_at),
      endDate: row.end_date ? new Date(row.end_date) : undefined,
      status: row.status,
      termsAndConditions: row.terms_and_conditions,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    }));
  } catch (error) {
    console.error('Failed to get retainers by client:', error);
    throw error;
  }
}

export async function getRetainersByProvider(providerId: string): Promise<RetainerAgreement[]> {
  try {
    const result = await query(
      `SELECT * FROM retainer_agreements WHERE provider_id = $1 ORDER BY created_at DESC`,
      [providerId]
    );

    return result.rows.map(row => ({
      id: row.id,
      clientId: row.client_id,
      providerId: row.provider_id,
      amount: parseFloat(row.amount),
      hourlyRate: parseFloat(row.hourly_rate),
      currency: row.currency,
      startDate: new Date(row.created_at),
      endDate: row.end_date ? new Date(row.end_date) : undefined,
      status: row.status,
      termsAndConditions: row.terms_and_conditions,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    }));
  } catch (error) {
    console.error('Failed to get retainers by provider:', error);
    throw error;
  }
}

// ============================================
// RETAINER DEPOSITS
// ============================================

export async function depositRetainerFunds(
  retainerId: string,
  clientId: string,
  amount: number,
  description: string
): Promise<RetainerDeposit> {
  try {
    if (amount <= 0) {
      throw new Error('Deposit amount must be greater than 0');
    }

    // Get retainer agreement
    const retainerResult = await query(
      `SELECT * FROM retainer_agreements WHERE id = $1`,
      [retainerId]
    );

    if (retainerResult.rows.length === 0) {
      throw new Error('Retainer agreement not found');
    }

    // Get client's Stripe customer ID
    const clientResult = await query(
      `SELECT stripe_customer_id FROM users WHERE id = $1`,
      [clientId]
    );

    if (clientResult.rows.length === 0) {
      throw new Error('Client not found');
    }

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency: 'usd',
      customer: clientResult.rows[0].stripe_customer_id,
      description: `Retainer deposit: ${description}`,
      metadata: {
        retainerId,
        clientId,
        depositType: 'retainer_deposit',
      },
      automatic_payment_methods: {
        enabled: true,
      },
    });

    // Record deposit
    const result = await query(
      `INSERT INTO retainer_deposits
       (retainer_id, client_id, amount, currency, payment_intent_id, description)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [retainerId, clientId, amount, 'usd', paymentIntent.id, description]
    );

    // Update retainer status if needed
    await updateRetainerStatus(retainerId);

    // Log activity
    await logRetainerActivity(
      retainerId,
      'deposit_created',
      clientId,
      `Deposit of $${amount} made to retainer`
    );

    return {
      id: result.rows[0].id,
      retainerId,
      clientId,
      amount,
      currency: 'usd',
      paymentIntentId: paymentIntent.id,
      depositDate: new Date(),
      description,
      createdAt: new Date(result.rows[0].created_at),
    };
  } catch (error) {
    console.error('Failed to deposit retainer funds:', error);
    throw error;
  }
}

export async function getRetainerDeposits(retainerId: string): Promise<RetainerDeposit[]> {
  try {
    const result = await query(
      `SELECT * FROM retainer_deposits WHERE retainer_id = $1 ORDER BY created_at DESC`,
      [retainerId]
    );

    return result.rows.map(row => ({
      id: row.id,
      retainerId: row.retainer_id,
      clientId: row.client_id,
      amount: parseFloat(row.amount),
      currency: row.currency,
      paymentIntentId: row.payment_intent_id,
      depositDate: new Date(row.deposit_date),
      description: row.description,
      createdAt: new Date(row.created_at),
    }));
  } catch (error) {
    console.error('Failed to get retainer deposits:', error);
    throw error;
  }
}

// ============================================
// BILLABLE ENTRIES & TIME TRACKING
// ============================================

export async function addBillableEntry(
  retainerId: string,
  clientId: string,
  providerId: string,
  hours: number,
  hourlyRate: number,
  description: string,
  entryDate: Date = new Date()
): Promise<BillableEntry> {
  try {
    if (hours <= 0) {
      throw new Error('Hours must be greater than 0');
    }

    const amount = hours * hourlyRate;

    const result = await query(
      `INSERT INTO billable_entries
       (retainer_id, client_id, provider_id, hours, hourly_rate, amount, description, entry_date, billable_status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [retainerId, clientId, providerId, hours, hourlyRate, amount, description, entryDate, 'pending']
    );

    // Log activity
    await logRetainerActivity(
      retainerId,
      'billable_entry_added',
      providerId,
      `Billable entry: ${hours} hours at $${hourlyRate}/hour`
    );

    return {
      id: result.rows[0].id,
      retainerId,
      clientId,
      providerId,
      hours,
      hourlyRate,
      amount,
      description,
      entryDate,
      billableStatus: 'pending',
      createdAt: new Date(result.rows[0].created_at),
    };
  } catch (error) {
    console.error('Failed to add billable entry:', error);
    throw error;
  }
}

export async function approveBillableEntry(
  entryId: string,
  approvedBy: string
): Promise<BillableEntry> {
  try {
    const result = await query(
      `UPDATE billable_entries
       SET billable_status = $1, approved_at = NOW(), approved_by = $2
       WHERE id = $3
       RETURNING *`,
      ['approved', approvedBy, entryId]
    );

    if (result.rows.length === 0) {
      throw new Error('Billable entry not found');
    }

    const entry = result.rows[0];

    // Log activity
    await logRetainerActivity(
      entry.retainer_id,
      'billable_entry_approved',
      approvedBy,
      `Billable entry approved: ${entry.hours} hours`
    );

    return {
      id: entry.id,
      retainerId: entry.retainer_id,
      clientId: entry.client_id,
      providerId: entry.provider_id,
      hours: parseFloat(entry.hours),
      hourlyRate: parseFloat(entry.hourly_rate),
      amount: parseFloat(entry.amount),
      description: entry.description,
      entryDate: new Date(entry.entry_date),
      billableStatus: 'approved',
      createdAt: new Date(entry.created_at),
      approvedAt: new Date(),
    };
  } catch (error) {
    console.error('Failed to approve billable entry:', error);
    throw error;
  }
}

export async function getBillableEntries(
  retainerId: string,
  status?: string
): Promise<BillableEntry[]> {
  try {
    let sql = `SELECT * FROM billable_entries WHERE retainer_id = $1`;
    const params: any[] = [retainerId];

    if (status) {
      sql += ` AND billable_status = $2`;
      params.push(status);
    }

    sql += ` ORDER BY entry_date DESC`;

    const result = await query(sql, params);

    return result.rows.map(row => ({
      id: row.id,
      retainerId: row.retainer_id,
      clientId: row.client_id,
      providerId: row.provider_id,
      hours: parseFloat(row.hours),
      hourlyRate: parseFloat(row.hourly_rate),
      amount: parseFloat(row.amount),
      description: row.description,
      entryDate: new Date(row.entry_date),
      billableStatus: row.billable_status,
      createdAt: new Date(row.created_at),
      approvedAt: row.approved_at ? new Date(row.approved_at) : undefined,
    }));
  } catch (error) {
    console.error('Failed to get billable entries:', error);
    throw error;
  }
}

// ============================================
// RETAINER BALANCE CALCULATION
// ============================================

export async function getRetainerBalance(retainerId: string): Promise<RetainerBalance> {
  try {
    // Get all deposits
    const depositsResult = await query(
      `SELECT COALESCE(SUM(amount), 0) as total FROM retainer_deposits WHERE retainer_id = $1`,
      [retainerId]
    );

    // Get all approved billable entries
    const billedResult = await query(
      `SELECT COALESCE(SUM(amount), 0) as total FROM billable_entries
       WHERE retainer_id = $1 AND billable_status IN ('approved', 'billed')`,
      [retainerId]
    );

    // Get all refunded amounts
    const refundedResult = await query(
      `SELECT COALESCE(SUM(amount), 0) as total FROM refund_requests
       WHERE retainer_id = $1 AND status = 'processed'`,
      [retainerId]
    );

    // Get pending hours
    const pendingHoursResult = await query(
      `SELECT COALESCE(SUM(hours), 0) as total FROM billable_entries
       WHERE retainer_id = $1 AND billable_status = 'pending'`,
      [retainerId]
    );

    // Get approved hours
    const approvedHoursResult = await query(
      `SELECT COALESCE(SUM(hours), 0) as total FROM billable_entries
       WHERE retainer_id = $1 AND billable_status = 'approved'`,
      [retainerId]
    );

    const totalDeposited = parseFloat(depositsResult.rows[0].total);
    const totalBilled = parseFloat(billedResult.rows[0].total);
    const totalRefunded = parseFloat(refundedResult.rows[0].total);
    const pendingHours = parseFloat(pendingHoursResult.rows[0].total);
    const approvedHours = parseFloat(approvedHoursResult.rows[0].total);

    return {
      retainerId,
      totalDeposited,
      totalEarned: totalBilled,
      totalBilled,
      availableBalance: totalDeposited - totalBilled - totalRefunded,
      totalRefunded,
      pendingHours,
      approvedHours,
    };
  } catch (error) {
    console.error('Failed to get retainer balance:', error);
    throw error;
  }
}

// ============================================
// REFUND LOGIC
// ============================================

export async function requestRefund(
  retainerId: string,
  clientId: string,
  amount: number,
  reason: string
): Promise<RefundRequest> {
  try {
    if (amount <= 0) {
      throw new Error('Refund amount must be greater than 0');
    }

    // Verify balance is sufficient
    const balance = await getRetainerBalance(retainerId);
    if (amount > balance.availableBalance) {
      throw new Error(`Insufficient balance. Available: $${balance.availableBalance}`);
    }

    const result = await query(
      `INSERT INTO refund_requests
       (retainer_id, client_id, amount, reason, status)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [retainerId, clientId, amount, reason, 'requested']
    );

    // Log activity
    await logRetainerActivity(
      retainerId,
      'refund_requested',
      clientId,
      `Refund requested: $${amount}. Reason: ${reason}`
    );

    // Send notification to admin
    await sendRefundNotification(retainerId, amount, reason, 'requested');

    return {
      id: result.rows[0].id,
      retainerId,
      clientId,
      amount,
      reason,
      status: 'requested',
      requestDate: new Date(result.rows[0].created_at),
    };
  } catch (error) {
    console.error('Failed to request refund:', error);
    throw error;
  }
}

export async function approveRefund(
  refundRequestId: string,
  approvedBy: string
): Promise<RefundRequest> {
  try {
    const result = await query(
      `UPDATE refund_requests
       SET status = $1, approved_by = $2
       WHERE id = $3
       RETURNING *`,
      ['approved', approvedBy, refundRequestId]
    );

    if (result.rows.length === 0) {
      throw new Error('Refund request not found');
    }

    const refund = result.rows[0];

    // Log activity
    await logRetainerActivity(
      refund.retainer_id,
      'refund_approved',
      approvedBy,
      `Refund approved: $${refund.amount}`
    );

    return {
      id: refund.id,
      retainerId: refund.retainer_id,
      clientId: refund.client_id,
      amount: parseFloat(refund.amount),
      reason: refund.reason,
      status: 'approved',
      requestDate: new Date(refund.created_at),
    };
  } catch (error) {
    console.error('Failed to approve refund:', error);
    throw error;
  }
}

export async function processRefund(
  refundRequestId: string,
  processedBy: string
): Promise<RefundRequest> {
  try {
    // Get refund request
    const refundResult = await query(
      `SELECT * FROM refund_requests WHERE id = $1`,
      [refundRequestId]
    );

    if (refundResult.rows.length === 0) {
      throw new Error('Refund request not found');
    }

    const refund = refundResult.rows[0];

    if (refund.status !== 'approved') {
      throw new Error('Refund must be approved before processing');
    }

    // Get client's Stripe customer
    const clientResult = await query(
      `SELECT stripe_customer_id FROM users WHERE id = $1`,
      [refund.client_id]
    );

    if (clientResult.rows.length === 0) {
      throw new Error('Client not found');
    }

    // Get latest deposit payment intent
    const depositResult = await query(
      `SELECT payment_intent_id FROM retainer_deposits
       WHERE retainer_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [refund.retainer_id]
    );

    let transactionId = null;
    if (depositResult.rows.length > 0) {
      const paymentIntent = await stripe.paymentIntents.retrieve(depositResult.rows[0].payment_intent_id);

      if (paymentIntent.charges.data.length > 0) {
        const stripeRefund = await stripe.refunds.create({
          charge: paymentIntent.charges.data[0].id,
          amount: Math.round(refund.amount * 100),
          metadata: {
            refundRequestId,
            reason: refund.reason,
          },
        });
        transactionId = stripeRefund.id;
      }
    }

    // Update refund request
    const result = await query(
      `UPDATE refund_requests
       SET status = $1, processed_date = NOW(), refund_transaction_id = $2
       WHERE id = $3
       RETURNING *`,
      ['processed', transactionId, refundRequestId]
    );

    // Log activity
    await logRetainerActivity(
      refund.retainer_id,
      'refund_processed',
      processedBy,
      `Refund processed: $${refund.amount}. Transaction ID: ${transactionId}`
    );

    // Send notification
    await sendRefundNotification(refund.retainer_id, refund.amount, refund.reason, 'processed');

    return {
      id: result.rows[0].id,
      retainerId: refund.retainer_id,
      clientId: refund.client_id,
      amount: parseFloat(refund.amount),
      reason: refund.reason,
      status: 'processed',
      requestDate: new Date(refund.created_at),
      processedDate: new Date(),
      refundTransactionId: transactionId || undefined,
    };
  } catch (error) {
    console.error('Failed to process refund:', error);
    throw error;
  }
}

export async function denyRefund(
  refundRequestId: string,
  reason: string,
  deniedBy: string
): Promise<RefundRequest> {
  try {
    const result = await query(
      `UPDATE refund_requests
       SET status = $1, denial_reason = $2, denied_by = $3
       WHERE id = $4
       RETURNING *`,
      ['denied', reason, deniedBy, refundRequestId]
    );

    if (result.rows.length === 0) {
      throw new Error('Refund request not found');
    }

    const refund = result.rows[0];

    // Log activity
    await logRetainerActivity(
      refund.retainer_id,
      'refund_denied',
      deniedBy,
      `Refund denied: $${refund.amount}. Reason: ${reason}`
    );

    return {
      id: refund.id,
      retainerId: refund.retainer_id,
      clientId: refund.client_id,
      amount: parseFloat(refund.amount),
      reason: refund.reason,
      status: 'denied',
      requestDate: new Date(refund.created_at),
    };
  } catch (error) {
    console.error('Failed to deny refund:', error);
    throw error;
  }
}

// ============================================
// CLIENT STATEMENTS
// ============================================

export async function generateClientStatement(
  retainerId: string,
  startDate: Date,
  endDate: Date
): Promise<ClientStatement> {
  try {
    // Get retainer details
    const retainerResult = await query(
      `SELECT * FROM retainer_agreements WHERE id = $1`,
      [retainerId]
    );

    if (retainerResult.rows.length === 0) {
      throw new Error('Retainer not found');
    }

    const retainer = retainerResult.rows[0];

    // Get deposits in date range
    const depositsResult = await query(
      `SELECT COALESCE(SUM(amount), 0) as total FROM retainer_deposits
       WHERE retainer_id = $1 AND created_at BETWEEN $2 AND $3`,
      [retainerId, startDate, endDate]
    );

    // Get billable entries in date range
    const billedResult = await query(
      `SELECT COALESCE(SUM(amount), 0) as total FROM billable_entries
       WHERE retainer_id = $1 AND entry_date BETWEEN $2 AND $3 AND billable_status IN ('approved', 'billed')`,
      [retainerId, startDate, endDate]
    );

    // Get refunds in date range
    const refundedResult = await query(
      `SELECT COALESCE(SUM(amount), 0) as total FROM refund_requests
       WHERE retainer_id = $1 AND processed_date BETWEEN $2 AND $3 AND status = 'processed'`,
      [retainerId, startDate, endDate]
    );

    // Get all billable entries for detail
    const entriesResult = await query(
      `SELECT * FROM billable_entries
       WHERE retainer_id = $1 AND entry_date BETWEEN $2 AND $3
       ORDER BY entry_date ASC`,
      [retainerId, startDate, endDate]
    );

    const totalDeposits = parseFloat(depositsResult.rows[0].total);
    const totalBilled = parseFloat(billedResult.rows[0].total);
    const totalRefunded = parseFloat(refundedResult.rows[0].total);
    const balanceRemaining = totalDeposits - totalBilled - totalRefunded;

    const billableEntries = entriesResult.rows.map(row => ({
      id: row.id,
      retainerId: row.retainer_id,
      clientId: row.client_id,
      providerId: row.provider_id,
      hours: parseFloat(row.hours),
      hourlyRate: parseFloat(row.hourly_rate),
      amount: parseFloat(row.amount),
      description: row.description,
      entryDate: new Date(row.entry_date),
      billableStatus: row.billable_status,
      createdAt: new Date(row.created_at),
    }));

    // Create statement record
    const statementResult = await query(
      `INSERT INTO client_statements
       (retainer_id, client_id, provider_id, start_date, end_date,
        total_deposits, total_billed, total_refunded, balance_remaining, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        retainerId,
        retainer.client_id,
        retainer.provider_id,
        startDate,
        endDate,
        totalDeposits,
        totalBilled,
        totalRefunded,
        balanceRemaining,
        'sent',
      ]
    );

    // Log activity
    await logRetainerActivity(
      retainerId,
      'statement_generated',
      retainer.provider_id,
      `Client statement generated for period ${startDate.toISOString()} to ${endDate.toISOString()}`
    );

    // Send statement to client
    await sendClientStatement(retainer.client_id, statementResult.rows[0].id);

    return {
      id: statementResult.rows[0].id,
      retainerId,
      clientId: retainer.client_id,
      providerId: retainer.provider_id,
      startDate,
      endDate,
      totalDeposits,
      totalEarned: totalBilled,
      totalBilled,
      totalRefunded,
      balanceRemaining,
      billableEntries,
      generatedAt: new Date(),
      status: 'sent',
    };
  } catch (error) {
    console.error('Failed to generate client statement:', error);
    throw error;
  }
}

export async function getClientStatement(
  statementId: string
): Promise<ClientStatement | null> {
  try {
    const result = await query(
      `SELECT * FROM client_statements WHERE id = $1`,
      [statementId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const statement = result.rows[0];

    // Get billable entries
    const entriesResult = await query(
      `SELECT * FROM billable_entries
       WHERE retainer_id = $1 AND entry_date BETWEEN $2 AND $3
       ORDER BY entry_date ASC`,
      [statement.retainer_id, statement.start_date, statement.end_date]
    );

    const billableEntries = entriesResult.rows.map(row => ({
      id: row.id,
      retainerId: row.retainer_id,
      clientId: row.client_id,
      providerId: row.provider_id,
      hours: parseFloat(row.hours),
      hourlyRate: parseFloat(row.hourly_rate),
      amount: parseFloat(row.amount),
      description: row.description,
      entryDate: new Date(row.entry_date),
      billableStatus: row.billable_status,
      createdAt: new Date(row.created_at),
    }));

    return {
      id: statement.id,
      retainerId: statement.retainer_id,
      clientId: statement.client_id,
      providerId: statement.provider_id,
      startDate: new Date(statement.start_date),
      endDate: new Date(statement.end_date),
      totalDeposits: parseFloat(statement.total_deposits),
      totalEarned: parseFloat(statement.total_billed),
      totalBilled: parseFloat(statement.total_billed),
      totalRefunded: parseFloat(statement.total_refunded),
      balanceRemaining: parseFloat(statement.balance_remaining),
      billableEntries,
      generatedAt: new Date(statement.generated_at),
      status: statement.status,
    };
  } catch (error) {
    console.error('Failed to get client statement:', error);
    throw error;
  }
}

// ============================================
// DISPUTE HANDLING
// ============================================

export async function openDispute(
  retainerId: string,
  clientId: string,
  providerId: string,
  amount: number,
  description: string,
  initiatedBy: string
): Promise<Dispute> {
  try {
    const result = await query(
      `INSERT INTO retainer_disputes
       (retainer_id, client_id, provider_id, amount, description, status, initiated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [retainerId, clientId, providerId, amount, description, 'open', initiatedBy]
    );

    // Update retainer status
    await query(
      `UPDATE retainer_agreements SET status = $1 WHERE id = $2`,
      ['disputed', retainerId]
    );

    // Log activity
    await logRetainerActivity(
      retainerId,
      'dispute_opened',
      initiatedBy,
      `Dispute opened: ${description}`
    );

    // Send notifications
    await sendDisputeNotifications(retainerId, clientId, providerId, description);

    return {
      id: result.rows[0].id,
      retainerId,
      clientId,
      providerId,
      amount,
      description,
      status: 'open',
      createdAt: new Date(result.rows[0].created_at),
    };
  } catch (error) {
    console.error('Failed to open dispute:', error);
    throw error;
  }
}

export async function resolveDispute(
  disputeId: string,
  resolution: string,
  resolvedBy: string,
  resolutionType: 'partial_refund' | 'full_refund' | 'accepted'
): Promise<Dispute> {
  try {
    // Get dispute
    const disputeResult = await query(
      `SELECT * FROM retainer_disputes WHERE id = $1`,
      [disputeId]
    );

    if (disputeResult.rows.length === 0) {
      throw new Error('Dispute not found');
    }

    const dispute = disputeResult.rows[0];

    // Update dispute
    const result = await query(
      `UPDATE retainer_disputes
       SET status = $1, resolution = $2, resolved_at = NOW(), resolved_by = $3, resolution_type = $4
       WHERE id = $5
       RETURNING *`,
      ['resolved', resolution, resolvedBy, resolutionType, disputeId]
    );

    // Handle refund if needed
    if (resolutionType === 'partial_refund' || resolutionType === 'full_refund') {
      await requestRefund(
        dispute.retainer_id,
        dispute.client_id,
        dispute.amount,
        `Dispute resolution: ${resolution}`
      );
    }

    // Update retainer status
    await query(
      `UPDATE retainer_agreements SET status = $1 WHERE id = $2`,
      ['active', dispute.retainer_id]
    );

    // Log activity
    await logRetainerActivity(
      dispute.retainer_id,
      'dispute_resolved',
      resolvedBy,
      `Dispute resolved: ${resolution}`
    );

    return {
      id: result.rows[0].id,
      retainerId: dispute.retainer_id,
      clientId: dispute.client_id,
      providerId: dispute.provider_id,
      amount: parseFloat(dispute.amount),
      description: dispute.description,
      status: 'resolved',
      resolution,
      createdAt: new Date(dispute.created_at),
      resolvedAt: new Date(),
    };
  } catch (error) {
    console.error('Failed to resolve dispute:', error);
    throw error;
  }
}

// ============================================
// TAX REPORTING
// ============================================

export async function generateTaxReport(
  retainerId: string,
  providerId: string,
  taxYear: number
): Promise<TaxReportingEntry> {
  try {
    // Get year start and end dates
    const yearStart = new Date(taxYear, 0, 1);
    const yearEnd = new Date(taxYear, 11, 31);

    // Calculate totals for the year
    const balance = await getRetainerBalance(retainerId);

    // Get detailed income by month
    const monthlyResult = await query(
      `SELECT
        DATE_TRUNC('month', entry_date) as month,
        SUM(amount) as monthly_total
       FROM billable_entries
       WHERE retainer_id = $1 AND provider_id = $2
       AND entry_date BETWEEN $3 AND $4
       AND billable_status IN ('approved', 'billed')
       GROUP BY DATE_TRUNC('month', entry_date)
       ORDER BY month ASC`,
      [retainerId, providerId, yearStart, yearEnd]
    );

    // Get refunds
    const refundsResult = await query(
      `SELECT COALESCE(SUM(amount), 0) as total FROM refund_requests
       WHERE retainer_id = $1 AND status = 'processed'
       AND processed_date BETWEEN $2 AND $3`,
      [retainerId, yearStart, yearEnd]
    );

    const totalEarned = balance.totalBilled;
    const totalRefunded = parseFloat(refundsResult.rows[0].total);
    const netRevenue = totalEarned - totalRefunded;

    // Create tax report
    const result = await query(
      `INSERT INTO tax_reporting_entries
       (retainer_id, provider_id, tax_year, total_earned, total_billed, total_refunded, net_revenue)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [retainerId, providerId, taxYear, totalEarned, totalEarned, totalRefunded, netRevenue]
    );

    // Log activity
    await logRetainerActivity(
      retainerId,
      'tax_report_generated',
      providerId,
      `Tax report generated for year ${taxYear}`
    );

    return {
      id: result.rows[0].id,
      retainerId,
      providerId,
      taxYear,
      totalEarned,
      totalBilled: totalEarned,
      totalRefunded,
      discountedAmount: 0,
      netRevenue,
      generatedAt: new Date(),
    };
  } catch (error) {
    console.error('Failed to generate tax report:', error);
    throw error;
  }
}

export async function getTaxReports(
  providerId: string,
  taxYear?: number
): Promise<TaxReportingEntry[]> {
  try {
    let sql = `SELECT * FROM tax_reporting_entries WHERE provider_id = $1`;
    const params: any[] = [providerId];

    if (taxYear) {
      sql += ` AND tax_year = $2`;
      params.push(taxYear);
    }

    sql += ` ORDER BY tax_year DESC`;

    const result = await query(sql, params);

    return result.rows.map(row => ({
      id: row.id,
      retainerId: row.retainer_id,
      providerId: row.provider_id,
      taxYear: row.tax_year,
      totalEarned: parseFloat(row.total_earned),
      totalBilled: parseFloat(row.total_billed),
      totalRefunded: parseFloat(row.total_refunded),
      discountedAmount: parseFloat(row.discounted_amount || 0),
      netRevenue: parseFloat(row.net_revenue),
      generatedAt: new Date(row.generated_at),
    }));
  } catch (error) {
    console.error('Failed to get tax reports:', error);
    throw error;
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

async function updateRetainerStatus(retainerId: string): Promise<void> {
  try {
    const balance = await getRetainerBalance(retainerId);

    let newStatus = 'active';
    if (balance.availableBalance <= 0) {
      newStatus = 'depleted';
    } else if (balance.totalBilled > 0) {
      newStatus = 'partially_used';
    }

    await query(
      `UPDATE retainer_agreements SET status = $1, updated_at = NOW() WHERE id = $2`,
      [newStatus, retainerId]
    );
  } catch (error) {
    console.error('Failed to update retainer status:', error);
  }
}

async function logRetainerActivity(
  retainerId: string,
  action: string,
  userId: string,
  description: string
): Promise<void> {
  try {
    await query(
      `INSERT INTO retainer_audit_log (retainer_id, action, user_id, description)
       VALUES ($1, $2, $3, $4)`,
      [retainerId, action, userId, description]
    );
  } catch (error) {
    console.error('Failed to log retainer activity:', error);
  }
}

async function sendRetainerNotification(
  clientId: string,
  providerId: string,
  subject: string,
  message: string
): Promise<void> {
  try {
    const clientResult = await query(`SELECT email FROM users WHERE id = $1`, [clientId]);
    const providerResult = await query(`SELECT email FROM users WHERE id = $1`, [providerId]);

    if (clientResult.rows.length > 0) {
      await sendEmailNotification(clientResult.rows[0].email, subject, message);
    }

    if (providerResult.rows.length > 0) {
      await sendEmailNotification(providerResult.rows[0].email, subject, message);
    }
  } catch (error) {
    console.error('Failed to send retainer notification:', error);
  }
}

async function sendRefundNotification(
  retainerId: string,
  amount: number,
  reason: string,
  status: string
): Promise<void> {
  try {
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@transcend-law.com';
    const message = `Refund request for retainer ${retainerId}: $${amount}. Reason: ${reason}. Status: ${status}`;
    await sendEmailNotification(adminEmail, 'Retainer Refund Notification', message);
  } catch (error) {
    console.error('Failed to send refund notification:', error);
  }
}

async function sendClientStatement(clientId: string, statementId: string): Promise<void> {
  try {
    const clientResult = await query(`SELECT email FROM users WHERE id = $1`, [clientId]);

    if (clientResult.rows.length > 0) {
      const message = `Your retainer statement ${statementId} has been generated. Please review it in your account.`;
      await sendEmailNotification(
        clientResult.rows[0].email,
        'Retainer Statement Generated',
        message
      );
    }
  } catch (error) {
    console.error('Failed to send client statement:', error);
  }
}

async function sendDisputeNotifications(
  retainerId: string,
  clientId: string,
  providerId: string,
  description: string
): Promise<void> {
  try {
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@transcend-law.com';
    await sendEmailNotification(
      adminEmail,
      'Retainer Dispute Opened',
      `A dispute has been opened for retainer ${retainerId}. Description: ${description}`
    );

    const clientResult = await query(`SELECT email FROM users WHERE id = $1`, [clientId]);
    if (clientResult.rows.length > 0) {
      await sendEmailNotification(
        clientResult.rows[0].email,
        'Retainer Dispute Opened',
        `A dispute has been opened on your retainer. Our team will investigate and resolve this matter.`
      );
    }

    const providerResult = await query(`SELECT email FROM users WHERE id = $1`, [providerId]);
    if (providerResult.rows.length > 0) {
      await sendEmailNotification(
        providerResult.rows[0].email,
        'Retainer Dispute Opened',
        `A dispute has been opened on your retainer. Our team will investigate and resolve this matter.`
      );
    }
  } catch (error) {
    console.error('Failed to send dispute notifications:', error);
  }
}

export default {
  createRetainerAgreement,
  getRetainerAgreement,
  getRetainersByClient,
  getRetainersByProvider,
  depositRetainerFunds,
  getRetainerDeposits,
  addBillableEntry,
  approveBillableEntry,
  getBillableEntries,
  getRetainerBalance,
  requestRefund,
  approveRefund,
  processRefund,
  denyRefund,
  generateClientStatement,
  getClientStatement,
  openDispute,
  resolveDispute,
  generateTaxReport,
  getTaxReports,
};
